const path = require('path');
const fs = require('fs/promises');
const pool = require('../db');
const { getStorageProvider } = require('../services/storage');

const enqueueAssetObjectDelete = async (client, asset, { assetId = null } = {}) => {
  const storageProvider = asset?.storage_provider;
  const storagePath = asset?.storage_path;
  if (!storageProvider || !storagePath) {
    return null;
  }

  const { rows } = await client.query(
    `
      INSERT INTO asset_delete_jobs (asset_id, storage_provider, storage_path)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [assetId || asset.id || null, storageProvider, storagePath],
  );
  return rows[0]?.id || null;
};

const softDeleteAsset = async (client, assetId, deletedByUserId = null) => {
  const { rows } = await client.query(
    `
      UPDATE assets
      SET deleted_at = COALESCE(deleted_at, now()),
          deleted_by_user_id = COALESCE(deleted_by_user_id, $2)
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id, storage_provider, storage_path
    `,
    [assetId, deletedByUserId],
  );

  const asset = rows[0];
  if (!asset) {
    return null;
  }

  await enqueueAssetObjectDelete(client, asset, { assetId });
  return asset;
};

const softDeleteOrphanAssets = async (client, assetIds = [], deletedByUserId = null) => {
  const uniqueAssetIds = [...new Set(assetIds.filter(Boolean))];
  if (!uniqueAssetIds.length) {
    return [];
  }

  const { rows } = await client.query(
    `
      UPDATE assets a
      SET deleted_at = COALESCE(a.deleted_at, now()),
          deleted_by_user_id = COALESCE(a.deleted_by_user_id, $2)
      WHERE a.id = ANY($1::uuid[])
        AND a.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM lesson_assets la WHERE la.asset_id = a.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM lesson_submission_files lsf WHERE lsf.asset_id = a.id
        )
      RETURNING a.id, a.storage_provider, a.storage_path
    `,
    [uniqueAssetIds, deletedByUserId],
  );

  for (const asset of rows) {
    await enqueueAssetObjectDelete(client, asset, { assetId: asset.id });
  }

  return rows;
};

const deleteLocalObject = async (storagePath) => {
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  const normalized = String(storagePath || '').replace(/^\/+/, '');
  const relative = normalized.startsWith('uploads/')
    ? normalized.slice('uploads/'.length)
    : normalized;
  const target = path.resolve(uploadsDir, relative);
  if (!target.startsWith(`${uploadsDir}${path.sep}`)) {
    throw new Error('Refusing to delete local object outside uploads directory');
  }
  await fs.unlink(target).catch((err) => {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  });
};

const deleteStorageObject = async ({ storageProvider, storagePath }) => {
  if (storageProvider === 'r2') {
    await getStorageProvider('r2').deleteObject({ key: storagePath });
    return;
  }

  if (storageProvider === 'local') {
    await deleteLocalObject(storagePath);
    return;
  }

  throw new Error(`Unsupported storage provider "${storageProvider}"`);
};

const processPendingAssetDeletes = async ({ limit = 50 } = {}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: jobs } = await client.query(
      `
        SELECT id, storage_provider, storage_path, attempts
        FROM asset_delete_jobs
        WHERE status IN ('pending', 'failed', 'processing')
          AND (next_attempt_at IS NULL OR next_attempt_at <= now())
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `,
      [limit],
    );
    if (jobs.length) {
      await client.query(
        `
          UPDATE asset_delete_jobs
          SET status = 'processing',
              next_attempt_at = now() + interval '15 minutes'
          WHERE id = ANY($1::uuid[])
        `,
        [jobs.map((job) => job.id)],
      );
    }
    await client.query('COMMIT');

    let deleted = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        await deleteStorageObject({
          storageProvider: job.storage_provider,
          storagePath: job.storage_path,
        });
        await client.query(
          `
            UPDATE asset_delete_jobs
            SET status = 'deleted',
                attempts = attempts + 1,
                last_error = NULL,
                processed_at = now(),
                next_attempt_at = NULL
            WHERE id = $1
          `,
          [job.id],
        );
        deleted += 1;
      } catch (err) {
        await client.query(
          `
            UPDATE asset_delete_jobs
            SET status = 'failed',
                attempts = attempts + 1,
                last_error = $2,
                next_attempt_at = now() + interval '15 minutes'
            WHERE id = $1
          `,
          [job.id, err.message || 'Failed to delete object'],
        );
        failed += 1;
      }
    }

    return { scanned: jobs.length, deleted, failed };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Transaction may already be committed before object deletion starts.
    }
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  enqueueAssetObjectDelete,
  softDeleteAsset,
  softDeleteOrphanAssets,
  processPendingAssetDeletes,
};

const { processPendingAssetDeletes } = require('../src/utils/assetDeletion');
const pool = require('../src/db');

const main = async () => {
  const limit = Number(process.argv[2] || process.env.ASSET_GC_LIMIT || 50);
  const result = await processPendingAssetDeletes({ limit });
  console.log(JSON.stringify(result));
};

main()
  .catch((err) => {
    console.error('Asset garbage collection failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

exports.up = async (knex) => {
  await knex.schema.createTable("lesson_submissions", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("lesson_id")
      .notNullable()
      .references("id")
      .inTable("lessons")
      .onDelete("CASCADE");
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.text("status").notNullable();
    table.text("content_text").nullable();
    table.timestamp("submitted_at", { useTz: true }).nullable();
    table.timestamp("reviewed_at", { useTz: true }).nullable();
    table
      .uuid("reviewed_by")
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    table.decimal("grade", 8, 2).nullable();
    table.text("feedback").nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(["lesson_id", "user_id"], "lesson_submissions_lesson_user_unique");
    table.index(["lesson_id", "status"], "idx_lesson_submissions_lesson_status");
    table.check(
      "status IN ('pending', 'submitted', 'submitted_late', 'reviewed', 'returned')",
      [],
      "lesson_submissions_status_check",
    );
  });

  await knex.schema.createTable("lesson_submission_files", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("submission_id")
      .notNullable()
      .references("id")
      .inTable("lesson_submissions")
      .onDelete("CASCADE");
    table
      .uuid("asset_id")
      .notNullable()
      .references("id")
      .inTable("assets")
      .onDelete("CASCADE");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(["submission_id", "asset_id"], "lesson_submission_files_submission_asset_unique");
    table.index(["asset_id"], "idx_lesson_submission_files_asset");
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("lesson_submission_files");
  await knex.schema.dropTableIfExists("lesson_submissions");
};

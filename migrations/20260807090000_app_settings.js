exports.up = async (knex) => {
  await knex.schema.createTable("app_settings", (table) => {
    table.text("key").primary();
    table.jsonb("value").notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    table
      .uuid("updated_by")
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("app_settings");
};

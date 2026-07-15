exports.up = async (knex) => {
  const columns = [
    ["available_from", (table) => table.timestamp("available_from", { useTz: true }).nullable()],
    ["due_at", (table) => table.timestamp("due_at", { useTz: true }).nullable()],
    [
      "allow_late_submission",
      (table) => table.boolean("allow_late_submission").notNullable().defaultTo(false),
    ],
    ["late_until", (table) => table.timestamp("late_until", { useTz: true }).nullable()],
    [
      "requires_submission",
      (table) => table.boolean("requires_submission").notNullable().defaultTo(false),
    ],
  ];

  for (const [columnName, addColumn] of columns) {
    const hasColumn = await knex.schema.hasColumn("lessons", columnName);
    if (!hasColumn) {
      await knex.schema.alterTable("lessons", (table) => {
        addColumn(table);
      });
    }
  }
};

exports.down = async (knex) => {
  const columns = [
    "requires_submission",
    "late_until",
    "allow_late_submission",
    "due_at",
    "available_from",
  ];

  for (const columnName of columns) {
    const hasColumn = await knex.schema.hasColumn("lessons", columnName);
    if (hasColumn) {
      await knex.schema.alterTable("lessons", (table) => {
        table.dropColumn(columnName);
      });
    }
  }
};

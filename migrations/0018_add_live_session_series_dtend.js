exports.up = function (knex) {
  return knex.schema.alterTable('live_session_series', (table) => {
    table.timestamp('dtend', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('live_session_series', (table) => {
    table.dropColumn('dtend');
  });
};

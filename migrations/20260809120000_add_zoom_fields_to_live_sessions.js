exports.up = async function up(knex) {
  await knex.schema.alterTable('live_sessions', (table) => {
    table.text('zoom_meeting_id').nullable();
    table.text('zoom_meeting_uuid').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('live_sessions', (table) => {
    table.dropColumn('zoom_meeting_uuid');
    table.dropColumn('zoom_meeting_id');
  });
};

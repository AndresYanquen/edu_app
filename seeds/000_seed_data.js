const { randomUUID } = require('node:crypto');

const uuid = () => randomUUID();
const TIMESTAMP = new Date().toISOString();
const PASSWORD_HASH = '$2a$10$SYm36506oapBKJFZGySHc.In4qyqGcGAirduhwjf9ON7VB8iK4MMW'; // "password"

const admin = { id: uuid(), email: 'admin@academy.local', fullName: 'Alex Rivera' };
const instructors = [
  { id: uuid(), email: 'natalie.roberts@academy.local', fullName: 'Natalie Roberts' },
  { id: uuid(), email: 'marco.alvarez@academy.local', fullName: 'Marco Alvarez' },
];

const students = [
  { id: uuid(), email: 'ava.parker@academy.local', fullName: 'Ava Parker' },
  { id: uuid(), email: 'liam.singh@academy.local', fullName: 'Liam Singh' },
  { id: uuid(), email: 'emily.chen@academy.local', fullName: 'Emily Chen' },
  { id: uuid(), email: 'noah.johnson@academy.local', fullName: 'Noah Johnson' },
  { id: uuid(), email: 'mia.rodriguez@academy.local', fullName: 'Mia Rodriguez' },
  { id: uuid(), email: 'lucas.patel@academy.local', fullName: 'Lucas Patel' },
  { id: uuid(), email: 'sophia.martinez@academy.local', fullName: 'Sophia Martinez' },
  { id: uuid(), email: 'ethan.kim@academy.local', fullName: 'Ethan Kim' },
  { id: uuid(), email: 'harper.davis@academy.local', fullName: 'Harper Davis' },
  { id: uuid(), email: 'isabella.lopez@academy.local', fullName: 'Isabella Lopez' },
  { id: uuid(), email: 'mason.rivera@academy.local', fullName: 'Mason Rivera' },
  { id: uuid(), email: 'amelia.nguyen@academy.local', fullName: 'Amelia Nguyen' },
  { id: uuid(), email: 'logan.brooks@academy.local', fullName: 'Logan Brooks' },
  { id: uuid(), email: 'chloe.ramirez@academy.local', fullName: 'Chloe Ramirez' },
  { id: uuid(), email: 'ben.scott@academy.local', fullName: 'Benjamin Scott' },
];

const allUsers = [admin, ...instructors, ...students];

const buildUserRow = (user) => ({
  id: user.id,
  email: user.email,
  password_hash: PASSWORD_HASH,
  full_name: user.fullName,
  status: 'active',
  created_at: TIMESTAMP,
});

const memberships = [
  { id: uuid(), user_id: admin.id, role: 'admin', status: 'active', joined_at: TIMESTAMP },
  ...instructors.map((user) => ({
    id: uuid(),
    user_id: user.id,
    role: 'instructor',
    status: 'active',
    joined_at: TIMESTAMP,
  })),
  ...students.map((user) => ({
    id: uuid(),
    user_id: user.id,
    role: 'student',
    status: 'active',
    joined_at: TIMESTAMP,
  })),
];

const courseFullStackId = uuid();
const courseAnalyticsId = uuid();

const moduleFsIntroId = uuid();
const moduleFsBackendId = uuid();
const moduleAnalyticsPrepId = uuid();
const moduleAnalyticsStoryId = uuid();

const lessonFsIntroId = uuid();
const lessonFsHtmlCssId = uuid();
const lessonFsNodeId = uuid();
const lessonFsApiDesignId = uuid();
const lessonAnalyticsMindsetId = uuid();
const lessonAnalyticsSqlId = uuid();
const lessonAnalyticsSheetsId = uuid();
const lessonAnalyticsStorytellingId = uuid();

const assetChecklistId = uuid();
const assetSqlCheatSheetId = uuid();

const groupFsWeeknightId = uuid();
const groupFsWeekendId = uuid();
const groupAnalyticsMorningId = uuid();
const groupAnalyticsEveningId = uuid();

const usersRows = allUsers.map(buildUserRow);

const courses = [
  {
    id: courseFullStackId,
    title: 'Full Stack Web Bootcamp',
    description: 'Immersive bootcamp that covers front-end and back-end fundamentals.',
    level: 'B2',
    status: 'published',
    owner_user_id: instructors[0].id,
    created_at: TIMESTAMP,
    published_at: TIMESTAMP,
  },
  {
    id: courseAnalyticsId,
    title: 'Data Analytics Foundations',
    description: 'SQL-first analytics with dashboards and storytelling practice.',
    level: 'B1',
    status: 'published',
    owner_user_id: instructors[1].id,
    created_at: TIMESTAMP,
    published_at: TIMESTAMP,
  },
];

const modules = [
  { id: moduleFsIntroId, course_id: courseFullStackId, title: 'Web Fundamentals', position: 1, created_at: TIMESTAMP },
  { id: moduleFsBackendId, course_id: courseFullStackId, title: 'Back-end Foundations', position: 2, created_at: TIMESTAMP },
  { id: moduleAnalyticsPrepId, course_id: courseAnalyticsId, title: 'Analytics Preparation', position: 1, created_at: TIMESTAMP },
  { id: moduleAnalyticsStoryId, course_id: courseAnalyticsId, title: 'Visualization & Storytelling', position: 2, created_at: TIMESTAMP },
];

const lessons = [
  {
    id: lessonFsIntroId,
    module_id: moduleFsIntroId,
    title: 'How the Web Works',
    position: 1,
    content_type: 'text',
    content_text: 'Request/response flow, DNS, and basic tooling overview.',
    content_url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP',
    embed_html: null,
    duration_seconds: 1800,
    is_free_preview: true,
    created_at: TIMESTAMP,
  },
  {
    id: lessonFsHtmlCssId,
    module_id: moduleFsIntroId,
    title: 'HTML & CSS Essentials',
    position: 2,
    content_type: 'video',
    content_text: null,
    content_url: 'https://web.dev/learn/css/',
    embed_html: null,
    duration_seconds: 2700,
    is_free_preview: false,
    created_at: TIMESTAMP,
  },
  {
    id: lessonFsNodeId,
    module_id: moduleFsBackendId,
    title: 'Node.js Fundamentals',
    position: 1,
    content_type: 'text',
    content_text: 'Event loop, npm scripts, and modular apps.',
    content_url: 'https://nodejs.org/en/learn',
    embed_html: null,
    duration_seconds: 2400,
    is_free_preview: false,
    created_at: TIMESTAMP,
  },
  {
    id: lessonFsApiDesignId,
    module_id: moduleFsBackendId,
    title: 'Designing REST APIs',
    position: 2,
    content_type: 'link',
    content_text: null,
    content_url: 'https://martinfowler.com/articles/richardsonMaturityModel.html',
    embed_html: null,
    duration_seconds: 2100,
    is_free_preview: false,
    created_at: TIMESTAMP,
  },
  {
    id: lessonAnalyticsMindsetId,
    module_id: moduleAnalyticsPrepId,
    title: 'Analytics Mindset',
    position: 1,
    content_type: 'text',
    content_text: 'Problem framing and KPI planning.',
    content_url: 'https://hbr.org/2012/09/a-refresher-on-regression-analysis',
    embed_html: null,
    duration_seconds: 1500,
    is_free_preview: true,
    created_at: TIMESTAMP,
  },
  {
    id: lessonAnalyticsSqlId,
    module_id: moduleAnalyticsPrepId,
    title: 'SQL for Analysts',
    position: 2,
    content_type: 'video',
    content_text: null,
    content_url: 'https://mode.com/sql-tutorial/',
    embed_html: null,
    duration_seconds: 2400,
    is_free_preview: false,
    created_at: TIMESTAMP,
  },
  {
    id: lessonAnalyticsSheetsId,
    module_id: moduleAnalyticsStoryId,
    title: 'Dashboards in Sheets',
    position: 1,
    content_type: 'text',
    content_text: 'Pivot tables, charts, and automation basics.',
    content_url: 'https://workspace.google.com/learning-center/products/sheets/',
    embed_html: null,
    duration_seconds: 1800,
    is_free_preview: false,
    created_at: TIMESTAMP,
  },
  {
    id: lessonAnalyticsStorytellingId,
    module_id: moduleAnalyticsStoryId,
    title: 'Data Storytelling',
    position: 2,
    content_type: 'link',
    content_text: null,
    content_url: 'https://www.storytellingwithdata.com/',
    embed_html: null,
    duration_seconds: 2100,
    is_free_preview: false,
    created_at: TIMESTAMP,
  },
];

const assets = [
  {
    id: assetChecklistId,
    uploaded_by_user_id: instructors[0].id,
    storage_provider: 'local',
    path: 'assets/fs-web-checklist.pdf',
    mime_type: 'application/pdf',
    size_bytes: 524288,
    created_at: TIMESTAMP,
  },
  {
    id: assetSqlCheatSheetId,
    uploaded_by_user_id: instructors[1].id,
    storage_provider: 'local',
    path: 'assets/sql-cheatsheet.pdf',
    mime_type: 'application/pdf',
    size_bytes: 262144,
    created_at: TIMESTAMP,
  },
];

const lessonAssets = [
  { lesson_id: lessonFsIntroId, asset_id: assetChecklistId },
  { lesson_id: lessonAnalyticsSqlId, asset_id: assetSqlCheatSheetId },
];

const groups = [
  {
    id: groupFsWeeknightId,
    course_id: courseFullStackId,
    name: 'FS - Weeknight Cohort',
    status: 'active',
    schedule_text: 'Mon & Wed 7-9pm',
    created_at: TIMESTAMP,
  },
  {
    id: groupFsWeekendId,
    course_id: courseFullStackId,
    name: 'FS - Weekend Sprint',
    status: 'active',
    schedule_text: 'Sat 10am-2pm',
    created_at: TIMESTAMP,
  },
  {
    id: groupAnalyticsMorningId,
    course_id: courseAnalyticsId,
    name: 'Analytics - Morning Lab',
    status: 'active',
    schedule_text: 'Tue & Thu 9-11am',
    created_at: TIMESTAMP,
  },
  {
    id: groupAnalyticsEveningId,
    course_id: courseAnalyticsId,
    name: 'Analytics - Evening Cohort',
    status: 'active',
    schedule_text: 'Tue & Thu 6-8pm',
    created_at: TIMESTAMP,
  },
];

const groupTeachers = [
  { group_id: groupFsWeeknightId, user_id: instructors[0].id, role: 'lead', assigned_at: TIMESTAMP },
  { group_id: groupFsWeekendId, user_id: instructors[0].id, role: 'assistant', assigned_at: TIMESTAMP },
  { group_id: groupAnalyticsMorningId, user_id: instructors[1].id, role: 'lead', assigned_at: TIMESTAMP },
  { group_id: groupAnalyticsEveningId, user_id: instructors[1].id, role: 'assistant', assigned_at: TIMESTAMP },
];

const groupStudentAssignments = [
  { groupId: groupFsWeeknightId, studentIndexes: [0, 1, 2, 3] },
  { groupId: groupFsWeekendId, studentIndexes: [4, 5, 6, 7, 8] },
  { groupId: groupAnalyticsMorningId, studentIndexes: [0, 1, 2, 9, 10] },
  { groupId: groupAnalyticsEveningId, studentIndexes: [8, 11, 12, 13, 14] },
];

const groupStudents = groupStudentAssignments.flatMap(({ groupId, studentIndexes }) =>
  studentIndexes.map((index) => ({
    group_id: groupId,
    user_id: students[index].id,
    joined_at: TIMESTAMP,
    status: 'active',
  })),
);

const enrollments = [];
const enrollInCourse = (courseId, studentIndex) => {
  enrollments.push({
    id: uuid(),
    course_id: courseId,
    user_id: students[studentIndex].id,
    status: 'active',
    enrolled_at: TIMESTAMP,
  });
};

[0, 1, 2, 3, 4, 5, 6, 7, 8].forEach((index) => enrollInCourse(courseFullStackId, index));
[5, 6, 8, 9, 10, 11, 12, 13, 14].forEach((index) => enrollInCourse(courseAnalyticsId, index));

const lessonProgress = [
  {
    user_id: students[0].id,
    lesson_id: lessonFsIntroId,
    status: 'done',
    progress_percent: 100,
    last_seen_at: TIMESTAMP,
  },
  {
    user_id: students[0].id,
    lesson_id: lessonFsHtmlCssId,
    status: 'in_progress',
    progress_percent: 60,
    last_seen_at: TIMESTAMP,
  },
  {
    user_id: students[1].id,
    lesson_id: lessonFsIntroId,
    status: 'done',
    progress_percent: 100,
    last_seen_at: TIMESTAMP,
  },
  {
    user_id: students[9].id,
    lesson_id: lessonAnalyticsMindsetId,
    status: 'done',
    progress_percent: 100,
    last_seen_at: TIMESTAMP,
  },
  {
    user_id: students[9].id,
    lesson_id: lessonAnalyticsSqlId,
    status: 'not_started',
    progress_percent: null,
    last_seen_at: TIMESTAMP,
  },
  {
    user_id: students[12].id,
    lesson_id: lessonAnalyticsSqlId,
    status: 'in_progress',
    progress_percent: 45,
    last_seen_at: TIMESTAMP,
  },
];

exports.seed = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      TRUNCATE TABLE
        announcements,
        lesson_assets,
        assets,
        lesson_progress,
        enrollments,
        group_students,
        group_teachers,
        groups,
        lessons,
        modules,
        courses,
        academy_memberships,
        users
      RESTART IDENTITY CASCADE
    `);

    await trx('users').insert(usersRows);
    await trx('academy_memberships').insert(memberships);
    await trx('courses').insert(courses);
    await trx('modules').insert(modules);
    await trx('lessons').insert(lessons);
    await trx('assets').insert(assets);
    await trx('lesson_assets').insert(lessonAssets);
    await trx('groups').insert(groups);
    await trx('group_teachers').insert(groupTeachers);
    await trx('group_students').insert(groupStudents);
    await trx('enrollments').insert(enrollments);
    await trx('lesson_progress').insert(lessonProgress);
  });
};

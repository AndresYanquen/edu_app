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

const ROLE_NAMES = ['admin', 'instructor', 'student', 'content_editor', 'enrollment_manager'];
const roleRows = ROLE_NAMES.map((name) => ({
  id: uuid(),
  name,
  created_at: TIMESTAMP,
}));
const roleIdByName = roleRows.reduce((acc, role) => {
  acc[role.name] = role.id;
  return acc;
}, {});

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

const userRoles = memberships
  .map((membership) => {
    const roleId = roleIdByName[membership.role];
    if (!roleId) {
      return null;
    }
    return {
      user_id: membership.user_id,
      role_id: roleId,
    };
  })
  .filter(Boolean);

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
const quizQuestionOneId = uuid();
const quizQuestionTwoId = uuid();
const quizQuestionThreeId = uuid();

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
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    created_at: TIMESTAMP,
  },
  {
    id: courseAnalyticsId,
    title: 'Data Analytics Foundations',
    description: 'SQL-first analytics with dashboards and storytelling practice.',
    level: 'B1',
    status: 'published',
    owner_user_id: instructors[1].id,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    created_at: TIMESTAMP,
  },
];

const modules = [
  {
    id: moduleFsIntroId,
    course_id: courseFullStackId,
    title: 'Web Fundamentals',
    position: 1,
    order_index: 1,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    created_at: TIMESTAMP,
  },
  {
    id: moduleFsBackendId,
    course_id: courseFullStackId,
    title: 'Back-end Foundations',
    position: 2,
    order_index: 2,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    created_at: TIMESTAMP,
  },
  {
    id: moduleAnalyticsPrepId,
    course_id: courseAnalyticsId,
    title: 'Analytics Preparation',
    position: 1,
    order_index: 1,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    created_at: TIMESTAMP,
  },
  {
    id: moduleAnalyticsStoryId,
    course_id: courseAnalyticsId,
    title: 'Visualization & Storytelling',
    position: 2,
    order_index: 2,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    created_at: TIMESTAMP,
  },
];

const lessons = [
  {
    id: lessonFsIntroId,
    module_id: moduleFsIntroId,
    title: 'How the Web Works',
    position: 1,
    content_type: 'text',
    content_text:
      'Trace the full journey of an HTTP request, from DNS lookups to TLS handshakes, and practice using browser DevTools to inspect headers and payloads like an English-speaking engineer.',
    video_url: 'https://www.youtube.com/watch?v=f02mOEt11OQ',
    content_url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP',
    embed_html: null,
    duration_seconds: 1800,
    estimated_minutes: 12,
    is_free_preview: true,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    order_index: 1,
    created_at: TIMESTAMP,
  },
  {
    id: lessonFsHtmlCssId,
    module_id: moduleFsIntroId,
    title: 'HTML & CSS Essentials',
    position: 2,
    content_type: 'video',
    content_text:
      'Compose accessible semantic layouts, apply modern Flexbox/Grid utilities, and describe UI behavior clearly to cross-functional teammates.',
    video_url: 'https://www.youtube.com/watch?v=1Rs2ND1ryYc',
    content_url: 'https://web.dev/learn/css/',
    embed_html: null,
    duration_seconds: 2700,
    estimated_minutes: 15,
    is_free_preview: false,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    order_index: 2,
    created_at: TIMESTAMP,
  },
  {
    id: lessonFsNodeId,
    module_id: moduleFsBackendId,
    title: 'Node.js Fundamentals',
    position: 1,
    content_type: 'text',
    content_text:
      'Review the event loop, learn how to organize npm scripts, and explain asynchronous flows with the confident language expected in remote stand-ups.',
    video_url: null,
    content_url: 'https://nodejs.org/en/learn',
    embed_html: null,
    duration_seconds: 2400,
    estimated_minutes: 10,
    is_free_preview: false,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    order_index: 1,
    created_at: TIMESTAMP,
  },
  {
    id: lessonFsApiDesignId,
    module_id: moduleFsBackendId,
    title: 'Designing REST APIs',
    position: 2,
    content_type: 'link',
    content_text:
      'Write clear English descriptions of resources, choose verbs that communicate intent, and document status codes your stakeholders can trust.',
    video_url: null,
    content_url: 'https://martinfowler.com/articles/richardsonMaturityModel.html',
    embed_html: null,
    duration_seconds: 2100,
    estimated_minutes: 9,
    is_free_preview: false,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    order_index: 2,
    created_at: TIMESTAMP,
  },
  {
    id: lessonAnalyticsMindsetId,
    module_id: moduleAnalyticsPrepId,
    title: 'Analytics Mindset',
    position: 1,
    content_type: 'text',
    content_text:
      'Practice framing messy business questions, define KPIs in plain English, and align stakeholders before running a single query.',
    video_url: null,
    content_url: 'https://hbr.org/2012/09/a-refresher-on-regression-analysis',
    embed_html: null,
    duration_seconds: 1500,
    estimated_minutes: 8,
    is_free_preview: true,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    order_index: 1,
    created_at: TIMESTAMP,
  },
  {
    id: lessonAnalyticsSqlId,
    module_id: moduleAnalyticsPrepId,
    title: 'SQL for Analysts',
    position: 2,
    content_type: 'video',
    content_text:
      'Narrate your SQL in business-friendly language while writing joins, filters, and aggregations that survive real stakeholder scrutiny.',
    video_url: 'https://www.youtube.com/watch?v=HXV3zeQKqGY',
    content_url: 'https://mode.com/sql-tutorial/',
    embed_html: null,
    duration_seconds: 2400,
    estimated_minutes: 14,
    is_free_preview: false,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    order_index: 2,
    created_at: TIMESTAMP,
  },
  {
    id: lessonAnalyticsSheetsId,
    module_id: moduleAnalyticsStoryId,
    title: 'Dashboards in Sheets',
    position: 1,
    content_type: 'text',
    content_text: 'Pivot tables, charts, and automation basics.',
    video_url: null,
    content_url: 'https://workspace.google.com/learning-center/products/sheets/',
    embed_html: null,
    duration_seconds: 1800,
    estimated_minutes: 11,
    is_free_preview: false,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    order_index: 1,
    created_at: TIMESTAMP,
  },
  {
    id: lessonAnalyticsStorytellingId,
    module_id: moduleAnalyticsStoryId,
    title: 'Data Storytelling',
    position: 2,
    content_type: 'link',
    content_text: null,
    video_url: null,
    content_url: 'https://www.storytellingwithdata.com/',
    embed_html: null,
    duration_seconds: 2100,
    estimated_minutes: 10,
    is_free_preview: false,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    order_index: 2,
    created_at: TIMESTAMP,
  },
];

const quizQuestions = [
  {
    id: quizQuestionOneId,
    lesson_id: lessonAnalyticsMindsetId,
    question_text: 'When presenting a KPI to stakeholders, what should you explain first?',
    question_type: 'single_choice',
    order_index: 1,
    created_at: TIMESTAMP,
  },
  {
    id: quizQuestionTwoId,
    lesson_id: lessonAnalyticsMindsetId,
    question_text: 'Which sentence best rewrites a vague request into an actionable analytics task?',
    question_type: 'single_choice',
    order_index: 2,
    created_at: TIMESTAMP,
  },
  {
    id: quizQuestionThreeId,
    lesson_id: lessonAnalyticsMindsetId,
    question_text: 'True or False: You should confirm the business problem before writing SQL queries.',
    question_type: 'true_false',
    order_index: 3,
    created_at: TIMESTAMP,
  },
];

const quizOptions = [
  {
    id: uuid(),
    question_id: quizQuestionOneId,
    option_text: 'The business objective the KPI supports.',
    is_correct: true,
    order_index: 1,
  },
  {
    id: uuid(),
    question_id: quizQuestionOneId,
    option_text: 'Every SQL join used to calculate it.',
    is_correct: false,
    order_index: 2,
  },
  {
    id: uuid(),
    question_id: quizQuestionOneId,
    option_text: 'Your favorite dashboard color palette.',
    is_correct: false,
    order_index: 3,
  },
  {
    id: uuid(),
    question_id: quizQuestionOneId,
    option_text: 'The number of slides in your presentation.',
    is_correct: false,
    order_index: 4,
  },
  {
    id: uuid(),
    question_id: quizQuestionTwoId,
    option_text: '"Find insights from the data ASAP."',
    is_correct: false,
    order_index: 1,
  },
  {
    id: uuid(),
    question_id: quizQuestionTwoId,
    option_text: '"Investigate why churn rose 4% last month in LATAM and propose two hypotheses."',
    is_correct: true,
    order_index: 2,
  },
  {
    id: uuid(),
    question_id: quizQuestionTwoId,
    option_text: '"Make a chart that looks modern."',
    is_correct: false,
    order_index: 3,
  },
  {
    id: uuid(),
    question_id: quizQuestionTwoId,
    option_text: '"Email leadership once you find something surprising."',
    is_correct: false,
    order_index: 4,
  },
  {
    id: uuid(),
    question_id: quizQuestionThreeId,
    option_text: 'True',
    is_correct: false,
    order_index: 1,
  },
  {
    id: uuid(),
    question_id: quizQuestionThreeId,
    option_text: 'False',
    is_correct: true,
    order_index: 2,
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

const courseStaffAssignments = [
  {
    courseId: courseFullStackId,
    userId: instructors[0].id,
    roles: ['instructor', 'content_editor'],
  },
  {
    courseId: courseAnalyticsId,
    userId: instructors[1].id,
    roles: ['instructor', 'enrollment_manager'],
  },
  {
    courseId: courseAnalyticsId,
    userId: instructors[0].id,
    roles: ['content_editor'],
  },
];

const courseUserRoles = courseStaffAssignments.flatMap(({ courseId, userId, roles }) =>
  roles
    .map((roleName) => ({
      course_id: courseId,
      user_id: userId,
      role_id: roleIdByName[roleName],
    }))
    .filter((entry) => Boolean(entry.role_id)),
);

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
        course_user_roles,
        user_roles,
        roles,
        quiz_attempts,
        quiz_options,
        quiz_questions,
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

    await trx('roles').insert(roleRows);
    await trx('users').insert(usersRows);
    await trx('academy_memberships').insert(memberships);
    await trx('user_roles').insert(userRoles);
    await trx('courses').insert(courses);
    await trx('course_user_roles').insert(courseUserRoles);
    await trx('modules').insert(modules);
    await trx('lessons').insert(lessons);
    await trx('quiz_questions').insert(quizQuestions);
    await trx('quiz_options').insert(quizOptions);
    await trx('assets').insert(assets);
    await trx('lesson_assets').insert(lessonAssets);
    await trx('groups').insert(groups);
    await trx('group_teachers').insert(groupTeachers);
    await trx('group_students').insert(groupStudents);
    await trx('enrollments').insert(enrollments);
    await trx('lesson_progress').insert(lessonProgress);
  });
};

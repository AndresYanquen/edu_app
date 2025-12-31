const { randomUUID } = require('node:crypto');

const uuid = () => randomUUID();
const TIMESTAMP = new Date().toISOString();
const PASSWORD_HASH = '$2a$10$ED7AmyVF7i.vps96ZMLf6.ajCnBBVtWt1FuzNsuGxMmCWCrpwDzDK'; // "Password123!"

const makeUser = (email, fullName) => ({
  id: uuid(),
  email,
  fullName,
});

const admin = makeUser('admin@academy.local', 'Jordan Avery');
const instructors = [
  makeUser('lena.carter@academy.local', 'Lena Carter'),
  makeUser('darius.ford@academy.local', 'Darius Ford'),
];
const contentEditor = makeUser('priya.desai@academy.local', 'Priya Desai');
const enrollmentManager = makeUser('noah.fox@academy.local', 'Noah Fox');
const students = [
  makeUser('mia.garcia@academy.local', 'Mia Garcia'),
  makeUser('isaac.rivera@academy.local', 'Isaac Rivera'),
  makeUser('sloan.kim@academy.local', 'Sloan Kim'),
  makeUser('nora.mitchell@academy.local', 'Nora Mitchell'),
  makeUser('parker.jones@academy.local', 'Parker Jones'),
  makeUser('olive.bennett@academy.local', 'Olive Bennett'),
];

const allUsers = [admin, ...instructors, contentEditor, enrollmentManager, ...students];

const ROLE_NAMES = ['admin', 'student', 'instructor', 'content_editor', 'enrollment_manager'];
const roleRows = ROLE_NAMES.map((name) => ({
  id: uuid(),
  name,
  created_at: TIMESTAMP,
}));
const roleIdByName = roleRows.reduce((acc, role) => {
  acc[role.name] = role.id;
  return acc;
}, {});

const userRows = allUsers.map((user) => ({
  id: user.id,
  email: user.email,
  password_hash: PASSWORD_HASH,
  full_name: user.fullName,
  status: 'active',
  is_active: true,
  must_set_password: false,
  created_at: TIMESTAMP,
}));

const userRoles = [
  { user_id: admin.id, role_id: roleIdByName.admin },
  ...instructors.map((user) => ({
    user_id: user.id,
    role_id: roleIdByName.instructor,
  })),
  { user_id: contentEditor.id, role_id: roleIdByName.content_editor },
  { user_id: enrollmentManager.id, role_id: roleIdByName.enrollment_manager },
  ...students.map((student) => ({
    user_id: student.id,
    role_id: roleIdByName.student,
  })),
];

const courseFullStackId = uuid();
const courseAnalyticsId = uuid();

const courses = [
  {
    id: courseFullStackId,
    title: 'Full Stack Launchpad',
    description: 'Modern JavaScript, APIs, and deployment workflows for juniors.',
    level: 'B2',
    status: 'published',
    owner_user_id: admin.id,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    created_at: TIMESTAMP,
  },
  {
    id: courseAnalyticsId,
    title: 'Product Analytics Studio',
    description: 'Hands-on SQL and dashboard storytelling for product teams.',
    level: 'B1',
    status: 'published',
    owner_user_id: admin.id,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    created_at: TIMESTAMP,
  },
];

const courseUserRoles = [
  // Course 1 staff
  { course_id: courseFullStackId, user_id: instructors[0].id, role_id: roleIdByName.instructor },
  { course_id: courseFullStackId, user_id: contentEditor.id, role_id: roleIdByName.content_editor },
  {
    course_id: courseFullStackId,
    user_id: enrollmentManager.id,
    role_id: roleIdByName.enrollment_manager,
  },
  // Course 2 staff
  { course_id: courseAnalyticsId, user_id: instructors[1].id, role_id: roleIdByName.instructor },
  { course_id: courseAnalyticsId, user_id: contentEditor.id, role_id: roleIdByName.content_editor },
  {
    course_id: courseAnalyticsId,
    user_id: enrollmentManager.id,
    role_id: roleIdByName.enrollment_manager,
  },
];

const moduleFsFrontendId = uuid();
const moduleFsBackendId = uuid();
const moduleAnalyticsCoreId = uuid();
const moduleAnalyticsStoryId = uuid();

const modules = [
  {
    id: moduleFsFrontendId,
    course_id: courseFullStackId,
    title: 'Frontend Foundations',
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
    title: 'API & Deployment',
    position: 2,
    order_index: 2,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    created_at: TIMESTAMP,
  },
  {
    id: moduleAnalyticsCoreId,
    course_id: courseAnalyticsId,
    title: 'Analytics Core',
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
    title: 'Dashboards & Storytelling',
    position: 2,
    order_index: 2,
    is_published: true,
    published_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    created_at: TIMESTAMP,
  },
];

const lessonWebBasicsId = uuid();
const lessonAccessibilityId = uuid();
const lessonApiDesignId = uuid();
const lessonDeploymentId = uuid();
const lessonLiveWorkshopId = uuid();
const lessonSqlWarmupId = uuid();
const lessonDataCleaningId = uuid();
const lessonDashboardStoryId = uuid();
const lessonExecReportingId = uuid();

const lessonBody = (text) =>
  text +
  ' This lesson includes starter projects, guided steps, and review questions to help students practice in an English-first environment.';

const upcomingStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const upcomingEnd = new Date(upcomingStart.getTime() + 60 * 60 * 1000);

const lessonEntry = ({
  id,
  moduleId,
  title,
  position,
  contentType = 'text',
  videoUrl = null,
  contentUrl = null,
  contentMarkdown = null,
  durationMinutes = 30,
  liveStartsAt = null,
  meetingUrl = null,
}) => ({
  id,
  module_id: moduleId,
  title,
  position,
  order_index: position,
  content_type: contentType,
  content_text: lessonBody(title),
  content_markdown: contentMarkdown || null,
  video_url: videoUrl,
  content_url: contentUrl,
  live_starts_at: liveStartsAt,
  meeting_url: meetingUrl,
  embed_html: null,
  duration_seconds: durationMinutes * 60,
  estimated_minutes: durationMinutes,
  is_published: true,
  published_at: TIMESTAMP,
  updated_at: TIMESTAMP,
  created_at: TIMESTAMP,
});

const accessibilityRichContent = [
  'In this lesson we audit commonly used components and ensure they pass WCAG checks.',
  '',
  'Watch the accessible patterns talk:',
  'https://www.youtube.com/watch?v=GAWZ3MGRa44',
  '',
  'Reference board screenshot:',
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=60',
  '',
  'Async follow-up demo:',
  'https://www.loom.com/share/0f3fe5a9bb9f42a59549fd26efabcd12',
].join('\n');

const deploymentRichContent = [
  'Review the deployment checklist and follow along with the recorded walkthrough.',
  '',
  'Architecture overview:',
  'https://vimeo.com/76979871',
  '',
  'Terminal session recording:',
  'https://www.loom.com/share/6d9a37a0b4b84d01be13ed51be8c4680',
  '',
  'Rolling-update diagram:',
  'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?auto=format&fit=crop&w=1200&q=60',
].join('\n');

const lessons = [
  lessonEntry({
    id: lessonWebBasicsId,
    moduleId: moduleFsFrontendId,
    title: 'Modern Web Requests',
    position: 1,
    contentUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview',
  }),
  lessonEntry({
    id: lessonAccessibilityId,
    moduleId: moduleFsFrontendId,
    title: 'Accessible Components',
    position: 2,
    videoUrl: 'https://www.youtube.com/watch?v=GAWZ3MGRa44',
    contentMarkdown: accessibilityRichContent,
  }),
  lessonEntry({
    id: lessonApiDesignId,
    moduleId: moduleFsBackendId,
    title: 'Designing Reliable APIs',
    position: 1,
    contentUrl: 'https://martinfowler.com/articles/richardsonMaturityModel.html',
  }),
  lessonEntry({
    id: lessonDeploymentId,
    moduleId: moduleFsBackendId,
    title: 'Deploying Node Services',
    position: 2,
    videoUrl: 'https://www.youtube.com/watch?v=bNLG8GiEYfA',
    contentMarkdown: deploymentRichContent,
  }),
  lessonEntry({
    id: lessonLiveWorkshopId,
    moduleId: moduleFsBackendId,
    title: 'Live Deployment Standup',
    position: 3,
    contentType: 'live',
    contentMarkdown: [
      'Join this live session to walkthrough blue/green deploys and answer questions before cutover.',
      '',
      'Agenda:',
      '- Review stateful service playbook',
      '- Observe rolling updates on staging',
      '- Q&A with SRE',
    ].join('\n'),
    durationMinutes: 45,
    liveStartsAt: upcomingStart.toISOString(),
    meetingUrl: 'https://meet.google.com/abc-live-workshop',
  }),
  lessonEntry({
    id: lessonSqlWarmupId,
    moduleId: moduleAnalyticsCoreId,
    title: 'SQL Warmup',
    position: 1,
    contentUrl: 'https://mode.com/sql-tutorial/introduction-to-sql/',
  }),
  lessonEntry({
    id: lessonDataCleaningId,
    moduleId: moduleAnalyticsCoreId,
    title: 'Cleaning Product Events',
    position: 2,
    videoUrl: 'https://www.youtube.com/watch?v=_V8eKsto3Ug',
  }),
  lessonEntry({
    id: lessonDashboardStoryId,
    moduleId: moduleAnalyticsStoryId,
    title: 'Dashboard Storytelling',
    position: 1,
    contentUrl: 'https://datastudio.google.com',
  }),
  lessonEntry({
    id: lessonExecReportingId,
    moduleId: moduleAnalyticsStoryId,
    title: 'Executive Reporting Rituals',
    position: 2,
    videoUrl: 'https://www.youtube.com/watch?v=miEHe-gItcM',
  }),
];

const assetProjectBriefId = uuid();
const assetSqlCheatId = uuid();

const assets = [
  {
    id: assetProjectBriefId,
    uploaded_by_user_id: contentEditor.id,
    storage_provider: 'local',
    path: 'demo-assets/full-stack-project-brief.pdf',
    mime_type: 'application/pdf',
    size_bytes: 132400,
    created_at: TIMESTAMP,
  },
  {
    id: assetSqlCheatId,
    uploaded_by_user_id: instructors[1].id,
    storage_provider: 'local',
    path: 'demo-assets/sql-reference.pdf',
    mime_type: 'application/pdf',
    size_bytes: 88400,
    created_at: TIMESTAMP,
  },
];

const lessonAssets = [
  { lesson_id: lessonApiDesignId, asset_id: assetProjectBriefId },
  { lesson_id: lessonSqlWarmupId, asset_id: assetSqlCheatId },
];

const groups = [
  {
    id: uuid(),
    course_id: courseFullStackId,
    name: 'Weeknight Builders',
    status: 'active',
    schedule_text: 'Tue/Thu 6-8pm',
    created_at: TIMESTAMP,
  },
  {
    id: uuid(),
    course_id: courseFullStackId,
    name: 'Weekend Sprinters',
    status: 'active',
    schedule_text: 'Sat 10am-2pm',
    created_at: TIMESTAMP,
  },
  {
    id: uuid(),
    course_id: courseAnalyticsId,
    name: 'Morning Analysts',
    status: 'active',
    schedule_text: 'Mon/Wed 9-11am',
    created_at: TIMESTAMP,
  },
];

const groupTeachers = [
  {
    group_id: groups[0].id,
    user_id: instructors[0].id,
    role: 'lead',
    assigned_at: TIMESTAMP,
  },
  {
    group_id: groups[1].id,
    user_id: instructors[0].id,
    role: 'lead',
    assigned_at: TIMESTAMP,
  },
  {
    group_id: groups[2].id,
    user_id: instructors[1].id,
    role: 'lead',
    assigned_at: TIMESTAMP,
  },
];

const enrollments = [
  { course_id: courseFullStackId, user_id: students[0].id },
  { course_id: courseFullStackId, user_id: students[1].id },
  { course_id: courseFullStackId, user_id: students[2].id },
  { course_id: courseFullStackId, user_id: students[3].id },
  { course_id: courseAnalyticsId, user_id: students[4].id },
  { course_id: courseAnalyticsId, user_id: students[5].id },
].map((row) => ({
  id: uuid(),
  ...row,
  status: 'active',
  enrolled_at: TIMESTAMP,
}));

const groupStudents = [
  { group_id: groups[0].id, user_id: students[0].id },
  { group_id: groups[0].id, user_id: students[1].id },
  { group_id: groups[1].id, user_id: students[2].id },
  { group_id: groups[1].id, user_id: students[3].id },
  { group_id: groups[2].id, user_id: students[4].id },
  { group_id: groups[2].id, user_id: students[5].id },
].map((row) => ({
  ...row,
  joined_at: TIMESTAMP,
  status: 'active',
}));

const groupLessonSessions = [
  {
    id: uuid(),
    group_id: groups[0].id,
    lesson_id: lessonLiveWorkshopId,
    starts_at: upcomingStart.toISOString(),
    ends_at: upcomingEnd.toISOString(),
    meeting_url: 'https://meet.google.com/abc-defg-hjk',
    unlock_offset_minutes: 10,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
  },
];

const lessonProgress = [
  {
    user_id: students[0].id,
    lesson_id: lessonWebBasicsId,
    status: 'done',
    progress_percent: 100,
  },
  {
    user_id: students[0].id,
    lesson_id: lessonApiDesignId,
    status: 'in_progress',
    progress_percent: 55,
  },
  {
    user_id: students[2].id,
    lesson_id: lessonSqlWarmupId,
    status: 'done',
    progress_percent: 100,
  },
  {
    user_id: students[4].id,
    lesson_id: lessonDashboardStoryId,
    status: 'in_progress',
    progress_percent: 40,
  },
  {
    user_id: students[5].id,
    lesson_id: lessonDashboardStoryId,
    status: 'done',
    progress_percent: 100,
  },
].map((row) => ({
  ...row,
  last_seen_at: TIMESTAMP,
}));

const quizQuestionWebId = uuid();
const quizQuestionDeployId = uuid();
const quizQuestionDashboardId = uuid();
const quizQuestionKpiId = uuid();

const quizQuestions = [
  {
    id: quizQuestionWebId,
    lesson_id: lessonWebBasicsId,
    question_text: 'What status code indicates a successful GET request?',
    question_type: 'single_choice',
    order_index: 1,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
  },
  {
    id: quizQuestionDeployId,
    lesson_id: lessonDeploymentId,
    question_text: 'Which command builds a production Node image?',
    question_type: 'single_choice',
    order_index: 2,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
  },
  {
    id: quizQuestionDashboardId,
    lesson_id: lessonDashboardStoryId,
    question_text: 'Why lead with the key metric on a dashboard?',
    question_type: 'single_choice',
    order_index: 1,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
  },
  {
    id: quizQuestionKpiId,
    lesson_id: lessonDashboardStoryId,
    question_text: 'Which KPI best tracks activation health?',
    question_type: 'single_choice',
    order_index: 2,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
  },
];

const quizOptions = [
  { question_id: quizQuestionWebId, option_text: '200 OK', is_correct: true, order_index: 1 },
  { question_id: quizQuestionWebId, option_text: '302 Found', is_correct: false, order_index: 2 },
  { question_id: quizQuestionWebId, option_text: '404 Not Found', is_correct: false, order_index: 3 },
  {
    question_id: quizQuestionDeployId,
    option_text: 'docker build -t api:prod .',
    is_correct: true,
    order_index: 1,
  },
  {
    question_id: quizQuestionDeployId,
    option_text: 'npm run dev',
    is_correct: false,
    order_index: 2,
  },
  {
    question_id: quizQuestionDashboardId,
    option_text: 'Executives decide quickly when the headline is obvious.',
    is_correct: true,
    order_index: 1,
  },
  {
    question_id: quizQuestionDashboardId,
    option_text: 'It fills empty space at the top of the page.',
    is_correct: false,
    order_index: 2,
  },
  {
    question_id: quizQuestionKpiId,
    option_text: 'New weekly activated accounts',
    is_correct: true,
    order_index: 1,
  },
  {
    question_id: quizQuestionKpiId,
    option_text: 'Page views',
    is_correct: false,
    order_index: 2,
  },
].map((row) => ({
  id: uuid(),
  ...row,
}));

const quizAttempts = [
  {
    user_id: students[0].id,
    lesson_id: lessonWebBasicsId,
    score_percent: 100,
  },
  {
    user_id: students[2].id,
    lesson_id: lessonWebBasicsId,
    score_percent: 75,
  },
  {
    user_id: students[4].id,
    lesson_id: lessonDashboardStoryId,
    score_percent: 80,
  },
  {
    user_id: students[5].id,
    lesson_id: lessonDashboardStoryId,
    score_percent: 95,
  },
].map((row) => ({
  id: uuid(),
  ...row,
  created_at: TIMESTAMP,
}));

const announcements = [
  {
    id: uuid(),
    scope: 'course',
    course_id: courseFullStackId,
    group_id: null,
    created_by_user_id: instructors[0].id,
    title: 'Sprint review on Thursday',
    body: 'Bring your API demos and highlight metrics. Slides optional.',
    created_at: TIMESTAMP,
  },
  {
    id: uuid(),
    scope: 'group',
    course_id: null,
    group_id: groups[2].id,
    created_by_user_id: instructors[1].id,
    title: 'Dashboard critique',
    body: 'Share your latest Looker board for async feedback.',
    created_at: TIMESTAMP,
  },
];

exports.seed = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      TRUNCATE TABLE
        announcements,
        lesson_assets,
        group_lesson_sessions,
        lesson_progress,
        quiz_attempts,
        quiz_options,
        quiz_questions,
        group_students,
        group_teachers,
        enrollments,
        groups,
        lessons,
        modules,
        courses,
        course_user_roles,
        user_roles,
        refresh_tokens,
        user_invites,
        assets,
        roles,
        users
      RESTART IDENTITY CASCADE
    `);

    await trx('roles').insert(roleRows);
    await trx('users').insert(userRows);
    await trx('user_roles').insert(userRoles);
    await trx('courses').insert(courses);
    await trx('course_user_roles').insert(courseUserRoles);
    await trx('modules').insert(modules);
    await trx('lessons').insert(lessons);
    await trx('assets').insert(assets);
    await trx('lesson_assets').insert(lessonAssets);
    await trx('groups').insert(groups);
    await trx('group_lesson_sessions').insert(groupLessonSessions);
    await trx('group_teachers').insert(groupTeachers);
    await trx('enrollments').insert(enrollments);
    await trx('group_students').insert(groupStudents);
    await trx('lesson_progress').insert(lessonProgress);
    await trx('quiz_questions').insert(quizQuestions);
    await trx('quiz_options').insert(quizOptions);
    await trx('quiz_attempts').insert(quizAttempts);
    await trx('announcements').insert(announcements);
  });
};

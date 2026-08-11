const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'authorization-test-secret-with-32-plus-chars';
process.env.NODE_ENV = 'test';
process.env.STORAGE_PROVIDER = 'r2';

const pool = require('../src/db');
const cmsRoutes = require('../src/routes/cms');
const coursesRoutes = require('../src/routes/courses');
const adminRoutes = require('../src/routes/admin');
const forumRoutes = require('../src/routes/forums');
const instructorRoutes = require('../src/routes/instructor');
const liveSessionRoutes = require('../src/routes/liveSessions');
const { assignStudentToCourseGroup } = require('../src/utils/groupMembership');

const IDS = {
  manager: '11111111-1111-4111-8111-111111111111',
  course: '22222222-2222-4222-8222-222222222222',
  otherCourse: '33333333-3333-4333-8333-333333333333',
  group: '44444444-4444-4444-8444-444444444444',
  otherGroup: '55555555-5555-4555-8555-555555555555',
  targetGroup: '99999999-9999-4999-8999-999999999998',
  student: '66666666-6666-4666-8666-666666666666',
  teacher: '77777777-7777-4777-8777-777777777777',
  session: '88888888-8888-4888-8888-888888888888',
  series: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  lesson: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

const assignedCourse = {
  id: IDS.course,
  title: 'Assigned course',
  description: null,
  level: 'A1',
  owner_user_id: null,
  is_published: true,
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
};

const assignedGroup = {
  id: IDS.group,
  course_id: IDS.course,
  name: 'Group A',
  code: 'GA',
  timezone: 'America/Mexico_City',
  start_date: null,
  end_date: null,
  capacity: 20,
  status: 'active',
  is_active: true,
  schedule_text: 'Mon 10:00',
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  teachers_count: 1,
};

const state = {
  enrolled: false,
  existingInviteUser: false,
  roleInsertions: 0,
  advisoryLocks: [],
  targetCapacity: 20,
  targetStudentCount: 0,
  candidateSearchSupportsPlatformId: false,
  liveSessionRangeParams: null,
  regenerateWindowParams: null,
  auditEvents: [],
};

const normalizeSql = (sql) => String(sql).replace(/\s+/g, ' ').trim().toLowerCase();

const queryResult = (rows = [], rowCount = rows.length) => ({ rows, rowCount });

const mockQuery = async (sql, values = []) => {
  const text = normalizeSql(sql);

  if (text === 'begin' || text === 'commit' || text === 'rollback') return queryResult();

  if (
    text.includes('from users u') &&
    text.includes('coalesce(u.token_version') &&
    text.includes('global_roles')
  ) {
    return queryResult([
      {
        id: IDS.manager,
        is_active: true,
        must_set_password: false,
        token_version: 0,
        global_roles: ['enrollment_manager'],
      },
    ]);
  }

  if (text.includes('pg_advisory_xact_lock')) {
    state.advisoryLocks.push(values[0]);
    return queryResult([{ pg_advisory_xact_lock: null }]);
  }

  if (text.includes('from courses') && text.includes('where id = $1') && text.includes('owner_user_id')) {
    const courseId = values[0];
    if (courseId === IDS.course || courseId === IDS.otherCourse) {
      return queryResult([{ id: courseId, owner_user_id: '99999999-9999-4999-8999-999999999999' }]);
    }
    return queryResult();
  }

  if (text.includes('from course_user_roles cur') && text.includes('r.name = any($3)')) {
    const [userId, courseId, allowedRoles] = values;
    const allowed =
      userId === IDS.manager &&
      courseId === IDS.course &&
      Array.isArray(allowedRoles) &&
      allowedRoles.includes('enrollment_manager');
    return queryResult(allowed ? [{ '?column?': 1 }] : []);
  }

  if (text.includes("r.name = 'enrollment_manager'") && text.includes('join course_user_roles')) {
    return queryResult([assignedCourse]);
  }

  if (text.includes('select id, course_id, name from groups where id = $1')) {
    if (values[0] === IDS.group) return queryResult([assignedGroup]);
    if (values[0] === IDS.otherGroup) {
      return queryResult([{ id: IDS.otherGroup, course_id: IDS.otherCourse, name: 'Other group' }]);
    }
    return queryResult();
  }

  if (text.includes('select id, capacity from groups') && text.includes('for update')) {
    return queryResult(values[0] === IDS.group || values[0] === IDS.targetGroup
      ? [{ id: values[0], capacity: 20 }]
      : []);
  }

  if (text.includes("bool_or(gs.user_id = $2") && text.includes('students_count')) {
    return queryResult([{ students_count: 0, already_assigned: false }]);
  }

  if (text.includes('select id, course_id from groups where id = $1')) {
    if (values[0] === IDS.group) return queryResult([{ id: IDS.group, course_id: IDS.course }]);
    return queryResult();
  }

  if (text.includes('select id, course_id, name, status from groups where id = $1')) {
    if (values[0] === IDS.group) return queryResult([assignedGroup]);
    return queryResult();
  }

  if (
    text.includes('from groups g') &&
    text.includes('where g.id = $1') &&
    text.includes('teachers_count')
  ) {
    return queryResult(values[0] === IDS.group ? [{
      ...assignedGroup,
      teachers: [{
        id: IDS.teacher,
        fullName: 'Teacher One',
        email: 'teacher@example.com',
        role: 'lead',
      }],
      students_count: 1,
    }] : []);
  }

  if (
    text.includes('select id, name, capacity from groups') &&
    text.includes('id = any($2::uuid[])')
  ) {
    const requestedIds = values[1] || [];
    return queryResult(requestedIds.filter((id) => id !== IDS.otherGroup).map((id) => ({
      id,
      name: id === IDS.group ? 'Group A' : 'Group B',
      capacity: id === IDS.targetGroup ? state.targetCapacity : 20,
    })));
  }

  if (text.includes('from groups g') && text.includes('where g.course_id = $1') && text.includes('teachers_count')) {
    return queryResult(values[0] === IDS.course ? [assignedGroup] : []);
  }

  if (
    text.includes('select u.id, u.full_name, u.email') &&
    text.includes('from group_teachers gt')
  ) {
    return queryResult([
      { id: IDS.teacher, full_name: 'Teacher One', email: 'teacher@example.com' },
    ]);
  }

  if (
    text.includes('from group_students gs') &&
    text.includes('join enrollments e') &&
    text.includes('attendance_percentage') === false
  ) {
    return queryResult([
      {
        student_id: IDS.student,
        full_name: 'Student One',
        email: 'student@example.com',
        enrollment_status: 'active',
        group_status: 'active',
        joined_at: new Date('2026-07-01T00:00:00Z'),
        taken_sessions: 4,
        attended_sessions: 3,
      },
    ]);
  }

  if (text.includes('from enrollments e') && text.includes('assignment.group_id')) {
    if (text.includes('u.id::text ilike')) {
      state.candidateSearchSupportsPlatformId = true;
    }
    return queryResult([
      {
        student_id: IDS.student,
        full_name: 'Student One',
        email: 'student@example.com',
        enrollment_status: 'active',
        course_id: IDS.course,
        course_title: 'Assigned course',
        group_id: IDS.otherGroup,
        group_name: 'Group B',
        schedule_text: 'Tue 12:00',
        teacher_names: 'Teacher Two',
      },
    ]);
  }

  if (text.includes('from group_students gs') && text.includes('join users u')) return queryResult();
  if (text.includes('from live_sessions ls') && text.includes('join groups g')) return queryResult();

  if (text.includes('from live_sessions ls') && text.includes('join class_types ct')) {
    if (text.includes('where ls.group_id = $1') && text.includes('ls.starts_at >= $2')) {
      state.liveSessionRangeParams = values;
    }
    return queryResult([
      {
        id: IDS.session,
        series_id: null,
        group_id: IDS.group,
        module_id: null,
        class_type_id: IDS.teacher,
        class_type_name: 'Conversation',
        host_teacher_id: IDS.teacher,
        host_teacher_name: 'Teacher One',
        starts_at: new Date('2026-08-03T16:00:00Z'),
        ends_at: new Date('2026-08-03T17:00:00Z'),
        published: true,
        status: 'scheduled',
        join_url: 'https://classes.example/join',
        host_url: 'https://classes.example/host-secret',
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
  }

  if (text.includes('from live_session_series s') && text.includes('join class_types ct')) {
    if (text.includes('where s.id = $1')) {
      if (values[0] !== IDS.series) return queryResult([]);
      return queryResult([
        {
          id: IDS.series,
          group_id: IDS.group,
          course_id: IDS.course,
          module_id: null,
          class_type_id: IDS.teacher,
          class_type_name: 'Conversation',
          class_type_code: 'conversation',
          host_teacher_id: IDS.teacher,
          host_teacher_name: 'Teacher One',
          title: 'Weekly conversation',
          timezone: 'America/Bogota',
          rrule: 'FREQ=WEEKLY;BYDAY=MO',
          dtstart: new Date('2026-08-03T16:00:00Z'),
          dtend: new Date('2026-09-01T16:00:00Z'),
          duration_minutes: 60,
          published: true,
          join_url: 'https://classes.example/join',
          host_url: 'https://classes.example/host-secret',
          created_by: IDS.manager,
          created_at: new Date('2026-01-01T00:00:00Z'),
          updated_at: new Date('2026-01-01T00:00:00Z'),
        },
      ]);
    }
    return queryResult([]);
  }

  if (text.includes('select dtend from live_session_series')) {
    return queryResult(
      values[0] === IDS.series ? [{ dtend: new Date('2026-09-01T16:00:00Z') }] : [],
    );
  }

  if (text.startsWith('delete from live_sessions') && text.includes('series_id = $1')) {
    state.regenerateWindowParams = values;
    return queryResult([], 2);
  }

  if (text.includes('select starts_at') && text.includes('from live_sessions') && text.includes('series_id = $1')) {
    return queryResult([]);
  }

  if (text.startsWith('insert into live_sessions')) {
    return queryResult([], 0);
  }

  if (text.includes('from lessons l') && text.includes('join modules m')) {
    return queryResult(values[0] === IDS.lesson ? [{ course_id: IDS.course }] : []);
  }

  if (text.includes('select u.id') && text.includes("r.name = 'student'")) {
    return queryResult([{ id: IDS.student }]);
  }

  if (text.includes('select 1 from enrollments') && text.includes('course_id = $1')) {
    return queryResult(state.enrolled ? [{ '?column?': 1 }] : []);
  }

  if (text.includes('select user_id, status from enrollments')) {
    return queryResult((values[1] || []).map((userId) => ({ user_id: userId, status: 'active' })));
  }

  if (
    text.includes('select gs.group_id') &&
    text.includes('from group_students gs') &&
    text.includes("gs.status = 'active'")
  ) {
    return queryResult([{ group_id: IDS.group }]);
  }

  if (
    text.includes('select gs.user_id, gs.group_id') &&
    text.includes('gs.status = \'active\'')
  ) {
    return queryResult((values[1] || []).map((userId) => ({
      user_id: userId,
      group_id: IDS.group,
    })));
  }

  if (text.includes('select count(*)::int as students_count from group_students')) {
    return queryResult([{ students_count: state.targetStudentCount }]);
  }

  if (text.startsWith('insert into enrollments')) {
    state.enrolled = true;
    return queryResult([{ user_id: IDS.student }], 1);
  }

  if (text.startsWith('insert into student_audit_events')) {
    state.auditEvents.push({
      courseId: values[0],
      studentId: values[1],
      actorUserId: values[2],
      eventType: values[3],
      sourceGroupId: values[4],
      targetGroupId: values[5],
      metadata: JSON.parse(values[6] || '{}'),
    });
    return queryResult([], 1);
  }

  if (text.includes('from student_audit_events sae') && text.includes('join users student')) {
    return queryResult(state.auditEvents.map((event, index) => ({
      id: `audit-${index}`,
      course_id: event.courseId,
      student_id: event.studentId,
      student_full_name: 'Student One',
      student_email: 'student@example.com',
      actor_user_id: event.actorUserId,
      actor_full_name: 'Manager One',
      actor_email: 'manager@example.com',
      event_type: event.eventType,
      source_group_id: event.sourceGroupId,
      source_group_name: event.sourceGroupId === IDS.group ? 'Group A' : null,
      target_group_id: event.targetGroupId,
      target_group_name: event.targetGroupId === IDS.targetGroup ? 'Group B' : 'Group A',
      metadata: event.metadata,
      created_at: new Date('2026-08-10T12:00:00Z'),
    })));
  }

  if (text.includes('from student_audit_events sae') && text.includes('count(*)::int as total')) {
    return queryResult([{ total: state.auditEvents.length }]);
  }

  if (text.startsWith('delete from enrollments')) {
    const existed = state.enrolled;
    state.enrolled = false;
    return queryResult(existed ? [{ '?column?': 1 }] : [], existed ? 1 : 0);
  }

  if (text.includes('from users u') && text.includes('where lower(u.email) = lower($1)')) {
    if (!state.existingInviteUser) return queryResult();
    return queryResult([
      {
        id: IDS.student,
        full_name: 'Existing user',
        global_roles: [],
      },
    ]);
  }

  if (text.startsWith('insert into user_roles')) {
    state.roleInsertions += 1;
    return queryResult([], 1);
  }

  if (text.includes('from roles') && text.includes('where name = any($1)')) {
    return queryResult([{ id: IDS.teacher, name: 'student' }]);
  }

  if (text.includes('from class_types')) {
    return queryResult([
      { id: IDS.teacher, code: 'conversation', label: 'Conversation', is_active: true },
    ]);
  }

  if (text.startsWith('delete from group_students') || text.startsWith('insert into group_students')) {
    return queryResult([], 1);
  }

  return queryResult();
};

const originalQuery = pool.query.bind(pool);
const originalConnect = pool.connect.bind(pool);

pool.query = mockQuery;
pool.connect = async () => ({ query: mockQuery, release() {} });

const app = express();
app.use(express.json());
app.use('/cms', cmsRoutes);
app.use('/courses', coursesRoutes);
app.use('/admin', adminRoutes);
app.use(forumRoutes);
app.use(liveSessionRoutes);
app.use(instructorRoutes);

let server;
let baseUrl;

const token = jwt.sign(
  { id: IDS.manager, tokenVersion: 0, globalRoles: ['enrollment_manager'] },
  process.env.JWT_SECRET,
);

const request = async (path, options = {}) => {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${baseUrl}${path}`, { ...options, headers });
};

const requestWithToken = async (path, accessToken, options = {}) => {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${baseUrl}${path}`, { ...options, headers });
};

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  pool.query = originalQuery;
  pool.connect = originalConnect;
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

test.beforeEach(() => {
  state.enrolled = false;
  state.existingInviteUser = false;
  state.roleInsertions = 0;
  state.advisoryLocks = [];
  state.targetCapacity = 20;
  state.targetStudentCount = 0;
  state.candidateSearchSupportsPlatformId = false;
  state.liveSessionRangeParams = null;
  state.regenerateWindowParams = null;
});

test('stale access token version is rejected', async () => {
  const staleToken = jwt.sign(
    { id: IDS.manager, tokenVersion: 1, globalRoles: ['enrollment_manager'] },
    process.env.JWT_SECRET,
  );
  const response = await requestWithToken('/cms/courses', staleToken);
  assert.equal(response.status, 401);
});

test('course listing is limited to courses assigned as enrollment_manager', async () => {
  const response = await request('/cms/courses');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.map((course) => course.id), [IDS.course]);
});

test('course mutations are forbidden', async (t) => {
  const cases = [
    ['create', '/cms/courses', 'POST', { title: 'Forbidden course', level: 'A1' }],
    ['edit', `/cms/courses/${IDS.course}`, 'PATCH', { title: 'Forbidden title' }],
    ['publish', `/cms/courses/${IDS.course}/publish`, 'POST', undefined],
    ['unpublish', `/cms/courses/${IDS.course}/unpublish`, 'POST', undefined],
    ['delete', `/cms/courses/${IDS.course}`, 'DELETE', undefined],
  ];

  for (const [name, path, method, body] of cases) {
    await t.test(name, async () => {
      const response = await request(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.equal(response.status, 403);
    });
  }
});

test('group structure mutations are forbidden', async (t) => {
  const cases = [
    ['create', `/cms/courses/${IDS.course}/groups`, 'POST', { name: 'New group' }],
    ['edit', `/cms/groups/${IDS.group}`, 'PATCH', { name: 'Renamed group' }],
    ['delete', `/cms/groups/${IDS.group}`, 'DELETE', undefined],
  ];

  for (const [name, path, method, body] of cases) {
    await t.test(name, async () => {
      const response = await request(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.equal(response.status, 403);
    });
  }
});

test('group teacher mutations are forbidden', async (t) => {
  const cases = [
    ['assign', `/cms/groups/${IDS.group}/teachers`, 'POST', { userId: IDS.teacher }],
    ['remove', `/cms/groups/${IDS.group}/teachers/${IDS.teacher}`, 'DELETE', undefined],
  ];

  for (const [name, path, method, body] of cases) {
    await t.test(name, async () => {
      const response = await request(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.equal(response.status, 403);
    });
  }
});

test('attendance modification is forbidden', async (t) => {
  await t.test('course week attendance', async () => {
    const response = await request(`/courses/${IDS.course}/attendance/week`, {
      method: 'PUT',
      body: JSON.stringify({
        weekStart: '2026-08-03',
        groupId: IDS.group,
        updates: [{ sessionId: IDS.session, userId: IDS.student, status: 'present' }],
      }),
    });
    assert.equal(response.status, 403);
  });

  await t.test('single live session attendance', async () => {
    const response = await request(`/live-sessions/${IDS.session}/attendance`, {
      method: 'PUT',
      body: JSON.stringify({ items: [{ userId: IDS.student, status: 'present' }] }),
    });
    assert.equal(response.status, 403);
  });
});

test('academic content, forums and assets are forbidden', async (t) => {
  const cases = [
    ['module', `/cms/courses/${IDS.course}/modules`, 'POST', { title: 'Module' }],
    ['quiz', `/cms/lessons/${IDS.lesson}/quiz/questions`, 'POST', { questionText: 'Question?' }],
    ['forum', '/forums', 'POST', { scope: 'course', courseId: IDS.course, title: 'Forum' }],
    ['asset', '/cms/assets/register', 'POST', { storagePath: 'x', publicUrl: 'x', kind: 'image' }],
  ];

  for (const [name, path, method, body] of cases) {
    await t.test(name, async () => {
      const response = await request(path, {
        method,
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 403);
    });
  }
});

test('bulk invite rejects every non-student role', async () => {
  const form = new FormData();
  form.set('defaultRole', 'instructor');
  form.set('file', new Blob(['email,role\nteacher2@example.com,instructor'], { type: 'text/csv' }), 'users.csv');

  const response = await request('/admin/users/bulk-invite', { method: 'POST', body: form });
  assert.equal(response.status, 403);
});

test('bulk invite does not grant a role to an existing user', async () => {
  state.existingInviteUser = true;
  const form = new FormData();
  form.set('defaultRole', 'student');
  form.set('file', new Blob(['email\nexisting@example.com'], { type: 'text/csv' }), 'users.csv');

  const response = await request('/admin/users/bulk-invite', { method: 'POST', body: form });
  assert.equal(response.status, 200);
  assert.equal(state.roleInsertions, 0);
});

test('bulk invite rejects an unassigned course', async () => {
  const form = new FormData();
  form.set('defaultRole', 'student');
  form.set('defaultCourseId', IDS.otherCourse);
  form.set('file', new Blob(['email\nstudent2@example.com'], { type: 'text/csv' }), 'users.csv');

  const response = await request('/admin/users/bulk-invite', { method: 'POST', body: form });
  assert.equal(response.status, 403);
});

test('assigned groups and teachers remain readable', async (t) => {
  await t.test('groups', async () => {
    const response = await request(`/cms/courses/${IDS.course}/groups`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body[0].id, IDS.group);
  });

  await t.test('teachers', async () => {
    const response = await request(`/cms/groups/${IDS.group}/teachers`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body[0].fullName, 'Teacher One');
    assert.equal(Object.hasOwn(body[0], 'email'), false);
  });
});

test('assigned group student detail and available candidates remain readable', async (t) => {
  await t.test('student roster includes enrollment and attendance information', async () => {
    const response = await request(`/cms/groups/${IDS.group}/students`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.group.id, IDS.group);
    assert.equal(body.teacher.fullName, 'Teacher One');
    assert.equal(body.schedule, 'Mon 10:00');
    assert.equal(body.studentCount, 1);
    assert.equal(body.students[0].studentId, IDS.student);
    assert.equal(body.students[0].enrollmentStatus, 'active');
    assert.equal(body.students[0].attendancePercentage, 75);
    assert.equal(body.availableStudents[0].groupName, 'Group B');
  });

  await t.test('candidates expose their current group without duplicating the target group', async () => {
    const response = await request(`/cms/groups/${IDS.group}/student-candidates?search=student`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body[0].courseId, IDS.course);
    assert.equal(body[0].platformId, IDS.student);
    assert.equal(body[0].studentCode, null);
    assert.equal(body[0].groupName, 'Group B');
    assert.equal(body[0].currentGroupTeacher, 'Teacher Two');
    assert.equal(body[0].currentGroupSchedule, 'Tue 12:00');
    assert.equal(body[0].assignmentStatus, 'with_group');
    assert.equal(state.candidateSearchSupportsPlatformId, true);
  });

  await t.test('another course group remains forbidden', async () => {
    const response = await request(`/cms/groups/${IDS.otherGroup}/students`);
    assert.equal(response.status, 403);
  });
});

test('group assignment locks the course-student pair before replacing membership', async () => {
  const calls = [];
  const client = {
    query: async (sql, values) => {
      const normalized = normalizeSql(sql);
      calls.push({ sql: normalized, values });
      if (normalized.includes('select id, capacity from groups')) {
        return queryResult([{ id: IDS.group, capacity: 20 }]);
      }
      if (normalized.includes('already_assigned')) {
        return queryResult([{ students_count: 0, already_assigned: false }]);
      }
      return queryResult();
    },
  };

  await assignStudentToCourseGroup(client, {
    courseId: IDS.course,
    studentId: IDS.student,
    groupId: IDS.group,
  });

  assert.equal(calls.length, 5);
  assert.match(calls[0].sql, /pg_advisory_xact_lock/);
  assert.deepEqual(calls[0].values, [`${IDS.course}:${IDS.student}`]);
  assert.match(calls[1].sql, /select id, capacity from groups/);
  assert.match(calls[2].sql, /already_assigned/);
  assert.match(calls[3].sql, /^delete from group_students/);
  assert.match(calls[4].sql, /^insert into group_students/);
});

test('bulk group operations are transactional and return processing summaries', async (t) => {
  await t.test('assign multiple enrolled students', async () => {
    const response = await request(
      `/cms/courses/${IDS.course}/groups/${IDS.targetGroup}/students/bulk-assign`,
      {
        method: 'POST',
        body: JSON.stringify({ studentIds: [IDS.student] }),
      },
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.processed, [IDS.student]);
    assert.equal(body.failed.length, 0);
  });

  await t.test('move multiple students to another group', async () => {
    const response = await request(
      `/cms/courses/${IDS.course}/groups/${IDS.group}/students/bulk-move`,
      {
        method: 'POST',
        body: JSON.stringify({
          studentIds: [IDS.student],
          targetGroupId: IDS.targetGroup,
        }),
      },
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.processed, [IDS.student]);
    assert.ok(state.advisoryLocks.includes(`${IDS.course}:${IDS.student}`));
  });

  await t.test('remove multiple students without deleting enrollment', async () => {
    const response = await request(
      `/cms/courses/${IDS.course}/groups/${IDS.group}/students/bulk-remove`,
      {
        method: 'POST',
        body: JSON.stringify({ studentIds: [IDS.student] }),
      },
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.processed, [IDS.student]);
  });

  await t.test('reject a target group from another course', async () => {
    const response = await request(
      `/cms/courses/${IDS.course}/groups/${IDS.group}/students/bulk-move`,
      {
        method: 'POST',
        body: JSON.stringify({
          studentIds: [IDS.student],
          targetGroupId: IDS.otherGroup,
        }),
      },
    );
    assert.equal(response.status, 400);
  });

  await t.test('reject the whole move when target capacity is exceeded', async () => {
    state.targetCapacity = 1;
    state.targetStudentCount = 1;
    const response = await request(
      `/cms/courses/${IDS.course}/groups/${IDS.group}/students/bulk-move`,
      {
        method: 'POST',
        body: JSON.stringify({
          studentIds: [IDS.student],
          targetGroupId: IDS.targetGroup,
        }),
      },
    );
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.processed.length, 0);
    assert.equal(body.failed[0].reason, 'capacity_exceeded');
  });
});

test('assigned course attendance remains readable', async () => {
  const response = await request(
    `/courses/${IDS.course}/attendance?weekStart=2026-08-03&groupId=${IDS.group}`,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.courseId, IDS.course);
  assert.equal(body.groupId, IDS.group);
});

test('assigned course live sessions remain readable', async () => {
  const response = await request(
    `/groups/${IDS.group}/live-sessions?from=2026-07-28T00:00:00.000Z&to=2026-09-01T23:59:59.999Z`,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body[0].joinUrl, 'https://classes.example/join');
  assert.equal(Object.hasOwn(body[0], 'hostUrl'), false);
  assert.equal(state.liveSessionRangeParams.length, 3);
  assert.equal(state.liveSessionRangeParams[0], IDS.group);
  assert.equal(state.liveSessionRangeParams[1].toISOString(), '2026-07-28T00:00:00.000Z');
  assert.equal(state.liveSessionRangeParams[2].toISOString(), '2026-09-01T23:59:59.999Z');
});

test('assigned course live sessions remain manageable', async () => {
  let response = await request(`/groups/${IDS.group}/live-series`);
  assert.equal(response.status, 200);

  response = await request('/class-types');
  assert.equal(response.status, 200);

  response = await request(`/live-sessions/${IDS.session}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed' }),
  });
  assert.equal(response.status, 200);

  response = await request(`/live-series/${IDS.series}/regenerate`, {
    method: 'POST',
    body: JSON.stringify({ weeks: 8 }),
  });
  assert.equal(response.status, 200);
  assert.equal(state.regenerateWindowParams[0], IDS.series);
  assert.equal(state.regenerateWindowParams[1].toISOString(), '2026-08-03T16:00:00.000Z');
  assert.equal(state.regenerateWindowParams[2].toISOString(), '2026-09-01T16:00:00.000Z');
});

test('enroll, change group and withdraw remain allowed on an assigned course', async () => {
  state.auditEvents = [];
  let response = await request(`/cms/courses/${IDS.course}/enroll`, {
    method: 'POST',
    body: JSON.stringify({ studentId: IDS.student, groupId: IDS.group }),
  });
  assert.equal(response.status, 201);
  assert.equal(state.enrolled, true);

  response = await request(`/cms/courses/${IDS.course}/enroll/${IDS.student}/group`, {
    method: 'POST',
    body: JSON.stringify({ groupId: IDS.group }),
  });
  assert.equal(response.status, 200);

  response = await request(`/cms/courses/${IDS.course}/enroll/${IDS.student}`, {
    method: 'DELETE',
  });
  assert.equal(response.status, 200);
  assert.equal(state.enrolled, false);
  assert.ok(state.advisoryLocks.length >= 5);
  assert.ok(state.advisoryLocks.every((key) => key === `${IDS.course}:${IDS.student}`));
  assert.ok(state.auditEvents.some((event) => event.eventType === 'student_enrolled'));
  assert.ok(state.auditEvents.some((event) => event.eventType === 'student_unenrolled'));
  assert.ok(state.auditEvents.some((event) => event.eventType === 'student_group_removed'));

  response = await request(`/cms/courses/${IDS.course}/audit-events?studentId=${IDS.student}`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, state.auditEvents.length);
  assert.equal(body.data[0].student.id, IDS.student);
  assert.equal(body.data[0].actor.id, IDS.manager);
});

test('operations on an unassigned course are forbidden', async () => {
  const response = await request(`/cms/courses/${IDS.otherCourse}/enroll`, {
    method: 'POST',
    body: JSON.stringify({ studentId: IDS.student }),
  });
  assert.equal(response.status, 403);
});

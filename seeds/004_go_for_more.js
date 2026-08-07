const TIMESTAMP = new Date().toISOString();

const ids = {
  course: '3ebd564c-f71c-49ea-ad32-84fc1684ab9a',
  moduleLibrary: '861b67e0-cb33-4e02-b597-1aa9b5dfb508',
  moduleLesson2: '9f10440b-9fbe-4648-b25e-98ecb3aa5668',
  moduleLeah: 'df2d164e-1875-4d0f-8c8c-a4035102252a',
  lessonAgenda: 'd6f35d86-4f04-49a7-a155-99d853d1a0ee',
  lessonAgendaQuiz: '0c1348f1-ade0-4e63-b55b-ce842984744e',
  lessonPlacement: 'bd1a3329-38fe-4943-a4ab-ba2736a9dc4d',
  groupRoberto: '9e9d2760-510c-4ec1-b22d-afd03b6e315a',
  liveSeries: '5f73db3a-291c-4d00-8efe-be11e61b4806',
  quizQuestionAgenda: '5b770409-625e-4a6f-bc73-9177f435eef5',
  announcementNoClass: '65c525a4-91c4-42c7-ab8c-81746a059827',
  coursePostWelcome: '1380cf5d-1e49-4273-bf6e-d345a2bc7e22',
  forumRoberto: 'ac6904ba-a6c8-4338-94cd-09e651fbe3a9',
};

const imageUrl =
  'https://eokbwjltwnueblyfkrlc.supabase.co/storage/v1/object/public/Academy_storage/courses/3ebd564c-f71c-49ea-ad32-84fc1684ab9a/lessons/bd1a3329-38fe-4943-a4ab-ba2736a9dc4d/images/1776288190948-test-1.png';

const placementText =
  'Con el fin de garantizar una correcta realización del Test de Nivelación, se solicita leer previamente el documento “Guía de uso Leah – GO4MORE”, en el cual se detallan los pasos y recomendaciones necesarias para el desarrollo de la actividad.\n\n\n\n🔗 Haga clic aquí para acceder al registro del Test de Nivelación.\n\n\n\n⚠️ Nota importante: Si aún no ha presentado el Test de Nivelación, no marque esta actividad como leída, ya que esto puede afectar el seguimiento académico correspondiente.';

const agendaContentHtml = `
        <section data-layout="single-column" class="lesson-page-block">
          <h2>Página 1</h2>
          
      
      <figure class="lesson-media lesson-media-audio">
        <iframe style="display:block;width:100%;max-width:100%;height:166px;border:0;border-radius:16px;" frameborder="0" loading="lazy" allow="autoplay" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/1968570755&amp;color=%23ff5500&amp;auto_play=false&amp;hide_related=false&amp;show_comments=false&amp;show_user=false&amp;show_reposts=false&amp;show_teaser=false&amp;visual=false">
        </iframe>
      </figure>
      
    
              
              <figure class="lesson-media lesson-media-image">
                <img alt="image" src="${imageUrl}">
                
              </figure>
            
        </section>
      <div class="page-break"></div>
        <section data-layout="single-column" class="lesson-page-block">
          <h2>First video</h2>
          
      <figure style="width:100%;max-width:640px;margin:20px auto;" class="lesson-media lesson-media-video">
        <iframe style="display:block;width:100%;max-width:100%;aspect-ratio:16/9;border:0;border-radius:20px;background:#000;box-shadow:0 12px 28px rgba(15,23,42,.14);" allowfullscreen="" allow="autoplay; fullscreen; picture-in-picture" src="https://player.vimeo.com/video/581158245">
        </iframe>
      </figure>
    <h3>What is the meaning of life?</h3>
      <h3>What are the w questions?</h3>
      <div data-show-feedback="true" data-question-id="${ids.quizQuestionAgenda}" data-lesson-id="${ids.lessonAgenda}" data-quiz-mode="single_question" class="lesson-quiz-marker">
        Pregunta individual del quiz
      </div>
    
        </section>
      `;

const agendaContentJson = {
  pages: [
    {
      title: 'Página 1',
      blocks: [
        {
          src: '',
          type: 'audio',
          title: '',
          caption: '',
          embedUrl:
            'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/1968570755&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true',
        },
        {
          src: imageUrl,
          type: 'image',
          title: '',
          caption: '',
        },
      ],
      layout: 'single-column',
    },
    {
      title: 'First video',
      blocks: [
        {
          src: 'https://player.vimeo.com/video/581158245',
          type: 'video',
          title: '',
          caption: '',
          embedUrl: '',
        },
        {
          type: 'text',
          title: 'What is the meaning of life?',
          content: '',
        },
        {
          type: 'quiz',
          title: 'What are the w questions?',
          quizMode: 'single_question',
          questionId: ids.quizQuestionAgenda,
          showFeedback: true,
        },
      ],
      layout: 'single-column',
    },
  ],
};

const agendaQuizContentJson = {
  pages: [
    {
      title: 'Page 1',
      blocks: [
        {
          type: 'quiz',
          title: '',
          quizMode: 'single_question',
          questionId: 'c701fdcf-b047-4a17-9647-6305909632d7',
          showFeedback: true,
        },
      ],
      layout: 'single-column',
    },
  ],
};

const placementContentJson = {
  pages: [
    {
      title: 'Page 1',
      blocks: [
        {
          src: imageUrl,
          type: 'image',
          title: 'Contenido',
          caption: 'Test (1).png',
        },
        {
          type: 'text',
          title: '',
          content:
            'Con el fin de garantizar una correcta realización del Test de Nivelación, se solicita leer previamente el documento “Guía de uso Leah – GO4MORE”, en el cual se detallan los pasos y recomendaciones necesarias para el desarrollo de la actividad.',
        },
        {
          type: 'text',
          title: '',
          content: '🔗 Haga clic aquí para acceder al registro del Test de Nivelación.',
        },
        {
          type: 'text',
          title: '',
          content:
            '⚠️ Nota importante: Si aún no ha presentado el Test de Nivelación, no marque esta actividad como leída, ya que esto puede afectar el seguimiento académico correspondiente.',
        },
      ],
      layout: 'single-column',
    },
  ],
};

const liveSessions = [
  ['484d6d1c-1baa-4859-8cd7-ce5239fbdda0', '2026-08-07T03:30:13.000Z', '2026-08-07T04:00:13.000Z'],
  ['b437f136-10ce-4642-b8b8-ce98df71e2ea', '2026-08-10T03:30:13.000Z', '2026-08-10T04:00:13.000Z'],
  ['1a813d92-1f8b-46de-8435-66828f41e9c4', '2026-08-14T03:30:13.000Z', '2026-08-14T04:00:13.000Z'],
  ['68705e04-aea7-4d67-9e60-867453736812', '2026-08-17T03:30:13.000Z', '2026-08-17T04:00:13.000Z'],
  ['7c2013a3-fe1e-4dac-b309-929cc1c8d8b8', '2026-08-21T03:30:13.000Z', '2026-08-21T04:00:13.000Z'],
  ['d66f0598-e9d0-4ca5-8593-3df7a0a8728a', '2026-08-24T03:30:13.000Z', '2026-08-24T04:00:13.000Z'],
  ['a3cacdbe-4a4a-47e6-b27d-ec8496585718', '2026-08-28T03:30:13.000Z', '2026-08-28T04:00:13.000Z'],
  ['e9f0b262-be4b-4c82-854d-e2c810fb9796', '2026-08-31T03:30:13.000Z', '2026-08-31T04:00:13.000Z'],
  ['06f7c3a3-3024-48e0-beda-22a2051caefa', '2026-09-04T03:30:13.000Z', '2026-09-04T04:00:13.000Z'],
  ['e15284a9-7b5b-4401-a56b-2a2c08f68870', '2026-09-07T03:30:13.000Z', '2026-09-07T04:00:13.000Z'],
  ['ed3747ca-a973-4c1b-9421-f79efa5f47d8', '2026-09-11T03:30:13.000Z', '2026-09-11T04:00:13.000Z'],
  ['3d45ccd7-f31a-4a63-985c-653f061a107e', '2026-09-14T03:30:13.000Z', '2026-09-14T04:00:13.000Z'],
  ['9e0b14a1-3ae1-4a36-9218-396434a7ea06', '2026-09-18T03:30:13.000Z', '2026-09-18T04:00:13.000Z'],
  ['3408dc0e-a9ff-4851-85f1-66a688346378', '2026-09-21T03:30:13.000Z', '2026-09-21T04:00:13.000Z'],
  ['5e67a767-d67a-4dd5-8304-1d4468f09bc7', '2026-09-25T03:30:13.000Z', '2026-09-25T04:00:13.000Z'],
  ['ebb9184d-e6f3-4fa4-a9e8-ccb538473f80', '2026-09-28T03:30:13.000Z', '2026-09-28T04:00:13.000Z'],
];

const fetchRequired = async (knex, table, where, label) => {
  const row = await knex(table).where(where).first();
  if (!row) {
    throw new Error(`Missing required seed dependency: ${label}`);
  }
  return row;
};

exports.seed = async function seed(knex) {
  await knex.transaction(async (trx) => {
    const [admin, instructor, isaac, nora, instructorRole, englishLevel, conversationType] =
      await Promise.all([
        fetchRequired(trx, 'users', { email: 'admin@academy.local' }, 'admin@academy.local'),
        fetchRequired(trx, 'users', { email: 'darius.ford@academy.local' }, 'darius.ford@academy.local'),
        fetchRequired(trx, 'users', { email: 'isaac.rivera@academy.local' }, 'isaac.rivera@academy.local'),
        fetchRequired(trx, 'users', { email: 'nora.mitchell@academy.local' }, 'nora.mitchell@academy.local'),
        fetchRequired(trx, 'roles', { name: 'instructor' }, 'role: instructor'),
        trx('course_levels')
          .insert({
            id: trx.raw('gen_random_uuid()'),
            code: 'INGLES',
            label: 'INGLES',
            is_active: true,
            created_at: TIMESTAMP,
            updated_at: TIMESTAMP,
          })
          .onConflict('code')
          .merge({ label: 'INGLES', is_active: true, updated_at: trx.fn.now() })
          .returning('*')
          .then((rows) => rows[0] || trx('course_levels').where({ code: 'INGLES' }).first()),
        trx('class_types')
          .insert({
            id: trx.raw('gen_random_uuid()'),
            code: 'conversation',
            label: 'Conversation Club',
            is_active: true,
            created_at: TIMESTAMP,
            updated_at: TIMESTAMP,
          })
          .onConflict('code')
          .merge({ label: 'Conversation Club', is_active: true, updated_at: trx.fn.now() })
          .returning('*')
          .then((rows) => rows[0] || trx('class_types').where({ code: 'conversation' }).first()),
      ]);

    await trx('courses').where({ id: ids.course }).delete();

    await trx('courses').insert({
      id: ids.course,
      title: 'GO FOR MORE',
      description: null,
      status: 'draft',
      owner_user_id: null,
      created_at: '2026-04-09T23:48:47.847Z',
      published_at: '2026-05-06T21:29:18.921Z',
      is_published: true,
      updated_at: '2026-05-06T21:29:18.921Z',
      level_id: englishLevel.id,
    });

    await trx('course_user_roles').insert({
      course_id: ids.course,
      user_id: instructor.id,
      role_id: instructorRole.id,
    });

    await trx('modules').insert([
      {
        id: ids.moduleLibrary,
        course_id: ids.course,
        title: 'BIBLIOTECA',
        position: 1,
        order_index: 1,
        is_published: true,
        published_at: '2026-04-15T21:24:00.520Z',
        created_at: '2026-04-09T23:53:09.643Z',
        updated_at: '2026-04-15T21:24:00.520Z',
      },
      {
        id: ids.moduleLesson2,
        course_id: ids.course,
        title: 'Lección 2',
        position: 3,
        order_index: 2,
        is_published: true,
        published_at: '2026-04-24T21:32:57.920Z',
        created_at: '2026-04-24T21:23:35.053Z',
        updated_at: '2026-04-24T21:32:57.920Z',
      },
      {
        id: ids.moduleLeah,
        course_id: ids.course,
        title: 'TEST LEAH',
        position: 2,
        order_index: 3,
        is_published: true,
        published_at: '2026-04-15T21:23:58.865Z',
        created_at: '2026-04-15T21:21:30.824Z',
        updated_at: '2026-04-24T21:23:52.268Z',
      },
    ]);

    await trx('lessons').insert([
      {
        id: ids.lessonAgenda,
        module_id: ids.moduleLibrary,
        title: 'LECCIÓN 145: ORGANIZING YOUR AGENDA',
        position: 1,
        order_index: 1,
        content_type: 'text',
        content_text: '',
        content_markdown: '',
        content_html: agendaContentHtml,
        content_json: JSON.stringify(agendaContentJson),
        cover_image_url: imageUrl,
        estimated_minutes: 60,
        is_free_preview: false,
        is_published: true,
        published_at: '2026-04-15T20:23:23.789Z',
        allow_late_submission: false,
        requires_submission: false,
        created_at: '2026-04-09T23:53:57.083Z',
        updated_at: '2026-08-02T13:03:08.740Z',
      },
      {
        id: ids.lessonAgendaQuiz,
        module_id: ids.moduleLibrary,
        title: 'Quiz: Agenda Workflow',
        position: 2,
        order_index: 2,
        content_type: 'assessment',
        content_html: `
        <section data-layout="single-column" class="lesson-page-block">
          <h2>Page 1</h2>
          
      
      <div data-show-feedback="true" data-question-id="c701fdcf-b047-4a17-9647-6305909632d7" data-lesson-id="${ids.lessonAgendaQuiz}" data-quiz-mode="single_question" class="lesson-quiz-marker">
        Pregunta individual del quiz
      </div>
    
        </section>
      `,
        content_json: JSON.stringify(agendaQuizContentJson),
        cover_image_url: '',
        is_free_preview: false,
        is_published: true,
        published_at: '2026-08-02T13:10:38.411Z',
        available_from: '2026-08-03T00:37:15.659Z',
        due_at: '2026-08-03T02:47:39.000Z',
        allow_late_submission: false,
        requires_submission: false,
        created_at: '2026-08-02T04:14:24.254Z',
        updated_at: '2026-08-03T02:47:44.204Z',
      },
      {
        id: ids.lessonPlacement,
        module_id: ids.moduleLeah,
        title: 'TEST DE NIVELACIÓN',
        position: 1,
        order_index: 1,
        content_type: 'text',
        content_text: placementText,
        content_markdown: placementText,
        content_html: `
        <section data-layout="single-column" class="lesson-page-block">
          <h2>Page 1</h2>
          
              <h3>Contenido</h3>
              <figure class="lesson-media lesson-media-image">
                <img alt="Test (1).png" src="${imageUrl}">
                <figcaption>Test (1).png</figcaption>
              </figure>
            <p>Con el fin de garantizar una correcta realización del Test de Nivelación, se solicita leer previamente el documento “Guía de uso Leah – GO4MORE”, en el cual se detallan los pasos y recomendaciones necesarias para el desarrollo de la actividad.</p><p>🔗 Haga clic aquí para acceder al registro del Test de Nivelación.</p><p>⚠️ Nota importante: Si aún no ha presentado el Test de Nivelación, no marque esta actividad como leída, ya que esto puede afectar el seguimiento académico correspondiente.</p>
        </section>
      `,
        content_json: JSON.stringify(placementContentJson),
        cover_image_url: '',
        estimated_minutes: 10,
        is_free_preview: false,
        is_published: true,
        published_at: '2026-04-15T21:23:55.444Z',
        allow_late_submission: false,
        requires_submission: false,
        created_at: '2026-04-15T21:22:08.778Z',
        updated_at: '2026-05-05T19:42:53.206Z',
      },
    ]);

    await trx('groups').insert({
      id: ids.groupRoberto,
      course_id: ids.course,
      name: 'ROBERTO | LUNES Y MIÉRCOLES | 07:00 A 08:00',
      status: 'active',
      schedule_text: 'LUNES Y MIÉRCOLES | 07:00 A 08:00',
      code: 'M07 ROBERTO',
      timezone: 'America/Bogota',
      start_date: '2026-04-13',
      end_date: '2026-08-31',
      capacity: 30,
      is_active: true,
      created_at: '2026-04-09T23:52:14.970Z',
      updated_at: '2026-04-09T23:52:14.970Z',
    });

    await trx('group_teachers').insert({
      group_id: ids.groupRoberto,
      user_id: instructor.id,
      role: 'lead',
      assigned_at: '2026-04-10T00:20:34.601Z',
    });

    await trx('enrollments').insert([
      {
        id: '749cb943-faf1-4138-8b20-5dac2eb3fcdc',
        course_id: ids.course,
        user_id: isaac.id,
        status: 'active',
        enrolled_at: '2026-04-09T23:50:18.674Z',
      },
      {
        id: 'c08c6916-465f-49ac-a270-6af0b849afb9',
        course_id: ids.course,
        user_id: nora.id,
        status: 'active',
        enrolled_at: '2026-04-09T23:50:18.674Z',
      },
    ]);

    await trx('group_students').insert([
      {
        group_id: ids.groupRoberto,
        user_id: isaac.id,
        joined_at: '2026-04-09T23:52:29.199Z',
        status: 'active',
      },
      {
        group_id: ids.groupRoberto,
        user_id: nora.id,
        joined_at: '2026-04-09T23:52:31.091Z',
        status: 'active',
      },
    ]);

    await trx('live_session_series').insert({
      id: ids.liveSeries,
      group_id: ids.groupRoberto,
      course_id: ids.course,
      module_id: ids.moduleLibrary,
      class_type_id: conversationType.id,
      host_teacher_id: instructor.id,
      title: 'DARIUS FORD: 8am - 10am',
      timezone: 'America/Bogota',
      rrule: 'FREQ=WEEKLY;BYDAY=SU,TH',
      dtstart: '2026-08-04T03:30:13.000Z',
      dtend: '2026-10-01T03:30:13.000Z',
      duration_minutes: 30,
      published: true,
      join_url: 'https://meet.google.com',
      host_url: null,
      created_by: admin.id,
      created_at: '2026-08-04T03:31:31.505Z',
      updated_at: '2026-08-04T04:06:57.155Z',
    });

    await trx('live_sessions').insert(
      liveSessions.map(([id, startsAt, endsAt]) => ({
        id,
        series_id: ids.liveSeries,
        group_id: ids.groupRoberto,
        module_id: ids.moduleLibrary,
        class_type_id: conversationType.id,
        host_teacher_id: instructor.id,
        starts_at: startsAt,
        ends_at: endsAt,
        published: true,
        status: 'scheduled',
        join_url: 'https://meet.google.com',
        host_url: null,
        created_at: '2026-08-04T04:07:00.808Z',
        updated_at: '2026-08-04T04:07:00.808Z',
      })),
    );

    await trx('quiz_questions').insert({
      id: ids.quizQuestionAgenda,
      lesson_id: ids.lessonAgenda,
      question_text: 'Pregunta',
      question_type: 'multiple_choice',
      order_index: 1,
      points: 1,
      explanation: 'pregunta',
      created_at: '2026-04-16T15:44:50.741Z',
      updated_at: '2026-04-16T15:44:50.741Z',
    });

    await trx('quiz_options').insert([
      {
        id: '2c2b4487-fc68-41e2-8547-262053bb46e0',
        question_id: ids.quizQuestionAgenda,
        option_text: '1',
        is_correct: true,
        order_index: 1,
        points: 0,
        created_at: '2026-04-16T15:44:50.760Z',
        updated_at: '2026-04-16T15:44:50.760Z',
      },
      {
        id: '610f1683-75c4-44a9-94e7-9f936cd1f5aa',
        question_id: ids.quizQuestionAgenda,
        option_text: '2',
        is_correct: false,
        order_index: 2,
        points: 0,
        created_at: '2026-04-16T15:44:50.772Z',
        updated_at: '2026-04-16T15:44:50.772Z',
      },
      {
        id: '6d85500a-1dc2-4d90-9bef-36ff312f797a',
        question_id: ids.quizQuestionAgenda,
        option_text: '3',
        is_correct: false,
        order_index: 3,
        points: 0,
        created_at: '2026-04-16T15:44:50.781Z',
        updated_at: '2026-04-16T15:44:50.781Z',
      },
    ]);

    await trx('announcements').insert({
      id: ids.announcementNoClass,
      scope: 'group',
      course_id: ids.course,
      group_id: ids.groupRoberto,
      created_by_user_id: admin.id,
      title: 'NO HAY CLASE',
      body: 'NO HAY CLASE POR TAL RAZON',
      status: 'published',
      priority: 1,
      starts_at: '2026-04-16T00:26:48.000Z',
      expires_at: '2026-04-19T00:26:48.000Z',
      created_at: '2026-04-10T00:27:43.775Z',
    });

    await trx('course_posts').insert({
      id: ids.coursePostWelcome,
      course_id: ids.course,
      group_id: null,
      created_by_user_id: admin.id,
      title: '✨ BIENVENIDO/A AL CURSO',
      body: '¡Hola! 👋\n\nNos alegra muchísimo tenerte aquí.\n\nEstás a punto de comenzar un proceso de aprendizaje diseñado para ayudarte a mejorar tu inglés de forma práctica, dinámica y enfocada en resultados reales.\n\n🚀 ¿Qué encontrarás en este curso?\n\nClases en vivo con profesores\nMaterial de apoyo (videos, audios y ejercicios)\nActividades para practicar a tu ritmo\nSeguimiento de tu progreso\n\n📅 Recomendaciones para empezar\n\nRevisa el calendario de clases\nAsiste puntualmente a tus sesiones\nParticipa activamente (¡equivocarse también es aprender!)\nPractica constantemente\n\n💬 ¿Necesitas ayuda?\n\nSi tienes dudas o necesitas soporte, nuestro equipo estará disponible para ayudarte.\n\n👉 Recuerda: La constancia es la clave del éxito.\n¡Estamos contigo en este proceso! 💪',
      created_at: '2026-04-15T21:26:58.783Z',
      updated_at: '2026-04-15T21:29:37.702Z',
    });

    await trx('forums').insert({
      id: ids.forumRoberto,
      scope: 'group',
      course_id: ids.course,
      group_id: ids.groupRoberto,
      title: 'ROBERTO | LUNES Y MIÉRCOLES | 07:00 A 08:00',
      description: 'Foro del grupo',
      is_active: true,
      created_by: null,
      created_at: '2026-08-04T03:11:57.832Z',
      updated_at: '2026-08-04T03:11:57.832Z',
    });
  });
};

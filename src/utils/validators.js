const { z } = require('zod');

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .email('Email must be valid'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

const lessonProgressSchema = z
  .object({
    status: z.enum(['not_started', 'in_progress', 'done'], {
      errorMap: () => ({ message: 'Invalid status value' }),
    }),
    progressPercent: z.union([z.number(), z.string(), z.null(), z.undefined()]).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.progressPercent === undefined ||
      data.progressPercent === null ||
      data.progressPercent === ''
    ) {
      return;
    }

    const value = Number(data.progressPercent);
    if (Number.isNaN(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['progressPercent'],
        message: 'progressPercent must be a number',
      });
      return;
    }

    if (value < 0 || value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['progressPercent'],
        message: 'progressPercent must be between 0 and 100',
      });
    }
  })
  .transform((data) => ({
    status: data.status,
    progressPercent:
      data.progressPercent === undefined ||
      data.progressPercent === null ||
      data.progressPercent === ''
        ? undefined
        : Number(data.progressPercent),
  }));

const uuidSchema = z
  .string({ required_error: 'studentId is required' })
  .trim()
  .uuid({ message: 'studentId must be a valid UUID' });

const quizAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid({ message: 'questionId must be a valid UUID' }),
        optionId: z.string().uuid({ message: 'optionId must be a valid UUID' }),
      }),
    )
    .min(1, 'At least one answer is required'),
});

const passwordSchema = z
  .string({ required_error: 'password is required' })
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a digit');

const userCreateSchema = z.object({
  fullName: z
    .string({ required_error: 'fullName is required' })
    .trim()
    .min(1, 'fullName is required'),
  email: z
    .string({ required_error: 'email is required' })
    .trim()
    .email('Email must be valid'),
  role: z.enum(['student', 'instructor', 'content_editor', 'enrollment_manager'], {
    errorMap: () => ({ message: 'Invalid role selection' }),
  }),
});

const activationSchema = z.object({
  token: z.string({ required_error: 'token is required' }).min(1, 'token is required'),
  password: passwordSchema,
});

const questionTypeEnum = z.enum(['single_choice', 'true_false']);

const preprocessInt = (min = 1) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === '') {
      return undefined;
    }
    if (typeof val === 'number') {
      return val;
    }
    const parsed = Number(val);
    return Number.isNaN(parsed) ? val : parsed;
  }, z.number().int().min(min));

const quizQuestionCreateSchema = z.object({
  questionText: z
    .string({ required_error: 'questionText is required' })
    .trim()
    .min(1, 'questionText is required'),
  questionType: questionTypeEnum.optional(),
  orderIndex: preprocessInt().optional(),
});

const quizQuestionUpdateSchema = z
  .object({
    questionText: z.string().trim().min(1).optional(),
    questionType: questionTypeEnum.optional(),
    orderIndex: preprocessInt().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

const quizOptionCreateSchema = z.object({
  optionText: z
    .string({ required_error: 'optionText is required' })
    .trim()
    .min(1, 'optionText is required'),
  isCorrect: z.boolean().optional(),
  orderIndex: preprocessInt().optional(),
});

const quizOptionUpdateSchema = z
  .object({
    optionText: z.string().trim().min(1).optional(),
    isCorrect: z.boolean().optional(),
    orderIndex: preprocessInt().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

const courseCreateSchema = z.object({
  title: z
    .string({ required_error: 'title is required' })
    .trim()
    .min(1, 'title is required'),
  description: z.string().optional(),
  level: z.string().optional(),
  ownerUserId: z.string().uuid().optional(),
});

const courseUpdateSchema = z
  .object({
    title: z.string().trim().min(1, 'title is required').optional(),
    description: z.string().optional(),
    level: z.string().optional(),
    ownerUserId: z.string().uuid().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

const instructorAssignSchema = z.object({
  instructorIds: z.array(z.string().uuid()).optional(),
});

const staffRoleEnum = z.enum(['instructor', 'content_editor', 'enrollment_manager']);

const courseStaffAssignSchema = z.object({
  userId: z.string({ required_error: 'userId is required' }).uuid({ message: 'userId must be a valid UUID' }),
  roles: z
    .array(staffRoleEnum, { required_error: 'roles is required' })
    .min(1, 'At least one role is required')
    .refine(
      (items) => new Set(items).size === items.length,
      { message: 'roles must be unique', path: ['roles'] },
    ),
});

const moduleCreateSchema = z.object({
  title: z
    .string({ required_error: 'title is required' })
    .trim()
    .min(1, 'title is required'),
  orderIndex: preprocessInt().optional(),
});

const moduleUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    orderIndex: preprocessInt().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

const lessonCreateSchema = z.object({
  title: z
    .string({ required_error: 'title is required' })
    .trim()
    .min(1, 'title is required'),
  contentText: z.string().optional(),
  contentMarkdown: z.string().optional(),
  videoUrl: z.string().url().optional(),
  estimatedMinutes: preprocessInt().optional(),
  orderIndex: preprocessInt().optional(),
});

const lessonUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    contentText: z.string().optional(),
    contentMarkdown: z.string().optional(),
    videoUrl: z.string().url().optional(),
    estimatedMinutes: preprocessInt().optional(),
    orderIndex: preprocessInt().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

const formatZodError = (error) =>
  error.errors
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : 'value';
      return `${path}: ${issue.message}`;
    })
    .join(', ');

const enrollStudentSchema = z.object({
  studentId: z
    .string({ required_error: 'studentId is required' })
    .trim()
    .uuid({ message: 'studentId must be a valid UUID' }),
  groupId: z
    .string()
    .uuid({ message: 'groupId must be a valid UUID' })
    .optional()
    .nullable(),
});

const assignGroupSchema = z.object({
  groupId: z
    .string({ required_error: 'groupId is required' })
    .trim()
    .uuid({ message: 'groupId must be a valid UUID' })
    .nullable(),
});

const groupTeacherAssignSchema = z.object({
  userId: z
    .string({ required_error: 'userId is required' })
    .trim()
    .uuid({ message: 'userId must be a valid UUID' }),
});

const bulkEnrollSchema = z.object({
  studentIds: z
    .array(
      z
        .string()
        .trim()
        .uuid({ message: 'studentIds must contain valid UUIDs' }),
    )
    .min(1, 'Select at least one student'),
  groupId: z
    .string()
    .uuid({ message: 'groupId must be a valid UUID' })
    .optional()
    .nullable(),
});

module.exports = {
  loginSchema,
  lessonProgressSchema,
  uuidSchema,
  courseCreateSchema,
  courseUpdateSchema,
  instructorAssignSchema,
  courseStaffAssignSchema,
  moduleCreateSchema,
  moduleUpdateSchema,
  lessonCreateSchema,
  lessonUpdateSchema,
  quizAttemptSchema,
  quizQuestionCreateSchema,
  quizQuestionUpdateSchema,
  quizOptionCreateSchema,
  quizOptionUpdateSchema,
  userCreateSchema,
  activationSchema,
  enrollStudentSchema,
  assignGroupSchema,
  groupTeacherAssignSchema,
  bulkEnrollSchema,
  formatZodError,
};

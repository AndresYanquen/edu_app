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
  videoUrl: z.string().url().optional(),
  estimatedMinutes: preprocessInt().optional(),
  orderIndex: preprocessInt().optional(),
});

const lessonUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    contentText: z.string().optional(),
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

module.exports = {
  loginSchema,
  lessonProgressSchema,
  uuidSchema,
  courseCreateSchema,
  courseUpdateSchema,
  instructorAssignSchema,
  moduleCreateSchema,
  moduleUpdateSchema,
  lessonCreateSchema,
  lessonUpdateSchema,
  quizAttemptSchema,
  formatZodError,
};

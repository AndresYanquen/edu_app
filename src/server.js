const express = require('express');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');

const authRoutes = require('./routes/auth');
const meRoutes = require('./routes/me');
const coursesRoutes = require('./routes/courses');
const progressRoutes = require('./routes/progress');
const quizzesRoutes = require('./routes/quizzes');
const instructorRoutes = require('./routes/instructor');
const liveSessionRoutes = require('./routes/liveSessions');
const cmsRoutes = require('./routes/cms');
const adminRoutes = require('./routes/admin');
const themeRoutes = require('./routes/theme');
const notificationsRoutes = require('./routes/notifications');
const presenceRoutes = require('./routes/presence');
const forumsRoutes = require('./routes/forums');
const gamificationRoutes = require('./routes/gamification');
const submissionsRoutes = require('./routes/submissions');
const leahRoutes = require('./integrations/leah/leah.routes');
const swaggerDocument = require('./docs/openapi');

const app = express();
app.set('trust proxy', 1);

const uploadsDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
if (env.ENABLE_PUBLIC_LOCAL_UPLOADS === 'true' && env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(uploadsDir));
}

const corsOptions = {
  origin: env.FRONTEND_ORIGIN,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: env.URLENCODED_BODY_LIMIT }));

const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication requests, try again later' },
});
const authRateLimitDisabled = env.NODE_ENV !== 'production';

const adminBulkInviteLimiter = rateLimit({
  windowMs: env.ADMIN_BULK_INVITE_RATE_LIMIT_WINDOW_MS,
  max: env.ADMIN_BULK_INVITE_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many bulk invite requests, try again later' },
});


if (env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :response-time ms'));
}

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

if (!authRateLimitDisabled) {
  app.use('/auth', authLimiter);
}
app.use('/admin/users/bulk-invite', adminBulkInviteLimiter);
app.use('/auth', authRoutes);
app.use('/me', meRoutes);
app.use('/courses', coursesRoutes);
app.use('/cms', cmsRoutes);
app.use(themeRoutes);
app.use('/admin', adminRoutes);
app.use(notificationsRoutes);
app.use(presenceRoutes);
app.use(forumsRoutes);
app.use(gamificationRoutes);
app.use(submissionsRoutes);
app.use(progressRoutes);
app.use(quizzesRoutes);
app.use(liveSessionRoutes);
app.use(instructorRoutes);
app.use('/integrations/leah', leahRoutes);

const PORT = env.PORT;
const REQUEST_TIMEOUT_MS = env.SERVER_REQUEST_TIMEOUT_MS;
const HEADERS_TIMEOUT_MS = env.SERVER_HEADERS_TIMEOUT_MS;
const KEEP_ALIVE_TIMEOUT_MS = env.SERVER_KEEP_ALIVE_TIMEOUT_MS;

const server = app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
server.requestTimeout = REQUEST_TIMEOUT_MS;
server.headersTimeout = HEADERS_TIMEOUT_MS;
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;

module.exports = app;

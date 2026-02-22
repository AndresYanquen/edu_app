const dotenv = require('dotenv');
const express = require('express');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const rateLimit = require('express-rate-limit');

dotenv.config();

const authRoutes = require('./routes/auth');
const meRoutes = require('./routes/me');
const coursesRoutes = require('./routes/courses');
const progressRoutes = require('./routes/progress');
const quizzesRoutes = require('./routes/quizzes');
const instructorRoutes = require('./routes/instructor');
const liveSessionRoutes = require('./routes/liveSessions');
const cmsRoutes = require('./routes/cms');
const adminRoutes = require('./routes/admin');
const notificationsRoutes = require('./routes/notifications');
const swaggerDocument = require('./docs/openapi');

const app = express();
app.set('trust proxy', 1);

const uploadsDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

const corsOptions = {
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || '1mb' }));

const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication requests, try again later' },
});

const adminBulkInviteLimiter = rateLimit({
  windowMs: Number(process.env.ADMIN_BULK_INVITE_RATE_LIMIT_WINDOW_MS || 60 * 1000),
  max: Number(process.env.ADMIN_BULK_INVITE_RATE_LIMIT_MAX || 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many bulk invite requests, try again later' },
});


if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :response-time ms'));
}

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/auth', authLimiter);
app.use('/admin/users/bulk-invite', adminBulkInviteLimiter);
app.use('/auth', authRoutes);
app.use('/me', meRoutes);
app.use('/courses', coursesRoutes);
app.use('/cms', cmsRoutes);
app.use('/admin', adminRoutes);
app.use(notificationsRoutes);
app.use(progressRoutes);
app.use(quizzesRoutes);
app.use(instructorRoutes);
app.use(liveSessionRoutes);

const PORT = process.env.PORT || 3000;
const REQUEST_TIMEOUT_MS = Number(process.env.SERVER_REQUEST_TIMEOUT_MS || 15_000);
const HEADERS_TIMEOUT_MS = Number(process.env.SERVER_HEADERS_TIMEOUT_MS || 10_000);
const KEEP_ALIVE_TIMEOUT_MS = Number(process.env.SERVER_KEEP_ALIVE_TIMEOUT_MS || 5_000);

const server = app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
server.requestTimeout = REQUEST_TIMEOUT_MS;
server.headersTimeout = HEADERS_TIMEOUT_MS;
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;

module.exports = app;

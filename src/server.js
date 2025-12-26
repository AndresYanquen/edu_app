const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');

dotenv.config();

const authRoutes = require('./routes/auth');
const meRoutes = require('./routes/me');
const coursesRoutes = require('./routes/courses');
const progressRoutes = require('./routes/progress');
const quizzesRoutes = require('./routes/quizzes');
const instructorRoutes = require('./routes/instructor');
const cmsRoutes = require('./routes/cms');
const swaggerDocument = require('./docs/openapi');

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :response-time ms'));
}

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/auth', authRoutes);
app.use('/me', meRoutes);
app.use('/courses', coursesRoutes);
app.use('/cms', cmsRoutes);
app.use(progressRoutes);
app.use(quizzesRoutes);
app.use(instructorRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});

module.exports = app;

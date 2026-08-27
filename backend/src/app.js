const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const env = require('./config/env');
const requestLogger = require('./middlewares/requestLogger.middleware');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');
const { apiWriteLimiter } = require('./middlewares/rateLimit.middleware');
const routes = require('./routes');
const { uploadRoot } = require('./modules/attachments/storage');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use('/api', apiWriteLimiter);

// Force download rather than inline render — an uploaded .html/.svg must never execute as if it
// were served from the app's own origin.
app.use('/uploads', express.static(uploadRoot, {
  setHeaders: (res) => {
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

app.get('/health', (req, res) => res.json({ success: true, message: 'ALMS backend is healthy', timestamp: new Date().toISOString() }));

const openapiPath = path.join(__dirname, 'docs', 'openapi.yaml');
try {
  const openapiDocument = YAML.load(openapiPath);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));
} catch (err) {
  // Docs are non-critical to the app booting; log and continue.
  // eslint-disable-next-line no-console
  console.warn('Could not load OpenAPI docs:', err.message);
}

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

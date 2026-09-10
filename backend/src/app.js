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

// Force download rather than inline render, by default — an uploaded .html/.svg must never
// execute as if it were served from the app's own origin. PDFs and JPEGs are the exception: they
// carry no script-execution risk in a browser (a sandboxed PDF viewer, or a raster image), so they
// open inline instead — matching how a user expects "View document" to behave — while everything
// else still forces a download. `?download` (any value, or none) always forces a download
// regardless of type, for the explicit "Download" affordance next to that inline view.
const INLINE_SAFE_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg']);
app.use('/uploads', (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  const inline = INLINE_SAFE_EXTENSIONS.has(ext) && req.query.download === undefined;
  res.setHeader('Content-Disposition', inline ? 'inline' : 'attachment');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, express.static(uploadRoot));

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

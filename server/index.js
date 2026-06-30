import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEntry, deleteEntry, listEntries, updateEntry } from './db.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;
const appUsername = process.env.APP_USERNAME;
const appPassword = process.env.APP_PASSWORD;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!sessionSecret) {
  throw new Error('SESSION_SECRET is required');
}

if (!appUsername || !appPassword) {
  throw new Error('APP_USERNAME and APP_PASSWORD are required');
}

app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', 1);
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 14
    }
  })
);

if (allowedOrigins.length > 0) {
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Origin not allowed by CORS'));
      }
    })
  );
}

app.post('/api/auth/login', (request, response) => {
  const username = sanitizeText(request.body?.username);
  const password = sanitizeText(request.body?.password);

  if (username !== appUsername || password !== appPassword) {
    response.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  request.session.user = { username };
  response.json({ user: { username } });
});

app.post('/api/auth/logout', (request, response, next) => {
  request.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    response.clearCookie('connect.sid');
    response.status(204).end();
  });
});

app.get('/api/auth/me', (request, response) => {
  if (!request.session.user) {
    response.status(401).json({ authenticated: false });
    return;
  }

  response.json({
    authenticated: true,
    user: request.session.user
  });
});

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/api/entries', requireAuth, async (_request, response, next) => {
  try {
    const entries = await listEntries();
    response.json({ entries });
  } catch (error) {
    next(error);
  }
});

app.post('/api/entries', requireAuth, async (request, response, next) => {
  try {
    const payload = parseEntryPayload(request.body);
    const entry = await createEntry(payload);
    response.status(201).json({ entry });
  } catch (error) {
    next(error);
  }
});

app.put('/api/entries/:id', requireAuth, async (request, response, next) => {
  try {
    const payload = parseEntryPayload(request.body);
    const updated = await updateEntry(request.params.id, payload);

    if (!updated) {
      response.status(404).json({ error: 'Entry not found' });
      return;
    }

    response.json({ entry: updated });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/entries/:id', requireAuth, async (request, response, next) => {
  try {
    const removed = await deleteEntry(request.params.id);

    if (!removed) {
      response.status(404).json({ error: 'Entry not found' });
      return;
    }

    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

const distPath = path.resolve(__dirname, '../dist');
const hasBuiltClient = fs.existsSync(path.join(distPath, 'index.html'));

if (hasBuiltClient) {
  app.use(express.static(distPath));

  app.get('*', (_request, response) => {
    response.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (_request, response) => {
    response.status(200).json({
      message:
        'Frontend build not found. Run "npm run build" before "npm start", or use "npm run dev" for local development.'
    });
  });
}

app.use((error, _request, response, _next) => {
  const status = error.statusCode || 500;
  response.status(status).json({
    error: error.message || 'Unexpected server error'
  });
});

app.listen(port, () => {
  console.log(`Journal app listening on port ${port}`);
});

function parseEntryPayload(body) {
  const title = sanitizeText(body?.title);
  const content = sanitizeText(body?.content);
  const mood = sanitizeText(body?.mood);
  const tags = parseTags(body?.tags);

  if (!content) {
    const error = new Error('Content is required');
    error.statusCode = 400;
    throw error;
  }

  return { title, content, mood, tags };
}

function sanitizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => sanitizeText(tag)).filter(Boolean).slice(0, 12);
  }

  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function requireAuth(request, response, next) {
  if (!request.session.user) {
    response.status(401).json({ error: 'Authentication required' });
    return;
  }

  next();
}
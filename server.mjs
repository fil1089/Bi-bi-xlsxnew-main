// Bi-bi XLSX Lite — основной сервер для Sprinthost (Passenger 4.0).
// Express + статика (Vite build) + /api на Neon Postgres.
// Схема 1:1 как server_live.mjs у aibrainpulse.ru.
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // Тот же домен — CORS не нужен; кросс-домен разрешаем только для ALLOWED_ORIGIN.
      if (!ALLOWED_ORIGIN) return callback(null, false);
      if (!origin) return callback(null, true);
      if (origin === ALLOWED_ORIGIN) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(compression());
// Таблицы целиком летят в JSON — запас с головой для РФ-маршрута без VPN.
app.use(express.json({ limit: '50mb' }));

// ── Адаптер: serverless-стиль handler(req, res) -> Express ──
function handler(fn) {
  return async (req, res) => {
    if (req.params) Object.assign(req.query, req.params);
    try {
      await fn(req, res);
    } catch (e) {
      console.error('Handler error:', e);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  };
}

// ── Ленивая загрузка API-хендлеров (после биндинга порта) ──
async function loadHandlers() {
  const { default: signupHandler } = await import('./api/auth/signup.mjs');
  const { default: loginHandler } = await import('./api/auth/login.mjs');
  const { default: meHandler } = await import('./api/auth/me.mjs');
  const { default: filesHandler } = await import('./api/files/index.mjs');
  const { default: deleteHandler } = await import('./api/files/delete.mjs');

  app.all('/api/auth/signup', handler(signupHandler));
  app.all('/api/auth/login', handler(loginHandler));
  app.all('/api/auth/me', handler(meHandler));
  app.all('/api/files', handler(filesHandler));
  app.all('/api/files/delete', handler(deleteHandler));

  app.get('/api/health', async (req, res) => {
    try {
      const { sql } = await import('./api/_db.mjs');
      await sql`SELECT 1 AS ok`;
      res.json({ status: 'ok', db: 'connected' });
    } catch (err) {
      res.status(500).json({ status: 'error', db: err.message });
    }
  });
}

// ── Статика Vite-сборки ──
const distPath = path.join(__dirname, 'public_html');
app.use(express.static(distPath));

// ── Старт: сначала listen (сигнал готовности для Passenger), потом хендлеры ──
function startServer(retriesLeft = 5) {
  const server = app.listen(PORT, () => {
    console.log(`Bi-bi server on port ${PORT}`);
    console.log(`Serving static from: ${distPath}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && retriesLeft > 0) {
      console.warn(`Port ${PORT} busy, retry in 3s (${retriesLeft} left)`);
      setTimeout(() => startServer(retriesLeft - 1), 3000);
    } else {
      console.error('Listen failed:', err);
      process.exit(1);
    }
  });
}
startServer();

loadHandlers()
  .then(() => {
    // SPA fallback — после загрузки хендлеров.
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        res.sendFile(path.join(distPath, 'index.html'));
      } else if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API route not found' });
      } else {
        next();
      }
    });
  })
  .catch((err) => {
    console.error('Failed to load handlers:', err);
    process.exit(1);
  });

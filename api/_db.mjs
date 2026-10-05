// Серверный хелпер подключения к Neon Postgres (Sprinthost-версия, ESM).
// Используется только в /api. DATABASE_URL в браузер не попадает.
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL не задан в переменных окружения');
}

export const sql = neon(process.env.DATABASE_URL);

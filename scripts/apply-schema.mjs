// Применение schema.sql к базе Neon.
// Запуск:  node scripts/apply-schema.mjs
// Требует переменную окружения DATABASE_URL (или читает .env.local).

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Минимальный парсер .env.local, если DATABASE_URL не задан в окружении
function loadEnv() {
    if (process.env.DATABASE_URL) return;
    try {
        const env = readFileSync(join(root, '.env.local'), 'utf8');
        for (const line of env.split('\n')) {
            const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
            if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
        }
    } catch { /* нет файла — ок */ }
}

loadEnv();

if (!process.env.DATABASE_URL) {
    console.error('Ошибка: не задана переменная DATABASE_URL.');
    process.exit(1);
}

// Отдельные стейтменты — neon serverless не выполняет multi-statement через .query()
const STATEMENTS = [
    `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,
    `CREATE TABLE IF NOT EXISTS bibi_users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS bibi_users_email_lower_idx ON bibi_users (lower(email))`,
    `CREATE TABLE IF NOT EXISTS bibi_files (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id           UUID NOT NULL REFERENCES bibi_users(id) ON DELETE CASCADE,
        file_name         TEXT NOT NULL,
        file_data         JSONB NOT NULL DEFAULT '{}'::jsonb,
        sheet_data        JSONB NOT NULL DEFAULT '[]'::jsonb,
        headers           JSONB NOT NULL DEFAULT '[]'::jsonb,
        notes             JSONB NOT NULL DEFAULT '{}'::jsonb,
        highlighted_cells JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, file_name)
    )`,
    `CREATE INDEX IF NOT EXISTS bibi_files_user_id_idx ON bibi_files (user_id)`,
];

const sql = neon(process.env.DATABASE_URL);

for (const stmt of STATEMENTS) {
    await sql.query(stmt);
    console.log('OK:', stmt.trim().split('\n')[0].slice(0, 60));
}

console.log('\nСхема применена.');

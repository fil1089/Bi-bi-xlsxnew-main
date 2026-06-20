-- Схема БД для Bi-bi XLSX Editor (Neon Postgres)
-- Применить в Neon SQL Editor или: node scripts/apply-schema.mjs
--
-- ВАЖНО: в этой базе Neon уже есть таблицы других проектов (users, entries, ...).
-- Поэтому наши таблицы используют префикс bibi_, чтобы не конфликтовать.

-- Расширение для генерации UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Пользователи (замена Supabase Auth)
CREATE TABLE IF NOT EXISTS bibi_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email храним в нижнем регистре — уникальность без учёта регистра
CREATE UNIQUE INDEX IF NOT EXISTS bibi_users_email_lower_idx ON bibi_users (lower(email));

-- Файлы пользователей (замена таблицы files в Supabase)
CREATE TABLE IF NOT EXISTS bibi_files (
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
);

CREATE INDEX IF NOT EXISTS bibi_files_user_id_idx ON bibi_files (user_id);

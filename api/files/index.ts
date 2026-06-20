// /api/files
//   GET  -> { files: [...] }                список файлов пользователя
//   POST { file_name, file_data, sheet_data, headers, notes, highlighted_cells }
//        -> { file }                          upsert по (user_id, file_name)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_db';
import { applyCors, getUserFromRequest } from '../_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    applyCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();

    const payload = getUserFromRequest(req);
    if (!payload) {
        return res.status(401).json({ error: 'Не авторизован' });
    }
    const userId = payload.sub;

    try {
        if (req.method === 'GET') {
            const files = await sql`
                SELECT id, file_name, file_data, sheet_data, headers, notes,
                       highlighted_cells, created_at, updated_at
                FROM bibi_files
                WHERE user_id = ${userId}
                ORDER BY updated_at DESC
            `;
            return res.status(200).json({ files });
        }

        if (req.method === 'POST') {
            const {
                file_name,
                file_data = {},
                sheet_data = [],
                headers = [],
                notes = {},
                highlighted_cells = {},
            } = req.body || {};

            if (typeof file_name !== 'string' || !file_name.trim()) {
                return res.status(400).json({ error: 'Не указано имя файла' });
            }

            // Upsert по уникальному ключу (user_id, file_name).
            // JSONB-поля передаём как строки и кастуем на стороне БД.
            const rows = await sql`
                INSERT INTO bibi_files
                    (user_id, file_name, file_data, sheet_data, headers, notes, highlighted_cells)
                VALUES (
                    ${userId},
                    ${file_name},
                    ${JSON.stringify(file_data)}::jsonb,
                    ${JSON.stringify(sheet_data)}::jsonb,
                    ${JSON.stringify(headers)}::jsonb,
                    ${JSON.stringify(notes)}::jsonb,
                    ${JSON.stringify(highlighted_cells)}::jsonb
                )
                ON CONFLICT (user_id, file_name) DO UPDATE SET
                    file_data = EXCLUDED.file_data,
                    sheet_data = EXCLUDED.sheet_data,
                    headers = EXCLUDED.headers,
                    notes = EXCLUDED.notes,
                    highlighted_cells = EXCLUDED.highlighted_cells,
                    updated_at = now()
                RETURNING id, file_name, file_data, sheet_data, headers, notes,
                          highlighted_cells, created_at, updated_at
            `;
            return res.status(200).json({ file: rows[0] });
        }

        return res.status(405).json({ error: 'Метод не поддерживается' });
    } catch (err: any) {
        console.error('files error:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}

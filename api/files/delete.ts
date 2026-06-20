// POST /api/files/delete  { file_name } -> { ok: true }
// (DELETE с телом ненадёжен у некоторых клиентов, поэтому POST.)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_db.js';
import { applyCors, getUserFromRequest } from '../_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    applyCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

    const payload = getUserFromRequest(req);
    if (!payload) {
        return res.status(401).json({ error: 'Не авторизован' });
    }

    try {
        const { file_name } = req.body || {};
        if (typeof file_name !== 'string' || !file_name.trim()) {
            return res.status(400).json({ error: 'Не указано имя файла' });
        }

        await sql`
            DELETE FROM bibi_files
            WHERE user_id = ${payload.sub} AND file_name = ${file_name}
        `;
        return res.status(200).json({ ok: true });
    } catch (err: any) {
        console.error('files/delete error:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}

// GET /api/auth/me  (Authorization: Bearer <token>) -> { user }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_db';
import { applyCors, getUserFromRequest } from '../_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    applyCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Метод не поддерживается' });

    const payload = getUserFromRequest(req);
    if (!payload) {
        return res.status(401).json({ error: 'Не авторизован' });
    }

    try {
        // Сверяемся с БД — пользователь мог быть удалён.
        const rows = await sql`
            SELECT id, email FROM bibi_users WHERE id = ${payload.sub} LIMIT 1
        `;
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        return res.status(200).json({ user: { id: rows[0].id, email: rows[0].email } });
    } catch (err: any) {
        console.error('me error:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}

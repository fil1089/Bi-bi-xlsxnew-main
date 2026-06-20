// POST /api/auth/login  { email, password } -> { token, user }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_db.js';
import { applyCors, verifyPassword, signToken, isValidEmail } from '../_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    applyCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

    try {
        const { email, password } = req.body || {};

        if (!isValidEmail(email) || typeof password !== 'string' || !password) {
            return res.status(400).json({ error: 'Укажите email и пароль' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const rows = await sql`
            SELECT id, email, password_hash FROM bibi_users
            WHERE lower(email) = ${normalizedEmail} LIMIT 1
        `;

        // Один и тот же ответ при неверном email и неверном пароле — не раскрываем,
        // существует ли пользователь.
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const user = rows[0];
        const ok = await verifyPassword(password, user.password_hash);
        if (!ok) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const token = signToken({ sub: user.id, email: user.email });
        return res.status(200).json({ token, user: { id: user.id, email: user.email } });
    } catch (err: any) {
        console.error('login error:', err);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}

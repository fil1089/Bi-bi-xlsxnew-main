// POST /api/auth/signup  { email, password } -> { token, user }
import { sql } from '../_db.mjs';
import { applyCors, hashPassword, signToken, isValidEmail } from '../_auth.mjs';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const { email, password } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await sql`
      SELECT id FROM bibi_users WHERE lower(email) = ${normalizedEmail} LIMIT 1
    `;
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }

    const passwordHash = await hashPassword(password);
    const rows = await sql`
      INSERT INTO bibi_users (email, password_hash)
      VALUES (${normalizedEmail}, ${passwordHash})
      RETURNING id, email
    `;
    const user = rows[0];

    const token = signToken({ sub: user.id, email: user.email });
    return res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('signup error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

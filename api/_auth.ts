// Серверные хелперы аутентификации: JWT, хэширование паролей, извлечение
// текущего пользователя из запроса. Используются только в /api.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET не задан в переменных окружения');
}

const TOKEN_TTL = '30d';

export interface TokenPayload {
    sub: string;   // user id
    email: string;
}

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET as string, { expiresIn: TOKEN_TTL });
}

// Достаёт пользователя из заголовка Authorization: Bearer <token>.
// Возвращает payload или null, если токена нет/он невалиден.
export function getUserFromRequest(req: VercelRequest): TokenPayload | null {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    try {
        return jwt.verify(match[1], JWT_SECRET as string) as TokenPayload;
    } catch {
        return null;
    }
}

// Общие CORS-заголовки (фронт и API на одном домене Vercel, но пусть будет надёжно).
export function applyCors(res: VercelResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Простейшая валидация email.
export function isValidEmail(email: unknown): email is string {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

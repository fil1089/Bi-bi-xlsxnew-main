import { useState, useEffect, useCallback } from 'react';
import { api, type ApiUser } from '../lib/api';

// Хук авторизации поверх собственного API (Neon Postgres + JWT).
// Сохраняет интерфейс, совместимый с прежней версией на Supabase:
// user, loading, signIn, signUp, signOut.
export const useAuth = () => {
    const [user, setUser] = useState<ApiUser | null>(null);
    const [loading, setLoading] = useState(true);

    // При загрузке проверяем сохранённый токен через /api/auth/me
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const me = await api.me();
                if (!cancelled) setUser(me);
            } catch (err) {
                console.error('Не удалось восстановить сессию:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        try {
            const { user } = await api.signIn(email, password);
            setUser(user);
            return { data: { user }, error: null };
        } catch (err: any) {
            return { data: null, error: { message: err.message || 'Произошла ошибка' } };
        }
    }, []);

    const signUp = useCallback(async (email: string, password: string) => {
        try {
            const { user } = await api.signUp(email, password);
            setUser(user);
            return { data: { user }, error: null };
        } catch (err: any) {
            return { data: null, error: { message: err.message || 'Произошла ошибка' } };
        }
    }, []);

    const signOut = useCallback(async () => {
        api.signOut();
        setUser(null);
        return { error: null };
    }, []);

    return {
        user,
        loading,
        signIn,
        signUp,
        signOut,
    };
};

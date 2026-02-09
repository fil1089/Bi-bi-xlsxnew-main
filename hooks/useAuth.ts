import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

// Helper function to check if error is network-related
const isNetworkError = (err: any): boolean => {
    return (
        (err instanceof TypeError && err.message.includes('Load failed')) ||
        (err.name === 'AbortError') ||
        (err.message?.includes('network')) ||
        (err.message?.includes('fetch')) ||
        (err.message?.includes('Failed to fetch'))
    );
};

// Helper function to retry async operations
const retryAsync = async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 5,
    baseDelay: number = 1500
): Promise<T> => {
    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            lastError = err;
            if (isNetworkError(err) && attempt < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.log(`Auth: Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw err;
            }
        }
    }
    throw lastError;
};

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // If supabase is not configured, just set loading to false
        if (!supabase) {
            setLoading(false);
            return;
        }

        // Get initial session with retry for mobile networks
        const initSession = async () => {
            try {
                const { data: { session } } = await retryAsync(
                    () => supabase!.auth.getSession(),
                    3, // fewer retries for initial load
                    1000
                );
                setSession(session);
                setUser(session?.user ?? null);
            } catch (err) {
                console.error('Failed to get initial session:', err);
                // Still set loading to false so app can render
            } finally {
                setLoading(false);
            }
        };

        initSession();

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        if (!supabase) {
            return { data: null, error: { message: 'Authentication not configured' } };
        }
        try {
            const result = await retryAsync(async () => {
                return await supabase!.auth.signInWithPassword({
                    email,
                    password,
                });
            });
            return result;
        } catch (err: any) {
            console.error('SignIn error:', err);
            if (isNetworkError(err)) {
                return {
                    data: null,
                    error: { message: 'Проблема с сетью. Проверьте подключение к интернету и попробуйте снова.' }
                };
            }
            return { data: null, error: { message: err.message || 'Произошла ошибка' } };
        }
    }, []);

    const signUp = useCallback(async (email: string, password: string) => {
        if (!supabase) {
            return { data: null, error: { message: 'Authentication not configured' } };
        }
        try {
            const result = await retryAsync(async () => {
                return await supabase!.auth.signUp({
                    email,
                    password,
                });
            });
            return result;
        } catch (err: any) {
            console.error('SignUp error:', err);
            if (isNetworkError(err)) {
                return {
                    data: null,
                    error: { message: 'Проблема с сетью. Проверьте подключение к интернету и попробуйте снова.' }
                };
            }
            return { data: null, error: { message: err.message || 'Произошла ошибка' } };
        }
    }, []);

    const signOut = useCallback(async () => {
        if (!supabase) {
            return { error: { message: 'Authentication not configured' } };
        }
        try {
            const result = await retryAsync(async () => {
                return await supabase!.auth.signOut();
            });
            return result;
        } catch (err: any) {
            console.error('SignOut error:', err);
            if (isNetworkError(err)) {
                return { error: { message: 'Проблема с сетью. Проверьте подключение к интернету.' } };
            }
            return { error: { message: err.message || 'Произошла ошибка' } };
        }
    }, []);

    return {
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
    };
};

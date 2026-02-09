import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

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

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

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

    const signIn = async (email: string, password: string) => {
        if (!supabase) {
            return { data: null, error: { message: 'Authentication not configured' } };
        }
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            return { data, error };
        } catch (err: any) {
            // Handle network errors specifically
            if (err instanceof TypeError && err.message.includes('Load failed')) {
                return {
                    data: null,
                    error: { message: 'Проблема с сетью. Проверьте подключение к интернету.' }
                };
            }
            return { data: null, error: { message: err.message || 'Произошла ошибка' } };
        }
    };

    const signUp = async (email: string, password: string) => {
        if (!supabase) {
            return { data: null, error: { message: 'Authentication not configured' } };
        }
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });
            return { data, error };
        } catch (err: any) {
            // Handle network errors specifically
            if (err instanceof TypeError && err.message.includes('Load failed')) {
                return {
                    data: null,
                    error: { message: 'Проблема с сетью. Проверьте подключение к интернету.' }
                };
            }
            return { data: null, error: { message: err.message || 'Произошла ошибка' } };
        }
    };

    const signOut = async () => {
        if (!supabase) {
            return { error: { message: 'Authentication not configured' } };
        }
        try {
            const { error } = await supabase.auth.signOut();
            return { error };
        } catch (err: any) {
            // Handle network errors specifically
            if (err instanceof TypeError && err.message.includes('Load failed')) {
                return { error: { message: 'Проблема с сетью. Проверьте подключение к интернету.' } };
            }
            return { error: { message: err.message || 'Произошла ошибка' } };
        }
    };

    return {
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
    };
};

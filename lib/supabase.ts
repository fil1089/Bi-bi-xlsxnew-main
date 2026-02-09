import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only create client if credentials are provided
export const supabase: SupabaseClient | null = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'bibi-auth-token',
            // Changed from 'pkce' to 'implicit' for better iOS Safari compatibility
            flowType: 'implicit',
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
        global: {
            headers: {
                'X-Client-Info': 'bibi-xlsx-app',
            },
        },
    })
    : null;

export const isAuthEnabled = !!supabase;

export interface FileData {
    id?: string;
    user_id: string;
    file_name: string;
    file_data: any;
    sheet_data: any[][];
    headers: string[];
    notes: Record<string, string>;
    highlighted_cells: Record<string, 'green' | 'red'>;
    updated_at?: string;
    created_at?: string;
}

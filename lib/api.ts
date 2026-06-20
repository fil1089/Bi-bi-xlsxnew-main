// Клиент к серверному API (/api). Заменяет прямой доступ к Supabase.
// JWT хранится в localStorage; авторизованные запросы шлют его в заголовке.

const TOKEN_KEY = 'bibi-auth-token';

export interface ApiUser {
    id: string;
    email: string;
}

export interface FileRecord {
    id: string;
    file_name: string;
    file_data: any;
    sheet_data: any[][];
    headers: string[];
    notes: Record<string, string>;
    highlighted_cells: Record<string, 'green' | 'red'>;
    created_at?: string;
    updated_at?: string;
}

export interface FilePayload {
    file_name: string;
    file_data?: any;
    sheet_data: any[][];
    headers: string[];
    notes: Record<string, string>;
    highlighted_cells: Record<string, 'green' | 'red'>;
}

// Авторизация на основе собственного API всегда доступна (в отличие от
// опционального Supabase). Оставляем флаг для совместимости с компонентами.
export const isAuthEnabled = true;

// --- работа с токеном ---
export const getToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = (): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(TOKEN_KEY);
};

// --- низкоуровневый fetch к API ---
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api${path}`, { ...options, headers });

    let body: any = null;
    const text = await res.text();
    if (text) {
        try { body = JSON.parse(text); } catch { body = { error: text }; }
    }

    if (!res.ok) {
        const message = body?.error || `Ошибка запроса (${res.status})`;
        const err = new Error(message) as Error & { status?: number };
        err.status = res.status;
        throw err;
    }
    return body as T;
}

// --- аутентификация ---
export const api = {
    async signUp(email: string, password: string): Promise<{ token: string; user: ApiUser }> {
        const data = await request<{ token: string; user: ApiUser }>('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        setToken(data.token);
        return data;
    },

    async signIn(email: string, password: string): Promise<{ token: string; user: ApiUser }> {
        const data = await request<{ token: string; user: ApiUser }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        setToken(data.token);
        return data;
    },

    async me(): Promise<ApiUser | null> {
        if (!getToken()) return null;
        try {
            const data = await request<{ user: ApiUser }>('/auth/me', { method: 'GET' });
            return data.user;
        } catch (err: any) {
            if (err.status === 401) {
                clearToken();
                return null;
            }
            throw err;
        }
    },

    signOut(): void {
        clearToken();
    },

    // --- файлы ---
    async listFiles(): Promise<FileRecord[]> {
        const data = await request<{ files: FileRecord[] }>('/files', { method: 'GET' });
        return data.files;
    },

    async saveFile(payload: FilePayload): Promise<FileRecord> {
        const data = await request<{ file: FileRecord }>('/files', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return data.file;
    },

    async deleteFile(fileName: string): Promise<void> {
        await request('/files/delete', {
            method: 'POST',
            body: JSON.stringify({ file_name: fileName }),
        });
    },
};

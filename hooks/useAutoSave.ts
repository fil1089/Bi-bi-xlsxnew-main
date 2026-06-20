import { useRef, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

interface AutoSaveData {
    user_id: string;
    file_name: string;
    file_data: any;
    sheet_data: any[][];
    headers: string[];
    notes: Record<string, string>;
    highlighted_cells: Record<string, 'green' | 'red'>;
}

export const useAutoSave = (
    data: AutoSaveData | null,
    delay: number = 2000,
    onSavingChange?: (saving: boolean) => void,
    onSavingError?: (error: string | null) => void
) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedRef = useRef<string>('');
    const isSavingRef = useRef<boolean>(false);

    const save = useCallback(async (saveData: AutoSaveData) => {
        if (isSavingRef.current) {
            console.log('AutoSave: Save already in progress, skipping this cycle.');
            return;
        }

        const currentDataString = JSON.stringify(saveData);
        if (currentDataString === lastSavedRef.current) {
            return;
        }

        try {
            isSavingRef.current = true;
            onSavingChange?.(true);
            onSavingError?.(null);

            // Сервер делает upsert по (user_id, file_name) — отдельная проверка
            // существования не нужна.
            await api.saveFile({
                file_name: saveData.file_name,
                file_data: saveData.file_data,
                sheet_data: saveData.sheet_data,
                headers: saveData.headers,
                notes: saveData.notes,
                highlighted_cells: saveData.highlighted_cells,
            });

            lastSavedRef.current = currentDataString;
            onSavingError?.(null);
        } catch (err: any) {
            console.error('AutoSave: error:', err);
            let errorMessage = 'Ошибка сохранения';
            if (err.status === 401) {
                errorMessage = 'Сессия истекла. Войдите снова.';
            } else if (err.message) {
                errorMessage = `Ошибка: ${err.message}`;
            }
            onSavingError?.(errorMessage);
        } finally {
            isSavingRef.current = false;
            onSavingChange?.(false);
        }
    }, [onSavingChange, onSavingError]);

    useEffect(() => {
        if (!data || !data.user_id || !data.file_name) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            save(data);
        }, delay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [data, delay, save]);
};

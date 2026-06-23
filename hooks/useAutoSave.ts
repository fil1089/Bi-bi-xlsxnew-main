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
    delay: number = 5000,
    onSavingChange?: (saving: boolean) => void,
    onSavingError?: (error: string | null) => void
) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedRef = useRef<string>('');
    const isSavingRef = useRef<boolean>(false);
    // Последние данные, ожидающие сохранения. Нужны, чтобы перепланировать
    // попытку, если в момент срабатывания таймера предыдущее сохранение ещё идёт.
    const pendingDataRef = useRef<AutoSaveData | null>(null);
    // Актуальные данные для ручного flush() — чтобы не пересоздавать колбэк при
    // каждом изменении.
    const dataRef = useRef<AutoSaveData | null>(data);
    dataRef.current = data;

    const save = useCallback(async (saveData: AutoSaveData, isRetry = false) => {
        // Если сохранение уже идёт — не теряем цикл, а запоминаем данные и
        // перепланируем (сработает после завершения текущего запроса).
        if (isSavingRef.current) {
            pendingDataRef.current = saveData;
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
            // Сессия истекла — показываем сразу, ретрай не поможет.
            if (err.status === 401) {
                onSavingError?.('Сессия истекла. Войдите снова.');
            } else if (!isRetry) {
                // Разовый сбой/гонка — один тихий ретрай через 3 с, не пугаем
                // пользователя миганием ошибки.
                console.warn('AutoSave: первая попытка не удалась, тихий ретрай через 3с', err);
                isSavingRef.current = false;
                onSavingChange?.(false);
                setTimeout(() => save(saveData, true), 3000);
                return;
            } else {
                console.error('AutoSave: ошибка после ретрая:', err);
                onSavingError?.(err.message ? `Ошибка: ${err.message}` : 'Ошибка сохранения');
            }
        } finally {
            isSavingRef.current = false;
            onSavingChange?.(false);

            // Если за время сохранения накопились новые данные — сохранить их.
            const pending = pendingDataRef.current;
            if (pending && JSON.stringify(pending) !== lastSavedRef.current) {
                pendingDataRef.current = null;
                setTimeout(() => save(pending), 0);
            } else {
                pendingDataRef.current = null;
            }
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

    // Ручное сохранение «прямо сейчас»: отменяет отложенный автосейв и немедленно
    // отправляет актуальные данные на сервер, минуя debounce. Возвращает промис,
    // чтобы вызывающая сторона могла дождаться завершения (для подтверждения).
    const flush = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        const current = dataRef.current;
        if (!current || !current.user_id || !current.file_name) {
            return Promise.resolve();
        }
        return save(current);
    }, [save]);

    return flush;
};

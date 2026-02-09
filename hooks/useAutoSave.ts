import { useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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

    const retryWithBackoff = useCallback(async <T>(
        fn: () => Promise<T>,
        maxRetries: number = 5, // Increased for mobile
        baseDelay: number = 1500 // Longer base delay for mobile networks
    ): Promise<T> => {
        let lastError: any;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await fn();
            } catch (err: any) {
                lastError = err;
                // Check for network-related errors (Load failed, AbortError, network errors)
                const isNetworkError =
                    (err instanceof TypeError && err.message.includes('Load failed')) ||
                    (err.name === 'AbortError') ||
                    (err.message?.includes('network')) ||
                    (err.message?.includes('fetch'));

                if (isNetworkError) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    console.log(`AutoSave: Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw err; // Don't retry non-network errors
                }
            }
        }
        throw lastError;
    }, []);

    const saveToSupabase = useCallback(async (saveData: AutoSaveData) => {
        if (!supabase) {
            console.warn('AutoSave: Supabase client not initialized. Check your environment variables.');
            onSavingError?.('Ошибка инициализации Supabase. Проверьте настройки Vercel.');
            return;
        }

        if (isSavingRef.current) {
            console.log('AutoSave: Save already in progress, skipping this cycle.');
            return;
        }

        try {
            const currentDataString = JSON.stringify(saveData);
            if (currentDataString === lastSavedRef.current) {
                return;
            }

            console.log('AutoSave: Starting save for file:', saveData.file_name);
            isSavingRef.current = true;
            onSavingChange?.(true);
            onSavingError?.(null);

            // Check if file already exists for this user and name (with retry)
            const { data: existingFiles, error: fetchError } = await retryWithBackoff(async () => {
                return await supabase
                    .from('files')
                    .select('id')
                    .eq('user_id', saveData.user_id)
                    .eq('file_name', saveData.file_name)
                    .limit(1);
            });

            if (fetchError) {
                console.error('AutoSave: Fetch error:', fetchError);
                throw fetchError;
            }

            if (existingFiles && existingFiles.length > 0) {
                // Update (with retry)
                console.log('AutoSave: Updating existing file record:', existingFiles[0].id);
                const { error: updateError } = await retryWithBackoff(async () => {
                    return await supabase
                        .from('files')
                        .update({
                            sheet_data: saveData.sheet_data,
                            headers: saveData.headers,
                            notes: saveData.notes,
                            highlighted_cells: saveData.highlighted_cells,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingFiles[0].id);
                });

                if (updateError) {
                    console.error('AutoSave: Update error:', updateError);
                    throw updateError;
                }
            } else {
                // Insert (with retry)
                console.log('AutoSave: Creating new file record');
                const { error: insertError } = await retryWithBackoff(async () => {
                    return await supabase
                        .from('files')
                        .insert([{
                            user_id: saveData.user_id,
                            file_name: saveData.file_name,
                            file_data: saveData.file_data,
                            sheet_data: saveData.sheet_data,
                            headers: saveData.headers,
                            notes: saveData.notes,
                            highlighted_cells: saveData.highlighted_cells
                        }]);
                });

                if (insertError) {
                    console.error('AutoSave: Insert error:', insertError);
                    throw insertError;
                }
            }

            lastSavedRef.current = currentDataString;
            console.log('AutoSave: Success');
            onSavingError?.(null); // Explicitly clear error on success
        } catch (err: any) {
            console.error('AutoSave: Final catch error FULL DETAILS:', JSON.stringify(err, null, 2));
            console.error('AutoSave: Error message:', err.message);
            console.error('AutoSave: Error stack:', err.stack);

            // Check for network-related errors
            const isNetworkError =
                (err instanceof TypeError && err.message.includes('Load failed')) ||
                (err.name === 'AbortError') ||
                (err.message?.includes('network')) ||
                (err.message?.includes('fetch'));

            // More user-friendly error messages
            let errorMessage = 'Ошибка сохранения';
            if (isNetworkError) {
                errorMessage = 'Проблема с сетью. Проверьте подключение к интернету.';
            } else if (err.message) {
                errorMessage = `Ошибка: ${err.message}`;
            }
            onSavingError?.(errorMessage);

            // If it's a session error, we might want to log it specifically
            if (errorMessage.includes('session') || errorMessage.includes('JWT')) {
                console.warn('AutoSave: Auth session issue detected');
            }
        } finally {
            isSavingRef.current = false;
            onSavingChange?.(false);
        }
    }, [onSavingChange, onSavingError, retryWithBackoff]);

    useEffect(() => {
        if (!data || !data.user_id || !data.file_name) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            saveToSupabase(data);
        }, delay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [data, delay, saveToSupabase]);
};

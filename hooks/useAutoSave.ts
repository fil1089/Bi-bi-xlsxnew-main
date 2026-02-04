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

            // Check if file already exists for this user and name
            const { data: existingFiles, error: fetchError } = await supabase
                .from('files')
                .select('id')
                .eq('user_id', saveData.user_id)
                .eq('file_name', saveData.file_name)
                .limit(1);

            if (fetchError) {
                console.error('AutoSave: Fetch error:', fetchError);
                throw fetchError;
            }

            if (existingFiles && existingFiles.length > 0) {
                // Update
                console.log('AutoSave: Updating existing file record:', existingFiles[0].id);
                const { error: updateError } = await supabase
                    .from('files')
                    .update({
                        sheet_data: saveData.sheet_data,
                        headers: saveData.headers,
                        notes: saveData.notes,
                        highlighted_cells: saveData.highlighted_cells,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingFiles[0].id);

                if (updateError) {
                    console.error('AutoSave: Update error:', updateError);
                    throw updateError;
                }
            } else {
                // Insert
                console.log('AutoSave: Creating new file record');
                const { error: insertError } = await supabase
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

                if (insertError) {
                    console.error('AutoSave: Insert error:', insertError);
                    throw insertError;
                }
            }

            lastSavedRef.current = currentDataString;
            console.log('AutoSave: Success');
        } catch (err: any) {
            console.error('AutoSave: Final catch error:', err);
            onSavingError?.(err.message || 'Ошибка сети');
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
            saveToSupabase(data);
        }, delay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [data, delay, saveToSupabase]);
};

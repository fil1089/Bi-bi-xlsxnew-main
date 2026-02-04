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
    onSavingChange?: (saving: boolean) => void
) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedRef = useRef<string>('');

    const saveToSupabase = useCallback(async (saveData: AutoSaveData) => {
        if (!supabase) return;

        try {
            const currentDataString = JSON.stringify(saveData);
            if (currentDataString === lastSavedRef.current) return;

            onSavingChange?.(true);

            // Check if file already exists for this user and name
            const { data: existingFiles, error: fetchError } = await supabase
                .from('files')
                .select('id')
                .eq('user_id', saveData.user_id)
                .eq('file_name', saveData.file_name)
                .limit(1);

            if (fetchError) throw fetchError;

            if (existingFiles && existingFiles.length > 0) {
                // Update
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

                if (updateError) throw updateError;
            } else {
                // Insert
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

                if (insertError) throw insertError;
            }

            lastSavedRef.current = currentDataString;
            console.log('File auto-saved successfully');
        } catch (err) {
            console.error('Error auto-saving to Supabase:', err);
        } finally {
            onSavingChange?.(false);
        }
    }, [onSavingChange]);

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

import React, { useState, useCallback, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import FileUpload, { ProcessedFileMeta } from './components/FileUpload';
import DataTable from './components/DataTable';
import NoteEditor from './components/NoteEditor';
import FileEditor from './components/FileEditor';
import ModeSelectionModal from './components/ModeSelectionModal';
import NumericKeyboard from './components/NumericKeyboard';
import SearchBar from './components/HighlightMenu'; // Using HighlightMenu file for the new SearchBar component
import { ChevronDownIcon, PlusIcon, SaveIcon, HighlightIcon, DocumentTextIcon, UserIcon, CloudIcon } from './components/Icons';
import AuthModal from './components/AuthModal';
import { BiBiLogo } from './components/BiBiLogo';
import { api, isAuthEnabled } from './lib/api';
import { useAuth } from './hooks/useAuth';
import { useAutoSave } from './hooks/useAutoSave';
import { calculateAutoWidths, detectHighlightColor } from './lib/utils';
import { SheetData, HighlightedCells, CellNotes, FilterType } from './types';
import * as ExcelJSImport from 'exceljs';

// exceljs резолвится Vite через browser-поле в dist/exceljs.min.js (UMD).
// Берём конструктор устойчиво к разным формам интеропа.
const ExcelJS: any = (ExcelJSImport as any).default ?? ExcelJSImport;

type NoteEditorState = {
    visible: true;
    rowIndex: number;
    colIndex: number;
} | { visible: false };


const REVISION_GROUP_PREFIX = 'Ревизионная группа';

const App: React.FC = () => {
    // Auth state
    const { user, loading: authLoading, signIn, signUp, signOut } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);

    const [fileName, setFileName] = useState<string | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [sheetData, setSheetData] = useState<SheetData>([]);

    // New state for mode selection
    const [appMode, setAppMode] = useState<'home' | 'search' | 'editor'>('home');
    const [pendingFile, setPendingFile] = useState<{
        headers: string[];
        data: SheetData;
        fileName: string;
        buffer?: ArrayBuffer;
        notes?: CellNotes;
        highlightedCells?: HighlightedCells;
        columnWidths?: number[];
    } | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Исходные байты загруженного .xlsx — чтобы экспортировать поверх оригинала
    // и сохранить форматирование. null, если файл пришёл из облака (без байтов).
    const originalBufferRef = useRef<ArrayBuffer | null>(null);
    // Карты соответствия текущего индекса исходному (0-based) — обновляются при
    // удалении строк/столбцов, чтобы при экспорте знать, что вырезать из оригинала.
    const rowIndexMapRef = useRef<number[]>([]);
    const colIndexMapRef = useRef<number[]>([]);
    const origRowCountRef = useRef<number>(0);
    const origColCountRef = useRef<number>(0);

    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);
    const [filter, setFilter] = useState<FilterType>('all');
    const [highlightedCells, setHighlightedCells] = useState<HighlightedCells>({});
    const [highlightedHeaderIndices, setHighlightedHeaderIndices] = useState<Set<number>>(new Set());
    const [notes, setNotes] = useState<CellNotes>({});
    const [noteEditorState, setNoteEditorState] = useState<NoteEditorState>({ visible: false });
    const [columnWidths, setColumnWidths] = useState<number[]>([]);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [highlightMode, setHighlightMode] = useState(false);

    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const [scrollToRowIndex, setScrollToRowIndex] = useState<number | null>(null);
    const [selectedCell, setSelectedCell] = useState<{ row: number, col: number } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [userFiles, setUserFiles] = useState<any[]>([]);
    const initialFetchAttempted = useRef(false);

    // Auto-save integration
    const autoSaveData = useMemo(() => {
        if (!user || !fileName) return null;
        return {
            user_id: user.id,
            file_name: fileName,
            file_data: {}, // Meta data if needed
            sheet_data: sheetData,
            headers,
            notes,
            highlighted_cells: highlightedCells
        };
    }, [user, fileName, sheetData, headers, notes, highlightedCells]);

    useAutoSave(autoSaveData, 2000, setIsSaving, setSaveError);

    // Fetch user files on login
    useEffect(() => {
        const fetchUserFiles = async (retryCount = 0) => {
            if (!user || initialFetchAttempted.current) return;

            initialFetchAttempted.current = true;
            try {
                const data = await api.listFiles();

                setUserFiles(data);
                // Automatically load the first one if we don't have a filename yet
                if (data.length > 0 && !fileName) {
                    const lastFile = data[0];
                    setHeaders(lastFile.headers);
                    setSheetData(lastFile.sheet_data);
                    setFileName(lastFile.file_name);
                    setHighlightedCells(lastFile.highlighted_cells || {});
                    setNotes(lastFile.notes || {});
                    setColumnWidths(calculateAutoWidths(lastFile.headers, lastFile.sheet_data));
                    // Облачный файл — исходных байтов нет, экспорт пойдёт по фолбэку.
                    originalBufferRef.current = null;
                    rowIndexMapRef.current = [];
                    colIndexMapRef.current = [];
                    origRowCountRef.current = 0;
                    origColCountRef.current = 0;
                    // Открываем в режиме «поиск» — иначе панель поиска с клавиатурой
                    // не отрендерится (она завязана на appMode === 'search').
                    setAppMode('search');
                }
            } catch (err: any) {
                console.error('Error fetching user files:', err);

                // Check for network-related errors (Load failed, AbortError, network errors)
                const isNetworkError =
                    (err instanceof TypeError && err.message.includes('Load failed')) ||
                    (err.name === 'AbortError') ||
                    (err.message?.includes('network')) ||
                    (err.message?.includes('fetch'));

                // Retry on network errors - increased to 5 attempts for mobile
                if (isNetworkError && retryCount < 4) {
                    console.log(`Retrying file fetch (attempt ${retryCount + 2}/5)...`);
                    initialFetchAttempted.current = false;
                    const delay = 1500 * Math.pow(2, retryCount); // Longer delays for mobile
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return fetchUserFiles(retryCount + 1);
                }

                // User-friendly error message
                if (isNetworkError) {
                    setError('Не удалось загрузить ваши файлы. Проверьте подключение к интернету.');
                } else {
                    setError('Не удалось загрузить ваши файлы');
                }
            }
        };

        if (user && !initialFetchAttempted.current) {
            fetchUserFiles();
        }
    }, [user]);

    useEffect(() => {
        setSelectedCell(null);
    }, [filter]);

    const handleFileProcessed = useCallback(async (newHeaders: string[], newData: SheetData, newFileName: string, meta: ProcessedFileMeta) => {
        setPendingFile({
            headers: newHeaders,
            data: newData,
            fileName: newFileName,
            buffer: meta.buffer,
            notes: meta.notes,
            highlightedCells: meta.highlightedCells,
            columnWidths: meta.columnWidths
        });

        // Refresh file list
        if (user) {
            try {
                const data = await api.listFiles();
                setUserFiles(data);
            } catch (err) {
                console.error('Error refreshing file list:', err);
            }
        }
    }, [user]);

    const handleSelectFile = (file: any) => {
        setPendingFile({
            headers: file.headers,
            data: file.sheet_data,
            fileName: file.file_name,
            notes: file.notes || {},
            highlightedCells: file.highlighted_cells || {},
            columnWidths: calculateAutoWidths(file.headers, file.sheet_data)
        });
    };

    const handleModeSelect = (mode: 'search' | 'edit') => {
        if (!pendingFile) return;

        const newHeaders = pendingFile.headers || [];
        const newData = pendingFile.data || [];

        setHeaders(newHeaders);
        setSheetData(newData);
        setFileName(pendingFile.fileName);

        setNotes(pendingFile.notes || {});
        setHighlightedCells(pendingFile.highlightedCells || {});

        if (pendingFile.columnWidths && pendingFile.columnWidths.length > 0) {
            setColumnWidths(pendingFile.columnWidths);
        } else {
            setColumnWidths(calculateAutoWidths(newHeaders, newData));
        }

        // Сохраняем исходные байты и инициализируем карты индексов «как есть».
        originalBufferRef.current = pendingFile.buffer ?? null;
        origRowCountRef.current = newData.length;
        origColCountRef.current = newHeaders.length;
        rowIndexMapRef.current = newData.map((_, i) => i);
        colIndexMapRef.current = newHeaders.map((_, i) => i);

        setSearchQuery('');
        setHighlightedHeaderIndices(new Set());
        setError('');
        setFilter('all');
        setNoteEditorState({ visible: false });
        setKeyboardVisible(false);
        setHighlightMode(false);

        setAppMode(mode === 'search' ? 'search' : 'editor');
        setPendingFile(null);
    };

    const handleDeleteRows = useCallback((rowIndices: number[]) => {
        const sortedIndices = [...new Set(rowIndices)].sort((a, b) => b - a);
        const deletedSet = new Set(sortedIndices);

        setSheetData(prev => prev.filter((_, index) => !deletedSet.has(index)));

        // Синхронизируем карту строк: выкидываем те же визуальные индексы.
        rowIndexMapRef.current = rowIndexMapRef.current.filter((_, index) => !deletedSet.has(index));

        const remapKeys = (obj: any) => {
            const newObj: any = {};
            Object.keys(obj).forEach(key => {
                const [r, c] = key.split('-').map(Number);
                if (deletedSet.has(r)) return;
                const shift = sortedIndices.filter(idx => idx < r).length;
                newObj[`${r - shift}-${c}`] = obj[key];
            });
            return newObj;
        };

        setNotes(prev => remapKeys(prev));
        setHighlightedCells(prev => remapKeys(prev));
    }, []);

    const handleDeleteColumns = useCallback((colIndices: number[]) => {
        const sortedIndices = [...new Set(colIndices)].sort((a, b) => b - a);
        const deletedSet = new Set(sortedIndices);

        setHeaders(prev => prev.filter((_, index) => !deletedSet.has(index)));
        setSheetData(prev => prev.map(row => {
            if (!row) return row;
            return row.filter((_, index) => !deletedSet.has(index));
        }));
        setColumnWidths(prev => prev.filter((_, index) => !deletedSet.has(index)));

        // Синхронизируем карту столбцов.
        colIndexMapRef.current = colIndexMapRef.current.filter((_, index) => !deletedSet.has(index));

        const remapKeys = (obj: any) => {
            const newObj: any = {};
            Object.keys(obj).forEach(key => {
                const [r, c] = key.split('-').map(Number);
                if (deletedSet.has(c)) return;
                const shift = sortedIndices.filter(idx => idx < c).length;
                newObj[`${r}-${c - shift}`] = obj[key];
            });
            return newObj;
        };

        setNotes(prev => remapKeys(prev));
        setHighlightedCells(prev => remapKeys(prev));
    }, []);

    const filteredData = useMemo(() => {
        const sourceData = sheetData.map((row, index) => ({ row, originalIndex: index }));

        if (filter === 'all') {
            return sourceData;
        }

        return sourceData.filter(({ row, originalIndex }) => {
            let hasGreen = false;
            let hasRed = false;
            let hasAnyColor = false;

            for (let i = 0; i < row.length; i++) {
                const color = highlightedCells[`${originalIndex}-${i}`];
                if (color === 'green') {
                    hasGreen = true;
                    hasAnyColor = true;
                } else if (color === 'red') {
                    hasRed = true;
                    hasAnyColor = true;
                }
            }

            switch (filter) {
                case 'green': return hasGreen;
                case 'red': return hasRed;
                case 'none': return !hasAnyColor;
                default: return true;
            }
        });
    }, [sheetData, filter, highlightedCells]);

    const searchMatches = useMemo(() => {
        if (!debouncedSearchQuery.trim()) return [];
        const matches: number[] = [];
        const query = debouncedSearchQuery.toLowerCase();

        filteredData.forEach(({ originalIndex, row }) => {
            for (const cell of row) {
                if (String(cell ?? '').toLowerCase().includes(query)) {
                    matches.push(originalIndex);
                    break;
                }
            }
        });
        return matches;
    }, [filteredData, debouncedSearchQuery]);

    useEffect(() => {
        if (searchMatches.length > 0) {
            setCurrentMatchIndex(0);
            setScrollToRowIndex(searchMatches[0]);
        } else {
            setCurrentMatchIndex(0);
            setScrollToRowIndex(null);
        }
    }, [searchMatches]);

    const handleNavigateMatch = (direction: 'next' | 'prev') => {
        if (searchMatches.length === 0) return;

        let nextIndex = direction === 'next'
            ? currentMatchIndex + 1
            : currentMatchIndex - 1;

        if (nextIndex >= 0 && nextIndex < searchMatches.length) {
            setCurrentMatchIndex(nextIndex);
            setScrollToRowIndex(searchMatches[nextIndex]);
        }
    };

    const revisionGroupColIndex = useMemo(() =>
        headers.findIndex(h => h.trim().startsWith(REVISION_GROUP_PREFIX)),
        [headers]);

    const revisionGroupIndices = useMemo(() =>
        sheetData.map((row, i) =>
            String(row[0] ?? '').trim().startsWith(REVISION_GROUP_PREFIX) ? i : -1
        ).filter(i => i !== -1),
        [sheetData]);

    const handleHeaderClick = (colIndex: number) => {
        if (colIndex !== revisionGroupColIndex) return;

        setHighlightedHeaderIndices(prev => {
            const newSet = new Set(prev);
            if (newSet.has(colIndex)) {
                newSet.delete(colIndex);
            } else {
                newSet.add(colIndex);
            }
            return newSet;
        });
    };

    const handleColumnResize = useCallback((index: number, newWidth: number) => {
        setColumnWidths(prevWidths => {
            const newWidths = [...prevWidths];
            newWidths[index] = newWidth;
            return newWidths;
        });
    }, []);

    const handleCellClick = (rowIndex: number, colIndex: number) => {
        const cellKey = `${rowIndex}-${colIndex}`;

        setHighlightedCells(prev => {
            const newHighlights = { ...prev };
            const currentColor = newHighlights[cellKey];
            let nextColor: 'red' | 'green' | undefined;

            if (currentColor === 'green') {
                newHighlights[cellKey] = 'red';
                nextColor = 'red';
            } else if (currentColor === 'red') {
                delete newHighlights[cellKey];
                nextColor = undefined;
            } else {
                newHighlights[cellKey] = 'green';
                nextColor = 'green';
            }

            if (revisionGroupColIndex !== -1) {
                const revisionGroupCellKey = `${rowIndex}-${revisionGroupColIndex}`;

                if (nextColor === 'red') {
                    newHighlights[revisionGroupCellKey] = 'red';
                } else if (currentColor === 'red' && nextColor === undefined) {
                    let hasOtherRedCells = false;
                    for (let i = 0; i < headers.length; i++) {
                        if (newHighlights[`${rowIndex}-${i}`] === 'red') {
                            hasOtherRedCells = true;
                            break;
                        }
                    }
                    if (!hasOtherRedCells) {
                        delete newHighlights[revisionGroupCellKey];
                    }
                }
            }
            return newHighlights;
        });
    };

    const handleCellSelect = useCallback((rowIndex: number, colIndex: number) => {
        if (selectedCell && selectedCell.row === rowIndex && selectedCell.col === colIndex) {
            setSelectedCell(null);
        } else {
            setSelectedCell({ row: rowIndex, col: colIndex });
        }
        setKeyboardVisible(true);
    }, [selectedCell]);

    const handleRequestNoteEditor = () => {
        if (selectedCell) {
            setNoteEditorState({ visible: true, rowIndex: selectedCell.row, colIndex: selectedCell.col });
        }
    };

    const handleSaveNote = (note: string) => {
        if (!noteEditorState.visible) return;
        const { rowIndex, colIndex } = noteEditorState;
        const cellKey = `${rowIndex}-${colIndex}`;

        setNotes(prev => {
            const newNotes = { ...prev };
            if (note.trim()) {
                newNotes[cellKey] = note.trim();
            } else {
                delete newNotes[cellKey];
            }
            return newNotes;
        });
        setNoteEditorState({ visible: false });
    };

    const handleSaveFile = async () => {
        if (!fileName) return;

        try {
            const workbook = new ExcelJS.Workbook();

            const fillFor = (color: 'red' | 'green') => ({
                type: 'pattern' as const,
                pattern: 'solid' as const,
                fgColor: { argb: color === 'green' ? 'FF00B050' : 'FFFF0000' },
            });

            if (originalBufferRef.current) {
                // --- Экспорт ПОВЕРХ оригинала: сохраняем шрифты, границы,
                // числовые форматы, формулы и ширины исходного файла. ---
                await workbook.xlsx.load(originalBufferRef.current);
                const worksheet = workbook.worksheets[0];

                // 1. Вырезаем удалённые столбцы (от старших индексов к младшим).
                const survivingCols = new Set(colIndexMapRef.current);
                for (let oc = origColCountRef.current - 1; oc >= 0; oc--) {
                    if (!survivingCols.has(oc)) worksheet.spliceColumns(oc + 1, 1);
                }

                // 2. Вырезаем удалённые строки данных (Excel-строки начинаются с 2).
                const survivingRows = new Set(rowIndexMapRef.current);
                for (let or = origRowCountRef.current - 1; or >= 0; or--) {
                    if (!survivingRows.has(or)) worksheet.spliceRows(or + 2, 1);
                }

                // 3. Снимаем устаревшие подсветки/заметки с оставшихся ячеек,
                // чтобы синхронизировать с текущим состоянием (учесть снятия).
                worksheet.eachRow((row: any, rowNumber: number) => {
                    if (rowNumber === 1) return;
                    row.eachCell((cell: any) => {
                        if (detectHighlightColor(cell.fill)) {
                            cell.fill = { type: 'pattern', pattern: 'none' };
                        }
                        if (cell.note) cell.note = undefined;
                    });
                });

                // 4. Накладываем актуальные подсветки и заметки.
                // Текущий индекс (r,c) → Excel (r+2, c+1).
                Object.keys(highlightedCells).forEach(key => {
                    const [r, c] = key.split('-').map(Number);
                    worksheet.getCell(r + 2, c + 1).fill = fillFor(highlightedCells[key]);
                });
                Object.keys(notes).forEach(key => {
                    if (!notes[key]) return;
                    const [r, c] = key.split('-').map(Number);
                    worksheet.getCell(r + 2, c + 1).note = notes[key];
                });
            } else {
                // --- Фолбэк: исходных байтов нет (файл из облака) — собираем
                // основной лист с нуля, как раньше. ---
                const worksheet = workbook.addWorksheet("Основной лист");

                worksheet.addRow(headers.map(h => h ?? ''));

                sheetData.forEach((row, rowIndex) => {
                    const excelRow = worksheet.addRow(row.map(c => c ?? null));

                    row.forEach((cell, colIndex) => {
                        const cellKey = `${rowIndex}-${colIndex}`;
                        const excelCell = excelRow.getCell(colIndex + 1);

                        if (highlightedCells[cellKey]) {
                            excelCell.fill = fillFor(highlightedCells[cellKey]);
                        }
                        if (notes[cellKey]) {
                            excelCell.note = notes[cellKey];
                        }
                    });
                });

                if (headers.length > 0) {
                    for (let i = 1; i <= headers.length; i++) {
                        if (i === 1) {
                            worksheet.getColumn(1).width = 5;
                        } else {
                            worksheet.getColumn(i).width = Math.max(10, (columnWidths[i - 1] || 80) / 8);
                        }
                    }
                }
            }

            const redRowIndexes = new Set<number>();
            Object.keys(highlightedCells).forEach(key => {
                if (highlightedCells[key] === 'red') {
                    redRowIndexes.add(parseInt(key.split('-')[0], 10));
                }
            });

            if (redRowIndexes.size > 0) {
                const redWorksheet = workbook.addWorksheet("Выделено красным");
                redWorksheet.addRow(headers.map(h => h ?? ''));

                const sortedRedRowIndexes = Array.from(redRowIndexes).sort((a, b) => a - b);
                let lastAddedSubheaderIndex = -1;

                sortedRedRowIndexes.forEach(rowIndex => {
                    let subheaderIndex = -1;
                    for (let i = revisionGroupIndices.length - 1; i >= 0; i--) {
                        if (revisionGroupIndices[i] <= rowIndex) {
                            subheaderIndex = revisionGroupIndices[i];
                            break;
                        }
                    }

                    if (subheaderIndex !== -1 && subheaderIndex !== lastAddedSubheaderIndex) {
                        redWorksheet.addRow(sheetData[subheaderIndex].map(c => c ?? null));
                        lastAddedSubheaderIndex = subheaderIndex;
                    }

                    redWorksheet.addRow(sheetData[rowIndex].map(c => c ?? null));
                });

                if (headers.length > 0) {
                    for (let i = 1; i <= headers.length; i++) {
                        if (i === 1) {
                            redWorksheet.getColumn(1).width = 5;
                        } else {
                            redWorksheet.getColumn(i).width = Math.max(10, (columnWidths[i - 1] || 80) / 8);
                        }
                    }
                }
            }

            const noteRowIndexes = new Set<number>();
            Object.keys(notes).forEach(key => {
                if (notes[key]) {
                    noteRowIndexes.add(parseInt(key.split('-')[0], 10));
                }
            });

            if (noteRowIndexes.size > 0) {
                const noteWorksheet = workbook.addWorksheet("С комментариями");
                noteWorksheet.addRow(headers.map(h => h ?? ''));

                const sortedNoteRowIndexes = Array.from(noteRowIndexes).sort((a, b) => a - b);
                let lastAddedSubheaderIndex = -1;

                sortedNoteRowIndexes.forEach(rowIndex => {
                    let subheaderIndex = -1;
                    for (let i = revisionGroupIndices.length - 1; i >= 0; i--) {
                        if (revisionGroupIndices[i] <= rowIndex) {
                            subheaderIndex = revisionGroupIndices[i];
                            break;
                        }
                    }

                    if (subheaderIndex !== -1 && subheaderIndex !== lastAddedSubheaderIndex) {
                        noteWorksheet.addRow(sheetData[subheaderIndex].map(c => c ?? null));
                        lastAddedSubheaderIndex = subheaderIndex;
                    }

                    const newRow = noteWorksheet.addRow(sheetData[rowIndex].map(c => c ?? null));

                    // Add notes to the new row
                    newRow.eachCell((cell: any, colNumber: number) => {
                        const colIndex = colNumber - 1;
                        const noteKey = `${rowIndex}-${colIndex}`;
                        const note = notes[noteKey];
                        if (note) {
                            cell.note = note;
                        }
                    });
                });

                if (headers.length > 0) {
                    for (let i = 1; i <= headers.length; i++) {
                        if (i === 1) {
                            noteWorksheet.getColumn(1).width = 5;
                        } else {
                            noteWorksheet.getColumn(i).width = Math.max(10, (columnWidths[i - 1] || 80) / 8);
                        }
                    }
                }
            }

            if (revisionGroupIndices.length > 0) {
                const summaryWorksheet = workbook.addWorksheet("Сводка по группам");
                summaryWorksheet.addRow(["Название ревизионной группы", "Количество наименований", "Количество красных"]);

                revisionGroupIndices.forEach((groupStartIndex, i) => {
                    const groupEndIndex = (i + 1 < revisionGroupIndices.length)
                        ? revisionGroupIndices[i + 1] - 1
                        : sheetData.length - 1;

                    const groupName = sheetData[groupStartIndex][0] ?? 'Без названия';

                    // Новая, более точная логика:
                    // Ищем последнее значение в первом столбце (№ п/п) этой группы.
                    // Двигаемся снизу вверх от конца группы.
                    let totalItems = 'N/A';
                    for (let r = groupEndIndex; r > groupStartIndex; r--) {
                        const currentRow = sheetData[r];
                        if (!currentRow || currentRow.length === 0) continue; // Пропускаем пустые или некорректные строки

                        const firstCellValue = currentRow[0];
                        const trimmedValue = String(firstCellValue ?? '').trim();

                        // Условие: значение не пустое и является числом.
                        // Это гарантирует, что мы берем номер строки, а не текст.
                        if (trimmedValue !== '' && !isNaN(Number(trimmedValue))) {
                            totalItems = trimmedValue;
                            break; // Нашли последнее значение, выходим из цикла
                        }
                    }

                    let redRowsCount = 0;
                    for (let rowIndex = groupStartIndex + 1; rowIndex <= groupEndIndex; rowIndex++) {
                        let isRedRow = false;
                        for (let colIndex = 0; colIndex < headers.length; colIndex++) {
                            if (highlightedCells[`${rowIndex}-${colIndex}`] === 'red') {
                                isRedRow = true;
                                break;
                            }
                        }
                        if (isRedRow) {
                            redRowsCount++;
                        }
                    }

                    summaryWorksheet.addRow([groupName, totalItems, redRowsCount]);
                });

                summaryWorksheet.getColumn(1).width = 50;
                summaryWorksheet.getColumn(2).width = 30;
                summaryWorksheet.getColumn(3).width = 30;
            }

            const newFileName = `edited_${fileName}`;
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = newFileName;
            document.body.appendChild(link);
            link.click();

            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);

        } catch (err) {
            console.error("Ошибка сохранения:", err);
            setError("Не удалось сохранить файл. Попробуйте еще раз.");
        }
    };

    const handleNumericKeyPress = (key: string) => {
        setSearchQuery(prev => prev + key);
    };

    const handleNumericBackspace = () => {
        setSearchQuery(prev => prev.slice(0, -1));
    };

    const handleClearSearch = () => {
        setSearchQuery('');
    };

    const resetApp = () => {
        setFileName(null);
        setHeaders([]);
        setSheetData([]);
        setLoading(false);
        setError('');
        setSearchQuery('');
        setFilter('all');
        setHighlightedCells({});
        setNotes({});
        setColumnWidths([]);
        setNoteEditorState({ visible: false });
        setKeyboardVisible(false);
        setHighlightedHeaderIndices(new Set());
        setHighlightMode(false);
        originalBufferRef.current = null;
        rowIndexMapRef.current = [];
        colIndexMapRef.current = [];
        origRowCountRef.current = 0;
        origColCountRef.current = 0;
        setSelectedCell(null);
    };

    const handleDeleteFile = async () => {
        if (!user || !fileName) return;

        const confirmed = window.confirm(`Вы уверены, что хотите удалить файл "${fileName}" из облака? Это действие нельзя отменить.`);
        if (!confirmed) return;

        try {
            setLoading(true);
            await api.deleteFile(fileName);

            console.log('File deleted successfully');
            resetApp();

            // Refresh list
            if (user) {
                const data = await api.listFiles();
                setUserFiles(data);
            }
        } catch (err: any) {
            console.error('Error deleting file:', err);
            setError('Не удалось удалить файл');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFileInternal = async (name: string) => {
        if (!user) return;
        try {
            setLoading(true);
            await api.deleteFile(name);

            // Refresh list
            const data = await api.listFiles();
            setUserFiles(data);

            if (fileName === name) {
                resetApp();
            }
        } catch (err: any) {
            console.error('Error deleting file:', err);
            setError('Не удалось удалить файл');
        } finally {
            setLoading(false);
        }
    };

    const renderContent = () => {
        if (loading) {
            return <div className="d-flex align-items-center justify-content-center h-100"><p className="fs-5 text-gray-300">Обработка файла...</p></div>;
        }

        if (error) {
            return (
                <div className="d-flex flex-column align-items-center justify-content-center h-100 p-4 text-center">
                    <p className="fs-5 text-danger mb-4">{error}</p>
                    <button onClick={resetApp} className="btn btn-warning fw-semibold">Попробовать снова</button>
                </div>
            );
        }

        if (appMode === 'editor' && fileName && sheetData.length > 0) {
            return (
                <FileEditor
                    headers={headers}
                    data={sheetData}
                    columnWidths={columnWidths}
                    onDeleteRows={handleDeleteRows}
                    onDeleteColumns={handleDeleteColumns}
                    onBack={resetApp}
                    onSwitchToSearch={() => setAppMode('search')}
                    onDownload={handleSaveFile}
                    fileName={fileName}
                />
            );
        }

        if (fileName && sheetData.length > 0) {
            return (
                <div className="d-flex flex-column h-100 w-100">
                    <DataTable
                        headers={headers}
                        data={filteredData}
                        searchMatches={searchMatches}
                        highlightedCells={highlightedCells}
                        notes={notes}
                        onCellClick={handleCellClick}
                        onCellSelect={handleCellSelect}
                        selectedCell={selectedCell}
                        columnWidths={columnWidths}
                        onColumnResize={handleColumnResize}
                        highlightedHeaderIndices={highlightedHeaderIndices}
                        onHeaderClick={handleHeaderClick}
                        highlightMode={highlightMode}
                        scrollToRowIndex={scrollToRowIndex}
                        isKeyboardVisible={isKeyboardVisible}
                    />
                </div>
            );
        }

        if (!fileName) {
            return (
                <FileUpload
                    onFileProcessed={handleFileProcessed}
                    setLoading={setLoading}
                    setError={setError}
                    onShowAuth={() => setShowAuthModal(true)}
                    onLogout={() => signOut()}
                    isAuthenticated={!!user}
                    userEmail={user?.email || null}
                    userFiles={userFiles}
                    onSelectFile={handleSelectFile}
                    onDeleteFile={handleDeleteFileInternal}
                />
            );
        }
    };

    return (
        <div className="d-flex flex-column position-relative" style={{ height: '100vh', overflow: 'hidden' }}>
            {pendingFile && (
                <ModeSelectionModal
                    fileName={pendingFile.fileName}
                    onSelectMode={handleModeSelect}
                    onCancel={() => setPendingFile(null)}
                />
            )}
            {loading && (
                <div className="position-fixed inset-0 d-flex align-items-center justify-content-center bg-dark bg-opacity-75 z-1050">
                    <div className="spinner-border text-warning" role="status">
                        <span className="visually-hidden">Загрузка...</span>
                    </div>
                </div>
            )}

            {error && (
                <div className="alert alert-danger position-fixed start-50 translate-middle-x mt-3 z-1050" role="alert" style={{ top: '1rem', maxWidth: '90%' }}>
                    {error}
                </div>
            )}

            {renderContent()}
            {appMode === 'search' && noteEditorState.visible && (
                <NoteEditor
                    note={notes[`${noteEditorState.rowIndex}-${noteEditorState.colIndex}`] || ''}
                    onSave={handleSaveNote}
                    onClose={() => setNoteEditorState({ visible: false })}
                />
            )}
            {isAuthEnabled && (
                <AuthModal
                    visible={showAuthModal}
                    onClose={() => setShowAuthModal(false)}
                    onSignIn={signIn}
                    onSignUp={signUp}
                />
            )}
            {fileName && (isSaving || saveError) && (
                <div className="position-fixed top-0 end-0 p-2 z-1050 pointer-events-none">
                    <div
                        onClick={() => saveError && setSaveError(null)}
                        className={`d-flex align-items-center gap-1 small bg-black bg-opacity-75 px-2 py-1 rounded shadow-sm border border-secondary pointer-events-auto ${saveError ? 'text-danger cursor-pointer' : 'text-warning animate-pulse'}`}
                    >
                        <CloudIcon style={{ width: '1rem', height: '1rem' }} />
                        <span>{saveError ? `Ошибка сохранения: ${saveError} (нажмите, чтобы скрыть)` : 'Сохранение...'}</span>
                    </div>
                </div>
            )}
            {appMode === 'search' && fileName && (
                <SearchBar
                    searchQuery={searchQuery}
                    onClear={handleClearSearch}
                    onFocus={() => setKeyboardVisible(true)}
                    isKeyboardVisible={isKeyboardVisible}
                    searchMatchCount={searchMatches.length}
                    currentMatchIndex={currentMatchIndex}
                    onNavigateMatch={handleNavigateMatch}
                    filter={filter}
                    setFilter={setFilter}
                    onReset={resetApp}
                >
                    {isKeyboardVisible && (
                        <NumericKeyboard
                            onKeyPress={handleNumericKeyPress}
                            onBackspace={handleNumericBackspace}
                            onDone={() => setKeyboardVisible(false)}
                            onClear={handleClearSearch}
                            highlightMode={highlightMode}
                            onHighlightToggle={() => {
                                setHighlightMode(prev => !prev);
                                setSelectedCell(null);
                            }}
                            onAddNote={handleRequestNoteEditor}
                            isCellSelected={!!selectedCell}
                            onReset={resetApp}
                            onSave={handleSaveFile}
                        />
                    )}
                </SearchBar>
            )}
        </div>
    );
};

export default App;

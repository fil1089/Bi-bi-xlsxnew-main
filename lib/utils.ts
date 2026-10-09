import { SheetData, HighlightedCells, CellNotes } from "../types";

// Маркер сборки: виден в титуле карандаша и дебаг-плашке (?debug=1),
// чтобы за секунду понимать, какой код выполняется в браузере.
export const BUILD_ID = '2026-10-09-count-v8';

/**
 * Определяет положение строки заголовков и число ведущих пустых столбцов.
 * Нужно для файлов 1С, где заголовки не на первой строке (выше — название
 * бланка, магазин), а данные начинаются со столбца B.
 *
 * Эвристика: среди первых строк ищем максимум непустых ячеек, затем берём
 * первую строку, где непустых >= 70% от максимума и есть >= 2 текстовых
 * значения (заголовки — это текст). Для обычных файлов вернёт строку 1.
 *
 * Возвращает { headerRowNumber, colOffset } — оба для ExcelJS (1-based строки).
 */
export const detectHeaderPosition = (worksheet: any): { headerRowNumber: number; colOffset: number } => {
    if (!worksheet || !worksheet.rowCount) return { headerRowNumber: 1, colOffset: 0 };

    const maxScan = Math.min(worksheet.rowCount, 30);
    const maxCol = Math.max(1, worksheet.columnCount || 1);

    const counts: { row: number; nonEmpty: number; textCount: number }[] = [];
    let maxNonEmpty = 0;

    for (let r = 1; r <= maxScan; r++) {
        const row = worksheet.getRow(r);
        let nonEmpty = 0;
        let textCount = 0;
        for (let c = 1; c <= maxCol; c++) {
            const v = normalizeCellValue(row.getCell(c).value);
            if (v !== null && String(v).trim() !== '') {
                nonEmpty++;
                if (typeof v === 'string' && isNaN(Number(v))) textCount++;
            }
        }
        counts.push({ row: r, nonEmpty, textCount });
        if (nonEmpty > maxNonEmpty) maxNonEmpty = nonEmpty;
    }

    let headerRowNumber = 1;
    for (const { row, nonEmpty, textCount } of counts) {
        if (nonEmpty >= Math.max(2, maxNonEmpty * 0.7) && textCount >= 2) {
            headerRowNumber = row;
            break;
        }
    }

    // Число ведущих пустых столбцов в строке заголовков.
    const headerRow = worksheet.getRow(headerRowNumber);
    let colOffset = 0;
    for (let c = 1; c <= maxCol; c++) {
        const v = normalizeCellValue(headerRow.getCell(c).value);
        if (v !== null && String(v).trim() !== '') break;
        colOffset++;
    }
    if (colOffset >= maxCol) colOffset = 0; // защита от полностью пустой строки

    return { headerRowNumber, colOffset };
};

/**
 * Normalizes ExcelJS cell values to primitives (string, number, boolean, or null).
 * Handles formulas, rich text, and shared strings.
 */
export const normalizeCellValue = (value: any): string | number | boolean | null => {
    if (value === null || value === undefined) return null;

    if (typeof value === 'object') {
        // Handle Formula values
        if (value.result !== undefined) {
            return normalizeCellValue(value.result);
        }
        // Handle Rich Text
        if (value.richText && Array.isArray(value.richText)) {
            return value.richText.map((rt: any) => rt.text || '').join('');
        }
        // Handle object with 'text' property
        if (value.text !== undefined) {
            return String(value.text);
        }
        // Fallback for other objects
        return String(value);
    }

    return value;
};

export const calculateAutoWidths = (headers: string[], data: any[][]): number[] => {
    const MIN_WIDTH = 60;
    const MAX_WIDTH = 500;
    const PADDING = 24;

    const widths = headers.map(h => (h ? String(h).length : 0));

    data.forEach(row => {
        const firstCell = String(row[0] ?? '').trim();
        const isSubheader = firstCell.startsWith('Ревизионная группа');

        row.forEach((cell, i) => {
            if (i >= widths.length) return;

            // Skip subheader text for the first column width calculation
            // as it is rendered with colSpan and would blow up the column width.
            if (i === 0 && isSubheader) return;

            const normalized = normalizeCellValue(cell);
            const cellLength = normalized !== null ? String(normalized).length : 0;
            if (widths[i] < cellLength) {
                widths[i] = cellLength;
            }
        });
    });

    return widths.map(charCount =>
        Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, charCount * 8 + PADDING))
    );
};

export const readInitialWidths = (worksheet: any, headers: string[], data: SheetData, colOffset: number = 0): number[] => {
    if (!worksheet || !worksheet.columns) {
        return calculateAutoWidths(headers, data);
    }

    const widths: number[] = [];
    worksheet.columns.forEach((column: any, idx: number) => {
        if (idx < colOffset) return; // пропустить ведущие пустые столбцы
        if (column && column.width) {
            widths.push(column.width * 8); // Конвертировать из символов в пиксели
        } else {
            widths.push(100);
        }
    });

    return widths.length > 0 ? widths : calculateAutoWidths(headers, data);
};

// headerRowNumber — 1-based Excel-строка заголовков, colOffset — число ведущих
// пустых столбцов. Индекс данных (0-based) = rowNumber - headerRowNumber - 1,
// колонка = colNumber - 1 - colOffset. Для обычных файлов (1, 0) формула даёт
// привычные rowNumber-2 / colNumber-1.
export const readInitialNotes = (worksheet: any, headerRowNumber: number = 1, colOffset: number = 0): CellNotes => {
    const cellNotes: CellNotes = {};
    if (!worksheet) return cellNotes;

    worksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber <= headerRowNumber) return; // заголовки и всё выше них

        row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
            const colIdx = colNumber - 1 - colOffset;
            if (colIdx < 0) return;
            if (cell.note) {
                const key = `${rowNumber - headerRowNumber - 1}-${colIdx}`;
                if (typeof cell.note === 'object' && cell.note.texts) {
                    cellNotes[key] = cell.note.texts.map((t: any) => t.text).join('');
                } else {
                    cellNotes[key] = String(cell.note);
                }
            }
        });
    });

    return cellNotes;
};

export const readInitialHighlights = (worksheet: any, headerRowNumber: number = 1, colOffset: number = 0): HighlightedCells => {
    const highlights: HighlightedCells = {};
    if (!worksheet) return highlights;

    worksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber <= headerRowNumber) return; // заголовки и всё выше них

        row.eachCell((cell: any, colNumber: number) => {
            const colIdx = colNumber - 1 - colOffset;
            if (colIdx < 0) return;
            const color = detectHighlightColor(cell.fill);
            if (color) {
                const key = `${rowNumber - headerRowNumber - 1}-${colIdx}`;
                highlights[key] = color;
            }
        });
    });

    return highlights;
};

/**
 * Режим пересчёта: поиск графы количества («По факту» и похожие).
 * Порядок колонок НЕ меняем — работаем с графой там, где она есть.
 * Все функции чистые (без мутаций входа).
 */
export const COUNT_COLUMN_HINTS = ['факт', 'кол-во', 'количество'];
export const NOMENCLATURE_COLUMN_HINT = 'номенклатура';
export const UCHET_COLUMN_HINT = 'учет';
export const DEVIATION_COLUMN_HINT = 'отклон';

/** Нормализация заголовка для сравнения: trim, нижний регистр, ё→е, схлопывание пробелов (включая nbsp). */
export const normalizeHeader = (h: unknown): string =>
    String(h ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[\s\u00a0]+/g, ' ').trim();

/** Индекс первой колонки, чьё название содержит hint (регистр/пробелы не важны), −1 если нет. */
export const findColumnIndex = (headers: string[], hint: string): number => {
    const normHint = normalizeHeader(hint);
    return headers.findIndex(h => normalizeHeader(h).includes(normHint));
};

export interface CountColumns {
    /** Визуальный индекс графы пересчёта, −1 если колонки нет. */
    countColIndex: number;
    /** Визуальный индекс номенклатуры, −1 если колонки нет. */
    nomenColIndex: number;
    /** Визуальный индекс «По учёту», −1 если колонки нет. */
    uchetColIndex: number;
    /** Визуальный индекс «Отклонение», −1 если колонки нет. */
    devColIndex: number;
}

/** Первая подходящая подсказка из COUNT_COLUMN_HINTS, иначе −1. */
export const detectCountColumns = (headers: string[]): CountColumns => {
    let countColIndex = -1;
    for (const hint of COUNT_COLUMN_HINTS) {
        countColIndex = findColumnIndex(headers, hint);
        if (countColIndex !== -1) break;
    }
    return {
        countColIndex,
        nomenColIndex: findColumnIndex(headers, NOMENCLATURE_COLUMN_HINT),
        uchetColIndex: findColumnIndex(headers, UCHET_COLUMN_HINT),
        devColIndex: findColumnIndex(headers, DEVIATION_COLUMN_HINT),
    };
};

/**
 * Число из значения ячейки для пересчёта (понимает decimal-запятую).
 * null — не число (пусто или текст).
 */
export const parseCountNumber = (value: string | number | boolean | null): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return isNaN(value) ? null : value;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().replace(',', '.');
    if (trimmed === '') return null;
    const num = Number(trimmed);
    return isNaN(num) ? null : num;
};

/**
 * Значение ячейки для записи в ExcelJS: числовые строки -> Number,
 * пустые -> null (очистить ячейку), остальное как есть.
 */
export const toExcelCellValue = (value: string | number | boolean | null): string | number | boolean | null => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed === '') return null;
    return isNaN(Number(trimmed)) ? value : Number(trimmed);
};
export const detectHighlightColor = (fill: any): 'red' | 'green' | null => {
    if (!fill || fill.type !== 'pattern' || fill.pattern !== 'solid') return null;

    const fgColor = fill.fgColor;
    if (!fgColor || !fgColor.argb) return null;

    const argb = fgColor.argb;
    const rgb = argb.length > 6 ? argb.substring(2) : argb;
    if (!rgb || rgb.length < 6) return null;

    const r = parseInt(rgb.substring(0, 2), 16);
    const g = parseInt(rgb.substring(2, 4), 16);
    const b = parseInt(rgb.substring(4, 6), 16);

    const isRed = r > 100 && r > g * 1.5 && r > b * 1.5;
    const isGreen = g > 100 && g > r * 1.5 && g > b * 1.5;

    if (isRed) return 'red';
    if (isGreen) return 'green';
    return null;
};

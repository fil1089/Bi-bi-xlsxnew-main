import { SheetData, HighlightedCells, CellNotes } from "../types";

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

export const readInitialWidths = (worksheet: any, headers: string[], data: SheetData): number[] => {
    if (!worksheet || !worksheet.columns) {
        return calculateAutoWidths(headers, data);
    }

    const widths: number[] = [];
    worksheet.columns.forEach((column: any) => {
        if (column && column.width) {
            widths.push(column.width * 8); // Конвертировать из символов в пиксели
        } else {
            widths.push(100);
        }
    });

    return widths.length > 0 ? widths : calculateAutoWidths(headers, data);
};

export const readInitialNotes = (worksheet: any): CellNotes => {
    const cellNotes: CellNotes = {};
    if (!worksheet) return cellNotes;

    worksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return; // Пропустить заголовки

        row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
            if (cell.note) {
                const key = `${rowNumber - 2}-${colNumber - 1}`;
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

export const readInitialHighlights = (worksheet: any): HighlightedCells => {
    const highlights: HighlightedCells = {};
    if (!worksheet) return highlights;

    worksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return; // Пропустить заголовки

        row.eachCell((cell: any, colNumber: number) => {
            const fill = cell.fill;

            if (fill && fill.type === 'pattern' && fill.pattern === 'solid') {
                const fgColor = fill.fgColor;

                if (fgColor && fgColor.argb) {
                    const argb = fgColor.argb;
                    const rgb = argb.length > 6 ? argb.substring(2) : argb;

                    // Prevent error on invalid hex values
                    if (rgb && rgb.length >= 6) {
                        const r = parseInt(rgb.substring(0, 2), 16);
                        const g = parseInt(rgb.substring(2, 4), 16);
                        const b = parseInt(rgb.substring(4, 6), 16);

                        const isRed = r > 100 && r > g * 1.5 && r > b * 1.5;
                        const isGreen = g > 100 && g > r * 1.5 && g > b * 1.5;

                        if (isRed || isGreen) {
                            const key = `${rowNumber - 2}-${colNumber - 1}`;
                            highlights[key] = isRed ? 'red' : 'green';
                        }
                    }
                }
            }
        });
    });

    return highlights;
};

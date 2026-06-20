// Web Worker: парсинг .xlsx вне главного потока, чтобы UI не фризился
// на больших файлах. Используется тот же ExcelJS, что и на главном потоке
// (браузерный бандл из npm), и те же хелперы чтения метаданных.
import ExcelJSNS from 'exceljs/dist/exceljs.min.js';
import {
    normalizeCellValue,
    readInitialNotes,
    readInitialHighlights,
    readInitialWidths,
    detectHeaderPosition,
} from './utils';
import { repairXlsx } from './xlsxRepair';
import { SheetData } from '../types';

// exceljs/dist — UMD-бандл; в зависимости от интеропа Vite default может
// лежать в .default. Берём надёжно.
const ExcelJS: any = (ExcelJSNS as any)?.default ?? ExcelJSNS;

self.onmessage = async (e: MessageEvent) => {
    try {
        const { buffer } = e.data as { buffer: ArrayBuffer };

        // Буфер, который вернём главному потоку для экспорта поверх оригинала.
        // При ремонте он заменяется на починенный — иначе экспорт упадёт так же.
        let effectiveBuffer = buffer;

        const workbook = new ExcelJS.Workbook();
        try {
            await workbook.xlsx.load(effectiveBuffer);
        } catch (loadErr) {
            // Типовой битый файл из 1С — пробуем починить и загрузить ещё раз.
            try {
                effectiveBuffer = repairXlsx(buffer);
                await workbook.xlsx.load(effectiveBuffer);
            } catch {
                throw loadErr; // ремонт не помог — отдаём исходную ошибку
            }
        }

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            (self as any).postMessage({ error: 'no-sheets' });
            return;
        }

        // У файлов 1С заголовки не на первой строке (выше — название бланка,
        // магазин), данные могут начинаться со столбца B. Определяем положение.
        const { headerRowNumber, colOffset } = detectHeaderPosition(worksheet);
        const maxCol = Math.max(1, worksheet.columnCount || 1);

        // Заголовки — со строки headerRowNumber, начиная со столбца colOffset+1.
        const headers: string[] = [];
        const headerRow = worksheet.getRow(headerRowNumber);
        for (let j = colOffset + 1; j <= maxCol; j++) {
            headers.push(String(headerRow.getCell(j).value ?? ''));
        }
        // Обрезаем хвост полностью пустых заголовков справа.
        while (headers.length > 0 && headers[headers.length - 1].trim() === '') {
            headers.pop();
        }

        // Данные — со строки сразу после заголовков.
        const data: SheetData = [];
        for (let i = headerRowNumber + 1; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            const rowData: (string | number | boolean | null)[] = [];
            for (let j = 0; j < headers.length; j++) {
                rowData.push(normalizeCellValue(row.getCell(colOffset + 1 + j).value));
            }
            data.push(rowData);
        }

        const notes = readInitialNotes(worksheet, headerRowNumber, colOffset);
        const highlightedCells = readInitialHighlights(worksheet, headerRowNumber, colOffset);
        const columnWidths = readInitialWidths(worksheet, headers, data, colOffset);

        // Возвращаем (возможно, починенный) буфер обратно (transferable), чтобы
        // главный поток сохранил байты для экспорта поверх оригинала — без
        // удвоения памяти на копию. headerRowNumber/colOffset нужны для экспорта.
        (self as any).postMessage(
            {
                headers,
                data,
                notes,
                highlightedCells,
                columnWidths,
                headerRowNumber,
                colOffset,
                buffer: effectiveBuffer,
            },
            [effectiveBuffer],
        );
    } catch (err) {
        (self as any).postMessage({ error: String(err) });
    }
};

// Web Worker: парсинг .xlsx вне главного потока, чтобы UI не фризился
// на больших файлах. Используется тот же ExcelJS, что и на главном потоке
// (браузерный бандл из npm), и те же хелперы чтения метаданных.
import ExcelJSNS from 'exceljs/dist/exceljs.min.js';
import {
    normalizeCellValue,
    readInitialNotes,
    readInitialHighlights,
    readInitialWidths,
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

        // Заголовки — первая строка.
        const headers: string[] = [];
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell({ includeEmpty: true }, (cell: any) => {
            headers.push(String(cell.value ?? ''));
        });

        // Данные — со второй строки.
        const data: SheetData = [];
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            const rowData: (string | number | boolean | null)[] = [];
            for (let j = 1; j <= headers.length; j++) {
                rowData.push(normalizeCellValue(row.getCell(j).value));
            }
            data.push(rowData);
        }

        const notes = readInitialNotes(worksheet);
        const highlightedCells = readInitialHighlights(worksheet);
        const columnWidths = readInitialWidths(worksheet, headers, data);

        // Возвращаем (возможно, починенный) буфер обратно (transferable), чтобы
        // главный поток сохранил байты для экспорта поверх оригинала — без
        // удвоения памяти на копию.
        (self as any).postMessage(
            { headers, data, notes, highlightedCells, columnWidths, buffer: effectiveBuffer },
            [effectiveBuffer],
        );
    } catch (err) {
        (self as any).postMessage({ error: String(err) });
    }
};

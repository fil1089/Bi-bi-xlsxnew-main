// Ремонт «битых» .xlsx (типичные дефекты выгрузок из 1С), на которых
// строгий парсер ExcelJS падает или теряет текст. Запускается ТОЛЬКО когда
// обычная загрузка не удалась — нормальные файлы не трогаем.
//
// Лечит два дефекта, замеченных у файлов 1С:
//   1. Несовпадение регистра имён частей архива: реальный файл называется
//      `xl/SharedStrings.xml`, а ссылки ведут на `xl/sharedStrings.xml`.
//      Имена в zip регистрозависимы, ExcelJS не находит часть → пустой текст.
//   2. Пустой `xl/drawings/drawing1.xml` (`<wsDr/>` без содержимого), на
//      котором парсер рисунков ExcelJS бросает `reading 'anchors'`.
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';

type Entries = Record<string, Uint8Array>;

/** Собрать «ожидаемые» пути частей из всех *.rels (Target) и [Content_Types].xml (PartName). */
function collectExpectedPaths(files: Entries): Set<string> {
    const expected = new Set<string>();

    const resolveRelative = (relsPath: string, target: string) => {
        if (/^https?:/i.test(target) || target.startsWith('/')) return; // внешние/абсолютные
        // .rels лежит в <dir>/_rels/<file>.rels — база на уровень выше папки _rels.
        const baseDir = relsPath.split('/').slice(0, -2).join('/');
        const combined = (baseDir ? baseDir + '/' : '') + target;
        const stack: string[] = [];
        for (const seg of combined.split('/')) {
            if (seg === '..') stack.pop();
            else if (seg !== '.' && seg !== '') stack.push(seg);
        }
        expected.add(stack.join('/'));
    };

    for (const [name, data] of Object.entries(files)) {
        if (/\.rels$/i.test(name)) {
            const xml = strFromU8(data);
            for (const m of xml.matchAll(/Target="([^"]+)"/g)) resolveRelative(name, m[1]);
        }
        if (/\[Content_Types\]\.xml$/i.test(name)) {
            const xml = strFromU8(data);
            for (const m of xml.matchAll(/PartName="\/([^"]+)"/g)) expected.add(m[1]);
        }
    }
    return expected;
}

/** Переименовать части, чьё имя совпадает с ожидаемым лишь без учёта регистра. */
function fixPartNameCase(files: Entries): Entries {
    const expected = collectExpectedPaths(files);
    const lowerToActual = new Map<string, string>();
    for (const name of Object.keys(files)) lowerToActual.set(name.toLowerCase(), name);

    const out: Entries = { ...files };
    for (const exp of expected) {
        if (out[exp]) continue; // точное совпадение уже есть
        const actual = lowerToActual.get(exp.toLowerCase());
        if (actual && actual !== exp) {
            out[exp] = out[actual];
            delete out[actual];
        }
    }
    return out;
}

/** Убрать части рисунков и ссылки на них (пустые drawing/vmlDrawing ломают ExcelJS). */
function stripDrawings(files: Entries): Entries {
    const out: Entries = {};
    for (const [name, data] of Object.entries(files)) {
        if (/drawings?\//i.test(name)) continue; // сами drawing-части и их _rels
        out[name] = data;
    }
    for (const name of Object.keys(out)) {
        if (/worksheets\/_rels\/.*\.rels$/i.test(name)) {
            out[name] = strToU8(
                strFromU8(out[name]).replace(
                    /<Relationship[^>]*Type="[^"]*(?:\/drawing|\/vmlDrawing)"[^>]*\/>/g,
                    '',
                ),
            );
        }
        if (/worksheets\/sheet\d+\.xml$/i.test(name)) {
            out[name] = strToU8(
                strFromU8(out[name])
                    .replace(/<drawing[^>]*\/>/g, '')
                    .replace(/<legacyDrawing[^>]*\/>/g, ''),
            );
        }
        if (/\[Content_Types\]\.xml$/i.test(name)) {
            out[name] = strToU8(
                strFromU8(out[name])
                    .replace(/<Override[^>]*PartName="[^"]*drawing[^"]*"[^>]*\/>/gi, '')
                    .replace(/<Default[^>]*Extension="vml"[^>]*\/>/gi, ''),
            );
        }
    }
    return out;
}

/**
 * Пересобрать архив с исправленными дефектами. Возвращает новый ArrayBuffer,
 * пригодный и для парсинга, и для «экспорта поверх оригинала».
 * Бросает, если архив вообще не разворачивается (тогда чинить нечего).
 */
export function repairXlsx(buffer: ArrayBuffer): ArrayBuffer {
    const files = unzipSync(new Uint8Array(buffer));
    const repaired = stripDrawings(fixPartNameCase(files));
    const out = zipSync(repaired);
    // Возвращаем именно ArrayBuffer (срез, чтобы не тащить лишний хвост пула).
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

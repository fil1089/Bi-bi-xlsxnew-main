import React, { useCallback } from 'react';
import { UploadIcon } from './Icons';
import { BiBiLogo } from './BiBiLogo';
import { isAuthEnabled } from '../lib/supabase';
import { normalizeCellValue } from '../lib/utils';
import { SheetData } from '../types';

interface FileUploadProps {
    onFileProcessed: (headers: string[], data: SheetData, fileName: string, worksheet: any) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string) => void;
    onShowAuth?: () => void;
    onLogout?: () => void;
    isAuthenticated?: boolean;
    userEmail?: string | null;
}

declare const ExcelJS: any;

const FileUpload: React.FC<FileUploadProps> = ({
    onFileProcessed,
    setLoading,
    setError,
    onShowAuth,
    onLogout,
    isAuthenticated = false,
    userEmail = null
}) => {

    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError('');

        try {
            const buffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);

            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                setError('Файл не содержит листов');
                setLoading(false);
                return;
            }

            // Извлечь заголовки
            const headers: string[] = [];
            const headerRow = worksheet.getRow(1);
            headerRow.eachCell({ includeEmpty: true }, (cell: any) => {
                headers.push(String(cell.value ?? ''));
            });

            // Извлечь данные
            const data: SheetData = [];
            for (let i = 2; i <= worksheet.rowCount; i++) {
                const row = worksheet.getRow(i);
                const rowData: (string | number | boolean | null)[] = [];

                for (let j = 1; j <= headers.length; j++) {
                    const cell = row.getCell(j);
                    rowData.push(normalizeCellValue(cell.value));
                }

                data.push(rowData);
            }

            onFileProcessed(headers, data, file.name, worksheet);
        } catch (err) {
            console.error('Ошибка загрузки:', err);
            setError('Не удалось загрузить файл');
        } finally {
            setLoading(false);
        }
    }, [onFileProcessed, setLoading, setError]);

    const handleClick = useCallback(() => {
        document.getElementById('fileInput')?.click();
    }, []);

    return (
        <div className="position-fixed inset-0 d-flex align-items-center justify-content-center bg-black">
            {/* Auth buttons in top-right corner - only show if auth is enabled */}
            {/* Top Bar with Logo and Auth */}
            {isAuthEnabled && (
                <div className="position-absolute top-0 start-0 end-0 p-3 d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                        <BiBiLogo style={{ width: '100px', height: 'auto' }} />
                    </div>
                    <div>
                        {isAuthenticated ? (
                            <button
                                onClick={onLogout}
                                className="btn btn-outline-danger btn-sm px-3"
                                title={`Выйти (${userEmail})`}
                            >
                                ВЫХОД
                            </button>
                        ) : (
                            <button
                                onClick={onShowAuth}
                                className="btn btn-outline-warning btn-sm px-3"
                            >
                                ВОЙТИ
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="text-center p-4" style={{ maxWidth: '26rem' }}>
                <h1 className="h4 fw-bold text-white mb-3">Редактор XLSX Lite</h1>
                <p className="text-gray-300 mb-4 small">
                    Открывайте, ищите и выделяйте ячейки в ваших таблицах. Адаптировано для мобильных устройств.
                </p>

                <input
                    id="fileInput"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="d-none"
                />

                <button
                    onClick={handleClick}
                    className="btn btn-lg btn-outline-secondary w-100 py-3 border-2 border-dashed bg-gray-800 text-gray-300 d-flex flex-column align-items-center justify-content-center gap-2"
                    style={{ minHeight: '10rem' }}
                >
                    <UploadIcon style={{ width: '2.5rem', height: '2.5rem' }} />
                    <span className="fw-bold">Нажмите, чтобы выбрать файл XLS или XLSX</span>
                    <span className="small text-gray-400">Ваш файл обрабатывается локально в браузере.</span>
                </button>
            </div>
        </div>
    );
};

export default FileUpload;
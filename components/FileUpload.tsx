import React, { useCallback } from 'react';
import { UploadIcon, TrashIcon, DocumentTextIcon } from './Icons';
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
    userFiles?: any[];
    onSelectFile?: (file: any) => void;
    onDeleteFile?: (fileName: string) => void;
}

declare const ExcelJS: any;

const FileUpload: React.FC<FileUploadProps> = ({
    onFileProcessed,
    setLoading,
    setError,
    onShowAuth,
    onLogout,
    isAuthenticated = false,
    userEmail = null,
    userFiles = [],
    onSelectFile,
    onDeleteFile
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
                    className="btn btn-lg btn-outline-secondary w-100 py-3 border-2 border-dashed bg-gray-800 text-gray-300 d-flex flex-column align-items-center justify-content-center gap-2 mb-4 transition-all hover:bg-gray-700"
                    style={{ minHeight: '8rem' }}
                >
                    <UploadIcon style={{ width: '2rem', height: '2rem' }} />
                    <span className="fw-bold">Выбрать новый файл</span>
                    <span className="small text-gray-400">Перетащите сюда или нажмите для выбора</span>
                </button>

                {isAuthenticated && userFiles.length > 0 && (
                    <div className="text-start mt-2">
                        <h2 className="h6 fw-bold text-gray-400 text-uppercase mb-3" style={{ letterSpacing: '0.05em', fontSize: '0.75rem' }}>Недавние файлы</h2>
                        <div className="d-flex flex-column gap-2 overflow-y-auto pe-1" style={{ maxHeight: '15rem' }}>
                            {userFiles.map((file) => (
                                <div
                                    key={file.id}
                                    className="d-flex align-items-center justify-content-between p-3 bg-gray-800 rounded border border-secondary transition-all hover:bg-gray-700 group cursor-pointer"
                                    onClick={() => onSelectFile?.(file)}
                                >
                                    <div className="d-flex align-items-center gap-3 overflow-hidden">
                                        <DocumentTextIcon className="text-yellow-400 flex-shrink-0" style={{ width: '1.25rem', height: '1.25rem' }} />
                                        <div className="overflow-hidden">
                                            <div className="text-white small fw-medium text-truncate">{file.file_name}</div>
                                            <div className="text-gray-500" style={{ fontSize: '0.7rem' }}>
                                                {new Date(file.updated_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm(`Вы уверены, что хотите удалить файл "${file.file_name}"?`)) {
                                                onDeleteFile?.(file.file_name);
                                            }
                                        }}
                                        className="btn btn-link btn-sm text-gray-500 hover-text-danger p-1 border-0"
                                        title="Удалить файл"
                                    >
                                        <TrashIcon style={{ width: '1rem', height: '1rem' }} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileUpload;
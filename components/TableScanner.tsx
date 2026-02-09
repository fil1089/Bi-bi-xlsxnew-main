import React, { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { UploadIcon } from './Icons';

interface TableScannerProps {
    onExtract: (data: string[][]) => void;
    onClose: () => void;
}

const TableScanner: React.FC<TableScannerProps> = ({ onExtract, onClose }) => {
    const [image, setImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setImage(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const processImage = async () => {
        if (!image) return;
        setLoading(true);
        setStatus('Инициализация OCR...');

        try {
            // Tesseract v5+ syntax: createWorker('lang')
            const worker = await createWorker('rus+eng');

            setStatus('Распознавание текста...');
            const { data: { text } } = await worker.recognize(image, {
                rotateAuto: true,
            });

            setStatus('Обработка таблицы...');

            // Basic parsing logic: Split by newlines, then by multiple spaces
            const rows: string[][] = [];
            const textLines = text.split('\n').filter(line => line.trim() !== '');

            textLines.forEach(line => {
                // Split by 2 or more spaces, or tabs
                const cells = line.split(/\s{2,}/).filter(c => c.trim() !== '');
                if (cells.length > 0) {
                    rows.push(cells);
                }
            });

            await worker.terminate();

            if (rows.length > 0) {
                onExtract(rows);
            } else {
                alert('Не удалось распознать структуру таблицы. Попробуйте еще раз или другое фото.');
            }

        } catch (err: any) {
            console.error(err);
            alert('Ошибка при распознавании: ' + (err.message || String(err)));
        } finally {
            setLoading(false);
            setStatus('');
        }
    };

    return (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-black bg-opacity-75 backdrop-blur z-2000">
            <div className="bg-gray-800 border border-secondary rounded-4 p-4 shadow-lg text-center d-flex flex-column" style={{ maxWidth: '95%', width: '32rem', maxHeight: '90vh' }}>
                <h3 className="h5 text-white mb-3">Сканирование таблицы</h3>

                <div className="flex-grow-1 bg-black border border-secondary rounded-3 mb-3 d-flex align-items-center justify-content-center overflow-hidden position-relative" style={{ minHeight: '200px' }}>
                    {image ? (
                        <img src={image} alt="Preview" className="img-fluid object-contain" style={{ maxHeight: '50vh' }} />
                    ) : (
                        <div className="text-gray-500 d-flex flex-column align-items-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <UploadIcon className="w-10 h-10 mb-2 opacity-50" />
                            <p className="small mb-0">Нажмите чтобы выбрать фото</p>
                        </div>
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="d-none"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                    />
                </div>

                {loading ? (
                    <div className="text-warning mb-3">
                        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                        <span className="small animate-pulse">{status}</span>
                    </div>
                ) : (
                    <div className="d-grid gap-2">
                        {!image ? (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="btn btn-outline-primary py-2 fw-medium"
                            >
                                Выбрать фото
                            </button>
                        ) : (
                            <div className="d-flex gap-2">
                                <button
                                    onClick={() => setImage(null)}
                                    className="btn btn-outline-secondary py-2 flex-grow-1"
                                >
                                    Сброс
                                </button>
                                <button
                                    onClick={processImage}
                                    className="btn btn-primary py-2 flex-grow-1 fw-bold"
                                >
                                    Запуск OCR
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="btn btn-link text-gray-500 mt-2 small text-decoration-none hover:text-white"
                    disabled={loading}
                >
                    Отмена
                </button>
            </div>
        </div>
    );
};

export default TableScanner;

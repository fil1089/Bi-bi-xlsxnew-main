import React, { useState, useCallback } from 'react';
import { TrashIcon, BackArrowIcon, SaveIcon, SearchIcon } from './Icons';

interface FileEditorProps {
    headers: string[];
    data: any[][];
    columnWidths: number[];
    onDeleteRows: (rowIndices: number[]) => void;
    onDeleteColumns: (colIndices: number[]) => void;
    onBack: () => void;
    onSwitchToSearch: () => void;
    onDownload: () => void;
    fileName: string;
}

const FileEditor: React.FC<FileEditorProps> = ({
    headers,
    data,
    columnWidths,
    onDeleteRows,
    onDeleteColumns,
    onBack,
    onSwitchToSearch,
    onDownload,
    fileName
}) => {
    const [selectionMode, setSelectionMode] = useState<'row' | 'col' | null>(null);
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

    const toggleSelection = useCallback((index: number, type: 'row' | 'col') => {
        let newIndices: Set<number>;
        let newMode = type;

        if (selectionMode !== type) {
            newIndices = new Set([index]);
        } else {
            newIndices = new Set(selectedIndices);
            if (newIndices.has(index)) {
                newIndices.delete(index);
            } else {
                newIndices.add(index);
            }
        }

        if (newIndices.size === 0) {
            setSelectionMode(null);
            setSelectedIndices(new Set());
        } else {
            setSelectionMode(newMode);
            setSelectedIndices(newIndices);
        }
    }, [selectedIndices, selectionMode]);

    const handleHeaderClick = (index: number) => {
        toggleSelection(index, 'col');
    };

    const handleRowNumberClick = (index: number) => {
        toggleSelection(index, 'row');
    };

    const handleDelete = () => {
        if (selectedIndices.size === 0) return;

        const count = selectedIndices.size;
        const typeLabel = selectionMode === 'col' ? (count > 1 ? 'столбцы' : 'столбец') : (count > 1 ? 'строки' : 'строку');

        if (window.confirm(`Удалить выбранные ${count} ${typeLabel}?`)) {
            const indices = Array.from(selectedIndices).map(Number).sort((a, b) => b - a);

            if (selectionMode === 'col') {
                onDeleteColumns(indices);
            } else {
                onDeleteRows(indices);
            }

            setSelectedIndices(new Set());
            setSelectionMode(null);
        }
    };

    return (
        <div className="d-flex flex-column flex-grow-1 h-100 w-100 bg-black text-white" style={{ minHeight: 0 }}>
            {/* Toolbar */}
            <div className="d-flex flex-column p-2 border-bottom border-secondary bg-gray-900 shadow-sm z-20">
                <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2 overflow-hidden">
                        <button
                            onClick={onBack}
                            className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center p-2"
                            title="Назад"
                        >
                            <BackArrowIcon className="text-warning" style={{ width: '1.25rem', height: '1.25rem' }} />
                        </button>

                        <div className="d-flex flex-column truncate">
                            <span className="text-white fw-bold small text-truncate">{fileName}</span>
                            <span className="text-gray-400 x-small text-truncate">
                                {selectionMode ? `Выбрано: ${selectedIndices.size}` : 'Режим редактирования'}
                            </span>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        {selectionMode && selectedIndices.size > 0 && (
                            <button
                                onClick={handleDelete}
                                className="btn btn-sm btn-danger d-flex align-items-center gap-1 fw-bold px-2 py-1 shadow-sm"
                            >
                                <span>Удалить ({selectedIndices.size})</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="d-flex align-items-center gap-2 pt-1 border-top border-secondary border-opacity-25">
                    <button
                        onClick={onSwitchToSearch}
                        className="btn btn-sm btn-outline-warning d-flex align-items-center justify-content-center gap-1 flex-grow-1 py-1.5 fw-bold"
                    >
                        <SearchIcon style={{ width: '1rem', height: '1rem' }} />
                        <span>В поиск</span>
                    </button>

                    <button
                        onClick={onDownload}
                        className="btn btn-sm btn-success d-flex align-items-center justify-content-center gap-1 flex-grow-1 py-1.5 fw-bold"
                    >
                        <SaveIcon style={{ width: '1rem', height: '1rem' }} />
                        <span>Скачать</span>
                    </button>
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-grow-1 overflow-auto bg-gray-900 custom-scrollbar" style={{ minHeight: 0 }}>
                <table className="w-100 border-collapse bg-black" style={{ tableLayout: columnWidths.length > 0 ? 'fixed' : 'auto' }}>
                    <colgroup>
                        <col style={{ width: '50px' }} /> {/* Row numbers column */}
                        {columnWidths.map((width, index) => (
                            <col key={`col-${index}`} style={{ width: `${width}px` }} />
                        ))}
                    </colgroup>

                    <thead className="sticky top-0 z-10 bg-gray-900 shadow-sm">
                        <tr>
                            <th className="p-2 border-bottom border-end border-secondary bg-gray-800 z-20 sticky left-0 text-center text-gray-500 small select-none">#</th>
                            {headers.map((header, index) => {
                                const isSelected = selectionMode === 'col' && selectedIndices.has(index);
                                return (
                                    <th
                                        key={index}
                                        onClick={() => handleHeaderClick(index)}
                                        className={`p-2 text-start small fw-bold border-bottom border-end border-secondary whitespace-nowrap cursor-pointer transition-colors select-none position-relative ${isSelected ? 'bg-green-800 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
                                    >
                                        <div className="truncate px-1">{header}</div>
                                        {isSelected && <div className="position-absolute bottom-0 start-0 w-100 bg-green-500" style={{ height: '3px' }}></div>}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>

                    <tbody>
                        {data.map((row, rowIndex) => {
                            const isRowSelected = selectionMode === 'row' && selectedIndices.has(rowIndex);

                            return (
                                <tr key={rowIndex} className={`transition-colors ${isRowSelected ? 'bg-green-900 bg-opacity-50' : ''}`}>
                                    <td
                                        onClick={() => handleRowNumberClick(rowIndex)}
                                        className={`p-2 text-center small border-bottom border-end border-secondary sticky left-0 z-10 cursor-pointer select-none transition-colors fw-medium position-relative ${isRowSelected ? 'bg-green-800 text-white' : 'bg-gray-800 text-gray-500 hover:text-white'}`}
                                    >
                                        {rowIndex + 1}
                                        {isRowSelected && <div className="position-absolute top-0 end-0 h-100 bg-green-500" style={{ width: '3px' }}></div>}
                                    </td>
                                    {row.map((cell: any, colIndex: number) => {
                                        const isColSelected = selectionMode === 'col' && selectedIndices.has(colIndex);
                                        const isHighlighted = isColSelected;

                                        return (
                                            <td
                                                key={colIndex}
                                                className={`p-2 small text-gray-200 border-bottom border-end border-secondary whitespace-nowrap overflow-hidden transition-colors ${isHighlighted ? 'bg-green-900 bg-opacity-30' : ''}`}
                                            >
                                                <div className="truncate px-1">{String(cell ?? '')}</div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Empty State / Hint */}
            {data.length === 0 && (
                <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-gray-500">
                    <p>Нет данных для отображения</p>
                </div>
            )}
        </div>
    );
};

export default FileEditor;

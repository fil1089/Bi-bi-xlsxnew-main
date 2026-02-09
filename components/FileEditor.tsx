import React, { useState, useRef, useEffect } from 'react';
import { TrashIcon, ChevronLeftIcon } from './Icons';

interface FileEditorProps {
    headers: string[];
    data: any[][];
    columnWidths: number[];
    onDeleteRow: (rowIndex: number) => void;
    onDeleteColumn: (colIndex: number) => void;
    onBack: () => void;
    fileName: string;
}

const FileEditor: React.FC<FileEditorProps> = ({
    headers,
    data,
    columnWidths,
    onDeleteRow,
    onDeleteColumn,
    onBack,
    fileName
}) => {
    const [selectedType, setSelectedType] = useState<'row' | 'col' | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    const handleHeaderClick = (index: number) => {
        if (selectedType === 'col' && selectedIndex === index) {
            setSelectedType(null);
            setSelectedIndex(null);
        } else {
            setSelectedType('col');
            setSelectedIndex(index);
        }
    };

    const handleRowNumberClick = (index: number) => {
        if (selectedType === 'row' && selectedIndex === index) {
            setSelectedType(null);
            setSelectedIndex(null);
        } else {
            setSelectedType('row');
            setSelectedIndex(index);
        }
    };

    const handleDelete = () => {
        if (selectedType === 'col' && selectedIndex !== null) {
            if (window.confirm(`Удалить столбец "${headers[selectedIndex]}"?`)) {
                onDeleteColumn(selectedIndex);
                setSelectedType(null);
                setSelectedIndex(null);
            }
        } else if (selectedType === 'row' && selectedIndex !== null) {
            if (window.confirm(`Удалить строку ${selectedIndex + 1}?`)) {
                onDeleteRow(selectedIndex);
                setSelectedType(null);
                setSelectedIndex(null);
            }
        }
    };

    return (
        <div className="d-flex flex-column h-100 bg-black text-white">
            {/* Toolbar */}
            <div className="d-flex align-items-center justify-content-between p-3 border-bottom border-secondary bg-gray-900">
                <div className="d-flex align-items-center gap-3">
                    <button
                        onClick={onBack}
                        className="btn btn-link text-white p-0 d-flex align-items-center gap-2 text-decoration-none"
                    >
                        <ChevronLeftIcon className="w-5 h-5" />
                        <span>Назад</span>
                    </button>
                    <span className="text-gray-400 border-start border-secondary ps-3 ms-2">{fileName}</span>
                </div>

                {selectedType && selectedIndex !== null && (
                    <button
                        onClick={handleDelete}
                        className="btn btn-danger d-flex align-items-center gap-2"
                    >
                        <TrashIcon className="w-4 h-4" />
                        <span>Удалить {selectedType === 'col' ? 'столбец' : 'строку'}</span>
                    </button>
                )}
            </div>

            {/* Table Container */}
            <div className="flex-grow-1 overflow-auto">
                <table className="w-100 border-collapse" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                        <col style={{ width: '50px' }} /> {/* Row numbers column */}
                        {columnWidths.map((width, index) => (
                            <col key={`col-${index}`} style={{ width: `${width}px` }} />
                        ))}
                    </colgroup>

                    <thead className="sticky top-0 z-20 bg-gray-900">
                        <tr>
                            <th className="p-2 border-bottom border-end border-secondary bg-gray-800 z-30 sticky left-0 text-center text-gray-500 small">#</th>
                            {headers.map((header, index) => {
                                const isSelected = selectedType === 'col' && selectedIndex === index;
                                return (
                                    <th
                                        key={index}
                                        onClick={() => handleHeaderClick(index)}
                                        className={`p-2 text-start small fw-bold border-bottom border-end border-secondary whitespace-nowrap cursor-pointer transition-colors ${isSelected ? 'bg-blue-900 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
                                    >
                                        <div className="truncate">{header}</div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>

                    <tbody>
                        {data.map((row, rowIndex) => {
                            const isRowSelected = selectedType === 'row' && selectedIndex === rowIndex;

                            return (
                                <tr key={rowIndex} className={isRowSelected ? 'bg-blue-900 bg-opacity-25' : ''}>
                                    <td
                                        onClick={() => handleRowNumberClick(rowIndex)}
                                        className={`p-2 text-center small text-gray-500 border-bottom border-end border-secondary bg-gray-800 sticky left-0 z-10 cursor-pointer hover:text-white ${isRowSelected ? 'bg-blue-900 text-white' : ''}`}
                                    >
                                        {rowIndex + 1}
                                    </td>
                                    {row.map((cell: any, colIndex: number) => {
                                        const isColSelected = selectedType === 'col' && selectedIndex === colIndex;

                                        return (
                                            <td
                                                key={colIndex}
                                                className={`p-2 small text-gray-200 border-bottom border-end border-secondary whitespace-nowrap overflow-hidden ${isColSelected ? 'bg-blue-900 bg-opacity-10' : ''}`}
                                            >
                                                <div className="truncate">{String(cell ?? '')}</div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FileEditor;

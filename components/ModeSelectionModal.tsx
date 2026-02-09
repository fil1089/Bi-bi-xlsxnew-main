import React from 'react';
import { SearchIcon, EditIcon } from './Icons';

interface ModeSelectionModalProps {
    fileName: string;
    onSelectMode: (mode: 'search' | 'edit') => void;
    onCancel: () => void;
}

const ModeSelectionModal: React.FC<ModeSelectionModalProps> = ({ fileName, onSelectMode, onCancel }) => {
    return (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-black bg-opacity-90 backdrop-blur z-2000">
            <div className="bg-gray-900 border border-secondary rounded-4 p-4 shadow-lg text-center" style={{ maxWidth: '90%', width: '22rem' }}>
                <h3 className="h6 text-gray-400 mb-2 text-uppercase fw-bold ls-1">Файл загружен</h3>
                <p className="text-white mb-4 fw-medium text-truncate">{fileName}</p>

                <div className="d-grid gap-3">
                    {/* Search Button - Yellow */}
                    <button
                        onClick={() => onSelectMode('search')}
                        className="btn py-4 d-flex flex-column align-items-center justify-content-center gap-2 transition-all border-0 shadow-sm"
                        style={{ backgroundColor: '#fbbf24', color: '#000' }}
                    >
                        <SearchIcon className="w-8 h-8" />
                        <span className="fw-bold fs-5">Поиск и выделение</span>
                    </button>

                    {/* Editor Button - Black */}
                    <button
                        onClick={() => onSelectMode('edit')}
                        className="btn py-4 d-flex flex-column align-items-center justify-content-center gap-2 transition-all border border-secondary"
                        style={{ backgroundColor: '#000', color: '#fff' }}
                    >
                        <EditIcon className="w-8 h-8" />
                        <span className="fw-bold fs-5">Редактор (удаление)</span>
                    </button>
                </div>

                <div className="mt-4 pt-2 border-top border-secondary opacity-30"></div>

                <button
                    onClick={onCancel}
                    className="btn btn-link text-gray-500 mt-2 small text-decoration-none hover:text-white w-100 py-2"
                >
                    Отмена
                </button>
            </div>
        </div>
    );
};

export default ModeSelectionModal;

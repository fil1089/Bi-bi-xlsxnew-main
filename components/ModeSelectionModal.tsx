import React from 'react';
import { SearchIcon, EditIcon } from './Icons';

interface ModeSelectionModalProps {
    fileName: string;
    onSelectMode: (mode: 'search' | 'edit') => void;
    onCancel: () => void;
}

const ModeSelectionModal: React.FC<ModeSelectionModalProps> = ({ fileName, onSelectMode, onCancel }) => {
    return (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-black bg-opacity-75 backdrop-blur z-2000">
            <div className="bg-gray-800 border border-secondary rounded p-4 shadow-lg text-center" style={{ maxWidth: '90%', width: '24rem' }}>
                <h3 className="h5 text-white mb-2">Файл загружен</h3>
                <p className="text-gray-400 mb-4 small text-truncate">{fileName}</p>

                <div className="d-grid gap-3">
                    <button
                        onClick={() => onSelectMode('search')}
                        className="btn btn-outline-warning py-3 d-flex align-items-center justify-content-center gap-2 group hover:bg-yellow-900 transition-colors"
                    >
                        <SearchIcon className="w-5 h-5" />
                        <span className="fw-medium">Поиск и выделение</span>
                    </button>

                    <button
                        onClick={() => onSelectMode('edit')}
                        className="btn btn-outline-primary py-3 d-flex align-items-center justify-content-center gap-2 group hover:bg-blue-900 transition-colors"
                    >
                        <EditIcon className="w-5 h-5" />
                        <span className="fw-medium">Редактор (удаление строк)</span>
                    </button>
                </div>

                <button
                    onClick={onCancel}
                    className="btn btn-link text-gray-500 mt-3 small text-decoration-none hover:text-white"
                >
                    Отмена
                </button>
            </div>
        </div>
    );
};

export default ModeSelectionModal;

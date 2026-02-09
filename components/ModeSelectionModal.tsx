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
            <div className="bg-gray-900 border border-secondary rounded-3 p-4 shadow-lg text-center" style={{ maxWidth: '90%', width: '22rem' }}>
                <h3 className="h6 text-gray-400 mb-2 text-uppercase fw-bold ls-1">Файл загружен</h3>
                <p className="text-white mb-4 fw-medium text-truncate">{fileName}</p>

                <div className="d-grid gap-3">
                    <button
                        onClick={() => onSelectMode('search')}
                        className="btn btn-dark border-secondary py-3 d-flex align-items-center justify-content-center gap-2 group hover:bg-gray-800 transition-colors bg-gradient-to-r"
                    >
                        <SearchIcon className="w-5 h-5 text-warning" />
                        <span className="fw-medium text-gray-200">Поиск и выделение</span>
                    </button>

                    <button
                        onClick={() => onSelectMode('edit')}
                        className="btn btn-success py-3 d-flex align-items-center justify-content-center gap-2 group shadow-lg"
                        style={{ backgroundColor: '#10b981', borderColor: '#059669' }}
                    >
                        <EditIcon className="w-5 h-5" />
                        <span className="fw-bold">Редактор (удаление)</span>
                    </button>
                </div>

                <div className="mt-4 pt-2 border-top border-secondary opacity-50"></div>

                <button
                    onClick={onCancel}
                    className="btn btn-link text-gray-500 mt-2 small text-decoration-none hover:text-white w-100"
                >
                    Отмена
                </button>
            </div>
        </div>
    );
};

export default ModeSelectionModal;

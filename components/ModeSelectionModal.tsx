import React from 'react';

interface ModeSelectionModalProps {
    fileName: string;
    onSelectMode: (mode: 'search' | 'edit') => void;
    onCancel: () => void;
}

const ModeSelectionModal: React.FC<ModeSelectionModalProps> = ({ fileName, onSelectMode, onCancel }) => {
    return (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-black bg-opacity-80 backdrop-blur z-2000">
            <div className="bg-gray-800 border-0 rounded-4 p-4 shadow-lg text-center" style={{ maxWidth: '90%', width: '22.5rem', backgroundColor: '#1e293b' }}>
                <h3 className="h6 text-white mb-2 text-uppercase fw-bold opacity-75 fs-6 tracking-wide pt-2">ФАЙЛ ЗАГРУЖЕН</h3>
                <p className="text-white mb-4 fw-normal opacity-50 small text-truncate px-2">{fileName}</p>

                <div className="d-grid gap-3 mb-4 px-1">
                    {/* Search Button - Like Screenshot (Outlineish Yellow) */}
                    <button
                        onClick={() => onSelectMode('search')}
                        className="btn py-3 d-flex align-items-center justify-content-center transition-all rounded-3 fs-5 fw-bold"
                        style={{
                            backgroundColor: 'rgba(251, 191, 36, 0.05)',
                            border: '1.5px solid #fbbf24',
                            color: '#fbbf24'
                        }}
                    >
                        Поиск и выделение
                    </button>

                    {/* Editor Button - Like Screenshot (Solid black as requested) */}
                    <button
                        onClick={() => onSelectMode('edit')}
                        className="btn py-3 d-flex align-items-center justify-content-center transition-all rounded-3 fs-5 fw-bold"
                        style={{
                            backgroundColor: '#000',
                            border: '1.5px solid #334155',
                            color: '#fff'
                        }}
                    >
                        Редактор (удаление строк)
                    </button>
                </div>

                <button
                    onClick={onCancel}
                    className="btn btn-link text-gray-500 small text-decoration-none hover:text-white py-1 mb-2"
                >
                    Отмена
                </button>
            </div>
        </div>
    );
};

export default ModeSelectionModal;

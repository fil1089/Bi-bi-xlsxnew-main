
import React, { useState, useEffect, useRef } from 'react';

interface NoteEditorProps {
    note: string;
    onSave: (note: string) => void;
    onClose: () => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ note, onSave, onClose }) => {
    const [text, setText] = useState(note);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, []);

    const handleSave = () => {
        onSave(text);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            handleSave();
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div
            className="position-fixed inset-0 z-2000 bg-opacity-75 d-flex align-items-start justify-content-center p-4 pt-5"
            onClick={onClose}
        >
            <div
                className="bg-gray-800 rounded shadow w-100 p-4 d-flex flex-column gap-3 border border-secondary"
                style={{ maxWidth: '28rem' }}
                onClick={e => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                <h2 className="h5 fw-bold text-gray-100">Редактировать заметку</h2>
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    className="form-control h-full bg-gray-900 border-secondary focus-warning placeholder-gray-400 text-white"
                    style={{ height: '8rem' }}
                    placeholder="Введите вашу заметку..."
                />
                <div className="d-flex justify-content-end gap-2">
                    <button
                        onClick={onClose}
                        className="btn btn-secondary btn-sm transition-colors"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleSave}
                        className="btn btn-warning btn-sm fw-bold transition-colors"
                    >
                        Сохранить
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NoteEditor;


import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
// Fix: Correctly import KeyboardButtonConfig type.
import type { KeyboardButtonConfig } from './NumericKeyboard';
// Fix: Import newly created DragHandleIcon.
import { DragHandleIcon } from './Icons';

interface KeyboardSettingsModalProps {
    layout: KeyboardButtonConfig[];
    onChange: (layout: KeyboardButtonConfig[]) => void;
    onClose: () => void;
}

const KeyboardSettingsModal: React.FC<KeyboardSettingsModalProps> = ({ layout, onChange, onClose }) => {

    function handleDragEnd(result: DropResult) {
        if (!result.destination) return;
        const updated = Array.from(layout);
        const [removed] = updated.splice(result.source.index, 1);
        updated.splice(result.destination.index, 0, removed);
        onChange(updated);
    }

    return (
        <div
            className="position-fixed inset-0 z-1050 bg-opacity-75 d-flex align-items-center justify-content-center p-4"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div
                className="bg-gray-800 rounded shadow w-100 p-4 d-flex flex-column gap-2 border border-secondary"
                style={{ maxWidth: '24rem' }}
                onClick={e => e.stopPropagation()}
            >
                <h2 className="h5 fw-bold text-gray-100">Настройка клавиатуры</h2>
                <p className="small text-gray-400">Перетащите кнопки, чтобы изменить их порядок. Изменения сохраняются автоматически.</p>

                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="keyboard-layout">
                        {(provided) => (
                            <div {...provided.droppableProps} ref={provided.innerRef} className="overflow-y-auto pe-2" style={{ maxHeight: '20rem' }}>
                                {layout.map((btn, index) => (
                                    <Draggable key={btn.id} draggableId={btn.id} index={index}>
                                        {(provided, snapshot) => (
                                            <div ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                                className={`p-2 rounded d-flex align-items-center gap-3 transition-colors mb-2 ${snapshot.isDragging ? 'bg-warning bg-opacity-25' : 'bg-gray-900'}`}
                                            >
                                                <DragHandleIcon style={{ width: '1.25rem', height: '1.25rem' }} className="text-gray-500 flex-shrink-0" />
                                                <div className="flex-shrink-0 d-flex align-items-center justify-content-center bg-gray-800 rounded" style={{ width: '3rem', height: '3rem' }}>
                                                    {btn.renderPreview()}
                                                </div>
                                                <span className="text-gray-200">{btn.label}</span>
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>

                <div className="d-flex justify-content-end gap-2 mt-4">
                    <button
                        onClick={onClose}
                        className="btn btn-warning btn-sm fw-bold transition-colors"
                    >
                        Готово
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KeyboardSettingsModal;

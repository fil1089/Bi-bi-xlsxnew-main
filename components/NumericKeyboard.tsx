
import React, { useRef } from 'react';
import { TrashIcon, HighlightIcon, ChevronDownIcon, DocumentTextIcon, BackspaceIcon, PlusIcon, SaveIcon } from './Icons';
import { FilterType } from '../types';

// Fix: Export KeyboardButtonConfig type for use in KeyboardSettingsModal.
export type KeyboardButtonConfig = {
    id: string;
    label: string;
    renderPreview: () => React.ReactNode;
};

interface NumericKeyboardProps {
    onKeyPress: (key: string) => void;
    onBackspace: () => void;
    onDone: () => void;
    onClear: () => void;
    highlightMode: boolean;
    onHighlightToggle: () => void;
    onAddNote: () => void;
    isCellSelected: boolean;
    onReset: () => void;
    onSave: () => void;
    onForceSave: () => void;
    onFillEmptyRed: () => void;
}

const KeyButton: React.FC<{
    onClick: () => void;
    children: React.ReactNode;
    className?: string;
    title?: string;
    disabled?: boolean;
    onPressStart?: () => void;
    onPressEnd?: () => void;
}> = ({ onClick, children, className = '', title, disabled = false, onPressStart, onPressEnd }) => (
    <button
        onClick={onClick}
        onPointerDown={onPressStart}
        onPointerUp={onPressEnd}
        onPointerLeave={onPressEnd}
        onContextMenu={onPressStart ? (e) => e.preventDefault() : undefined}
        className={`btn-press-anim d-flex align-items-center justify-content-center border-0 fw-bold text-white bg-gray-800 rounded transition-colors ${className} ${disabled ? 'opacity-50' : ''}`}
        style={{ height: '3rem', width: '100%', fontSize: '1.25rem', cursor: disabled ? 'not-allowed' : 'pointer', touchAction: 'manipulation', userSelect: 'none' }}
        title={title}
        disabled={disabled}
        aria-label={title || (typeof children === 'string' ? children : 'keyboard button')}
    >
        {children}
    </button>
);

const NumericKeyboard: React.FC<NumericKeyboardProps> = (props) => {
    const {
        onKeyPress,
        onBackspace,
        onDone,
        onClear,
        highlightMode,
        onHighlightToggle,
        onAddNote,
        isCellSelected,
        onReset,
        onSave,
        onForceSave,
        onFillEmptyRed,
    } = props;

    // Долгое удержание карандаша (≥600мс) — перекрасить незакрашенные в красный.
    // Короткий тап — обычное переключение режима выделения.
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressFiredRef = useRef(false);

    const startHighlightPress = () => {
        longPressFiredRef.current = false;
        longPressTimerRef.current = setTimeout(() => {
            longPressFiredRef.current = true;
            onFillEmptyRed();
        }, 600);
    };

    const cancelHighlightPress = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleHighlightClick = () => {
        // Если только что сработало долгое удержание — обычный тап игнорируем.
        if (longPressFiredRef.current) {
            longPressFiredRef.current = false;
            return;
        }
        onHighlightToggle();
    };

    // Долгое удержание кнопки сохранения (≥600мс) — форсировать сохранение на
    // сервер (минуя debounce автосейва). Короткий тап — скачать файл .xlsx.
    const savePressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savePressFiredRef = useRef(false);

    const startSavePress = () => {
        savePressFiredRef.current = false;
        savePressTimerRef.current = setTimeout(() => {
            savePressFiredRef.current = true;
            onForceSave();
        }, 600);
    };

    const cancelSavePress = () => {
        if (savePressTimerRef.current) {
            clearTimeout(savePressTimerRef.current);
            savePressTimerRef.current = null;
        }
    };

    const handleSaveClick = () => {
        // Если только что сработало долгое удержание — обычный тап игнорируем.
        if (savePressFiredRef.current) {
            savePressFiredRef.current = false;
            return;
        }
        onSave();
    };

    const buttons = [
        // Row 1
        { id: '1', content: '1', action: () => onKeyPress('1'), disabled: false },
        { id: '2', content: '2', action: () => onKeyPress('2'), disabled: false },
        { id: '3', content: '3', action: () => onKeyPress('3'), disabled: false },
        { id: 'clear', content: <TrashIcon style={{ width: '1.5rem', height: '1.5rem' }} />, action: onClear, className: "bg-red-800", title: "Очистить поиск", disabled: false },
        // Row 2
        { id: '4', content: '4', action: () => onKeyPress('4'), disabled: false },
        { id: '5', content: '5', action: () => onKeyPress('5'), disabled: false },
        { id: '6', content: '6', action: () => onKeyPress('6'), disabled: false },
        { id: 'backspace', content: <BackspaceIcon style={{ width: '1.5rem', height: '1.5rem' }} />, action: onBackspace, title: "Удалить", disabled: false },
        // Row 3
        { id: '7', content: '7', action: () => onKeyPress('7'), disabled: false },
        { id: '8', content: '8', action: () => onKeyPress('8'), disabled: false },
        { id: '9', content: '9', action: () => onKeyPress('9'), disabled: false },
        { id: 'highlight', content: <HighlightIcon style={{ width: '1.5rem', height: '1.5rem', color: highlightMode ? 'black' : 'white' }} />, action: handleHighlightClick, className: highlightMode ? 'bg-warning' : 'bg-gray-700', title: "Режим выделения (удерживайте — закрасить незакрашенные красным)", disabled: false, onPressStart: startHighlightPress, onPressEnd: cancelHighlightPress },
    ];

    return (
        <div className="w-100 pb-2 px-2">
            <div className="mx-auto" style={{ maxWidth: '28rem' }}>
                <div className="row g-2 mb-2">
                    {buttons.slice(0, 4).map(btn => (
                        <div key={btn.id} className="col-3">
                            <KeyButton onClick={btn.action} className={btn.className} title={btn.title} disabled={btn.disabled}>
                                {btn.content}
                            </KeyButton>
                        </div>
                    ))}
                </div>
                <div className="row g-2 mb-2">
                    {buttons.slice(4, 8).map(btn => (
                        <div key={btn.id} className="col-3">
                            <KeyButton onClick={btn.action} className={btn.className} title={btn.title} disabled={btn.disabled}>
                                {btn.content}
                            </KeyButton>
                        </div>
                    ))}
                </div>
                <div className="row g-2 mb-2">
                    {buttons.slice(8, 12).map((btn: any) => (
                        <div key={btn.id} className="col-3">
                            <KeyButton onClick={btn.action} className={btn.className} title={btn.title} disabled={btn.disabled} onPressStart={btn.onPressStart} onPressEnd={btn.onPressEnd}>
                                {btn.content}
                            </KeyButton>
                        </div>
                    ))}
                </div>
                <div className="row g-2">
                    <div className="col-3">
                        <KeyButton onClick={handleSaveClick} onPressStart={startSavePress} onPressEnd={cancelSavePress} className="bg-gray-800 text-white" title="Сохранить (тап — скачать файл; удерживайте — сохранить на сервер)">
                            <SaveIcon style={{ width: '1.5rem', height: '1.5rem' }} />
                        </KeyButton>
                    </div>
                    <div className="col-3">
                        <KeyButton onClick={onDone} className="bg-gray-800 text-white" title="Скрыть клавиатуру">
                            <ChevronDownIcon style={{ width: '1.5rem', height: '1.5rem' }} />
                        </KeyButton>
                    </div>
                    <div className="col-3">
                        <KeyButton onClick={() => onKeyPress('0')}>0</KeyButton>
                    </div>
                    <div className="col-3">
                        <KeyButton onClick={onAddNote} disabled={!isCellSelected} className="bg-gray-700" title="Добавить/изменить заметку">
                            <DocumentTextIcon style={{ width: '1.5rem', height: '1.5rem' }} />
                        </KeyButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NumericKeyboard;

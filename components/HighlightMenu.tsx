
import React, { useState, useRef, useEffect } from 'react';
import { ClearIcon, ChevronLeftIcon, ChevronRightIcon, FilterIcon, PlusIcon, TrashIcon } from './Icons';
import { FilterType } from '../types';

interface SearchBarProps {
    searchQuery: string;
    onClear: () => void;
    onFocus: () => void;
    isKeyboardVisible: boolean; // Kept for interface compatibility, though styling handles it now
    searchMatchCount: number;
    currentMatchIndex: number;
    onNavigateMatch: (direction: 'next' | 'prev') => void;
    filter: FilterType;
    setFilter: (filter: FilterType) => void;
    onReset: () => void;
    onDelete?: () => void;
    children?: React.ReactNode;
}

const SearchBar: React.FC<SearchBarProps> = ({
    searchQuery,
    onClear,
    onFocus,
    searchMatchCount,
    currentMatchIndex,
    onNavigateMatch,
    filter,
    setFilter,
    onReset,
    onDelete,
    children
}) => {
    const [isFilterOpen, setFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    const filterOptions: { value: FilterType, label: string }[] = [
        { value: 'all', label: 'Все строки' },
        { value: 'green', label: 'Зеленые' },
        { value: 'red', label: 'Красные' },
        { value: 'none', label: 'Без цвета' },
    ];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setFilterOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="position-fixed start-0 end-0 bottom-0 z-1050 bg-black bg-opacity-75 backdrop-blur border-top border-secondary d-flex flex-column transition-all">
            <div className="d-flex align-items-center gap-2 p-2 mx-auto w-100" style={{ maxWidth: '28rem' }}>
                <div className="position-relative flex-shrink-0" ref={filterRef}>
                    <button
                        onClick={() => setFilterOpen(prev => !prev)}
                        className={`btn p-0 d-flex align-items-center justify-content-center transition-colors border border-secondary ${filter !== 'all' ? 'text-yellow-400 border-yellow-400' : 'text-gray-200 bg-gray-900'}`}
                        style={{ height: '2.5rem', width: '2.5rem' }}
                        title="Фильтр"
                        aria-label="Фильтр строк"
                    >
                        <FilterIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                    </button>
                    {isFilterOpen && (
                        <div className="position-absolute start-0 bottom-100 mb-2 bg-gray-800 border border-secondary rounded shadow-lg z-1050 overflow-hidden" style={{ width: '10rem' }}>
                            {filterOptions.map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        setFilter(option.value);
                                        setFilterOpen(false);
                                    }}
                                    className={`btn btn-link w-100 text-start px-3 py-2 small text-decoration-none border-0 rounded-0 ${filter === option.value ? 'bg-yellow-400 text-black' : 'text-gray-200 bg-transparent hover:bg-gray-700'}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                            <div className="border-top border-secondary"></div>
                            <button
                                onClick={() => {
                                    setFilter('all');
                                    setFilterOpen(false);
                                }}
                                className="btn btn-link w-100 text-start px-3 py-2 small text-decoration-none text-gray-200 bg-transparent hover:bg-gray-700 border-0 rounded-0"
                            >
                                Сбросить фильтр
                            </button>
                        </div>
                    )}
                </div>

                <button
                    onClick={onReset}
                    className="btn p-0 d-flex align-items-center justify-content-center transition-colors border border-secondary text-gray-200 bg-gray-900 flex-shrink-0"
                    style={{ height: '2.5rem', width: '2.5rem' }}
                    title="Новый файл"
                    aria-label="Загрузить новый файл"
                >
                    <PlusIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                </button>

                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="btn p-0 d-flex align-items-center justify-content-center transition-colors border border-secondary text-danger bg-gray-900 flex-shrink-0 hover-bg-red-900"
                        style={{ height: '2.5rem', width: '2.5rem' }}
                        title="Удалить файл"
                        aria-label="Удалить текущий файл"
                    >
                        <TrashIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                    </button>
                )}

                <div className="position-relative flex-grow-1">
                    <input
                        type="text"
                        placeholder="Поиск..."
                        value={searchQuery}
                        readOnly
                        onFocus={onFocus}
                        className={`form-control bg-gray-900 border-secondary text-white cursor-pointer focus-warning ${searchQuery ? 'border-warning' : ''}`}
                        style={{ height: '2.5rem', fontSize: '0.875rem', paddingLeft: '0.75rem', paddingRight: '2.5rem' }}
                        aria-label="Поле поиска, нажмите для ввода"
                    />

                    {searchQuery && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onClear(); }}
                            className="position-absolute top-50 translate-middle-y end-0 d-flex align-items-center pe-3 bg-transparent border-0 text-gray-400"
                            style={{ height: '100%' }}
                            aria-label="Очистить поиск"
                        >
                            <ClearIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                        </button>
                    )}
                </div>
                {searchMatchCount > 0 && (
                    <div className="d-flex align-items-center gap-1 bg-gray-800 border border-secondary rounded px-2 flex-shrink-0" style={{ height: '2.5rem' }}>
                        <span className="small text-gray-300 white-space-nowrap">{currentMatchIndex + 1} / {searchMatchCount}</span>
                        <button onClick={() => onNavigateMatch('prev')} className="btn btn-link p-1 text-gray-200 d-flex align-items-center border-0" disabled={currentMatchIndex <= 0} aria-label="Предыдущее совпадение">
                            <ChevronLeftIcon style={{ width: '1rem', height: '1rem' }} />
                        </button>
                        <button onClick={() => onNavigateMatch('next')} className="btn btn-link p-1 text-gray-200 d-flex align-items-center border-0" disabled={currentMatchIndex >= searchMatchCount - 1} aria-label="Следующее совпадение">
                            <ChevronRightIcon style={{ width: '1rem', height: '1rem' }} />
                        </button>
                    </div>
                )}
            </div>
            {children}
        </div>
    );
};

export default SearchBar;

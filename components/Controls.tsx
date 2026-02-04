
import React, { useState, useRef, useEffect } from 'react';
import { SearchIcon, FilterIcon } from './Icons';
import { FilterType } from '../types';

interface ControlsProps {
    filter: FilterType;
    setFilter: (filter: FilterType) => void;
    onToggleKeyboard: () => void;
}

const Controls: React.FC<ControlsProps> = ({
    filter,
    setFilter,
    onToggleKeyboard
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
        <div className="sticky top-0 z-10 bg-black bg-opacity-75 backdrop-blur p-2 p-sm-3 border-bottom border-secondary">
            <div className="d-flex align-items-center justify-content-end gap-2 w-100">
                <button
                    onClick={onToggleKeyboard}
                    className="btn btn-secondary btn-sm p-2 d-flex align-items-center justify-content-center transition-colors border border-secondary text-gray-200"
                    style={{ height: '2.5rem', width: '2.5rem' }}
                    title="Поиск"
                >
                    <SearchIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                </button>

                <div className="position-relative flex-shrink-0" ref={filterRef}>
                    <button
                        onClick={() => setFilterOpen(prev => !prev)}
                        className={`btn btn-secondary btn-sm p-2 d-flex align-items-center justify-content-center transition-colors border border-secondary ${filter !== 'all' ? 'text-yellow-400 border-yellow-400' : 'text-gray-200'}`}
                        style={{ height: '2.5rem', width: '2.5rem' }}
                        title="Фильтр"
                    >
                        <FilterIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                    </button>
                    {isFilterOpen && (
                        <div className="position-absolute end-0 mt-2 bg-gray-800 border border-secondary rounded shadow-lg z-10 overflow-hidden" style={{ width: '10rem' }}>
                            {filterOptions.map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        setFilter(option.value);
                                        setFilterOpen(false);
                                    }}
                                    className={`btn btn-link w-100 text-end px-3 py-2 small text-decoration-none border-0 rounded-0 ${filter === option.value ? 'bg-yellow-400 text-black' : 'text-gray-200 bg-transparent hover:bg-gray-700'}`}
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
                                className="btn btn-link w-100 text-end px-3 py-2 small text-decoration-none text-gray-200 bg-transparent hover:bg-gray-700 border-0 rounded-0"
                            >
                                Сбросить фильтр
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Controls;
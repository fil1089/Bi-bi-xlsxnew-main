
import React, { useRef, useEffect, useCallback, useLayoutEffect, useState } from 'react';
import { SheetRow, HighlightedCells, CellNotes } from '../types';

interface DataTableProps {
    headers: string[];
    data: { row: SheetRow, originalIndex: number }[];
    searchMatches: number[];
    highlightedCells: HighlightedCells;
    notes: CellNotes;
    onCellClick: (rowIndex: number, colIndex: number) => void;
    onCellSelect: (rowIndex: number, colIndex: number) => void;
    selectedCell: { row: number; col: number; } | null;
    columnWidths: number[];
    onColumnResize: (index: number, newWidth: number) => void;
    highlightedHeaderIndices: Set<number>;
    onHeaderClick: (colIndex: number) => void;
    highlightMode: boolean;
    scrollToRowIndex: number | null;
    isKeyboardVisible: boolean;
}

const REVISION_GROUP_PREFIX = 'Ревизионная группа';

const DataTable: React.FC<DataTableProps> = ({
    headers,
    data,
    searchMatches,
    highlightedCells,
    notes,
    onCellClick,
    onCellSelect,
    selectedCell,
    columnWidths,
    onColumnResize,
    highlightedHeaderIndices,
    onHeaderClick,
    highlightMode,
    scrollToRowIndex,
    isKeyboardVisible,
}) => {
    const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
    const resizingColumnRef = useRef<{ index: number; startX: number; startWidth: number; } | null>(null);
    const headerRef = useRef<HTMLTableSectionElement | null>(null);
    const [headerHeight, setHeaderHeight] = useState(0);

    useLayoutEffect(() => {
        if (headerRef.current) {
            setHeaderHeight(headerRef.current.offsetHeight);
        }
    }, [headers]);

    useEffect(() => {
        rowRefs.current = rowRefs.current.slice(0, data.length);
    }, [data.length]);

    useEffect(() => {
        if (scrollToRowIndex !== null) {
            const targetRow = data.findIndex(d => d.originalIndex === scrollToRowIndex);
            if (targetRow !== -1 && rowRefs.current[targetRow]) {
                rowRefs.current[targetRow]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                });
            }
        }
    }, [scrollToRowIndex, data]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!resizingColumnRef.current) return;
        const { index, startX, startWidth } = resizingColumnRef.current;
        const newWidth = startWidth + (e.clientX - startX);
        onColumnResize(index, Math.max(40, newWidth)); // Enforce a minimum width
    }, [onColumnResize]);

    const handleMouseUp = useCallback(() => {
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
        resizingColumnRef.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const handleResizeStart = (index: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        resizingColumnRef.current = {
            index,
            startX: e.clientX,
            startWidth: columnWidths[index],
        };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const rowStyle = { scrollMarginTop: `${headerHeight}px` };
    const searchMatchesSet = new Set(searchMatches);

    const searchBarHeight = 64;
    // Calculated: Keyboard height 232px + Search bar height ~56px = ~288px
    const keyboardAndSearchBarHeight = 288;
    const paddingBottom = isKeyboardVisible ? keyboardAndSearchBarHeight : searchBarHeight;

    return (
        <div
            className="flex-grow-1 w-100 overflow-auto"
            style={{ paddingBottom: `${paddingBottom}px` }}
        >
            <table className="w-100 border-collapse" style={{ tableLayout: columnWidths.length > 0 ? 'fixed' : 'auto' }}>
                {columnWidths.length > 0 && (
                    <colgroup>
                        {columnWidths.map((width, index) => (
                            <col key={`col-${index}`} style={{ width: `${width}px` }} />
                        ))}
                    </colgroup>
                )}
                <thead ref={headerRef} className="sticky top-0 z-20 bg-gray-900 shadow-sm">
                    <tr>
                        {headers.map((header, index) => {
                            const isRevisionGroupHeader = header.trim().startsWith(REVISION_GROUP_PREFIX);
                            const isHeaderHighlighted = highlightedHeaderIndices.has(index);
                            const isFirstColumn = index === 0;

                            const stickyClass = isFirstColumn ? 'sticky left-0 z-30' : '';
                            const highlightClass = isHeaderHighlighted ? 'bg-red-800' : 'bg-gray-900';
                            const cursorClass = isRevisionGroupHeader ? 'cursor-pointer' : '';

                            return (
                                <th
                                    key={index}
                                    className={`relative p-2 text-start small fw-bold text-gray-300 border-bottom border-end border-secondary whitespace-nowrap group transition-colors ${stickyClass} ${highlightClass}`}
                                >
                                    <div
                                        className={`truncate pe-4 ${cursorClass}`}
                                        onClick={() => onHeaderClick(index)}
                                    >
                                        {header}
                                    </div>
                                    <div
                                        onMouseDown={(e) => handleResizeStart(index, e)}
                                        className="position-absolute top-0 end-0 h-100 cursor-col-resize z-2 w-25"
                                        style={{ right: '-5px', width: '10px' }}
                                    />
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {data.map(({ row, originalIndex }, visualRowIndex) => {
                        const isMatch = searchMatchesSet.has(originalIndex);

                        // Check if the current row should be treated as a full-width subheader
                        const isSubheader = String(row[0] ?? '').trim().startsWith(REVISION_GROUP_PREFIX);

                        const rowRef = (el: HTMLTableRowElement | null) => { rowRefs.current[visualRowIndex] = el; };

                        if (isSubheader) {
                            return (
                                <tr key={`subheader-${originalIndex}`} ref={rowRef} className="bg-gray-800" style={rowStyle}>
                                    <td
                                        colSpan={headers.length}
                                        className="p-2 small fw-bold text-gray-200 border-bottom border-end border-secondary whitespace-nowrap sticky left-0 z-10"
                                    >
                                        {row[0]}
                                    </td>
                                </tr>
                            );
                        }

                        return (
                            <tr key={originalIndex} ref={rowRef} className="transition-colors duration-300" style={rowStyle}>
                                {row.map((cell, colIndex) => {
                                    const cellKey = `${originalIndex}-${colIndex}`;
                                    const highlightColor = highlightedCells[cellKey];
                                    const hasNote = !!notes[cellKey];
                                    const isFirstColumn = colIndex === 0;
                                    const isSelected = !highlightMode && selectedCell?.row === originalIndex && selectedCell?.col === colIndex;

                                    const classNames = ['position-relative p-2 small text-gray-200 border-bottom border-end border-secondary whitespace-nowrap select-none touch-manipulation transition-colors cursor-pointer'];

                                    if (isFirstColumn) {
                                        classNames.push('sticky left-0 z-10');
                                    }

                                    if (highlightColor) {
                                        if (highlightColor === 'green') {
                                            classNames.push('bg-green-800');
                                        } else { // red
                                            classNames.push('bg-red-800');
                                        }
                                    } else if (isMatch) {
                                        classNames.push('bg-yellow-800');
                                    } else {
                                        classNames.push(visualRowIndex % 2 === 0 ? 'bg-gray-900' : 'bg-black');
                                    }

                                    return (
                                        <td
                                            key={colIndex}
                                            onClick={() => {
                                                if (highlightMode) {
                                                    onCellClick(originalIndex, colIndex);
                                                } else {
                                                    onCellSelect(originalIndex, colIndex);
                                                }
                                            }}
                                            className={classNames.join(' ')}
                                            style={{ touchAction: 'manipulation' }}
                                        >
                                            {isSelected && <div className="selection-ring" />}
                                            {hasNote && <div className="position-absolute top-0 end-0 w-0 h-0 border-start-8 border-start-transparent border-top-8 border-top-blue-500" style={{ borderLeft: '8px solid transparent', borderTop: '8px solid #3b82f6' }} title="Есть заметка"></div>}
                                            <div className="truncate" title={String(cell ?? '')}>{String(cell ?? '')}</div>
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default React.memo(DataTable);

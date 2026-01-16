/**
 * DataTable Component - Virtualized table for high-volume telemetry data
 */

import React, { useRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  minWidth?: string;
  flexGrow?: number;
  render: (item: T, index: number) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  selectedId?: string | null;
  rowClassName?: (item: T) => string;
  emptyMessage?: string;
  estimatedRowHeight?: number;
  // Sorting props
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  defaultSortColumn?: string;
  onSort?: (column: string | null, direction: 'asc' | 'desc' | null) => void;
}

// ============================================================================
// Empty State
// ============================================================================

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-64 text-surface-500">
    <svg className="w-12 h-12 mb-4 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
    <p className="text-sm">{message}</p>
    <p className="text-xs text-surface-600 mt-1">
      Send OTLP data to port 4317 to see telemetry
    </p>
  </div>
);

// ============================================================================
// Helper Functions
// ============================================================================

const parseWidth = (width: string | number | undefined, defaultWidth = 100): number => {
  if (typeof width === 'number') return width;
  if (!width) return defaultWidth;
  if (width.endsWith('px')) return parseInt(width, 10);
  return defaultWidth;
};

// ============================================================================
// DataTable Component
// ============================================================================

export function DataTable<T>({
  data,
  columns,
  rowKey,
  onRowClick,
  selectedId,
  rowClassName,
  emptyMessage = 'No data available',
  estimatedRowHeight = 36,
  sortColumn,
  sortDirection,
  defaultSortColumn,
  onSort,
}: DataTableProps<T>): React.ReactElement {
  const parentRef = useRef<HTMLDivElement>(null);

  // Initialize column widths from props
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    columns.forEach(col => {
      if (col.key !== 'spacer') {
        widths[col.key] = parseWidth(col.width || col.minWidth);
      }
    });
    return widths;
  });

  const resizingRef = useRef<{ startX: number; startWidth: number; key: string } | null>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 10,
  });

  const handleRowClick = useCallback((item: T) => {
    if (onRowClick) {
      onRowClick(item);
    }
  }, [onRowClick]);

  const handleHeaderClick = (key: string) => {
    if (!onSort || key === 'spacer') return;

    if (sortColumn === key) {
      if (sortDirection === 'asc') {
        // If it was ASC, always go to DESC
        onSort(key, 'desc');
      } else {
        // If it was DESC, logic depends on if this is the default column
        if (key === defaultSortColumn) {
          // For default column, DESC -> ASC (toggle behavior, never "off")
          onSort(key, 'asc');
        } else {
          // For other columns, DESC -> Default/Off
          onSort(null, null);
        }
      }
    } else {
      // New sort column, default to asc
      onSort(key, 'asc');
    }
  };

  // Resize Handlers
  const startResize = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering sort
    const startWidth = columnWidths[key] || parseWidth(columns.find(c => c.key === key)?.width);
    resizingRef.current = { startX: e.clientX, startWidth, key };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { startX, startWidth, key } = resizingRef.current;
    const diff = e.clientX - startX;
    const newWidth = Math.max(50, startWidth + diff); // Min width 50px

    setColumnWidths((prev: Record<string, number>) => ({
      ...prev,
      [key]: newWidth,
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  if (data.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  // Helper to get effective style for a column
  const getColStyle = (col: Column<T>) => {
    // If it's the spacer, use flexGrow
    if (col.key === 'spacer') {
      return { flexGrow: 1, flexShrink: 1, width: 'auto' };
    }

    // Otherwise use strict pixels based on state or initial prop
    const width = columnWidths[col.key] ?? parseWidth(col.width || col.minWidth);

    return {
      width: `${width}px`,
      minWidth: `${width}px`, // Force it to respect the width
      flexShrink: 0,
      flexGrow: 0,
    };
  };

  return (
    <div className="flex flex-col h-full bg-surface-950 text-surface-200">
      {/* Table Header */}
      <div className="flex-shrink-0 flex items-center bg-surface-900/80 border-b border-surface-700/50">
        {columns.map((col) => {
          const isSorted = sortColumn === col.key;

          return (
            <div
              key={col.key}
              className={`
                relative px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-surface-400 
                ${col.headerClassName || ''} 
                ${col.key !== 'spacer' ? 'cursor-pointer hover:bg-surface-800/50 hover:text-surface-200' : ''}
                group flex items-center gap-1 select-none
              `}
              style={getColStyle(col)}
              onClick={() => handleHeaderClick(col.key)}
            >
              <span className="truncate">{col.header}</span>

              {/* Sort Indicator */}
              {isSorted && (
                <span className="text-phosphor-400 flex-shrink-0">
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
              )}

              {/* Resizer Handle (except for spacer) */}
              {col.key !== 'spacer' && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-phosphor-500/50 group-hover:bg-surface-700 transition-colors z-10"
                  onMouseDown={(e) => startResize(e, col.key)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Table Body - Virtualized */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = data[virtualRow.index];
            const id = rowKey(item);
            const isSelected = selectedId === id;
            const customClass = rowClassName ? rowClassName(item) : '';

            return (
              <div
                key={id}
                role="row"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%', // Allow row to fill container width
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={`flex items-center border-b border-surface-800/50 transition-colors duration-100 
                  ${isSelected ? 'bg-phosphor-900/30' : 'hover:bg-surface-800/40'} 
                  ${customClass} 
                  ${onRowClick ? 'cursor-pointer' : ''}
                `}
                onClick={() => handleRowClick(item)}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    role="cell"
                    className={`px-3 py-1 truncate ${col.cellClassName || ''}`}
                    style={getColStyle(col)}
                  >
                    {col.render(item, virtualRow.index)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

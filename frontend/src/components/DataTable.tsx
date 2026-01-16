/**
 * DataTable Component - Virtualized table for high-volume telemetry data
 */

import React, { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

// ============================================================================
// Types
// ============================================================================

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  minWidth?: string;
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
}: DataTableProps<T>): React.ReactElement {
  const parentRef = useRef<HTMLDivElement>(null);

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

  if (data.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="flex flex-col h-full bg-surface-950 text-surface-200">
      {/* Table Header */}
      <div className="flex-shrink-0 flex items-center bg-surface-900/80 border-b border-surface-700/50">
        {columns.map((col) => (
          <div
            key={col.key}
            className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-surface-400 ${col.headerClassName || ''}`}
            style={{
              width: col.width,
              minWidth: col.minWidth,
              flexShrink: 0,
              flexGrow: 0,
            }}
          >
            {col.header}
          </div>
        ))}
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
                  width: '100%',
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
                    style={{
                      width: col.width,
                      minWidth: col.minWidth,
                      flexShrink: 0,
                      flexGrow: 0,
                    }}
                  >
                    {col.render(item, virtualRow.index)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Table Footer - Stats */}
      <div className="flex-shrink-0 px-3 py-2 bg-surface-900/60 border-t border-surface-800/50">
        <div className="flex items-center justify-between text-xs text-surface-500">
          <span>{data.length.toLocaleString()} items</span>
          <span>Scroll to load more</span>
        </div>
      </div>
    </div>
  );
}

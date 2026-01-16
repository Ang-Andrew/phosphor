/**
 * TraceView Component - Displays trace/span data
 */

import React, { useMemo, useState } from 'react';
import { DataTable, type Column } from './DataTable';
import type { Span, SpanKind, StatusCode } from '../types';

// ============================================================================
// Helper Functions
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const time = date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${time}.${ms}`;
}

function getSpanKindBadge(kind: SpanKind): string {
  const badges: Record<SpanKind, string> = {
    server: 'badge-server',
    client: 'badge-client',
    producer: 'badge-producer',
    consumer: 'badge-consumer',
    internal: 'badge-internal',
    unspecified: 'badge-internal',
  };
  return badges[kind] || 'badge-internal';
}

// ============================================================================
// Props
// ============================================================================

interface TraceViewProps {
  traces: Span[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

// ============================================================================
// TraceRow Component
// ============================================================================

const StatusIndicator: React.FC<{ status: StatusCode }> = ({ status }) => {
  const classes: Record<StatusCode, string> = {
    ok: 'status-dot-ok',
    error: 'status-dot-error',
    unset: 'status-dot-unset',
  };
  return <span className={`status-dot ${classes[status]}`} />;
};

const SpanKindBadge: React.FC<{ kind: SpanKind }> = ({ kind }) => (
  <span className={`badge ${getSpanKindBadge(kind)}`}>
    {kind.toUpperCase()}
  </span>
);

// ============================================================================
// TraceView Component
// ============================================================================

export const TraceView: React.FC<TraceViewProps> = ({
  traces,
  searchQuery,
  onSearchChange,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter traces based on search query
  const filteredTraces = useMemo(() => {
    if (!searchQuery.trim()) return traces;

    const query = searchQuery.toLowerCase();
    return traces.filter(span =>
      span.name.toLowerCase().includes(query) ||
      span.resource.serviceName.toLowerCase().includes(query) ||
      span.traceId.toLowerCase().includes(query) ||
      span.spanId.toLowerCase().includes(query)
    );
  }, [traces, searchQuery]);

  // Reverse to show newest first
  const sortedTraces = useMemo(() =>
    [...filteredTraces].reverse(),
    [filteredTraces]
  );

  const columns: Column<Span>[] = useMemo(() => [
    {
      key: 'status',
      header: '',
      width: '32px',
      render: (span) => (
        <div className="flex justify-center">
          <StatusIndicator status={span.statusCode} />
        </div>
      ),
    },
    {
      key: 'timestamp',
      header: 'Time',
      width: '100px',
      render: (span) => (
        <span className="mono text-surface-400">
          {formatTimestamp(span.startTime)}
        </span>
      ),
    },
    {
      key: 'service',
      header: 'Service',
      width: '140px',
      render: (span) => (
        <span className="font-medium text-phosphor-400 truncate block max-w-[120px]">
          {span.resource.serviceName}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      minWidth: '200px',
      render: (span) => (
        <span className={`font-medium ${span.statusCode === 'error' ? 'text-red-400' : 'text-surface-200'}`}>
          {span.name}
        </span>
      ),
    },
    {
      key: 'kind',
      header: 'Kind',
      width: '100px',
      render: (span) => <SpanKindBadge kind={span.kind} />,
    },
    {
      key: 'duration',
      header: 'Duration',
      width: '90px',
      render: (span) => (
        <span className={`mono tabular-nums ${span.durationMs > 1000 ? 'text-amber-400' :
          span.durationMs > 100 ? 'text-surface-300' :
            'text-surface-400'
          }`}>
          {formatDuration(span.durationMs)}
        </span>
      ),
    },
    {
      key: 'traceId',
      header: 'Trace ID',
      width: '130px',
      render: (span) => (
        <span className="mono text-surface-500 truncate-id block">
          {span.traceId.substring(0, 16)}...
        </span>
      ),
    },
  ], []);

  const getRowClassName = (span: Span): string => {
    if (span.statusCode === 'error') return 'error';
    return '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-4">
          <h2 className="panel-header-title">Traces</h2>
          <span className="text-xs text-surface-500 tabular-nums">
            {filteredTraces.length.toLocaleString()} spans
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search traces..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="input w-64 pl-9"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        <DataTable
          data={sortedTraces}
          columns={columns}
          rowKey={(span) => span.id}
          selectedId={selectedId}
          onRowClick={(span) => setSelectedId(span.id)}
          rowClassName={getRowClassName}
          emptyMessage="No traces received yet"
        />
      </div>
    </div>
  );
};

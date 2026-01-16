/**
 * LogView Component - Displays log records
 */

import React, { useMemo, useState } from 'react';
import { DataTable, type Column } from './DataTable';
import { DetailsDrawer } from './DetailsDrawer';
import type { LogRecord, SeverityLevel } from '../types';
import { parseQuery, matchItem } from '../utils/search';

// ============================================================================
// Helper Functions
// ============================================================================

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

function getSeverityBadge(severity: SeverityLevel): string {
  const badges: Record<SeverityLevel, string> = {
    trace: 'badge-trace',
    debug: 'badge-debug',
    info: 'badge-info',
    warn: 'badge-warn',
    error: 'badge-error',
    fatal: 'badge-fatal',
    unspecified: 'badge-trace',
  };
  return badges[severity] || 'badge-trace';
}

function formatBody(body: unknown): string {
  if (typeof body === 'string') return body;
  if (body === null || body === undefined) return '';
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

// ============================================================================
// Props
// ============================================================================

interface LogViewProps {
  logs: LogRecord[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

// ============================================================================
// Severity Badge Component
// ============================================================================

const SeverityBadge: React.FC<{ severity: SeverityLevel; text?: string }> = ({ severity, text }) => (
  <span className={`badge ${getSeverityBadge(severity)}`}>
    {(text || severity).toUpperCase()}
  </span>
);

// ============================================================================
// LogView Component
// ============================================================================

export const LogView: React.FC<LogViewProps> = ({
  logs,
  searchQuery,
  onSearchChange,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'all'>('all');
  const [sortColumn, setSortColumn] = useState<string>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter logs based on search query and severity
  const filteredLogs = useMemo(() => {
    let filtered = logs;

    if (severityFilter !== 'all') {
      filtered = filtered.filter(log => log.severity === severityFilter);
    }

    if (searchQuery.trim()) {
      const criteria = parseQuery(searchQuery);
      filtered = filtered.filter(log => matchItem(
        log,
        criteria,
        {
          service: (l) => l.resource.serviceName,
          severity: (l) => l.severity,
          level: (l) => l.severity, // alias
          traceid: (l) => l.traceId,
          body: (l) => formatBody(l.body),
          message: (l) => formatBody(l.body), // alias
        },
        (l) => [formatBody(l.body), l.resource.serviceName, l.traceId || '']
      ));
    }

    return filtered;
  }, [logs, searchQuery, severityFilter]);

  // Sort logs
  const sortedLogs = useMemo(() => {
    const sorted = [...filteredLogs];

    sorted.sort((a, b) => {
      let res = 0;
      switch (sortColumn) {
        case 'timestamp':
          res = a.timeUnixNano - b.timeUnixNano;
          break;
        case 'service':
          res = a.resource.serviceName.localeCompare(b.resource.serviceName);
          break;
        case 'severity':
          // Sort by severity logic: fatal > error > warn...
          // Or explicitly by number if available
          res = a.severityNumber - b.severityNumber;
          break;
        case 'body':
          res = formatBody(a.body).localeCompare(formatBody(b.body));
          break;
        default:
          res = 0;
      }
      return sortDirection === 'asc' ? res : -res;
    });

    return sorted;
  }, [filteredLogs, sortColumn, sortDirection]);

  const columns: Column<LogRecord>[] = useMemo(() => [
    {
      key: 'severity',
      header: 'Level',
      width: '80px',
      render: (log) => (
        <SeverityBadge severity={log.severity} text={log.severityText || undefined} />
      ),
    },
    {
      key: 'timestamp',
      header: 'Time',
      width: '100px',
      render: (log) => (
        <span className="mono text-surface-400">
          {formatTimestamp(log.timestamp)}
        </span>
      ),
    },
    {
      key: 'service',
      header: 'Service',
      width: '140px',
      render: (log) => (
        <span className="font-medium text-phosphor-400 truncate block max-w-[120px]">
          {log.resource.serviceName}
        </span>
      ),
    },
    {
      key: 'body',
      header: 'Message',
      minWidth: '300px',
      render: (log) => {
        const body = formatBody(log.body);
        const isError = log.severity === 'error' || log.severity === 'fatal';
        return (
          <span className={`font-mono text-xs ${isError ? 'text-red-400' : 'text-surface-300'} line-clamp-1`}>
            {body}
          </span>
        );
      },
    },
    {
      key: 'spacer',
      header: '',
      flexGrow: 1,
      render: () => null,
    },
  ], []);

  const getRowClassName = (log: LogRecord): string => {
    if (log.severity === 'error' || log.severity === 'fatal') return 'error';
    return '';
  };

  const severityOptions: { value: SeverityLevel | 'all'; label: string }[] = [
    { value: 'all', label: 'All Levels' },
    { value: 'trace', label: 'Trace' },
    { value: 'debug', label: 'Debug' },
    { value: 'info', label: 'Info' },
    { value: 'warn', label: 'Warning' },
    { value: 'error', label: 'Error' },
    { value: 'fatal', label: 'Fatal' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-4">
          <h2 className="panel-header-title">Logs</h2>
          <span className="text-xs text-surface-500 tabular-nums">
            {filteredLogs.length.toLocaleString()} records
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as SeverityLevel | 'all')}
            className="input w-32 text-sm"
          >
            {severityOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="relative">
            <input
              type="text"
              placeholder="Search logs..."
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
          data={sortedLogs}
          columns={columns}
          rowKey={(log) => log.id}
          selectedId={selectedId}
          onRowClick={(log) => setSelectedId(log.id)}
          rowClassName={getRowClassName}
          emptyMessage="No logs received yet"
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          defaultSortColumn="timestamp"
          onSort={(col, dir) => {
            if (col && dir) {
              setSortColumn(col);
              setSortDirection(dir);
            } else {
              setSortColumn('timestamp');
              setSortDirection('desc');
            }
          }}
        />
      </div>
      <DetailsDrawer
        item={logs.find(l => l.id === selectedId) || null}
        onClose={() => setSelectedId(null)}
        type="log"
      />
    </div>
  );
};

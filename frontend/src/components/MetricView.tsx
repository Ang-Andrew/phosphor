/**
 * MetricView Component - Displays metrics data
 */

import React, { useMemo, useState } from 'react';
import { DataTable, type Column } from './DataTable';
import { DetailsDrawer } from './DetailsDrawer';
import type { Metric, MetricType } from '../types';
import { parseQuery, matchItem } from '../utils/search';

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getMetricTypeBadge(type: MetricType): string {
  const badges: Record<MetricType, string> = {
    gauge: 'badge-info',
    sum: 'badge-debug',
    histogram: 'badge-warn',
    summary: 'badge-consumer',
    exponentialHistogram: 'badge-warn',
  };
  return badges[type] || 'badge-internal';
}

function formatMetricValue(metric: Metric): string {
  if (metric.dataPoints.length === 0) return '—';

  const point = metric.dataPoints[metric.dataPoints.length - 1];

  if (point.valueInt64 !== undefined && point.valueInt64 !== null) {
    return point.valueInt64.toLocaleString();
  }
  if (point.valueDouble !== undefined && point.valueDouble !== null) {
    return point.valueDouble.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (point.count !== undefined) {
    return `count: ${point.count.toLocaleString()}`;
  }

  return '—';
}

function getMetricSortValue(metric: Metric): number {
  if (metric.dataPoints.length === 0) return 0;
  const point = metric.dataPoints[metric.dataPoints.length - 1];
  if (point.valueInt64 !== undefined && point.valueInt64 !== null) return point.valueInt64;
  if (point.valueDouble !== undefined && point.valueDouble !== null) return point.valueDouble;
  if (point.count !== undefined) return point.count;
  return 0;
}

// ============================================================================
// Props
// ============================================================================

interface MetricViewProps {
  metrics: Metric[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

// ============================================================================
// Metric Type Badge Component
// ============================================================================

const MetricTypeBadge: React.FC<{ type: MetricType }> = ({ type }) => {
  const displayType = type.replace(/([A-Z])/g, ' $1').trim();
  return (
    <span className={`badge ${getMetricTypeBadge(type)}`}>
      {displayType.toUpperCase()}
    </span>
  );
};

// ============================================================================
// MetricView Component
// ============================================================================

export const MetricView: React.FC<MetricViewProps> = ({
  metrics,
  searchQuery,
  onSearchChange,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<MetricType | 'all'>('all');
  const [sortColumn, setSortColumn] = useState<string>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter metrics based on search query and type
  const filteredMetrics = useMemo(() => {
    let filtered = metrics;

    if (typeFilter !== 'all') {
      filtered = filtered.filter(metric => metric.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const criteria = parseQuery(searchQuery);
      filtered = filtered.filter(metric => matchItem(
        metric,
        criteria,
        {
          service: (m) => m.resource.serviceName,
          name: (m) => m.name,
          type: (m) => m.type,
          unit: (m) => m.unit,
          description: (m) => m.description,
        },
        (m) => [m.name, m.resource.serviceName, m.description || '']
      ));
    }

    return filtered;
  }, [metrics, searchQuery, typeFilter]);

  // Sort metrics
  const sortedMetrics = useMemo(() => {
    const sorted = [...filteredMetrics];

    sorted.sort((a, b) => {
      let res = 0;
      switch (sortColumn) {
        case 'timestamp':
          res = new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
          break;
        case 'service':
          res = a.resource.serviceName.localeCompare(b.resource.serviceName);
          break;
        case 'name':
          res = a.name.localeCompare(b.name);
          break;
        case 'type':
          res = a.type.localeCompare(b.type);
          break;
        case 'value':
          res = getMetricSortValue(a) - getMetricSortValue(b);
          break;
        case 'unit':
          res = (a.unit || '').localeCompare(b.unit || '');
          break;
        case 'points':
          res = a.dataPoints.length - b.dataPoints.length;
          break;
        default:
          res = 0;
      }
      return sortDirection === 'asc' ? res : -res;
    });

    return sorted;
  }, [filteredMetrics, sortColumn, sortDirection]);

  const columns: Column<Metric>[] = useMemo(() => [
    {
      key: 'type',
      header: 'Type',
      width: '110px',
      render: (metric) => <MetricTypeBadge type={metric.type} />,
    },
    {
      key: 'timestamp',
      header: 'Time',
      width: '80px',
      render: (metric) => (
        <span className="mono text-surface-400">
          {formatTimestamp(metric.receivedAt)}
        </span>
      ),
    },
    {
      key: 'service',
      header: 'Service',
      width: '140px',
      render: (metric) => (
        <span className="font-medium text-phosphor-400 truncate block">
          {metric.resource.serviceName}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      minWidth: '350px',
      render: (metric) => (
        <div className="flex flex-col justify-center">
          <span className="font-medium text-surface-200">
            {metric.name}
          </span>
          {metric.description && (
            <span className="text-xs text-surface-500 truncate">
              {metric.description}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Latest Value',
      width: '120px',
      render: (metric) => (
        <span className="mono tabular-nums text-green-400 block truncate">
          {formatMetricValue(metric)}
        </span>
      ),
    },
    {
      key: 'unit',
      header: 'Unit',
      width: '60px',
      render: (metric) => (
        <span className="text-surface-500">
          {metric.unit || '—'}
        </span>
      ),
    },
    {
      key: 'points',
      header: 'Points',
      width: '60px',
      render: (metric) => (
        <span className="mono text-surface-500">
          {metric.dataPoints.length}
        </span>
      ),
    },
    {
      key: 'spacer',
      header: '',
      flexGrow: 1,
      render: () => null,
    },
  ], []);

  const typeOptions: { value: MetricType | 'all'; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'gauge', label: 'Gauge' },
    { value: 'sum', label: 'Sum' },
    { value: 'histogram', label: 'Histogram' },
    { value: 'summary', label: 'Summary' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-4">
          <h2 className="panel-header-title">Metrics</h2>
          <span className="text-xs text-surface-500 tabular-nums">
            {filteredMetrics.length.toLocaleString()} metrics
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as MetricType | 'all')}
            className="input w-32 text-sm"
          >
            {typeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="relative">
            <input
              type="text"
              placeholder="Search metrics..."
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
          data={sortedMetrics}
          columns={columns}
          rowKey={(metric) => metric.id}
          selectedId={selectedId}
          onRowClick={(metric) => setSelectedId(metric.id)}
          emptyMessage="No metrics received yet"
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
        item={metrics.find(m => m.id === selectedId) || null}
        onClose={() => setSelectedId(null)}
        type="metric"
      />
    </div>
  );
};

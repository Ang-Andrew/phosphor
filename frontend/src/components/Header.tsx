/**
 * Header Component - Top toolbar with controls
 */

import React from 'react';
import type { TelemetryStats } from '../types';

// ============================================================================
// Props
// ============================================================================

interface HeaderProps {
  stats: TelemetryStats;
  isStreaming: boolean;
  onRefresh: () => void;
  onClear: () => void;
  isLoading: boolean;
  lastUpdate: Date | null;
}

// ============================================================================
// Icons
// ============================================================================

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

// ============================================================================
// Header Component
// ============================================================================

export const Header: React.FC<HeaderProps> = ({
  stats,
  isStreaming,
  onRefresh,
  onClear,
  isLoading,
  lastUpdate,
}) => {
  const formatLastUpdate = (date: Date | null): string => {
    if (!date) return 'Never';
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const totalCount = stats.traceCount + stats.metricCount + stats.logCount;

  return (
    <header className="flex items-center justify-between h-12 px-4 bg-surface-900/50 border-b border-surface-800/50">
      {/* Left - Status */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`status-dot ${isStreaming ? 'status-dot-ok animate-pulse-subtle' : 'status-dot-unset'}`} />
            <span className="text-sm text-surface-300">
              {isStreaming ? 'Live' : 'Paused'}
            </span>
          </div>
          <div className="w-px h-4 bg-surface-700" />
          <span className="text-xs text-surface-500">
            Last update: <span className="text-surface-400">{formatLastUpdate(lastUpdate)}</span>
          </span>
        </div>
      </div>

      {/* Center - Stats */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-surface-500">Total:</span>
          <span className="font-medium text-surface-300 tabular-nums">
            {totalCount.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-phosphor-500" />
            <span className="text-surface-400">{stats.traceCount.toLocaleString()} traces</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-surface-400">{stats.metricCount.toLocaleString()} metrics</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-surface-400">{stats.logCount.toLocaleString()} logs</span>
          </div>
        </div>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="btn btn-ghost btn-icon"
          title="Refresh data"
        >
          <RefreshIcon className={isLoading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={onClear}
          disabled={totalCount === 0}
          className="btn btn-ghost btn-icon text-red-400 hover:text-red-300 hover:bg-red-900/30"
          title="Clear all data"
        >
          <TrashIcon />
        </button>
      </div>
    </header>
  );
};

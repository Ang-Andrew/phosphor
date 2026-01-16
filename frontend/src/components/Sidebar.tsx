/**
 * Sidebar Component - Navigation for Traces, Metrics, and Logs
 */

import React from 'react';
import type { TabType, TelemetryStats } from '../types';

// ============================================================================
// Icons
// ============================================================================

const TraceIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const MetricIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

const LogIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

const PhosphorLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="28" height="28" viewBox="0 0 32 32" fill="none">
    <defs>
      <linearGradient id="phosphor-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0ea5e9" />
        <stop offset="100%" stopColor="#7dd3fc" />
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="14" stroke="url(#phosphor-gradient)" strokeWidth="2" fill="none" />
    <path d="M10 16 L14 12 L18 16 L22 10" stroke="url(#phosphor-gradient)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="10" cy="16" r="2" fill="#0ea5e9" />
    <circle cx="14" cy="12" r="2" fill="#38bdf8" />
    <circle cx="18" cy="16" r="2" fill="#38bdf8" />
    <circle cx="22" cy="10" r="2" fill="#7dd3fc" />
  </svg>
);

// ============================================================================
// Props
// ============================================================================

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  stats: TelemetryStats;
  isStreaming: boolean;
  onToggleStreaming: () => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  usage: number;
  isActive: boolean;
  onClick: () => void;
}

// ============================================================================
// NavItem Component
// ============================================================================

const NavItem: React.FC<NavItemProps> = ({
  icon,
  label,
  count,
  usage,
  isActive,
  onClick,
}) => {
  const usagePercent = Math.round(usage * 100);
  const isNearCapacity = usagePercent >= 80;

  return (
    <button
      onClick={onClick}
      className={`sidebar-item w-full group ${isActive ? 'active' : ''}`}
    >
      <span className={isActive ? 'text-phosphor-400' : 'text-surface-500 group-hover:text-surface-300'}>
        {icon}
      </span>
      <div className="flex-1 text-left">
        <div className="flex items-center justify-between">
          <span className={isActive ? 'text-phosphor-100' : 'text-surface-300'}>
            {label}
          </span>
          <span className={`text-xs tabular-nums ${isNearCapacity ? 'text-amber-400' : 'text-surface-500'}`}>
            {count.toLocaleString()}
          </span>
        </div>
        <div className="usage-bar mt-1.5">
          <div
            className={`usage-bar-fill ${isNearCapacity
                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                : 'bg-gradient-to-r from-phosphor-600 to-phosphor-400'
              }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>
    </button>
  );
};

// ============================================================================
// Sidebar Component
// ============================================================================

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  stats,
  isStreaming,
  onToggleStreaming,
}) => {
  return (
    <aside className="w-56 h-full flex flex-col bg-surface-900/30 border-r border-surface-800/50">
      {/* Logo Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-surface-800/50">
        <PhosphorLogo />
        <div>
          <h1 className="text-lg font-bold text-surface-100">Phosphor</h1>
          <p className="text-xxs text-surface-500 uppercase tracking-wider">OpenTelemetry Viewer</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        <NavItem
          icon={<TraceIcon />}
          label="Traces"
          count={stats.traceCount}
          usage={stats.traceUsage}
          isActive={activeTab === 'traces'}
          onClick={() => onTabChange('traces')}
        />
        <NavItem
          icon={<MetricIcon />}
          label="Metrics"
          count={stats.metricCount}
          usage={stats.metricUsage}
          isActive={activeTab === 'metrics'}
          onClick={() => onTabChange('metrics')}
        />
        <NavItem
          icon={<LogIcon />}
          label="Logs"
          count={stats.logCount}
          usage={stats.logUsage}
          isActive={activeTab === 'logs'}
          onClick={() => onTabChange('logs')}
        />
      </nav>

      {/* Streaming Status */}
      <div className="p-3 border-t border-surface-800/50">
        <button
          onClick={onToggleStreaming}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${isStreaming
              ? 'bg-green-900/30 text-green-400 border border-green-800/50 hover:bg-green-900/50'
              : 'bg-surface-800/50 text-surface-400 border border-surface-700/50 hover:bg-surface-800'
            }`}
        >
          <span className={`status-dot ${isStreaming ? 'status-dot-ok animate-pulse-subtle' : 'status-dot-unset'}`} />
          {isStreaming ? 'Streaming' : 'Paused'}
        </button>

        <div className="mt-3 px-1">
          <div className="flex items-center justify-between text-xxs">
            <span className="text-surface-500">Port</span>
            <span className="font-mono text-surface-400">:4317</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

/**
 * Main App Component - Root application layout
 */

import React, { useState } from 'react';
import { useTelemetry } from './hooks';
import { Sidebar, Header, TraceView, LogView, MetricView } from './components';
import type { TabType } from './types';

// ============================================================================
// App Component
// ============================================================================

export const App: React.FC = () => {
  const [state, actions] = useTelemetry();
  const [activeTab, setActiveTab] = useState<TabType>('traces');
  const [searchQueries, setSearchQueries] = useState({
    traces: '',
    metrics: '',
    logs: '',
  });

  const handleSearchChange = (tab: TabType, query: string) => {
    setSearchQueries(prev => ({ ...prev, [tab]: query }));
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'traces':
        return (
          <TraceView
            traces={state.traces}
            searchQuery={searchQueries.traces}
            onSearchChange={(query) => handleSearchChange('traces', query)}
          />
        );
      case 'metrics':
        return (
          <MetricView
            metrics={state.metrics}
            searchQuery={searchQueries.metrics}
            onSearchChange={(query) => handleSearchChange('metrics', query)}
          />
        );
      case 'logs':
        return (
          <LogView
            logs={state.logs}
            searchQuery={searchQueries.logs}
            onSearchChange={(query) => handleSearchChange('logs', query)}
          />
        );
      default:
        return null;
    }
  };

  // Loading state
  if (state.isLoading && state.traces.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-phosphor-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-surface-400 text-sm">Loading Phosphor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-950">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-200 mb-2">Connection Error</h2>
            <p className="text-surface-400 text-sm">{state.error}</p>
          </div>
          <button
            onClick={actions.refresh}
            className="btn btn-primary"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-surface-950">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        stats={state.stats}
        isStreaming={state.isStreaming}
        onToggleStreaming={actions.toggleStreaming}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header
          stats={state.stats}
          isStreaming={state.isStreaming}
          onRefresh={actions.refresh}
          onClear={actions.clearAll}
          isLoading={state.isLoading}
          lastUpdate={state.lastUpdate}
        />

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full panel m-4 overflow-hidden">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

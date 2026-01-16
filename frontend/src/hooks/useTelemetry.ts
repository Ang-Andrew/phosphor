/**
 * useTelemetry hook - Manages telemetry data state and real-time streaming.
 * This is the primary hook for consuming telemetry data in the application.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  Span,
  Metric,
  LogRecord,
  TelemetryStats,
  TelemetryEvent,
} from '../types/telemetry';
import { getApp, getRuntime, isWailsContext } from '../types/wails';

// ============================================================================
// Configuration
// ============================================================================

const MAX_BUFFER_SIZE = 1000;
const REFRESH_INTERVAL_MS = 5000;

// ============================================================================
// Hook State Types
// ============================================================================

export interface TelemetryState {
  traces: Span[];
  metrics: Metric[];
  logs: LogRecord[];
  stats: TelemetryStats;
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

export interface TelemetryActions {
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
  toggleStreaming: () => Promise<void>;
  refresh: () => Promise<void>;
  clearAll: () => Promise<void>;
  getTraceById: (id: string) => Span | undefined;
  getLogById: (id: string) => LogRecord | undefined;
  getMetricById: (id: string) => Metric | undefined;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useTelemetry(): [TelemetryState, TelemetryActions] {
  const [state, setState] = useState<TelemetryState>({
    traces: [],
    metrics: [],
    logs: [],
    stats: {
      traceCount: 0,
      metricCount: 0,
      logCount: 0,
      traceCapacity: 1000,
      metricCapacity: 1000,
      logCapacity: 1000,
      traceUsage: 0,
      metricUsage: 0,
      logUsage: 0,
    },
    isStreaming: false,
    isLoading: true,
    error: null,
    lastUpdate: null,
  });

  const tracesRef = useRef<Map<string, Span>>(new Map());
  const metricsRef = useRef<Map<string, Metric>>(new Map());
  const logsRef = useRef<Map<string, LogRecord>>(new Map());

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchInitialData = useCallback(async () => {
    if (!isWailsContext()) {
      // Mock data for development outside Wails
      setState(prev => ({
        ...prev,
        isLoading: false,
        lastUpdate: new Date(),
      }));
      return;
    }

    try {
      const app = getApp();
      const [batch, stats, streaming] = await Promise.all([
        app.GetAllTelemetry(),
        app.GetStats(),
        app.IsStreaming(),
      ]);

      // Populate refs
      tracesRef.current.clear();
      metricsRef.current.clear();
      logsRef.current.clear();

      batch.spans?.forEach(span => tracesRef.current.set(span.id, span));
      batch.metrics?.forEach(metric => metricsRef.current.set(metric.id, metric));
      batch.logs?.forEach(log => logsRef.current.set(log.id, log));

      setState(prev => ({
        ...prev,
        traces: batch.spans || [],
        metrics: batch.metrics || [],
        logs: batch.logs || [],
        stats,
        isStreaming: streaming,
        isLoading: false,
        error: null,
        lastUpdate: new Date(),
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load telemetry data',
      }));
    }
  }, []);

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    await fetchInitialData();
  }, [fetchInitialData]);

  // ============================================================================
  // Streaming Control
  // ============================================================================

  const startStreaming = useCallback(async () => {
    if (!isWailsContext()) return;

    try {
      await getApp().StartStreaming();
      setState(prev => ({ ...prev, isStreaming: true }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to start streaming',
      }));
    }
  }, []);

  const stopStreaming = useCallback(async () => {
    if (!isWailsContext()) return;

    try {
      await getApp().StopStreaming();
      setState(prev => ({ ...prev, isStreaming: false }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to stop streaming',
      }));
    }
  }, []);

  const toggleStreaming = useCallback(async () => {
    if (state.isStreaming) {
      await stopStreaming();
    } else {
      await startStreaming();
    }
  }, [state.isStreaming, startStreaming, stopStreaming]);

  const clearAll = useCallback(async () => {
    if (!isWailsContext()) return;

    try {
      await getApp().ClearAll();
      tracesRef.current.clear();
      metricsRef.current.clear();
      logsRef.current.clear();

      setState(prev => ({
        ...prev,
        traces: [],
        metrics: [],
        logs: [],
        stats: {
          ...prev.stats,
          traceCount: 0,
          metricCount: 0,
          logCount: 0,
          traceUsage: 0,
          metricUsage: 0,
          logUsage: 0,
        },
        lastUpdate: new Date(),
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to clear data',
      }));
    }
  }, []);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleTelemetryEvent = useCallback((event: TelemetryEvent) => {
    setState(prev => {
      const newState = { ...prev, lastUpdate: new Date() };

      switch (event.type) {
        case 'trace':
          if (event.span) {
            tracesRef.current.set(event.span.id, event.span);

            // Maintain buffer size limit
            if (tracesRef.current.size > MAX_BUFFER_SIZE) {
              const firstKey = tracesRef.current.keys().next().value;
              if (firstKey) tracesRef.current.delete(firstKey);
            }

            newState.traces = Array.from(tracesRef.current.values());
            newState.stats = {
              ...prev.stats,
              traceCount: tracesRef.current.size,
              traceUsage: tracesRef.current.size / prev.stats.traceCapacity,
            };
          }
          break;

        case 'metric':
          if (event.metric) {
            metricsRef.current.set(event.metric.id, event.metric);

            if (metricsRef.current.size > MAX_BUFFER_SIZE) {
              const firstKey = metricsRef.current.keys().next().value;
              if (firstKey) metricsRef.current.delete(firstKey);
            }

            newState.metrics = Array.from(metricsRef.current.values());
            newState.stats = {
              ...prev.stats,
              metricCount: metricsRef.current.size,
              metricUsage: metricsRef.current.size / prev.stats.metricCapacity,
            };
          }
          break;

        case 'log':
          if (event.log) {
            logsRef.current.set(event.log.id, event.log);

            if (logsRef.current.size > MAX_BUFFER_SIZE) {
              const firstKey = logsRef.current.keys().next().value;
              if (firstKey) logsRef.current.delete(firstKey);
            }

            newState.logs = Array.from(logsRef.current.values());
            newState.stats = {
              ...prev.stats,
              logCount: logsRef.current.size,
              logUsage: logsRef.current.size / prev.stats.logCapacity,
            };
          }
          break;
      }

      return newState;
    });
  }, []);

  const handleClearEvent = useCallback(() => {
    tracesRef.current.clear();
    metricsRef.current.clear();
    logsRef.current.clear();

    setState(prev => ({
      ...prev,
      traces: [],
      metrics: [],
      logs: [],
      stats: {
        ...prev.stats,
        traceCount: 0,
        metricCount: 0,
        logCount: 0,
        traceUsage: 0,
        metricUsage: 0,
        logUsage: 0,
      },
      lastUpdate: new Date(),
    }));
  }, []);

  // ============================================================================
  // Lookup Helpers
  // ============================================================================

  const getTraceById = useCallback((id: string): Span | undefined => {
    return tracesRef.current.get(id);
  }, []);

  const getLogById = useCallback((id: string): LogRecord | undefined => {
    return logsRef.current.get(id);
  }, []);

  const getMetricById = useCallback((id: string): Metric | undefined => {
    return metricsRef.current.get(id);
  }, []);

  // ============================================================================
  // Effects
  // ============================================================================

  // Initial data load
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Event subscription
  useEffect(() => {
    if (!isWailsContext()) return;

    const runtime = getRuntime();

    const unsubEvent = runtime.EventsOn('telemetry:event', (data) => {
      handleTelemetryEvent(data as TelemetryEvent);
    });

    const unsubClear = runtime.EventsOn('telemetry:cleared', () => {
      handleClearEvent();
    });

    return () => {
      unsubEvent();
      unsubClear();
    };
  }, [handleTelemetryEvent, handleClearEvent]);

  // Periodic stats refresh when not streaming
  useEffect(() => {
    if (state.isStreaming || !isWailsContext()) return;

    const interval = setInterval(async () => {
      try {
        const stats = await getApp().GetStats();
        setState(prev => ({ ...prev, stats }));
      } catch {
        // Silently ignore periodic refresh errors
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [state.isStreaming]);

  // ============================================================================
  // Return
  // ============================================================================

  const actions: TelemetryActions = {
    startStreaming,
    stopStreaming,
    toggleStreaming,
    refresh,
    clearAll,
    getTraceById,
    getLogById,
    getMetricById,
  };

  return [state, actions];
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook for filtering traces based on search criteria
 */
export function useFilteredTraces(
  traces: Span[],
  filters: {
    searchQuery?: string;
    serviceName?: string;
    statusCode?: string;
    spanKind?: string;
  }
): Span[] {
  return traces.filter(span => {
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesName = span.name.toLowerCase().includes(query);
      const matchesService = span.resource.serviceName.toLowerCase().includes(query);
      const matchesTraceId = span.traceId.toLowerCase().includes(query);
      if (!matchesName && !matchesService && !matchesTraceId) return false;
    }

    if (filters.serviceName && span.resource.serviceName !== filters.serviceName) {
      return false;
    }

    if (filters.statusCode && span.statusCode !== filters.statusCode) {
      return false;
    }

    if (filters.spanKind && span.kind !== filters.spanKind) {
      return false;
    }

    return true;
  });
}

/**
 * Hook for filtering logs based on search criteria
 */
export function useFilteredLogs(
  logs: LogRecord[],
  filters: {
    searchQuery?: string;
    serviceName?: string;
    severity?: string;
  }
): LogRecord[] {
  return logs.filter(log => {
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const body = typeof log.body === 'string' ? log.body : JSON.stringify(log.body);
      const matchesBody = body.toLowerCase().includes(query);
      const matchesService = log.resource.serviceName.toLowerCase().includes(query);
      if (!matchesBody && !matchesService) return false;
    }

    if (filters.serviceName && log.resource.serviceName !== filters.serviceName) {
      return false;
    }

    if (filters.severity && log.severity !== filters.severity) {
      return false;
    }

    return true;
  });
}

/**
 * Hook for filtering metrics based on search criteria
 */
export function useFilteredMetrics(
  metrics: Metric[],
  filters: {
    searchQuery?: string;
    serviceName?: string;
    metricType?: string;
  }
): Metric[] {
  return metrics.filter(metric => {
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesName = metric.name.toLowerCase().includes(query);
      const matchesService = metric.resource.serviceName.toLowerCase().includes(query);
      if (!matchesName && !matchesService) return false;
    }

    if (filters.serviceName && metric.resource.serviceName !== filters.serviceName) {
      return false;
    }

    if (filters.metricType && metric.type !== filters.metricType) {
      return false;
    }

    return true;
  });
}

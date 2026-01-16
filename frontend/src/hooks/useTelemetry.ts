/**
 * useTelemetry Hook
 * Manages the application state for traces, metrics, logs, and statistics.
 * Handles real-time updates from Wails backend and maintains ring buffers.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  Span,
  Metric,
  LogRecord,
  TelemetryStats,
  TelemetryBatch,
  TelemetryEvent,
  SeverityLevel,
} from '../types/telemetry';
import { getApp, getRuntime, isWailsContext } from '../types/wails';

// ============================================================================
// Types
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
  startStreaming: () => void;
  stopStreaming: () => void;
  toggleStreaming: () => void;
  refresh: () => void;
  clearAll: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_BUFFER_SIZE = 1000;

const INITIAL_STATS: TelemetryStats = {
  traceCount: 0,
  metricCount: 0,
  logCount: 0,
  traceCapacity: MAX_BUFFER_SIZE,
  metricCapacity: MAX_BUFFER_SIZE,
  logCapacity: MAX_BUFFER_SIZE,
  traceUsage: 0,
  metricUsage: 0,
  logUsage: 0,
};

const INITIAL_STATE: TelemetryState = {
  traces: [],
  metrics: [],
  logs: [],
  stats: INITIAL_STATS,
  isStreaming: false,
  isLoading: true,
  error: null,
  lastUpdate: null,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useTelemetry(): [TelemetryState, TelemetryActions] {
  const [state, setState] = useState<TelemetryState>(INITIAL_STATE);

  // Use generic refs to avoid strict map typing issues during rapid updates
  const tracesRef = useRef<Map<string, Span>>(new Map());
  const metricsRef = useRef<Map<string, Metric>>(new Map());
  const logsRef = useRef<Map<string, LogRecord>>(new Map());

  // Data processing helper
  const processBatch = useCallback((batch: TelemetryBatch) => {
    const now = new Date();

    // Process Traces
    if (batch.spans && batch.spans.length > 0) {
      batch.spans.forEach(span => {
        tracesRef.current.set(span.id, span);
        // Maintain buffer size
        if (tracesRef.current.size > MAX_BUFFER_SIZE) {
          const firstKey = tracesRef.current.keys().next().value;
          if (firstKey) tracesRef.current.delete(firstKey);
        }
      });
    }

    // Process Metrics
    if (batch.metrics && batch.metrics.length > 0) {
      batch.metrics.forEach(metric => {
        metricsRef.current.set(metric.id, metric);
        if (metricsRef.current.size > MAX_BUFFER_SIZE) {
          const firstKey = metricsRef.current.keys().next().value;
          if (firstKey) metricsRef.current.delete(firstKey);
        }
      });
    }

    // Process Logs
    if (batch.logs && batch.logs.length > 0) {
      batch.logs.forEach(log => {
        logsRef.current.set(log.id, log);
        if (logsRef.current.size > MAX_BUFFER_SIZE) {
          const firstKey = logsRef.current.keys().next().value;
          if (firstKey) logsRef.current.delete(firstKey);
        }
      });
    }

    // Update state efficiently
    const traceArr = Array.from(tracesRef.current.values());
    const metricArr = Array.from(metricsRef.current.values());
    const logArr = Array.from(logsRef.current.values());

    setState(prev => ({
      ...prev,
      traces: traceArr,
      metrics: metricArr,
      logs: logArr,
      stats: {
        traceCount: tracesRef.current.size,
        metricCount: metricsRef.current.size,
        logCount: logsRef.current.size,
        traceCapacity: MAX_BUFFER_SIZE,
        metricCapacity: MAX_BUFFER_SIZE,
        logCapacity: MAX_BUFFER_SIZE,
        traceUsage: tracesRef.current.size / MAX_BUFFER_SIZE,
        metricUsage: metricsRef.current.size / MAX_BUFFER_SIZE,
        logUsage: logsRef.current.size / MAX_BUFFER_SIZE,
      },
      lastUpdate: now,
    }));
  }, []);

  // Synthetic Data Generator for Browser Dev
  useEffect(() => {
    if (isWailsContext()) return;

    console.log("Running in browser mode - generating synthetic data");
    setState(prev => ({ ...prev, isLoading: false, isStreaming: true }));

    const generateID = () => Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

    const generateSyntheticData = () => {
      const now = new Date();
      const timeStr = now.toISOString();
      const timeNano = now.getTime() * 1000000;

      const services = ['order-service', 'payment-service', 'user-service', 'inventory-service'];
      const methods = ['GET', 'POST', 'PUT', 'DELETE'];
      const paths = ['/api/v1/orders', '/api/v1/users', '/api/v1/inventory', '/health'];

      const newSpans: Span[] = [];
      const newLogs: LogRecord[] = [];
      const newMetrics: Metric[] = [];

      // Generate Spans
      if (Math.random() > 0.3) {
        const service = services[Math.floor(Math.random() * services.length)];
        const method = methods[Math.floor(Math.random() * methods.length)];
        const path = paths[Math.floor(Math.random() * paths.length)];
        const isError = Math.random() > 0.9;

        newSpans.push({
          id: generateID(),
          traceId: generateID() + generateID(),
          spanId: generateID().substring(0, 16),
          name: `${method} ${path}`,
          kind: Math.random() > 0.5 ? 'server' : 'client',
          statusCode: isError ? 'error' : 'ok',
          startTimeUnixNano: timeNano,
          endTimeUnixNano: timeNano + (Math.random() * 500 * 1000000),
          startTime: timeStr,
          endTime: new Date(now.getTime() + Math.random() * 500).toISOString(),
          durationMs: Math.random() * 500,
          resource: { serviceName: service, attributes: [] },
          instrumentationScope: { name: 'synthetic-gen', version: '1.0' },
          receivedAt: timeStr,
          attributes: [{ key: 'http.status_code', value: isError ? 500 : 200, type: 'int' }]
        });
      }

      // Generate Logs
      if (Math.random() > 0.4) {
        const service = services[Math.floor(Math.random() * services.length)];
        const severities: SeverityLevel[] = ['info', 'info', 'warn', 'error'];
        const severity = severities[Math.floor(Math.random() * severities.length)];

        newLogs.push({
          id: generateID(),
          timeUnixNano: timeNano,
          observedTimeUnixNano: timeNano,
          timestamp: timeStr,
          observedTime: timeStr,
          body: `Processed request for ${service} - ${generateID()}`,
          severityNumber: severity === 'error' ? 17 : severity === 'warn' ? 13 : 9,
          severityText: severity.toUpperCase(),
          severity: severity,
          resource: { serviceName: service, attributes: [] },
          instrumentationScope: { name: 'synthetic-gen', version: '1.0' },
          receivedAt: timeStr
        });
      }

      // Generate Metrics
      if (Math.random() > 0.7) {
        const service = services[Math.floor(Math.random() * services.length)];
        newMetrics.push({
          id: generateID(),
          name: 'http.server.duration',
          description: 'Duration of HTTP requests',
          unit: 'ms',
          type: 'histogram',
          dataPoints: [{
            timeUnixNano: timeNano,
            timestamp: timeStr,
            valueDouble: Math.random() * 200,
            attributes: []
          }],
          resource: { serviceName: service, attributes: [] },
          instrumentationScope: { name: 'synthetic-gen', version: '1.0' },
          receivedAt: timeStr
        });
      }

      processBatch({ spans: newSpans, logs: newLogs, metrics: newMetrics });
    };

    const interval = setInterval(generateSyntheticData, 800);
    return () => clearInterval(interval);
  }, [processBatch]);

  // Initial load or refresh (Wails only)
  useEffect(() => {
    if (!isWailsContext()) return;

    // Use proper helper, not setState directly if possible, but here we need to set loading
    setState(prev => ({ ...prev, isLoading: true }));

    getApp().GetStats()
      .then((stats) => {
        setState(prev => ({ ...prev, stats, isLoading: false }));
        return getApp().IsStreaming();
      })
      .then((isStreaming) => {
        setState(prev => ({ ...prev, isStreaming }));
        if (isStreaming) {
          // If already streaming, fetch latest data
          getApp().GetAllTelemetry()
            .then((data) => processBatch(data))
            .catch(console.error);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch initial telemetry:", err);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: "Failed to connect to backend. Is Phosphor running?"
        }));
      });

    // Listen for real-time events
    const unsubscribe = getRuntime().EventsOn("telemetry", (data: unknown) => {
      // Type assertion safe here as we control the backend emission
      const event = data as TelemetryEvent;
      const batch: TelemetryBatch = {};

      if (event.type === 'trace' && event.span) {
        batch.spans = [event.span];
      } else if (event.type === 'metric' && event.metric) {
        batch.metrics = [event.metric];
      } else if (event.type === 'log' && event.log) {
        batch.logs = [event.log];
      }
      processBatch(batch);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [processBatch]);

  const startStreaming = useCallback(async () => {
    if (!isWailsContext()) {
      setState(prev => ({ ...prev, isStreaming: true }));
      return;
    }
    try {
      await getApp().StartStreaming();
      setState(prev => ({ ...prev, isStreaming: true }));
    } catch (err) {
      console.error("Failed to start streaming:", err);
    }
  }, []);

  const stopStreaming = useCallback(async () => {
    if (!isWailsContext()) {
      setState(prev => ({ ...prev, isStreaming: false }));
      return;
    }
    try {
      await getApp().StopStreaming();
      setState(prev => ({ ...prev, isStreaming: false }));
    } catch (err) {
      console.error("Failed to stop streaming:", err);
    }
  }, []);

  const toggleStreaming = useCallback(() => {
    if (state.isStreaming) {
      stopStreaming();
    } else {
      startStreaming();
    }
  }, [state.isStreaming, startStreaming, stopStreaming]);

  const refresh = useCallback(async () => {
    if (!isWailsContext()) return;
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const [stats, batch] = await Promise.all([
        getApp().GetStats(),
        getApp().GetAllTelemetry(),
      ]);
      processBatch(batch);
      setState(prev => ({ ...prev, stats, isLoading: false }));
    } catch (err) {
      console.error("Failed to refresh:", err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: "Failed to refresh data"
      }));
    }
  }, [processBatch]);

  const clearAll = useCallback(async () => {
    // Clear local state
    tracesRef.current.clear();
    metricsRef.current.clear();
    logsRef.current.clear();

    setState(prev => ({
      ...prev,
      traces: [],
      metrics: [],
      logs: [],
      stats: INITIAL_STATS,
    }));

    if (isWailsContext()) {
      try {
        await getApp().ClearAll();
      } catch (err) {
        console.error("Failed to clear backend data:", err);
      }
    }
  }, []);

  return [state, {
    startStreaming,
    stopStreaming,
    toggleStreaming,
    refresh,
    clearAll,
  }];
}

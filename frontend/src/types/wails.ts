/**
 * Wails runtime type declarations for TypeScript.
 * These provide type-safe bindings to the Go backend.
 */

import type {
  Span,
  Metric,
  LogRecord,
  TelemetryStats,
  TelemetryBatch,
} from './telemetry';

// ============================================================================
// Wails Backend Bindings
// ============================================================================

/**
 * App represents the Wails-bound methods from the Go backend.
 * These map directly to the methods in internal/bridge/app.go
 */
export interface AppBindings {
  // Trace methods
  GetTraces(): Promise<Span[]>;
  GetRecentTraces(count: number): Promise<Span[]>;

  // Metric methods
  GetMetrics(): Promise<Metric[]>;
  GetRecentMetrics(count: number): Promise<Metric[]>;

  // Log methods
  GetLogs(): Promise<LogRecord[]>;
  GetRecentLogs(count: number): Promise<LogRecord[]>;

  // Stats methods
  GetStats(): Promise<TelemetryStats>;

  // Control methods
  StartStreaming(): Promise<void>;
  StopStreaming(): Promise<void>;
  IsStreaming(): Promise<boolean>;
  ClearAll(): Promise<void>;

  // Batch methods
  GetAllTelemetry(): Promise<TelemetryBatch>;
}

// ============================================================================
// Wails Runtime Types
// ============================================================================

export interface WailsRuntime {
  EventsOn(eventName: string, callback: (data: unknown) => void): () => void;
  EventsOff(eventName: string): void;
  EventsEmit(eventName: string, data?: unknown): void;
}

// ============================================================================
// Event Types
// ============================================================================

export type TelemetryEventName = 'telemetry:event' | 'telemetry:cleared';

// ============================================================================
// Window Extensions
// ============================================================================

declare global {
  interface Window {
    go: {
      'github.com/phosphor-project/phosphor/internal/bridge': {
        App: AppBindings;
      };
    };
    runtime: WailsRuntime;
  }
}

// ============================================================================
// Type-safe API accessor
// ============================================================================

/**
 * Get the Wails backend bindings with proper typing.
 * Throws if not running in Wails context.
 */
export function getApp(): AppBindings {
  if (typeof window === 'undefined' || !window.go) {
    throw new Error('Not running in Wails context');
  }
  return window.go['github.com/phosphor-project/phosphor/internal/bridge'].App;
}

/**
 * Get the Wails runtime for event handling.
 * Throws if not running in Wails context.
 */
export function getRuntime(): WailsRuntime {
  if (typeof window === 'undefined' || !window.runtime) {
    throw new Error('Not running in Wails context');
  }
  return window.runtime;
}

/**
 * Check if running in Wails context.
 */
export function isWailsContext(): boolean {
  return typeof window !== 'undefined' && !!window.go && !!window.runtime;
}

/**
 * TypeScript type definitions for OpenTelemetry telemetry data.
 * These types mirror the Go models defined in pkg/models/telemetry.go
 */

// ============================================================================
// Core Types
// ============================================================================

export type SignalType = 'trace' | 'metric' | 'log';

export type SeverityLevel =
  | 'unspecified'
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal';

export type SpanKind =
  | 'unspecified'
  | 'internal'
  | 'server'
  | 'client'
  | 'producer'
  | 'consumer';

export type StatusCode = 'unset' | 'ok' | 'error';

export type MetricType =
  | 'gauge'
  | 'sum'
  | 'histogram'
  | 'summary'
  | 'exponentialHistogram';

// ============================================================================
// Attribute & Context Types
// ============================================================================

// Primitive attribute value types
export type PrimitiveValue = string | number | boolean | null;

// Recursive attribute value using interface to avoid circular reference
export interface AttributeArray extends Array<PrimitiveValue | AttributeArray | AttributeObject> { }

export interface AttributeObject {
  [key: string]: PrimitiveValue | AttributeArray | AttributeObject;
}

export type AttributeValue = PrimitiveValue | AttributeArray | AttributeObject;

export interface Attribute {
  key: string;
  value: AttributeValue;
  type: 'string' | 'int' | 'double' | 'bool' | 'array' | 'kvlist' | 'bytes' | 'null' | 'unknown';
}

export interface Resource {
  attributes: Attribute[];
  serviceName: string;
}

export interface InstrumentationScope {
  name: string;
  version: string;
  attributes?: Attribute[];
}

// ============================================================================
// Span Types
// ============================================================================

export interface SpanEvent {
  name: string;
  timestampUnixNano: number;
  timestamp: string; // ISO date string
  attributes?: Attribute[];
  droppedAttributesCount?: number;
}

export interface SpanLink {
  traceId: string;
  spanId: string;
  traceState?: string;
  attributes?: Attribute[];
  droppedAttributesCount?: number;
}

export interface Span {
  // Identity
  id: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceState?: string;

  // Timing
  startTimeUnixNano: number;
  endTimeUnixNano: number;
  startTime: string; // ISO date string
  endTime: string;   // ISO date string
  durationMs: number;

  // Identification
  name: string;
  kind: SpanKind;

  // Status
  statusCode: StatusCode;
  statusMessage?: string;

  // Context
  resource: Resource;
  instrumentationScope: InstrumentationScope;
  attributes?: Attribute[];

  // Related data
  events?: SpanEvent[];
  links?: SpanLink[];

  // Counts
  droppedAttributesCount?: number;
  droppedEventsCount?: number;
  droppedLinksCount?: number;

  // Metadata
  receivedAt: string; // ISO date string
}

// ============================================================================
// Metric Types
// ============================================================================

export interface QuantileValue {
  quantile: number;
  value: number;
}

export interface DataPoint {
  attributes?: Attribute[];
  startTimeUnixNano?: number;
  timeUnixNano: number;
  timestamp: string; // ISO date string

  // Value (one of these will be set)
  valueInt64?: number;
  valueDouble?: number;

  // For histograms
  count?: number;
  sum?: number;
  bucketCounts?: number[];
  explicitBounds?: number[];

  // For summaries
  quantileValues?: QuantileValue[];
}

export interface Metric {
  // Identity
  id: string;
  name: string;

  // Description
  description?: string;
  unit?: string;
  type: MetricType;

  // Aggregation
  aggregationTemporality?: 'delta' | 'cumulative' | 'unspecified';

  // Data
  dataPoints: DataPoint[];

  // Context
  resource: Resource;
  instrumentationScope: InstrumentationScope;

  // Metadata
  receivedAt: string; // ISO date string
}

// ============================================================================
// Log Types
// ============================================================================

export interface LogRecord {
  // Identity
  id: string;

  // Timing
  timeUnixNano: number;
  observedTimeUnixNano: number;
  timestamp: string;    // ISO date string
  observedTime: string; // ISO date string

  // Content
  body: AttributeValue;
  severityNumber: number;
  severityText: string;
  severity: SeverityLevel;

  // Trace correlation
  traceId?: string;
  spanId?: string;
  traceFlags?: number;

  // Context
  resource: Resource;
  instrumentationScope: InstrumentationScope;
  attributes?: Attribute[];

  // Counts
  droppedAttributesCount?: number;

  // Metadata
  receivedAt: string; // ISO date string
}

// ============================================================================
// Stats & Batch Types
// ============================================================================

export interface TelemetryStats {
  traceCount: number;
  metricCount: number;
  logCount: number;
  traceCapacity: number;
  metricCapacity: number;
  logCapacity: number;
  traceUsage: number;
  metricUsage: number;
  logUsage: number;
}

export interface TelemetryBatch {
  spans?: Span[];
  metrics?: Metric[];
  logs?: LogRecord[];
}

export interface TelemetryEvent {
  type: SignalType;
  span?: Span;
  metric?: Metric;
  log?: LogRecord;
  timestamp: string; // ISO date string
}

// ============================================================================
// UI State Types
// ============================================================================

export type TabType = 'traces' | 'metrics' | 'logs';

export interface FilterState {
  searchQuery: string;
  serviceName?: string;
  severityLevel?: SeverityLevel;
  statusCode?: StatusCode;
  spanKind?: SpanKind;
  metricType?: MetricType;
}

export interface UIState {
  activeTab: TabType;
  isStreaming: boolean;
  selectedItemId: string | null;
  filters: FilterState;
}

// ============================================================================
// Utility Types
// ============================================================================

/** Type guard for checking if a span has an error status */
export function isErrorSpan(span: Span): boolean {
  return span.statusCode === 'error';
}

/** Type guard for checking if a log has error or higher severity */
export function isErrorLog(log: LogRecord): boolean {
  return log.severityNumber >= 17;
}

/** Get display color class for severity level */
export function getSeverityColorClass(severity: SeverityLevel): string {
  const colorMap: Record<SeverityLevel, string> = {
    unspecified: 'text-gray-400',
    trace: 'text-gray-400',
    debug: 'text-purple-400',
    info: 'text-blue-400',
    warn: 'text-amber-400',
    error: 'text-red-400',
    fatal: 'text-red-600',
  };
  return colorMap[severity];
}

/** Get display color class for span kind */
export function getSpanKindColorClass(kind: SpanKind): string {
  const colorMap: Record<SpanKind, string> = {
    unspecified: 'text-gray-400',
    internal: 'text-gray-400',
    server: 'text-green-400',
    client: 'text-blue-400',
    producer: 'text-amber-400',
    consumer: 'text-purple-400',
  };
  return colorMap[kind];
}

/** Get display color class for status code */
export function getStatusColorClass(status: StatusCode): string {
  const colorMap: Record<StatusCode, string> = {
    unset: 'text-gray-400',
    ok: 'text-green-400',
    error: 'text-red-400',
  };
  return colorMap[status];
}

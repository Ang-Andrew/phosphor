// Package models defines the domain types for OpenTelemetry signals.
// These types are designed to be serializable to JSON for the frontend
// while maintaining type safety and idiomatic Go patterns.
package models

import (
	"time"
)

// SignalType represents the type of telemetry signal.
type SignalType string

const (
	SignalTypeTrace  SignalType = "trace"
	SignalTypeMetric SignalType = "metric"
	SignalTypeLog    SignalType = "log"
)

// SeverityLevel represents the severity of a log or span status.
type SeverityLevel string

const (
	SeverityUnspecified SeverityLevel = "unspecified"
	SeverityTrace       SeverityLevel = "trace"
	SeverityDebug       SeverityLevel = "debug"
	SeverityInfo        SeverityLevel = "info"
	SeverityWarn        SeverityLevel = "warn"
	SeverityError       SeverityLevel = "error"
	SeverityFatal       SeverityLevel = "fatal"
)

// SpanKind represents the type of span.
type SpanKind string

const (
	SpanKindUnspecified SpanKind = "unspecified"
	SpanKindInternal    SpanKind = "internal"
	SpanKindServer      SpanKind = "server"
	SpanKindClient      SpanKind = "client"
	SpanKindProducer    SpanKind = "producer"
	SpanKindConsumer    SpanKind = "consumer"
)

// StatusCode represents the status of a span.
type StatusCode string

const (
	StatusCodeUnset StatusCode = "unset"
	StatusCodeOk    StatusCode = "ok"
	StatusCodeError StatusCode = "error"
)

// Attribute represents a key-value pair for telemetry attributes.
type Attribute struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
	Type  string      `json:"type"` // string, int, double, bool, array, kvlist
}

// Resource represents the entity producing telemetry.
type Resource struct {
	Attributes []Attribute `json:"attributes"`
	ServiceName string     `json:"serviceName"` // Extracted for convenience
}

// InstrumentationScope identifies the instrumentation library.
type InstrumentationScope struct {
	Name       string      `json:"name"`
	Version    string      `json:"version"`
	Attributes []Attribute `json:"attributes,omitempty"`
}

// SpanEvent represents an event within a span.
type SpanEvent struct {
	Name                   string      `json:"name"`
	TimestampUnixNano      int64       `json:"timestampUnixNano"`
	Timestamp              time.Time   `json:"timestamp"`
	Attributes             []Attribute `json:"attributes,omitempty"`
	DroppedAttributesCount uint32      `json:"droppedAttributesCount,omitempty"`
}

// SpanLink represents a link to another span.
type SpanLink struct {
	TraceID                string      `json:"traceId"`
	SpanID                 string      `json:"spanId"`
	TraceState             string      `json:"traceState,omitempty"`
	Attributes             []Attribute `json:"attributes,omitempty"`
	DroppedAttributesCount uint32      `json:"droppedAttributesCount,omitempty"`
}

// Span represents a single span in a trace.
type Span struct {
	// Identity
	ID             string `json:"id"`            // Internal ID for React keys
	TraceID        string `json:"traceId"`       // Hex-encoded trace ID
	SpanID         string `json:"spanId"`        // Hex-encoded span ID
	ParentSpanID   string `json:"parentSpanId,omitempty"`
	TraceState     string `json:"traceState,omitempty"`

	// Timing
	StartTimeUnixNano int64     `json:"startTimeUnixNano"`
	EndTimeUnixNano   int64     `json:"endTimeUnixNano"`
	StartTime         time.Time `json:"startTime"`
	EndTime           time.Time `json:"endTime"`
	DurationMs        float64   `json:"durationMs"`

	// Identification
	Name       string   `json:"name"`
	Kind       SpanKind `json:"kind"`

	// Status
	StatusCode    StatusCode `json:"statusCode"`
	StatusMessage string     `json:"statusMessage,omitempty"`

	// Context
	Resource             Resource             `json:"resource"`
	InstrumentationScope InstrumentationScope `json:"instrumentationScope"`
	Attributes           []Attribute          `json:"attributes,omitempty"`

	// Related data
	Events []SpanEvent `json:"events,omitempty"`
	Links  []SpanLink  `json:"links,omitempty"`

	// Counts
	DroppedAttributesCount uint32 `json:"droppedAttributesCount,omitempty"`
	DroppedEventsCount     uint32 `json:"droppedEventsCount,omitempty"`
	DroppedLinksCount      uint32 `json:"droppedLinksCount,omitempty"`

	// Metadata
	ReceivedAt time.Time `json:"receivedAt"`
}

// IsError returns true if the span has an error status.
func (s *Span) IsError() bool {
	return s.StatusCode == StatusCodeError
}

// MetricType represents the type of metric.
type MetricType string

const (
	MetricTypeGauge        MetricType = "gauge"
	MetricTypeSum          MetricType = "sum"
	MetricTypeHistogram    MetricType = "histogram"
	MetricTypeSummary      MetricType = "summary"
	MetricTypeExponentialHistogram MetricType = "exponentialHistogram"
)

// DataPoint represents a single data point in a metric.
type DataPoint struct {
	Attributes        []Attribute `json:"attributes,omitempty"`
	StartTimeUnixNano int64       `json:"startTimeUnixNano,omitempty"`
	TimeUnixNano      int64       `json:"timeUnixNano"`
	Timestamp         time.Time   `json:"timestamp"`

	// Value (one of these will be set based on type)
	ValueInt64   *int64   `json:"valueInt64,omitempty"`
	ValueDouble  *float64 `json:"valueDouble,omitempty"`

	// For histograms
	Count          *uint64   `json:"count,omitempty"`
	Sum            *float64  `json:"sum,omitempty"`
	BucketCounts   []uint64  `json:"bucketCounts,omitempty"`
	ExplicitBounds []float64 `json:"explicitBounds,omitempty"`

	// For summaries
	QuantileValues []QuantileValue `json:"quantileValues,omitempty"`
}

// QuantileValue represents a quantile in a summary.
type QuantileValue struct {
	Quantile float64 `json:"quantile"`
	Value    float64 `json:"value"`
}

// Metric represents a metric with its data points.
type Metric struct {
	// Identity
	ID   string `json:"id"`   // Internal ID for React keys
	Name string `json:"name"`

	// Description
	Description string     `json:"description,omitempty"`
	Unit        string     `json:"unit,omitempty"`
	Type        MetricType `json:"type"`

	// Aggregation temporality for Sum/Histogram
	AggregationTemporality string `json:"aggregationTemporality,omitempty"` // delta, cumulative

	// Data
	DataPoints []DataPoint `json:"dataPoints"`

	// Context
	Resource             Resource             `json:"resource"`
	InstrumentationScope InstrumentationScope `json:"instrumentationScope"`

	// Metadata
	ReceivedAt time.Time `json:"receivedAt"`
}

// LogRecord represents a log entry.
type LogRecord struct {
	// Identity
	ID string `json:"id"` // Internal ID for React keys

	// Timing
	TimeUnixNano         int64     `json:"timeUnixNano"`
	ObservedTimeUnixNano int64     `json:"observedTimeUnixNano"`
	Timestamp            time.Time `json:"timestamp"`
	ObservedTime         time.Time `json:"observedTime"`

	// Content
	Body           interface{} `json:"body"` // Can be string, map, or array
	SeverityNumber int32       `json:"severityNumber"`
	SeverityText   string      `json:"severityText"`
	Severity       SeverityLevel `json:"severity"` // Normalized severity

	// Trace correlation
	TraceID    string `json:"traceId,omitempty"`
	SpanID     string `json:"spanId,omitempty"`
	TraceFlags uint32 `json:"traceFlags,omitempty"`

	// Context
	Resource             Resource             `json:"resource"`
	InstrumentationScope InstrumentationScope `json:"instrumentationScope"`
	Attributes           []Attribute          `json:"attributes,omitempty"`

	// Counts
	DroppedAttributesCount uint32 `json:"droppedAttributesCount,omitempty"`

	// Metadata
	ReceivedAt time.Time `json:"receivedAt"`
}

// IsError returns true if the log has an error or higher severity.
func (l *LogRecord) IsError() bool {
	return l.SeverityNumber >= 17 // ERROR and above in OTLP
}

// TelemetryStats represents statistics about stored telemetry.
type TelemetryStats struct {
	TraceCount     int     `json:"traceCount"`
	MetricCount    int     `json:"metricCount"`
	LogCount       int     `json:"logCount"`
	TraceCapacity  int     `json:"traceCapacity"`
	MetricCapacity int     `json:"metricCapacity"`
	LogCapacity    int     `json:"logCapacity"`
	TraceUsage     float64 `json:"traceUsage"`
	MetricUsage    float64 `json:"metricUsage"`
	LogUsage       float64 `json:"logUsage"`
}

// TelemetryBatch represents a batch of telemetry data for the frontend.
type TelemetryBatch struct {
	Spans   []Span      `json:"spans,omitempty"`
	Metrics []Metric    `json:"metrics,omitempty"`
	Logs    []LogRecord `json:"logs,omitempty"`
}

// TelemetryEvent represents a real-time event pushed to the frontend.
type TelemetryEvent struct {
	Type      SignalType  `json:"type"`
	Span      *Span       `json:"span,omitempty"`
	Metric    *Metric     `json:"metric,omitempty"`
	Log       *LogRecord  `json:"log,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
}

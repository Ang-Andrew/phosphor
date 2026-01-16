// Package receiver implements the OTLP gRPC receiver for traces, metrics, and logs.
package receiver

import (
	"context"
	"fmt"
	"log"
	"net"
	"sync"

	"github.com/phosphor-project/phosphor/pkg/buffer"
	"github.com/phosphor-project/phosphor/pkg/models"
	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

// EventCallback is called when new telemetry data is received.
type EventCallback func(event models.TelemetryEvent)

// Config holds the configuration for the OTLP receiver.
type Config struct {
	Port           int // Port to listen on (default: 4317)
	TraceCapacity  int // Ring buffer capacity for traces (default: 1000)
	MetricCapacity int // Ring buffer capacity for metrics (default: 1000)
	LogCapacity    int // Ring buffer capacity for logs (default: 1000)
}

// DefaultConfig returns a Config with sensible defaults.
func DefaultConfig() Config {
	return Config{
		Port:           4317,
		TraceCapacity:  1000,
		MetricCapacity: 1000,
		LogCapacity:    1000,
	}
}

// OTLPReceiver manages the OTLP gRPC server for all signal types.
type OTLPReceiver struct {
	config Config

	// Ring buffers for storing telemetry
	traces  *buffer.RingBuffer[models.Span]
	metrics *buffer.RingBuffer[models.Metric]
	logs    *buffer.RingBuffer[models.LogRecord]

	// Event callbacks for real-time streaming
	callbacks   []EventCallback
	callbacksMu sync.RWMutex

	// gRPC server components
	server   *grpc.Server
	listener net.Listener

	// Service handlers
	traceService   *traceServiceHandler
	metricsService *metricsServiceHandler
	logsService    *logsServiceHandler

	// Statistics
	stats   ReceiverStats
	statsMu sync.RWMutex
}

// ReceiverStats tracks telemetry reception statistics.
type ReceiverStats struct {
	TracesReceived  uint64 `json:"tracesReceived"`
	MetricsReceived uint64 `json:"metricsReceived"`
	LogsReceived    uint64 `json:"logsReceived"`
	Errors          uint64 `json:"errors"`
}

// traceServiceHandler implements the OTLP TraceService.
type traceServiceHandler struct {
	coltracepb.UnimplementedTraceServiceServer
	receiver *OTLPReceiver
}

// metricsServiceHandler implements the OTLP MetricsService.
type metricsServiceHandler struct {
	colmetricspb.UnimplementedMetricsServiceServer
	receiver *OTLPReceiver
}

// logsServiceHandler implements the OTLP LogsService.
type logsServiceHandler struct {
	collogspb.UnimplementedLogsServiceServer
	receiver *OTLPReceiver
}

// NewOTLPReceiver creates a new OTLP receiver with the given configuration.
func NewOTLPReceiver(config Config) *OTLPReceiver {
	if config.Port == 0 {
		config.Port = 4317
	}
	if config.TraceCapacity == 0 {
		config.TraceCapacity = 1000
	}
	if config.MetricCapacity == 0 {
		config.MetricCapacity = 1000
	}
	if config.LogCapacity == 0 {
		config.LogCapacity = 1000
	}

	r := &OTLPReceiver{
		config:    config,
		traces:    buffer.NewRingBuffer[models.Span](config.TraceCapacity),
		metrics:   buffer.NewRingBuffer[models.Metric](config.MetricCapacity),
		logs:      buffer.NewRingBuffer[models.LogRecord](config.LogCapacity),
		callbacks: make([]EventCallback, 0),
	}

	// Initialize service handlers
	r.traceService = &traceServiceHandler{receiver: r}
	r.metricsService = &metricsServiceHandler{receiver: r}
	r.logsService = &logsServiceHandler{receiver: r}

	return r
}

// OnEvent registers a callback to be called when telemetry is received.
func (r *OTLPReceiver) OnEvent(callback EventCallback) {
	r.callbacksMu.Lock()
	defer r.callbacksMu.Unlock()
	r.callbacks = append(r.callbacks, callback)
}

// emitEvent sends an event to all registered callbacks.
func (r *OTLPReceiver) emitEvent(event models.TelemetryEvent) {
	r.callbacksMu.RLock()
	callbacks := r.callbacks
	r.callbacksMu.RUnlock()

	for _, cb := range callbacks {
		// Run callbacks in goroutines to avoid blocking
		go cb(event)
	}
}

// Start begins listening for OTLP data on the configured port.
func (r *OTLPReceiver) Start() error {
	addr := fmt.Sprintf(":%d", r.config.Port)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", addr, err)
	}
	r.listener = listener

	r.server = grpc.NewServer(
		grpc.MaxRecvMsgSize(16 * 1024 * 1024), // 16MB max message size
	)

	// Register all OTLP services
	coltracepb.RegisterTraceServiceServer(r.server, r.traceService)
	colmetricspb.RegisterMetricsServiceServer(r.server, r.metricsService)
	collogspb.RegisterLogsServiceServer(r.server, r.logsService)

	// Enable reflection for debugging
	reflection.Register(r.server)

	log.Printf("[Phosphor] OTLP receiver listening on %s", addr)

	go func() {
		if err := r.server.Serve(listener); err != nil {
			log.Printf("[Phosphor] gRPC server error: %v", err)
		}
	}()

	return nil
}

// Stop gracefully shuts down the receiver.
func (r *OTLPReceiver) Stop() {
	if r.server != nil {
		r.server.GracefulStop()
	}
	if r.listener != nil {
		r.listener.Close()
	}
	log.Println("[Phosphor] OTLP receiver stopped")
}

// Export implements the TraceService Export method.
func (h *traceServiceHandler) Export(ctx context.Context, req *coltracepb.ExportTraceServiceRequest) (*coltracepb.ExportTraceServiceResponse, error) {
	if req == nil {
		return &coltracepb.ExportTraceServiceResponse{}, nil
	}

	var spanCount int
	r := h.receiver

	for _, resourceSpans := range req.ResourceSpans {
		resource := models.ConvertResource(resourceSpans.Resource)

		for _, scopeSpans := range resourceSpans.ScopeSpans {
			scope := models.ConvertInstrumentationScope(scopeSpans.Scope)

			for _, span := range scopeSpans.Spans {
				converted := models.ConvertSpan(span, resource, scope)
				r.traces.Push(converted)
				spanCount++

				// Emit real-time event
				r.emitEvent(models.TelemetryEvent{
					Type:      models.SignalTypeTrace,
					Span:      &converted,
					Timestamp: converted.ReceivedAt,
				})
			}
		}
	}

	r.statsMu.Lock()
	r.stats.TracesReceived += uint64(spanCount)
	r.statsMu.Unlock()

	log.Printf("[Phosphor] Received %d spans", spanCount)

	return &coltracepb.ExportTraceServiceResponse{}, nil
}

// Export implements the MetricsService Export method.
func (h *metricsServiceHandler) Export(ctx context.Context, req *colmetricspb.ExportMetricsServiceRequest) (*colmetricspb.ExportMetricsServiceResponse, error) {
	if req == nil {
		return &colmetricspb.ExportMetricsServiceResponse{}, nil
	}

	var metricCount int
	r := h.receiver

	for _, resourceMetrics := range req.ResourceMetrics {
		resource := models.ConvertResource(resourceMetrics.Resource)

		for _, scopeMetrics := range resourceMetrics.ScopeMetrics {
			scope := models.ConvertInstrumentationScope(scopeMetrics.Scope)

			for _, metric := range scopeMetrics.Metrics {
				converted := models.ConvertMetric(metric, resource, scope)
				r.metrics.Push(converted)
				metricCount++

				// Emit real-time event
				r.emitEvent(models.TelemetryEvent{
					Type:      models.SignalTypeMetric,
					Metric:    &converted,
					Timestamp: converted.ReceivedAt,
				})
			}
		}
	}

	r.statsMu.Lock()
	r.stats.MetricsReceived += uint64(metricCount)
	r.statsMu.Unlock()

	log.Printf("[Phosphor] Received %d metrics", metricCount)

	return &colmetricspb.ExportMetricsServiceResponse{}, nil
}

// Export implements the LogsService Export method.
func (h *logsServiceHandler) Export(ctx context.Context, req *collogspb.ExportLogsServiceRequest) (*collogspb.ExportLogsServiceResponse, error) {
	if req == nil {
		return &collogspb.ExportLogsServiceResponse{}, nil
	}

	var logCount int
	r := h.receiver

	for _, resourceLogs := range req.ResourceLogs {
		resource := models.ConvertResource(resourceLogs.Resource)

		for _, scopeLogs := range resourceLogs.ScopeLogs {
			scope := models.ConvertInstrumentationScope(scopeLogs.Scope)

			for _, logRecord := range scopeLogs.LogRecords {
				converted := models.ConvertLogRecord(logRecord, resource, scope)
				r.logs.Push(converted)
				logCount++

				// Emit real-time event
				r.emitEvent(models.TelemetryEvent{
					Type:      models.SignalTypeLog,
					Log:       &converted,
					Timestamp: converted.ReceivedAt,
				})
			}
		}
	}

	r.statsMu.Lock()
	r.stats.LogsReceived += uint64(logCount)
	r.statsMu.Unlock()

	log.Printf("[Phosphor] Received %d logs", logCount)

	return &collogspb.ExportLogsServiceResponse{}, nil
}

// GetTraces returns all stored traces.
func (r *OTLPReceiver) GetTraces() []models.Span {
	return r.traces.GetAll()
}

// GetRecentTraces returns the last n traces.
func (r *OTLPReceiver) GetRecentTraces(n int) []models.Span {
	return r.traces.GetLast(n)
}

// GetMetrics returns all stored metrics.
func (r *OTLPReceiver) GetMetrics() []models.Metric {
	return r.metrics.GetAll()
}

// GetRecentMetrics returns the last n metrics.
func (r *OTLPReceiver) GetRecentMetrics(n int) []models.Metric {
	return r.metrics.GetLast(n)
}

// GetLogs returns all stored logs.
func (r *OTLPReceiver) GetLogs() []models.LogRecord {
	return r.logs.GetAll()
}

// GetRecentLogs returns the last n logs.
func (r *OTLPReceiver) GetRecentLogs(n int) []models.LogRecord {
	return r.logs.GetLast(n)
}

// GetStats returns the current telemetry statistics.
func (r *OTLPReceiver) GetStats() models.TelemetryStats {
	r.statsMu.RLock()
	defer r.statsMu.RUnlock()

	traceStats := r.traces.Stats()
	metricStats := r.metrics.Stats()
	logStats := r.logs.Stats()

	return models.TelemetryStats{
		TraceCount:     traceStats.Count,
		MetricCount:    metricStats.Count,
		LogCount:       logStats.Count,
		TraceCapacity:  traceStats.Capacity,
		MetricCapacity: metricStats.Capacity,
		LogCapacity:    logStats.Capacity,
		TraceUsage:     traceStats.Usage,
		MetricUsage:    metricStats.Usage,
		LogUsage:       logStats.Usage,
	}
}

// ClearAll clears all stored telemetry data.
func (r *OTLPReceiver) ClearAll() {
	r.traces.Clear()
	r.metrics.Clear()
	r.logs.Clear()

	r.statsMu.Lock()
	r.stats = ReceiverStats{}
	r.statsMu.Unlock()

	log.Println("[Phosphor] All telemetry data cleared")
}

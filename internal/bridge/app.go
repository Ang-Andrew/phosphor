// Package bridge provides the Wails bindings for frontend-backend communication.
package bridge

import (
	"context"
	"log"
	"sync"

	"github.com/phosphor-project/phosphor/internal/receiver"
	"github.com/phosphor-project/phosphor/pkg/models"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App represents the Wails application bridge.
// It exposes methods to the frontend and manages telemetry streaming.
type App struct {
	ctx      context.Context
	receiver *receiver.OTLPReceiver

	// Streaming control
	streaming   bool
	streamingMu sync.RWMutex
}

// NewApp creates a new App instance.
func NewApp() *App {
	return &App{}
}

// Startup is called when the Wails application starts.
// It initializes the OTLP receiver and sets up event streaming.
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	// Initialize the receiver with default configuration
	config := receiver.DefaultConfig()
	a.receiver = receiver.NewOTLPReceiver(config)

	// Register event callback for real-time streaming
	a.receiver.OnEvent(func(event models.TelemetryEvent) {
		a.streamingMu.RLock()
		streaming := a.streaming
		a.streamingMu.RUnlock()

		if streaming {
			// Emit event to frontend via Wails runtime
			runtime.EventsEmit(a.ctx, "telemetry:event", event)
		}
	})

	// Start the OTLP receiver
	if err := a.receiver.Start(); err != nil {
		log.Printf("[Phosphor] Failed to start receiver: %v", err)
		return
	}

	log.Println("[Phosphor] Application started successfully")
}

// Shutdown is called when the Wails application is closing.
func (a *App) Shutdown(ctx context.Context) {
	if a.receiver != nil {
		a.receiver.Stop()
	}
	log.Println("[Phosphor] Application shutdown complete")
}

// --- Trace Methods ---

// GetTraces returns all stored traces (up to buffer capacity).
func (a *App) GetTraces() []models.Span {
	if a.receiver == nil {
		return []models.Span{}
	}
	return a.receiver.GetTraces()
}

// GetRecentTraces returns the last n traces.
func (a *App) GetRecentTraces(count int) []models.Span {
	if a.receiver == nil {
		return []models.Span{}
	}
	return a.receiver.GetRecentTraces(count)
}

// --- Metric Methods ---

// GetMetrics returns all stored metrics (up to buffer capacity).
func (a *App) GetMetrics() []models.Metric {
	if a.receiver == nil {
		return []models.Metric{}
	}
	return a.receiver.GetMetrics()
}

// GetRecentMetrics returns the last n metrics.
func (a *App) GetRecentMetrics(count int) []models.Metric {
	if a.receiver == nil {
		return []models.Metric{}
	}
	return a.receiver.GetRecentMetrics(count)
}

// --- Log Methods ---

// GetLogs returns all stored logs (up to buffer capacity).
func (a *App) GetLogs() []models.LogRecord {
	if a.receiver == nil {
		return []models.LogRecord{}
	}
	return a.receiver.GetLogs()
}

// GetRecentLogs returns the last n logs.
func (a *App) GetRecentLogs(count int) []models.LogRecord {
	if a.receiver == nil {
		return []models.LogRecord{}
	}
	return a.receiver.GetRecentLogs(count)
}

// --- Stats Methods ---

// GetStats returns current telemetry statistics.
func (a *App) GetStats() models.TelemetryStats {
	if a.receiver == nil {
		return models.TelemetryStats{}
	}
	return a.receiver.GetStats()
}

// --- Control Methods ---

// StartStreaming enables real-time event streaming to the frontend.
func (a *App) StartStreaming() {
	a.streamingMu.Lock()
	a.streaming = true
	a.streamingMu.Unlock()
	log.Println("[Phosphor] Streaming enabled")
}

// StopStreaming disables real-time event streaming.
func (a *App) StopStreaming() {
	a.streamingMu.Lock()
	a.streaming = false
	a.streamingMu.Unlock()
	log.Println("[Phosphor] Streaming disabled")
}

// IsStreaming returns whether streaming is currently enabled.
func (a *App) IsStreaming() bool {
	a.streamingMu.RLock()
	defer a.streamingMu.RUnlock()
	return a.streaming
}

// ClearAll clears all stored telemetry data.
func (a *App) ClearAll() {
	if a.receiver != nil {
		a.receiver.ClearAll()
	}
	// Notify frontend to clear its state
	runtime.EventsEmit(a.ctx, "telemetry:cleared", nil)
}

// GetAllTelemetry returns all telemetry data in a single batch.
// Useful for initial load or refresh.
func (a *App) GetAllTelemetry() models.TelemetryBatch {
	if a.receiver == nil {
		return models.TelemetryBatch{}
	}
	return models.TelemetryBatch{
		Spans:   a.receiver.GetTraces(),
		Metrics: a.receiver.GetMetrics(),
		Logs:    a.receiver.GetLogs(),
	}
}

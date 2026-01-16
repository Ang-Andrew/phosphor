# Phosphor

<div align="center">

![Phosphor Logo](https://img.shields.io/badge/Phosphor-OpenTelemetry_Viewer-00A5E9?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiLz48cGF0aCBkPSJNNyAxNCBMMTAgMTAgTDE0IDE0IEwxNyA4IiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+)

**A desktop Wireshark for OpenTelemetry**

*Professional-grade local observability tool for debugging traces, metrics, and logs*

[![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat-square&logo=go)](https://go.dev)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Wails](https://img.shields.io/badge/Wails-v2-red?style=flat-square)](https://wails.io)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## Overview

Phosphor is a **local-first, desktop application** for viewing and debugging OpenTelemetry (OTLP) signals. It serves as a sidecar to your development workflow, allowing you to inspect high-volume telemetry data without needing a full-blown observability stack.

**Core Philosophy:**
- **Zero Dependencies:** No databases (uses in-memory ring buffers).
- **Pro Performance:** Handles 1000s of spans/sec with virtualized rendering.
- **Developer Aesthetic:** Clean, dense, dark-mode UI inspired by modern IDEs.

## Architecture

Phosphor bridges a high-performance Go backend with a React frontend using [Wails](https://wails.io).

```mermaid
graph TD
    Client[Your App / OTel Collector] -->|gRPC :4317| Receiver[OTLP Receiver (Go)]
    
    subgraph "Phosphor Backend (Go)"
        Receiver -->|Parsed| RingBuffers[Ring Buffers<T>]
        RingBuffers -->|Events| Bridge[Wails Bridge]
    end
    
    subgraph "Phosphor Frontend (React)"
        Bridge -->|IPC| ReactHooks[useTelemetry Hook]
        ReactHooks --> State[Virtual Store]
        State --> UI[DataTables / Visualizations]
    end
```

## Features

### 🚄 High-Performance Data Ingestion
- **Native gRPC Receiver:** Listens on port `4317` for OTLP Traces, Metrics, and Logs.
- **Ring Buffer Storage:** Fixed-capacity memory implementation (default: 1000 items) ensures Phosphor never consumes excessive RAM. It automatically rotates old data.
- **Concurrency Safe:** Built with fine-grained mutexes for concurrent reading/writing.

### 💎 Professional UI
- **Live Streaming:** Real-time updates as signals arrive.
- **Virtualized Tables:** Renders thousands of rows smoothly using `@tanstack/react-virtual`.
- **Signal Correlation:**
    - **Traces:** Duration coloring, status indicators (Error/Ok).
    - **Logs:** Severity badging (Info, Warn, Error, Fatal).
    - **Metrics:** Support for Gauges, Sums, and Histograms.

### 🛠️ Developer Experience
- **"Mirror" Pattern Ready:** includes configurations to fan-out data from a local OTel Collector to both Phosphor and your production backend.
- **Strict Typing:** Shared data models between Go and TypeScript ensure type safety across the IPC bridge.

## Project Structure

This project follows the **Standard Go Project Layout**:

```
phosphor/
├── cmd/phosphor/       # Main entry point for the application
├── internal/
│   ├── bridge/         # Wails bindings & frontend IPC
│   └── receiver/       # OTLP gRPC server implementation
├── pkg/
│   ├── buffer/         # Generic RingBuffer[T] implementation
│   └── models/         # Shared domain models & OTLP converters
├── frontend/           # Vite + React + TypeScript + Tailwind
├── deploy/             # Docker Compose & OTel Collector configs
└── main.go             # Wails build entry
```

## Getting Started

### Prerequisites
- **Go 1.22+**
- **Node.js 18+**
- **Wails CLI:** `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

### Building & Running

1. **Install Dependencies:**
   ```bash
   # Install frontend deps
   cd frontend && npm install && cd ..
   
   # Tidy Go modules
   go mod tidy
   ```

2. **Run in Dev Mode:**
    ```bash
    wails dev
    ```
    This starts the backend and a Vite dev server for the frontend.

3. **Build for Production:**
    ```bash
    wails build
    ```

### Sending Data (Demo)

Phosphor includes a demo environment to simulate traffic.

```bash
cd deploy

# 1. Direct Load: Sends telemetrygen traffic directly to Phosphor
docker-compose --profile direct-load up

# 2. Mirror Pattern: Specially configured collector fans out data
docker-compose --profile mirror up
```

## Configuration

Phosphor listens on `0.0.0.0:4317` by default.

To configure your application to send to Phosphor:

**Go (OpenTelemetry SDK):**
```go
ctx := context.Background()
exporter, err := otlptracegrpc.New(ctx,
    otlptracegrpc.WithInsecure(),
    otlptracegrpc.WithEndpoint("localhost:4317"),
)
```

**Environment Variables (OTel Standard):**
```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OTEL_EXPORTER_OTLP_INSECURE=true
```

## License

MIT

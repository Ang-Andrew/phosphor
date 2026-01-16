.PHONY: all build dev test clean deps frontend-deps run-demo

# Build variables
APP_NAME := phosphor
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_DIR := build/bin

# Go variables
GOCMD := go
GOBUILD := $(GOCMD) build
GOTEST := $(GOCMD) test
GOMOD := $(GOCMD) mod
WAILS := wails

# Default target
all: deps build

# Install dependencies
deps: frontend-deps
	$(GOMOD) download
	$(GOMOD) tidy

frontend-deps:
	cd frontend && npm install

# Development mode
dev:
	$(WAILS) dev

# Build the application
build:
	$(WAILS) build

# Build for specific platforms
build-darwin:
	$(WAILS) build -platform darwin/universal

build-windows:
	$(WAILS) build -platform windows/amd64

build-linux:
	$(WAILS) build -platform linux/amd64

# Run tests
test:
	$(GOTEST) -v -race ./...

test-coverage:
	$(GOTEST) -v -race -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html

# Benchmarks
bench:
	$(GOTEST) -bench=. -benchmem ./pkg/buffer/...

# Lint
lint:
	golangci-lint run ./...
	cd frontend && npm run lint

# Clean build artifacts
clean:
	rm -rf $(BUILD_DIR)
	rm -rf frontend/dist
	rm -rf frontend/node_modules
	rm -f coverage.out coverage.html

# Demo commands
run-demo-direct:
	cd deploy && docker-compose --profile direct-load up

run-demo-mirror:
	cd deploy && docker-compose --profile mirror up

run-demo-stress:
	cd deploy && docker-compose --profile stress up

stop-demo:
	cd deploy && docker-compose down

# Generate Wails bindings
generate:
	$(WAILS) generate module

# Help
help:
	@echo "Phosphor - OpenTelemetry Desktop Viewer"
	@echo ""
	@echo "Usage:"
	@echo "  make deps          Install all dependencies"
	@echo "  make dev           Run in development mode"
	@echo "  make build         Build for current platform"
	@echo "  make build-darwin  Build for macOS (universal)"
	@echo "  make test          Run tests"
	@echo "  make lint          Run linters"
	@echo "  make clean         Clean build artifacts"
	@echo ""
	@echo "Demo commands:"
	@echo "  make run-demo-direct   Run direct load demo"
	@echo "  make run-demo-mirror   Run mirror pattern demo"
	@echo "  make run-demo-stress   Run stress test demo"
	@echo "  make stop-demo         Stop demo containers"

.PHONY: build run clean install test deps

# Build variables
BINARY_NAME=packetpilot-daemon
BUILD_DIR=build
VERSION=0.1.0
BUILD_TIME=$(shell date +%Y-%m-%d_%H:%M:%S)
GIT_COMMIT=$(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Build flags
LDFLAGS=-ldflags "-X main.version=$(VERSION) -X main.build=$(BUILD_TIME)-$(GIT_COMMIT)"

# Default target
all: deps build

# Install dependencies
deps:
	go mod tidy
	go mod download

# Build the binary
build:
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p $(BUILD_DIR)
	go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) .
	@echo "Build complete: $(BUILD_DIR)/$(BINARY_NAME)"

# Build for multiple platforms
build-all:
	@echo "Building for multiple platforms..."
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 .
	GOOS=linux GOARCH=arm64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-arm64 .
	GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-windows-amd64.exe .
	GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-amd64 .
	@echo "Cross-platform build complete"

# Run the daemon
run: build
	@echo "Running $(BINARY_NAME)..."
	sudo $(BUILD_DIR)/$(BINARY_NAME) --config config.yaml

# Run in development mode
dev: build
	@echo "Running in development mode..."
	$(BUILD_DIR)/$(BINARY_NAME) --config config.yaml --log-level debug

# Run tests
test:
	go test -v ./...

# Run tests with coverage
test-coverage:
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf $(BUILD_DIR)
	rm -f coverage.out coverage.html

# Install systemd service (requires sudo)
install: build
	@echo "Installing systemd service..."
	sudo cp $(BUILD_DIR)/$(BINARY_NAME) /usr/local/bin/
	sudo mkdir -p /etc/packetpilot
	sudo cp config.yaml /etc/packetpilot/
	sudo mkdir -p /var/log/packetpilot
	sudo chown root:root /usr/local/bin/$(BINARY_NAME)
	sudo chmod +x /usr/local/bin/$(BINARY_NAME)
	@echo "Installation complete"

# Uninstall systemd service
uninstall:
	@echo "Uninstalling..."
	sudo rm -f /usr/local/bin/$(BINARY_NAME)
	sudo rm -rf /etc/packetpilot
	sudo rm -rf /var/log/packetpilot
	@echo "Uninstallation complete"

# Show help
help:
	@echo "Available targets:"
	@echo "  build      - Build the binary"
	@echo "  build-all  - Build for multiple platforms"
	@echo "  run        - Build and run the daemon"
	@echo "  dev        - Run in development mode"
	@echo "  test       - Run tests"
	@echo "  test-coverage - Run tests with coverage"
	@echo "  clean      - Clean build artifacts"
	@echo "  install    - Install systemd service"
	@echo "  uninstall  - Uninstall systemd service"
	@echo "  deps       - Install dependencies"
	@echo "  help       - Show this help"

package reporter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"time"

	"packetpilot-daemon/internal/logger"
	"packetpilot-daemon/internal/monitor"
)

type Reporter struct {
	config     *Config
	logger     *logger.Logger
	httpClient *http.Client
	monitor    *monitor.TrafficMonitor
}

type Config struct {
	ServerHost     string
	ServerPort     int
	UseTLS         bool
	APIKey         string
	DeviceID       string
	ReportInterval time.Duration
	BatchSize      int
	RetryAttempts  int
	RetryDelay     time.Duration
}

type InterfaceUsageReport struct {
	Interface string  `json:"interface"`
	TotalRx   uint64  `json:"total_rx"`   // bytes
	TotalTx   uint64  `json:"total_tx"`   // bytes
	TotalRxMB float64 `json:"total_rx_mb"` // MB
	TotalTxMB float64 `json:"total_tx_mb"` // MB
}

type DailyUsageReport struct {
	DeviceID    string                   `json:"device_id"`
	Timestamp   time.Time                `json:"timestamp"`
	Date        string                   `json:"date"`        // YYYY-MM-DD
	Interfaces  []InterfaceUsageReport   `json:"interfaces"`
	TotalRxMB   float64                  `json:"total_rx_mb"` // Combined MB
	TotalTxMB   float64                  `json:"total_tx_mb"` // Combined MB
}

type ServerResponse struct {
	Success  bool      `json:"success"`
	Message  string    `json:"message"`
	Commands []Command `json:"commands,omitempty"`
}

type Command struct {
	Type    string `json:"type"`
	AppName string `json:"app_name"`
	Action  string `json:"action"`
}

func NewReporter(config *Config, logger *logger.Logger, monitor *monitor.TrafficMonitor) *Reporter {
	return &Reporter{
		config: config,
		logger: logger,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		monitor: monitor,
	}
}

func (r *Reporter) Start(ctx context.Context) error {
	r.logger.Info("Starting daily usage reporter",
		"server", fmt.Sprintf("%s:%d", r.config.ServerHost, r.config.ServerPort),
		"interval", r.config.ReportInterval,
	)

	ticker := time.NewTicker(r.config.ReportInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := r.sendReport(); err != nil {
				r.logger.Error("Failed to send report", "error", err)
			}
		case <-ctx.Done():
			r.logger.Info("Daily usage reporter stopped")
			return nil
		}
	}
}

func (r *Reporter) sendReport() error {
	// Get current daily usage from monitor
	usage := r.monitor.GetDailyUsage()
	if usage == nil {
		r.logger.Debug("No daily usage data to report")
		return nil
	}

	r.logger.Debug("Got daily usage data", "interfaces_count", len(usage.Interfaces), "date", usage.Date)

	// Create interface reports (sorted by interface name)
	var interfaceReports []InterfaceUsageReport
	var totalRx, totalTx uint64

	// Get sorted interface names
	interfaceNames := make([]string, 0, len(usage.Interfaces))
	for name := range usage.Interfaces {
		interfaceNames = append(interfaceNames, name)
	}
	sort.Strings(interfaceNames)

	// Create reports in sorted order
	for _, iface := range interfaceNames {
		stats := usage.Interfaces[iface]
		interfaceReport := InterfaceUsageReport{
			Interface: iface,
			TotalRx:   stats.TotalRx,
			TotalTx:   stats.TotalTx,
			TotalRxMB: float64(stats.TotalRx) / (1024 * 1024),
			TotalTxMB: float64(stats.TotalTx) / (1024 * 1024),
		}
		interfaceReports = append(interfaceReports, interfaceReport)
		
		// Add to totals
		totalRx += stats.TotalRx
		totalTx += stats.TotalTx
		
		// r.logger.Debug("Added interface to report", "interface", iface, "rx_mb", interfaceReport.TotalRxMB, "tx_mb", interfaceReport.TotalTxMB)
	}

	r.logger.Debug("Created interface reports", "count", len(interfaceReports), "total_rx_mb", float64(totalRx)/(1024*1024), "total_tx_mb", float64(totalTx)/(1024*1024))

	// Create report
	report := DailyUsageReport{
		DeviceID:   r.config.DeviceID,
		Timestamp:  time.Now(),
		Date:       usage.Date,
		Interfaces: interfaceReports,
		TotalRxMB:  float64(totalRx) / (1024 * 1024),
		TotalTxMB:  float64(totalTx) / (1024 * 1024),
	}

	jsonData, err := json.Marshal(report)
	if err != nil {
		return fmt.Errorf("failed to marshal report: %w", err)
	}

	protocol := "http"
	if r.config.UseTLS {
		protocol = "https"
	}
	url := fmt.Sprintf("%s://%s:%d/api/v1/traffic/report", protocol, r.config.ServerHost, r.config.ServerPort)

	var lastErr error
	for attempt := 1; attempt <= r.config.RetryAttempts; attempt++ {
		// Recreate request each attempt so Body isn't exhausted
		req, err := http.NewRequest("POST", url, bytes.NewReader(jsonData))
		if err != nil {
			return fmt.Errorf("failed to create request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+r.config.APIKey)
		req.Header.Set("User-Agent", "PacketPilot-Daemon/1.0")

		r.logger.Debug("Sending daily usage report", "attempt", attempt, "url", url,
			"date", report.Date, "interfaces", len(report.Interfaces), "total_rx_mb", report.TotalRxMB, "total_tx_mb", report.TotalTxMB)

		resp, err := r.httpClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("request failed: %w", err)
			r.logger.Warn("Report attempt failed", "attempt", attempt, "error", err)
			if attempt < r.config.RetryAttempts {
				time.Sleep(r.config.RetryDelay)
				continue
			}
			break
		}

		func() {
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				lastErr = fmt.Errorf("server returned status %d", resp.StatusCode)
				r.logger.Warn("Server returned error status", "status", resp.StatusCode)
				return
			}

			var serverResp ServerResponse
			if err := json.NewDecoder(resp.Body).Decode(&serverResp); err != nil {
				r.logger.Warn("Failed to parse server response", "error", err)
			} else {
				r.logger.Info("Daily usage report sent successfully", 
					"message", serverResp.Message,
					"date", report.Date,
					"interfaces", len(report.Interfaces),
					"total_rx_mb", report.TotalRxMB,
					"total_tx_mb", report.TotalTxMB)
				if len(serverResp.Commands) > 0 {
					r.handleCommands(serverResp.Commands)
				}
			}
		}()

		// Success - return (don't reset stats, keep accumulating daily usage)
		return nil
	}

	return lastErr
}

func (r *Reporter) handleCommands(commands []Command) {
	r.logger.Info("Received commands from server", "count", len(commands))
	for _, cmd := range commands {
		r.logger.Info("Processing command", "type", cmd.Type, "app", cmd.AppName, "action", cmd.Action)
		switch cmd.Type {
		case "block_app":
			r.handleBlockApp(cmd.AppName, cmd.Action)
		case "limit_app":
			r.handleLimitApp(cmd.AppName, cmd.Action)
		default:
			r.logger.Warn("Unknown command type", "type", cmd.Type)
		}
	}
}

func (r *Reporter) handleBlockApp(appName, action string) {
	r.logger.Info("Block app command", "app", appName, "action", action)
}

func (r *Reporter) handleLimitApp(appName, action string) {
	r.logger.Info("Limit app command", "app", appName, "action", action)
}

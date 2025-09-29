package daemon

import (
	"context"
	"fmt"
	"time"

	"packetpilot-daemon/internal/config"
	"packetpilot-daemon/internal/logger"
	"packetpilot-daemon/internal/monitor"
	"packetpilot-daemon/internal/reporter"
)

type Daemon struct {
	config   *config.Config
	logger   *logger.Logger
	monitor  *monitor.TrafficMonitor
	reporter *reporter.Reporter
}

func New(cfg *config.Config, log *logger.Logger) (*Daemon, error) {
	// Parse durations
	updateInterval, err := time.ParseDuration(cfg.Monitor.UpdateInterval)
	if err != nil {
		return nil, fmt.Errorf("invalid update interval: %w", err)
	}

	reportInterval, err := time.ParseDuration(cfg.Reporter.ReportInterval)
	if err != nil {
		return nil, fmt.Errorf("invalid report interval: %w", err)
	}

	retryDelay, err := time.ParseDuration(cfg.Reporter.RetryDelay)
	if err != nil {
		return nil, fmt.Errorf("invalid retry delay: %w", err)
	}

	// Create monitor
	monitorConfig := &monitor.Config{
		Interface:      cfg.Monitor.Interface,
		UpdateInterval: updateInterval,
		BufferSize:     cfg.Monitor.BufferSize,
		UsageFile:      cfg.Monitor.UsageFile,
	}

	trafficMonitor := monitor.NewTrafficMonitor(monitorConfig, log)

	// Create reporter
	reporterConfig := &reporter.Config{
		ServerHost:     cfg.Server.Host,
		ServerPort:     cfg.Server.Port,
		UseTLS:         cfg.Server.UseTLS,
		APIKey:         cfg.Server.APIKey,
		DeviceID:       cfg.Server.DeviceID,
		ReportInterval: reportInterval,
		BatchSize:      cfg.Reporter.BatchSize,
		RetryAttempts:  cfg.Reporter.RetryAttempts,
		RetryDelay:     retryDelay,
	}

	trafficReporter := reporter.NewReporter(reporterConfig, log, trafficMonitor)

	return &Daemon{
		config:   cfg,
		logger:   log,
		monitor:  trafficMonitor,
		reporter: trafficReporter,
	}, nil
}

func (d *Daemon) Start(ctx context.Context) error {
	d.logger.Info("Starting PacketPilot daemon components")

	// Start traffic monitor
	go func() {
		if err := d.monitor.Start(ctx); err != nil {
			d.logger.Error("Traffic monitor failed", "error", err)
		}
	}()

	// Start reporter
	go func() {
		if err := d.reporter.Start(ctx); err != nil {
			d.logger.Error("Traffic reporter failed", "error", err)
		}
	}()

	// Wait for context cancellation
	<-ctx.Done()
	
	d.logger.Info("Shutting down daemon components")
	return nil
}

func (d *Daemon) GetDailyUsage() *monitor.DailyUsage {
	return d.monitor.GetDailyUsage()
}

func (d *Daemon) ResetStats() {
	d.monitor.ResetStats()
}

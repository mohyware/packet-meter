package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"packetpilot-daemon/internal/config"
	"packetpilot-daemon/internal/daemon"
	"packetpilot-daemon/internal/logger"

	"github.com/spf13/cobra"
)

var (
	version = "0.1.0"
	build   = "dev"
)

func main() {
	var rootCmd = &cobra.Command{
		Use:   "packetpilot-daemon",
		Short: "PacketPilot traffic monitoring daemon",
		Long:  "A daemon service that monitors network traffic per application on Ubuntu systems",
		RunE:  runDaemon,
	}

	rootCmd.AddCommand(&cobra.Command{
		Use:   "version",
		Short: "Print version information",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("PacketPilot Daemon v%s (build: %s)\n", version, build)
		},
	})

	// Add flags
	rootCmd.Flags().StringP("config", "c", "", "Path to config file")
	rootCmd.Flags().BoolP("daemon", "d", false, "Run as daemon")
	rootCmd.Flags().StringP("log-level", "l", "info", "Log level (debug, info, warn, error)")

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func runDaemon(cmd *cobra.Command, args []string) error {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Initialize logger
	log, err := logger.New(cfg.Logging.Level, cfg.Logging.File)
	if err != nil {
		return fmt.Errorf("failed to initialize logger: %w", err)
	}

	log.Info("Starting PacketPilot daemon", "version", version, "build", build)

	// Create daemon instance
	d, err := daemon.New(cfg, log)
	if err != nil {
		return fmt.Errorf("failed to create daemon: %w", err)
	}

	// Setup graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigChan
		log.Info("Received signal, shutting down gracefully", "signal", sig)
		cancel()
	}()

	// Start daemon
	if err := d.Start(ctx); err != nil {
		return fmt.Errorf("daemon failed: %w", err)
	}

	log.Info("PacketPilot daemon stopped")
	return nil
}

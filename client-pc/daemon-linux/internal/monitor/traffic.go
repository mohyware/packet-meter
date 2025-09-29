package monitor

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"packetpilot-daemon/internal/logger"

	"github.com/google/gopacket/pcap"
)

type InterfaceUsage struct {
	Interface string `json:"interface"`
	TotalRx   uint64 `json:"total_rx"` // bytes
	TotalTx   uint64 `json:"total_tx"` // bytes
	LastRx    uint64 `json:"last_rx"`  // last read value from /sys/class/net/*/statistics/rx_bytes
	LastTx    uint64 `json:"last_tx"`  // last read value from /sys/class/net/*/statistics/tx_bytes
}

type DailyUsage struct {
	Date        string                     `json:"date"`        // YYYY-MM-DD
	Interfaces  map[string]*InterfaceUsage `json:"interfaces"`  // interface name -> usage
}

type TrafficMonitor struct {
	config     *Config
	logger     *logger.Logger
	stopChan   chan struct{}
	
	// Daily usage tracking
	dailyUsage     *DailyUsage
	dailyMutex     sync.RWMutex
	usageFile      string
	interfaces     []string // list of interfaces to monitor
}

type Config struct {
	Interface      string
	UpdateInterval time.Duration
	BufferSize     int
	UsageFile      string // path to daily usage file
}

func NewTrafficMonitor(config *Config, logger *logger.Logger) *TrafficMonitor {
	usageFile := config.UsageFile
	if usageFile == "" {
		usageFile = "/var/lib/packetpilot/daily_usage.json"
	}
	
	return &TrafficMonitor{
		config:    config,
		logger:    logger,
		stopChan:  make(chan struct{}),
		usageFile: usageFile,
	}
}

func (tm *TrafficMonitor) Start(ctx context.Context) error {
	tm.logger.Info("Starting daily usage monitor", "interface", tm.config.Interface)

	// Find network interfaces to monitor FIRST
	if err := tm.discoverInterfaces(); err != nil {
		return fmt.Errorf("failed to discover interfaces: %w", err)
	}

	tm.logger.Info("Monitoring interfaces", "interfaces", tm.interfaces)

	// Load or initialize daily usage AFTER discovering interfaces
	if err := tm.loadDailyUsage(); err != nil {
		tm.logger.Warn("Failed to load daily usage, starting fresh", "error", err)
		tm.initDailyUsage()
	}

	// Start daily usage tracking
	go tm.trackDailyUsage(ctx)

	// Wait for context cancellation
	<-ctx.Done()
	close(tm.stopChan)

	tm.logger.Info("Daily usage monitor stopped")
	return nil
}

func (tm *TrafficMonitor) discoverInterfaces() error {
	devices, err := pcap.FindAllDevs()
	if err != nil {
		return fmt.Errorf("failed to find network devices: %w", err)
	}

	var interfaces []string
	
	if tm.config.Interface == "any" {
		// Find all active interfaces
		for _, dev := range devices {
			if len(dev.Addresses) > 0 {
				// Check if interface has statistics files
				if tm.hasInterfaceStats(dev.Name) {
					interfaces = append(interfaces, dev.Name)
				}
			}
		}
	} else {
		// Use specific interface
		if tm.hasInterfaceStats(tm.config.Interface) {
			interfaces = append(interfaces, tm.config.Interface)
		} else {
			return fmt.Errorf("interface %s not found or no statistics available", tm.config.Interface)
		}
	}

	if len(interfaces) == 0 {
		return fmt.Errorf("no suitable network interfaces found")
	}

	// Sort interfaces alphabetically
	sort.Strings(interfaces)
	tm.interfaces = interfaces
	return nil
}

func (tm *TrafficMonitor) hasInterfaceStats(iface string) bool {
	rxPath := fmt.Sprintf("/sys/class/net/%s/statistics/rx_bytes", iface)
	txPath := fmt.Sprintf("/sys/class/net/%s/statistics/tx_bytes", iface)
	
	_, err1 := os.Stat(rxPath)
	_, err2 := os.Stat(txPath)
	
	return err1 == nil && err2 == nil
}

// Daily usage tracking methods
func (tm *TrafficMonitor) loadDailyUsage() error {
	data, err := ioutil.ReadFile(tm.usageFile)
	if err != nil {
		return err
	}

	var usage DailyUsage
	if err := json.Unmarshal(data, &usage); err != nil {
		return err
	}

	// Check if it's a new day
	today := time.Now().Format("2006-01-02")
	if usage.Date != today {
		tm.logger.Info("New day detected, resetting daily usage", "old_date", usage.Date, "new_date", today)
		tm.initDailyUsage()
		return nil
	}

	// Check if we have data for all current interfaces
	missingInterfaces := []string{}
	for _, iface := range tm.interfaces {
		if _, exists := usage.Interfaces[iface]; !exists {
			missingInterfaces = append(missingInterfaces, iface)
		}
	}

	// Initialize missing interfaces
	if len(missingInterfaces) > 0 {
		tm.logger.Info("Found new interfaces, initializing them", "interfaces", missingInterfaces)
		tm.dailyMutex.Lock()
		if tm.dailyUsage == nil {
			tm.dailyUsage = &usage
		}
		for _, iface := range missingInterfaces {
			tm.initInterfaceUsageLocked(iface)
		}
		tm.dailyMutex.Unlock()
		// Save after adding new interfaces
		tm.saveDailyUsage()
	} else {
		tm.dailyMutex.Lock()
		tm.dailyUsage = &usage
		tm.dailyMutex.Unlock()
	}

	// Log loaded usage for each interface (sorted)
	sortedInterfaces := tm.getSortedInterfaceNames(usage.Interfaces)
	for _, iface := range sortedInterfaces {
		stats := usage.Interfaces[iface]
		tm.logger.Info("Loaded daily usage for interface", 
			"interface", iface,
			"date", usage.Date, 
			"total_rx_mb", float64(stats.TotalRx)/(1024*1024), 
			"total_tx_mb", float64(stats.TotalTx)/(1024*1024))
	}
	return nil
}

func (tm *TrafficMonitor) initDailyUsage() {
	today := time.Now().Format("2006-01-02")
	
	tm.dailyMutex.Lock()
	tm.dailyUsage = &DailyUsage{
		Date:       today,
		Interfaces: make(map[string]*InterfaceUsage),
	}
	
	// Initialize each interface within the lock
	for _, iface := range tm.interfaces {
		tm.initInterfaceUsageLocked(iface)
	}
	tm.dailyMutex.Unlock()

	tm.saveDailyUsage()
	tm.logger.Info("Initialized daily usage for all interfaces", "date", today, "interfaces", tm.interfaces)
}

func (tm *TrafficMonitor) initInterfaceUsage(iface string) {
	tm.dailyMutex.Lock()
	defer tm.dailyMutex.Unlock()
	tm.initInterfaceUsageLocked(iface)
}

func (tm *TrafficMonitor) initInterfaceUsageLocked(iface string) {
	// Read current interface counters
	rx, tx, err := tm.readInterfaceCounters(iface)
	if err != nil {
		tm.logger.Warn("Failed to read interface counters, starting with zeros", "interface", iface, "error", err)
		rx, tx = 0, 0
	}

	if tm.dailyUsage == nil {
		tm.dailyUsage = &DailyUsage{
			Date:       time.Now().Format("2006-01-02"),
			Interfaces: make(map[string]*InterfaceUsage),
		}
	}
	tm.dailyUsage.Interfaces[iface] = &InterfaceUsage{
		Interface: iface,
		TotalRx:   0,
		TotalTx:   0,
		LastRx:    rx,
		LastTx:    tx,
	}

	tm.logger.Info("Initialized interface usage", "interface", iface, "last_rx", rx, "last_tx", tx)
}

func (tm *TrafficMonitor) trackDailyUsage(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			tm.updateDailyUsage()
		case <-ctx.Done():
			return
		}
	}
}

func (tm *TrafficMonitor) updateDailyUsage() {
	tm.dailyMutex.Lock()
	defer tm.dailyMutex.Unlock()

	if tm.dailyUsage == nil {
		return
	}

	// Update each interface
	for iface, stats := range tm.dailyUsage.Interfaces {
		tm.updateInterfaceUsage(iface, stats)
	}

	// Save to file
	if err := tm.saveDailyUsage(); err != nil {
		tm.logger.Warn("Failed to save daily usage", "error", err)
	}
}

func (tm *TrafficMonitor) updateInterfaceUsage(iface string, stats *InterfaceUsage) {
	rx, tx, err := tm.readInterfaceCounters(iface)
	if err != nil {
		tm.logger.Warn("Failed to read interface counters", "interface", iface, "error", err)
		return
	}

	// Calculate delta since last read
	deltaRx := rx - stats.LastRx
	deltaTx := tx - stats.LastTx

	// Add to daily totals
	stats.TotalRx += deltaRx
	stats.TotalTx += deltaTx
	stats.LastRx = rx
	stats.LastTx = tx

	tm.logger.Debug("Interface usage updated",
		"interface", iface,
		"delta_rx_kb", float64(deltaRx)/1024,
		"delta_tx_kb", float64(deltaTx)/1024,
		"total_rx_mb", float64(stats.TotalRx)/(1024*1024),
		"total_tx_mb", float64(stats.TotalTx)/(1024*1024),
	)
}

func (tm *TrafficMonitor) readInterfaceCounters(iface string) (uint64, uint64, error) {
	rxPath := fmt.Sprintf("/sys/class/net/%s/statistics/rx_bytes", iface)
	txPath := fmt.Sprintf("/sys/class/net/%s/statistics/tx_bytes", iface)

	rx, err := tm.readCounter(rxPath)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to read rx counter for %s: %w", iface, err)
	}

	tx, err := tm.readCounter(txPath)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to read tx counter for %s: %w", err)
	}

	return rx, tx, nil
}

func (tm *TrafficMonitor) readCounter(path string) (uint64, error) {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return 0, err
	}
	value := strings.TrimSpace(string(data))
	return strconv.ParseUint(value, 10, 64)
}

func (tm *TrafficMonitor) saveDailyUsage() error {
	// Ensure directory exists
	dir := filepath.Dir(tm.usageFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(tm.dailyUsage, "", "  ")
	if err != nil {
		return err
	}

	return ioutil.WriteFile(tm.usageFile, data, 0644)
}

func (tm *TrafficMonitor) getSortedInterfaceNames(interfaces map[string]*InterfaceUsage) []string {
	names := make([]string, 0, len(interfaces))
	for name := range interfaces {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func (tm *TrafficMonitor) GetDailyUsage() *DailyUsage {
	tm.dailyMutex.RLock()
	defer tm.dailyMutex.RUnlock()
	
	if tm.dailyUsage == nil {
		return nil
	}
	
	// Return a copy with proper interface copying, sorted by name
	usage := DailyUsage{
		Date:       tm.dailyUsage.Date,
		Interfaces: make(map[string]*InterfaceUsage),
	}
	
	// Get sorted interface names
	sortedNames := tm.getSortedInterfaceNames(tm.dailyUsage.Interfaces)
	
	// Copy interfaces in sorted order
	for _, name := range sortedNames {
		stats := *tm.dailyUsage.Interfaces[name]
		usage.Interfaces[name] = &stats
	}
	
	return &usage
}

func (tm *TrafficMonitor) ResetStats() {
	tm.dailyMutex.Lock()
	defer tm.dailyMutex.Unlock()
	
	if tm.dailyUsage != nil {
		for _, stats := range tm.dailyUsage.Interfaces {
			stats.TotalRx = 0
			stats.TotalTx = 0
		}
		tm.saveDailyUsage()
	}
	tm.logger.Info("Daily usage statistics reset for all interfaces")
}

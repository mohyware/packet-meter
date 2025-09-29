package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"
	"github.com/subosito/gotenv"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Logging  LoggingConfig  `mapstructure:"logging"`
	Monitor  MonitorConfig  `mapstructure:"monitor"`
	Reporter ReporterConfig `mapstructure:"reporter"`
}

type ServerConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	UseTLS   bool   `mapstructure:"use_tls"`
	APIKey   string `mapstructure:"api_key"`
	DeviceID string `mapstructure:"device_id"`
}

type LoggingConfig struct {
	Level    string `mapstructure:"level"`
	File     string `mapstructure:"file"`
	MaxSize  int    `mapstructure:"max_size"`
	MaxAge   int    `mapstructure:"max_age"`
	Compress bool   `mapstructure:"compress"`
}

type MonitorConfig struct {
	Interface      string   `mapstructure:"interface"`
	UpdateInterval string   `mapstructure:"update_interval"`
	BufferSize     int      `mapstructure:"buffer_size"`
	UsageFile      string   `mapstructure:"usage_file"`
}

type ReporterConfig struct {
	ReportInterval string `mapstructure:"report_interval"`
	BatchSize      int    `mapstructure:"batch_size"`
	RetryAttempts  int    `mapstructure:"retry_attempts"`
	RetryDelay     string `mapstructure:"retry_delay"`
}

func Load() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("/etc/packetpilot/")
	viper.AddConfigPath("$HOME/.packetpilot/")

	// Optional explicit config path via env
	if cfgPath := os.Getenv("PACKETPILOT_CONFIG"); cfgPath != "" {
		viper.SetConfigFile(cfgPath)
	}

	// Load .env files (optional)
	_ = gotenv.Load()
	_ = gotenv.Load("/etc/packetpilot/.env")
	_ = gotenv.Load(filepath.Join(os.Getenv("HOME"), ".packetpilot", ".env"))

	// Set defaults
	setDefaults()

	// Read config file if present
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	}

	// Environment variable overrides: PACKETPILOT_SERVER_HOST, etc.
	viper.SetEnvPrefix("PACKETPILOT")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	if err := validate(&config); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return &config, nil
}

func setDefaults() {
	// Server defaults
	viper.SetDefault("server.host", "localhost")
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("server.use_tls", false)
	viper.SetDefault("server.device_id", getDeviceID())

	// Logging defaults
	viper.SetDefault("logging.level", "info")
	viper.SetDefault("logging.file", "/var/log/packetpilot/daemon.log")
	viper.SetDefault("logging.max_size", 100)
	viper.SetDefault("logging.max_age", 30)
	viper.SetDefault("logging.compress", true)

	// Monitor defaults
	viper.SetDefault("monitor.interface", "any")
	viper.SetDefault("monitor.update_interval", "5s")
	viper.SetDefault("monitor.buffer_size", 1000)
	viper.SetDefault("monitor.usage_file", "/var/lib/packetpilot/daily_usage.json")

	// Reporter defaults
	viper.SetDefault("reporter.report_interval", "30s")
	viper.SetDefault("reporter.batch_size", 100)
	viper.SetDefault("reporter.retry_attempts", 3)
	viper.SetDefault("reporter.retry_delay", "5s")
}

func validate(config *Config) error {
	if config.Server.Host == "" {
		return fmt.Errorf("server host cannot be empty")
	}
	if config.Server.Port <= 0 || config.Server.Port > 65535 {
		return fmt.Errorf("server port must be between 1 and 65535")
	}
	if config.Server.DeviceID == "" {
		return fmt.Errorf("device ID cannot be empty")
	}
	return nil
}

func getDeviceID() string {
	if data, err := os.ReadFile("/etc/machine-id"); err == nil {
		return strings.TrimSpace(string(data))
	}
	hostname, err := os.Hostname()
	if err != nil {
		return "unknown-device"
	}
	return hostname
}

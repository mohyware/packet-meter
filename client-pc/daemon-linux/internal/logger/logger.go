package logger

import (
	"io"
	"os"
	"path/filepath"

	"github.com/sirupsen/logrus"
)

type Logger struct {
	*logrus.Logger
}

func New(level, logFile string) (*Logger, error) {
	logger := logrus.New()
	
	// Set log level
	logLevel, err := logrus.ParseLevel(level)
	if err != nil {
		return nil, err
	}
	logger.SetLevel(logLevel)

	// Set formatter
	logger.SetFormatter(&logrus.TextFormatter{
		FullTimestamp: true,
		TimestampFormat: "2006-01-02 15:04:05",
	})

	// Set output
	if logFile != "" {
		// Ensure log directory exists
		dir := filepath.Dir(logFile)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, err
		}

		file, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			return nil, err
		}

		// Write to both file and stdout
		multiWriter := io.MultiWriter(os.Stdout, file)
		logger.SetOutput(multiWriter)
	} else {
		logger.SetOutput(os.Stdout)
	}

	return &Logger{Logger: logger}, nil
}

// Info logs a message at Info level with structured fields
func (l *Logger) Info(msg string, fields ...interface{}) {
	if len(fields) > 0 {
		// Convert fields to logrus.Fields
		logFields := make(logrus.Fields)
		for i := 0; i < len(fields); i += 2 {
			if i+1 < len(fields) {
				logFields[fields[i].(string)] = fields[i+1]
			}
		}
		l.Logger.WithFields(logFields).Info(msg)
	} else {
		l.Logger.Info(msg)
	}
}

// Error logs a message at Error level with structured fields
func (l *Logger) Error(msg string, fields ...interface{}) {
	if len(fields) > 0 {
		logFields := make(logrus.Fields)
		for i := 0; i < len(fields); i += 2 {
			if i+1 < len(fields) {
				logFields[fields[i].(string)] = fields[i+1]
			}
		}
		l.Logger.WithFields(logFields).Error(msg)
	} else {
		l.Logger.Error(msg)
	}
}

// Debug logs a message at Debug level with structured fields
func (l *Logger) Debug(msg string, fields ...interface{}) {
	if len(fields) > 0 {
		logFields := make(logrus.Fields)
		for i := 0; i < len(fields); i += 2 {
			if i+1 < len(fields) {
				logFields[fields[i].(string)] = fields[i+1]
			}
		}
		l.Logger.WithFields(logFields).Debug(msg)
	} else {
		l.Logger.Debug(msg)
	}
}

// Warn logs a message at Warn level with structured fields
func (l *Logger) Warn(msg string, fields ...interface{}) {
	if len(fields) > 0 {
		logFields := make(logrus.Fields)
		for i := 0; i < len(fields); i += 2 {
			if i+1 < len(fields) {
				logFields[fields[i].(string)] = fields[i+1]
			}
		}
		l.Logger.WithFields(logFields).Warn(msg)
	} else {
		l.Logger.Warn(msg)
	}
}

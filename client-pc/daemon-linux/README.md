## PacketPilot Daemon

A Go-based traffic monitoring daemon for Ubuntu systems that tracks network usage and reports to a central server. it gets statistics by reading the kernel-exposed RX and TX byte counters (from /sys/class/net/<interface>/statistics/{rx_bytes,tx_bytes}).

## Prerequisites

- Ubuntu 18.04+ (or other Linux distributions)
- Go 1.21+
- libpcap development libraries
- Root/sudo privileges for packet capture

## Installation

### Install Dependencies

```bash
# Install libpcap development libraries
sudo apt-get update
sudo apt-get install libpcap-dev

# Install Go (if not already installed)
wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin
```

### Build and Install

```bash
# Clone and build
git clone <repository-url>
cd PacketPilot/client-pc/daemon

# Install dependencies
make deps

# Build
make build

# Install system service
sudo make install
```

## Configuration

The daemon uses a YAML configuration file. A sample `config.yaml` is provided

## Usage

### Command Line Options

```bash
./packetpilot-daemon [flags]

Flags:
  -c, --config string     Path to config file
  -d, --daemon           Run as daemon
  -l, --log-level string Log level (debug, info, warn, error)
  -h, --help             Show help
```

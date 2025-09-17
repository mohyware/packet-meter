## Overview
Packet Pilot is a cross-platform traffic monitoring and control system for PCs and phones connected in the same network that can be self-hosted.

### Features:
- 📱 Clients (agents) running on PCs and phones that collect usage data.
- 📊 Monitoring network traffic per device and per app.
- 🌐 Server that aggregates all reports and stores usage logs.
- 🖥️ Admin dashboard (web app) to visualize all connected devices usage in real-time.
- 🔒 Admin can block specific apps or websites with firewall for specific devices.

## Architecture

- Client (service/agent)
    - Runs on PCs and phones.
    - Monitors per-app traffic usage (upload/download, active sessions).
    - Sends periodic reports (JSON payloads) to the server.
    - Listens for admin commands (e.g., “block Facebook” for a given device).
    - On phones: Could be a background service (Android → foreground service with accessibility + VPN-based monitoring, iOS is more restricted).

- Server
    - Central controller for all connected devices.
    - Collects usage logs from clients.
    - Stores in database for history/analytics.
    - Issues block commands to clients.
    - Handles authentication & admin roles.

- Admin GUI
    - Web app dashboard.
    - Shows devices → apps → usage stats (per time window).
    - Control panel to block/unblock apps or limit usage.
    - Charts (bandwidth, app categories, top apps, etc.).

## Tech Stacks
- Client (service on PC & Phone)
    - For pc:
        - Daemon
            - Go → easy networking, smaller footprint, simpler than C++.
            - For PC: Use OS APIs (Windows: ETW, Mac: NetworkExtension, Linux: netlink/iptables).
        - Web App GUI
            - Frontend:React + Tailwind for modern dashboard.
            - Charts: Recharts, Chart.js, or Plotly.
    - For Phone:
        - Android: Use VPNService API → acts as a local VPN to capture per-app traffic.
        - iOS: Very restrictive → need MDM (mobile device management) or supervised devices.

- Server
    - Backend:
        - Go (Gin/Fiber) → efficient and lightweight.
        - Node.js (NestJS/Express) → if you prefer JS/TS ecosystem.

    - Database:
        - sqlite
        - Postgres → structured, reliable for analytics.
        - ClickHouse → if you want high-performance traffic analytics at scale.



- Communication
    - gRPC → efficient binary protocol for server-client commands.
    - WebSocket/MQTT → for real-time updates (app blocking, live stats).
    - HTTPS REST → for bulk reporting.
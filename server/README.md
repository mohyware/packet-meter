# PacketMeter Server

Central Node.js TypeScript server with PostgreSQL + Drizzle ORM for managing users, devices, and network usage reports.

## Features

- **User Management**: Google OAuth authentication with session-based sessions
- **Device Management**: Create devices, generate activation tokens with QR codes
- **Device Activation**: Devices activate on first health check
- **Usage Reports**: Store and retrieve network traffic data per device
- **Database**: PostgreSQL with Drizzle ORM for type-safe queries
- **CORS**: Configured for frontend access

## Prerequisites

- Node.js (v18+)
- PostgreSQL database

## Setup

For detailed setup instructions, you can find more in [SETUP.md](./SETUP.md).

## Database Schema

- **users**: User accounts
- **sessions**: Active user sessions
- **devices**: User devices with activation tokens
- **reports**: Daily usage reports per device
- **interfaces**: Per-interface statistics for each report

## Device Activation Flow

1. User creates a device via `/api/v1/devices`
2. Server generates a unique 64-character hex token and QR code
3. Token is hashed and stored in database
4. Device is created with `isActivated: false`
5. Device uses token to call `/api/v1/device/health-check`
6. Device is marked as `activated`
7. Device can now submit traffic reports using the same token

## TODOs:

1. Add other check from user in setup 5
2. Refactors

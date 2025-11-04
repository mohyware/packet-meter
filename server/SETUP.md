# Setup Guide

Follow these steps to get the PacketPilot server up and running.

## 1. Install PostgreSQL

### Windows
Download from [PostgreSQL downloads page](https://www.postgresql.org/download/windows/)

### macOS
```bash
brew install postgresql
brew services start postgresql
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

## 2. Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE packetpilot;

# Create user (optional but recommended)
CREATE USER packetpilot_user WITH PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE packetpilot TO packetpilot_user;

# Exit psql
\q
```

## 3. Install Dependencies

```bash
cd server
npm install
```

## 4. Configure Environment

Create a `.env` file in the `server` directory:

```env
# Server Configuration
PACKETPILOT_SERVER_PORT=8080
NODE_ENV=development

# Session Secret (generate a random string)
SESSION_SECRET=your-super-secret-key-change-this-in-production

# Database Configuration
# Format: postgresql://username:password@localhost:5432/database_name
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/packetpilot
```

**Important:** 
- Replace `postgres:postgres` with your actual username and password
- Replace `localhost:5432` if your PostgreSQL is running on a different host/port
- Generate a secure `SESSION_SECRET` for production

## 5. Initialize Database Schema

```bash
# Option A: Push schema directly (recommended for dev)
npm run db:push

# Option B: Generate and run migrations (recommended for production)
npm run db:generate
npm run db:migrate
```

## 6. Start Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm run build
npm start
```

The server should now be running on `http://localhost:8080`

## 7. Verify Setup

```bash
# Test health endpoint
curl http://localhost:8080/health

# Should return: {"ok":true}
```

## Optional: View Database

```bash
# Open Drizzle Studio
npm run db:studio

# This will open a web interface at http://localhost:4983
```
**Backup regularly**
   ```bash
   pg_dump packetpilot > backup.sql
   ```
   
## Next Steps

1. Register a user: `POST /api/v1/auth/register`
2. Create a device: `POST /api/v1/devices` (requires login)
3. Get the device token and QR code
4. Configure your daemon to use the token
5. Device will activate on first health check
6. View usage reports: `GET /api/v1/devices/:deviceId/usage`


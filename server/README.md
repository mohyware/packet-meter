# PacketPilot TypeScript Server

Minimal Node.js TypeScript server that accepts traffic reports from the PacketPilot daemon.

## Run

```bash
cd server-ts
npm install
# or: pnpm i / yarn

# dev mode (autoreload)
PACKETPILOT_API_KEY=supersecret npm run dev

# or build and start
npm run build
PACKETPILOT_API_KEY=supersecret npm start
```

## Endpoint

- POST `/api/v1/traffic/report`
  - Auth: `Authorization: Bearer <PACKETPILOT_API_KEY>`
  - Body: JSON

## Healthcheck

- GET `/health` -> `{ ok: true }`

## Environment

- `PACKETPILOT_API_KEY` (required)
- `PACKETPILOT_SERVER_PORT` (optional, default 8080)

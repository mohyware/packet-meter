# API Reference

Complete API documentation for PacketPilot Server.

## Base URL

```
http://localhost:8080
```

## Authentication

### User Authentication (Session-based)

User endpoints use session cookies for authentication. Login creates a session automatically.

### Device Authentication (Bearer Token)

Device endpoints use Bearer tokens:

```
Authorization: Bearer <device-token>
```

---

## User Endpoints

### Register User

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "john",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "user created",
  "user": {
    "id": "uuid",
    "username": "john",
    "email": "john@example.com"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "invalid payload",
  "error": {
    "username": ["Expected string, received number"]
  }
}
```

**Response (409 Conflict):**
```json
{
  "success": false,
  "message": "Username or email already exists"
}
```

---

### Login User

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "john",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "login successful",
  "user": {
    "id": "uuid",
    "username": "john",
    "email": "john@example.com"
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "invalid credentials"
}
```

---

### Logout User

```http
POST /api/v1/auth/logout
Cookie: connect.sid=...
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "logout successful"
}
```

---

### Get Current User

```http
GET /api/v1/auth/me
Cookie: connect.sid=...
```

**Response (200 OK):**
```json
{
  "success": true,
  "userId": "uuid"
}
```

---

## Device Endpoints

### Create Device

```http
POST /api/v1/devices
Cookie: connect.sid=...
Content-Type: application/json

{
  "name": "My Home PC"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "device created",
  "device": {
    "id": "uuid",
    "name": "My Home PC",
    "isActivated": false,
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "token": "abc123def456...",
  "qrCode": "data:image/png;base64,..."
}
```

---

### List Devices

```http
GET /api/v1/devices
Cookie: connect.sid=...
```

**Response (200 OK):**
```json
{
  "success": true,
  "devices": [
    {
      "id": "uuid",
      "name": "My Home PC",
      "isActivated": true,
      "lastHealthCheck": "2024-01-01T00:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "name": "My Laptop",
      "isActivated": false,
      "lastHealthCheck": null,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### Get Device Usage

```http
GET /api/v1/devices/:deviceId/usage?limit=100
Cookie: connect.sid=...
```

**Response (200 OK):**
```json
{
  "success": true,
  "reports": [
    {
      "id": "uuid",
      "deviceId": "uuid",
      "timestamp": "2024-01-01T00:00:00Z",
      "date": "2024-01-01",
      "totalRxMB": "1234.56",
      "totalTxMB": "567.89",
      "createdAt": "2024-01-01T00:00:00Z",
      "interfaces": [
        {
          "id": "uuid",
          "deviceId": "uuid",
          "reportId": "uuid",
          "name": "eth0",
          "totalRx": "1234567890",
          "totalTx": "567890123",
          "totalRxMB": "1234.56",
          "totalTxMB": "567.89"
        }
      ]
    }
  ]
}
```

---

## Device Management Endpoints

### Health Check

Activates the device if not already activated.

```http
POST /api/v1/device/health-check
Authorization: Bearer <device-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "health check received",
  "device": {
    "id": "uuid",
    "name": "My Home PC"
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "invalid device token"
}
```

---

### Submit Traffic Report

```http
POST /api/v1/traffic/report
Authorization: Bearer <device-token>
Content-Type: application/json

{
  "DeviceId": "uuid",
  "Timestamp": "2024-01-01T00:00:00Z",
  "Date": "2024-01-01",
  "Interfaces": [
    {
      "Interface": "eth0",
      "TotalRx": 1234567890,
      "TotalTx": 567890123,
      "TotalRxMB": 1234.56,
      "TotalTxMB": 567.89
    },
    {
      "Interface": "wlan0",
      "TotalRx": 987654321,
      "TotalTx": 123456789,
      "TotalRxMB": 987.65,
      "TotalTxMB": 123.46
    }
  ],
  "TotalRxMB": 2222.21,
  "TotalTxMB": 691.35
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "received",
  "commands": []
}
```

---

## Utility Endpoints

### Health Check

```http
GET /health
```

**Response (200 OK):**
```json
{
  "ok": true
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "error description"
}
```

Common error codes:

- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication required)
- `409` - Conflict (resource already exists)
- `500` - Internal Server Error

---

## Examples

### Complete Workflow

```bash
# 1. Register a user
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john","email":"john@example.com","password":"securepass123"}' \
  -c cookies.txt

# 2. Create a device
curl -X POST http://localhost:8080/api/v1/devices \
  -H "Content-Type: application/json" \
  -d '{"name":"My PC"}' \
  -b cookies.txt

# Response includes device token and QR code

# 3. On the device, send health check (device activates)
curl -X POST http://localhost:8080/api/v1/device/health-check \
  -H "Authorization: Bearer <device-token>"

# 4. Submit usage report
curl -X POST http://localhost:8080/api/v1/traffic/report \
  -H "Authorization: Bearer <device-token>" \
  -H "Content-Type: application/json" \
  -d @report.json

# 5. View usage from web client
curl http://localhost:8080/api/v1/devices/<deviceId>/usage \
  -b cookies.txt
```

---

## Rate Limiting

Currently no rate limiting is implemented. Consider adding for production use.

## CORS

CORS is not configured by default. Configure if accessing from web browsers on different origins.


# RFID Tracking System API Documentation

## Overview

The RFID Tracking System provides a comprehensive REST API for managing assets, RFID readers, floor plans, and generating reports. All endpoints require authentication unless otherwise specified.

## Authentication

### Base URL
```
http://localhost:5000/api
```

### Authentication Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

## API Endpoints

### Authentication

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "fullName": "string",
  "department": "string" // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "fullName": "string",
      "role": "user",
      "department": "string"
    },
    "token": "jwt_token"
  }
}
```

#### POST /auth/login
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "fullName": "string",
      "role": "user",
      "department": "string"
    },
    "token": "jwt_token"
  }
}
```

#### GET /auth/me
Get current authenticated user information.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "fullName": "string",
      "role": "user",
      "department": "string"
    }
  }
}
```

### Assets

#### GET /assets
List all assets with optional filtering and pagination.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `search` (string): Search in name, RFID tag, or description
- `department` (string): Filter by department
- `status` (string): Filter by status (active, missing, maintenance, inactive)
- `zone` (uuid): Filter by current zone

**Response:**
```json
{
  "success": true,
  "data": {
    "assets": [
      {
        "id": "uuid",
        "name": "string",
        "rfidTag": "string",
        "assetType": "string",
        "description": "string",
        "acquisitionDate": "date",
        "value": "number",
        "department": "string",
        "status": "active",
        "currentZoneId": "uuid",
        "zoneName": "string",
        "lastSeenAt": "timestamp",
        "createdBy": "string",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 100,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

#### GET /assets/:id
Get detailed information about a specific asset.

**Response:**
```json
{
  "success": true,
  "data": {
    "asset": {
      "id": "uuid",
      "name": "string",
      "rfidTag": "string",
      "assetType": "string",
      "description": "string",
      "acquisitionDate": "date",
      "value": "number",
      "department": "string",
      "status": "active",
      "currentZoneId": "uuid",
      "zoneName": "string",
      "lastSeenAt": "timestamp",
      "createdBy": "string",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    },
    "recentMovements": [
      {
        "id": "uuid",
        "fromZoneId": "uuid",
        "fromZoneName": "string",
        "toZoneId": "uuid",
        "toZoneName": "string",
        "movementType": "automatic",
        "movedBy": "string",
        "notes": "string",
        "timestamp": "timestamp"
      }
    ]
  }
}
```

#### POST /assets
Create a new asset. Requires 'admin' or 'user' role.

**Request Body:**
```json
{
  "name": "string",
  "rfidTag": "string",
  "assetType": "string",
  "description": "string", // optional
  "acquisitionDate": "date", // optional
  "value": "number", // optional
  "department": "string" // optional
}
```

#### PUT /assets/:id
Update an existing asset. Requires 'admin' or 'user' role.

**Request Body:** Same as POST /assets

#### DELETE /assets/:id
Delete an asset. Requires 'admin' role.

#### GET /assets/stats/overview
Get asset statistics overview.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAssets": 150,
    "activeAssets": 140,
    "missingAssets": 5,
    "maintenanceAssets": 3,
    "trackedAssets": 145
  }
}
```

### RFID

#### POST /rfid/reading
Process an RFID reading from a reader device.

**Request Body:**
```json
{
  "rfidTag": "string",
  "readerId": "uuid",
  "signalStrength": "number", // optional, -100 to 0
  "timestamp": "timestamp" // optional, defaults to current time
}
```

**Response:**
```json
{
  "success": true,
  "message": "RFID reading processed successfully",
  "data": {
    "assetId": "uuid",
    "previousZone": "uuid",
    "currentZone": "uuid",
    "action": "moved" // or "updated"
  }
}
```

#### GET /rfid/readers
List all RFID readers.

**Response:**
```json
{
  "success": true,
  "data": {
    "readers": [
      {
        "id": "uuid",
        "name": "string",
        "location": "string",
        "zoneId": "uuid",
        "zoneName": "string",
        "readerType": "fixed", // or "portable"
        "ipAddress": "ip_address",
        "isActive": true,
        "isOnline": true,
        "lastHeartbeat": "timestamp",
        "totalReadings": 1250,
        "createdAt": "timestamp"
      }
    ]
  }
}
```

#### POST /rfid/readers
Create a new RFID reader. Requires 'admin' role.

**Request Body:**
```json
{
  "name": "string",
  "location": "string",
  "zoneId": "uuid", // optional
  "readerType": "fixed", // or "portable"
  "ipAddress": "ip_address" // optional
}
```

#### PUT /rfid/readers/:id
Update an RFID reader. Requires 'admin' role.

#### GET /rfid/readings
Get RFID reading history with filtering.

**Query Parameters:**
- `limit` (number): Number of readings (default: 50)
- `assetId` (uuid): Filter by asset
- `readerId` (uuid): Filter by reader
- `since` (timestamp): Filter readings since timestamp

#### POST /rfid/simulate
Simulate an RFID reading for testing. Requires 'admin' role.

**Request Body:**
```json
{
  "rfidTag": "string",
  "readerId": "uuid"
}
```

### Floor Plans

#### GET /floor-plan
List all active floor plans.

**Response:**
```json
{
  "success": true,
  "data": {
    "floorPlans": [
      {
        "id": "uuid",
        "name": "string",
        "description": "string",
        "imageUrl": "string",
        "zonesCount": 12,
        "createdBy": "string",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    ]
  }
}
```

#### GET /floor-plan/:id
Get detailed floor plan with zones and assets.

**Response:**
```json
{
  "success": true,
  "data": {
    "floorPlan": {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "svgData": "string",
      "imageUrl": "string",
      "createdBy": "string",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    },
    "zones": [
      {
        "id": "uuid",
        "name": "string",
        "description": "string",
        "zoneType": "room",
        "coordinates": {},
        "isRestricted": false,
        "assetsCount": 5,
        "createdAt": "timestamp"
      }
    ],
    "assets": [
      {
        "id": "uuid",
        "name": "string",
        "rfidTag": "string",
        "assetType": "string",
        "zoneName": "string",
        "zoneId": "uuid",
        "lastSeenAt": "timestamp"
      }
    ]
  }
}
```

#### POST /floor-plan
Create a new floor plan. Requires 'admin' or 'user' role.

**Request:** Multipart form data
- `name` (string): Floor plan name
- `description` (string): Optional description
- `image` (file): Floor plan image file

#### POST /floor-plan/:floorPlanId/zones
Create a zone within a floor plan. Requires 'admin' or 'user' role.

**Request Body:**
```json
{
  "name": "string",
  "description": "string", // optional
  "zoneType": "room", // optional, default "room"
  "coordinates": {}, // optional
  "isRestricted": false // optional, default false
}
```

#### PUT /floor-plan/zones/:zoneId
Update a zone. Requires 'admin' or 'user' role.

#### DELETE /floor-plan/zones/:zoneId
Delete a zone. Requires 'admin' role.

### Reports

#### GET /reports/dashboard
Get dashboard statistics and recent activity.

**Response:**
```json
{
  "success": true,
  "data": {
    "assetStats": {
      "total_assets": 150,
      "active_assets": 140,
      "missing_assets": 5,
      "maintenance_assets": 3,
      "tracked_assets": 145
    },
    "readerStats": {
      "total_readers": 25,
      "active_readers": 24,
      "online_readers": 23
    },
    "recentAlerts": [
      {
        "id": "uuid",
        "assetId": "uuid",
        "assetName": "string",
        "alertType": "unauthorized_movement",
        "severity": "high",
        "message": "string",
        "isAcknowledged": false,
        "createdAt": "timestamp"
      }
    ],
    "assetsByDepartment": [
      {
        "department": "IT",
        "count": 45
      }
    ],
    "recentMovements": [
      {
        "id": "uuid",
        "assetName": "string",
        "fromZone": "string",
        "toZone": "string",
        "movementType": "automatic",
        "timestamp": "timestamp"
      }
    ]
  }
}
```

#### GET /reports/inventory
Get inventory report with filtering.

**Query Parameters:**
- `department` (string): Filter by department
- `status` (string): Filter by status
- `zone` (uuid): Filter by zone

#### GET /reports/movements
Get movement history report.

**Query Parameters:**
- `assetId` (uuid): Filter by asset
- `startDate` (date): Start date for filtering
- `endDate` (date): End date for filtering
- `limit` (number): Number of results (default: 100)

#### GET /reports/alerts
Get alerts report.

**Query Parameters:**
- `severity` (string): Filter by severity
- `acknowledged` (boolean): Filter by acknowledgment status
- `limit` (number): Number of results (default: 50)

#### POST /reports/alerts/:id/acknowledge
Acknowledge an alert.

**Response:**
```json
{
  "success": true,
  "message": "Alert acknowledged successfully"
}
```

### Users (Admin Only)

#### GET /users
List all users. Requires 'admin' role.

#### PUT /users/:id
Update user role, department, or active status. Requires 'admin' role.

**Request Body:**
```json
{
  "role": "admin", // optional: admin, user, auditor
  "department": "string", // optional
  "isActive": true // optional
}
```

## Error Handling

All API endpoints return errors in the following format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": {} // Additional error details when applicable
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid or missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

## Real-time Updates

The system uses Socket.IO for real-time updates. Connect to the WebSocket endpoint to receive live asset tracking updates:

**WebSocket Events:**
- `asset_update` - Emitted when an asset location changes

**Example:**
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

socket.on('asset_update', (data) => {
  console.log('Asset moved:', data);
  // {
  //   assetId: "uuid",
  //   rfidTag: "string",
  //   currentZoneId: "uuid",
  //   lastSeenAt: "timestamp",
  //   readerId: "uuid"
  // }
});
```

## Rate Limiting

The API implements rate limiting to prevent abuse:
- 100 requests per 15-minute window per IP address
- Authentication endpoints have stricter limits

## Security

- All passwords are hashed using bcrypt
- JWT tokens expire based on configuration (default: 7 days)
- Input validation using Joi schemas
- SQL injection protection through parameterized queries
- CORS protection configured
- Helmet.js for security headers
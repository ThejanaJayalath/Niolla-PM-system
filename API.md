# Niolla PM – API Documentation

**Base URL:** `http://localhost:5000/api/v1`  
**Content-Type:** `application/json`

---

## Response format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Success with meta (e.g. duplicate phone alert):**
```json
{
  "success": true,
  "data": { ... },
  "meta": { "duplicatePhone": true }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

**Validation error (400):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "First validation message",
    "details": [ ... ]
  }
}
```

---

## Authentication

Protected routes require:

```
Authorization: Bearer <JWT_TOKEN>
```

Get a token via `POST /auth/login`. Use it in the `Authorization` header for all other endpoints except `/auth/register` and `/health`.

---

## Endpoints overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/auth/login` | No | Login |
| POST | `/auth/register` | No | Register user |
| GET | `/inquiries` | Yes | List inquiries |
| GET | `/inquiries/check-phone` | Yes | Check duplicate phone |
| POST | `/inquiries` | Yes | Create inquiry |
| GET | `/inquiries/:id` | Yes | Get inquiry |
| PATCH | `/inquiries/:id` | Yes | Update inquiry |
| DELETE | `/inquiries/:id` | Yes | Delete inquiry |
| GET | `/reminders/upcoming` | Yes | Upcoming reminders |
| GET | `/reminders/inquiry/:inquiryId` | Yes | Reminders by inquiry |
| POST | `/reminders` | Yes | Create reminder |
| GET | `/reminders/:id` | Yes | Get reminder |
| PATCH | `/reminders/:id` | Yes | Update reminder |
| DELETE | `/reminders/:id` | Yes | Delete reminder |
| POST | `/proposals` | Yes | Create proposal |
| GET | `/proposals/inquiry/:inquiryId` | Yes | Get proposal by inquiry |
| GET | `/proposals/:id` | Yes | Get proposal |
| GET | `/proposals/:id/pdf` | Yes | Download proposal PDF |

---

## 1. Health

### GET `/health`

No auth. Check if API is running.

**Response (200):**
```json
{
  "success": true,
  "message": "Niolla PM API is running"
}
```

---

## 2. Auth

### POST `/auth/login`

**Body:**
```json
{
  "email": "admin@niolla.com",
  "password": "admin123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Valid email |
| password | string | Yes | User password |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "...",
      "email": "admin@niolla.com",
      "name": "Admin",
      "role": "admin",
      "createdAt": "...",
      "updatedAt": "..."
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error (401):**
```json
{
  "success": false,
  "error": { "code": "UNAUTHORIZED", "message": "Invalid email or password" }
}
```

---

### POST `/auth/register`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "secret123",
  "name": "John Doe",
  "role": "admin"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Valid email |
| password | string | Yes | Min 6 characters |
| name | string | Yes | Display name |
| role | string | No | `"admin"` or `"user"` (default: `"admin"`) |

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error (400):** User with this email already exists.

---

## 3. Inquiries

All inquiry endpoints require `Authorization: Bearer <token>`.

### GET `/inquiries`

List all inquiries. Optional filter by status.

**Query:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | No | `new`, `contacted`, `proposal_sent`, `negotiating`, `won`, `lost` |

**Example:** `GET /inquiries?status=new`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "customerName": "Acme Corp",
      "phoneNumber": "0771234567",
      "projectDescription": "Web app for inventory",
      "requiredFeatures": ["Dashboard", "Reports"],
      "internalNotes": "Follow up next week",
      "status": "new",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

### GET `/inquiries/check-phone`

Check if a phone number already exists (duplicate check).

**Query:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| phoneNumber | string | Yes | Phone to check |
| excludeId | string | No | Inquiry ID to exclude (e.g. when editing) |

**Example:** `GET /inquiries/check-phone?phoneNumber=0771234567`

**Response (200):**
```json
{
  "success": true,
  "data": { "duplicate": true }
}
```

---

### POST `/inquiries`

Create a new inquiry. Response may include `meta.duplicatePhone` if the phone already exists.

**Body:**
```json
{
  "customerName": "Acme Corp",
  "phoneNumber": "0771234567",
  "projectDescription": "Need a web app for inventory management.",
  "requiredFeatures": ["Dashboard", "Reports", "Export"],
  "internalNotes": "Budget around 50k"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| customerName | string | Yes | Customer full name |
| phoneNumber | string | Yes | Contact number |
| projectDescription | string | Yes | Project description |
| requiredFeatures | string[] | Yes | Array of feature names |
| internalNotes | string | No | Internal notes |

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "customerName": "Acme Corp",
    "phoneNumber": "0771234567",
    "projectDescription": "...",
    "requiredFeatures": ["Dashboard", "Reports", "Export"],
    "internalNotes": "Budget around 50k",
    "status": "new",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "meta": { "duplicatePhone": false }
}
```

---

### GET `/inquiries/:id`

Get one inquiry by ID.

**Response (200):** Single inquiry object.  
**Error (404):** Inquiry not found.

---

### PATCH `/inquiries/:id`

Update an inquiry. Send only fields to update.

**Body (all optional):**
```json
{
  "customerName": "Acme Corp",
  "phoneNumber": "0771234567",
  "projectDescription": "...",
  "requiredFeatures": ["Dashboard", "Reports"],
  "internalNotes": "...",
  "status": "contacted"
}
```

| Field | Type | Description |
|-------|------|-------------|
| status | string | `new`, `contacted`, `proposal_sent`, `negotiating`, `won`, `lost` |

**Response (200):** Updated inquiry object.  
**Error (404):** Inquiry not found.

---

### DELETE `/inquiries/:id`

Delete an inquiry.

**Response (204):** No body.  
**Error (404):** Inquiry not found.

---

## 4. Reminders

All reminder endpoints require `Authorization: Bearer <token>`.

### GET `/reminders/upcoming`

List upcoming reminders and meetings (not completed).

**Query:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| limit | number | No | Max 1–100 (default: 20) |

**Example:** `GET /reminders/upcoming?limit=10`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "inquiryId": "...",
      "type": "meeting",
      "title": "Follow-up call",
      "scheduledAt": "2025-02-01T10:00:00.000Z",
      "notes": "Discuss proposal",
      "completed": false,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

### GET `/reminders/inquiry/:inquiryId`

List all reminders for one inquiry.

**Response (200):** Array of reminder objects.

---

### POST `/reminders`

Create a reminder or meeting.

**Body:**
```json
{
  "inquiryId": "64a1b2c3d4e5f6789012345",
  "type": "meeting",
  "title": "Follow-up call",
  "scheduledAt": "2025-02-01T10:00:00.000Z",
  "notes": "Discuss proposal"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| inquiryId | string | Yes | Valid MongoDB ObjectId (inquiry ID) |
| type | string | Yes | `"reminder"` or `"meeting"` |
| title | string | Yes | Title |
| scheduledAt | string | Yes | ISO 8601 date-time |
| notes | string | No | Optional notes |

**Response (201):** Created reminder object.

---

### GET `/reminders/:id`

Get one reminder by ID.

**Response (200):** Single reminder object.  
**Error (404):** Reminder not found.

---

### PATCH `/reminders/:id`

Update a reminder. Send only fields to update.

**Body (all optional):**
```json
{
  "title": "Updated title",
  "scheduledAt": "2025-02-02T14:00:00.000Z",
  "notes": "...",
  "completed": true
}
```

**Response (200):** Updated reminder object.  
**Error (404):** Reminder not found.

---

### DELETE `/reminders/:id`

Delete a reminder.

**Response (204):** No body.  
**Error (404):** Reminder not found.

---

## 5. Proposals

All proposal endpoints require `Authorization: Bearer <token>`.

### POST `/proposals`

Create a proposal for an inquiry. Customer name, project description, and required features are copied from the inquiry.

**Body:**
```json
{
  "inquiryId": "64a1b2c3d4e5f6789012345",
  "milestones": [
    { "title": "Phase 1 – Design", "amount": 5000, "description": "UI/UX", "dueDate": "2025-03-01" },
    { "title": "Phase 2 – Development", "amount": 15000 }
  ],
  "totalAmount": 20000,
  "validUntil": "2025-02-15",
  "notes": "Prices in USD"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| inquiryId | string | Yes | Valid inquiry ID |
| milestones | array | Yes | At least one milestone |
| milestones[].title | string | Yes | Milestone title |
| milestones[].amount | number | Yes | Amount |
| milestones[].description | string | No | Description |
| milestones[].dueDate | string | No | Due date (e.g. YYYY-MM-DD) |
| totalAmount | number | Yes | Total amount |
| validUntil | string | No | Proposal valid until |
| notes | string | No | Optional notes |

**Response (201):** Created proposal object (includes `customerName`, `projectDescription`, `requiredFeatures` from inquiry).

**Error (400):** Inquiry not found.

---

### GET `/proposals/inquiry/:inquiryId`

Get the latest proposal for an inquiry.

**Response (200):** Single proposal object.  
**Error (404):** No proposal found for this inquiry.

---

### GET `/proposals/:id`

Get a proposal by ID.

**Response (200):** Single proposal object.  
**Error (404):** Proposal not found.

---

### GET `/proposals/:id/pdf`

Download the proposal as a PDF file. Same as other endpoints: send `Authorization: Bearer <token>`.

**Response (200):**
- **Content-Type:** `application/pdf`
- **Content-Disposition:** `attachment; filename="proposal-...-.pdf"`
- Body: PDF binary

**Error (404):** Proposal not found.

---

## HTTP status codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (e.g. DELETE) |
| 400 | Bad Request (validation or business error) |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (insufficient role) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Error codes

| Code | Description |
|------|-------------|
| VALIDATION_ERROR | Request body or query validation failed |
| UNAUTHORIZED | Invalid or missing JWT |
| FORBIDDEN | User role not allowed |
| NOT_FOUND | Resource not found |
| BAD_REQUEST | Other client error |
| INTERNAL_ERROR | Server error |

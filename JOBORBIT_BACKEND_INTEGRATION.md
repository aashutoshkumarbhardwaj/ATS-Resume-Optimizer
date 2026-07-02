# Job Orbit Backend Integration Guide

## Overview
This document describes what the Job Orbit backend (`https://job-orbit-flax.vercel.app`) needs to implement to complete the extension authentication flow.

---

## Required Implementation on Job Orbit Backend

### 1. Auth Page: `/extension-auth`

**Purpose**: OAuth callback page that handles extension authentication

**Location**: `https://job-orbit-flax.vercel.app/extension-auth`

**Query Parameters Received**:
```javascript
{
  extensionId: "abcdef123456", // Chrome extension ID
  state: "abc123xyz",           // CSRF protection token
  nonce: "1234567890000"        // Additional security parameter
}
```

**Responsibilities**:
1. Display login UI (email/password or OAuth)
2. Authenticate user
3. Create or fetch user from Job Orbit database
4. Send authentication response back to extension
5. Close the auth tab after sending response

**How to Send Response Back to Extension**:

```javascript
// After successful authentication, send message to extension

const extensionId = new URLSearchParams(window.location.search).get('extensionId');
const state = new URLSearchParams(window.location.search).get('state');

// Send message to extension
chrome.runtime.sendMessage(extensionId, {
  type: 'JOBORBIT_AUTH_RESPONSE',
  state: state, // Echo back the state for CSRF validation
  data: {
    extensionToken: "jwt_token_from_backend", // Optional (can generate in backend instead)
    expiresIn: 86400, // 24 hours in seconds
    user: {
      id: "user_123",
      email: "user@example.com",
      name: "John Doe",
      avatar: "https://..." // Optional
    }
  }
}, (response) => {
  if (chrome.runtime.lastError) {
    console.error('Failed to send message:', chrome.runtime.lastError);
  } else {
    console.log('Message sent to extension successfully');
    // Close the auth tab
    window.close();
  }
});
```

**Important Notes**:
- The `extensionId` is the unique ID of the user's installed extension
- The `state` parameter must be echoed back for CSRF validation
- If `chrome.runtime.sendMessage` fails, the extension popup is not open
- Always try to close the window after sending the message
- Consider adding a 2-second delay before `window.close()` to ensure message is received

---

### 2. Backend Token Generation (Optional)

**Current Flow**: Extension JWT is generated on ATS-Resume-Optimizer backend

**Alternative Flow**: Job Orbit backend can generate the token instead

If Job Orbit backend generates the token:

```javascript
// Option 1: Generate token on Job Orbit backend
const token = jwt.sign(
  {
    type: 'extension',
    user_id: user.id,
    email: user.email,
    extension_id: extensionId
  },
  'shared-secret-key', // Must match backend JWT_SECRET
  {
    expiresIn: '24h',
    algorithm: 'HS256'
  }
);

// Send in response
chrome.runtime.sendMessage(extensionId, {
  type: 'JOBORBIT_AUTH_RESPONSE',
  state: state,
  data: {
    extensionToken: token,
    expiresIn: 86400,
    user: { id, email, name }
  }
});
```

---

### 3. Optional: Dedicated Auth Endpoint

**Endpoint**: `POST /api/extension/auth/login`

**Purpose**: Generate extension token from credentials

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "extensionId": "abcdef123456"
}
```

**Response**:
```json
{
  "success": true,
  "extensionToken": "jwt_token",
  "expiresIn": 86400,
  "user": {
    "id": "user_123",
    "email": "user@example.com"
  }
}
```

---

## ATS-Resume-Optimizer Backend Support

### Backend Endpoints Already Implemented

**1. POST `/api/extension-auth/verify`**
- Input: Supabase token + extensionId
- Output: Extension JWT token
- Use case: Web authentication → extension token

**2. POST `/api/extension-auth/refresh`**
- Input: Extension token + extensionId
- Output: New extension JWT token
- Use case: Refresh expired tokens

**3. POST `/api/extension-auth/sync`**
- Input: Extension token
- Output: Sync status
- Use case: Sync extension data with backend

### Configuration

**Environment Variables** (in `.env`):
```
EXTENSION_JWT_SECRET=your-secret-key
SUPABASE_URL=https://dsbkjkwefszqqzukgdtk.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

---

## Complete Flow Diagram

```
┌─────────────────────┐
│  Extension Popup    │
│  (Chrome)           │
└──────────┬──────────┘
           │
           │ Click "Login with Job Orbit"
           ▼
┌─────────────────────────────────────────┐
│ Open: https://job-orbit-flax.vercel.app │
│       /extension-auth?extensionId=...   │
│       &state=xyz&nonce=abc              │
└─────────────────────┬───────────────────┘
                      │
                      │ User authenticates
                      │ (Email/Password/OAuth)
                      │
                      ▼
            ┌──────────────────────┐
            │ Validate credentials │
            │ Create/get user      │
            └──────────┬───────────┘
                       │
                       │ Send message back
                       ▼
        ┌──────────────────────────────────┐
        │ chrome.runtime.sendMessage(      │
        │   extensionId,                   │
        │   {                              │
        │     type: 'JOBORBIT_AUTH...',    │
        │     state: state,                │
        │     data: { token, user, ... }   │
        │   }                              │
        │ )                                │
        └──────────────────────────────────┘
                       │
                       │ Message received
                       ▼
            ┌──────────────────────┐
            │ Extension Service    │
            │ Worker               │
            │ (onMessageExternal)  │
            └──────────┬───────────┘
                       │
                       │ Store token
                       ▼
            ┌──────────────────────┐
            │ chrome.storage.sync  │
            │ { jobOrbitAuth: ... }│
            └──────────┬───────────┘
                       │
                       │ Notify popup
                       ▼
            ┌──────────────────────┐
            │ Popup updates UI     │
            │ Shows: ✓ Connected   │
            │ Shows user email     │
            │ Shows sync button    │
            └──────────────────────┘
```

---

## Testing Checklist for Job Orbit

- [ ] Auth page loads with query parameters
- [ ] User can authenticate on the page
- [ ] After auth, `chrome.runtime.sendMessage()` is called
- [ ] Message includes `extensionId`, `state`, and user data
- [ ] Auth tab closes after message is sent
- [ ] Extension receives and processes the message
- [ ] Token is stored in Chrome storage
- [ ] Extension UI updates to show "Already Logged In"

---

## Troubleshooting

### Message Not Being Received

**Possible Causes**:
1. Wrong `extensionId` passed in query params
2. Extension popup not listening when message is sent
3. Browser security blocking the message
4. Typo in message type: must be exactly `'JOBORBIT_AUTH_RESPONSE'`

**Debug Steps**:
1. Check browser console for errors
2. Verify `chrome.runtime.sendMessage()` callback for errors
3. Test by keeping popup open while authenticating
4. Add logging to extension service worker

### CORS Issues

If calling backend from auth page:

```javascript
// Use credentials and proper headers
fetch('https://backend-url/api/..., {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
})
```

Backend CORS is already configured to accept requests.

---

## Security Considerations

1. **State Validation**: Extension validates state parameter - Don't forget to echo it back
2. **CSRF Protection**: State changes every login - Implement timeout (15 minutes)
3. **Token Expiry**: Should be reasonably short (24 hours recommended)
4. **HTTPS Only**: Auth page must be served over HTTPS
5. **Nonce**: Additional parameter for extra security - can be ignored or validated

---

## Questions?

Contact: Backend team or check extension logs for debugging

Extension Logs: Open Chrome DevTools → Extensions → Select extension → Check service worker logs

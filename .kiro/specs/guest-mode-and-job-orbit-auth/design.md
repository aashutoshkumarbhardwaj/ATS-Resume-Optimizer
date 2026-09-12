# Design: Guest Mode and Job Orbit Authentication System

## Overview

The Guest Mode and Job Orbit Authentication system introduces a two-tier user experience for the ATS Resume Optimizer Chrome extension. Users begin in Guest Mode with access to core resume optimization features (ATS scoring, JD extraction, autofill) powered by local processing and no authentication. Job Orbit Mode, accessed via Supabase OAuth (Google, GitHub, Microsoft), unlocks premium features including cloud synchronization, multi-device access, application tracking, and AI memory.

The design emphasizes:
- **Immediate value**: Guest Mode requires zero setup
- **Frictionless upgrade**: OAuth enables premium features without passwords
- **Data portability**: Cloud sync keeps users' work synchronized
- **Resilience**: Offline-first approach with automatic retry
- **Security**: Token encryption and HTTPS-only communication

## Architecture

### High-Level System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome Extension (Popup)                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Guest Mode UI          │      Job Orbit Mode UI            │ │
│  │  • Resume optimize      │  • Resume optimize                │ │
│  │  • Extract JD           │  • Extract JD                     │ │
│  │  • Autofill (local)     │  • Autofill (cloud-synced)        │ │
│  │  • "Sign in" button     │  • Application tracker            │ │
│  │                         │  • AI memory viewer               │ │
│  │                         │  • Sync status                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │        Authentication Manager (Token Handling)              │ │
│  │  • OAuth flow initiation                                    │ │
│  │  • Token storage (Chrome storage, encrypted)               │ │
│  │  • Token refresh logic                                     │ │
│  │  • Session state management                                │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │        Data Sync Manager (Local ↔ Cloud)                   │ │
│  │  • Debounced writes                                        │ │
│  │  • Queue on failure, retry on reconnect                   │ │
│  │  • Last-write-wins conflict resolution                    │ │
│  │  • Cache management                                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌─────────────────────┐
                    │    Website Login    │
                    │  (OAuth redirect)   │
                    └─────────────────────┘
                              │
                              ↓
                    ┌─────────────────────┐
                    │     Supabase Auth   │
                    │ (OAuth Providers)   │
                    └─────────────────────┘
                              │
                              ↓
                    ┌─────────────────────┐
                    │  Supabase Database  │
                    │  (Profiles, Data)   │
                    └─────────────────────┘
```

### Authentication Flow Diagram

**Guest Mode (No Authentication)**
```
User Opens Extension
    → Check Chrome storage for tokens
    → No tokens found
    → Render Guest Mode UI
    → User accesses features locally
    → Data optionally stored in Chrome storage
```

**Job Orbit OAuth Flow**
```
User Clicks "Sign in to Job Orbit"
    → Open OAuth redirect URL in new tab
    → Supabase OAuth consent screen
    → User selects provider (Google/GitHub/Microsoft)
    → Supabase redirects to callback URL with auth code
    → Website backend exchanges code for tokens
    → Website sends tokens to extension via postMessage/storage listener
    → Extension stores tokens in Chrome storage (encrypted)
    → Extension switches to Job Orbit Mode UI
    → Automatic fetch of synced data from cloud
```

**Session Sharing**
```
Website Login
    → Store token in shared location (Chrome storage key)
    → Extension detects token via storage listener
    → Extension switches to Job Orbit Mode

Extension Login
    → Store token in shared location
    → Website detects token (polling or listener)
    → Website switches to authenticated state
```

## Components and Interfaces

### 1. Authentication Manager Component

**Purpose**: Handle OAuth flow, token storage, and session management

**Key Methods**:
- `initiateOAuthFlow(provider)` → Opens OAuth URL
- `exchangeCodeForTokens(code)` → Gets tokens from Supabase
- `storeTokens(accessToken, refreshToken)` → Encrypts and stores in Chrome storage
- `getAccessToken()` → Retrieves current token (refresh if expired)
- `refreshAccessToken()` → Uses refresh token to get new access token
- `logout()` → Clears all tokens and returns to Guest Mode
- `isAuthenticated()` → Checks if valid tokens exist

**Data Structures**:
```
Token = {
  access_token: string,
  refresh_token: string,
  expires_at: number (unix timestamp),
  provider: string (google|github|microsoft)
}

ChromeStorageKeys = {
  TOKENS: "auth_tokens_encrypted",
  GUEST_DATA: "guest_data",
  SYNC_QUEUE: "sync_queue",
  CACHE: "cloud_cache"
}
```

### 2. Data Sync Manager Component

**Purpose**: Handle bidirectional sync between local storage and cloud

**Key Methods**:
- `syncResume(resumeData)` → PATCH/POST to Supabase
- `syncApplication(appData)` → PATCH/POST to Supabase
- `fetchResumes()` → GET from Supabase, cache locally
- `fetchApplications()` → GET from Supabase, cache locally
- `fetchAIMemory()` → GET from Supabase, cache locally
- `queueSyncOperation(operation)` → Queue failed operations
- `retryQueuedOperations()` → Process queued operations on reconnect
- `resolveSyncConflict(local, remote)` → Apply last-write-wins
- `clearCache()` → Flush local cache

**Data Structures**:
```
SyncOperation = {
  id: uuid,
  type: string (CREATE|UPDATE|DELETE),
  resource: string (resume|application|ai_memory),
  payload: object,
  timestamp: number,
  retryCount: number,
  lastError?: string
}

Cache = {
  resumes: [Resume],
  applications: [Application],
  ai_memory: [AIMemory],
  lastFetch: {
    resumes: number,
    applications: number,
    ai_memory: number
  }
}
```

### 3. Guest Mode Feature Handler

**Purpose**: Execute core features that work in both Guest and Job Orbit modes

**Key Methods**:
- `optimizeResume(resumeText, jobDescription)` → Call backend API (no auth required)
- `extractJobDescription(text)` → Parse JD and extract keywords
- `autofillForm(resumeData, formFields)` → Populate form with resume data
- `calculateATSScore(resumeText, jobDescription)` → Score computation
- `saveGuestData(data)` → Store locally if "Remember my data" enabled
- `loadGuestData()` → Retrieve locally stored guest data

### 4. UI State Manager

**Purpose**: Render appropriate UI based on authentication state

**UI States**:
- `GUEST_MODE`: Show core features + "Sign in" button
- `JOB_ORBIT_UNAUTHENTICATED`: OAuth flow in progress
- `JOB_ORBIT_AUTHENTICATED`: Show all features + user email + "Sign out"
- `JOB_ORBIT_OFFLINE`: Show cached data + "Syncing when online..."
- `ERROR`: Show error message + retry option

### 5. Chrome Storage Encryption

**Purpose**: Secure token storage in Chrome storage

**Implementation**:
- Use Chrome's native `chrome.storage.sync` for encrypted storage
- Tokens encrypted using chrome-specific keys (browser-managed)
- Alternative: Use TweetNaCl.js for client-side encryption if needed
- Never store plaintext tokens in Chrome storage

## Data Models

### Supabase Tables

**1. Profiles Table**
```
profiles:
  id: UUID (Primary Key)
  user_id: UUID (Foreign Key - Supabase Auth)
  email: string (Indexed)
  provider_id: string (OAuth provider ID)
  subscription_status: enum (free|premium)
  preferences: JSONB {
    theme: string,
    resume_template: string,
    preferred_keywords: string[]
  }
  created_at: timestamp
  updated_at: timestamp
  deleted_at: timestamp (soft delete)
```

**2. Resumes Table**
```
resumes:
  id: UUID (Primary Key)
  profile_id: UUID (Foreign Key)
  title: string
  file_format: enum (text|pdf|docx)
  content: text (Resume content)
  content_hash: string (MD5 of content for change detection)
  created_at: timestamp
  updated_at: timestamp
  deleted_at: timestamp (soft delete)
  Indexes: (profile_id, updated_at) for fast fetch
```

**3. Applications Table**
```
applications:
  id: UUID (Primary Key)
  profile_id: UUID (Foreign Key)
  job_title: string
  company: string
  job_url: string (Optional)
  job_description: text
  application_date: timestamp
  status: enum (applied|interviewing|rejected|offered|withdrawn)
  notes: text (Optional user notes)
  created_at: timestamp
  updated_at: timestamp
  deleted_at: timestamp (soft delete)
  Indexes: (profile_id, application_date DESC) for sorting
```

**4. AI_Memory Table**
```
ai_memory:
  id: UUID (Primary Key)
  profile_id: UUID (Foreign Key)
  question_type: enum (resume_optimization|jd_extraction|autofill)
  context: JSONB {
    job_role: string,
    keywords: string[],
    industry: string
  }
  response_content: text (AI-generated response)
  feedback_score: integer (-1|0|1)
  created_at: timestamp
  updated_at: timestamp
  deleted_at: timestamp (soft delete)
  Indexes: (profile_id, created_at DESC)
```

### Supabase RLS (Row-Level Security) Policies

Each table should enforce:
- Users can only SELECT/UPDATE/DELETE their own rows (matching `profile_id` to authenticated user)
- Users cannot INSERT directly; only backend can create records
- Soft deletes (updated `deleted_at` timestamp) for data retention compliance

## API Endpoints (Backend Integration)

### Authentication Endpoints

**1. POST /auth/oauth/callback**
```
Input: { code: string, provider: string }
Output: { access_token, refresh_token, expires_in }
Purpose: Exchange OAuth code for tokens (Supabase handles this)
```

**2. POST /auth/refresh**
```
Input: { refresh_token: string }
Output: { access_token, expires_in }
Purpose: Get new access token using refresh token
```

**3. POST /auth/logout**
```
Input: { authorization: Bearer token }
Output: { success: boolean }
Purpose: Invalidate tokens (optional backend tracking)
```

### Profile Endpoints

**1. GET /profile**
```
Headers: Authorization: Bearer token
Output: Profile object
Purpose: Fetch authenticated user's profile
```

**2. PATCH /profile**
```
Headers: Authorization: Bearer token
Input: { subscription_status?, preferences? }
Output: Updated Profile object
Purpose: Update profile data (auto-sync from extension)
```

### Resume Endpoints

**1. GET /resumes**
```
Headers: Authorization: Bearer token
Output: [Resume]
Purpose: Fetch all resumes for authenticated user
```

**2. POST /resumes**
```
Headers: Authorization: Bearer token
Input: { title, file_format, content }
Output: Created Resume object
Purpose: Create new resume
```

**3. PATCH /resumes/{id}**
```
Headers: Authorization: Bearer token
Input: { title?, file_format?, content? }
Output: Updated Resume object
Purpose: Update resume (auto-sync from extension)
```

**4. DELETE /resumes/{id}**
```
Headers: Authorization: Bearer token
Output: { success: boolean }
Purpose: Delete resume
```

### Application Endpoints

**1. GET /applications**
```
Headers: Authorization: Bearer token
Output: [Application]
Purpose: Fetch all applications for authenticated user
```

**2. POST /applications**
```
Headers: Authorization: Bearer token
Input: { job_title, company, job_description, application_date, status }
Output: Created Application object
Purpose: Create application record
```

**3. PATCH /applications/{id}**
```
Headers: Authorization: Bearer token
Input: { status?, notes? }
Output: Updated Application object
Purpose: Update application status
```

**4. DELETE /applications/{id}**
```
Headers: Authorization: Bearer token
Output: { success: boolean }
Purpose: Delete application record
```

### AI Memory Endpoints

**1. GET /ai-memory**
```
Headers: Authorization: Bearer token
Query: { question_type?, limit?, offset? }
Output: [AIMemory]
Purpose: Fetch AI memory entries with filtering
```

**2. POST /ai-memory**
```
Headers: Authorization: Bearer token
Input: { question_type, context, response_content }
Output: Created AIMemory object
Purpose: Store AI response for future reference
```

**3. PATCH /ai-memory/{id}**
```
Headers: Authorization: Bearer token
Input: { feedback_score }
Output: Updated AIMemory object
Purpose: Update feedback on AI response
```

## Error Handling Strategy

**Categories**:

1. **Authentication Errors**
   - Invalid token → Refresh token or logout
   - Token expired → Automatic refresh
   - Refresh token invalid → Force re-authentication
   - OAuth cancelled by user → Return to Guest Mode (non-blocking)

2. **Network Errors**
   - No connectivity → Queue operation, cache locally
   - Timeout → Retry with exponential backoff
   - Server 5xx → Retry with exponential backoff

3. **Data Errors**
   - Sync conflict → Apply last-write-wins resolution
   - Migration failure → Log error, allow manual retry
   - Validation failure → Display user-friendly error

4. **UI Errors**
   - Popup render error → Fallback to Guest Mode
   - Storage quota exceeded → Warn user, allow cleanup

## Testing Strategy

### Unit Tests

**Areas**:
- Token storage and encryption/decryption
- Sync operation queueing and retry logic
- Conflict resolution (last-write-wins)
- OAuth state machine (various completion scenarios)
- Guest data migration validation
- Cache invalidation logic

**Examples**:
- Test that expired tokens trigger refresh
- Test that offline operations are queued
- Test that queued operations retry on reconnect
- Test that conflicting updates use latest timestamp
- Test that guest data migrates with all fields
- Test that encryption/decryption are idempotent

### Integration Tests

**Areas**:
- Full OAuth flow (mock Supabase)
- Profile creation and update flow
- Resume creation, fetch, update, delete flow
- Application tracking flow
- Session sharing between website and extension
- First-login migration flow

**Tools**:
- Mock Supabase using Jest or similar
- Simulate Chrome storage and extension APIs
- Test cross-tab communication

### Property-Based Tests

**Properties to validate** (see Correctness Properties section below):
- Token refresh idempotence
- Sync queue ordering preservation
- Data consistency across devices
- Cache freshness validation
- OAuth state completeness

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Token Refresh Idempotence

For any expired access token with a valid refresh token, calling refresh multiple times (due to race conditions or retries) SHALL produce a valid new token without creating invalid states or orphaned sessions.

**Validates: Requirements 2.7, 3.5**

### Property 2: Sync Operation Ordering

For any sequence of sync operations queued offline and later executed online, the final cloud state SHALL reflect all operations in the order they were queued (FIFO ordering) or use last-write-wins if the same resource is modified multiple times.

**Validates: Requirements 7.6, 8.6**

### Property 3: Cache Consistency

For any cloud data fetched and cached locally, when the extension is closed and reopened, the cached data SHALL match the current cloud state (no stale reads after sync completes).

**Validates: Requirements 10.3, 10.4, 10.5**

### Property 4: First-Login Migration Round Trip

For any guest user migrating to Job Orbit Mode, all locally-stored resume and preference data SHALL be successfully migrated to cloud storage such that a second-device login retrieves the exact same data (no data loss or corruption).

**Validates: Requirements 6.2, 6.3, 6.4**

### Property 5: Multi-Device Consistency

For any user authenticated on two devices, performing updates on Device A and then opening the extension on Device B SHALL retrieve the latest state from Device A (reflecting the update).

**Validates: Requirements 10.1, 10.2, 10.3**

### Property 6: Offline-First Resilience

For any user in offline mode performing a sync-required operation, the operation SHALL be queued successfully and executed upon reconnection without data loss.

**Validates: Requirements 14.2, 14.3**

### Property 7: Authentication State Completeness

For any successful OAuth completion, the resulting authentication state SHALL include access token, refresh token, token expiration time, and profile metadata—sufficient to authenticate subsequent API calls.

**Validates: Requirements 3.4, 3.5, 4.1**

### Property 8: Token Encryption

For any access token stored in Chrome storage, the token SHALL be encrypted such that reading it directly from storage without decryption SHALL NOT reveal the plaintext token.

**Validates: Requirements 13.1, 3.4**

## Notes

- Supabase OAuth is configured for Google, GitHub, and Microsoft providers
- Backend is deployed on Render (as per existing infrastructure)
- Chrome storage provides encrypted sync across user's Chrome instances
- All API endpoints use Bearer token authentication
- Soft deletes maintain data for compliance (GDPR/CCPA)
- Feature gating is dynamic via feature matrix (can be updated server-side without code changes)
- Last-write-wins strategy: timestamp-based conflict resolution ensures eventual consistency
- Debouncing prevents excessive writes during rapid user interactions


## Correctness Properties (Detailed)

Based on the prework analysis, the following properties have been identified as suitable for property-based testing. These properties formalize the universal behaviors that must hold across all valid inputs and states.

### Property 1: Token Refresh Idempotence

*For any* expired access token with a valid refresh token, performing the refresh operation multiple times (due to race conditions or automatic retries) SHALL produce a valid new access token each time, with no invalid states or orphaned sessions.

**Rationale**: When multiple API calls encounter an expired token simultaneously, they may trigger multiple refresh attempts. Each refresh must succeed independently and produce a usable token.

**Validates: Requirements 2.7, 3.5**

### Property 2: Sync Operation FIFO Ordering

*For any* sequence of sync operations queued while offline, when connectivity is restored and operations execute, the final cloud state SHALL reflect operations applied in the same order they were queued (for different resources) or use last-write-wins strategy (for the same resource modified multiple times).

**Rationale**: If a user edits Resume A, then Resume B offline, the cloud should reflect both edits in that order. If Resume A is edited twice offline, only the latest edit should persist (last-write-wins by timestamp).

**Validates: Requirements 7.6, 8.6, 10.6**

### Property 3: Cache Consistency After Sync

*For any* synced data fetched from cloud and cached locally, after a sync operation completes successfully, immediately re-fetching the data SHALL return the same content as what is currently cached (no divergence between cache and cloud after sync confirmation).

**Rationale**: Cache must remain truthful. After confirming a sync succeeded, the cache should match cloud state until the next change.

**Validates: Requirements 10.3, 10.4, 10.5**

### Property 4: First-Login Migration Round Trip

*For any* guest user with locally-stored resume data, after authenticating and accepting the migration offer, fetching the profile's resumes from cloud on a second device SHALL return data with the same structure, content, and metadata (allowing for minor formatting differences but preserving all meaningful data).

**Rationale**: Migration must preserve data integrity. A user should not lose any information when moving from guest to authenticated mode.

**Validates: Requirements 6.2, 6.3, 6.4, 6.5**

### Property 5: Multi-Device Last-Write-Wins Consistency

*For any* resource (resume, application, or preference) that is modified on Device A and then accessed on Device B within the same session, Device B SHALL retrieve the version with the latest timestamp, ensuring eventual consistency across devices.

**Rationale**: Simultaneous updates on different devices should not cause permanent divergence. The system should always converge to the state of the most recent edit.

**Validates: Requirements 10.1, 10.2, 10.6**

### Property 6: Offline-First Queue Preservation

*For any* sync operation that fails due to network unavailability, the operation SHALL be persisted to the sync queue such that after reconnection and automatic retry, the operation either succeeds or is retried with exponential backoff until manually cancelled or max retries exceeded.

**Rationale**: Operations initiated offline should not be silently lost. They must be queued and reliably processed when connectivity returns.

**Validates: Requirements 14.2, 14.3**

### Property 7: OAuth State Completeness

*For any* successful OAuth completion, the resulting authentication state stored in Chrome storage SHALL contain: access_token, refresh_token, expiration_timestamp, and provider_identifier—sufficient for at least one subsequent authenticated API call without additional OAuth interaction.

**Rationale**: A successful OAuth flow must produce a complete, usable authentication state. Any missing component would require re-authentication.

**Validates: Requirements 3.4, 3.5, 4.1**

### Property 8: Token Encryption

*For any* access token stored in Chrome storage, direct binary or text examination of the stored Chrome storage value SHALL not reveal the plaintext token (i.e., the stored value must be cryptographically distinct from the token value).

**Rationale**: Tokens in storage must not be readable in plaintext. Encryption must be applied before storage.

**Validates: Requirements 13.1, 3.4**

### Property 9: Guest Data Isolation in Guest Mode

*For any* guest user in Guest Mode who saves resume preferences, those preferences SHALL be stored only in Chrome local storage and SHALL NOT be sent to any cloud endpoint until the user authenticates and explicitly accepts migration.

**Rationale**: Guest Mode must be truly local-first. No data should leak to the cloud without explicit user action.

**Validates: Requirements 1.6, 1.7, 12.1, 12.2**

### Property 10: Access Control on Profile Data

*For any* Profile fetched via GET /profile endpoint with a valid access token for User A, the returned Profile SHALL always correspond to User A and SHALL never contain fields or data belonging to User B or other users, even if a malformed request is sent.

**Rationale**: User data must be isolated. The backend must enforce row-level security regardless of request content.

**Validates: Requirements 5.5, 13.5**

### Property Reflection

Upon review of the 10 properties identified, each provides unique validation value:
- Properties 1-3 test core data sync mechanisms (idempotence, ordering, cache consistency)
- Properties 4-5 test multi-device and migration scenarios
- Property 6 tests offline resilience
- Property 7-8 test authentication completeness and security
- Property 9 tests guest mode isolation
- Property 10 tests access control

No properties are logically redundant. Each addresses a distinct correctness concern.

## Testing Strategy

### Unit Tests

Unit tests focus on specific scenarios and edge cases that property tests may not fully cover:

**Core Functionality**:
- Guest Mode features: optimize, extract JD, autofill with provided test data
- Token storage/retrieval: encrypt, decrypt, validate token structure
- Cache operations: add, update, invalidate, clear cache
- Sync queue operations: enqueue, dequeue, persist to storage

**Edge Cases**:
- Empty resume passed to optimization
- Whitespace-only input to JD extraction
- Missing form fields during autofill
- Expired token with no refresh token (force re-auth)
- Sync queue with 1000+ operations
- Migration with corrupted local data

**Error Handling**:
- Network timeout scenarios
- Invalid OAuth response from Supabase
- Malformed API responses
- Chrome storage quota exceeded
- Token decryption failure (corrupted data)

**Data Validation**:
- Resume content exceeds size limit
- Application status invalid enum value
- AI Memory feedback score outside range (-1, 0, 1)
- Profile preference malformed JSON

### Property-Based Tests

Property-based tests systematically verify universal correctness properties using randomized input generation:

**For Property 1: Token Refresh Idempotence**
- Generate random valid tokens with past expiration times
- Invoke refresh 2-5 times in parallel
- Verify each refresh succeeds and produces valid tokens
- Verify no duplicate sessions or orphaned tokens

**For Property 2: Sync Operation FIFO Ordering**
- Generate 5-20 random sync operations for different resources
- Queue all operations while simulating offline mode
- Trigger reconnection
- Verify operations execute in queue order
- Verify cloud state matches expected final state

**For Property 3: Cache Consistency After Sync**
- Generate random resume data
- Store in cache and cloud
- Perform modifications via sync
- Verify cache matches fetched cloud state

**For Property 4: First-Login Migration Round Trip**
- Generate random guest resume data (various formats and sizes)
- Migrate to authenticated account
- Fetch on second device
- Verify round-trip equality (content preserved)

**For Property 5: Multi-Device Last-Write-Wins**
- Generate random edits to same resource on two simulated devices
- Vary timestamp order (Device A latest, then Device B latest)
- Verify retrieved version matches device with latest timestamp

**For Property 6: Offline-First Queue Preservation**
- Generate 10-50 sync operations while offline
- Verify each operation is queued successfully
- Trigger reconnection
- Verify all queued operations are processed

**For Property 7: OAuth State Completeness**
- Generate random OAuth responses from Supabase
- Parse and store authentication state
- Verify all required fields present
- Verify enough information to make authenticated API call

**For Property 8: Token Encryption**
- Generate random token strings
- Encrypt using storage method
- Verify encrypted value differs from plaintext
- Verify decryption recovers original token

**For Property 9: Guest Data Isolation**
- Generate random guest resume and preference data
- Save in Guest Mode
- Verify no API calls made to cloud storage
- Verify data only in Chrome local storage

**For Property 10: Access Control**
- Generate profiles for different users
- Attempt to fetch with User A token, expecting User A profile
- Verify response only contains User A data
- Attempt boundary case queries
- Verify access control enforced

### Integration Tests

Integration tests verify end-to-end flows with mocked external services:

**OAuth Flow Integration**
- Mock Supabase OAuth endpoint
- Simulate full OAuth redirect flow
- Verify tokens received and stored correctly
- Verify extension UI updates to Job Orbit Mode

**Profile Creation and Updates**
- Mock Supabase database
- Create profile via OAuth
- Update profile preferences
- Verify Supabase state matches

**Resume Sync Integration**
- Mock Supabase database
- Add resume in Job Orbit Mode
- Verify PATCH request to backend
- Fetch resumes on second device
- Verify all resumes retrieved

**Application Tracking Integration**
- Mock backend application endpoint
- Submit application via extension
- Verify POST request received
- Update application status
- Verify status persists in cloud

**Session Sharing Integration**
- Mock Chrome storage and listeners
- Simulate website login
- Verify extension detects and updates
- Simulate extension logout
- Verify website detects and updates

**First-Login Migration Integration**
- Generate guest resume data
- Authenticate new user
- Verify migration offer appears
- Accept migration
- Verify data in Supabase
- Verify data accessible on second device

**Offline Resilience Integration**
- Simulate network disconnection
- Queue multiple operations
- Simulate network reconnection
- Verify operations retried and succeeded
- Verify cloud state consistent

### Configuration

**Unit Tests**:
- Framework: Jest (Node.js, Chrome extensions compatible)
- Execution: `npm test -- --testPathPattern=unit`
- Coverage target: 80%+

**Property-Based Tests**:
- Framework: fast-check (JavaScript/TypeScript)
- Minimum iterations: 100 per property
- Seed: deterministic for reproducibility
- Execution: `npm test -- --testPathPattern=property`
- Configuration: `fast-check` with { numRuns: 100, timeout: 5000 }

**Integration Tests**:
- Framework: Jest with node-fetch and mock-server
- Mocking: jest.mock() for Supabase and backend
- Execution: `npm test -- --testPathPattern=integration`
- Note: Run with `INTEGRATION_TEST=true` environment variable

**Example Test Tags** (for Property Tests):
```javascript
describe("Feature: guest-mode-and-job-orbit-auth", () => {
  it("Property 1: Token refresh idempotence", () => {
    // Fast-check property test
    // Tag: Feature: guest-mode-and-job-orbit-auth, Property 1: Token refresh idempotence
  });
  
  it("Property 2: Sync operation FIFO ordering", () => {
    // Fast-check property test
    // Tag: Feature: guest-mode-and-job-orbit-auth, Property 2: Sync operation FIFO ordering
  });
});
```

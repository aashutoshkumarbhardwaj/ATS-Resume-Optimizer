# Implementation Plan: Guest Mode and Job Orbit Authentication System

## Overview

This implementation plan transforms the ATS Resume Optimizer into a two-tier authentication system using JavaScript/Node.js for the backend and JavaScript for the Chrome extension. The plan follows an incremental approach, building authentication infrastructure first, then core features, then sync mechanisms, and finally multi-device support. Each task builds on previous steps without orphaned code.

## Tasks

- [ ] 1. Set up authentication infrastructure and token management
  - [ ] 1.1 Create Chrome storage encryption utility
    - Write utility functions for token encryption/decryption using Chrome storage APIs
    - Test encryption roundtrip (encrypt → decrypt should equal original)
    - _Requirements: 13.1, 3.4_
  
  - [ ]* 1.2 Write property test for token encryption
    - **Property 8: Token encryption**
    - **Validates: Requirements 13.1, 3.4**
  
  - [ ] 1.3 Create Authentication Manager class in extension
    - Write initiateOAuthFlow(), exchangeCodeForTokens(), storeTokens(), getAccessToken(), refreshAccessToken(), logout() methods
    - Handle token expiration and automatic refresh logic
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7_
  
  - [ ]* 1.4 Write property test for token refresh idempotence
    - **Property 1: Token refresh idempotence**
    - **Validates: Requirements 2.7, 3.5**
  
  - [ ] 1.5 Set up Supabase OAuth callback endpoint on website
    - Create `/auth/oauth/callback` endpoint to exchange OAuth code for Supabase tokens
    - Configure Supabase OAuth providers (Google, GitHub, Microsoft)
    - Return tokens to extension via postMessage/storage listener
    - _Requirements: 2.1, 2.2, 2.3, 3.2, 3.3, 3.4_

- [ ] 2. Implement core guest mode features in extension
  - [ ] 2.1 Create Guest Mode feature handler
    - Write optimizeResume(), extractJobDescription(), autofillForm() functions
    - These call existing backend API without authentication
    - _Requirements: 1.2, 1.3, 1.4_
  
  - [ ]* 2.2 Write property tests for guest mode features
    - **Property 2: Guest data isolation (partial - local storage)**
    - **Validates: Requirements 1.2, 1.3, 1.4, 12.1, 12.2**
  
  - [ ] 2.3 Create guest data persistence layer
    - Write saveGuestData() and loadGuestData() functions using Chrome storage
    - Save resume text, autofill preferences, settings with "Remember my data" flag
    - _Requirements: 1.6, 1.7, 12.1, 12.2_
  
  - [ ]* 2.4 Write property tests for guest data persistence
    - **Property 9: Guest data isolation**
    - **Validates: Requirements 1.6, 1.7, 12.1, 12.2**

- [ ] 3. Implement UI state management and guest mode popup
  - [ ] 3.1 Create UI State Manager
    - Write state machine for GUEST_MODE, JOB_ORBIT_UNAUTHENTICATED, JOB_ORBIT_AUTHENTICATED, JOB_ORBIT_OFFLINE, ERROR states
    - Manage state transitions based on authentication status and connectivity
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [ ] 3.2 Build Guest Mode popup UI
    - Render "Guest Mode" header with available features (Resume Optimize, Extract JD, Autofill)
    - Display "Sign in to Job Orbit" button
    - Hide premium feature indicators
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 15.1_
  
  - [ ]* 3.3 Write unit tests for UI state transitions
    - Test state changes on authentication, logout, offline detection
    - _Requirements: 15.1, 15.2, 15.3_

- [ ] 4. Implement OAuth flow in extension and website
  - [ ] 4.1 Add "Sign in to Job Orbit" button handler to extension popup
    - Call authenticateWithProvider(provider) which opens OAuth URL in new tab
    - Listen for tokens from website via storage listener
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ] 4.2 Create OAuth token listener in extension background script
    - Listen for tokens stored by website callback handler
    - Automatically update extension popup to Job Orbit Mode when tokens received
    - Validate received tokens before using them
    - _Requirements: 3.3, 3.4, 3.5, 3.7_
  
  - [ ]* 4.3 Write integration tests for OAuth flow
    - Mock Supabase OAuth endpoint
    - Simulate full redirect flow with token passing
    - Verify extension updates to Job Orbit Mode
    - _Requirements: 3.1-3.7_
  
  - [ ] 4.4 Add session sharing between website and extension
    - Website stores token in shared Chrome storage location on successful login
    - Extension checks for token in shared location on initialization
    - Website listening for token changes from extension
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5. Create Supabase data models and backend endpoints
  - [ ] 5.1 Create Supabase tables (profiles, resumes, applications, ai_memory)
    - Define schema with all fields from design document
    - Set up primary keys, foreign keys, and indexes
    - Enable row-level security (RLS) policies
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 5.2 Set up RLS policies for data isolation
    - Write policies ensuring users can only access their own Profile, Resumes, Applications, AI_Memory
    - Block cross-user access at database level
    - _Requirements: 5.5, 13.5_
  
  - [ ] 5.3 Create backend Profile endpoints (GET, PATCH)
    - GET /profile returns authenticated user's profile
    - PATCH /profile updates profile with subscription status and preferences
    - Verify user owns profile before returning data
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ]* 5.4 Write property test for access control
    - **Property 10: Access control on profile data**
    - **Validates: Requirements 5.5, 13.5**

- [ ] 6. Create Resume sync endpoints
  - [ ] 6.1 Create backend Resume endpoints (GET, POST, PATCH, DELETE)
    - GET /resumes returns all resumes for authenticated user
    - POST /resumes creates new resume
    - PATCH /resumes/{id} updates resume content/metadata
    - DELETE /resumes/{id} soft-deletes resume
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [ ] 6.2 Implement content hash tracking
    - Store content_hash in Resume table for change detection
    - Compute MD5 hash of resume content
    - Use hash to detect modifications (avoid unnecessary updates)
    - _Requirements: 7.2_
  
  - [ ]* 6.3 Write integration tests for Resume endpoints
    - Create, fetch, update, delete resumes
    - Verify user isolation
    - _Requirements: 7.1-7.4_

- [ ] 7. Implement Data Sync Manager in extension
  - [ ] 7.1 Create sync queue persistence
    - Write SyncOperation objects to Chrome storage when offline
    - Include type (CREATE|UPDATE|DELETE), resource type, payload, timestamp, retry count
    - Retrieve queue on reconnection
    - _Requirements: 14.2, 14.3, 7.6_
  
  - [ ] 7.2 Implement debounced writes for local-to-cloud sync
    - Write debounceSync() function with 1-2 second delay
    - Batch multiple rapid changes to same resource into single PATCH
    - Prevents excessive API calls during user editing
    - _Requirements: 7.7, 8.7_
  
  - [ ]* 7.3 Write property test for sync operation ordering
    - **Property 2: Sync operation FIFO ordering**
    - **Validates: Requirements 7.6, 8.6, 10.6**
  
  - [ ] 7.4 Implement network error handling and retry logic
    - Catch network errors and queue operations
    - Implement exponential backoff retry (1s, 2s, 4s, 8s, 16s max)
    - Retry queued operations when connectivity restored
    - _Requirements: 14.1, 14.2, 14.3_
  
  - [ ]* 7.5 Write integration tests for sync queue
    - Queue operations while offline
    - Simulate network reconnection
    - Verify all operations processed in order
    - _Requirements: 14.2, 14.3, 7.6_

- [ ] 8. Implement resume sync in extension
  - [ ] 8.1 Create resume input handler in extension
    - Detect when user updates resume text in extension UI
    - Call syncResume() via Data Sync Manager
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 8.2 Implement cache management for resumes
    - Fetch resumes on extension open and cache locally
    - Update cache when sync completes
    - Display cached resumes to user
    - _Requirements: 10.4, 10.5_
  
  - [ ]* 8.3 Write property test for cache consistency
    - **Property 3: Cache consistency after sync**
    - **Validates: Requirements 10.3, 10.4, 10.5**

- [ ] 9. Create Application tracking endpoints and sync
  - [ ] 9.1 Create backend Application endpoints (GET, POST, PATCH, DELETE)
    - GET /applications returns sorted by application_date DESC
    - POST /applications creates new application record
    - PATCH /applications/{id} updates status and notes
    - DELETE /applications/{id} soft-deletes application
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ] 9.2 Add application autofill detection
    - Detect when user submits job application form
    - Extract job details (title, company, URL)
    - Auto-POST to /applications endpoint
    - _Requirements: 8.1_
  
  - [ ]* 9.3 Write integration tests for Application endpoints
    - Create, fetch, update, delete applications
    - Verify auto-sync on form submission
    - _Requirements: 8.1-8.4_

- [ ] 10. Implement first-login guest data migration
  - [ ] 10.1 Create migration detection logic
    - Check if guest data exists in Chrome storage on authentication
    - Show "Import my guest data" dialog to user
    - _Requirements: 6.1, 6.2_
  
  - [ ] 10.2 Implement migration execution
    - Parse guest resume and preference data
    - Create Resume records in Supabase for each guest resume
    - Create Profile preferences from guest settings
    - Clear guest data from Chrome storage after successful migration
    - _Requirements: 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 10.3 Write property test for migration round trip
    - **Property 4: First-login migration round trip**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5**
  
  - [ ] 10.4 Handle migration failures gracefully
    - Log and display error if migration fails
    - Allow user to retry or skip migration
    - _Requirements: 6.6, 14.1_

- [ ] 11. Implement Job Orbit Mode popup UI
  - [ ] 11.1 Create Job Orbit Mode popup layout
    - Display "Job Orbit Mode" header with user email
    - Show "Sign out" button
    - Display quick access links (View Resumes, Applications, AI Memory)
    - Show sync status indicator
    - _Requirements: 15.2, 15.5, 15.6, 15.7_
  
  - [ ] 11.2 Add sync status display
    - Show "Syncing..." indicator with percentage when operations in progress
    - Show "Sync complete" when all operations done
    - Show "Offline mode" when no connectivity
    - _Requirements: 15.6, 15.7_

- [ ] 12. Implement AI Memory storage and retrieval
  - [ ] 12.1 Create backend AI_Memory endpoints (GET, POST, PATCH)
    - GET /ai-memory returns entries with optional filtering by question_type
    - POST /ai-memory stores new response with context and feedback_score=0
    - PATCH /ai-memory/{id} updates feedback_score
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ] 12.2 Add AI Memory context extraction
    - When AI generates resume suggestions, extract context (job_role, keywords, industry)
    - Store response to AI_Memory with context
    - _Requirements: 9.2, 9.3_
  
  - [ ] 12.3 Use AI Memory for improved suggestions
    - On next suggestion request, fetch similar AI_Memory entries
    - Pass to AI engine to inform new suggestions with historical preferences
    - _Requirements: 9.3, 9.4_

- [ ] 13. Checkpoint - Ensure all core components work together
  - Verify guest mode features execute without authentication
  - Verify OAuth flow completes and stores tokens
  - Verify resume CRUD operations work in Job Orbit Mode
  - Verify application tracking records are created
  - Verify all unit and property tests pass
  - Ask the user if questions arise

- [ ] 14. Implement multi-device consistency
  - [ ] 14.1 Add last-write-wins conflict resolution
    - When fetching from cloud, compare local cache timestamp with remote timestamp
    - Use version with latest timestamp
    - Update cache to latest version
    - _Requirements: 10.6, 5.2_
  
  - [ ]* 14.2 Write property test for multi-device consistency
    - **Property 5: Multi-device last-write-wins consistency**
    - **Validates: Requirements 10.1, 10.2, 10.6**
  
  - [ ] 14.3 Implement cache freshness validation
    - Track last-fetch timestamp per resource type
    - Refresh cache if older than 5 minutes when extension opens
    - _Requirements: 10.3, 10.4, 10.5_

- [ ] 15. Implement offline resilience and error handling
  - [ ] 15.1 Add offline detection
    - Listen to browser online/offline events
    - Switch UI to "Offline Mode" when offline
    - Continue displaying cached data
    - _Requirements: 14.2, 14.5, 15.7_
  
  - [ ] 15.2 Implement automatic retry on reconnection
    - When online event fires, process entire sync queue
    - Retry each queued operation
    - Display results to user
    - _Requirements: 14.3, 14.4_
  
  - [ ]* 15.3 Write property test for offline queue preservation
    - **Property 6: Offline-first queue preservation**
    - **Validates: Requirements 14.2, 14.3**
  
  - [ ] 15.4 Add error messages and recovery options
    - Display user-friendly error messages for network failures
    - Provide "Retry" button for failed operations
    - Provide "Contact support" link for persistent failures
    - _Requirements: 14.1, 14.4_

- [ ] 16. Implement premium feature gating
  - [ ] 16.1 Create feature matrix constant
    - Define which features are available in Guest Mode vs. Job Orbit Mode
    - Include future premium features with is_available: false
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [ ] 16.2 Add feature availability checks
    - Check feature matrix before rendering feature UI
    - Show upsell message for unavailable features in Guest Mode
    - _Requirements: 11.3_
  
  - [ ] 16.3 Implement subscription status handling
    - Fetch subscription status from Profile
    - Hide premium features if subscription expired
    - Show re-subscription message
    - _Requirements: 11.6, 11.7_

- [ ] 17. Implement security measures
  - [ ] 17.1 Add HTTPS validation for all API calls
    - Verify all requests use HTTPS (no HTTP)
    - Reject insecure connections
    - _Requirements: 13.2_
  
  - [ ] 17.2 Add token validation on extension startup
    - Verify token signature and expiration on extension init
    - Clear invalid tokens and return to Guest Mode
    - _Requirements: 3.7, 13.1_
  
  - [ ] 17.3 Implement token revocation on logout
    - Clear tokens from Chrome storage immediately on logout
    - Invalidate refresh token on backend (optional)
    - _Requirements: 13.3, 13.4_

- [ ] 18. Implement analytics and success metrics
  - [ ] 18.1 Add event tracking for metrics collection
    - Track user_mode (guest|job_orbit) on extension open
    - Track feature_usage (resume_optimize|extract_jd|autofill|view_applications|view_ai_memory)
    - Track resume_optimization requests with ats_score results
    - Track application submissions with conversion_rate
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_
  
  - [ ] 18.2 Add anonymized error logging
    - Log error events (auth_failure, network_error, sync_failure) without PII
    - Send to analytics endpoint
    - _Requirements: 16.6_
  
  - [ ] 18.3 Ensure privacy compliance in analytics
    - Implement user consent check before tracking
    - Strip PII from all logged events
    - Respect GDPR/CCPA data handling
    - _Requirements: 16.7_

- [ ] 19. Write integration tests for complete flows
  - [ ]* 19.1 Write integration test for complete OAuth flow
    - Guest user → OAuth → Job Orbit Mode → First login migration
    - Verify all components integrated
    - _Requirements: 3.1-3.7, 6.1-6.5_
  
  - [ ]* 19.2 Write integration test for resume sync across devices
    - Add resume on Device A
    - Open extension on Device B
    - Verify Device B sees updated resume
    - _Requirements: 7.1, 10.1, 10.2, 10.3_
  
  - [ ]* 19.3 Write integration test for application tracking
    - Submit application via form
    - Verify application record created in cloud
    - Verify appears in application list
    - _Requirements: 8.1-8.4_

- [ ] 20. Final checkpoint - Ensure all tests pass and system ready for deployment
  - Verify all unit tests pass
  - Verify all property-based tests pass (100+ iterations each)
  - Verify all integration tests pass
  - Verify code coverage above 80%
  - Verify no console errors or warnings in extension
  - Verify no sensitive data logged
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for faster MVP
- Each task builds incrementally on previous tasks
- No orphaned code—all components are integrated before moving to next feature
- All core implementation tasks must be completed
- Optional tasks include comprehensive property-based and integration testing
- Backend uses existing Node.js/Express deployment on Render
- Extension uses existing Chrome extension manifest and popup structure
- Supabase credentials already configured in .env file

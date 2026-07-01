# Requirements: Guest Mode and Job Orbit Authentication

## Introduction

The ATS Resume Optimizer extension is transitioning from a single-mode tool to a two-tier system that balances immediate user value with premium features. Guest Mode provides unrestricted access to core resume optimization features (ATS scoring, JD extraction, autofill) without requiring authentication or cloud synchronization. Job Orbit Mode unlocks premium features (cloud sync, multi-device access, application tracking, AI memory) through OAuth authentication with Supabase.

This requirements document establishes the business-level needs, user workflows, and acceptance criteria for both authentication modes and their associated features.

## Glossary

- **Guest_Mode**: A local-only experience where users access core features without authentication or cloud synchronization
- **Job_Orbit_Mode**: A premium, authenticated experience with cloud synchronization and advanced features
- **OAuth_Provider**: Third-party authentication service (Google, GitHub, Microsoft)
- **Supabase**: Backend-as-a-service platform providing authentication and database functionality
- **Profile**: User account record containing email, subscription status, and preferences
- **Application_Record**: Tracked job application entry containing job details and status
- **AI_Memory**: Persistent storage of AI-generated responses and preferences
- **Auto_Sync**: Automatic synchronization of user data to cloud storage via PATCH operations
- **Chrome_Extension**: The locally-installed extension providing UI and feature execution
- **Chrome_Storage**: Local browser storage mechanism for tokens and guest data
- **Session_Sharing**: Login state shared between website and extension
- **First_Login_Migration**: Process of importing guest data to cloud storage on initial authentication
- **Premium_Features**: Advanced capabilities available only in Job Orbit Mode

## Requirements

### Requirement 1: Guest Mode Core Features

**User Story:** As a job seeker, I want to use the extension immediately without authentication, so that I can start optimizing my resume and applications right away.

#### Acceptance Criteria

1. WHEN a user opens the extension for the first time THEN the system SHALL display the Guest Mode interface with core feature access
2. WHEN in Guest Mode THEN the system SHALL provide resume optimization capabilities including ATS scoring, keyword matching, and content suggestions
3. WHEN in Guest Mode THEN the system SHALL provide JD extraction capabilities to parse job description text and identify key requirements
4. WHEN in Guest Mode THEN the system SHALL provide application autofill capabilities to populate form fields with resume data
5. WHEN in Guest Mode THEN THE Guest_Mode interface SHALL NOT display premium feature indicators, subscriptions, or Job Orbit upsells
6. WHERE a user chooses to enable "Remember my data" THEN THE system SHALL store resume and autofill preferences locally using Chrome storage
7. WHEN the extension is closed and reopened THEN the system SHALL restore previously stored guest data from Chrome storage

### Requirement 2: Job Orbit OAuth Authentication

**User Story:** As a frequent job seeker, I want to authenticate with my existing accounts (Google, GitHub, Microsoft), so that I don't need to create yet another password.

#### Acceptance Criteria

1. WHEN a user clicks "Sign in to Job Orbit" THEN the system SHALL display OAuth provider options (Google, GitHub, Microsoft)
2. WHEN a user selects an OAuth provider THEN THE OAuth_Provider SHALL redirect to Supabase authentication flow
3. WHEN authentication succeeds THEN Supabase SHALL issue an access token and refresh token to the extension
4. WHEN authentication fails or is cancelled THEN the system SHALL return the user to Guest Mode without interruption
5. WHEN a user authenticates for the first time THEN the system SHALL create a new Profile record in Supabase with provider identifier and metadata
6. WHEN a user authenticates with the same provider again THEN the system SHALL log in using the existing Profile record
7. WHEN the access token expires THEN the system SHALL automatically refresh the token using the refresh token without user intervention

### Requirement 3: Chrome Extension OAuth Flow

**User Story:** As a Chrome extension user, I want the OAuth flow to work seamlessly within the extension popup, so that authentication feels native to the extension experience.

#### Acceptance Criteria

1. WHEN a user clicks "Sign in to Job Orbit" THEN the system SHALL open a new browser tab to the Supabase OAuth URL
2. WHEN authentication completes successfully THEN the website callback SHALL redirect to a success page that notifies the extension
3. WHEN the website page detects successful authentication THEN the system SHALL send tokens to the extension via postMessage or storage listener
4. WHEN the extension receives authentication tokens THEN the system SHALL store the access token in Chrome storage with encryption
5. WHEN tokens are received THEN the extension popup SHALL be automatically updated to show Job Orbit Mode UI
6. WHEN a user closes the authentication tab before completing flow THEN the system SHALL detect timeout and allow retry
7. THE extension SHALL validate all received tokens to ensure they originate from Supabase

### Requirement 4: Session Sharing Between Website and Extension

**User Story:** As a user with both website and extension access, I want my login session to be automatically shared, so that I stay authenticated across both platforms.

#### Acceptance Criteria

1. WHEN a user logs in on the website THEN the system SHALL store the access token in a shared storage location accessible to both website and extension
2. WHEN a user logs in via the extension THEN the website SHALL detect the new session and automatically authenticate
3. WHEN a session token exists in shared storage THEN both website and extension SHALL recognize the user as authenticated in Job Orbit Mode
4. WHEN a user logs out from either platform THEN the system SHALL clear tokens from shared storage on both platforms
5. WHEN the user opens the extension while authenticated on the website THEN the extension SHALL automatically detect and display Job Orbit Mode
6. WHEN the access token expires THEN both website and extension SHALL use the refresh token to obtain a new access token independently
7. WHEN a user switches browsers or devices THEN the system SHALL require re-authentication as tokens are browser-specific

### Requirement 5: User Profile and Account Management

**User Story:** As an authenticated user, I want my account information, preferences, and settings to be stored in the cloud, so that my experience is consistent across devices.

#### Acceptance Criteria

1. WHEN a user completes authentication THEN the system SHALL create a Profile record containing email, provider_id, created_at, and updated_at
2. WHEN a user updates profile information THEN the system SHALL PATCH the Profile record to reflect changes immediately
3. THE system SHALL store profile subscription status (free, premium) indicating Job Orbit Mode access level
4. THE system SHALL store user preferences including resume templates, preferred keywords, and theme settings
5. WHEN a user queries their profile THEN the system SHALL retrieve only the authenticated user's profile data
6. WHEN a user profile is created THEN the system SHALL initialize an empty list of associated Resumes and Applications
7. WHERE a user provides optional information THEN THE system SHALL accept and store it without requiring mandatory fields beyond email

### Requirement 6: Guest Data Migration on First Login

**User Story:** As a guest user turning into a Job Orbit subscriber, I want my locally-stored resume data and preferences to be preserved, so that I don't lose my work when I sign up.

#### Acceptance Criteria

1. WHEN a user authenticates for the first time and previously used Guest Mode THEN the system SHALL detect locally-stored guest data
2. WHEN guest data is detected THEN the system SHALL offer the user an option to "Import my guest data" before proceeding
3. WHEN a user accepts the import offer THEN the system SHALL migrate all guest data to cloud storage under the user's Profile
4. WHEN guest data includes saved resumes THEN the system SHALL create Resume records in the cloud associated with the Profile
5. WHEN guest data is successfully migrated THEN the system SHALL display a confirmation message and clear local guest storage
6. WHEN a user declines the import offer THEN the system SHALL preserve guest data locally and proceed with Job Orbit Mode
7. WHEN guest data exists but is incomplete THEN the system SHALL migrate only valid data and log any dropped records

### Requirement 7: Cloud Sync for Resumes

**User Story:** As a Job Orbit subscriber, I want my resumes to be automatically synced to the cloud, so that I can access them on any device.

#### Acceptance Criteria

1. WHEN a user in Job Orbit Mode adds or updates a resume THEN the system SHALL automatically PATCH the Resume record to cloud storage
2. WHEN a resume is stored in the cloud THEN the system SHALL include metadata (title, file_format, created_at, updated_at, content_hash)
3. WHEN a user retrieves the resume list THEN the system SHALL fetch and display all Resumes associated with the authenticated Profile
4. WHEN a resume is deleted THEN the system SHALL remove it from cloud storage and all local caches
5. WHEN a user opens the extension on a different device THEN the system SHALL retrieve and populate all synced Resumes from cloud storage
6. WHEN sync fails due to network error THEN the system SHALL queue the operation and retry automatically when connectivity is restored
7. WHERE multiple updates occur rapidly THEN THE system SHALL debounce writes to prevent excessive API calls

### Requirement 8: Cloud Sync for Application Tracking

**User Story:** As a Job Orbit subscriber, I want to track my job applications in the cloud, so that I can monitor my progress across all devices and never lose track of where I've applied.

#### Acceptance Criteria

1. WHEN a user submits a job application THEN the system SHALL automatically POST an Application_Record to cloud storage
2. THE Application_Record SHALL include job title, company, application date, and application status (applied, interviews, rejected, offered)
3. WHEN an application status is updated THEN the system SHALL PATCH the Application_Record to reflect the new status
4. WHEN a user queries applications THEN the system SHALL retrieve all Application_Records associated with the authenticated Profile
5. WHEN a user views the application list THEN the system SHALL display applications sorted by most recent application date
6. WHEN a user deletes an application record THEN the system SHALL remove it from cloud storage permanently
7. WHEN sync fails THEN the system SHALL queue the operation and retry when connectivity is restored

### Requirement 9: AI Memory for Responses

**User Story:** As a Job Orbit subscriber, I want the system to remember my preferred writing style and common keywords, so that AI suggestions improve over time.

#### Acceptance Criteria

1. WHEN the AI generates resume suggestions or improvements THEN the system SHALL store the response in AI_Memory associated with the Profile
2. WHEN AI_Memory is stored THEN the system SHALL include context (question_type, job_role, keywords used, response_content)
3. WHEN generating new suggestions THEN the system SHALL retrieve relevant AI_Memory entries to inform recommendations
4. WHEN a user provides feedback on an AI suggestion THEN the system SHALL update the AI_Memory entry with feedback score
5. WHERE a user deletes an AI_Memory entry THEN THE system SHALL remove it from cloud storage
6. WHEN AI memory contains personal or sensitive data THEN THE system SHALL ensure encryption in transit and at rest
7. WHEN a user accesses AI_Memory THEN THE system SHALL only retrieve entries created by that user

### Requirement 10: Multi-Device Experience

**User Story:** As a user with Job Orbit Mode enabled, I want my work on one device to automatically be available on another, so that I can seamlessly switch between my laptop and phone.

#### Acceptance Criteria

1. WHEN a user is logged into Job Orbit Mode on Device A THEN the system SHALL fetch all synced data (Resumes, Applications, AI_Memory)
2. WHEN the user logs into Job Orbit Mode on Device B THEN the system SHALL fetch the same synced data from cloud storage
3. WHEN the user updates a resume on Device A THEN Device B SHALL fetch the updated version when the extension is next opened
4. WHEN the user is offline on Device B THEN the system SHALL cache the last-synced data and display it from cache
5. WHEN Device B comes back online THEN the system SHALL check for updates and sync any changes from the cloud
6. WHEN conflicting updates occur simultaneously on two devices THEN the system SHALL use last-write-wins strategy, with latest timestamp taking precedence
7. WHEN synced data exists on multiple devices THEN the system SHALL maintain consistency across all devices

### Requirement 11: Premium Features Roadmap and Feature Gating

**User Story:** As a product manager, I want to clearly distinguish free and premium features, so that users understand what Job Orbit Mode unlocks and can make informed upgrade decisions.

#### Acceptance Criteria

1. WHEN a user is in Guest Mode THEN the system SHALL display all available features without premium indicators
2. WHEN a user is in Job Orbit Mode THEN the system SHALL display all features as unlocked and functional
3. WHEN a user is in Guest Mode and attempts to access a future premium feature THEN the system SHALL display an upsell message inviting Job Orbit subscription
4. THE system SHALL maintain a feature matrix defining which features are Guest Mode, free Job Orbit, and premium Job Orbit
5. WHEN the feature matrix is updated THEN all clients SHALL respect the new feature availability rules without code changes
6. WHERE a user has a Job Orbit subscription that expires THEN THE system SHALL gracefully downgrade them to Guest Mode
7. WHEN premium features are unavailable due to subscription lapse THEN the system SHALL preserve user data and allow full access upon re-subscription

### Requirement 12: Chrome Storage Strategy

**User Story:** As a developer, I want a clear strategy for what data to store locally vs. in the cloud, so that the extension remains performant while ensuring data persistence.

#### Acceptance Criteria

1. WHEN a user is in Guest Mode THEN the system SHALL store only resume text, autofill preferences, and settings in Chrome storage (no cloud backup)
2. WHEN a user authenticates THEN the system SHALL store only the access token and refresh token in Chrome storage (encrypted)
3. WHEN a user is in Job Orbit Mode THEN the system SHALL fetch synced data from cloud storage on each session, not from local Chrome storage
4. WHERE user data size exceeds Chrome storage limits THEN THE system SHALL prioritize storing tokens and metadata, with full data available via cloud fetch
5. WHEN Chrome storage is cleared by the user THEN the system SHALL detect this and prompt the user to re-authenticate if tokens are missing
6. WHEN the extension is uninstalled THEN all local Chrome storage data SHALL be automatically deleted by the browser
7. WHEN the extension is reinstalled with the same Google account THEN the system SHALL allow re-authentication and full data recovery from cloud

### Requirement 13: Security and Data Privacy

**User Story:** As a user, I want my data to be secure and my privacy to be protected, so that I trust the platform with my personal information.

#### Acceptance Criteria

1. WHEN tokens are stored in Chrome storage THEN the system SHALL encrypt them using Chrome's encryption APIs
2. WHEN data is transmitted between extension and Supabase THEN the system SHALL use HTTPS encryption for all requests
3. WHEN a user logs out THEN the system SHALL immediately clear all tokens and sensitive data from Chrome storage
4. WHEN a user deletes their account THEN the system SHALL remove all associated data (Profile, Resumes, Applications, AI_Memory) from cloud storage
5. WHEN accessing user data THEN the system SHALL verify the request is authenticated with a valid token before returning any data
6. WHERE user data includes resumes with personal information THEN THE system SHALL not log or store this data in error logs or analytics
7. WHEN a refresh token is invalidated THEN the system SHALL require the user to re-authenticate

### Requirement 14: Error Handling and Offline Resilience

**User Story:** As a user, I want the extension to gracefully handle network failures and errors, so that I can continue working even when connectivity is interrupted.

#### Acceptance Criteria

1. WHEN an API call fails due to network error THEN the system SHALL display a user-friendly error message and offer a retry option
2. WHEN a user is offline THEN the system SHALL continue displaying previously cached data without interruption
3. WHEN a sync operation fails THEN the system SHALL queue the operation and retry automatically when connectivity is restored
4. WHEN an API returns an error THEN the system SHALL parse the error message and display context-specific help to the user
5. WHEN a user is in Guest Mode and loses network connectivity THEN the system SHALL continue functioning with all local features
6. WHEN authentication fails due to server error THEN the system SHALL NOT lock the user out of Guest Mode
7. WHEN retry attempts exceed a threshold THEN the system SHALL inform the user of the persistent issue and suggest contacting support

### Requirement 15: Chrome Popup UI for Authentication State

**User Story:** As a user, I want the extension popup to clearly show whether I'm in Guest Mode or Job Orbit Mode, so that I understand my current access level.

#### Acceptance Criteria

1. WHEN the user opens the extension popup in Guest Mode THEN the system SHALL display "Guest Mode" with available features and "Sign in to Job Orbit" button
2. WHEN the user opens the extension popup in Job Orbit Mode THEN the system SHALL display "Job Orbit Mode" with the user's email and a "Sign out" button
3. WHEN a user clicks "Sign in to Job Orbit" THEN the system SHALL open the OAuth flow as defined in Requirement 3
4. WHEN a user clicks "Sign out" THEN the system SHALL clear all tokens and return to Guest Mode
5. WHEN in Job Orbit Mode THEN the system SHALL display quick-access links to premium features (View Applications, View AI Memory, Sync Status)
6. WHEN sync is in progress THEN the system SHALL display a progress indicator showing "Syncing..." with percentage complete
7. WHEN the user is offline but in Job Orbit Mode THEN the system SHALL display "Offline Mode" with a note that data will sync when connectivity is restored

### Requirement 16: Success Metrics and Data Collection

**User Story:** As a product manager, I want to measure the success of the two-tier system, so that I can optimize the experience and understand user behavior.

#### Acceptance Criteria

1. THE system SHALL track the number of users in Guest Mode vs. Job Orbit Mode daily
2. THE system SHALL track the conversion rate from Guest Mode to Job Orbit Mode sign-ups
3. THE system SHALL track feature usage for both Guest Mode and Job Orbit Mode features
4. THE system SHALL track resume optimization requests and average ATS scores per user
5. THE system SHALL track application submissions and track conversion from application to offer
6. WHERE users provide feedback or encounter errors THEN THE system SHALL log anonymized events for analysis
7. WHEN collecting metrics THEN the system SHALL ensure compliance with privacy regulations (GDPR, CCPA) and user consent

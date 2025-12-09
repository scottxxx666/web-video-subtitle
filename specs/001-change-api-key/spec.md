# Feature Specification: API Key Management

**Feature Branch**: `001-change-api-key`
**Created**: 2025-12-08
**Status**: Draft
**Input**: User description: "user could change api key"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enter/Change API Key (Priority: P1)

A user wants to enter or change their Gemini API key through the extension popup.

**Why this priority**: Core functionality - users must be able to set credentials to use the extension.

**Independent Test**: User can enter an API key through the popup, save it, and the extension uses it for subtitle generation.

**Acceptance Scenarios**:

1. **Given** the extension popup is open, **When** the user enters an API key and saves, **Then** the extension stores the key
2. **Given** the API key has been saved, **When** the user starts subtitle generation, **Then** the extension uses the key for API calls
3. **Given** an API call fails with authentication error, **When** the error occurs, **Then** the extension shows "API key authentication failed" message

---

### User Story 2 - Clear API Key (Priority: P2)

A user wants to clear their stored API key from the extension.

**Why this priority**: Allows users to remove credentials when needed (switching keys, privacy).

**Independent Test**: User can clear their stored API key through the popup.

**Acceptance Scenarios**:

1. **Given** an API key is stored, **When** the user clicks "Clear" or similar action, **Then** the key is removed from storage
2. **Given** no API key is stored, **When** the user attempts to start subtitles, **Then** the extension prompts to enter a key

---

### Edge Cases

- What happens if the user saves an empty/blank API key?
- How does the extension behave when API key is changed mid-session (active subtitle generation)?
- What happens if browser storage fails when saving API key?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to enter and save an API key through the extension popup
- **FR-002**: System MUST NOT allow saving an empty API key (must reject empty input)
- **FR-003**: System MUST store the API key in browser storage
- **FR-004**: Users MUST be able to clear/remove their stored API key
- **FR-005**: System MUST display an error message when API authentication fails
- **FR-006**: System MUST NOT log or display full API key in console or error messages

### Key Entities *(include if feature involves data)*

- **API Key**: Gemini API credential; stored in browser storage; used for authenticating API requests; can be entered, changed, or cleared by user; cannot be empty

### Assumptions

- User obtains API key from Google Cloud Console
- Browser storage (chrome.storage.local) is available
- Popup UI exists and can be extended with API key input
- API authentication errors can be detected from API response
- Empty check is the only validation required (no format validation)

### Dependencies

- Browser storage API (chrome.storage.local or equivalent)
- Extension popup UI (React)
- Existing Gemini API integration

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can enter and save an API key in under 15 seconds
- **SC-002**: Users cannot save an empty API key (UI prevents or shows error)
- **SC-003**: Users can clear their API key with a single action
- **SC-004**: Extension displays authentication error message when API key is invalid
- **SC-005**: Full API key never appears in browser console or UI (only masked or hidden)

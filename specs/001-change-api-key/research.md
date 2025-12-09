# Research: API Key Management

**Feature**: API Key Management (001-change-api-key)
**Date**: 2025-12-08

## Research Questions

### 1. React 19 Hooks Pattern for Browser Extension Popup

**Decision**: Use `useState` for local form state, `useEffect` for loading from chrome.storage on mount

**Rationale**:
- React 19 maintains hooks API from React 18
- `useState` is simplest pattern for input field value
- `useEffect` with empty dependency array loads API key on component mount
- No need for complex state management (Redux, Context) per YAGNI principle

**Alternatives considered**:
- **useReducer**: Overkill for simple form with 2 actions (save/clear)
- **React Context**: Not needed - no prop drilling, single component
- **External state library**: Violates simplicity principle for this scope

**References**:
- React 19 docs maintain useState/useEffect patterns
- WXT framework uses standard React patterns in popup entrypoints

---

### 2. chrome.storage API Best Practices

**Decision**: Use `chrome.storage.local.set()` and `chrome.storage.local.get()` directly in component

**Rationale**:
- chrome.storage.local is persistent across sessions (vs session storage)
- WXT provides browser compatibility shim (chrome.storage → browser.storage for Firefox)
- Promise-based API works naturally with async/await in React
- No encryption layer needed - browser storage is profile-scoped and secure at OS level

**Alternatives considered**:
- **Encrypted storage**: Not required per spec (spec says "encrypted if possible" - browser profile isolation sufficient)
- **Storage abstraction layer**: Violates YAGNI - direct API calls are 3 lines of code
- **chrome.storage.sync**: Would sync across devices - undesired for API keys (privacy concern)

**Security notes** (per constitution Principle I):
- API keys stored in local storage, never in content scripts ✓
- Background script can access storage separately for token generation ✓
- No need to change existing token generation architecture

**References**:
- Chrome Extension API docs: `chrome.storage.local` for non-synced data
- WXT framework handles browser compatibility automatically

---

### 3. Empty Validation Strategy

**Decision**: Client-side empty check before save, show inline error message

**Rationale**:
- Simplest UX: disable Save button when input is empty, OR show error on click
- No format validation per user requirement (no regex, no length checks)
- API authentication errors handled separately (from API response, not client-side)

**Implementation approach**:
- Option A: Disable save button when `input.trim() === ''`
- Option B: Allow click, show error message "API key cannot be empty"
- **Chosen**: Option A (disabled button) - clearer UX, prevents error state

**Alternatives considered**:
- **Format validation**: Rejected per user simplification request
- **API key test call**: Expensive, not required - validation happens on first subtitle use

---

### 4. Error Display Pattern

**Decision**: Show authentication errors via toast/alert or inline message in popup

**Rationale**:
- Authentication errors come from Gemini API response (not during save)
- Error needs to persist until user acknowledges (not auto-dismiss)
- Simple pattern: conditional render of error message in popup UI

**Implementation pattern**:
```tsx
{error && <div className="error">{error}</div>}
```

**Alternatives considered**:
- **Browser notification API**: Too intrusive for form errors
- **Console.error only**: Violates accessibility, users won't see
- **Background script notification**: Adds complexity, violates YAGNI

---

## Technology Stack Summary

| Component | Technology | Justification |
|-----------|------------|---------------|
| UI Framework | React 19 | Existing project dependency |
| State Management | useState hook | Simplest for 1-2 state variables |
| Storage API | chrome.storage.local | Persistent, browser-compat via WXT |
| Validation | `trim() !== ''` check | Minimum required per spec |
| Error Display | Inline conditional render | Simplest accessible pattern |

---

## No Research Required

The following were straightforward from existing codebase:
- TypeScript types for chrome.storage (provided by WXT)
- Popup component structure (entrypoints/popup/App.tsx exists)
- Build process (yarn dev / yarn build unchanged)
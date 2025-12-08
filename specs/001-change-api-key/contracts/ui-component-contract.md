# UI Component Contract: API Key Settings

**Feature**: API Key Management (001-change-api-key)
**Component**: API Key Settings (Popup UI)
**Date**: 2025-12-08

---

## Component Interface

### Props

```typescript
// If inline in App.tsx: no props
// If extracted as component:
interface ApiKeySettingsProps {
  // None required - self-contained component
}
```

### Component API

```typescript
function ApiKeySettings(): JSX.Element
```

---

## User Interface Contract

### Visual Elements

| Element | Type | Purpose | Behavior |
|---------|------|---------|----------|
| API Key Input | `<input type="password">` | Enter/edit API key | Shows masked characters; clears on user action |
| Save Button | `<button>` | Save API key to storage | Disabled when input is empty; saves on click |
| Clear Button | `<button>` | Remove stored API key | Enabled when API key exists; prompts confirmation (optional) |
| Error Message | `<div>` (conditional) | Show validation/API errors | Displays when error state exists |
| Success Message | `<div>` (conditional) | Confirm save/clear | Displays briefly after successful action (optional) |

### State Contract

```typescript
interface ComponentState {
  apiKey: string;           // Current input value
  savedKey?: string;        // Key loaded from storage (for comparison)
  error?: string;           // Error message to display
  loading: boolean;         // Loading state (storage operations)
}
```

---

## User Actions & Responses

### Action: Load Component

**Trigger**: Popup opens, component mounts

**Flow**:
1. Component calls `chrome.storage.local.get('apiKey')`
2. If key exists: populate input field (optionally masked)
3. If key doesn't exist: show empty input

**UI State**:
- Loading: Show skeleton/spinner (brief)
- Success: Input populated or empty
- Error: Show "Failed to load settings" message

---

### Action: Enter/Change API Key

**Trigger**: User types in input field

**Flow**:
1. Update local state (`apiKey` value)
2. Enable/disable Save button based on empty check

**Validation**:
- Empty check: `input.trim() === ''` → disable Save button
- No format validation

---

### Action: Save API Key

**Trigger**: User clicks "Save" button

**Flow**:
1. Validate input is not empty (should be guaranteed by disabled button)
2. Call `chrome.storage.local.set({ apiKey: input.trim() })`
3. Show success feedback (optional: "API key saved")
4. Update `savedKey` state to match `apiKey`

**UI States**:
- Loading: Disable buttons, show spinner (brief)
- Success: Show success message, re-enable buttons
- Error: Show "Failed to save API key" message

**Error Handling**:
- Storage quota exceeded: "Storage full - unable to save"
- Browser API unavailable: "Settings unavailable - try reloading extension"

---

### Action: Clear API Key

**Trigger**: User clicks "Clear" button

**Flow**:
1. (Optional) Show confirmation: "Remove API key?"
2. Call `chrome.storage.local.remove('apiKey')`
3. Clear input field
4. Show success feedback: "API key removed"

**UI States**:
- Loading: Disable buttons, show spinner (brief)
- Success: Input cleared, show success message
- Error: Show "Failed to clear API key" message

---

### Action: API Authentication Failure (External)

**Trigger**: Gemini API returns 401/403 error (detected elsewhere in app)

**Flow**:
1. Error passed to component via props/context/event (implementation detail)
2. Component displays error: "API key authentication failed - please check your key"

**Note**: This is NOT handled during save action - it's detected on first subtitle generation attempt.

---

## Browser Compatibility

### Chrome/Chromium

```typescript
chrome.storage.local.set({ apiKey: value });
chrome.storage.local.get('apiKey');
chrome.storage.local.remove('apiKey');
```

### Firefox

WXT framework automatically polyfills:

```typescript
browser.storage.local.set({ apiKey: value });
browser.storage.local.get('apiKey');
browser.storage.local.remove('apiKey');
```

**Contract**: Component uses `chrome.storage` API; WXT handles browser compatibility.

---

## Security Contract (per Constitution Principle I)

| Requirement | Implementation | Verification |
|-------------|----------------|--------------|
| Never log API key | No console.log of `apiKey` variable | Code review |
| Never expose in errors | Error messages don't include key value | Code review |
| Secure storage | Use chrome.storage.local (not localStorage) | Code review |
| Optional masking | Input type="password" or masked display | UI review |

---

## Accessibility Contract

| Requirement | Implementation |
|-------------|----------------|
| Keyboard navigation | All buttons focusable, Enter key submits |
| Screen reader support | Labels for input field, button text clear |
| Error announcements | Error messages in accessible div (aria-live) |
| Focus management | Focus returns to input after save/clear |

---

## Component Integration

### Mounting Location

```tsx
// entrypoints/popup/App.tsx
function App() {
  return (
    <div>
      {/* Existing popup content */}
      <ApiKeySettings />
    </div>
  );
}
```

### No External Dependencies

- No props required
- No context providers needed
- Self-contained state management
- Direct chrome.storage.local access

---

## Testing Contract (Aspirational)

**When testing framework added** (per Constitution):

### Unit Tests

1. Renders with empty state when no API key stored
2. Loads and displays existing API key on mount
3. Disables Save button when input is empty
4. Enables Save button when input has value
5. Calls chrome.storage.local.set on Save click
6. Calls chrome.storage.local.remove on Clear click
7. Displays error message on storage failure

### Integration Tests

1. Full save flow: enter key → save → verify storage
2. Full clear flow: clear → verify storage empty
3. Reload persistence: save → close popup → reopen → key persists

---

## Performance Contract

| Metric | Target | Measurement |
|--------|--------|-------------|
| Load time | <100ms | Time from mount to display |
| Save operation | <50ms | chrome.storage.local.set duration |
| Clear operation | <50ms | chrome.storage.local.remove duration |
| Input responsiveness | <16ms | Typing to state update (60fps) |
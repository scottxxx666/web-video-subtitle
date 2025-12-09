# Data Model: API Key Management

**Feature**: API Key Management (001-change-api-key)
**Date**: 2025-12-08

## Entities

### API Key

**Purpose**: Store and manage Gemini API credential for authentication

**Storage Location**: `chrome.storage.local`

**Storage Key**: `apiKey` (or `gemini_api_key` if namespacing preferred)

**Schema**:

```typescript
interface StorageSchema {
  apiKey?: string;  // undefined if not set, string if configured
}
```

**Attributes**:

| Attribute | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| value | string | Yes | Non-empty (trim() !== '') | The actual API key string from Google Cloud Console |

**Lifecycle**:

1. **Creation**: User enters API key in popup → saved to chrome.storage.local
2. **Read**: Component mounts → loads API key from storage to display (optionally masked)
3. **Update**: User changes API key → overwrites existing value in storage
4. **Delete**: User clicks "Clear" → removes key from storage (sets to undefined/null)

**Validation Rules**:

- **Client-side**: Must not be empty string (enforced before save)
- **Server-side**: No client validation of format - validated by Gemini API on first use

**State Transitions**:

```
[Not Set] --user enters key--> [Configured]
[Configured] --user clears--> [Not Set]
[Configured] --user updates--> [Configured (new value)]
```

**Security Considerations** (per Constitution Principle I):

- ✅ Stored in chrome.storage.local (not accessible to content scripts)
- ✅ Never logged to console
- ✅ Never exposed in error messages
- ✅ Can be masked in UI display (e.g., show only first 3 + last 6 chars)
- ✅ Browser profile isolation provides encryption at OS level

**Related Components**:

- **Popup UI**: Reads/writes API key via chrome.storage API
- **Background script**: Reads API key to generate ephemeral tokens (existing functionality)

---

## Storage Operations

### Save API Key

```typescript
await chrome.storage.local.set({ apiKey: userInput.trim() });
```

### Load API Key

```typescript
const { apiKey } = await chrome.storage.local.get('apiKey');
// apiKey is undefined if not set, string otherwise
```

### Clear API Key

```typescript
await chrome.storage.local.remove('apiKey');
// or
await chrome.storage.local.set({ apiKey: undefined });
```

---

## No Additional Entities

This feature is minimal by design (YAGNI principle):
- No user profiles (single user per browser profile)
- No API key history or versioning
- No metadata (creation date, last modified, etc.)
- No validation cache or error logs
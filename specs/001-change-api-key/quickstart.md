# Quickstart: API Key Management Implementation

**Feature**: API Key Management (001-change-api-key)
**Date**: 2025-12-08

---

## Prerequisites

- Branch `001-change-api-key` checked out
- Dependencies installed (`yarn install`)
- Development environment running (`yarn dev` or `yarn dev:firefox`)

---

## Implementation Overview

**Goal**: Add API key settings UI to extension popup for entering, changing, and clearing Gemini API keys.

**Scope**: Modify `entrypoints/popup/App.tsx` to add inline API key management (no separate component file unless needed).

**Duration Estimate**: ~1-2 hours for implementation, ~30 min for testing

---

## Step-by-Step Implementation

### Step 1: Understand Existing Popup Structure

**File**: `entrypoints/popup/App.tsx`

**Action**: Read the file to understand current structure

```bash
# View current popup implementation
cat entrypoints/popup/App.tsx
```

**What to look for**:
- How is the popup currently structured?
- Are there existing sections or components?
- Where should API key settings be added? (top, bottom, separate tab?)

---

### Step 2: Add API Key State Management

**File**: `entrypoints/popup/App.tsx`

**Add React hooks** at the top of your component:

```tsx
import { useState, useEffect } from 'react';

function App() {
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load API key from storage on mount
  useEffect(() => {
    const loadApiKey = async () => {
      try {
        const { apiKey: stored } = await chrome.storage.local.get('apiKey');
        if (stored) {
          setApiKey(stored);
          setSavedKey(stored);
        }
      } catch (err) {
        setError('Failed to load API key settings');
        console.error('Storage error:', err);
      }
    };
    loadApiKey();
  }, []);

  // ... rest of component
}
```

---

### Step 3: Add Save Handler

**Add function** to handle saving API key:

```tsx
const handleSave = async () => {
  const trimmedKey = apiKey.trim();

  if (!trimmedKey) {
    setError('API key cannot be empty');
    return;
  }

  setLoading(true);
  setError('');

  try {
    await chrome.storage.local.set({ apiKey: trimmedKey });
    setSavedKey(trimmedKey);
    // Optional success feedback (remove if too complex)
    // setTimeout(() => setError(''), 2000); // Clear after 2s
  } catch (err) {
    setError('Failed to save API key');
    console.error('Save error:', err);
  } finally {
    setLoading(false);
  }
};
```

---

### Step 4: Add Clear Handler

**Add function** to handle clearing API key:

```tsx
const handleClear = async () => {
  setLoading(true);
  setError('');

  try {
    await chrome.storage.local.remove('apiKey');
    setApiKey('');
    setSavedKey('');
  } catch (err) {
    setError('Failed to clear API key');
    console.error('Clear error:', err);
  } finally {
    setLoading(false);
  }
};
```

---

### Step 5: Add UI Elements

**Add UI** to your component's return statement:

```tsx
return (
  <div className="popup-container">
    {/* Existing popup content */}

    {/* API Key Settings Section */}
    <div className="api-key-settings">
      <h2>API Key Settings</h2>

      <div className="input-group">
        <label htmlFor="apiKey">Gemini API Key:</label>
        <input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your API key"
          disabled={loading}
        />
      </div>

      <div className="button-group">
        <button
          onClick={handleSave}
          disabled={loading || !apiKey.trim()}
        >
          {loading ? 'Saving...' : 'Save'}
        </button>

        <button
          onClick={handleClear}
          disabled={loading || !savedKey}
        >
          {loading ? 'Clearing...' : 'Clear'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  </div>
);
```

---

### Step 6: Add Basic Styling (Optional)

**File**: Existing popup CSS file (or add inline styles)

```css
.api-key-settings {
  padding: 16px;
  border-top: 1px solid #ccc;
}

.input-group {
  margin-bottom: 12px;
}

.input-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
}

.input-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.button-group {
  display: flex;
  gap: 8px;
}

.button-group button {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background-color: #007bff;
  color: white;
}

.button-group button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.error-message {
  margin-top: 8px;
  color: #dc3545;
  font-size: 14px;
}
```

---

## Testing Checklist

### Manual Testing

1. **Load Test**:
   - [ ] Open extension popup
   - [ ] Verify API key settings section appears
   - [ ] If no API key stored: input is empty, Clear button disabled

2. **Save Test**:
   - [ ] Enter an API key
   - [ ] Click Save
   - [ ] Verify no errors displayed
   - [ ] Close and reopen popup
   - [ ] Verify API key persists

3. **Empty Validation Test**:
   - [ ] Clear input field
   - [ ] Verify Save button is disabled
   - [ ] Enter whitespace only
   - [ ] Verify Save button is disabled

4. **Clear Test**:
   - [ ] With API key saved, click Clear
   - [ ] Verify input field clears
   - [ ] Verify Clear button becomes disabled
   - [ ] Close and reopen popup
   - [ ] Verify API key is gone

5. **Browser Compatibility**:
   - [ ] Test in Chrome/Chromium (`yarn dev`)
   - [ ] Test in Firefox (`yarn dev:firefox`)
   - [ ] Verify both work identically

### Verify Storage

```javascript
// In browser console (on extension popup)
chrome.storage.local.get('apiKey').then(console.log);

// Should show: { apiKey: "your-key-here" } or {}
```

---

## Troubleshooting

### Issue: chrome.storage is undefined

**Cause**: WXT hasn't injected storage API in popup context

**Fix**: Ensure `wxt.config.ts` has correct manifest configuration

### Issue: State doesn't persist after closing popup

**Cause**: Using `chrome.storage.session` instead of `chrome.storage.local`

**Fix**: Double-check all storage calls use `.local`, not `.session`

### Issue: Clear button always disabled

**Cause**: `savedKey` not being set after load or save

**Fix**: Verify `setSavedKey(stored)` is called in `useEffect` and after successful save

### Issue: Save button enabled when input is empty

**Cause**: Not checking trim() in disabled condition

**Fix**: Use `disabled={loading || !apiKey.trim()}`

---

## Next Steps

After implementing and testing:

1. Commit your changes:
   ```bash
   git add entrypoints/popup/App.tsx
   git commit -m "feat: add API key management UI to popup"
   ```

2. Test authentication flow:
   - Enter your actual Gemini API key
   - Try starting subtitle generation
   - Verify API uses the stored key

3. Ready for `/speckit.tasks` to generate task list

---

## Files Modified

| File | Changes | LOC |
|------|---------|-----|
| `entrypoints/popup/App.tsx` | Added API key state + UI + handlers | ~80-100 |
| `entrypoints/popup/App.css` (if exists) | Added styling for API key section | ~40 |

**Total**: ~120-140 lines of code added

---

## Security Reminders (Constitution Principle I)

- ✅ No `console.log(apiKey)` anywhere in code
- ✅ Error messages don't include API key value
- ✅ Using chrome.storage.local (not localStorage or sessionStorage)
- ✅ Input type="password" masks characters (optional but recommended)

---

## Constitution Compliance Checklist

- [x] **Simplicity (YAGNI)**: No abstraction layers, inline implementation
- [x] **Best Practices**: React 19 hooks pattern (useState, useEffect)
- [x] **Browser Compatibility**: WXT handles chrome/firefox differences
- [x] **Security-First**: API key in chrome.storage.local, never logged
- [x] **Resource Management**: No persistent connections, simple state cleanup
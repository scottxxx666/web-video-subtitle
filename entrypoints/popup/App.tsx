import { useState, useEffect } from 'react';
import './App.css';

function App() {
  // T005: Add React state management hooks
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);

  // T006: Load API key and enabled state from chrome.storage.local on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { apiKey: stored, enabled: storedEnabled } = await chrome.storage.local.get(['apiKey', 'enabled']);
        if (stored) {
          setApiKey(stored);
          setSavedKey(stored);
        }
        setEnabled(storedEnabled ?? false);
      } catch (err) {
        setError('Failed to load settings');
        console.error('Storage error:', err);
      }
    };
    loadSettings();
  }, []);

  // T007: Implement handleSave function
  const handleSave = async () => {
    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      setError('API key cannot be empty');
      setSuccess('');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await chrome.storage.local.set({ apiKey: trimmedKey });
      setSavedKey(trimmedKey);
      setSuccess('API key saved successfully!');
    } catch (err) {
      setError('Failed to save API key');
      console.error('Save error:', err);
    } finally {
      setLoading(false);
    }
  };

  // T016: Implement handleClear function
  const handleClear = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await chrome.storage.local.remove('apiKey');
      setApiKey('');
      setSavedKey('');
      setSuccess('API key cleared successfully!');
    } catch (err) {
      setError('Failed to clear API key');
      console.error('Clear error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle translation toggle
  const handleToggle = async () => {
    const newValue = !enabled;
    setEnabled(newValue);
    await chrome.storage.local.set({ enabled: newValue });

    // Notify active tab's content script
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_TRANSLATION', enabled: newValue });
      }
    } catch (err) {
      console.error('Failed to notify content script:', err);
    }
  };

  return (
    <div className="popup-container">
      <h1>Video Subtitle Generator</h1>

      {/* Translation Toggle */}
      <div className="toggle-section">
        <label className="toggle-label">
          <span>Translation</span>
          <div className="toggle-switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={handleToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </label>
        <p className="toggle-description">
          {enabled ? 'Translation is active' : 'Translation is disabled'}
        </p>
      </div>

      {/* T008-T010: API Key Settings UI */}
      <div className="api-key-settings">
        <h2>API Key Settings</h2>

        <div className="input-group">
          <label htmlFor="apiKey">Gemini API Key:</label>
          <input
            id="apiKey"
            type="text"
            value={savedKey && apiKey === savedKey
              ? savedKey.substring(0, 4) + '*'.repeat(Math.max(0, savedKey.length - 4))
              : apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            disabled={loading}
            onFocus={() => {
              // Show full key when focused if it was masked
              if (savedKey && apiKey === savedKey) {
                setApiKey(savedKey);
              }
            }}
          />
        </div>

        <div className="button-group">
          <button
            onClick={handleSave}
            disabled={loading || !apiKey.trim()}
          >
            {loading ? 'Saving...' : 'Save'}
          </button>

          {/* T017: Add Clear button */}
          <button
            onClick={handleClear}
            disabled={loading || !savedKey}
            className="clear-button"
          >
            {loading ? 'Clearing...' : 'Clear'}
          </button>
        </div>

        {/* Success message display */}
        {success && <div className="success-message">{success}</div>}

        {/* T010: Error message display */}
        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
}

export default App;

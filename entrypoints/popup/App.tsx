import { useState, useEffect } from 'react';
import './App.css';

function App() {
  // T005: Add React state management hooks
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // T006: Load API key from chrome.storage.local on component mount
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

  // T007: Implement handleSave function
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

  return (
    <div className="popup-container">
      <h1>Video Subtitle Generator</h1>

      {/* T008-T010: API Key Settings UI */}
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

          {/* T017: Add Clear button */}
          <button
            onClick={handleClear}
            disabled={loading || !savedKey}
            className="clear-button"
          >
            {loading ? 'Clearing...' : 'Clear'}
          </button>
        </div>

        {/* T010: Error message display */}
        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
}

export default App;

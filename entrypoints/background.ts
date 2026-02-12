import { GeminiAudioUnderstandingSession } from '~/utils/gemini-audio-understanding';

export default defineBackground(() => {
  console.log('Video subtitle background script loaded', { id: browser.runtime.id });

  // Initialize message handling for content script communication
  setupMessageHandling();
});

interface GeminiConfig {
  apiKey: string;
  model: string;
  region: string;
}

interface SessionInfo {
  session: GeminiAudioUnderstandingSession;
  tabId: number;
}

// Store active Gemini sessions per tab
const activeSessions = new Map<number, SessionInfo>();

// TODO: In production, API key should come from user settings or secure storage
const GEMINI_CONFIG: GeminiConfig = {
  apiKey: '', // Will be set by user in popup/options
  model: 'gemini-2.0-flash-live-preview-04-09',
  region: 'us-central1'
};

function setupMessageHandling() {
  browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log('Background received message:', message.type);

    try {
      switch (message.type) {
        case 'GET_GEMINI_CONFIG':
          return handleGetGeminiConfig();

        case 'SET_API_KEY':
          return handleSetApiKey(message.apiKey);

        case 'VALIDATE_API_KEY':
          return handleValidateApiKey(message.apiKey);

        case 'START_GEMINI_SESSION':
          return handleStartSession(sender.tab?.id);

        case 'STOP_GEMINI_SESSION':
          return handleStopSession(sender.tab?.id);

        case 'SEND_AUDIO_CHUNK':
          return handleAudioChunk(sender.tab?.id, message.audioData);

        default:
          console.warn('Unknown message type:', message.type);
          return { success: false, error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('Error handling message:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}

async function handleGetGeminiConfig() {
  try {
    // Get API key from storage
    const result = await browser.storage.local.get(['apiKey']);

    return {
      success: true,
      apiKey: result.apiKey || null,
      config: result.apiKey ? {
        ...GEMINI_CONFIG,
        apiKey: result.apiKey
      } : null
    };
  } catch (error) {
    console.error('Error getting Gemini config:', error);
    return {
      success: false,
      error: 'Failed to retrieve configuration',
      apiKey: null,
      config: null
    };
  }
}

async function handleSetApiKey(apiKey: string) {
  if (!apiKey || typeof apiKey !== 'string') {
    return { success: false, error: 'Invalid API key' };
  }

  // Store API key securely
  await browser.storage.local.set({ apiKey });

  console.log('API key stored successfully');
  return { success: true };
}

async function handleValidateApiKey(apiKey: string) {
  // TODO: Implement API key validation by making a test request
  // For now, just check if it looks like a valid API key format
  const isValid = apiKey && apiKey.startsWith('AIza') && apiKey.length > 20;

  return {
    success: true,
    isValid,
    message: isValid ? 'API key format is valid' : 'Invalid API key format'
  };
}

// Session Management Handlers

async function handleStartSession(tabId: number | undefined) {
  if (!tabId) {
    return { success: false, error: 'No tab ID provided' };
  }

  try {
    // Check if session already exists for this tab
    if (activeSessions.has(tabId)) {
      console.log(`Session already exists for tab ${tabId}`);
      return { success: true, message: 'Session already active' };
    }

    // Get API key from storage
    const result = await browser.storage.local.get(['apiKey']);
    if (!result.apiKey) {
      return { success: false, error: 'No API key configured' };
    }

    console.log(`[Background] Starting Gemini session for tab ${tabId}`);

    // Create new Gemini Audio Understanding session
    const session = new GeminiAudioUnderstandingSession(result.apiKey);

    // Connect to Gemini with callback to forward transcriptions to content script
    await session.connect((transcriptionText: string) => {
      // Send transcription back to content script
      console.log('text', transcriptionText);
      browser.tabs.sendMessage(tabId, {
        type: 'TRANSCRIPTION_RESULT',
        text: transcriptionText
      }).catch(err => {
        console.error('Error sending transcription to content script:', err);
      });
    });

    // Store session
    activeSessions.set(tabId, { session, tabId });

    console.log(`[Background] Gemini session started for tab ${tabId}`);
    return { success: true, message: 'Session started successfully' };

  } catch (error) {
    console.error('Error starting Gemini session:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function handleStopSession(tabId: number | undefined) {
  if (!tabId) {
    return { success: false, error: 'No tab ID provided' };
  }

  try {
    const sessionInfo = activeSessions.get(tabId);
    if (!sessionInfo) {
      return { success: true, message: 'No active session for this tab' };
    }

    console.log(`[Background] Stopping Gemini session for tab ${tabId}`);

    // Disconnect and cleanup session
    await sessionInfo.session.disconnect();
    activeSessions.delete(tabId);

    console.log(`[Background] Gemini session stopped for tab ${tabId}`);
    return { success: true, message: 'Session stopped successfully' };

  } catch (error) {
    console.error('Error stopping Gemini session:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function handleAudioChunk(tabId: number | undefined, audioData: any) {
  if (!tabId) {
    return { success: false, error: 'No tab ID provided' };
  }

  try {
    const sessionInfo = activeSessions.get(tabId);
    if (!sessionInfo) {
      return { success: false, error: 'No active session for this tab' };
    }

    // Forward audio data to Gemini session
    sessionInfo.session.sendAudioData(audioData);

    return { success: true };

  } catch (error) {
    console.error('Error handling audio chunk:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Cleanup sessions when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
  const sessionInfo = activeSessions.get(tabId);
  if (sessionInfo) {
    console.log(`[Background] Tab ${tabId} closed, cleaning up session`);
    sessionInfo.session.disconnect().catch(err => {
      console.error('Error disconnecting session:', err);
    });
    activeSessions.delete(tabId);
  }
});

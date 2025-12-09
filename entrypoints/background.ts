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

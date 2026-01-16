import {
  captureAudioFromVideo,
  stopAudioTracks,
  type ExtendedHTMLVideoElement
} from '~/utils/audio-capture';
import {
  createSubtitleOverlay,
  updateSubtitles,
  removeSubtitleOverlay
} from '~/utils/subtitle-overlay';

// Track whether translation is enabled
let isEnabled = false;

export default defineContentScript({
  matches: [
    'https://*/*',
    'http://*/*',
  ],

  async main() {
    console.log('Video subtitle extension loaded');

    // Load initial enabled state from storage
    const { enabled } = await chrome.storage.local.get('enabled');
    isEnabled = enabled ?? false;
    console.log('[Content] Translation enabled:', isEnabled);

    // Initialize video detection and audio capture
    initVideoSubtitleSystem();

    // Listen for transcription results from background script
    setupTranscriptionListener();

    // Listen for toggle messages from popup
    setupToggleListener();
  },
});

interface VideoInfo {
  element: HTMLVideoElement;
  audioStream: MediaStream | null;
  audioContext: AudioContext | null;
  audioProcessingTimer: number | null;
  isCapturing: boolean;
  subtitleElement: HTMLElement | null;
}

const videoInstances = new Map<HTMLVideoElement, VideoInfo>();

// Listen for transcription results from background script
function setupTranscriptionListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TRANSCRIPTION_RESULT') {
      console.log('[Content] Received transcription:', message.text);

      // Update subtitles for all active videos
      videoInstances.forEach((videoInfo) => {
        if (videoInfo.subtitleElement && videoInfo.isCapturing) {
          updateSubtitles(message.text, videoInfo.subtitleElement);
        }
      });
    }
  });
}

// Listen for toggle messages from popup
function setupToggleListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_TRANSLATION') {
      isEnabled = message.enabled;
      console.log('[Content] Translation toggled:', isEnabled);

      if (!isEnabled) {
        // Stop all active captures when disabled
        videoInstances.forEach((videoInfo) => {
          if (videoInfo.isCapturing) {
            stopAudioCapture(videoInfo);
          }
        });
      }
    }
  });
}

function initVideoSubtitleSystem() {
  // Detect existing videos
  detectExistingVideos();

  // Watch for dynamically added videos
  observeNewVideos();

  console.log('Video subtitle system initialized');
}

function detectExistingVideos() {
  const videos = document.querySelectorAll('video');
  console.log(`Found ${videos.length} existing video elements`);

  videos.forEach(video => {
    registerVideoElement(video as HTMLVideoElement);
  });
}

function observeNewVideos() {
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;

          // Check if the added node is a video element
          if (element.tagName === 'VIDEO') {
            registerVideoElement(element as HTMLVideoElement);
          }

          // Check if the added node contains video elements
          const videos = element.querySelectorAll('video');
          videos.forEach(video => {
            registerVideoElement(video as HTMLVideoElement);
          });
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('Started observing for new video elements');
}

function registerVideoElement(video: HTMLVideoElement) {
  if (videoInstances.has(video)) {
    return; // Already registered
  }

  console.log('Registering new video element:', {
    src: video.src || video.currentSrc,
    duration: video.duration,
    width: video.videoWidth,
    height: video.videoHeight
  });

  const videoInfo: VideoInfo = {
    element: video,
    audioStream: null,
    audioContext: null,
    audioProcessingTimer: null,
    isCapturing: false,
    subtitleElement: null
  };

  videoInstances.set(video, videoInfo);

  // Add event listeners
  setupVideoEventListeners(video, videoInfo);
}

function setupVideoEventListeners(video: HTMLVideoElement, videoInfo: VideoInfo) {
  // Start audio capture when video starts playing
  video.addEventListener('play', () => {
    console.log('Video started playing, attempting audio capture');
    startAudioCapture(video, videoInfo);
  });

  // Stop audio capture when video pauses or ends
  video.addEventListener('pause', () => {
    console.log('Video paused, stopping audio capture');
    stopAudioCapture(videoInfo);
  });

  video.addEventListener('ended', () => {
    console.log('Video ended, stopping audio capture');
    stopAudioCapture(videoInfo);
  });

  // Handle video removal
  video.addEventListener('remove', () => {
    console.log('Video element removed');
    stopAudioCapture(videoInfo);
    videoInstances.delete(video);
  });
}

async function startAudioCapture(video: HTMLVideoElement, videoInfo: VideoInfo) {
  // Check if translation is enabled
  if (!isEnabled) {
    console.log('[Content] Translation disabled, not starting capture');
    return;
  }

  // Stop all other capturing videos to ensure only 1 Gemini Live session
  for (const [otherVideo, otherVideoInfo] of videoInstances) {
    if (otherVideo !== video && otherVideoInfo.isCapturing) {
      console.log('Stopping other video capture to start new session');
      await stopAudioCapture(otherVideoInfo);
    }
  }

  if (videoInfo.isCapturing) {
    console.log('Already capturing audio from this video');
    return;
  }

  try {
    // Capture audio from video using utility
    const audioResult = await captureAudioFromVideo(video as ExtendedHTMLVideoElement);

    if (!audioResult) {
      console.error('Failed to capture audio from video');
      return;
    }

    videoInfo.audioStream = audioResult.audioStream;
    videoInfo.isCapturing = true;

    // Setup Gemini Live API connection via background
    const sessionStarted = await setupGeminiConnection(videoInfo);
    if (!sessionStarted) {
      console.error('[Content] Failed to start Gemini session');
      return;
    }

    // Start local audio processing and streaming to background
    if (videoInfo.audioStream) {
      await startAudioProcessing(videoInfo);
    }

    console.log('[Content] Audio capture and streaming setup successful!');

  } catch (error) {
    console.error('Error capturing audio from video:', error);
  }
}


async function setupGeminiConnection(videoInfo: VideoInfo) {
  try {
    console.log('[Content] Starting Gemini session via background script...');

    // Send message to background to start Gemini session
    const response = await chrome.runtime.sendMessage({
      type: 'START_GEMINI_SESSION'
    });

    if (!response?.success) {
      console.error('[Content] Failed to start Gemini session:', response?.error);
      return false;
    }

    // Create subtitle overlay
    videoInfo.subtitleElement = createSubtitleOverlay(videoInfo.element);

    console.log('[Content] Gemini session started successfully');
    return true;
  } catch (error) {
    console.error('[Content] Error setting up Gemini connection:', error);
    return false;
  }
}

async function startAudioProcessing(videoInfo: VideoInfo): Promise<void> {
  if (!videoInfo.audioStream) {
    console.error('[Content] No audio stream available');
    return;
  }

  try {
    const targetSampleRate = 16000;
    const chunkDurationMs = 250;

    // Create AudioContext for processing
    videoInfo.audioContext = new AudioContext({ sampleRate: targetSampleRate });
    const mediaStreamSource = videoInfo.audioContext.createMediaStreamSource(videoInfo.audioStream);

    // Create AnalyserNode for audio data capture
    const analyserNode = videoInfo.audioContext.createAnalyser();
    const samplesNeeded = targetSampleRate * chunkDurationMs / 1000;
    analyserNode.fftSize = Math.pow(2, Math.ceil(Math.log2(samplesNeeded)));
    analyserNode.smoothingTimeConstant = 0;

    // Connect audio graph
    mediaStreamSource.connect(analyserNode);

    const bufferLength = analyserNode.fftSize;
    const audioBuffer = new Float32Array(bufferLength);

    // Start periodic audio capture
    videoInfo.audioProcessingTimer = window.setInterval(() => {
      analyserNode.getFloatTimeDomainData(audioBuffer);

      // Convert to Int16 PCM
      const pcmData = convertFloat32ToInt16PCM(audioBuffer);

      // Convert to base64
      const base64Data = arrayBufferToBase64(pcmData.buffer);

      // Send to background script
      chrome.runtime.sendMessage({
        type: 'SEND_AUDIO_CHUNK',
        audioData: {
          data: base64Data,
          mimeType: 'audio/pcm;rate=16000'
        }
      }).catch(err => {
        console.error('[Content] Error sending audio chunk:', err);
      });
    }, chunkDurationMs);

    console.log('[Content] Audio processing started');
  } catch (error) {
    console.error('[Content] Error starting audio processing:', error);
  }
}

function convertFloat32ToInt16PCM(float32Data: Float32Array): Int16Array {
  const int16Data = new Int16Array(float32Data.length);
  for (let i = 0; i < float32Data.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Data[i]));
    int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
  }
  return int16Data;
}

function arrayBufferToBase64(buffer: ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function stopAudioProcessing(videoInfo: VideoInfo): void {
  if (videoInfo.audioProcessingTimer) {
    clearInterval(videoInfo.audioProcessingTimer);
    videoInfo.audioProcessingTimer = null;
  }

  if (videoInfo.audioContext) {
    videoInfo.audioContext.close();
    videoInfo.audioContext = null;
  }

  console.log('[Content] Audio processing stopped');
}

async function stopAudioCapture(videoInfo: VideoInfo) {
  if (!videoInfo.isCapturing) {
    return;
  }

  console.log('[Content] Stopping audio capture');

  // Stop local audio processing
  stopAudioProcessing(videoInfo);

  // Stop Gemini session in background
  try {
    await chrome.runtime.sendMessage({
      type: 'STOP_GEMINI_SESSION'
    });
  } catch (error) {
    console.error('[Content] Error stopping Gemini session:', error);
  }

  // Remove subtitle overlay using utility
  removeSubtitleOverlay(videoInfo.subtitleElement);
  videoInfo.subtitleElement = null;

  // Stop all audio tracks using utility
  stopAudioTracks(videoInfo.audioStream);
  videoInfo.audioStream = null;

  videoInfo.isCapturing = false;

  console.log('[Content] Audio capture stopped');
}

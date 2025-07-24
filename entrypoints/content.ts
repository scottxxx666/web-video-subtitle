import { GeminiLiveSession } from '~/utils/gemini-live';
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

export default defineContentScript({
  matches: [
    '*://*.youtube.com/*',
    '*://*.netflix.com/*',
    '*://*.twitch.tv/*',
    '*://*.vimeo.com/*',
    '*://weverse.io/*',
    '*://localhost/*',
    'file://*/*'
  ],

  main() {
    console.log('Video subtitle extension loaded');

    // Initialize video detection and audio capture
    initVideoSubtitleSystem();
  },
});

interface VideoInfo {
  element: HTMLVideoElement;
  audioStream: MediaStream | null;
  geminiSession: GeminiLiveSession | null;
  isCapturing: boolean;
  subtitleElement: HTMLElement | null;
}

const videoInstances = new Map<HTMLVideoElement, VideoInfo>();


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

          // Check if the added node is a video
          if (element.tagName === 'VIDEO') {
            registerVideoElement(element as HTMLVideoElement);
          }

          // Check if the added node contains videos
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
    geminiSession: null,
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

    // Setup Gemini Live API connection
    await setupGeminiConnection(videoInfo);

    // Start audio processing directly with Gemini
    if (videoInfo.audioStream && videoInfo.geminiSession) {
      await videoInfo.geminiSession.startAudioProcessing(videoInfo.audioStream);
    }

    console.log('Audio capture and Gemini connection setup successful!');

  } catch (error) {
    console.error('Error capturing audio from video:', error);
  }
}


async function setupGeminiConnection(videoInfo: VideoInfo) {
  try {
    console.log('Setting up Gemini Live API connection...');


    // Create new Gemini session with subtitle callback
    videoInfo.geminiSession = new GeminiLiveSession();

    videoInfo.subtitleElement = createSubtitleOverlay(videoInfo.element);
    await videoInfo.geminiSession.connect((text: string) => {
      if (videoInfo.subtitleElement) {
        updateSubtitles(text, videoInfo.subtitleElement);
      }
    });

      console.log('Gemini Live API connection established successfully');
  return true
  } catch (error) {
    console.error('Error setting up Gemini connection:', error);
    videoInfo.geminiSession = null;
    return false
  }
}




async function stopAudioCapture(videoInfo: VideoInfo) {
  if (!videoInfo.isCapturing) {
    return;
  }

  console.log('Stopping audio capture');

  // Stop audio processing and disconnect Gemini session
  if (videoInfo.geminiSession) {
    videoInfo.geminiSession.stopAudioProcessing();
    await videoInfo.geminiSession.disconnect();
    videoInfo.geminiSession = null;
  }

  // Remove subtitle overlay using utility
  removeSubtitleOverlay(videoInfo.subtitleElement);
  videoInfo.subtitleElement = null;

  // Stop all audio tracks using utility
  stopAudioTracks(videoInfo.audioStream);
  videoInfo.audioStream = null;

  videoInfo.isCapturing = false;

  console.log('Audio capture stopped');
}

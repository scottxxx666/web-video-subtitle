export default defineContentScript({
  matches: [
    '*://*.youtube.com/*',
    '*://*.netflix.com/*',
    '*://*.twitch.tv/*',
    '*://*.vimeo.com/*',
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
  isCapturing: boolean;
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
    isCapturing: false
  };
  
  videoInstances.set(video, videoInfo);
  
  // Add event listeners
  setupVideoEventListeners(video, videoInfo);
}

function setupVideoEventListeners(video: HTMLVideoElement, videoInfo: VideoInfo) {
  // Start audio capture when video starts playing
  video.addEventListener('play', () => {
    console.log('Video started playing, attempting audio capture');
    captureAudioFromVideo(video, videoInfo);
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

async function captureAudioFromVideo(video: HTMLVideoElement, videoInfo: VideoInfo) {
  if (videoInfo.isCapturing) {
    console.log('Already capturing audio from this video');
    return;
  }
  
  try {
    console.log('Attempting to capture audio stream from video element');
    
    // Check if the video element supports captureStream
    if (typeof video.captureStream !== 'function') {
      console.error('captureStream not supported on this video element');
      return;
    }
    
    // Capture the media stream from the video element
    const stream = video.captureStream();
    
    if (!stream) {
      console.error('Failed to capture stream from video');
      return;
    }
    
    // Get only audio tracks
    const audioTracks = stream.getAudioTracks();
    
    if (audioTracks.length === 0) {
      console.warn('No audio tracks found in video stream');
      return;
    }
    
    console.log(`Captured audio stream with ${audioTracks.length} audio tracks`);
    
    // Create audio-only stream
    const audioStream = new MediaStream(audioTracks);
    
    videoInfo.audioStream = audioStream;
    videoInfo.isCapturing = true;
    
    // Log audio track details
    audioTracks.forEach((track, index) => {
      console.log(`Audio track ${index}:`, {
        id: track.id,
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState,
        settings: track.getSettings()
      });
    });
    
    console.log('Audio capture successful!');
    
    // TODO: In next phase, we'll process this audio stream with MediaRecorder
    // and send it to Gemini Live API
    
  } catch (error) {
    console.error('Error capturing audio from video:', error);
  }
}

function stopAudioCapture(videoInfo: VideoInfo) {
  if (!videoInfo.isCapturing || !videoInfo.audioStream) {
    return;
  }
  
  console.log('Stopping audio capture');
  
  // Stop all audio tracks
  videoInfo.audioStream.getAudioTracks().forEach(track => {
    track.stop();
  });
  
  videoInfo.audioStream = null;
  videoInfo.isCapturing = false;
  
  console.log('Audio capture stopped');
}

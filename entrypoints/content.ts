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
  mediaRecorder: MediaRecorder | null;
  isCapturing: boolean;
  audioChunks: Blob[];
}

const videoInstances = new Map<HTMLVideoElement, VideoInfo>();

// Audio processing configuration
const AUDIO_CONFIG = {
  CHUNK_DURATION: 3000, // 3 seconds - good balance for sentence boundaries
  OVERLAP_DURATION: 500, // 0.5 second overlap to prevent word cutting
  MIME_TYPE: 'audio/webm;codecs=opus', // Efficient for speech
  SAMPLE_RATE: 16000 // Standard for speech recognition
};

// Extend HTMLVideoElement type to include captureStream
interface ExtendedHTMLVideoElement extends HTMLVideoElement {
  captureStream?: () => MediaStream;
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
    mediaRecorder: null,
    isCapturing: false,
    audioChunks: []
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

async function captureAudioFromVideo(video: ExtendedHTMLVideoElement, videoInfo: VideoInfo) {
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
    videoInfo.audioStream = new MediaStream(audioTracks);
    videoInfo.isCapturing = true;
    
    // Log audio track details
    audioTracks.forEach((track: MediaStreamTrack, index: number) => {
      console.log(`Audio track ${index}:`, {
        id: track.id,
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState,
        settings: track.getSettings()
      });
    });
    
    // Setup MediaRecorder for audio processing
    await setupMediaRecorder(videoInfo);
    
    console.log('Audio capture and MediaRecorder setup successful!');
    
  } catch (error) {
    console.error('Error capturing audio from video:', error);
  }
}

async function setupMediaRecorder(videoInfo: VideoInfo) {
  if (!videoInfo.audioStream) {
    console.error('No audio stream available for MediaRecorder');
    return;
  }
  
  try {
    // Check MediaRecorder support for our preferred format
    const mimeType = AUDIO_CONFIG.MIME_TYPE;
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      console.warn(`${mimeType} not supported, falling back to default`);
    }
    
    // Create MediaRecorder with optimal settings for speech recognition
    const options: MediaRecorderOptions = {
      mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'audio/webm',
      audioBitsPerSecond: 32000 // Good quality for speech
    };
    
    videoInfo.mediaRecorder = new MediaRecorder(videoInfo.audioStream, options);
    videoInfo.audioChunks = [];
    
    // Handle data available events - this is where we get audio chunks
    videoInfo.mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) {
        console.log(`Audio chunk received: ${event.data.size} bytes`);
        videoInfo.audioChunks.push(event.data);
        
        // Process the audio chunk for speech recognition
        processAudioChunk(event.data, videoInfo);
      }
    });
    
    // Handle recording stop
    videoInfo.mediaRecorder.addEventListener('stop', () => {
      console.log('MediaRecorder stopped');
      if (videoInfo.audioChunks.length > 0) {
        // Process final audio data
        const finalBlob = new Blob(videoInfo.audioChunks, { type: options.mimeType });
        console.log(`Final audio blob: ${finalBlob.size} bytes`);
        // TODO: Send final chunk to Gemini Live API
        videoInfo.audioChunks = [];
      }
    });
    
    // Handle errors
    videoInfo.mediaRecorder.addEventListener('error', (event) => {
      console.error('MediaRecorder error:', event);
    });
    
    // Start recording with our configured chunk duration
    // This creates chunks that are good for sentence boundaries
    videoInfo.mediaRecorder.start(AUDIO_CONFIG.CHUNK_DURATION);
    
    console.log(`MediaRecorder started with ${AUDIO_CONFIG.CHUNK_DURATION}ms chunks`);
    
  } catch (error) {
    console.error('Error setting up MediaRecorder:', error);
  }
}

function processAudioChunk(audioBlob: Blob, videoInfo: VideoInfo) {
  console.log(`Processing audio chunk: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
  
  // TODO: Next phase - send this audio chunk to Gemini Live API
  // The chunk duration (3 seconds) is optimized to:
  // 1. Capture complete sentences/phrases
  // 2. Minimize latency 
  // 3. Reduce API calls
  
  // For now, just log the chunk info
  console.log('Audio chunk ready for speech recognition processing');
}

function stopAudioCapture(videoInfo: VideoInfo) {
  if (!videoInfo.isCapturing) {
    return;
  }
  
  console.log('Stopping audio capture');
  
  // Stop MediaRecorder if active
  if (videoInfo.mediaRecorder && videoInfo.mediaRecorder.state !== 'inactive') {
    videoInfo.mediaRecorder.stop();
    videoInfo.mediaRecorder = null;
  }
  
  // Stop all audio tracks
  if (videoInfo.audioStream) {
    videoInfo.audioStream.getAudioTracks().forEach(track => {
      track.stop();
    });
    videoInfo.audioStream = null;
  }
  
  // Clear audio chunks
  videoInfo.audioChunks = [];
  videoInfo.isCapturing = false;
  
  console.log('Audio capture stopped');
}

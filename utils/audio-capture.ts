// Audio capture utility for video elements

// Audio processing configuration
export const AUDIO_CONFIG = {
  CHUNK_DURATION: 3000, // 3 seconds - good balance for sentence boundaries
  OVERLAP_DURATION: 500, // 0.5 second overlap to prevent word cutting
  MIME_TYPE: 'audio/webm;codecs=pcm', // Efficient for speech
  SAMPLE_RATE: 16000 // Standard for speech recognition
};

// Extend HTMLVideoElement type to include captureStream
export interface ExtendedHTMLVideoElement extends HTMLVideoElement {
  captureStream?: () => MediaStream;
}

export interface AudioCaptureResult {
  audioStream: MediaStream;
  audioTracks: MediaStreamTrack[];
}

export async function captureAudioFromVideo(video: ExtendedHTMLVideoElement): Promise<AudioCaptureResult | null> {
  try {
    console.log('Attempting to capture audio stream from video element');

    // Check if the video element supports captureStream
    if (typeof video.captureStream !== 'function') {
      console.error('captureStream not supported on this video element');
      return null;
    }

    // Capture the media stream from the video element
    const stream = video.captureStream();

    if (!stream) {
      console.error('Failed to capture stream from video');
      return null;
    }

    // Get only audio tracks
    const audioTracks = stream.getAudioTracks();

    if (audioTracks.length === 0) {
      console.warn('No audio tracks found in video stream');
      return null;
    }

    console.log(`Captured audio stream with ${audioTracks.length} audio tracks`);

    // Create audio-only stream
    const audioStream = new MediaStream(audioTracks);

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

    return { audioStream, audioTracks };

  } catch (error) {
    console.error('Error capturing audio from video:', error);
    return null;
  }
}

export function stopAudioTracks(audioStream: MediaStream | null): void {
  if (audioStream) {
    audioStream.getAudioTracks().forEach(track => {
      track.stop();
    });
  }
}

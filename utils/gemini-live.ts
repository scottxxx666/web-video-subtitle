import { GoogleGenAI, Modality } from '@google/genai';
import { WaveFile } from 'wavefile';

// Gemini Live API configuration
export interface GeminiConfig {
  apiKey: string;
  model: string;
}

// Gemini Live Session for real-time speech recognition
export class GeminiLiveSession {
  private config: GeminiConfig | null = null;
  private session: any = null;
  private audioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private captureTimer: number | null = null;
  private audioBufferQueue: Float32Array[] = [];
  private targetSampleRate = 16000;
  private captureInterval = 1000; // 1 second - collect 1s samples
  private bufferCount = 4; // 4 buffers × 1s = 4 seconds
  private saveProcessedAudio = false; // Set to false to disable processed audio saving

  constructor() {
    console.log('GeminiLiveSession created');
  }

  async connect(){
      console.log('Attempting to connect to Gemini Live API...');

      this.config = {
        apiKey: 'apiKey', // Replace with actual API key
        model: 'gemini-live-2.5-flash-preview', // Default model
      }
      console.log('Got Gemini config:', {model: this.config.model});

      const ai = new GoogleGenAI({
        apiKey: this.config.apiKey,
      });

    this.session = await ai.live.connect({
        model: this.config.model,
        callbacks: {
          onopen: function () {
            console.debug('Opened');
          },
          onmessage: function (message) {
            // responseQueue.push(message);
            console.log('Received message:', message);
          },
          onerror: function (e) {
            console.debug('Error:', e.message);
          },
          onclose: function (e) {
            console.debug('Close:', e.reason);
          },
        },
        config: {
          responseModalities: [Modality.TEXT],
          // systemInstruction: "convert speech to text in real-time. if not recognize tell me why. plz give me response for every audio chunk as soon as possible",
          systemInstruction: "請將聲音檔中的非繁體中文的部分都產生繁體中文字幕，並在最短時間內傳回",
        },
      });


      return true;
  }

  async startAudioProcessing(mediaStream: MediaStream): Promise<void> {
    if (!this.session) {
      console.error('Cannot start audio processing: session not connected');
      return;
    }

    try {
      this.audioContext = new AudioContext({ sampleRate: this.targetSampleRate });
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(mediaStream);

      // Create AnalyserNode for audio data capture
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 16384; // 16384 samples = ~1.02 seconds at 16kHz
      this.analyserNode.smoothingTimeConstant = 0;

      if (this.saveProcessedAudio) {
        console.log('Processed audio saving enabled - WAV files will be auto-downloaded');
      }

      // Connect audio graph: MediaStream -> AnalyserNode
      this.mediaStreamSource.connect(this.analyserNode);

      // Start periodic audio capture
      this.startAudioCapture();

      console.log('Audio processing started with AnalyserNode');
    } catch (error) {
      console.error('Error starting audio processing:', error);
    }
  }

  private startAudioCapture(): void {
    if (!this.analyserNode) return;

    const bufferLength = this.analyserNode.fftSize;
    const audioBuffer = new Float32Array(bufferLength);

    this.captureTimer = window.setInterval(() => {
      if (this.analyserNode) {
        // Get time domain data (raw audio samples) - 1 second worth
        this.analyserNode.getFloatTimeDomainData(audioBuffer);
        this.collectAudioSample(new Float32Array(audioBuffer)); // Copy the buffer
      }
    }, this.captureInterval);
  }

  private collectAudioSample(audioSample: Float32Array): void {
    // Add 1-second sample to queue
    this.audioBufferQueue.push(audioSample);
    console.log(`Collected audio sample ${this.audioBufferQueue.length}/${this.bufferCount} (~1 second each)`);

    // If we have 4 samples (4 seconds), process them
    if (this.audioBufferQueue.length >= this.bufferCount) {
      this.processAccumulatedAudio();
    }
  }

  private processAccumulatedAudio(): void {
    if (this.audioBufferQueue.length === 0) return;

    try {
      // Concatenate all 1-second buffers into one 4-second audio chunk
      const totalSamples = this.audioBufferQueue.reduce((sum, buffer) => sum + buffer.length, 0);
      const combinedBuffer = new Float32Array(totalSamples);

      let offset = 0;
      for (const buffer of this.audioBufferQueue) {
        combinedBuffer.set(buffer, offset);
        offset += buffer.length;
      }

      // Process the combined 4-second audio
      this.processAudioData(combinedBuffer);

      // Clear the queue for next accumulation
      this.audioBufferQueue = [];

      console.log(`Processed ${totalSamples} samples (~${(totalSamples / this.targetSampleRate).toFixed(1)}s of audio)`);

    } catch (error) {
      console.error('Error processing accumulated audio:', error);
      this.audioBufferQueue = []; // Clear queue on error
    }
  }

  private processAudioData(audioData: Float32Array): void {
    try {
      // Convert to Int16 PCM
      const pcmData = this.convertFloat32ToInt16PCM(audioData);

      // Save processed audio to WAV file if enabled
      if (this.saveProcessedAudio) {
        this.saveAsWavFile(pcmData);
      }

      // Convert to base64 and send to Gemini
      const base64Data = this.arrayBufferToBase64(pcmData.buffer);
      this.session.sendRealtimeInput({
        audio: {
          data: base64Data,
          mimeType: "audio/pcm;rate=16000"
        }
      });
      console.log('Processed audio data and sent to Gemini:', base64Data.length, 'bytes');

    } catch (error) {
      console.error('Error processing audio data:', error);
    }
  }

  private saveAsWavFile(pcmData: Int16Array): void {
    try {
      // Create WAV file using wavefile package
      const wav = new WaveFile();
      wav.fromScratch(1, this.targetSampleRate, '16', pcmData);

      // Convert to buffer and create blob for download
      const wavBuffer = wav.toBuffer();
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      this.downloadWavFile(blob);

    } catch (error) {
      console.error('Error creating WAV file:', error);
    }
  }

  private downloadWavFile(wavBlob: Blob): void {
    const timestamp = Date.now();
    const filename = `processed_audio_${timestamp}.wav`;

    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`Downloaded processed audio: ${filename} (${wavBlob.size} bytes)`);
  }

  private convertFloat32ToInt16PCM(float32Data: Float32Array): Int16Array {
    const int16Data = new Int16Array(float32Data.length);

    for (let i = 0; i < float32Data.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Data[i]));
      int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    return int16Data;
  }

  private arrayBufferToBase64(buffer: ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async disconnect(): Promise<void> {
    this.stopAudioProcessing();
    if (this.session) {
      // Close Gemini session if it has a close method
      try {
        await this.session.close?.();
      } catch (error) {
        console.error('Error closing Gemini session:', error);
      }
      this.session = null;
    }
    console.log('Gemini session disconnected');
  }

  stopAudioProcessing(): void {
    if (this.captureTimer) {
      clearInterval(this.captureTimer);
      this.captureTimer = null;
    }

    // Clear any remaining buffers
    this.audioBufferQueue = [];

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    console.log('Audio processing stopped');
  }


}

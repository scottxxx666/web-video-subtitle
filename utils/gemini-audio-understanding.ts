import { GoogleGenAI } from '@google/genai';
import { WaveFile } from 'wavefile';

// Gemini Audio Understanding configuration
export interface GeminiConfig {
  apiKey: string;
  model: string;
}

// Connection states for tracking session status
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  FAILED = 'failed'
}

// System prompt for Korean entertainment subtitle processing
const SYSTEM_PROMPT = `請執行韓國娛樂人士語音字幕處理任務：

**適用對象**：韓國偶像、明星、演員
**處理規則**：
- 韓語內容：翻譯為繁體中文
- 中文/英文內容：保持原文不翻譯
- 混合語言：分別按語言處理

**輸出要求**：
1. 翻譯背景：基於韓國娛樂圈文化進行翻譯
2. 專業術語：準確翻譯韓流相關用語、敬語、粉絲文化用詞
3. 語言識別：僅輸出中文或英文
4. 不需要標記時間，只需要將字幕內容分段輸出為純文本
5. 只回傳字幕內容就好，如果沒有內容就回傳空字串`;

// Gemini Audio Understanding Session for batch speech recognition
export class GeminiAudioUnderstandingSession {
  private genAI: GoogleGenAI | null = null;
  private config: GeminiConfig | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private captureTimer: number | null = null;
  private audioBufferQueue: Float32Array[] = [];
  private isProcessing = false;
  private updateSubtitleCallback: ((text: string) => void) | null = null;
  private currentMediaStream: MediaStream | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private apiKey: string;

  // Audio configuration
  private targetSampleRate = 16000;
  private batchDurationMs = 4000; // Accumulate 4 seconds of audio before processing
  private chunkDurationMs = 1000; // Capture audio every 1 second
  private accumulatedDurationMs = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    console.log('GeminiAudioUnderstandingSession created');
  }

  // Computed properties for audio capture
  private get fftSize(): number {
    const samplesNeeded = this.targetSampleRate * this.chunkDurationMs / 1000;
    return Math.pow(2, Math.ceil(Math.log2(samplesNeeded)));
  }

  async connect(updateSubtitle: (text: string) => void): Promise<boolean> {
    console.log('Initializing Gemini Audio Understanding session...');

    this.connectionState = ConnectionState.CONNECTING;
    this.updateSubtitleCallback = updateSubtitle;

    try {
      this.config = {
        apiKey: this.apiKey,
        model: 'gemini-2.0-flash-lite', // Cheaper model for batch processing
      };

      this.genAI = new GoogleGenAI({
        apiKey: this.config.apiKey,
      });

      this.connectionState = ConnectionState.CONNECTED;
      console.log('Gemini Audio Understanding session initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize Gemini session:', error);
      this.connectionState = ConnectionState.FAILED;
      return false;
    }
  }

  async startAudioProcessing(mediaStream: MediaStream): Promise<void> {
    if (!this.genAI) {
      console.error('Cannot start audio processing: session not initialized');
      return;
    }

    this.currentMediaStream = mediaStream;

    try {
      this.audioContext = new AudioContext({ sampleRate: this.targetSampleRate });
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(mediaStream);

      // Create AnalyserNode for audio data capture
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = this.fftSize;
      this.analyserNode.smoothingTimeConstant = 0;

      // Connect audio graph: MediaStream -> AnalyserNode
      this.mediaStreamSource.connect(this.analyserNode);

      // Reset buffer queue
      this.audioBufferQueue = [];
      this.accumulatedDurationMs = 0;

      // Start periodic audio capture
      this.startAudioCapture();

      console.log('Audio processing started with batch mode');
    } catch (error) {
      console.error('Error starting audio processing:', error);
    }
  }

  stopAudioProcessing(): void {
    if (this.captureTimer) {
      clearInterval(this.captureTimer);
      this.captureTimer = null;
    }

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

    // Process any remaining audio in the queue
    if (this.audioBufferQueue.length > 0 && !this.isProcessing) {
      this.processAudioQueue();
    }

    console.log('Audio processing stopped');
  }

  async disconnect(): Promise<void> {
    this.connectionState = ConnectionState.DISCONNECTED;
    this.stopAudioProcessing();
    this.genAI = null;
    this.audioBufferQueue = [];
    this.accumulatedDurationMs = 0;
    console.log('Gemini Audio Understanding session disconnected');
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // Method for compatibility with background.ts (not used in batch mode)
  sendAudioData(_audioData: { data: string; mimeType: string }): void {
    // Not used in batch mode - audio is captured directly
    console.warn('sendAudioData called but batch mode captures audio directly');
  }

  private startAudioCapture(): void {
    if (!this.analyserNode) return;

    const bufferLength = this.analyserNode.fftSize;
    const audioBuffer = new Float32Array(bufferLength);

    this.captureTimer = window.setInterval(() => {
      if (this.analyserNode) {
        // Get time domain data (raw audio samples)
        this.analyserNode.getFloatTimeDomainData(audioBuffer);

        // Add to buffer queue
        this.audioBufferQueue.push(new Float32Array(audioBuffer));
        this.accumulatedDurationMs += this.chunkDurationMs;

        // Process queue when we've accumulated enough audio
        if (this.accumulatedDurationMs >= this.batchDurationMs && !this.isProcessing) {
          this.processAudioQueue();
        }
      }
    }, this.chunkDurationMs);
  }

  private async processAudioQueue(): Promise<void> {
    if (this.audioBufferQueue.length === 0 || !this.genAI || !this.config) {
      return;
    }

    this.isProcessing = true;

    try {
      // Combine all buffers
      const combinedBuffer = this.combineAudioBuffers(this.audioBufferQueue);

      // Clear the queue and reset duration
      this.audioBufferQueue = [];
      this.accumulatedDurationMs = 0;

      // Convert to Int16 PCM then to WAV
      const pcmData = this.convertFloat32ToInt16PCM(combinedBuffer);
      const wavBase64 = this.createWavBase64(pcmData);

      // Send to Gemini generateContent API
      const response = await this.genAI.models.generateContent({
        model: this.config.model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/wav',
                  data: wavBase64,
                },
              },
              {
                text: SYSTEM_PROMPT,
              },
            ],
          },
        ],
      });

      // Extract transcription text from response
      const text = response.text?.trim() || '';

      if (text && this.updateSubtitleCallback) {
        console.log('Transcription result:', text);
        this.updateSubtitleCallback(text);
      }
    } catch (error) {
      console.error('Error processing audio queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private combineAudioBuffers(buffers: Float32Array[]): Float32Array {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const combined = new Float32Array(totalLength);

    let offset = 0;
    for (const buffer of buffers) {
      combined.set(buffer, offset);
      offset += buffer.length;
    }

    return combined;
  }

  private convertFloat32ToInt16PCM(float32Data: Float32Array): Int16Array {
    const int16Data = new Int16Array(float32Data.length);

    for (let i = 0; i < float32Data.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Data[i]));
      int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    return int16Data;
  }

  private createWavBase64(pcmData: Int16Array): string {
    // Create WAV file using wavefile package
    const wav = new WaveFile();
    wav.fromScratch(1, this.targetSampleRate, '16', pcmData);

    // Convert to buffer and then to base64
    const wavBuffer = wav.toBuffer();
    return this.arrayBufferToBase64(wavBuffer);
  }

  private arrayBufferToBase64(buffer: ArrayBufferLike | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

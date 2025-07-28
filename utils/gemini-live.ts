import { ActivityHandling, EndSensitivity, GoogleGenAI, Modality, StartSensitivity, TurnCoverage } from '@google/genai';
import { WaveFile } from 'wavefile';

// Gemini Live API configuration
export interface GeminiConfig {
  apiKey: string;
  model: string;
}

// Connection states for tracking Gemini session status
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}

// Gemini Live Session for real-time speech recognition
export class GeminiLiveSession {
  private config: GeminiConfig | null = null;
  private session: any = null;
  private currentTurnText = ''; // Accumulate text within a turn
  private audioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private captureTimer: number | null = null;
  private targetSampleRate = 16000;
  private chunkDurationMs = 250; // 1 second audio chunks
  private saveProcessedAudio = false; // Set to false to disable processed audio saving

  // Reconnection management
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private isIntentionalDisconnect = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000; // 1 second
  private maxReconnectDelay = 30000; // 30 seconds
  private reconnectTimeoutId: number | null = null;
  private updateSubtitleCallback: ((text: string) => void) | null = null;
  private currentMediaStream: MediaStream | null = null;

  constructor() {
    console.log('GeminiLiveSession created');
  }

  // Computed properties based on chunk duration
  private get fftSize(): number {
    // Calculate samples needed for desired duration, round up to nearest power of 2
    const samplesNeeded = this.targetSampleRate * this.chunkDurationMs / 1000;
    return Math.pow(2, Math.ceil(Math.log2(samplesNeeded)));
  }

  private get captureInterval(): number {
    return this.chunkDurationMs;
  }

  async connect(updateSubtitle: ((text: string) => void)) {
    console.log('Attempting to connect to Gemini Live API...');

    this.connectionState = ConnectionState.CONNECTING;
    this.updateSubtitleCallback = updateSubtitle;

      this.config = {
        apiKey: 'apiKey', // Replace with actual API key
        model: 'gemini-live-2.5-flash-preview', // Default model
      }

    const ai = new GoogleGenAI({
      apiKey: this.config.apiKey,
    });

    this.session = await ai.live.connect({
      model: this.config.model,
      callbacks: {
        onopen: () => {
          console.debug('Gemini connection opened');
          this.connectionState = ConnectionState.CONNECTED;
          this.reconnectAttempts = 0; // Reset reconnection attempts on successful connection
        },
        onmessage: (message) => {
          // console.log('Received message:', message);

          // Handle transcription responses
          if (message.serverContent) {
            if (message.serverContent.modelTurn && message.serverContent.modelTurn.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.text) {
                  this.currentTurnText += part.text;
                }
              }
            }

            // When turn is complete, send accumulated text
            if (message.serverContent.turnComplete) {
              if (this.currentTurnText.trim()) {
                // console.log('Turn completed with text:', this.currentTurnText);
                if (this.updateSubtitleCallback) {
                  this.updateSubtitleCallback(this.currentTurnText);
                }
                this.currentTurnText = ''; // Reset for next turn
              }
            }
          }
        },
        onerror: (e) => {
          console.debug('Gemini connection error:', e.message);
          this.connectionState = ConnectionState.FAILED;
        },
        onclose: (e) => {
          console.debug('Gemini connection closed:', e.reason);
          this.handleConnectionClose(e);
        },
      },
      config: {
        responseModalities: [Modality.TEXT],
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false, // default
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
            prefixPaddingMs: 20, // optional
            silenceDurationMs: 20, // optional
          },
          activityHandling: ActivityHandling.NO_INTERRUPTION,
        },
        systemInstruction: `請執行韓國娛樂人士語音即時字幕處理任務：

**適用對象**：韓國偶像、演員
**處理規則**：
- 韓語內容：翻譯為繁體中文
- 中文/英文內容：保持原文不翻譯
- 混合語言：分別按語言處理
- 請準確翻譯所有聽到的內容，不要省略任何句子
- 可能同時有多人說話，請全部翻譯出來，寧願多翻或錯翻也不要缺少翻譯

**輸出要求**：
1. 即時處理：完成後立即傳回，避免延遲
2. 字幕格式：每句話獨立處理，翻譯好一句就先傳回來同時繼續翻譯
3. 翻譯背景：基於韓國娛樂圈文化進行翻譯
4. 專業術語：準確翻譯韓流相關用語、敬語、粉絲文化用詞
5. 語言識別：僅輸出中文或英文`,
      },
    });


    return true;
  }

  async startAudioProcessing(mediaStream: MediaStream): Promise<void> {
    if (!this.session) {
      console.error('Cannot start audio processing: session not connected');
      return;
    }

    this.currentMediaStream = mediaStream; // Store for potential reconnection

    try {
      this.audioContext = new AudioContext({sampleRate: this.targetSampleRate});
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(mediaStream);

      // Create AnalyserNode for audio data capture
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = this.fftSize; // Calculated from chunk duration
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

  async disconnect(): Promise<void> {
    this.isIntentionalDisconnect = true; // Mark as intentional disconnect
    this.connectionState = ConnectionState.DISCONNECTED;

    // Clear any pending reconnection attempts
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    this.stopAudioProcessing();
    if (this.session) {
      try {
        await this.session.close?.();
      } catch (error) {
        console.error('Error closing Gemini session:', error);
      }
      this.session = null;
    }
    console.log('Gemini session disconnected');
  }

  // Handle connection closure and determine if reconnection is needed
  private handleConnectionClose(_closeEvent: any): void {
    console.log('Connection closed. Intentional:', this.isIntentionalDisconnect);

    if (this.isIntentionalDisconnect) {
      // This was an intentional disconnect, don't reconnect
      this.connectionState = ConnectionState.DISCONNECTED;
      this.isIntentionalDisconnect = false; // Reset flag
      return;
    }

    // This was an unexpected disconnect, attempt reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.connectionState = ConnectionState.RECONNECTING;
      void this.attemptReconnection();
    } else {
      console.error('Max reconnection attempts reached. Connection failed permanently.');
      this.connectionState = ConnectionState.FAILED;
    }
  }

  // Attempt to reconnect with exponential backoff
  private async attemptReconnection(): Promise<void> {
    this.reconnectAttempts++;

    // Calculate delay using exponential backoff
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);

    this.reconnectTimeoutId = window.setTimeout(async () => {
      try {
        if (!this.updateSubtitleCallback) {
          console.error('Cannot reconnect: subtitle callback not available');
          return;
        }

        // Attempt to reconnect
        await this.connect(this.updateSubtitleCallback);

        // If reconnection successful and we have a media stream, restart audio processing
        if (this.currentMediaStream && this.connectionState === ConnectionState.CONNECTED) {
          await this.startAudioProcessing(this.currentMediaStream);
          console.log('Reconnection successful. Audio processing resumed.');
        }

      } catch (error) {
        console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);

        // If this wasn't the last attempt, try again
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          void this.attemptReconnection();
        } else {
          console.error('All reconnection attempts failed. Connection permanently failed.');
          this.connectionState = ConnectionState.FAILED;
        }
      }
    }, delay);
  }

  // Public method to get current connection state
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // Public method to manually trigger reconnection
  async manualReconnect(): Promise<boolean> {
    if (this.connectionState === ConnectionState.CONNECTED) {
      console.log('Already connected. No need to reconnect.');
      return true;
    }

    console.log('Manual reconnection triggered...');
    this.reconnectAttempts = 0; // Reset attempts for manual reconnection

    try {
      if (!this.updateSubtitleCallback) {
        console.error('Cannot reconnect: subtitle callback not available');
        return false;
      }

      await this.connect(this.updateSubtitleCallback);

      if (this.currentMediaStream && this.connectionState === ConnectionState.CONNECTED) {
        await this.startAudioProcessing(this.currentMediaStream);
        console.log('Manual reconnection successful.');
        return true;
      }

      return this.connectionState === ConnectionState.CONNECTED;
    } catch (error) {
      console.error('Manual reconnection failed:', error);
      return false;
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

    console.log('Audio processing stopped');
  }

  private startAudioCapture(): void {
    if (!this.analyserNode) return;

    const bufferLength = this.analyserNode.fftSize;
    const audioBuffer = new Float32Array(bufferLength);

    this.captureTimer = window.setInterval(() => {
      if (this.analyserNode) {
        // Get time domain data (raw audio samples) - send immediately
        this.analyserNode.getFloatTimeDomainData(audioBuffer);
        this.processAudioData(new Float32Array(audioBuffer)); // Send directly
      }
    }, this.captureInterval);
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
      const blob = new Blob([wavBuffer], {type: 'audio/wav'});
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


}

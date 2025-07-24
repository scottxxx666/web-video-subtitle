import { ActivityHandling, EndSensitivity, GoogleGenAI, Modality, StartSensitivity } from '@google/genai';
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
  private currentTurnText = ''; // Accumulate text within a turn
  private audioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private captureTimer: number | null = null;
  private targetSampleRate = 16000;
  private chunkDurationMs = 250; // 1 second audio chunks
  private saveProcessedAudio = false; // Set to false to disable processed audio saving

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
          console.debug('Opened');
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
                console.log('Turn completed with text:', this.currentTurnText);
                updateSubtitle(this.currentTurnText);
                this.currentTurnText = ''; // Reset for next turn
              }
            }
          }
        },
        onerror: (e) => {
          console.debug('Error:', e.message);
        },
        onclose: (e) => {
          console.debug('Close:', e.reason);
        },
      },
      config: {
        responseModalities: [Modality.TEXT],
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false, // default
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
            prefixPaddingMs: 20, // optional
            silenceDurationMs: 100, // optional
          },
          // activityHandling: ActivityHandling.NO_INTERRUPTION,
          // turnCoverage: TurnCoverage.TURN_INCLUDES_ALL_INPUT,
        },
        systemInstruction: `請執行韓國娛樂人士語音即時字幕處理任務：

**適用對象**：韓國偶像、明星、演員
**處理規則**：
- 韓語內容：翻譯為繁體中文
- 中文/英文內容：保持原文不翻譯
- 混合語言：分別按語言處理

**輸出要求**：
1. 即時處理：完成後立即傳回，避免延遲
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

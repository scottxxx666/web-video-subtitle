import { GoogleGenAI } from '@google/genai';
import { WaveFile } from 'wavefile';

// Gemini Live API configuration
export interface GeminiConfig {
  apiKey: string;
  model: string;
}

// Gemini Audio Understanding Session for batch speech recognition
export class GeminiLiveSession {
  private config: GeminiConfig;
  private genAI: GoogleGenAI | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private captureTimer: number | null = null;
  private targetSampleRate = 16000;
  private chunkDurationMs = 1000; // 1 second audio chunks for capture
  private duration = 4000; // 5 seconds
  private updateSubtitleCallback: ((text: string) => void) | null = null;
  private audioBufferQueue: AudioBuffer[] = [];
  private isProcessing = false;

  constructor() {
    this.config = {
      apiKey: 'apiKey', // Replace with actual API key
      model: 'gemini-2.5-flash-lite', // Default model for audio understanding
    }
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
    console.log('Attempting to connect to Gemini Audio Understanding API...');

    this.genAI = new GoogleGenAI({apiKey: this.config.apiKey});
    this.updateSubtitleCallback = updateSubtitle;

    console.log('Gemini Audio Understanding API connection established successfully');
    return true;
  }

  async startAudioProcessing(mediaStream: MediaStream): Promise<void> {
    if (!this.genAI) {
      console.error('Cannot start audio processing: Gemini AI not connected');
      return;
    }

    try {
      this.audioContext = new AudioContext({sampleRate: this.targetSampleRate});
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(mediaStream);

      // Create AnalyserNode for audio data capture
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = this.fftSize; // Calculated from chunk duration
      this.analyserNode.smoothingTimeConstant = 0;

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
    this.genAI = null;
    this.updateSubtitleCallback = null;
    this.audioBufferQueue = [];
    this.isProcessing = false;
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
    if (!this.analyserNode || !this.audioContext) return;

    const bufferLength = this.analyserNode.fftSize;
    const audioBuffer = new Float32Array(bufferLength);

    this.captureTimer = window.setInterval(() => {
      if (this.analyserNode && this.audioContext) {
        // Get time domain data (raw audio samples)
        this.analyserNode.getFloatTimeDomainData(audioBuffer);

        // Create AudioBuffer for batch processing
        const audioBufferForProcessing = this.audioContext.createBuffer(
          1, // mono
          audioBuffer.length,
          this.targetSampleRate
        );
        audioBufferForProcessing.copyToChannel(audioBuffer, 0);

        // Add to buffer queue
        this.audioBufferQueue.push(audioBufferForProcessing);

        if (this.audioBufferQueue.length >= (this.duration/this.chunkDurationMs) && !this.isProcessing) {
          this.processAudioQueue();
        }
      }
    }, this.captureInterval);
  }

  private async processAudioQueue(): Promise<void> {
    if (this.isProcessing || this.audioBufferQueue.length === 0 || !this.genAI || !this.updateSubtitleCallback) {
      return;
    }

    this.isProcessing = true;

    // Take a copy of current buffers for processing
    const buffersToProcess = [...this.audioBufferQueue];

    // Clear buffer immediately after taking copy to continue capturing new audio
    this.audioBufferQueue = [];

    try {
      // Combine all buffers into one 5-second buffer
      const combinedBuffer = this.combineAudioBuffers(buffersToProcess);

      // Convert combined AudioBuffer to WAV using wavefile
      const channelData = combinedBuffer.getChannelData(0);
      const pcmData = this.convertFloat32ToInt16PCM(channelData);

      const wav = new WaveFile();
      wav.fromScratch(1, this.targetSampleRate, '16', pcmData);
      const wavBuffer = wav.toBuffer();
      const base64Data = this.arrayBufferToBase64(wavBuffer);

      // Send audio to Gemini for transcription
      let contents = [
        {
          text: `請執行韓國娛樂人士語音字幕處理任務：

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
5. 只回傳字幕內容就好，如果沒有內容就回傳空字串`
        },
        {
          inlineData: {
            data: base64Data,
            mimeType: "audio/wav"
          }
        }
      ];
      const response = await this.genAI.models.generateContent({
        model: this.config.model,
        contents
      });

      const text = response.text || '';
      console.log(response);

      if (text.trim()) {
        this.updateSubtitleCallback(text.trim());
      }

    } catch (error) {
      console.error('Error processing audio queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }


  private combineAudioBuffers(buffers: AudioBuffer[]): AudioBuffer {
    if (buffers.length === 0) {
      throw new Error('No buffers to combine');
    }

    if (buffers.length === 1) {
      return buffers[0];
    }

    // Calculate total length
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);

    // Create combined buffer
    const combinedBuffer = this.audioContext!.createBuffer(
      1, // mono
      totalLength,
      this.targetSampleRate
    );

    // Copy all buffer data into combined buffer
    let offset = 0;
    const combinedChannelData = combinedBuffer.getChannelData(0);

    for (const buffer of buffers) {
      const bufferChannelData = buffer.getChannelData(0);
      combinedChannelData.set(bufferChannelData, offset);
      offset += buffer.length;
    }

    return combinedBuffer;
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

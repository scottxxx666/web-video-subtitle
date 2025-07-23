# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser extension built with **WXT** (Web Extension Toolkit) and **React 19** that provides **real-time video subtitles** by capturing audio from video elements and streaming it to **Gemini Live API** for speech recognition. The project uses TypeScript throughout and supports both Chrome/Chromium and Firefox browsers.

## Development Commands

Use **Yarn** as the package manager for this project:

```bash
# Install dependencies (including Gemini SDK)
yarn install

# Development (Chrome/Chromium)
yarn dev

# Development (Firefox)
yarn dev:firefox

# Production build (Chrome/Chromium)
yarn build

# Production build (Firefox)
yarn build:firefox

# Create distributable zip (Chrome/Chromium)
yarn zip

# Create distributable zip (Firefox)
yarn zip:firefox

# Type checking only
yarn compile
```

## Required Dependencies

The project requires the **Gemini Live API SDK**:
```bash
yarn add @google/genai
```

## Architecture

### Real-time Subtitle System Flow
```
Video Element → Audio Capture → WebSocket → Gemini Live API
     ↓              ↓               ↓              ↓
HTMLMediaElement → MediaRecorder → @google/genai → Speech Recognition
     ↑              ↑               ↑              ↑
Subtitle Overlay ← Content Script ← Direct Connection ← Streaming Response
```

### WXT Framework Structure
- **WXT** handles manifest generation, build process, and browser compatibility
- Configuration in `wxt.config.ts` with React module enabled
- TypeScript configuration extends from `./.wxt/tsconfig.json`

### Entry Points & Responsibilities
- `entrypoints/background.ts` - Ephemeral token management, API configuration
- `entrypoints/content.ts` - Video detection, audio capture, subtitle rendering, direct Gemini API connection
- `entrypoints/popup/` - User controls, settings, enable/disable functionality

### Content Script Implementation
- **Video Detection**: Automatically finds `<video>` elements on supported sites
- **Audio Capture**: Uses `HTMLMediaElement.captureStream()` to extract audio
- **Real-time Processing**: MediaRecorder chunks audio for WebSocket streaming
- **Direct API Connection**: Connects directly to Gemini Live API via WebSocket
- **Subtitle Rendering**: Overlays real-time transcription on video elements

### Content Script Targeting
Update `matches` array in `entrypoints/content.ts` for video sites:
- YouTube (`*://*.youtube.com/*`)
- Netflix (`*://*.netflix.com/*`) 
- Other video platforms as needed

### Security Architecture
- **API Key Protection**: Never expose API keys in content scripts
- **Ephemeral Tokens**: Background script generates short-lived tokens
- **Token Refresh**: Automatic renewal before expiration
- **CORS Compliance**: Direct WebSocket connections from content script

### Extension Popup
- React 19 app in `entrypoints/popup/`
- Controls: Enable/disable, language selection, styling options
- Settings: API configuration, site permissions
- Status indicators: Active transcription, connection status

### Required Permissions
```json
{
  "permissions": ["activeTab", "storage", "scripting"],
  "host_permissions": ["*://*.youtube.com/*", "*://*.netflix.com/*"]
}
```

## Implementation Guidelines

### Audio Processing Best Practices
- Use **WebM/Opus** encoding for efficient streaming
- Process audio in **small chunks** (100-200ms) for low latency
- Implement **connection pooling** to manage API rate limits
- Handle **CORS restrictions** for cross-origin video content

### Performance Considerations
- **Memory management**: Clean up MediaRecorder and WebSocket connections
- **Session timeout**: Implement automatic disconnect after inactivity
- **Error recovery**: Reconnect on network failures or API errors
- **Cost optimization**: Monitor API usage and implement usage caps

### Security Requirements
- **Never commit API keys** to repository
- Use **ephemeral tokens** for client-side API access
- Implement **user consent** before accessing audio streams
- Provide **privacy controls** for sensitive sites

### Development Phases
1. **Phase 1**: Basic video detection and audio capture
2. **Phase 2**: MediaRecorder setup and audio streaming
3. **Phase 3**: Gemini Live API integration with WebSocket
4. **Phase 4**: Real-time subtitle rendering and UI
5. **Phase 5**: Error handling, optimization, and production features

### Testing Strategy
- **Unit tests**: Audio processing utilities
- **Integration tests**: Gemini API connection and streaming
- **E2E tests**: Full subtitle workflow on major video sites
- **Performance tests**: Memory usage and latency benchmarks

## Important Notes

- **No testing framework** is currently configured - recommend Jest/Vitest
- **No linting/formatting** tools are set up - recommend ESLint/Prettier
- Uses modern React 19 with TypeScript 5.8.3
- Multi-browser support built into WXT framework
- **Gemini Live API** has rate limits (10 concurrent sessions per project)
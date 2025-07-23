# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser extension built with **WXT** (Web Extension Toolkit) and **React 19** for adding video subtitle functionality to web pages. The project uses TypeScript throughout and supports both Chrome/Chromium and Firefox browsers.

## Development Commands

Use **Yarn** as the package manager for this project:

```bash
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

## Architecture

### WXT Framework Structure
- **WXT** handles manifest generation, build process, and browser compatibility
- Configuration in `wxt.config.ts` with React module enabled
- TypeScript configuration extends from `./.wxt/tsconfig.json`

### Entry Points
- `entrypoints/background.ts` - Service worker/background script
- `entrypoints/content.ts` - Content script (currently matches `*://*.google.com/*`)
- `entrypoints/popup/` - Browser extension popup UI (React app)

### Content Script Targeting
The content script currently only runs on Google domains. Update the `matches` array in `entrypoints/content.ts` to target video sites where subtitle functionality should be active.

### Extension Popup
- React 19 app in `entrypoints/popup/`
- Entry point: `main.tsx`
- Main component: `App.tsx`
- Styling: CSS modules approach with `App.css` and `style.css`

### Assets
- Extension icons in `public/icon/` (16, 32, 48, 96, 128px sizes)
- React and WXT logos in `assets/` and `public/`

## Important Notes

- **No testing framework** is currently configured
- **No linting/formatting** tools are set up (ESLint, Prettier)
- Project is based on WXT React starter template
- Uses modern React 19 with TypeScript 5.8.3
- Multi-browser support built into WXT framework
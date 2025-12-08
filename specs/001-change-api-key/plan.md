# Implementation Plan: API Key Management

**Branch**: `001-change-api-key` | **Date**: 2025-12-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-change-api-key/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add API key management UI to the extension popup, allowing users to enter, change, and clear their Gemini API key. Key is stored in browser storage (chrome.storage.local) and used for Gemini API authentication. Implementation follows simplicity principle (YAGNI) - no format validation, only empty check. Authentication errors shown from API response.

## Technical Context

**Language/Version**: TypeScript 5.8.3
**Primary Dependencies**: React 19, WXT 0.20.6, @wxt-dev/module-react, chrome.storage API
**Storage**: Browser local storage (chrome.storage.local / browser.storage.local)
**Testing**: None configured (aspirational: Jest/Vitest per constitution)
**Target Platform**: Chrome/Chromium and Firefox browsers (Manifest V3)
**Project Type**: Browser extension (WXT framework structure)
**Performance Goals**: UI responsiveness <100ms, storage operations <50ms
**Constraints**: Browser storage API limits, popup UI size constraints, security requirements per constitution
**Scale/Scope**: Single-user per browser profile, ~50 LOC for UI component

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Security-First (NON-NEGOTIABLE)

✅ **PASS** - API key stored in background script storage (chrome.storage.local), never exposed in content scripts or console logs per FR-006. Follows existing security architecture.

### II. Real-time Performance

✅ **PASS** - Not applicable (UI feature, no audio processing). Storage operations are fast (<50ms).

### III. Browser Compatibility

✅ **PASS** - Uses WXT framework conventions. chrome.storage API works on both Chrome and Firefox (via browser.storage polyfill provided by WXT).

### IV. Resource Management

✅ **PASS** - No persistent connections or streams. Simple storage operations with no cleanup required.

### V. Privacy & User Consent

✅ **PASS** - API key handling follows constitution: stored securely, never logged, user has full control (enter/clear).

### VI. Standards & Best Practices

✅ **PASS** - React 19 hooks pattern for UI component. Follows Manifest V3 storage guidelines. No AI client changes in this feature.

### VII. Simplicity (YAGNI)

✅ **PASS** - Minimal implementation: input field + save/clear buttons. No validation beyond empty check. No abstraction layers or design patterns. Follows user's simplification request.

## Project Structure

### Documentation (this feature)

```text
specs/001-change-api-key/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (React 19 hooks patterns, chrome.storage best practices)
├── data-model.md        # Phase 1 output (API key entity)
├── quickstart.md        # Phase 1 output (developer guide)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
entrypoints/
├── popup/
│   ├── App.tsx          # Modify: Add API key settings UI
│   └── components/      # New: ApiKeySettings component (if needed for organization)
└── background.ts        # Existing: Uses chrome.storage.local for API key

utils/                   # Potential: Storage helper if needed (follow YAGNI)
```

**Structure Decision**: Browser extension using WXT framework structure. Primary changes in `entrypoints/popup/` directory for UI components. No new directories needed - follow simplicity principle and add components inline to App.tsx unless complexity requires extraction.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - all constitution gates pass.

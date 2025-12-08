---

description: "Task list for API Key Management feature implementation"
---

# Tasks: API Key Management

**Input**: Design documents from `/specs/001-change-api-key/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: No testing framework configured - tests are NOT included per constitution (aspirational: Jest/Vitest when added)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Browser extension**: `entrypoints/` at repository root
- Paths shown below use WXT framework structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and verification

- [ ] T001 Verify branch `001-change-api-key` is checked out and clean
- [ ] T002 Verify dependencies installed via `yarn install`
- [ ] T003 Verify development environment runs via `yarn dev`

---

## Phase 2: User Story 1 - Enter/Change API Key (Priority: P1) MVP

**Goal**: Users can enter and save their Gemini API key through the popup, and the extension uses it for authentication

**Independent Test**: Open popup → enter API key → save → close popup → reopen → key persists. Start subtitle generation → extension uses saved key.

### Implementation for User Story 1

- [ ] T004 [US1] Read existing popup structure in entrypoints/popup/App.tsx to understand current layout
- [ ] T005 [US1] Add React state management hooks (useState for apiKey, savedKey, error, loading) in entrypoints/popup/App.tsx
- [ ] T006 [US1] Add useEffect hook to load API key from chrome.storage.local on component mount in entrypoints/popup/App.tsx
- [ ] T007 [US1] Implement handleSave function with empty validation and chrome.storage.local.set in entrypoints/popup/App.tsx
- [ ] T008 [US1] Add API key input field (type password) with onChange handler in entrypoints/popup/App.tsx
- [ ] T009 [US1] Add Save button with disabled state (when empty or loading) and onClick handler in entrypoints/popup/App.tsx
- [ ] T010 [US1] Add error message display with conditional rendering in entrypoints/popup/App.tsx
- [ ] T011 [P] [US1] Add CSS styling for .api-key-settings, .input-group, .button-group, .error-message in entrypoints/popup/App.css (or inline styles)
- [ ] T012 [US1] Test save flow: enter key → click save → verify chrome.storage.local contains key
- [ ] T013 [US1] Test persistence: save key → close popup → reopen → verify key loads
- [ ] T014 [US1] Test empty validation: verify Save button disabled when input is empty or whitespace
- [ ] T015 [US1] Test browser compatibility: verify in Chrome (`yarn dev`) and Firefox (`yarn dev:firefox`)

**Checkpoint**: At this point, User Story 1 should be fully functional - users can enter and save API keys that persist across popup sessions

---

## Phase 3: User Story 2 - Clear API Key (Priority: P2)

**Goal**: Users can clear their stored API key from the extension

**Independent Test**: With API key saved → click Clear → verify input clears and storage is empty. Close and reopen popup → key is gone.

### Implementation for User Story 2

- [ ] T016 [US2] Implement handleClear function with chrome.storage.local.remove in entrypoints/popup/App.tsx
- [ ] T017 [US2] Add Clear button with disabled state (when no savedKey or loading) and onClick handler in entrypoints/popup/App.tsx
- [ ] T018 [US2] Test clear flow: save key → click clear → verify chrome.storage.local is empty
- [ ] T019 [US2] Test clear button states: verify disabled when no key saved, enabled when key exists
- [ ] T020 [US2] Test persistence after clear: clear key → close popup → reopen → verify key is gone

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - full CRUD for API key management

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect the feature as a whole

- [ ] T021 Security audit: verify no console.log(apiKey) anywhere in entrypoints/popup/App.tsx
- [ ] T022 Security audit: verify error messages never include API key value in entrypoints/popup/App.tsx
- [ ] T023 Accessibility check: verify input has proper label, buttons have clear text
- [ ] T024 Code review: verify follows React 19 hooks patterns (useState, useEffect)
- [ ] T025 Code review: verify follows YAGNI principle (no unnecessary abstractions)
- [ ] T026 Manual end-to-end test: enter real API key → start subtitle generation → verify authentication works
- [ ] T027 Commit changes with message "feat: add API key management UI to popup

"

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **User Story 1 (Phase 2)**: Depends on Setup completion - this is the MVP
- **User Story 2 (Phase 3)**: Depends on User Story 1 completion (shares same state management)
- **Polish (Phase 4)**: Depends on both user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Setup (Phase 1) - No dependencies on other stories
- **User Story 2 (P2)**: Builds on User Story 1 state management - must complete US1 first

### Within Each User Story

- **User Story 1**:
  - T004 (read existing structure) must complete before T005-T010
  - T005-T006 (state setup) before T007-T010 (handlers and UI)
  - T011 (CSS) can run in parallel with T007-T010
  - T012-T015 (testing) must run after implementation (T004-T011)

- **User Story 2**:
  - T016-T017 (implementation) before T018-T020 (testing)

### Parallel Opportunities

- **Within User Story 1**:
  - T011 [P] (CSS styling) can run in parallel with T007-T010 (handler and UI implementation)

- **No parallel opportunities between stories** - US2 depends on US1 state management

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: User Story 1 (Enter/Save API Key)
3. **STOP and VALIDATE**: Test User Story 1 independently
4. Verify end-to-end: enter key → save → reload extension → key persists → subtitle generation uses key
5. **MVP COMPLETE** - basic API key management functional

### Incremental Delivery

1. Complete Setup → Foundation ready
2. Add User Story 1 → Test independently → **MVP deployed**
3. Add User Story 2 → Test independently → Feature complete
4. Polish phase → Production ready

### Sequential Strategy (Recommended for single developer)

1. T001-T003: Setup (5-10 min)
2. T004-T015: User Story 1 implementation and testing (1-1.5 hours)
3. Validate US1 works end-to-end
4. T016-T020: User Story 2 implementation and testing (30-45 min)
5. Validate US2 works end-to-end
6. T021-T027: Polish and commit (15-20 min)

**Total estimated time**: 2-3 hours

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- No testing framework configured - manual testing tasks included
- Commit after completing both user stories and polish phase
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, dependencies that break story independence

---

## File Modification Summary

| File | User Story | Changes | Estimated LOC |
|------|------------|---------|---------------|
| `entrypoints/popup/App.tsx` | US1 | Add state hooks, useEffect, handleSave, input UI, error display | ~80 |
| `entrypoints/popup/App.tsx` | US2 | Add handleClear, clear button | ~20 |
| `entrypoints/popup/App.css` | US1 | Add styling for API key section | ~40 |

**Total**: ~140 LOC added to existing files
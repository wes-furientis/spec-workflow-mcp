# Completed Backlog Items

Items that have been implemented and removed from the active backlog.

## DTG Convention

All completed items track timestamps in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ):

- **Added**: When item was first created
- **Modified**: When item was substantially changed (if applicable)
- **Completed**: When item was finished and moved here

---

### #7 - Claude Code Planning Tool Integration
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T00:00:00Z
- **Description**: Integrate spec-workflow-mcp with Claude Code's planning capabilities (EnterPlanMode/ExitPlanMode)
- **Implementation**: `src/tools/planning-tools.ts` - Levels 1-4 implemented
  - Level 1: Guidance via `suggest-plan-mode`
  - Level 2: Context sharing with steering docs
  - Level 3: Bidirectional protocol
  - Level 4: Plan import/export

### #23 - Fix Approval Revision Comments Not Being Saved
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T14:30:00Z
- **Description**: Fix dashboard not loading existing revision comments when reopening an approval
- **Root Cause**: Comments were correctly saved to JSON but React state was initialized empty and never loaded from approval object
- **Implementation**:
  - Added `useEffect` in `ApprovalsPage.tsx` to load `a.comments` into local state
  - Extended `Approval` type in `api.tsx` with `comments`, `response`, `annotations` fields
  - Added 8 unit tests verifying comment persistence and retrieval

### #25 - Resume Workflow Tool with State Tracking
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T14:36:00Z
- **Description**: Add workflow state tracking and resume-workflow tool
- **Implementation**:
  - New `src/core/workflow-state.ts`: State management with WorkflowState interface
    - Tracks steering docs, spec phases, approvals, current focus
    - Helper functions: isSpecReadyForImplementation, getImplementationBlockers
  - New `src/tools/resume-workflow.ts`: MCP tool for resuming workflows
    - action: "status" - show current state and next actions
    - action: "validate-for-implementation" - blocks if specs not fully approved
  - State updates hooked into approvals tool (status check updates state)
  - 14 unit tests for workflow state management
- **State file**: `.spec-workflow/state.json`
- **Remaining**: Dashboard view showing workflow state (nice-to-have)

### #20 - Reduce Context Usage in MCP Tool Responses
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T14:40:00Z
- **Description**: Audit and slim down tool responses to minimize context consumption
- **Implementation**:
  - `get-steering-template.ts`: Changed `templateContent` to `templateSummary` (line count + first line preview)
  - `steering-planning-respond.ts`: Same change for consistency
  - Both tools: Changed `relevantFromApprovedDocs` (500 char snippets) to `relevantDocsHints` (file path + line number)
  - Limited placeholders to 5 max
- **Pattern adopted**: Return paths/summaries, agent calls Read if needed
- **Already efficient**: steering-guide, get-planning-context (return status, not content)

### #8 - Configuration Consistency Tests
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T14:44:00Z
- **Description**: Add unit tests to validate MCP server configurations and prevent configuration drift
- **Implementation**:
  - New `src/__tests__/config-consistency.test.ts`: 8 tests
    - Validates no @pimzino/spec-workflow-mcp references in configs
    - Ensures production configs use local dist/index.js path
    - Verifies consistent server names across configs
    - Checks plugin.json versions match package.json
    - Validates documentation doesn't have stale usage instructions
    - Confirms absolute paths in production configs
  - Tests immediately caught version drift: plugin.json (2.1.7) vs package.json (1.0.0)
  - Fixed by running `npm run sync:plugin-version`
- **Pattern**: Config validation tests prevent drift before it causes issues

### #9 - Steering Document Planning Check Tests
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T14:47:00Z
- **Description**: Add tests to ensure steering-guide properly instructs agents to call suggest-plan-mode before creating documents with requiresPlanning: true
- **Implementation**:
  - New `src/tools/__tests__/steering-planning-check.test.ts`: 19 tests
    - Tests steering-guide includes suggest-plan-mode instruction for docs with requiresPlanning
    - Tests suggest-plan-mode returns "required" for architecture.md, conventions.md, documentation.md (greenfield)
    - Tests suggest-plan-mode returns "required" for legacy.md, migration.md (brownfield)
    - Tests suggest-plan-mode returns "required" for ux.md, api.md (web-app)
    - Tests suggest-plan-mode returns "required" for thesis.md (research-paper)
    - Tests suggest-plan-mode returns "required" for compatibility.md (code-library)
    - Tests planning marker file creation
    - Tests nextSteps includes EnterPlanMode and get-steering-template
    - Tests missing archetype handling (warns, still recommends planning)
- **Pattern**: Archetype-specific planning requirements are properly enforced

### #18 - Speed Up Section-by-Section Planning
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T14:40:00Z (covered by #20)
- **Description**: Reduce response payload in steering template planning flow
- **Implementation**: Covered by #20 (Reduce Context Usage)
  - `templateContent` → `templateSummary`
  - `relevantFromApprovedDocs` → `relevantDocsHints`
  - Limited placeholders to 5 max

### #22 - Fix Tasks.md Preview Only Showing Phase 1
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T15:10:00Z
- **Description**: Dashboard markdown preview truncating tasks.md content
- **Root Cause**: MDXEditorWrapper defaulted to `height: 'full'` (100%), but parent container had no defined height, causing content to be constrained
- **Implementation**:
  - Changed `SpecViewerPage.tsx` to pass `height="auto"` to MDXEditorWrapper
  - Also fixed `ChangelogModal.tsx` for consistency
  - Now content expands naturally based on document length

### #26 - Normalize Approval Titles
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T15:10:00Z
- **Description**: Default approval titles to filename when agent provides creative titles
- **Implementation**:
  - Modified `createApproval()` in `approval-storage.ts`
  - Extracts filename from filePath using `basename()`
  - Uses filename as title unless provided title already matches
  - Agents can still provide matching titles (e.g., "requirements" for requirements.md)

### #17 - Comprehensive Template Overlap Refactor
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T15:30:00Z
- **Description**: Refactor all steering templates to eliminate duplicate sections and establish clear ownership
- **Implementation**:
  - Added ownership declarations to all templates (architecture.md, conventions.md, documentation.md, structure-template.md, tech-template.md, design-template.md, product-template.md, requirements-template.md)
  - Added cross-references ("See X.md") where topics are covered elsewhere
  - Each template now declares what it owns and links to related documents
  - Pattern: `> **This document owns**: [topics] > **Related**: [links]`

### #21 - Validate Documentation Template Against Real Sphinx Project
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T15:30:00Z
- **Description**: Scrub documentation.md template against real Sphinx project (seeker_algo)
- **Implementation**:
  - Compared against ~/furientis/dev/algorithms/seeker_algo Sphinx setup
  - Added "Markup Language" table (Markdown, MyST, RST, Docstrings)
  - Added footnotes pattern documentation
  - Added custom MathJax macros example for Sphinx projects
  - Added "(for technical/scientific projects)" qualifier to derivation structure

### #19 - Generalize Validation Cases Section in Documentation Template
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T15:30:00Z
- **Description**: Rewrite validation cases section to be more general-purpose
- **Implementation**:
  - Replaced physics-focused validation with general "Types of Validation" table
  - Added 6 validation types: Analytical, Reference, Cross-implementation, Golden file, Integration, Behavioral
  - Updated validation case structure with "What This Validates" and "Evidence Source" sections
  - Added "Acceptance Validation" to categories
  - Focus changed from physics proofs to "does the software do what it says?" with evidence

### #10 - Archetype Lifecycle: Greenfield → Brownfield Transition
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T15:40:00Z
- **Description**: Add version-based archetype transition with manual control
- **Implementation**:
  - New `src/tools/archetype-transition.ts` with `archetype-transition` MCP tool
  - `action: 'check'` - Detects package.json version, suggests transition at v1.0.0+
  - `action: 'transition'` - Performs transition, records in workflow state
  - Stores transition history in `.spec-workflow/state.json`
  - Validates target archetype exists before transitioning

### #11 - Steering Doc Re-Review Workflow on Transition
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T15:40:00Z
- **Description**: Trigger re-review workflow for steering docs when transitioning archetypes
- **Implementation**:
  - Integrated into `archetype-transition.ts` transition action
  - Finds all steering docs in `.spec-workflow/steering/`
  - Marks approved docs for re-review in workflow state (`steeringReReview`)
  - Returns list of marked docs in response with guidance for adding transition annotations
  - Suggests "[!NOTE] Established pattern from greenfield phase" callouts

### #12 - Branch-Aware Guidance
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T15:40:00Z
- **Description**: Detect git branch pattern and adjust guidance accordingly
- **Implementation**:
  - Added `detectBranchGuidance()` to `planning-tools.ts`
  - Branch patterns: main/master/release (brownfield), feature/develop (greenfield-ish), hotfix (minimal)
  - Integrated into `suggest-plan-mode` handler
  - Adjusts complexity score and adds branch-specific guidance notes
  - Returns branch info in response: `{ name, guidanceType, note }`

### #14 - Markdown Callout Blocks (Annotations Phase 1)
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T15:50:00Z
- **Description**: Support GitHub-style alert blocks ([!NOTE], [!WARNING], etc.) with colored rendering
- **Implementation**:
  - New `src/dashboard_frontend/.../plugins/alertPlugin.ts`
  - `transformAlerts()` function converts `> [!NOTE]` syntax to styled blockquotes
  - Added CSS for 5 alert types: note (blue), tip (green), important (purple), warning (amber), caution (red)
  - Integrated into MDXEditorWrapper's view mode only (preserves source in edit mode)
  - Dark mode support included

### #24 - Prevent Implementation Audit Log from Growing Unbounded
- **Added**: 2025-12-30
- **Completed**: 2025-12-31T15:55:00Z
- **Description**: Add strategies to keep implementation log manageable and prevent context bloat
- **Implementation**:
  - Updated `implementation-log-manager.ts` with log management config
  - Added `LogManagementConfig`: maxRecentEntries (50), archiveAfterDays (30), maxArchiveEntries (200)
  - New methods: `archiveOldLogs()`, `getLogSummary()`, `getRecentLogs()`, `getLogsPaginated()`, `autoManageLogs()`, `generateArchiveSummary()`
  - Archives moved to `.archive` subdirectory
  - `log-implementation` handler now auto-manages after each entry
  - Returns summary counts in response for context efficiency

### #27 - Custom Archetype Creation
- **Added**: 2025-12-31
- **Completed**: 2025-12-31T17:30:00Z
- **Description**: Allow users to create custom archetypes beyond the built-in ones
- **User Requirements**:
  - Storage: Project-level only (`.spec-workflow/archetypes/`)
  - Inheritance: Extend existing archetypes with selective overrides
  - Creation UX: Both dashboard UI form AND direct JSON file editing
- **Implementation**:
  - New types: `CustomArchetypeDefinition`, `CustomSteeringConfig` in `types.ts`
  - New `src/archetypes/archetype-merger.ts`: Inheritance resolution with removal syntax (`-docname`)
  - New `src/archetypes/custom-archetype-loader.ts`: Load/save/delete from `.spec-workflow/archetypes/`
  - Updated `archetype-registry.ts`: Project-aware methods (`getWithProject`, `getAllWithProject`, `isCustomArchetype`)
  - New API endpoints in `multi-server.ts`:
    - `GET/POST/PUT/DELETE /api/projects/:projectId/custom-archetypes[/:name]`
    - `GET /api/projects/:projectId/all-archetypes` (built-in + custom)
    - `POST /api/projects/:projectId/custom-archetypes/validate`
  - New `src/dashboard_frontend/.../ArchetypesPage.tsx`: Full management UI with form and JSON editor modes
  - Updated `SettingsPage.tsx`: Now loads custom archetypes via all-archetypes endpoint
  - Added sidebar navigation for `/archetypes` page
  - New MCP tool: `manage-archetype` in `src/tools/manage-archetype.ts`
    - Actions: list, inspect, create, update, delete, validate
- **Plan document**: `docs/plans/custom-archetype-creation-plan.md`

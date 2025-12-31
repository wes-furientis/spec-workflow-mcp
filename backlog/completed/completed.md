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

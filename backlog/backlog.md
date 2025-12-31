# Backlog

Items to consider for future specs. These are captured here to avoid scope creep in active specs.

## DTG Convention

All backlog items track timestamps in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ):

- **Added**: When item was first created
- **Modified**: When item was substantially changed (optional, add when updating)
- **Completed**: When item was finished (in completed/completed.md only)

Historical items before 2025-12-31 have date-only timestamps.

## Items

### 1. Backlog Feature for Spec Workflow MCP
- **Description**: Add a built-in backlog management feature to spec-workflow-mcp itself, so users can capture future ideas, tech debt, and feature requests without disrupting active specs
- **Rationale**: Currently no way to track ideas that come up during development without either forgetting them or adding scope to in-progress specs
- **Potential scope**: Backlog CRUD, dashboard UI for viewing/prioritizing, ability to convert backlog item to new spec
- **Added**: 2024-12-30

### 2. Beads Integration: Export Tool (Option A)
- **Description**: Add MCP tool to export approved tasks to beads JSONL format for multi-agent execution
- **Rationale**: Spec-workflow excels at planning (requirements → design → tasks), beads excels at execution (parallel agents, dependency tracking, persistent context). Export enables handoff from planning to execution phase.
- **Potential scope**:
  - New `export-to-beads` MCP tool (~200 lines)
  - Field mapping: task hierarchy → parent-child deps, sequential tasks → blocks deps, requirements → labels, prompts → descriptions
  - External ref linking: `spec:{specName}:{taskId}`
- **Effort**: Low (~200 lines, spec-workflow only)
- **Added**: 2025-12-30

### 3. Beads Integration: Bidirectional Sync (Option B)
- **Description**: Add status sync back from beads to update task checkboxes in tasks.md
- **Rationale**: After agents complete work via beads, automatically reflect completion status in spec-workflow without manual updates
- **Potential scope**:
  - `sync-from-beads` tool (~150 lines)
  - Parse `bd export --json` output
  - Update checkbox states: `[ ]` → `[x]` based on beads status
- **Effort**: Medium (~350 lines total, builds on Option A)
- **Depends on**: Item #2 (Export Tool)
- **Added**: 2025-12-30

### 4. Beads Integration: Native Connector (Option C)
- **Description**: Add `bd spec-workflow` command to beads CLI (mirrors Linear/Jira pattern)
- **Rationale**: For heavy usage, native beads support provides tighter integration and simpler UX
- **Potential scope**:
  - `cmd/bd/spec-workflow.go` (~400-500 lines)
  - Client, mapping, sync modules in beads
  - Commands: `bd spec-workflow pull/push/sync`
- **Effort**: Higher (~1050 lines, mostly in beads repo)
- **Depends on**: Items #2 and #3 proving valuable
- **Added**: 2025-12-30

### 5. Project Dropdown: Active Servers Only + Project Browser
- **Description**: Change the main project dropdown to only show projects with active MCP server connections. Add a separate "Project Browser" view to browse/manage all registered projects.
- **Rationale**: Current dropdown shows all registered projects regardless of whether they're actively being worked on. This clutters the dropdown with stale projects (e.g., "tools PIB10304", "spec-workflow-mcp PIB39008"). Users want the dropdown to reflect "what I'm working on right now" while still being able to access historical project data.
- **Potential scope**:
  - Modify project dropdown to filter by active server connections
  - Add "active" indicator to project registry (track which have live WebSocket connections)
  - New "Project Browser" page or modal for viewing all registered projects
  - Ability to remove/archive projects from the registry
  - View specs, implementation logs, settings for inactive projects
- **Effort**: Medium
- **Added**: 2025-12-30

### 6. Multi-Select Question Interface for Agent Clarification
- **Description**: Add an MCP tool similar to Claude Code's `AskUserQuestion` that allows agents to present multiple choice questions to users via the dashboard, with support for multi-select options.
- **Rationale**: During spec development and implementation, agents often need to clarify requirements or gather user preferences. A structured Q&A interface with multiple choice options (including multi-select) provides a better UX than free-form text and ensures clear, actionable responses.
- **Potential scope**:
  - New MCP tool `ask-user-question` with parameters: question, options (2-4), multiSelect flag, header/label
  - Dashboard UI component for displaying questions and collecting responses
  - WebSocket integration for real-time question delivery and response handling
  - Support for "Other" option allowing custom text input
  - Question queue for handling multiple pending questions
- **Effort**: Medium
- **Added**: 2025-12-30

### 13. Git-Based Change Awareness Highlighting
- **Description**: Show subtle visual highlighting in steering docs for sections that changed since last version/merge, with mouse-over details.
- **Rationale**: After merges, users should be passively aware of what changed without being forced to take action. Helps maintain awareness of documentation drift.
- **Potential scope**:
  - Git blame integration to detect what sections changed and when
  - Subtle background tint on changed sections in dashboard preview
  - Mouse-over tooltip: "Modified in feature/X merge, Dec 30"
  - Compare to last git tag for "changed since v1.0.0" view
  - Highlighting fades over time as changes age
- **Effort**: Medium-High
- **Added**: 2025-12-30

### 15. Comment Overlay on Rendered Preview (Annotations Phase 2)
- **Description**: Add annotation layer on rendered markdown preview allowing users to select text and add comments.
- **Rationale**: Reviewing raw markdown is clunky. Users should be able to annotate the rendered view directly, with comments stored as metadata.
- **Potential scope**:
  - Selection-based commenting on rendered markdown
  - Comments stored separately (e.g., requirements.comments.json)
  - Visual markers on rendered view showing where comments exist
  - Comments sync without modifying source markdown
- **Depends on**: Item #14 (Callout Blocks)
- **Effort**: Medium-High
- **Added**: 2025-12-30

### 16. Rich Markdown Editor (Annotations Phase 3)
- **Description**: Replace raw markdown editing with WYSIWYG editor (Milkdown, TipTap, or similar) with inline commenting.
- **Rationale**: Full visual editing experience with markdown output. Inline comments built into editor, not separate overlay.
- **Potential scope**:
  - Evaluate and integrate rich markdown editor library
  - Maintain markdown as source of truth
  - Inline commenting and suggestion mode
  - Track changes visualization
- **Depends on**: Items #14 and #15
- **Effort**: High
- **Added**: 2025-12-30



# Backlog

Items to consider for future specs. These are captured here to avoid scope creep in active specs.

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

### 8. Configuration Consistency Tests
- **Description**: Add unit tests to validate MCP server configurations and prevent configuration drift
- **Rationale**: MCP configurations scattered across .claude.json, .mcp.json files can become inconsistent (different paths, missing flags, pimzino vs local versions). Need automated validation to catch these issues.
- **Potential scope**:
  - Test that all spec-workflow MCP configs point to local build, not NPM
  - Test that --AutoStartDashboard flag is present where expected
  - Test that project paths are consistent
  - Validate .claude-plugin/*.mcp.json files on build
  - CI check to prevent committing configs that reference @pimzino/spec-workflow-mcp
- **Priority**: High (this has caused repeated issues)
- **Effort**: Low-Medium
- **Added**: 2025-12-30

### 9. Steering Document Planning Check Tests
- **Description**: Add tests to ensure steering-guide properly instructs agents to call suggest-plan-mode before creating documents with requiresPlanning: true
- **Rationale**: Agents were skipping the planning check when creating architecture.md despite the archetype requiring it. Need tests to verify the guidance is correct and complete.
- **Potential scope**:
  - Test that steering-guide output includes planning check instructions for docs with requiresPlanning: true
  - Test that generateCustomDocPhase() includes PLANNING CHECK REQUIRED block when appropriate
  - Test that suggest-plan-mode correctly detects steering doc creation tasks
  - Integration test: given "Create architecture.md" task, verify recommend is "required"
- **Priority**: High
- **Effort**: Medium
- **Added**: 2025-12-30

### 7. Claude Code Planning Tool Integration
- **Description**: Integrate spec-workflow-mcp with Claude Code's planning capabilities (EnterPlanMode/ExitPlanMode) for a seamless planning-to-implementation workflow.
- **Rationale**: Claude Code has powerful planning tools, and spec-workflow-mcp has structured spec documents. Integrating them would enable plans to inform specs and specs to guide planning, reducing context switching and improving workflow continuity.
- **Potential scope** (4 levels):
  - **Level 1 - Guidance**: Update spec-workflow-guide to suggest when to use Claude Code's plan mode based on archetype
  - **Level 2 - Context Sharing**: Claude Code automatically reads steering docs when entering plan mode for archetype-aware planning
  - **Level 3 - Bidirectional Protocol**: New MCP tool `suggest-plan-mode` that signals when tasks should be planned first; requires changes to both projects
  - **Level 4 - Plan Import/Export**: Export Claude Code plans to requirements.md format; import spec-workflow tasks into Claude Code task tracking; two-way sync
- **Dependencies**: Levels 3-4 would require coordination with Claude Code development
- **Effort**: Level 1 (Low), Level 2 (Medium), Levels 3-4 (High)
- **Added**: 2025-12-30


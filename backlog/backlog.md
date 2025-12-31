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
- **Status**: Levels 1-4 implemented in planning-tools.ts

### 10. Archetype Lifecycle: Greenfield → Brownfield Transition
- **Description**: Add version-based archetype transition with manual control. When version reaches 1.0.0, suggest (don't auto-change) transitioning from greenfield to brownfield archetype.
- **Rationale**: Projects evolve from "building new" (greenfield) to "maintaining existing" (brownfield). The guidance should change accordingly, but the transition should be explicit and user-controlled.
- **Potential scope**:
  - Detect version bump to 1.0.0 and prompt user to transition
  - `transition-archetype` tool or dashboard action
  - Add transition note to steering docs
  - Versioning remains manual (user edits package.json)
- **Effort**: Medium
- **Added**: 2025-12-30

### 11. Steering Doc Re-Review Workflow on Transition
- **Description**: When transitioning from greenfield to brownfield, trigger a review workflow for all existing steering documents.
- **Rationale**: Steering docs created during greenfield should be reviewed and potentially annotated when entering maintenance mode. This ensures the "why we built it this way" context is preserved and marked as established patterns.
- **Potential scope**:
  - Trigger approval workflow for each steering doc on archetype transition
  - Add transition callouts to reviewed docs
  - Mark sections as "established pattern" vs "open for revision"
- **Depends on**: Item #10 (Archetype Lifecycle)
- **Effort**: Medium
- **Added**: 2025-12-30

### 12. Branch-Aware Guidance
- **Description**: Detect current git branch pattern and adjust archetype guidance accordingly.
- **Rationale**: Feature branches are "greenfield-ish" (building something new) even in a brownfield project. Branch context can inform whether to give "establish patterns" or "follow existing patterns" guidance.
- **Potential scope**:
  - Detect branch pattern: main/release (brownfield), feature/* (greenfield-ish), hotfix/* (minimal)
  - Adjust `suggest-plan-mode` and `spec-workflow-guide` output based on branch
  - Configurable branch-to-guidance mappings
  - No merge-time action gates (merge is just a git operation)
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

### 14. Markdown Callout Blocks (Annotations Phase 1)
- **Description**: Support GitHub-style alert blocks ([!NOTE], [!WARNING], [!IMPORTANT]) with colored rendering in dashboard.
- **Rationale**: First step toward better documentation annotation. Pure markdown, works everywhere, enables color-coded callouts for transition notes, architectural decisions, etc.
- **Potential scope**:
  - Add remark plugin to parse alert syntax
  - Style callout blocks with appropriate colors in dashboard
  - Use for transition notes, "established pattern" markers, review comments
- **Effort**: Low
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

### 17. Comprehensive Template Overlap Refactor
- **Description**: Refactor all steering templates to eliminate duplicate sections and establish clear ownership
- **Rationale**: Multiple templates cover the same topics, forcing users to repeat themselves or create inconsistencies. Each topic should have ONE authoritative location with other templates referencing it.
- **Overlaps identified**:
  | Topic | Currently In | Move To |
  |-------|-------------|---------|
  | Naming conventions (files/code) | structure, conventions | structure only |
  | File/directory organization | structure, conventions | structure only |
  | Error handling patterns | architecture, conventions, design | architecture (patterns), conventions (style only) |
  | Testing conventions | conventions, design, tech | conventions (how to test), tech (tools only) |
  | Security requirements | architecture, tech, requirements | tech only (others reference) |
  | Code quality tools | tech, conventions | tech only (conventions references) |
  | Module boundaries | structure, conventions | structure only |
  | Documentation standards | structure, documentation | documentation only |
  | Git workflow (branching) | tech, conventions | tech (branching), conventions (commits/PRs) |
  | Data models | architecture, design, tech | architecture only |
  | Performance/scalability | tech, architecture, requirements | tech (requirements), architecture (design) |
  | Code modularity principles | requirements, structure, design | structure only (others reference) |
- **Potential scope**:
  - Remove duplicate sections from each template
  - Add "See X.md" references where topics moved
  - Update section-by-section planning to detect when a section should reference another doc
  - Clear ownership: each topic has ONE template that owns it
- **Effort**: Medium
- **Added**: 2025-12-30

### 18. Speed Up Section-by-Section Planning
- **Description**: Reduce response payload and skip unnecessary processing in steering template planning flow
- **Rationale**: Agent takes a long time to think between each section question. Large response payloads and context lookups add latency and cognitive load.
- **Quick wins**:
  - Don't return full `templateContent` - just section name and one-line summary
  - Skip `relevantFromApprovedDocs` context lookups - user knows their own docs
  - Minimize response data - less data = less agent thinking time
- **Files**: `src/tools/get-steering-template.ts`, `src/tools/steering-planning-respond.ts`
- **Effort**: Low
- **Added**: 2025-12-30

### 19. Generalize Validation Cases Section in Documentation Template
- **Description**: Rewrite the "Validation Cases" section in documentation.md template to be more general-purpose
- **Rationale**: Current section is too focused on physics/math proofs. Validation should cover any way to demonstrate software works as intended.
- **New framing**:
  - E2E cases that confirm the software works as claimed
  - Links/references to authoritative sources where applicable
  - Could be physics proofs, math derivations, OR just showing certain data types are handled correctly
  - Focus: "does the software do what it says it does?" with evidence
- **Examples to include**:
  - Mathematical/physics validation (current focus)
  - Data handling validation (input X produces expected output Y)
  - Compliance validation (meets spec/standard X)
  - Integration validation (works correctly with external system Y)
- **File**: `src/markdown/templates/documentation.md`
- **Effort**: Low
- **Added**: 2025-12-30

### 20. Reduce Context Usage in MCP Tool Responses
- **Description**: Audit and slim down all tool responses to minimize context consumption
- **Rationale**: MCP tool responses add to conversation context. Verbose responses eat up the context window, leaving less room for actual work. Agent can always call Read tool if it needs full content.
- **Strategies**:
  1. **Return paths, not content** - Give file path + line count, let agent Read if needed
  2. **Minimal status responses** - Just status + next action, not full descriptions
  3. **Don't repeat instructions** - First call gets guidance, subsequent calls just data
  4. **Summarize, don't dump** - "10 sections: Overview, Naming, ..." not full template
  5. **Lazy loading** - Only include content when explicitly requested
  6. **Line number hints** - "See product.md:45-60 for target users" instead of including text
- **Tools to audit**:
  - `steering-guide` - Currently returns descriptions for all docs
  - `get-steering-template` - Returns full template content + context snippets
  - `steering-planning-respond` - Returns next section content
  - `spec-workflow-guide` - Returns verbose guidance text
  - `spec-status` - May include too much detail
  - `get-planning-context` - Loads and returns context docs inline
- **Pattern to adopt**:
  ```
  Bad:  { content: "# Full document here\n..." }
  Good: { path: ".spec-workflow/steering/product.md", lines: 150, summary: "Product vision doc" }
  ```
  Agent calls: Read(.spec-workflow/steering/product.md) only if needed
- **Effort**: Medium
- **Priority**: High (impacts every tool call)
- **Added**: 2025-12-30

### 21. Validate Documentation Template Against Real Sphinx Project
- **Description**: Scrub the documentation.md template against the Sphinx documentation in ~/furientis/dev/algorithms/seeker_algo
- **Rationale**: The documentation template should reflect real-world documentation practices. Comparing against an actual Sphinx project will identify gaps, unrealistic sections, and missing patterns.
- **Scope**:
  - Review seeker_algo's Sphinx setup (conf.py, structure, build process)
  - Compare template sections against what's actually used
  - Remove template sections that don't match real practice
  - Add missing patterns discovered in real project
  - Ensure template guidance aligns with Sphinx conventions
- **File**: `src/markdown/templates/documentation.md`
- **Reference**: `~/furientis/dev/algorithms/seeker_algo`
- **Effort**: Low-Medium
- **Added**: 2025-12-30

### 22. Fix Tasks.md Preview Only Showing Phase 1
- **Description**: The rendered markdown preview for tasks.md only displays Phase 1 tasks, not the full document
- **Rationale**: Users need to see all task phases when reviewing tasks.md in the dashboard preview
- **Symptoms**:
  - Open tasks.md in dashboard preview
  - Only Phase 1 tasks visible
  - Other phases (2, 3, etc.) not rendered
- **Possible causes**:
  - Markdown parser truncating at certain point
  - Rendering height/overflow issue
  - Content being cut off by container
  - Parser issue with specific markdown syntax
- **Files to investigate**:
  - Dashboard markdown preview component
  - MDX editor wrapper
  - Spec viewer page
- **Effort**: Low-Medium
- **Priority**: Medium (affects usability)
- **Added**: 2025-12-30

### 23. Fix Approval Revision Comments Not Being Saved
- **Description**: When requesting revisions on an approval, the revision comment is not saved to the log
- **Rationale**: Revision feedback is critical context for the agent to address issues. If comments aren't persisted, agent doesn't know what to fix.
- **Symptoms observed**:
  - Agent submitted Tasks as "Updated Tasks" (generic title)
  - User requested revisions with comments
  - Comments not visible in approval log/history
- **Issues to investigate**:
  1. Are revision comments being passed to `updateApproval()`?
  2. Are comments stored in the approval JSON?
  3. Is the dashboard UI displaying stored comments?
  4. Is the agent reading revision feedback when resuming?
- **Related**: Approval titles should be more specific than "Updated Tasks"
- **Files to investigate**:
  - `src/dashboard/approval-storage.ts` - updateApproval(), revisionHistory
  - `src/tools/approvals.ts` - how revisions are handled
  - Dashboard approval UI components
- **Effort**: Medium
- **Priority**: High (breaks revision workflow)
- **Added**: 2025-12-30

### 24. Prevent Implementation Audit Log from Growing Unbounded
- **Description**: Add strategies to keep the implementation audit log manageable and prevent context bloat
- **Rationale**: Logs accumulate over project lifetime. If agent reads logs for context, huge logs = wasted context window.
- **Strategies**:
  1. **Log rotation** - Archive logs older than N days, keep recent entries
  2. **Summarization** - Periodically summarize old entries into a condensed "history" section
  3. **Truncation** - Keep only last N entries per spec
  4. **Tiered detail** - Recent logs = full detail, older logs = one-line summary
  5. **Session boundaries** - Log per session, summarize when session ends
  6. **Don't return full logs** - Return summary + line count, agent Reads if needed
  7. **Separate files** - `implementation-log.md` (recent) + `implementation-archive.md` (old)
- **Questions to answer**:
  - How long should detailed logs be kept?
  - What gets summarized vs discarded?
  - Should summarization be automatic or manual?
- **Files**: `src/tools/log-implementation.ts`
- **Effort**: Medium
- **Added**: 2025-12-30

### 25. Resume Workflow Tool with State Tracking
- **Description**: Add `resume-workflow` tool and explicit state file (`.spec-workflow/state.json`) to enable picking up interrupted work and enforce spec completion before implementation.
- **Rationale**: When starting a new conversation, Claude doesn't know what phase you're in, what was approved, or what to do next. This causes wasted effort redoing work or skipping steps. Also need to prevent implementation on unapproved specs.
- **Potential scope**:
  - New `.spec-workflow/state.json` file tracking:
    - Current phase (steering, requirements, design, tasks, implementation)
    - Current spec being worked on
    - Pending approvals
    - Completed phases with timestamps
    - Implementation progress (tasks completed/in-progress)
    - Last action taken
  - New `resume-workflow` MCP tool that:
    - Reads state.json and validates against actual files
    - Returns clear "you are here, do this next" guidance
    - Blocks implementation if spec not fully approved
    - Detects inconsistencies between state and files
  - Update other tools to write state.json on significant actions
  - Dashboard view showing workflow state
- **Enforcement**: Tool returns error if trying to implement without approved spec:
  ```
  ⚠️ CANNOT PROCEED
  Spec "X" is not ready for implementation:
  - Design: ❌ PENDING APPROVAL
  REQUIRED ACTION: Complete Phase 2 and get approval.
  ```
- **Priority**: High (this is causing real workflow problems)
- **Effort**: Medium-High
- **Added**: 2025-12-30

### 26. Normalize Approval Titles
- **Description**: Default approval titles to filename when agent provides arbitrary/creative titles
- **Rationale**: Agents create approvals with creative titles like "Revised tasks.md - documentation.md alignment" instead of predictable names. This is a UX annoyance (hard to scan approval list) but not breaking - matching uses `filePath`, not `title`.
- **Fix**: In `approval-storage.ts createApproval()`, normalize title:
  ```typescript
  const normalizedTitle = title || basename(filePath).replace('.md', '');
  ```
- **Alternative**: Could also validate title matches filename pattern and warn/override if not
- **Files**: `src/dashboard/approval-storage.ts`
- **Effort**: Low (single line change + optional validation)
- **Priority**: Low (cosmetic)
- **Added**: 2025-12-30


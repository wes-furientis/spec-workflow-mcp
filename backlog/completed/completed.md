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

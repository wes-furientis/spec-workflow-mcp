# Future Architecture: Decomposed MCP + Skills

## The Problem with Monolithic MCP Servers

The current `spec-workflow-mcp` is a single server with ~20 tools, complex internal state, and workflow logic encoded in TypeScript. This creates several issues:

1. **Agents ignore code paths** - We can return `nextSteps: ["do X before Y"]` but agents skip steps anyway. The workflow logic is suggestions, not gates.

2. **Gating requires errors** - The only reliable way to stop an agent is to return an error. This is ugly and unintuitive.

3. **Complex tools = complex reasoning** - When a tool has many modes and conditional behaviors, agents make mistakes about which mode to use.

4. **Testing is hard** - Integration tests need to simulate full agent conversations to verify workflow enforcement.

5. **Context bloat** - Tool responses include workflow guidance, templates, context docs, and status all at once.

## The Core Insight

**Agents are good at following instructions (prompts/skills). They're bad at following implicit code paths.**

If workflow logic lives in readable skills that the agent processes as instructions, it will follow them. If workflow logic lives in TypeScript that returns suggestions, it will ignore them.

## Proposed Architecture

### Layer 1: Micro-MCP Servers

Each MCP server does ONE thing with minimal logic:

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  approval-mcp   │  │  template-mcp   │  │  archetype-mcp  │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ • create        │  │ • get-template  │  │ • list          │
│ • update        │  │ • parse-sections│  │ • get           │
│ • get-status    │  │ • generate-draft│  │ • validate      │
│ • list          │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘

┌─────────────────┐  ┌─────────────────┐
│ project-state   │  │  spec-files-mcp │
├─────────────────┤  ├─────────────────┤
│ • get-state     │  │ • read-spec     │
│ • set-phase     │  │ • write-spec    │
│ • get-position  │  │ • list-specs    │
│ • log-action    │  │ • validate      │
└─────────────────┘  └─────────────────┘
```

### Layer 2: Skills as Orchestration

Skills are prompt templates that encode workflow. The agent reads and follows them:

```
/steering skill:
1. Call archetype-mcp:get to load project archetype
2. Call project-state:get-position to see what's next
3. IF not all steering docs approved:
   a. Call template-mcp:get-template for next doc
   b. Walk through sections with user (use AskUserQuestion)
   c. Call template-mcp:generate-draft
   d. Call approval-mcp:create
   e. STOP - wait for approval
4. IF all approved:
   → Tell user steering is complete, suggest /spec

/spec skill:
1. Call project-state:get-position
2. IF steering not complete:
   → STOP - tell user to complete steering first
3. IF requirements not done:
   a. Call template-mcp:get-template "requirements"
   ...
```

### Layer 3: Dashboard Aggregator

A lightweight dashboard that queries all micro-MCPs:

```
┌──────────────────────────────────────────────────────┐
│                    Dashboard                          │
├──────────────────────────────────────────────────────┤
│  Queries:                                            │
│  • approval-mcp → pending approvals                  │
│  • project-state → current phase, progress           │
│  • archetype-mcp → project configuration             │
│  • spec-files-mcp → spec documents                   │
└──────────────────────────────────────────────────────┘
```

## Why This Works Better

### 1. Deterministic Gatekeeping

With monolithic MCP:
```
Agent: calls big-tool with mode="implement"
Tool: returns { success: true, warning: "specs not approved", nextSteps: [...] }
Agent: ignores warning, proceeds anyway
```

With micro-MCPs + skills:
```
Skill says: "First call approval-mcp:get-status for design.md"
Agent: calls approval-mcp:get-status
Tool: returns { status: "pending" }
Skill says: "IF status != approved, STOP and tell user"
Agent: follows instruction, stops
```

The skill is an explicit instruction the agent processes. The tool just returns facts.

### 2. Single-Responsibility Tools

Each tool does exactly one thing:

| Tool | Input | Output |
|------|-------|--------|
| approval-mcp:create | filePath, title, category | approvalId |
| approval-mcp:get-status | approvalId | status, comments |
| template-mcp:parse-sections | templateName | sections[] |

No modes. No conditionals. No "if archetype is X, do Y". Just data in, data out.

### 3. Readable Workflow Logic

Current approach - workflow in TypeScript:
```typescript
if (context.projectArchetype) {
  const archetype = await archetypeRegistry.get(context.projectArchetype);
  if (archetype?.steering.custom.find(d => d.name === docName)?.requiresPlanning) {
    // ... 50 more lines
  }
}
```

Proposed approach - workflow in skill:
```markdown
## Creating a Steering Document

1. Get the archetype: `archetype-mcp:get`
2. Check if this doc requires planning: look at `archetype.steering.custom[].requiresPlanning`
3. If requiresPlanning is true:
   - First use EnterPlanMode
   - Then continue with template
4. Get the template: `template-mcp:get-template docName`
5. ...
```

The skill is auditable, editable, and the agent reads it as instructions.

### 4. Composable and Optional

Want approvals but not templates? Just use approval-mcp.
Want to add a new workflow phase? Write a new skill, maybe add a micro-MCP.
Want different workflow for different projects? Different skills, same MCPs.

### 5. Reduced Context Usage

Each micro-MCP returns minimal data:
- approval-mcp:get-status → `{ status: "approved", approvedAt: "..." }`
- Not: `{ status: "approved", fullDocument: "...", history: [...], nextSteps: [...] }`

Skills tell the agent what to do next. Tools just return facts.

## Implementation Plan

### Phase 1: Extract approval-mcp

The approval system is already fairly self-contained:
- `src/dashboard/approval-storage.ts` → core of new MCP
- Tools: create, update, get-status, list
- ~300 lines of focused code

This can be extracted and tested independently.

### Phase 2: Extract template-mcp

Template parsing and draft generation:
- `src/tools/get-steering-template.ts` (parsing logic)
- `src/tools/steering-planning-respond.ts` (draft generation)
- Tools: get-template, parse-sections, generate-draft

### Phase 3: Create orchestration skills

Write skills that chain the micro-MCPs:
- `/steering` - steering document workflow
- `/spec` - requirements → design → tasks workflow
- `/implement` - implementation with logging

### Phase 4: Build aggregator dashboard

Lightweight dashboard that queries all micro-MCPs for unified view.

### Phase 5: Deprecate monolithic server

Once skills + micro-MCPs are working, phase out the monolithic server.

## File Structure

```
tools/
├── approval-mcp/
│   ├── src/
│   │   ├── index.ts
│   │   ├── storage.ts
│   │   └── tools/
│   │       ├── create.ts
│   │       ├── update.ts
│   │       ├── get-status.ts
│   │       └── list.ts
│   └── package.json
│
├── template-mcp/
│   ├── src/
│   │   ├── index.ts
│   │   ├── parser.ts
│   │   └── tools/
│   │       ├── get-template.ts
│   │       ├── parse-sections.ts
│   │       └── generate-draft.ts
│   └── package.json
│
├── archetype-mcp/
│   └── ...
│
├── project-state-mcp/
│   └── ...
│
├── spec-workflow-dashboard/
│   ├── src/
│   │   ├── aggregator.ts  # Queries all micro-MCPs
│   │   └── ui/
│   └── package.json
│
└── skills/
    ├── steering.md
    ├── spec.md
    ├── implement.md
    └── review.md
```

## Considerations

### Configuration Complexity

Users need to configure multiple MCP servers. Mitigations:
- Provide a meta-package that installs all of them
- Single config file that enables/disables components
- CLI tool: `spec-workflow init` sets up all MCPs

### State Coordination

Micro-MCPs need to agree on project paths and state location. Solutions:
- Shared config file (`.spec-workflow/config.json`)
- Each MCP reads same config on startup
- project-state-mcp is source of truth for workflow position

### Skill Maintenance

Skills are now critical workflow logic. Need:
- Version control for skills
- Testing that skills produce expected tool call sequences
- Clear documentation for skill authors

## Summary

| Aspect | Monolithic MCP | Micro-MCPs + Skills |
|--------|---------------|---------------------|
| Workflow logic | TypeScript (ignored) | Skills (followed) |
| Tool complexity | High (many modes) | Low (single purpose) |
| Gatekeeping | Suggestions via nextSteps | Explicit in skill instructions |
| Testing | Integration tests | Unit tests per MCP |
| Context usage | High (bundled responses) | Low (minimal returns) |
| Flexibility | Modify TypeScript | Modify skills |

The key shift: **Move workflow logic from code the agent calls to instructions the agent reads.**

# Planning Integration Guide

This guide explains how to use spec-workflow-mcp's planning tools with Claude Code's planning mode (`EnterPlanMode`/`ExitPlanMode`).

## Overview

The planning integration provides four MCP tools:

| Tool | Purpose |
|------|---------|
| `suggest-plan-mode` | Analyze a task and recommend whether to use planning mode |
| `get-planning-context` | Get list of steering docs to read before planning |
| `export-plan` | Export spec tasks to a planning document format |
| `import-plan` | Convert a planning document into spec requirements/tasks |

## Tool 1: suggest-plan-mode

**When to use:** Before starting any significant task, to decide if you should enter planning mode first.

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `taskDescription` | Yes | Description of what you're about to do |
| `specName` | No | Name of related spec for additional context |
| `estimatedFiles` | No | Estimated number of files to be modified |

### Example Usage

**Simple task check:**
```
Call the suggest-plan-mode tool with:
  taskDescription: "Add a logout button to the header"
```

**Task with spec context:**
```
Call the suggest-plan-mode tool with:
  taskDescription: "Implement the optical ray tracing algorithm"
  specName: "optical-analysis"
  estimatedFiles: 5
```

**Creating a steering document:**
```
Call the suggest-plan-mode tool with:
  taskDescription: "Create architecture.md steering document"
```

### Example Response

```json
{
  "success": true,
  "message": "Planning mode recommended for this task",
  "data": {
    "recommendation": "recommended",
    "confidence": "medium",
    "complexityScore": 4,
    "complexityFactors": [
      "New feature implementation",
      "Moderate file count (5 files)"
    ],
    "archetypeRecommendation": "recommended",
    "archetype": "greenfield",
    "contextFilesToRead": [
      ".spec-workflow/steering/product.md",
      ".spec-workflow/steering/tech.md"
    ],
    "reasoning": "Complexity factors detected: New feature implementation, Moderate file count (5 files). Project archetype \"Greenfield Project\" strongly benefits from upfront planning."
  },
  "nextSteps": [
    "Consider using EnterPlanMode before implementation",
    "Read steering docs for project context",
    "Design implementation approach",
    "Get user approval on approach",
    "Exit planning mode and implement"
  ]
}
```

### Recommendation Values

| Value | Meaning | Action |
|-------|---------|--------|
| `required` | Planning is mandatory (e.g., steering doc with `requiresPlanning: true`) | Must use EnterPlanMode |
| `strongly-recommended` | High complexity task | Should use EnterPlanMode |
| `recommended` | Moderate complexity | Consider using EnterPlanMode |
| `optional` | Low complexity | Planning mode helpful but not necessary |
| `not-needed` | Simple task | Proceed directly with implementation |

---

## Tool 2: get-planning-context

**When to use:** After deciding to enter planning mode, to know which steering docs to read first.

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `specName` | No | Include spec-specific context (requirements, design, tasks) |

### Example Usage

**Get general planning context:**
```
Call the get-planning-context tool
```

**Get context for a specific spec:**
```
Call the get-planning-context tool with:
  specName: "optical-analysis"
```

### Example Response

```json
{
  "success": true,
  "message": "Planning context loaded for Greenfield Project",
  "data": {
    "archetype": {
      "name": "greenfield",
      "displayName": "Greenfield Project",
      "documentationStyle": "rich-inline-external"
    },
    "contextFiles": [
      {
        "path": ".spec-workflow/steering/product.md",
        "purpose": "Product vision, goals, success criteria, and user needs",
        "priority": "required",
        "exists": true
      },
      {
        "path": ".spec-workflow/steering/tech.md",
        "purpose": "Technology stack decisions, rationale, and constraints",
        "priority": "required",
        "exists": true
      },
      {
        "path": ".spec-workflow/steering/structure.md",
        "purpose": "Codebase organization, module boundaries, and file conventions",
        "priority": "required",
        "exists": false
      },
      {
        "path": ".spec-workflow/steering/architecture.md",
        "purpose": "Architecture Decision Records (ADRs), system diagrams, component relationships",
        "priority": "recommended",
        "exists": false
      }
    ],
    "planningGuidance": [
      "Focus on establishing solid architectural foundations",
      "Document technology choices before implementing",
      "Consider scalability from the start",
      "Establish coding standards and conventions"
    ],
    "existingFilesCount": 2,
    "totalFilesCount": 4
  },
  "nextSteps": [
    "Read existing context files marked as \"exists: true\"",
    "Consider creating missing required/recommended steering docs",
    "Use context to inform implementation planning",
    "Exit planning mode when approach is decided"
  ]
}
```

---

## Tool 3: export-plan

**When to use:** To export tasks from a spec into a format suitable for Claude Code planning mode.

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `specName` | Yes | Name of the spec to export |
| `includeCompleted` | No | Include completed tasks (default: false) |

### Example Usage

```
Call the export-plan tool with:
  specName: "optical-analysis"
```

**Include completed tasks:**
```
Call the export-plan tool with:
  specName: "optical-analysis"
  includeCompleted: true
```

### Example Response

```json
{
  "success": true,
  "message": "Exported 5 tasks from spec \"optical-analysis\"",
  "data": {
    "specName": "optical-analysis",
    "taskCount": 5,
    "pendingCount": 3,
    "inProgressCount": 1,
    "completedCount": 1,
    "planDocument": "# Implementation Plan: optical-analysis\n\nGenerated for planning mode integration.\nProject archetype: greenfield\n\n## Summary\n\n- Total tasks: 5\n- Pending: 3\n- In Progress: 1\n- Completed: 1\n\n## Tasks\n\n### [ ] task-1: Set up optical simulation framework\nFiles: src/optical/framework.ts, src/optical/types.ts\n\n### [-] task-2: Implement ray tracing algorithm\nFiles: src/optical/raytracer.ts\n\n...",
    "tasks": [
      {
        "id": "task-1",
        "title": "Set up optical simulation framework",
        "status": "pending",
        "files": ["src/optical/framework.ts", "src/optical/types.ts"]
      }
    ]
  },
  "nextSteps": [
    "Use planDocument content as context for EnterPlanMode",
    "Review tasks and their dependencies",
    "Plan implementation order",
    "Consider parallel execution opportunities"
  ]
}
```

---

## Tool 4: import-plan

**When to use:** To convert a planning document (like one created in Claude Code's planning mode) into spec-workflow requirements or tasks.

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `specName` | Yes | Name for the new spec (kebab-case) |
| `planContent` | Yes | The planning document content to import |
| `outputType` | No | What to generate: `requirements`, `tasks`, or `both` (default: `requirements`) |

### Example Usage

```
Call the import-plan tool with:
  specName: "new-feature"
  planContent: "## Goals\n- Implement user dashboard\n- Add real-time updates\n\n## Steps\n1. Create dashboard component\n2. Add WebSocket connection\n3. Implement data visualization\n\n## Considerations\n- Must work offline\n- Performance critical"
  outputType: "both"
```

### Example Response

```json
{
  "success": true,
  "message": "Parsed plan and generated 2 document(s) for spec \"new-feature\"",
  "data": {
    "specName": "new-feature",
    "outputType": "both",
    "parsedPlan": {
      "goalsCount": 2,
      "stepsCount": 3,
      "considerationsCount": 2
    },
    "generatedDocs": [
      { "name": "requirements.md", "path": ".spec-workflow/specs/new-feature/requirements.md" },
      { "name": "tasks.md", "path": ".spec-workflow/specs/new-feature/tasks.md" }
    ],
    "documentContents": {
      "requirements.md": "# Requirements Document\n\n## Introduction\n\n*Generated from planning document*\n\n## Goals\n\n- Implement user dashboard\n- Add real-time updates\n\n## Requirements\n\n### Requirement 1: Create dashboard component\n\n**User Story:** As a user, I want create dashboard component\n\n**Acceptance Criteria:**\n- [ ] Criteria to be defined\n\n...",
      "tasks.md": "# Tasks\n\n## Implementation Tasks\n\n### Task 1: Create dashboard component\n\n- [ ] Create dashboard component\n\n**_Prompt:**\n```\nRole: Developer implementing Create dashboard component\nTask: Create dashboard component\nSuccess: Task completed and tested\n```\n\n..."
    }
  },
  "nextSteps": [
    "Create spec directory: .spec-workflow/specs/new-feature",
    "Write file: .spec-workflow/specs/new-feature/requirements.md",
    "Write file: .spec-workflow/specs/new-feature/tasks.md",
    "Review and refine generated documents",
    "Submit for approval via approvals tool"
  ]
}
```

---

## Complete Workflow Example

Here's a full example of using planning integration for a new feature:

### Step 1: Check if planning is needed

```
User: "I want to add optical ray tracing to the simulation"

AI: Let me check if this task would benefit from planning mode.

[Calls suggest-plan-mode with taskDescription: "Add optical ray tracing to the simulation"]

Result: recommendation: "strongly-recommended", complexityFactors: ["New feature implementation", "Greenfield project - architecture decisions important"]
```

### Step 2: Get planning context

```
AI: Planning is strongly recommended. Let me get the context files to read.

[Calls get-planning-context]

Result: contextFiles with product.md (exists: true), tech.md (exists: true), architecture.md (exists: false)
```

### Step 3: Enter planning mode

```
AI: I'll read the existing steering docs and enter planning mode.

[Reads .spec-workflow/steering/product.md]
[Reads .spec-workflow/steering/tech.md]
[Uses EnterPlanMode]

Now in planning mode. Based on the steering docs:
- Product goal: Scientific accuracy for optical simulations
- Tech stack: Python with NumPy for numerical computation
- No architecture.md yet

I'll design an approach for the ray tracing implementation...
```

### Step 4: Create plan and exit

```
AI: [Creates plan in plan file]

Plan:
1. Create optical module structure
2. Implement basic ray class
3. Add material properties system
4. Implement Snell's law for refraction
5. Add reflection calculations
6. Create visualization output

[Uses ExitPlanMode]
```

### Step 5: Import plan to spec (optional)

```
AI: Would you like me to convert this plan into a formal spec?

User: Yes

[Calls import-plan with the plan content, specName: "optical-raytracing", outputType: "both"]

Result: Generated requirements.md and tasks.md
```

---

## Archetype-Specific Behavior

Different archetypes have different planning recommendations:

| Archetype | Planning Recommendation |
|-----------|------------------------|
| **greenfield** | Strongly recommended - architecture decisions critical |
| **brownfield** | Recommended - need to understand existing patterns |
| **web-app** | Recommended for new features |
| **code-library** | Recommended for public API changes |
| **research-paper** | Optional - for methodology design |
| **generic** | Based on task complexity |

### Steering Docs with `requiresPlanning: true`

Some archetypes have steering documents that require planning mode before creation:

**greenfield:**
- `architecture.md` - requires planning (context: product.md, tech.md)
- `documentation.md` - requires planning (context: product.md, structure.md)

When you try to create these docs, `suggest-plan-mode` will return `recommendation: "required"`.

---

## Tips

1. **Always check suggest-plan-mode first** for non-trivial tasks
2. **Read existing steering docs** before entering planning mode
3. **Use get-planning-context** to know which docs exist and which are missing
4. **Export existing specs** before major refactoring to have context in planning mode
5. **Import plans** to formalize ad-hoc planning into trackable specs

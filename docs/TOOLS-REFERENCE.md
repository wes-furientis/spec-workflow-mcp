# Tools Reference

Complete documentation for all MCP tools and prompts provided by Spec Workflow MCP.

## Important: Tools vs Prompts

Spec Workflow MCP provides two types of MCP resources:

- **Tools**: Called with parameters, return structured data
- **Prompts**: Generate conversation context for Claude to act on

---

## Tools (18 total)

### Workflow Guidance Tools

#### spec-workflow-guide

Returns comprehensive guidance for the spec-driven workflow.

**Parameters**: None required

**Usage**:
```
spec-workflow-guide
```

**Returns**: Markdown guide with workflow steps, archetype info, and phase instructions.

---

#### steering-guide

Returns guidance for creating steering documents.

**Parameters**: None required

**Usage**:
```
steering-guide
```

**Returns**: Guide for steering document creation based on current archetype.

---

#### get-steering-template

Returns a specific steering document template.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| templateName | string | Yes | Template name (e.g., "product", "tech", "goals") |

**Usage**:
```
get-steering-template templateName:"goals"
```

---

#### steering-planning-respond

Responds to steering document planning questions.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| response | string | Yes | User's response to planning question |

---

### Spec Status Tools

#### spec-status

Gets detailed status for a specification.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| specName | string | Yes | Name of the spec |

**Usage**:
```
spec-status specName:"user-auth"
```

**Returns**: Document status, task progress, approval states.

---

### Approval Tools

#### approvals

Single tool for all approval operations. Uses `action` parameter to specify operation.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | Yes | One of: "request", "status", "delete", "list" |
| filePath | string | For request | Path to document being approved |
| approvalId | string | For status/delete | ID of existing approval |
| category | string | For request | Category: "steering" or "spec" |
| categoryName | string | For request | Spec name or "steering" |
| type | string | For request | "document" |
| title | string | For request | Document title |

**Actions**:

**Request approval**:
```
approvals action:"request" filePath:".spec-workflow/specs/my-feature/requirements.md" category:"spec" categoryName:"my-feature" type:"document" title:"requirements"
```

**Check status**:
```
approvals action:"status" approvalId:"approval_123456"
```

**Delete approval** (after approved/rejected):
```
approvals action:"delete" approvalId:"approval_123456"
```

**List all approvals**:
```
approvals action:"list"
```

**CRITICAL**: Verbal approval is NOT accepted. Always check status via this tool.

---

### Implementation Tools

#### log-implementation

Logs implementation details after completing a task.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| specName | string | Yes | Spec name |
| taskId | string | Yes | Task ID (e.g., "1.2.1") |
| summary | string | Yes | What was implemented |
| filesChanged | array | No | List of files modified |
| artifacts | object | No | Additional details |

**Usage**:
```
log-implementation specName:"user-auth" taskId:"1.2" summary:"Created login endpoint" filesChanged:["src/routes/auth.ts"]
```

---

### Planning Tools

#### get-planning-context

Gets context for Claude Code planning mode integration.

**Parameters**: None required

---

#### suggest-plan-mode

Suggests whether to use planning mode for a task.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| taskDescription | string | Yes | Description of the task |

---

#### export-plan

Exports a plan to a file.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| planContent | string | Yes | Plan markdown content |
| filename | string | No | Output filename |

---

#### import-plan

Imports a plan from a file.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filename | string | Yes | Plan file to import |

---

### Workflow State Tools

#### resume-workflow

Resumes workflow from saved state.

**Parameters**: None required

**Returns**: Current workflow state and next steps.

---

### Archetype Tools

#### archetype-transition

Transitions project to a different archetype.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| targetArchetype | string | Yes | Archetype to transition to |
| preserveCustom | boolean | No | Keep custom steering docs |

**Built-in archetypes**: generic, greenfield, brownfield, code-library, research-paper, web-app

---

#### manage-archetype

CRUD operations for custom archetypes.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | Yes | One of: "list", "inspect", "create", "update", "delete", "validate" |
| name | string | For most | Archetype name |
| definition | object | For create/update | Archetype definition |

**Usage**:
```
manage-archetype action:"list"
manage-archetype action:"inspect" name:"my-custom-archetype"
```

---

### Validation Tools

#### validate-phase

Validates a spec phase against quality criteria.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phase | string | Yes | One of: "steering", "requirements", "design", "tasks" |
| specName | string | For spec phases | Spec name |

**Usage**:
```
validate-phase phase:"requirements" specName:"user-auth"
```

**Returns**: Pass/fail for each check with suggestions.

---

### Build Tools (Ralph Integration)

#### build-spec

Orchestrates autonomous spec implementation.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| specName | string | Yes | Spec to build |
| startFromTask | string | No | Task ID to start from |

---

#### implement-task-auto

Implements a single task autonomously.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| specName | string | Yes | Spec name |
| taskId | string | Yes | Task ID |

---

#### verify-implementation

Verifies task implementation meets spec.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| specName | string | Yes | Spec name |
| taskId | string | Yes | Task ID |

---

## Prompts (9 total)

Prompts generate conversation context. Call them like tools but they return guidance for Claude to act on.

### create-spec

Creates a spec document (requirements, design, or tasks).

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| specName | string | Yes | Spec name in kebab-case |
| documentType | string | Yes | One of: "requirements", "design", "tasks" |
| description | string | No | Brief description |

**Usage**:
```
create-spec specName:"user-auth" documentType:"requirements"
create-spec specName:"user-auth" documentType:"design"
create-spec specName:"user-auth" documentType:"tasks"
```

---

### create-steering-doc

Creates a steering document.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| docType | string | Yes | Document type (archetype-specific) |

**Usage**:
```
create-steering-doc docType:"goals"
create-steering-doc docType:"approach"
```

---

### implement-task

Generates implementation guidance for a task.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| specName | string | Yes | Spec name |
| taskId | string | Yes | Task ID |

**Usage**:
```
implement-task specName:"user-auth" taskId:"1.2"
```

---

### spec-status

Returns formatted spec status.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| specName | string | No | Specific spec or all |

---

### inject-spec-workflow-guide

Injects workflow guide into conversation context.

**Parameters**: None

---

### inject-steering-guide

Injects steering guide into conversation context.

**Parameters**: None

---

### refresh-tasks

Refreshes tasks.md to align with updated requirements/design.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| specName | string | Yes | Spec to refresh |

**Usage**:
```
refresh-tasks specName:"user-auth"
```

---

### ralph-validate-phase

Generates Ralph loop prompt for phase validation.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phase | string | Yes | Phase to validate |
| specName | string | Yes | Spec name |

---

### ralph-build-spec

Generates Ralph loop prompt for spec building.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| specName | string | Yes | Spec to build |

---

## Quick Reference

### Common Workflows

**Create and validate requirements**:
```
create-spec specName:"my-feature" documentType:"requirements"
validate-phase phase:"requirements" specName:"my-feature"
approvals action:"request" filePath:".spec-workflow/specs/my-feature/requirements.md" category:"spec" categoryName:"my-feature" type:"document" title:"requirements"
```

**Check approval and cleanup**:
```
approvals action:"status" approvalId:"[id]"
approvals action:"delete" approvalId:"[id]"
```

**Full spec creation sequence**:
1. `create-spec specName:"X" documentType:"requirements"`
2. `validate-phase phase:"requirements" specName:"X"`
3. `approvals action:"request" ...`
4. (approve in dashboard)
5. `approvals action:"delete" ...`
6. `create-spec specName:"X" documentType:"design"`
7. ... repeat for design and tasks

See [COMMAND-SEQUENCE.md](COMMAND-SEQUENCE.md) for complete workflow with Ralph loops.

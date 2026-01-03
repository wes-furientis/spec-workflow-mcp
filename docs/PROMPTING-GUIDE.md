# Prompting Guide

Actual commands and prompts for Spec Workflow MCP. No fiction.

## MCP Prompts vs Tools

**Prompts**: Generate guidance for Claude to act on (create documents)
**Tools**: Return data or perform operations (check status, validate, approve)

---

## Creating Documents

### Create Spec Documents

```
create-spec specName:"user-auth" documentType:"requirements"
create-spec specName:"user-auth" documentType:"design"
create-spec specName:"user-auth" documentType:"tasks"
```

All three parameters shown. `specName` and `documentType` are required.

### Create Steering Documents

```
create-steering-doc docType:"goals"
create-steering-doc docType:"approach"
create-steering-doc docType:"product"
create-steering-doc docType:"tech"
```

The `docType` depends on your archetype.

---

## Validation with Ralph

### Requirements Validation

```
/ralph-wiggum:ralph-loop --max-iterations 10
```

Prompt:
```
Validate the requirements phase for spec "SPEC_NAME". Call validate-phase with phase:"requirements" and specName:"SPEC_NAME". If validation fails, fix the issues and re-validate. When validation passes, output: <promise>REQUIREMENTS_VALIDATED</promise>
```

### Design Validation

```
/ralph-wiggum:ralph-loop --max-iterations 10
```

Prompt:
```
Validate the design phase for spec "SPEC_NAME". Call validate-phase with phase:"design" and specName:"SPEC_NAME". If validation fails, fix the issues and re-validate. When validation passes, output: <promise>DESIGN_VALIDATED</promise>
```

### Tasks Validation

```
/ralph-wiggum:ralph-loop --max-iterations 15
```

Prompt:
```
Validate the tasks phase for spec "SPEC_NAME". Call validate-phase with phase:"tasks" and specName:"SPEC_NAME". If validation fails, fix the issues and re-validate. When validation passes, output: <promise>TASKS_VALIDATED</promise>
```

**CRITICAL**: Always include `--max-iterations`. Without it, Ralph loops forever.

---

## Approval Workflow

### Request Approval

```
approvals action:"request" filePath:".spec-workflow/specs/my-feature/requirements.md" category:"spec" categoryName:"my-feature" type:"document" title:"requirements"
```

### Check Status

```
approvals action:"status" approvalId:"approval_1234567890_abc123"
```

### Delete After Approval

```
approvals action:"delete" approvalId:"approval_1234567890_abc123"
```

### List All Approvals

```
approvals action:"list"
```

**CRITICAL**: Verbal approval is NOT accepted. Always verify with `action:"status"`.

---

## Status Checking

### Check Spec Status

```
spec-status specName:"user-auth"
```

### Validate Without Ralph

```
validate-phase phase:"requirements" specName:"user-auth"
validate-phase phase:"design" specName:"user-auth"
validate-phase phase:"tasks" specName:"user-auth"
```

---

## Implementation

### Get Task Implementation Guidance

```
implement-task specName:"user-auth" taskId:"1.2"
```

### Log Implementation After Completing

```
log-implementation specName:"user-auth" taskId:"1.2" summary:"Created login endpoint with JWT authentication" filesChanged:["src/routes/auth.ts", "src/middleware/jwt.ts"]
```

---

## Task Refresh

When requirements or design change mid-implementation:

```
refresh-tasks specName:"user-auth"
```

This updates tasks.md to align with current requirements and design while preserving completed work.

---

## Archetype Management

### List Available Archetypes

```
manage-archetype action:"list"
```

### Inspect Archetype Details

```
manage-archetype action:"inspect" name:"greenfield"
```

### Transition to Different Archetype

```
archetype-transition targetArchetype:"web-app"
```

---

## Complete Workflow Example

### Phase 1: Steering (No Ralph)

```
"Here's my project: [description]. Create steering documents."
```

Review and approve in dashboard.

### Phase 2: Requirements

```
create-spec specName:"my-feature" documentType:"requirements"
```

```
/ralph-wiggum:ralph-loop --max-iterations 10
```
```
Validate the requirements phase for spec "my-feature". Call validate-phase with phase:"requirements" and specName:"my-feature". If validation fails, fix the issues and re-validate. When validation passes, output: <promise>REQUIREMENTS_VALIDATED</promise>
```

```
approvals action:"request" filePath:".spec-workflow/specs/my-feature/requirements.md" category:"spec" categoryName:"my-feature" type:"document" title:"requirements"
```

(Approve in dashboard)

```
approvals action:"status" approvalId:"[id]"
approvals action:"delete" approvalId:"[id]"
```

### Phase 3: Design

```
create-spec specName:"my-feature" documentType:"design"
```

```
/ralph-wiggum:ralph-loop --max-iterations 10
```
```
Validate the design phase for spec "my-feature". Call validate-phase with phase:"design" and specName:"my-feature". If validation fails, fix the issues and re-validate. When validation passes, output: <promise>DESIGN_VALIDATED</promise>
```

```
approvals action:"request" filePath:".spec-workflow/specs/my-feature/design.md" category:"spec" categoryName:"my-feature" type:"document" title:"design"
```

(Approve in dashboard)

```
approvals action:"status" approvalId:"[id]"
approvals action:"delete" approvalId:"[id]"
```

### Phase 4: Tasks

```
create-spec specName:"my-feature" documentType:"tasks"
```

```
/ralph-wiggum:ralph-loop --max-iterations 15
```
```
Validate the tasks phase for spec "my-feature". Call validate-phase with phase:"tasks" and specName:"my-feature". If validation fails, fix the issues and re-validate. When validation passes, output: <promise>TASKS_VALIDATED</promise>
```

```
approvals action:"request" filePath:".spec-workflow/specs/my-feature/tasks.md" category:"spec" categoryName:"my-feature" type:"document" title:"tasks"
```

(Approve in dashboard)

```
approvals action:"status" approvalId:"[id]"
approvals action:"delete" approvalId:"[id]"
```

---

## What NOT to Do

### Don't use natural language for MCP commands

Wrong:
```
"Create a spec for user authentication"
```

Right:
```
create-spec specName:"user-auth" documentType:"requirements"
```

### Don't skip documentType

Wrong:
```
create-spec specName:"user-auth"
```

Right:
```
create-spec specName:"user-auth" documentType:"requirements"
```

### Don't run Ralph without max-iterations

Wrong:
```
/ralph-wiggum:ralph-loop
```

Right:
```
/ralph-wiggum:ralph-loop --max-iterations 10
```

### Don't trust verbal approval

Wrong:
```
User: "I approved it"
Agent: *proceeds to next phase*
```

Right:
```
approvals action:"status" approvalId:"[id]"
*verify status is "approved"*
*then proceed*
```

---

## Related Documentation

- [COMMAND-SEQUENCE.md](COMMAND-SEQUENCE.md) - Full workflow with all commands
- [TOOLS-REFERENCE.md](TOOLS-REFERENCE.md) - All tools and prompts
- [USER-GUIDE.md](USER-GUIDE.md) - Getting started guide

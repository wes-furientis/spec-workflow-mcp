# Spec Workflow: Complete Command Sequence

A soup-to-nuts guide showing every command needed to take a vague PRD through to an approved task list.

---

## Prerequisites

1. MCP server running: `spec-workflow-mcp --dashboard`
2. Dashboard open in browser
3. Ralph Wiggum plugin installed in Claude Code

---

## Phase 0: Project Initialization

**In Claude Code:**
```
initialize-workflow
```

This creates the `.spec-workflow/` directory structure.

---

## Phase 1: Steering Documents (Manual - No Ralph)

### 1.1 Create Steering Documents

Paste your vague PRD and ask Claude to create steering documents:

```
"Here's my rough idea for a project: [paste PRD]

Create steering documents for this project."
```

Claude will create documents in `.spec-workflow/steering/` based on your archetype.

### 1.2 Review in Dashboard

1. Go to **Approvals** in dashboard
2. Review each steering document
3. Add comments/annotations for changes needed
4. Click **Needs Revision** or **Approve**

### 1.3 Iterate Until Approved

If revisions needed, tell Claude:
```
"Update the [goals/approach/etc] steering document based on the feedback"
```

Repeat until all steering documents are approved.

---

## Phase 2: Requirements (With Ralph Validation)

### 2.1 Create Requirements Document

```
create-spec specName:"my-feature" documentType:"requirements"
```

Claude creates `.spec-workflow/specs/my-feature/requirements.md`

### 2.2 Validate with Ralph

```
/ralph-wiggum:ralph-loop
```

When prompted, enter:
```
Validate the requirements phase for spec "my-feature".
Call validate-phase with phase:"requirements" and specName:"my-feature".
If validation fails, fix the issues in requirements.md and re-validate.
When validation passes, output: <promise>REQUIREMENTS_VALIDATED</promise>
```

Ralph loops until validation passes.

### 2.3 Request Approval

After validation passes:
```
approvals action:"request" filePath:".spec-workflow/specs/my-feature/requirements.md" category:"spec" categoryName:"my-feature" type:"document" title:"requirements"
```

### 2.4 Approve in Dashboard

1. Go to **Approvals** in dashboard
2. Review requirements document
3. Click **Approve** (or **Needs Revision** with feedback)

### 2.5 Check Approval Status

```
approvals action:"status" approvalId:"[id-from-step-2.3]"
```

Wait for `status: "approved"`.

### 2.6 Cleanup Approval

```
approvals action:"delete" approvalId:"[id-from-step-2.3]"
```

---

## Phase 3: Design (With Ralph Validation)

### 3.1 Create Design Document

```
create-spec specName:"my-feature" documentType:"design"
```

Claude creates `.spec-workflow/specs/my-feature/design.md`

### 3.2 Validate with Ralph

```
/ralph-wiggum:ralph-loop
```

When prompted:
```
Validate the design phase for spec "my-feature".
Call validate-phase with phase:"design" and specName:"my-feature".
If validation fails, fix the issues in design.md and re-validate.
When validation passes, output: <promise>DESIGN_VALIDATED</promise>
```

### 3.3 Request Approval

```
approvals action:"request" filePath:".spec-workflow/specs/my-feature/design.md" category:"spec" categoryName:"my-feature" type:"document" title:"design"
```

### 3.4 Approve in Dashboard

Review and approve design document.

### 3.5 Check & Cleanup

```
approvals action:"status" approvalId:"[id]"
approvals action:"delete" approvalId:"[id]"
```

---

## Phase 4: Tasks (With Ralph Validation)

### 4.1 Create Tasks Document

```
create-spec specName:"my-feature" documentType:"tasks"
```

Claude creates `.spec-workflow/specs/my-feature/tasks.md`

### 4.2 Validate with Ralph

```
/ralph-wiggum:ralph-loop
```

When prompted:
```
Validate the tasks phase for spec "my-feature".
Call validate-phase with phase:"tasks" and specName:"my-feature".
If validation fails, fix the issues in tasks.md and re-validate.
When validation passes, output: <promise>TASKS_VALIDATED</promise>
```

### 4.3 Request Approval

```
approvals action:"request" filePath:".spec-workflow/specs/my-feature/tasks.md" category:"spec" categoryName:"my-feature" type:"document" title:"tasks"
```

### 4.4 Approve in Dashboard

Review and approve tasks document.

### 4.5 Check & Cleanup

```
approvals action:"status" approvalId:"[id]"
approvals action:"delete" approvalId:"[id]"
```

---

## Complete Command Summary

| Phase | Command | Purpose |
|-------|---------|---------|
| Init | `initialize-workflow` | Create .spec-workflow structure |
| Steering | (natural language) | Create steering docs manually |
| Steering | Dashboard | Review/approve steering |
| Req | `create-spec specName:"X" documentType:"requirements"` | Create requirements |
| Req | `/ralph-wiggum:ralph-loop` | Validate requirements |
| Req | `approvals action:"request" ...` | Request approval |
| Req | Dashboard | Approve requirements |
| Req | `approvals action:"delete" ...` | Cleanup |
| Design | `create-spec specName:"X" documentType:"design"` | Create design |
| Design | `/ralph-wiggum:ralph-loop` | Validate design |
| Design | `approvals action:"request" ...` | Request approval |
| Design | Dashboard | Approve design |
| Design | `approvals action:"delete" ...` | Cleanup |
| Tasks | `create-spec specName:"X" documentType:"tasks"` | Create tasks |
| Tasks | `/ralph-wiggum:ralph-loop` | Validate tasks |
| Tasks | `approvals action:"request" ...` | Request approval |
| Tasks | Dashboard | Approve tasks |
| Tasks | `approvals action:"delete" ...` | Cleanup |

---

## Quick Reference: Ralph Validation Prompts

**Requirements:**
```
Validate the requirements phase for spec "SPEC_NAME". Call validate-phase with phase:"requirements" and specName:"SPEC_NAME". If validation fails, fix the issues and re-validate. When validation passes, output: <promise>REQUIREMENTS_VALIDATED</promise>
```

**Design:**
```
Validate the design phase for spec "SPEC_NAME". Call validate-phase with phase:"design" and specName:"SPEC_NAME". If validation fails, fix the issues and re-validate. When validation passes, output: <promise>DESIGN_VALIDATED</promise>
```

**Tasks:**
```
Validate the tasks phase for spec "SPEC_NAME". Call validate-phase with phase:"tasks" and specName:"SPEC_NAME". If validation fails, fix the issues and re-validate. When validation passes, output: <promise>TASKS_VALIDATED</promise>
```

---

## Notes

- **Steering documents**: Ralph validation not recommended yet (archetype-specific validation needs work)
- **Approval verification**: Always check `approvals action:"status"` before proceeding - verbal confirmation is not accepted
- **Dashboard must be connected**: If WebSocket disconnects, approvals won't register
- **Spec names**: Use kebab-case (e.g., `user-authentication`, `data-campaign`)

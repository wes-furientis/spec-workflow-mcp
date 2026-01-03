# Workflow Process Guide

The spec-driven development workflow for Spec Workflow MCP.

## Overview

```
Archetype Setup → Steering → Requirements → Design → Tasks → Implementation
```

Each phase builds on the previous. Documents must be validated and approved before proceeding.

## Phase 0: Project Setup

### Initialize Workflow

```
initialize-workflow
```

Creates `.spec-workflow/` directory structure:
```
.spec-workflow/
├── steering/        # Steering documents
├── specs/           # Specification documents
├── templates/       # Document templates
├── approvals/       # Approval records
├── archive/         # Archived documents
└── config.json      # Project configuration
```

### Set Archetype

Open dashboard → Settings → Select archetype.

| Archetype | Required Steering Docs |
|-----------|----------------------|
| generic | (minimal) |
| greenfield | product, tech, structure |
| brownfield | existing-patterns, constraints |
| code-library | api-design, versioning |
| research-paper | methodology, literature-review |
| web-app | user-flows, ui-patterns |

Custom archetypes can define their own steering documents.

## Phase 1: Steering Documents

### Purpose

Steering documents provide project-level guidance that all specifications reference:
- Project goals and constraints
- Technical decisions and patterns
- Structure and conventions

### Creation

Tell Claude about your project and ask for steering documents:

```
"Here's my project: [description]

Create the steering documents."
```

Or use the prompt directly:
```
create-steering-doc docType:"goals"
create-steering-doc docType:"approach"
```

### Review & Approval

1. Review each steering document in dashboard
2. Add comments/feedback
3. Approve or request revisions
4. All steering docs should be approved before creating specs

### No Ralph for Steering

Steering document validation is not yet mature. Create and refine steering documents manually through the approval process.

## Phase 2: Requirements

### Purpose

Define WHAT needs to be built:
- User stories
- Acceptance criteria
- Non-functional requirements
- Constraints and assumptions

### Creation

```
create-spec specName:"my-feature" documentType:"requirements"
```

### Validation with Ralph

```
/ralph-wiggum:ralph-loop --max-iterations 10
```

Prompt:
```
Validate the requirements phase for spec "my-feature". Call validate-phase with phase:"requirements" and specName:"my-feature". If validation fails, fix the issues and re-validate. When validation passes, output: <promise>REQUIREMENTS_VALIDATED</promise>
```

### Validation Checks

- Document exists
- User stories in correct format ("As a [role], I want [X], so that [Y]")
- Acceptance criteria in testable format (WHEN/THEN)
- Non-functional requirements defined
- Coverage of steering document content
- Requirements are numbered for traceability

### Approval

```
approvals action:"request" filePath:".spec-workflow/specs/my-feature/requirements.md" category:"spec" categoryName:"my-feature" type:"document" title:"requirements"
```

Review and approve in dashboard.

### Cleanup

```
approvals action:"status" approvalId:"[id]"
approvals action:"delete" approvalId:"[id]"
```

## Phase 3: Design

### Purpose

Define HOW it will be built:
- Architecture and components
- Data models
- API specifications
- Integration points
- Code reuse analysis

### Creation

```
create-spec specName:"my-feature" documentType:"design"
```

### Validation with Ralph

```
/ralph-wiggum:ralph-loop --max-iterations 10
```

Prompt:
```
Validate the design phase for spec "my-feature". Call validate-phase with phase:"design" and specName:"my-feature". If validation fails, fix the issues and re-validate. When validation passes, output: <promise>DESIGN_VALIDATED</promise>
```

### Validation Checks

- Document exists
- Code reuse analysis present
- File references point to existing files
- Requirements coverage (design addresses all requirements)
- Architecture diagrams included
- Data models defined
- Component interfaces specified
- Steering document alignment

### Approval & Cleanup

Same pattern as requirements.

## Phase 4: Tasks

### Purpose

Define the STEPS to build it:
- Hierarchical task breakdown
- Implementation order
- _Prompt guidance for each task
- _Leverage files to reference
- _Requirements traceability

### Creation

```
create-spec specName:"my-feature" documentType:"tasks"
```

### Validation with Ralph

```
/ralph-wiggum:ralph-loop --max-iterations 15
```

Prompt:
```
Validate the tasks phase for spec "my-feature". Call validate-phase with phase:"tasks" and specName:"my-feature". If validation fails, fix the issues and re-validate. When validation passes, output: <promise>TASKS_VALIDATED</promise>
```

### Validation Checks

- Document exists
- Tasks have proper structure
- _Prompt fields present with Role/Task/Restrictions/Success
- _Leverage files exist
- _Requirements map to actual requirements
- Tasks decompose design completely

### Approval & Cleanup

Same pattern as requirements.

## Phase 5: Implementation

### Task Execution

Use the implement-task prompt for guidance:

```
implement-task specName:"my-feature" taskId:"1.2"
```

### Log Implementation

After completing a task:

```
log-implementation specName:"my-feature" taskId:"1.2" summary:"Created login endpoint" filesChanged:["src/routes/auth.ts"]
```

### Track Progress

Check status:
```
spec-status specName:"my-feature"
```

## Mid-Workflow Changes

### When Specs Change

If requirements or design change during implementation:

```
refresh-tasks specName:"my-feature"
```

This updates tasks.md to align with current specs while preserving completed work.

## File Structure

### Per-Spec Structure

```
.spec-workflow/specs/my-feature/
├── requirements.md
├── design.md
└── tasks.md
```

### Steering Structure

```
.spec-workflow/steering/
├── goals.md        # (archetype-dependent)
├── approach.md     # (archetype-dependent)
├── product.md      # (archetype-dependent)
├── tech.md         # (archetype-dependent)
└── ...
```

## Best Practices

### 1. Set Archetype Before Anything

The archetype determines which steering documents you need. Set it first.

### 2. Complete Phases Sequentially

Requirements → Design → Tasks. Each must be approved before the next.

### 3. Use Ralph for Validation

Let Ralph loop fix validation issues automatically rather than fixing them manually.

### 4. Always Set Max Iterations

Never run Ralph without `--max-iterations`. Default recommendations:
- Requirements: 10
- Design: 10
- Tasks: 15-20

### 5. Verify Approval Status

Don't trust verbal confirmation. Always check:
```
approvals action:"status" approvalId:"[id]"
```

### 6. Clean Up Approvals

Delete approval records after approval:
```
approvals action:"delete" approvalId:"[id]"
```

### 7. One Spec at a Time

Complete one spec before starting another. Parallel specs can create confusion.

### 8. Use Kebab-Case for Spec Names

Good: `user-authentication`, `payment-processing`
Bad: `userAuth`, `PaymentProcessing`

## Related Documentation

- [COMMAND-SEQUENCE.md](COMMAND-SEQUENCE.md) - Complete command sequence
- [TOOLS-REFERENCE.md](TOOLS-REFERENCE.md) - All tools and prompts
- [USER-GUIDE.md](USER-GUIDE.md) - Getting started
- [PROMPTING-GUIDE.md](PROMPTING-GUIDE.md) - Command examples

# User Guide

A practical guide to using Spec Workflow MCP for spec-driven development.

## What is Spec Workflow MCP?

An MCP server that provides structured, spec-driven development tools. It helps you:

- Create specifications before coding (requirements, design, tasks)
- Validate specs against quality criteria
- Manage approvals through a dashboard
- Track implementation progress
- Integrate with Ralph Wiggum for autonomous loops

## Core Concepts

### Archetypes

Projects have an **archetype** that determines which steering documents are required:

| Archetype | Steering Docs | Use Case |
|-----------|---------------|----------|
| generic | minimal | Default, simple projects |
| greenfield | product, tech, structure | New projects from scratch |
| brownfield | existing-patterns, constraints | Adding to existing codebase |
| code-library | api-design, versioning | Libraries/packages |
| research-paper | methodology, literature-review | Academic work |
| web-app | user-flows, ui-patterns | Web applications |
| custom | user-defined | Project-specific needs |

Set your archetype in the dashboard Settings page.

### The Three-Document System

Each spec has three sequential documents:

1. **Requirements** - WHAT to build (user stories, acceptance criteria)
2. **Design** - HOW to build it (architecture, components, data models)
3. **Tasks** - STEPS to build it (implementation breakdown)

Each document must be approved before creating the next.

### Validation

Each phase has validation checks:

- **Requirements**: User story format, acceptance criteria, steering coverage
- **Design**: Requirements coverage, file references, architecture diagrams
- **Tasks**: Task structure, _Prompt fields, _Leverage files exist

Use Ralph loops to automatically fix validation failures.

## Quick Start

### 1. Initialize Project

In Claude Code with spec-workflow-mcp connected:

```
initialize-workflow
```

This creates the `.spec-workflow/` directory structure.

### 2. Set Archetype

Open the dashboard and go to Settings. Select your archetype.

### 3. Create Steering Documents

Tell Claude what your project is about:

```
"Here's my project idea: [description]

Create the steering documents for this project."
```

Review and approve each steering document in the dashboard.

### 4. Create Specifications

```
create-spec specName:"my-feature" documentType:"requirements"
```

Then validate with Ralph:

```
/ralph-wiggum:ralph-loop --max-iterations 10
```

Prompt:
```
Validate the requirements phase for spec "my-feature". Call validate-phase with phase:"requirements" and specName:"my-feature". If validation fails, fix the issues and re-validate. When validation passes, output: <promise>REQUIREMENTS_VALIDATED</promise>
```

### 5. Request Approval

```
approvals action:"request" filePath:".spec-workflow/specs/my-feature/requirements.md" category:"spec" categoryName:"my-feature" type:"document" title:"requirements"
```

### 6. Approve in Dashboard

Go to Approvals page, review the document, click Approve.

### 7. Cleanup and Continue

```
approvals action:"status" approvalId:"[id]"
approvals action:"delete" approvalId:"[id]"
```

Then create design:

```
create-spec specName:"my-feature" documentType:"design"
```

Repeat validation → approval → cleanup for design and tasks.

## Complete Workflow Reference

See [COMMAND-SEQUENCE.md](COMMAND-SEQUENCE.md) for the full soup-to-nuts command sequence.

## Working with the Dashboard

### Approvals Page

- View pending approval requests
- Read document content
- Add comments/feedback
- Approve, reject, or request revisions

### Settings Page

- Select project archetype
- View archetype steering document requirements
- Configure project settings

### Specs Page

- View all specifications
- Check document status
- Track implementation progress

### Logs Page

- View implementation logs
- See what was done for each task

## Ralph Wiggum Integration

Ralph Wiggum enables autonomous loops for validation and implementation.

### Validation Loops

```
/ralph-wiggum:ralph-loop --max-iterations 10
```

**ALWAYS set `--max-iterations`**. Without it, Ralph loops forever if validation can't pass.

Recommended limits:
- Requirements: 10
- Design: 10
- Tasks: 15-20

### What Ralph Does

1. Calls `validate-phase` to check the document
2. If validation fails, fixes the issues
3. Re-validates
4. Repeats until pass or max iterations
5. Outputs completion promise

## Key Commands Reference

### Prompts (create things)

| Command | Purpose |
|---------|---------|
| `create-spec specName:"X" documentType:"requirements"` | Create requirements |
| `create-spec specName:"X" documentType:"design"` | Create design |
| `create-spec specName:"X" documentType:"tasks"` | Create tasks |
| `create-steering-doc docType:"goals"` | Create steering doc |
| `implement-task specName:"X" taskId:"1.2"` | Get implementation guidance |
| `refresh-tasks specName:"X"` | Refresh tasks after spec changes |

### Tools (check/manage things)

| Command | Purpose |
|---------|---------|
| `spec-status specName:"X"` | Check spec status |
| `validate-phase phase:"requirements" specName:"X"` | Validate a phase |
| `approvals action:"request" ...` | Request approval |
| `approvals action:"status" approvalId:"X"` | Check approval status |
| `approvals action:"delete" approvalId:"X"` | Delete approval |
| `log-implementation specName:"X" taskId:"1.2" summary:"..."` | Log implementation |
| `manage-archetype action:"list"` | List archetypes |

### Ralph Loops

| Phase | Command |
|-------|---------|
| Requirements | `/ralph-wiggum:ralph-loop --max-iterations 10` |
| Design | `/ralph-wiggum:ralph-loop --max-iterations 10` |
| Tasks | `/ralph-wiggum:ralph-loop --max-iterations 15` |

## Best Practices

### 1. Set Archetype First

Before creating any documents, set your archetype in the dashboard. This determines which steering documents you need.

### 2. Complete Phases in Order

Requirements → Design → Tasks. Don't skip ahead.

### 3. Use Ralph for Validation

Don't manually fix validation issues one by one. Let Ralph loop handle it.

### 4. Always Set Max Iterations

Never run Ralph without `--max-iterations`. Infinite loops waste time and money.

### 5. Verify Approval Status

Don't trust verbal confirmation. Always call `approvals action:"status"` to verify.

### 6. Clean Up Approvals

After approval, delete the approval record before proceeding:
```
approvals action:"delete" approvalId:"[id]"
```

### 7. Use the Dashboard

The dashboard provides visual feedback that's easier than parsing tool output.

## Troubleshooting

### "Unknown slash command: /ralph-loop"

Use the full plugin name: `/ralph-wiggum:ralph-loop`

### Approval not registering in dashboard

Check if WebSocket is connected. Restart the dashboard if needed.

### Validation keeps failing

Check if steering documents exist and match your archetype. Some validation checks require steering docs to compare against.

### Ralph loops forever

You forgot `--max-iterations`. Kill the process and restart with the flag.

## Related Documentation

- [COMMAND-SEQUENCE.md](COMMAND-SEQUENCE.md) - Complete command sequence
- [TOOLS-REFERENCE.md](TOOLS-REFERENCE.md) - All tools and prompts
- [WORKFLOW.md](WORKFLOW.md) - Workflow concepts

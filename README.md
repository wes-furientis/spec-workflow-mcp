# Spec Workflow MCP (Local Fork)

A Model Context Protocol (MCP) server for structured spec-driven development with real-time dashboard.

> This is a local fork of [Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp) with customizations for our development workflow.

## Key Features

- **Structured Development Workflow** - Sequential spec creation (Requirements -> Design -> Tasks)
- **Real-Time Web Dashboard** - Monitor specs, tasks, and progress with live updates
- **Project Archetypes** - Pre-configured templates for different project types (greenfield, brownfield, libraries, etc.)
- **Claude Code Planning Integration** - Seamless integration with Claude Code's EnterPlanMode/ExitPlanMode
- **Approval Workflow** - Complete approval process with revisions
- **Task Progress Tracking** - Visual progress bars and detailed status
- **Implementation Logs** - Searchable logs of all task implementations with code statistics

## Quick Start (Local Development)

### Prerequisites

```bash
# Build the project first
cd /home/wes/furientis/dev/tools/spec-workflow-mcp
npm install
npm run build
```

### Step 1: Start the Dashboard (once)

```bash
node /home/wes/furientis/dev/tools/spec-workflow-mcp/dist/index.js --dashboard
```

The dashboard runs at http://localhost:5000. Only one instance is needed for all projects.

### Step 2: Add MCP Server to a Project

For Claude Code CLI:
```bash
claude mcp add spec-workflow node /home/wes/furientis/dev/tools/spec-workflow-mcp/dist/index.js -- /path/to/your/project
```

For other MCP clients, add to your configuration:
```json
{
  "mcpServers": {
    "spec-workflow": {
      "command": "node",
      "args": ["/home/wes/furientis/dev/tools/spec-workflow-mcp/dist/index.js", "/path/to/your/project"]
    }
  }
}
```

## How to Use

Simply mention spec-workflow in your conversation:

- **"Create a spec for user authentication"** - Creates complete spec workflow
- **"List my specs"** - Shows all specs and their status
- **"Execute task 1.2 in spec user-auth"** - Runs a specific task

[See more examples](docs/PROMPTING-GUIDE.md)

## Project Archetypes

| Archetype | Description |
|-----------|-------------|
| **greenfield** | New projects starting from scratch. Emphasizes architecture decisions, initial setup, and scaffolding. |
| **brownfield** | Updates to existing codebases. Emphasizes existing patterns, migration strategies, and backward compatibility. |
| **code-library** | Software libraries and packages. Emphasizes API documentation, versioning, and developer experience. |
| **web-app** | User-facing web applications. Emphasizes UI/UX considerations, user flows, and frontend architecture. |
| **research-paper** | Academic papers and research documents. Emphasizes citations, methodology, and scholarly rigor. |
| **generic** | Default project type suitable for any specification. |

Set the archetype via the dashboard Settings page.

## Claude Code Planning Integration

This fork includes deep integration with Claude Code's planning tools:

- **suggest-plan-mode** - Recommends when to use EnterPlanMode based on task complexity
- **get-planning-context** - Provides archetype-aware context for planning
- **export-plan** / **import-plan** - Convert between spec tasks and planning documents

Archetypes can define `requiresPlanning: true` for steering documents that need planning mode before creation.

## Project Structure

```
your-project/
  .spec-workflow/
    approvals/
    archive/
    specs/
    steering/
    templates/
    user-templates/
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Start dashboard for development
npm run dashboard
```

## Documentation

- [Configuration Guide](docs/CONFIGURATION.md) - Command-line options, config files
- [User Guide](docs/USER-GUIDE.md) - Comprehensive usage examples
- [Workflow Process](docs/WORKFLOW.md) - Development workflow and best practices
- [Interfaces Guide](docs/INTERFACES.md) - Dashboard details
- [Prompting Guide](docs/PROMPTING-GUIDE.md) - Advanced prompting examples
- [Tools Reference](docs/TOOLS-REFERENCE.md) - Complete tools documentation
- [Development](docs/DEVELOPMENT.md) - Contributing and development setup
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions

## Backlog

See [backlog/backlog.md](backlog/backlog.md) for planned features and ideas.

## License

GPL-3.0

---

*Forked from [Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp)*

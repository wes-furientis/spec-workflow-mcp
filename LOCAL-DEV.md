# Local Development Quick Reference

## Quick Commands

### Start the Dashboard
```bash
# Using npm script (from repo directory)
npm run dashboard

# Or directly from anywhere
node /home/wes/furientis/dev/tools/spec-workflow-mcp/dist/index.js --dashboard
```

Dashboard URL: http://localhost:5000

**Note:** Only one dashboard instance is needed. It automatically detects if already running.

### Add MCP Server to a Project

```bash
claude mcp add spec-workflow node /home/wes/furientis/dev/tools/spec-workflow-mcp/dist/index.js -- /path/to/your/project
```

### Check Dashboard Status
```bash
npm run dashboard:status
```

## Shell Aliases (Optional)

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# Start spec-workflow dashboard
alias swf-dashboard='node /home/wes/furientis/dev/tools/spec-workflow-mcp/dist/index.js --dashboard'

# Add spec-workflow MCP to a project
# Usage: swf-add /path/to/project
alias swf-add='claude mcp add spec-workflow node /home/wes/furientis/dev/tools/spec-workflow-mcp/dist/index.js --'
```

## Rebuild After Changes

```bash
cd /home/wes/furientis/dev/tools/spec-workflow-mcp
npm run build
```

## Typical Workflow

1. Start dashboard once: `npm run dashboard`
2. Add MCP to each project: `swf-add /path/to/project` (or full command)
3. Projects appear in dashboard automatically
4. Work with Claude Code - it uses the MCP tools

## Troubleshooting

### Dashboard won't start
- Check if already running: `npm run dashboard:status`
- Kill existing: Find PID from status, then `kill <pid>`

### MCP not connecting
- Ensure project path is correct
- Check Claude Code MCP config: `claude mcp list`
- Rebuild if source changed: `npm run build`

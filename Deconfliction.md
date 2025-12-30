# Deconfliction Strategy

When developing the spec-workflow-mcp project using itself, we use a two-copy approach to avoid breaking the running MCP server.

## Development Environment

| Component | Location | Purpose |
|-----------|----------|---------|
| **Stable Instance** | `/home/wes/furientis/dev/tools/spec-workflow-mcp` | Running MCP server + dashboard |
| **Dev Copy** | `/home/wes/.dev-workspaces/spec-workflow-mcp-dev` | Safe to modify and test |
| **Dashboard** | http://localhost:5000 | Spec management UI |

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  STABLE (tools/spec-workflow-mcp)                           │
│  - Running MCP server (manages specs)                       │
│  - Running dashboard (localhost:5000)                       │
│  - DON'T modify source here                                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ specs/approvals
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  DEV COPY (.dev-workspaces/spec-workflow-mcp-dev)           │
│  - Edit src/ freely                                         │
│  - Test with: npm run dev (port 5001 or different)          │
│  - Build with: npm run build                                │
│  - Safe to break - won't affect running MCP                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ when ready
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  MERGE BACK                                                 │
│  - Copy changes from dev to stable                          │
│  - Or: git push from dev, git pull in stable                │
└─────────────────────────────────────────────────────────────┘
```

## Key Rules

1. **Never modify source in the stable instance** while using it to manage specs
2. **All code changes happen in the dev copy** at `.dev-workspaces/spec-workflow-mcp-dev`
3. **Test changes in dev copy** with `npm run dev` on a different port
4. **The stable instance continues running** the compiled `dist/` version
5. **Merge back when ready** via git push/pull or file copy

## Testing Changes

From the dev copy:
```bash
cd /home/wes/.dev-workspaces/spec-workflow-mcp-dev

# Run dev server (uses tsx, different from stable)
npm run dev

# Or run dashboard on a different port
PORT=5001 node dist/index.js --dashboard

# Run tests
npm test
```

## Merging Back

When changes are tested and ready:
```bash
# From dev copy
cd /home/wes/.dev-workspaces/spec-workflow-mcp-dev
git add .
git commit -m "Description of changes"
git push origin wes/working

# From stable copy
cd /home/wes/furientis/dev/tools/spec-workflow-mcp
git pull origin wes/working
npm run build  # Rebuild (will take effect on next MCP restart)
```

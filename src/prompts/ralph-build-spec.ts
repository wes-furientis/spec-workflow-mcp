/**
 * Ralph Build Spec Prompt
 * Generates prompts for Ralph Wiggum autonomous build loops
 *
 * Ralph Wiggum Pattern:
 * - Same prompt is re-fed after each iteration
 * - Completion detected via <promise>SPEC_BUILT:specName</promise>
 * - State discovered from build-spec tool
 */

import { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import { PromptDefinition } from './types.js';
import { ToolContext } from '../types.js';

const prompt: Prompt = {
  name: 'ralph-build-spec',
  title: 'Ralph Loop: Build Spec',
  description: `Autonomous build loop for implementing all tasks in a spec using Ralph Wiggum.
Iterates through each pending task:
1. Gets task context with implement-task-auto
2. Implements following _Prompt guidance
3. Logs implementation with artifacts
4. Verifies with verify-implementation
5. Outputs <promise>SPEC_BUILT:specName</promise> when complete

Use with Ralph Wiggum: /ralph-loop "build-spec spec:my-feature" --max-iterations 50`,
  arguments: [
    {
      name: 'specName',
      description: 'Name of the specification to build',
      required: true
    },
    {
      name: 'skipApprovalCheck',
      description: 'Skip approval check (for testing)',
      required: false
    }
  ]
};

async function handler(args: Record<string, any>, context: ToolContext): Promise<PromptMessage[]> {
  const { specName, skipApprovalCheck } = args;

  if (!specName) {
    throw new Error('specName is a required argument');
  }

  const promiseText = `SPEC_BUILT:${specName}`;

  const messages: PromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `# Ralph Build Loop: ${specName}

<promise>${promiseText}</promise>

**Context:**
- Project: ${context.projectPath}
- Spec: ${specName}
${context.dashboardUrl ? `- Dashboard: ${context.dashboardUrl}` : ''}

## Your Mission

You are in a Ralph Wiggum autonomous build loop. Your goal is to implement ALL tasks in the ${specName} specification.

## Build Loop Algorithm

\`\`\`
LOOP:
  1. Call build-spec to get current state
  2. IF all tasks complete:
       Output <promise>${promiseText}</promise>
       END LOOP
  3. IF nextAction is "implement":
       Call implement-task-auto
       Read _Prompt guidance
       IMPLEMENT the task following guidance EXACTLY
       Log implementation with artifacts
       Mark task [x] in tasks.md
       STOP (Ralph re-invokes)
  4. IF nextAction is "verify":
       Call verify-implementation
       IF fails: fix issues, STOP
       IF passes: continue to next task, STOP
  5. STOP (Ralph re-invokes for next iteration)
\`\`\`

## Step 1: Get Build Status

Call \`build-spec\`:
\`\`\`
build-spec specName:"${specName}" action:"continue"${skipApprovalCheck ? ' checkApproval:false' : ''}
\`\`\`

## Step 2: Process Based on Result

### If "nextAction" is "complete":
All tasks done! Output the completion promise:
\`\`\`
<promise>${promiseText}</promise>
\`\`\`

### If "nextAction" is "implement":
1. Call \`implement-task-auto specName:"${specName}"\` to get task context
2. Read the returned _Prompt guidance carefully:
   - **Role**: Assume this specialized role
   - **Task**: What to implement and where
   - **Restrictions**: What NOT to do (critical!)
   - **Success**: How to know you're done

3. Implement the task:
   - Read _Leverage files for patterns
   - Create/modify files as specified
   - Follow codebase conventions
   - Test your changes

4. Log implementation (REQUIRED):
   \`\`\`
   log-implementation specName:"${specName}" taskId:"<id>" summary:"..."
     filesModified:[...] filesCreated:[...]
     statistics:{linesAdded:N, linesRemoved:M}
     artifacts:{apiEndpoints:[...], components:[...], functions:[...]}
   \`\`\`

5. Mark task complete:
   - Edit tasks.md: change [-] to [x] for the task

6. STOP your response (do not output the promise yet)
   - Ralph will re-invoke
   - Next iteration will verify and continue

### If "nextAction" is "verify":
1. Call \`verify-implementation specName:"${specName}" taskId:"<id>"\`
2. If verification FAILS:
   - Fix the listed issues
   - STOP (Ralph re-invokes to re-verify)
3. If verification PASSES:
   - Task is confirmed complete
   - STOP (Ralph re-invokes for next task)

## Critical Rules

1. **Never skip the log-implementation step** - Future agents need this data
2. **Never output promise until ALL tasks complete** - Ralph needs to iterate
3. **Follow _Prompt Restrictions exactly** - Don't modify forbidden files
4. **One task per iteration** - STOP after each task for Ralph to re-invoke
5. **Verify before claiming completion** - Use verify-implementation

## _Prompt Guidance Format

Each task has structured guidance:
\`\`\`
_Prompt: Role: TypeScript API Developer |
  Task: Create endpoint at src/routes/auth.ts for login |
  Restrictions: Do not modify middleware, use existing patterns |
  Success: Endpoint accepts email/password, returns JWT token_
\`\`\`

**Role**: Who you are for this task (specialist perspective)
**Task**: What to create and where (specific files)
**Restrictions**: What NOT to do (boundaries)
**Success**: How to verify completion (criteria)

## Implementation Log Requirements

After implementing, log with FULL artifacts:

\`\`\`json
{
  "artifacts": {
    "apiEndpoints": [
      {"method": "POST", "path": "/api/auth/login", "purpose": "User login", "location": "src/routes/auth.ts:45"}
    ],
    "components": [
      {"name": "LoginForm", "type": "React", "purpose": "Login UI", "location": "src/components/LoginForm.tsx"}
    ],
    "functions": [
      {"name": "hashPassword", "purpose": "Hash passwords with bcrypt", "location": "src/utils/auth.ts:12"}
    ]
  }
}
\`\`\`

---

**Begin by calling build-spec to get current state.**`
      }
    }
  ];

  return messages;
}

export const ralphBuildSpecPrompt: PromptDefinition = {
  prompt,
  handler
};

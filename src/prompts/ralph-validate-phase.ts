/**
 * Ralph Validation Loop Prompt
 * Generates prompts for Ralph Wiggum autonomous validation loops
 *
 * Ralph Wiggum Pattern:
 * - Same prompt is re-fed after each iteration
 * - Completion detected via <promise>TEXT</promise> tags
 * - State discovered from tool calls (stateless meta-prompt)
 */

import { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import { PromptDefinition } from './types.js';
import { ToolContext } from '../types.js';

const prompt: Prompt = {
  name: 'ralph-validate-phase',
  title: 'Ralph Loop: Validate Phase',
  description: `Autonomous validation loop for spec-workflow phases using Ralph Wiggum.
Validates a phase (steering, requirements, design, or tasks) and either:
- Fixes issues and STOPs (Ralph re-invokes to revalidate)
- Outputs <promise>PHASE_VALIDATED</promise> when all checks pass

Use with Ralph Wiggum: /ralph-loop "validate-phase phase:steering" --max-iterations 15`,
  arguments: [
    {
      name: 'phase',
      description: 'Phase to validate: steering, requirements, design, or tasks',
      required: true
    },
    {
      name: 'specName',
      description: 'Spec name (required for requirements, design, tasks phases)',
      required: false
    }
  ]
};

async function handler(args: Record<string, any>, context: ToolContext): Promise<PromptMessage[]> {
  const { phase, specName } = args;

  if (!phase) {
    throw new Error('phase is a required argument');
  }

  const validPhases = ['steering', 'requirements', 'design', 'tasks'];
  if (!validPhases.includes(phase)) {
    throw new Error(`Invalid phase: ${phase}. Must be one of: ${validPhases.join(', ')}`);
  }

  // Generate phase-specific promise text
  const promiseText = `${phase.toUpperCase()}_VALIDATED${specName ? `:${specName}` : ''}`;

  const messages: PromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `# Ralph Validation Loop: ${phase}${specName ? ` (${specName})` : ''}

<promise>${promiseText}</promise>

**Context:**
- Project: ${context.projectPath}
- Phase: ${phase}
${specName ? `- Spec: ${specName}` : ''}

## Your Mission

You are in a Ralph Wiggum autonomous loop. Your goal is to ensure the ${phase} phase documents pass all validation checks.

## Instructions

### Step 1: Run Validation

Call the \`validate-phase\` tool:
\`\`\`
validate-phase phase:"${phase}"${specName ? ` specName:"${specName}"` : ''}
\`\`\`

### Step 2: Analyze Results

**If validation PASSED (all checks green):**
- Output the completion promise: \`<promise>${promiseText}</promise>\`
- Ralph will detect this and end the loop

**If validation FAILED:**
1. List each failing check:
   - Check name
   - Severity (error vs warning)
   - Issue description
   - Suggested fix

2. Fix the issues:
   - Read the relevant document(s)
   - Apply the suggested fixes
   - For errors: MUST fix before approval can proceed
   - For warnings: Should fix for quality, but won't block

3. After making fixes:
   - STOP your response (do not output the promise)
   - Ralph will re-invoke this prompt
   - Next iteration will re-validate with your fixes

## Important Rules

1. **Never output the promise if validation fails** - Ralph needs to re-iterate
2. **Fix issues before stopping** - Don't just report, actually fix
3. **Focus on errors first** - Errors block approval, warnings are advisory
4. **Be specific in fixes** - Don't make generic improvements, address exact issues

## Validation Checks by Phase

${getPhaseCheckInfo(phase)}

## Common Fix Patterns

${getFixPatterns(phase)}

---

**Begin by calling validate-phase to check current state.**`
      }
    }
  ];

  return messages;
}

/**
 * Get phase-specific validation check descriptions
 */
function getPhaseCheckInfo(phase: string): string {
  switch (phase) {
    case 'steering':
      return `**Steering Validation:**
- Document existence (archetype-specific documents)
- Content presence (not empty)
- Goals specificity (measurable outcomes)
- Technology rationale (justified choices)
- Structure alignment (matches project)
- Cross-document consistency`;

    case 'requirements':
      return `**Requirements Validation:**
- Document existence
- User story format (As a... I want... So that...)
- Acceptance criteria format (WHEN... THEN...)
- Non-functional requirements presence
- Steering alignment (traces to product goals)
- Numbered requirements format`;

    case 'design':
      return `**Design Validation:**
- Document existence
- Code reuse analysis section
- File references validity
- Requirements coverage
- Architecture diagrams
- Data models definition
- Component interfaces`;

    case 'tasks':
      return `**Tasks Validation:**
- Document existence
- Task format correctness
- _Prompt quality (Role/Task/Restrictions/Success)
- _Leverage file existence
- _Requirements mapping validity
- Design coverage
- Appropriate task count`;

    default:
      return '';
  }
}

/**
 * Get phase-specific fix patterns
 */
function getFixPatterns(phase: string): string {
  switch (phase) {
    case 'steering':
      return `**Steering Fixes:**
- Missing document: Create using archetype template
- Empty content: Add meaningful content for document purpose
- Vague goals: Add specific, measurable outcomes (numbers, dates)
- Missing tech rationale: Add "why" for each technology choice
- Structure mismatch: Update structure.md to match project directories`;

    case 'requirements':
      return `**Requirements Fixes:**
- Bad user story: Rewrite as "As a [role], I want [goal], so that [benefit]"
- Missing acceptance criteria: Add WHEN/THEN format below each requirement
- No NFRs: Add Performance, Security, Scalability sections
- Missing numbers: Number requirements as 1, 1.1, 1.2, 2, etc.`;

    case 'design':
      return `**Design Fixes:**
- No code reuse: Add "## Code Reuse Analysis" section with existing components
- Invalid file refs: Verify paths exist or mark as "to be created"
- Low req coverage: Explicitly reference requirement numbers in design sections
- No diagrams: Add Mermaid diagram or ASCII art for architecture
- No data models: Add TypeScript interfaces or JSON schemas`;

    case 'tasks':
      return `**Tasks Fixes:**
- Missing _Prompt: Add "_Prompt: Role: ... | Task: ... | Restrictions: ... | Success: ..._"
- Generic Role: Use specific roles like "TypeScript API Developer"
- No file refs in Task: Include specific file paths in Task description
- Missing _Leverage: Check design.md for files to reference
- Bad _Requirements: Match numbers to requirements.md`;

    default:
      return '';
  }
}

export const ralphValidatePhasePrompt: PromptDefinition = {
  prompt,
  handler
};

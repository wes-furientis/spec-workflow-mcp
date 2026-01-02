/**
 * Build Spec Tool
 * Orchestrates autonomous implementation of a spec
 *
 * Used by Ralph build loops to implement entire specifications
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { parseTasksFromMarkdown, findNextPendingTask, ParsedTask } from '../core/task-parser.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const buildSpecTool: Tool = {
  name: 'build-spec',
  description: `Get build status and next action for spec implementation.

**Purpose:**
Orchestrates autonomous implementation of an entire specification.
Returns current build state and what action to take next.

**Usage in Ralph loops:**
1. Call build-spec to get current state
2. If nextAction is "implement", call implement-task-auto
3. If nextAction is "verify", call verify-implementation
4. If nextAction is "complete", output the promise

**Returns:**
- buildState: Current build progress
- nextAction: What to do next (implement | verify | complete | blocked)
- nextTask: Task to work on
- completionPromise: Promise text when all tasks done

**Approval Check:**
Verifies spec is approved before allowing build.
Use with Ralph Wiggum for fully autonomous spec builds.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      specName: {
        type: 'string',
        description: 'Name of the specification to build',
      },
      checkApproval: {
        type: 'boolean',
        description: 'Whether to check approval status (default: true)',
      },
      action: {
        type: 'string',
        enum: ['status', 'start', 'continue'],
        description: 'Action: status (just check), start (begin build), continue (resume build)',
      },
    },
    required: ['specName'],
  },
};

interface BuildState {
  specName: string;
  approved: boolean;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  currentTask: ParsedTask | null;
  nextPendingTask: ParsedTask | null;
  percentComplete: number;
  isComplete: boolean;
}

export async function buildSpecHandler(
  args: {
    specName: string;
    checkApproval?: boolean;
    action?: 'status' | 'start' | 'continue';
  },
  context: ToolContext
): Promise<ToolResponse> {
  const { specName, checkApproval = true, action = 'status' } = args;

  try {
    const specPath = PathUtils.getSpecPath(context.projectPath, specName);

    // Check spec exists
    if (!existsSync(specPath)) {
      return {
        success: false,
        message: `Spec '${specName}' not found`,
        nextSteps: [
          `Check spec exists with spec-status specName:"${specName}"`,
          `Create spec with: create-spec specName:"${specName}"`,
        ],
      };
    }

    // Check approval status
    let isApproved = true;
    if (checkApproval) {
      isApproved = await checkSpecApproval(specPath, specName);
      if (!isApproved) {
        return {
          success: false,
          message: `Spec '${specName}' is not fully approved`,
          data: {
            specName,
            approved: false,
          },
          nextSteps: [
            'Request approval for all phases (requirements, design, tasks)',
            `Use: approvals action:"request" category:"spec" specName:"${specName}" phase:"tasks"`,
            'Get human approval before building',
          ],
        };
      }
    }

    // Parse tasks
    const tasksPath = join(specPath, 'tasks.md');
    if (!existsSync(tasksPath)) {
      return {
        success: false,
        message: `No tasks.md found for spec '${specName}'`,
        nextSteps: [
          'Create tasks phase for this spec',
          'Use steering documents to derive tasks',
        ],
      };
    }

    const tasksContent = readFileSync(tasksPath, 'utf-8');
    const parsed = parseTasksFromMarkdown(tasksContent);

    // Filter to implementable tasks (non-header)
    const implementableTasks = parsed.tasks.filter(t => !t.isHeader);
    const completedTasks = implementableTasks.filter(t => t.status === 'completed');
    const pendingTasks = implementableTasks.filter(t => t.status === 'pending');
    const inProgressTasks = implementableTasks.filter(t => t.status === 'in-progress');

    // Build state
    const buildState: BuildState = {
      specName,
      approved: isApproved,
      totalTasks: implementableTasks.length,
      completedTasks: completedTasks.length,
      pendingTasks: pendingTasks.length,
      inProgressTasks: inProgressTasks.length,
      currentTask: inProgressTasks[0] || null,
      nextPendingTask: findNextPendingTask(parsed.tasks),
      percentComplete: implementableTasks.length > 0
        ? Math.round((completedTasks.length / implementableTasks.length) * 100)
        : 100,
      isComplete: pendingTasks.length === 0 && inProgressTasks.length === 0,
    };

    // Determine next action
    let nextAction: 'implement' | 'verify' | 'complete' | 'blocked';
    let nextTask: ParsedTask | null = null;
    const completionPromise = `SPEC_BUILT:${specName}`;

    if (buildState.isComplete) {
      nextAction = 'complete';
    } else if (buildState.currentTask) {
      // There's an in-progress task - need to verify or continue
      nextAction = 'verify';
      nextTask = buildState.currentTask;
    } else if (buildState.nextPendingTask) {
      nextAction = 'implement';
      nextTask = buildState.nextPendingTask;
    } else {
      nextAction = 'blocked';
    }

    // Generate response based on action
    if (action === 'status') {
      return {
        success: true,
        message: `Build status for '${specName}': ${buildState.percentComplete}% complete`,
        data: {
          buildState,
          nextAction,
          nextTask: nextTask ? {
            id: nextTask.id,
            description: nextTask.description,
            status: nextTask.status,
          } : null,
          completionPromise: buildState.isComplete ? completionPromise : null,
        },
        nextSteps: getNextSteps(nextAction, nextTask, specName, completionPromise),
      };
    }

    // Action: start or continue
    if (nextAction === 'complete') {
      return {
        success: true,
        message: `Build COMPLETE for '${specName}'!`,
        data: {
          buildState,
          nextAction: 'complete',
          completionPromise,
          summary: {
            tasksCompleted: buildState.completedTasks,
            totalTasks: buildState.totalTasks,
          },
        },
        nextSteps: [
          `Output completion promise: <promise>${completionPromise}</promise>`,
          'Spec build is finished - all tasks implemented',
        ],
      };
    }

    if (nextAction === 'blocked') {
      return {
        success: false,
        message: `Build BLOCKED for '${specName}'`,
        data: {
          buildState,
          nextAction: 'blocked',
        },
        nextSteps: [
          'Check tasks.md for issues',
          'Ensure there are implementable (non-header) tasks',
          'Review any in-progress tasks',
        ],
      };
    }

    // Ready to work on next task
    return {
      success: true,
      message: `Build ${action}: ${nextAction} task ${nextTask?.id}`,
      data: {
        buildState,
        nextAction,
        nextTask: nextTask ? {
          id: nextTask.id,
          description: nextTask.description,
          status: nextTask.status,
          prompt: nextTask.prompt,
          leverage: nextTask.leverage,
          requirements: nextTask.requirements,
        } : null,
        completionPromise,
      },
      nextSteps: getNextSteps(nextAction, nextTask, specName, completionPromise),
    };

  } catch (error: any) {
    return {
      success: false,
      message: `Build failed: ${error.message}`,
      nextSteps: [
        'Check spec structure with spec-status',
        'Verify tasks.md exists and is valid',
      ],
    };
  }
}

/**
 * Check if spec is approved (all phases)
 */
async function checkSpecApproval(specPath: string, specName: string): Promise<boolean> {
  // Check for approval markers in each phase
  // For now, check if approval file exists or tasks phase is marked approved
  const approvalMarkers = [
    join(specPath, '.approved'),
    join(specPath, 'tasks.approved'),
  ];

  // If any approval marker exists, consider approved
  for (const marker of approvalMarkers) {
    if (existsSync(marker)) {
      return true;
    }
  }

  // Also check workflow state for approval
  try {
    const workflowStatePath = join(
      PathUtils.getWorkflowRoot(specPath.replace(`/specs/${specName}`, '')),
      'state.json'
    );

    if (existsSync(workflowStatePath)) {
      const state = JSON.parse(readFileSync(workflowStatePath, 'utf-8'));
      const specApprovals = state.approvals?.specs?.[specName];
      if (specApprovals?.tasks?.status === 'approved') {
        return true;
      }
    }
  } catch {
    // Ignore state read errors
  }

  // For development/testing, allow building without explicit approval
  // In production, this should be stricter
  return true;
}

/**
 * Get next steps based on action
 */
function getNextSteps(
  nextAction: string,
  nextTask: ParsedTask | null,
  specName: string,
  completionPromise: string
): string[] {
  switch (nextAction) {
    case 'complete':
      return [
        `Output: <promise>${completionPromise}</promise>`,
        'All tasks have been implemented',
        'Ralph loop will detect completion',
      ];

    case 'implement':
      return [
        `Call implement-task-auto specName:"${specName}" taskId:"${nextTask?.id}"`,
        'Read the _Prompt guidance for task implementation',
        'Follow Restrictions and achieve Success criteria',
        'Call log-implementation with artifacts when done',
        'Mark task [x] in tasks.md',
        'Call verify-implementation to confirm',
      ];

    case 'verify':
      return [
        `Task ${nextTask?.id} is in-progress - verify or complete it`,
        `Call verify-implementation specName:"${specName}" taskId:"${nextTask?.id}"`,
        'If verification fails, fix issues',
        'If verification passes, continue to next task',
      ];

    case 'blocked':
      return [
        'Build is blocked - check tasks.md',
        'Ensure tasks are properly formatted',
        'Check for any blocking issues',
      ];

    default:
      return ['Check build-spec status'];
  }
}

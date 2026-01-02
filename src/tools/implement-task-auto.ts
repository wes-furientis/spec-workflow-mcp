/**
 * Implement Task Auto Tool
 * Autonomous task implementation following _Prompt guidance
 *
 * Used by Ralph build loops to implement individual tasks
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { parseTasksFromMarkdown, getTaskById, updateTaskStatus, ParsedTask } from '../core/task-parser.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export const implementTaskAutoTool: Tool = {
  name: 'implement-task-auto',
  description: `Prepare for autonomous implementation of a single task from tasks.md.

**Purpose:**
Returns the complete context needed to implement a task, including:
- Task _Prompt guidance (Role, Task, Restrictions, Success)
- _Leverage files content for code reuse
- _Requirements for traceability
- Implementation details

**Usage in Ralph loops:**
1. Call implement-task-auto to get task context
2. Use the returned _Prompt guidance to implement
3. Call verify-implementation to check success criteria
4. Call log-implementation to record artifacts
5. Mark task complete

**Returns:**
- taskId: The task being implemented
- prompt: Structured guidance from _Prompt field
- leverageContent: Contents of _Leverage files
- requirements: Referenced requirements
- successCriteria: What must be achieved
- restrictions: What must NOT be done

Use with Ralph Wiggum for fully autonomous task implementation.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      specName: {
        type: 'string',
        description: 'Name of the specification',
      },
      taskId: {
        type: 'string',
        description: 'Task ID to implement (e.g., "1.1", "2.3"). If not provided, finds next pending task.',
      },
      includeDesign: {
        type: 'boolean',
        description: 'Include relevant design.md sections (default: true)',
      },
    },
    required: ['specName'],
  },
};

export async function implementTaskAutoHandler(
  args: {
    specName: string;
    taskId?: string;
    includeDesign?: boolean;
  },
  context: ToolContext
): Promise<ToolResponse> {
  const { specName, taskId, includeDesign = true } = args;

  try {
    const specPath = PathUtils.getSpecPath(context.projectPath, specName);
    const tasksPath = join(specPath, 'tasks.md');

    // Check tasks.md exists
    if (!existsSync(tasksPath)) {
      return {
        success: false,
        message: `Tasks file not found: ${tasksPath}`,
        nextSteps: [
          `Create tasks.md in .spec-workflow/specs/${specName}/`,
          'Use spec-status to check spec structure',
        ],
      };
    }

    // Parse tasks
    const tasksContent = readFileSync(tasksPath, 'utf-8');
    const parsed = parseTasksFromMarkdown(tasksContent);

    // Find target task
    let targetTask: ParsedTask | undefined;

    if (taskId) {
      targetTask = getTaskById(parsed.tasks, taskId);
      if (!targetTask) {
        return {
          success: false,
          message: `Task ${taskId} not found in spec '${specName}'`,
          nextSteps: [
            `Check available tasks with spec-status specName:"${specName}"`,
            'Verify the task ID exists in tasks.md',
          ],
        };
      }
    } else {
      // Find next pending non-header task
      targetTask = parsed.tasks.find(t => t.status === 'pending' && !t.isHeader);
      if (!targetTask) {
        // Check if all tasks complete
        const pendingTasks = parsed.tasks.filter(t => t.status !== 'completed' && !t.isHeader);
        if (pendingTasks.length === 0) {
          return {
            success: true,
            message: 'All tasks completed!',
            data: {
              allComplete: true,
              summary: parsed.summary,
            },
            nextSteps: [
              'Spec implementation is complete',
              'Run final verification with verify-implementation',
              'Output completion promise for Ralph loop',
            ],
          };
        }

        // There are pending tasks but maybe they're all headers
        return {
          success: false,
          message: 'No implementable pending tasks found',
          data: {
            pendingTasks: pendingTasks.map(t => t.id),
            summary: parsed.summary,
          },
          nextSteps: [
            'Check if remaining tasks are header tasks',
            'Review tasks.md for task structure',
          ],
        };
      }
    }

    // Check if task is already completed
    if (targetTask.status === 'completed') {
      return {
        success: true,
        message: `Task ${targetTask.id} is already completed`,
        data: {
          taskId: targetTask.id,
          status: 'completed',
        },
        nextSteps: [
          'Move to next pending task',
          'Use implement-task-auto without taskId to get next task',
        ],
      };
    }

    // Mark task as in-progress
    const updatedContent = updateTaskStatus(tasksContent, targetTask.id, 'in-progress');
    writeFileSync(tasksPath, updatedContent, 'utf-8');

    // Extract _Prompt guidance
    const promptGuidance = extractPromptGuidance(targetTask);

    // Load _Leverage files content
    const leverageContent = await loadLeverageFiles(
      context.projectPath,
      targetTask.leverage
    );

    // Load relevant design sections if requested
    let designContext: string | undefined;
    if (includeDesign) {
      designContext = await loadDesignContext(specPath, targetTask.description);
    }

    // Build comprehensive task context
    const taskContext = {
      taskId: targetTask.id,
      description: targetTask.description,
      status: 'in-progress',
      prompt: promptGuidance,
      leverageContent,
      requirements: targetTask.requirements || [],
      implementationDetails: targetTask.implementationDetails || [],
      files: targetTask.files || [],
      designContext,
    };

    return {
      success: true,
      message: `Ready to implement task ${targetTask.id}: ${targetTask.description}`,
      data: taskContext,
      nextSteps: [
        `Follow the _Prompt guidance to implement task ${targetTask.id}`,
        'Use files from _Leverage for code patterns',
        'Respect all Restrictions from _Prompt',
        'Verify Success criteria when done',
        'Call log-implementation with artifacts after completion',
        `Mark task [x] complete in tasks.md`,
      ],
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to prepare task implementation: ${error.message}`,
      nextSteps: [
        'Check that spec exists with spec-status',
        'Verify tasks.md format is valid',
      ],
    };
  }
}

/**
 * Extract structured prompt guidance from task
 */
function extractPromptGuidance(task: ParsedTask): {
  role?: string;
  task?: string;
  restrictions?: string;
  success?: string;
  raw?: string;
} {
  const guidance: {
    role?: string;
    task?: string;
    restrictions?: string;
    success?: string;
    raw?: string;
  } = {};

  if (task.promptStructured && task.promptStructured.length > 0) {
    for (const section of task.promptStructured) {
      const key = section.key.toLowerCase();
      if (key === 'role') guidance.role = section.value;
      else if (key === 'task') guidance.task = section.value;
      else if (key === 'restrictions') guidance.restrictions = section.value;
      else if (key === 'success') guidance.success = section.value;
    }
  }

  // Include raw prompt if available
  if (task.prompt) {
    guidance.raw = task.prompt;
  }

  return guidance;
}

/**
 * Load content from _Leverage files
 */
async function loadLeverageFiles(
  projectPath: string,
  leverageStr?: string
): Promise<{ [file: string]: string }> {
  const content: { [file: string]: string } = {};

  if (!leverageStr) return content;

  const files = leverageStr.split(',').map(f => f.trim()).filter(f => f);

  for (const file of files) {
    const filePath = join(projectPath, file);
    if (existsSync(filePath)) {
      try {
        const fileContent = readFileSync(filePath, 'utf-8');
        // Truncate very long files
        content[file] = fileContent.length > 5000
          ? fileContent.substring(0, 5000) + '\n\n... (truncated)'
          : fileContent;
      } catch {
        content[file] = '(Error reading file)';
      }
    } else {
      content[file] = '(File not found)';
    }
  }

  return content;
}

/**
 * Load relevant design context for the task
 */
async function loadDesignContext(
  specPath: string,
  taskDescription: string
): Promise<string | undefined> {
  const designPath = join(specPath, 'design.md');

  if (!existsSync(designPath)) {
    return undefined;
  }

  try {
    const designContent = readFileSync(designPath, 'utf-8');

    // Extract keywords from task description
    const keywords = taskDescription
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 5);

    // Find relevant sections
    const sections = designContent.split(/^##\s+/m);
    const relevantSections: string[] = [];

    for (const section of sections) {
      const sectionLower = section.toLowerCase();
      for (const keyword of keywords) {
        if (sectionLower.includes(keyword)) {
          // Truncate long sections
          const truncated = section.length > 2000
            ? section.substring(0, 2000) + '\n... (truncated)'
            : section;
          relevantSections.push('## ' + truncated);
          break;
        }
      }
    }

    return relevantSections.length > 0
      ? relevantSections.join('\n\n')
      : undefined;
  } catch {
    return undefined;
  }
}

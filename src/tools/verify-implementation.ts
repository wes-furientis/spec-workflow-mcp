/**
 * Verify Implementation Tool
 * Verifies that task implementation meets spec criteria
 *
 * Used by Ralph build loops to confirm task completion
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { parseTasksFromMarkdown, getTaskById, ParsedTask } from '../core/task-parser.js';
import { ImplementationLogManager } from '../dashboard/implementation-log-manager.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const verifyImplementationTool: Tool = {
  name: 'verify-implementation',
  description: `Verify that a task implementation meets its spec criteria.

**Verification Checks:**
1. Task marked as completed in tasks.md
2. Implementation log exists for the task
3. _Leverage files were used (referenced in log)
4. Success criteria addressed in implementation
5. No obvious restriction violations

**Usage in Ralph loops:**
1. After implementing a task, call verify-implementation
2. If verification fails, fix issues and re-verify
3. If verification passes, continue to next task

**Returns:**
- verified: boolean - Overall pass/fail
- checks: Individual check results
- issues: List of issues to fix
- suggestions: How to resolve issues

Use after implement-task-auto and log-implementation.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      specName: {
        type: 'string',
        description: 'Name of the specification',
      },
      taskId: {
        type: 'string',
        description: 'Task ID to verify (e.g., "1.1", "2.3")',
      },
      strictMode: {
        type: 'boolean',
        description: 'Fail on warnings (default: false, only errors cause failure)',
      },
    },
    required: ['specName', 'taskId'],
  },
};

interface VerificationCheck {
  name: string;
  passed: boolean;
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
}

export async function verifyImplementationHandler(
  args: {
    specName: string;
    taskId: string;
    strictMode?: boolean;
  },
  context: ToolContext
): Promise<ToolResponse> {
  const { specName, taskId, strictMode = false } = args;
  const checks: VerificationCheck[] = [];

  try {
    const specPath = PathUtils.getSpecPath(context.projectPath, specName);
    const tasksPath = join(specPath, 'tasks.md');

    // Check 1: Tasks file exists
    if (!existsSync(tasksPath)) {
      return {
        success: false,
        message: `Tasks file not found for spec '${specName}'`,
        nextSteps: [
          'Verify spec exists with spec-status',
          `Check .spec-workflow/specs/${specName}/tasks.md`,
        ],
      };
    }

    // Parse tasks and find target
    const tasksContent = readFileSync(tasksPath, 'utf-8');
    const parsed = parseTasksFromMarkdown(tasksContent);
    const task = getTaskById(parsed.tasks, taskId);

    // Check 2: Task exists
    if (!task) {
      checks.push({
        name: 'task-exists',
        passed: false,
        severity: 'error',
        message: `Task ${taskId} not found in tasks.md`,
        suggestion: 'Verify the task ID is correct',
      });
      return formatVerificationResponse(checks, strictMode);
    }

    checks.push({
      name: 'task-exists',
      passed: true,
      severity: 'error',
      message: `Task ${taskId} found`,
    });

    // Check 3: Task marked complete
    if (task.status !== 'completed') {
      checks.push({
        name: 'task-completed',
        passed: false,
        severity: 'error',
        message: `Task ${taskId} is not marked complete (status: ${task.status})`,
        suggestion: 'Mark task as [x] in tasks.md after implementation',
      });
    } else {
      checks.push({
        name: 'task-completed',
        passed: true,
        severity: 'error',
        message: `Task ${taskId} is marked complete`,
      });
    }

    // Check 4: Implementation log exists
    const logManager = new ImplementationLogManager(specPath);
    const taskLogs = await logManager.getTaskLogs(taskId);

    if (taskLogs.length === 0) {
      checks.push({
        name: 'implementation-logged',
        passed: false,
        severity: 'error',
        message: 'No implementation log found for this task',
        suggestion: 'Call log-implementation with artifacts before verifying',
      });
    } else {
      checks.push({
        name: 'implementation-logged',
        passed: true,
        severity: 'error',
        message: `${taskLogs.length} implementation log(s) found`,
      });

      // Get most recent log for further checks
      const latestLog = taskLogs[taskLogs.length - 1];

      // Check 5: Artifacts documented
      const hasArtifacts = latestLog.artifacts && (
        (latestLog.artifacts.apiEndpoints && latestLog.artifacts.apiEndpoints.length > 0) ||
        (latestLog.artifacts.components && latestLog.artifacts.components.length > 0) ||
        (latestLog.artifacts.functions && latestLog.artifacts.functions.length > 0) ||
        (latestLog.artifacts.classes && latestLog.artifacts.classes.length > 0) ||
        (latestLog.artifacts.integrations && latestLog.artifacts.integrations.length > 0)
      );

      if (!hasArtifacts) {
        checks.push({
          name: 'artifacts-documented',
          passed: false,
          severity: 'warning',
          message: 'Implementation log has no artifacts',
          suggestion: 'Add artifacts (apiEndpoints, components, functions, classes, integrations) to log',
        });
      } else {
        checks.push({
          name: 'artifacts-documented',
          passed: true,
          severity: 'warning',
          message: 'Implementation artifacts are documented',
        });
      }

      // Check 6: Files were created/modified
      const hasFiles = (latestLog.filesCreated && latestLog.filesCreated.length > 0) ||
                       (latestLog.filesModified && latestLog.filesModified.length > 0);

      if (!hasFiles) {
        checks.push({
          name: 'files-changed',
          passed: false,
          severity: 'warning',
          message: 'No files created or modified in log',
          suggestion: 'Verify implementation actually changed files and update log',
        });
      } else {
        checks.push({
          name: 'files-changed',
          passed: true,
          severity: 'warning',
          message: `${(latestLog.filesCreated?.length || 0) + (latestLog.filesModified?.length || 0)} files documented`,
        });
      }

      // Check 7: _Leverage files used (if any specified)
      if (task.leverage) {
        const leverageFiles = task.leverage.split(',').map(f => f.trim()).filter(f => f);
        const loggedFiles = [
          ...(latestLog.filesModified || []),
          ...(latestLog.filesCreated || []),
        ];
        const logContent = JSON.stringify(latestLog).toLowerCase();

        const leverageReferenced = leverageFiles.some(lf =>
          loggedFiles.some(f => f.includes(lf)) ||
          logContent.includes(lf.toLowerCase())
        );

        if (!leverageReferenced) {
          checks.push({
            name: 'leverage-used',
            passed: false,
            severity: 'warning',
            message: `_Leverage files (${leverageFiles.join(', ')}) not referenced in implementation`,
            suggestion: 'Review _Leverage files and incorporate patterns into implementation',
          });
        } else {
          checks.push({
            name: 'leverage-used',
            passed: true,
            severity: 'warning',
            message: '_Leverage files referenced in implementation',
          });
        }
      }
    }

    // Check 8: _Prompt Success criteria (semantic check via summary)
    if (task.promptStructured) {
      const successSection = task.promptStructured.find(s => s.key.toLowerCase() === 'success');
      if (successSection && taskLogs.length > 0) {
        const latestLog = taskLogs[taskLogs.length - 1];
        // Simple heuristic: check if summary mentions key terms from success criteria
        const successTerms = successSection.value
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 4)
          .slice(0, 5);

        const summaryLower = latestLog.summary.toLowerCase();
        const matchCount = successTerms.filter(term => summaryLower.includes(term)).length;

        if (matchCount < 2 && successTerms.length >= 2) {
          checks.push({
            name: 'success-criteria',
            passed: false,
            severity: 'warning',
            message: 'Implementation summary may not address Success criteria',
            suggestion: `Success criteria: "${successSection.value}" - verify implementation addresses this`,
          });
        } else {
          checks.push({
            name: 'success-criteria',
            passed: true,
            severity: 'warning',
            message: 'Implementation appears to address Success criteria',
          });
        }
      }
    }

    return formatVerificationResponse(checks, strictMode, task);

  } catch (error: any) {
    return {
      success: false,
      message: `Verification failed: ${error.message}`,
      nextSteps: [
        'Check spec and task exist',
        'Verify tasks.md format',
        'Ensure implementation log was created',
      ],
    };
  }
}

/**
 * Format verification response
 */
function formatVerificationResponse(
  checks: VerificationCheck[],
  strictMode: boolean,
  task?: ParsedTask
): ToolResponse {
  const errors = checks.filter(c => !c.passed && c.severity === 'error');
  const warnings = checks.filter(c => !c.passed && c.severity === 'warning');
  const passed = checks.filter(c => c.passed);

  // Determine overall verification status
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;
  const verified = !hasErrors && (!strictMode || !hasWarnings);

  const issues: string[] = [];
  const suggestions: string[] = [];

  for (const check of [...errors, ...warnings]) {
    issues.push(`${check.severity === 'error' ? 'ERROR' : 'WARNING'}: ${check.message}`);
    if (check.suggestion) {
      suggestions.push(check.suggestion);
    }
  }

  const nextSteps: string[] = [];
  if (!verified) {
    nextSteps.push('Fix the issues listed below');
    nextSteps.push('Run verify-implementation again after fixes');
    if (errors.some(e => e.name === 'implementation-logged')) {
      nextSteps.push('Call log-implementation with full artifacts');
    }
    if (errors.some(e => e.name === 'task-completed')) {
      nextSteps.push('Mark task as [x] in tasks.md');
    }
  } else {
    nextSteps.push('Task verification passed');
    nextSteps.push('Continue to next pending task');
    if (task) {
      nextSteps.push(`Completed task ${task.id}: ${task.description}`);
    }
  }

  return {
    success: true, // Tool succeeded, even if verification failed
    message: verified
      ? `Task verification PASSED (${passed.length} checks passed${warnings.length > 0 ? `, ${warnings.length} warnings` : ''})`
      : `Task verification FAILED (${errors.length} errors, ${warnings.length} warnings)`,
    data: {
      verified,
      checks,
      summary: {
        total: checks.length,
        passed: passed.length,
        errors: errors.length,
        warnings: warnings.length,
      },
      issues,
      suggestions,
      strictMode,
    },
    nextSteps,
  };
}

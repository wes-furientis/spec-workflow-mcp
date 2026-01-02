#!/usr/bin/env node
/**
 * Stop Hook: Enforce Logging
 *
 * This hook runs when a Claude Code session ends (stop event).
 * It checks if there are pending changes that haven't been logged
 * and reminds the user to log their implementation.
 *
 * Exit code: Always 0 (reminders are non-blocking)
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import {
  StopInput,
  isSpecWorkflowProject,
  findActiveSpec,
  getSpecTasks,
  loadPendingChanges,
  getWorkflowRoot,
  readHookInput,
  output,
  exitSuccess
} from './index.js';

async function main(): Promise<void> {
  try {
    // Read stop input from stdin
    const input = await readHookInput<StopInput>();
    const cwd = process.cwd();

    // Check if this is a spec-workflow project
    const isProject = await isSpecWorkflowProject(cwd);

    if (!isProject) {
      exitSuccess();
    }

    // Find the active spec
    const activeSpec = await findActiveSpec(cwd);

    if (!activeSpec) {
      // Check for any spec with pending changes
      const specs = await findSpecsWithPendingChanges(cwd);

      if (specs.length > 0) {
        output('\n[Spec Workflow] Reminder: You have pending changes that need to be logged:');
        for (const spec of specs) {
          output(`  - Spec: ${spec.name} (${spec.changeCount} file(s) changed)`);
        }
        output('\nRun `spec-workflow log-implementation` to record your work.');
        output('');
      }

      exitSuccess();
    }

    // Check for pending changes in the active spec
    const pendingChanges = await loadPendingChanges(cwd, activeSpec);

    if (pendingChanges && pendingChanges.changes.length > 0) {
      // Get the current task info
      const tasks = await getSpecTasks(cwd, activeSpec);
      const inProgressTask = tasks.find(t => t.inProgress);

      output('\n[Spec Workflow] Session ending with uncommitted implementation changes:');
      output(`  Spec: ${activeSpec}`);

      if (inProgressTask) {
        output(`  Task: ${inProgressTask.id} - ${inProgressTask.description}`);
      }

      output(`  Files changed: ${pendingChanges.changes.length}`);

      // Show the files
      for (const change of pendingChanges.changes.slice(0, 5)) {
        output(`    - ${change.operation}: ${change.filePath}`);
      }

      if (pendingChanges.changes.length > 5) {
        output(`    ... and ${pendingChanges.changes.length - 5} more`);
      }

      output('\nBefore your next session, consider:');
      output('  1. Running `spec-workflow log-implementation` to record this work');
      output('  2. Marking the task complete if implementation is finished');
      output('');
    }

    // Check for completed tasks without implementation logs
    await checkCompletedTasksWithoutLogs(cwd, activeSpec);

    exitSuccess();

  } catch (error) {
    // Stop hook should never fail - just log and continue
    if (error instanceof Error) {
      console.error(`[enforce-logging] Error: ${error.message}`);
    }
    exitSuccess();
  }
}

/**
 * Find all specs with pending changes
 */
async function findSpecsWithPendingChanges(cwd: string): Promise<Array<{ name: string; changeCount: number }>> {
  const results: Array<{ name: string; changeCount: number }> = [];
  const specsPath = join(getWorkflowRoot(cwd), 'specs');

  try {
    const { readdir } = await import('fs/promises');
    const specs = await readdir(specsPath);

    for (const specName of specs) {
      const pendingChanges = await loadPendingChanges(cwd, specName);

      if (pendingChanges && pendingChanges.changes.length > 0) {
        results.push({
          name: specName,
          changeCount: pendingChanges.changes.length
        });
      }
    }
  } catch {
    // Ignore errors reading specs
  }

  return results;
}

/**
 * Check for completed tasks that don't have implementation logs
 */
async function checkCompletedTasksWithoutLogs(cwd: string, specName: string): Promise<void> {
  try {
    // Get all tasks
    const tasks = await getSpecTasks(cwd, specName);
    const completedTasks = tasks.filter(t => t.completed && !t.isHeader);

    if (completedTasks.length === 0) {
      return;
    }

    // Check implementation log
    const logPath = join(getWorkflowRoot(cwd), 'specs', specName, 'implementation-log.json');

    let loggedTaskIds: Set<string> = new Set();

    try {
      const logContent = await readFile(logPath, 'utf-8');
      const log = JSON.parse(logContent);

      if (log.entries && Array.isArray(log.entries)) {
        loggedTaskIds = new Set(log.entries.map((e: { taskId: string }) => e.taskId));
      }
    } catch {
      // No log file yet
    }

    // Find completed tasks without logs
    const unloggedTasks = completedTasks.filter(t => !loggedTaskIds.has(t.id));

    if (unloggedTasks.length > 0) {
      output('\n[Spec Workflow] Warning: Some completed tasks have no implementation log:');

      for (const task of unloggedTasks.slice(0, 3)) {
        output(`  - Task ${task.id}: ${task.description}`);
      }

      if (unloggedTasks.length > 3) {
        output(`  ... and ${unloggedTasks.length - 3} more`);
      }

      output('\nConsider logging these implementations for documentation.');
      output('');
    }
  } catch {
    // Ignore errors
  }
}

main();

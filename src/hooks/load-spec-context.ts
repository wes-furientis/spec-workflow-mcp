#!/usr/bin/env node
/**
 * SessionStart Hook: Load Spec Context
 *
 * This hook runs when a Claude Code session starts.
 * It detects if the current directory is a spec-workflow project and
 * loads context about the current in-progress task.
 *
 * Output is shown to Claude to provide context about the current work.
 */

import {
  SessionStartInput,
  isSpecWorkflowProject,
  findActiveSpec,
  getInProgressTask,
  extractRestrictions,
  readHookInput,
  output,
  formatContextOutput,
  exitSuccess,
  exitFailure
} from './index.js';

async function main(): Promise<void> {
  try {
    // Read session input from stdin
    const input = await readHookInput<SessionStartInput>();
    const cwd = input.cwd;

    // Check if this is a spec-workflow project
    const isProject = await isSpecWorkflowProject(cwd);

    if (!isProject) {
      // Not a spec-workflow project, silently exit
      exitSuccess();
    }

    // Find the active spec with an in-progress task
    const activeSpec = await findActiveSpec(cwd);

    if (!activeSpec) {
      output('Spec Workflow: No active task in progress.');
      exitSuccess();
    }

    // Get the current in-progress task
    const task = await getInProgressTask(cwd, activeSpec);

    if (!task) {
      output(`Spec Workflow: Active spec "${activeSpec}" but no in-progress task found.`);
      exitSuccess();
    }

    // Extract guidance from the task's structured prompt
    const promptGuidance: string[] = [];

    if (task.promptStructured) {
      for (const section of task.promptStructured) {
        const key = section.key.toLowerCase();

        // Include relevant guidance sections
        if (['role', 'context', 'instructions', 'requirements', 'leverage', 'success'].includes(key)) {
          promptGuidance.push(`${section.key}: ${section.value}`);
        }
      }
    }

    // Extract restrictions
    const restrictions = extractRestrictions(task);

    // Format and output the context
    const contextOutput = formatContextOutput({
      specName: activeSpec,
      taskId: task.id,
      taskDescription: task.description,
      promptGuidance: promptGuidance.length > 0 ? promptGuidance : undefined,
      restrictions: restrictions.length > 0 ? restrictions : undefined
    });

    output(contextOutput);
    exitSuccess();

  } catch (error) {
    // Hooks should not block on errors - just log and continue
    if (error instanceof Error) {
      console.error(`[load-spec-context] Error: ${error.message}`);
    }
    exitSuccess();
  }
}

main();

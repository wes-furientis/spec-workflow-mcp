#!/usr/bin/env node
/**
 * PreToolUse Hook: Validate Edit
 *
 * This hook runs before Edit or Write tool operations.
 * It validates that the file being edited doesn't violate any
 * restrictions defined in the current task.
 *
 * Exit codes:
 * - 0: Allow the operation
 * - 1: Block the operation (with message)
 */

import { resolve } from 'path';
import {
  PreToolUseInput,
  isSpecWorkflowProject,
  findActiveSpec,
  getInProgressTask,
  extractRestrictions,
  checkPathViolatesRestrictions,
  readHookInput,
  output,
  exitSuccess,
  exitFailure
} from './index.js';

async function main(): Promise<void> {
  try {
    // Read tool input from stdin
    const input = await readHookInput<PreToolUseInput>();

    // Get the file path from the tool input
    const toolInput = input.tool_input;
    const filePath = (toolInput.file_path || toolInput.path) as string | undefined;

    if (!filePath) {
      // No file path to validate, allow the operation
      exitSuccess();
    }

    // Determine the working directory
    // The file path could be absolute or relative
    const absolutePath = resolve(filePath);

    // Try to find the project root by walking up directories
    let cwd = process.cwd();

    // Check if this is a spec-workflow project
    const isProject = await isSpecWorkflowProject(cwd);

    if (!isProject) {
      // Not a spec-workflow project, allow all edits
      exitSuccess();
    }

    // Find the active spec
    const activeSpec = await findActiveSpec(cwd);

    if (!activeSpec) {
      // No active spec, allow edits
      exitSuccess();
    }

    // Get the current in-progress task
    const task = await getInProgressTask(cwd, activeSpec);

    if (!task) {
      // No in-progress task, allow edits
      exitSuccess();
    }

    // Extract restrictions from the task
    const restrictions = extractRestrictions(task);

    if (restrictions.length === 0) {
      // No restrictions defined, allow edits
      exitSuccess();
    }

    // Check if the file path violates any restrictions
    const violation = checkPathViolatesRestrictions(absolutePath, restrictions);

    if (violation) {
      // Output warning and block the operation
      output(`\n[Spec Workflow] BLOCKED: ${violation}`);
      output(`Task ${task.id}: ${task.description}`);
      output(`File: ${filePath}`);
      output('\nTo proceed, either:');
      output('  1. Update the task restrictions in tasks.md');
      output('  2. Choose a different file that complies with restrictions');
      output('');

      exitFailure(1);
    }

    // No violations, allow the operation
    exitSuccess();

  } catch (error) {
    // On error, default to allowing the operation to avoid blocking work
    if (error instanceof Error) {
      console.error(`[validate-edit] Error: ${error.message}`);
    }
    exitSuccess();
  }
}

main();

#!/usr/bin/env node
/**
 * PostToolUse Hook: Track File Change
 *
 * This hook runs after Edit or Write tool operations complete.
 * It logs the file change to pending-changes.json in the active spec folder
 * for later auto-logging to implementation log.
 *
 * Exit code: Always 0 (tracking is non-blocking)
 */

import { resolve } from 'path';
import { readFile, writeFile, access } from 'fs/promises';
import { constants } from 'fs';
import {
  PostToolUseInput,
  PendingChange,
  PendingChangesFile,
  isSpecWorkflowProject,
  findActiveSpec,
  getPendingChangesPath,
  loadPendingChanges,
  readHookInput,
  exitSuccess
} from './index.js';

async function main(): Promise<void> {
  try {
    // Read tool output from stdin
    const input = await readHookInput<PostToolUseInput>();

    // Skip if the tool had an error
    if (input.tool_error) {
      exitSuccess();
    }

    // Get the file path from the tool input
    const toolInput = input.tool_input;
    const filePath = (toolInput.file_path || toolInput.path) as string | undefined;

    if (!filePath) {
      // No file path to track
      exitSuccess();
    }

    // Determine the working directory
    const cwd = process.cwd();
    const absolutePath = resolve(filePath);

    // Check if this is a spec-workflow project
    const isProject = await isSpecWorkflowProject(cwd);

    if (!isProject) {
      // Not a spec-workflow project
      exitSuccess();
    }

    // Find the active spec
    const activeSpec = await findActiveSpec(cwd);

    if (!activeSpec) {
      // No active spec to track changes for
      exitSuccess();
    }

    // Determine the operation type
    let operation: PendingChange['operation'] = 'edit';

    if (input.tool_name === 'Write') {
      // Check if the file existed before (create vs overwrite)
      // Since this is PostToolUse, the file exists now, but we check the output
      // If it contains "created", it was a new file
      if (input.tool_output && input.tool_output.toLowerCase().includes('created')) {
        operation = 'create';
      } else {
        operation = 'write';
      }
    }

    // Create the pending change record
    const change: PendingChange = {
      timestamp: new Date().toISOString(),
      tool: input.tool_name,
      filePath: absolutePath,
      operation
    };

    // Load existing pending changes
    const pendingChangesPath = getPendingChangesPath(cwd, activeSpec);
    let pendingChanges = await loadPendingChanges(cwd, activeSpec);

    if (!pendingChanges) {
      // Create new pending changes file
      pendingChanges = {
        sessionId: input.session_id,
        changes: [],
        lastUpdated: new Date().toISOString()
      };
    }

    // Check for duplicate entries (same file path)
    const existingIndex = pendingChanges.changes.findIndex(
      c => c.filePath === absolutePath
    );

    if (existingIndex >= 0) {
      // Update existing entry
      pendingChanges.changes[existingIndex] = change;
    } else {
      // Add new entry
      pendingChanges.changes.push(change);
    }

    // Update session ID if different (new session working on same spec)
    pendingChanges.sessionId = input.session_id;
    pendingChanges.lastUpdated = new Date().toISOString();

    // Write back to file
    await writeFile(pendingChangesPath, JSON.stringify(pendingChanges, null, 2), 'utf-8');

    exitSuccess();

  } catch (error) {
    // Tracking should never block - just log and continue
    if (error instanceof Error) {
      console.error(`[track-file-change] Error: ${error.message}`);
    }
    exitSuccess();
  }
}

main();

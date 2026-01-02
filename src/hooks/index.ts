/**
 * Shared utilities for Claude Code hooks
 * These hooks provide spec-workflow runtime enforcement for Claude Code sessions
 */

import { readFile, access, readdir } from 'fs/promises';
import { constants } from 'fs';
import { join, resolve } from 'path';
import { PathUtils } from '../core/path-utils.js';
import { parseTasksFromMarkdown, ParsedTask } from '../core/task-parser.js';

/**
 * Standard hook input types based on Claude Code hooks specification
 */
export interface SessionStartInput {
  session_id: string;
  cwd: string;
}

export interface PreToolUseInput {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
}

export interface PostToolUseInput {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output?: string;
  tool_error?: string;
}

export interface StopInput {
  session_id: string;
  stop_reason: string;
}

/**
 * Pending file changes tracked during a session
 */
export interface PendingChange {
  timestamp: string;
  tool: string;
  filePath: string;
  operation: 'edit' | 'write' | 'create';
}

export interface PendingChangesFile {
  sessionId: string;
  changes: PendingChange[];
  lastUpdated: string;
}

/**
 * Check if the current directory is a spec-workflow project
 */
export async function isSpecWorkflowProject(cwd: string): Promise<boolean> {
  try {
    const workflowRoot = PathUtils.getWorkflowRoot(cwd);
    await access(workflowRoot, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the spec-workflow root directory for a project
 */
export function getWorkflowRoot(cwd: string): string {
  return PathUtils.getWorkflowRoot(cwd);
}

/**
 * Find the current active spec (in-progress tasks)
 */
export async function findActiveSpec(cwd: string): Promise<string | null> {
  const specsPath = join(PathUtils.getWorkflowRoot(cwd), 'specs');

  try {
    await access(specsPath, constants.F_OK);
    const specs = await readdir(specsPath);

    for (const specName of specs) {
      const tasksPath = join(specsPath, specName, 'tasks.md');
      try {
        const content = await readFile(tasksPath, 'utf-8');
        const result = parseTasksFromMarkdown(content);

        // If this spec has an in-progress task, it's the active spec
        if (result.inProgressTask) {
          return specName;
        }
      } catch {
        // Skip specs without tasks.md
        continue;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Get the current in-progress task from a spec
 */
export async function getInProgressTask(cwd: string, specName: string): Promise<ParsedTask | null> {
  const tasksPath = join(PathUtils.getWorkflowRoot(cwd), 'specs', specName, 'tasks.md');

  try {
    const content = await readFile(tasksPath, 'utf-8');
    const result = parseTasksFromMarkdown(content);

    if (result.inProgressTask) {
      return result.tasks.find(t => t.id === result.inProgressTask) || null;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Get all tasks from a spec
 */
export async function getSpecTasks(cwd: string, specName: string): Promise<ParsedTask[]> {
  const tasksPath = join(PathUtils.getWorkflowRoot(cwd), 'specs', specName, 'tasks.md');

  try {
    const content = await readFile(tasksPath, 'utf-8');
    const result = parseTasksFromMarkdown(content);
    return result.tasks;
  } catch {
    return [];
  }
}

/**
 * Extract restrictions from a task's prompt or structured prompt
 */
export function extractRestrictions(task: ParsedTask): string[] {
  const restrictions: string[] = [];

  // Check structured prompt first
  if (task.promptStructured) {
    for (const section of task.promptStructured) {
      if (section.key.toLowerCase() === 'restrictions') {
        restrictions.push(section.value);
      }
    }
  }

  // Fall back to parsing raw prompt
  if (restrictions.length === 0 && task.prompt) {
    const restrictionMatch = task.prompt.match(/Restrictions?:\s*([^|]+)/i);
    if (restrictionMatch) {
      restrictions.push(restrictionMatch[1].trim());
    }
  }

  return restrictions;
}

/**
 * Read hook input from stdin
 */
export async function readHookInput<T>(): Promise<T> {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf-8');

    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });

    process.stdin.on('end', () => {
      try {
        const parsed = JSON.parse(data) as T;
        resolve(parsed);
      } catch (e) {
        reject(new Error(`Failed to parse hook input: ${e}`));
      }
    });

    process.stdin.on('error', reject);
  });
}

/**
 * Output a message to the user (via stdout)
 */
export function output(message: string): void {
  console.log(message);
}

/**
 * Output an error message
 */
export function outputError(message: string): void {
  console.error(message);
}

/**
 * Exit with success (allow operation)
 */
export function exitSuccess(): never {
  process.exit(0);
}

/**
 * Exit with failure (block operation or warn)
 */
export function exitFailure(code: number = 1): never {
  process.exit(code);
}

/**
 * Get the path to the pending changes file for a spec
 */
export function getPendingChangesPath(cwd: string, specName: string): string {
  return join(PathUtils.getWorkflowRoot(cwd), 'specs', specName, 'pending-changes.json');
}

/**
 * Load pending changes from file
 */
export async function loadPendingChanges(cwd: string, specName: string): Promise<PendingChangesFile | null> {
  const path = getPendingChangesPath(cwd, specName);

  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as PendingChangesFile;
  } catch {
    return null;
  }
}

/**
 * Check if a file path violates any restrictions
 */
export function checkPathViolatesRestrictions(filePath: string, restrictions: string[]): string | null {
  const normalizedPath = resolve(filePath);

  for (const restriction of restrictions) {
    // Check for various restriction patterns
    const lowerRestriction = restriction.toLowerCase();

    // "Do not modify X" pattern
    const doNotModifyMatch = lowerRestriction.match(/do\s+not\s+(modify|edit|change|touch)\s+(.+)/i);
    if (doNotModifyMatch) {
      const forbiddenPattern = doNotModifyMatch[2].trim();
      if (pathMatchesPattern(normalizedPath, forbiddenPattern)) {
        return `Restriction violated: "${restriction}"`;
      }
    }

    // "Only modify X" pattern
    const onlyModifyMatch = lowerRestriction.match(/only\s+(modify|edit|change)\s+(.+)/i);
    if (onlyModifyMatch) {
      const allowedPattern = onlyModifyMatch[2].trim();
      if (!pathMatchesPattern(normalizedPath, allowedPattern)) {
        return `Restriction violated: "${restriction}" - this file is not in the allowed scope`;
      }
    }

    // "Avoid X" pattern
    const avoidMatch = lowerRestriction.match(/avoid\s+(.+)/i);
    if (avoidMatch) {
      const avoidPattern = avoidMatch[1].trim();
      if (pathMatchesPattern(normalizedPath, avoidPattern)) {
        return `Restriction violated: "${restriction}"`;
      }
    }
  }

  return null;
}

/**
 * Check if a path matches a pattern (simple glob-like matching)
 */
function pathMatchesPattern(filePath: string, pattern: string): boolean {
  const normalizedPath = filePath.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();

  // Remove quotes and extra whitespace
  const cleanPattern = normalizedPattern.replace(/['"]/g, '').trim();

  // Check for directory patterns (e.g., "src/tests", "node_modules")
  if (normalizedPath.includes(cleanPattern)) {
    return true;
  }

  // Check for file extension patterns (e.g., "*.test.ts", ".md files")
  const extMatch = cleanPattern.match(/\*?\.(\w+)(\s+files?)?/);
  if (extMatch) {
    const extension = '.' + extMatch[1];
    if (normalizedPath.endsWith(extension)) {
      return true;
    }
  }

  // Check for specific file names
  if (normalizedPath.endsWith('/' + cleanPattern) || normalizedPath === cleanPattern) {
    return true;
  }

  return false;
}

/**
 * Format context output for Claude
 */
export function formatContextOutput(data: {
  specName?: string;
  taskId?: string;
  taskDescription?: string;
  promptGuidance?: string[];
  restrictions?: string[];
}): string {
  const lines: string[] = [];

  lines.push('=== Spec Workflow Context ===');

  if (data.specName) {
    lines.push(`Active Spec: ${data.specName}`);
  }

  if (data.taskId && data.taskDescription) {
    lines.push(`Current Task: ${data.taskId} - ${data.taskDescription}`);
  }

  if (data.promptGuidance && data.promptGuidance.length > 0) {
    lines.push('');
    lines.push('Guidance:');
    for (const guidance of data.promptGuidance) {
      lines.push(`  - ${guidance}`);
    }
  }

  if (data.restrictions && data.restrictions.length > 0) {
    lines.push('');
    lines.push('Restrictions:');
    for (const restriction of data.restrictions) {
      lines.push(`  - ${restriction}`);
    }
  }

  lines.push('=============================');

  return lines.join('\n');
}

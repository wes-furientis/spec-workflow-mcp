/**
 * Tasks Document Validator
 * Extends core task-validator with semantic quality checks
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { validateTasksMarkdown } from '../core/task-validator.js';
import { parseTasksFromMarkdown, ParsedTask } from '../core/task-parser.js';
import {
  ValidationCheck,
  ValidationOptions,
  DocumentValidationResult,
  PhaseValidationResult,
  passCheck,
  failCheck,
  calculateSummary,
} from './types.js';

/**
 * Check if tasks document exists
 */
function checkDocumentExists(
  projectPath: string,
  specName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'tasks.md');

  if (existsSync(docPath)) {
    return passCheck('tasks-exists', 'Tasks document exists');
  }

  return failCheck(
    'tasks-exists',
    'Tasks document exists',
    `tasks.md not found for spec '${specName}'`,
    'error',
    `Create tasks.md in .spec-workflow/specs/${specName}/`
  );
}

/**
 * Run core format validation
 */
function checkCoreFormat(
  projectPath: string,
  specName: string
): ValidationCheck[] {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'tasks.md');

  if (!existsSync(docPath)) {
    return [];
  }

  const content = readFileSync(docPath, 'utf-8');
  const result = validateTasksMarkdown(content);

  const checks: ValidationCheck[] = [];

  // Convert core validation errors to our format
  for (const error of result.errors) {
    checks.push(failCheck(
      `format-${error.field}`,
      `Task format: ${error.field}`,
      error.message,
      'error',
      error.suggestion,
      `specs/${specName}/tasks.md`,
      error.line
    ));
  }

  // Convert warnings
  for (const warning of result.warnings) {
    checks.push(failCheck(
      `format-${warning.field}`,
      `Task format: ${warning.field}`,
      warning.message,
      'warning',
      warning.suggestion,
      `specs/${specName}/tasks.md`,
      warning.line
    ));
  }

  // If no errors, add a pass check
  if (result.errors.length === 0) {
    checks.push(passCheck(
      'format-valid',
      `All ${result.summary.totalTasks} tasks have valid format`
    ));
  }

  return checks;
}

/**
 * Check if all tasks have _Prompt with required sections
 */
function checkPromptQuality(
  projectPath: string,
  specName: string
): ValidationCheck[] {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'tasks.md');

  if (!existsSync(docPath)) {
    return [];
  }

  const content = readFileSync(docPath, 'utf-8');
  const parsed = parseTasksFromMarkdown(content);
  const checks: ValidationCheck[] = [];

  const implementableTasks = parsed.tasks.filter(t => !t.isHeader);
  const tasksWithPrompt = implementableTasks.filter(t => t.prompt);
  const tasksWithStructuredPrompt = implementableTasks.filter(t => t.promptStructured && t.promptStructured.length > 0);

  // Check that all implementable tasks have _Prompt
  if (tasksWithPrompt.length < implementableTasks.length) {
    const missingCount = implementableTasks.length - tasksWithPrompt.length;
    checks.push(failCheck(
      'prompt-exists-all',
      'All implementable tasks have _Prompt field',
      `${missingCount} tasks missing _Prompt field`,
      'error',
      'Add _Prompt: Role: ... | Task: ... | Restrictions: ... | Success: ..._ to each task'
    ));
  } else if (implementableTasks.length > 0) {
    checks.push(passCheck(
      'prompt-exists-all',
      'All implementable tasks have _Prompt field'
    ));
  }

  // Check _Prompt structure quality
  const requiredSections = ['Role', 'Task', 'Restrictions', 'Success'];

  for (const task of tasksWithStructuredPrompt) {
    const sections = task.promptStructured || [];
    const sectionNames = sections.map(s => s.key);

    for (const required of requiredSections) {
      if (!sectionNames.includes(required)) {
        checks.push(failCheck(
          `prompt-section-${task.id}`,
          `Task ${task.id} _Prompt has ${required} section`,
          `Missing ${required} section in _Prompt`,
          'warning',
          `Add "${required}: ..." to the _Prompt field`,
          `specs/${specName}/tasks.md`,
          task.lineNumber + 1
        ));
      }
    }

    // Check if Role is specific (not generic)
    const roleSection = sections.find(s => s.key === 'Role');
    if (roleSection) {
      const genericRoles = ['developer', 'engineer', 'programmer', 'coder'];
      const roleValue = roleSection.value.toLowerCase();
      if (genericRoles.some(r => roleValue === r)) {
        checks.push(failCheck(
          `prompt-role-specific-${task.id}`,
          `Task ${task.id} has specific Role`,
          `Role "${roleSection.value}" is too generic`,
          'warning',
          'Use specific roles like "TypeScript API Developer" or "React Component Developer"'
        ));
      }
    }

    // Check if Task references files
    const taskSection = sections.find(s => s.key === 'Task');
    if (taskSection) {
      const hasFileRef = /src\/|\.ts|\.tsx|\.js|\.py|\.go/.test(taskSection.value);
      if (!hasFileRef) {
        checks.push(failCheck(
          `prompt-task-files-${task.id}`,
          `Task ${task.id} references specific files`,
          'Task description does not reference specific file paths',
          'warning',
          'Include file paths like "in src/components/..." in the Task description'
        ));
      }
    }
  }

  return checks;
}

/**
 * Check if _Leverage files exist
 */
function checkLeverageFilesExist(
  projectPath: string,
  specName: string
): ValidationCheck[] {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'tasks.md');

  if (!existsSync(docPath)) {
    return [];
  }

  const content = readFileSync(docPath, 'utf-8');
  const parsed = parseTasksFromMarkdown(content);
  const checks: ValidationCheck[] = [];

  const tasksWithLeverage = parsed.tasks.filter(t => t.leverage);
  let missingCount = 0;
  const missingFiles: string[] = [];

  for (const task of tasksWithLeverage) {
    const leverageFiles = task.leverage!.split(',').map(f => f.trim());

    for (const file of leverageFiles) {
      if (!file) continue;

      const filePath = join(projectPath, file);
      if (!existsSync(filePath)) {
        missingCount++;
        if (missingFiles.length < 5) {
          missingFiles.push(`${task.id}: ${file}`);
        }
      }
    }
  }

  if (missingCount > 0) {
    checks.push(failCheck(
      'leverage-files-exist',
      '_Leverage files exist in codebase',
      `${missingCount} _Leverage files not found: ${missingFiles.join(', ')}${missingCount > 5 ? '...' : ''}`,
      'warning',
      'Verify file paths in _Leverage fields or update if files were moved'
    ));
  } else if (tasksWithLeverage.length > 0) {
    checks.push(passCheck(
      'leverage-files-exist',
      `All ${tasksWithLeverage.length} _Leverage references point to existing files`
    ));
  }

  return checks;
}

/**
 * Check if _Requirements map to actual requirements
 */
function checkRequirementsMapping(
  projectPath: string,
  specName: string
): ValidationCheck[] {
  const tasksPath = join(projectPath, '.spec-workflow', 'specs', specName, 'tasks.md');
  const reqPath = join(projectPath, '.spec-workflow', 'specs', specName, 'requirements.md');

  if (!existsSync(tasksPath)) {
    return [];
  }

  const tasksContent = readFileSync(tasksPath, 'utf-8');
  const parsed = parseTasksFromMarkdown(tasksContent);
  const checks: ValidationCheck[] = [];

  const tasksWithReqs = parsed.tasks.filter(t => t.requirements && t.requirements.length > 0);

  if (tasksWithReqs.length === 0 && parsed.tasks.filter(t => !t.isHeader).length > 0) {
    checks.push(failCheck(
      'requirements-mapping-exists',
      'Tasks have _Requirements traceability',
      'No tasks have _Requirements fields',
      'warning',
      'Add _Requirements: 1.1, 1.2_ to tasks to trace back to requirements'
    ));
    return checks;
  }

  // If requirements.md exists, validate the mappings
  if (existsSync(reqPath)) {
    const reqContent = readFileSync(reqPath, 'utf-8');

    // Extract requirement numbers from requirements.md
    const reqPattern = /(?:requirement|req)?\s*(\d+(?:\.\d+)*)/gi;
    const validReqNumbers = new Set<string>();
    let match;
    while ((match = reqPattern.exec(reqContent)) !== null) {
      validReqNumbers.add(match[1]);
    }

    // Check that task requirements are valid
    for (const task of tasksWithReqs) {
      for (const req of task.requirements!) {
        if (!validReqNumbers.has(req) && req !== 'NFR') {
          checks.push(failCheck(
            `requirements-mapping-${task.id}`,
            `Task ${task.id} _Requirements are valid`,
            `Requirement "${req}" not found in requirements.md`,
            'warning',
            'Verify requirement number exists in requirements.md'
          ));
        }
      }
    }
  }

  if (tasksWithReqs.length > 0 && checks.length === 0) {
    checks.push(passCheck(
      'requirements-mapping-valid',
      `${tasksWithReqs.length} tasks have valid _Requirements mappings`
    ));
  }

  return checks;
}

/**
 * Check if tasks decompose all design components
 */
function checkDesignCoverage(
  projectPath: string,
  specName: string
): ValidationCheck {
  const tasksPath = join(projectPath, '.spec-workflow', 'specs', specName, 'tasks.md');
  const designPath = join(projectPath, '.spec-workflow', 'specs', specName, 'design.md');

  if (!existsSync(tasksPath) || !existsSync(designPath)) {
    return passCheck(
      'design-coverage',
      'Tasks decompose design (no design.md to compare)'
    );
  }

  const tasksContent = readFileSync(tasksPath, 'utf-8').toLowerCase();
  const designContent = readFileSync(designPath, 'utf-8');

  // Extract component/file references from design
  const componentPattern = /(?:component|module|class|interface|function)\s+[`*]*(\w+)[`*]*/gi;
  const designComponents = new Set<string>();
  let match;
  while ((match = componentPattern.exec(designContent)) !== null) {
    if (match[1].length > 2) { // Skip very short names
      designComponents.add(match[1].toLowerCase());
    }
  }

  // Check how many design components are mentioned in tasks
  let coveredCount = 0;
  for (const component of designComponents) {
    if (tasksContent.includes(component)) {
      coveredCount++;
    }
  }

  const totalComponents = designComponents.size;
  const coveragePercent = totalComponents > 0
    ? Math.round((coveredCount / totalComponents) * 100)
    : 100;

  if (totalComponents > 5 && coveragePercent < 50) {
    return failCheck(
      'design-coverage',
      'Tasks decompose design components',
      `Only ${coveragePercent}% of design components covered in tasks (${coveredCount}/${totalComponents})`,
      'warning',
      'Ensure tasks cover all components defined in design.md'
    );
  }

  return passCheck(
    'design-coverage',
    `Tasks cover ${coveragePercent}% of design components`
  );
}

/**
 * Check task count and complexity
 */
function checkTaskCount(
  projectPath: string,
  specName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'tasks.md');

  if (!existsSync(docPath)) {
    return failCheck(
      'task-count',
      'Tasks document has appropriate task count',
      'tasks.md does not exist',
      'error'
    );
  }

  const content = readFileSync(docPath, 'utf-8');
  const parsed = parseTasksFromMarkdown(content);

  const implementableTasks = parsed.tasks.filter(t => !t.isHeader);

  if (implementableTasks.length === 0) {
    return failCheck(
      'task-count',
      'Tasks document has implementable tasks',
      'No implementable tasks found (all are headers)',
      'error',
      'Add specific tasks with implementation details under header tasks'
    );
  }

  if (implementableTasks.length < 3) {
    return failCheck(
      'task-count',
      'Tasks document has appropriate task count',
      `Only ${implementableTasks.length} implementable tasks - may indicate under-decomposition`,
      'warning',
      'Break down tasks further for better tracking and autonomous execution'
    );
  }

  return passCheck(
    'task-count',
    `${implementableTasks.length} implementable tasks defined`
  );
}

/**
 * Validate tasks document
 */
export async function validateTasks(
  options: ValidationOptions
): Promise<PhaseValidationResult> {
  const { projectPath, specName } = options;
  const timestamp = new Date().toISOString();

  if (!specName) {
    return {
      phase: 'tasks',
      valid: false,
      timestamp,
      checks: [failCheck(
        'spec-name-required',
        'Spec name is provided',
        'specName is required for tasks validation',
        'error'
      )],
      documents: [],
      summary: { totalChecks: 1, passedChecks: 0, failedChecks: 1, errors: 1, warnings: 0 },
    };
  }

  const allChecks: ValidationCheck[] = [];
  const docPath = `specs/${specName}/tasks.md`;

  // Run all validation checks
  allChecks.push(checkDocumentExists(projectPath, specName));

  const fullPath = join(projectPath, '.spec-workflow', 'specs', specName, 'tasks.md');
  if (existsSync(fullPath)) {
    allChecks.push(...checkCoreFormat(projectPath, specName));
    allChecks.push(...checkPromptQuality(projectPath, specName));
    allChecks.push(...checkLeverageFilesExist(projectPath, specName));
    allChecks.push(...checkRequirementsMapping(projectPath, specName));
    allChecks.push(checkDesignCoverage(projectPath, specName));
    allChecks.push(checkTaskCount(projectPath, specName));
  }

  const document: DocumentValidationResult = {
    document: docPath,
    exists: existsSync(fullPath),
    checks: allChecks,
    valid: !allChecks.some(c => !c.passed && c.severity === 'error'),
  };

  return {
    phase: 'tasks',
    specName,
    valid: document.valid,
    timestamp,
    checks: allChecks,
    documents: [document],
    summary: calculateSummary(allChecks),
  };
}

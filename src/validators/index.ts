/**
 * Validators Index
 * Export all phase validators
 */

export * from './types.js';
export { validateSteering } from './steering-validator.js';
export { validateRequirements } from './requirements-validator.js';
export { validateDesign } from './design-validator.js';
export { validateTasks } from './tasks-validator.js';

import { ValidationOptions, PhaseValidationResult } from './types.js';
import { validateSteering } from './steering-validator.js';
import { validateRequirements } from './requirements-validator.js';
import { validateDesign } from './design-validator.js';
import { validateTasks } from './tasks-validator.js';

/**
 * Validate a phase by name
 */
export async function validatePhase(
  phase: 'steering' | 'requirements' | 'design' | 'tasks',
  options: ValidationOptions
): Promise<PhaseValidationResult> {
  switch (phase) {
    case 'steering':
      return validateSteering(options);
    case 'requirements':
      return validateRequirements(options);
    case 'design':
      return validateDesign(options);
    case 'tasks':
      return validateTasks(options);
    default:
      throw new Error(`Unknown phase: ${phase}`);
  }
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: PhaseValidationResult): string[] {
  const lines: string[] = [];

  lines.push(`## ${result.phase.toUpperCase()} Validation`);
  if (result.specName) {
    lines.push(`Spec: ${result.specName}`);
  }
  if (result.archetype) {
    lines.push(`Archetype: ${result.archetype}`);
  }
  lines.push(`Status: ${result.valid ? '✅ PASSED' : '❌ FAILED'}`);
  lines.push('');

  // Summary
  lines.push(`### Summary`);
  lines.push(`- Total checks: ${result.summary.totalChecks}`);
  lines.push(`- Passed: ${result.summary.passedChecks}`);
  lines.push(`- Failed: ${result.summary.failedChecks}`);
  lines.push(`- Errors: ${result.summary.errors}`);
  lines.push(`- Warnings: ${result.summary.warnings}`);
  lines.push('');

  // Errors
  const errors = result.checks.filter(c => !c.passed && c.severity === 'error');
  if (errors.length > 0) {
    lines.push(`### Errors (${errors.length})`);
    for (const check of errors) {
      lines.push(`- ❌ **${check.name}**: ${check.message}`);
      if (check.suggestion) {
        lines.push(`  - 💡 ${check.suggestion}`);
      }
      if (check.file) {
        lines.push(`  - 📁 ${check.file}${check.line ? `:${check.line}` : ''}`);
      }
    }
    lines.push('');
  }

  // Warnings
  const warnings = result.checks.filter(c => !c.passed && c.severity === 'warning');
  if (warnings.length > 0) {
    lines.push(`### Warnings (${warnings.length})`);
    for (const check of warnings) {
      lines.push(`- ⚠️ **${check.name}**: ${check.message}`);
      if (check.suggestion) {
        lines.push(`  - 💡 ${check.suggestion}`);
      }
    }
    lines.push('');
  }

  // Passed checks (summary only)
  const passed = result.checks.filter(c => c.passed);
  if (passed.length > 0) {
    lines.push(`### Passed Checks (${passed.length})`);
    for (const check of passed) {
      lines.push(`- ✅ ${check.description}`);
    }
  }

  return lines;
}

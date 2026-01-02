/**
 * Validator Types for spec-workflow-mcp
 * Common interfaces used across all phase validators
 */

/**
 * Single validation check result
 */
export interface ValidationCheck {
  /** Unique identifier for this check */
  name: string;
  /** Human-readable description of what was checked */
  description: string;
  /** Whether the check passed */
  passed: boolean;
  /** Severity: error blocks approval, warning allows with notice */
  severity: 'error' | 'warning';
  /** Detailed message if check failed */
  message?: string;
  /** Suggestion for how to fix */
  suggestion?: string;
  /** File path if check relates to a specific file */
  file?: string;
  /** Line number if applicable */
  line?: number;
}

/**
 * Result of validating a single document
 */
export interface DocumentValidationResult {
  /** Document path relative to project */
  document: string;
  /** Document exists */
  exists: boolean;
  /** All checks for this document */
  checks: ValidationCheck[];
  /** Overall document validity (no errors) */
  valid: boolean;
}

/**
 * Result of validating a phase
 */
export interface PhaseValidationResult {
  /** Phase that was validated */
  phase: 'steering' | 'requirements' | 'design' | 'tasks';
  /** Spec name (not used for steering) */
  specName?: string;
  /** Archetype used for validation */
  archetype?: string;
  /** Overall validity (all documents valid, no errors) */
  valid: boolean;
  /** Timestamp of validation */
  timestamp: string;
  /** All checks across all documents */
  checks: ValidationCheck[];
  /** Per-document results */
  documents: DocumentValidationResult[];
  /** Summary statistics */
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    errors: number;
    warnings: number;
  };
}

/**
 * Options for running validation
 */
export interface ValidationOptions {
  /** Project root path */
  projectPath: string;
  /** Spec name (required for requirements, design, tasks) */
  specName?: string;
  /** Run in fix mode - attempt automatic corrections */
  fixMode?: boolean;
  /** Specific checks to run (default: all) */
  checks?: string[];
  /** Skip specific checks */
  skipChecks?: string[];
}

/**
 * Validator function signature
 */
export type ValidatorFunction = (
  content: string,
  options: ValidationOptions
) => ValidationCheck[] | Promise<ValidationCheck[]>;

/**
 * Document validator definition
 */
export interface DocumentValidator {
  /** Document name (e.g., "product", "requirements") */
  name: string;
  /** Path to document relative to .spec-workflow */
  getPath: (specName?: string) => string;
  /** Validation functions to run */
  validators: ValidatorFunction[];
}

/**
 * Phase validator definition
 */
export interface PhaseValidator {
  /** Phase name */
  phase: 'steering' | 'requirements' | 'design' | 'tasks';
  /** Documents to validate for this phase */
  documents: DocumentValidator[];
  /** Cross-document validation (runs after individual docs) */
  crossValidators?: ValidatorFunction[];
}

/**
 * Helper to create a passing check
 */
export function passCheck(
  name: string,
  description: string,
  severity: 'error' | 'warning' = 'error'
): ValidationCheck {
  return {
    name,
    description,
    passed: true,
    severity,
  };
}

/**
 * Helper to create a failing check
 */
export function failCheck(
  name: string,
  description: string,
  message: string,
  severity: 'error' | 'warning' = 'error',
  suggestion?: string,
  file?: string,
  line?: number
): ValidationCheck {
  return {
    name,
    description,
    passed: false,
    severity,
    message,
    suggestion,
    file,
    line,
  };
}

/**
 * Calculate summary from checks
 */
export function calculateSummary(checks: ValidationCheck[]): PhaseValidationResult['summary'] {
  const errors = checks.filter(c => !c.passed && c.severity === 'error');
  const warnings = checks.filter(c => !c.passed && c.severity === 'warning');

  return {
    totalChecks: checks.length,
    passedChecks: checks.filter(c => c.passed).length,
    failedChecks: checks.filter(c => !c.passed).length,
    errors: errors.length,
    warnings: warnings.length,
  };
}

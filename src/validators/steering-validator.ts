/**
 * Steering Document Validator
 * Validates steering documents based on the project's archetype
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import archetypeRegistry from '../archetypes/archetype-registry.js';
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
 * Get the current archetype for a project
 */
async function getProjectArchetype(projectPath: string): Promise<string> {
  const configPath = join(projectPath, '.spec-workflow', 'config.json');

  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      return config.archetype || 'generic';
    } catch {
      return 'generic';
    }
  }

  return 'generic';
}

/**
 * Check if steering document exists
 */
function checkDocumentExists(
  projectPath: string,
  docName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'steering', `${docName}.md`);

  if (existsSync(docPath)) {
    return passCheck(
      `${docName}-exists`,
      `Steering document '${docName}.md' exists`
    );
  }

  return failCheck(
    `${docName}-exists`,
    `Steering document '${docName}.md' exists`,
    `Required steering document '${docName}.md' not found`,
    'error',
    `Create ${docName}.md in .spec-workflow/steering/`,
    `steering/${docName}.md`
  );
}

/**
 * Check if document has meaningful content (not just template placeholders)
 */
function checkDocumentHasContent(
  projectPath: string,
  docName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'steering', `${docName}.md`);

  if (!existsSync(docPath)) {
    return failCheck(
      `${docName}-has-content`,
      `Steering document '${docName}.md' has content`,
      'Document does not exist',
      'error'
    );
  }

  const content = readFileSync(docPath, 'utf-8');

  // Check for common placeholder patterns
  const placeholderPatterns = [
    /\[.*?\]/g,  // [placeholder text]
    /TODO:/gi,
    /FIXME:/gi,
    /TBD/gi,
    /<.*?>/g,    // <placeholder>
  ];

  // Count actual content lines (non-empty, non-heading, non-placeholder)
  const lines = content.split('\n');
  let contentLines = 0;
  let placeholderCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('---')) continue;

    // Check for placeholders
    for (const pattern of placeholderPatterns) {
      const matches = trimmed.match(pattern);
      if (matches) {
        placeholderCount += matches.length;
      }
    }

    contentLines++;
  }

  if (contentLines < 5) {
    return failCheck(
      `${docName}-has-content`,
      `Steering document '${docName}.md' has meaningful content`,
      `Document has only ${contentLines} content lines`,
      'error',
      'Add more content to the steering document',
      `steering/${docName}.md`
    );
  }

  if (placeholderCount > 5) {
    return failCheck(
      `${docName}-has-content`,
      `Steering document '${docName}.md' has meaningful content`,
      `Document contains ${placeholderCount} placeholder patterns ([...], TODO, etc.)`,
      'warning',
      'Replace placeholder text with actual content',
      `steering/${docName}.md`
    );
  }

  return passCheck(
    `${docName}-has-content`,
    `Steering document '${docName}.md' has meaningful content`
  );
}

/**
 * Check if goals/objectives are specific and measurable
 */
function checkGoalsSpecific(
  projectPath: string,
  docName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'steering', `${docName}.md`);

  if (!existsSync(docPath)) {
    return failCheck(
      `${docName}-goals-specific`,
      `Goals in '${docName}.md' are specific and measurable`,
      'Document does not exist',
      'error'
    );
  }

  const content = readFileSync(docPath, 'utf-8').toLowerCase();

  // Vague terms that indicate non-specific goals
  const vagueTerms = [
    'improve',
    'enhance',
    'better',
    'good',
    'nice',
    'great',
    'optimize',
    'streamline',
  ];

  const foundVagueTerms: string[] = [];
  for (const term of vagueTerms) {
    // Check if term appears in context of goals/objectives
    const patterns = [
      new RegExp(`goal.*${term}`, 'gi'),
      new RegExp(`objective.*${term}`, 'gi'),
      new RegExp(`${term}.*goal`, 'gi'),
      new RegExp(`${term}.*objective`, 'gi'),
    ];

    for (const pattern of patterns) {
      if (content.match(pattern)) {
        foundVagueTerms.push(term);
        break;
      }
    }
  }

  // Check for measurable indicators
  const measurablePatterns = [
    /\d+%/,           // percentages
    /\d+\s*(ms|seconds|minutes|hours|days)/i,  // time measurements
    /\d+\s*(users|requests|transactions)/i,    // quantity
    /within\s+\d+/i,  // deadlines
    /by\s+\d{4}/i,    // date targets
    /reduce.*by\s+\d+/i,
    /increase.*by\s+\d+/i,
  ];

  let hasMeasurableGoals = false;
  for (const pattern of measurablePatterns) {
    if (content.match(pattern)) {
      hasMeasurableGoals = true;
      break;
    }
  }

  if (foundVagueTerms.length > 2) {
    return failCheck(
      `${docName}-goals-specific`,
      `Goals in '${docName}.md' are specific and measurable`,
      `Found vague terms: ${foundVagueTerms.join(', ')}`,
      'warning',
      'Replace vague terms with specific, measurable outcomes',
      `steering/${docName}.md`
    );
  }

  if (!hasMeasurableGoals && (docName === 'product' || content.includes('goal') || content.includes('objective'))) {
    return failCheck(
      `${docName}-goals-specific`,
      `Goals in '${docName}.md' are specific and measurable`,
      'No measurable goals found (numbers, percentages, timeframes)',
      'warning',
      'Add specific metrics like "reduce load time by 50%" or "support 1000 concurrent users"',
      `steering/${docName}.md`
    );
  }

  return passCheck(
    `${docName}-goals-specific`,
    `Goals in '${docName}.md' are specific and measurable`
  );
}

/**
 * Check if tech decisions have rationale
 */
function checkTechRationale(projectPath: string): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'steering', 'tech.md');

  if (!existsSync(docPath)) {
    return failCheck(
      'tech-rationale',
      'Technology decisions include rationale',
      'tech.md does not exist',
      'error'
    );
  }

  const content = readFileSync(docPath, 'utf-8').toLowerCase();

  // Check for rationale indicators
  const rationalePatterns = [
    /because/i,
    /reason/i,
    /rationale/i,
    /why/i,
    /chose.*for/i,
    /selected.*due to/i,
    /benefits/i,
    /advantages/i,
    /trade-?off/i,
  ];

  let hasRationale = false;
  for (const pattern of rationalePatterns) {
    if (content.match(pattern)) {
      hasRationale = true;
      break;
    }
  }

  if (!hasRationale) {
    return failCheck(
      'tech-rationale',
      'Technology decisions include rationale',
      'No rationale found for technology choices',
      'warning',
      'Add explanations for why each technology was chosen',
      'steering/tech.md'
    );
  }

  return passCheck(
    'tech-rationale',
    'Technology decisions include rationale'
  );
}

/**
 * Check if structure matches actual project layout
 */
async function checkStructureMatchesProject(
  projectPath: string
): Promise<ValidationCheck> {
  const docPath = join(projectPath, '.spec-workflow', 'steering', 'structure.md');

  if (!existsSync(docPath)) {
    return failCheck(
      'structure-matches-project',
      'Structure document matches actual project layout',
      'structure.md does not exist',
      'error'
    );
  }

  const content = readFileSync(docPath, 'utf-8');

  // Extract directory references from structure.md
  const dirPatterns = [
    /`(src\/[^`]+)`/g,
    /`(lib\/[^`]+)`/g,
    /`(test\/[^`]+)`/g,
    /`(tests\/[^`]+)`/g,
    /`(\.\/[^`]+)`/g,
  ];

  const referencedDirs: string[] = [];
  for (const pattern of dirPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      referencedDirs.push(match[1].replace(/\/$/, ''));
    }
  }

  // Check if referenced directories exist
  const missingDirs: string[] = [];
  for (const dir of referencedDirs.slice(0, 10)) { // Check first 10 to avoid excessive I/O
    const dirPath = join(projectPath, dir);
    if (!existsSync(dirPath)) {
      missingDirs.push(dir);
    }
  }

  if (missingDirs.length > 0) {
    return failCheck(
      'structure-matches-project',
      'Structure document matches actual project layout',
      `Referenced directories not found: ${missingDirs.join(', ')}`,
      'warning',
      'Update structure.md to match actual project layout or create the documented directories',
      'steering/structure.md'
    );
  }

  return passCheck(
    'structure-matches-project',
    'Structure document matches actual project layout'
  );
}

/**
 * Validate a single steering document
 */
async function validateSteeringDocument(
  projectPath: string,
  docName: string
): Promise<DocumentValidationResult> {
  const docPath = `steering/${docName}.md`;
  const checks: ValidationCheck[] = [];

  // Check existence
  checks.push(checkDocumentExists(projectPath, docName));

  // If document exists, run content checks
  const fullPath = join(projectPath, '.spec-workflow', 'steering', `${docName}.md`);
  if (existsSync(fullPath)) {
    checks.push(checkDocumentHasContent(projectPath, docName));

    // Document-specific checks
    if (docName === 'product') {
      checks.push(checkGoalsSpecific(projectPath, docName));
    }

    if (docName === 'tech') {
      checks.push(checkTechRationale(projectPath));
    }

    if (docName === 'structure') {
      checks.push(await checkStructureMatchesProject(projectPath));
    }
  }

  return {
    document: docPath,
    exists: existsSync(fullPath),
    checks,
    valid: !checks.some(c => !c.passed && c.severity === 'error'),
  };
}

/**
 * Validate all steering documents for a project
 */
export async function validateSteering(
  options: ValidationOptions
): Promise<PhaseValidationResult> {
  const { projectPath } = options;
  const timestamp = new Date().toISOString();

  // Get archetype and its steering requirements
  const archetype = await getProjectArchetype(projectPath);
  const steeringConfig = await archetypeRegistry.getSteeringDocsForProject(archetype, projectPath);

  const allChecks: ValidationCheck[] = [];
  const documents: DocumentValidationResult[] = [];

  // Validate required steering documents
  for (const docName of steeringConfig.required) {
    const result = await validateSteeringDocument(projectPath, docName);
    documents.push(result);
    allChecks.push(...result.checks);
  }

  // Validate custom steering documents
  for (const customDoc of steeringConfig.custom) {
    const result = await validateSteeringDocument(projectPath, customDoc.name);
    documents.push(result);
    allChecks.push(...result.checks);
  }

  // Optionally validate optional steering documents if they exist
  for (const docName of steeringConfig.optional) {
    const docPath = join(projectPath, '.spec-workflow', 'steering', `${docName}.md`);
    if (existsSync(docPath)) {
      const result = await validateSteeringDocument(projectPath, docName);
      documents.push(result);
      allChecks.push(...result.checks);
    }
  }

  return {
    phase: 'steering',
    archetype,
    valid: !allChecks.some(c => !c.passed && c.severity === 'error'),
    timestamp,
    checks: allChecks,
    documents,
    summary: calculateSummary(allChecks),
  };
}

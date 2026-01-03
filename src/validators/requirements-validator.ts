/**
 * Requirements Document Validator
 * Validates requirements.md against steering documents and quality criteria
 *
 * ARCHETYPE-AWARE: Dynamically checks for references to the project's
 * actual steering documents, not hardcoded defaults.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import archetypeRegistry from '../archetypes/archetype-registry.js';
import {
  extractAllSteeringContent,
  generateCoverageReport,
  CoverageReport,
  SteeringContentItem,
} from './steering-content-extractor.js';
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
 * Check if requirements document exists
 */
function checkDocumentExists(
  projectPath: string,
  specName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'requirements.md');

  if (existsSync(docPath)) {
    return passCheck(
      'requirements-exists',
      'Requirements document exists'
    );
  }

  return failCheck(
    'requirements-exists',
    'Requirements document exists',
    `requirements.md not found for spec '${specName}'`,
    'error',
    `Create requirements.md in .spec-workflow/specs/${specName}/`
  );
}

/**
 * Check if requirements have user stories in correct format
 */
function checkUserStoryFormat(
  projectPath: string,
  specName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'requirements.md');

  if (!existsSync(docPath)) {
    return failCheck(
      'user-story-format',
      'Requirements include properly formatted user stories',
      'requirements.md does not exist',
      'error'
    );
  }

  const content = readFileSync(docPath, 'utf-8');

  // Check for user story format: "As a [role], I want [feature], so that [benefit]"
  const userStoryPattern = /as\s+a[n]?\s+.+,?\s+i\s+want\s+.+,?\s+so\s+that\s+/gi;
  const matches = content.match(userStoryPattern);

  if (!matches || matches.length === 0) {
    return failCheck(
      'user-story-format',
      'Requirements include properly formatted user stories',
      'No user stories found in standard format',
      'warning',
      'Add user stories in format: "As a [role], I want [feature], so that [benefit]"'
    );
  }

  return passCheck(
    'user-story-format',
    `Requirements include ${matches.length} properly formatted user stories`
  );
}

/**
 * Check if acceptance criteria are in WHEN/THEN format
 */
function checkAcceptanceCriteriaFormat(
  projectPath: string,
  specName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'requirements.md');

  if (!existsSync(docPath)) {
    return failCheck(
      'acceptance-criteria-format',
      'Acceptance criteria are in testable format',
      'requirements.md does not exist',
      'error'
    );
  }

  const content = readFileSync(docPath, 'utf-8');

  // Check for WHEN/THEN or GIVEN/WHEN/THEN format
  const criteriaPatterns = [
    /when\s+.+\s*,?\s*then\s+/gi,
    /given\s+.+\s*,?\s*when\s+.+\s*,?\s*then\s+/gi,
    /if\s+.+\s*,?\s*then\s+/gi,
  ];

  let totalMatches = 0;
  for (const pattern of criteriaPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      totalMatches += matches.length;
    }
  }

  // Also check for acceptance criteria section
  const hasAcceptanceSection = /acceptance\s+criteria/i.test(content);

  if (totalMatches < 3 && hasAcceptanceSection) {
    return failCheck(
      'acceptance-criteria-format',
      'Acceptance criteria are in testable format',
      `Only ${totalMatches} testable criteria found`,
      'warning',
      'Add acceptance criteria in WHEN/THEN format: "WHEN [action], THEN [expected result]"'
    );
  }

  if (!hasAcceptanceSection) {
    return failCheck(
      'acceptance-criteria-format',
      'Acceptance criteria are in testable format',
      'No acceptance criteria section found',
      'warning',
      'Add an "Acceptance Criteria" section with WHEN/THEN statements'
    );
  }

  return passCheck(
    'acceptance-criteria-format',
    `Requirements include ${totalMatches} testable acceptance criteria`
  );
}

/**
 * Check if non-functional requirements are defined
 */
function checkNonFunctionalRequirements(
  projectPath: string,
  specName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'requirements.md');

  if (!existsSync(docPath)) {
    return failCheck(
      'nfr-defined',
      'Non-functional requirements are defined',
      'requirements.md does not exist',
      'error'
    );
  }

  const content = readFileSync(docPath, 'utf-8').toLowerCase();

  // Check for NFR categories
  const nfrCategories = [
    { name: 'performance', patterns: [/performance/i, /response\s+time/i, /latency/i, /throughput/i] },
    { name: 'security', patterns: [/security/i, /authentication/i, /authorization/i, /encryption/i] },
    { name: 'scalability', patterns: [/scalab/i, /concurrent/i, /load/i] },
    { name: 'reliability', patterns: [/reliab/i, /availability/i, /uptime/i, /fault/i] },
    { name: 'maintainability', patterns: [/maintain/i, /testab/i, /modular/i] },
  ];

  const foundCategories: string[] = [];
  for (const category of nfrCategories) {
    for (const pattern of category.patterns) {
      if (content.match(pattern)) {
        foundCategories.push(category.name);
        break;
      }
    }
  }

  // Also check for explicit NFR section
  const hasNfrSection = /non-?functional|nfr/i.test(content);

  if (foundCategories.length < 2 && !hasNfrSection) {
    return failCheck(
      'nfr-defined',
      'Non-functional requirements are defined',
      `Only ${foundCategories.length} NFR categories addressed: ${foundCategories.join(', ') || 'none'}`,
      'warning',
      'Add non-functional requirements for: performance, security, scalability, reliability'
    );
  }

  return passCheck(
    'nfr-defined',
    `Non-functional requirements defined (${foundCategories.join(', ')})`
  );
}

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
 * Check if requirements cover content from steering documents
 * ARCHETYPE-AWARE: Extracts key content from each steering doc and checks coverage
 *
 * This goes line-by-line through steering docs to find:
 * - Headers (## Section)
 * - Bullet points (- item)
 * - Numbered items (1. item)
 * - Key statements (sentences with important keywords)
 *
 * Then checks if each item is represented in requirements.
 */
async function checkSteeringCoverage(
  projectPath: string,
  specName: string
): Promise<ValidationCheck[]> {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'requirements.md');
  const steeringPath = join(projectPath, '.spec-workflow', 'steering');
  const checks: ValidationCheck[] = [];

  if (!existsSync(docPath)) {
    checks.push(failCheck(
      'steering-coverage',
      'Requirements cover steering content',
      'requirements.md does not exist',
      'error'
    ));
    return checks;
  }

  const requirementsContent = readFileSync(docPath, 'utf-8');

  // Get the project's archetype and its steering docs
  const archetype = await getProjectArchetype(projectPath);
  const steeringConfig = await archetypeRegistry.getSteeringDocsForProject(archetype, projectPath);

  // Build list of steering docs
  const allSteeringDocs = [
    ...steeringConfig.required,
    ...steeringConfig.optional,
    ...steeringConfig.custom.map(c => c.name),
  ];

  // Find which steering docs actually exist
  const existingSteeringDocs: string[] = [];
  for (const docName of allSteeringDocs) {
    if (existsSync(join(steeringPath, `${docName}.md`))) {
      existingSteeringDocs.push(docName);
    }
  }

  if (existingSteeringDocs.length === 0) {
    checks.push(passCheck(
      'steering-coverage',
      'Steering coverage (no steering docs to check against)'
    ));
    return checks;
  }

  // Extract content from all steering docs
  const extractions = extractAllSteeringContent(projectPath, existingSteeringDocs);

  if (extractions.length === 0) {
    checks.push(passCheck(
      'steering-coverage',
      'Steering coverage (no extractable content found)'
    ));
    return checks;
  }

  // Generate coverage report for each steering doc
  const reports: CoverageReport[] = [];
  let totalItems = 0;
  let totalCovered = 0;
  const allUncoveredItems: Array<{ doc: string; item: SteeringContentItem }> = [];

  for (const extraction of extractions) {
    const report = generateCoverageReport(extraction, requirementsContent, 2);
    reports.push(report);
    totalItems += report.totalItems;
    totalCovered += report.coveredItems;

    // Collect uncovered items (limit to most important)
    for (const item of report.uncoveredItems.slice(0, 5)) {
      allUncoveredItems.push({ doc: extraction.document, item });
    }
  }

  const overallCoverage = totalItems > 0
    ? Math.round((totalCovered / totalItems) * 100)
    : 100;

  // Add per-document coverage checks - ALWAYS show what's missing
  for (const report of reports) {
    if (report.totalItems === 0) continue;

    // Format uncovered items for display
    const uncoveredDisplay = report.uncoveredItems.length > 0
      ? report.uncoveredItems.slice(0, 5)
          .map(item => `"${item.content.substring(0, 60)}${item.content.length > 60 ? '...' : ''}"`)
          .join('\n    • ')
      : null;

    if (report.coveragePercent < 50) {
      // Low coverage - fail with specific gaps
      checks.push(failCheck(
        `steering-coverage-${report.source}`,
        `Requirements cover ${report.source}.md content`,
        `Only ${report.coveragePercent}% coverage (${report.coveredItems}/${report.totalItems} items)`,
        'warning',
        uncoveredDisplay
          ? `Missing from ${report.source}.md:\n    • ${uncoveredDisplay}`
          : undefined,
        `steering/${report.source}.md`
      ));
    } else if (report.uncoveredItems.length > 0) {
      // Good coverage but still show what's missing - PASS with info
      checks.push(passCheck(
        `steering-coverage-${report.source}`,
        `${report.source}.md: ${report.coveragePercent}% (${report.coveredItems}/${report.totalItems}). ` +
        `NOT COVERED (${report.uncoveredItems.length}):\n    • ${uncoveredDisplay}`
      ));
    } else {
      // 100% coverage
      checks.push(passCheck(
        `steering-coverage-${report.source}`,
        `${report.source}.md: 100% coverage (${report.totalItems}/${report.totalItems} items)`
      ));
    }
  }

  // Add overall coverage check - ALWAYS show gaps
  const overallUncoveredDisplay = allUncoveredItems.length > 0
    ? allUncoveredItems.slice(0, 8)
        .map(u => `[${u.doc}] ${u.item.content.substring(0, 50)}...`)
        .join('\n    • ')
    : null;

  if (overallCoverage < 50) {
    checks.push(failCheck(
      'steering-coverage-overall',
      'Requirements have good overall steering coverage',
      `Only ${overallCoverage}% overall coverage across steering docs`,
      'warning',
      overallUncoveredDisplay
        ? `All uncovered items:\n    • ${overallUncoveredDisplay}`
        : undefined
    ));
  } else if (allUncoveredItems.length > 0) {
    // Pass but show what's missing
    checks.push(passCheck(
      'steering-coverage-overall',
      `Overall: ${overallCoverage}% (${totalCovered}/${totalItems}). ` +
      `NOT COVERED (${allUncoveredItems.length} items):\n    • ${overallUncoveredDisplay}`
    ));
  } else {
    checks.push(passCheck(
      'steering-coverage-overall',
      `Overall steering coverage: 100% (${totalItems}/${totalItems} items)`
    ));
  }

  return checks;
}

/**
 * Check that requirements are numbered and traceable
 */
function checkRequirementsNumbered(
  projectPath: string,
  specName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'requirements.md');

  if (!existsSync(docPath)) {
    return failCheck(
      'requirements-numbered',
      'Requirements are numbered for traceability',
      'requirements.md does not exist',
      'error'
    );
  }

  const content = readFileSync(docPath, 'utf-8');

  // Check for numbered requirements patterns
  const numberPatterns = [
    /##?\s*(?:requirement\s*)?(\d+(?:\.\d+)*)/gi,  // ## Requirement 1.1 or ## 1.1
    /\*\*(?:req|requirement)?\s*(\d+(?:\.\d+)*)\*\*/gi,  // **REQ 1.1** or **1.1**
    /^-\s*\[?\d+(?:\.\d+)*\]?\s/gm,  // - 1.1 or - [1.1]
  ];

  let numberedCount = 0;
  for (const pattern of numberPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      numberedCount += matches.length;
    }
  }

  if (numberedCount < 3) {
    return failCheck(
      'requirements-numbered',
      'Requirements are numbered for traceability',
      `Only ${numberedCount} numbered requirements found`,
      'warning',
      'Number requirements like "1.1", "1.2", "2.1" for traceability to tasks'
    );
  }

  return passCheck(
    'requirements-numbered',
    `${numberedCount} numbered requirements found`
  );
}

/**
 * Validate requirements document
 */
export async function validateRequirements(
  options: ValidationOptions
): Promise<PhaseValidationResult> {
  const { projectPath, specName } = options;
  const timestamp = new Date().toISOString();

  if (!specName) {
    return {
      phase: 'requirements',
      valid: false,
      timestamp,
      checks: [failCheck(
        'spec-name-required',
        'Spec name is provided',
        'specName is required for requirements validation',
        'error'
      )],
      documents: [],
      summary: { totalChecks: 1, passedChecks: 0, failedChecks: 1, errors: 1, warnings: 0 },
    };
  }

  const allChecks: ValidationCheck[] = [];
  const docPath = `specs/${specName}/requirements.md`;

  // Run all validation checks
  allChecks.push(checkDocumentExists(projectPath, specName));

  const fullPath = join(projectPath, '.spec-workflow', 'specs', specName, 'requirements.md');
  if (existsSync(fullPath)) {
    allChecks.push(checkUserStoryFormat(projectPath, specName));
    allChecks.push(checkAcceptanceCriteriaFormat(projectPath, specName));
    allChecks.push(checkNonFunctionalRequirements(projectPath, specName));
    allChecks.push(...await checkSteeringCoverage(projectPath, specName));
    allChecks.push(checkRequirementsNumbered(projectPath, specName));
  }

  const document: DocumentValidationResult = {
    document: docPath,
    exists: existsSync(fullPath),
    checks: allChecks,
    valid: !allChecks.some(c => !c.passed && c.severity === 'error'),
  };

  return {
    phase: 'requirements',
    specName,
    valid: document.valid,
    timestamp,
    checks: allChecks,
    documents: [document],
    summary: calculateSummary(allChecks),
  };
}

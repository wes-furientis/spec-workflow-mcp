/**
 * Design Document Validator
 * Validates design.md against requirements and existing code
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
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
 * Check if design document exists
 */
function checkDocumentExists(
  projectPath: string,
  specName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'design.md');

  if (existsSync(docPath)) {
    return passCheck(
      'design-exists',
      'Design document exists'
    );
  }

  return failCheck(
    'design-exists',
    'Design document exists',
    `design.md not found for spec '${specName}'`,
    'error',
    `Create design.md in .spec-workflow/specs/${specName}/`
  );
}

/**
 * Check if design has code reuse analysis section
 */
function checkCodeReuseAnalysis(
  projectPath: string,
  specName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'design.md');

  if (!existsSync(docPath)) {
    return failCheck(
      'code-reuse-analysis',
      'Design includes code reuse analysis',
      'design.md does not exist',
      'error'
    );
  }

  const content = readFileSync(docPath, 'utf-8').toLowerCase();

  // Check for code reuse section
  const reusePatterns = [
    /code\s+reuse/i,
    /existing\s+components?/i,
    /leverage/i,
    /integration\s+points?/i,
    /reusable/i,
  ];

  let hasReuseSection = false;
  for (const pattern of reusePatterns) {
    if (content.match(pattern)) {
      hasReuseSection = true;
      break;
    }
  }

  if (!hasReuseSection) {
    return failCheck(
      'code-reuse-analysis',
      'Design includes code reuse analysis',
      'No code reuse or integration analysis found',
      'warning',
      'Add a "Code Reuse Analysis" or "Existing Components to Leverage" section'
    );
  }

  return passCheck(
    'code-reuse-analysis',
    'Design includes code reuse analysis'
  );
}

/**
 * Check if file references in design point to actual files
 */
function checkFileReferencesExist(
  projectPath: string,
  specName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'design.md');

  if (!existsSync(docPath)) {
    return failCheck(
      'file-references-valid',
      'File references in design point to existing files',
      'design.md does not exist',
      'error'
    );
  }

  const content = readFileSync(docPath, 'utf-8');

  // Extract file references from design
  const filePatterns = [
    /`(src\/[^`]+\.[a-z]+)`/gi,
    /`(lib\/[^`]+\.[a-z]+)`/gi,
    /`(\.\/[^`]+\.[a-z]+)`/gi,
    /\*\*(src\/[^*]+\.[a-z]+)\*\*/gi,
  ];

  const referencedFiles: string[] = [];
  for (const pattern of filePatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      referencedFiles.push(match[1]);
    }
  }

  // Check if referenced files exist (for _Leverage references)
  const missingFiles: string[] = [];
  const existingFiles: string[] = [];

  for (const file of [...new Set(referencedFiles)].slice(0, 15)) {
    const filePath = join(projectPath, file);
    if (existsSync(filePath)) {
      existingFiles.push(file);
    } else {
      missingFiles.push(file);
    }
  }

  // It's okay if some files don't exist (they might be created)
  // But warn if most are missing
  if (missingFiles.length > existingFiles.length && existingFiles.length > 0) {
    return failCheck(
      'file-references-valid',
      'File references in design point to existing files',
      `${missingFiles.length} referenced files don't exist: ${missingFiles.slice(0, 3).join(', ')}...`,
      'warning',
      'Verify file paths are correct or note which files will be created'
    );
  }

  return passCheck(
    'file-references-valid',
    `Design references ${existingFiles.length} existing files`
  );
}

/**
 * Check if design covers all requirements
 */
function checkRequirementsCoverage(
  projectPath: string,
  specName: string
): ValidationCheck {
  const designPath = join(projectPath, '.spec-workflow', 'specs', specName, 'design.md');
  const requirementsPath = join(projectPath, '.spec-workflow', 'specs', specName, 'requirements.md');

  if (!existsSync(designPath)) {
    return failCheck(
      'requirements-coverage',
      'Design addresses all requirements',
      'design.md does not exist',
      'error'
    );
  }

  if (!existsSync(requirementsPath)) {
    return passCheck(
      'requirements-coverage',
      'Design addresses requirements (no requirements.md to compare)'
    );
  }

  const designContent = readFileSync(designPath, 'utf-8');
  const requirementsContent = readFileSync(requirementsPath, 'utf-8');

  // Extract requirement numbers from requirements.md
  const reqPattern = /(?:requirement|req)?\s*(\d+(?:\.\d+)*)/gi;
  const requirementNumbers = new Set<string>();
  let match;

  while ((match = reqPattern.exec(requirementsContent)) !== null) {
    const num = match[1];
    if (num.includes('.') || parseInt(num) < 20) { // Reasonable requirement numbers
      requirementNumbers.add(num);
    }
  }

  // Check how many are referenced in design
  let coveredCount = 0;
  for (const num of requirementNumbers) {
    if (designContent.includes(num)) {
      coveredCount++;
    }
  }

  const totalReqs = requirementNumbers.size;
  const coveragePercent = totalReqs > 0 ? Math.round((coveredCount / totalReqs) * 100) : 100;

  if (totalReqs > 0 && coveragePercent < 50) {
    return failCheck(
      'requirements-coverage',
      'Design addresses all requirements',
      `Only ${coveragePercent}% of requirements referenced in design (${coveredCount}/${totalReqs})`,
      'warning',
      'Ensure design explicitly addresses each requirement number'
    );
  }

  return passCheck(
    'requirements-coverage',
    `Design references ${coveragePercent}% of requirements`
  );
}

/**
 * Check if design has architecture diagrams
 */
function checkArchitectureDiagrams(
  projectPath: string,
  specName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'design.md');

  if (!existsSync(docPath)) {
    return failCheck(
      'architecture-diagrams',
      'Design includes architecture diagrams',
      'design.md does not exist',
      'error'
    );
  }

  const content = readFileSync(docPath, 'utf-8');

  // Check for diagram indicators
  const diagramPatterns = [
    /```mermaid/i,
    /```plantuml/i,
    /\!\[.*diagram.*\]/i,
    /\!\[.*architecture.*\]/i,
    /flowchart/i,
    /sequenceDiagram/i,
    /classDiagram/i,
  ];

  let hasDiagrams = false;
  for (const pattern of diagramPatterns) {
    if (content.match(pattern)) {
      hasDiagrams = true;
      break;
    }
  }

  // Also check for ASCII diagrams
  const asciiDiagramPattern = /[┌┐└┘│─├┤┬┴┼╔╗╚╝║═]/;
  if (content.match(asciiDiagramPattern)) {
    hasDiagrams = true;
  }

  if (!hasDiagrams) {
    return failCheck(
      'architecture-diagrams',
      'Design includes architecture diagrams',
      'No architecture diagrams found',
      'warning',
      'Add Mermaid diagrams, ASCII diagrams, or image references for architecture visualization'
    );
  }

  return passCheck(
    'architecture-diagrams',
    'Design includes architecture diagrams'
  );
}

/**
 * Check if design defines data models
 */
function checkDataModels(
  projectPath: string,
  specName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'design.md');

  if (!existsSync(docPath)) {
    return failCheck(
      'data-models',
      'Design defines data models',
      'design.md does not exist',
      'error'
    );
  }

  const content = readFileSync(docPath, 'utf-8').toLowerCase();

  // Check for data model indicators
  const dataModelPatterns = [
    /data\s+model/i,
    /interface\s+\w+/i,
    /type\s+\w+/i,
    /schema/i,
    /entity/i,
    /```typescript/i,
    /```json/i,
  ];

  let hasDataModels = false;
  for (const pattern of dataModelPatterns) {
    if (content.match(pattern)) {
      hasDataModels = true;
      break;
    }
  }

  if (!hasDataModels) {
    return failCheck(
      'data-models',
      'Design defines data models',
      'No data models or type definitions found',
      'warning',
      'Add a "Data Models" section with TypeScript interfaces or JSON schemas'
    );
  }

  return passCheck(
    'data-models',
    'Design defines data models'
  );
}

/**
 * Check if design defines component interfaces
 */
function checkComponentInterfaces(
  projectPath: string,
  specName: string
): ValidationCheck {
  const docPath = join(projectPath, '.spec-workflow', 'specs', specName, 'design.md');

  if (!existsSync(docPath)) {
    return failCheck(
      'component-interfaces',
      'Design defines component interfaces',
      'design.md does not exist',
      'error'
    );
  }

  const content = readFileSync(docPath, 'utf-8');

  // Check for API/interface definitions
  const interfacePatterns = [
    /api/i,
    /interface/i,
    /endpoint/i,
    /component/i,
    /props/i,
    /signature/i,
    /method/i,
  ];

  let hasInterfaces = false;
  for (const pattern of interfacePatterns) {
    if (content.match(pattern)) {
      hasInterfaces = true;
      break;
    }
  }

  if (!hasInterfaces) {
    return failCheck(
      'component-interfaces',
      'Design defines component interfaces',
      'No component interfaces or APIs defined',
      'warning',
      'Add sections defining component props, API endpoints, or function signatures'
    );
  }

  return passCheck(
    'component-interfaces',
    'Design defines component interfaces'
  );
}

/**
 * Validate design document
 */
export async function validateDesign(
  options: ValidationOptions
): Promise<PhaseValidationResult> {
  const { projectPath, specName } = options;
  const timestamp = new Date().toISOString();

  if (!specName) {
    return {
      phase: 'design',
      valid: false,
      timestamp,
      checks: [failCheck(
        'spec-name-required',
        'Spec name is provided',
        'specName is required for design validation',
        'error'
      )],
      documents: [],
      summary: { totalChecks: 1, passedChecks: 0, failedChecks: 1, errors: 1, warnings: 0 },
    };
  }

  const allChecks: ValidationCheck[] = [];
  const docPath = `specs/${specName}/design.md`;

  // Run all validation checks
  allChecks.push(checkDocumentExists(projectPath, specName));

  const fullPath = join(projectPath, '.spec-workflow', 'specs', specName, 'design.md');
  if (existsSync(fullPath)) {
    allChecks.push(checkCodeReuseAnalysis(projectPath, specName));
    allChecks.push(checkFileReferencesExist(projectPath, specName));
    allChecks.push(checkRequirementsCoverage(projectPath, specName));
    allChecks.push(checkArchitectureDiagrams(projectPath, specName));
    allChecks.push(checkDataModels(projectPath, specName));
    allChecks.push(checkComponentInterfaces(projectPath, specName));
  }

  const document: DocumentValidationResult = {
    document: docPath,
    exists: existsSync(fullPath),
    checks: allChecks,
    valid: !allChecks.some(c => !c.passed && c.severity === 'error'),
  };

  return {
    phase: 'design',
    specName,
    valid: document.valid,
    timestamp,
    checks: allChecks,
    documents: [document],
    summary: calculateSummary(allChecks),
  };
}

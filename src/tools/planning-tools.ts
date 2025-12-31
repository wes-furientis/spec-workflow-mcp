/**
 * Planning Tools for Claude Code Integration
 *
 * These tools integrate spec-workflow-mcp with Claude Code's planning capabilities
 * to enable seamless planning-to-implementation workflows.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import archetypeRegistry from '../archetypes/archetype-registry.js';
import { ArchetypeDefinition } from '../archetypes/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// =============================================================================
// Level 2: Get Planning Context Tool
// =============================================================================

export const getPlanningContextTool: Tool = {
  name: 'get-planning-context',
  description: `Get recommended steering documents and context files for Claude Code planning mode.

# Instructions
Call this tool when entering planning mode to get archetype-specific context files to read.
Returns a prioritized list of steering documents and their purposes, tailored to the project archetype.
This helps Claude Code's planning mode understand project constraints and patterns.`,
  inputSchema: {
    type: 'object',
    properties: {
      specName: {
        type: 'string',
        description: 'Optional spec name to include spec-specific context'
      }
    },
    additionalProperties: false
  }
};

export async function getPlanningContextHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  const projectPath = context.projectPath || process.cwd();
  const specName = args.specName;

  // Get archetype definition if available
  let archetypeDefinition: ArchetypeDefinition | undefined;
  if (context.projectArchetype) {
    archetypeDefinition = await archetypeRegistry.get(context.projectArchetype);
  }

  // Build list of context files to read
  const contextFiles: Array<{
    path: string;
    purpose: string;
    priority: 'required' | 'recommended' | 'optional';
    exists?: boolean;
  }> = [];

  // Add steering documents based on archetype
  const steeringDir = path.join(projectPath, '.spec-workflow', 'steering');

  if (archetypeDefinition) {
    // Required steering docs
    for (const doc of archetypeDefinition.steering.required) {
      const filePath = path.join(steeringDir, `${doc}.md`);
      const exists = await fileExists(filePath);
      contextFiles.push({
        path: `.spec-workflow/steering/${doc}.md`,
        purpose: getSteeringDocPurpose(doc),
        priority: 'required',
        exists
      });
    }

    // Optional steering docs
    for (const doc of archetypeDefinition.steering.optional) {
      const filePath = path.join(steeringDir, `${doc}.md`);
      const exists = await fileExists(filePath);
      contextFiles.push({
        path: `.spec-workflow/steering/${doc}.md`,
        purpose: getSteeringDocPurpose(doc),
        priority: 'recommended',
        exists
      });
    }

    // Custom steering docs
    for (const custom of archetypeDefinition.steering.custom) {
      const filePath = path.join(steeringDir, `${custom.name}.md`);
      const exists = await fileExists(filePath);
      contextFiles.push({
        path: `.spec-workflow/steering/${custom.name}.md`,
        purpose: custom.description,
        priority: 'recommended',
        exists
      });
    }
  } else {
    // Default steering docs for generic/unknown archetype
    for (const doc of ['product', 'tech', 'structure']) {
      const filePath = path.join(steeringDir, `${doc}.md`);
      const exists = await fileExists(filePath);
      contextFiles.push({
        path: `.spec-workflow/steering/${doc}.md`,
        purpose: getSteeringDocPurpose(doc),
        priority: 'recommended',
        exists
      });
    }
  }

  // Add spec-specific context if specName provided
  if (specName) {
    const specDir = path.join(projectPath, '.spec-workflow', 'specs', specName);

    for (const specDoc of ['requirements.md', 'design.md', 'tasks.md']) {
      const filePath = path.join(specDir, specDoc);
      const exists = await fileExists(filePath);
      if (exists) {
        contextFiles.push({
          path: `.spec-workflow/specs/${specName}/${specDoc}`,
          purpose: `Spec document: ${specDoc.replace('.md', '')}`,
          priority: 'required',
          exists
        });
      }
    }
  }

  // Generate planning guidance based on archetype
  const planningGuidance = archetypeDefinition
    ? getPlanningGuidanceForArchetype(archetypeDefinition)
    : getDefaultPlanningGuidance();

  return {
    success: true,
    message: archetypeDefinition
      ? `Planning context loaded for ${archetypeDefinition.displayName}`
      : 'Planning context loaded (generic project)',
    data: {
      archetype: archetypeDefinition ? {
        name: archetypeDefinition.name,
        displayName: archetypeDefinition.displayName,
        documentationStyle: archetypeDefinition.guidance.documentationStyle || 'rich-inline-external'
      } : undefined,
      contextFiles,
      planningGuidance,
      existingFilesCount: contextFiles.filter(f => f.exists).length,
      totalFilesCount: contextFiles.length
    },
    nextSteps: [
      'Read existing context files marked as "exists: true"',
      'Consider creating missing required/recommended steering docs',
      'Use context to inform implementation planning',
      'Exit planning mode when approach is decided'
    ]
  };
}

// =============================================================================
// Level 3: Suggest Plan Mode Tool
// =============================================================================

export const suggestPlanModeTool: Tool = {
  name: 'suggest-plan-mode',
  description: `REQUIRED: Check if Claude Code planning mode should be used before significant tasks.

# CRITICAL INSTRUCTIONS
You MUST call this tool BEFORE:
- Creating any steering document (architecture.md, conventions.md, documentation.md, etc.)
- Implementing features that touch 3+ files
- Making architectural decisions
- Starting work on a new spec

This tool analyzes task complexity and archetype requirements to determine if EnterPlanMode is needed.
If the response returns recommendation: "required" or "strongly-recommended", you MUST use EnterPlanMode before proceeding.

# When to Skip
Only skip this check for trivial tasks like: typo fixes, single-line changes, adding comments.`,
  inputSchema: {
    type: 'object',
    properties: {
      taskDescription: {
        type: 'string',
        description: 'Description of the task to be implemented'
      },
      specName: {
        type: 'string',
        description: 'Optional spec name for additional context'
      },
      estimatedFiles: {
        type: 'number',
        description: 'Optional estimate of files to be modified'
      }
    },
    required: ['taskDescription'],
    additionalProperties: false
  }
};

export async function suggestPlanModeHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  const { taskDescription, specName, estimatedFiles } = args;

  // Get archetype definition if available
  let archetypeDefinition: ArchetypeDefinition | undefined;
  if (context.projectArchetype) {
    archetypeDefinition = await archetypeRegistry.get(context.projectArchetype);
  }

  // Check if task is about creating a steering doc that requires planning
  const steeringDocResult = checkSteeringDocPlanning(taskDescription, archetypeDefinition);
  if (steeringDocResult) {
    return steeringDocResult;
  }

  // Analyze task complexity
  const complexityFactors: string[] = [];
  let complexityScore = 0;

  // Check for complexity indicators in task description
  const complexityIndicators = [
    { pattern: /architect/i, weight: 3, reason: 'Architectural decisions involved' },
    { pattern: /migrat/i, weight: 3, reason: 'Migration work detected' },
    { pattern: /refactor/i, weight: 2, reason: 'Refactoring required' },
    { pattern: /api|endpoint/i, weight: 2, reason: 'API design involved' },
    { pattern: /database|schema/i, weight: 2, reason: 'Database changes involved' },
    { pattern: /auth|security/i, weight: 2, reason: 'Security-sensitive work' },
    { pattern: /integrat/i, weight: 2, reason: 'Integration work detected' },
    { pattern: /new feature|implement/i, weight: 1, reason: 'New feature implementation' },
    { pattern: /multi.*file|several.*file|multiple.*component/i, weight: 2, reason: 'Multi-file changes' },
  ];

  for (const indicator of complexityIndicators) {
    if (indicator.pattern.test(taskDescription)) {
      complexityScore += indicator.weight;
      complexityFactors.push(indicator.reason);
    }
  }

  // Factor in estimated files
  if (estimatedFiles !== undefined) {
    if (estimatedFiles > 5) {
      complexityScore += 3;
      complexityFactors.push(`High file count (${estimatedFiles} files)`);
    } else if (estimatedFiles > 2) {
      complexityScore += 1;
      complexityFactors.push(`Moderate file count (${estimatedFiles} files)`);
    }
  }

  // Factor in archetype
  let archetypeRecommendation = 'neutral';
  if (archetypeDefinition) {
    switch (archetypeDefinition.name) {
      case 'greenfield':
        complexityScore += 2;
        complexityFactors.push('Greenfield project - architecture decisions important');
        archetypeRecommendation = 'strongly-recommended';
        break;
      case 'brownfield':
        complexityScore += 1;
        complexityFactors.push('Brownfield project - existing patterns must be understood');
        archetypeRecommendation = 'recommended';
        break;
      case 'code-library':
        if (/api|public|export/i.test(taskDescription)) {
          complexityScore += 2;
          complexityFactors.push('Library API changes - versioning considerations');
          archetypeRecommendation = 'recommended';
        }
        break;
    }
  }

  // Determine recommendation
  let recommendation: 'strongly-recommended' | 'recommended' | 'optional' | 'not-needed';
  let confidence: 'high' | 'medium' | 'low';

  if (complexityScore >= 5) {
    recommendation = 'strongly-recommended';
    confidence = 'high';
  } else if (complexityScore >= 3) {
    recommendation = 'recommended';
    confidence = 'medium';
  } else if (complexityScore >= 1) {
    recommendation = 'optional';
    confidence = 'medium';
  } else {
    recommendation = 'not-needed';
    confidence = 'low';
  }

  // Build context files to read if planning mode is used
  const contextFilesToRead: string[] = [];
  if (archetypeDefinition) {
    for (const doc of archetypeDefinition.steering.required) {
      contextFilesToRead.push(`.spec-workflow/steering/${doc}.md`);
    }
    for (const custom of archetypeDefinition.steering.custom) {
      contextFilesToRead.push(`.spec-workflow/steering/${custom.name}.md`);
    }
  }

  return {
    success: true,
    message: `Planning mode ${recommendation} for this task`,
    data: {
      recommendation,
      confidence,
      complexityScore,
      complexityFactors,
      archetypeRecommendation,
      archetype: archetypeDefinition?.name || 'generic',
      contextFilesToRead,
      reasoning: generatePlanningReasoning(recommendation, complexityFactors, archetypeDefinition)
    },
    nextSteps: recommendation === 'strongly-recommended' || recommendation === 'recommended'
      ? [
          'Consider using EnterPlanMode before implementation',
          'Read steering docs for project context',
          'Design implementation approach',
          'Get user approval on approach',
          'Exit planning mode and implement'
        ]
      : [
          'Proceed with implementation directly',
          'Consider planning mode if you encounter unexpected complexity'
        ]
  };
}

// =============================================================================
// Level 4: Plan Export Tool
// =============================================================================

export const exportPlanTool: Tool = {
  name: 'export-plan',
  description: `Export spec-workflow tasks to a format suitable for Claude Code planning.

# Instructions
Call this tool to export tasks from a spec into a planning document format.
Creates a structured plan that can be used as context for Claude Code planning mode.`,
  inputSchema: {
    type: 'object',
    properties: {
      specName: {
        type: 'string',
        description: 'Name of the spec to export tasks from'
      },
      includeCompleted: {
        type: 'boolean',
        description: 'Include completed tasks in export (default: false)'
      }
    },
    required: ['specName'],
    additionalProperties: false
  }
};

export async function exportPlanHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  const { specName, includeCompleted = false } = args;
  const projectPath = context.projectPath || process.cwd();

  // Read tasks.md
  const tasksPath = path.join(projectPath, '.spec-workflow', 'specs', specName, 'tasks.md');

  try {
    const tasksContent = await fs.readFile(tasksPath, 'utf-8');

    // Parse tasks from markdown
    const tasks = parseTasksFromMarkdown(tasksContent, includeCompleted);

    // Read requirements for context
    const requirementsPath = path.join(projectPath, '.spec-workflow', 'specs', specName, 'requirements.md');
    let requirements = '';
    try {
      requirements = await fs.readFile(requirementsPath, 'utf-8');
    } catch {
      // Requirements file may not exist
    }

    // Read design for context
    const designPath = path.join(projectPath, '.spec-workflow', 'specs', specName, 'design.md');
    let design = '';
    try {
      design = await fs.readFile(designPath, 'utf-8');
    } catch {
      // Design file may not exist
    }

    // Generate plan document
    const planDocument = generatePlanDocument(specName, tasks, requirements, design, context.projectArchetype);

    return {
      success: true,
      message: `Exported ${tasks.length} tasks from spec "${specName}"`,
      data: {
        specName,
        taskCount: tasks.length,
        pendingCount: tasks.filter(t => t.status === 'pending').length,
        inProgressCount: tasks.filter(t => t.status === 'in-progress').length,
        completedCount: tasks.filter(t => t.status === 'completed').length,
        planDocument,
        tasks
      },
      nextSteps: [
        'Use planDocument content as context for EnterPlanMode',
        'Review tasks and their dependencies',
        'Plan implementation order',
        'Consider parallel execution opportunities'
      ]
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to export plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: { specName },
      nextSteps: ['Verify spec exists', 'Check tasks.md file']
    };
  }
}

// =============================================================================
// Level 4: Plan Import Tool
// =============================================================================

export const importPlanTool: Tool = {
  name: 'import-plan',
  description: `Import a planning document into spec-workflow requirements format.

# Instructions
Call this tool to convert a Claude Code planning document or outline into spec-workflow requirements.
Extracts requirements, design considerations, and tasks from planning content.`,
  inputSchema: {
    type: 'object',
    properties: {
      specName: {
        type: 'string',
        description: 'Name for the new spec (kebab-case)'
      },
      planContent: {
        type: 'string',
        description: 'Planning document content to import'
      },
      outputType: {
        type: 'string',
        enum: ['requirements', 'tasks', 'both'],
        description: 'What to generate from the plan (default: requirements)'
      }
    },
    required: ['specName', 'planContent'],
    additionalProperties: false
  }
};

export async function importPlanHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  const { specName, planContent, outputType = 'requirements' } = args;
  const projectPath = context.projectPath || process.cwd();

  // Get archetype for template customization
  let archetypeDefinition: ArchetypeDefinition | undefined;
  if (context.projectArchetype) {
    archetypeDefinition = await archetypeRegistry.get(context.projectArchetype);
  }

  // Parse planning content
  const parsedPlan = parsePlanningContent(planContent);

  // Generate spec documents based on outputType
  const generatedDocs: Array<{ name: string; path: string; content: string }> = [];
  const specDir = `.spec-workflow/specs/${specName}`;

  if (outputType === 'requirements' || outputType === 'both') {
    const requirementsContent = generateRequirementsFromPlan(parsedPlan, archetypeDefinition);
    generatedDocs.push({
      name: 'requirements.md',
      path: `${specDir}/requirements.md`,
      content: requirementsContent
    });
  }

  if (outputType === 'tasks' || outputType === 'both') {
    const tasksContent = generateTasksFromPlan(parsedPlan, archetypeDefinition);
    generatedDocs.push({
      name: 'tasks.md',
      path: `${specDir}/tasks.md`,
      content: tasksContent
    });
  }

  return {
    success: true,
    message: `Parsed plan and generated ${generatedDocs.length} document(s) for spec "${specName}"`,
    data: {
      specName,
      outputType,
      parsedPlan: {
        goalsCount: parsedPlan.goals.length,
        stepsCount: parsedPlan.steps.length,
        considerationsCount: parsedPlan.considerations.length
      },
      generatedDocs: generatedDocs.map(d => ({ name: d.name, path: d.path })),
      documentContents: generatedDocs.reduce((acc, d) => {
        acc[d.name] = d.content;
        return acc;
      }, {} as Record<string, string>)
    },
    nextSteps: [
      `Create spec directory: ${specDir}`,
      ...generatedDocs.map(d => `Write file: ${d.path}`),
      'Review and refine generated documents',
      'Submit for approval via approvals tool'
    ]
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a task is about creating a steering doc that requires planning
 * Returns a ToolResponse if planning is required, null otherwise
 */
function checkSteeringDocPlanning(
  taskDescription: string,
  archetype?: ArchetypeDefinition
): ToolResponse | null {
  if (!archetype) return null;

  const taskLower = taskDescription.toLowerCase();

  // Check if task mentions creating/writing steering docs
  const steeringDocPatterns = [
    /creat(e|ing)\s+(\w+\.md|steering|documentation)/i,
    /writ(e|ing)\s+(\w+\.md|steering|documentation)/i,
    /set\s*up\s+(\w+\.md|steering|documentation)/i,
    /draft\s+(\w+\.md|steering|documentation)/i,
  ];

  const isSteeringDocTask = steeringDocPatterns.some(p => p.test(taskDescription));
  if (!isSteeringDocTask) return null;

  // Check each custom steering doc for requiresPlanning
  for (const customDoc of archetype.steering.custom) {
    // Check if this doc is mentioned in the task
    const docNamePattern = new RegExp(`${customDoc.name}(\\.md)?`, 'i');
    if (docNamePattern.test(taskDescription) && customDoc.requiresPlanning) {
      // Build context files to read
      const contextFiles: string[] = [];

      // Add planning context from the doc definition
      if (customDoc.planningContext) {
        for (const ctx of customDoc.planningContext) {
          contextFiles.push(`.spec-workflow/steering/${ctx}.md`);
        }
      }

      // Also add required steering docs as context
      for (const req of archetype.steering.required) {
        if (!contextFiles.includes(`.spec-workflow/steering/${req}.md`)) {
          contextFiles.push(`.spec-workflow/steering/${req}.md`);
        }
      }

      return {
        success: true,
        message: `Planning mode REQUIRED for creating ${customDoc.name}.md`,
        data: {
          recommendation: 'required' as const,
          confidence: 'high' as const,
          complexityScore: 10,
          complexityFactors: [
            `Creating steering doc: ${customDoc.name}.md`,
            `Doc requires planning: ${customDoc.description}`,
            `Archetype: ${archetype.displayName}`
          ],
          archetypeRecommendation: 'required',
          archetype: archetype.name,
          steeringDoc: {
            name: customDoc.name,
            description: customDoc.description,
            requiresPlanning: true,
            planningContext: customDoc.planningContext
          },
          contextFilesToRead: contextFiles,
          reasoning: `The steering document "${customDoc.name}.md" is configured to require planning mode. ` +
            `This ensures architectural decisions and project context are considered before documenting ${customDoc.description.toLowerCase()}. ` +
            `Read the context files first, then use EnterPlanMode to design the document structure.`
        },
        nextSteps: [
          `Read context files: ${contextFiles.join(', ')}`,
          'Use EnterPlanMode before creating the document',
          'Design document structure and key sections',
          'Get user approval on document approach',
          'Exit planning mode and create the document',
          `Create: .spec-workflow/steering/${customDoc.name}.md`
        ]
      };
    }
  }

  // Check standard steering docs (product, tech, structure) - these don't have requiresPlanning
  // but we can still provide guidance
  const standardDocs = ['product', 'tech', 'structure'];
  for (const docName of standardDocs) {
    const docPattern = new RegExp(`${docName}(\\.md)?`, 'i');
    if (docPattern.test(taskDescription)) {
      // Standard docs recommend planning for greenfield/brownfield
      const shouldRecommend = archetype.name === 'greenfield' || archetype.name === 'brownfield';

      if (shouldRecommend) {
        return {
          success: true,
          message: `Planning mode recommended for creating ${docName}.md`,
          data: {
            recommendation: 'recommended' as const,
            confidence: 'medium' as const,
            complexityScore: 5,
            complexityFactors: [
              `Creating steering doc: ${docName}.md`,
              `Archetype ${archetype.displayName} benefits from upfront planning`
            ],
            archetypeRecommendation: 'recommended',
            archetype: archetype.name,
            steeringDoc: {
              name: docName,
              description: getSteeringDocPurpose(docName),
              requiresPlanning: false
            },
            contextFilesToRead: [],
            reasoning: `Creating ${docName}.md for a ${archetype.displayName} project. ` +
              `Planning mode is recommended to ensure thorough consideration of project requirements.`
          },
          nextSteps: [
            'Consider using EnterPlanMode for thorough planning',
            'Review existing project context',
            `Create: .spec-workflow/steering/${docName}.md`
          ]
        };
      }
    }
  }

  return null;
}

function getSteeringDocPurpose(docName: string): string {
  const purposes: Record<string, string> = {
    product: 'Product vision, goals, success criteria, and user needs',
    tech: 'Technology stack decisions, rationale, and constraints',
    structure: 'Codebase organization, module boundaries, and file conventions',
    architecture: 'Architecture Decision Records (ADRs), patterns, and system design',
    conventions: 'Coding standards, naming conventions, and style guidelines',
    documentation: 'Documentation strategy, what to document, and format standards',
    legacy: 'Existing patterns to follow, technical debt, and historical context',
    migration: 'Migration strategies, backward compatibility, and upgrade paths',
    ux: 'Design system, UI/UX guidelines, and accessibility standards',
    api: 'API design principles, endpoint patterns, and response formats',
    deployment: 'Deployment strategy, environments, and infrastructure',
    compatibility: 'Version support, platform compatibility, and dependencies',
    thesis: 'Research questions, hypotheses, and central argument',
    methodology: 'Research methods, data collection, and analysis approach',
    literature: 'Literature review, key citations, and theoretical framework',
    evidence: 'Data sources, statistical methods, and reproducibility',
    publication: 'Target venue, formatting requirements, and submission timeline'
  };
  return purposes[docName] || `Steering document: ${docName}`;
}

function getPlanningGuidanceForArchetype(archetype: ArchetypeDefinition): string[] {
  const guidance: string[] = [];

  switch (archetype.name) {
    case 'greenfield':
      guidance.push('Focus on establishing solid architectural foundations');
      guidance.push('Document technology choices before implementing');
      guidance.push('Consider scalability and future requirements');
      guidance.push('Define coding conventions early');
      break;
    case 'brownfield':
      guidance.push('Understand existing patterns before making changes');
      guidance.push('Plan for backward compatibility');
      guidance.push('Identify technical debt to avoid/address');
      guidance.push('Document integration points');
      break;
    case 'web-app':
      guidance.push('Consider user flows and accessibility');
      guidance.push('Plan component hierarchy and state management');
      guidance.push('Design API contracts before implementation');
      guidance.push('Consider deployment and monitoring');
      break;
    case 'code-library':
      guidance.push('Design intuitive public APIs');
      guidance.push('Plan semantic versioning strategy');
      guidance.push('Document breaking changes');
      guidance.push('Minimize dependencies');
      break;
    case 'research-paper':
      guidance.push('Ensure methodology alignment with research questions');
      guidance.push('Plan evidence collection systematically');
      guidance.push('Consider publication venue requirements');
      guidance.push('Track citations rigorously');
      break;
    default:
      guidance.push('Review project steering documents');
      guidance.push('Consider impact on existing code');
      guidance.push('Plan for testing and validation');
  }

  return guidance;
}

function getDefaultPlanningGuidance(): string[] {
  return [
    'Review existing codebase patterns',
    'Consider impact on existing functionality',
    'Plan for testing and validation',
    'Document architectural decisions'
  ];
}

function generatePlanningReasoning(
  recommendation: string,
  factors: string[],
  archetype?: ArchetypeDefinition
): string {
  const parts: string[] = [];

  if (factors.length > 0) {
    parts.push(`Complexity factors detected: ${factors.join(', ')}.`);
  }

  if (archetype) {
    parts.push(`Project archetype "${archetype.displayName}" ${
      archetype.name === 'greenfield' ? 'strongly benefits from upfront planning.' :
      archetype.name === 'brownfield' ? 'benefits from understanding existing patterns first.' :
      'has specific considerations for planning.'
    }`);
  }

  switch (recommendation) {
    case 'strongly-recommended':
      parts.push('Planning mode will help ensure a well-thought-out implementation approach.');
      break;
    case 'recommended':
      parts.push('Planning mode can help clarify the implementation approach.');
      break;
    case 'optional':
      parts.push('Planning mode may be helpful but is not strictly necessary.');
      break;
    case 'not-needed':
      parts.push('Task appears straightforward; direct implementation should suffice.');
      break;
  }

  return parts.join(' ');
}

interface ParsedTask {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed';
  description?: string;
  files?: string[];
}

function parseTasksFromMarkdown(content: string, includeCompleted: boolean): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const lines = content.split('\n');

  let currentTask: Partial<ParsedTask> | null = null;
  let taskCounter = 0;

  for (const line of lines) {
    // Match task lines: - [ ] Task, - [-] Task, - [x] Task
    const taskMatch = line.match(/^[-*]\s*\[([ x-])\]\s*(.+)/);

    if (taskMatch) {
      // Save previous task
      if (currentTask && currentTask.title) {
        if (includeCompleted || currentTask.status !== 'completed') {
          tasks.push(currentTask as ParsedTask);
        }
      }

      taskCounter++;
      const statusChar = taskMatch[1];
      const status = statusChar === 'x' ? 'completed' : statusChar === '-' ? 'in-progress' : 'pending';

      currentTask = {
        id: `task-${taskCounter}`,
        title: taskMatch[2].trim(),
        status,
        files: []
      };
    } else if (currentTask && line.trim().startsWith('- ') && !line.match(/^\s*[-*]\s*\[/)) {
      // Sub-item (file or description)
      const item = line.trim().substring(2);
      if (item.includes('/') || item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.js')) {
        currentTask.files = currentTask.files || [];
        currentTask.files.push(item);
      } else {
        currentTask.description = (currentTask.description || '') + item + ' ';
      }
    }
  }

  // Don't forget the last task
  if (currentTask && currentTask.title) {
    if (includeCompleted || currentTask.status !== 'completed') {
      tasks.push(currentTask as ParsedTask);
    }
  }

  return tasks;
}

function generatePlanDocument(
  specName: string,
  tasks: ParsedTask[],
  requirements: string,
  design: string,
  archetype?: string
): string {
  const lines: string[] = [];

  lines.push(`# Implementation Plan: ${specName}`);
  lines.push('');
  lines.push(`Generated for planning mode integration.`);
  if (archetype) {
    lines.push(`Project archetype: ${archetype}`);
  }
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total tasks: ${tasks.length}`);
  lines.push(`- Pending: ${tasks.filter(t => t.status === 'pending').length}`);
  lines.push(`- In Progress: ${tasks.filter(t => t.status === 'in-progress').length}`);
  lines.push(`- Completed: ${tasks.filter(t => t.status === 'completed').length}`);
  lines.push('');

  // Tasks
  lines.push('## Tasks');
  lines.push('');
  for (const task of tasks) {
    const statusIcon = task.status === 'completed' ? '[x]' : task.status === 'in-progress' ? '[-]' : '[ ]';
    lines.push(`### ${statusIcon} ${task.id}: ${task.title}`);
    if (task.description) {
      lines.push(`Description: ${task.description.trim()}`);
    }
    if (task.files && task.files.length > 0) {
      lines.push(`Files: ${task.files.join(', ')}`);
    }
    lines.push('');
  }

  // Requirements excerpt
  if (requirements) {
    lines.push('## Requirements Context');
    lines.push('');
    // Extract first few requirements
    const reqLines = requirements.split('\n').slice(0, 30);
    lines.push(reqLines.join('\n'));
    lines.push('...');
    lines.push('');
  }

  // Design excerpt
  if (design) {
    lines.push('## Design Context');
    lines.push('');
    // Extract first few lines of design
    const designLines = design.split('\n').slice(0, 30);
    lines.push(designLines.join('\n'));
    lines.push('...');
    lines.push('');
  }

  return lines.join('\n');
}

interface ParsedPlan {
  goals: string[];
  steps: string[];
  considerations: string[];
  files: string[];
}

function parsePlanningContent(content: string): ParsedPlan {
  const plan: ParsedPlan = {
    goals: [],
    steps: [],
    considerations: [],
    files: []
  };

  const lines = content.split('\n');
  let currentSection: 'goals' | 'steps' | 'considerations' | 'files' | null = null;

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();

    // Detect section headers
    if (trimmed.includes('goal') || trimmed.includes('objective') || trimmed.includes('purpose')) {
      currentSection = 'goals';
      continue;
    } else if (trimmed.includes('step') || trimmed.includes('task') || trimmed.includes('implementation')) {
      currentSection = 'steps';
      continue;
    } else if (trimmed.includes('consider') || trimmed.includes('note') || trimmed.includes('caveat')) {
      currentSection = 'considerations';
      continue;
    } else if (trimmed.includes('file') || trimmed.includes('module') || trimmed.includes('component')) {
      currentSection = 'files';
      continue;
    }

    // Extract bullet points
    const bulletMatch = line.match(/^[-*•]\s*(.+)/);
    const numberedMatch = line.match(/^\d+\.\s*(.+)/);
    const item = bulletMatch?.[1] || numberedMatch?.[1];

    if (item && currentSection) {
      plan[currentSection].push(item.trim());
    } else if (item) {
      // Default to steps if no section detected
      plan.steps.push(item.trim());
    }
  }

  return plan;
}

function generateRequirementsFromPlan(plan: ParsedPlan, archetype?: ArchetypeDefinition): string {
  const lines: string[] = [];

  lines.push('# Requirements Document');
  lines.push('');
  lines.push('## Introduction');
  lines.push('');
  lines.push('*Generated from planning document*');
  lines.push('');

  if (plan.goals.length > 0) {
    lines.push('## Goals');
    lines.push('');
    for (const goal of plan.goals) {
      lines.push(`- ${goal}`);
    }
    lines.push('');
  }

  lines.push('## Requirements');
  lines.push('');

  let reqNum = 1;
  for (const step of plan.steps) {
    lines.push(`### Requirement ${reqNum}: ${step}`);
    lines.push('');
    lines.push(`**User Story:** As a user, I want ${step.toLowerCase()}`);
    lines.push('');
    lines.push('**Acceptance Criteria:**');
    lines.push('- [ ] Criteria to be defined');
    lines.push('');
    reqNum++;
  }

  if (plan.considerations.length > 0) {
    lines.push('## Non-Functional Requirements');
    lines.push('');
    for (const consideration of plan.considerations) {
      lines.push(`- ${consideration}`);
    }
    lines.push('');
  }

  if (archetype) {
    lines.push('## Archetype Considerations');
    lines.push('');
    lines.push(`Project archetype: ${archetype.displayName}`);
    lines.push('');
    for (const emphasis of archetype.guidance.workflowEmphasis) {
      lines.push(`- ${emphasis}`);
    }
  }

  return lines.join('\n');
}

function generateTasksFromPlan(plan: ParsedPlan, archetype?: ArchetypeDefinition): string {
  const lines: string[] = [];

  lines.push('# Tasks');
  lines.push('');
  lines.push('## Implementation Tasks');
  lines.push('');

  let taskNum = 1;
  for (const step of plan.steps) {
    lines.push(`### Task ${taskNum}: ${step}`);
    lines.push('');
    lines.push(`- [ ] ${step}`);

    // Add relevant files if detected
    for (const file of plan.files) {
      if (file.toLowerCase().includes(step.split(' ')[0].toLowerCase())) {
        lines.push(`  - File: ${file}`);
      }
    }

    lines.push('');
    lines.push('**_Prompt:**');
    lines.push('```');
    lines.push(`Role: Developer implementing ${step}`);
    lines.push(`Task: ${step}`);
    lines.push('Success: Task completed and tested');
    lines.push('```');
    lines.push('');
    taskNum++;
  }

  return lines.join('\n');
}

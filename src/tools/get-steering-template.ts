import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import archetypeRegistry from '../archetypes/archetype-registry.js';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PathUtils } from '../core/path-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const getSteeringTemplateTool: Tool = {
  name: 'get-steering-template',
  description: `Get the template for a steering document.

For documents that require planning, you must complete planning first.
Call steering-guide to see which docs require planning.`,
  inputSchema: {
    type: 'object',
    properties: {
      docName: {
        type: 'string',
        description: 'Name of the steering document (e.g., "product", "conventions", "documentation")'
      }
    },
    required: ['docName'],
    additionalProperties: false
  }
};

/**
 * Check if planning was completed for a doc
 */
async function isPlanningComplete(projectPath: string, docName: string): Promise<boolean> {
  const markerPath = join(projectPath, '.spec-workflow', '.planning', `${docName}.complete`);
  try {
    await fs.access(markerPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read template content
 */
async function readTemplate(templateFileName: string, projectPath: string): Promise<string | null> {
  // First check user-templates
  const userTemplatePath = join(projectPath, '.spec-workflow', 'user-templates', templateFileName);
  try {
    return await fs.readFile(userTemplatePath, 'utf-8');
  } catch {
    // Not in user-templates
  }

  // Then check project templates
  const projectTemplatePath = join(projectPath, '.spec-workflow', 'templates', templateFileName);
  try {
    return await fs.readFile(projectTemplatePath, 'utf-8');
  } catch {
    // Not in project templates
  }

  // Finally check built-in templates
  const builtInPath = join(__dirname, '..', 'markdown', 'templates', templateFileName);
  try {
    return await fs.readFile(builtInPath, 'utf-8');
  } catch {
    return null;
  }
}

export async function getSteeringTemplateHandler(args: { docName: string }, context: ToolContext): Promise<ToolResponse> {
  const { docName } = args;

  if (!docName) {
    return {
      success: false,
      message: 'docName is required',
      nextSteps: ['Call with docName parameter']
    };
  }

  // Need archetype to know template file and planning requirements
  if (!context.projectArchetype) {
    return {
      success: false,
      message: 'No archetype configured',
      nextSteps: ['Set archetype in dashboard first']
    };
  }

  const archetype = await archetypeRegistry.get(context.projectArchetype);
  if (!archetype) {
    return {
      success: false,
      message: `Unknown archetype: ${context.projectArchetype}`,
      nextSteps: ['Check archetype configuration']
    };
  }

  const projectPath = context.projectPath || process.cwd();

  // Find the doc in archetype config
  let templateFileName: string;
  let requiresPlanning = false;
  let planningContext: string[] = [];

  // Check standard docs
  const standardDocs = [...archetype.steering.required, ...archetype.steering.optional];
  if (standardDocs.includes(docName)) {
    templateFileName = `${docName}-template.md`;
    requiresPlanning = false;
  } else {
    // Check custom docs
    const customDoc = archetype.steering.custom.find(d => d.name === docName);
    if (!customDoc) {
      return {
        success: false,
        message: `Unknown steering document: ${docName}`,
        data: {
          validDocs: [
            ...standardDocs,
            ...archetype.steering.custom.map(d => d.name)
          ]
        },
        nextSteps: ['Call steering-guide to see available documents']
      };
    }
    templateFileName = customDoc.templateFile;
    requiresPlanning = customDoc.requiresPlanning ?? false;
    planningContext = customDoc.planningContext ?? [];
  }

  // Check if planning is required and not done
  if (requiresPlanning) {
    const planningDone = await isPlanningComplete(projectPath, docName);
    if (!planningDone) {
      return {
        success: false,
        message: `Planning required for ${docName}.md`,
        data: {
          docName,
          requiresPlanning: true,
          planningContext: planningContext.map(d => `.spec-workflow/steering/${d}.md`)
        },
        nextSteps: [
          `Call: suggest-plan-mode taskDescription:"Create ${docName}.md steering document"`,
          'Complete planning phase',
          'Then call get-steering-template again'
        ]
      };
    }
  }

  // Read the template
  const templateContent = await readTemplate(templateFileName, projectPath);
  if (!templateContent) {
    return {
      success: false,
      message: `Template not found: ${templateFileName}`,
      nextSteps: ['Check if templates are installed correctly']
    };
  }

  return {
    success: true,
    message: `Template loaded for ${docName}.md`,
    data: {
      docName,
      templateFileName,
      outputPath: `.spec-workflow/steering/${docName}.md`,
      template: templateContent
    },
    nextSteps: [
      `Create document at: .spec-workflow/steering/${docName}.md`,
      'Follow template structure',
      'Submit for approval when complete'
    ]
  };
}

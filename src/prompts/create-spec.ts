import { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import { PromptDefinition } from './types.js';
import { ToolContext } from '../types.js';
import archetypeRegistry from '../archetypes/archetype-registry.js';
import { ArchetypeDefinition, ArchetypeOutputType } from '../archetypes/types.js';

const prompt: Prompt = {
  name: 'create-spec',
  title: 'Create Specification Document',
  description: 'Guide for creating spec documents directly in the file system. Shows how to use templates and create requirements, design, or tasks documents at the correct paths.',
  arguments: [
    {
      name: 'specName',
      description: 'Feature name in kebab-case (e.g., user-authentication, data-export)',
      required: true
    },
    {
      name: 'documentType', 
      description: 'Type of document to create: requirements, design, or tasks',
      required: true
    },
    {
      name: 'description',
      description: 'Brief description of what this spec should accomplish',
      required: false
    }
  ]
};

/**
 * Generate output-type-specific workflow guidance
 */
function getOutputTypeGuidance(outputType: ArchetypeOutputType, documentType: string): string {
  switch (outputType) {
    case 'document':
      return `
**CRITICAL: This is a DOCUMENT-CREATION project**
The output of this project is a DOCUMENT (or set of documents), NOT code execution.

- Requirements define WHAT the document needs to contain and accomplish
- Design defines HOW the document will be structured and organized
- Tasks define the WRITING work to produce each section/artifact

DO NOT create tasks about executing the subject of the document.
DO create tasks about WRITING ABOUT the subject.

Example - if the document is about "launching a marketing campaign":
- WRONG task: "Set up email automation system"
- RIGHT task: "Write the Email Automation Strategy section"

Example - if the document is about "data analysis":
- WRONG task: "Run the data pipeline"
- RIGHT task: "Write the Data Pipeline Architecture section"
`;

    case 'artifact-set':
      return `
**CRITICAL: This is an ARTIFACT-SET project**
The output is a set of artifacts (documents, spreadsheets, slides, etc.), NOT code execution.

- Requirements define WHAT artifacts need to be created and their purpose
- Design defines HOW each artifact will be structured
- Tasks define the CREATION work for each artifact

DO NOT create tasks about executing the subject matter.
DO create tasks about CREATING the artifacts that describe the subject.

Example artifacts: planning documents, spreadsheets, presentations, diagrams
`;

    case 'code':
    default:
      return `
**Workflow Guidelines:**
- Requirements documents define WHAT needs to be built (code/software)
- Design documents define HOW it will be built (architecture, components)
- Tasks documents break down implementation into coding steps
- Each document builds upon the previous one in sequence
`;
  }
}

/**
 * Generate archetype-specific guidance section
 */
function getArchetypeGuidance(archetype: ArchetypeDefinition | undefined): string {
  if (!archetype) {
    return '';
  }

  const { guidance } = archetype;
  let result = `\n**Archetype: ${archetype.displayName}**\n`;
  result += `${archetype.description}\n`;

  if (guidance.keyConsiderations && guidance.keyConsiderations.length > 0) {
    result += `\n**Key Considerations:**\n`;
    for (const consideration of guidance.keyConsiderations) {
      result += `- ${consideration}\n`;
    }
  }

  if (guidance.workflowEmphasis && guidance.workflowEmphasis.length > 0) {
    result += `\n**Workflow Emphasis:**\n`;
    for (const emphasis of guidance.workflowEmphasis) {
      result += `- ${emphasis}\n`;
    }
  }

  if (guidance.documentationFocus) {
    result += `\n**Documentation Focus:** ${guidance.documentationFocus}\n`;
  }

  return result;
}

async function handler(args: Record<string, any>, context: ToolContext): Promise<PromptMessage[]> {
  const { specName, documentType, description } = args;

  if (!specName || !documentType) {
    throw new Error('specName and documentType are required arguments');
  }

  const validDocTypes = ['requirements', 'design', 'tasks'];
  if (!validDocTypes.includes(documentType)) {
    throw new Error(`documentType must be one of: ${validDocTypes.join(', ')}`);
  }

  // Load archetype definition
  let archetype: ArchetypeDefinition | undefined;
  const archetypeName = context.projectArchetype || 'generic';

  try {
    const result = await archetypeRegistry.getWithProject(archetypeName, context.projectPath);
    archetype = result?.archetype;
  } catch (error) {
    // Continue without archetype guidance if loading fails
    console.warn(`Warning: Could not load archetype '${archetypeName}': ${error}`);
  }

  const outputType: ArchetypeOutputType = archetype?.guidance?.outputType || 'code';
  const outputTypeGuidance = getOutputTypeGuidance(outputType, documentType);
  const archetypeGuidance = getArchetypeGuidance(archetype);

  // Build context-aware messages
  const messages: PromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Create a ${documentType} document for the "${specName}" spec using the spec-workflow methodology.

**Context:**
- Project: ${context.projectPath}
- Spec name: ${specName}
- Document type: ${documentType}
- Archetype: ${archetypeName}
${description ? `- Description: ${description}` : ''}
${context.dashboardUrl ? `- Dashboard: ${context.dashboardUrl}` : ''}
${archetypeGuidance}
${outputTypeGuidance}

**Instructions:**
1. First, read the template at: .spec-workflow/templates/${documentType}-template.md
2. Read existing steering documents for context
3. Follow the template structure exactly - this ensures consistency
4. Create comprehensive content following the archetype guidance above
5. Include all required sections from the template
6. Use clear, actionable language appropriate to the output type
7. Create the document at: .spec-workflow/specs/${specName}/${documentType}.md
8. STOP after creating the document - wait for user review before validation or approval

**File Paths:**
- Template location: .spec-workflow/templates/${documentType}-template.md
- Document destination: .spec-workflow/specs/${specName}/${documentType}.md

${documentType === 'tasks' ? `
**Special Instructions for Tasks Document:**
- For each task, generate a _Prompt field with structured AI guidance
- Format: _Prompt: Role: [role] | Task: [description] | Restrictions: [constraints] | Success: [criteria]
- Make prompts specific to the project context and output type (${outputType})
- Include _Leverage fields pointing to existing content to reference
- Include _Requirements fields showing which requirements each task addresses
- Tasks should be atomic and in logical order
${outputType !== 'code' ? `
- Remember: Tasks should be about CREATING the artifacts, not executing the subject matter
- Each task should produce a specific section, document, or artifact` : ''}

**Implementation Logging:**
- When implementing tasks, use log-implementation to record what was done
- Implementation logs appear in the dashboard's "Logs" tab
` : ''}

Please read the ${documentType} template and create the comprehensive document at the specified path. STOP after creating - do not auto-validate or auto-submit for approval.`
      }
    }
  ];

  return messages;
}

export const createSpecPrompt: PromptDefinition = {
  prompt,
  handler
};
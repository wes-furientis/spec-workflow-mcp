import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import archetypeRegistry from '../archetypes/archetype-registry.js';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Session state for section-by-section planning
 */
interface PlanningSession {
  docName: string;
  templateFileName: string;
  startedAt: string;
  currentSection: number;
  totalSections: number;
  sections: TemplateSection[];
  answers: Record<string, SectionAnswer>;
  planningContext: string[];
}

interface TemplateSection {
  index: number;
  name: string;
  content: string;
  placeholders: string[];
}

interface SectionAnswer {
  include: 'yes' | 'skip' | 'reference';
  referenceDoc?: string;
  customContent?: string;
  notes?: string;
}

export const getSteeringTemplateTool: Tool = {
  name: 'get-steering-template',
  description: `Start or continue planning a steering document section-by-section.

This tool walks you through each template section interactively:
- First call: starts planning session, returns section 1
- You MUST ask the user about each section before proceeding
- Call steering-planning-respond with answers to get next section
- After all sections: generates draft for approval

DO NOT skip sections or make decisions for the user.`,
  inputSchema: {
    type: 'object',
    properties: {
      docName: {
        type: 'string',
        description: 'Name of the steering document (e.g., "conventions", "documentation")'
      }
    },
    required: ['docName'],
    additionalProperties: false
  }
};

/**
 * Check if planning marker exists (from suggest-plan-mode)
 */
async function isPlanningMarkerSet(projectPath: string, docName: string): Promise<boolean> {
  const markerPath = join(projectPath, '.spec-workflow', '.planning', `${docName}.complete`);
  try {
    await fs.access(markerPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get existing session or null
 */
async function getSession(projectPath: string, docName: string): Promise<PlanningSession | null> {
  const sessionPath = join(projectPath, '.spec-workflow', '.planning', `${docName}-session.json`);
  try {
    const content = await fs.readFile(sessionPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save session state
 */
async function saveSession(projectPath: string, session: PlanningSession): Promise<void> {
  const planningDir = join(projectPath, '.spec-workflow', '.planning');
  await fs.mkdir(planningDir, { recursive: true });
  const sessionPath = join(planningDir, `${session.docName}-session.json`);
  await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
}

/**
 * Read template content from various locations
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

/**
 * Parse template into sections based on ## headers
 */
function parseTemplateSections(content: string): TemplateSection[] {
  const sections: TemplateSection[] = [];
  const lines = content.split('\n');

  let currentSection: TemplateSection | null = null;
  let currentContent: string[] = [];
  let sectionIndex = 0;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // Save previous section
      if (currentSection) {
        currentSection.content = currentContent.join('\n').trim();
        currentSection.placeholders = extractPlaceholders(currentSection.content);
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        index: sectionIndex++,
        name: line.replace('## ', '').trim(),
        content: '',
        placeholders: []
      };
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
    // Skip content before first ## (like # Title)
  }

  // Don't forget last section
  if (currentSection) {
    currentSection.content = currentContent.join('\n').trim();
    currentSection.placeholders = extractPlaceholders(currentSection.content);
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Extract placeholder text from [...] patterns
 */
function extractPlaceholders(content: string): string[] {
  const matches = content.match(/\[([^\]]+)\]/g) || [];
  return matches
    .map(m => m.slice(1, -1))
    .filter(m => m.startsWith('e.g.,') || m.startsWith('Purpose') || m.startsWith('Rule') || !m.includes('/'));
}

/**
 * Read approved context documents
 */
async function readContextDocs(projectPath: string, docNames: string[]): Promise<Record<string, string>> {
  const context: Record<string, string> = {};
  for (const docName of docNames) {
    const filePath = join(projectPath, '.spec-workflow', 'steering', `${docName}.md`);
    try {
      context[docName] = await fs.readFile(filePath, 'utf-8');
    } catch {
      // Doc doesn't exist
    }
  }
  return context;
}

/**
 * Format a section for presentation to user
 * NOTE: Returns summaries instead of full content to reduce context usage
 */
function formatSectionForUser(
  section: TemplateSection,
  currentIndex: number,
  totalSections: number,
  contextDocs: Record<string, string>
): { sectionInfo: any; questions: string[] } {

  // Check if any context docs mention this section topic - return paths, not content
  const relevantContextHints: Record<string, string> = {};
  const sectionKeywords = section.name.toLowerCase().split(' ');

  for (const [docName, content] of Object.entries(contextDocs)) {
    const lowerContent = content.toLowerCase();
    const matchingKeyword = sectionKeywords.find(kw => kw.length > 3 && lowerContent.includes(kw));
    if (matchingKeyword) {
      // Just note the file and line number hint, don't include content
      const lines = content.split('\n');
      const lineIdx = lines.findIndex(line => line.toLowerCase().includes(matchingKeyword));
      if (lineIdx >= 0) {
        relevantContextHints[docName] = `See .spec-workflow/steering/${docName}.md:${lineIdx + 1} (mentions "${matchingKeyword}")`;
      }
    }
  }

  const questions = [
    `Include "${section.name}" section in this document?`,
    'Options: (1) Yes, include (2) Skip this section (3) Reference another doc instead',
    'What specific content or customizations do you want for this section?'
  ];

  if (section.placeholders.length > 0) {
    questions.push(`Template suggests: ${section.placeholders.slice(0, 3).join(', ')}${section.placeholders.length > 3 ? '...' : ''}`);
  }

  // Return summary instead of full template content
  const contentLines = section.content.split('\n').filter(l => l.trim());
  const contentSummary = contentLines.length > 0
    ? `${contentLines.length} lines. First: "${contentLines[0].substring(0, 60)}${contentLines[0].length > 60 ? '...' : ''}"`
    : 'Empty section';

  return {
    sectionInfo: {
      sectionNumber: currentIndex + 1,
      totalSections,
      sectionName: section.name,
      // Return summary instead of full content - agent can Read template file if needed
      templateSummary: contentSummary,
      placeholders: section.placeholders.slice(0, 5), // Limit placeholders
      relevantDocsHints: Object.keys(relevantContextHints).length > 0 ? relevantContextHints : undefined
    },
    questions
  };
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

  // Find doc config
  let templateFileName: string;
  let requiresPlanning = false;
  let planningContext: string[] = [];

  const standardDocs = [...archetype.steering.required, ...archetype.steering.optional];
  if (standardDocs.includes(docName)) {
    templateFileName = `${docName}-template.md`;
    requiresPlanning = false;
  } else {
    const customDoc = archetype.steering.custom.find(d => d.name === docName);
    if (!customDoc) {
      return {
        success: false,
        message: `Unknown steering document: ${docName}`,
        data: {
          validDocs: [...standardDocs, ...archetype.steering.custom.map(d => d.name)]
        },
        nextSteps: ['Call steering-guide to see available documents']
      };
    }
    templateFileName = customDoc.templateFile;
    requiresPlanning = customDoc.requiresPlanning ?? false;
    planningContext = customDoc.planningContext ?? [];
  }

  // Check if planning marker is set (for docs that require planning)
  if (requiresPlanning) {
    const markerSet = await isPlanningMarkerSet(projectPath, docName);
    if (!markerSet) {
      return {
        success: false,
        message: `Planning mode required for ${docName}.md`,
        data: {
          docName,
          requiresPlanning: true,
          planningContext: planningContext.map(d => `.spec-workflow/steering/${d}.md`)
        },
        nextSteps: [
          `Call: suggest-plan-mode taskDescription:"Create ${docName}.md steering document"`,
          'Enter planning mode',
          'Then call get-steering-template again'
        ]
      };
    }
  }

  // Check for existing session
  let session = await getSession(projectPath, docName);

  if (!session) {
    // Start new session - parse template into sections
    const templateContent = await readTemplate(templateFileName, projectPath);
    if (!templateContent) {
      return {
        success: false,
        message: `Template not found: ${templateFileName}`,
        nextSteps: ['Check if templates are installed correctly']
      };
    }

    const sections = parseTemplateSections(templateContent);
    if (sections.length === 0) {
      return {
        success: false,
        message: 'Template has no sections to plan',
        nextSteps: ['Check template format']
      };
    }

    session = {
      docName,
      templateFileName,
      startedAt: new Date().toISOString(),
      currentSection: 0,
      totalSections: sections.length,
      sections,
      answers: {},
      planningContext
    };

    await saveSession(projectPath, session);
  }

  // Get current section
  const currentSection = session.sections[session.currentSection];
  if (!currentSection) {
    return {
      success: false,
      message: 'Invalid session state',
      nextSteps: ['Delete session file and restart planning']
    };
  }

  // Read context docs for relevant info
  const contextDocs = await readContextDocs(projectPath, session.planningContext);
  const { sectionInfo, questions } = formatSectionForUser(
    currentSection,
    session.currentSection,
    session.totalSections,
    contextDocs
  );

  return {
    success: true,
    message: `Section ${session.currentSection + 1} of ${session.totalSections}: ${currentSection.name}`,
    data: {
      planning: true,
      docName,
      ...sectionInfo,
      useAskUserQuestion: {
        question: `Section ${session.currentSection + 1}/${session.totalSections}: Include "${currentSection.name}" in ${docName}.md?`,
        header: currentSection.name,
        options: [
          { label: 'Yes, include', description: 'Include this section with template structure' },
          { label: 'Skip section', description: 'Omit this section entirely' },
          { label: 'Reference other doc', description: 'Point to another steering doc instead' }
        ],
        followUp: 'Any specific content or customizations for this section?'
      },
      instruction: 'YOU MUST use the AskUserQuestion tool to present these options. Do NOT just print them as text.'
    },
    nextSteps: [
      'Call AskUserQuestion with the options provided in useAskUserQuestion',
      'Wait for user selection',
      `Then call: steering-planning-respond docName:"${docName}" include:"yes|skip|reference" notes:"user's answer"`
    ]
  };
}

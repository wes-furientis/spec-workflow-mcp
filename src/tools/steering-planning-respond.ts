import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { promises as fs } from 'fs';
import { join } from 'path';

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

export const steeringPlanningRespondTool: Tool = {
  name: 'steering-planning-respond',
  description: `Submit user's answer for current template section and get next section.

Call this AFTER asking the user about the current section.
Provide the user's decision (include/skip/reference) and any notes they gave.

After all sections are answered, this returns the generated draft.`,
  inputSchema: {
    type: 'object',
    properties: {
      docName: {
        type: 'string',
        description: 'Name of the steering document being planned'
      },
      include: {
        type: 'string',
        enum: ['yes', 'skip', 'reference'],
        description: 'User decision: yes=include section, skip=omit it, reference=point to another doc'
      },
      referenceDoc: {
        type: 'string',
        description: 'If include=reference, which document to reference (e.g., "structure")'
      },
      notes: {
        type: 'string',
        description: 'User notes, customizations, or specific content they want'
      }
    },
    required: ['docName', 'include'],
    additionalProperties: false
  }
};

/**
 * Get existing session
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
 * Delete session after completion
 */
async function deleteSession(projectPath: string, docName: string): Promise<void> {
  const sessionPath = join(projectPath, '.spec-workflow', '.planning', `${docName}-session.json`);
  try {
    await fs.unlink(sessionPath);
  } catch {
    // Ignore if doesn't exist
  }
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
 * Generate the final document draft based on all answers
 */
function generateDraft(session: PlanningSession): string {
  const lines: string[] = [];

  // Get doc title from template filename
  const docTitle = session.docName.charAt(0).toUpperCase() + session.docName.slice(1);
  lines.push(`# ${docTitle}`);
  lines.push('');

  for (const section of session.sections) {
    const answer = session.answers[`section-${section.index}`];

    if (!answer || answer.include === 'skip') {
      continue; // Skip this section
    }

    lines.push(`## ${section.name}`);
    lines.push('');

    if (answer.include === 'reference' && answer.referenceDoc) {
      lines.push(`See [${answer.referenceDoc}.md](./${answer.referenceDoc}.md) for ${section.name.toLowerCase()} details.`);
      if (answer.notes) {
        lines.push('');
        lines.push(`Additional notes: ${answer.notes}`);
      }
    } else {
      // Include section with user customizations
      if (answer.notes) {
        // User provided specific content
        lines.push(answer.notes);
      } else if (answer.customContent) {
        lines.push(answer.customContent);
      } else {
        // Use template content as placeholder
        lines.push(`<!-- TODO: Fill in ${section.name} based on template -->`);
        lines.push('');
        lines.push(section.content);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format next section for presentation
 */
function formatSectionForUser(
  section: TemplateSection,
  currentIndex: number,
  totalSections: number,
  contextDocs: Record<string, string>
): { sectionInfo: any; questions: string[] } {
  const relevantContext: Record<string, string> = {};
  const sectionKeywords = section.name.toLowerCase().split(' ');

  for (const [docName, content] of Object.entries(contextDocs)) {
    const lowerContent = content.toLowerCase();
    if (sectionKeywords.some(kw => kw.length > 3 && lowerContent.includes(kw))) {
      const matchIdx = lowerContent.indexOf(sectionKeywords.find(kw => kw.length > 3 && lowerContent.includes(kw)) || '');
      if (matchIdx !== -1) {
        const start = Math.max(0, matchIdx - 100);
        const end = Math.min(content.length, matchIdx + 400);
        relevantContext[docName] = content.slice(start, end) + '...';
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

  return {
    sectionInfo: {
      sectionNumber: currentIndex + 1,
      totalSections,
      sectionName: section.name,
      templateContent: section.content,
      placeholders: section.placeholders,
      relevantFromApprovedDocs: Object.keys(relevantContext).length > 0 ? relevantContext : undefined
    },
    questions
  };
}

export async function steeringPlanningRespondHandler(
  args: { docName: string; include: string; referenceDoc?: string; notes?: string },
  context: ToolContext
): Promise<ToolResponse> {
  const { docName, include, referenceDoc, notes } = args;

  if (!docName) {
    return {
      success: false,
      message: 'docName is required',
      nextSteps: ['Provide docName parameter']
    };
  }

  if (!['yes', 'skip', 'reference'].includes(include)) {
    return {
      success: false,
      message: 'include must be "yes", "skip", or "reference"',
      nextSteps: ['Provide valid include value']
    };
  }

  if (include === 'reference' && !referenceDoc) {
    return {
      success: false,
      message: 'referenceDoc required when include="reference"',
      nextSteps: ['Provide referenceDoc parameter']
    };
  }

  const projectPath = context.projectPath || process.cwd();

  // Get session
  const session = await getSession(projectPath, docName);
  if (!session) {
    return {
      success: false,
      message: `No planning session found for ${docName}`,
      nextSteps: ['Call get-steering-template first to start a session']
    };
  }

  // Record answer for current section
  const currentSection = session.sections[session.currentSection];
  session.answers[`section-${currentSection.index}`] = {
    include: include as 'yes' | 'skip' | 'reference',
    referenceDoc,
    notes
  };

  // Move to next section
  session.currentSection++;

  // Check if we're done
  if (session.currentSection >= session.totalSections) {
    // Generate final draft
    const draft = generateDraft(session);

    // Clean up session
    await deleteSession(projectPath, docName);

    return {
      success: true,
      message: `Planning complete! Generated draft for ${docName}.md`,
      data: {
        planningComplete: true,
        docName,
        outputPath: `.spec-workflow/steering/${docName}.md`,
        draft,
        sectionsIncluded: Object.entries(session.answers)
          .filter(([_, a]) => a.include !== 'skip')
          .map(([key, _]) => {
            const idx = parseInt(key.replace('section-', ''));
            return session.sections[idx]?.name;
          })
          .filter(Boolean),
        sectionsSkipped: Object.entries(session.answers)
          .filter(([_, a]) => a.include === 'skip')
          .map(([key, _]) => {
            const idx = parseInt(key.replace('section-', ''));
            return session.sections[idx]?.name;
          })
          .filter(Boolean)
      },
      nextSteps: [
        `Write the draft to: .spec-workflow/steering/${docName}.md`,
        'Review and refine the content based on user preferences',
        'Submit for approval: approvals action:"request"'
      ]
    };
  }

  // Save session and return next section
  await saveSession(projectPath, session);

  // Get next section info
  const nextSection = session.sections[session.currentSection];
  const contextDocs = await readContextDocs(projectPath, session.planningContext);
  const { sectionInfo, questions } = formatSectionForUser(
    nextSection,
    session.currentSection,
    session.totalSections,
    contextDocs
  );

  return {
    success: true,
    message: `Recorded answer. Section ${session.currentSection + 1} of ${session.totalSections}: ${nextSection.name}`,
    data: {
      planning: true,
      docName,
      previousSection: currentSection.name,
      previousAnswer: include,
      ...sectionInfo,
      useAskUserQuestion: {
        question: `Section ${session.currentSection + 1}/${session.totalSections}: Include "${nextSection.name}" in ${docName}.md?`,
        header: nextSection.name,
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

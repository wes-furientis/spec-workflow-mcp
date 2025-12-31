import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import archetypeRegistry from '../archetypes/archetype-registry.js';
import { ArchetypeDefinition } from '../archetypes/types.js';

export const steeringGuideTool: Tool = {
  name: 'steering-guide',
  description: `Load guide for creating project steering documents.

# Instructions
Call ONLY when user explicitly requests steering document creation or asks about project architecture docs. Not part of standard spec workflow. Provides templates and guidance for product.md, tech.md, and structure.md creation. Its important that you follow this workflow exactly to avoid errors.

# CRITICAL: Planning Check Required
Before creating ANY steering document, you MUST call the \`suggest-plan-mode\` tool first. If the response returns \`recommendation: "required"\` or \`recommendation: "recommended"\`, you MUST use Claude Code's EnterPlanMode BEFORE creating the document. This ensures complex architectural decisions are properly planned.`,
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false
  }
};

export async function steeringGuideHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  // Get archetype definition if available
  let archetypeDefinition: ArchetypeDefinition | undefined;
  let archetypeWarning: string | undefined;

  if (context.projectArchetype) {
    archetypeDefinition = await archetypeRegistry.get(context.projectArchetype);
  } else {
    // No archetype set - warn the user
    archetypeWarning = `⚠️ NO ARCHETYPE SET

This project does not have an archetype configured. Without an archetype, steering-guide cannot determine:
- Which steering documents are required vs optional
- Which documents require planning mode before creation
- Archetype-specific templates and guidance

REQUIRED ACTION: Set an archetype before creating steering documents.

How to set archetype:
1. Open the dashboard: ${context.dashboardUrl || 'spec-workflow-mcp --dashboard'}
2. Select this project
3. Go to Settings
4. Choose an archetype from the dropdown:
   - greenfield: New projects - includes architecture.md, conventions.md, documentation.md
   - brownfield: Existing codebases - includes legacy.md, migration.md
   - web-app: User-facing web applications - includes ux.md, api.md, deployment.md
   - code-library: Libraries and packages - includes api.md, compatibility.md
   - research-paper: Academic/research documents - includes thesis.md, evidence.md
   - generic: Default (minimal customization)

Once set, call steering-guide again to get archetype-specific guidance.`;
  }

  // Generate the guide with archetype customization
  const guide = getSteeringGuide(archetypeDefinition);

  // Build next steps based on archetype steering configuration
  const nextSteps = buildNextSteps(archetypeDefinition, context.dashboardUrl);

  // If no archetype, prepend warning to next steps
  if (archetypeWarning) {
    nextSteps.unshift('⚠️ REQUIRED: Set archetype in dashboard before creating steering docs');
  }

  return {
    success: !archetypeWarning, // Not fully successful without archetype
    message: archetypeWarning
      ? '⚠️ WARNING: No archetype configured - set one before creating steering documents'
      : archetypeDefinition
        ? `Steering workflow guide loaded for ${archetypeDefinition.displayName} - follow this workflow exactly to avoid errors`
        : 'Steering workflow guide loaded - follow this workflow exactly to avoid errors',
    data: {
      guide: guide,
      dashboardUrl: context.dashboardUrl,
      archetypeWarning: archetypeWarning,
      archetype: archetypeDefinition ? {
        name: archetypeDefinition.name,
        displayName: archetypeDefinition.displayName,
        steering: archetypeDefinition.steering
      } : undefined
    },
    nextSteps: nextSteps
  };
}

/**
 * Build next steps based on archetype configuration
 */
function buildNextSteps(archetype: ArchetypeDefinition | undefined, dashboardUrl?: string): string[] {
  const steps: string[] = ['Only proceed if user requested steering docs'];

  if (!archetype) {
    // Default/generic behavior
    steps.push('Create product.md first');
    steps.push('Then tech.md and structure.md');
  } else {
    // Archetype-specific behavior
    const required = archetype.steering.required;
    const optional = archetype.steering.optional;
    const custom = archetype.steering.custom;

    if (required.length === 0 && optional.length === 0 && custom.length === 0) {
      steps.push('This archetype has no steering documents configured');
      steps.push('Steering docs are optional for this project type');
    } else {
      if (required.length > 0) {
        steps.push(`Create required: ${required.map(d => `${d}.md`).join(', ')}`);
      }
      if (optional.length > 0) {
        steps.push(`Optional: ${optional.map(d => `${d}.md`).join(', ')}`);
      }
      if (custom.length > 0) {
        steps.push(`Custom for ${archetype.displayName}: ${custom.map(d => `${d.name}.md`).join(', ')}`);
      }
    }
  }

  steps.push('Reference in future specs');
  steps.push(dashboardUrl ? `Dashboard: ${dashboardUrl}` : 'Start the dashboard with: spec-workflow-mcp --dashboard');

  return steps;
}

function getSteeringGuide(archetype?: ArchetypeDefinition): string {
  if (!archetype) {
    // No archetype - return default guide with warning
    return getDefaultSteeringGuide();
  }

  // Check what steering docs this archetype has
  const hasStandard = hasStandardSteeringDocs(archetype);
  const hasCustom = archetype.steering.custom.length > 0;

  if (!hasStandard && hasCustom) {
    // Only custom docs (no standard) - use archetype-specific guide
    return getArchetypeSpecificSteeringGuide(archetype);
  }

  if (hasStandard && hasCustom) {
    // BOTH standard and custom docs - generate combined guide
    return getCombinedSteeringGuide(archetype);
  }

  // Only standard docs (or no custom) - use default guide
  return getDefaultSteeringGuide();
}

/**
 * Check if archetype uses standard steering docs (product, tech, structure)
 */
function hasStandardSteeringDocs(archetype: ArchetypeDefinition): boolean {
  const standardDocs = ['product', 'tech', 'structure'];
  const allDocs = [...archetype.steering.required, ...archetype.steering.optional];
  return standardDocs.some(doc => allDocs.includes(doc));
}

/**
 * Generate steering guide for archetypes with BOTH standard and custom docs (e.g., greenfield)
 */
function getCombinedSteeringGuide(archetype: ArchetypeDefinition): string {
  const customDocs = archetype.steering.custom;

  // Identify which docs require planning
  const docsRequiringPlanning = customDocs.filter(d => d.requiresPlanning);
  const planningSection = docsRequiringPlanning.length > 0
    ? `
## CRITICAL: Planning Check Before Creating Documents

Some steering documents in this archetype require planning mode. Before creating these documents, you MUST call \`suggest-plan-mode\` first:

**Documents requiring planning check:**
${docsRequiringPlanning.map(d => `- **${d.name}.md** (context: ${d.planningContext && d.planningContext.length > 0 ? d.planningContext.map(c => `${c}.md`).join(', ') : 'none'})`).join('\n')}

**Process:**
1. Call \`suggest-plan-mode\` with taskDescription: "Create <document-name>.md steering document"
2. If recommendation is "required" or "recommended": Use \`EnterPlanMode\` first
3. Use \`get-planning-context\` to retrieve context documents for planning
4. Complete planning phase before creating the document

**Why this matters:** These documents define foundational project decisions that benefit from structured planning and exploration.
`
    : '';

  // Build all steering docs list
  const allRequiredDocs = archetype.steering.required.map(d => `- **${d}.md**: ${getSteeringDocPurpose(d)}`);
  const allOptionalDocs = archetype.steering.optional.map(d => `- **${d}.md**: ${getSteeringDocPurpose(d)} *(optional)*`);
  const allCustomDocs = customDocs.map(doc => `- **${doc.name}.md**: ${doc.description}${doc.requiresPlanning ? ' ⚠️ *Planning required*' : ''}`);

  // Generate phases for custom docs (standard docs use default phases)
  const customPhases = customDocs.map((doc, index) =>
    generateCustomDocPhase(doc, index + 4, customDocs.length + 3) // Phase 4+ after product/tech/structure
  );

  // Generate file structure - standard templates use -template suffix, custom templates use templateFile directly
  const standardTemplateFiles = ['product-template.md', 'tech-template.md', 'structure-template.md'];
  const customTemplateFiles = customDocs.map(d => d.templateFile);
  const allTemplateFiles = [...standardTemplateFiles, ...customTemplateFiles];

  // Steering doc output files (without -template suffix)
  const standardSteeringFiles = ['product.md', 'tech.md', 'structure.md'];
  const customSteeringFiles = customDocs.map(d => `${d.name}.md`);
  const allSteeringFiles = [...standardSteeringFiles, ...customSteeringFiles];

  return `# Steering Workflow - ${archetype.displayName}

## Overview

Create project-level guidance documents for ${archetype.displayName} projects. ${archetype.description}

**Documentation Focus**: ${archetype.guidance.documentationFocus}

Its important that you follow this workflow exactly to avoid errors.
${planningSection}
## Complete Steering Documents for ${archetype.displayName}

This archetype requires the following steering documents:

### Required (Standard)
${allRequiredDocs.join('\n')}

### Required (${archetype.displayName}-specific)
${allCustomDocs.join('\n')}
${allOptionalDocs.length > 0 ? `
### Optional
${allOptionalDocs.join('\n')}
` : ''}
## Steering Workflow Phases

### Phase 1: Product Document
**Purpose**: Define vision, goals, and user outcomes.

**File Operations**:
- Check for custom template: \`.spec-workflow/user-templates/product-template.md\`
- Read template: \`.spec-workflow/templates/product-template.md\` (if no custom template)
- Create document: \`.spec-workflow/steering/product.md\`

**Tools**:
- steering-guide: Load workflow instructions
- approvals: Manage approval workflow (actions: request, status, delete)

**Process**:
1. Check for custom template at \`.spec-workflow/user-templates/product-template.md\`
2. If no custom template, read from \`.spec-workflow/templates/product-template.md\`
3. Generate product vision and goals
4. Create \`product.md\` at \`.spec-workflow/steering/product.md\`
5. Request approval using approvals tool with action:'request' (filePath only)
6. Poll status using approvals with action:'status' until approved/needs-revision
7. If needs-revision: update document using comments, create NEW approval, do NOT proceed
8. Once approved: use approvals with action:'delete' (must succeed) before proceeding
9. If delete fails: STOP - return to polling

### Phase 2: Tech Document
**Purpose**: Document technology decisions and architecture.

**File Operations**:
- Check for custom template: \`.spec-workflow/user-templates/tech-template.md\`
- Read template: \`.spec-workflow/templates/tech-template.md\` (if no custom template)
- Create document: \`.spec-workflow/steering/tech.md\`

**Process**:
1. Check for custom template at \`.spec-workflow/user-templates/tech-template.md\`
2. If no custom template, read from \`.spec-workflow/templates/tech-template.md\`
3. Analyze existing technology stack
4. Document architectural decisions and patterns
5. Create \`tech.md\` at \`.spec-workflow/steering/tech.md\`
6. Request approval using approvals tool with action:'request'
7. Poll status until approved/needs-revision
8. If needs-revision: update document, create NEW approval, do NOT proceed
9. Once approved: use approvals with action:'delete' before proceeding

### Phase 3: Structure Document
**Purpose**: Map codebase organization and patterns.

**File Operations**:
- Check for custom template: \`.spec-workflow/user-templates/structure-template.md\`
- Read template: \`.spec-workflow/templates/structure-template.md\` (if no custom template)
- Create document: \`.spec-workflow/steering/structure.md\`

**Process**:
1. Check for custom template at \`.spec-workflow/user-templates/structure-template.md\`
2. If no custom template, read from \`.spec-workflow/templates/structure-template.md\`
3. Analyze directory structure and file organization
4. Document coding patterns and conventions
5. Create \`structure.md\` at \`.spec-workflow/steering/structure.md\`
6. Request approval using approvals tool with action:'request'
7. Poll status until approved/needs-revision
8. If needs-revision: update document, create NEW approval, do NOT proceed
9. Once approved: use approvals with action:'delete' before proceeding

${customPhases.join('\n\n')}

## Workflow Rules

- Create documents directly at specified file paths
- Check for custom templates in \`.spec-workflow/user-templates/\` first
- Read templates from \`.spec-workflow/templates/\` directory if no custom template exists
- Follow exact template structures
- Get explicit user approval between phases (using approvals tool with action:'request')
- Complete phases in sequence (no skipping)
- Approval requests: provide filePath only, never content
- BLOCKING: Never proceed if approval delete fails
- CRITICAL: Must have approved status AND successful cleanup before next phase
- CRITICAL: Verbal approval is NEVER accepted - dashboard or VS Code extension only
- NEVER proceed on user saying "approved" - check system status only

## File Structure
\`\`\`
.spec-workflow/
├── templates/           # Auto-populated on server start
${allTemplateFiles.map(f => `│   └── ${f}`).join('\n')}
└── steering/
${allSteeringFiles.map(f => `    └── ${f}`).join('\n')}
\`\`\``;
}

/**
 * Get purpose description for standard steering docs
 */
function getSteeringDocPurpose(docName: string): string {
  switch (docName) {
    case 'product':
      return 'Product vision, target users, key features, success metrics';
    case 'tech':
      return 'Technology stack, dependencies, architectural decisions';
    case 'structure':
      return 'Directory organization, file naming, module boundaries';
    default:
      return 'Project documentation';
  }
}

/**
 * Generate steering guide for archetypes with custom steering configuration
 */
function getArchetypeSpecificSteeringGuide(archetype: ArchetypeDefinition): string {
  const customDocs = archetype.steering.custom;

  if (customDocs.length === 0) {
    // No steering docs configured for this archetype
    return `# Steering Workflow - ${archetype.displayName}

## Overview

This archetype (${archetype.displayName}) does not require standard steering documents (product.md, tech.md, structure.md).

${archetype.description}

## Documentation Focus

${archetype.guidance.documentationFocus}

## Key Considerations

${archetype.guidance.keyConsiderations.map(c => `- ${c}`).join('\n')}

## Note

Steering documents are optional for this project type. You can proceed directly to spec creation using the spec-workflow-guide tool.

If you still want to create project-level documentation, consider creating custom documents in \`.spec-workflow/steering/\` that are relevant to your specific needs.`;
  }

  // Generate guide for custom steering docs
  const phases = customDocs.map((doc, index) => generateCustomDocPhase(doc, index + 1, customDocs.length));
  const fileStructure = generateCustomFileStructure(customDocs);

  // Identify which docs require planning
  const docsRequiringPlanning = customDocs.filter(d => d.requiresPlanning);
  const planningSection = docsRequiringPlanning.length > 0
    ? `

## CRITICAL: Planning Check Before Creating Documents

Some steering documents in this archetype require planning mode. Before creating these documents, you MUST call \`suggest-plan-mode\` first:

**Documents requiring planning check:**
${docsRequiringPlanning.map(d => `- **${d.name}.md** (context: ${d.planningContext && d.planningContext.length > 0 ? d.planningContext.map(c => `${c}.md`).join(', ') : 'none'})`).join('\n')}

**Process:**
1. Call \`suggest-plan-mode\` with taskDescription: "Create <document-name>.md steering document"
2. If recommendation is "required" or "recommended": Use \`EnterPlanMode\` first
3. Use \`get-planning-context\` to retrieve context documents for planning
4. Complete planning phase before creating the document

**Why this matters:** These documents define foundational project decisions that benefit from structured planning and exploration.`
    : '';

  return `# Steering Workflow - ${archetype.displayName}

## Overview

Create project-level guidance documents for ${archetype.displayName} projects. ${archetype.description}

**Documentation Focus**: ${archetype.guidance.documentationFocus}

Its important that you follow this workflow exactly to avoid errors.
${planningSection}

## Steering Documents for ${archetype.displayName}

This archetype uses custom steering documents instead of the standard product.md, tech.md, and structure.md:

${customDocs.map(doc => `- **${doc.name}.md**: ${doc.description}${doc.requiresPlanning ? ' ⚠️ *Planning required*' : ''}`).join('\n')}

## Steering Workflow Phases

${phases.join('\n\n')}

## Workflow Rules

- Create documents directly at specified file paths
- Check for custom templates in \`.spec-workflow/user-templates/\` first
- Read templates from \`.spec-workflow/templates/\` directory if no custom template exists
- Follow exact template structures
- Get explicit user approval between phases (using approvals tool with action:'request')
- Complete phases in sequence (no skipping)
- Approval requests: provide filePath only, never content
- BLOCKING: Never proceed if approval delete fails
- CRITICAL: Must have approved status AND successful cleanup before next phase
- CRITICAL: Verbal approval is NEVER accepted - dashboard or VS Code extension only
- NEVER proceed on user saying "approved" - check system status only

${fileStructure}`;
}

/**
 * Generate a phase section for a custom steering document
 */
function generateCustomDocPhase(
  doc: { name: string; templateFile: string; description: string; requiresPlanning?: boolean; planningContext?: string[] },
  phaseNum: number,
  totalPhases: number
): string {
  const completionMessage = phaseNum === totalPhases
    ? '\n12. After successful cleanup: "Steering docs complete. Ready for spec creation?"'
    : '';

  // Generate planning check step if required
  const planningStep = doc.requiresPlanning
    ? `
**PLANNING CHECK REQUIRED**:
This document requires planning mode before creation. Call \`suggest-plan-mode\` with taskDescription: "Create ${doc.name}.md steering document".
- If recommendation is "required" or "recommended": Use \`EnterPlanMode\` first
- Planning context documents: ${doc.planningContext && doc.planningContext.length > 0 ? doc.planningContext.map(d => `${d}.md`).join(', ') : 'none'}
- Use \`get-planning-context\` to retrieve these documents for planning

`
    : '';

  const stepOffset = doc.requiresPlanning ? 1 : 0;

  return `### Phase ${phaseNum}: ${capitalizeFirst(doc.name)} Document
**Purpose**: ${doc.description}
${planningStep}
**File Operations**:
- Check for custom template: \`.spec-workflow/user-templates/${doc.templateFile}\`
- Read template: \`.spec-workflow/templates/${doc.templateFile}\` (if no custom template)
- Create document: \`.spec-workflow/steering/${doc.name}.md\`

**Tools**:
- suggest-plan-mode: Check if planning is required before creating this document
- get-planning-context: Retrieve steering docs for planning mode
- approvals: Manage approval workflow (actions: request, status, delete)

**Process**:
${doc.requiresPlanning ? `1. FIRST: Call \`suggest-plan-mode\` with taskDescription: "Create ${doc.name}.md steering document"
   - If recommendation is "required" or "recommended": Use \`EnterPlanMode\` before proceeding
   - Complete planning phase before continuing
` : ''}${1 + stepOffset}. Check for custom template at \`.spec-workflow/user-templates/${doc.templateFile}\`
${2 + stepOffset}. If no custom template, read from \`.spec-workflow/templates/${doc.templateFile}\`
${3 + stepOffset}. Generate ${doc.name} content based on project requirements
${4 + stepOffset}. Create \`${doc.name}.md\` at \`.spec-workflow/steering/${doc.name}.md\`
${5 + stepOffset}. Request approval using approvals tool with action:'request' (filePath only)
${6 + stepOffset}. Poll status using approvals with action:'status' until approved/needs-revision (NEVER accept verbal approval)
${7 + stepOffset}. If needs-revision: update document using comments, create NEW approval, do NOT proceed
${8 + stepOffset}. Once approved: use approvals with action:'delete' (must succeed) before proceeding
${9 + stepOffset}. If delete fails: STOP - return to polling${completionMessage}`;
}

/**
 * Generate file structure section for custom steering docs
 */
function generateCustomFileStructure(customDocs: Array<{ name: string; templateFile: string; description: string }>): string {
  const templateFiles = customDocs.map(doc => `│   └── ${doc.templateFile}`).join('\n');
  const steeringFiles = customDocs.map(doc => `    └── ${doc.name}.md`).join('\n');

  return `## File Structure
\`\`\`
.spec-workflow/
├── templates/           # Auto-populated on server start
${templateFiles}
└── steering/
${steeringFiles}
\`\`\``;
}

/**
 * Capitalize first letter of a string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Default steering guide with all standard documents
 */
function getDefaultSteeringGuide(): string {
  return `# Steering Workflow

## Overview

Create project-level guidance documents when explicitly requested. Steering docs establish vision, architecture, and conventions for established codebases. Its important that you follow this workflow exactly to avoid errors.

## CRITICAL: Planning Check Before Creating Documents

Before creating ANY steering document, you MUST call the \`suggest-plan-mode\` tool first:

\`\`\`
suggest-plan-mode with taskDescription: "Create <document-name>.md steering document"
\`\`\`

**If the response returns:**
- \`recommendation: "required"\` → You MUST use \`EnterPlanMode\` before creating the document
- \`recommendation: "recommended"\` → You SHOULD use \`EnterPlanMode\` for best results
- \`recommendation: "optional"\` → You may proceed directly

**Why this matters:** Steering documents define foundational project decisions. Planning mode ensures proper exploration of architecture, trade-offs, and existing patterns before committing to documentation.

**Tools for Planning:**
- \`suggest-plan-mode\`: Check if planning is required
- \`get-planning-context\`: Retrieve existing steering docs to inform planning

## Workflow Diagram

\`\`\`mermaid
flowchart TD
    Start([Start: Setup steering docs]) --> Guide[steering-guide<br/>Load workflow instructions]

    %% Phase 1: Product
    Guide --> P1_Template[Check user-templates first,<br/>then read template:<br/>product-template.md]
    P1_Template --> P1_Generate[Generate vision & goals]
    P1_Generate --> P1_Create[Create file:<br/>.spec-workflow/steering/<br/>product.md]
    P1_Create --> P1_Approve[approvals<br/>action: request<br/>filePath only]
    P1_Approve --> P1_Status[approvals<br/>action: status<br/>poll status]
    P1_Status --> P1_Check{Status?}
    P1_Check -->|needs-revision| P1_Update[Update document using user comments for guidance]
    P1_Update --> P1_Create
    P1_Check -->|approved| P1_Clean[approvals<br/>action: delete]
    P1_Clean -->|failed| P1_Status

    %% Phase 2: Tech
    P1_Clean -->|success| P2_Template[Check user-templates first,<br/>then read template:<br/>tech-template.md]
    P2_Template --> P2_Analyze[Analyze tech stack]
    P2_Analyze --> P2_Create[Create file:<br/>.spec-workflow/steering/<br/>tech.md]
    P2_Create --> P2_Approve[approvals<br/>action: request<br/>filePath only]
    P2_Approve --> P2_Status[approvals<br/>action: status<br/>poll status]
    P2_Status --> P2_Check{Status?}
    P2_Check -->|needs-revision| P2_Update[Update document using user comments for guidance]
    P2_Update --> P2_Create
    P2_Check -->|approved| P2_Clean[approvals<br/>action: delete]
    P2_Clean -->|failed| P2_Status

    %% Phase 3: Structure
    P2_Clean -->|success| P3_Template[Check user-templates first,<br/>then read template:<br/>structure-template.md]
    P3_Template --> P3_Analyze[Analyze codebase structure]
    P3_Analyze --> P3_Create[Create file:<br/>.spec-workflow/steering/<br/>structure.md]
    P3_Create --> P3_Approve[approvals<br/>action: request<br/>filePath only]
    P3_Approve --> P3_Status[approvals<br/>action: status<br/>poll status]
    P3_Status --> P3_Check{Status?}
    P3_Check -->|needs-revision| P3_Update[Update document using user comments for guidance]
    P3_Update --> P3_Create
    P3_Check -->|approved| P3_Clean[approvals<br/>action: delete]
    P3_Clean -->|failed| P3_Status

    P3_Clean -->|success| Complete([Steering docs complete])

    style Start fill:#e6f3ff
    style Complete fill:#e6f3ff
    style P1_Check fill:#ffe6e6
    style P2_Check fill:#ffe6e6
    style P3_Check fill:#ffe6e6
\`\`\`

## Steering Workflow Phases

### Phase 1: Product Document
**Purpose**: Define vision, goals, and user outcomes.

**File Operations**:
- Check for custom template: \`.spec-workflow/user-templates/product-template.md\`
- Read template: \`.spec-workflow/templates/product-template.md\` (if no custom template)
- Create document: \`.spec-workflow/steering/product.md\`

**Tools**:
- steering-guide: Load workflow instructions
- approvals: Manage approval workflow (actions: request, status, delete)

**Process**:
1. Load steering guide for workflow overview
2. Check for custom template at \`.spec-workflow/user-templates/product-template.md\`
3. If no custom template, read from \`.spec-workflow/templates/product-template.md\`
4. Generate product vision and goals
5. Create \`product.md\` at \`.spec-workflow/steering/product.md\`
6. Request approval using approvals tool with action:'request' (filePath only)
7. Poll status using approvals with action:'status' until approved/needs-revision (NEVER accept verbal approval)
8. If needs-revision: update document using comments, create NEW approval, do NOT proceed
9. Once approved: use approvals with action:'delete' (must succeed) before proceeding
10. If delete fails: STOP - return to polling

### Phase 2: Tech Document
**Purpose**: Document technology decisions and architecture.

**File Operations**:
- Check for custom template: \`.spec-workflow/user-templates/tech-template.md\`
- Read template: \`.spec-workflow/templates/tech-template.md\` (if no custom template)
- Create document: \`.spec-workflow/steering/tech.md\`

**Tools**:
- approvals: Manage approval workflow (actions: request, status, delete)

**Process**:
1. Check for custom template at \`.spec-workflow/user-templates/tech-template.md\`
2. If no custom template, read from \`.spec-workflow/templates/tech-template.md\`
3. Analyze existing technology stack
4. Document architectural decisions and patterns
5. Create \`tech.md\` at \`.spec-workflow/steering/tech.md\`
6. Request approval using approvals tool with action:'request'
7. Poll status using approvals with action:'status' until approved/needs-revision
8. If needs-revision: update document using comments, create NEW approval, do NOT proceed
9. Once approved: use approvals with action:'delete' (must succeed) before proceeding
10. If delete fails: STOP - return to polling

### Phase 3: Structure Document
**Purpose**: Map codebase organization and patterns.

**File Operations**:
- Check for custom template: \`.spec-workflow/user-templates/structure-template.md\`
- Read template: \`.spec-workflow/templates/structure-template.md\` (if no custom template)
- Create document: \`.spec-workflow/steering/structure.md\`

**Tools**:
- approvals: Manage approval workflow (actions: request, status, delete)

**Process**:
1. Check for custom template at \`.spec-workflow/user-templates/structure-template.md\`
2. If no custom template, read from \`.spec-workflow/templates/structure-template.md\`
3. Analyze directory structure and file organization
4. Document coding patterns and conventions
5. Create \`structure.md\` at \`.spec-workflow/steering/structure.md\`
6. Request approval using approvals tool with action:'request'
7. Poll status using approvals with action:'status' until approved/needs-revision
8. If needs-revision: update document using comments, create NEW approval, do NOT proceed
9. Once approved: use approvals with action:'delete' (must succeed) before proceeding
10. If delete fails: STOP - return to polling
11. After successful cleanup: "Steering docs complete. Ready for spec creation?"

## Workflow Rules

- Create documents directly at specified file paths
- Check for custom templates in \`.spec-workflow/user-templates/\` first
- Read templates from \`.spec-workflow/templates/\` directory if no custom template exists
- Follow exact template structures
- Get explicit user approval between phases (using approvals tool with action:'request')
- Complete phases in sequence (no skipping)
- Approval requests: provide filePath only, never content
- BLOCKING: Never proceed if approval delete fails
- CRITICAL: Must have approved status AND successful cleanup before next phase
- CRITICAL: Verbal approval is NEVER accepted - dashboard or VS Code extension only
- NEVER proceed on user saying "approved" - check system status only

## File Structure
\`\`\`
.spec-workflow/
├── templates/           # Auto-populated on server start
│   ├── product-template.md
│   ├── tech-template.md
│   └── structure-template.md
└── steering/
    ├── product.md
    ├── tech.md
    └── structure.md
\`\`\``;
}
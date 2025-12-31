import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import archetypeRegistry from '../archetypes/archetype-registry.js';
import { ArchetypeDefinition } from '../archetypes/types.js';
import { ApprovalStorage, ApprovalRequest } from '../dashboard/approval-storage.js';
import { PathUtils } from '../core/path-utils.js';
import { promises as fs } from 'fs';
import { join } from 'path';

interface SteeringDocStatus {
  name: string;
  fileName: string;
  status: 'not-created' | 'draft' | 'pending-approval' | 'needs-revision' | 'approved';
  requiresPlanning: boolean;
  description: string;
  approvalId?: string;
}

/**
 * Get all steering approvals for a project
 */
async function getSteeringApprovals(projectPath: string): Promise<ApprovalRequest[]> {
  try {
    const translatedPath = PathUtils.translatePath(projectPath);
    const approvalStorage = new ApprovalStorage(translatedPath, projectPath);
    await approvalStorage.start();
    const allApprovals = await approvalStorage.getAllApprovals();
    await approvalStorage.stop();
    return allApprovals.filter(a => a.category === 'steering');
  } catch {
    return [];
  }
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get status for a steering document
 */
async function getDocStatus(
  docName: string,
  fileName: string,
  requiresPlanning: boolean,
  description: string,
  steeringDir: string,
  approvals: ApprovalRequest[]
): Promise<SteeringDocStatus> {
  const filePath = join(steeringDir, `${docName}.md`);
  const relativePath = `.spec-workflow/steering/${docName}.md`;
  const exists = await fileExists(filePath);

  // Find approval for this file
  const fileApprovals = approvals.filter(a => a.filePath === relativePath);
  fileApprovals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const latestApproval = fileApprovals[0];

  let status: SteeringDocStatus['status'];
  let approvalId: string | undefined;

  if (!exists) {
    status = 'not-created';
  } else if (latestApproval?.status === 'approved') {
    status = 'approved';
  } else if (latestApproval?.status === 'pending') {
    status = 'pending-approval';
    approvalId = latestApproval.id;
  } else if (latestApproval?.status === 'needs-revision') {
    status = 'needs-revision';
    approvalId = latestApproval.id;
  } else {
    status = 'draft';
  }

  return { name: docName, fileName, status, requiresPlanning, description, approvalId };
}

export const steeringGuideTool: Tool = {
  name: 'steering-guide',
  description: `Get status of steering documents for this project.

Returns which documents exist, their approval status, and what to do next.
Does NOT return templates or workflow details - call get-steering-template for that.`,
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false
  }
};

export async function steeringGuideHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  // No archetype = can't proceed
  if (!context.projectArchetype) {
    return {
      success: false,
      message: 'No archetype configured',
      data: {
        error: 'archetype-required',
        howToFix: `Set archetype in dashboard: ${context.dashboardUrl || 'spec-workflow-mcp --dashboard'}`
      },
      nextSteps: ['Set archetype in dashboard before creating steering docs']
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
  const steeringDir = join(projectPath, '.spec-workflow', 'steering');
  const approvals = await getSteeringApprovals(projectPath);

  // Build status for all steering docs
  const docs: SteeringDocStatus[] = [];

  // Standard docs (product, tech, structure)
  for (const docName of archetype.steering.required) {
    docs.push(await getDocStatus(
      docName,
      `${docName}-template.md`,
      false,
      getStandardDocDescription(docName),
      steeringDir,
      approvals
    ));
  }

  for (const docName of archetype.steering.optional) {
    docs.push(await getDocStatus(
      docName,
      `${docName}-template.md`,
      false,
      getStandardDocDescription(docName),
      steeringDir,
      approvals
    ));
  }

  // Custom docs
  for (const custom of archetype.steering.custom) {
    docs.push(await getDocStatus(
      custom.name,
      custom.templateFile,
      custom.requiresPlanning ?? false,
      custom.description,
      steeringDir,
      approvals
    ));
  }

  // Determine what to do next - respects document order
  // Find first doc that isn't approved (docs are already in correct order: required → optional → custom)
  const nextDoc = docs.find(d => d.status !== 'approved');

  let nextAction: string;
  let blocked = false;

  if (!nextDoc) {
    nextAction = 'All steering docs complete!';
  } else {
    switch (nextDoc.status) {
      case 'pending-approval':
        nextAction = `BLOCKED: "${nextDoc.name}.md" awaiting approval. Check dashboard or call: approvals action:"status" approvalId:"${nextDoc.approvalId}"`;
        blocked = true;
        break;
      case 'needs-revision':
        nextAction = `BLOCKED: "${nextDoc.name}.md" needs revision. Update doc, then create new approval.`;
        blocked = true;
        break;
      case 'draft':
        nextAction = `"${nextDoc.name}.md" exists but not approved. Submit for approval: approvals action:"request"`;
        blocked = true;
        break;
      case 'not-created':
        if (nextDoc.requiresPlanning) {
          nextAction = `Create "${nextDoc.name}.md" - PLANNING REQUIRED. Call: suggest-plan-mode taskDescription:"Create ${nextDoc.name}.md"`;
        } else {
          nextAction = `Create "${nextDoc.name}.md". Call: get-steering-template docName:"${nextDoc.name}"`;
        }
        break;
      default:
        nextAction = `Unknown status for "${nextDoc.name}.md"`;
    }
  }

  return {
    success: !blocked,
    message: blocked ? 'Workflow blocked - resolve before continuing' : `Steering status for ${archetype.displayName}`,
    data: {
      archetype: archetype.name,
      documents: docs,
      summary: {
        approved: docs.filter(d => d.status === 'approved').length,
        notCreated: docs.filter(d => d.status === 'not-created').length,
        draft: docs.filter(d => d.status === 'draft').length,
        pendingApproval: docs.filter(d => d.status === 'pending-approval').length,
        needsRevision: docs.filter(d => d.status === 'needs-revision').length
      }
    },
    nextSteps: [nextAction]
  };
}

function getStandardDocDescription(docName: string): string {
  switch (docName) {
    case 'product': return 'Product vision, target users, key features';
    case 'tech': return 'Technology stack, dependencies, architecture';
    case 'structure': return 'Directory organization, file patterns';
    default: return 'Project documentation';
  }
}

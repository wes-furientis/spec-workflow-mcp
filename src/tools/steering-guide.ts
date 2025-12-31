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
  status: 'missing' | 'pending-approval' | 'needs-revision' | 'complete' | 'unapproved';
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
    status = 'missing';
  } else if (latestApproval?.status === 'approved') {
    status = 'complete';
  } else if (latestApproval?.status === 'pending') {
    status = 'pending-approval';
    approvalId = latestApproval.id;
  } else if (latestApproval?.status === 'needs-revision') {
    status = 'needs-revision';
    approvalId = latestApproval.id;
  } else {
    status = 'unapproved';
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

  // Determine what to do next
  const pendingApproval = docs.find(d => d.status === 'pending-approval');
  const needsRevision = docs.find(d => d.status === 'needs-revision');
  const unapproved = docs.find(d => d.status === 'unapproved');
  const missing = docs.find(d => d.status === 'missing');

  let nextAction: string;
  let blocked = false;

  if (pendingApproval) {
    nextAction = `BLOCKED: "${pendingApproval.name}.md" awaiting approval. Check dashboard or call: approvals action:"status" approvalId:"${pendingApproval.approvalId}"`;
    blocked = true;
  } else if (needsRevision) {
    nextAction = `BLOCKED: "${needsRevision.name}.md" needs revision. Update doc, then create new approval.`;
    blocked = true;
  } else if (unapproved) {
    nextAction = `"${unapproved.name}.md" exists but not approved. Submit for approval: approvals action:"request"`;
    blocked = true;
  } else if (missing) {
    if (missing.requiresPlanning) {
      nextAction = `Create "${missing.name}.md" - PLANNING REQUIRED. Call: suggest-plan-mode taskDescription:"Create ${missing.name}.md"`;
    } else {
      nextAction = `Create "${missing.name}.md". Call: get-steering-template docName:"${missing.name}"`;
    }
  } else {
    nextAction = 'All steering docs complete!';
  }

  return {
    success: !blocked,
    message: blocked ? 'Workflow blocked - resolve before continuing' : `Steering status for ${archetype.displayName}`,
    data: {
      archetype: archetype.name,
      documents: docs,
      summary: {
        complete: docs.filter(d => d.status === 'complete').length,
        missing: docs.filter(d => d.status === 'missing').length,
        pendingApproval: docs.filter(d => d.status === 'pending-approval').length,
        needsRevision: docs.filter(d => d.status === 'needs-revision').length,
        unapproved: docs.filter(d => d.status === 'unapproved').length
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

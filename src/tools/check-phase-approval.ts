/**
 * Check Phase Approval Tool
 *
 * A simple tool that checks if a phase has been approved in the system.
 * This should be called by Ralph loops before proceeding to the next phase.
 *
 * CRITICAL: This tool verifies approval status from the actual approval records,
 * NOT from verbal user confirmation. Agents must call this tool and receive
 * a "canProceed: true" response before continuing.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { ApprovalStorage } from '../dashboard/approval-storage.js';
import { validateProjectPath, PathUtils } from '../core/path-utils.js';

export const checkPhaseApprovalTool: Tool = {
  name: 'check-phase-approval',
  description: `REQUIRED before proceeding to next phase. Verifies approval status from system records.

CRITICAL: Verbal user confirmation is NOT accepted. You MUST call this tool and receive canProceed:true before continuing to the next phase.

Returns:
- canProceed: true - Phase is approved, you may continue
- canProceed: false - Phase is NOT approved, you MUST STOP and wait`,
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Absolute path to the project root'
      },
      phase: {
        type: 'string',
        enum: ['steering', 'requirements', 'design', 'tasks'],
        description: 'The phase to check approval for'
      },
      specName: {
        type: 'string',
        description: 'Name of the spec (required for requirements, design, tasks phases)'
      },
      docName: {
        type: 'string',
        description: 'Name of the steering document (required for steering phase)'
      }
    },
    required: ['phase']
  }
};

export async function checkPhaseApprovalHandler(
  args: {
    projectPath?: string;
    phase: 'steering' | 'requirements' | 'design' | 'tasks';
    specName?: string;
    docName?: string;
  },
  context: ToolContext
): Promise<ToolResponse> {
  const projectPath = args.projectPath || context.projectPath;

  if (!projectPath) {
    return {
      success: false,
      message: 'Project path is required',
      data: { canProceed: false }
    };
  }

  // Validate phase-specific requirements
  if (args.phase === 'steering' && !args.docName) {
    return {
      success: false,
      message: 'docName is required for steering phase check',
      data: { canProceed: false }
    };
  }

  if (['requirements', 'design', 'tasks'].includes(args.phase) && !args.specName) {
    return {
      success: false,
      message: `specName is required for ${args.phase} phase check`,
      data: { canProceed: false }
    };
  }

  try {
    const validatedProjectPath = await validateProjectPath(projectPath);
    const translatedPath = PathUtils.translatePath(validatedProjectPath);

    const approvalStorage = new ApprovalStorage(translatedPath, validatedProjectPath);
    await approvalStorage.start();

    // Get all approvals and find the matching one
    const allApprovals = await approvalStorage.getAllApprovals();
    await approvalStorage.stop();

    // Build the expected file path pattern
    let expectedPathPattern: RegExp;
    if (args.phase === 'steering') {
      expectedPathPattern = new RegExp(`steering/${args.docName}\\.md$`);
    } else {
      expectedPathPattern = new RegExp(`specs/${args.specName}/${args.phase}\\.md$`);
    }

    // Find matching approval
    const matchingApproval = allApprovals.find(a =>
      a.filePath && expectedPathPattern.test(a.filePath)
    );

    if (!matchingApproval) {
      return {
        success: true,
        message: `NO APPROVAL FOUND for ${args.phase}. You must request approval first.`,
        data: {
          canProceed: false,
          phase: args.phase,
          specName: args.specName,
          docName: args.docName,
          status: 'not-requested',
          reason: 'No approval request exists for this phase'
        },
        nextSteps: [
          'BLOCKED - Cannot proceed',
          'Create an approval request first using the approvals tool',
          'Wait for dashboard approval',
          'Then call check-phase-approval again'
        ]
      };
    }

    const isApproved = matchingApproval.status === 'approved';
    const canProceed = isApproved;

    if (canProceed) {
      return {
        success: true,
        message: `APPROVED - ${args.phase} phase is approved. You may proceed.`,
        data: {
          canProceed: true,
          phase: args.phase,
          specName: args.specName,
          docName: args.docName,
          status: matchingApproval.status,
          approvalId: matchingApproval.id,
          approvedAt: matchingApproval.respondedAt
        },
        nextSteps: [
          'Proceed to next phase',
          `Delete approval with: approvals action:"delete" approvalId:"${matchingApproval.id}"`
        ]
      };
    } else {
      return {
        success: true,
        message: `BLOCKED - ${args.phase} phase is NOT approved. Status: ${matchingApproval.status}`,
        data: {
          canProceed: false,
          phase: args.phase,
          specName: args.specName,
          docName: args.docName,
          status: matchingApproval.status,
          approvalId: matchingApproval.id,
          reason: matchingApproval.status === 'pending'
            ? 'Awaiting dashboard approval'
            : matchingApproval.status === 'needs-revision'
            ? 'Revisions requested - fix and re-request'
            : 'Rejected - review feedback'
        },
        nextSteps: [
          'STOP - Do not proceed',
          'VERBAL APPROVAL NOT ACCEPTED',
          matchingApproval.status === 'pending'
            ? 'Wait for dashboard approval, then call check-phase-approval again'
            : matchingApproval.status === 'needs-revision'
            ? 'Address revision feedback, then create new approval request'
            : 'Review rejection feedback'
        ]
      };
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to check approval status: ${errorMessage}`,
      data: { canProceed: false }
    };
  }
}

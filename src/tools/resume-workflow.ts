import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import {
  readWorkflowState,
  WorkflowState,
  WorkflowPhase,
  isSpecReadyForImplementation,
  getImplementationBlockers
} from '../core/workflow-state.js';
import { ApprovalStorage } from '../dashboard/approval-storage.js';
import { PathUtils } from '../core/path-utils.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import archetypeRegistry from '../archetypes/archetype-registry.js';

export const resumeWorkflowTool: Tool = {
  name: 'resume-workflow',
  description: `Resume an interrupted workflow or check current workflow status.

Returns:
- Current phase (steering, requirements, design, tasks, implementation)
- What's been completed and approved
- What needs to be done next
- Blocks implementation if specs not fully approved

Call this tool:
- At the start of a new conversation to understand where you left off
- Before starting implementation to verify all approvals are in place
- When unsure about workflow status`,
  inputSchema: {
    type: 'object',
    properties: {
      specName: {
        type: 'string',
        description: 'Optional: Check status for a specific spec'
      },
      action: {
        type: 'string',
        enum: ['status', 'validate-for-implementation'],
        description: 'status = show current state, validate-for-implementation = check if ready to implement'
      }
    },
    additionalProperties: false
  }
};

interface ValidationResult {
  valid: boolean;
  issues: string[];
}

/**
 * Validate state against actual files
 */
async function validateStateAgainstFiles(
  projectPath: string,
  state: WorkflowState,
  approvalStorage: ApprovalStorage
): Promise<ValidationResult> {
  const issues: string[] = [];

  // Check steering documents exist
  for (const [docName, record] of Object.entries(state.steering.documents)) {
    if (record.status === 'approved') {
      const filePath = join(projectPath, '.spec-workflow', 'steering', `${docName}.md`);
      try {
        await fs.access(filePath);
      } catch {
        issues.push(`Steering doc '${docName}' marked as approved but file not found`);
      }
    }
  }

  // Check spec files exist
  for (const [specName, spec] of Object.entries(state.activeSpecs)) {
    const specDir = join(projectPath, '.spec-workflow', 'specs', specName);

    for (const phase of ['requirements', 'design', 'tasks'] as const) {
      if (spec.phases[phase].status === 'approved') {
        const filePath = join(specDir, `${phase}.md`);
        try {
          await fs.access(filePath);
        } catch {
          issues.push(`Spec '${specName}' ${phase}.md marked as approved but file not found`);
        }
      }
    }
  }

  // Check for pending approvals that might have been resolved
  const allApprovals = await approvalStorage.getAllApprovals();
  const pendingApprovals = allApprovals.filter(a => a.status === 'pending');

  for (const approval of pendingApprovals) {
    // Check if state knows about this pending approval
    const isTracked = Object.values(state.steering.documents).some(d => d.approvalId === approval.id) ||
      Object.values(state.activeSpecs).some(spec =>
        Object.values(spec.phases).some(p => p.approvalId === approval.id)
      );

    if (!isTracked) {
      issues.push(`Pending approval '${approval.title}' not tracked in state`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Build a summary of current workflow status
 */
function buildStatusSummary(
  state: WorkflowState,
  archetype: any | null,
  pendingApprovals: any[]
): {
  phase: WorkflowPhase;
  summary: string;
  steering: any;
  specs: any;
  nextActions: string[];
} {
  const nextActions: string[] = [];

  // Steering status
  const steeringDocs = Object.entries(state.steering.documents);
  const steeringApproved = steeringDocs.filter(([_, d]) => d.status === 'approved').length;
  const steeringTotal = archetype?.steering ?
    (archetype.steering.required?.length || 0) + (archetype.steering.optional?.length || 0) + (archetype.steering.custom?.length || 0) :
    steeringDocs.length;

  const steeringSummary = {
    status: state.steering.status,
    approved: steeringApproved,
    total: steeringTotal,
    documents: state.steering.documents
  };

  // Specs status
  const specsSummary = Object.entries(state.activeSpecs).map(([name, spec]) => ({
    name,
    requirements: spec.phases.requirements.status,
    design: spec.phases.design.status,
    tasks: spec.phases.tasks.status,
    readyForImplementation: isSpecReadyForImplementation(spec),
    blockers: isSpecReadyForImplementation(spec) ? [] : getImplementationBlockers(spec)
  }));

  // Determine next actions
  if (state.steering.status !== 'approved') {
    if (pendingApprovals.some(a => a.category === 'steering')) {
      nextActions.push('BLOCKED: Steering document awaiting approval in dashboard');
    } else {
      nextActions.push('Call: steering-guide to see which steering docs need work');
    }
  } else if (Object.keys(state.activeSpecs).length === 0) {
    nextActions.push('Steering complete! Call: spec-workflow-guide to start a new spec');
  } else {
    const currentSpec = state.activeSpecs[state.currentSpec || ''];
    if (currentSpec) {
      if (!isSpecReadyForImplementation(currentSpec)) {
        const blockers = getImplementationBlockers(currentSpec);
        if (pendingApprovals.some(a => a.category === 'spec')) {
          nextActions.push(`BLOCKED: Spec document awaiting approval in dashboard`);
        } else {
          nextActions.push(`Spec '${state.currentSpec}' not ready for implementation:`);
          blockers.forEach(b => nextActions.push(`  - ${b}`));
          nextActions.push('Call: spec-workflow-guide to continue');
        }
      } else {
        nextActions.push(`Spec '${state.currentSpec}' is READY for implementation!`);
        nextActions.push('Proceed with implementing tasks from tasks.md');
      }
    }
  }

  // Overall summary
  let summary: string;
  if (state.steering.status !== 'approved') {
    summary = `Steering phase: ${steeringApproved}/${steeringTotal} documents approved`;
  } else if (Object.keys(state.activeSpecs).length === 0) {
    summary = 'Steering complete, no active specs';
  } else {
    const readySpecs = specsSummary.filter(s => s.readyForImplementation).length;
    summary = `${readySpecs}/${specsSummary.length} specs ready for implementation`;
  }

  return {
    phase: state.currentPhase,
    summary,
    steering: steeringSummary,
    specs: specsSummary,
    nextActions
  };
}

export async function resumeWorkflowHandler(
  args: { specName?: string; action?: string },
  context: ToolContext
): Promise<ToolResponse> {
  const action = args.action || 'status';
  const projectPath = context.projectPath || process.cwd();

  // Read current state
  const state = await readWorkflowState(projectPath);

  // Get archetype for context
  let archetype = null;
  if (context.projectArchetype) {
    archetype = await archetypeRegistry.get(context.projectArchetype);
  }

  // Get pending approvals
  const translatedPath = PathUtils.translatePath(projectPath);
  const approvalStorage = new ApprovalStorage(translatedPath, projectPath);
  await approvalStorage.start();
  const allApprovals = await approvalStorage.getAllApprovals();
  const pendingApprovals = allApprovals.filter(a => a.status === 'pending');
  await approvalStorage.stop();

  // Validate state against files
  const validation = await validateStateAgainstFiles(projectPath, state, approvalStorage);

  if (action === 'validate-for-implementation') {
    // Check if specific spec or any spec is ready
    const specName = args.specName || state.currentSpec;

    if (!specName) {
      return {
        success: false,
        message: 'No spec specified and no current spec in workflow state',
        data: {
          state,
          pendingApprovals: pendingApprovals.length
        },
        nextSteps: ['Specify specName parameter or create a spec first']
      };
    }

    const spec = state.activeSpecs[specName];
    if (!spec) {
      return {
        success: false,
        message: `Spec '${specName}' not found in workflow state`,
        data: {
          availableSpecs: Object.keys(state.activeSpecs)
        },
        nextSteps: ['Check spec name or create the spec first']
      };
    }

    if (!isSpecReadyForImplementation(spec)) {
      const blockers = getImplementationBlockers(spec);
      return {
        success: false,
        message: `⚠️ CANNOT PROCEED - Spec '${specName}' is not ready for implementation`,
        data: {
          specName,
          phases: spec.phases,
          blockers,
          pendingApprovals: pendingApprovals.filter(a => a.category === 'spec').map(a => ({
            id: a.id,
            title: a.title,
            status: a.status
          }))
        },
        nextSteps: [
          'BLOCKED: Complete all spec phases and get approvals',
          ...blockers.map(b => `Fix: ${b}`),
          'Call: spec-workflow-guide to continue spec development'
        ]
      };
    }

    return {
      success: true,
      message: `✅ Spec '${specName}' is READY for implementation`,
      data: {
        specName,
        phases: spec.phases,
        implementationProgress: spec.implementationProgress
      },
      nextSteps: [
        'Proceed with implementation',
        `Read tasks from: .spec-workflow/specs/${specName}/tasks.md`,
        'Use log-implementation to track progress'
      ]
    };
  }

  // Default: status action
  const status = buildStatusSummary(state, archetype, pendingApprovals);

  return {
    success: true,
    message: status.summary,
    data: {
      currentPhase: status.phase,
      currentSpec: state.currentSpec,
      lastAction: state.lastAction,
      lastUpdated: state.lastUpdated,
      steering: status.steering,
      specs: status.specs,
      pendingApprovals: pendingApprovals.map(a => ({
        id: a.id,
        title: a.title,
        category: a.category,
        filePath: a.filePath
      })),
      validation: validation.valid ? 'OK' : { issues: validation.issues }
    },
    nextSteps: status.nextActions
  };
}

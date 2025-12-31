import { promises as fs } from 'fs';
import { join } from 'path';
import { ProjectRegistry, generateProjectId } from '../core/project-registry.js';
import { readWorkflowState, writeWorkflowState, WorkflowState } from '../core/workflow-state.js';
import { resolve } from 'path';
import { ToolContext, ToolResponse } from '../types.js';

/**
 * Find all steering documents in the project
 */
async function findSteeringDocs(projectPath: string): Promise<string[]> {
  const steeringDir = join(projectPath, '.spec-workflow', 'steering');
  try {
    const files = await fs.readdir(steeringDir);
    return files
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, ''));
  } catch {
    return [];
  }
}

/**
 * Mark steering docs for re-review after archetype transition (#11)
 */
async function markSteeringDocsForReReview(
  projectPath: string,
  state: WorkflowState,
  fromArchetype: string | null,
  toArchetype: string
): Promise<{ markedDocs: string[]; reReviewNote: string }> {
  const steeringDocs = await findSteeringDocs(projectPath);
  const markedDocs: string[] = [];

  // Add re-review markers to the state
  if (!(state as any).steeringReReview) {
    (state as any).steeringReReview = {};
  }

  const timestamp = new Date().toISOString();
  for (const doc of steeringDocs) {
    // Check if doc exists in steering documents state
    if (state.steering.documents[doc]?.status === 'approved') {
      (state as any).steeringReReview[doc] = {
        markedAt: timestamp,
        reason: `Archetype transition from '${fromArchetype}' to '${toArchetype}'`,
        status: 'pending-review'
      };
      markedDocs.push(doc);
    }
  }

  const reReviewNote = markedDocs.length > 0
    ? `${markedDocs.length} steering doc(s) marked for re-review: ${markedDocs.join(', ')}. ` +
      `Review these docs to add transition annotations like "[!NOTE] Established pattern from ${fromArchetype} phase".`
    : 'No approved steering docs found to mark for re-review.';

  return { markedDocs, reReviewNote };
}

/**
 * Get the project version from package.json
 */
async function getProjectVersion(projectPath: string): Promise<string | null> {
  try {
    const pkgPath = join(projectPath, 'package.json');
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    return pkg.version || null;
  } catch {
    return null;
  }
}

/**
 * Parse semver version into components
 */
function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10)
  };
}

/**
 * Check if version indicates project has reached 1.0.0 milestone
 */
function isAtOrBeyondV1(version: string): boolean {
  const parsed = parseSemver(version);
  if (!parsed) return false;
  return parsed.major >= 1;
}

/**
 * Archetype transition tool handler
 */
export async function handleArchetypeTransition(
  projectPath: string,
  projectId: string,
  action: 'check' | 'transition',
  targetArchetype?: string
): Promise<{
  shouldTransition: boolean;
  currentArchetype: string | null;
  suggestedArchetype?: string;
  version?: string;
  message: string;
  transitioned?: boolean;
  transitionNote?: string;
  steeringDocsMarkedForReReview?: string[];
}> {
  const registry = new ProjectRegistry();
  const currentArchetype = await registry.getArchetype(projectId);
  const version = await getProjectVersion(projectPath);

  if (action === 'check') {
    // Check if transition should be suggested

    // Only suggest transition for greenfield projects
    if (currentArchetype !== 'greenfield') {
      return {
        shouldTransition: false,
        currentArchetype,
        version: version || undefined,
        message: `Project archetype is '${currentArchetype || 'not set'}'. No transition suggested.`
      };
    }

    // Check if version is at or beyond 1.0.0
    if (!version) {
      return {
        shouldTransition: false,
        currentArchetype,
        message: 'No package.json version found. Cannot determine if transition is appropriate.'
      };
    }

    if (!isAtOrBeyondV1(version)) {
      return {
        shouldTransition: false,
        currentArchetype,
        version,
        message: `Project version is ${version}. Transition to brownfield is typically suggested at v1.0.0 or later.`
      };
    }

    // Suggest transition
    return {
      shouldTransition: true,
      currentArchetype,
      suggestedArchetype: 'brownfield',
      version,
      message: `Project has reached version ${version}. Consider transitioning from greenfield to brownfield archetype. ` +
        `This will shift guidance from "establishing patterns" to "maintaining and extending established patterns". ` +
        `Use action='transition' to proceed.`
    };
  }

  if (action === 'transition') {
    // Perform the transition
    const newArchetype = targetArchetype || 'brownfield';

    // Validate target archetype exists
    try {
      const { loadArchetype } = await import('../archetypes/archetype-loader.js');
      await loadArchetype(newArchetype);
    } catch {
      return {
        shouldTransition: false,
        currentArchetype,
        message: `Invalid target archetype: '${newArchetype}'`
      };
    }

    // Update the archetype in registry
    await registry.setArchetype(projectId, newArchetype);

    // Record transition in workflow state
    const state = await readWorkflowState(projectPath);

    // Add transition record to state
    const transitionNote = `Transitioned from '${currentArchetype}' to '${newArchetype}' at version ${version || 'unknown'} on ${new Date().toISOString()}`;

    // Store transition history in state (create if needed)
    if (!(state as any).archetypeTransitions) {
      (state as any).archetypeTransitions = [];
    }
    (state as any).archetypeTransitions.push({
      from: currentArchetype,
      to: newArchetype,
      version: version || null,
      timestamp: new Date().toISOString(),
      note: transitionNote
    });

    // Mark steering docs for re-review (#11)
    const { markedDocs, reReviewNote } = await markSteeringDocsForReReview(
      projectPath,
      state,
      currentArchetype,
      newArchetype
    );

    state.lastAction = `archetype-transition:${currentArchetype}→${newArchetype}`;
    await writeWorkflowState(projectPath, state);

    return {
      shouldTransition: false, // Already done
      currentArchetype: newArchetype,
      version: version || undefined,
      message: `Successfully transitioned from '${currentArchetype}' to '${newArchetype}'. ` +
        `Guidance will now focus on maintaining established patterns rather than establishing new ones. ` +
        reReviewNote,
      transitioned: true,
      transitionNote,
      steeringDocsMarkedForReReview: markedDocs.length > 0 ? markedDocs : undefined
    };
  }

  return {
    shouldTransition: false,
    currentArchetype,
    message: `Unknown action: ${action}. Use 'check' or 'transition'.`
  };
}

/**
 * MCP tool definition for archetype-transition
 */
export const archetypeTransitionTool = {
  name: 'archetype-transition',
  description: 'Check if project should transition archetypes (e.g., greenfield → brownfield at v1.0.0) or perform the transition. ' +
    'Use action="check" to see if transition is recommended. Use action="transition" to perform it.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['check', 'transition'],
        description: 'Action to perform: "check" to see if transition is suggested, "transition" to perform it'
      },
      targetArchetype: {
        type: 'string',
        description: 'Target archetype for transition (default: brownfield). Only used with action="transition".'
      }
    },
    required: ['action']
  }
};

/**
 * Handler for the archetype-transition tool
 */
export async function archetypeTransitionHandler(
  args: { action: 'check' | 'transition'; targetArchetype?: string },
  context: ToolContext
): Promise<ToolResponse> {
  const projectPath = context.projectPath;
  const projectId = generateProjectId(resolve(projectPath));

  const result = await handleArchetypeTransition(
    projectPath,
    projectId,
    args.action,
    args.targetArchetype
  );

  return {
    success: true,
    message: result.message,
    data: result
  };
}

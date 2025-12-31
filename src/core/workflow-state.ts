import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Workflow phases in order
 */
export type WorkflowPhase = 'steering' | 'requirements' | 'design' | 'tasks' | 'implementation';

/**
 * Status of a phase
 */
export type PhaseStatus = 'not-started' | 'in-progress' | 'pending-approval' | 'approved' | 'needs-revision';

/**
 * Phase completion record
 */
export interface PhaseRecord {
  status: PhaseStatus;
  startedAt?: string;
  completedAt?: string;
  approvalId?: string;
}

/**
 * Active spec tracking
 */
export interface ActiveSpec {
  name: string;
  phases: {
    requirements: PhaseRecord;
    design: PhaseRecord;
    tasks: PhaseRecord;
  };
  implementationProgress?: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: string[];
  };
}

/**
 * Full workflow state
 */
export interface WorkflowState {
  version: 1;
  lastUpdated: string;
  lastAction: string;

  // Steering phase
  steering: {
    status: PhaseStatus;
    documents: Record<string, PhaseRecord>;
  };

  // Active specs being worked on
  activeSpecs: Record<string, ActiveSpec>;

  // Current focus
  currentPhase: WorkflowPhase;
  currentSpec?: string;
}

/**
 * Default empty state
 */
function createEmptyState(): WorkflowState {
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    lastAction: 'initialized',
    steering: {
      status: 'not-started',
      documents: {}
    },
    activeSpecs: {},
    currentPhase: 'steering',
    currentSpec: undefined
  };
}

/**
 * Get the state file path for a project
 */
export function getStatePath(projectPath: string): string {
  return join(projectPath, '.spec-workflow', 'state.json');
}

/**
 * Read workflow state from disk
 */
export async function readWorkflowState(projectPath: string): Promise<WorkflowState> {
  const statePath = getStatePath(projectPath);
  try {
    const content = await fs.readFile(statePath, 'utf-8');
    const state = JSON.parse(content) as WorkflowState;
    return state;
  } catch {
    return createEmptyState();
  }
}

/**
 * Write workflow state to disk
 */
export async function writeWorkflowState(projectPath: string, state: WorkflowState): Promise<void> {
  const statePath = getStatePath(projectPath);
  const dir = join(projectPath, '.spec-workflow');
  await fs.mkdir(dir, { recursive: true });
  state.lastUpdated = new Date().toISOString();
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Update state with a specific action
 */
export async function updateWorkflowState(
  projectPath: string,
  action: string,
  updater: (state: WorkflowState) => void
): Promise<WorkflowState> {
  const state = await readWorkflowState(projectPath);
  state.lastAction = action;
  updater(state);
  await writeWorkflowState(projectPath, state);
  return state;
}

/**
 * Record steering document status change
 */
export async function recordSteeringStatus(
  projectPath: string,
  docName: string,
  status: PhaseStatus,
  approvalId?: string
): Promise<void> {
  await updateWorkflowState(projectPath, `steering:${docName}:${status}`, (state) => {
    if (!state.steering.documents[docName]) {
      state.steering.documents[docName] = {
        status: 'not-started'
      };
    }

    const doc = state.steering.documents[docName];
    doc.status = status;

    if (status === 'in-progress' && !doc.startedAt) {
      doc.startedAt = new Date().toISOString();
    }
    if (status === 'approved') {
      doc.completedAt = new Date().toISOString();
    }
    if (approvalId) {
      doc.approvalId = approvalId;
    }

    // Update overall steering status
    const allDocs = Object.values(state.steering.documents);
    if (allDocs.every(d => d.status === 'approved')) {
      state.steering.status = 'approved';
      state.currentPhase = 'requirements';
    } else if (allDocs.some(d => d.status === 'pending-approval')) {
      state.steering.status = 'pending-approval';
    } else if (allDocs.some(d => d.status === 'in-progress')) {
      state.steering.status = 'in-progress';
    }
  });
}

/**
 * Record spec phase status change
 */
export async function recordSpecPhaseStatus(
  projectPath: string,
  specName: string,
  phase: 'requirements' | 'design' | 'tasks',
  status: PhaseStatus,
  approvalId?: string
): Promise<void> {
  await updateWorkflowState(projectPath, `spec:${specName}:${phase}:${status}`, (state) => {
    if (!state.activeSpecs[specName]) {
      state.activeSpecs[specName] = {
        name: specName,
        phases: {
          requirements: { status: 'not-started' },
          design: { status: 'not-started' },
          tasks: { status: 'not-started' }
        }
      };
    }

    const spec = state.activeSpecs[specName];
    const phaseRecord = spec.phases[phase];
    phaseRecord.status = status;

    if (status === 'in-progress' && !phaseRecord.startedAt) {
      phaseRecord.startedAt = new Date().toISOString();
    }
    if (status === 'approved') {
      phaseRecord.completedAt = new Date().toISOString();
    }
    if (approvalId) {
      phaseRecord.approvalId = approvalId;
    }

    // Update current phase based on what's complete
    state.currentSpec = specName;
    if (spec.phases.tasks.status === 'approved') {
      state.currentPhase = 'implementation';
    } else if (spec.phases.design.status === 'approved') {
      state.currentPhase = 'tasks';
    } else if (spec.phases.requirements.status === 'approved') {
      state.currentPhase = 'design';
    } else {
      state.currentPhase = 'requirements';
    }
  });
}

/**
 * Check if a spec is ready for implementation
 */
export function isSpecReadyForImplementation(spec: ActiveSpec): boolean {
  return (
    spec.phases.requirements.status === 'approved' &&
    spec.phases.design.status === 'approved' &&
    spec.phases.tasks.status === 'approved'
  );
}

/**
 * Get blocking reasons for implementation
 */
export function getImplementationBlockers(spec: ActiveSpec): string[] {
  const blockers: string[] = [];

  if (spec.phases.requirements.status !== 'approved') {
    blockers.push(`Requirements: ${spec.phases.requirements.status.toUpperCase()}`);
  }
  if (spec.phases.design.status !== 'approved') {
    blockers.push(`Design: ${spec.phases.design.status.toUpperCase()}`);
  }
  if (spec.phases.tasks.status !== 'approved') {
    blockers.push(`Tasks: ${spec.phases.tasks.status.toUpperCase()}`);
  }

  return blockers;
}

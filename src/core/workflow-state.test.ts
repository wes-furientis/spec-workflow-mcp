import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  readWorkflowState,
  writeWorkflowState,
  updateWorkflowState,
  recordSteeringStatus,
  recordSpecPhaseStatus,
  isSpecReadyForImplementation,
  getImplementationBlockers,
  WorkflowState
} from './workflow-state.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('WorkflowState', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `workflow-state-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(join(testDir, '.spec-workflow'), { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('readWorkflowState', () => {
    it('should return empty state when no state file exists', async () => {
      const state = await readWorkflowState(testDir);

      expect(state.version).toBe(1);
      expect(state.currentPhase).toBe('steering');
      expect(state.steering.status).toBe('not-started');
      expect(Object.keys(state.activeSpecs)).toHaveLength(0);
    });

    it('should read existing state file', async () => {
      const existingState: WorkflowState = {
        version: 1,
        lastUpdated: '2025-01-01T00:00:00Z',
        lastAction: 'test-action',
        steering: {
          status: 'approved',
          documents: {
            product: { status: 'approved', completedAt: '2025-01-01T00:00:00Z' }
          }
        },
        activeSpecs: {},
        currentPhase: 'requirements',
        currentSpec: undefined
      };

      await fs.writeFile(
        join(testDir, '.spec-workflow', 'state.json'),
        JSON.stringify(existingState, null, 2),
        'utf-8'
      );

      const state = await readWorkflowState(testDir);

      expect(state.steering.status).toBe('approved');
      expect(state.currentPhase).toBe('requirements');
      expect(state.lastAction).toBe('test-action');
    });
  });

  describe('writeWorkflowState', () => {
    it('should write state to file', async () => {
      const state: WorkflowState = {
        version: 1,
        lastUpdated: '2025-01-01T00:00:00Z',
        lastAction: 'write-test',
        steering: {
          status: 'in-progress',
          documents: {}
        },
        activeSpecs: {},
        currentPhase: 'steering',
        currentSpec: undefined
      };

      await writeWorkflowState(testDir, state);

      const content = await fs.readFile(join(testDir, '.spec-workflow', 'state.json'), 'utf-8');
      const savedState = JSON.parse(content);

      expect(savedState.lastAction).toBe('write-test');
      expect(savedState.steering.status).toBe('in-progress');
    });

    it('should update lastUpdated timestamp', async () => {
      const state: WorkflowState = {
        version: 1,
        lastUpdated: '2020-01-01T00:00:00Z',
        lastAction: 'test',
        steering: { status: 'not-started', documents: {} },
        activeSpecs: {},
        currentPhase: 'steering',
        currentSpec: undefined
      };

      await writeWorkflowState(testDir, state);

      const content = await fs.readFile(join(testDir, '.spec-workflow', 'state.json'), 'utf-8');
      const savedState = JSON.parse(content);

      expect(new Date(savedState.lastUpdated).getFullYear()).toBeGreaterThanOrEqual(2025);
    });
  });

  describe('recordSteeringStatus', () => {
    it('should record steering document status', async () => {
      await recordSteeringStatus(testDir, 'product', 'in-progress');

      const state = await readWorkflowState(testDir);

      expect(state.steering.documents.product).toBeDefined();
      expect(state.steering.documents.product.status).toBe('in-progress');
      expect(state.steering.documents.product.startedAt).toBeDefined();
    });

    it('should update steering document to approved', async () => {
      await recordSteeringStatus(testDir, 'product', 'in-progress');
      await recordSteeringStatus(testDir, 'product', 'approved', 'approval-123');

      const state = await readWorkflowState(testDir);

      expect(state.steering.documents.product.status).toBe('approved');
      expect(state.steering.documents.product.completedAt).toBeDefined();
      expect(state.steering.documents.product.approvalId).toBe('approval-123');
    });

    it('should update overall steering status when all docs approved', async () => {
      await recordSteeringStatus(testDir, 'product', 'approved');
      await recordSteeringStatus(testDir, 'tech', 'approved');

      const state = await readWorkflowState(testDir);

      expect(state.steering.status).toBe('approved');
      expect(state.currentPhase).toBe('requirements');
    });
  });

  describe('recordSpecPhaseStatus', () => {
    it('should create spec entry when recording status', async () => {
      await recordSpecPhaseStatus(testDir, 'my-feature', 'requirements', 'in-progress');

      const state = await readWorkflowState(testDir);

      expect(state.activeSpecs['my-feature']).toBeDefined();
      expect(state.activeSpecs['my-feature'].phases.requirements.status).toBe('in-progress');
      expect(state.currentSpec).toBe('my-feature');
    });

    it('should update phase status and track approvals', async () => {
      await recordSpecPhaseStatus(testDir, 'my-feature', 'requirements', 'approved', 'approval-req');
      await recordSpecPhaseStatus(testDir, 'my-feature', 'design', 'approved', 'approval-design');
      await recordSpecPhaseStatus(testDir, 'my-feature', 'tasks', 'approved', 'approval-tasks');

      const state = await readWorkflowState(testDir);
      const spec = state.activeSpecs['my-feature'];

      expect(spec.phases.requirements.status).toBe('approved');
      expect(spec.phases.design.status).toBe('approved');
      expect(spec.phases.tasks.status).toBe('approved');
      expect(state.currentPhase).toBe('implementation');
    });

    it('should update current phase correctly as phases complete', async () => {
      await recordSpecPhaseStatus(testDir, 'my-feature', 'requirements', 'approved');
      let state = await readWorkflowState(testDir);
      expect(state.currentPhase).toBe('design');

      await recordSpecPhaseStatus(testDir, 'my-feature', 'design', 'approved');
      state = await readWorkflowState(testDir);
      expect(state.currentPhase).toBe('tasks');

      await recordSpecPhaseStatus(testDir, 'my-feature', 'tasks', 'approved');
      state = await readWorkflowState(testDir);
      expect(state.currentPhase).toBe('implementation');
    });
  });

  describe('isSpecReadyForImplementation', () => {
    it('should return true when all phases approved', () => {
      const spec = {
        name: 'test',
        phases: {
          requirements: { status: 'approved' as const },
          design: { status: 'approved' as const },
          tasks: { status: 'approved' as const }
        }
      };

      expect(isSpecReadyForImplementation(spec)).toBe(true);
    });

    it('should return false when any phase not approved', () => {
      const spec = {
        name: 'test',
        phases: {
          requirements: { status: 'approved' as const },
          design: { status: 'pending-approval' as const },
          tasks: { status: 'not-started' as const }
        }
      };

      expect(isSpecReadyForImplementation(spec)).toBe(false);
    });
  });

  describe('getImplementationBlockers', () => {
    it('should return empty array when all approved', () => {
      const spec = {
        name: 'test',
        phases: {
          requirements: { status: 'approved' as const },
          design: { status: 'approved' as const },
          tasks: { status: 'approved' as const }
        }
      };

      expect(getImplementationBlockers(spec)).toHaveLength(0);
    });

    it('should return list of blocking phases', () => {
      const spec = {
        name: 'test',
        phases: {
          requirements: { status: 'approved' as const },
          design: { status: 'pending-approval' as const },
          tasks: { status: 'not-started' as const }
        }
      };

      const blockers = getImplementationBlockers(spec);

      expect(blockers).toHaveLength(2);
      expect(blockers).toContain('Design: PENDING-APPROVAL');
      expect(blockers).toContain('Tasks: NOT-STARTED');
    });
  });
});

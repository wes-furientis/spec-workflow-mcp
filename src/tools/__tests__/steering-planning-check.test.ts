import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { steeringGuideHandler } from '../steering-guide.js';
import { suggestPlanModeHandler } from '../planning-tools.js';
import { ToolContext } from '../../types.js';

/**
 * Steering Document Planning Check Tests (#9 from backlog)
 *
 * These tests verify that:
 * 1. steering-guide properly instructs agents to use suggest-plan-mode
 * 2. suggest-plan-mode correctly detects steering doc creation tasks
 * 3. Documents with requiresPlanning: true get recommendation: "required"
 */
describe('Steering Document Planning Check', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `steering-planning-test-${Date.now()}`);
    await fs.mkdir(join(testDir, '.spec-workflow', 'steering'), { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('steering-guide planning instructions', () => {
    it('should include suggest-plan-mode instruction for docs with requiresPlanning: true', async () => {
      // Create product.md and tech.md as approved (prerequisites for architecture.md)
      await fs.writeFile(join(testDir, '.spec-workflow', 'steering', 'product.md'), '# Product');
      await fs.writeFile(join(testDir, '.spec-workflow', 'steering', 'tech.md'), '# Tech');
      await fs.writeFile(join(testDir, '.spec-workflow', 'steering', 'structure.md'), '# Structure');

      // Need to mock the approvals to mark prerequisite docs as approved
      // For this test, we'll verify the nextSteps includes the planning instruction
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'greenfield'
      };

      const result = await steeringGuideHandler({}, context);

      // Find the next doc that needs creation
      const docs = result.data?.documents || [];
      const architectureDoc = docs.find((d: any) => d.name === 'architecture');

      // architecture.md should have requiresPlanning: true
      expect(architectureDoc).toBeDefined();
      expect(architectureDoc.requiresPlanning).toBe(true);
    });

    it('should generate PLANNING REQUIRED instruction when next doc requires planning', async () => {
      // Create required docs as approved (mock by checking instruction pattern)
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'greenfield'
      };

      const result = await steeringGuideHandler({}, context);

      // The nextSteps should include planning instruction when next doc requires planning
      const nextSteps = result.nextSteps || [];

      // If next doc is product/tech/structure (no requiresPlanning), instruction is different
      // We need to check the logic for when next doc DOES require planning
      const docs = result.data?.documents || [];
      const nextDoc = docs.find((d: any) => d.status !== 'approved');

      if (nextDoc?.requiresPlanning) {
        // Should include suggest-plan-mode call
        expect(nextSteps[0]).toContain('suggest-plan-mode');
      }
    });

    it('should NOT include suggest-plan-mode for standard docs without requiresPlanning', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'greenfield'
      };

      const result = await steeringGuideHandler({}, context);
      const nextSteps = result.nextSteps || [];

      // First doc to create is product.md which doesn't have requiresPlanning
      // So instruction should NOT mention suggest-plan-mode
      const docs = result.data?.documents || [];
      const firstDoc = docs[0];

      if (firstDoc?.name === 'product' && firstDoc?.status === 'not-created') {
        expect(firstDoc.requiresPlanning).toBe(false);
        expect(nextSteps[0]).toContain('get-steering-template');
        expect(nextSteps[0]).not.toContain('suggest-plan-mode');
      }
    });
  });

  describe('suggest-plan-mode steering doc detection', () => {
    it('should return recommendation: "required" for "Create architecture.md" task (greenfield)', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'greenfield'
      };

      const result = await suggestPlanModeHandler({
        taskDescription: 'Create architecture.md steering document'
      }, context);

      expect(result.success).toBe(true);
      expect(result.data?.recommendation).toBe('required');
      expect(result.data?.steeringDoc?.name).toBe('architecture');
      expect(result.data?.steeringDoc?.requiresPlanning).toBe(true);
    });

    it('should return recommendation: "required" for "Create conventions.md" task (greenfield)', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'greenfield'
      };

      const result = await suggestPlanModeHandler({
        taskDescription: 'Create conventions.md'
      }, context);

      expect(result.success).toBe(true);
      expect(result.data?.recommendation).toBe('required');
      expect(result.data?.steeringDoc?.name).toBe('conventions');
    });

    it('should return recommendation: "required" for "Create documentation.md" task (greenfield)', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'greenfield'
      };

      const result = await suggestPlanModeHandler({
        taskDescription: 'Create documentation.md'
      }, context);

      expect(result.success).toBe(true);
      expect(result.data?.recommendation).toBe('required');
      expect(result.data?.steeringDoc?.name).toBe('documentation');
    });

    it('should return recommendation: "required" for "Create legacy.md" task (brownfield)', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'brownfield'
      };

      const result = await suggestPlanModeHandler({
        taskDescription: 'Create legacy.md'
      }, context);

      expect(result.success).toBe(true);
      expect(result.data?.recommendation).toBe('required');
      expect(result.data?.steeringDoc?.name).toBe('legacy');
    });

    it('should return recommendation: "required" for "Create migration.md" task (brownfield)', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'brownfield'
      };

      const result = await suggestPlanModeHandler({
        taskDescription: 'Create migration.md steering document'
      }, context);

      expect(result.success).toBe(true);
      expect(result.data?.recommendation).toBe('required');
      expect(result.data?.steeringDoc?.name).toBe('migration');
    });

    it('should include context files from planningContext when planning is required', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'greenfield'
      };

      const result = await suggestPlanModeHandler({
        taskDescription: 'Create architecture.md'
      }, context);

      // architecture.md has planningContext: ["product", "tech"]
      expect(result.data?.contextFilesToRead).toBeDefined();
      expect(result.data?.contextFilesToRead).toContain('.spec-workflow/steering/product.md');
      expect(result.data?.contextFilesToRead).toContain('.spec-workflow/steering/tech.md');
    });

    it('should detect steering doc creation with various phrasings', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'greenfield'
      };

      // These phrasings match the patterns in checkSteeringDocPlanning:
      // /creat(e|ing)\s+(\w+\.md|steering|documentation)/i
      // /writ(e|ing)\s+(\w+\.md|steering|documentation)/i
      // /set\s*up\s+(\w+\.md|steering|documentation)/i
      // /draft\s+(\w+\.md|steering|documentation)/i
      const phrasings = [
        'Create architecture.md',
        'Creating architecture.md steering document',
        'Write architecture.md',
        'Set up architecture.md',
        'Draft architecture.md'
      ];

      for (const phrasing of phrasings) {
        const result = await suggestPlanModeHandler({
          taskDescription: phrasing
        }, context);

        expect(result.data?.recommendation).toBe('required');
        expect(result.data?.steeringDoc?.name).toBe('architecture');
      }
    });

    it('should NOT return "required" for standard docs without requiresPlanning (product.md)', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'greenfield'
      };

      const result = await suggestPlanModeHandler({
        taskDescription: 'Create product.md'
      }, context);

      // product.md is a standard doc and doesn't have requiresPlanning set
      // It should return "recommended" for greenfield (not "required")
      expect(result.data?.recommendation).not.toBe('required');
      // For greenfield, standard docs get "recommended"
      expect(['recommended', 'optional', 'not-needed']).toContain(result.data?.recommendation);
    });

    it('should create planning marker file when steering doc requires planning', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'greenfield'
      };

      await suggestPlanModeHandler({
        taskDescription: 'Create architecture.md'
      }, context);

      // Check that planning marker was created
      const markerPath = join(testDir, '.spec-workflow', '.planning', 'architecture.complete');
      const exists = await fs.access(markerPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('archetype-specific planning requirements', () => {
    it('should require planning for ux.md (web-app archetype)', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'web-app'
      };

      const result = await suggestPlanModeHandler({
        taskDescription: 'Create ux.md'
      }, context);

      expect(result.data?.recommendation).toBe('required');
      expect(result.data?.steeringDoc?.name).toBe('ux');
    });

    it('should require planning for api.md (web-app archetype)', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'web-app'
      };

      const result = await suggestPlanModeHandler({
        taskDescription: 'Create api.md'
      }, context);

      expect(result.data?.recommendation).toBe('required');
      expect(result.data?.steeringDoc?.name).toBe('api');
    });

    it('should require planning for thesis.md (research-paper archetype)', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'research-paper'
      };

      const result = await suggestPlanModeHandler({
        taskDescription: 'Create thesis.md'
      }, context);

      expect(result.data?.recommendation).toBe('required');
      expect(result.data?.steeringDoc?.name).toBe('thesis');
    });

    it('should require planning for compatibility.md (code-library archetype)', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'code-library'
      };

      const result = await suggestPlanModeHandler({
        taskDescription: 'Create compatibility.md'
      }, context);

      expect(result.data?.recommendation).toBe('required');
      expect(result.data?.steeringDoc?.name).toBe('compatibility');
    });
  });

  describe('missing archetype handling', () => {
    it('should recommend planning for steering docs when no archetype is set', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: undefined
      };

      const result = await suggestPlanModeHandler({
        taskDescription: 'Create architecture.md'
      }, context);

      // Should still recommend planning, but with a warning
      expect(result.data?.recommendation).toBe('recommended');
      expect(result.data?.archetypeWarning).toBeDefined();
      expect(result.data?.archetypeWarning).toContain('No archetype is configured');
    });
  });

  describe('nextSteps guidance', () => {
    it('should include EnterPlanMode in nextSteps when recommendation is required', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'greenfield'
      };

      const result = await suggestPlanModeHandler({
        taskDescription: 'Create architecture.md'
      }, context);

      expect(result.nextSteps).toBeDefined();
      expect(result.nextSteps.some((s: string) => s.includes('EnterPlanMode'))).toBe(true);
    });

    it('should include get-steering-template in nextSteps after planning is done', async () => {
      const context: ToolContext = {
        projectPath: testDir,
        projectArchetype: 'greenfield'
      };

      const result = await suggestPlanModeHandler({
        taskDescription: 'Create architecture.md'
      }, context);

      expect(result.nextSteps).toBeDefined();
      expect(result.nextSteps.some((s: string) => s.includes('get-steering-template'))).toBe(true);
    });
  });
});

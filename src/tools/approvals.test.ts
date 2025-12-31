import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { approvalsHandler } from './approvals.js';
import { ApprovalStorage, ApprovalComment } from '../dashboard/approval-storage.js';
import { ToolContext } from '../types.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('approvalsHandler', () => {
  let testDir: string;
  let storage: ApprovalStorage;
  let testFilePath: string;
  let context: ToolContext;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `approvals-tool-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create .spec-workflow structure
    const specWorkflowDir = join(testDir, '.spec-workflow');
    await fs.mkdir(specWorkflowDir, { recursive: true });

    // Create a test file for approval
    testFilePath = join(specWorkflowDir, 'steering', 'test.md');
    await fs.mkdir(join(specWorkflowDir, 'steering'), { recursive: true });
    await fs.writeFile(testFilePath, '# Test Document\n\nThis is a test document.');

    // Create context
    context = {
      projectPath: testDir,
      dashboardUrl: 'http://localhost:3000'
    };

    storage = new ApprovalStorage(testDir);
    await storage.start();
  });

  afterEach(async () => {
    await storage.stop();
    // Clean up temp directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('status action with needs-revision', () => {
    it('should return revision comments in nextSteps', async () => {
      // Create an approval
      const approvalId = await storage.createApproval(
        'Test Document',
        '.spec-workflow/steering/test.md',
        'steering',
        'steering',
        'document'
      );

      // Add revision comments
      const comments: ApprovalComment[] = [
        {
          type: 'general',
          comment: 'Please add more details to the introduction',
          timestamp: new Date().toISOString()
        },
        {
          type: 'selection',
          selectedText: 'This is a test document',
          comment: 'This section needs clarification about the purpose',
          timestamp: new Date().toISOString(),
          lineNumber: 3
        }
      ];

      const response = 'Feedback Summary (2 comments):\n\n1. Please add more details\n2. Clarification needed';

      await storage.updateApproval(approvalId, 'needs-revision', response, undefined, comments);
      await storage.stop();

      // Now call the handler to check status
      const result = await approvalsHandler(
        {
          action: 'status',
          projectPath: testDir,
          approvalId
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('needs-revision');
      expect(result.data?.comments).toBeDefined();
      expect(result.data?.comments?.length).toBe(2);

      // Check nextSteps contains the feedback
      expect(result.nextSteps).toBeDefined();
      const nextStepsStr = result.nextSteps?.join(' ') || '';

      expect(nextStepsStr).toContain('Feedback:');
      expect(nextStepsStr).toContain('2 comments for targeted fixes');
      expect(nextStepsStr).toContain('Please add more details to the introduction');
      expect(nextStepsStr).toContain('This section needs clarification about the purpose');
    });

    it('should include response field in data when needs-revision', async () => {
      const approvalId = await storage.createApproval(
        'Test Document',
        '.spec-workflow/steering/test.md',
        'steering',
        'steering',
        'document'
      );

      const response = 'Please fix the following issues';
      await storage.updateApproval(approvalId, 'needs-revision', response, undefined, []);
      await storage.stop();

      const result = await approvalsHandler(
        {
          action: 'status',
          projectPath: testDir,
          approvalId
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.data?.response).toBe(response);
    });

    it('should include annotations field in data when needs-revision', async () => {
      const approvalId = await storage.createApproval(
        'Test Document',
        '.spec-workflow/steering/test.md',
        'steering',
        'steering',
        'document'
      );

      const annotations = JSON.stringify({ decision: 'needs-revision', timestamp: new Date().toISOString() });
      await storage.updateApproval(approvalId, 'needs-revision', 'Fix it', annotations, []);
      await storage.stop();

      const result = await approvalsHandler(
        {
          action: 'status',
          projectPath: testDir,
          approvalId
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.data?.annotations).toBe(annotations);
    });
  });

  describe('status action blocking behavior', () => {
    it('should indicate blocking status for needs-revision', async () => {
      const approvalId = await storage.createApproval(
        'Test Document',
        '.spec-workflow/steering/test.md',
        'steering',
        'steering',
        'document'
      );

      await storage.updateApproval(approvalId, 'needs-revision', 'Fix it', undefined, []);
      await storage.stop();

      const result = await approvalsHandler(
        {
          action: 'status',
          projectPath: testDir,
          approvalId
        },
        context
      );

      expect(result.data?.blockNext).toBe(true);
      expect(result.data?.canProceed).toBe(false);
      expect(result.nextSteps).toContain('BLOCKED - Do not proceed');
    });
  });
});

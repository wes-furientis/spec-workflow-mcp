import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApprovalStorage, ApprovalComment } from './approval-storage.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ApprovalStorage', () => {
  let testDir: string;
  let storage: ApprovalStorage;
  let testFilePath: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `approval-storage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create .spec-workflow structure
    const specWorkflowDir = join(testDir, '.spec-workflow');
    await fs.mkdir(specWorkflowDir, { recursive: true });

    // Create a test file for approval
    testFilePath = join(specWorkflowDir, 'steering', 'test.md');
    await fs.mkdir(join(specWorkflowDir, 'steering'), { recursive: true });
    await fs.writeFile(testFilePath, '# Test Document\n\nThis is a test document.');

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

  describe('updateApproval with needs-revision', () => {
    it('should save revision comments when status is needs-revision', async () => {
      // Create an approval
      const approvalId = await storage.createApproval(
        'Test Document',
        '.spec-workflow/steering/test.md',
        'steering',
        'steering',
        'document'
      );

      // Define test comments
      const comments: ApprovalComment[] = [
        {
          type: 'general',
          comment: 'Please add more details to the introduction',
          timestamp: new Date().toISOString()
        },
        {
          type: 'selection',
          selectedText: 'This is a test',
          comment: 'This section needs clarification',
          timestamp: new Date().toISOString(),
          lineNumber: 3
        }
      ];

      const response = 'Feedback Summary (2 comments):\n\n1. Please add more details\n2. Clarification needed';
      const annotations = JSON.stringify({
        decision: 'needs-revision',
        comments,
        summary: response,
        timestamp: new Date().toISOString()
      });

      // Update approval with needs-revision status and comments
      await storage.updateApproval(approvalId, 'needs-revision', response, annotations, comments);

      // Retrieve the approval and verify comments are saved
      const approval = await storage.getApproval(approvalId);

      expect(approval).not.toBeNull();
      expect(approval!.status).toBe('needs-revision');
      expect(approval!.response).toBe(response);
      expect(approval!.annotations).toBe(annotations);
      expect(approval!.comments).toBeDefined();
      expect(approval!.comments!.length).toBe(2);
      expect(approval!.comments![0].comment).toBe('Please add more details to the introduction');
      expect(approval!.comments![1].type).toBe('selection');
      expect(approval!.comments![1].selectedText).toBe('This is a test');
    });

    it('should persist comments to the approval JSON file', async () => {
      // Create an approval
      const approvalId = await storage.createApproval(
        'Test Document',
        '.spec-workflow/steering/test.md',
        'steering',
        'steering',
        'document'
      );

      const comments: ApprovalComment[] = [
        {
          type: 'general',
          comment: 'Test comment for persistence check',
          timestamp: new Date().toISOString()
        }
      ];

      await storage.updateApproval(approvalId, 'needs-revision', 'Please revise', undefined, comments);

      // Stop and restart storage to verify persistence
      await storage.stop();

      const storage2 = new ApprovalStorage(testDir);
      await storage2.start();

      const approval = await storage2.getApproval(approvalId);

      expect(approval).not.toBeNull();
      expect(approval!.comments).toBeDefined();
      expect(approval!.comments!.length).toBe(1);
      expect(approval!.comments![0].comment).toBe('Test comment for persistence check');

      await storage2.stop();
    });

    it('should capture snapshot with comments when requesting revision', async () => {
      const approvalId = await storage.createApproval(
        'Test Document',
        '.spec-workflow/steering/test.md',
        'steering',
        'steering',
        'document'
      );

      const comments: ApprovalComment[] = [
        {
          type: 'general',
          comment: 'Snapshot test comment',
          timestamp: new Date().toISOString()
        }
      ];

      await storage.updateApproval(approvalId, 'needs-revision', 'Needs work', undefined, comments);

      // Check that a snapshot was captured
      const snapshots = await storage.getSnapshots(approvalId);

      // Should have initial snapshot + revision_requested snapshot
      expect(snapshots.length).toBeGreaterThanOrEqual(2);

      const revisionSnapshot = snapshots.find(s => s.trigger === 'revision_requested');
      expect(revisionSnapshot).toBeDefined();
    });
  });

  describe('approval comments in status check', () => {
    it('should return comments when getting approval with needs-revision status', async () => {
      const approvalId = await storage.createApproval(
        'Test Document',
        '.spec-workflow/steering/test.md',
        'steering',
        'steering',
        'document'
      );

      const comments: ApprovalComment[] = [
        {
          type: 'selection',
          selectedText: 'selected text here',
          comment: 'This needs to be fixed',
          timestamp: new Date().toISOString(),
          lineNumber: 5
        }
      ];

      await storage.updateApproval(approvalId, 'needs-revision', 'Fix the issues', undefined, comments);

      const approval = await storage.getApproval(approvalId);

      expect(approval).not.toBeNull();
      expect(approval!.comments).toBeDefined();
      expect(approval!.comments![0]).toMatchObject({
        type: 'selection',
        selectedText: 'selected text here',
        comment: 'This needs to be fixed'
      });
    });
  });
});

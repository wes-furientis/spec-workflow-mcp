import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  scanDirectory,
  watchForNewProjects,
  readConfigFile,
  getProjectArchetype,
  DiscoveredProject
} from '../project-scanner.js';

// Mock the fs module
vi.mock('fs', () => ({
  promises: {
    readdir: vi.fn(),
    stat: vi.fn(),
    access: vi.fn(),
    readFile: vi.fn()
  }
}));

// Mock chokidar
vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      removeAllListeners: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined)
    }))
  }
}));

const mockReaddir = fs.readdir as Mock;
const mockStat = fs.stat as Mock;
const mockAccess = fs.access as Mock;
const mockReadFile = fs.readFile as Mock;

describe('ProjectScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('scanDirectory', () => {
    it('should find a project with .spec-workflow directory', async () => {
      // Mock root directory structure
      mockReaddir.mockImplementation((path: string) => {
        if (path === '/root') {
          return Promise.resolve(['project1']);
        }
        if (path === '/root/project1') {
          return Promise.resolve(['.spec-workflow', 'src']);
        }
        return Promise.resolve([]);
      });

      mockStat.mockImplementation((path: string) => {
        if (path === '/root/project1/.spec-workflow') {
          return Promise.resolve({ isDirectory: () => true });
        }
        if (path === '/root/project1') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      // No config files
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const projects = await scanDirectory('/root', 2);

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('project1');
      expect(projects[0].path).toBe('/root/project1');
      expect(projects[0].hasConfig).toBe(false);
    });

    it('should find multiple projects at different depths', async () => {
      mockReaddir.mockImplementation((path: string) => {
        if (path === '/root') {
          return Promise.resolve(['workspace', 'project-a']);
        }
        if (path === '/root/workspace') {
          return Promise.resolve(['project-b']);
        }
        if (path === '/root/project-a') {
          return Promise.resolve(['.spec-workflow']);
        }
        if (path === '/root/workspace/project-b') {
          return Promise.resolve(['.spec-workflow']);
        }
        return Promise.resolve([]);
      });

      mockStat.mockImplementation((path: string) => {
        const directories = [
          '/root/workspace',
          '/root/project-a',
          '/root/workspace/project-b',
          '/root/project-a/.spec-workflow',
          '/root/workspace/project-b/.spec-workflow'
        ];
        if (directories.includes(path)) {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const projects = await scanDirectory('/root', 3);

      expect(projects).toHaveLength(2);
      const projectNames = projects.map(p => p.name).sort();
      expect(projectNames).toEqual(['project-a', 'project-b']);
    });

    it('should respect depth limit', async () => {
      mockReaddir.mockImplementation((path: string) => {
        if (path === '/root') {
          return Promise.resolve(['level1']);
        }
        if (path === '/root/level1') {
          return Promise.resolve(['level2']);
        }
        if (path === '/root/level1/level2') {
          return Promise.resolve(['level3']);
        }
        if (path === '/root/level1/level2/level3') {
          return Promise.resolve(['.spec-workflow']);
        }
        return Promise.resolve([]);
      });

      mockStat.mockImplementation((path: string) => {
        const directories = [
          '/root/level1',
          '/root/level1/level2',
          '/root/level1/level2/level3',
          '/root/level1/level2/level3/.spec-workflow'
        ];
        if (directories.includes(path)) {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      // With depth 2, should not find project at level 3
      const projectsDepth2 = await scanDirectory('/root', 2);
      expect(projectsDepth2).toHaveLength(0);

      // With depth 3, should find project at level 3
      const projectsDepth3 = await scanDirectory('/root', 3);
      expect(projectsDepth3).toHaveLength(1);
      expect(projectsDepth3[0].name).toBe('level3');
    });

    it('should handle permission errors gracefully', async () => {
      mockReaddir.mockImplementation((path: string) => {
        if (path === '/root') {
          return Promise.resolve(['accessible', 'protected']);
        }
        if (path === '/root/accessible') {
          return Promise.resolve(['.spec-workflow']);
        }
        if (path === '/root/protected') {
          const error: NodeJS.ErrnoException = new Error('Permission denied');
          error.code = 'EACCES';
          return Promise.reject(error);
        }
        return Promise.resolve([]);
      });

      mockStat.mockImplementation((path: string) => {
        if (path === '/root/accessible' || path === '/root/protected') {
          return Promise.resolve({ isDirectory: () => true });
        }
        if (path === '/root/accessible/.spec-workflow') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const projects = await scanDirectory('/root', 2);

      // Should find the accessible project, skip the protected one
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('accessible');
    });

    it('should handle EPERM errors gracefully', async () => {
      mockReaddir.mockImplementation((path: string) => {
        if (path === '/root') {
          return Promise.resolve(['project1', 'system']);
        }
        if (path === '/root/project1') {
          return Promise.resolve(['.spec-workflow']);
        }
        if (path === '/root/system') {
          const error: NodeJS.ErrnoException = new Error('Operation not permitted');
          error.code = 'EPERM';
          return Promise.reject(error);
        }
        return Promise.resolve([]);
      });

      mockStat.mockImplementation((path: string) => {
        if (path === '/root/project1' || path === '/root/system') {
          return Promise.resolve({ isDirectory: () => true });
        }
        if (path === '/root/project1/.spec-workflow') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const projects = await scanDirectory('/root', 2);

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('project1');
    });

    it('should skip node_modules directory', async () => {
      mockReaddir.mockImplementation((path: string) => {
        if (path === '/root') {
          return Promise.resolve(['project1', 'node_modules']);
        }
        if (path === '/root/project1') {
          return Promise.resolve(['.spec-workflow']);
        }
        if (path === '/root/node_modules') {
          return Promise.resolve(['some-package']);
        }
        if (path === '/root/node_modules/some-package') {
          return Promise.resolve(['.spec-workflow']);
        }
        return Promise.resolve([]);
      });

      mockStat.mockImplementation((path: string) => {
        if (path.includes('node_modules') || path === '/root/project1' || path === '/root/project1/.spec-workflow') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const projects = await scanDirectory('/root', 3);

      // Should only find project1, not the one in node_modules
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('project1');
    });

    it('should skip hidden directories (except .spec-workflow)', async () => {
      mockReaddir.mockImplementation((path: string) => {
        if (path === '/root') {
          return Promise.resolve(['project1', '.hidden-project']);
        }
        if (path === '/root/project1') {
          return Promise.resolve(['.spec-workflow']);
        }
        // This should not be called because .hidden-project is skipped
        if (path === '/root/.hidden-project') {
          return Promise.resolve(['.spec-workflow']);
        }
        return Promise.resolve([]);
      });

      mockStat.mockImplementation((path: string) => {
        if (path === '/root/project1' || path === '/root/.hidden-project') {
          return Promise.resolve({ isDirectory: () => true });
        }
        if (path === '/root/project1/.spec-workflow') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const projects = await scanDirectory('/root', 2);

      // Should only find project1, not the hidden one
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('project1');
    });

    it('should skip common build directories (dist, build, target)', async () => {
      mockReaddir.mockImplementation((path: string) => {
        if (path === '/root') {
          return Promise.resolve(['project1', 'dist', 'build', 'target']);
        }
        if (path === '/root/project1') {
          return Promise.resolve(['.spec-workflow']);
        }
        // These should not be called
        if (path === '/root/dist' || path === '/root/build' || path === '/root/target') {
          return Promise.resolve(['.spec-workflow']);
        }
        return Promise.resolve([]);
      });

      mockStat.mockImplementation((path: string) => {
        const directories = ['/root/project1', '/root/dist', '/root/build', '/root/target', '/root/project1/.spec-workflow'];
        if (directories.includes(path)) {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const projects = await scanDirectory('/root', 2);

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('project1');
    });

    it('should not recurse into projects with .spec-workflow', async () => {
      mockReaddir.mockImplementation((path: string) => {
        if (path === '/root') {
          return Promise.resolve(['parent-project']);
        }
        if (path === '/root/parent-project') {
          return Promise.resolve(['.spec-workflow', 'nested']);
        }
        // This should not be called because we stop at projects
        if (path === '/root/parent-project/nested') {
          return Promise.resolve(['.spec-workflow']);
        }
        return Promise.resolve([]);
      });

      mockStat.mockImplementation((path: string) => {
        if (path === '/root/parent-project') {
          return Promise.resolve({ isDirectory: () => true });
        }
        if (path === '/root/parent-project/.spec-workflow') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const projects = await scanDirectory('/root', 3);

      // Should only find parent-project, not recurse into nested
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('parent-project');
    });

    it('should read archetype from project.yaml config', async () => {
      mockReaddir.mockImplementation((path: string) => {
        if (path === '/root') {
          return Promise.resolve(['my-project']);
        }
        if (path === '/root/my-project') {
          return Promise.resolve(['.spec-workflow']);
        }
        return Promise.resolve([]);
      });

      mockStat.mockImplementation((path: string) => {
        if (path === '/root/my-project') {
          return Promise.resolve({ isDirectory: () => true });
        }
        if (path === '/root/my-project/.spec-workflow') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      mockAccess.mockImplementation((path: string) => {
        if (path === '/root/my-project/.spec-workflow/project.yaml') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockReadFile.mockImplementation((path: string) => {
        if (path === '/root/my-project/.spec-workflow/project.yaml') {
          return Promise.resolve('archetype: typescript-library\nname: my-project');
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const projects = await scanDirectory('/root', 2);

      expect(projects).toHaveLength(1);
      expect(projects[0].hasConfig).toBe(true);
      expect(projects[0].archetype).toBe('typescript-library');
    });

    it('should read archetype from project.json config', async () => {
      mockReaddir.mockImplementation((path: string) => {
        if (path === '/root') {
          return Promise.resolve(['json-project']);
        }
        if (path === '/root/json-project') {
          return Promise.resolve(['.spec-workflow']);
        }
        return Promise.resolve([]);
      });

      mockStat.mockImplementation((path: string) => {
        if (path === '/root/json-project') {
          return Promise.resolve({ isDirectory: () => true });
        }
        if (path === '/root/json-project/.spec-workflow') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      mockAccess.mockImplementation((path: string) => {
        if (path === '/root/json-project/.spec-workflow/project.yaml') {
          return Promise.reject(new Error('ENOENT'));
        }
        if (path === '/root/json-project/.spec-workflow/project.yml') {
          return Promise.reject(new Error('ENOENT'));
        }
        if (path === '/root/json-project/.spec-workflow/project.json') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockReadFile.mockImplementation((path: string) => {
        if (path === '/root/json-project/.spec-workflow/project.json') {
          return Promise.resolve(JSON.stringify({ archetype: 'node-api', name: 'json-project' }));
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const projects = await scanDirectory('/root', 2);

      expect(projects).toHaveLength(1);
      expect(projects[0].hasConfig).toBe(true);
      expect(projects[0].archetype).toBe('node-api');
    });

    it('should sort projects by path', async () => {
      mockReaddir.mockImplementation((path: string) => {
        if (path === '/root') {
          return Promise.resolve(['zebra', 'alpha', 'middle']);
        }
        if (path === '/root/zebra' || path === '/root/alpha' || path === '/root/middle') {
          return Promise.resolve(['.spec-workflow']);
        }
        return Promise.resolve([]);
      });

      mockStat.mockImplementation((path: string) => {
        const directories = [
          '/root/zebra',
          '/root/alpha',
          '/root/middle',
          '/root/zebra/.spec-workflow',
          '/root/alpha/.spec-workflow',
          '/root/middle/.spec-workflow'
        ];
        if (directories.includes(path)) {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const projects = await scanDirectory('/root', 2);

      expect(projects).toHaveLength(3);
      expect(projects[0].name).toBe('alpha');
      expect(projects[1].name).toBe('middle');
      expect(projects[2].name).toBe('zebra');
    });

    it('should return empty array for directory with no projects', async () => {
      mockReaddir.mockImplementation((path: string) => {
        if (path === '/root') {
          return Promise.resolve(['folder1', 'folder2']);
        }
        if (path === '/root/folder1' || path === '/root/folder2') {
          return Promise.resolve(['some-file.txt']);
        }
        return Promise.resolve([]);
      });

      mockStat.mockImplementation((path: string) => {
        if (path === '/root/folder1' || path === '/root/folder2') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      const projects = await scanDirectory('/root', 2);

      expect(projects).toHaveLength(0);
    });

    it('should handle depth 0 (only scan root itself)', async () => {
      mockReaddir.mockImplementation((path: string) => {
        if (path === '/root') {
          return Promise.resolve(['subdir']);
        }
        if (path === '/root/subdir') {
          return Promise.resolve(['.spec-workflow']);
        }
        return Promise.resolve([]);
      });

      mockStat.mockImplementation((path: string) => {
        // Check if root has .spec-workflow (it doesn't)
        if (path === '/root/.spec-workflow') {
          return Promise.reject(new Error('ENOENT'));
        }
        if (path === '/root/subdir') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      const projects = await scanDirectory('/root', 0);

      // With depth 0, should not find the project in subdir
      expect(projects).toHaveLength(0);
    });

    it('should handle stat errors for entries gracefully', async () => {
      mockReaddir.mockImplementation((path: string) => {
        if (path === '/root') {
          return Promise.resolve(['project1', 'broken-link']);
        }
        if (path === '/root/project1') {
          return Promise.resolve(['.spec-workflow']);
        }
        return Promise.resolve([]);
      });

      mockStat.mockImplementation((path: string) => {
        if (path === '/root/project1') {
          return Promise.resolve({ isDirectory: () => true });
        }
        if (path === '/root/project1/.spec-workflow') {
          return Promise.resolve({ isDirectory: () => true });
        }
        if (path === '/root/broken-link') {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const projects = await scanDirectory('/root', 2);

      // Should find project1 and skip broken-link
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('project1');
    });
  });

  describe('readConfigFile', () => {
    it('should parse JSON config file', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        archetype: 'react-app',
        name: 'my-app'
      }));

      const config = await readConfigFile('/path/to/project.json');

      expect(config).toEqual({
        archetype: 'react-app',
        name: 'my-app'
      });
    });

    it('should parse YAML config file', async () => {
      mockReadFile.mockResolvedValue('archetype: node-api\nname: my-api\nversion: 1.0.0');

      const config = await readConfigFile('/path/to/project.yaml');

      expect(config).toEqual({
        archetype: 'node-api',
        name: 'my-api',
        version: '1.0.0'
      });
    });

    it('should parse YAML file with .yml extension', async () => {
      mockReadFile.mockResolvedValue('archetype: python-lib');

      const config = await readConfigFile('/path/to/project.yml');

      expect(config).toEqual({
        archetype: 'python-lib'
      });
    });

    it('should handle quoted values in YAML', async () => {
      mockReadFile.mockResolvedValue('archetype: "typescript-lib"\nname: \'quoted-name\'');

      const config = await readConfigFile('/path/to/project.yaml');

      expect(config?.archetype).toBe('typescript-lib');
      expect(config?.name).toBe('quoted-name');
    });

    it('should skip comments in YAML', async () => {
      mockReadFile.mockResolvedValue('# This is a comment\narchetype: go-service\n# Another comment');

      const config = await readConfigFile('/path/to/project.yaml');

      expect(config).toEqual({
        archetype: 'go-service'
      });
    });

    it('should return null for read errors', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const config = await readConfigFile('/path/to/nonexistent.yaml');

      expect(config).toBeNull();
    });

    it('should return null for unsupported file types', async () => {
      mockReadFile.mockResolvedValue('some content');

      const config = await readConfigFile('/path/to/config.txt');

      expect(config).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      mockReadFile.mockResolvedValue('{ invalid json }');

      const config = await readConfigFile('/path/to/project.json');

      expect(config).toBeNull();
    });
  });

  describe('getProjectArchetype', () => {
    it('should return archetype from project.yaml', async () => {
      mockAccess.mockImplementation((path: string) => {
        if (path === '/project/.spec-workflow/project.yaml') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockReadFile.mockImplementation((path: string) => {
        if (path === '/project/.spec-workflow/project.yaml') {
          return Promise.resolve('archetype: web-app');
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const archetype = await getProjectArchetype('/project');

      expect(archetype).toBe('web-app');
    });

    it('should return undefined when no config file exists', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const archetype = await getProjectArchetype('/project');

      expect(archetype).toBeUndefined();
    });

    it('should return undefined when config has no archetype', async () => {
      mockAccess.mockImplementation((path: string) => {
        if (path === '/project/.spec-workflow/project.json') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockReadFile.mockImplementation((path: string) => {
        if (path === '/project/.spec-workflow/project.json') {
          return Promise.resolve(JSON.stringify({ name: 'my-project' }));
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const archetype = await getProjectArchetype('/project');

      expect(archetype).toBeUndefined();
    });

    it('should try multiple config file extensions', async () => {
      const accessCalls: string[] = [];
      mockAccess.mockImplementation((path: string) => {
        accessCalls.push(path);
        if (path === '/project/.spec-workflow/project.yml') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockReadFile.mockImplementation((path: string) => {
        if (path === '/project/.spec-workflow/project.yml') {
          return Promise.resolve('archetype: rust-lib');
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const archetype = await getProjectArchetype('/project');

      expect(archetype).toBe('rust-lib');
      // Should have tried project.yaml first, then project.yml
      expect(accessCalls).toContain('/project/.spec-workflow/project.yaml');
      expect(accessCalls).toContain('/project/.spec-workflow/project.yml');
    });
  });

  describe('watchForNewProjects', () => {
    let mockChokidar: any;
    let mockWatcher: any;
    let eventHandlers: Record<string, Function[]>;

    beforeEach(async () => {
      eventHandlers = {};
      mockWatcher = {
        on: vi.fn((event: string, handler: Function) => {
          if (!eventHandlers[event]) {
            eventHandlers[event] = [];
          }
          eventHandlers[event].push(handler);
          return mockWatcher;
        }),
        removeAllListeners: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined)
      };

      // Re-mock chokidar for this describe block
      const chokidar = await import('chokidar');
      mockChokidar = chokidar.default;
      (mockChokidar.watch as Mock).mockReturnValue(mockWatcher);
    });

    it('should return a cleanup function', () => {
      const cleanup = watchForNewProjects('/root', () => {});

      expect(typeof cleanup).toBe('function');

      cleanup();
    });

    it('should watch with correct options', () => {
      watchForNewProjects('/root', () => {});

      expect(mockChokidar.watch).toHaveBeenCalledWith('/root', expect.objectContaining({
        ignoreInitial: true,
        persistent: true,
        depth: 3,
        ignorePermissionErrors: true
      }));
    });

    it('should ignore common directories', () => {
      watchForNewProjects('/root', () => {});

      const watchCall = (mockChokidar.watch as Mock).mock.calls[0];
      const options = watchCall[1];

      expect(options.ignored).toContain('**/node_modules/**');
      expect(options.ignored).toContain('**/.git/**');
      expect(options.ignored).toContain('**/vendor/**');
      expect(options.ignored).toContain('**/dist/**');
      expect(options.ignored).toContain('**/build/**');
    });

    it('should register addDir event handler', () => {
      watchForNewProjects('/root', () => {});

      expect(mockWatcher.on).toHaveBeenCalledWith('addDir', expect.any(Function));
    });

    it('should register add event handler for config files', () => {
      watchForNewProjects('/root', () => {});

      expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
    });

    it('should register error event handler', () => {
      watchForNewProjects('/root', () => {});

      expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should close watcher on cleanup', async () => {
      const cleanup = watchForNewProjects('/root', () => {});

      cleanup();

      expect(mockWatcher.removeAllListeners).toHaveBeenCalled();
      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it('should call callback when .spec-workflow directory is added', async () => {
      vi.useFakeTimers();

      const callback = vi.fn();
      watchForNewProjects('/root', callback);

      // Mock stat for checking the project
      mockStat.mockImplementation((path: string) => {
        if (path === '/root/new-project/.spec-workflow') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      // Trigger the addDir event
      const addDirHandler = eventHandlers['addDir'][0];
      addDirHandler('/root/new-project/.spec-workflow');

      // Advance past debounce timer
      await vi.advanceTimersByTimeAsync(600);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        path: '/root/new-project',
        name: 'new-project'
      }));

      vi.useRealTimers();
    });

    it('should debounce rapid events for the same project', async () => {
      vi.useFakeTimers();

      const callback = vi.fn();
      watchForNewProjects('/root', callback);

      mockStat.mockImplementation((path: string) => {
        if (path === '/root/project/.spec-workflow') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const addDirHandler = eventHandlers['addDir'][0];

      // Trigger multiple rapid events
      addDirHandler('/root/project/.spec-workflow');
      await vi.advanceTimersByTimeAsync(100);
      addDirHandler('/root/project/.spec-workflow');
      await vi.advanceTimersByTimeAsync(100);
      addDirHandler('/root/project/.spec-workflow');

      // Advance past debounce timer
      await vi.advanceTimersByTimeAsync(600);

      // Should only call callback once due to debouncing
      expect(callback).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should not call callback for duplicate discovered projects', async () => {
      vi.useFakeTimers();

      const callback = vi.fn();
      watchForNewProjects('/root', callback);

      mockStat.mockImplementation((path: string) => {
        if (path === '/root/project/.spec-workflow') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const addDirHandler = eventHandlers['addDir'][0];

      // First discovery
      addDirHandler('/root/project/.spec-workflow');
      await vi.advanceTimersByTimeAsync(600);

      // Second discovery (same project)
      addDirHandler('/root/project/.spec-workflow');
      await vi.advanceTimersByTimeAsync(600);

      // Should only call callback once
      expect(callback).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should trigger check when config file is added', async () => {
      vi.useFakeTimers();

      const callback = vi.fn();
      watchForNewProjects('/root', callback);

      mockStat.mockImplementation((path: string) => {
        if (path === '/root/project/.spec-workflow') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const addHandler = eventHandlers['add'][0];

      // Trigger config file add
      addHandler('/root/project/.spec-workflow/project.yaml');
      await vi.advanceTimersByTimeAsync(600);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        path: '/root/project',
        name: 'project'
      }));

      vi.useRealTimers();
    });

    it('should handle error events without crashing', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      watchForNewProjects('/root', () => {});

      const errorHandler = eventHandlers['error'][0];

      // Should not throw
      expect(() => {
        errorHandler(new Error('Test error'));
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});

import { promises as fs } from 'fs';
import { join, basename, resolve } from 'path';
import chokidar from 'chokidar';

/**
 * Represents a discovered project with a .spec-workflow directory
 */
export interface DiscoveredProject {
  /** Absolute path to project root */
  path: string;
  /** Project name derived from directory name */
  name: string;
  /** Whether the project has a project.yaml or project.json config file */
  hasConfig: boolean;
  /** Archetype from config if present */
  archetype?: string;
}

/**
 * Configuration structure expected in project.yaml or project.json
 */
export interface ProjectConfig {
  archetype?: string;
  [key: string]: unknown;
}

/**
 * Check if a path is a hidden directory (starts with .)
 * @param name - Directory or file name to check
 * @returns true if hidden (except for .spec-workflow)
 */
function isHiddenDirectory(name: string): boolean {
  return name.startsWith('.') && name !== '.spec-workflow';
}

/**
 * Read and parse a project config file (YAML or JSON)
 * @param configPath - Path to the config file
 * @returns Parsed config object or null if failed
 */
export async function readConfigFile(configPath: string): Promise<ProjectConfig | null> {
  try {
    const content = await fs.readFile(configPath, 'utf-8');

    if (configPath.endsWith('.json')) {
      return JSON.parse(content) as ProjectConfig;
    } else if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
      // Simple YAML parsing for basic key-value pairs
      // For full YAML support, a library like js-yaml would be needed
      const lines = content.split('\n');
      const config: ProjectConfig = {};

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const colonIndex = trimmed.indexOf(':');
          if (colonIndex > 0) {
            const key = trimmed.substring(0, colonIndex).trim();
            let value = trimmed.substring(colonIndex + 1).trim();

            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }

            if (value) {
              config[key] = value;
            }
          }
        }
      }

      return config;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a directory contains a .spec-workflow folder and extract project info
 * @param dirPath - Absolute path to the directory to check
 * @returns DiscoveredProject if valid, null otherwise
 */
async function checkForProject(dirPath: string): Promise<DiscoveredProject | null> {
  const specWorkflowPath = join(dirPath, '.spec-workflow');

  try {
    const stats = await fs.stat(specWorkflowPath);
    if (!stats.isDirectory()) {
      return null;
    }
  } catch {
    // .spec-workflow doesn't exist
    return null;
  }

  // Found a project with .spec-workflow
  const projectName = basename(dirPath);

  // Check for project config files
  const configFiles = ['project.yaml', 'project.yml', 'project.json'];
  let hasConfig = false;
  let archetype: string | undefined;

  for (const configFile of configFiles) {
    const configPath = join(specWorkflowPath, configFile);
    try {
      await fs.access(configPath);
      hasConfig = true;

      // Try to read archetype from config
      const config = await readConfigFile(configPath);
      if (config?.archetype && typeof config.archetype === 'string') {
        archetype = config.archetype;
      }
      break; // Found a config file, stop searching
    } catch {
      // Config file doesn't exist, continue checking
    }
  }

  return {
    path: dirPath,
    name: projectName,
    hasConfig,
    archetype
  };
}

/**
 * Recursively scan a directory for projects containing .spec-workflow folders
 *
 * @param rootPath - The root directory to start scanning from
 * @param depth - Maximum depth to recurse (default: 2). 0 means only scan rootPath itself.
 * @returns Array of discovered projects
 *
 * @example
 * ```typescript
 * const projects = await scanDirectory('/home/user/projects', 3);
 * for (const project of projects) {
 *   console.log(`Found: ${project.name} at ${project.path}`);
 * }
 * ```
 */
export async function scanDirectory(
  rootPath: string,
  depth: number = 2
): Promise<DiscoveredProject[]> {
  const absoluteRoot = resolve(rootPath);
  const projects: DiscoveredProject[] = [];

  async function scanRecursive(currentPath: string, currentDepth: number): Promise<void> {
    // Check if current directory is a project
    const project = await checkForProject(currentPath);
    if (project) {
      projects.push(project);
      // Don't recurse into projects that already have .spec-workflow
      return;
    }

    // Stop if we've reached max depth
    if (currentDepth >= depth) {
      return;
    }

    // Read directory contents
    let entries: string[];
    try {
      entries = await fs.readdir(currentPath);
    } catch (error: any) {
      // Permission error or other issue - skip this directory
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        // Silently skip inaccessible directories
        return;
      }
      // For other errors, also skip but could log if needed
      return;
    }

    // Process subdirectories
    const subdirPromises: Promise<void>[] = [];

    for (const entry of entries) {
      // Skip hidden directories (except .spec-workflow which we check above)
      if (isHiddenDirectory(entry)) {
        continue;
      }

      // Skip common directories that shouldn't contain projects
      if (entry === 'node_modules' || entry === 'vendor' || entry === '__pycache__' ||
          entry === '.git' || entry === 'dist' || entry === 'build' || entry === 'target') {
        continue;
      }

      const entryPath = join(currentPath, entry);

      try {
        const stats = await fs.stat(entryPath);
        if (stats.isDirectory()) {
          subdirPromises.push(scanRecursive(entryPath, currentDepth + 1));
        }
      } catch {
        // Skip entries we can't stat
      }
    }

    // Process all subdirectories concurrently
    await Promise.all(subdirPromises);
  }

  await scanRecursive(absoluteRoot, 0);

  // Sort by path for consistent ordering
  projects.sort((a, b) => a.path.localeCompare(b.path));

  return projects;
}

/**
 * Watch for new projects being created in a directory tree
 *
 * @param rootPath - The root directory to watch
 * @param callback - Function called when a new project is discovered
 * @returns Cleanup function to stop watching
 *
 * @example
 * ```typescript
 * const cleanup = watchForNewProjects('/home/user/projects', (project) => {
 *   console.log(`New project: ${project.name}`);
 * });
 *
 * // Later, when done watching:
 * cleanup();
 * ```
 */
export function watchForNewProjects(
  rootPath: string,
  callback: (project: DiscoveredProject) => void
): () => void {
  const absoluteRoot = resolve(rootPath);

  // Track pending callbacks to debounce
  const pendingCallbacks = new Map<string, NodeJS.Timeout>();
  const DEBOUNCE_MS = 500;

  // Track discovered projects to avoid duplicates
  const discoveredPaths = new Set<string>();

  // Watch for .spec-workflow directories being created
  // Use depth: 99 to watch deeply, but filter in handler
  const watcher = chokidar.watch(absoluteRoot, {
    ignoreInitial: true,
    persistent: true,
    depth: 3, // Limit depth to avoid performance issues
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/vendor/**',
      '**/__pycache__/**',
      '**/dist/**',
      '**/build/**',
      '**/target/**'
    ],
    ignorePermissionErrors: true
  });

  /**
   * Handle potential new project discovery
   */
  async function handlePotentialProject(specWorkflowPath: string): Promise<void> {
    // Get project root (parent of .spec-workflow)
    const projectPath = join(specWorkflowPath, '..');
    const resolvedProjectPath = resolve(projectPath);

    // Skip if already discovered
    if (discoveredPaths.has(resolvedProjectPath)) {
      return;
    }

    // Check if this is a valid project
    const project = await checkForProject(resolvedProjectPath);
    if (project) {
      discoveredPaths.add(resolvedProjectPath);
      callback(project);
    }
  }

  /**
   * Schedule a debounced check for a project
   */
  function scheduleProjectCheck(specWorkflowPath: string): void {
    const existing = pendingCallbacks.get(specWorkflowPath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      pendingCallbacks.delete(specWorkflowPath);
      handlePotentialProject(specWorkflowPath).catch((error) => {
        console.error(`Error checking project at ${specWorkflowPath}:`, error);
      });
    }, DEBOUNCE_MS);

    pendingCallbacks.set(specWorkflowPath, timer);
  }

  // Watch for .spec-workflow directories being added
  watcher.on('addDir', (dirPath: string) => {
    const normalizedPath = dirPath.replace(/\\/g, '/');

    // Check if this is a .spec-workflow directory
    if (normalizedPath.endsWith('/.spec-workflow') || basename(dirPath) === '.spec-workflow') {
      scheduleProjectCheck(dirPath);
    }
  });

  // Also watch for config files being added (might indicate project setup completion)
  watcher.on('add', (filePath: string) => {
    const fileName = basename(filePath);
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Check if this is a config file inside .spec-workflow
    if ((fileName === 'project.yaml' || fileName === 'project.yml' || fileName === 'project.json') &&
        normalizedPath.includes('/.spec-workflow/')) {
      const specWorkflowPath = join(filePath, '..');
      scheduleProjectCheck(specWorkflowPath);
    }
  });

  // Add error handler to prevent watcher crashes
  watcher.on('error', (error) => {
    console.error('Project scanner watcher error:', error);
    // Don't propagate error to prevent system crash
  });

  // Return cleanup function
  return () => {
    // Clear all pending debounced callbacks
    Array.from(pendingCallbacks.values()).forEach((timer) => {
      clearTimeout(timer);
    });
    pendingCallbacks.clear();

    // Remove all listeners and close watcher
    watcher.removeAllListeners();
    watcher.close().catch((error) => {
      console.error('Error closing project scanner watcher:', error);
    });
  };
}

/**
 * Get the archetype for a project from its config file
 * @param projectPath - Absolute path to the project root
 * @returns The archetype name if configured, undefined otherwise
 */
export async function getProjectArchetype(projectPath: string): Promise<string | undefined> {
  const specWorkflowPath = join(projectPath, '.spec-workflow');
  const configFiles = ['project.yaml', 'project.yml', 'project.json'];

  for (const configFile of configFiles) {
    const configPath = join(specWorkflowPath, configFile);
    try {
      await fs.access(configPath);
      const config = await readConfigFile(configPath);
      if (config?.archetype && typeof config.archetype === 'string') {
        return config.archetype;
      }
    } catch {
      // Config file doesn't exist, continue checking
    }
  }

  return undefined;
}

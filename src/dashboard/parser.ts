import { readFile, readdir, access, stat } from 'fs/promises';
import { join } from 'path';
import { PathUtils } from '../core/path-utils.js';
import { SpecData, SteeringStatus, SteeringDocumentInfo, TaskInfo } from '../types.js';
import { parseTaskProgress } from '../core/task-parser.js';
import archetypeRegistry from '../archetypes/archetype-registry.js';
import { ArchetypeDefinition } from '../archetypes/types.js';

export interface ParsedSpec extends SpecData {
  displayName: string;
}


export class SpecParser {
  private projectPath: string;
  private specsPath: string;
  private archiveSpecsPath: string;
  private steeringPath: string;

  constructor(projectPath: string) {
    // Path should already be translated by caller (ProjectManager)
    this.projectPath = projectPath;
    this.specsPath = PathUtils.getSpecPath(projectPath, '');
    this.archiveSpecsPath = PathUtils.getArchiveSpecsPath(projectPath);
    this.steeringPath = PathUtils.getSteeringPath(projectPath);
  }

  async getAllSpecs(): Promise<ParsedSpec[]> {
    try {
      await access(this.specsPath);
      const entries = await readdir(this.specsPath, { withFileTypes: true });
      const specDirs = entries.filter(entry => entry.isDirectory());
      
      const specs: ParsedSpec[] = [];
      for (const dir of specDirs) {
        const spec = await this.getSpec(dir.name);
        if (spec) {
          specs.push(spec);
        }
      }
      
      return specs.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  async getAllArchivedSpecs(): Promise<ParsedSpec[]> {
    try {
      await access(this.archiveSpecsPath);
      const entries = await readdir(this.archiveSpecsPath, { withFileTypes: true });
      const specDirs = entries.filter(entry => entry.isDirectory());
      
      const specs: ParsedSpec[] = [];
      for (const dir of specDirs) {
        const spec = await this.getArchivedSpec(dir.name);
        if (spec) {
          specs.push(spec);
        }
      }
      
      return specs.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  async getSpec(name: string): Promise<ParsedSpec | null> {
    try {
      const specDir = PathUtils.getSpecPath(this.projectPath, name);
      await access(specDir);

      const spec: ParsedSpec = {
        name,
        displayName: this.formatDisplayName(name),
        createdAt: '',
        lastModified: '',
        phases: {
          requirements: { exists: false },
          design: { exists: false },
          tasks: { exists: false },
          implementation: { exists: false }
        }
      };

      // Get directory stats
      const dirStats = await stat(specDir);
      spec.createdAt = dirStats.birthtime.toISOString();
      spec.lastModified = dirStats.mtime.toISOString();

      // Check each phase
      const requirementsPath = join(specDir, 'requirements.md');
      const designPath = join(specDir, 'design.md');
      const tasksPath = join(specDir, 'tasks.md');

      // Check requirements
      try {
        await access(requirementsPath);
        spec.phases.requirements.exists = true;
        const reqStats = await stat(requirementsPath);
        spec.phases.requirements.lastModified = reqStats.mtime.toISOString();
        
        // Update overall last modified if this is newer
        if (reqStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = reqStats.mtime.toISOString();
        }
      } catch {}

      // Check design
      try {
        await access(designPath);
        spec.phases.design.exists = true;
        const designStats = await stat(designPath);
        spec.phases.design.lastModified = designStats.mtime.toISOString();
        
        if (designStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = designStats.mtime.toISOString();
        }
      } catch {}

      // Check tasks
      try {
        await access(tasksPath);
        spec.phases.tasks.exists = true;
        const tasksStats = await stat(tasksPath);
        spec.phases.tasks.lastModified = tasksStats.mtime.toISOString();
        
        if (tasksStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = tasksStats.mtime.toISOString();
        }

        // Parse tasks to get progress
        const tasksContent = await readFile(tasksPath, 'utf-8');
        const taskProgress = parseTaskProgress(tasksContent);
        spec.taskProgress = {
          total: taskProgress.total,
          completed: taskProgress.completed,
          pending: taskProgress.pending
        };
      } catch {}

      // Implementation phase is always considered "exists" since it's ongoing manual work
      spec.phases.implementation.exists = true;

      return spec;
    } catch {
      return null;
    }
  }

  async getArchivedSpec(name: string): Promise<ParsedSpec | null> {
    try {
      const specDir = PathUtils.getArchiveSpecPath(this.projectPath, name);
      await access(specDir);

      const spec: ParsedSpec = {
        name,
        displayName: this.formatDisplayName(name),
        createdAt: '',
        lastModified: '',
        phases: {
          requirements: { exists: false },
          design: { exists: false },
          tasks: { exists: false },
          implementation: { exists: false }
        }
      };

      // Get directory stats
      const dirStats = await stat(specDir);
      spec.createdAt = dirStats.birthtime.toISOString();
      spec.lastModified = dirStats.mtime.toISOString();

      // Check each phase
      const requirementsPath = join(specDir, 'requirements.md');
      const designPath = join(specDir, 'design.md');
      const tasksPath = join(specDir, 'tasks.md');

      // Check requirements
      try {
        await access(requirementsPath);
        spec.phases.requirements.exists = true;
        const reqStats = await stat(requirementsPath);
        spec.phases.requirements.lastModified = reqStats.mtime.toISOString();
        
        // Update overall last modified if this is newer
        if (reqStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = reqStats.mtime.toISOString();
        }
      } catch {}

      // Check design
      try {
        await access(designPath);
        spec.phases.design.exists = true;
        const designStats = await stat(designPath);
        spec.phases.design.lastModified = designStats.mtime.toISOString();
        
        if (designStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = designStats.mtime.toISOString();
        }
      } catch {}

      // Check tasks
      try {
        await access(tasksPath);
        spec.phases.tasks.exists = true;
        const tasksStats = await stat(tasksPath);
        spec.phases.tasks.lastModified = tasksStats.mtime.toISOString();
        
        if (tasksStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = tasksStats.mtime.toISOString();
        }

        // Parse tasks to get progress
        const tasksContent = await readFile(tasksPath, 'utf-8');
        const taskProgress = parseTaskProgress(tasksContent);
        spec.taskProgress = {
          total: taskProgress.total,
          completed: taskProgress.completed,
          pending: taskProgress.pending
        };
      } catch {}

      // Implementation phase is always considered "exists" since it's ongoing manual work
      spec.phases.implementation.exists = true;

      return spec;
    } catch {
      return null;
    }
  }


  async getProjectSteeringStatus(archetypeName?: string): Promise<SteeringStatus> {
    // Get archetype definition if specified
    let archetype: ArchetypeDefinition | null = null;
    if (archetypeName) {
      const result = await archetypeRegistry.get(archetypeName);
      archetype = result ?? null;
    }

    const documents: Record<string, boolean> = {};
    const documentList: SteeringDocumentInfo[] = [];

    // Helper to check if a file exists
    const fileExists = async (filename: string): Promise<boolean> => {
      try {
        await access(join(this.steeringPath, filename));
        return true;
      } catch {
        return false;
      }
    };

    // Helper to get file mod time
    const getModTime = async (filename: string): Promise<string | undefined> => {
      try {
        const stats = await stat(join(this.steeringPath, filename));
        return stats.mtime.toISOString();
      } catch {
        return undefined;
      }
    };

    // Helper to capitalize display name
    const getDisplayName = (name: string): string => {
      const displayNames: Record<string, string> = {
        product: 'Product', tech: 'Technical', structure: 'Structure',
        architecture: 'Architecture', conventions: 'Conventions', documentation: 'Documentation',
        api: 'API', ux: 'UX', deployment: 'Deployment', legacy: 'Legacy',
        migration: 'Migration', compatibility: 'Compatibility', thesis: 'Thesis',
        methodology: 'Methodology', literature: 'Literature', evidence: 'Evidence', publication: 'Publication'
      };
      return displayNames[name] || name.charAt(0).toUpperCase() + name.slice(1);
    };

    let dirExists = false;
    let lastModified: string | undefined;

    try {
      await access(this.steeringPath);
      dirExists = true;
      const steeringStats = await stat(this.steeringPath);
      lastModified = steeringStats.mtime.toISOString();
    } catch {}

    if (archetype) {
      // Use archetype-specific steering documents
      const { required, optional, custom } = archetype.steering;

      // Add required standard docs
      for (const docName of required) {
        const exists = await fileExists(`${docName}.md`);
        documents[docName] = exists;
        documentList.push({
          name: docName,
          displayName: getDisplayName(docName),
          exists,
          lastModified: exists ? await getModTime(`${docName}.md`) : undefined
        });
      }

      // Add optional standard docs
      for (const docName of optional) {
        const exists = await fileExists(`${docName}.md`);
        documents[docName] = exists;
        documentList.push({
          name: docName,
          displayName: getDisplayName(docName),
          exists,
          lastModified: exists ? await getModTime(`${docName}.md`) : undefined
        });
      }

      // Add custom steering docs
      for (const customDoc of custom) {
        const exists = await fileExists(`${customDoc.name}.md`);
        documents[customDoc.name] = exists;
        documentList.push({
          name: customDoc.name,
          displayName: getDisplayName(customDoc.name),
          exists,
          lastModified: exists ? await getModTime(`${customDoc.name}.md`) : undefined,
          requiresPlanning: customDoc.requiresPlanning,
          planningContext: customDoc.planningContext
        });
      }
    } else {
      // Default: use standard steering documents
      documents.product = await fileExists('product.md');
      documents.tech = await fileExists('tech.md');
      documents.structure = await fileExists('structure.md');

      documentList.push(
        { name: 'product', displayName: 'Product', exists: documents.product, lastModified: documents.product ? await getModTime('product.md') : undefined },
        { name: 'tech', displayName: 'Technical', exists: documents.tech, lastModified: documents.tech ? await getModTime('tech.md') : undefined },
        { name: 'structure', displayName: 'Structure', exists: documents.structure, lastModified: documents.structure ? await getModTime('structure.md') : undefined }
      );
    }

    return {
      exists: dirExists,
      documents,
      documentList,
      archetype: archetype?.name,
      archetypeDisplayName: archetype?.displayName,
      lastModified
    };
  }


  private formatDisplayName(kebabCase: string): string {
    return kebabCase
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
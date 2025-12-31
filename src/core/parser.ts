import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { PathUtils } from './path-utils.js';
import { SpecData, SteeringStatus, SteeringDocumentInfo, PhaseStatus } from '../types.js';
import { parseTaskProgress } from './task-parser.js';
import archetypeRegistry from '../archetypes/archetype-registry.js';
import { ArchetypeDefinition, SteeringDocDef } from '../archetypes/types.js';

export class SpecParser {
  constructor(private projectPath: string) {}

  async getAllSpecs(): Promise<SpecData[]> {
    const specs: SpecData[] = [];
    const specsPath = PathUtils.getSpecPath(this.projectPath, '');
    
    try {
      const entries = await readdir(specsPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const spec = await this.getSpec(entry.name);
          if (spec) {
            specs.push(spec);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist yet
      return [];
    }
    
    return specs;
  }

  async getSpec(name: string): Promise<SpecData | null> {
    const specPath = PathUtils.getSpecPath(this.projectPath, name);
    
    try {
      const stats = await stat(specPath);
      if (!stats.isDirectory()) {
        return null;
      }
      
      // Read all phase files
      const requirements = await this.getPhaseStatus(specPath, 'requirements.md');
      const design = await this.getPhaseStatus(specPath, 'design.md');
      const tasks = await this.getPhaseStatus(specPath, 'tasks.md');
      
      // Parse task progress using unified parser
      let taskProgress = undefined;
      if (tasks.exists) {
        try {
          const tasksContent = await readFile(join(specPath, 'tasks.md'), 'utf-8');
          taskProgress = parseTaskProgress(tasksContent);
        } catch {
          // Error reading tasks file
        }
      }
      
      return {
        name,
        createdAt: stats.birthtime.toISOString(),
        lastModified: stats.mtime.toISOString(),
        phases: {
          requirements,
          design,
          tasks,
          implementation: {
            exists: taskProgress ? taskProgress.completed > 0 : false
          }
        },
        taskProgress
      };
    } catch (error) {
      return null;
    }
  }


  async getProjectSteeringStatus(archetypeName?: string): Promise<SteeringStatus> {
    const steeringPath = PathUtils.getSteeringPath(this.projectPath);

    // Get archetype definition if specified
    let archetype: ArchetypeDefinition | null = null;
    if (archetypeName) {
      const result = await archetypeRegistry.get(archetypeName);
      archetype = result ?? null;
    }

    try {
      const stats = await stat(steeringPath);

      // Always check standard docs for backward compatibility
      const productExists = await this.fileExists(join(steeringPath, 'product.md'));
      const techExists = await this.fileExists(join(steeringPath, 'tech.md'));
      const structureExists = await this.fileExists(join(steeringPath, 'structure.md'));

      const documents: Record<string, boolean> = {
        product: productExists,
        tech: techExists,
        structure: structureExists
      };

      // Build the document list based on archetype
      const documentList: SteeringDocumentInfo[] = [];

      if (archetype) {
        // Use archetype-specific steering documents
        const { required, optional, custom } = archetype.steering;

        // Add required standard docs
        for (const docName of required) {
          const exists = await this.fileExists(join(steeringPath, `${docName}.md`));
          documents[docName] = exists;
          documentList.push({
            name: docName,
            displayName: this.getDisplayName(docName),
            exists,
            lastModified: exists ? await this.getFileModTime(join(steeringPath, `${docName}.md`)) : undefined
          });
        }

        // Add optional standard docs
        for (const docName of optional) {
          const exists = await this.fileExists(join(steeringPath, `${docName}.md`));
          documents[docName] = exists;
          documentList.push({
            name: docName,
            displayName: this.getDisplayName(docName),
            exists,
            lastModified: exists ? await this.getFileModTime(join(steeringPath, `${docName}.md`)) : undefined
          });
        }

        // Add custom steering docs
        for (const customDoc of custom) {
          const exists = await this.fileExists(join(steeringPath, `${customDoc.name}.md`));
          documents[customDoc.name] = exists;
          documentList.push({
            name: customDoc.name,
            displayName: this.getDisplayName(customDoc.name),
            exists,
            lastModified: exists ? await this.getFileModTime(join(steeringPath, `${customDoc.name}.md`)) : undefined,
            requiresPlanning: customDoc.requiresPlanning,
            planningContext: customDoc.planningContext
          });
        }
      } else {
        // Default: use standard steering documents
        documentList.push(
          { name: 'product', displayName: 'Product', exists: productExists },
          { name: 'tech', displayName: 'Technical', exists: techExists },
          { name: 'structure', displayName: 'Structure', exists: structureExists }
        );
      }

      return {
        exists: stats.isDirectory(),
        documents,
        documentList,
        archetype: archetype?.name,
        archetypeDisplayName: archetype?.displayName,
        lastModified: stats.mtime.toISOString()
      };
    } catch (error) {
      // Directory doesn't exist - still return archetype info if available
      const documentList: SteeringDocumentInfo[] = [];
      const documents: Record<string, boolean> = {
        product: false,
        tech: false,
        structure: false
      };

      if (archetype) {
        const { required, optional, custom } = archetype.steering;

        for (const docName of [...required, ...optional]) {
          documents[docName] = false;
          documentList.push({
            name: docName,
            displayName: this.getDisplayName(docName),
            exists: false
          });
        }

        for (const customDoc of custom) {
          documents[customDoc.name] = false;
          documentList.push({
            name: customDoc.name,
            displayName: this.getDisplayName(customDoc.name),
            exists: false,
            requiresPlanning: customDoc.requiresPlanning,
            planningContext: customDoc.planningContext
          });
        }
      } else {
        documentList.push(
          { name: 'product', displayName: 'Product', exists: false },
          { name: 'tech', displayName: 'Technical', exists: false },
          { name: 'structure', displayName: 'Structure', exists: false }
        );
      }

      return {
        exists: false,
        documents,
        documentList,
        archetype: archetype?.name,
        archetypeDisplayName: archetype?.displayName
      };
    }
  }

  private getDisplayName(docName: string): string {
    const displayNames: Record<string, string> = {
      product: 'Product',
      tech: 'Technical',
      structure: 'Structure',
      architecture: 'Architecture',
      conventions: 'Conventions',
      documentation: 'Documentation',
      api: 'API',
      ux: 'UX',
      deployment: 'Deployment',
      legacy: 'Legacy',
      migration: 'Migration',
      compatibility: 'Compatibility',
      thesis: 'Thesis',
      methodology: 'Methodology',
      literature: 'Literature',
      evidence: 'Evidence',
      publication: 'Publication'
    };
    return displayNames[docName] || docName.charAt(0).toUpperCase() + docName.slice(1);
  }

  private async getFileModTime(filePath: string): Promise<string | undefined> {
    try {
      const stats = await stat(filePath);
      return stats.mtime.toISOString();
    } catch {
      return undefined;
    }
  }

  private async getPhaseStatus(basePath: string, filename: string): Promise<PhaseStatus> {
    const filePath = join(basePath, filename);
    
    try {
      const stats = await stat(filePath);
      const content = await readFile(filePath, 'utf-8');
      
      return {
        exists: true,
        lastModified: stats.mtime.toISOString(),
        content
      };
    } catch (error) {
      return {
        exists: false
      };
    }
  }


  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
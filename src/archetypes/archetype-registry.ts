import {
  ArchetypeDefinition,
  SteeringDocDef,
} from './types.js';
import { loadArchetype, listArchetypes } from './archetype-loader.js';

/**
 * Singleton registry for archetype definitions.
 * Provides lazy-loaded, cached access to all archetypes.
 */
class ArchetypeRegistry {
  private static instance: ArchetypeRegistry | null = null;

  /** Cached archetypes by name */
  private archetypes: Map<string, ArchetypeDefinition> = new Map();

  /** Whether archetypes have been loaded */
  private initialized: boolean = false;

  /** Initialization error, if any occurred */
  private initError: Error | null = null;

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {}

  /**
   * Get the singleton instance of the registry
   */
  public static getInstance(): ArchetypeRegistry {
    if (!ArchetypeRegistry.instance) {
      ArchetypeRegistry.instance = new ArchetypeRegistry();
    }
    return ArchetypeRegistry.instance;
  }

  /**
   * Ensure archetypes are loaded (lazy initialization)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Get list of all archetypes
      const archetypeInfos = await listArchetypes();

      // Load each archetype fully
      for (const info of archetypeInfos) {
        try {
          const definition = await loadArchetype(info.name);
          this.archetypes.set(definition.name, definition);
        } catch (error: any) {
          // Log warning but continue loading other archetypes
          console.warn(`Warning: Failed to load archetype '${info.name}': ${error.message}`);
        }
      }

      this.initialized = true;
    } catch (error: any) {
      this.initError = error;
      this.initialized = true; // Mark as initialized to avoid repeated failed attempts
      console.warn(`Warning: Failed to initialize archetype registry: ${error.message}`);
    }
  }

  /**
   * Get an archetype by name
   * Falls back to 'generic' archetype if the requested one is not found
   * @param name - The archetype name
   * @returns The archetype definition, or undefined if neither the requested nor generic exists
   */
  public async get(name: string): Promise<ArchetypeDefinition | undefined> {
    await this.ensureInitialized();

    // Try to get the requested archetype
    const archetype = this.archetypes.get(name);
    if (archetype) {
      return archetype;
    }

    // Fall back to 'generic' if the requested archetype wasn't found
    if (name !== 'generic') {
      const generic = this.archetypes.get('generic');
      if (generic) {
        console.warn(`Warning: Archetype '${name}' not found, falling back to 'generic'`);
        return generic;
      }
    }

    return undefined;
  }

  /**
   * Get all loaded archetypes
   * @returns Array of all archetype definitions
   */
  public async getAll(): Promise<ArchetypeDefinition[]> {
    await this.ensureInitialized();
    return Array.from(this.archetypes.values());
  }

  /**
   * Get the template names enabled for an archetype
   * @param archetype - The archetype name
   * @returns Array of template names that are enabled (e.g., ["requirements", "design", "tasks"])
   */
  public async getTemplatesFor(archetype: string): Promise<string[]> {
    const definition = await this.get(archetype);
    if (!definition) {
      // Default to all templates if archetype not found
      return ['requirements', 'design', 'tasks'];
    }

    const enabledTemplates: string[] = [];

    if (definition.templates.requirements) {
      enabledTemplates.push('requirements');
    }
    if (definition.templates.design) {
      enabledTemplates.push('design');
    }
    if (definition.templates.tasks) {
      enabledTemplates.push('tasks');
    }

    return enabledTemplates;
  }

  /**
   * Get steering document configuration for an archetype
   * @param archetype - The archetype name
   * @returns Object with required, optional, and custom steering doc arrays
   */
  public async getSteeringDocsFor(archetype: string): Promise<{
    required: string[];
    optional: string[];
    custom: SteeringDocDef[];
  }> {
    const definition = await this.get(archetype);
    if (!definition) {
      // Default steering configuration if archetype not found
      return {
        required: ['product', 'tech', 'structure'],
        optional: [],
        custom: [],
      };
    }

    return {
      required: [...definition.steering.required],
      optional: [...definition.steering.optional],
      custom: [...definition.steering.custom],
    };
  }

  /**
   * Reset the registry (primarily for testing)
   * Clears all cached data and resets initialization state
   */
  public reset(): void {
    this.archetypes.clear();
    this.initialized = false;
    this.initError = null;
  }
}

// Export the singleton instance as default
export default ArchetypeRegistry.getInstance();

// Also export the class for testing purposes
export { ArchetypeRegistry };

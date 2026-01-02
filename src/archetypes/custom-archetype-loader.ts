/**
 * Custom archetype loader for project-level archetypes.
 * Loads archetypes from .spec-workflow/archetypes/ directory.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import {
  ArchetypeDefinition,
  ArchetypeInfo,
  CustomArchetypeDefinition,
  toArchetypeInfo,
} from './types.js';
import { loadArchetype, listArchetypes as listBuiltInArchetypes } from './archetype-loader.js';
import { resolveArchetype, validateCustomArchetype, createStandaloneArchetype } from './archetype-merger.js';

/**
 * Get the path to the custom archetypes directory for a project.
 */
export function getCustomArchetypesDir(projectPath: string): string {
  return join(projectPath, '.spec-workflow', 'archetypes');
}

/**
 * Get the path to a custom archetype file.
 */
export function getCustomArchetypePath(projectPath: string, name: string): string {
  return join(getCustomArchetypesDir(projectPath), `${name}.json`);
}

/**
 * Check if a custom archetypes directory exists for a project.
 */
export async function hasCustomArchetypes(projectPath: string): Promise<boolean> {
  try {
    await fs.access(getCustomArchetypesDir(projectPath));
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure the custom archetypes directory exists.
 */
export async function ensureCustomArchetypesDir(projectPath: string): Promise<void> {
  const dir = getCustomArchetypesDir(projectPath);
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Load a custom archetype definition (raw, unresolved).
 */
export async function loadCustomArchetypeRaw(
  projectPath: string,
  name: string
): Promise<CustomArchetypeDefinition> {
  const filePath = getCustomArchetypePath(projectPath, name);

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Custom archetype '${name}' not found at: ${filePath}`);
    }
    throw new Error(`Failed to read custom archetype '${name}': ${error.message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error: any) {
    throw new Error(`Failed to parse custom archetype '${name}': Invalid JSON - ${error.message}`);
  }

  // Basic structure validation
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Custom archetype '${name}' must be an object`);
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.name !== 'string' || !obj.name) {
    throw new Error(`Custom archetype missing required 'name' field`);
  }

  if (typeof obj.displayName !== 'string' || !obj.displayName) {
    throw new Error(`Custom archetype '${obj.name}' missing required 'displayName' field`);
  }

  return parsed as CustomArchetypeDefinition;
}

/**
 * Load and resolve a custom archetype.
 * If the archetype has an 'extends' field, it will be merged with the base archetype.
 */
export async function loadCustomArchetype(
  projectPath: string,
  name: string
): Promise<ArchetypeDefinition> {
  const custom = await loadCustomArchetypeRaw(projectPath, name);

  // Get list of built-in archetype names for validation
  const builtIns = await listBuiltInArchetypes();
  const builtInNames = builtIns.map(a => a.name);

  // Validate
  const errors = validateCustomArchetype(custom, builtInNames);
  if (errors.length > 0) {
    throw new Error(`Invalid custom archetype '${name}': ${errors.join('; ')}`);
  }

  // Resolve inheritance
  if (custom.extends) {
    const base = await loadArchetype(custom.extends);
    return resolveArchetype(custom, base);
  }

  // Standalone archetype - create with defaults
  return createStandaloneArchetype(custom);
}

/**
 * List all custom archetypes for a project.
 * Returns raw (unresolved) definitions.
 */
export async function listCustomArchetypesRaw(
  projectPath: string
): Promise<CustomArchetypeDefinition[]> {
  const dir = getCustomArchetypesDir(projectPath);

  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // No custom archetypes directory
      return [];
    }
    throw new Error(`Failed to read custom archetypes directory: ${error.message}`);
  }

  const jsonFiles = files.filter(file => file.endsWith('.json'));
  const archetypes: CustomArchetypeDefinition[] = [];

  for (const file of jsonFiles) {
    const name = file.slice(0, -5); // Remove .json extension
    try {
      const raw = await loadCustomArchetypeRaw(projectPath, name);
      archetypes.push(raw);
    } catch (error: any) {
      console.warn(`Warning: Skipping invalid custom archetype '${name}': ${error.message}`);
    }
  }

  return archetypes;
}

/**
 * List all custom archetypes for a project (resolved).
 */
export async function listCustomArchetypes(
  projectPath: string
): Promise<ArchetypeInfo[]> {
  const dir = getCustomArchetypesDir(projectPath);

  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw new Error(`Failed to read custom archetypes directory: ${error.message}`);
  }

  const jsonFiles = files.filter(file => file.endsWith('.json'));
  const archetypes: ArchetypeInfo[] = [];

  for (const file of jsonFiles) {
    const name = file.slice(0, -5);
    try {
      const definition = await loadCustomArchetype(projectPath, name);
      archetypes.push(toArchetypeInfo(definition, true)); // isCustom = true
    } catch (error: any) {
      console.warn(`Warning: Skipping invalid custom archetype '${name}': ${error.message}`);
    }
  }

  archetypes.sort((a, b) => a.name.localeCompare(b.name));
  return archetypes;
}

/**
 * Save a custom archetype definition.
 */
export async function saveCustomArchetype(
  projectPath: string,
  definition: CustomArchetypeDefinition
): Promise<void> {
  // Validate before saving
  const builtIns = await listBuiltInArchetypes();
  const builtInNames = builtIns.map(a => a.name);

  const errors = validateCustomArchetype(definition, builtInNames);
  if (errors.length > 0) {
    throw new Error(`Invalid archetype: ${errors.join('; ')}`);
  }

  await ensureCustomArchetypesDir(projectPath);
  const filePath = getCustomArchetypePath(projectPath, definition.name);
  await fs.writeFile(filePath, JSON.stringify(definition, null, 2), 'utf-8');
}

/**
 * Delete a custom archetype.
 */
export async function deleteCustomArchetype(
  projectPath: string,
  name: string
): Promise<void> {
  const filePath = getCustomArchetypePath(projectPath, name);

  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Custom archetype '${name}' not found`);
    }
    throw new Error(`Failed to delete custom archetype '${name}': ${error.message}`);
  }
}

/**
 * Check if a custom archetype exists.
 */
export async function customArchetypeExists(
  projectPath: string,
  name: string
): Promise<boolean> {
  try {
    await fs.access(getCustomArchetypePath(projectPath, name));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all archetypes (built-in + custom) for a project.
 */
export async function getAllArchetypes(
  projectPath: string
): Promise<ArchetypeInfo[]> {
  const [builtIn, custom] = await Promise.all([
    listBuiltInArchetypes(),
    listCustomArchetypes(projectPath),
  ]);

  // Mark built-in archetypes
  const builtInWithFlag = builtIn.map(a => ({ ...a, isCustom: false }));

  // Combine and sort
  return [...builtInWithFlag, ...custom].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/**
 * Load an archetype by name, checking custom archetypes first.
 */
export async function loadArchetypeWithFallback(
  projectPath: string,
  name: string
): Promise<{ archetype: ArchetypeDefinition; isCustom: boolean }> {
  // Check custom first
  if (await customArchetypeExists(projectPath, name)) {
    const archetype = await loadCustomArchetype(projectPath, name);
    return { archetype, isCustom: true };
  }

  // Fall back to built-in
  const archetype = await loadArchetype(name);
  return { archetype, isCustom: false };
}

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  ArchetypeDefinition,
  ArchetypeInfo,
  ArchetypeTemplates,
  ArchetypeSteering,
  ArchetypeGuidance,
  SteeringDocDef,
  toArchetypeInfo,
} from './types.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Path to the definitions directory containing archetype JSON files
 */
const DEFINITIONS_DIR = join(__dirname, 'definitions');

/**
 * Validate that a value is a non-empty string
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate that a value is an array of strings
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Validate a SteeringDocDef object
 */
function validateSteeringDocDef(def: unknown, index: number): SteeringDocDef {
  if (typeof def !== 'object' || def === null) {
    throw new Error(`steering.custom[${index}] must be an object`);
  }

  const obj = def as Record<string, unknown>;

  if (!isNonEmptyString(obj.name)) {
    throw new Error(`steering.custom[${index}].name must be a non-empty string`);
  }
  if (!isNonEmptyString(obj.templateFile)) {
    throw new Error(`steering.custom[${index}].templateFile must be a non-empty string`);
  }
  if (!isNonEmptyString(obj.description)) {
    throw new Error(`steering.custom[${index}].description must be a non-empty string`);
  }

  return {
    name: obj.name,
    templateFile: obj.templateFile,
    description: obj.description,
  };
}

/**
 * Validate ArchetypeTemplates object
 */
function validateTemplates(templates: unknown): ArchetypeTemplates {
  if (typeof templates !== 'object' || templates === null) {
    throw new Error('templates must be an object');
  }

  const obj = templates as Record<string, unknown>;

  if (typeof obj.requirements !== 'boolean') {
    throw new Error('templates.requirements must be a boolean');
  }
  if (typeof obj.design !== 'boolean') {
    throw new Error('templates.design must be a boolean');
  }
  if (typeof obj.tasks !== 'boolean') {
    throw new Error('templates.tasks must be a boolean');
  }

  return {
    requirements: obj.requirements,
    design: obj.design,
    tasks: obj.tasks,
  };
}

/**
 * Validate ArchetypeSteering object
 */
function validateSteering(steering: unknown): ArchetypeSteering {
  if (typeof steering !== 'object' || steering === null) {
    throw new Error('steering must be an object');
  }

  const obj = steering as Record<string, unknown>;

  if (!isStringArray(obj.required)) {
    throw new Error('steering.required must be an array of strings');
  }
  if (!isStringArray(obj.optional)) {
    throw new Error('steering.optional must be an array of strings');
  }
  if (!Array.isArray(obj.custom)) {
    throw new Error('steering.custom must be an array');
  }

  const customDocs = obj.custom.map((item, index) => validateSteeringDocDef(item, index));

  return {
    required: obj.required,
    optional: obj.optional,
    custom: customDocs,
  };
}

/**
 * Validate ArchetypeGuidance object
 */
function validateGuidance(guidance: unknown): ArchetypeGuidance {
  if (typeof guidance !== 'object' || guidance === null) {
    throw new Error('guidance must be an object');
  }

  const obj = guidance as Record<string, unknown>;

  if (!isStringArray(obj.workflowEmphasis)) {
    throw new Error('guidance.workflowEmphasis must be an array of strings');
  }
  if (!isNonEmptyString(obj.documentationFocus)) {
    throw new Error('guidance.documentationFocus must be a non-empty string');
  }
  if (!isStringArray(obj.keyConsiderations)) {
    throw new Error('guidance.keyConsiderations must be an array of strings');
  }

  return {
    workflowEmphasis: obj.workflowEmphasis,
    documentationFocus: obj.documentationFocus,
    keyConsiderations: obj.keyConsiderations,
  };
}

/**
 * Validate and type-check an archetype definition
 * @param def - The unknown value to validate
 * @returns A validated ArchetypeDefinition
 * @throws Error if the definition is invalid
 */
export function validateArchetype(def: unknown): ArchetypeDefinition {
  if (typeof def !== 'object' || def === null) {
    throw new Error('Archetype definition must be an object');
  }

  const obj = def as Record<string, unknown>;

  // Validate top-level required string fields
  if (!isNonEmptyString(obj.name)) {
    throw new Error('Archetype name must be a non-empty string');
  }
  if (!isNonEmptyString(obj.displayName)) {
    throw new Error('Archetype displayName must be a non-empty string');
  }
  if (!isNonEmptyString(obj.description)) {
    throw new Error('Archetype description must be a non-empty string');
  }

  // Validate nested objects
  const templates = validateTemplates(obj.templates);
  const steering = validateSteering(obj.steering);
  const guidance = validateGuidance(obj.guidance);

  return {
    name: obj.name,
    displayName: obj.displayName,
    description: obj.description,
    templates,
    steering,
    guidance,
  };
}

/**
 * Load a single archetype definition by name
 * @param name - The archetype name (without .json extension)
 * @returns The validated archetype definition
 * @throws Error if the archetype file is not found or invalid
 */
export async function loadArchetype(name: string): Promise<ArchetypeDefinition> {
  const filePath = join(DEFINITIONS_DIR, `${name}.json`);

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Archetype '${name}' not found. Expected file at: ${filePath}`);
    }
    throw new Error(`Failed to read archetype '${name}': ${error.message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error: any) {
    throw new Error(`Failed to parse archetype '${name}': Invalid JSON - ${error.message}`);
  }

  try {
    return validateArchetype(parsed);
  } catch (error: any) {
    throw new Error(`Invalid archetype '${name}': ${error.message}`);
  }
}

/**
 * List all available archetypes with their basic info
 * @returns Array of ArchetypeInfo objects
 */
export async function listArchetypes(): Promise<ArchetypeInfo[]> {
  let files: string[];
  try {
    files = await fs.readdir(DEFINITIONS_DIR);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // Definitions directory doesn't exist yet
      return [];
    }
    throw new Error(`Failed to read archetypes directory: ${error.message}`);
  }

  const jsonFiles = files.filter((file) => file.endsWith('.json'));
  const archetypes: ArchetypeInfo[] = [];

  for (const file of jsonFiles) {
    const name = file.slice(0, -5); // Remove .json extension
    try {
      const definition = await loadArchetype(name);
      archetypes.push(toArchetypeInfo(definition));
    } catch (error: any) {
      // Log warning but continue loading other archetypes
      console.warn(`Warning: Skipping invalid archetype '${name}': ${error.message}`);
    }
  }

  // Sort alphabetically by name for consistent ordering
  archetypes.sort((a, b) => a.name.localeCompare(b.name));

  return archetypes;
}

/**
 * Archetype inheritance resolution.
 * Merges custom archetype definitions with their base archetypes.
 */

import {
  ArchetypeDefinition,
  ArchetypeSteering,
  ArchetypeGuidance,
  ArchetypeTemplates,
  CustomArchetypeDefinition,
  CustomSteeringConfig,
  SteeringDocDef,
} from './types.js';

/**
 * Resolve a custom archetype by merging it with its base archetype.
 *
 * @param custom - The custom archetype definition (partial)
 * @param base - The base archetype to inherit from
 * @returns Fully resolved ArchetypeDefinition
 */
export function resolveArchetype(
  custom: CustomArchetypeDefinition,
  base: ArchetypeDefinition
): ArchetypeDefinition {
  return {
    name: custom.name,
    displayName: custom.displayName,
    description: custom.description ?? base.description,
    templates: mergeTemplates(base.templates, custom.templates),
    steering: mergeSteering(base.steering, custom.steering),
    guidance: mergeGuidance(base.guidance, custom.guidance),
    readme: custom.readme ?? base.readme,
  };
}

/**
 * Merge template configuration.
 * Custom values override base values.
 */
function mergeTemplates(
  base: ArchetypeTemplates,
  custom?: Partial<ArchetypeTemplates>
): ArchetypeTemplates {
  if (!custom) return { ...base };

  return {
    requirements: custom.requirements ?? base.requirements,
    design: custom.design ?? base.design,
    tasks: custom.tasks ?? base.tasks,
  };
}

/**
 * Merge steering configuration.
 * Handles addition and removal (via "-docname" syntax) of steering docs.
 */
function mergeSteering(
  base: ArchetypeSteering,
  custom?: CustomSteeringConfig
): ArchetypeSteering {
  if (!custom) return { ...base, custom: [...base.custom] };

  return {
    required: mergeSteeringDocs(base.required, custom.required),
    optional: mergeSteeringDocs(base.optional, custom.optional),
    custom: mergeCustomDocs(base.custom, custom.custom),
  };
}

/**
 * Merge steering doc arrays with support for:
 * - Adding new docs (string or SteeringDocDef)
 * - Removing inherited docs via "-docname" syntax
 */
function mergeSteeringDocs(
  base: string[],
  custom?: (string | SteeringDocDef)[]
): string[] {
  if (!custom) return [...base];

  // Separate removals from additions
  const removals = new Set<string>();
  const additions: string[] = [];

  for (const item of custom) {
    if (typeof item === 'string') {
      if (item.startsWith('-')) {
        // Remove from base
        removals.add(item.slice(1));
      } else {
        // Add to list
        additions.push(item);
      }
    } else {
      // SteeringDocDef - add the name
      additions.push(item.name);
    }
  }

  // Start with base, remove specified items, add new items
  const result = base.filter(doc => !removals.has(doc));

  // Add new items that aren't already present
  for (const addition of additions) {
    if (!result.includes(addition)) {
      result.push(addition);
    }
  }

  return result;
}

/**
 * Merge custom steering doc definitions.
 * Custom definitions are added to base definitions.
 * If a custom doc has the same name as a base doc, it overrides it.
 */
function mergeCustomDocs(
  base: SteeringDocDef[],
  custom?: SteeringDocDef[]
): SteeringDocDef[] {
  if (!custom) return [...base];

  // Create a map of base docs by name
  const docMap = new Map<string, SteeringDocDef>();
  for (const doc of base) {
    docMap.set(doc.name, doc);
  }

  // Override or add custom docs
  for (const doc of custom) {
    docMap.set(doc.name, doc);
  }

  return Array.from(docMap.values());
}

/**
 * Merge guidance configuration.
 * Custom values override base values, arrays are replaced not merged.
 */
function mergeGuidance(
  base: ArchetypeGuidance,
  custom?: Partial<ArchetypeGuidance>
): ArchetypeGuidance {
  if (!custom) return { ...base };

  return {
    workflowEmphasis: custom.workflowEmphasis ?? base.workflowEmphasis,
    documentationFocus: custom.documentationFocus ?? base.documentationFocus,
    documentationStyle: custom.documentationStyle ?? base.documentationStyle,
    keyConsiderations: custom.keyConsiderations ?? base.keyConsiderations,
  };
}

/**
 * Validate a custom archetype definition.
 * Returns an array of error messages (empty if valid).
 */
export function validateCustomArchetype(
  custom: CustomArchetypeDefinition,
  builtInNames: string[]
): string[] {
  const errors: string[] = [];

  // Required fields
  if (!custom.name) {
    errors.push('name is required');
  } else {
    // Name format validation
    if (!/^[a-z0-9-]+$/.test(custom.name)) {
      errors.push('name must contain only lowercase letters, numbers, and hyphens');
    }
    // No collision with built-in archetypes
    if (builtInNames.includes(custom.name)) {
      errors.push(`name '${custom.name}' conflicts with a built-in archetype`);
    }
  }

  if (!custom.displayName) {
    errors.push('displayName is required');
  }

  // If extends is specified, validate it references a valid archetype
  if (custom.extends && !builtInNames.includes(custom.extends)) {
    errors.push(`extends references unknown archetype '${custom.extends}'`);
  }

  // Validate steering doc definitions
  if (custom.steering?.custom) {
    for (const doc of custom.steering.custom) {
      if (!doc.name) {
        errors.push('custom steering doc missing name');
      }
      if (!doc.templateFile) {
        errors.push(`custom steering doc '${doc.name || 'unknown'}' missing templateFile`);
      }
      if (!doc.description) {
        errors.push(`custom steering doc '${doc.name || 'unknown'}' missing description`);
      }
      // Check for path traversal
      if (doc.templateFile && doc.templateFile.includes('..')) {
        errors.push(`templateFile '${doc.templateFile}' contains path traversal`);
      }
    }
  }

  return errors;
}

/**
 * Create a standalone custom archetype (no inheritance).
 * Provides defaults for all required fields.
 */
export function createStandaloneArchetype(
  custom: CustomArchetypeDefinition
): ArchetypeDefinition {
  return {
    name: custom.name,
    displayName: custom.displayName,
    description: custom.description ?? '',
    templates: custom.templates ? {
      requirements: custom.templates.requirements ?? true,
      design: custom.templates.design ?? true,
      tasks: custom.templates.tasks ?? true,
    } : {
      requirements: true,
      design: true,
      tasks: true,
    },
    steering: {
      required: extractSteeringNames(custom.steering?.required),
      optional: extractSteeringNames(custom.steering?.optional),
      custom: custom.steering?.custom ?? [],
    },
    guidance: {
      workflowEmphasis: custom.guidance?.workflowEmphasis ?? [],
      documentationFocus: custom.guidance?.documentationFocus ?? 'Standard documentation practices',
      documentationStyle: custom.guidance?.documentationStyle,
      keyConsiderations: custom.guidance?.keyConsiderations ?? [],
    },
    readme: custom.readme,
  };
}

/**
 * Extract steering doc names from mixed string/SteeringDocDef array.
 * Filters out removal entries (starting with "-").
 */
function extractSteeringNames(items?: (string | SteeringDocDef)[]): string[] {
  if (!items) return [];

  return items
    .filter(item => {
      if (typeof item === 'string') {
        return !item.startsWith('-');
      }
      return true;
    })
    .map(item => typeof item === 'string' ? item : item.name);
}

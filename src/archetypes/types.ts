// Archetype system types for spec-workflow-mcp

/**
 * Definition for a custom steering document specific to an archetype
 */
export interface SteeringDocDef {
  /** Document name (e.g., "methodology") */
  name: string;
  /** Template filename to use */
  templateFile: string;
  /** Description of what this document covers */
  description: string;
  /** Whether creating this doc requires planning mode first (default: false) */
  requiresPlanning?: boolean;
  /** Which steering docs to read as context before planning this doc */
  planningContext?: string[];
}

/**
 * Template configuration for an archetype
 */
export interface ArchetypeTemplates {
  /** Include requirements template */
  requirements: boolean;
  /** Include design template */
  design: boolean;
  /** Include tasks template */
  tasks: boolean;
}

/**
 * Steering document configuration for an archetype
 */
export interface ArchetypeSteering {
  /** Required steering documents (e.g., ["product", "tech", "structure"]) */
  required: string[];
  /** Optional steering documents */
  optional: string[];
  /** Custom steering documents specific to this archetype */
  custom: SteeringDocDef[];
}

/**
 * What type of output this archetype produces
 * - "code": Software development - output is working code
 * - "document": Document creation - output is a document (planning doc, proposal, etc.)
 * - "artifact-set": Multiple artifacts - output includes docs, spreadsheets, slides, etc.
 */
export type ArchetypeOutputType = 'code' | 'document' | 'artifact-set';

/**
 * Guidance configuration for AI agents
 */
export interface ArchetypeGuidance {
  /** What type of output this archetype produces (default: "code") */
  outputType?: ArchetypeOutputType;
  /** Key points to emphasize in workflow guidance */
  workflowEmphasis: string[];
  /** What "documentation" means for this project type */
  documentationFocus: string;
  /** Documentation style preference (e.g., "rich-inline-external", "minimal-inline", "external-first") */
  documentationStyle?: string;
  /** Things to highlight when creating specs */
  keyConsiderations: string[];
}

/**
 * README structure configuration
 */
export interface ArchetypeReadme {
  /** Sections to include in README, in order */
  sections: string[];
}

/**
 * Complete archetype definition
 */
export interface ArchetypeDefinition {
  /** Archetype identifier (e.g., "greenfield", "brownfield") */
  name: string;
  /** Display name for UI (e.g., "Greenfield Project") */
  displayName: string;
  /** User-facing description */
  description: string;
  /** Which templates to include */
  templates: ArchetypeTemplates;
  /** Steering document configuration */
  steering: ArchetypeSteering;
  /** Guidance for AI agents */
  guidance: ArchetypeGuidance;
  /** README structure for this archetype */
  readme?: ArchetypeReadme;
}

/**
 * Abbreviated archetype info for listing/display
 */
export interface ArchetypeInfo {
  /** Archetype identifier */
  name: string;
  /** Display name for UI */
  displayName: string;
  /** User-facing description */
  description: string;
  /** Whether this is a custom (project-level) archetype */
  isCustom?: boolean;
}

/**
 * Custom steering configuration for custom archetypes.
 * Supports partial definition and removal of inherited docs via "-docname" syntax.
 */
export interface CustomSteeringConfig {
  /** Required steering documents to add (or "-name" to remove from inherited) */
  required?: (string | SteeringDocDef)[];
  /** Optional steering documents to add (or "-name" to remove from inherited) */
  optional?: (string | SteeringDocDef)[];
  /** Custom steering documents specific to this archetype */
  custom?: SteeringDocDef[];
}

/**
 * Custom archetype definition for project-level archetypes.
 * Supports inheritance from built-in archetypes via 'extends'.
 */
export interface CustomArchetypeDefinition {
  /** Unique archetype identifier (required) */
  name: string;
  /** Display name for UI (required) */
  displayName: string;
  /** User-facing description */
  description?: string;
  /** Base archetype to inherit from (e.g., "brownfield", "greenfield") */
  extends?: string;
  /** Override templates configuration */
  templates?: Partial<ArchetypeTemplates>;
  /** Override steering configuration (merged with base) */
  steering?: CustomSteeringConfig;
  /** Override guidance configuration (merged with base) */
  guidance?: Partial<ArchetypeGuidance>;
  /** Override README structure */
  readme?: ArchetypeReadme;
}

/**
 * Convert full ArchetypeDefinition to abbreviated ArchetypeInfo
 */
export function toArchetypeInfo(def: ArchetypeDefinition, isCustom = false): ArchetypeInfo {
  return {
    name: def.name,
    displayName: def.displayName,
    description: def.description,
    isCustom,
  };
}

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
 * Guidance configuration for AI agents
 */
export interface ArchetypeGuidance {
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
}

/**
 * Convert full ArchetypeDefinition to abbreviated ArchetypeInfo
 */
export function toArchetypeInfo(def: ArchetypeDefinition): ArchetypeInfo {
  return {
    name: def.name,
    displayName: def.displayName,
    description: def.description,
  };
}

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import archetypeRegistry from '../archetypes/archetype-registry.js';
import { listArchetypes } from '../archetypes/archetype-loader.js';
import {
  loadCustomArchetypeRaw,
  loadCustomArchetype,
  saveCustomArchetype,
  deleteCustomArchetype,
  customArchetypeExists,
  listCustomArchetypes,
  getAllArchetypes,
} from '../archetypes/custom-archetype-loader.js';
import { validateCustomArchetype, resolveArchetype, createStandaloneArchetype } from '../archetypes/archetype-merger.js';
import { CustomArchetypeDefinition } from '../archetypes/types.js';

export const manageArchetypeTool: Tool = {
  name: 'manage-archetype',
  description: `Create, update, delete, or inspect custom archetypes for this project.

Custom archetypes allow you to define project-specific documentation structures and workflows beyond the built-in archetypes (greenfield, brownfield, web-app, code-library, research-paper, generic).

## Actions

- **list**: List all archetypes (built-in and custom)
- **inspect**: Get detailed information about a specific archetype
- **create**: Create a new custom archetype
- **update**: Update an existing custom archetype
- **delete**: Delete a custom archetype
- **validate**: Validate an archetype definition without saving

## Inheritance

Custom archetypes can extend built-in archetypes using the 'extends' field:
- Inherit all settings from the base archetype
- Override specific fields as needed
- Add/remove steering docs with "-docname" syntax

## Example

Create a data-pipeline archetype that extends brownfield:

\`\`\`json
{
  "name": "data-pipeline",
  "displayName": "Data Pipeline",
  "description": "ETL and data processing projects",
  "extends": "brownfield",
  "steering": {
    "required": [
      { "name": "data-flow", "templateFile": "data-flow.md", "description": "Data flow diagrams" },
      { "name": "schema", "templateFile": "schema.md", "description": "Data schemas" }
    ],
    "optional": ["-legacy"]
  }
}
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Absolute path to the project root (optional - uses server context path if not provided)',
      },
      action: {
        type: 'string',
        enum: ['list', 'inspect', 'create', 'update', 'delete', 'validate'],
        description: 'The action to perform',
      },
      name: {
        type: 'string',
        description: 'Archetype name (required for inspect, update, delete)',
      },
      definition: {
        type: 'object',
        description: 'Custom archetype definition (required for create, update, validate)',
        properties: {
          name: { type: 'string', description: 'Unique identifier (lowercase, hyphens allowed)' },
          displayName: { type: 'string', description: 'Human-readable name' },
          description: { type: 'string', description: 'What this archetype is for' },
          extends: { type: 'string', description: 'Base archetype to inherit from' },
          steering: {
            type: 'object',
            description: 'Steering document configuration',
          },
          guidance: {
            type: 'object',
            description: 'AI guidance configuration',
          },
          templates: {
            type: 'object',
            description: 'Template configuration (requirements, design, tasks)',
          },
        },
      },
    },
    required: ['action'],
  },
};

export async function manageArchetypeHandler(
  args: any,
  context: ToolContext
): Promise<ToolResponse> {
  const { action, name, definition } = args;
  const projectPath = args.projectPath || context.projectPath;

  if (!projectPath) {
    return {
      success: false,
      message: 'Project path is required but not provided in context or arguments',
    };
  }

  try {
    switch (action) {
      case 'list':
        return await handleList(projectPath);

      case 'inspect':
        if (!name) {
          return {
            success: false,
            message: 'name is required for inspect action',
          };
        }
        return await handleInspect(projectPath, name);

      case 'create':
        if (!definition) {
          return {
            success: false,
            message: 'definition is required for create action',
          };
        }
        return await handleCreate(projectPath, definition);

      case 'update':
        if (!name) {
          return {
            success: false,
            message: 'name is required for update action',
          };
        }
        if (!definition) {
          return {
            success: false,
            message: 'definition is required for update action',
          };
        }
        return await handleUpdate(projectPath, name, definition);

      case 'delete':
        if (!name) {
          return {
            success: false,
            message: 'name is required for delete action',
          };
        }
        return await handleDelete(projectPath, name);

      case 'validate':
        if (!definition) {
          return {
            success: false,
            message: 'definition is required for validate action',
          };
        }
        return await handleValidate(projectPath, definition);

      default:
        return {
          success: false,
          message: `Unknown action: ${action}. Valid actions: list, inspect, create, update, delete, validate`,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to ${action} archetype: ${errorMessage}`,
    };
  }
}

async function handleList(projectPath: string): Promise<ToolResponse> {
  const [builtIn, custom] = await Promise.all([
    listArchetypes(),
    listCustomArchetypes(projectPath),
  ]);

  return {
    success: true,
    message: `Found ${builtIn.length} built-in and ${custom.length} custom archetype(s)`,
    data: {
      builtIn: builtIn.map(a => ({
        name: a.name,
        displayName: a.displayName,
        description: a.description,
      })),
      custom: custom.map(a => ({
        name: a.name,
        displayName: a.displayName,
        description: a.description,
      })),
    },
    nextSteps: custom.length === 0
      ? ['Use action: "create" to create your first custom archetype']
      : ['Use action: "inspect" with name to see archetype details'],
  };
}

async function handleInspect(projectPath: string, name: string): Promise<ToolResponse> {
  // Check if it's a custom archetype
  const isCustom = await customArchetypeExists(projectPath, name);

  if (isCustom) {
    const raw = await loadCustomArchetypeRaw(projectPath, name);
    const resolved = await loadCustomArchetype(projectPath, name);

    return {
      success: true,
      message: `Custom archetype '${name}' details`,
      data: {
        isCustom: true,
        raw,
        resolved,
        extendsFrom: raw.extends || null,
      },
    };
  }

  // Check built-in
  const archetype = await archetypeRegistry.get(name);
  if (archetype) {
    return {
      success: true,
      message: `Built-in archetype '${name}' details`,
      data: {
        isCustom: false,
        definition: archetype,
      },
      nextSteps: [
        `To create a custom archetype that extends '${name}', use action: "create" with extends: "${name}"`,
      ],
    };
  }

  return {
    success: false,
    message: `Archetype '${name}' not found`,
    nextSteps: ['Use action: "list" to see available archetypes'],
  };
}

async function handleCreate(
  projectPath: string,
  definition: CustomArchetypeDefinition
): Promise<ToolResponse> {
  // Validate required fields
  if (!definition.name) {
    return {
      success: false,
      message: 'name is required in definition',
    };
  }

  if (!definition.displayName) {
    return {
      success: false,
      message: 'displayName is required in definition',
    };
  }

  // Check if already exists
  if (await customArchetypeExists(projectPath, definition.name)) {
    return {
      success: false,
      message: `Custom archetype '${definition.name}' already exists. Use action: "update" to modify it.`,
    };
  }

  // Validate
  const builtIns = await listArchetypes();
  const builtInNames = builtIns.map(a => a.name);
  const errors = validateCustomArchetype(definition, builtInNames);

  if (errors.length > 0) {
    return {
      success: false,
      message: `Invalid archetype definition: ${errors.join('; ')}`,
    };
  }

  // Save
  await saveCustomArchetype(projectPath, definition);

  // Resolve to show final result
  let resolved;
  if (definition.extends) {
    const { loadArchetype } = await import('../archetypes/archetype-loader.js');
    const base = await loadArchetype(definition.extends);
    resolved = resolveArchetype(definition, base);
  } else {
    resolved = createStandaloneArchetype(definition);
  }

  return {
    success: true,
    message: `Created custom archetype '${definition.name}'`,
    data: {
      name: definition.name,
      displayName: definition.displayName,
      extendsFrom: definition.extends || null,
      resolved,
      storagePath: `.spec-workflow/archetypes/${definition.name}.json`,
    },
    nextSteps: [
      `Set this as the project archetype using the archetype-transition tool or dashboard Settings`,
      `View in dashboard at /archetypes`,
    ],
  };
}

async function handleUpdate(
  projectPath: string,
  name: string,
  updates: Partial<CustomArchetypeDefinition>
): Promise<ToolResponse> {
  // Check if exists
  if (!(await customArchetypeExists(projectPath, name))) {
    return {
      success: false,
      message: `Custom archetype '${name}' not found. Use action: "create" to create a new archetype.`,
    };
  }

  // Load existing
  const existing = await loadCustomArchetypeRaw(projectPath, name);

  // Merge updates (preserve name)
  const updated: CustomArchetypeDefinition = {
    ...existing,
    ...updates,
    name, // Cannot change name
  };

  // Validate
  const builtIns = await listArchetypes();
  const builtInNames = builtIns.map(a => a.name);
  const errors = validateCustomArchetype(updated, builtInNames);

  if (errors.length > 0) {
    return {
      success: false,
      message: `Invalid archetype definition: ${errors.join('; ')}`,
    };
  }

  // Save
  await saveCustomArchetype(projectPath, updated);

  return {
    success: true,
    message: `Updated custom archetype '${name}'`,
    data: {
      name,
      updated,
      storagePath: `.spec-workflow/archetypes/${name}.json`,
    },
  };
}

async function handleDelete(projectPath: string, name: string): Promise<ToolResponse> {
  // Check if exists
  if (!(await customArchetypeExists(projectPath, name))) {
    return {
      success: false,
      message: `Custom archetype '${name}' not found`,
    };
  }

  await deleteCustomArchetype(projectPath, name);

  return {
    success: true,
    message: `Deleted custom archetype '${name}'`,
    nextSteps: [
      'If this was the active project archetype, set a new one using the archetype-transition tool or dashboard Settings',
    ],
  };
}

async function handleValidate(
  projectPath: string,
  definition: CustomArchetypeDefinition
): Promise<ToolResponse> {
  const builtIns = await listArchetypes();
  const builtInNames = builtIns.map(a => a.name);

  const errors = validateCustomArchetype(definition, builtInNames);

  if (errors.length > 0) {
    return {
      success: false,
      message: 'Validation failed',
      data: { errors },
    };
  }

  // Try to resolve to verify inheritance
  let resolved;
  try {
    if (definition.extends) {
      const { loadArchetype } = await import('../archetypes/archetype-loader.js');
      const base = await loadArchetype(definition.extends);
      resolved = resolveArchetype(definition, base);
    } else {
      resolved = createStandaloneArchetype(definition);
    }
  } catch (error) {
    return {
      success: false,
      message: `Validation failed during resolution: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  return {
    success: true,
    message: 'Archetype definition is valid',
    data: {
      valid: true,
      resolved,
    },
    nextSteps: ['Use action: "create" to save this archetype'],
  };
}

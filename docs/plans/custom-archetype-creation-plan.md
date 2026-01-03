# Custom Archetype Creation (#27) - Implementation Plan

## Overview

Enable users to create custom archetypes beyond the built-in ones (greenfield, brownfield, web-app, code-library, research-paper, generic). Custom archetypes are stored at the project level and can inherit from existing archetypes with field overrides.

## User Requirements (Confirmed)

- **Storage**: Project-level only (`.spec-workflow/archetypes/`)
- **Inheritance**: Yes, extend existing archetypes with selective overrides
- **Creation UX**: Both dashboard UI form AND direct JSON file editing

---

## Implementation Phases

### Phase 1: Core Infrastructure (Backend)

#### 1.1 Custom Archetype Loader

**File**: `src/archetypes/custom-archetype-loader.ts` (NEW)

```typescript
interface CustomArchetypeDefinition extends Partial<ArchetypeDefinition> {
  name: string;  // Required - unique identifier
  displayName: string;  // Required
  extends?: string;  // Optional - base archetype to inherit from
}
```

Responsibilities:
- Load custom archetypes from `.spec-workflow/archetypes/*.json`
- Validate partial definitions
- Resolve inheritance by merging with base archetype
- Return fully-resolved ArchetypeDefinition

#### 1.2 Modify Archetype Registry

**File**: `src/archetypes/archetype-registry.ts` (MODIFY)

Changes:
- Add project path awareness to `get()` method
- Check project-level archetypes first, fall back to built-in
- New method: `getCustomArchetypes(projectPath)` - list project archetypes
- New method: `isCustomArchetype(name, projectPath)` - check if custom
- Cache invalidation when custom archetypes change

#### 1.3 Inheritance Resolution

**File**: `src/archetypes/archetype-merger.ts` (NEW)

```typescript
function resolveArchetype(
  custom: CustomArchetypeDefinition,
  base: ArchetypeDefinition
): ArchetypeDefinition {
  // Deep merge with custom values taking precedence
  // Handle array merging for steering.required, steering.optional
  // Preserve base templates unless explicitly overridden
}
```

Merge strategy:
- Simple fields: Custom overrides base
- `steering.required[]`: Union of base + custom, custom can remove via `"-docname"`
- `steering.optional[]`: Same union logic
- `guidance`: Deep merge, custom fields override
- `templates`: Custom overrides specific templates

---

### Phase 2: API Endpoints

**File**: `src/dashboard/multi-server.ts` (MODIFY)

#### 2.1 List Custom Archetypes
```
GET /api/projects/:projectId/custom-archetypes
Response: { archetypes: CustomArchetypeDefinition[] }
```

#### 2.2 Get Single Custom Archetype
```
GET /api/projects/:projectId/custom-archetypes/:name
Response: { archetype: CustomArchetypeDefinition, resolved: ArchetypeDefinition }
```

#### 2.3 Create Custom Archetype
```
POST /api/projects/:projectId/custom-archetypes
Body: CustomArchetypeDefinition
Response: { success: true, archetype: CustomArchetypeDefinition }
```

#### 2.4 Update Custom Archetype
```
PUT /api/projects/:projectId/custom-archetypes/:name
Body: Partial<CustomArchetypeDefinition>
Response: { success: true, archetype: CustomArchetypeDefinition }
```

#### 2.5 Delete Custom Archetype
```
DELETE /api/projects/:projectId/custom-archetypes/:name
Response: { success: true }
```

#### 2.6 Validate Archetype JSON
```
POST /api/projects/:projectId/custom-archetypes/validate
Body: { json: string }
Response: { valid: boolean, errors?: string[], resolved?: ArchetypeDefinition }
```

---

### Phase 3: Dashboard UI

#### 3.1 Custom Archetype List Component

**File**: `src/dashboard_frontend/src/modules/pages/ArchetypesPage.tsx` (NEW)

- List all archetypes (built-in + custom)
- Visual indicator for custom vs built-in
- "Create Custom Archetype" button
- Edit/Delete actions for custom archetypes only

#### 3.2 Archetype Editor Form

**File**: `src/dashboard_frontend/src/modules/components/ArchetypeEditor.tsx` (NEW)

Form fields:
- **Name** (text, required, validated for uniqueness)
- **Display Name** (text, required)
- **Description** (textarea, required)
- **Extends** (dropdown of existing archetypes, optional)
- **Required Steering Docs** (multi-select + custom addition)
- **Optional Steering Docs** (multi-select + custom addition)
- **Guidance** (expandable sections for planning, implementation, etc.)
- **Custom Steering Templates** (advanced - file upload or inline editor)

Preview panel showing resolved archetype structure.

#### 3.3 JSON Editor Mode

**File**: `src/dashboard_frontend/src/modules/components/ArchetypeJsonEditor.tsx` (NEW)

- Monaco editor or CodeMirror with JSON syntax highlighting
- Real-time validation with error highlighting
- "Preview Resolved" button to see inheritance applied
- Schema hints/autocomplete based on ArchetypeDefinition

#### 3.4 Modify Settings Page

**File**: `src/dashboard_frontend/src/modules/pages/SettingsPage.tsx` (MODIFY)

- ArchetypeSelector now shows custom archetypes
- Link to "Manage Custom Archetypes" page
- Visual distinction between built-in and custom in dropdown

---

### Phase 4: Custom Steering Templates

#### 4.1 Template Storage

Custom steering templates stored in:
```
.spec-workflow/archetypes/{archetype-name}/templates/
  ├── custom-doc.md
  └── another-doc.md
```

#### 4.2 Template Resolution

Modify `get-steering-template` tool to:
1. Check custom archetype template directory first
2. Fall back to built-in templates
3. Support template inheritance (base template + custom additions)

---

### Phase 5: MCP Tool Integration

#### 5.1 New Tool: `manage-archetype`

**File**: `src/tools/manage-archetype.ts` (NEW)

```typescript
{
  name: 'manage-archetype',
  description: 'Create, update, or inspect custom archetypes',
  inputSchema: {
    action: 'create' | 'update' | 'delete' | 'list' | 'inspect',
    name?: string,
    definition?: CustomArchetypeDefinition,
    extends?: string
  }
}
```

Enables AI agents to programmatically create archetypes based on project analysis.

---

## File Changes Summary

### New Files
1. `src/archetypes/custom-archetype-loader.ts` - Custom archetype loading
2. `src/archetypes/archetype-merger.ts` - Inheritance resolution
3. `src/tools/manage-archetype.ts` - MCP tool
4. `src/dashboard_frontend/.../ArchetypesPage.tsx` - List/manage page
5. `src/dashboard_frontend/.../ArchetypeEditor.tsx` - Form-based editor
6. `src/dashboard_frontend/.../ArchetypeJsonEditor.tsx` - JSON editor

### Modified Files
1. `src/archetypes/archetype-registry.ts` - Project path awareness
2. `src/archetypes/types.ts` - Add CustomArchetypeDefinition type
3. `src/dashboard/multi-server.ts` - API endpoints
4. `src/dashboard_frontend/.../SettingsPage.tsx` - Show custom archetypes
5. `src/dashboard_frontend/.../App.tsx` - Add route
6. `src/tools/get-steering-template.ts` - Custom template resolution
7. `src/index.ts` - Register new tool

---

## Implementation Order

1. **Phase 1.1-1.3**: Core types and loader (~150 lines)
2. **Phase 2**: API endpoints (~200 lines)
3. **Phase 3.1-3.2**: Basic UI list and form editor (~400 lines)
4. **Phase 3.3**: JSON editor (~150 lines)
5. **Phase 4**: Custom template resolution (~100 lines)
6. **Phase 5**: MCP tool (~150 lines)
7. **Tests**: Unit tests for each phase (~300 lines)

**Total estimated**: ~1450 lines

---

## Validation & Error Handling

- Validate archetype names are unique (no collision with built-in)
- Validate `extends` references existing archetype
- Validate steering doc names don't have path traversal
- Validate JSON structure before saving
- Clear error messages for invalid configurations

---

## Example Custom Archetype

```json
{
  "name": "data-pipeline",
  "displayName": "Data Pipeline",
  "description": "ETL and data processing projects",
  "extends": "brownfield",
  "steering": {
    "required": [
      {
        "name": "data-flow",
        "templateFile": "data-flow.md",
        "description": "Data flow diagrams and transformations"
      },
      {
        "name": "schema",
        "templateFile": "schema.md",
        "description": "Data schemas and validation rules"
      }
    ],
    "optional": [
      "-legacy"
    ]
  },
  "guidance": {
    "planning": "Focus on data flow, validation, and error handling"
  }
}
```

This inherits from brownfield but adds data-flow and schema docs while removing the legacy doc from optional.

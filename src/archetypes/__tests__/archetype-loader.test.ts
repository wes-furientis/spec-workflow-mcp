import { describe, it, expect } from 'vitest';
import { validateArchetype, loadArchetype, listArchetypes } from '../archetype-loader.js';
import type { ArchetypeDefinition } from '../types.js';

/**
 * Create a valid minimal archetype definition for testing
 */
function createValidArchetype(overrides: Partial<ArchetypeDefinition> = {}): ArchetypeDefinition {
  return {
    name: 'test-archetype',
    displayName: 'Test Archetype',
    description: 'A test archetype for unit testing',
    templates: {
      requirements: true,
      design: true,
      tasks: true,
    },
    steering: {
      required: ['product', 'tech'],
      optional: ['structure'],
      custom: [],
    },
    guidance: {
      workflowEmphasis: ['Step 1', 'Step 2'],
      documentationFocus: 'Testing documentation focus',
      keyConsiderations: ['Consider this', 'Consider that'],
    },
    ...overrides,
  };
}

describe('archetype-loader', () => {
  describe('validateArchetype', () => {
    describe('valid archetypes', () => {
      it('should validate a complete valid archetype', () => {
        const archetype = createValidArchetype();
        const result = validateArchetype(archetype);

        expect(result.name).toBe('test-archetype');
        expect(result.displayName).toBe('Test Archetype');
        expect(result.description).toBe('A test archetype for unit testing');
        expect(result.templates.requirements).toBe(true);
        expect(result.templates.design).toBe(true);
        expect(result.templates.tasks).toBe(true);
      });

      it('should validate archetype with custom steering documents', () => {
        const archetype = createValidArchetype({
          steering: {
            required: ['product'],
            optional: [],
            custom: [
              {
                name: 'methodology',
                templateFile: 'methodology.md',
                description: 'Development methodology document',
              },
            ],
          },
        });

        const result = validateArchetype(archetype);

        expect(result.steering.custom).toHaveLength(1);
        expect(result.steering.custom[0].name).toBe('methodology');
        expect(result.steering.custom[0].templateFile).toBe('methodology.md');
        expect(result.steering.custom[0].description).toBe('Development methodology document');
      });

      it('should validate archetype with templates disabled', () => {
        const archetype = createValidArchetype({
          templates: {
            requirements: false,
            design: false,
            tasks: true,
          },
        });

        const result = validateArchetype(archetype);

        expect(result.templates.requirements).toBe(false);
        expect(result.templates.design).toBe(false);
        expect(result.templates.tasks).toBe(true);
      });

      it('should validate archetype with empty optional arrays', () => {
        const archetype = createValidArchetype({
          steering: {
            required: [],
            optional: [],
            custom: [],
          },
          guidance: {
            workflowEmphasis: [],
            documentationFocus: 'Focus',
            keyConsiderations: [],
          },
        });

        const result = validateArchetype(archetype);

        expect(result.steering.required).toEqual([]);
        expect(result.steering.optional).toEqual([]);
        expect(result.guidance.workflowEmphasis).toEqual([]);
      });
    });

    describe('invalid archetypes - top level', () => {
      it('should throw for null input', () => {
        expect(() => validateArchetype(null)).toThrow('Archetype definition must be an object');
      });

      it('should throw for non-object input', () => {
        expect(() => validateArchetype('string')).toThrow('Archetype definition must be an object');
        expect(() => validateArchetype(123)).toThrow('Archetype definition must be an object');
      });

      it('should throw for array input (missing name property)', () => {
        // Arrays are objects in JS but won't have the required name property
        expect(() => validateArchetype([])).toThrow('Archetype name must be a non-empty string');
      });

      it('should throw for missing name', () => {
        const archetype = createValidArchetype();
        delete (archetype as any).name;

        expect(() => validateArchetype(archetype)).toThrow('Archetype name must be a non-empty string');
      });

      it('should throw for empty name', () => {
        const archetype = createValidArchetype({ name: '' });

        expect(() => validateArchetype(archetype)).toThrow('Archetype name must be a non-empty string');
      });

      it('should throw for whitespace-only name', () => {
        const archetype = createValidArchetype({ name: '   ' });

        expect(() => validateArchetype(archetype)).toThrow('Archetype name must be a non-empty string');
      });

      it('should throw for missing displayName', () => {
        const archetype = createValidArchetype();
        delete (archetype as any).displayName;

        expect(() => validateArchetype(archetype)).toThrow('Archetype displayName must be a non-empty string');
      });

      it('should throw for missing description', () => {
        const archetype = createValidArchetype();
        delete (archetype as any).description;

        expect(() => validateArchetype(archetype)).toThrow('Archetype description must be a non-empty string');
      });
    });

    describe('invalid archetypes - templates', () => {
      it('should throw for missing templates object', () => {
        const archetype = createValidArchetype();
        delete (archetype as any).templates;

        expect(() => validateArchetype(archetype)).toThrow('templates must be an object');
      });

      it('should throw for null templates', () => {
        const archetype = createValidArchetype();
        (archetype as any).templates = null;

        expect(() => validateArchetype(archetype)).toThrow('templates must be an object');
      });

      it('should throw for non-boolean requirements', () => {
        const archetype = createValidArchetype();
        (archetype.templates as any).requirements = 'true';

        expect(() => validateArchetype(archetype)).toThrow('templates.requirements must be a boolean');
      });

      it('should throw for non-boolean design', () => {
        const archetype = createValidArchetype();
        (archetype.templates as any).design = 1;

        expect(() => validateArchetype(archetype)).toThrow('templates.design must be a boolean');
      });

      it('should throw for non-boolean tasks', () => {
        const archetype = createValidArchetype();
        (archetype.templates as any).tasks = null;

        expect(() => validateArchetype(archetype)).toThrow('templates.tasks must be a boolean');
      });
    });

    describe('invalid archetypes - steering', () => {
      it('should throw for missing steering object', () => {
        const archetype = createValidArchetype();
        delete (archetype as any).steering;

        expect(() => validateArchetype(archetype)).toThrow('steering must be an object');
      });

      it('should throw for non-array required', () => {
        const archetype = createValidArchetype();
        (archetype.steering as any).required = 'product';

        expect(() => validateArchetype(archetype)).toThrow('steering.required must be an array of strings');
      });

      it('should throw for required array with non-strings', () => {
        const archetype = createValidArchetype();
        (archetype.steering as any).required = ['product', 123];

        expect(() => validateArchetype(archetype)).toThrow('steering.required must be an array of strings');
      });

      it('should throw for non-array optional', () => {
        const archetype = createValidArchetype();
        (archetype.steering as any).optional = null;

        expect(() => validateArchetype(archetype)).toThrow('steering.optional must be an array of strings');
      });

      it('should throw for non-array custom', () => {
        const archetype = createValidArchetype();
        (archetype.steering as any).custom = 'not-an-array';

        expect(() => validateArchetype(archetype)).toThrow('steering.custom must be an array');
      });
    });

    describe('invalid archetypes - custom steering docs', () => {
      it('should throw for non-object custom doc', () => {
        const archetype = createValidArchetype();
        (archetype.steering as any).custom = ['not-an-object'];

        expect(() => validateArchetype(archetype)).toThrow('steering.custom[0] must be an object');
      });

      it('should throw for custom doc with missing name', () => {
        const archetype = createValidArchetype();
        (archetype.steering as any).custom = [
          { templateFile: 'test.md', description: 'Test' },
        ];

        expect(() => validateArchetype(archetype)).toThrow('steering.custom[0].name must be a non-empty string');
      });

      it('should throw for custom doc with empty name', () => {
        const archetype = createValidArchetype();
        (archetype.steering as any).custom = [
          { name: '', templateFile: 'test.md', description: 'Test' },
        ];

        expect(() => validateArchetype(archetype)).toThrow('steering.custom[0].name must be a non-empty string');
      });

      it('should throw for custom doc with missing templateFile', () => {
        const archetype = createValidArchetype();
        (archetype.steering as any).custom = [
          { name: 'test', description: 'Test' },
        ];

        expect(() => validateArchetype(archetype)).toThrow('steering.custom[0].templateFile must be a non-empty string');
      });

      it('should throw for custom doc with missing description', () => {
        const archetype = createValidArchetype();
        (archetype.steering as any).custom = [
          { name: 'test', templateFile: 'test.md' },
        ];

        expect(() => validateArchetype(archetype)).toThrow('steering.custom[0].description must be a non-empty string');
      });

      it('should report correct index for invalid custom doc', () => {
        const archetype = createValidArchetype();
        (archetype.steering as any).custom = [
          { name: 'valid', templateFile: 'valid.md', description: 'Valid' },
          { name: '', templateFile: 'invalid.md', description: 'Invalid' },
        ];

        expect(() => validateArchetype(archetype)).toThrow('steering.custom[1].name must be a non-empty string');
      });
    });

    describe('invalid archetypes - guidance', () => {
      it('should throw for missing guidance object', () => {
        const archetype = createValidArchetype();
        delete (archetype as any).guidance;

        expect(() => validateArchetype(archetype)).toThrow('guidance must be an object');
      });

      it('should throw for non-array workflowEmphasis', () => {
        const archetype = createValidArchetype();
        (archetype.guidance as any).workflowEmphasis = 'string';

        expect(() => validateArchetype(archetype)).toThrow('guidance.workflowEmphasis must be an array of strings');
      });

      it('should throw for non-string documentationFocus', () => {
        const archetype = createValidArchetype();
        (archetype.guidance as any).documentationFocus = 123;

        expect(() => validateArchetype(archetype)).toThrow('guidance.documentationFocus must be a non-empty string');
      });

      it('should throw for empty documentationFocus', () => {
        const archetype = createValidArchetype();
        archetype.guidance.documentationFocus = '';

        expect(() => validateArchetype(archetype)).toThrow('guidance.documentationFocus must be a non-empty string');
      });

      it('should throw for non-array keyConsiderations', () => {
        const archetype = createValidArchetype();
        (archetype.guidance as any).keyConsiderations = { key: 'value' };

        expect(() => validateArchetype(archetype)).toThrow('guidance.keyConsiderations must be an array of strings');
      });
    });
  });

  describe('loadArchetype', () => {
    it('should load the generic archetype', async () => {
      const archetype = await loadArchetype('generic');

      expect(archetype.name).toBe('generic');
      expect(archetype.displayName).toBe('Generic Project');
      expect(archetype.templates.requirements).toBe(true);
      expect(archetype.templates.design).toBe(true);
      expect(archetype.templates.tasks).toBe(true);
    });

    it('should load the greenfield archetype', async () => {
      const archetype = await loadArchetype('greenfield');

      expect(archetype.name).toBe('greenfield');
      expect(archetype.displayName).toBeDefined();
      expect(archetype.templates).toBeDefined();
      expect(archetype.steering).toBeDefined();
      expect(archetype.guidance).toBeDefined();
    });

    it('should throw for non-existent archetype', async () => {
      await expect(loadArchetype('non-existent-archetype')).rejects.toThrow(
        /Archetype 'non-existent-archetype' not found/
      );
    });

    it('should include file path in error for missing archetype', async () => {
      await expect(loadArchetype('missing')).rejects.toThrow(/Expected file at:/);
    });
  });


  describe('listArchetypes', () => {
    it('should return array of archetype info objects', async () => {
      const archetypes = await listArchetypes();

      expect(Array.isArray(archetypes)).toBe(true);
      expect(archetypes.length).toBeGreaterThan(0);
    });

    it('should include expected built-in archetypes', async () => {
      const archetypes = await listArchetypes();
      const names = archetypes.map((a) => a.name);

      // Should include at least some known archetypes
      expect(names).toContain('generic');
    });

    it('should return sorted archetypes by name', async () => {
      const archetypes = await listArchetypes();
      const names = archetypes.map((a) => a.name);
      const sortedNames = [...names].sort((a, b) => a.localeCompare(b));

      expect(names).toEqual(sortedNames);
    });

    it('should return archetype info with required fields', async () => {
      const archetypes = await listArchetypes();

      for (const archetype of archetypes) {
        expect(archetype).toHaveProperty('name');
        expect(archetype).toHaveProperty('displayName');
        expect(archetype).toHaveProperty('description');
        expect(typeof archetype.name).toBe('string');
        expect(typeof archetype.displayName).toBe('string');
        expect(typeof archetype.description).toBe('string');
      }
    });

    it('should not include full archetype details in info', async () => {
      const archetypes = await listArchetypes();

      for (const archetype of archetypes) {
        // ArchetypeInfo should only have name, displayName, description
        expect(archetype).not.toHaveProperty('templates');
        expect(archetype).not.toHaveProperty('steering');
        expect(archetype).not.toHaveProperty('guidance');
      }
    });
  });
});

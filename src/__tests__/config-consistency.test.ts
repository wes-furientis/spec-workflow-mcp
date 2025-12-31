import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');

/**
 * Configuration Consistency Tests (#8 from backlog)
 *
 * These tests validate MCP server configurations to prevent configuration drift:
 * - Ensure configs point to local build, not NPM packages
 * - Validate expected flags are present
 * - Prevent committing configs that reference @pimzino/spec-workflow-mcp
 */
describe('Configuration Consistency', () => {
  describe('MCP Configuration Files', () => {
    it('should not reference @pimzino/spec-workflow-mcp in any config file', async () => {
      // Find all potential config files
      const patterns = [
        '**/*.mcp.json',
        '**/.claude.json',
        '**/mcp.json'
      ];

      const violations: { file: string; line: string }[] = [];

      for (const pattern of patterns) {
        const files = await glob(pattern, {
          cwd: PROJECT_ROOT,
          ignore: ['node_modules/**', 'dist/**']
        });

        for (const file of files) {
          const content = await fs.readFile(join(PROJECT_ROOT, file), 'utf-8');
          const lines = content.split('\n');

          lines.forEach((line, idx) => {
            if (line.includes('@pimzino/spec-workflow-mcp')) {
              violations.push({
                file,
                line: `Line ${idx + 1}: ${line.trim()}`
              });
            }
          });
        }
      }

      expect(violations).toEqual([]);
    });

    it('should have production configs pointing to local dist/index.js', async () => {
      // These are the "real" configs used when installing the plugin
      const productionConfigs = [
        '.claude-plugin/.mcp.json',
        '.claude-plugin/with-dashboard/.mcp.json'
      ];

      for (const configPath of productionConfigs) {
        const fullPath = join(PROJECT_ROOT, configPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const config = JSON.parse(content);

        // Should use 'node' command
        expect(config.mcpServers['spec-workflow']).toBeDefined();
        expect(config.mcpServers['spec-workflow'].command).toBe('node');

        // Args should include the dist/index.js path
        const args = config.mcpServers['spec-workflow'].args;
        expect(args).toBeDefined();
        expect(args.length).toBeGreaterThan(0);

        // First arg should be the dist/index.js path (local build)
        expect(args[0]).toMatch(/dist\/index\.js$/);

        // Should NOT use npx (which would pull from NPM)
        expect(config.mcpServers['spec-workflow'].command).not.toBe('npx');
      }
    });

    it('should have consistent server names across configs', async () => {
      const configFiles = await glob('**/*.mcp.json', {
        cwd: PROJECT_ROOT,
        ignore: ['node_modules/**', 'dist/**']
      });

      const serverNames = new Set<string>();

      for (const file of configFiles) {
        const content = await fs.readFile(join(PROJECT_ROOT, file), 'utf-8');
        const config = JSON.parse(content);

        if (config.mcpServers) {
          Object.keys(config.mcpServers).forEach(name => serverNames.add(name));
        }
      }

      // All configs should use the same server name: 'spec-workflow'
      expect(serverNames.size).toBe(1);
      expect(serverNames.has('spec-workflow')).toBe(true);
    });

    it('should allow example configs to have placeholder paths', async () => {
      // Example configs in containers/ are for documentation purposes
      const exampleConfig = join(PROJECT_ROOT, 'containers/example.mcp.json');
      const content = await fs.readFile(exampleConfig, 'utf-8');
      const config = JSON.parse(content);

      // Example config can use npx for demonstration
      // Just verify it's valid JSON and has the expected structure
      expect(config.mcpServers).toBeDefined();
      expect(config.mcpServers['spec-workflow']).toBeDefined();
    });
  });

  describe('Plugin Configuration', () => {
    it('should have plugin.json files with consistent metadata', async () => {
      const pluginFiles = [
        '.claude-plugin/plugin.json',
        '.claude-plugin/with-dashboard/plugin.json'
      ];

      for (const pluginPath of pluginFiles) {
        const fullPath = join(PROJECT_ROOT, pluginPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const plugin = JSON.parse(content);

        // Should have required fields
        expect(plugin.name).toBeDefined();
        expect(plugin.name).toMatch(/^spec-workflow-mcp/);
        expect(plugin.version).toBeDefined();
        expect(plugin.description).toBeDefined();
      }
    });

    it('should have matching versions between package.json and plugin.json', async () => {
      const packageJson = JSON.parse(
        await fs.readFile(join(PROJECT_ROOT, 'package.json'), 'utf-8')
      );

      const pluginFiles = [
        '.claude-plugin/plugin.json',
        '.claude-plugin/with-dashboard/plugin.json'
      ];

      for (const pluginPath of pluginFiles) {
        const fullPath = join(PROJECT_ROOT, pluginPath);
        const plugin = JSON.parse(
          await fs.readFile(fullPath, 'utf-8')
        );

        // Versions should match
        expect(plugin.version).toBe(packageJson.version);
      }
    });
  });

  describe('Documentation References', () => {
    it('should not have stale npx @pimzino references in documentation suggesting current usage', async () => {
      // These files are checked for active usage instructions that might be stale
      const docFiles = [
        'README.md',
        'LOCAL-DEV.md',
        'docs/DEVELOPMENT.md'
      ];

      // Pattern that suggests "run this command" with @pimzino
      const activeUsagePattern = /npx\s+@pimzino\/spec-workflow-mcp(?:\s|$)/;

      for (const docFile of docFiles) {
        const fullPath = join(PROJECT_ROOT, docFile);
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const matches = content.match(activeUsagePattern);

          // Should not have active usage instructions with @pimzino
          // (historical references in CHANGELOG are ok)
          if (matches) {
            // If there are matches, verify they're not in "how to use" sections
            const lines = content.split('\n');
            const activeUsageLines = lines.filter((line, idx) => {
              if (activeUsagePattern.test(line)) {
                // Check if previous lines suggest this is active usage instruction
                const prevLines = lines.slice(Math.max(0, idx - 3), idx).join(' ');
                return prevLines.toLowerCase().includes('run') ||
                       prevLines.toLowerCase().includes('install') ||
                       prevLines.toLowerCase().includes('usage');
              }
              return false;
            });

            expect(activeUsageLines).toHaveLength(0);
          }
        } catch {
          // File doesn't exist, skip
        }
      }
    });
  });

  describe('Path Consistency', () => {
    it('should use absolute paths in production configs', async () => {
      const productionConfigs = [
        '.claude-plugin/.mcp.json',
        '.claude-plugin/with-dashboard/.mcp.json'
      ];

      for (const configPath of productionConfigs) {
        const content = await fs.readFile(join(PROJECT_ROOT, configPath), 'utf-8');
        const config = JSON.parse(content);
        const args = config.mcpServers['spec-workflow'].args;

        // First argument (the script path) should be absolute
        expect(args[0]).toMatch(/^\//);
      }
    });
  });
});

/**
 * Validate Phase Tool
 * MCP tool for validating spec-workflow phase documents
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { validatePhase, formatValidationResult, PhaseValidationResult } from '../validators/index.js';

export const validatePhaseTool: Tool = {
  name: 'validate-phase',
  description: `Validate a spec-workflow phase document for quality and completeness.

**Phases:**
- **steering**: Validates all steering documents (archetype-aware: product, tech, structure, custom docs)
- **requirements**: Validates requirements.md (user stories, acceptance criteria, NFRs)
- **design**: Validates design.md (code reuse, file references, architecture)
- **tasks**: Validates tasks.md (_Prompt quality, _Leverage files, requirements mapping)

**Returns:**
- Pass/fail status for each validation check
- Errors (block approval) and warnings (allow with notice)
- Suggestions for fixing issues

Use this tool before requesting approval to ensure document quality.
Use with Ralph loops to iterate until validation passes.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      phase: {
        type: 'string',
        enum: ['steering', 'requirements', 'design', 'tasks'],
        description: 'Phase to validate',
      },
      specName: {
        type: 'string',
        description: 'Spec name (required for requirements, design, tasks)',
      },
      fixMode: {
        type: 'boolean',
        description: 'Attempt automatic fixes where possible (not yet implemented)',
      },
    },
    required: ['phase'],
  },
};

export async function validatePhaseHandler(
  args: {
    phase: 'steering' | 'requirements' | 'design' | 'tasks';
    specName?: string;
    fixMode?: boolean;
  },
  context: ToolContext
): Promise<ToolResponse> {
  const { phase, specName, fixMode } = args;

  // Validate specName is provided for spec phases
  if (['requirements', 'design', 'tasks'].includes(phase) && !specName) {
    return {
      success: false,
      message: `specName is required for ${phase} validation`,
      nextSteps: [
        `Provide specName parameter: validate-phase phase:"${phase}" specName:"your-spec-name"`,
      ],
    };
  }

  try {
    const result = await validatePhase(phase, {
      projectPath: context.projectPath,
      specName,
      fixMode,
    });

    const formattedOutput = formatValidationResult(result);

    // Determine next steps based on result
    const nextSteps: string[] = [];

    if (result.valid) {
      if (phase === 'steering') {
        nextSteps.push('Steering validation passed! You can now request approval for steering documents.');
      } else {
        nextSteps.push(`${phase} validation passed! You can now request approval.`);
        nextSteps.push(`Use: approvals action:"request" category:"spec" specName:"${specName}" phase:"${phase}"`);
      }
    } else {
      const errors = result.checks.filter(c => !c.passed && c.severity === 'error');
      const warnings = result.checks.filter(c => !c.passed && c.severity === 'warning');

      if (errors.length > 0) {
        nextSteps.push(`Fix ${errors.length} error(s) to proceed with approval.`);
        nextSteps.push('Errors block approval - they must be resolved first.');
      }

      if (warnings.length > 0) {
        nextSteps.push(`Consider addressing ${warnings.length} warning(s) for better quality.`);
      }

      nextSteps.push('Run validate-phase again after making fixes.');

      // If in a Ralph loop context
      nextSteps.push('If using Ralph loop: fix issues and exit to continue iteration.');
    }

    return {
      success: true,
      message: result.valid
        ? `✅ ${phase} validation PASSED`
        : `❌ ${phase} validation FAILED (${result.summary.errors} errors, ${result.summary.warnings} warnings)`,
      data: {
        valid: result.valid,
        phase: result.phase,
        specName: result.specName,
        archetype: result.archetype,
        summary: result.summary,
        checks: result.checks,
        formattedOutput: formattedOutput.join('\n'),
      },
      nextSteps,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Validation failed: ${error.message}`,
      nextSteps: [
        'Check that the project has a valid .spec-workflow directory',
        'Ensure the specified phase documents exist',
      ],
    };
  }
}

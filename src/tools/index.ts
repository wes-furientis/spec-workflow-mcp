import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { specWorkflowGuideTool, specWorkflowGuideHandler } from './spec-workflow-guide.js';
import { specStatusTool, specStatusHandler } from './spec-status.js';
import { steeringGuideTool, steeringGuideHandler } from './steering-guide.js';
import { getSteeringTemplateTool, getSteeringTemplateHandler } from './get-steering-template.js';
import { steeringPlanningRespondTool, steeringPlanningRespondHandler } from './steering-planning-respond.js';
import { approvalsTool, approvalsHandler } from './approvals.js';
import { logImplementationTool, logImplementationHandler } from './log-implementation.js';
import {
  getPlanningContextTool, getPlanningContextHandler,
  suggestPlanModeTool, suggestPlanModeHandler,
  exportPlanTool, exportPlanHandler,
  importPlanTool, importPlanHandler
} from './planning-tools.js';
import { resumeWorkflowTool, resumeWorkflowHandler } from './resume-workflow.js';
import { archetypeTransitionTool, archetypeTransitionHandler } from './archetype-transition.js';
import { manageArchetypeTool, manageArchetypeHandler } from './manage-archetype.js';
import { validatePhaseTool, validatePhaseHandler } from './validate-phase.js';
import { buildSpecTool, buildSpecHandler } from './build-spec.js';
import { implementTaskAutoTool, implementTaskAutoHandler } from './implement-task-auto.js';
import { verifyImplementationTool, verifyImplementationHandler } from './verify-implementation.js';
import { ToolContext, ToolResponse, MCPToolResponse, toMCPResponse } from '../types.js';

export function registerTools(): Tool[] {
  return [
    specWorkflowGuideTool,
    steeringGuideTool,
    getSteeringTemplateTool,
    steeringPlanningRespondTool,
    specStatusTool,
    approvalsTool,
    logImplementationTool,
    // Planning integration tools
    getPlanningContextTool,
    suggestPlanModeTool,
    exportPlanTool,
    importPlanTool,
    // Workflow state tools
    resumeWorkflowTool,
    // Archetype lifecycle tools
    archetypeTransitionTool,
    manageArchetypeTool,
    // Validation tools
    validatePhaseTool,
    // Build tools (Ralph integration)
    buildSpecTool,
    implementTaskAutoTool,
    verifyImplementationTool
  ];
}

export async function handleToolCall(name: string, args: any, context: ToolContext): Promise<MCPToolResponse> {
  let response: ToolResponse;
  let isError = false;

  try {
    switch (name) {
      case 'spec-workflow-guide':
        response = await specWorkflowGuideHandler(args, context);
        break;
      case 'steering-guide':
        response = await steeringGuideHandler(args, context);
        break;
      case 'get-steering-template':
        response = await getSteeringTemplateHandler(args, context);
        break;
      case 'steering-planning-respond':
        response = await steeringPlanningRespondHandler(args, context);
        break;
      case 'spec-status':
        response = await specStatusHandler(args, context);
        break;
      case 'approvals':
        response = await approvalsHandler(args, context);
        break;
      case 'log-implementation':
        response = await logImplementationHandler(args, context);
        break;
      // Planning integration tools
      case 'get-planning-context':
        response = await getPlanningContextHandler(args, context);
        break;
      case 'suggest-plan-mode':
        response = await suggestPlanModeHandler(args, context);
        break;
      case 'export-plan':
        response = await exportPlanHandler(args, context);
        break;
      case 'import-plan':
        response = await importPlanHandler(args, context);
        break;
      case 'resume-workflow':
        response = await resumeWorkflowHandler(args, context);
        break;
      case 'archetype-transition':
        response = await archetypeTransitionHandler(args, context);
        break;
      case 'manage-archetype':
        response = await manageArchetypeHandler(args, context);
        break;
      // Validation tools
      case 'validate-phase':
        response = await validatePhaseHandler(args, context);
        break;
      // Build tools (Ralph integration)
      case 'build-spec':
        response = await buildSpecHandler(args, context);
        break;
      case 'implement-task-auto':
        response = await implementTaskAutoHandler(args, context);
        break;
      case 'verify-implementation':
        response = await verifyImplementationHandler(args, context);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    // Check if the response indicates an error
    isError = !response.success;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    response = {
      success: false,
      message: `Tool execution failed: ${errorMessage}`
    };
    isError = true;
  }

  return toMCPResponse(response, isError);
}
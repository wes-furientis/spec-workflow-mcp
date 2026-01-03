/**
 * Steering Content Extractor
 * Extracts key content items from steering documents for traceability validation
 *
 * Parses steering docs to find:
 * - Section headers (## Header)
 * - Bullet points (- item, * item)
 * - Numbered items (1. item)
 * - Key statements (sentences with important keywords)
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface SteeringContentItem {
  /** Source document name (e.g., "goals", "approach") */
  source: string;
  /** Type of content item */
  type: 'header' | 'bullet' | 'numbered' | 'key-statement';
  /** The extracted content */
  content: string;
  /** Normalized content for matching (lowercase, trimmed) */
  normalized: string;
  /** Key terms extracted for fuzzy matching */
  keyTerms: string[];
  /** Line number in source document */
  line: number;
}

export interface SteeringExtraction {
  /** Document name */
  document: string;
  /** All extracted content items */
  items: SteeringContentItem[];
  /** Total lines in document */
  totalLines: number;
}

/**
 * Extract key terms from a content string
 * Filters out common stop words and short words
 */
function extractKeyTerms(content: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
    'this', 'that', 'these', 'those', 'it', 'its', 'we', 'our', 'us',
    'they', 'their', 'them', 'he', 'she', 'his', 'her', 'who', 'which',
    'what', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only',
    'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here',
  ]);

  const words = content
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));

  // Return unique terms
  return [...new Set(words)];
}

/**
 * Check if a line is a header
 */
function isHeader(line: string): boolean {
  return /^#{1,6}\s+.+/.test(line.trim());
}

/**
 * Check if a line is a bullet point
 */
function isBullet(line: string): boolean {
  return /^\s*[-*+]\s+.+/.test(line);
}

/**
 * Check if a line is a numbered item
 */
function isNumbered(line: string): boolean {
  return /^\s*\d+[.)]\s+.+/.test(line);
}

/**
 * Check if a line contains a key statement (important content)
 */
function isKeyStatement(line: string): boolean {
  const trimmed = line.trim();

  // Skip empty lines, very short lines, or metadata
  if (trimmed.length < 20) return false;
  if (trimmed.startsWith('---')) return false;
  if (trimmed.startsWith('```')) return false;
  if (trimmed.startsWith('|')) return false; // Table rows

  // Look for sentences with actionable/important keywords
  const importantPatterns = [
    /\b(goal|objective|target|aim)\b/i,
    /\b(must|shall|will|need|require)\b/i,
    /\b(strategy|approach|method|plan)\b/i,
    /\b(milestone|deadline|timeline|phase)\b/i,
    /\b(risk|threat|concern|issue)\b/i,
    /\b(resource|budget|team|tool)\b/i,
    /\b(success|metric|measure|kpi)\b/i,
    /\b(priority|critical|important|key)\b/i,
    /\b(deliver|achieve|complete|implement)\b/i,
    /\d+%/, // Percentages
    /\$[\d,]+/, // Dollar amounts
    /\d{4}/, // Years/dates
  ];

  return importantPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Extract content from a line based on its type
 */
function extractContent(line: string): string {
  let content = line.trim();

  // Remove markdown header symbols
  content = content.replace(/^#{1,6}\s+/, '');

  // Remove bullet/number prefixes
  content = content.replace(/^\s*[-*+]\s+/, '');
  content = content.replace(/^\s*\d+[.)]\s+/, '');

  // Remove bold/italic markers
  content = content.replace(/\*\*([^*]+)\*\*/g, '$1');
  content = content.replace(/\*([^*]+)\*/g, '$1');
  content = content.replace(/_([^_]+)_/g, '$1');

  // Remove inline code
  content = content.replace(/`([^`]+)`/g, '$1');

  return content.trim();
}

/**
 * Extract all key content from a steering document
 */
export function extractSteeringContent(
  projectPath: string,
  docName: string
): SteeringExtraction | null {
  const docPath = join(projectPath, '.spec-workflow', 'steering', `${docName}.md`);

  if (!existsSync(docPath)) {
    return null;
  }

  const content = readFileSync(docPath, 'utf-8');
  const lines = content.split('\n');
  const items: SteeringContentItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    let type: SteeringContentItem['type'] | null = null;

    if (isHeader(line)) {
      type = 'header';
    } else if (isBullet(line)) {
      type = 'bullet';
    } else if (isNumbered(line)) {
      type = 'numbered';
    } else if (isKeyStatement(line)) {
      type = 'key-statement';
    }

    if (type) {
      const extractedContent = extractContent(line);
      if (extractedContent.length > 5) { // Skip very short items
        items.push({
          source: docName,
          type,
          content: extractedContent,
          normalized: extractedContent.toLowerCase(),
          keyTerms: extractKeyTerms(extractedContent),
          line: lineNumber,
        });
      }
    }
  }

  return {
    document: docName,
    items,
    totalLines: lines.length,
  };
}

/**
 * Extract content from all steering documents for a project
 */
export function extractAllSteeringContent(
  projectPath: string,
  steeringDocs: string[]
): SteeringExtraction[] {
  const extractions: SteeringExtraction[] = [];

  for (const docName of steeringDocs) {
    const extraction = extractSteeringContent(projectPath, docName);
    if (extraction && extraction.items.length > 0) {
      extractions.push(extraction);
    }
  }

  return extractions;
}

/**
 * Check if a target document covers a steering content item
 * Uses fuzzy matching based on key terms
 */
export function checkItemCoverage(
  item: SteeringContentItem,
  targetContent: string,
  minTermMatch: number = 2
): { covered: boolean; matchedTerms: string[]; matchPercent: number } {
  const targetLower = targetContent.toLowerCase();
  const matchedTerms: string[] = [];

  // Check for exact phrase match (normalized)
  if (targetLower.includes(item.normalized)) {
    return {
      covered: true,
      matchedTerms: item.keyTerms,
      matchPercent: 100,
    };
  }

  // Check for key term matches
  for (const term of item.keyTerms) {
    // Check for word boundary match
    const termPattern = new RegExp(`\\b${term}\\b`, 'i');
    if (termPattern.test(targetContent)) {
      matchedTerms.push(term);
    }
  }

  const matchPercent = item.keyTerms.length > 0
    ? Math.round((matchedTerms.length / item.keyTerms.length) * 100)
    : 0;

  // Consider covered if enough key terms match
  const covered = matchedTerms.length >= minTermMatch ||
    (item.keyTerms.length <= 2 && matchedTerms.length >= 1);

  return { covered, matchedTerms, matchPercent };
}

/**
 * Detailed coverage report for steering items
 */
export interface CoverageReport {
  /** Source steering document */
  source: string;
  /** Total items in steering doc */
  totalItems: number;
  /** Number of items covered in target */
  coveredItems: number;
  /** Coverage percentage */
  coveragePercent: number;
  /** Items that are not covered */
  uncoveredItems: SteeringContentItem[];
  /** Items that are covered */
  coveredItemsList: SteeringContentItem[];
}

/**
 * Generate coverage report for steering content against a target document
 */
export function generateCoverageReport(
  extraction: SteeringExtraction,
  targetContent: string,
  minTermMatch: number = 2
): CoverageReport {
  const coveredItemsList: SteeringContentItem[] = [];
  const uncoveredItems: SteeringContentItem[] = [];

  for (const item of extraction.items) {
    const { covered } = checkItemCoverage(item, targetContent, minTermMatch);
    if (covered) {
      coveredItemsList.push(item);
    } else {
      uncoveredItems.push(item);
    }
  }

  return {
    source: extraction.document,
    totalItems: extraction.items.length,
    coveredItems: coveredItemsList.length,
    coveragePercent: extraction.items.length > 0
      ? Math.round((coveredItemsList.length / extraction.items.length) * 100)
      : 100,
    uncoveredItems,
    coveredItemsList,
  };
}

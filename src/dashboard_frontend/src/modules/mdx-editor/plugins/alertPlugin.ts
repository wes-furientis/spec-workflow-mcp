/**
 * GitHub-style Alert Blocks Plugin (#14)
 *
 * Transforms GitHub alert syntax into styled blockquotes:
 * > [!NOTE]
 * > Content here
 *
 * Becomes:
 * > **ℹ️ Note**
 * > Content here
 *
 * With CSS styling applied via data attribute.
 */

export type AlertType = 'note' | 'tip' | 'important' | 'warning' | 'caution';

interface AlertConfig {
  icon: string;
  label: string;
  className: string;
}

const ALERT_CONFIGS: Record<AlertType, AlertConfig> = {
  note: { icon: 'ℹ️', label: 'Note', className: 'alert-note' },
  tip: { icon: '💡', label: 'Tip', className: 'alert-tip' },
  important: { icon: '❗', label: 'Important', className: 'alert-important' },
  warning: { icon: '⚠️', label: 'Warning', className: 'alert-warning' },
  caution: { icon: '🔴', label: 'Caution', className: 'alert-caution' },
};

/**
 * Pattern to match GitHub alert syntax: > [!TYPE]
 */
const ALERT_PATTERN = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/im;
const ALERT_LINE_PATTERN = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i;

/**
 * Transform GitHub alert syntax into styled markdown
 * This runs before the markdown is passed to MDXEditor
 */
export function transformAlerts(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(ALERT_LINE_PATTERN);

    if (match) {
      const alertType = match[1].toLowerCase() as AlertType;
      const config = ALERT_CONFIGS[alertType];

      // Replace the [!TYPE] line with styled header
      result.push(`> **${config.icon} ${config.label}**`);
      result.push(`> <!-- alert-${alertType} -->`);
      i++;

      // Continue with subsequent blockquote lines
      while (i < lines.length && lines[i].startsWith('>')) {
        // Skip if we hit another alert
        if (ALERT_LINE_PATTERN.test(lines[i])) break;
        result.push(lines[i]);
        i++;
      }
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join('\n');
}

/**
 * Check if markdown contains any GitHub-style alerts
 */
export function hasAlerts(markdown: string): boolean {
  return ALERT_PATTERN.test(markdown);
}

/**
 * Get all alert types used in the markdown
 */
export function getAlertTypes(markdown: string): AlertType[] {
  const types: AlertType[] = [];
  const regex = /\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gi;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    const type = match[1].toLowerCase() as AlertType;
    if (!types.includes(type)) {
      types.push(type);
    }
  }

  return types;
}

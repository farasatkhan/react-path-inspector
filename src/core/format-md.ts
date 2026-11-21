
import { type MarkdownInput } from '../definitions';

export function formatMarkdown(input: MarkdownInput): string {
  const header: string[] = [];
  if (input.headerEnabled && input.from) {
    header.push(`React component path (root → selected), from ${input.from}`);
  }
  if (input.reactVersion) header.push(`React ${input.reactVersion}`);
  if (input.note) {
    const [first, ...rest] = input.note.split('\n');
    header.push(
      `Question: ${first}${rest.map((line) => (line ? `\n  ${line}` : '\n')).join('')}`,
    );
  }
  if (input.route) header.push(`Route: ${input.route}`);
  header.push(`Path: ${input.pathSummary}`);

  const parts: string[] = [header.join('\n'), ...input.blocks];

  if (input.clickedElementMarkdown) parts.push(input.clickedElementMarkdown);
  if (input.providersLine) parts.push(input.providersLine);
  if (input.trimmedCount > 0) {
    parts.push(
      `[trimmed: ${input.trimmedCount} ancestors reduced to prop names to fit ${input.budgetChars} chars]`,
    );
  }
  for (const warning of input.warnings) parts.push(warning);

  return parts.join('\n\n');
}


export const FORMAT_NAMES = { markdown: 'Markdown', json: 'JSON' } as const;

import { type OutputNode } from '../definitions';

export function nodeToMarkdownBlock(node: OutputNode, selected: boolean): string {
  const lines: string[] = [selected ? `${node.name}  ← selected` : node.name];
  if (node.propsNote) lines.push(`  props: ${node.propsNote}`);
  else if (node.propsText !== null) lines.push(`  props: ${node.propsText}`);
  if (node.stateText) lines.push(node.stateText);
  return lines.join('\n');
}

export function nodeToKeysBlock(node: OutputNode): string | null {
  if (node.propsNote || node.propsKeys.length === 0) return null;
  const lines: string[] = [node.name];
  lines.push(`  props: { ${node.propsKeys.join(', ')} }`);
  if (node.stateText) lines.push(node.stateText);
  return lines.join('\n');
}


import { type InternalOutput, type JsonOutput } from '../definitions';

export function buildJsonOutput(output: InternalOutput): JsonOutput {
  return {
    route: output.route,
    from: output.from,
    reactVersion: output.reactVersion,
    note: output.note,
    path: output.nodes.map((node) => (node.boundary === 'server' ? `${node.name} (server)` : node.name)),
    nodes: output.nodes.map((node) => ({
      name: node.name,
      boundary: node.boundary,
      selected: node.selected,
      props: node.propsNote ? null : node.propsJson,
      propsNote: node.propsNote,
      propsKeys: node.propsKeys,
      state: node.stateJson,
      context: null,
    })),
    element: output.clickedElementJson,
    warnings: output.warnings,
    trimmed:
      output.trimmedCount > 0 ? { ancestorsReducedToKeys: output.trimmedCount } : null,
  };
}

export function formatJson(output: InternalOutput): string {
  return JSON.stringify(buildJsonOutput(output), null, 2);
}

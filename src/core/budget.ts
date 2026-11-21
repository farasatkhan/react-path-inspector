
import { type BudgetBlock, type BudgetResult } from '../definitions';

export function applyBudget(blocks: BudgetBlock[], budget: number): BudgetResult {
  const out = blocks.map((block) => ({ ...block }));
  const totalLen = () =>
    out.reduce((sum, block) => sum + block.text.length + 2, 0) - 2;

  const reducedIndices: number[] = [];
  let guard = 0;
  while (totalLen() > budget && guard < 500) {
    guard += 1;
    let reduced = false;
    for (let i = 0; i < out.length - 1; i++) {
      if (out[i].keysText !== null && out[i].text !== out[i].keysText) {
        out[i].text = out[i].keysText;
        reducedIndices.push(i);
        reduced = true;
        break;
      }
    }
    if (!reduced) break;
  }

  const note =
    reducedIndices.length > 0
      ? `[trimmed: ${reducedIndices.length} ancestors reduced to prop names to fit ${budget} chars]`
      : null;

  return {
    blocks: out.map((block) => block.text),
    reducedIndices,
    trimmedCount: reducedIndices.length,
    note,
    overBudget: totalLen() > budget,
  };
}

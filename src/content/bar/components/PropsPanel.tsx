import React from 'react';
import { type PathBarChip } from '../../../definitions';

export function PropsPanel({
  chips,
  selected,
  propsPreview,
  propsLoading,
}: {
  chips: PathBarChip[];
  selected: number;
  propsPreview: { index: number; text: string } | null;
  propsLoading: boolean;
}) {
  const body = propsLoading
    ? 'Loading props…'
    : propsPreview && propsPreview.index === selected
      ? propsPreview.text.split('\n').slice(1).join('\n').trim() || '[no props]'
      : '[no props]';
  return (
    <div className="rpc-props-panel">
      <div className="rpc-props-header">{chips[selected]?.name ?? 'Component'} · props</div>
      <pre className="rpc-props-text">{body}</pre>
    </div>
  );
}

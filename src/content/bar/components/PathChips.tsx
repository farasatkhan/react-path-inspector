import React from 'react';
import { type PathBarChip } from '../../../definitions';

export function PathChips({
  chips,
  selected,
  noDomFlags,
  onSelect,
}: {
  chips: PathBarChip[];
  selected: number;
  noDomFlags: Record<number, boolean>;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="rpc-bar-chips">
      {chips.map((chip, position) => (
        <React.Fragment key={chip.index}>
          {position > 0 ? <span className="rpc-sep" aria-hidden="true">›</span> : null}
          <button
            className={'rpc-chip' + (chip.index === selected ? ' rpc-chip-selected' : '')}
            onClick={() => onSelect(chip.index)}
            title={chip.server ? 'Server component' : 'Client component'}
          >
            {chip.name}
            {chip.server ? <span className="rpc-chip-server-mod"> (server)</span> : null}
            {noDomFlags[chip.index] ? (
              <span className="rpc-chip-nodom" title="No DOM output; the path is still selectable">
                <span className="rpc-chip-nodom-dot" />
                no DOM
              </span>
            ) : null}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

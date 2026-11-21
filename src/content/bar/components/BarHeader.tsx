import React from 'react';
import { CloseIcon, ReactLogo } from './icons';

export function BarHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="rpc-bar-header">
      <span className="rpc-bar-title">
        <ReactLogo />
        React Path
      </span>
      <button className="rpc-bar-close" onClick={onClose} title="Close (Esc)" aria-label="Close (Esc)">
        <CloseIcon />
      </button>
    </div>
  );
}

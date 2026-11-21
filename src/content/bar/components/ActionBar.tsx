import React from 'react';
import { CheckIcon, CopyIcon, ReturnIcon } from './icons';

export function ActionBar({
  copied,
  onCopyClick,
  copiedProps,
  onCopyPropsClick,
  propsOpen,
  onToggleProps,
  noteEnabled,
}: {
  copied: boolean;
  onCopyClick: () => void;
  copiedProps: boolean;
  onCopyPropsClick: () => void;
  propsOpen: boolean;
  onToggleProps: () => void;
  noteEnabled: boolean;
}) {
  return (
    <div className="rpc-bar-actions">
      <button className={'rpc-bar-copy' + (copied ? ' rpc-bar-copied' : '')} onClick={onCopyClick}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <button
        className={'rpc-bar-copy' + (copiedProps ? ' rpc-bar-copied' : '')}
        onClick={onCopyPropsClick}
        title="Copy only the selected component's props"
      >
        {copiedProps ? <CheckIcon /> : <CopyIcon />}
        {copiedProps ? 'Copied' : 'Copy props'}
      </button>
      <button
        className={'rpc-props-toggle' + (propsOpen ? ' rpc-props-toggle-active' : '')}
        onClick={onToggleProps}
        title="Show or hide the selected component's props"
      >
        Props
      </button>
      <span className="rpc-bar-hints">
        <span className="rpc-hint"><span className="rpc-kbd">↑</span> parent</span>
        <span className="rpc-hint"><span className="rpc-kbd">↓</span> back</span>
        <span className="rpc-hint"><span className="rpc-kbd"><ReturnIcon /></span> copy</span>
        {noteEnabled ? (
          <span className="rpc-hint"><span className="rpc-kbd">tab</span> note</span>
        ) : null}
        <span className="rpc-hint"><span className="rpc-kbd">esc</span> close</span>
      </span>
    </div>
  );
}

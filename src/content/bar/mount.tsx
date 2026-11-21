import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Bar from './Bar';
import { type BarMount, type BarState } from '../../definitions';
import { BAR_CSS } from './css';

export function mountBar(): BarMount {
  const host = document.createElement('div');
  host.id = 'react-path-copier-bar-host';
  host.style.cssText = 'position:fixed; left:20px; bottom:20px; z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = BAR_CSS;
  shadow.appendChild(style);
  const container = document.createElement('div');
  shadow.appendChild(container);
  document.documentElement.appendChild(host);

  const noteInputRef = React.createRef<HTMLTextAreaElement>();
  let latestNote = '';
  let state: BarState = {
    visible: false,
    chips: [],
    selected: 0,
    noDomFlags: {},
    noteEnabled: false,
    theme: 'light',
    propsOpen: false,
    propsPreview: null,
    propsLoading: false,
    noteInputRef,
    onNoteChange: (note) => {
      latestNote = note;
    },
    onSelect: () => {},
    onCopy: () => {},
    onCopyProps: () => {},
    onToggleProps: () => {},
    onClose: () => {},
  };
  const listeners = new Set<() => void>();

  function Subscribed() {
    const [, force] = useState(0);
    useEffect(() => {
      const listener = () => force((n) => n + 1);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }, []);
    return state.visible ? <Bar {...state} /> : null;
  }

  createRoot(container).render(<Subscribed />);

  return {
    controller: {
      update(partial) {
        state = { ...state, ...partial };
        listeners.forEach((listener) => listener());
      },
      focusNote() {
        noteInputRef.current?.focus();
      },
      getNote() {
        return latestNote;
      },
      destroy() {
        host.remove();
      },
    },
    host,
  };
}

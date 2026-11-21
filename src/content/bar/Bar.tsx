import React, { useEffect, useRef, useState } from 'react';
import { type BarProps } from '../../definitions';
import { ActionBar } from './components/ActionBar';
import { BarHeader } from './components/BarHeader';
import { NoteField } from './components/NoteField';
import { PathChips } from './components/PathChips';
import { PropsPanel } from './components/PropsPanel';

const COPIED_RESET_MS = 1800;

export default function Bar(props: BarProps) {
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedProps, setCopiedProps] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  const copiedPropsTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);
  useEffect(() => () => window.clearTimeout(copiedPropsTimer.current), []);

  const handleCopy = () => {
    props.onCopy(note);
    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
  };

  const handleCopyProps = () => {
    props.onCopyProps();
    setCopiedProps(true);
    window.clearTimeout(copiedPropsTimer.current);
    copiedPropsTimer.current = window.setTimeout(() => setCopiedProps(false), COPIED_RESET_MS);
  };

  return (
    <div className={`rpc-bar rpc-theme-${props.theme}`}>
      <BarHeader onClose={props.onClose} />
      <PathChips
        chips={props.chips}
        selected={props.selected}
        noDomFlags={props.noDomFlags}
        onSelect={props.onSelect}
      />
      {props.noteEnabled ? (
        <NoteField
          noteInputRef={props.noteInputRef}
          note={note}
          onNoteChange={(value) => {
            setNote(value);
            props.onNoteChange(value);
          }}
        />
      ) : null}
      <ActionBar
        copied={copied}
        onCopyClick={handleCopy}
        copiedProps={copiedProps}
        onCopyPropsClick={handleCopyProps}
        propsOpen={props.propsOpen}
        onToggleProps={props.onToggleProps}
        noteEnabled={props.noteEnabled}
      />
      {props.propsOpen ? (
        <PropsPanel
          chips={props.chips}
          selected={props.selected}
          propsPreview={props.propsPreview}
          propsLoading={props.propsLoading}
        />
      ) : null}
    </div>
  );
}

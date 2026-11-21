import React from 'react';
import { type RefObject } from 'react';

const NOTE_MAX_HEIGHT_PX = 120;

function autoGrowNote(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, NOTE_MAX_HEIGHT_PX)}px`;
}

export function NoteField({
  noteInputRef,
  note,
  onNoteChange,
}: {
  noteInputRef: RefObject<HTMLTextAreaElement | null>;
  note: string;
  onNoteChange: (note: string) => void;
}) {
  return (
    <textarea
      ref={noteInputRef}
      className="rpc-bar-note"
      rows={1}
      placeholder="Question for the AI (optional; Shift+Enter for a new line)"
      value={note}
      onChange={(event) => {
        onNoteChange(event.target.value);
        autoGrowNote(event.target);
      }}
    />
  );
}

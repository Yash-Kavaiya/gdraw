import React from 'react';
import type { Tool } from '../lib/types';
import { IconButton } from './ui';

export const TOOLS: { id: Tool; icon: string; label: string; key: string }[] = [
  { id: 'hand', icon: 'pan_tool', label: 'Hand', key: 'H' },
  { id: 'select', icon: 'arrow_selector_tool', label: 'Select', key: 'V' },
  { id: 'rect', icon: 'rectangle', label: 'Rectangle', key: 'R' },
  { id: 'ellipse', icon: 'circle', label: 'Ellipse', key: 'O' },
  { id: 'diamond', icon: 'diamond', label: 'Decision', key: 'D' },
  { id: 'arrow', icon: 'north_east', label: 'Connector', key: 'A' },
  { id: 'line', icon: 'pen_size_2', label: 'Line', key: 'L' },
  { id: 'pen', icon: 'stylus', label: 'Pen', key: 'P' },
  { id: 'text', icon: 'title', label: 'Text', key: 'T' },
  { id: 'note', icon: 'sticky_note_2', label: 'Sticky note', key: 'N' },
  { id: 'zone', icon: 'select', label: 'Boundary', key: 'B' },
  { id: 'eraser', icon: 'ink_eraser', label: 'Eraser', key: 'E' },
];

export default function Toolbar({ tool, setTool, locked, setLocked, onAI }: {
  tool: Tool; setTool: (t: Tool) => void; locked: boolean; setLocked: (b: boolean) => void; onAI: () => void;
}) {
  return (
    <div className="toolbar" role="toolbar">
      <IconButton icon={locked ? 'lock' : 'lock_open'} label="Keep tool active" active={locked} onClick={() => setLocked(!locked)} size={18} className="lock-btn" />
      <span className="tb-div" />
      {TOOLS.map((t) => (
        <IconButton key={t.id} icon={t.icon} label={t.label} shortcut={t.key} active={tool === t.id} onClick={() => setTool(t.id)} />
      ))}
      <span className="tb-div" />
      <button className="ai-chip" onClick={onAI} data-tip="Generate with AI · Ctrl K">
        <span className="msym fill">auto_awesome</span>
        <span>AI</span>
      </button>
    </div>
  );
}

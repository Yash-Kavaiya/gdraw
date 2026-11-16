import React, { useEffect } from 'react';

export const Icon = ({ name, size = 20, fill = false, className = '' }: { name: string; size?: number; fill?: boolean; className?: string }) => (
  <span className={`msym ${fill ? 'fill' : ''} ${className}`} style={{ fontSize: size }} aria-hidden>{name}</span>
);

export function IconButton({ icon, label, active, onClick, disabled, size = 20, className = '', shortcut }: {
  icon: string; label: string; active?: boolean; onClick?: () => void; disabled?: boolean; size?: number; className?: string; shortcut?: string;
}) {
  return (
    <button className={`icon-btn ${active ? 'active' : ''} ${className}`} onClick={onClick} disabled={disabled} aria-label={label} data-tip={shortcut ? `${label} · ${shortcut}` : label}>
      <Icon name={icon} size={size} fill={active} />
    </button>
  );
}

export function Dialog({ open, onClose, title, icon, children, wide, actions, className = '' }: {
  open: boolean; onClose: () => void; title: string; icon?: string; children: React.ReactNode; wide?: boolean | 'full'; actions?: React.ReactNode; className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`dialog ${wide === 'full' ? 'full' : wide ? 'wide' : ''} ${className}`} role="dialog" aria-label={title}>
        <header className="dialog-head">
          {icon && <span className="dialog-icon"><Icon name={icon} size={22} /></span>}
          <h2>{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </header>
        <div className="dialog-body">{children}</div>
        {actions && <footer className="dialog-actions">{actions}</footer>}
      </div>
    </div>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange }: {
  value: T | undefined; options: { value: T; label?: string; icon?: string; tip?: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={String(o.value)} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)} data-tip={o.tip} aria-label={o.tip ?? o.label}>
          {o.icon && <Icon name={o.icon} size={18} />}{o.label}
        </button>
      ))}
    </div>
  );
}

/** Very small markdown renderer for AI reviews (bold, code, bullets, headings). */
export function Markdown({ text }: { text: string }) {
  const html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.*)$/gm, '<h4>$1</h4>').replace(/^## (.*)$/gm, '<h3>$1</h3>').replace(/^# (.*)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\s*[-*] (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, '<br/>');
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Spinner() { return <span className="spinner" aria-label="Loading" />; }

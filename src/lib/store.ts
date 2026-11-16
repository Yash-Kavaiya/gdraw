import { useCallback, useRef, useState } from 'react';
import type { Doc, El } from './types';
import { uid } from './geometry';

const DOCS_KEY = 'gdraw.docs';
const CURRENT_KEY = 'gdraw.current';

export function listDocs(): Doc[] {
  try { return JSON.parse(localStorage.getItem(DOCS_KEY) || '[]'); } catch { return []; }
}
export function saveDoc(doc: Doc) {
  try {
    const docs = listDocs().filter((d) => d.id !== doc.id);
    docs.unshift(doc);
    localStorage.setItem(DOCS_KEY, JSON.stringify(docs.slice(0, 50)));
    localStorage.setItem(CURRENT_KEY, doc.id);
  } catch { /* storage full or blocked */ }
}
export function deleteDoc(id: string) {
  try { localStorage.setItem(DOCS_KEY, JSON.stringify(listDocs().filter((d) => d.id !== id))); } catch { /* ignore */ }
}
export function loadCurrent(): Doc | null {
  try {
    const id = localStorage.getItem(CURRENT_KEY);
    return listDocs().find((d) => d.id === id) ?? null;
  } catch { return null; }
}
export const newDoc = (name = 'Untitled architecture'): Doc => ({ id: uid(), name, elements: [], updated: Date.now() });

/** Element state with undo/redo. `commit` pushes history; `setLive` updates without a history entry (during drags). */
export function useHistory(initial: El[]) {
  const [elements, setElements] = useState<El[]>(initial);
  const past = useRef<El[][]>([]);
  const future = useRef<El[][]>([]);
  const base = useRef<El[] | null>(null); // snapshot at start of a live interaction
  const cur = useRef(elements);
  cur.current = elements;

  const commit = useCallback((next: El[] | ((prev: El[]) => El[])) => {
    const prev = base.current ?? cur.current;
    const value = typeof next === 'function' ? (next as any)(cur.current) : next;
    past.current.push(prev);
    if (past.current.length > 200) past.current.shift();
    future.current = [];
    base.current = null;
    setElements(value);
  }, []);

  const setLive = useCallback((next: El[] | ((prev: El[]) => El[])) => {
    if (!base.current) base.current = cur.current;
    setElements((p) => (typeof next === 'function' ? (next as any)(p) : next));
  }, []);

  const endLive = useCallback(() => {
    if (base.current && base.current !== cur.current) {
      past.current.push(base.current);
      future.current = [];
    }
    base.current = null;
  }, []);

  const undo = useCallback(() => {
    const p = past.current.pop();
    if (!p) return;
    future.current.push(cur.current);
    setElements(p);
  }, []);
  const redo = useCallback(() => {
    const f = future.current.pop();
    if (!f) return;
    past.current.push(cur.current);
    setElements(f);
  }, []);
  const reset = useCallback((els: El[]) => { past.current = []; future.current = []; base.current = null; setElements(els); }, []);

  return { elements, commit, setLive, endLive, undo, redo, reset, canUndo: () => past.current.length > 0, canRedo: () => future.current.length > 0 };
}

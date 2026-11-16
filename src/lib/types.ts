export type Tool =
  | 'select' | 'hand' | 'rect' | 'ellipse' | 'diamond' | 'arrow' | 'line'
  | 'pen' | 'text' | 'note' | 'zone' | 'eraser';

export type ElementType =
  | 'rect' | 'ellipse' | 'diamond' | 'text' | 'arrow' | 'line'
  | 'freedraw' | 'service' | 'zone' | 'note' | 'image';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type ArrowHead = 'none' | 'arrow' | 'triangle' | 'dot';
export type Routing = 'straight' | 'elbow' | 'curve';
export type ZoneKind =
  | 'cloud' | 'project' | 'region' | 'zone' | 'vpc' | 'subnet'
  | 'cluster' | 'onprem' | 'external' | 'agent' | 'group';
export type ServiceVariant = 'card' | 'icon';

export interface Binding { id: string }

export interface BaseEl {
  id: string;
  type: ElementType;
  x: number; y: number; w: number; h: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  opacity: number;
  radius?: number;
  text?: string;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  locked?: boolean;
  shadow?: boolean;
  // service
  service?: string;
  subtitle?: string;
  variant?: ServiceVariant;
  // zone
  zoneKind?: ZoneKind;
  // linear (arrow/line): absolute points
  points?: [number, number][];
  start?: Binding | null;
  end?: Binding | null;
  startHead?: ArrowHead;
  endHead?: ArrowHead;
  routing?: Routing;
  animated?: boolean;
  // freedraw
  path?: [number, number][];
  // image
  src?: string;
}

export type El = BaseEl;

export interface Viewport { x: number; y: number; zoom: number }

export interface Doc {
  id: string;
  name: string;
  elements: El[];
  updated: number;
}

/** The structured diagram spec shared by AI generation, templates and Mermaid import. */
export interface DiagramSpec {
  title?: string;
  direction?: 'LR' | 'TB';
  groups?: { id: string; label: string; kind?: ZoneKind; parent?: string | null }[];
  nodes: {
    id: string; label: string; service?: string; subtitle?: string;
    group?: string | null; shape?: 'rect' | 'ellipse' | 'diamond';
  }[];
  edges?: { from: string; to: string; label?: string; style?: StrokeStyle; animated?: boolean; bidirectional?: boolean }[];
}

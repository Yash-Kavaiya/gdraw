import type { DiagramSpec } from './types';
import { SERVICES } from './services';

export type Provider = 'gemini' | 'openai' | 'anthropic' | 'custom';

export interface AISettings {
  provider: Provider;
  keys: Partial<Record<Provider, string>>;
  models: Partial<Record<Provider, string>>;
  baseUrl?: string; // for custom OpenAI-compatible endpoints (OpenRouter, Ollama, LM Studio…)
}

export const PROVIDERS: { id: Provider; name: string; defaultModel: string; models: string[]; keyHint: string; keyUrl?: string }[] = [
  { id: 'gemini', name: 'Google Gemini', defaultModel: 'gemini-2.5-flash', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-3-pro-preview'], keyHint: 'AIza…', keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'openai', name: 'OpenAI', defaultModel: 'gpt-4.1-mini', models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'], keyHint: 'sk-…', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', name: 'Anthropic Claude', defaultModel: 'claude-sonnet-5-5', models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'], keyHint: 'sk-ant-…', keyUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'custom', name: 'OpenAI-compatible', defaultModel: 'llama3.1', models: [], keyHint: 'optional' },
];

const LS = 'gdraw.ai.settings';
export function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) return { provider: 'gemini', keys: {}, models: {}, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { provider: 'gemini', keys: {}, models: {}, baseUrl: 'http://localhost:11434/v1' };
}
export function saveAISettings(s: AISettings) {
  try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* ignore */ }
}
export const modelFor = (s: AISettings) => s.models[s.provider] || PROVIDERS.find((p) => p.id === s.provider)!.defaultModel;
export const hasKey = (s: AISettings) => s.provider === 'custom' ? !!s.baseUrl : !!s.keys[s.provider];

export async function complete(s: AISettings, system: string, user: string, json = false, signal?: AbortSignal): Promise<string> {
  const key = s.keys[s.provider] ?? '';
  const model = modelFor(s);
  if (s.provider === 'gemini') {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.4, ...(json ? { responseMimeType: 'application/json' } : {}) },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? `Gemini error ${res.status}`);
    return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
  }
  if (s.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: {
        'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens: 8000, system, messages: [{ role: 'user', content: user }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? `Anthropic error ${res.status}`);
    return data?.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('') ?? '';
  }
  // OpenAI and OpenAI-compatible
  const base = s.provider === 'openai' ? 'https://api.openai.com/v1' : (s.baseUrl || '').replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({
      model, temperature: 0.4,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      ...(json && s.provider === 'openai' ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `API error ${res.status}`);
  return data?.choices?.[0]?.message?.content ?? '';
}

const SERVICE_LIST = SERVICES.filter((s) => s.category !== 'categories').map((s) => `${s.id} (${s.name})`).join(', ');

export const ARCH_SYSTEM = `You are a principal Google Cloud architect. Convert the user's request into a cloud architecture diagram.
Respond with ONLY a JSON object matching this TypeScript type (no markdown fences, no commentary):
{
  "title": string,
  "direction": "LR" | "TB",
  "groups": { "id": string, "label": string, "kind": "cloud"|"project"|"region"|"zone"|"vpc"|"subnet"|"cluster"|"onprem"|"external"|"agent"|"group", "parent"?: string }[],
  "nodes": { "id": string, "label": string, "service": string, "subtitle"?: string, "group"?: string, "shape"?: "rect"|"ellipse"|"diamond" }[],
  "edges": { "from": string, "to": string, "label"?: string, "style"?: "solid"|"dashed"|"dotted", "animated"?: boolean, "bidirectional"?: boolean }[]
}
Rules:
- "service" MUST be one of these ids: ${SERVICE_LIST}. Use "none" with a "shape" only for non-service steps (decisions, generic boxes).
- Use groups to show boundaries: an outer "cloud" group "Google Cloud", projects, regions, VPCs, GKE clusters. Users/clients/on-prem live outside the cloud group.
- Keep it readable: 5-16 nodes, short labels (1-3 words), subtitles for role/config (e.g. "PostgreSQL HA").
- Edges describe data flow direction; set "animated": true for streaming/event flows; dashed for async/optional paths.
- Prefer managed, idiomatic Google Cloud services and well-architected best practices.
- For agentic AI systems use Google's agent stack: "adk" for each agent (orchestrator and sub-agents), an "agent" group for the runtime
  (e.g. "Vertex AI Agent Engine"), "agent-engine" for managed sessions/Memory Bank, "gemini" for models, "a2a" between remote agents,
  "mcp-toolbox" for database tools over MCP, "model-armor" to screen prompts/responses, "cx-agent-studio" for customer-facing
  chat/voice agents, "gemini-enterprise" for the employee-facing agent hub, and "vector-search"/"agent-builder" for retrieval.
- Third-party AI tools are available too (e.g. "claude-code", "chatgpt", "claude", "grok", "grok-bot", "openclaw", "hermes-agent",
  "cursor", "codex", "gemini-cli", "github-copilot", "langgraph", "crewai", "mcp", "ollama", "hugging-face", "n8n").
  Use them when the user names them; otherwise prefer Google Cloud services.`;

export const MERMAID_SYSTEM = `You write Mermaid flowchart diagrams. Respond with ONLY Mermaid code (no markdown fences).
Use "flowchart LR" or "flowchart TB", subgraphs for boundaries (e.g. subgraph gcp["Google Cloud"]), short node labels and edge labels.
Name Google Cloud services exactly (Cloud Run, BigQuery, Pub/Sub, Cloud SQL, GKE, Vertex AI, Gemini, Cloud Storage, …) so they can be matched to icons.`;

export const REVIEW_SYSTEM = `You are a Google Cloud architecture reviewer applying the Google Cloud Well-Architected Framework
(operational excellence, security, reliability, cost optimization, performance, sustainability).
Given a diagram description, give a concise review in Markdown: a 1-2 sentence summary, then up to 6 bullet findings,
each starting with a pillar tag like **[Security]**, naming the concrete Google Cloud service or change to make. Be specific and brief.`;

export function extractJSON(text: string): any {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch { /* fall through */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error('The model did not return valid JSON.');
}

export function stripFences(text: string) {
  return text.trim().replace(/^```(?:mermaid)?\s*/i, '').replace(/```\s*$/, '').trim();
}

export function validateSpec(raw: any): DiagramSpec {
  if (!raw || !Array.isArray(raw.nodes) || !raw.nodes.length) throw new Error('No nodes in generated diagram.');
  const nodes = raw.nodes.filter((n: any) => n && n.id).map((n: any) => ({ ...n, id: String(n.id), label: String(n.label ?? n.id) }));
  const ids = new Set(nodes.map((n: any) => n.id));
  const groups = (raw.groups ?? []).filter((g: any) => g && g.id).map((g: any) => ({ ...g, id: String(g.id), label: String(g.label ?? g.id) }));
  const gids = new Set(groups.map((g: any) => g.id));
  for (const n of nodes) if (n.group && !gids.has(n.group)) n.group = null;
  for (const g of groups) if (g.parent && (!gids.has(g.parent) || g.parent === g.id)) g.parent = null;
  const edges = (raw.edges ?? []).filter((e: any) => ids.has(String(e.from)) && ids.has(String(e.to))).map((e: any) => ({ ...e, from: String(e.from), to: String(e.to) }));
  return { title: raw.title, direction: raw.direction === 'TB' ? 'TB' : 'LR', groups, nodes, edges };
}

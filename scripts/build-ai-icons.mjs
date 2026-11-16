// Copies third-party AI tool logos from @lobehub/icons-static-svg (MIT) into public/ai-icons
// and writes the catalog to src/data/ai-tools.json.
// Usage: node scripts/build-ai-icons.mjs <path to extracted package/icons folder>
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/build-ai-icons.mjs <icons dir>'); process.exit(1); }
const out = path.resolve('public/ai-icons');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// [id, display name, lobe icon name, description, aliases]
const GROUPS = {
  'ai-assistants': [
    ['chatgpt', 'ChatGPT', 'openai', 'OpenAI assistant & GPT models', ['chatgpt', 'openai', 'gpt', 'gpt-4', 'gpt-4o', 'gpt-5', 'openai api']],
    ['claude', 'Claude', 'claude', 'Anthropic assistant & models', ['claude', 'claude api', 'sonnet', 'opus', 'haiku']],
    ['anthropic', 'Anthropic', 'anthropic', 'Anthropic API', ['anthropic', 'anthropic api']],
    ['grok', 'Grok', 'grok', 'xAI assistant & models', ['grok', 'xai', 'grok api']],
    ['deepseek', 'DeepSeek', 'deepseek', 'Open-weight reasoning models', ['deepseek', 'deepseek r1']],
    ['mistral', 'Mistral AI', 'mistral', 'Mistral & Codestral models', ['mistral', 'mixtral', 'le chat']],
    ['meta-llama', 'Meta Llama', 'meta', 'Open-weight Llama models', ['llama', 'meta llama', 'llama 3', 'llama 4']],
    ['meta-ai', 'Meta AI', 'metaai', 'Meta assistant', ['meta ai']],
    ['qwen', 'Qwen', 'qwen', 'Alibaba Qwen models', ['qwen', 'tongyi']],
    ['kimi', 'Kimi', 'kimi', 'Moonshot AI assistant', ['kimi', 'moonshot']],
    ['perplexity', 'Perplexity', 'perplexity', 'AI answer engine', ['perplexity', 'sonar']],
    ['microsoft-copilot', 'Microsoft Copilot', 'copilot', 'Microsoft AI assistant', ['microsoft copilot', 'copilot']],
    ['notebooklm', 'NotebookLM', 'notebooklm', 'Google research notebook', ['notebooklm']],
    ['manus', 'Manus', 'manus', 'General AI agent', ['manus']],
    ['cohere', 'Cohere', 'cohere', 'Enterprise LLMs & rerank', ['cohere', 'command r', 'rerank']],
    ['minimax', 'MiniMax', 'minimax', 'MiniMax models', ['minimax']],
    ['poe', 'Poe', 'poe', 'Multi-model chat', ['poe']],
  ],
  'coding-agents': [
    ['claude-code', 'Claude Code', 'claudecode', 'Agentic coding in the terminal', ['claude code']],
    ['codex', 'OpenAI Codex', 'codex', 'OpenAI coding agent', ['codex', 'codex cli']],
    ['gemini-cli', 'Gemini CLI', 'geminicli', 'Gemini in the terminal', ['gemini cli']],
    ['antigravity', 'Google Antigravity', 'antigravity', 'Agent-first IDE', ['antigravity']],
    ['github-copilot', 'GitHub Copilot', 'githubcopilot', 'AI pair programmer', ['github copilot', 'copilot agent']],
    ['cursor', 'Cursor', 'cursor', 'AI code editor', ['cursor']],
    ['windsurf', 'Windsurf', 'windsurf', 'AI code editor', ['windsurf', 'codeium']],
    ['kiro', 'Kiro', 'kiro', 'Spec-driven AI IDE', ['kiro']],
    ['cline', 'Cline', 'cline', 'Autonomous coding agent', ['cline']],
    ['roo-code', 'Roo Code', 'roocode', 'Coding agent for VS Code', ['roo code', 'roocode']],
    ['devin', 'Devin', 'devin', 'Autonomous software engineer', ['devin']],
    ['opencode', 'OpenCode', 'opencode', 'Open-source terminal agent', ['opencode']],
    ['openhands', 'OpenHands', 'openhands', 'Open-source dev agent', ['openhands', 'opendevin']],
    ['goose', 'Goose', 'goose', 'Open-source local agent', ['goose']],
    ['amp', 'Amp', 'amp', 'Agentic coding tool', ['amp']],
    ['trae', 'Trae', 'trae', 'AI IDE', ['trae']],
    ['qoder', 'Qoder', 'qoder', 'Agentic coding platform', ['qoder']],
    ['replit', 'Replit Agent', 'replit', 'Build & deploy apps with AI', ['replit']],
    ['lovable', 'Lovable', 'lovable', 'AI app builder', ['lovable']],
    ['v0', 'v0', 'v0', 'Vercel generative UI', ['v0']],
  ],
  'agent-frameworks': [
    ['openclaw', 'OpenClaw', 'openclaw', 'Open-source personal AI agent', ['openclaw', 'clawdbot', 'moltbot']],
    ['hermes-agent', 'Hermes Agent', 'hermesagent', 'Nous Research agent', ['hermes agent', 'hermes']],
    ['grok-bot', 'Grok Bot', 'grokbot', 'xAI Grok bot', ['grok bot', 'grokbot']],
    ['nous-research', 'Nous Research', 'nousresearch', 'Hermes models', ['nous research', 'nous']],
    ['mcp', 'Model Context Protocol', 'mcp', 'MCP servers & clients', ['mcp', 'mcp server', 'model context protocol', 'mcp client']],
    ['langchain', 'LangChain', 'langchain', 'LLM application framework', ['langchain']],
    ['langgraph', 'LangGraph', 'langgraph', 'Stateful agent graphs', ['langgraph']],
    ['llamaindex', 'LlamaIndex', 'llamaindex', 'Data framework for LLMs', ['llamaindex', 'llama index']],
    ['crewai', 'CrewAI', 'crewai', 'Multi-agent crews', ['crewai', 'crew ai']],
    ['pydantic-ai', 'Pydantic AI', 'pydanticai', 'Type-safe agent framework', ['pydantic ai', 'pydanticai']],
    ['mastra', 'Mastra', 'mastra', 'TypeScript agent framework', ['mastra']],
    ['metagpt', 'MetaGPT', 'metagpt', 'Multi-agent framework', ['metagpt']],
    ['copilotkit', 'CopilotKit', 'copilotkit', 'In-app AI copilots', ['copilotkit']],
    ['dify', 'Dify', 'dify', 'LLM app platform', ['dify']],
    ['n8n', 'n8n', 'n8n', 'Workflow automation', ['n8n']],
    ['zapier', 'Zapier', 'zapier', 'No-code automation', ['zapier']],
    ['langfuse', 'Langfuse', 'langfuse', 'LLM observability', ['langfuse']],
    ['langsmith', 'LangSmith', 'langsmith', 'LLM tracing & evals', ['langsmith']],
  ],
  'model-hosting': [
    ['hugging-face', 'Hugging Face', 'huggingface', 'Models, datasets & Spaces', ['hugging face', 'huggingface', 'hf']],
    ['ollama', 'Ollama', 'ollama', 'Run models locally', ['ollama']],
    ['lm-studio', 'LM Studio', 'lmstudio', 'Local model desktop app', ['lm studio', 'lmstudio']],
    ['vllm', 'vLLM', 'vllm', 'High-throughput inference', ['vllm']],
    ['open-webui', 'Open WebUI', 'openwebui', 'Self-hosted chat UI', ['open webui', 'openwebui']],
    ['openrouter', 'OpenRouter', 'openrouter', 'Unified model API', ['openrouter']],
    ['groq', 'Groq', 'groq', 'LPU inference', ['groq']],
    ['together', 'Together AI', 'together', 'Open-model inference', ['together ai', 'together']],
    ['fireworks', 'Fireworks AI', 'fireworks', 'Fast inference', ['fireworks']],
    ['replicate', 'Replicate', 'replicate', 'Run models via API', ['replicate']],
    ['cerebras', 'Cerebras', 'cerebras', 'Wafer-scale inference', ['cerebras']],
    ['nvidia', 'NVIDIA', 'nvidia', 'GPUs & NIM', ['nvidia', 'nim', 'cuda']],
    ['aws-bedrock', 'Amazon Bedrock', 'bedrock', 'AWS foundation models', ['bedrock', 'amazon bedrock']],
    ['azure-openai', 'Azure AI', 'azure', 'Azure OpenAI & AI Foundry', ['azure', 'azure openai', 'ai foundry']],
  ],
  'gen-media': [
    ['midjourney', 'Midjourney', 'midjourney', 'Image generation', ['midjourney']],
    ['stability', 'Stability AI', 'stability', 'Stable Diffusion', ['stable diffusion', 'stability']],
    ['flux', 'FLUX', 'flux', 'Black Forest Labs images', ['flux', 'black forest labs']],
    ['sora', 'Sora', 'sora', 'OpenAI video generation', ['sora']],
    ['runway', 'Runway', 'runway', 'AI video tools', ['runway']],
    ['kling', 'Kling', 'kling', 'Video generation', ['kling']],
    ['elevenlabs', 'ElevenLabs', 'elevenlabs', 'Voice AI', ['elevenlabs', 'eleven labs', 'voice clone']],
    ['suno', 'Suno', 'suno', 'Music generation', ['suno']],
  ],
};

const catalog = [];
for (const [group, items] of Object.entries(GROUPS)) {
  for (const [id, name, lobe, desc, aliases] of items) {
    const color = path.join(src, `${lobe}-color.svg`);
    const mono = path.join(src, `${lobe}.svg`);
    const file = fs.existsSync(color) ? color : fs.existsSync(mono) ? mono : null;
    if (!file) { console.warn('missing icon:', lobe); continue; }
    let svg = fs.readFileSync(file, 'utf8');
    if (/<script|javascript:|on\w+=/i.test(svg)) { console.warn('skipping unsafe svg:', lobe); continue; }
    // standalone <img>/<image> rendering has no CSS color context — make currentColor explicit
    svg = svg.replace(/currentColor/g, '#1F1F1F').replace(/ height="1em"/, ' height="64"').replace(/ width="1em"/, ' width="64"').replace(/ style="[^"]*"/, '');
    fs.writeFileSync(path.join(out, `${id}.svg`), svg);
    catalog.push({ id, name, category: group, file: `ai-icons/${id}.svg`, desc, aliases });
  }
}
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/ai-tools.json', JSON.stringify(catalog));
console.log(`${catalog.length} AI tool icons`);

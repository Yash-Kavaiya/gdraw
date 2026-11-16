# Gdraw

A whiteboard for designing **Google Cloud architectures**: a Material 3 / Google-styled infinite canvas with the **official Google Cloud icon set**, reference templates, AI generation (bring your own key), and Google-flavored Mermaid.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## Features

- **Canvas**: select, pan and zoom; rectangle, ellipse and decision shapes; connectors that bind to shapes and re-route (straight, elbow or curved) when shapes move; animated data-flow edges; lines, freehand pen, text, sticky notes and eraser. Also undo/redo, copy/paste, duplicate, lock, layers, align/distribute and snap-to-grid.
- **Official Google Cloud icons**: all 249 icons from [cloud.google.com/icons](https://cloud.google.com/icons): the current core-product icons, the full product icon set and the 26 category icons. They are searchable and grouped by category, shown as cards or icons. Drag one onto the canvas or click to add it. Boundaries for Google Cloud, project, region, zone, VPC, subnet, GKE cluster, on-prem and external. Moving a boundary moves what's inside it (hold Alt to move it alone).
- **Agentic AI**: Agent Development Kit (ADK), Vertex AI Agent Engine, CX Agent Studio, Customer Engagement Suite, Gemini, Gemini Enterprise, Agent Builder, A2A Protocol, MCP Toolbox for Databases and Model Armor, plus an "Agent runtime" boundary.
- **AI tools & agents (third-party)**: 77 popular AI tools in 5 groups: assistants and models (ChatGPT, Claude, Grok, DeepSeek, Mistral, Llama, Qwen…), coding agents (Claude Code, Codex, Gemini CLI, Antigravity, GitHub Copilot, Cursor, Windsurf, Kiro, Cline, Devin…), agent frameworks and automation (OpenClaw, Hermes Agent, Grok Bot, MCP, LangChain, LangGraph, CrewAI, LlamaIndex, n8n…), model hosting (Hugging Face, Ollama, vLLM, OpenRouter, Groq…) and generative media (Midjourney, Sora, Runway, ElevenLabs…).
- **Templates**: 11 reference architectures, including *AI coding agents & MCP on Google Cloud*, including *Multi-agent system with ADK* (Agent Engine, A2A, MCP Toolbox, Model Armor) and *Contact center with CX Agent Studio*. Every node stays editable.
- **AI**: Gemini, OpenAI, Anthropic, or any OpenAI-compatible endpoint (OpenRouter, Ollama, LM Studio).
  - *Generate* a GCP diagram or Mermaid code from a prompt.
  - *Modify current diagram* to change what's already on the canvas.
  - *Review* runs a Well-Architected review of your diagram.
  - Keys are stored only in this browser's localStorage and sent directly to the chosen provider.
- **Mermaid studio**:
  - Live preview with a Google theme. "Google flavor" adds GCP icons and category colors to recognized services.
  - Convert flowcharts into editable canvas diagrams, or insert any diagram type as an image.
  - Export the canvas to Mermaid.
  - Pasting Mermaid code onto the canvas converts it automatically.
- **Export**: PNG (2×), SVG, copy PNG to clipboard, `.mmd`, and `.json`. Fonts and icons are embedded, so exports look right anywhere.
- **Light/dark theme**, autosave, and a "My diagrams" list stored in the browser.

## Icons

Service icons are Google's official Google Cloud icons, downloaded from https://cloud.google.com/icons. They are in `public/gcp-icons/`, and the catalog is in `src/data/gcp-icons.json`. To refresh them from new zips from that page:

```bash
npm run icons -- <folder containing the unzipped core-products-icons, category-icons and google-cloud-legacy-icons>
```

Agentic AI marks come from Google's own sources: the ADK logo from `google/adk-docs`, the A2A logo from `a2aproject/A2A`, the Gemini logo from Google's product page, and the MCP Toolbox mark (cropped from the logo) from `googleapis/genai-toolbox`. They are in `public/agentic-icons/`. Google hasn't published dedicated icons for CX Agent Studio, Agent Engine, Customer Engagement Suite or Model Armor. These use the closest official icons: Dialogflow CX, the "Agents" category icon, Contact Center AI and the "Security & Identity" category icon.

Third-party AI tool logos come from [LobeHub Icons](https://github.com/lobehub/lobe-icons) (`@lobehub/icons-static-svg`, MIT license) and are in `public/ai-icons/`. They are marked "3rd-party" in the library. To regenerate them, run `node scripts/build-ai-icons.mjs <extracted package/icons folder>`. All product names and logos are trademarks of their respective owners. They are used only to identify those products in diagrams.

Client and external items (users, browsers, mobile, on-prem) have no official Google Cloud icon, so they use Material Symbols. The Google Cloud icons are Google's property; use them as described on that page.

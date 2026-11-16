// Google Cloud service catalog backed by the OFFICIAL Google Cloud icon set
// (https://cloud.google.com/icons) — see scripts/build-icons.mjs. Client/external items
// (users, browsers, on-prem…) have no official GCP icon and use Material Symbols glyphs.
import OFFICIAL from '../data/gcp-icons.json';
import AI_TOOLS from '../data/ai-tools.json';

interface OfficialIcon { id: string; name: string; category: string; file: string; pack: string }
const OFFICIAL_ICONS = OFFICIAL as OfficialIcon[];
const OFFICIAL_BY_ID = new Map(OFFICIAL_ICONS.map((o) => [o.id, o]));

export interface Category { id: string; name: string; color: string; tint: string; darkTint: string; thirdParty?: boolean }

export const CATEGORIES: Category[] = [
  { id: 'agents', name: 'Agentic AI', color: '#9334E6', tint: '#F3E8FD', darkTint: '#33204A' },
  { id: 'compute', name: 'Compute', color: '#4285F4', tint: '#E8F0FE', darkTint: '#1C2B4A' },
  { id: 'containers', name: 'Containers & Serverless', color: '#1A73E8', tint: '#E8F0FE', darkTint: '#1C2B4A' },
  { id: 'storage', name: 'Storage & Databases', color: '#34A853', tint: '#E6F4EA', darkTint: '#183A24' },
  { id: 'analytics', name: 'Data Analytics', color: '#F9AB00', tint: '#FEF7E0', darkTint: '#3D3215' },
  { id: 'ai', name: 'AI & Machine Learning', color: '#A142F4', tint: '#F3E8FD', darkTint: '#33204A' },
  { id: 'networking', name: 'Networking', color: '#12B5CB', tint: '#E4F7FB', darkTint: '#133A40' },
  { id: 'security', name: 'Security & Identity', color: '#EA4335', tint: '#FCE8E6', darkTint: '#47201C' },
  { id: 'devops', name: 'DevOps & Operations', color: '#5F6368', tint: '#F1F3F4', darkTint: '#2D2F31' },
  { id: 'management', name: 'Management & Marketplace', color: '#5F6368', tint: '#F1F3F4', darkTint: '#2D2F31' },
  { id: 'ai-assistants', name: 'AI Assistants & Models', color: '#EA4335', tint: '#FCE8E6', darkTint: '#47201C', thirdParty: true },
  { id: 'coding-agents', name: 'AI Coding Agents', color: '#4285F4', tint: '#E8F0FE', darkTint: '#1C2B4A', thirdParty: true },
  { id: 'agent-frameworks', name: 'Agent Frameworks & Automation', color: '#34A853', tint: '#E6F4EA', darkTint: '#183A24', thirdParty: true },
  { id: 'model-hosting', name: 'Model Hosting & Runtimes', color: '#F9AB00', tint: '#FEF7E0', darkTint: '#3D3215', thirdParty: true },
  { id: 'gen-media', name: 'Generative Media', color: '#A142F4', tint: '#F3E8FD', darkTint: '#33204A', thirdParty: true },
  { id: 'generic', name: 'Clients & External', color: '#80868B', tint: '#F1F3F4', darkTint: '#2D2F31' },
  { id: 'categories', name: 'Product Categories', color: '#4285F4', tint: '#E8F0FE', darkTint: '#1C2B4A' },
];

export interface Service {
  id: string; name: string; category: string;
  /** Material Symbols glyph — fallback for non-GCP items */
  icon: string;
  /** Official Google Cloud icon file under /gcp-icons */
  file?: string;
  desc: string; aliases?: string[];
}

/** Curated services whose official icon lives under a different id. */
const FILE_ALIAS: Record<string, string> = {
  'agent-builder': 'category-agents', 'vector-search': 'ai-platform-unified',
  'agent-engine': 'category-agents', 'cx-agent-studio': 'dialogflow-cx', 'customer-engagement-suite': 'contact-center-ai',
  'model-armor': 'category-security-identity',
  'instance-group': 'compute-engine', pod: 'gke',
};

const AGENTIC = (f: string) => `agentic-icons/${f}`;

const CURATED: Service[] = [
  // Agentic AI — official marks from Google (ADK repo, A2A project, Gemini brand, MCP Toolbox repo)
  { id: 'adk', name: 'Agent Development Kit', category: 'agents', icon: 'smart_toy', file: AGENTIC('adk.png'), desc: 'ADK — build multi-agent systems', aliases: ['adk', 'agent development kit', 'agent', 'sub-agent', 'sub agent', 'multi-agent', 'llm agent', 'orchestrator agent', 'root agent'] },
  { id: 'agent-engine', name: 'Vertex AI Agent Engine', category: 'agents', icon: 'smart_toy', desc: 'Managed agent runtime, sessions & Memory Bank', aliases: ['agent engine', 'reasoning engine', 'agent runtime', 'memory bank', 'sessions'] },
  { id: 'cx-agent-studio', name: 'CX Agent Studio', category: 'agents', icon: 'support_agent', desc: 'Customer-experience agents & playbooks', aliases: ['cx agent studio', 'customer experience agent studio', 'conversational agents', 'dialogflow cx', 'dialogflow', 'playbook', 'playbooks', 'virtual agent', 'chatbot', 'voicebot'] },
  { id: 'customer-engagement-suite', name: 'Customer Engagement Suite', category: 'agents', icon: 'headset_mic', desc: 'Contact center AI (CCAI)', aliases: ['ccai', 'contact center', 'contact centre', 'customer engagement'] },
  { id: 'gemini', name: 'Gemini', category: 'agents', icon: 'auto_awesome', file: AGENTIC('gemini.svg'), desc: 'Multimodal foundation model', aliases: ['llm', 'genai', 'gemini api', 'gemini pro', 'gemini flash', 'foundation model'] },
  { id: 'gemini-enterprise', name: 'Gemini Enterprise', category: 'agents', icon: 'auto_awesome', file: AGENTIC('gemini.svg'), desc: 'Agent hub for the enterprise (formerly Agentspace)', aliases: ['gemini enterprise', 'agentspace', 'agent gallery', 'enterprise search'] },
  { id: 'agent-builder', name: 'Agent Builder', category: 'agents', icon: 'smart_toy', desc: 'Agents, Agent Garden & Vertex AI Search', aliases: ['agent builder', 'vertex ai search', 'agent garden'] },
  { id: 'a2a', name: 'A2A Protocol', category: 'agents', icon: 'swap_horiz', file: AGENTIC('a2a.svg'), desc: 'Agent2Agent interoperability', aliases: ['a2a', 'agent2agent', 'agent to agent', 'remote agent'] },
  { id: 'mcp-toolbox', name: 'MCP Toolbox for Databases', category: 'agents', icon: 'build', file: AGENTIC('mcp-toolbox.png'), desc: 'MCP server exposing database tools', aliases: ['mcp toolbox', 'mcp toolbox for databases', 'genai toolbox', 'database tools'] },
  { id: 'model-armor', name: 'Model Armor', category: 'agents', icon: 'shield', desc: 'Prompt & response safety screening', aliases: ['model armor', 'prompt injection', 'guardrails', 'llm firewall', 'safety filter'] },
  // Compute
  { id: 'compute-engine', name: 'Compute Engine', category: 'compute', icon: 'memory', desc: 'Virtual machines', aliases: ['gce', 'vm', 'virtual machine', 'instance'] },
  { id: 'app-engine', name: 'App Engine', category: 'compute', icon: 'apps', desc: 'Managed app platform', aliases: ['gae'] },
  { id: 'batch', name: 'Batch', category: 'compute', icon: 'dynamic_feed', desc: 'Batch jobs' },
  { id: 'vmware-engine', name: 'VMware Engine', category: 'compute', icon: 'dns', desc: 'VMware workloads', aliases: ['gcve'] },
  { id: 'tpu', name: 'Cloud TPU', category: 'compute', icon: 'developer_board', desc: 'Tensor processing units', aliases: ['tpu', 'gpu'] },
  { id: 'instance-group', name: 'Managed Instance Group', category: 'compute', icon: 'view_module', desc: 'Autoscaled VMs', aliases: ['mig'] },
  // Containers & serverless
  { id: 'gke', name: 'Google Kubernetes Engine', category: 'containers', icon: 'deployed_code', desc: 'Managed Kubernetes', aliases: ['gke', 'kubernetes', 'k8s'] },
  { id: 'cloud-run', name: 'Cloud Run', category: 'containers', icon: 'directions_run', desc: 'Serverless containers', aliases: ['run'] },
  { id: 'cloud-functions', name: 'Cloud Run functions', category: 'containers', icon: 'function', desc: 'Event-driven functions', aliases: ['cloud functions', 'functions', 'gcf', 'lambda'] },
  { id: 'artifact-registry', name: 'Artifact Registry', category: 'containers', icon: 'inventory', desc: 'Container & package registry', aliases: ['gcr', 'container registry', 'registry'] },
  { id: 'pod', name: 'Pod / Workload', category: 'containers', icon: 'view_in_ar', desc: 'Kubernetes workload', aliases: ['pod', 'deployment', 'service', 'microservice'] },
  // Storage & DB
  { id: 'cloud-storage', name: 'Cloud Storage', category: 'storage', icon: 'inventory_2', desc: 'Object storage', aliases: ['gcs', 'bucket', 'storage', 'data lake'] },
  { id: 'cloud-sql', name: 'Cloud SQL', category: 'storage', icon: 'database', desc: 'Managed MySQL / Postgres', aliases: ['sql', 'mysql', 'postgres', 'postgresql'] },
  { id: 'alloydb', name: 'AlloyDB', category: 'storage', icon: 'storage', desc: 'PostgreSQL-compatible DB', aliases: ['alloy'] },
  { id: 'spanner', name: 'Spanner', category: 'storage', icon: 'language', desc: 'Global relational DB', aliases: ['cloud spanner'] },
  { id: 'firestore', name: 'Firestore', category: 'storage', icon: 'local_fire_department', desc: 'Document database', aliases: ['datastore', 'firebase'] },
  { id: 'bigtable', name: 'Bigtable', category: 'storage', icon: 'table_rows', desc: 'Wide-column NoSQL', aliases: ['hbase'] },
  { id: 'memorystore', name: 'Memorystore', category: 'storage', icon: 'bolt', desc: 'Redis / Valkey cache', aliases: ['redis', 'cache', 'memcached', 'valkey'] },
  { id: 'filestore', name: 'Filestore', category: 'storage', icon: 'folder_shared', desc: 'Managed NFS', aliases: ['nfs'] },
  { id: 'persistent-disk', name: 'Persistent Disk', category: 'storage', icon: 'hard_drive', desc: 'Block storage', aliases: ['disk', 'pd', 'hyperdisk'] },
  // Analytics
  { id: 'bigquery', name: 'BigQuery', category: 'analytics', icon: 'query_stats', desc: 'Data warehouse', aliases: ['bq', 'warehouse'] },
  { id: 'pubsub', name: 'Pub/Sub', category: 'analytics', icon: 'hub', desc: 'Messaging & streaming', aliases: ['pub sub', 'pubsub', 'queue', 'kafka', 'topic'] },
  { id: 'dataflow', name: 'Dataflow', category: 'analytics', icon: 'waves', desc: 'Stream & batch processing', aliases: ['beam', 'etl'] },
  { id: 'dataproc', name: 'Dataproc', category: 'analytics', icon: 'settings_suggest', desc: 'Managed Spark & Hadoop', aliases: ['spark', 'hadoop'] },
  { id: 'looker', name: 'Looker', category: 'analytics', icon: 'insights', desc: 'BI & dashboards', aliases: ['looker studio', 'dashboard', 'bi', 'data studio'] },
  { id: 'composer', name: 'Cloud Composer', category: 'analytics', icon: 'account_tree', desc: 'Managed Airflow', aliases: ['airflow'] },
  { id: 'data-fusion', name: 'Data Fusion', category: 'analytics', icon: 'merge', desc: 'Visual data integration' },
  { id: 'dataplex', name: 'Dataplex', category: 'analytics', icon: 'dataset', desc: 'Data governance & catalog', aliases: ['data catalog', 'catalog'] },
  { id: 'datastream', name: 'Datastream', category: 'analytics', icon: 'stream', desc: 'Change data capture', aliases: ['cdc'] },
  // AI
  { id: 'vertex-ai', name: 'Vertex AI', category: 'ai', icon: 'neurology', desc: 'ML platform', aliases: ['vertex', 'ml', 'machine learning', 'agent platform'] },
  { id: 'vector-search', name: 'Vector Search', category: 'ai', icon: 'scatter_plot', desc: 'Vector similarity search', aliases: ['embeddings', 'vector', 'matching engine'] },
  { id: 'vertex-pipelines', name: 'Vertex AI Pipelines', category: 'ai', icon: 'model_training', desc: 'ML pipelines', aliases: ['pipelines', 'kubeflow', 'training'] },
  { id: 'model-endpoint', name: 'Vertex AI Endpoint', category: 'ai', icon: 'online_prediction', desc: 'Online prediction', aliases: ['endpoint', 'prediction', 'model serving'] },
  { id: 'document-ai', name: 'Document AI', category: 'ai', icon: 'description', desc: 'Document understanding', aliases: ['ocr', 'docai'] },
  { id: 'vision-ai', name: 'Vision AI', category: 'ai', icon: 'visibility', desc: 'Image analysis', aliases: ['vision'] },
  { id: 'speech', name: 'Speech-to-Text', category: 'ai', icon: 'mic', desc: 'Speech recognition', aliases: ['stt', 'speech', 'text-to-speech', 'tts'] },
  { id: 'translation', name: 'Translation AI', category: 'ai', icon: 'translate', desc: 'Machine translation', aliases: ['translate'] },
  { id: 'natural-language', name: 'Natural Language AI', category: 'ai', icon: 'chat', desc: 'Text analysis', aliases: ['nlp', 'natural language'] },
  // Networking
  { id: 'vpc', name: 'VPC Network', category: 'networking', icon: 'lan', desc: 'Virtual private cloud', aliases: ['network', 'vpc'] },
  { id: 'load-balancer', name: 'Cloud Load Balancing', category: 'networking', icon: 'alt_route', desc: 'Global load balancer', aliases: ['lb', 'load balancer', 'glb', 'alb'] },
  { id: 'cdn', name: 'Cloud CDN', category: 'networking', icon: 'speed', desc: 'Content delivery', aliases: ['cdn'] },
  { id: 'dns', name: 'Cloud DNS', category: 'networking', icon: 'dns', desc: 'Managed DNS', aliases: ['dns', 'domain'] },
  { id: 'armor', name: 'Cloud Armor', category: 'networking', icon: 'shield', desc: 'WAF & DDoS protection', aliases: ['waf', 'ddos', 'armor'] },
  { id: 'nat', name: 'Cloud NAT', category: 'networking', icon: 'swap_horiz', desc: 'Network address translation', aliases: ['nat'] },
  { id: 'interconnect', name: 'Cloud Interconnect', category: 'networking', icon: 'cable', desc: 'Dedicated connectivity', aliases: ['interconnect'] },
  { id: 'vpn', name: 'Cloud VPN', category: 'networking', icon: 'vpn_lock', desc: 'IPsec VPN', aliases: ['vpn'] },
  { id: 'router', name: 'Cloud Router', category: 'networking', icon: 'router', desc: 'Dynamic BGP routing', aliases: ['router', 'bgp'] },
  { id: 'api-gateway', name: 'API Gateway', category: 'networking', icon: 'api', desc: 'Managed API gateway', aliases: ['gateway', 'api'] },
  { id: 'apigee', name: 'Apigee', category: 'networking', icon: 'hub', desc: 'API management', aliases: ['api management'] },
  { id: 'psc', name: 'Private Service Connect', category: 'networking', icon: 'link', desc: 'Private endpoints', aliases: ['psc', 'private link'] },
  // Security
  { id: 'iam', name: 'IAM', category: 'security', icon: 'badge', desc: 'Identity & access', aliases: ['iam', 'roles', 'service account'] },
  { id: 'secret-manager', name: 'Secret Manager', category: 'security', icon: 'key', desc: 'Secrets storage', aliases: ['secrets', 'secret'] },
  { id: 'kms', name: 'Cloud KMS', category: 'security', icon: 'encrypted', desc: 'Key management', aliases: ['kms', 'encryption', 'hsm'] },
  { id: 'scc', name: 'Security Command Center', category: 'security', icon: 'security', desc: 'Security posture', aliases: ['scc'] },
  { id: 'iap', name: 'Identity-Aware Proxy', category: 'security', icon: 'lock_person', desc: 'Zero-trust access', aliases: ['iap', 'beyondcorp'] },
  { id: 'identity-platform', name: 'Identity Platform', category: 'security', icon: 'person_check', desc: 'Customer identity', aliases: ['auth', 'firebase auth', 'login', 'authentication'] },
  // DevOps
  { id: 'cloud-build', name: 'Cloud Build', category: 'devops', icon: 'build', desc: 'CI builds', aliases: ['ci', 'build'] },
  { id: 'cloud-deploy', name: 'Cloud Deploy', category: 'devops', icon: 'rocket_launch', desc: 'Continuous delivery', aliases: ['cd', 'deploy'] },
  { id: 'monitoring', name: 'Cloud Monitoring', category: 'devops', icon: 'monitoring', desc: 'Metrics & alerting', aliases: ['monitoring', 'metrics', 'stackdriver', 'observability'] },
  { id: 'logging', name: 'Cloud Logging', category: 'devops', icon: 'receipt_long', desc: 'Log management', aliases: ['logs', 'logging'] },
  { id: 'scheduler', name: 'Cloud Scheduler', category: 'devops', icon: 'schedule', desc: 'Cron jobs', aliases: ['cron', 'scheduler'] },
  { id: 'tasks', name: 'Cloud Tasks', category: 'devops', icon: 'task_alt', desc: 'Async task queues', aliases: ['tasks'] },
  { id: 'workflows', name: 'Workflows', category: 'devops', icon: 'conversion_path', desc: 'Service orchestration', aliases: ['workflow', 'orchestration'] },
  { id: 'eventarc', name: 'Eventarc', category: 'devops', icon: 'electric_bolt', desc: 'Event routing', aliases: ['events', 'trigger'] },
  { id: 'source-repo', name: 'Source Repository', category: 'devops', icon: 'code', desc: 'Git repository', aliases: ['github', 'gitlab', 'git', 'repo', 'source'] },
  // Generic
  { id: 'users', name: 'Users', category: 'generic', icon: 'group', desc: 'End users', aliases: ['user', 'users', 'customer', 'client', 'people'] },
  { id: 'browser', name: 'Web Browser', category: 'generic', icon: 'web', desc: 'Web client', aliases: ['browser', 'web', 'frontend', 'website', 'web app'] },
  { id: 'mobile', name: 'Mobile App', category: 'generic', icon: 'smartphone', desc: 'iOS / Android', aliases: ['mobile', 'phone', 'android', 'ios'] },
  { id: 'server', name: 'On-prem Server', category: 'generic', icon: 'dns', desc: 'Data center host', aliases: ['server', 'on-prem', 'onprem', 'datacenter', 'data center'] },
  { id: 'internet', name: 'Internet', category: 'generic', icon: 'public', desc: 'Public internet', aliases: ['internet', 'external api', 'third party', 'saas'] },
  { id: 'iot', name: 'IoT Devices', category: 'generic', icon: 'sensors', desc: 'Connected devices', aliases: ['iot', 'device', 'sensor'] },
  { id: 'email', name: 'Email / Notification', category: 'generic', icon: 'mail', desc: 'Notifications', aliases: ['email', 'notification', 'sms', 'alert'] },
  { id: 'developer', name: 'Developer', category: 'generic', icon: 'terminal', desc: 'Engineer / CLI', aliases: ['developer', 'engineer', 'cli', 'admin'] },
];

const CATEGORY_NAME: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name]));

export const SERVICES: Service[] = [
  ...CURATED.map((s) => {
    if (s.file) return s;
    const off = OFFICIAL_BY_ID.get(FILE_ALIAS[s.id] ?? s.id);
    return off && s.category !== 'generic' ? { ...s, file: off.file } : s;
  }),
  // third-party AI tools (logos via LobeHub icons, MIT) — see scripts/build-ai-icons.mjs
  ...(AI_TOOLS as Service[]).map((t) => ({ ...t, icon: 'smart_toy' })),
  // every remaining official icon becomes a placeable service
  ...OFFICIAL_ICONS
    .filter((o) => !CURATED.some((c) => c.id === o.id))
    .map((o) => ({
      id: o.id, name: o.name, category: o.category, icon: 'cloud', file: o.file,
      desc: o.pack === 'category' ? 'Google Cloud product category' : CATEGORY_NAME[o.category] ?? 'Google Cloud',
    })),
];

export const iconUrl = (file: string) => `${import.meta.env.BASE_URL}${file.includes('/') ? file : `gcp-icons/${file}`}`;

export const SERVICE_MAP = new Map(SERVICES.map((s) => [s.id, s]));
export const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.id, c]));

export function serviceInfo(id?: string) {
  const s = (id && SERVICE_MAP.get(id)) || SERVICE_MAP.get('internet')!;
  const c = CATEGORY_MAP.get(s.category)!;
  return { service: s, category: c };
}

/** Best-effort match of free text (e.g. a Mermaid label or AI output) to a service id. */
export function matchService(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase().replace(/<[^>]+>/g, ' ').trim();
  if (SERVICE_MAP.has(t)) return t;
  // exact name first, then longest alias contained in text
  for (const s of SERVICES) if (s.name.toLowerCase() === t) return s.id;
  let best: { id: string; len: number } | undefined;
  for (const s of SERVICES) {
    const names = [s.name.toLowerCase(), s.id.replace(/-/g, ' '), ...(s.aliases ?? [])];
    for (const n of names) {
      if (n.length < 2) continue;
      const re = new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}($|[^a-z0-9])`);
      if (re.test(t) && (!best || n.length > best.len)) best = { id: s.id, len: n.length };
    }
  }
  return best?.id;
}

export const ZONE_STYLES: Record<string, { label: string; icon: string; stroke: string; fill: string; darkFill: string; dash: boolean }> = {
  cloud:    { label: 'Google Cloud', icon: 'cloud', stroke: '#4285F4', fill: '#F8FAFF', darkFill: '#161C27', dash: false },
  project:  { label: 'Project', icon: 'folder_open', stroke: '#5F6368', fill: '#F8F9FA', darkFill: '#1C1D1F', dash: false },
  region:   { label: 'Region', icon: 'location_on', stroke: '#1A73E8', fill: '#EEF4FD', darkFill: '#18212F', dash: true },
  zone:     { label: 'Zone', icon: 'pin_drop', stroke: '#34A853', fill: '#EEF8F1', darkFill: '#172A1E', dash: true },
  vpc:      { label: 'VPC Network', icon: 'lan', stroke: '#12B5CB', fill: '#EDF9FB', darkFill: '#15292D', dash: false },
  subnet:   { label: 'Subnet', icon: 'hub', stroke: '#12B5CB', fill: '#F6FCFD', darkFill: '#17252A', dash: true },
  cluster:  { label: 'GKE Cluster', icon: 'deployed_code', stroke: '#1A73E8', fill: '#F4F8FE', darkFill: '#18202C', dash: true },
  onprem:   { label: 'On-premises', icon: 'domain', stroke: '#80868B', fill: '#F5F5F5', darkFill: '#202122', dash: false },
  agent:    { label: 'Agent runtime', icon: 'smart_toy', stroke: '#9334E6', fill: '#FAF5FE', darkFill: '#251B30', dash: false },
  external: { label: 'External', icon: 'public', stroke: '#F9AB00', fill: '#FFFAEB', darkFill: '#2B2615', dash: true },
  group:    { label: 'Group', icon: 'category', stroke: '#A142F4', fill: '#FAF5FE', darkFill: '#251B30', dash: true },
};

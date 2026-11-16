// Copies the official Google Cloud icon packs (https://cloud.google.com/icons) into
// public/gcp-icons and writes a catalog to src/data/gcp-icons.json.
// Usage: node scripts/build-icons.mjs <dir containing the 3 unzipped packs>
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/build-icons.mjs <icons dir>'); process.exit(1); }
const outDir = path.resolve('public/gcp-icons');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ACRONYMS = { api: 'API', apis: 'APIs', ai: 'AI', gke: 'GKE', iot: 'IoT', vpn: 'VPN', nat: 'NAT', cdn: 'CDN', dns: 'DNS', sql: 'SQL', tpu: 'TPU', gpu: 'GPU', hsm: 'HSM', ekm: 'EKM', ids: 'IDS', os: 'OS', ssd: 'SSD', nlp: 'NLP', qna: 'QnA', cx: 'CX', gce: 'GCE', vmware: 'VMware', automl: 'AutoML', bigquery: 'BigQuery', pubsub: 'Pub/Sub', vertexai: 'Vertex AI', dataproc: 'Dataproc', iap: 'IAP', ip: 'IP', on: 'on', for: 'for', and: 'and', to: 'to' };
const titleize = (s) => s.replace(/_-_/g, ' – ').split(/[_\s]+/).map((w, i) => {
  const lw = w.toLowerCase();
  if (ACRONYMS[lw] && !(i === 0 && ['on', 'for', 'and', 'to'].includes(lw))) return ACRONYMS[lw];
  return w.split('-').map((p) => ACRONYMS[p.toLowerCase()] ?? (p[0]?.toUpperCase() + p.slice(1))).join('-');
}).join(' ');

// keyword → category (first match wins)
const RULES = [
  ['ai', /vertex|automl|ai_|_ai|dialogflow|vision|speech|translation|natural_language|document_ai|recommendations|tensorflow|datalab|data_labeling|contact_center|agent|inference|visual_inspection|video_intelligence|healthcare_nlp|media_translation|optimization_ai|retail_api|jobs_api|advanced_solutions_lab/],
  ['analytics', /bigquery|dataflow|dataproc|pubsub|composer|data_fusion|dataplex|datastream|data_catalog|catalog|dataprep|looker|data_studio|analytics_hub|datashare|genomics|data_qna|stream_suite|real-world|datapol|data_layers|dataproc_metastore/],
  ['storage', /storage|sql|spanner|bigtable|firestore|datastore|memorystore|filestore|persistent_disk|local_ssd|transfer|database|alloydb|hyperdisk/],
  ['networking', /network|vpc|virtual_private|load_balancing|cdn|dns|armor|nat|interconnect|vpn|router|routes|private_service|private_connectivity|traffic_director|tier|external_ip|firewall|domains|connectivity|media_edge|service_discovery/],
  ['security', /security|iam|identity|access|secret|key_|kms|hsm|ekm|beyondcorp|certificate|binary_authorization|phishing|risk|web_risk|data_loss|assured_workloads|permissions|workload_identity|policy|mandiant|secops|threat|datapol/],
  ['containers', /kubernetes|gke|cloud_run|functions|anthos|container|kuberun|artifact_registry|migrate_for_anthos/],
  ['compute', /compute|app_engine|batch|vmware|tpu|gpu|bare_metal|game_servers|gce|os_|hypercomputer|distributed_cloud/],
  ['devops', /build|deploy|monitoring|logging|scheduler|tasks|workflows|eventarc|stackdriver|trace|profiler|debugger|error_reporting|cloud_ops|cloud_code|cloud_shell|test_lab|audit|apis|api|endpoints|apigee|deployment_manager|runtime_config|configuration_management|tools_for|launcher|connectors|developer_portal|iot/],
];
const CAT_OVERRIDE = {
  scc: 'security', apigee: 'networking', 'api-gateway': 'networking', cloud_ids: 'security', early_access_center: 'management',
  anthos: 'containers', secops: 'security', 'threat-intelligence': 'security', mandiant: 'security', looker: 'analytics',
  iot_core: 'compute', iot_edge: 'compute', cloud_endpoints: 'networking', cloud_healthcare_api: 'ai',
};
const categoryOf = (id) => CAT_OVERRIDE[id] ?? CAT_OVERRIDE[id.replace(/_/g, '-')] ?? (RULES.find(([, re]) => re.test(id))?.[0]) ?? 'management';

const catalog = [];
const add = (file, id, name, category, pack) => {
  const out = `${id}.svg`;
  fs.copyFileSync(file, path.join(outDir, out));
  catalog.push({ id, name, category, file: out, pack });
};

// 1. Current core product icons (preferred where they exist)
const CORE_IDS = {
  'AI Hypercomputer': 'ai-hypercomputer', AlloyDB: 'alloydb', Anthos: 'anthos', Apigee: 'apigee', BigQuery: 'bigquery',
  'Cloud Run': 'cloud-run', 'Cloud Spanner': 'spanner', 'Cloud SQL': 'cloud-sql', 'Cloud Storage': 'cloud-storage',
  'Compute Engine': 'compute-engine', 'Distributed Cloud': 'distributed-cloud', GKE: 'gke', Hyperdisk: 'hyperdisk',
  Looker: 'looker', Mandiant: 'mandiant', 'Security Command Center': 'scc', SecOps: 'secops',
  'Threat Intelligence': 'threat-intelligence', 'Vertex AI': 'vertex-ai',
};
const coreFiles = walk(path.join(src, 'core-products-icons')).filter((f) => f.endsWith('.svg'));
const coreNames = new Set();
for (const f of coreFiles) {
  const folder = path.basename(path.dirname(path.dirname(f)));
  const id = CORE_IDS[folder] ?? slug(folder);
  const name = folder === 'GKE' ? 'Google Kubernetes Engine' : folder === 'SecOps' ? 'Google SecOps' : folder;
  add(f, id, name, CAT_OVERRIDE[id] ?? categoryOf(id.replace(/-/g, '_')), 'core');
  coreNames.add(folder.toLowerCase().replace(/\s+/g, '_'));
}

// 2. Category icons
const catFiles = walk(path.join(src, 'category-icons')).filter((f) => f.endsWith('.svg'));
for (const f of catFiles) {
  const folder = path.basename(path.dirname(path.dirname(f))).replace(/\s*_\s*/g, ' & ');
  add(f, 'category-' + slug(folder), folder, 'categories', 'category');
}

// 3. Product icons (legacy pack) — skip ones superseded by core icons
const SUPERSEDED = new Set(['bigquery', 'cloud_run', 'cloud_spanner', 'cloud_sql', 'cloud_storage', 'compute_engine', 'google_kubernetes_engine', 'looker', 'security_command_center', 'vertexai', 'anthos', 'apigee_api_platform']);
const LEGACY_IDS = {
  app_engine: 'app-engine', batch: 'batch', vmware_engine: 'vmware-engine', cloud_tpu: 'tpu', cloud_functions: 'cloud-functions',
  artifact_registry: 'artifact-registry', firestore: 'firestore', bigtable: 'bigtable', memorystore: 'memorystore', filestore: 'filestore',
  persistent_disk: 'persistent-disk', pubsub: 'pubsub', dataflow: 'dataflow', dataproc: 'dataproc', cloud_composer: 'composer',
  cloud_data_fusion: 'data-fusion', dataplex: 'dataplex', datastream: 'datastream', document_ai: 'document-ai', cloud_vision_api: 'vision-ai',
  'speech-to-text': 'speech', cloud_translation_api: 'translation', cloud_natural_language_api: 'natural-language',
  virtual_private_cloud: 'vpc', cloud_load_balancing: 'load-balancer', cloud_cdn: 'cdn', cloud_dns: 'dns', cloud_armor: 'armor',
  cloud_nat: 'nat', cloud_interconnect: 'interconnect', cloud_vpn: 'vpn', cloud_router: 'router', cloud_api_gateway: 'api-gateway',
  private_service_connect: 'psc', identity_and_access_management: 'iam', secret_manager: 'secret-manager', key_management_service: 'kms',
  'identity-aware_proxy': 'iap', identity_platform: 'identity-platform', cloud_build: 'cloud-build', cloud_deploy: 'cloud-deploy',
  cloud_monitoring: 'monitoring', cloud_logging: 'logging', cloud_scheduler: 'scheduler', cloud_tasks: 'tasks', workflows: 'workflows',
  eventarc: 'eventarc', ai_platform: 'vertex-pipelines', cloud_inference_api: 'model-endpoint', dialogflow_cx: 'dialogflow-cx',
};
const NAME_FIX = {
  pubsub: 'Pub/Sub', vertexai: 'Vertex AI (classic)', cloud_tpu: 'Cloud TPU', ai_platform: 'Vertex AI Pipelines', cloud_inference_api: 'Vertex AI Endpoint',
  identity_and_access_management: 'IAM', key_management_service: 'Cloud KMS', 'identity-aware_proxy': 'Identity-Aware Proxy',
  cloud_vision_api: 'Vision AI', 'speech-to-text': 'Speech-to-Text', 'text-to-speech': 'Text-to-Speech', cloud_translation_api: 'Translation AI',
  cloud_natural_language_api: 'Natural Language AI', virtual_private_cloud: 'VPC Network', private_service_connect: 'Private Service Connect',
  cloud_api_gateway: 'API Gateway', 'gke_on-prem': 'GKE on-prem', 'real-world_insights': 'Real-World Insights',
};
const legacyDir = path.join(src, 'google-cloud-legacy-icons');
for (const folder of fs.readdirSync(legacyDir).sort()) {
  const f = path.join(legacyDir, folder, `${folder}.svg`);
  if (!fs.existsSync(f) || SUPERSEDED.has(folder)) continue;
  const id = LEGACY_IDS[folder] ?? slug(folder);
  if (catalog.some((c) => c.id === id)) continue;
  add(f, id, NAME_FIX[folder] ?? titleize(folder), categoryOf(folder), 'product');
}

fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/gcp-icons.json', JSON.stringify(catalog, null, 0));
const by = {};
for (const c of catalog) by[c.category] = (by[c.category] ?? 0) + 1;
console.log(`${catalog.length} official icons →`, by);

import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../integrations/apps-script/', import.meta.url);
const base = readFileSync(new URL('published-v51.gs', root), 'utf8');
const needle = 'return json_(buildDashboard_());';
if (base.split(needle).length !== 2) throw new Error('Dispatcher v51 inatteso');
const originCode = readFileSync(new URL('../lib/contract-origin.ts', import.meta.url), 'utf8');
const match = originCode.match(/LEAD_ORIGIN_KEYWORDS = (\[[^;]+\]);/);
if (!match) throw new Error('Regola origine CRM non trovata');
const keywords = JSON.parse(match[1]);
const classifier = 'function assistantOriginIsLead_(origin) { const value=String(origin||\'\').toLowerCase(); return '+JSON.stringify(keywords)+'.some(function(keyword){return value.indexOf(keyword)>=0;}); }';
const output = base.replace(needle, "if (e.parameter.action === 'assistant') return json_(assistantRead_(e.parameter));\n    " + needle)
  + '\n' + classifier + '\n' + readFileSync(new URL('assistant-readonly.gs', root), 'utf8');
writeFileSync(new URL('candidate-v53.gs', root), output);
console.log('candidate-v53.gs generato; nessun deployment effettuato');

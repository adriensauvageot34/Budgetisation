import fs from 'node:fs';
import {barP3Month,barP3Knowledge} from './fixtures/bar-apero-p3.mjs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { fixture as plannerFixture, state as plannerState, simpleMonth, nightMonth, weekendMonth, renewalMonth, externalMonth, householdId } from './fixtures/planner-headless.mjs';
import { providers } from './fixtures/planner-mobility.mjs';
import { atomicMonth, interactionMonth, richMonth, savingsMonth } from './fixtures/planner-atomic-ui.mjs';
import { visualMonth, visualThreeBeautyMonth, sparseMonth, unreadyMonth } from './fixtures/planner-visual-fidelity.mjs';
import { p10Month } from './fixtures/planner-p10.mjs';
import { p09CompatibilityMonth, p09ReadbackMonth } from './fixtures/planner-p09.mjs';
import { l33Month } from './fixtures/planner-l3-3.mjs';
import { l31Month } from './fixtures/planner-l3-1.mjs';
import { l4eMonth } from './fixtures/planner-l4e.mjs';
import { p2Measuring, p2FixturePlugin, p2World, p2Interaction } from './lib/planner-p14-p2-fixture-tools.mjs';
import { p4Measuring, p4FixturePlugin } from './lib/planner-p14-p4a-fixture-tools.mjs';
import { p4Fixture, p4Extra } from './fixtures/planner-p14-p4a.mjs';
import { p4dMeasuring, p4dFixturePlugin, p4dInteraction } from './lib/planner-p14-p4d-fixture-tools.mjs';
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { preparePlanningMobility } = require('@/server/phase2/planner/prospective-mobility-pricing');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');
const { appliedMobilitySummaries } = require('@/server/phase2/planner/mobility-presentation');
const { appliedPlanControls } = require('@/server/phase2/planner/applied-plan-read');
const { AppliedMonthView } = require('@/app/mois-a-venir/applied-month-view');
const { semanticStateDigest, parsePlanSemanticState } = require('@/domain/phase2/planner/semantic-state');
// Every prospective provider is synthetic. Reject any accidental server network call.
globalThis.fetch = async () => { throw new Error('FIXTURE_NETWORK_FORBIDDEN'); };
const out = path.resolve(process.env.PLANNER_C8_BROWSER_OUTPUT ?? 'outputs/planner-c8-browser');
fs.mkdirSync(out, { recursive: true });
if (process.env.PLANNER_C8_PREBUILT !== '1') {
const { build } = await import(process.env.PLANNER_BROWSER_TOOLS ? pathToFileURL(path.join(process.env.PLANNER_BROWSER_TOOLS, 'node_modules/esbuild/lib/main.js')).href : 'esbuild');
const mocks = {
  'next/link': 'import React from "react"; export default function Link({children,...props}) { return React.createElement("a",props,children); }',
  'next/navigation': 'export const usePathname = () => "/mois-a-venir/composer";',
  '@/components/runtime': 'import {useRef} from "react"; export function useProductRuntime(){return {backgroundRootRef:useRef(null)}}',
  '@/features/auth/sign-out-button': 'import React from "react"; export const SignOutButton = () => React.createElement("button",{disabled:true},"Déconnexion");'
};
const p4Split = p4Measuring && process.env.PLANNER_P14_P4B_SPLIT === '1' || process.env.PLANNER_L1_SPLIT === '1';
const l1Reference = process.env.PLANNER_L1_REFERENCE === '1';
const l1OriginalUi = new Set(['composer-shell.tsx','composer-board.tsx','composer.module.css','context-card.tsx','context-palette.tsx','editor-chunks.ts','local-draft.ts']);
const built = await build({ entryPoints: [p4dMeasuring ? 'scripts/lib/planner-composer-p14-p4d-browser-entry.tsx' : p4Measuring ? 'scripts/lib/planner-composer-p14-p4a-browser-entry.tsx' : p2Measuring ? 'scripts/lib/planner-composer-p14-p2-browser-entry.tsx' : 'scripts/lib/planner-composer-browser-entry.tsx'], bundle: true, format: 'esm', target: 'chrome120', jsx: 'automatic',
  define: { 'process.env.NEXT_PUBLIC_COMPOSER_P14_P2_INTERACTIONS': JSON.stringify(process.env.NEXT_PUBLIC_COMPOSER_P14_P2_INTERACTIONS ?? '1'),
    'process.env.NODE_ENV':'"production"',
    'process.env.NEXT_PUBLIC_COMPOSER_P14_P4A_PAGES':JSON.stringify(process.env.NEXT_PUBLIC_COMPOSER_P14_P4A_PAGES ?? 'neighbors'),
    ...(p4Measuring?{'process.env.NODE_ENV':'"production"','process.env.P4_DIAGNOSTICS':JSON.stringify(process.env.PLANNER_P14_P4A_DIAGNOSTICS==='1'),
      'process.env.NEXT_PUBLIC_COMPOSER_P14_P4A_PAGES':JSON.stringify(process.env.NEXT_PUBLIC_COMPOSER_P14_P4A_PAGES ?? 'neighbors')}: {}) },
  minify:p4Measuring || process.env.PLANNER_L1_SPLIT === '1',
  ...(p4Split ? { outdir:out, entryNames:'app', chunkNames:'chunks/[name]-[hash]', splitting:true, metafile:true } : { outfile: path.join(out, 'app.js') }),
  loader: { '.css': 'local-css' }, sourcemap: true,
  external: ['/planned-visuals/*'],
  plugins: [...(process.env.PLANNER_L33_CLUSTER_TRIAL === '1' ? [{ name:'l33-real-expansion-comparison',setup(builder){
    builder.onLoad({filter:/[\\/]visual-cluster\.tsx$/},args=>{
      const original=fs.readFileSync(args.path,'utf8');
      const before=original.slice(0,original.indexOf('export function VisualClusterOverlay'));
      const trial=fs.readFileSync('scripts/lib/l33-cluster-expansion-trial.tsx','utf8').replace(/^import .*$/gm,'');
      return {contents:before+trial,loader:'tsx',resolveDir:path.dirname(args.path)};
    });
  }}] : []),...(l1Reference ? [{name:'l1-approved-main-ui',setup(builder){ builder.onLoad({filter:/[\\/]composer[\\/][^\\/]+\.(tsx?|css)$/},args=> {
    if(!l1OriginalUi.has(path.basename(args.path)))return;
    const file=path.relative(process.cwd(),args.path).replaceAll('\\','/');
    return {contents:execFileSync('git',['show',`d965d54713c20d3ab614e3fe730ee70af2876ea8:${file}`],{encoding:'utf8',maxBuffer:4000000}),loader:args.path.endsWith('.css')?'local-css':'tsx',resolveDir:path.dirname(args.path)};
  });}}] : []),p4dFixturePlugin(),p4FixturePlugin(),p2FixturePlugin(), {name:'fixture-host-only',setup(builder){ builder.onResolve({filter:/^(next\/link|next\/navigation|@\/components\/runtime|@\/features\/auth\/sign-out-button)$/},args=>({path:args.path,namespace:'fixture-host'}));
    builder.onLoad({filter:/.*/,namespace:'fixture-host'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()})); }}] });
if(p4Split)fs.writeFileSync(path.join(out,'bundle-meta.json'),JSON.stringify(built.metafile,null,2));
const globalCss = process.env.PLANNER_C8_GLOBAL_CSS
  ? fs.readFileSync(process.env.PLANNER_C8_GLOBAL_CSS, 'utf8')
  : fs.readdirSync('.next/static/chunks').filter(n=>n.endsWith('.css')).map(n=>fs.readFileSync(`.next/static/chunks/${n}`,'utf8')).find(css=>css.includes('.h-dvh{'));
if (!globalCss || !/\.h-dvh\s*\{/.test(globalCss)) throw new Error('A production global stylesheet containing h-dvh is required for AppShell checks.');
fs.writeFileSync(path.join(out,'global.css'),globalCss);
} else if (['app.js','app.css','global.css'].some(name => !fs.existsSync(path.join(out,name)))) throw new Error('PLANNER_C8_PREBUILT_ASSETS_MISSING');
if (process.env.PLANNER_C8_BUILD_ONLY === '1') process.exit(0);
const stores = new Map(), fixtures = { A: simpleMonth, B: nightMonth, C: weekendMonth, D: renewalMonth, E: externalMonth, R: atomicMonth,
  L1: () => ({ world: plannerFixture(), semantic: plannerState() }),
  P04: () => ({ world: plannerFixture(), semantic: plannerState() }),
  P05: () => ({ world: plannerFixture(), semantic: plannerState() }),
  BAR_P3:barP3Month,
  P09: () => ({ world: plannerFixture(), semantic: plannerState() }),
  P09C: p09CompatibilityMonth,
  P09S: p09CompatibilityMonth,
  P09R: p09ReadbackMonth,
  P2:p10Month,
  P10:p10Month, P10OUT:p10Month, P11:p10Month, P11OUT:p10Month,
  RA: interactionMonth, RB: nightMonth, RC: weekendMonth, RR: atomicMonth, RICH:richMonth, SAVINGS:savingsMonth,
  VISUAL:visualMonth, VISUAL_P35_CLICK:visualMonth, VISUAL_P35_DRAG:visualMonth, VISUAL_P35_MULTI_DRAG:visualMonth, VISUAL_P35_REPLACE:visualMonth,
  VISUAL_P35_HISTORY:visualMonth, VISUAL_P35_PROTECTED:visualMonth, DISSOLVE_BEAUTY:visualThreeBeautyMonth,
  SPARSE:sparseMonth, UNREADY:unreadyMonth };
const draftStores = new Map();
function draftStore(key) {
  if (!draftStores.has(key)) draftStores.set(key, { active: null, archives: [], lostOnce: false, failedOnce: false, log: [] });
  return draftStores.get(key);
}
function draftSnapshot(s) { return { active: s.active, archives: s.archives,
  activePlanRevisionId: null, activePlanRevisionNumber: 0, baseStale: false }; }
const uiPayloadKeys = new Set(['x','y','screenX','screenY','uiPosition','boardPosition','orbit','presentation','focusedContext','page','pageIndex','carousel','plateau']);
function uiPayloadFields(value) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [...(uiPayloadKeys.has(key) ? [key] : []), ...uiPayloadFields(child)]);
}
async function store(key) {
  if (!stores.has(key)) stores.set(key, (async () => {
    const pg = await createKernelPostgres(), fixture = (/^L4E_(5|16|30|50)$/u.test(key) ? () => l4eMonth(Number(key.slice(4))) : key.startsWith('L1_L33') ? () => l33Month(key.includes('DENSE')) : key.startsWith('L1_L31') ? () => l31Month(key.includes('DENSE')) : key.startsWith('L1') ? fixtures.L1 : p4Measuring&&key.startsWith('P4')?p4Fixture:p2Measuring && key.startsWith('P2') ? fixtures.P2 : fixtures[key] ?? fixtures.A)(), owner = providers();
    if(key==='P10OUT'||key==='P11OUT') owner.settings.routeUnavailable=true;
    return { pg, fixture, log: [], deps: { repository: createPlanApplyRepository(pg.client),
      householdPersons: [{ personId: '00000000-0000-4000-8000-000000000001', displayName: 'Alice Fixture' },
        ...(key.startsWith('L1') ? [{ personId: '00000000-0000-4000-8000-000000000002', displayName: 'Camille Fixture' }] : [])],
      readMobilityOptions: async()=>({places:fixture.world.mobilityFacts?.places ?? [],vehicle:fixture.world.mobilityFacts?.vehicle ?? null,...(key==='BAR_P3'?{vehicleIsUnique:true,placeKnowledge:barP3Knowledge}:{})}),
      validateContextReferences: async (_household, refs) => {
        if (refs.placeIds.some(id=>!fixture.world.mobilityFacts?.places.some(p=>p.placeId===id))) throw new TypeError('CONTEXT_PLACE_NOT_ADMITTED');
        if (refs.personIds.some(id => id !== '00000000-0000-4000-8000-000000000001' && !(key.startsWith('L1') && id === '00000000-0000-4000-8000-000000000002'))) throw new TypeError('CONTEXT_PERSON_NOT_IN_HOUSEHOLD');
      }, readWorld: async () => p2World(() => fixture.world),
      prepareWorld: (world, state) => preparePlanningMobility(world, state, owner.value) } };
  })());
  return stores.get(key);
}
const assetOrigin = process.env.PLANNER_C8_ASSET_ORIGIN ?? '';
const host = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Composer mon mois — fixtures C8</title><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="${assetOrigin}/app.css"></head><body><div id="root"></div><script type="module" src="${assetOrigin}/app.js?v=${encodeURIComponent(process.env.PLANNER_C8_ASSET_VERSION ?? 'base')}"></script></body></html>`;
// Opt-in, bounded native-drag evidence on synthetic localhost only. No events
// are dispatched, and no domain payload, credentials or remote IO are read.
const l31DragTrace = `<script>(()=>{const events=[];for(const type of ['dragstart','dragenter','dragover','drop','dragend'])document.addEventListener(type,e=>{
const item={type,x:e.clientX,y:e.clientY,source:e.target.closest?.('[data-drag-source]')?.getAttribute('data-drag-source')??null,board:!!e.target.closest?.('[data-board-scroll]'),types:Array.from(e.dataTransfer?.types??[])};
if(type==='dragover'&&events.at(-1)?.type===type&&events.at(-1)?.board===item.board)return;events.push(item);if(events.length>60)events.shift();
setTimeout(()=>{item.prevented=e.defaultPrevented;document.documentElement.setAttribute('data-l31-drag-trace',JSON.stringify(events));},0);
},true);})();</script>`;
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const referringScenario = request.headers.referer ? new URL(request.headers.referer).searchParams.get('scenario') : null;
    const key = url.searchParams.get('scenario') ?? referringScenario ?? 'A';
    if(p4Measuring&&url.pathname==='/p4-metrics'&&request.method==='POST'){
      if(!/^P4_[a-zA-Z0-9_-]{1,80}$/.test(key))throw Error('P4_SCENARIO_INVALID');
      const chunks=[];let bytes=0;for await(const chunk of request){bytes+=chunk.length;if(bytes>1000000)throw Error('P4_METRICS_TOO_LARGE');chunks.push(chunk);}
      const data=JSON.parse(Buffer.concat(chunks).toString());
      const width=Number(data.samples?.[0]?.viewport?.[0]);
      const suffix=Number.isInteger(width)&&width>=320&&width<=4096?`-w${width}`:'';
      fs.writeFileSync(path.join(out,key+suffix+'-client.json'),JSON.stringify(data,null,2));response.end('Recorded local synthetic measures');return;
    }
    if (p2Measuring && url.pathname === '/p2-metrics' && request.method === 'POST') {
      if (!/^P2_[a-zA-Z0-9_-]{1,80}$/.test(key)) throw Error('P2_FIXTURE_SCENARIO_INVALID');
      const chunks=[];let bytes=0;for await(const chunk of request){bytes+=chunk.length;if(bytes>2000000)throw Error('P2_FIXTURE_PROBE_TOO_LARGE');chunks.push(chunk);}
      const metrics=JSON.parse(Buffer.concat(chunks).toString());
      fs.writeFileSync(path.join(out,key+'-client.json'),JSON.stringify(metrics,null,2));
      response.end('Recorded synthetic probe');return;
    }
    if (url.pathname === '/draft') {
      const s = draftStore(key);
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Cache-Control', 'no-store');
      if (request.method === 'GET') { response.end(JSON.stringify(draftSnapshot(s))); return; }
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const { kind, command } = JSON.parse(Buffer.concat(chunks).toString());
      const conflict = () => ({ ok:false, code:'CONFLICT', message:'Version obsolète.', latest:draftSnapshot(s) });
      let row;
      if (kind === 'SAVE') {
        const semanticState = parsePlanSemanticState(command.semanticState);
        if (semanticStateDigest(semanticState) !== command.digest || semanticState.targetMonth !== '2026-11') throw Error('FIXTURE_DRAFT_DIGEST_INVALID');
        const old = s.active;
        if (old?.lastMutationRequestId === command.requestId && old.digest === command.digest) {
          response.end(JSON.stringify({ok:true,draft:old,replayed:true})); return;
        }
        if ((old?.draftId ?? null) !== command.expectedDraftId || (old?.version ?? 0) !== command.expectedDraftVersion) {
          response.end(JSON.stringify(conflict())); return;
        }
        if (url.searchParams.get('draftFail') === '1') { response.writeHead(503); response.end('Fixture network failure'); return; }
        // C3: one pre-commit failure followed by a genuine UI retry on the same
        // local Draft. No domain writer or production transport is replaced.
        if (url.searchParams.get('draftFailOnce') === '1' && !s.failedOnce) {
          s.failedOnce = true;
          s.log.push({ kind:'SAVE_FAILED_BEFORE_COMMIT', version:old?.version ?? 0 });
          response.writeHead(503); response.end('Synthetic one-shot save failure'); return;
        }
        row = { draftId: old?.draftId ?? crypto.randomUUID(), version:(old?.version ?? 0)+1,
          lifecycle:'ACTIVE', semanticState, digest:command.digest, baseRevisionId:null, baseRevisionNumber:0,
          lastSavedAt:new Date().toISOString(), archivedAt:null, lastMutationRequestId:command.requestId,
          lastMutationExpectedVersion:command.expectedDraftVersion, lastMutationKind:'SAVE' };
        s.active = row;
      } else if (kind === 'ARCHIVE') {
        if (!s.active || s.active.draftId !== command.draftId || s.active.version !== command.expectedDraftVersion) {
          response.end(JSON.stringify(conflict())); return;
        }
        row = { ...s.active, version:s.active.version+1, lifecycle:'ABANDONED', archivedAt:new Date().toISOString(),
          lastMutationRequestId:command.requestId, lastMutationExpectedVersion:command.expectedDraftVersion, lastMutationKind:'ARCHIVE' };
        s.archives = [row, ...s.archives]; s.active = null;
      } else if (kind === 'RESTORE') {
        const old = s.archives.find(d => d.draftId === command.draftId);
        if (s.active || !old || old.version !== command.expectedDraftVersion) { response.end(JSON.stringify(conflict())); return; }
        row = { ...old, version:old.version+1, lifecycle:'ACTIVE', archivedAt:null,
          lastMutationRequestId:command.requestId, lastMutationExpectedVersion:command.expectedDraftVersion, lastMutationKind:'RESTORE' };
        s.archives = s.archives.filter(d => d.draftId !== row.draftId); s.active = row;
      } else throw Error('FIXTURE_DRAFT_KIND_INVALID');
      s.log.push({ kind, draftId:row.draftId, version:row.version, digest:row.digest });
      if (url.searchParams.get('draftLoseAfterCommit') === '1' && !s.lostOnce) {
        s.lostOnce = true; response.writeHead(503); response.end('Synthetic response lost after commit'); return;
      }
      const delay = Number(url.searchParams.get('draftDelay') ?? 0);
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, Math.min(delay,5000)));
      response.end(JSON.stringify({ok:true,draft:row,replayed:false})); return;
    }
    if (url.pathname === '/interaction') {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const command = JSON.parse(Buffer.concat(chunks).toString()), s = await store(key);
      const initialRead = command.kind === 'READ' && !command.draft;
      if (initialRead && !(await s.deps.repository.readActivePlan(householdId, '2026-11'))?.activeRevision) command.draft = s.fixture.semantic;
      if (!initialRead && command.kind === 'READ' && url.searchParams.has('networkFailSequence') && Number(url.searchParams.get('networkFailSequence')) === command.sequence) {
        s.log.push({ kind: 'NETWORK_FAILURE', sequence: command.sequence, at: Date.now() });
        response.writeHead(503, { 'Content-Type': 'text/plain' }); response.end('P03B_SYNTHETIC_NETWORK_FAILURE'); return;
      }
      // Delays only in this isolated host, to exercise stale hover responses in the actual UI.
      const rejectSequence = Number(url.searchParams.get('rejectSequence'));
      const syntheticReject = !initialRead && command.kind === 'READ' && url.searchParams.has('rejectSequence') && rejectSequence === command.sequence;
      let result = syntheticReject ? { ok:false, sequence:command.sequence, code:'P03B_SYNTHETIC_REJECTION', message:'Simulation de test rejetée' } : await p4dInteraction(command,url.searchParams.get('variant')??'P4D',s.deps,householdId,
        () => p2Interaction(command, () => handleComposerRequest(s.deps, householdId, command)));
      if(p4Measuring&&initialRead&&key.startsWith('P4')&&result.ok&&!draftStore(key).active){
        const target=key.includes('40')?40:20;let n=0;
        if(result.model.presentation.elementCount>target)throw Error('P4_INITIAL_DENSITY_EXCEEDS_TARGET');
        while(result.model.presentation.elementCount<target&&n<40){s.fixture.semantic.contexts.push(p4Extra(++n));command.draft=s.fixture.semantic;
          result=await handleComposerRequest(s.deps,householdId,command);if(!result.ok)throw Error(result.code);}
      }
      // Test transport integrity only: a deliberately mismatched proof must never become the current projection.
      if (!initialRead && command.kind === 'READ' && result.ok && url.searchParams.has('staleSequence')
        && Number(url.searchParams.get('staleSequence')) === command.sequence) result = { ...result,
          model: { ...result.model, board: { ...result.model.board, draft: { ...result.model.board.draft, semanticStateDigest: 'P09_SYNTHETIC_STALE_DIGEST' } } } };
      await s.pg.verifyCanaries();
      s.log.push({ kind: command.kind, sequence: command.sequence, mutationKind: result.mutationKind ?? null,
        gesture: command.kind === 'DROP' ? {assetKey:command.assetKey,target:command.target,sourceSocket:command.sourceSocket??null} : null,
        interactionImpact: result.interactionImpact ?? null,
        ...(p2Measuring ? { fixturePerformance:result.fixturePerformance } : {}),
        uiPayloadFields: uiPayloadFields(command),
        ok: result.ok, digest: result.ok ? result.model.board.draft.semanticStateDigest : result.code,
        projection: result.ok ? result.model.board.cockpit : null });
      const sequenceDelays = Object.fromEntries((url.searchParams.get('delaySequence') ?? '').split(',').filter(Boolean).map(item => item.split(':').map(Number)));
      const readDelay = !initialRead && command.kind === 'READ' ? Number(sequenceDelays[command.sequence] ?? url.searchParams.get('delayRead') ?? 0) : 0;
      if (readDelay > 0) await new Promise(resolve => setTimeout(resolve, Math.min(readDelay, 5000)));
      if (command.kind === 'MUTATE' && ['true', 'loading'].includes(url.searchParams.get('delayHover'))
        || url.searchParams.get('delayDrop') === 'true' && command.kind === 'DROP') {
        await new Promise(resolve => setTimeout(resolve, url.searchParams.get('delayHover') === 'loading' ? 3000 : 800));
      }
      s.log.push({ kind: 'RESPONSE', commandKind: command.kind, sequence: command.sequence, at: Date.now(), ok: result.ok });
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(result)); return;
    }
    if (url.pathname === '/evidence') {
      const s = await store(key); await s.pg.verifyCanaries(); response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ counts: await s.pg.counts(), rpcCalls: s.pg.rpcCalls, remoteWrites: 0, historicalCanaryWrites: 0, log: s.log,
        drafts: { active: draftStore(key).active && { id:draftStore(key).active.draftId, version:draftStore(key).active.version, digest:draftStore(key).active.digest },
          archives:draftStore(key).archives.length, events:draftStore(key).log },
        active: await s.deps.repository.readActivePlan(householdId, '2026-11') })); return;
    }
    if (url.pathname === '/mois-a-venir') {
      const s = await store(key), effective = await resolveEffectiveMonthScenario({ ...s.deps,
        readDirectWorld: async () => ({ forecast: s.fixture.world.forecast, monthInputs: s.fixture.world.monthInputs,
          externalIntents: s.fixture.world.externalIntents, asOfDate: s.fixture.world.asOfDate }) }, householdId, '2026-11');
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (effective.owner !== 'PLAN_V1') { response.end('<p>Aucune révision appliquée sur cette fixture.</p>'); return; }
      const controls = appliedPlanControls(effective.preview.compiled, effective.semanticState, effective.revision.baselineSnapshot);
      const markup = renderToStaticMarkup(React.createElement(AppliedMonthView, { projection: effective.projection, places: s.fixture.world.mobilityFacts?.places ?? [], mobility: effective.revision ? appliedMobilitySummaries(effective.revision.compiledManifest) : [],
        semanticState: effective.semanticState, controls, plan: null,
        persons: s.deps.householdPersons,
        revision: effective.revision.revisionNumber, today: s.fixture.world.asOfDate,
        composerHref: `/?scenario=${encodeURIComponent(key)}` }));
      response.end(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mois à venir · fixture ${key}</title><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/app.css"></head><body><main style="max-width:1100px;margin:24px auto;padding:16px">${markup}</main></body></html>`);
      return;
    }
    if (/^\/planned-visuals\/(?:composer\/presets|builder\/clay\/drinks)\/[a-z-]+\.webp$/.test(url.pathname)) {
      response.setHeader('Content-Type','image/webp'); response.setHeader('Cache-Control','public,max-age=3600');
      response.end(fs.readFileSync(path.join('public',url.pathname))); return;
    }
    if (['/app.js', '/app.css', '/global.css', '/app.js.map', '/app.css.map'].includes(url.pathname) || /^\/chunks\/[a-zA-Z0-9_-]+\.js(?:\.map)?$/.test(url.pathname)) {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript'); response.end(fs.readFileSync(path.join(out, url.pathname.slice(1)))); return;
    }
    const variantOrigin = p4Measuring && assetOrigin ? url.searchParams.get('ui') === 'P4A' ? process.env.PLANNER_C8_REFERENCE_ASSET_ORIGIN
      : url.searchParams.get('ui') === 'FAULT' ? process.env.PLANNER_C8_FAULT_ASSET_ORIGIN : null : null;
    const documentHost = url.searchParams.get('l31Trace') === '1' ? host.replace('</body>', l31DragTrace + '</body>') : host;
    response.setHeader('Content-Type', 'text/html'); response.end(variantOrigin ? documentHost.replaceAll(assetOrigin, variantOrigin) : documentHost);
  } catch (error) { console.error(error.message); response.writeHead(500); response.end('Fixture failed'); }
});
await store('A');
server.listen(Number(process.env.PORT ?? 3108), '127.0.0.1', () => console.log(`C8 synthetic Composer ready http://127.0.0.1:${server.address().port} (no remote writes)`));
process.on('SIGINT', async () => { server.close(); for (const promise of stores.values()) await (await promise).pg.close(); process.exit(); });

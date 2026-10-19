import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { require } from './lib/phase2-ts-loader.mjs';
const rr = createRequire(new URL('../outputs/l4c-test-tools/package.json', import.meta.url));
const React = rr('react'), { create, act } = rr('react-test-renderer'), original = Module._load;
Module._load = function(name, ...args) { return name === 'react' ? React : original.call(this, name, ...args); };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { BarPlaceSearch } = require('@/app/mois-a-venir/composer/bar-place-search');
const pending = [], adopted = [];
globalThis.fetch = async (path, init) => new Promise(resolve => pending.push({ path, resolve, signal: init.signal }));
const text = n => typeof n === 'string' ? n : n?.children?.map(text).join('') ?? '';
let key = 'initial', root;
const mount = () => React.createElement(BarPlaceSearch, { places: [], initialCity: 'Ville fictive', commitOnVerified: true, decisionKey: key,
  onKnown: () => assert.fail('No invented Canonical identity'), onGoogle: (label, ref) => adopted.push({ label, ref }) });
const field = () => root.root.findAll(n => n.type === 'label' && text(n).startsWith('Chercher un bar'))[0].findByType('input');
const change = async value => act(async () => field().props.onChange({ target: { value } }));
const wait = async () => act(async () => new Promise(resolve => setTimeout(resolve, 330)));
const answer = async (index, payload) => act(async () => { assert(pending[index]); pending[index].resolve({ ok: true, json: async () => payload }); });
const click = async name => act(async () => { const button = root.root.findAll(n => n.type === 'button' && text(n) === name)[0]; assert(button, name); await button.props.onClick(); });
const suggestions = { suggestions: [{ source: 'google_places', placeId: 'google_exact_r5', primaryText: 'Bar fictif', secondaryText: 'Ville fictive' }] };
const detail = { place: { provider: 'google_places', placeId: 'google_exact_r5', displayName: 'Bar fictif', formattedAddress: 'Adresse publique fictive', types: ['bar'] } };
try {
  await act(async () => { root = create(mount()); });
  await change('premier'); await wait(); await answer(0, suggestions);
  assert.equal(adopted.length, 0, 'typing/search does not admit a decision');
  await click('Bar fictif · Ville fictive'); assert.equal(adopted.length, 0, 'Details must complete first');
  await answer(1, detail); assert.equal(adopted.length, 1, 'one explicit click + verified Details = one minimal decision');
  assert.deepEqual(adopted[0], { label: 'Bar fictif', ref: { provider: 'google_places', kind: 'BAR_APERO', placeId: 'google_exact_r5' } });
  await click('Reprendre cette recherche'); await change('second'); await wait();
  // The resume schedules and cancels its predecessor; only the last actual request matters.
  let last = pending.length - 1; await answer(last, suggestions);
  await click('Bar fictif · Ville fictive'); last = pending.length - 1;
  key = 'changed-during-details'; await act(async () => root.update(mount()));
  assert.equal(pending[last].signal.aborted, true);
  await answer(last, detail); assert.equal(adopted.length, 1, 'late Details cannot overwrite a changed card');
  assert(root.root.findAll(n => n.props.role === 'status').some(n => text(n).includes('sortie a changé')));
  console.log('PASS R5 Google: typing is not a decision; verified single-click admission; minimal identity; changed-card late response rejected. MOCK_PROVIDER_ONLY');
} finally { if (root) await act(async () => root.unmount()); }

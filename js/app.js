// Avata — showcase + outfit storage for the factory back office. Boot + router.
import { $, $$, toast } from './ui.js';
import { initData } from './store.js';
import { renderLookbook, renderImportLooks } from './looks.js';
import { renderStyles, renderStyleDetail, renderStyleEdit } from './styles-view.js';
import { renderModels, renderModelDetail, renderImportModel } from './models-view.js';
import { renderStudio } from './studio.js';
import { renderSettings, applyTheme } from './settings-view.js';
import { renderSpin } from './spin-view.js';
import { initUpdates } from './update.js';

// VERSION is stamped automatically by the pre-commit hook (.githooks/pre-commit). Do not edit by hand.
export const VERSION = '2026.10.18-104734-eb3faca';

const TITLES = { looks: 'Lookbook', 'import-looks': 'Import mockups', styles: 'Catalog', style: 'Style', 'style-edit': 'Style', models: 'Model Library', model: 'Model', 'import-model': 'Import model', studio: 'Prompt builder', spin: '360 spin', settings: 'Settings' };
const TAB_OF = { looks: 'looks', 'import-looks': 'looks', styles: 'styles', style: 'styles', 'style-edit': 'styles', models: 'models', model: 'models', 'import-model': 'models', studio: 'models', spin: 'spin', settings: 'settings' };

function route() {
  const raw = (location.hash || '#/looks').slice(2);
  const [path, query = ''] = raw.split('?');
  const [tab = 'looks', arg = ''] = path.split('/');
  const params = new URLSearchParams(query);
  const t = TITLES[tab] ? tab : 'looks';
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === TAB_OF[t]));
  // fresh container each route so per-view listeners never pile up
  const old = $('#view'); const v = old.cloneNode(false); old.replaceWith(v);
  $('#topTag').textContent = TITLES[t]; $('#topActions').innerHTML = '';
  if ($('#sheet').open) $('#sheet').close();
  scrollTo(0, 0);
  const id = decodeURIComponent(arg);
  ({ looks: () => renderLookbook(v), 'import-looks': () => renderImportLooks(v, params), styles: () => renderStyles(v), style: () => renderStyleDetail(v, id), 'style-edit': () => renderStyleEdit(v, id || 'new'),
    models: () => renderModels(v), model: () => renderModelDetail(id), 'import-model': () => renderImportModel(v), studio: () => renderStudio(v, params), spin: () => renderSpin(v, id), settings: () => renderSettings(v, VERSION) })[t]();
}

async function boot() {
  applyTheme();
  initUpdates(VERSION); // first, so a broken data load can never block a fix from arriving
  addEventListener('avata-db-blocked', () => toast('Close other open Avata tabs or windows to finish updating.', { ms: 10000 }));
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  $('#sheet').addEventListener('close', () => { $('#sheet').innerHTML = ''; });
  try { await initData(); } catch (e) { console.error(e); toast('Some starter content could not load (offline?).'); }
  addEventListener('hashchange', route);
  addEventListener('scroll', () => $('#top').classList.toggle('scrolled', scrollY > 4), { passive: true });
  route();
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}
boot();

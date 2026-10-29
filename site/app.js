import {schedule, counts, nextCard} from './scheduler.js';
import {organizeDecks} from './library.js';
import {setupStudyVideo} from './video.js';
const $ = id => document.getElementById(id);
const KEY = 'recall.progress.v1';
const showVideo = setupStudyVideo($('study'));
let data = {version:1, cards:{}, days:{}};
let decks = [], active = null, current = null, revealed = false, studied = 0;
const dayKey = () => new Date().toLocaleDateString('en-CA');
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved) {
    if (saved.version !== 1 || !saved.cards || !saved.days) throw new Error('Invalid data');
    data = saved;
  }
} catch { $('storage-status').textContent = 'Saved progress could not be loaded. New progress will stay in memory unless browser storage is available.'; }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch { $('storage-status').textContent = 'Browser storage is unavailable or full. Back up progress before closing this page.'; }
}
function element(tag, text, cls) {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if(cls) node.className=cls; return node;
}
// Library preferences travel with the existing local progress and backups.
function libraryPreferences() {
  data.library ||= {};
  if (!Array.isArray(data.library.pinned)) data.library.pinned = [];
  return data.library;
}
const libraryControls = element('div', undefined, 'library-controls');
const sortLabel = element('label', 'Organize by ');
const sortSelect = element('select');
sortSelect.id = 'deck-sort';
for (const [value, label] of [['difficulty','Hardest to remember'],['due','Most due cards'],['name','Deck name']]) {
  const option = element('option', label); option.value = value; sortSelect.append(option);
}
sortSelect.value = libraryPreferences().sort || 'difficulty';
sortLabel.append(sortSelect);
libraryControls.append(sortLabel, element('p', 'Pins stay first. Difficulty uses recent Again and Hard ratings from studied cards.', 'hint'));
$('decks').before(libraryControls);
$('decks').classList.remove('decks');
$('decks').classList.add('deck-library');
sortSelect.onchange = () => { libraryPreferences().sort = sortSelect.value; save(); dashboard(); };

function deckArticle(deck, status, pinned) {
  const article = element('article', undefined, 'deck');
  const heading = element('div', undefined, 'deck-heading');
  const icon = element('div', '▤', 'deck-icon'); icon.setAttribute('aria-hidden','true');
  const pin = element('button', pinned ? '★ Pinned' : '☆ Pin', 'pin-button');
  pin.setAttribute('aria-label', `${pinned ? 'Unpin' : 'Pin'} ${deck.name}`);
  pin.setAttribute('aria-pressed', String(pinned));
  pin.dataset.deckId = deck.id;
  pin.onclick = () => {
    const prefs = libraryPreferences();
    prefs.pinned = pinned ? prefs.pinned.filter(id => id !== deck.id) : [...prefs.pinned, deck.id];
    save(); dashboard();
    [...document.querySelectorAll('.pin-button')].find(button => button.dataset.deckId === deck.id)?.focus({preventScroll:true});
  };
  heading.append(icon, pin);
  article.append(heading, element('h3',deck.name),element('p',`${deck.cards.length} cards · ${deck.source || 'Repository deck'}`,'source'));
  if (status.difficulty > 0) article.append(element('p', `${status.difficultCards} studied card${status.difficultCards === 1 ? ' needs' : 's need'} practice · ${Math.round(status.difficulty * 100)}% difficulty`, 'difficulty-note'));
  const metrics = element('div', undefined, 'counts');
  for (const [label, number] of [['New',status.new],['Learning',status.learning],['Review',status.review]]) {
    const span = element('span');span.append(element('b',number),document.createTextNode(' '+label)); metrics.append(span);
  }
  const button = element('button', status.new + status.ready ? 'Study deck  →' : 'All caught up ✓', 'study-button');
  button.disabled = status.new + status.ready === 0;
  button.onclick = () => start(deck);
  article.append(metrics,button);
  if (button.disabled && status.learning) article.append(element('p','Learning cards return when due.','hint'));
  return article;
}
function dashboard() {
  const c = counts(decks.flatMap(d => d.cards), data.cards);
  $('due').textContent = c.review; $('learning').textContent = c.learning; $('new').textContent = c.new;
  $('today').textContent = data.days[dayKey()] || 0; $('deck-count').textContent = decks.length;
  const prefs = libraryPreferences();
  sortSelect.value = prefs.sort || 'difficulty';
  const query = $('search').value;
  const groups = organizeDecks(decks, data.cards, prefs, query);
  const sections = [];
  for (const [key, title] of [['pinned','Pinned'],['difficult','Needs practice'],['studied','Studied'],['unopened','Not started']]) {
    const items = groups[key];
    if (!items.length) continue;
    const section = element(key === 'unopened' ? 'details' : 'section', undefined, 'library-group');
    const heading = element(key === 'unopened' ? 'summary' : 'h3', `${title} (${items.length})`, 'library-group-title');
    section.append(heading);
    if (key === 'unopened') {
      section.open = Boolean(query.trim()) || Boolean(prefs.unopenedExpanded);
      section.ontoggle = () => {
        if (!section.isConnected || $('search').value.trim()) return;
        if (prefs.unopenedExpanded !== section.open) {prefs.unopenedExpanded = section.open;save();}
      };
    }
    const grid = element('div', undefined, 'decks');
    for (const {deck, status} of items) grid.append(deckArticle(deck, status, key === 'pinned'));
    section.append(grid); sections.push(section);
  }
  $('decks').replaceChildren(...sections);
  const total = Object.values(groups).reduce((sum, items) => sum + items.length, 0);
  $('message').textContent = !decks.length ? 'No decks yet. Add APKG files to the repository’s decks folder and rebuild.' : !total ? 'No decks match your search.' : '';
}
function start(deck) {
  active=deck; studied=0; $('dashboard').hidden=true; $('study').hidden=false;
  $('study-deck').textContent=deck.name; showVideo(deck); showNext();
}
function documentFor(card, answer) {
  // A unique sandbox origin, no scripts, no forms, no external network, and no top navigation.
  const base = new URL('.',location.href).href;
  const policy = "default-src 'none'; img-src " + location.origin + " data:; media-src " + location.origin + "; style-src 'unsafe-inline'; font-src 'none';";
  const text = answer ? card.back : card.front;
  return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+policy+'"><base href="'+base+'"><style>body{font:20px/1.6 system-ui;color:#293f33;padding:12px;text-align:center;overflow-wrap:anywhere}img{max-width:100%;height:auto}audio{max-width:100%}h2{font-size:25px}.card{font-size:20px}'+(card.css || '')+'</style></head><body class="card">'+text+'</body></html>';
}
function showNext() {
  current=nextCard(active.cards,data.cards);revealed=false;
  $('session-count').textContent = `${studied} studied this session`;
  if (!current) {
    $('study-title').textContent = 'A little further along.';
    $('card-label').textContent = 'SESSION COMPLETE';
    const future = active.cards.map(c => data.cards[c.id]?.due).filter(n => n > Date.now());
    const note = future.length ? `Next review: ${new Date(Math.min(...future)).toLocaleString()}.` : 'Your deck is complete for now.';
    $('card').srcdoc = documentFor({front:`<h2>All caught up ✓</h2><p>${studied} cards studied.</p><p>${note}</p>`},false);
    $('reveal-wrap').hidden=true; $('ratings').hidden=true; return;
  }
  $('study-title').textContent='Time to remember.';
  $('card-label').textContent='QUESTION';
  $('card').srcdoc=documentFor(current,false);
  $('reveal-wrap').hidden=false;$('ratings').hidden=true;
  for (const rating of ['good','easy']) {
    const s=schedule(data.cards[current.id],rating);
    $(rating+'-interval').textContent=`${s.interval} day${s.interval===1?'':'s'} · ${rating==='good'?3:4}`;
  }
  $('reveal').focus({preventScroll:true});
}
function reveal() {
  if (!current || revealed) return;
  revealed=true; $('card-label').textContent='ANSWER'; $('card').srcdoc=documentFor(current,true);
  $('reveal-wrap').hidden=true; $('ratings').hidden=false;
  document.querySelector('[data-rating="good"]').focus({preventScroll:true});
}
function rate(rating) {
  if (!current || !revealed) return;
  data.cards[current.id]=schedule(data.cards[current.id],rating);
  data.days[dayKey()]=(data.days[dayKey()]||0)+1;
  studied++;save();showNext();
}
$('reveal').onclick=reveal;
$('exit').onclick=()=>{showVideo(null);active=null;current=null;$('study').hidden=true;$('dashboard').hidden=false;dashboard();};
$('search').oninput=dashboard;
document.querySelectorAll('[data-rating]').forEach(b=>b.onclick=()=>rate(b.dataset.rating));
document.addEventListener('keydown',e=>{
  if (!active || ['INPUT','TEXTAREA'].includes(e.target.tagName) || e.repeat) return;
  if (e.code==='Space') {e.preventDefault();reveal();}
  if (revealed && ['1','2','3','4'].includes(e.key)) {e.preventDefault();rate(['again','hard','good','easy'][Number(e.key)-1]);}
});
$('export').onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=element('a');a.href=url;a.download='recall-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
// Merge progress from another tab before displaying or recording another session.
window.addEventListener('storage',e=>{
  if(e.key!==KEY || !e.newValue)return;
  try {const saved=JSON.parse(e.newValue);if(saved.version===1 && saved.cards && saved.days){data=saved;if(!active)dashboard();}}catch{}
});
setInterval(()=>{if(!active){if(!$('decks').contains(document.activeElement))dashboard();}else if(!current)showNext();},30000);
try {
  const response=await fetch('data/catalog.json',{cache:'no-cache'});
  if(!response.ok)throw new Error('Catalog unavailable');
  decks=await response.json();dashboard();
} catch {
  $('message').textContent='Could not load the deck catalog. Run the build script, serve the site over HTTP, and try again.';
}

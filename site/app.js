import {schedule, counts, nextCard} from './scheduler.js';
const $ = id => document.getElementById(id);
const KEY = 'recall.progress.v1';
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
function dashboard() {
  const c = counts(decks.flatMap(d => d.cards), data.cards);
  $('due').textContent = c.review; $('learning').textContent = c.learning; $('new').textContent = c.new;
  $('today').textContent = data.days[dayKey()] || 0; $('deck-count').textContent = decks.length;
  $('decks').replaceChildren();
  const query = $('search').value.toLowerCase();
  const visible = decks.filter(d => d.name.toLowerCase().includes(query));
  for (const deck of visible) {
    const count = counts(deck.cards, data.cards);
    const article = element('article', undefined, 'deck');
    const icon = element('div', '▤', 'deck-icon'); icon.setAttribute('aria-hidden','true');
    article.append(icon, element('h3',deck.name),element('p',`${deck.cards.length} cards · ${deck.source || 'Repository deck'}`,'source'));
    const metrics = element('div', undefined, 'counts');
    for (const [label, number] of [['New',count.new],['Learning',count.learning],['Review',count.review]]) {
      const span = element('span');span.append(element('b',number),document.createTextNode(' '+label)); metrics.append(span);
    }
    const button = element('button', count.new + count.ready ? 'Study deck  →' : 'All caught up ✓');
    button.disabled = count.new + count.ready === 0;
    button.onclick = () => start(deck);
    article.append(metrics,button);
    if (button.disabled && count.learning) article.append(element('p','Learning cards return when due.','hint'));
    $('decks').append(article);
  }
  $('message').textContent = !decks.length ? 'No decks yet. Add APKG files to the repository’s decks folder and rebuild.' : !visible.length ? 'No decks match your search.' : '';
}
function start(deck) {
  active=deck; studied=0; $('dashboard').hidden=true; $('study').hidden=false;
  $('study-deck').textContent=deck.name; showNext();
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
$('exit').onclick=()=>{active=null;current=null;$('study').hidden=true;$('dashboard').hidden=false;dashboard();};
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
setInterval(()=>{if(!active)dashboard();else if(!current)showNext();},30000);
try {
  const response=await fetch('data/catalog.json',{cache:'no-cache'});
  if(!response.ok)throw new Error('Catalog unavailable');
  decks=await response.json();dashboard();
} catch {
  $('message').textContent='Could not load the deck catalog. Run the build script, serve the site over HTTP, and try again.';
}

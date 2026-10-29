import {counts} from './scheduler.js';

export function deckStatus(deck, progress, now = Date.now()) {
  const studied = deck.cards.map(card => progress[card.id]).filter(Boolean);
  // Older progress has no rating history: learning is the available indication
  // that a card was previously rated Again or Hard.
  const scores = studied.map(p => {
    if (!p.ratings?.length) return p.state === 'learning' ? 1 : 0;
    return p.ratings.reduce((sum, rating) => sum + (rating === 'again' ? 1 : rating === 'hard' ? 0.7 : 0), 0) / p.ratings.length;
  });
  return {
    started: studied.length > 0,
    difficulty: scores.length ? scores.reduce((a,b) => a+b, 0) / scores.length : 0,
    difficultCards: scores.filter(score => score > 0).length,
    ...counts(deck.cards, progress, now)
  };
}

export function organizeDecks(decks, progress, preferences = {}, query = '', now = Date.now()) {
  const pinned = new Set(preferences.pinned || []);
  const groups = {pinned: [], difficult: [], studied: [], unopened: []};
  for (const deck of decks) {
    if (!deck.name.toLowerCase().includes(query.trim().toLowerCase())) continue;
    const item = {deck, status: deckStatus(deck, progress, now)};
    const group = pinned.has(deck.id) ? 'pinned' : !item.status.started ? 'unopened' : item.status.difficulty > 0 ? 'difficult' : 'studied';
    groups[group].push(item);
  }
  const byName = (a,b) => a.deck.name.localeCompare(b.deck.name, undefined, {numeric:true});
  const compare = (a,b) => {
    if (preferences.sort === 'name') return byName(a,b);
    if (preferences.sort === 'due') return b.status.ready - a.status.ready || b.status.difficulty - a.status.difficulty || byName(a,b);
    return b.status.difficulty - a.status.difficulty || b.status.ready - a.status.ready || byName(a,b);
  };
  for (const [name, items] of Object.entries(groups)) items.sort(name === 'unopened' ? byName : compare);
  return groups;
}

export const DAY = 86400000;
export function schedule(previous, rating, now = Date.now()) {
  const old = previous || {state: 'new', interval: 0};
  if (!['again', 'hard', 'good', 'easy'].includes(rating)) throw new Error('Invalid rating');
  if (rating === 'again' || rating === 'hard') {
    return {state: 'learning', interval: 0, due: now + (rating === 'again' ? 60000 : 360000), reviews: (old.reviews || 0) + 1};
  }
  const interval = rating === 'easy' ? Math.max(4, Math.round(old.interval * 3)) : Math.max(1, Math.round(old.interval * 2.5));
  return {state: 'review', interval, due: now + interval * DAY, reviews: (old.reviews || 0) + 1};
}
export function counts(cards, progress, now = Date.now()) {
  return cards.reduce((out, card) => {
    const p = progress[card.id];
    if (!p) out.new++;
    else if (p.state === 'learning') { out.learning++; if (p.due <= now) out.ready++; }
    else if (p.due <= now) {out.review++; out.ready++;}
    return out;
  }, {new: 0, learning: 0, review: 0, ready: 0});
}
export function nextCard(cards, progress, now = Date.now()) {
  return cards.filter(c => progress[c.id]?.due <= now).sort((a,b) => progress[a.id].due - progress[b.id].due)[0]
    || cards.find(c => !progress[c.id]);
}

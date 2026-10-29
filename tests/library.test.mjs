import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deckStatus, organizeDecks} from '../site/library.js';
import {schedule} from '../site/scheduler.js';
const deck = (id, cards=[id]) => ({id,name:`Day ${id}`,cards:cards.map(id=>({id}))});
test('pins override difficulty and unopened grouping',()=>{
  const groups=organizeDecks([deck('1'),deck('2'),deck('3'),deck('4')],{'2':{state:'learning'},'3':{state:'review'}},{pinned:['1']});
  assert.deepEqual(groups.pinned.map(i=>i.deck.id),['1']);
  assert.deepEqual(groups.difficult.map(i=>i.deck.id),['2']);
  assert.deepEqual(groups.studied.map(i=>i.deck.id),['3']);
  assert.deepEqual(groups.unopened.map(i=>i.deck.id),['4']);
});
test('difficulty uses studied cards only and Again outweighs Hard',()=>{
  const progress={a:{ratings:['again'],state:'learning'},b:{ratings:['hard'],state:'learning'}};
  const groups=organizeDecks([deck('hard',['b']),deck('again',['a','unseen'])],progress);
  assert.deepEqual(groups.difficult.map(i=>i.deck.id),['again','hard']);
  assert.equal(groups.difficult[0].status.difficulty,1);
});
test('recent successful recalls reduce difficulty and history stays bounded',()=>{
  let p=schedule(null,'hard',0);
  p=schedule(p,'good',0);
  assert.equal(deckStatus(deck('1'),{'1':p}).difficulty,.35);
  for(let i=0;i<10;i++) p=schedule(p,'good',0);
  assert.equal(p.ratings.length,10);
  assert.equal(deckStatus(deck('1'),{'1':p}).difficulty,0);
});
test('due sorting, numeric names, search and unpinning preserve groups',()=>{
  const decks=[deck('10'),deck('2'),deck('1')];
  const progress={'1':{state:'review',due:100},'2':{state:'review',due:200}};
  assert.deepEqual(organizeDecks(decks,progress,{sort:'name'}).studied.map(i=>i.deck.id),['1','2']);
  assert.deepEqual(organizeDecks(decks,progress,{sort:'due'},'',150).studied.map(i=>i.deck.id),['1','2']);
  assert.equal(organizeDecks(decks,progress,{},'day 10').unopened.length,1);
  assert.equal(organizeDecks(decks,progress,{pinned:[]}).unopened[0].deck.id,'10');
});

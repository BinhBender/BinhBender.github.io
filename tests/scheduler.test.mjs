import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schedule, nextCard, counts, DAY} from '../site/scheduler.js';
test('new cards graduate and lapses return to learning',()=>{
  const good=schedule(null,'good',1000);assert.equal(good.due,1000+DAY);assert.equal(good.state,'review');
  assert.equal(schedule(good,'good',1000).interval,3);
  const lapse=schedule(good,'again',1000);assert.equal(lapse.state,'learning');assert.equal(lapse.due,61000);
  assert.equal(schedule(null,'easy',1000).interval,4);
});
test('due cards precede new cards and future cards are withheld',()=>{
  const cards=[{id:'new'},{id:'future'},{id:'due'}];
  const progress={future:{state:'review',due:2000},due:{state:'learning',due:900}};
  assert.equal(nextCard(cards,progress,1000).id,'due');
  assert.equal(nextCard(cards.slice(0,2),progress,1000).id,'new');
  assert.equal(nextCard([cards[1]],progress,1000),undefined);
  assert.deepEqual(counts(cards,progress,1000),{new:1,learning:1,review:0,ready:1});
});

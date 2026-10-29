import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../site/theme.js',import.meta.url),'utf8');
function browser({readyState='loading',saved=null,legacy=false,storageBlocked=false}={}) {
  const events={},elements={},stored=new Map(saved ? [['recall.theme.v1',saved]] : []);
  const node=()=>({children:[],attrs:{},handlers:{},append(...nodes){this.children.push(...nodes);for(const n of nodes)if(n.id)elements[n.id]=n;},setAttribute(key,value){this.attrs[key]=value;},addEventListener(key,handler){this.handlers[key]=handler;}});
  const header=node();header.querySelector=()=>null;
  const document={readyState,documentElement:{dataset:{}},getElementById:id=>elements[id],querySelector:()=>header,createElement:node,addEventListener:(name,fn)=>{events[name]=fn;}};
  const media={matches:false};media[legacy?'addListener':'addEventListener']=()=>{};
  const window={matchMedia:()=>media,addEventListener:(name,fn)=>{events[name]=fn;},dispatchEvent:()=>{}};
  runInNewContext(source,{document,window,Event:class{},localStorage:{getItem:key=>{if(storageBlocked)throw Error();return stored.get(key);},setItem:(key,value)=>{if(storageBlocked)throw Error();stored.set(key,value);}}});
  return {document,elements,stored,events};
}
test('toggles both directions, updates label, and saves preference',()=>{
  const b=browser();b.events.DOMContentLoaded();
  const button=b.elements['theme-toggle'];assert.equal(button.textContent,'Switch to dark');
  button.handlers.click();assert.equal(b.document.documentElement.dataset.theme,'dark');assert.equal(button.textContent,'Switch to light');assert.equal(b.stored.get('recall.theme.v1'),'dark');
  button.handlers.click();assert.equal(b.document.documentElement.dataset.theme,'light');assert.equal(button.attrs['aria-pressed'],'false');
});
test('initializes when loaded late, restores preference, and supports older browsers',()=>{
  const b=browser({readyState:'complete',saved:'dark',legacy:true});assert.equal(b.elements['theme-toggle'].textContent,'Switch to light');
  b.elements['theme-toggle'].handlers.click();assert.equal(b.document.documentElement.dataset.theme,'light');
});
test('blocked storage does not prevent toggling',()=>{
  const b=browser({readyState:'complete',storageBlocked:true});b.elements['theme-toggle'].handlers.click();assert.equal(b.document.documentElement.dataset.theme,'dark');
});

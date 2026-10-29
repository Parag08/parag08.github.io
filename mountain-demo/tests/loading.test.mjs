import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const controller=readFileSync(new URL('../../journey-loader.js',import.meta.url),'utf8');
const shared=readFileSync(new URL('../../script.js',import.meta.url),'utf8');
class Element {
  constructor() {
    this.events=new Map(); this.dataset={}; this.attrs={}; this.inert=false;
    this.classes=new Set(); this.classList={add:name=>this.classes.add(name)};
    this.children=new Map(); this.hidden=false; this.isConnected=true;
  }
  querySelector(selector) { return this.children.get(selector)||null; }
  querySelectorAll() { return []; }
  addEventListener(name,callback) { this.events.set(name,callback); }
  removeEventListener(name,callback) { if(this.events.get(name)===callback) this.events.delete(name); }
  emit(name) { this.events.get(name)?.({preventDefault(){}}); }
  setAttribute(name,value) { this.attrs[name]=value; }
  hasAttribute(name) { return name in this.attrs; }
  remove() { this.isConnected=false; }
}
function setup({reduced=false,state='loading',seen=true,journey=true}={}) {
  const root=new Element(),document=new Element(),loader=new Element(),scene=new Element();
  const main=new Element(),nav=new Element(),menu=new Element(),footer=new Element(),module=new Element();
  const percent=new Element(),label=new Element(),skip=new Element(),status=new Element();
  menu.inert=true; skip.hidden=true;
  if(journey) loader.attrs['data-journey-loader']='';
  loader.children.set('.loader-pct',percent); loader.children.set('[data-loader-status]',label); loader.children.set('[data-loader-continue]',skip);
  scene.dataset={sceneState:state,loadProgress:'5',loadLabel:'Preparing the mountain…'};
  scene.children.set('[data-descent-state]',status);
  const selectors=new Map([['[data-journey-loader]',journey?loader:null],['.loader',loader],['.loader-pct',percent],['.descent',scene],['script[data-journey-module]',module],['main',main]]);
  document.documentElement=root;
  document.querySelector=selector=>selectors.get(selector)||null;
  document.querySelectorAll=()=>[main,nav,menu,footer];
  main.focus=()=> { document.activeElement=main; };
  const timers=new Map(); let now=0,id=0;
  const window={
    matchMedia:()=>({matches:reduced}),
    setTimeout(fn,delay){ timers.set(++id,{fn,at:now+delay}); return id; },
    clearTimeout(id){ timers.delete(id); },
    addEventListener(){},
  };
  const context=vm.createContext({document,window,sessionStorage:{getItem:()=>seen?'1':null,setItem(){}},Promise});
  function advance(ms) {
    const until=now+ms;
    while(true) {
      const next=[...timers].filter(([,timer])=>timer.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next) break;
      now=next[1].at; timers.delete(next[0]); next[1].fn();
    }
    now=until;
  }
  vm.runInContext(controller,context);
  return {root,document,loader,scene,main,nav,menu,footer,module,percent,label,skip,status,advance,context};
}

test('the loader outlasts the old time limits and repeat-visit shortcut until the scene is ready',()=> {
  for(const reduced of [false,true]) {
    const page=setup({reduced,seen:true});
    // Run the real shared preloader too: its 350ms/2s safeguards must not release this loader.
    const preloader=shared.slice(0,shared.indexOf('  const menu ='))+'\n})();';
    vm.runInContext(preloader,page.context);
    page.advance(2500);
    assert.equal(page.loader.isConnected,true);
    assert.equal(page.root.classes.has('is-ready'),false);
    assert.equal(page.main.inert,true);
    assert.equal(page.main.attrs['aria-busy'],'true');
    page.scene.dataset.sceneState='ready'; page.document.emit('journey:ready');
    assert.equal(page.root.classes.has('is-ready'),true);
    assert.equal(page.percent.textContent,'100%');
    assert.equal(page.main.inert,false);
    assert.equal(page.main.attrs['aria-busy'],'false');
    assert.equal(page.menu.inert,true,'the mobile menu retains its original inert state');
    page.advance(400); assert.equal(page.loader.isConnected,false);
  }
});

test('model progress is monotonic and cannot claim completion before the first frame',()=> {
  const page=setup();
  page.scene.dataset.loadProgress='65'; page.document.emit('journey:progress');
  assert.equal(page.percent.textContent,'65%');
  page.scene.dataset.loadProgress='20'; page.document.emit('journey:progress');
  assert.equal(page.percent.textContent,'65%');
  page.scene.dataset.loadProgress='100'; page.document.emit('journey:progress');
  assert.equal(page.percent.textContent,'99%');
  assert.equal(page.root.classes.has('is-ready'),false);
});

test('a cached scene that was already drawn releases the loader immediately',()=> {
  const page=setup({state:'ready',reduced:true});
  assert.equal(page.loader.isConnected,false);
  assert.equal(page.percent.textContent,'100%');
  assert.equal(page.main.inert,false);
});

test('a failed model or renderer releases the page without waiting for a timeout',()=> {
  const page=setup();
  page.scene.dataset.sceneState='error'; page.document.emit('journey:error');
  assert.equal(page.root.classes.has('is-ready'),true);
  assert.equal(page.main.inert,false);
  page.advance(400); assert.equal(page.loader.isConnected,false);
});

test('a failed scene import also releases the page and reports an unavailable mountain view',()=> {
  const page=setup();
  page.module.emit('error');
  assert.equal(page.scene.dataset.sceneState,'error');
  assert.equal(page.status.textContent,'Mountain view unavailable');
  assert.equal(page.main.inert,false);
  page.advance(400); assert.equal(page.loader.isConnected,false);
});

test('a slow connection keeps loading until the visitor explicitly continues',()=> {
  const page=setup();
  page.advance(7999); assert.equal(page.skip.hidden,true);
  page.advance(1); assert.equal(page.skip.hidden,false);
  page.advance(60000); assert.equal(page.root.classes.has('is-ready'),false);
  page.document.activeElement=page.skip; page.skip.emit('click');
  assert.equal(page.root.classes.has('is-ready'),true);
  assert.equal(page.document.activeElement,page.main);
  page.advance(400); assert.equal(page.loader.isConnected,false);
  // Late loading events are harmless after the visitor has continued.
  page.document.emit('journey:ready'); assert.equal(page.main.inert,false);
});


test('the previous homepage retains its quick repeat-visit and reduced-motion loader behavior',()=> {
  for(const reduced of [false,true]) {
    const page=setup({journey:false,reduced,seen:true});
    const preloader=shared.slice(0,shared.indexOf('  const menu ='))+'\n})();';
    vm.runInContext(preloader,page.context);
    assert.equal(page.loader.isConnected,false);
    assert.equal(page.root.classes.has('is-ready'),true);
    assert.equal(page.main.inert,false);
  }
});

(() => {
  const loader=document.querySelector('[data-journey-loader]');
  if(!loader) return;
  const root=document.documentElement;
  const scene=document.querySelector('.descent');
  const percent=loader.querySelector('.loader-pct');
  const greeting=loader.querySelector('[data-loader-greeting]');
  const greetings=[['Hello','en'],['नमस्ते','hi'],['你好','zh-SG']];
  const label=loader.querySelector('[data-loader-status]');
  const skip=loader.querySelector('[data-loader-continue]');
  const module=document.querySelector('script[data-journey-module]');
  const main=document.querySelector('main');
  const regions=[...document.querySelectorAll('body > .skip-link, body > header, body > .mobile-menu, main, footer')];
  const previousInert=regions.map(region=>region.inert);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let finished=false,value=0,greetingIndex=0,greetingTimer=null;
  regions.forEach(region=> { region.inert=true; });
  main?.setAttribute('aria-busy','true');

  function cycleGreeting() {
    if(finished||!greeting) return;
    greetingIndex=(greetingIndex+1)%greetings.length;
    const [text,language]=greetings[greetingIndex];
    greeting.textContent=text;
    greeting.lang=language;
    greetingTimer=window.setTimeout(cycleGreeting,900);
  }
  function progress() {
    if(finished) return;
    value=Math.max(value,Math.min(99,Number(scene?.dataset.loadProgress)||0));
    if(percent) percent.textContent=`${Math.round(value)}%`;
    if(label&&scene?.dataset.loadLabel) label.textContent=scene.dataset.loadLabel;
  }
  function preventScroll(event) { event.preventDefault(); }
  function finish() {
    if(finished) return;
    finished=true;
    window.clearTimeout(slowTimer);
    window.clearTimeout(greetingTimer);
    document.removeEventListener('journey:progress',progress);
    document.removeEventListener('journey:ready',finish);
    document.removeEventListener('journey:error',finish);
    module?.removeEventListener('error',moduleFailed);
    loader.removeEventListener('wheel',preventScroll);
    loader.removeEventListener('touchmove',preventScroll);
    regions.forEach((region,i)=> { region.inert=previousInert[i]; });
    main?.setAttribute('aria-busy','false');
    const usedSkip=document.activeElement===skip;
    if(percent) percent.textContent=scene?.dataset.sceneState==='ready'?'100%':'—';
    if(label) label.textContent=scene?.dataset.sceneState==='ready'?'Ready to explore':'The journey is ready to read';
    root.classList.add('is-ready');
    loader.classList.add('done');
    if(usedSkip) main?.focus({preventScroll:true});
    if(reduced) loader.remove();
    else window.setTimeout(()=>loader.remove(),400);
  }
  function moduleFailed() {
    if(scene) {
      scene.dataset.sceneState='error';
      const status=scene.querySelector('[data-descent-state]');
      if(status) status.textContent='Mountain view unavailable';
      scene.querySelectorAll('button').forEach(button=> { button.hidden=true; });
    }
    finish();
  }
  // Slow connections may keep loading; visitors can still choose to read ahead.
  const slowTimer=window.setTimeout(()=> { if(!finished&&skip) skip.hidden=false; },8000);
  skip?.addEventListener('click',finish,{once:true});
  loader.addEventListener('wheel',preventScroll,{passive:false});
  loader.addEventListener('touchmove',preventScroll,{passive:false});
  document.addEventListener('journey:progress',progress);
  document.addEventListener('journey:ready',finish);
  document.addEventListener('journey:error',finish);
  module?.addEventListener('error',moduleFailed,{once:true});
  if(greeting) greetingTimer=window.setTimeout(cycleGreeting,900);
  progress();
  // A cached scene may finish before this deferred controller executes.
  if(scene?.dataset.sceneState==='ready'||scene?.dataset.sceneState==='error') finish();
})();

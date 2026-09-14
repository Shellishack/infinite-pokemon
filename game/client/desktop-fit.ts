// The desktop shell embeds the game. Fit its entire play surface, not just the
// canvas, so the title menu, objective and controls remain in view together.
export function installDesktopFit(root:HTMLElement){
  if(window.parent===window)return;
  document.documentElement.classList.add('desktop-game');
  window.addEventListener('keydown',event=>{
    if(event.repeat||event.ctrlKey||event.altKey||event.metaKey)return;
    const action=event.key==='F11'?'fullscreen':undefined;
    if(action){event.preventDefault();event.stopImmediatePropagation();window.parent.postMessage({type:'infinite-game-window',action},'*');}
  },true);
  let queued=0,observed:Element|null=null;
  const schedule=()=>{if(!queued)queued=requestAnimationFrame(fit);};
  const resize=new ResizeObserver(schedule);
  function fit(){
    queued=0;
    const surface=root.querySelector<HTMLElement>('.console-shell');
    if(!surface)return;
    if(observed!==surface){if(observed)resize.unobserve(observed);observed=surface;resize.observe(surface);}
    const width=Math.min(1024,window.innerWidth);
    root.style.width=`${width}px`;
    const height=surface.offsetHeight+24;
    const scale=Math.min(1,window.innerWidth/width,window.innerHeight/height);
    root.style.height=`${height}px`;
    root.style.setProperty('--desktop-height',`${height}px`);
    root.style.transform=`scale(${scale})`;
    root.style.left=`${Math.max(0,(window.innerWidth-width*scale)/2)}px`;
    root.style.top=`${Math.max(0,(window.innerHeight-height*scale)/2)}px`;
  }
  const mutations=new MutationObserver(schedule);
  mutations.observe(root,{childList:true,subtree:true,characterData:true});
  window.addEventListener('resize',schedule);
  void document.fonts.ready.then(schedule);
  schedule();
}

const frame = document.querySelector('#game'), boot = document.querySelector('.boot');
const status = document.querySelector('#status'), retry = document.querySelector('#retry');
const power = document.querySelector('#power-label');
let currentURL, phase;
function update(state) {
  if (!state) return;
  if(typeof state.fullscreen==='boolean')updateWindow(state);
  phase = state.phase;
  status.textContent = state.message;
  document.body.dataset.phase = phase;
  retry.hidden = phase !== 'error';
  if (phase === 'error' || phase === 'starting') { boot.hidden = false; frame.hidden = true; }
  power.textContent = phase === 'error' ? 'Needs attention' : 'Starting up';
  if (state.url && (state.url !== currentURL || phase === 'loading')) {
    currentURL = state.url;
    frame.src = currentURL;
  }
}
frame.addEventListener('load', () => {
  if (!currentURL || phase === 'error' || frame.src === 'about:blank') return;
  boot.hidden = true; frame.hidden = false;
  document.body.dataset.phase = 'ready'; power.textContent = 'Ready to play';
  frame.focus();
  frame.contentWindow?.postMessage({type:'infinite-desktop-fullscreen',fullscreen:document.body.classList.contains('fullscreen')},'*');
});
document.querySelectorAll('[data-control]').forEach(button => button.addEventListener('click', () => window.desktop.control(button.dataset.control)));
document.querySelector('.titlebar').addEventListener('dblclick', event => { if (!event.target.closest('button')) window.desktop.control('maximize'); });
retry.addEventListener('click', () => window.desktop.control('retry'));
window.desktop.onState(update);
function updateWindow({maximized,fullscreen}) {
  const button = document.querySelector('[data-control="maximize"]');
  button.setAttribute('aria-label', maximized ? 'Restore window' : 'Maximize window');
  button.title = maximized ? 'Restore' : 'Maximize';
  document.body.classList.toggle('maximized', maximized);
  document.body.classList.toggle('fullscreen', fullscreen);
  frame.contentWindow?.postMessage({type:'infinite-desktop-fullscreen',fullscreen},'*');
}
window.desktop.onWindow(updateWindow);
window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.data?.type!=='infinite-game-window')return;
  if(['fullscreen','exit-fullscreen'].includes(event.data.action))window.desktop.control(event.data.action);
});
window.addEventListener('keydown',event=>{
  if(event.repeat||event.ctrlKey||event.altKey||event.metaKey)return;
  if(event.key==='F11'){event.preventDefault();window.desktop.control('fullscreen');}
});
window.desktop.state().then(update);

// Non-sensitive audio preferences follow the player between local run ports.
window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow)return;
  if(event.data?.type==='ita-music-settings-get'){try{const settings=JSON.parse(localStorage.getItem('infinite-tamer-music-v1')??'null');if(settings)frame.contentWindow?.postMessage({type:'ita-music-settings',settings},'*');}catch{}}
  if(event.data?.type==='ita-music-settings-set'){const value=event.data.settings;if(value&&typeof value.enabled==='boolean'&&Number.isFinite(value.volume)&&value.volume>=0&&value.volume<=1&&(value.sfxEnabled===undefined||typeof value.sfxEnabled==='boolean')&&(value.sfxVolume===undefined||Number.isFinite(value.sfxVolume)&&value.sfxVolume>=0&&value.sfxVolume<=1)){try{localStorage.setItem('infinite-tamer-music-v1',JSON.stringify({enabled:value.enabled,volume:value.volume,sfxEnabled:value.sfxEnabled??true,sfxVolume:value.sfxVolume??.5}));}catch{}}}
});

import {sessionCardTitle} from './session-card';
import {providerVisual,sessionRuntime} from './session-runtime';
import {GhosttyTerminalSurface} from './ghostty/surface';
import {ghosttyTheme} from './ghostty-theme';
import {terminalKeyDecision} from './terminal-keys';
import type {TerminalInfo} from './terminals';
import {pages,nativeCommands,filterCommands,type Command} from './commands';
import {pageIcon} from './page-icons';
import {openTerminalLink} from './terminal-links';
import {TerminalOutput} from './terminal-output';
import {copyTerminalSelection} from './terminal-copy';
import {selectionAfterRefresh} from './session-selection';
import {backgroundColor,isBackgroundImageURL,type BackgroundImage} from './background-image';
// Linux: every shortcut shown names the Linux key (linux.ts), in the fixed HTML labels and in the command menu.
import {isLinux,linuxShortcutLabel,linuxTerminalSwallows} from './linux';
const LINUX=isLinux(navigator.platform);
const keyLabel=(text:string)=>LINUX?linuxShortcutLabel(text):text;
if(LINUX){
  document.documentElement.classList.add('linux-keys');
  document.querySelectorAll('kbd').forEach(k=>{k.textContent=keyLabel(k.textContent||'');});
  document.querySelectorAll<HTMLElement>('[title]').forEach(el=>{el.title=keyLabel(el.title);});
}
declare global{interface Window{pulseDesktop:{call:(action:string,args?:unknown)=>Promise<any>;input:(id:string,data:string)=>void;ack:(id:string,length:number)=>void;resize:(id:string,cols:number,rows:number)=>void;on:(name:string,cb:(data:any)=>void)=>()=>void}}}
const api=window.pulseDesktop;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let sessions:TerminalInfo[]=[];
let selected=localStorage.getItem('selected')||'/';
let appearance={font:'Menlo',fontSize:18.67,theme:{} as Record<string,string>,cursorBlink:false,background:undefined as BackgroundImage|undefined,optionAsMeta:false};
// Kitty tints the image with the background color at alpha = background_tint in linear light. The backdrop element
// carries the image through an SVG filter that composites in linearRGB, and the terminal pane goes fully transparent
// over it, the way kitty skips default-background cells when an image is set.
function backgroundImage(){const bg=appearance.background;return bg&&isBackgroundImageURL(bg.url)?bg:undefined;}
function paneTheme(){return ghosttyTheme(appearance.theme);}
let appearanceSignature='';
function applyAppearance(){
  // refreshNow runs every second; only touch the DOM and re-theme the panes when the kitty settings actually changed.
  const signature=JSON.stringify([appearance.theme,appearance.background]);
  if(signature===appearanceSignature)return;appearanceSignature=signature;
  const root=document.documentElement,bg=backgroundImage(),color=backgroundColor(appearance.theme.background);
  root.classList.toggle('has-image',!!bg);
  root.style.setProperty('--terminal-background',bg?'transparent':color);
  root.style.setProperty('--window-background',color);
  root.style.setProperty('--window-image',bg?`url("${bg.url}")`:'none');
  root.style.setProperty('--window-image-size',bg?bg.layout.size:'auto');
  root.style.setProperty('--window-image-repeat',bg?bg.layout.repeat:'no-repeat');
  root.style.setProperty('--window-image-position',bg?bg.layout.position:'center');
  const flood=document.getElementById('kitty-tint-color');
  if(flood){flood.setAttribute('flood-color',color);flood.setAttribute('flood-opacity',String(bg?bg.tint:1));}
  $('backdrop').hidden=!bg;
  const {theme,palette}=paneTheme();
  for(const p of panes.values())p.ready.then(s=>{s.setTheme(theme);s.setPalette(palette);s.setTransparentBackground(!!bg);s.setOptionAsAlt(appearance.optionAsMeta);}).catch(()=>{});
}
let lastList='';
let switching=0;
let renameTarget='';
let zoom=Number(localStorage.getItem('terminalZoomDelta'))||0;
let refreshQueue=Promise.resolve();
type Pane={surface:GhosttyTerminalSurface|null;ready:Promise<GhosttyTerminalSurface>;node:HTMLDivElement;attached:boolean;output:TerminalOutput};
const panes=new Map<string,Pane>()
const terminalFont=()=>({family:'PulseTerminal',size:appearance.fontSize+zoom});
function notice(error:unknown){$('notice').textContent=String(error).replace(/^Error: Error invoking remote method '[^']+': Error: /,'');$('notice').hidden=false;setTimeout(()=>$('notice').hidden=true,7000);}
const attempt=(fn:()=>Promise<unknown>)=>void fn().catch(notice);
function button(label:string,action:()=>void){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action;return b;}
pages.forEach(p=>{const b=button('',()=>attempt(()=>select(p.id)));b.dataset.id=p.id;b.append(pageIcon(p.id),Object.assign(document.createElement('span'),{textContent:p.title}),Object.assign(document.createElement('kbd'),{textContent:p.shortcut||''}));$('pages').append(b);});
// Linux: the page buttons' shortcut labels.
if(LINUX)$('pages').querySelectorAll('kbd').forEach(k=>{k.textContent=keyLabel(k.textContent||'');});
$('pages-back').onclick=()=>$('pages').scrollBy({left:-Math.max(240,$('pages').clientWidth*.7),behavior:'instant'});
$('pages-next').onclick=()=>$('pages').scrollBy({left:Math.max(240,$('pages').clientWidth*.7),behavior:'instant'});
function pageScrollState(){$<HTMLButtonElement>('pages-back').disabled=$('pages').scrollLeft<1;$<HTMLButtonElement>('pages-next').disabled=$('pages').scrollLeft+$('pages').clientWidth>=$('pages').scrollWidth-1;}
$('pages').addEventListener('scroll',pageScrollState);new ResizeObserver(pageScrollState).observe($('pages'));
function mark(){document.querySelectorAll<HTMLButtonElement>('[data-id]').forEach(b=>{b.classList.toggle('active',b.dataset.id===selected);b.setAttribute('aria-current',b.dataset.id===selected?'page':'false');});}
function terminal(id:string):Pane{
  let pane=panes.get(id);if(pane)return pane;
  const node=document.createElement('div');node.className='terminal-pane';node.dataset.terminal=id;$('terminal-host').append(node);
  const {theme,palette}=paneTheme();
  // libghostty-vt (wasm) parses the stream and encodes keys; the vendored canvas surface draws it. The PTY, tmux
  // server, IPC boundary and acknowledgement flow are unchanged from the xterm build.
  const ready=GhosttyTerminalSurface.create(node,{
    theme,font:terminalFont(),transparentBackground:!!backgroundImage(),
    onData:data=>{for(let i=0;i<data.length;i+=32768)api.input(id,data.slice(i,i+32768));},
    onResize:(cols,rows)=>api.resize(id,cols,rows),
    onSelectionChange:()=>{},
    beforeKey:e=>{
      const current=panes.get(id);
      // Linux: edit shortcuts with no effect in the terminal do not reach it as ^C, ^X, ^Z or ^A.
      if(LINUX&&e.type==='keydown'&&linuxTerminalSwallows(e,!!current?.surface?.hasSelection()))return false;
      switch(terminalKeyDecision(e,!!current?.surface?.hasSelection())){
        case 'copy':e.preventDefault();e.stopPropagation();attempt(()=>copyTerminalSelection({writeText:text=>api.call('copy',{text})},current!.surface!.getSelection()));return false;
        case 'newline':e.preventDefault();api.input(id,'\n');return false;
        case 'swallow':case 'app':return false;
        default:return true;
      }
    },
    onLinkActivate:url=>attempt(()=>openTerminalLink(api.call,url)),
  }).then(surface=>{surface.setPalette(palette);surface.setOptionAsAlt(appearance.optionAsMeta);pane!.surface=surface;return surface;});
  ready.catch(notice);
  const output=new TerminalOutput((data,done)=>{ready.then(surface=>{surface.write(data);done();},()=>done());},length=>api.ack(id,length));
  pane={surface:null,ready,node,attached:false,output};panes.set(id,pane);return pane;
}
async function select(id:string){
  if($<HTMLDialogElement>('rename-dialog').open||$<HTMLDialogElement>('command-dialog').open)return;
  const tick=++switching;selected=id;localStorage.setItem('selected',id);mark();
  document.querySelector<HTMLButtonElement>(`#pages [data-id="${CSS.escape(id)}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});
  const item=sessions.find(s=>s.id===id);
  $('rename').hidden=!item;$('end').hidden=!item;
  if(!item){
    for(const pane of panes.values()){pane.node.hidden=true;pane.surface?.setVisible(false);}
    $('kind').textContent='DASHBOARD';$('title').textContent=pages.find(p=>p.id===id)?.title||'Pulse';$('detail').textContent='Your life, in view.';$('keyhint').textContent='j / k scroll · gg / G jump';
    await api.call('page',{path:id.startsWith('/')?id:'/'});return;
  }
  $('kind').textContent='TERMINAL';$('title').textContent=item.title;$('detail').textContent=`${item.command} · ${item.directory}`;$('keyhint').textContent='⌃H / ⌃L switch';
  if(LINUX)$('keyhint').textContent=keyLabel('⌃H / ⌃L switch');
  await api.call('terminal');if(tick!==switching)return;
  for(const [key,p] of panes){p.node.hidden=key!==id;if(key!==id)p.surface?.setVisible(false);}
  try{await document.fonts.load(`${appearance.fontSize}px PulseTerminal`);}catch{/* no bundled terminal font: the fallback stack renders */}
  if(tick!==switching)return;
  const pane=terminal(id);pane.node.hidden=false;
  await document.fonts.ready;const surface=await pane.ready;if(tick!==switching)return;surface.setVisible(true);surface.fit();
  if(!pane.attached){pane.attached=true;try{await api.call('attach',{id,cols:surface.cols,rows:surface.rows});}catch(e){pane.attached=false;throw e;}}
  if(tick===switching)surface.focus();
}
// A terminal is only useful when its hidden textarea holds keyboard focus. Nothing in the base T3
// surface re-asserts that after the window regains OS focus or the sidebar rerenders, so the
// terminal would silently swallow nothing while looking active. Re-focus on every path that could
// have moved focus off it.
function focusTerminal(){if(!selected.startsWith("pulse-"))return;if($<HTMLDialogElement>("command-dialog").open||$<HTMLDialogElement>("rename-dialog").open)return;const p=panes.get(selected);if(p&&!p.node.hidden)p.surface?.focus();}
// Clicking anywhere in the terminal area — canvas, padding, or the gap around it — focuses the shell.
$("terminal-host").addEventListener("mousedown",()=>{if(selected.startsWith("pulse-"))queueMicrotask(focusTerminal);},true);
// Returning to Pulse (alt-tab, clicking the window) must land the caret back in the terminal, not on a button.
window.addEventListener("focus",()=>attempt(async()=>{focusTerminal();}));
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")focusTerminal();});
function refresh(){const next=refreshQueue.then(refreshNow,refreshNow);refreshQueue=next.catch(()=>{});return next;}
async function refreshNow(){
  const previous=sessions.map(s=>s.id);
  const data=await api.call('list');appearance=data.appearance;sessions=data.terminals;
  // A terminal inventory is the workspace's primary function. Appearance and
  // card enrichment must never prevent it from rendering or from selecting a
  // newly created session when one optional browser API or asset is unhappy.
  try{applyAppearance();}catch(error){notice(error);}
  const signature=JSON.stringify(data);if(signature===lastList){mark();return;}lastList=signature;
  const current=sessions.find(s=>s.id===selected);
  if(current){$('title').textContent=current.title;$('detail').textContent=`${current.command} · ${current.directory}`;}
  const focused=(document.activeElement as HTMLElement)?.dataset.id;
  $('sessions').replaceChildren();$('count').textContent=String(sessions.length).padStart(2,'0');$('empty').hidden=sessions.length>0;
  sessions.forEach(s=>{
    const b=button('',()=>attempt(()=>select(s.id)));b.dataset.id=s.id;b.className='session';b.title=s.title;if(s.decoration){b.style.setProperty('--tab-bg',s.decoration.inactiveBg);b.style.setProperty('--tab-fg',s.decoration.inactiveFg);b.style.setProperty('--active-bg',s.decoration.activeBg);b.style.setProperty('--active-fg',s.decoration.activeFg);}
    let title:{icon:string;heading:string;detail:string};
    try{title=sessionCardTitle(s.title,s.decoration?.sessionName);}
    catch{title={icon:'›_',heading:s.title||'TERMINAL',detail:''};}
    const copy=document.createElement('span');copy.className='copy';
    const heading=document.createElement('span');heading.className='session-heading';
    const icon=Object.assign(document.createElement('span'),{className:'session-icon',textContent:title.icon});icon.setAttribute('aria-hidden','true');
    heading.append(icon,Object.assign(document.createElement('span'),{className:'name',textContent:title.heading}));
    copy.append(heading);
    if(title.detail)copy.append(Object.assign(document.createElement('span'),{className:'session-detail',textContent:title.detail}));
    else copy.append(Object.assign(document.createElement('small'),{textContent:`${s.command} · ${s.directory}`}));
    let runtime:ReturnType<typeof sessionRuntime>=null;
    try{runtime=sessionRuntime(s.decoration,s.command);}catch{}
    if(runtime){
      const label=runtime.model??'Model starting…';
      const visual=providerVisual(runtime.provider);
      const provider=Object.assign(document.createElement('span'),{className:`provider-mark ${visual.className}`});
      const showText=()=>{provider.className=`provider-mark ${visual.src?'provider-mark--text':visual.className}`;provider.textContent=visual.text??'';};
      if(visual.src){const mark=Object.assign(document.createElement('img'),{src:visual.src,alt:''});mark.onerror=showText;provider.append(mark);}
      else showText();
      const runtimeLabel=Object.assign(document.createElement('span'),{className:'session-runtime',title:`Provider: ${runtime.provider}\nModel: ${runtime.model??'Starting…'}`,ariaLabel:`Provider ${runtime.provider}; model ${runtime.model??'starting'}`});
      runtimeLabel.append(provider,document.createTextNode(label));
      copy.append(runtimeLabel);
    }
    b.setAttribute('aria-label',s.title);b.title=title.detail?`${s.title}\n${s.command} · ${s.directory}`:s.title;
    b.append(copy,Object.assign(document.createElement('span'),{className:'live'}));b.ondblclick=()=>rename();$('sessions').append(b);
  });
  for(const [id,p] of panes)if(!sessions.some(s=>s.id===id)){p.output.dispose();p.ready.then(s=>s.dispose(),()=>{});p.node.remove();panes.delete(id);}
  const nextSelection=selectionAfterRefresh(selected,previous,sessions.map(s=>s.id));
  if(nextSelection!==selected)try{await select(nextSelection);}catch(error){notice(error);}
  mark();if(focused)document.querySelector<HTMLButtonElement>(`[data-id="${CSS.escape(focused)}"]`)?.focus();
  // If nothing in the sidebar wanted focus and a terminal is active, the caret belongs in the shell.
  if(!focused&&selected.startsWith("pulse-")&&(document.activeElement===document.body||document.activeElement===null))focusTerminal();
  if($<HTMLDialogElement>('command-dialog').open)renderCommands();
}
async function create(args={}){const id=await api.call('create',args);if(id){await refresh();await select(id);}}
function rename(){const item=sessions.find(s=>s.id===selected);if(!item)return;renameTarget=item.id;$<HTMLInputElement>('session-name').value=item.title;$<HTMLDialogElement>('rename-dialog').showModal();$<HTMLInputElement>('session-name').select();}
$('new').onclick=()=>attempt(()=>create());$('folder').onclick=()=>attempt(()=>create({chooseFolder:true}));$('rename').onclick=rename;
let ending=false;
async function endSelected(action:'end'|'close'='end'){
  const id=selected;
  if(ending||$<HTMLDialogElement>('command-dialog').open||$<HTMLDialogElement>('rename-dialog').open||!sessions.some(s=>s.id===id))return;
  ending=true;
  try{if(await api.call(action,{id}))await refresh();}
  finally{ending=false;panes.get(selected)?.surface?.focus();}
}
$('end').onclick=()=>attempt(()=>endSelected());
api.on('workspace:close',()=>attempt(()=>endSelected('close')));
$<HTMLDialogElement>('rename-dialog').addEventListener('close',()=>{const id=renameTarget;if($<HTMLDialogElement>('rename-dialog').returnValue==='save')attempt(async()=>{await api.call('rename',{id,title:$<HTMLInputElement>('session-name').value});await refresh();await select(id);});else panes.get(selected)?.surface?.focus();});
api.on('terminal:data',({id,data})=>{const p=panes.get(id);if(p)p.output.enqueue(data);else api.ack(id,data.length);});
api.on('terminal:exit',({id})=>{const p=panes.get(id);if(p)p.attached=false;attempt(refresh);});
api.on('workspace:cycle',(delta:number)=>{const ids=sessions.map(s=>s.id);if(!ids.length)return;const i=ids.indexOf(selected);attempt(()=>select(ids[i<0?(delta>0?0:ids.length-1):(i+delta+ids.length)%ids.length]));});
api.on('workspace:new',(args)=>attempt(()=>create(args)));api.on('workspace:page',(path:string)=>attempt(()=>select(path)));
api.on('workspace:zoom',(delta:number)=>{zoom=delta===0?0:Math.max(9-appearance.fontSize,Math.min(40-appearance.fontSize,zoom+Math.sign(delta)));localStorage.setItem('terminalZoomDelta',String(zoom));for(const p of panes.values())p.ready.then(s=>s.setFont(terminalFont())).catch(()=>{});});
api.on('workspace:focus',()=>(document.querySelector<HTMLButtonElement>('aside .active')||document.querySelector<HTMLButtonElement>('#sessions button')||$('new')).focus());
api.on('workspace:route',(path:string)=>{if(selected.startsWith('/')){selected=path;localStorage.setItem('selected',path);mark();}});
new ResizeObserver(()=>{const p=panes.get(selected);if(p&&!p.node.hidden)p.surface?.fit();}).observe($('terminal-host'));
document.querySelector('aside')!.addEventListener('keydown',(event)=>{
  const e=event as KeyboardEvent;if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(!['j','k','Escape'].includes(e.key))return;e.preventDefault();
  if(e.key==='Escape'){attempt(()=>select(selected));return;}
  const buttons=[...document.querySelectorAll<HTMLButtonElement>('aside button')];const i=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(i+(e.key==='j'?1:-1)+buttons.length)%buttons.length]?.focus();
});
const commandDialog=$<HTMLDialogElement>('command-dialog');
const commandQuery=$<HTMLInputElement>('command-query');
let commandMatches:Command[]=[];
let commandIndex=0;
let paletteBusy=false;
let shortcutsOnly=false;
let priorFocus:HTMLElement|null=null;
// The command menu shows and searches shortcuts through keyLabel; the shipped catalog is authorCatalog.
function commandCatalog():Command[]{
  const catalog=authorCatalog();
  if(!LINUX)return catalog;
  return catalog.map(c=>({...c,...(c.shortcut?{shortcut:keyLabel(c.shortcut)}:{}),...(c.detail&&c.group==='Shortcuts'?{detail:keyLabel(c.detail)}:{})}));
}
function authorCatalog():Command[]{
  const current=sessions.find(s=>s.id===selected);
  return [
    {id:'new',label:'New terminal',group:'Actions',shortcut:'⌘T',run:()=>create()},
    {id:'folder',label:'New terminal in folder…',group:'Actions',shortcut:'⇧⌘T',run:()=>create({chooseFolder:true})},
    {id:'shortcuts',label:'Show keyboard shortcuts',group:'Actions',detail:'Browse every shortcut and where it works',run:()=>{}},
    ...(current?[
      {id:'rename',label:'Rename current session',group:'Actions',detail:current.title,run:()=>rename()},
      {id:'end',label:'End current session…',group:'Actions',detail:'Asks before ending the shell and its programs',run:()=>endSelected()},
    ]:[]),
    ...pages.map(p=>({id:'page:'+p.id,label:'Go to '+p.title,group:'Pages',shortcut:p.shortcut,run:()=>select(p.id)})),
    ...sessions.map(s=>({id:s.id,label:s.title,group:'Sessions',detail:`${s.command} · ${s.directory}`,run:async()=>{await refresh();if(!sessions.some(item=>item.id===s.id))throw new Error('That session has ended.');await select(s.id);}})),
    ...nativeCommands.filter(c=>!['back','forward'].includes(c.id)||selected.startsWith('/')).map(c=>({...c,group:'View',run:async()=>{await api.call('native-command',{id:c.id});}})),
    {id:'focus',label:'Focus sessions sidebar',group:'Actions',shortcut:'⌘B',run:()=>{(document.querySelector<HTMLButtonElement>('#sessions .active')||$('new')).focus();}},
    ...[
      ['Command menu','⌘K','Anywhere in Pulse'],
      ['Previous / next session','⌃H / ⌃L','Anywhere outside dialogs'],
      ['Close current session','⌘W','Asks before ending the selected session'],
      ['Close window','⇧⌘W','Keeps sessions running'],
      ['Move in sidebar','j / k','After ⌘B; Enter selects, Escape returns'],
      ['Scroll dashboard','j / k','Outside text fields'],
      ['Jump to top / bottom','gg / G','Dashboard, outside text fields'],
      ['Scroll half a page','⌃D / ⌃U','Dashboard, outside text fields'],
      ['Copy / paste','⌘C / ⌘V','Text fields and terminals'],
    ].map(([label,shortcut,detail],i)=>({id:'help:'+i,label,shortcut,detail,group:'Shortcuts'})),
  ];
}
function highlightCommand(){
  const rows=$('command-results').querySelectorAll<HTMLElement>('[role=option]');
  rows.forEach((row,i)=>row.setAttribute('aria-selected',String(i===commandIndex)));
  const active=rows[commandIndex];
  if(active){commandQuery.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});}
  else commandQuery.removeAttribute('aria-activedescendant');
}
function renderCommands(){
  const old=commandMatches[commandIndex]?.id;
  commandMatches=filterCommands(commandCatalog().filter(c=>!shortcutsOnly||!!c.shortcut),commandQuery.value);
  commandIndex=Math.max(0,commandMatches.findIndex(c=>c.id===old));
  const list=$('command-results');list.replaceChildren();let group='';
  commandMatches.forEach((c,i)=>{
    if(group!==c.group){group=c.group;list.append(Object.assign(document.createElement('div'),{className:'command-group',textContent:group}));}
    const row=document.createElement('div');row.id='command-option-'+i;row.className='command-option';row.setAttribute('role','option');row.setAttribute('aria-disabled',String(!c.run));
    const copy=document.createElement('span');copy.className='command-copy';copy.append(Object.assign(document.createElement('span'),{textContent:c.label}));
    if(c.detail)copy.append(Object.assign(document.createElement('small'),{textContent:c.detail}));
    row.append(copy,Object.assign(document.createElement('kbd'),{textContent:c.shortcut|| (c.run?'↵':'')}));
    row.onmousedown=e=>e.preventDefault();row.onclick=()=>{commandIndex=i;attempt(runCommand);};list.append(row);
  });
  if(!commandMatches.length)list.append(Object.assign(document.createElement('div'),{className:'command-empty',textContent:'No matches. Try “terminal”, a page name, or “shortcuts”.'}));
  $('command-count').textContent=`${commandMatches.length} results`;
  highlightCommand();
}
async function closeCommands(restore=true){
  commandDialog.close();await api.call('palette',{open:false});
  if(selected.startsWith('pulse-')&&!sessions.some(s=>s.id===selected))await select(sessions[0]?.id||'/');
  if(restore&&selected.startsWith('pulse-')){if(priorFocus?.isConnected)priorFocus.focus();else panes.get(selected)?.surface?.focus();}
}
async function runCommand(){
  if(paletteBusy)return;const command=commandMatches[commandIndex];if(!command?.run)return;
  if(command.id==='shortcuts'){shortcutsOnly=true;commandQuery.value='';commandQuery.placeholder='Search keyboard shortcuts…';commandMatches=[];commandIndex=0;renderCommands();commandQuery.focus();return;
  }
  paletteBusy=true;
  try{await closeCommands(false);await command.run();}finally{paletteBusy=false;}
}
async function toggleCommands(){
  if(paletteBusy||$<HTMLDialogElement>('rename-dialog').open)return;
  paletteBusy=true;
  try{
    if(commandDialog.open){await closeCommands();return;}
    priorFocus=document.activeElement as HTMLElement;shortcutsOnly=false;commandQuery.placeholder='What would you like to do?';commandQuery.value='';commandMatches=[];commandIndex=0;
    await api.call('palette',{open:true});commandDialog.showModal();renderCommands();commandQuery.focus();
  }finally{paletteBusy=false;}
}
$('commands').onclick=()=>attempt(toggleCommands);
$('command-dismiss').onclick=()=>attempt(()=>closeCommands());
api.on('workspace:palette',()=>attempt(toggleCommands));
commandQuery.oninput=()=>{commandIndex=0;commandMatches=[];renderCommands();};
commandDialog.addEventListener('cancel',e=>{e.preventDefault();attempt(()=>closeCommands());});
commandDialog.addEventListener('click',e=>{if(e.target===commandDialog){const r=commandDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)attempt(()=>closeCommands());}});
commandDialog.addEventListener('keydown',e=>{
  if(e.target!==commandQuery)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(commandMatches.length){commandIndex=(commandIndex+(e.key==='ArrowDown'?1:-1)+commandMatches.length)%commandMatches.length;highlightCommand();}}
  else if(e.key==='Enter'){e.preventDefault();attempt(runCommand);}
});
attempt(async()=>{await refresh();await select(selected);});
setInterval(()=>attempt(refresh),1000);

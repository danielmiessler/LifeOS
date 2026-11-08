import {app,BrowserWindow,WebContentsView,Menu,dialog,shell,session,nativeTheme,ipcMain,screen,protocol,net,clipboard} from 'electron';
import type {WebContents,IpcMainInvokeEvent,IpcMainEvent} from 'electron';
import {readFileSync,writeFileSync,renameSync,statSync} from 'node:fs';
import {join,extname} from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ORIGIN,isPulseURL,isExternalURL,dashboardReady,rendererPreferences,parseState,restoreWindowBounds,preserveWorkspaceOnClose,activationAction} from './policy';
import {clipboardText,sessionId,trustedWorkspace,terminalSize,sessionTitle} from './workspace-policy';
import {terminalAppearance} from './workspace-policy';
import {IMAGE_EXTENSIONS,BACKGROUND_IMAGE_URL,type BackgroundImageSettings,type BackgroundImage} from './background-image';
import {BUNDLE_ID,DEFAULTS_BIN,pressAndHoldArgs} from './key-repeat';
import {Terminals} from './terminals';
import {endWithConfirmation} from './session-end';
import {nativeCommandAllowed,pages} from './commands';
import {invariant} from '../../TOOLS/Invariant';
// Linux support: everything only Linux needs lives in linux.ts; each call below sits in a branch that leaves the macOS path as written.
import {spawn} from 'node:child_process';
import {Notification} from 'electron';
import {isLinux,linuxBrowserCommand,LINUX_PULSE_START,linuxMenu,linuxMenuCommand,linuxEditCommand,type MenuEntry} from './linux';
const LINUX=isLinux(process.platform);
const exec=promisify(execFile);
const resourceDir=join(app.getAppPath(),'dist');
const workspaceURL=pathToFileURL(join(resourceDir,'workspace.html')).href;
const offlinePath=join(resourceDir,'offline.html');
let win:BrowserWindow|null=null;
let dashboard:WebContentsView|null=null;
let pageVisible=true;
let paletteVisible=false;
let route='/';
let requestedRoute='/';
let navigationVersion=0;
let creating=false;
let quitting=false;
const connecting=new WeakSet<WebContents>();
const send=(name:string,data:unknown={})=>{if(win&&!win.isDestroyed())win.webContents.send(name,data);};
const terminals=new Terminals(send,join(app.isPackaged?process.resourcesPath:resourceDir,'tmux.conf'));
app.setName('Pulse Desktop');app.setAppUserModelId('ai.lifeos.pulse.desktop');app.enableSandbox();
// The workspace loads the kitty background image through this scheme; the handler serves one file, the one named in kitty.conf.
// supportFetchAPI + corsEnabled: the workspace page (file: origin) fetches the two libghostty-vt wasm artifacts over this scheme.
protocol.registerSchemesAsPrivileged([{scheme:'pulse-asset',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
let backgroundImagePath='';
function publishBackground(settings:BackgroundImageSettings|undefined):BackgroundImage|undefined{
  backgroundImagePath='';
  if(!settings||!IMAGE_EXTENSIONS.has(extname(settings.path).toLowerCase()))return undefined;
  let stat;try{stat=statSync(settings.path);}catch{return undefined;}
  if(!stat.isFile()||stat.size>64*1024*1024)return undefined;
  backgroundImagePath=settings.path;
  return {url:`${BACKGROUND_IMAGE_URL}?v=${Math.floor(stat.mtimeMs)}`,layout:settings.layout,tint:settings.tint};
}
const GHOSTTY_ARTIFACTS=new Set(['ghostty-vt.wasm','ghostty-write-pty.wasm']);
function serveAsset(request:Request){
  const url=new URL(request.url);
  // Two fixed wasm artifacts from the bundle; the workspace renderer instantiates them under its own CSP.
  if(url.hostname==='ghostty'){const name=url.pathname.slice(1);if(!GHOSTTY_ARTIFACTS.has(name))return new Response('Not found',{status:404});return net.fetch(pathToFileURL(join(resourceDir,'ghostty',name)).href).then(r=>new Response(r.body,{status:r.status,headers:{'content-type':'application/wasm','access-control-allow-origin':'*','cache-control':'no-store'}}));}
  if(!backgroundImagePath||url.hostname!=='background'||url.pathname!=='/image')return new Response('Not found',{status:404});
  return net.fetch(pathToFileURL(backgroundImagePath).href);
}
function trusted(e:IpcMainInvokeEvent|IpcMainEvent){return trustedWorkspace(e.sender.id,win?.webContents.id,e.senderFrame?.url||'',workspaceURL,e.senderFrame===e.sender.mainFrame);}
async function external(url:unknown){
  if(!win||!isExternalURL(url))return;
  // Linux: start Chrome detached, since its process can outlive the app and an awaited exec would never return.
  if(LINUX){const [bin,args]=linuxBrowserCommand(url);$1return;}
  await exec('/usr/bin/open',['-a','Google Chrome',url]);
}
async function ready(){try{const r=await fetch(ORIGIN+'/healthz',{signal:AbortSignal.timeout(2500),redirect:'error'});return r.ok&&dashboardReady(await r.json());}catch{return false;}}
async function connect(){
  const target=dashboard?.webContents;if(!target||connecting.has(target))return;
  connecting.add(target);
  try{
    // Linux: Pulse runs as a systemd user service, and `start` leaves a running one alone; a failed start shows a notification instead of only an offline page.
    if(!(await ready())&&process.platform==='darwin')await exec('/bin/launchctl',['kickstart',`gui/${process.getuid!()}/com.lifeos.pulse`],{timeout:5000}).catch(()=>{});
    if(LINUX&&!(await ready()))await exec(LINUX_PULSE_START[0],LINUX_PULSE_START[1],{timeout:5000}).catch((error:{stderr?:string;message:string})=>{const reason=(error.stderr||error.message).trim();console.error('Pulse did not start:',reason);new Notification({title:'Pulse did not start',body:reason}).show();});
    for(let i=0;i<6;i++){
      const available=await ready();if(target.isDestroyed())return;
      if(available){
        while(!target.isDestroyed()){
          const version=navigationVersion;await target.loadURL(ORIGIN+requestedRoute);
          if(version===navigationVersion)return;
        }
        return;
      }await new Promise(r=>setTimeout(r,1000));
    }
    if(!target.isDestroyed())await target.loadFile(offlinePath);
  }catch{if(!target.isDestroyed())await target.loadFile(offlinePath);}finally{connecting.delete(target);}
}
function layout(){
  if(!win||!dashboard)return;const [width,height]=win.getContentSize();
  dashboard.setBounds({x:248,y:100,width:Math.max(1,width-248),height:Math.max(1,height-100)});
  const attached=win.contentView.children.includes(dashboard);
  if(pageVisible&&!paletteVisible&&!attached)win.contentView.addChildView(dashboard);
  else if((!pageVisible||paletteVisible)&&attached)win.contentView.removeChildView(dashboard);
}
function showPage(path:string){
  const clean=parseState({route:path}).route;pageVisible=true;layout();
  if(clean!==requestedRoute||dashboard?.webContents.getURL()!==ORIGIN+clean){requestedRoute=clean;navigationVersion++;void connect();}
  dashboard?.webContents.focus();
}
function saveState(){
  if(!win||win.isDestroyed())return;const state=parseState({...win.getNormalBounds(),route});
  invariant(Number.isFinite(state.width)&&isPulseURL(ORIGIN+state.route),'valid desktop state');
  const path=join(app.getPath('userData'),'window.json');writeFileSync(path+'.tmp',JSON.stringify(state),{mode:0o600});renameSync(path+'.tmp',path);
}
// Linux: app shortcuts are Ctrl+Shift (linux.ts), and the main process runs them before the key reaches the page, so the terminal never sends them to the shell.
function linuxShortcut(wc:WebContents,e:Electron.Event,input:Electron.Input){
  const key=input.key.toLowerCase();
  if(input.control&&input.shift&&!input.alt&&!input.meta&&input.code==='KeyK'){e.preventDefault();swallowed.add(input.code);if(!input.isAutoRepeat){win?.webContents.focus();send('workspace:palette');}return;}
  // Text fields with no terminal (the command menu, the Pulse pages) get the Ctrl+Shift edit keys from here; bare Ctrl
  // editing is Chromium's own. The terminal keeps them: its surface copies and pastes, and workspace.ts stops the rest.
  const command=(paletteVisible||wc!==win?.webContents)?linuxEditCommand(input):null;
  if(command){e.preventDefault();swallowed.add(input.code);wc[command]();return;}
  if(paletteVisible){wc.setIgnoreMenuShortcuts(true);return;}
  wc.setIgnoreMenuShortcuts(false);
  const item=linuxMenuCommand(Menu.getApplicationMenu()?.items??[],input);
  if(item){e.preventDefault();swallowed.add(input.code);if(input.isAutoRepeat&&input.code==='KeyW')return;if(item.enabled)item.click(undefined,win!,undefined);return;}
  if(input.control&&!input.alt&&!input.meta&&['h','l'].includes(key)){e.preventDefault();swallowed.add(input.code);send('workspace:cycle',key==='h'?-1:1);}
}
/** Keys whose press the main process ran as an app shortcut: their release is held back too, so a terminal program
 * that asked for key releases (kitty keyboard protocol) never gets a release for a press it never saw. */
const swallowed=new Set<string>();
function linuxRelease(e:Electron.Event,input:Electron.Input){if(swallowed.delete(input.code))e.preventDefault();}
function shortcuts(wc:WebContents){wc.on('before-input-event',(e,input)=>{
  // Linux shortcuts branch off here, before the keyDown-only return below, because Linux also holds back the key release. The rest of the function is the macOS path.
  if(LINUX){if(input.type==='keyDown')linuxShortcut(wc,e,input);else if(input.type==='keyUp')linuxRelease(e,input);return;}
  if(input.type!=='keyDown')return;
  if(input.meta&&!input.control&&!input.alt&&!input.shift&&input.key.toLowerCase()==='k'){e.preventDefault();if(!input.isAutoRepeat){win?.webContents.focus();send('workspace:palette');}return;}
  if(paletteVisible){
    // Keep native text editing available, but never run workspace accelerators over a modal.
    const editing=input.meta&&!input.control&&!input.alt&&['a','c','v','x','z'].includes(input.key.toLowerCase());
    wc.setIgnoreMenuShortcuts(!editing);return;
  }
  wc.setIgnoreMenuShortcuts(false);
  if(input.isAutoRepeat&&!input.alt&&!input.shift&&input.key.toLowerCase()==='w'&&(process.platform==='darwin'?input.meta&&!input.control:input.control&&!input.meta)){e.preventDefault();return;}
  if(input.control&&!input.alt&&!input.meta&&['h','l'].includes(input.key.toLowerCase())){e.preventDefault();send('workspace:cycle',input.key.toLowerCase()==='h'?-1:1);}
});}
const vimScript=`(()=>{
  if(window.__pulseVim)return;window.__pulseVim=true;let lastG=0;
  document.addEventListener('keydown',e=>{
    const el=e.target;if(el?.closest?.('input,textarea,select,[contenteditable=true],[role=textbox]'))return;
    if(e.metaKey||e.altKey)return;
    let amount=0,edge=null;
    if(e.ctrlKey){if(e.key==='d')amount=innerHeight/2;else if(e.key==='u')amount=-innerHeight/2;else return;}
    else if(e.key==='j')amount=80;else if(e.key==='k')amount=-80;
    else if(e.key==='G')edge='bottom';else if(e.key==='g'){if(Date.now()-lastG<600)edge='top';lastG=Date.now();e.preventDefault();if(!edge)return;}else return;
    e.preventDefault();let scroller=document.scrollingElement;
    for(let node=el;node&&node!==document.body;node=node.parentElement){if(node.scrollHeight>node.clientHeight+4&&/(auto|scroll)/.test(getComputedStyle(node).overflowY)){scroller=node;break;}}
    if(edge)scroller.scrollTo({top:edge==='top'?0:scroller.scrollHeight,behavior:'instant'});else scroller.scrollBy({top:amount,behavior:'instant'});
  },true);
})()`;
function createWindow(){
  let state=parseState(null);try{state=parseState(JSON.parse(readFileSync(join(app.getPath('userData'),'window.json'),'utf8')));}catch{}
  route=state.route;requestedRoute=route;navigationVersion++;pageVisible=true;paletteVisible=false;
  const bounds=restoreWindowBounds(state,screen.getAllDisplays().map(display=>display.workArea),screen.getPrimaryDisplay().workArea);
  const window=new BrowserWindow({...bounds,minWidth:1000,minHeight:650,title:'Pulse Desktop',backgroundColor:'#050b17',show:false,webPreferences:{...rendererPreferences,backgroundThrottling:false,preload:join(resourceDir,'preload.cjs'),partition:'persist:pulse-workspace'}});
  win=window;
  // Linux: Electron draws the menu inside the window (macOS shows it in the system bar), so it is hidden; its shortcuts still run through linuxShortcut.
  if(LINUX)window.setMenuBarVisibility(false);
  // When Pulse regains OS focus while a terminal is the active view, route focus to the workspace
  // webContents (not the hidden dashboard) so its window-focus handler lands the caret in the shell.
  window.on("focus",()=>{if(!pageVisible)window.webContents.focus();});
  window.webContents.setZoomFactor(1);
  const view=new WebContentsView({webPreferences:{...rendererPreferences,partition:'persist:pulse-desktop'}});dashboard=view;window.contentView.addChildView(view);layout();
  // macOS can constrain initial height to the primary display before placing the window.
  window.once('ready-to-show',()=>{window.show();window.setBounds(bounds);layout();});window.on('resize',layout);window.on('close',event=>{
    saveState();
    if(preserveWorkspaceOnClose(quitting)){
      event.preventDefault();
      window.hide();
    }
  });
  window.on('closed',()=>{terminals.detachAll();view.webContents.close();if(win===window){win=null;dashboard=null;}});
  window.webContents.on('will-navigate',e=>e.preventDefault());window.webContents.on('will-frame-navigate',e=>e.preventDefault());
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-attach-webview',e=>e.preventDefault());
  window.webContents.on('render-process-gone',()=>terminals.detachAll());
  window.webContents.on('did-start-navigation',(_e,_url,inPlace,isMain)=>{if(isMain&&!inPlace){paletteVisible=false;layout();terminals.detachAll();}});
  const wc=view.webContents;shortcuts(window.webContents);shortcuts(wc);
  wc.setWindowOpenHandler(({url})=>{if(isPulseURL(url))void wc.loadURL(url);else void external(url);return {action:'deny'};});
  wc.on('will-navigate',(e,url)=>{if(!isPulseURL(url)){e.preventDefault();void external(url);}});
  wc.on('will-redirect',(e,url)=>{if(!isPulseURL(url))e.preventDefault();});
  wc.on('will-frame-navigate',e=>{if(!e.isMainFrame&&!isPulseURL(e.url))e.preventDefault();});
  wc.on('will-attach-webview',e=>e.preventDefault());
  const navigated=(_e:unknown,url:string)=>{if(isPulseURL(url)){
    route=parseState({route:new URL(url).pathname}).route;
    if(!connecting.has(wc)){requestedRoute=route;navigationVersion++;}
    if(route===requestedRoute)send('workspace:route',route);
  }};
  wc.on('did-navigate',navigated);wc.on('did-navigate-in-page',navigated);
  wc.on('did-finish-load',()=>{if(isPulseURL(wc.getURL()))void wc.executeJavaScript(vimScript).catch(()=>{});});
  wc.on('did-fail-load',(_e,code,_d,url,isMain)=>{if(isMain&&code!==-3&&isPulseURL(url))void wc.loadFile(offlinePath);});
  wc.on('render-process-gone',()=>{if(!wc.isDestroyed())void wc.loadFile(offlinePath);});
  void window.loadURL(workspaceURL);
  if(!app.isPackaged&&process.argv.includes('--offline-preview'))void wc.loadFile(offlinePath);else void connect();
}
function setupIPC(){
  ipcMain.handle('workspace:call',async(e,action,args={})=>{
    if(!trusted(e))throw new Error('Workspace access denied');
    if(!args||typeof args!=='object')throw new Error('Invalid workspace request');
    switch(action){
      case 'palette':{
        if(typeof args.open!=='boolean')throw new Error('Invalid palette state');
        paletteVisible=args.open;layout();
        win?.webContents.setIgnoreMenuShortcuts(false);dashboard?.webContents.setIgnoreMenuShortcuts(false);
        if(paletteVisible||!pageVisible)win?.webContents.focus();else dashboard?.webContents.focus();
        return true;
      }
      case 'native-command':{
        if(!nativeCommandAllowed(args.id))throw new Error('Unknown command');
        const item=Menu.getApplicationMenu()?.getMenuItemById(args.id);
        if(!item||!item.enabled)throw new Error('Command unavailable');
        item.click(undefined,win!,undefined);return true;
      }
      case 'external':{
        const url=(args as {url?:unknown}).url;
        if(!isExternalURL(url))throw new Error('Invalid external link');
        await external(url);return true;
      }
      case 'copy':{
        clipboard.writeText(clipboardText((args as {text?:unknown}).text));return true;
      }
      case 'list':{
        let config='';try{config=readFileSync(join(homedir(),'.config/kitty/kitty.conf'),'utf8');}catch{}
        const {background,...appearance}=terminalAppearance(config,homedir());
        return {terminals:await terminals.list(),route,appearance:{...appearance,background:publishBackground(background)}};
      }
      case 'create':{
        if(creating)throw new Error('A terminal is already being created.');creating=true;
        try{
          if((await terminals.list()).length>=32)throw new Error('Close a terminal before opening another (32 maximum).');
          let cwd:string|undefined;
          if(args.chooseFolder){const result=await dialog.showOpenDialog(win!,{title:'New terminal in folder',properties:['openDirectory']});if(result.canceled)return null;cwd=result.filePaths[0];}
          return await terminals.create(cwd);
        }finally{creating=false;}
      }
      case 'attach':if(!sessionId(args.id))throw new Error('Invalid session');await terminals.attach(args.id,args.cols,args.rows);return true;
      case 'detach':if(!sessionId(args.id))throw new Error('Invalid session');terminals.detach(args.id);return true;
      case 'rename':if(!sessionId(args.id))throw new Error('Invalid session');await terminals.rename(args.id,sessionTitle(args.title));return true;
      // The End session button and the native Close Session shortcut (Cmd+W) both confirm before the shell and its programs are killed.
      case 'close':
      case 'end':{
        if(!sessionId(args.id))throw new Error('Invalid session');const item=(await terminals.list()).find(s=>s.id===args.id);if(!item)return false;
        return await endWithConfirmation(item,async(message,detail)=>(await dialog.showMessageBox(win!,{type:'warning',message,detail,buttons:['Keep running','End session'],defaultId:0,cancelId:0})).response===1,()=>terminals.end(args.id));
      }
      case 'page':if(typeof args.path!=='string'||!isPulseURL(ORIGIN+args.path))throw new Error('Invalid page');showPage(args.path);return true;
      case 'terminal':pageVisible=false;layout();win?.webContents.focus();return true;
      case 'reconnect':await connect();return true;
      default:throw new Error('Unknown workspace action');
    }
  });
  ipcMain.on('workspace:input',(e,id,data)=>{if(trusted(e)&&sessionId(id)&&typeof data==='string'&&data.length<=65536)terminals.write(id,data);});
  ipcMain.on('workspace:ack',(e,id,length)=>{if(trusted(e)&&sessionId(id)&&Number.isInteger(length)&&length>0&&length<=1048576)terminals.acknowledge(id,length);});
  ipcMain.on('workspace:resize',(e,id,cols,rows)=>{if(!trusted(e)||!sessionId(id))return;try{terminalSize(cols,rows);terminals.resize(id,cols,rows);}catch{}});
}
function menu(){
  const contents=()=>pageVisible?dashboard?.webContents:win?.webContents;
  const zoom=(delta:number)=>{if(pageVisible){const c=dashboard?.webContents;if(c)c.setZoomLevel(delta===0?0:Math.max(-3,Math.min(4,c.getZoomLevel()+delta)));}else send('workspace:zoom',delta);};
  // Linux: the same menu goes through linuxMenu (no macOS-only roles, Linux keys).
  const forPlatform=(template:Electron.MenuItemConstructorOptions[])=>LINUX?linuxMenu(template as MenuEntry[]) as Electron.MenuItemConstructorOptions[]:template;
  Menu.setApplicationMenu(Menu.buildFromTemplate(forPlatform([
    {label:'Pulse Desktop',submenu:[{role:'about'},{type:'separator'},{role:'services'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},
    {label:'File',submenu:[{label:'New Terminal',accelerator:'CmdOrCtrl+T',click:()=>send('workspace:new')},{label:'New Terminal in Folder…',accelerator:'CmdOrCtrl+Shift+T',click:()=>send('workspace:new',{chooseFolder:true})},{label:'Open Pulse',accelerator:'CmdOrCtrl+N',click:()=>{if(!win)createWindow();else win.show();}},{id:'reconnect',label:'Reconnect to Pulse',accelerator:'CmdOrCtrl+Shift+R',click:()=>void connect()},{type:'separator'},{label:'Close Session…',accelerator:'CmdOrCtrl+W',click:()=>send('workspace:close')},{role:'close',label:'Close Window',accelerator:'CmdOrCtrl+Shift+W'}]},
    {role:'editMenu'},
    {label:'View',submenu:[{label:'Command Menu…',accelerator:'CmdOrCtrl+K',click:()=>{win?.webContents.focus();send('workspace:palette');}},{id:'reload',label:'Reload',accelerator:'CmdOrCtrl+R',click:()=>contents()?.reload()},{label:'Force Reload',accelerator:'CmdOrCtrl+Alt+R',click:()=>contents()?.reloadIgnoringCache()},{type:'separator'},{id:'zoom-reset',label:'Actual Size',accelerator:'CmdOrCtrl+0',click:()=>zoom(0)},{id:'zoom-in',label:'Zoom In',accelerator:'CmdOrCtrl+Plus',click:()=>zoom(.5)},{id:'zoom-out',label:'Zoom Out',accelerator:'CmdOrCtrl+-',click:()=>zoom(-.5)},{type:'separator'},{id:'fullscreen',label:'Toggle Full Screen',accelerator:'Control+Command+F',click:()=>{if(win)win.setFullScreen(!win.isFullScreen());}}]},
    {label:'Navigate',submenu:[{label:'Focus Sessions',accelerator:'CmdOrCtrl+B',click:()=>{win?.webContents.focus();send('workspace:focus');}},{id:'back',label:'Back',accelerator:'CmdOrCtrl+[',click:()=>{if(dashboard?.webContents.navigationHistory.canGoBack())dashboard.webContents.navigationHistory.goBack();}},{id:'forward',label:'Forward',accelerator:'CmdOrCtrl+]',click:()=>{if(dashboard?.webContents.navigationHistory.canGoForward())dashboard.webContents.navigationHistory.goForward();}},...pages.filter(p=>p.shortcut).map(p=>({label:p.title,accelerator:`CmdOrCtrl+${p.shortcut!.slice(1)}`,click:()=>send('workspace:page',p.id)}))]},
    {role:'windowMenu'},
  ])));
}
// Talk (LIFEOS/DOCUMENTATION/VoiceMode/VoiceMode.md § Talk): `open -n -a "Pulse Desktop" --args --talk=<session>`
// raises a small always-on-top window running the live voice conversation for that Claude Code session.
const talkWindows=new Map<string,BrowserWindow>();
export function talkArg(argv:readonly string[]):string|null{const a=argv.find(x=>x.startsWith('--talk='));const id=a?a.slice(7):'';return /^[A-Za-z0-9_-]{1,128}$/.test(id)?id:null;}
function openTalk(id:string){
  const open=talkWindows.get(id);if(open&&!open.isDestroyed()){open.show();open.focus();return;}
  const t=new BrowserWindow({width:400,height:640,minWidth:340,minHeight:480,alwaysOnTop:true,title:'Talk',backgroundColor:'#050b17',titleBarStyle:'hiddenInset',webPreferences:{...rendererPreferences,partition:'persist:pulse-desktop'}});
  talkWindows.set(id,t);t.on('closed',()=>{if(talkWindows.get(id)===t)talkWindows.delete(id);});
  t.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  t.webContents.on('will-navigate',(e,url)=>{if(!isPulseURL(url))e.preventDefault();});
  void t.loadURL(`${ORIGIN}/talk?session=${encodeURIComponent(id)}`);
}
if(!app.requestSingleInstanceLock())app.quit();else{
  app.on('second-instance',(_e,argv)=>{const talk=talkArg(argv);if(talk){openTalk(talk);return;}if(!win)createWindow();else{if(win.isMinimized())win.restore();win.show();win.focus();}});
  app.whenReady().then(()=>{
    nativeTheme.themeSource='dark';setupIPC();
    // Held keys must repeat in the terminal like they do in kitty (see key-repeat.ts). Takes effect at the next launch.
    if(process.platform==='darwin'&&app.isPackaged)execFile(DEFAULTS_BIN,pressAndHoldArgs(BUNDLE_ID),()=>{});
    const local=session.fromPartition('persist:pulse-workspace');local.setPermissionRequestHandler((_w,_p,cb)=>cb(false));local.setPermissionCheckHandler(()=>false);
    local.protocol.handle('pulse-asset',serveAsset);
    const ses=session.fromPartition('persist:pulse-desktop');const allowed=new Set(['clipboard-sanitized-write']);
    ses.setPermissionCheckHandler((_w,p,origin)=>isPulseURL(origin)&&allowed.has(p));
    ses.setPermissionRequestHandler(async(wc,p,cb,details)=>{
      // A talk window asks from its own window; the dashboard view asks from the main one.
      const parent=BrowserWindow.fromWebContents(wc)??win;
      if(!parent||!isPulseURL(wc.getURL())||!isPulseURL(details.requestingUrl))return cb(false);
      if(p==='clipboard-sanitized-write')return cb(true);if(!['media','notifications'].includes(p))return cb(false);
      if(p==='media'&&allowed.has('media'))return cb(true);
      const r=await dialog.showMessageBox(parent,{type:'question',message:`Allow Pulse to use ${p==='media'?'your microphone or camera':'notifications'}?`,buttons:['Don’t allow','Allow'],defaultId:0,cancelId:0});if(r.response===1)allowed.add(p);cb(r.response===1);
    });
    ses.on('will-download',(_e,item)=>item.setSaveDialogOptions({title:'Save from Pulse',properties:['createDirectory','showOverwriteConfirmation']}));
    menu();createWindow();{const talk=talkArg(process.argv);if(talk)openTalk(talk);}app.on('activate',()=>{
      if(activationAction(!!win)==='create')createWindow();
      else{win!.show();win!.focus();}
    });
  });app.on('before-quit',()=>{quitting=true;terminals.detachAll();});app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
}

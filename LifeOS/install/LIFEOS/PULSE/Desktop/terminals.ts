import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {existsSync,statSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,basename} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
import * as pty from 'node-pty';
import {sessionId,sessionTitle,terminalSize,shellEnvironment} from './workspace-policy';
import {invariant} from '../../TOOLS/Invariant';
import {pulseSessionTitle} from '../../TOOLS/PulseSessionTitle';
import {codexSessionTitle} from '../../CODEX/SessionTitle';
import {claudeModelForTerminal} from './session-transcript';
// Linux: tmux, the config folder, the shell and the clipboard come from linux.ts.
import {userInfo} from 'node:os';
import {isLinux,LINUX_TMUX,LINUX_TMUX_MISSING,linuxTmuxConfig,linuxTerminalDir,linuxShellEnvironment} from './linux';
const LINUX=isLinux(process.platform);
const exec=promisify(execFile);
// Linux: the system tmux.
const tmux=LINUX?LINUX_TMUX.find(existsSync):['/opt/homebrew/bin/tmux','/usr/local/bin/tmux'].find(existsSync);
// Linux: the user's login shell, and a PATH without the Homebrew prefix.
const env=LINUX?linuxShellEnvironment(shellEnvironment(process.env),process.env.PATH,userInfo().shell!):shellEnvironment(process.env);
export type TerminalInfo={id:string;title:string;command:string;directory:string;decoration?:{sessionName?:string;provider?:"Claude Code"|"Codex"|"LifeOS";model?:string;codexThreadId?:string;inactiveBg:string;inactiveFg:string;activeBg:string;activeFg:string}};
export class Terminals {
  private clients=new Map<string,pty.IPty>();
  private pending=new Map<string,number>();
  private generation=0;
  private attaching=new Map<string,number>();
  // The tmux server keeps as its command line whatever created it. Booted with the bundled config, that
  // line held the app-bundle path, so a name-based kill of the app (pkill -f "Pulse Desktop") would also
  // match the server and take every shell with it. Copy the config to a neutral path with no app name and
  // point the server at that instead; the server (already daemonized, so it outlives a normal force-quit)
  // now has nothing app-named on its command line for a stray sweep to catch.
  private stableConfig:string|null=null;
  constructor(private emit:(event:string,data:unknown)=>void,private config:string){}
  private configPath(){
    if(this.stableConfig)return this.stableConfig;
    if(!existsSync(this.config)){this.stableConfig=this.config;return this.config;}
    // Linux: the stable copy lives under ~/.local/share and swaps zsh and pbcopy for the login shell and wl-copy.
    if(LINUX){const dir=linuxTerminalDir(homedir());mkdirSync(dir,{recursive:true});const stable=join(dir,'tmux.conf');const next=linuxTmuxConfig(readFileSync(this.config,'utf8'),userInfo().shell!);if(!existsSync(stable)||readFileSync(stable,'utf8')!==next)writeFileSync(stable,next);this.stableConfig=stable;return stable;}
    const dir=join(homedir(),'Library/Application Support/LifeOS/pulse-terminal');mkdirSync(dir,{recursive:true});
    const stable=join(dir,'tmux.conf');const next=readFileSync(this.config,'utf8');
    if(!existsSync(stable)||readFileSync(stable,'utf8')!==next)writeFileSync(stable,next);
    this.stableConfig=stable;return stable;
  }
  private async run(args:string[]){
    // Linux: the missing-tmux message names the Linux installer.
    if(!tmux&&LINUX)throw new Error(LINUX_TMUX_MISSING.replace(/\.$/,', then reconnect.'));
    if(!tmux)throw new Error('tmux is required. Install it with brew install tmux, then reconnect.');
    return (await exec(tmux,['-L','pulse-desktop','-f',this.configPath(),...args],{env,timeout:5000,maxBuffer:1024*1024})).stdout.trim();
  }
  async list():Promise<TerminalInfo[]>{
    if(!tmux&&LINUX)throw new Error(LINUX_TMUX_MISSING);
    if(!tmux)throw new Error('tmux is required. Install it with brew install tmux.');
    let text='';
    try{text=await this.run(['list-sessions','-F','#{session_name}\t#{@pulse-title}\t#{pane_current_command}\t#{pane_current_path}\t#{@pulse-decoration}\t#{session_id}']);}
    catch(error){if(/no server running|error connecting|No such file/.test(String((error as any).stderr)))return [];throw error;}
    // tmux session IDs increase on creation; names contain random UUIDs.
    return text.split('\n').sort((a,b)=>Number(a.split('\t')[5]?.slice(1))-Number(b.split('\t')[5]?.slice(1))).map(line=>{const [id,title,command,directory,raw]=line.split('\t');let decoration:any;try{decoration=JSON.parse(raw);}catch{}const model=decoration?.provider==='Claude Code'||!decoration?.provider?claudeModelForTerminal(id):null;if(model)decoration={...decoration,provider:'Claude Code',model:decoration?.model||model};return {id,title:decoration?.title?pulseSessionTitle(decoration.title):title||'Terminal',command:command||'shell',directory:basename(directory||''),decoration};}).filter(s=>sessionId(s.id));
  }
  async create(cwd=homedir()){
    invariant(statSync(cwd).isDirectory(),'terminal working directory exists');
    const id='pulse-'+randomUUID().replaceAll('-','');
    invariant(sessionId(id),'owned session id');
    const title=(basename(cwd).replace(/[\x00-\x1f\x7f]/g,' ').trim()||'Terminal').slice(0,64);
    if((await this.list()).length)await this.run(['set-environment','-gu','NO_COLOR',';','set-environment','-gu','FORCE_COLOR',';','set-environment','-gu','TERMINFO']);
    await this.run(['new-session','-d','-s',id,'-e',`PULSE_TERMINAL_ID=${id}`,'-e','COLORTERM=truecolor','-c',cwd,'-x','100','-y','30',';','set-option','-t',id,'@pulse-title',title]);
    return id;
  }
  async rename(id:string,title:string){
    invariant(sessionId(id),'only rename owned terminals');
    let name=sessionTitle(title);
    let decoration:any;try{decoration=JSON.parse(await this.run(['show-option','-v','-t',id,'@pulse-decoration']));}catch{}
    if(decoration?.codexThreadId){
      name=name.toUpperCase();
      await codexSessionTitle(decoration.codexThreadId,name);
      decoration.sessionName=name;
    }
    const args=['set-option','-t',id,'@pulse-title',name];
    if(decoration){const glyph=String(decoration.title||'').match(/^\p{Extended_Pictographic}\uFE0F?/u)?.[0]||'';decoration.title=(glyph+' '+name).trim();args.push(';','set-option','-t',id,'@pulse-decoration',JSON.stringify(decoration));}
    await this.run(args);
  }
  async attach(id:string,cols:number,rows:number){
    invariant(sessionId(id),'only attach owned terminals');
    const size=terminalSize(cols,rows);
    const generation=this.generation;
    const version=(this.attaching.get(id)||0)+1;this.attaching.set(id,version);
    if(!(await this.list()).some(s=>s.id===id))throw new Error('This session has ended.');
    if(generation!==this.generation||version!==this.attaching.get(id))return;
    this.detach(id);
    const child=pty.spawn(tmux!,['-L','pulse-desktop','-f',this.configPath(),'attach-session','-t',id],{name:'xterm-256color',cols:size.cols,rows:size.rows,cwd:homedir(),env:env as Record<string,string>});
    this.clients.set(id,child);
    this.pending.set(id,0);
    child.onData(data=>{
      if(this.clients.get(id)!==child)return;
      const pending=(this.pending.get(id)||0)+data.length;this.pending.set(id,pending);
      if(pending>262144)child.pause();
      this.emit('terminal:data',{id,data});
    });
    child.onExit(()=>{if(this.clients.get(id)===child){this.clients.delete(id);this.emit('terminal:exit',{id});}});
  }
  write(id:string,data:string){
    invariant(sessionId(id)&&typeof data==='string'&&data.length<=65536,'valid terminal input');
    this.clients.get(id)?.write(data);
  }
  resize(id:string,cols:number,rows:number){
    invariant(sessionId(id),'only resize owned terminals');
    const s=terminalSize(cols,rows);this.clients.get(id)?.resize(s.cols,s.rows);
  }
  acknowledge(id:string,length:number){const pending=Math.max(0,(this.pending.get(id)||0)-length);this.pending.set(id,pending);if(pending<131072)this.clients.get(id)?.resume();}
  detach(id:string){const child=this.clients.get(id);if(child){this.clients.delete(id);this.pending.delete(id);child.kill();}}
  detachAll(){this.generation++;this.attaching.clear();for(const id of this.clients.keys())this.detach(id);}
  async end(id:string){
    invariant(sessionId(id),'only end owned terminals');
    await this.run(['kill-session','-t',id]);this.detach(id);
  }
}

import {mkdirSync, copyFileSync, cpSync, existsSync, realpathSync, rmSync, renameSync, readFileSync, chmodSync} from 'node:fs';
import {join, resolve, relative} from 'node:path';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {packager} from '@electron/packager';
import {invariant} from '../../TOOLS/Invariant';
import {BUNDLE_ID,DEFAULTS_BIN,pressAndHoldArgs} from './key-repeat';
import {terminalFontFile} from './terminal-font';
import {copyOptionalFonts} from './optional-fonts';
// Linux: build and install there too; what only Linux needs lives in linux.ts.
import {readdirSync,writeFileSync} from 'node:fs';
import {isLinux,linuxFontDirs,desktopEntry,linuxShortcutLabel} from './linux';
const LINUX=isLinux(process.platform);
const subdirs=(dir:string)=>{try{return readdirSync(dir,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>join(dir,d.name));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}};

const root=import.meta.dir;
// The upstream macOS prebuild is distributed without its executable bit.
const helper=join(root,`node_modules/node-pty/prebuilds/darwin-${process.arch}/spawn-helper`);
if(process.platform==='darwin'){invariant(existsSync(helper),'PTY spawn helper exists');chmodSync(helper,0o755);}
const dist=join(root,'dist');
function generatedDir(path: string) {
  invariant(path===join(root,'stage') || path===join(root,'dist'), 'only regenerate owned build directories');
  if(existsSync(path)) {
    invariant(realpathSync(path)===path, 'build directory must not be a symlink');
    rmSync(path,{recursive:true});
  }
  mkdirSync(path,{recursive:true});
}
generatedDir(dist);
const assets=join(root,'assets');mkdirSync(assets,{recursive:true});
const iconArg=process.argv.indexOf('--icon');
if(iconArg!==-1){
  invariant(!!process.argv[iconArg+1], '--icon needs a PNG path');
  copyFileSync(resolve(process.argv[iconArg+1]),join(assets,'icon.png'));
}
// Without --icon, the first build uses the LifeOS logo the dashboard ships.
const shippedIcon=join(root,'../Observability/public/lifeos-logo.png');
if(!existsSync(join(assets,'icon.png')) && existsSync(shippedIcon))copyFileSync(shippedIcon,join(assets,'icon.png'));
invariant(existsSync(join(assets,'icon.png')), 'supply the app icon with --icon <PNG>; the shipped dashboard logo is missing');
const fonts=join(root,'../Observability/public/fonts');
// The brand families are commercially licensed and are not in the public release: bundle whichever are installed, and the CSS font stacks fall back to system fonts for the rest.
const bundledFonts=copyOptionalFonts(fonts,assets,{'concourse_t3_regular-webfont.woff':'body.woff','advocate_34_narr_reg.woff2':'display.woff2','concourse_t3_bold.otf':'body-bold.otf','triplicate_a_code_regular.woff2':'mono.woff2'});
if(bundledFonts.length===0)console.warn('No brand fonts found; using system fonts.');
// The terminal font is bundled when kitty.conf names a family whose regular file is installed; otherwise the terminal uses its fixed-width fallback stack.
const kittyConf=join(homedir(),'.config/kitty/kitty.conf');
// Linux: look for the kitty font in the Linux font folders.
const terminalFile=LINUX?terminalFontFile(existsSync(kittyConf)?readFileSync(kittyConf,'utf8'):'',linuxFontDirs(homedir(),subdirs)):terminalFontFile(existsSync(kittyConf)?readFileSync(kittyConf,'utf8'):'',[join(homedir(),'Library/Fonts'),'/Library/Fonts']);
rmSync(join(assets,'terminal.ttf'),{force:true});
if(terminalFile)copyFileSync(terminalFile,join(assets,'terminal.ttf'));
else console.warn('No kitty terminal font file found; using the fallback terminal font.');
const result=await Bun.build({entrypoints:[join(root,'main.ts'),join(root,'preload.ts')],outdir:dist,target:'node',format:'cjs',naming:'[name].cjs',external:['electron','node-pty'],minify:false});
invariant(result.success, result.logs.map(String).join('\n'));
const renderer=await Bun.build({entrypoints:[join(root,'workspace.ts')],outdir:dist,target:'browser',naming:'workspace.js'});
invariant(renderer.success,renderer.logs.map(String).join('\n'));
for(const file of ['workspace.html','workspace.css','tmux.conf'])copyFileSync(join(root,file),join(dist,file));
// libghostty-vt: the wasm terminal core (pinned revision in ghostty/VERSION) plus its 112-byte PTY-reply trampoline and the symbols font. Plain read-only assets served through pulse-asset:.
mkdirSync(join(dist,'ghostty'));
for(const file of ['vendor/ghostty-vt.wasm','vendor/ghostty-write-pty.wasm','fonts/SymbolsNerdFontMono-Regular.woff2','VERSION'])copyFileSync(join(root,'ghostty',file),join(dist,'ghostty',file.split('/').pop()!));
// Linux: the offline page runs no script, so its shortcut labels are rewritten at build time.
copyFileSync(join(root,'offline.html'),join(dist,'offline.html'));
if(LINUX)writeFileSync(join(dist,'offline.html'),linuxShortcutLabel(readFileSync(join(root,'offline.html'),'utf8')));
cpSync(assets,join(dist,'assets'),{recursive:true});
// Linux: package for linux and install to ~/.local/share/pulse-desktop with a pulse-desktop.desktop launcher entry; a previous copy is moved to ~/.local/share/LifeOS/app-backups.
if(LINUX&&(process.argv.includes('--package')||process.argv.includes('--install'))){
  const stage=join(root,'stage');generatedDir(stage);
  cpSync(dist,join(stage,'dist'),{recursive:true});
  const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
  await Bun.write(join(stage,'package.json'),JSON.stringify({name:manifest.name,productName:manifest.productName,version:manifest.version,main:manifest.main,dependencies:{'node-pty':manifest.dependencies['node-pty']}}));
  cpSync(join(root,'node_modules/node-pty'),join(stage,'node_modules/node-pty'),{recursive:true});
  const paths=await packager({dir:stage,name:'Pulse Desktop',executableName:'pulse-desktop',platform:'linux',arch:process.arch as 'arm64'|'x64',electronVersion:manifest.devDependencies.electron,out:join(root,'release'),overwrite:true,prune:false,asar:{unpackDir:'node_modules/node-pty'},extraResource:[join(dist,'tmux.conf')]});
  invariant(paths.length===1,'one app folder produced');
  const built=paths[0];
  invariant(existsSync(join(built,'pulse-desktop')),'packager produced a launchable app');
  console.log(built);
  if(process.argv.includes('--install')){
    const share=join(homedir(),'.local/share');const dest=join(share,'pulse-desktop');
    if(existsSync(dest)){
      invariant(realpathSync(dest)===dest,'do not replace a symlinked app');
      invariant(existsSync(join(dest,'pulse-desktop'))&&existsSync(join(dest,'resources/tmux.conf')),'only replace our own app');
      const backups=join(share,'LifeOS/app-backups');mkdirSync(backups,{recursive:true});
      invariant(realpathSync(backups)===backups,'backup directory must not be a symlink');
      const backup=join(backups,`pulse-desktop-${Date.now()}`);
      invariant(!existsSync(backup),'backup must not overwrite an existing app');
      renameSync(dest,backup);
    }
    cpSync(built,dest,{recursive:true,verbatimSymlinks:true});
    copyFileSync(join(assets,'icon.png'),join(dest,'pulse-desktop.png'));
    const apps=join(share,'applications');mkdirSync(apps,{recursive:true});
    const entry=join(apps,'pulse-desktop.desktop');
    if(existsSync(entry)){
      invariant(realpathSync(entry)===entry,'do not write through a symlinked launcher entry');
      invariant(readFileSync(entry,'utf8').includes('StartupWMClass=pulse-desktop'),'only replace our own launcher entry');
    }
    writeFileSync(entry,desktopEntry(join(dest,'pulse-desktop'),join(dest,'pulse-desktop.png')));
    console.log(`Installed ${dest}`);
  }
  process.exit(0);
}
if(process.argv.includes('--package') || process.argv.includes('--install')) {
  invariant(process.platform==='darwin','this installer targets macOS');
  const packagedIcon=join(assets,'Pulse.icns');
  if(existsSync(packagedIcon))copyFileSync(packagedIcon,join(dist,'Pulse.icns'));
  else {
    const iconset=join(dist,'Pulse.iconset');mkdirSync(iconset);
    for(const size of [16,32,128,256,512])for(const scale of [1,2]){
      execFileSync('/usr/bin/sips',['-z',String(size*scale),String(size*scale),join(assets,'icon.png'),'--out',join(iconset,`icon_${size}x${size}${scale===2?'@2x':''}.png`)],{stdio:'ignore'});
    }
    execFileSync('/usr/bin/iconutil',['-c','icns',iconset,'-o',join(dist,'Pulse.icns')]);
  }
  const stage=join(root,'stage');generatedDir(stage);
  cpSync(dist,join(stage,'dist'),{recursive:true});
  const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
  await Bun.write(join(stage,'package.json'),JSON.stringify({name:manifest.name,productName:manifest.productName,version:manifest.version,main:manifest.main,dependencies:{'node-pty':manifest.dependencies['node-pty']}}));
  cpSync(join(root,'node_modules/node-pty'),join(stage,'node_modules/node-pty'),{recursive:true});
  const paths=await packager({dir:stage,name:'Pulse Desktop',platform:'darwin',arch:process.arch as 'arm64'|'x64',electronVersion:manifest.devDependencies.electron,out:join(root,'release'),overwrite:true,prune:false,asar:{unpackDir:'node_modules/node-pty'},extraResource:[join(dist,'tmux.conf')],icon:join(dist,'Pulse.icns'),appBundleId:'ai.lifeos.pulse.desktop',appCategoryType:'public.app-category.productivity',extendInfo:{NSMicrophoneUsageDescription:'Pulse uses the microphone when you choose a voice feature.',NSCameraUsageDescription:'Pulse uses the camera only when you grant access.'}});
  invariant(paths.length===1,'one app bundle produced');
  const bundle=join(paths[0],'Pulse Desktop.app');
  invariant(existsSync(join(bundle,'Contents/MacOS/Pulse Desktop')), 'packager produced a launchable app bundle');
  console.log(bundle);
  if(process.argv.includes('--install')){
    const apps='/Applications';mkdirSync(apps,{recursive:true});
    const dest=join(apps,'Pulse Desktop.app');
    invariant(!relative(realpathSync(apps),resolve(dest)).startsWith('..'),'install stays in Applications');
    if(existsSync(dest)){
      invariant(realpathSync(dest)===dest,'do not replace a symlinked app');
      const id=execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleIdentifier',join(dest,'Contents/Info.plist')],{encoding:'utf8'}).trim();
      invariant(id==='ai.lifeos.pulse.desktop','only replace our own app');
      const backups=join(homedir(),'Library/Application Support/LifeOS/App Backups.noindex');
      mkdirSync(backups,{recursive:true});
      invariant(realpathSync(backups)===backups,'backup directory must not be a symlink');
      const backup=join(backups,`Pulse Desktop-${Date.now()}.app`);
      invariant(!existsSync(backup),'backup must not overwrite an existing app');
      execFileSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',['-u',dest]);
      renameSync(dest,backup);
    }
    execFileSync('/usr/bin/ditto',[bundle,dest]);
    execFileSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',['-f',dest]);
    // Held keys repeat in the terminal only with macOS press-and-hold off for this bundle; set it before the first launch.
    execFileSync(DEFAULTS_BIN,pressAndHoldArgs(BUNDLE_ID));
    console.log(`Installed ${dest}`);
  }
}

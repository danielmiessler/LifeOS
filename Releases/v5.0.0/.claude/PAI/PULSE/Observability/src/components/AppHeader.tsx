"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Menu,
  X,
  Heart,
  Activity,
  DollarSign,
  Briefcase,
  FolderKanban,
  Target,
  Bot,
  UsersRound,
  Library,
  ScrollText,
  Zap,
  Webhook,
  TreePine,
  ShieldCheck,
  BarChart3,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useObserverMode } from "@/contexts/ObserverModeContext";
import { useAudioStreamContext } from "@/contexts/AudioStreamContext";

const lifeNav = [
  { href: "/telos", label: "TELOS", icon: Target },
  { href: "/life", label: "LIFE", icon: Heart },
  { href: "/work", label: "WORK", icon: FolderKanban },
  { href: "/health", label: "HEALTH", icon: Activity },
  { href: "/finances", label: "FINANCES", icon: DollarSign },
  { href: "/business", label: "BUSINESS", icon: Briefcase },
];

const systemNav = [
  { href: "/assistant", label: "Assistant", icon: Bot },
  { href: "/agents", label: "Agents", icon: UsersRound },
  { href: "/knowledge", label: "Knowledge", icon: Library },
  { href: "/docs", label: "Documentation", icon: ScrollText },
  { href: "/skills", label: "Skills", icon: Zap },
  { href: "/hooks", label: "Hooks", icon: Webhook },
  { href: "/arbol", label: "Arbol", icon: TreePine },
  { href: "/security", label: "Security", icon: ShieldCheck },
  { href: "/performance", label: "Perf", icon: BarChart3 },
];

export default function AppHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const { observerMode, toggleObserverMode } = useObserverMode();
  const { enabled: audioEnabled, connected: audioConnected, toggle: toggleAudio } = useAudioStreamContext();

  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const h = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) setMobileMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [mobileMenuOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const isSystemPage = systemNav.some((item) => pathname.startsWith(item.href));

  const fontStyle = { fontFamily: "'concourse-t3', sans-serif" };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md">
      {/* Primary nav — Life domains */}
      <div className="border-b border-slate-800/50">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-center h-14 gap-6">
            <Link href="/" className="flex items-center gap-3 shrink-0 absolute left-4 sm:left-6">
              <Image src="/pai-logo.png" alt="PAI" width={36} height={36} className="h-9 w-9 object-contain" />
              <span className="text-lg tracking-[0.25em] text-white" style={{ fontFamily: "'advocate-c14', sans-serif", fontWeight: 600 }}>
                PULSE
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {lifeNav.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-[14px] font-medium tracking-[0.15em] rounded-md transition-all duration-200",
                      active ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                    style={fontStyle}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 absolute right-4 sm:right-6">
              <button
                onClick={toggleAudio}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] tracking-[0.1em] transition-all duration-200",
                  audioEnabled
                    ? audioConnected
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "bg-blue-500/10 text-blue-500/60 border border-blue-500/20"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                )}
                title={
                  audioEnabled
                    ? audioConnected
                      ? "Browser audio ON — connected"
                      : "Browser audio ON — connecting…"
                    : "Enable browser audio for voice notifications"
                }
              >
                {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline" style={fontStyle}>AUDIO</span>
              </button>
              <button
                onClick={toggleObserverMode}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] tracking-[0.1em] transition-all duration-200",
                  observerMode
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                )}
                title={observerMode ? "Observer mode ON — sensitive data hidden" : "Toggle observer mode"}
              >
                {observerMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline" style={fontStyle}>OBSERVER</span>
              </button>
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="flex md:hidden items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary nav — System (always visible) */}
      <div className="border-b border-slate-800/30 bg-slate-950/60">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6">
          <nav className="hidden md:flex items-center justify-center gap-1 h-10 overflow-x-auto">
            {systemNav.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 text-[12px] tracking-[0.1em] rounded transition-colors shrink-0",
                    active ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div ref={mobileMenuRef} className="md:hidden border-b border-slate-800/50 bg-slate-950/95 backdrop-blur-md">
          <nav className="flex flex-col px-4 py-3 gap-1">
            <div className="text-xs uppercase tracking-wider text-slate-500 px-3 py-1">Life</div>
            {lifeNav.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}
                  className={cn("flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium tracking-[0.1em] rounded-lg transition-colors",
                    active ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                  )} style={fontStyle}>
                  <Icon className="w-4 h-4" />{item.label}
                </Link>
              );
            })}
            <div className="text-xs uppercase tracking-wider text-slate-500 px-3 py-1 mt-2">System</div>
            {systemNav.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}
                  className={cn("flex items-center gap-2.5 px-3 py-2 text-sm tracking-[0.1em] rounded-lg transition-colors",
                    active ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                  )}>
                  <Icon className="w-3.5 h-3.5" />{item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}

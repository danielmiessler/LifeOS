"use client";

import { useState, useEffect } from "react";
import type { Telos } from "./data";

// Subordinate tabs — warm, sentence-led.

interface SparkProps {
  points?: readonly number[];
  color?: string;
}

interface SubTabsProps {
  telos: Telos;
}

export function Spark({ points=[38,42,40,45,48,52,51,56,58,62], color='var(--accent)' }: SparkProps) {
  const W=160, H=36, max=Math.max(...points), min=Math.min(...points);
  const norm = (v: number, i: number)=>{
    const x = (i/(points.length-1))*W;
    const y = H - ((v-min)/Math.max(1,(max-min)))*H;
    return `${x},${y}`;
  };
  const last = points.at(-1) ?? points[points.length - 1] ?? 0;
  return (
    <svg width={W} height={H} className="spark">
      <polyline fill="none" stroke={color} strokeWidth="1.6" points={points.map(norm).join(' ')}/>
      <circle cx={W} cy={H-((last-min)/Math.max(1,(max-min)))*H} r="2.8" fill={color}/>
    </svg>
  );
}

const SPARK_SEEDS = {
  business:  [36,39,42,44,47,50,52,55,58,60,61,62],
  finances:  [48,49,51,53,54,57,58,59,60,61,61,62],
  health:    [58,60,62,64,65,66,68,69,70,70,71,71],
  work:      [30,31,34,36,38,40,42,43,45,46,47,48],
  life:      [82,81,80,79,78,78,77,77,77,78,77,77],
} as const;

type SubtabId = keyof typeof SPARK_SEEDS;

export function SubTabs({ telos }: SubTabsProps) {
  const [active, setActive] = useState<string>(telos.subtabs[0]?.id ?? 'business');
  useEffect(() => {
    if (!telos.subtabs.find(t => t.id === active)) {
      setActive(telos.subtabs[0]?.id ?? 'business');
    }
  }, [telos.subtabs, active]);
  const tab = telos.subtabs.find(t=>t.id===active);
  const dim = telos.dimensions.find(d=>d.id===tab?.dim);
  if (!tab || !dim) return null;
  const veloText =
    tab.velo > 0.2 ? `climbing about ${tab.velo.toFixed(1)}% a month` :
    tab.velo < -0.2 ? `slipping about ${Math.abs(tab.velo).toFixed(1)}% a month` :
    'holding roughly flat';
  const eta = tab.velo>0 ? Math.ceil((tab.ideal-tab.cur)/tab.velo) : null;
  return (
    <section className="subtabs">
      <header className="band-head">
        <div>
          <h2 className="band-title">The corners of life</h2>
          <p className="band-sub">Each area reports back to one of the six.</p>
        </div>
      </header>

      <div className="sub-nav">
        {telos.subtabs.map(t=>{
          const d = telos.dimensions.find(x=>x.id===t.dim);
          return (
            <button key={t.id} className={'sub-tab'+(t.id===active?' on':'')} onClick={()=>setActive(t.id as SubtabId)}>
              <span className="sub-swatch" style={{background:`var(${d?.color ?? '--accent'})`}}/>
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="sub-card">
        <p className="sub-cite">
          {tab.label} feeds <span style={{color:`var(${dim.color})`}}>{dim.label}</span>,
          currently sitting at <span className="mono">{tab.cur}</span> out of {tab.ideal} —
          &nbsp;{veloText}.{eta && ` At this pace it lands on ideal in about ${eta} months.`}
        </p>
        <div className="sub-body">
          <div className="sub-l">
            <p className="sub-top">{tab.top}</p>
            <div className="sub-kpis">
              <div className="kpi"><div className="k">where it is</div><div className="v mono">{tab.cur}<span className="u">/{tab.ideal}</span></div></div>
              <div className="kpi"><div className="k">the gap</div><div className="v mono">{tab.ideal-tab.cur}</div></div>
              <div className="kpi"><div className="k">per month</div><div className="v mono" style={{color:tab.velo>0?'var(--ok)':tab.velo<0?'var(--bad)':'var(--text-3)'}}>{tab.velo>0?'+':''}{tab.velo.toFixed(1)}</div></div>
              <div className="kpi"><div className="k">ideal by</div><div className="v mono">{eta?eta+'mo':'—'}</div></div>
            </div>
          </div>
          <div className="sub-r">
            <div className="spark-head">last twelve months</div>
            <Spark points={SPARK_SEEDS[active]} color={`var(${dim.color})`}/>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import type { Telos } from "./data";

// Horizon — mission line, warm and calm.

interface HorizonProps {
  telos: Telos;
  activeId: string;
  onChange: (id: string) => void;
  showIds: boolean;
}

export function Horizon({ telos, activeId, onChange, showIds }: HorizonProps) {
  const active = telos.missions.find(m=>m.id===activeId) || telos.missions[0];
  return (
    <section className="horizon">
      <div className="h-tabs">
        {telos.missions.map(m=>(
          <button key={m.id}
            className={'h-tab'+(m.id===activeId?' on':'')}
            onClick={()=>onChange(m.id)}>
            <span className="h-tab-horizon">{m.horizon}</span>
            {showIds && <span className="h-tab-id mono">{m.id}</span>}
          </button>
        ))}
      </div>
      <div className="h-body">
        <div className="h-label">Mission</div>
        <div className="h-title">{active.title}</div>
      </div>
      <div className="h-right">
        9 of 12 strategies are pointing the right way.
      </div>
    </section>
  );
}

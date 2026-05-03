// TELOS data model — 11 first-class primitives with bidirectional links.
// IdealState -> Problems -> Mission -> Goals -> Metrics -> Challenges -> Strategies -> Projects -> Work -> Team -> Budget

export interface Owner {
  name: string;
  day: string;
  streak: number;
}

export interface IdealState {
  horizon: string;
  note: string;
}

export interface Dimension {
  id: string;
  label: string;
  cur: number;
  ideal: number;
  velo: number;
  color: string;
}

export interface SnapshotMetric {
  id: string;
  label: string;
  v: number;
  of: number;
}

export interface Problem {
  id: string;
  title: string;
  note: string;
  severity: "high" | "med" | "low";
  affects: readonly string[];
}

export interface Mission {
  id: string;
  title: string;
  horizon: string;
  active?: boolean;
  addresses?: readonly string[];
}

export interface Goal {
  id: string;
  title: string;
  kpi: string;
  target: string;
  pct: number;
  delta: number;
  dims: readonly string[];
  metrics: readonly string[];
}

export interface Metric {
  id: string;
  label: string;
  value: string;
  unit: string;
  trend: number;
  spark: readonly number[];
  feeds: readonly string[];
  color: string;
}

export interface Challenge {
  id: string;
  title: string;
  note: string;
  blocks: readonly string[];
}

export interface Strategy {
  id: string;
  title: string;
  overcomes: readonly string[];
  implements: readonly string[];
  active?: boolean;
}

export interface Work {
  id: string;
  title: string;
  strategy: string;
  eta: string;
  status: "green" | "amber" | "red";
  owner: string;
}

export interface Project {
  id: string;
  title: string;
  strategy: string;
  dims: readonly string[];
  status: "green" | "amber" | "red";
  work: readonly Work[];
  team?: readonly string[];
}

export interface Team {
  id: string;
  name: string;
  role: string;
  kind: "human" | "agent";
  owns: readonly string[];
  avatar: string;
  note: string;
}

export interface Budget {
  id: string;
  kind: "money" | "time" | "attention";
  label: string;
  value: string;
  of: string;
  pct: number;
  funds: readonly string[];
  note: string;
  warn?: boolean;
}

export interface Recommendation {
  id: string;
  action: string;
  because: string;
  upstream: readonly string[];
  effort: string;
  impact: "high" | "med" | "low";
}

export interface StrandedWork {
  id: string;
  title: string;
  owner: string;
  age: string;
}

export interface StrandedGoal {
  id: string;
  title: string;
  reason: string;
}

export interface StrandedStrategy {
  id: string;
  title: string;
  reason: string;
}

export interface Stranded {
  work_no_goal: readonly StrandedWork[];
  goals_no_strategy: readonly StrandedGoal[];
  strategies_idle: readonly StrandedStrategy[];
}

export interface Subtab {
  id: string;
  label: string;
  dim: string;
  cur: number;
  ideal: number;
  velo: number;
  target: string;
  top: string;
}

export interface PreferenceContext {
  books: readonly string[];
  films: readonly string[];
  anime: readonly string[];
  characters: readonly string[];
  aphorisms: readonly string[];
  hobbies: readonly string[];
  literature: readonly string[];
  music: readonly string[];
}

export interface NarrativeSeed {
  days_into: number;
  push_name: string;
  current_work: string;
  via_strategy: string;
  addresses: string;
  moves_goal: string;
  serves_mission: string;
}

export interface Telos {
  owner: Owner;
  idealState: IdealState;
  dimensions: readonly Dimension[];
  snapshot: readonly SnapshotMetric[];
  problems: readonly Problem[];
  missions: readonly Mission[];
  goals: readonly Goal[];
  metrics: readonly Metric[];
  challenges: readonly Challenge[];
  strategies: readonly Strategy[];
  projects: readonly Project[];
  team: readonly Team[];
  budget: readonly Budget[];
  recommendations: readonly Recommendation[];
  stranded: Stranded;
  subtabs: readonly Subtab[];
  preferences: PreferenceContext;
  narrativeSeed: NarrativeSeed;
}

// ─────────────────────────────────────────────────────────────────
// SAMPLE TELOS DATA — replace via /interview or by rewriting this file.
// Every field below is a placeholder. Real Pulse content populates
// once you've run the TELOS interview and your data lands in
// PAI/USER/TELOS/. This file is the FIXTURE the dashboard renders
// before any user data exists.
// ─────────────────────────────────────────────────────────────────
export const TELOS = {
  owner: { name: 'Sample User', day: 'Mon · 1 Jan', streak: 7 },

  // 1. IDEAL STATE — six dimensions with targets
  idealState: {
    horizon: 'by Dec 2027',
    note: 'A sample target state measured across six dimensions.',
  },
  dimensions: [
    { id:'health',        label:'Health',        cur:71, ideal:90, velo:+1.2, color:'--health'        },
    { id:'money',         label:'Money',         cur:62, ideal:95, velo:+0.0, color:'--money'         },
    { id:'freedom',       label:'Freedom',       cur:54, ideal:90, velo:+3.1, color:'--freedom'       },
    { id:'creative',      label:'Creative',      cur:48, ideal:85, velo:+2.4, color:'--creative'      },
    { id:'relationships', label:'Relationships', cur:77, ideal:90, velo:-0.4, color:'--relationships' },
    { id:'rhythms',       label:'Rhythms',       cur:66, ideal:85, velo:+0.9, color:'--rhythms'       },
  ],

  snapshot: [
    { id:'mood',   label:'Mood',   v:7.4, of:10 },
    { id:'energy', label:'Energy', v:6.1, of:10 },
    { id:'focus',  label:'Focus',  v:8.2, of:10 },
  ],

  // 2. PROBLEMS — the systemic issues above Mission
  problems: [
    { id:'PB0', title:'Sample systemic problem A — tools fragmented across silos',
      note:'Sample note — context is scattered between calendars, inboxes, documents, and task lists.',
      severity:'high', affects:['M1','M2'] },
    { id:'PB1', title:'Sample systemic problem B — context lost between sessions',
      note:'Sample note — assistants and workflows reset too often and fail to preserve prior decisions.',
      severity:'high', affects:['M1'] },
    { id:'PB2', title:'Sample systemic problem C — execution stalls before completion',
      note:'Sample note — too many half-finished efforts reduce reliability and compound operational drag.',
      severity:'med', affects:['M1','M2'] },
    { id:'PB3', title:'Sample systemic problem D — durable knowledge decays too quickly',
      note:'Sample note — useful thinking often disappears into short-lived channels instead of reusable assets.',
      severity:'med', affects:['M2'] },
  ],

  // 3. MISSION — three horizons
  missions: [
    { id:'M0', title:'Live well and stay curious',                              horizon:'lifetime' },
    { id:'M1', title:'Help people make better decisions through accessible tools', horizon:'10y', active:true, addresses:['PB0','PB1','PB2'] },
    { id:'M2', title:'Build durable work over decades',                         horizon:'25y', addresses:['PB2','PB3'] },
  ],

  // 4. GOALS — outcomes serving Mission
  goals: [
    { id:'G0',  title:'Sample health goal — sleep target',        kpi:'6h58', target:'7h30', pct:74, delta:+2.1, dims:['health','rhythms'],        metrics:['MT0'] },
    { id:'G1',  title:'Sample health goal — weekly distance',     kpi:'18.4km', target:'25km', pct:61, delta:+1.4, dims:['health'],                metrics:['MT1'] },
    { id:'G2',  title:'Ship Sample Project A',                    kpi:'0 / 1k', target:'Jun', pct:12, delta:+12,  dims:['creative','money'],       metrics:['MT2','MT8'] },
    { id:'G3',  title:'Reach $X MRR target',                      kpi:'$18.2k', target:'$40k', pct:45, delta:+2.8, dims:['money','freedom'],       metrics:['MT3'] },
    { id:'G4',  title:'Sample creative goal — publish consistently', kpi:'19 / 50', target:'Dec', pct:38, delta:+4, dims:['creative'],             metrics:['MT4'] },
    { id:'G6',  title:'Sample work goal — focus-hour target',     kpi:'2h41', target:'4h00', pct:67, delta:+0.3, dims:['creative','rhythms'],      metrics:['MT5'] },
    { id:'G7',  title:'Coach 12 sample participants',             kpi:'3 / 12', target:'Dec', pct:25, delta:0,   dims:['relationships','creative'],metrics:['MT6'] },
    { id:'G8',  title:'Sample relationships goal — connection cadence', kpi:'1.4/wk', target:'2/wk', pct:70, delta:-0.1, dims:['relationships'], metrics:['MT7'] },
    { id:'G9',  title:'Sample completion rate goal',              kpi:'54%', target:'80%', pct:54, delta:+6,   dims:['creative','rhythms'],        metrics:['MT8'] },
    { id:'G10', title:'Sample runway goal',                       kpi:'7.8mo', target:'12mo', pct:65, delta:+0.4, dims:['money','freedom'],        metrics:['MT9'] },
  ],

  // 5. METRICS — first-class, tracked independently of Goals
  metrics: [
    { id:'MT0', label:'Sample sleep metric',        value:'6h58',  unit:'',     trend:+0.12, spark:[6.4,6.5,6.6,6.7,6.8,6.9,6.9,7.0,6.9,7.0,7.0,7.0], feeds:['G0'],     color:'--health'   },
    { id:'MT1', label:'Sample distance metric',     value:'18.4',  unit:'km',   trend:+1.4,  spark:[10,11,12,13,14,14,15,16,17,17,18,18],                 feeds:['G1'],     color:'--health'   },
    { id:'MT2', label:'Sample signups metric',      value:'124',   unit:'',     trend:+22,   spark:[0,0,2,6,14,28,44,62,80,98,112,124],                   feeds:['G2'],     color:'--creative' },
    { id:'MT3', label:'Sample MRR metric',          value:'$18.2k',unit:'',     trend:+2.8,  spark:[8.2,9.1,10.4,11.6,12.8,13.5,14.2,15.4,16.1,16.9,17.6,18.2], feeds:['G3'], color:'--money'   },
    { id:'MT4', label:'Sample writing metric',      value:'19',    unit:'/50',  trend:+4,    spark:[2,3,4,6,7,9,11,13,14,16,18,19],                       feeds:['G4'],     color:'--creative' },
    { id:'MT5', label:'Sample focus metric',        value:'2h41',  unit:'',     trend:+0.08, spark:[1.8,1.9,2.0,2.1,2.1,2.2,2.3,2.4,2.5,2.5,2.6,2.7],     feeds:['G6'],     color:'--rhythms'  },
    { id:'MT6', label:'Sample cohort metric',       value:'3',     unit:'/12',  trend:0,     spark:[0,1,1,2,2,2,3,3,3,3,3,3],                             feeds:['G7'],     color:'--relationships' },
    { id:'MT7', label:'Sample partner metric',      value:'1.4',   unit:'/wk',  trend:-0.1,  spark:[1.6,1.7,1.6,1.8,1.7,1.6,1.5,1.5,1.4,1.5,1.4,1.4],     feeds:['G8'],     color:'--relationships' },
    { id:'MT8', label:'Sample completion metric',   value:'54',    unit:'%',    trend:+6,    spark:[42,43,44,45,46,47,48,49,50,51,52,54],                 feeds:['G2','G9'],color:'--creative' },
    { id:'MT9', label:'Sample runway metric',       value:'7.8',   unit:'mo',   trend:+0.4,  spark:[5.1,5.5,5.9,6.1,6.4,6.7,6.9,7.1,7.3,7.5,7.7,7.8],     feeds:['G10'],    color:'--money'   },
  ],

  // 6. CHALLENGES
  challenges: [
    { id:'C0', title:'Sample challenge — context fragmentation', note:'Sample note — too many parallel threads dilute attention.', blocks:['G2','G6','G9'] },
    { id:'C1', title:'Mid-project pivot pattern',                 note:'Sample note — work often stalls in the final stretch before completion.', blocks:['G2','G4','G9'] },
    { id:'C2', title:'Sample challenge — revenue dependency',     note:'Sample note — too much reliance on a narrow set of income sources.',      blocks:['G3','G10'] },
    { id:'C3', title:'Sample challenge — sleep regression',       note:'Sample note — late routines reduce energy and recovery for multiple days.', blocks:['G0','G1','G6'] },
    { id:'C4', title:'Sample challenge — reactive inbox',         note:'Sample note — reactive communication crowds out focused work.',           blocks:['G6'] },
    { id:'C5', title:'Sample challenge — social drift',           note:'Sample note — relationships weaken when connection is left to chance.',   blocks:['G7','G8'] },
  ],

  // 7. STRATEGIES
  strategies: [
    { id:'S0',  title:'Define-done-first — WIP≤2, definition-of-done before start', overcomes:['C0','C1'], implements:['G2','G9'], active:true },
    { id:'S1',  title:'Sample diversification strategy',                            overcomes:['C2'],      implements:['G3','G10'] },
    { id:'S2',  title:'Sample evening routine',                                     overcomes:['C3'],      implements:['G0','G6'] },
    { id:'S3',  title:'Sample inbox cadence',                                       overcomes:['C0','C4'], implements:['G6'] },
    { id:'S4',  title:'Sample social cadence',                                      overcomes:['C5'],      implements:['G7','G8'] },
    { id:'S5',  title:'Sample writing cadence',                                     overcomes:['C1'],      implements:['G4'] },
    { id:'S6',  title:'Sample fitness cadence',                                     overcomes:['C3'],      implements:['G1'] },
    { id:'S7',  title:'Sample savings strategy',                                    overcomes:['C2'],      implements:['G10'] },
    { id:'S8',  title:'Sample focus blocks',                                        overcomes:['C0','C4'], implements:['G6','G9'] },
    { id:'S11', title:'Publish-progress-weekly — post sample notes weekly',         overcomes:['C1'],      implements:['G7'] },
  ],

  // 8. PROJECTS · 9. WORK
  projects: [
    { id:'P0', title:'Sample Project A — Build', strategy:'S0', dims:['creative','money'], status:'green',
      work:[
        { id:'W0', title:'Sample work item — define schema', strategy:'S0', eta:'2d', status:'green', owner:'D' },
        { id:'W1', title:'Sample work item — sync graph',    strategy:'S0', eta:'4d', status:'amber', owner:'K' },
        { id:'W2', title:'Sample work item — ship onboarding', strategy:'S0', eta:'7d', status:'amber', owner:'D' },
      ]},
    { id:'P1', title:'Sample Project B — Operate', strategy:'S0', dims:['creative','rhythms'], status:'green',
      work:[
        { id:'W3', title:'Sample work item — set defaults', strategy:'S0', eta:'today', status:'green', owner:'D' },
        { id:'W4', title:'Sample work item — adapt layout', strategy:'S0', eta:'3d', status:'green', owner:'D' },
      ]},
    { id:'P2', title:'Sample Project C — Write', strategy:'S5', dims:['creative'], status:'amber',
      work:[
        { id:'W5', title:'Sample work item — revise draft', strategy:'S5', eta:'Sat', status:'amber', owner:'D' },
      ]},
    { id:'P3', title:'Sample Project D — Automate', strategy:'S7', dims:['money','freedom'], status:'amber',
      work:[
        { id:'W6', title:'Sample work item — automate transfer', strategy:'S7', eta:'5d', status:'amber', owner:'K' },
        { id:'W7', title:'Sample work item — update ledger',     strategy:'S7', eta:'9d', status:'red',   owner:'D' },
      ]},
    { id:'P4', title:'Sample Project E — Routine', strategy:'S6', dims:['health'], status:'green',
      work:[
        { id:'W8', title:'Sample work item — maintain routine', strategy:'S6', eta:'ongoing', status:'green', owner:'D' },
      ]},
    { id:'P5', title:'Sample Project F — Cohort', strategy:'S11', dims:['relationships','creative'], status:'red',
      work:[
        { id:'W9',  title:'Sample work item — draft curriculum', strategy:'S11', eta:'14d', status:'red', owner:'D' },
        { id:'W10', title:'Sample work item — publish intake form', strategy:'S11', eta:'21d', status:'red', owner:'K' },
      ]},
  ],

  // 10. TEAM — humans + agents
  team: [
    { id:'T0', name:'Sample User', role:'Principal', kind:'human',
      owns:['P0','P1','P2','P4','P5'], avatar:'U', note:'Sets mission, makes the calls.' },
    { id:'T1', name:'Sample DA',   role:'Primary DA · creative + strategy', kind:'agent',
      owns:['P0','P3'], avatar:'A', note:'Design, research, coding, scaffolding.' },
    { id:'T2', name:'Sample Worker A', role:'Sample worker · {{WORKER_HOST_1}}',  kind:'agent',
      owns:['P4','P5'], avatar:'B', note:'Sample worker — operational tasks.' },
    { id:'T3', name:'Sample Worker B', role:'Sample worker · {{WORKER_HOST_2}}', kind:'agent',
      owns:[], avatar:'C', note:'Sample worker — fleet member.' },
    { id:'T4', name:'Sample Worker C', role:'Sample worker · {{WORKER_HOST_3}}',  kind:'agent',
      owns:[], avatar:'D', note:'Sample worker — fleet member.' },
  ],

  // 11. BUDGET — money, time, attention
  budget: [
    { id:'B0', kind:'money',     label:'Monthly burn',        value:'$6.4k',  of:'$8.0k', pct:80,
      funds:['P0','P3'], note:'Sample note — operating costs for active sample projects.' },
    { id:'B1', kind:'money',     label:'Runway reserve',      value:'$51k',   of:'$96k',  pct:53,
      funds:['G10'], note:'Sample note — reserve progress toward the sample runway target.' },
    { id:'B2', kind:'money',     label:'Giving',              value:'$420',   of:'$1.0k', pct:42,
      funds:['G13'], note:'Sample note — placeholder giving allocation against a sample target.' },
    { id:'B3', kind:'time',      label:'Deep-work hours/wk',  value:'18h',    of:'28h',   pct:64,
      funds:['P0','P1','P2'], note:'Sample note — focus time reserved for sample build and writing work.' },
    { id:'B4', kind:'time',      label:'Meeting load/wk',     value:'4h',     of:'6h',    pct:67,
      funds:['P5'], note:'Sample note — collaboration time allocated to the sample cohort project.' },
    { id:'B5', kind:'attention', label:'Active threads',      value:'11',     of:'2',     pct:100, warn:true,
      funds:['P0','P1','P2','P3','P5'], note:'Sample note — active threads exceed the sample WIP cap.' },
    { id:'B6', kind:'attention', label:'Inbox pressure',      value:'63',     of:'20',    pct:100, warn:true,
      funds:['G12'], note:'Sample note — inbox load is above the sample operating threshold.' },
    { id:'B7', kind:'attention', label:'Phone screen-time',   value:'1h52',   of:'1h00',  pct:100, warn:true,
      funds:[], note:'Sample note — attention drift is above the sample limit.' },
  ],

  // Auto-generated next moves
  recommendations: [
    { id:'R0',
      action:'Sample recommendation — reduce active work before adding new scope.',
      because:'Sample reason — references upstream B5, S0, C0, G2, G6, G9, and M1.',
      upstream:['B5','S0','C0','G2','G6','G9','M1'],
      effort:'1h planning · ongoing discipline',
      impact:'high' },
    { id:'R1',
      action:'Sample recommendation — schedule focused work blocks early.',
      because:'Sample reason — references upstream MT5, S8, G6, G9, and M1.',
      upstream:['MT5','S8','G6','G9','M1'],
      effort:'5 min calendar',
      impact:'high' },
    { id:'R2',
      action:'Sample recommendation — complete the current draft before opening a new thread.',
      because:'Sample reason — references upstream P2, S5, MT4, MT8, G4, G9, and M2.',
      upstream:['P2','S5','MT4','MT8','G4','G9','M2'],
      effort:'3h writing',
      impact:'med' },
  ],

  // Orphans
  stranded: {
    work_no_goal: [
      { id:'W11', title:'Sample orphan work — rebuild asset', owner:'D', age:'43d' },
      { id:'W12', title:'Sample orphan work — migrate notes', owner:'D', age:'12d' },
    ],
    goals_no_strategy: [
      { id:'G13', title:'Sample orphan goal — giving target',   reason:'no strategy attached' },
      { id:'G14', title:'Sample orphan goal — retreat cadence', reason:'only partial — S9 covers cadence, not funding' },
    ],
    strategies_idle: [
      { id:'S10', title:'Sample idle strategy — attention reset', reason:'no tracked work in 21d' },
    ],
  },

  subtabs: [
    { id:'health',        label:'Health',        dim:'health',        cur:71, ideal:90, velo:+1.2, target:'Dec',
      top:'Sample subtab summary — recovery and sleep indicators placeholder' },
    { id:'money',         label:'Money',         dim:'money',         cur:62, ideal:95, velo:+2.8, target:'2027',
      top:'Sample subtab summary — operating margin and reserve progress placeholder' },
    { id:'freedom',       label:'Freedom',       dim:'freedom',       cur:54, ideal:90, velo:+3.1, target:'2027',
      top:'Sample subtab summary — runway and autonomy indicators placeholder' },
    { id:'creative',      label:'Creative',      dim:'creative',      cur:48, ideal:85, velo:+2.4, target:'Dec',
      top:'Sample subtab summary — active work, focus protection, and blockers placeholder' },
    { id:'relationships', label:'Relationships', dim:'relationships', cur:77, ideal:90, velo:-0.4, target:'ongoing',
      top:'Sample subtab summary — relationship cadence and outreach placeholder' },
  ],

  // Preference context — quiet strip below primitives
  preferences: {
    books:      ['Sample Book A', 'Sample Book B', 'Sample Book C', 'Sample Book D'],
    films:      ['Sample Film A', 'Sample Film B', 'Sample Film C', 'Sample Film D'],
    anime:      ['Sample Anime A', 'Sample Anime B', 'Sample Anime C'],
    characters: ['Sample Character A', 'Sample Character B', 'Sample Character C', 'Sample Character D'],
    aphorisms:  ['Sample Aphorism — replace via /interview', 'Sample Aphorism B — replace via /interview', 'Sample Aphorism C — replace via /interview'],
    hobbies:    ['Sample Hobby A', 'Sample Hobby B', 'Sample Hobby C', 'Sample Hobby D'],
    literature: ['Sample Author A', 'Sample Author B', 'Sample Author C', 'Sample Author D'],
    music:      ['Sample Artist A', 'Sample Artist B', 'Sample Artist C', 'Sample Artist D'],
  },

  narrativeSeed: {
    days_into: 5,
    push_name: 'sample build push',
    current_work: 'W0',
    via_strategy: 'S0',
    addresses: 'C1',
    moves_goal: 'G9',
    serves_mission: 'M1',
  }
} as const satisfies Telos;

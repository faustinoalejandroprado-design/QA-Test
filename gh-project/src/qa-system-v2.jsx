import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Papa from "papaparse";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from "recharts";

let D = null;

// =================================================================
// DATA LAYER & CONSTANTS
// =================================================================
let WEEKS = [];
let LATEST_WIDX = 0;
const SCS = ["WW", "TL", "RB", "VT", "AI", "OW", "SS", "AP", "PR", "LV"];
const SC_FULL = { WW: "Warm Welcome", TL: "Thoughtful Listening", RB: "Removing Barriers", VT: "Valuing Time", AI: "Accurate Info", OW: "Ownership", SS: "Sales as Service", AP: "Apologies", PR: "Professionalism", LV: "Living Values" };
const GOAL = 72;

const SC_MAP = {
  "Warm Welcome & Respect": "WW", "Thoughtful Listening": "TL", "Understanding & Removing Barriers": "RB",
  "Valuing the Customer's Time & Reducing Effort": "VT", "Accurate Information & Transparency": "AI",
  "Ownership & Follow-Through": "OW", "Sales as Service": "SS", "Apologies & Gratitude": "AP",
  "Professionalism & Positive Intent": "PR", "Living Our Values": "LV"
};

function getWeekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff)).toISOString().substring(0, 10);
}

function processFiles(csvText, rosterTabs) {
  const csv = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const tlMap = {};
  if (rosterTabs.leadership) {
    Papa.parse(rosterTabs.leadership, { header: true, skipEmptyLines: true }).data.forEach(row => {
      const email = (row["Email"] || "").toString().trim().toLowerCase();
      const name = row["Full Name"] || "";
      const role = (row["Role"] || "").toString();
      const location = (row["Location"] || "").toString();
      if (email && name && role.includes("Team Lead")) {
        const site = location.includes("Mexico") ? "HMO" : location.includes("Jamaica") ? "JAM" : "PAN";
        tlMap[email] = { name, location, site };
      }
    });
  }

  const agentSup = {};
  [rosterTabs.ccMexico, rosterTabs.ccJamaica, rosterTabs.act].forEach(tabCsv => {
    if (!tabCsv) return;
    Papa.parse(tabCsv, { header: true, skipEmptyLines: true }).data.forEach(row => {
      const email = (row["Email"] || "").toString().trim().toLowerCase();
      const supervisor = (row["Supervisor"] || "").toString().trim().toLowerCase();
      if (email && supervisor) agentSup[email] = supervisor;
    });
  });

  const cfs = csv.data.filter(r => r["Scorecard Name"] === "Customer First Scorecard" && (r["Email"] || "").includes("contractor."));
  if (!cfs.length) return { error: "No contractor evaluations found." };

  const interactions = {};
  cfs.forEach(r => {
    const iid = r["Interaction ID"];
    if (!interactions[iid]) {
      interactions[iid] = {
        id: iid, agent: r["Name"], email: r["Email"].trim().toLowerCase(),
        qa: r["Taker Name"], score: parseFloat(r["Overall Review Score"]) || 0,
        channel: (r["Channel"] || "").substring(0, 3) || "???",
        date: r["Time Started"], sc: {}, proc: null, notes: null,
        comments: r["Comments"] || ""
      };
    }
    const q = r["Question Text"] || "";
    if (SC_MAP[q]) interactions[iid].sc[SC_MAP[q]] = r["Answer Text"];
    if (q === "Follows Procedures") interactions[iid].proc = r["Answer Text"] === "Yes";
    if (q.includes("Notes in Gladly")) interactions[iid].notes = r["Answer Text"] === "Yes";
  });

  const weekSet = new Set();
  Object.values(interactions).forEach(i => weekSet.add(getWeekStart(i.date)));
  const weeks = [...weekSet].sort();
  const weekLabels = weeks.map(w => new Date(w + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }));

  const agentData = {};
  Object.values(interactions).forEach(int => {
    if (!agentData[int.email]) agentData[int.email] = { name: int.agent, email: int.email, interactions: [], channels: [] };
    agentData[int.email].interactions.push(int);
    agentData[int.email].channels.push(int.channel);
  });

  const tlGroups = {};
  Object.values(agentData).forEach(ad => {
    const w = weeks.map(wk => {
      const wi = ad.interactions.filter(i => getWeekStart(i.date) === wk);
      return wi.length ? +(wi.reduce((s, i) => s + i.score, 0) / wi.length).toFixed(1) : null;
    });
    const sc = {};
    SCS.forEach(code => {
      const answers = ad.interactions.map(i => i.sc[code]).filter(Boolean);
      const met = answers.filter(a => a === "Met" || a === "Exceed").length;
      sc[code] = answers.length ? Math.round(met / answers.length * 100) : 0;
    });
    const procA = ad.interactions.filter(i => i.proc !== null);
    const pr = procA.length ? Math.round(procA.filter(i => i.proc).length / procA.length * 100) : 0;
    const notesA = ad.interactions.filter(i => i.notes !== null);
    const nt = notesA.length ? Math.round(notesA.filter(i => i.notes).length / notesA.length * 100) : 0;
    const ch = Object.entries(ad.channels.reduce((a,c)=>{a[c]=(a[c]||0)+1;return a},{})).sort((a,b)=>b[1]-a[1])[0]?.[0] || "???";

    const supEmail = agentSup[ad.email] || "";
    const tlInfo = tlMap[supEmail];
    const tlKey = tlInfo ? supEmail : "_unassigned";
    if (!tlGroups[tlKey]) tlGroups[tlKey] = { name: tlInfo ? tlInfo.name : "Unassigned", site: tlInfo ? tlInfo.site : "???", agents: [] };
    tlGroups[tlKey].agents.push({ n: ad.name, email: ad.email, w, sc, pr, nt, ch, interactions: ad.interactions });
  });

  const qaData = {};
  Object.values(interactions).forEach(int => {
    if(!qaData[int.qa]) qaData[int.qa] = { name: int.qa, scores: [], weeklyScores: {} };
    qaData[int.qa].scores.push(int.score);
    const wk = getWeekStart(int.date);
    if(!qaData[int.qa].weeklyScores[wk]) qaData[int.qa].weeklyScores[wk] = [];
    qaData[int.qa].weeklyScores[wk].push(int.score);
  });

  const qas = Object.values(qaData).map(q => {
    const avg = +(q.scores.reduce((s,v)=>s+v,0)/q.scores.length).toFixed(1);
    const sd = +Math.sqrt(q.scores.reduce((s,v)=>s+(v-avg)**2,0)/q.scores.length).toFixed(1);
    const weeklyAvgs = weeks.map(wk => {
      const ws = q.weeklyScores[wk] || [];
      return ws.length ? +(ws.reduce((s,v)=>s+v,0)/ws.length).toFixed(1) : null;
    });
    return { name: q.name, n: q.scores.length, avg, sd, w: weeklyAvgs };
  });

  return { weeks: weekLabels, rawWeeks: weeks, tls: Object.values(tlGroups).sort((a,b)=>a.name.localeCompare(b.name)), qas, stats: { agents: Object.keys(agentData).length } };
}

// =================================================================
// COMPUTATION ENGINE
// =================================================================
function slope(a) {
  const pts = a.w.map((v, i) => v != null ? [i, v] : null).filter(Boolean);
  if (pts.length < 3) return 0;
  const n = pts.length, sx = pts.reduce((s, p) => s + p[0], 0), sy = pts.reduce((s, p) => s + p[1], 0);
  const sxy = pts.reduce((s, p) => s + p[0] * p[1], 0), sxx = pts.reduce((s, p) => s + p[0] * p[0], 0);
  return +((n * sxy - sx * sy) / (n * sxx - sx * sx)).toFixed(2);
}

function classify(a, wIdx) {
  const avg = a.w[wIdx];
  if (avg == null) return "no_data";
  const s = slope(a);
  if (avg >= GOAL) return "stable";
  if (avg >= 65 && s > 0.3) return "convertible";
  if (avg >= 60 && Math.abs(s) <= 0.5) return "stagnant";
  if (s < -0.5) return "regressing";
  if (avg < 60) return "critical";
  return "stagnant";
}

// =================================================================
// DESIGN SYSTEM
// =================================================================
const C = {
  bg: "#080810", panel: "#0c0c1a", card: "#111126", card2: "#151528", border: "rgba(255,255,255,0.06)",
  text: "#e4e4f0", dim: "#7a7aa0", muted: "#3d3d60",
  green: "#10b981", amber: "#f59e0b", red: "#ef4444", blue: "#5b7fff", purple: "#8b5cf6", cyan: "#06b6d4"
};

const cs = { background: `linear-gradient(145deg,${C.card} 0%,${C.card2} 100%)`, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 };
const scoreColor = s => s >= 72 ? C.green : s >= 65 ? C.cyan : s >= 60 ? C.amber : C.red;
const clsColor = { convertible: C.green, stable: C.blue, stagnant: C.amber, regressing: C.red, critical: C.red, no_data: C.muted };
const clsLabel = { convertible: "Convertible", stable: "Stable \u226572", stagnant: "Stagnant", regressing: "Regressing", critical: "Critical", no_data: "No Data" };

// =================================================================
// VIEWS & COMPONENTS
// =================================================================

function AgentView({ agent, wIdx }) {
  const [selIntId, setSelIntId] = useState(null);
  const avg = agent.w[wIdx];
  const tr = wIdx > 0 && agent.w[wIdx-1] ? +(avg - agent.w[wIdx-1]).toFixed(1) : null;
  const selInt = agent.interactions?.find(i => i.id === selIntId);

  if (avg == null) return <div style={cs}>No data for this week.</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <KpiCard value={avg} label="Current Score" color={scoreColor(avg)} delta={tr} />
        <KpiCard value={agent.pr + "%"} label="Procedures" color={agent.pr >= 80 ? C.green : C.red} />
        <KpiCard value={agent.nt + "%"} label="Gladly Notes" color={agent.nt >= 80 ? C.green : C.red} />
        <KpiCard value={slope(agent)} label="Velocity" color={slope(agent) >= 0 ? C.green : C.red} />
      </div>

      <div style={{ ...cs, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: "1px" }}>Interaction Scorecard</div>
          <select value={selIntId || ""} onChange={e => setSelIntId(e.target.value)} 
            style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}`, fontSize: 12, padding: "5px 10px", borderRadius: 6 }}>
            <option value="">Select an interaction...</option>
            {agent.interactions.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0, 10).map(i => (
              <option key={i.id} value={i.id}>{new Date(i.date).toLocaleDateString()} - {i.channel} ({i.score})</option>
            ))}
          </select>
        </div>

        {selInt ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ background: "rgba(255,255,255,0.02)", padding: 15, borderRadius: 8 }}>
              {SCS.map(sc => (
                <div key={sc} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
                  <span style={{ color: C.dim }}>{SC_FULL[sc]}</span>
                  <span style={{ color: selInt.sc[sc] === "Met" || selInt.sc[sc] === "Exceed" ? C.green : C.red, fontWeight: 700 }}>{selInt.sc[sc] || "N/A"}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "rgba(255,255,255,0.02)", padding: 15, borderRadius: 8, flex: 1 }}>
                <div style={{ fontSize: 9, color: C.cyan, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>QA Comments</div>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {selInt.comments || "No comments provided for this evaluation."}
                </div>
              </div>
              <div style={{ fontSize: 10, color: C.muted, textAlign: "right" }}>Evaluated by: {selInt.qa}</div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 40, color: C.muted, border: `1px dashed ${C.border}`, borderRadius: 8 }}>
            Select an interaction from the dropdown to view comments and category details.
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ value, label, color, delta }) {
  return (
    <div style={{ ...cs, flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: C.dim, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: color, fontFamily: "monospace" }}>{value}</span>
        {delta != null && <span style={{ fontSize: 11, fontWeight: 600, color: delta >= 0 ? C.green : C.red }}>{delta > 0 ? "+" : ""}{delta}</span>}
      </div>
    </div>
  );
}

// =================================================================
// MAIN SYSTEM ENGINE
// =================================================================

export default function QASystem() {
  const [data, setData] = useState(null);
  const [wIdx, setWIdx] = useState(0);
  const [selTL, setSelTL] = useState(null);
  const [selAgent, setSelAgent] = useState(null);
  const [loading, setLoading] = useState(true);

  const DEFAULT_QA = "1tH-SwH7OAdMSU-odErm6h8TF2kxCJN1veJ9fhmCzEJU";
  const DEFAULT_ROSTER = "1oY85yRMRQCTsWxzvH43aJsmWsWxLH6PS";

  // Función para sincronizar el estado desde la URL
  const syncFromHash = useCallback((currentData) => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const tlName = params.get("tl");
    const agentEmail = params.get("agent");

    if (tlName) {
      const foundTL = currentData.tls.find(t => t.name === tlName);
      setSelTL(foundTL);
      if (agentEmail && foundTL) {
        setSelAgent(foundTL.agents.find(a => a.email === agentEmail));
      } else {
        setSelAgent(null);
      }
    } else {
      setSelTL(null);
      setSelAgent(null);
    }
  }, []);

  // Función para actualizar la URL sin recargar
  const updateHash = (tl, agent) => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    if (tl) params.set("tl", tl.name); else params.delete("tl");
    if (agent) params.set("agent", agent.email); else params.delete("agent");
    window.history.pushState(null, "", "#" + params.toString());
  };

  useEffect(() => {
    async function load() {
      try {
        const qaUrl = `https://docs.google.com/spreadsheets/d/${DEFAULT_QA}/gviz/tq?tqx=out:csv`;
        const rosUrl = `https://docs.google.com/spreadsheets/d/${DEFAULT_ROSTER}/gviz/tq?tqx=out:csv&sheet=Leadership`;
        const rosMxUrl = `https://docs.google.com/spreadsheets/d/${DEFAULT_ROSTER}/gviz/tq?tqx=out:csv&sheet=CC%20MEXICO`;
        const rosJamUrl = `https://docs.google.com/spreadsheets/d/${DEFAULT_ROSTER}/gviz/tq?tqx=out:csv&sheet=CC%20JAMAICA`;
        const rosActUrl = `https://docs.google.com/spreadsheets/d/${DEFAULT_ROSTER}/gviz/tq?tqx=out:csv&sheet=ADVANCE%20CARE%20TEAM`;
        
        const responses = await Promise.all([fetch(qaUrl), fetch(rosUrl), fetch(rosMxUrl), fetch(rosJamUrl), fetch(rosActUrl)]);
        const texts = await Promise.all(responses.map(r => r.text()));
        
        const result = processFiles(texts[0], { 
          leadership: texts[1], 
          ccMexico: texts[2], 
          ccJamaica: texts[3], 
          act: texts[4] 
        });

        D = result;
        setData(result);
        setWIdx(result.weeks.length - 1);
        syncFromHash(result);
        setLoading(false);
      } catch (e) { console.error("Error loading data:", e); }
    }
    load();

    const handlePopState = () => { if (D) syncFromHash(D); };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [syncFromHash]);

  if (loading) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.text }}>
      <img src="https://raw.githubusercontent.com/NextSkill-Icons/logo/main/logo.png" alt="NextSkill" 
           style={{ height: 100, marginBottom: 20, filter: C.bg === "#080810" ? "brightness(0) invert(1)" : "none" }} />
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "2px", animation: "pulse 1.5s infinite" }}>NextSkill</div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
    </div>
  );

  const crumbs = [{ label: "Campaign", onClick: () => { setSelTL(null); setSelAgent(null); updateHash(null, null); } }];
  if (selTL) crumbs.push({ label: selTL.name, onClick: () => { setSelAgent(null); updateHash(selTL, null); } });
  if (selAgent) crumbs.push({ label: selAgent.n, onClick: () => {} });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: C.panel, padding: "16px 28px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>QA Performance System</h1>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              {crumbs.map((c, i) => (
                <span key={i} style={{ fontSize: 11, color: i === crumbs.length - 1 ? C.text : C.dim, cursor: "pointer" }} onClick={c.onClick}>
                  {i > 0 && " > "} {c.label}
                </span>
              ))}
            </div>
          </div>
          <select value={wIdx} onChange={e => setWIdx(+e.target.value)} style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}`, padding: "6px 12px", borderRadius: 6 }}>
            {data.weeks.map((w, i) => <option key={i} value={i}>{w}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding: "20px 28px", maxWidth: 1400, margin: "0 auto" }}>
        {selAgent ? (
          <AgentView agent={selAgent} wIdx={wIdx} />
        ) : selTL ? (
          <div style={cs}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.dim, textTransform: "uppercase", marginBottom: 15 }}>Agents under {selTL.name}</div>
            {selTL.agents.filter(a => a.w[wIdx] != null).sort((a,b)=>b.w[wIdx]-a.w[wIdx]).map(a => (
              <div key={a.email} onClick={() => { setSelAgent(a); updateHash(selTL, a); }} 
                style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, marginBottom: 6, cursor: "pointer" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{a.n}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(a.w[wIdx]), fontFamily: "monospace" }}>{a.w[wIdx]}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 15 }}>
            {data.tls.map(tl => {
              const active = tl.agents.filter(a => a.w[wIdx] != null);
              const avg = active.length ? (active.reduce((s,a)=>s+a.w[wIdx],0)/active.length).toFixed(1) : "0";
              return (
                <div key={tl.name} onClick={() => { setSelTL(tl); updateHash(tl, null); }} style={{ ...cs, cursor: "pointer" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{tl.name}</div>
                  <div style={{ fontSize: 10, color: C.dim, marginBottom: 12 }}>{tl.site} | {active.length} Active Agents</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: scoreColor(avg), fontFamily: "monospace" }}>{avg}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

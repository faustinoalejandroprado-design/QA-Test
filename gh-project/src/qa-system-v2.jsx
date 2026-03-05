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
      const location = (row["Location"] || "").toString();
      if (email && name && (row["Role"] || "").includes("Team Lead")) {
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
    if (!agentData[int.email]) agentData[int.email] = { name: int.agent, email: int.email, interactions: [] };
    agentData[int.email].interactions.push(int);
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

    const supEmail = agentSup[ad.email] || "";
    const tlInfo = tlMap[supEmail];
    const tlKey = tlInfo ? supEmail : "_unassigned";
    if (!tlGroups[tlKey]) tlGroups[tlKey] = { name: tlInfo ? tlInfo.name : "Unassigned", site: tlInfo ? tlInfo.site : "???", agents: [] };
    tlGroups[tlKey].agents.push({ n: ad.name, email: ad.email, w, sc, pr, nt, ch: ad.interactions[0]?.channel, interactions: ad.interactions });
  });

  return { weeks: weekLabels, rawWeeks: weeks, tls: Object.values(tlGroups), stats: { agents: Object.keys(agentData).length } };
}

// =================================================================
// DESIGN SYSTEM & UI COMPONENTS
// =================================================================
const C = {
  bg: "#080810", panel: "#0c0c1a", card: "#111126", border: "rgba(255,255,255,0.06)",
  text: "#e4e4f0", dim: "#7a7aa0", muted: "#3d3d60",
  green: "#10b981", amber: "#f59e0b", red: "#ef4444", blue: "#5b7fff", purple: "#8b5cf6", cyan: "#06b6d4"
};

const cs = { background: `linear-gradient(145deg,${C.card} 0%,#151528 100%)`, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 };
const scoreColor = s => s >= 72 ? C.green : s >= 65 ? C.cyan : s >= 60 ? C.amber : C.red;

function KpiCard({ value, label, color, delta }) {
  return (
    <div style={{ ...cs, flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: C.dim, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: color, fontFamily: "monospace" }}>{value}</span>
        {delta != null && <span style={{ fontSize: 10, color: delta >= 0 ? C.green : C.red }}>{delta > 0 ? "+" : ""}{delta}</span>}
      </div>
    </div>
  );
}

// =================================================================
// VIEWS
// =================================================================

function AgentView({ agent, wIdx }) {
  const [selIntId, setSelIntId] = useState(null);
  const avg = agent.w[wIdx];
  const selInt = agent.interactions?.find(i => i.id === selIntId);

  if (avg == null) return <div style={cs}>No data for this week.</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <KpiCard value={avg} label="Current Score" color={scoreColor(avg)} />
        <KpiCard value={agent.pr + "%"} label="Procedures" color={agent.pr >= 80 ? C.green : C.red} />
        <KpiCard value={agent.nt + "%"} label="Notes" color={agent.nt >= 80 ? C.green : C.red} />
      </div>

      <div style={{ ...cs, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.dim, textTransform: "uppercase" }}>Scorecard Detail</div>
          <select value={selIntId || ""} onChange={e => setSelIntId(e.target.value)} style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}`, fontSize: 11, borderRadius: 4 }}>
            <option value="">Select Interaction...</option>
            {agent.interactions.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(i => (
              <option key={i.id} value={i.id}>{new Date(i.date).toLocaleDateString()} - {i.channel} ({i.score})</option>
            ))}
          </select>
        </div>

        {selInt ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, background: "rgba(0,0,0,0.2)", padding: 15, borderRadius: 8 }}>
            <div>
              {SCS.map(sc => (
                <div key={sc} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: C.dim }}>{SC_FULL[sc]}</span>
                  <span style={{ color: selInt.sc[sc] === "Met" ? C.green : C.red, fontWeight: 700 }}>{selInt.sc[sc] || "N/A"}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.dim, textTransform: "uppercase", marginBottom: 5 }}>QA Comments</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.4, background: "rgba(255,255,255,0.02)", padding: 10, borderRadius: 6, minHeight: 80 }}>
                {selInt.comments || "No comments available."}
              </div>
              <div style={{ marginTop: 10, fontSize: 10, color: C.dim }}>Evaluator: {selInt.qa}</div>
            </div>
          </div>
        ) : <div style={{ textAlign: "center", color: C.muted, padding: 20 }}>Select an interaction to see the full scorecard</div>}
      </div>
    </div>
  );
}

// ... (CampaignView y TLView simplificados para el ejemplo)
function CampaignView({ data, wIdx, onSelectTL }) {
  return (
    <div style={cs}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Team Leaders</div>
      {data.tls.map(tl => (
        <div key={tl.name} onClick={() => onSelectTL(tl)} style={{ padding: 10, background: "rgba(255,255,255,0.02)", marginBottom: 5, borderRadius: 6, cursor: "pointer" }}>
          {tl.name} ({tl.site})
        </div>
      ))}
    </div>
  );
}

function TLView({ tl, wIdx, onSelectAgent }) {
  return (
    <div style={cs}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Agents under {tl.name}</div>
      {tl.agents.filter(a => a.w[wIdx] != null).map(a => (
        <div key={a.email} onClick={() => onSelectAgent(a)} style={{ padding: 10, background: "rgba(255,255,255,0.02)", marginBottom: 5, borderRadius: 6, cursor: "pointer", display: "flex", justifyContent: "space-between" }}>
          <span>{a.n}</span>
          <span style={{ color: scoreColor(a.w[wIdx]) }}>{a.w[wIdx]}</span>
        </div>
      ))}
    </div>
  );
}

// =================================================================
// MAIN APP WITH NAVIGATION LOGIC
// =================================================================
export default function QASystem() {
  const [data, setData] = useState(null);
  const [wIdx, setWIdx] = useState(0);
  const [selTL, setSelTL] = useState(null);
  const [selAgent, setSelAgent] = useState(null);
  const [loading, setLoading] = useState(true);

  const DEFAULT_QA = "1tH-SwH7OAdMSU-odErm6h8TF2kxCJN1veJ9fhmCzEJU";
  const DEFAULT_ROSTER = "1oY85yRMRQCTsWxzvH43aJsmWsWxLH6PS";

  // Sincronización de URL (Historial del navegador)
  const syncFromHash = useCallback((currentData) => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const tlName = params.get("tl");
    const agentEmail = params.get("agent");

    if (tlName) {
      const tl = currentData.tls.find(t => t.name === tlName);
      setSelTL(tl);
      if (agentEmail && tl) {
        setSelAgent(tl.agents.find(a => a.email === agentEmail));
      } else {
        setSelAgent(null);
      }
    } else {
      setSelTL(null);
      setSelAgent(null);
    }
  }, []);

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
        const [qaRes, rosRes] = await Promise.all([fetch(qaUrl), fetch(rosUrl)]);
        const qaText = await qaRes.text();
        const rosText = await rosRes.text();
        const result = processFiles(qaText, { leadership: rosText });
        D = result;
        setData(result);
        setWIdx(result.weeks.length - 1);
        syncFromHash(result);
        setLoading(false);
      } catch (e) { console.error(e); }
    }
    load();

    const handlePop = () => { if (D) syncFromHash(D); };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [syncFromHash]);

  if (loading) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.text }}>
      <img src="https://raw.githubusercontent.com/NextSkill-Icons/logo/main/logo.png" alt="NextSkill" style={{ height: 80, marginBottom: 20, filter: "brightness(0) invert(1)" }} />
      <div style={{ fontSize: 18, fontWeight: 600, animation: "pulse 1.5s infinite" }}>NextSkill</div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "sans-serif" }}>
      <div style={{ background: C.panel, padding: "15px 25px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}>
        <h1 onClick={() => { setSelTL(null); setSelAgent(null); updateHash(null, null); }} style={{ fontSize: 16, cursor: "pointer" }}>NextSkill QA</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <select value={wIdx} onChange={e => setWIdx(+e.target.value)} style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4 }}>
            {data.weeks.map((w, i) => <option key={i} value={i}>{w}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding: 25, maxWidth: 1200, margin: "0 auto" }}>
        {selAgent ? <AgentView agent={selAgent} wIdx={wIdx} /> :
         selTL ? <TLView tl={selTL} wIdx={wIdx} onSelectAgent={a => { setSelAgent(a); updateHash(selTL, a); }} /> :
         <CampaignView data={data} wIdx={wIdx} onSelectTL={t => { setSelTL(t); updateHash(t, null); }} />}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from "recharts";
import Papa from "papaparse";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3qt-rkXHja3wwv6HSx3Xi2V1I-NMrOa6VNrjAAFNt2SITNLmCb0gBWtdzUFDCDg/pub?gid=1321743990&single=true&output=csv";

const C = {
  bg: "#0b0e14", card: "#161b22", border: "#30363d", text: "#c9d1d9",
  dim: "#8b949e", blue: "#58a6ff", purple: "#bc8cff", green: "#3fb950", red: "#f85149", orange: "#d29922", muted: "#484f58"
};

const App = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wIdx, setWIdx] = useState(6);
  const [filter, setFilter] = useState("all"); // all, critical, convertible, top
  const [lastSync, setLastSync] = useState("");

  useEffect(() => {
    const fetchData = () => {
      Papa.parse(SHEET_URL, {
        download: true, header: true, skipEmptyLines: true,
        complete: (res) => {
          const tlsMap = {};
          res.data.forEach(row => {
            const tl = row['Team Leader'] || "Unknown";
            if (!tlsMap[tl]) tlsMap[tl] = { name: tl, site: row['Site'], agents: [] };
            tlsMap[tl].agents.push({
              n: row['Agent'],
              site: row['Site'],
              tlName: tl,
              pr: parseFloat(row['QA Score']) || 0,
              nt: parseFloat(row['Net Score']) || 0,
              w: [row['Week 1'], row['Week 2'], row['Week 3'], row['Week 4'], row['Week 5'], row['Week 6'], row['Week 7']].map(v => v === "" ? null : parseFloat(v)),
              sc: { WW: row['WW'], TL: row['TL'], RB: row['RB'], VT: row['VT'], AI: row['AI'], OW: row['OW'], SS: row['SS'], AP: row['AP'], PR: row['PR'], LV: row['LV'] }
            });
          });
          setData({ tls: Object.values(tlsMap) });
          setLastSync(new Date().toLocaleTimeString());
          setLoading(false);
        }
      });
    };
    fetchData();
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    let all = [];
    data.tls.forEach(t => t.agents.forEach(a => all.push(a)));
    
    // Segmentación
    const critical = all.filter(a => (a.w[wIdx] || 0) < 70 && a.w[wIdx] !== null);
    const convertible = all.filter(a => (a.w[wIdx] || 0) >= 70 && (a.w[wIdx] || 0) < 85);
    const top = all.filter(a => (a.w[wIdx] || 0) >= 90);

    return { all, critical, convertible, top, avg: (all.reduce((s, x) => s + (x.w[wIdx] || 0), 0) / all.filter(a => a.w[wIdx] !== null).length).toFixed(1) };
  }, [data, wIdx]);

  // Identificador de áreas de oportunidad (Misses)
  const getMisses = (sc) => {
    return Object.entries(sc)
      .filter(([_, val]) => val !== null && val < 85)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2);
  };

  if (loading) return <div style={{background:C.bg, color:C.blue, height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace'}}>⚡ LOADING AGENT INTELLIGENCE...</div>;

  const filteredList = filter === "critical" ? stats.critical : filter === "convertible" ? stats.convertible : filter === "top" ? stats.top : stats.all;

  return (
    <div style={{background:C.bg, color:C.text, minHeight:'100vh', fontFamily:'Inter, sans-serif', paddingBottom: 50}}>
      {/* HEADER */}
      <div style={{padding:"12px 28px", background:C.card, borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:100}}>
        <div style={{fontSize:12, fontWeight:700, color:C.blue}}>QA SYSTEM v2.1 <span style={{color:C.dim, fontWeight:400, marginLeft:10}}>Sync: {lastSync}</span></div>
        <div style={{display:'flex', gap:6}}>
          {[1,2,3,4,5,6,7].map((w, i) => (
            <button key={w} onClick={() => setWIdx(i)} style={{padding:"4px 10px", borderRadius:4, border:`1px solid ${wIdx===i?C.blue:C.border}`, background:wIdx===i?`${C.blue}22`:C.bg, color:wIdx===i?C.blue:C.dim, fontSize:10, cursor:'pointer'}}>W{w}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"24px 28px", maxWidth:1200, margin:'0 auto'}}>
        {/* KPI CARDS INTERACTIVAS */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16, marginBottom:32}}>
          <div onClick={() => setFilter("all")} style={{cursor:'pointer', padding:20, background:C.card, borderRadius:8, border:`1px solid ${filter==='all'?C.blue:C.border}`, transition:'0.2s'}}>
            <div style={{fontSize:10, color:C.dim, marginBottom:4}}>CAMP. AVERAGE</div>
            <div style={{fontSize:24, fontWeight:700, color:C.blue}}>{stats.avg}%</div>
          </div>
          <div onClick={() => setFilter("critical")} style={{cursor:'pointer', padding:20, background:C.card, borderRadius:8, border:`1px solid ${filter==='critical'?C.red:C.border}`, transition:'0.2s'}}>
            <div style={{fontSize:10, color:C.dim, marginBottom:4}}>CRITICAL ({"<"}70%)</div>
            <div style={{fontSize:24, fontWeight:700, color:C.red}}>{stats.critical.length}</div>
          </div>
          <div onClick={() => setFilter("convertible")} style={{cursor:'pointer', padding:20, background:C.card, borderRadius:8, border:`1px solid ${filter==='convertible'?C.orange:C.border}`, transition:'0.2s'}}>
            <div style={{fontSize:10, color:C.dim, marginBottom:4}}>CONVERTIBLE (70-85%)</div>
            <div style={{fontSize:24, fontWeight:700, color:C.orange}}>{stats.convertible.length}</div>
          </div>
          <div onClick={() => setFilter("top")} style={{cursor:'pointer', padding:20, background:C.card, borderRadius:8, border:`1px solid ${filter==='top'?C.green:C.border}`, transition:'0.2s'}}>
            <div style={{fontSize:10, color:C.dim, marginBottom:4}}>TOP PERFORMERS</div>
            <div style={{fontSize:24, fontWeight:700, color:C.green}}>{stats.top.length}</div>
          </div>
        </div>

        {/* LISTA DINÁMICA DE ACCIÓN */}
        <div style={{background:C.card, borderRadius:8, border:`1px solid ${C.border}`, overflow:'hidden'}}>
          <div style={{padding:16, borderBottom:`1px solid ${C.border}`, background:`${C.border}33`}}>
            <h3 style={{fontSize:13, margin:0, color:C.dim}}>MOSTRANDO: <span style={{color:C.text}}>{filter.toUpperCase()} AGENTS</span></h3>
          </div>
          <div style={{maxHeight:600, overflowY:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <thead>
                <tr style={{textAlign:'left', color:C.dim, fontSize:11, borderBottom:`1px solid ${C.border}`}}>
                  <th style={{padding:16}}>AGENT / TL</th>
                  <th style={{padding:16}}>SCORE W{wIdx+1}</th>
                  <th style={{padding:16}}>AREAS OF OPPORTUNITY (MISSES)</th>
                  <th style={{padding:16}}>TREND</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map(ag => {
                  const currentW = ag.w[wIdx] || 0;
                  const prevW = wIdx > 0 ? ag.w[wIdx-1] : null;
                  const trend = prevW !== null ? (currentW - prevW).toFixed(1) : null;
                  const misses = getMisses(ag.sc);

                  return (
                    <tr key={ag.n} style={{borderBottom:`1px solid ${C.border}`, transition:'0.1s'}} onMouseEnter={e => e.currentTarget.style.background="#ffffff05"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                      <td style={{padding:16}}>
                        <div style={{fontWeight:600}}>{ag.n}</div>
                        <div style={{fontSize:10, color:C.dim}}>{ag.tlName} • {ag.site}</div>
                      </td>
                      <td style={{padding:16, fontWeight:700, color: currentW < 70 ? C.red : currentW < 85 ? C.orange : C.green}}>
                        {currentW}%
                      </td>
                      <td style={{padding:16}}>
                        <div style={{display:'flex', gap:8}}>
                          {misses.length > 0 ? misses.map(([m, v]) => (
                            <div key={m} style={{padding:'4px 8px', background:`${C.red}15`, borderRadius:4, border:`1px solid ${C.red}33`, fontSize:10}}>
                              <span style={{color:C.dim}}>{m}:</span> <span style={{color:C.red, fontWeight:600}}>{v}%</span>
                            </div>
                          )) : <span style={{color:C.green, fontSize:10}}>● All metrics above 85%</span>}
                        </div>
                      </td>
                      <td style={{padding:16, fontSize:11}}>
                        {trend !== null ? (
                          <span style={{color: trend > 0 ? C.green : C.red}}>
                            {trend > 0 ? `▲ +${trend}` : `▼ ${trend}`}%
                          </span>
                        ) : '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;

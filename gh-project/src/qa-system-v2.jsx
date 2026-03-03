import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import Papa from "papaparse";

// CONFIGURACIÓN
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3qt-rkXHja3wwv6HSx3Xi2V1I-NMrOa6VNrjAAFNt2SITNLmCb0gBWtdzUFDCDg/pub?gid=1321743990&single=true&output=csv";
const CACHE_KEY = "qa_system_snapshot_v3";
const CACHE_TIME = 12 * 60 * 60 * 1000; // 12 horas

const C = {
  bg: "#0b0e14", card: "#161b22", border: "#30363d", text: "#c9d1d9",
  dim: "#8b949e", blue: "#58a6ff", purple: "#bc8cff", green: "#3fb950", 
  red: "#f85149", orange: "#d29922", muted: "#484f58"
};

const App = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wIdx, setWIdx] = useState(6);
  const [filter, setFilter] = useState("all");
  const [syncInfo, setSyncInfo] = useState("");

  // --- MOTOR DE CARGA OPTIMIZADO ---
  const fetchData = (force = false) => {
    const cached = localStorage.getItem(CACHE_KEY);
    const lastUpdate = localStorage.getItem(CACHE_KEY + "_time");
    const now = new Date().getTime();

    if (!force && cached && lastUpdate && (now - lastUpdate < CACHE_TIME)) {
      try {
        setData(JSON.parse(cached));
        setSyncInfo(`Modo Snapshot: ${new Date(parseInt(lastUpdate)).toLocaleTimeString()}`);
        setLoading(false);
        return;
      } catch (e) { localStorage.removeItem(CACHE_KEY); }
    }

    setSyncInfo("Descargando base de datos...");
    Papa.parse(SHEET_URL, {
      download: true,
      header: true,
      worker: true, // Procesa en hilo separado para no congelar el navegador
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (results.data.length === 0) {
          setSyncInfo("Error: Archivo vacío");
          setLoading(false);
          return;
        }
        
        // Transformación pesada fuera del hilo principal de renderizado
        const transformed = transformAndClean(results.data);
        localStorage.setItem(CACHE_KEY, JSON.stringify(transformed));
        localStorage.setItem(CACHE_KEY + "_time", now.toString());
        
        setData(transformed);
        setSyncInfo("Sincronización exitosa");
        setLoading(false);
      }
    });
  };

  useEffect(() => { fetchData(); }, []);

  // --- LIMPIADOR DE DATOS DE ALTO RENDIMIENTO ---
  const transformAndClean = (rows) => {
    const parseNum = (v) => {
      if (v === undefined || v === null || v === "") return null;
      const clean = v.toString().replace(/[%, ]/g, "");
      const num = parseFloat(clean);
      return isNaN(num) ? null : num;
    };

    const tlsMap = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const tl = row['Team Leader'] || row['TL'];
      if (!tl) continue;

      if (!tlsMap[tl]) {
        tlsMap[tl] = { name: tl, site: row['Site'] || 'N/A', agents: [] };
      }

      tlsMap[tl].agents.push({
        n: row['Agent'] || 'Unknown',
        site: row['Site'],
        tlName: tl,
        w: [
          parseNum(row['Week 1']), parseNum(row['Week 2']), parseNum(row['Week 3']),
          parseNum(row['Week 4']), parseNum(row['Week 5']), parseNum(row['Week 6']), parseNum(row['Week 7'])
        ],
        sc: {
          WW: parseNum(row['WW']), TL: parseNum(row['TL']), RB: parseNum(row['RB']),
          VT: parseNum(row['VT']), AI: parseNum(row['AI']), OW: parseNum(row['OW']),
          SS: parseNum(row['SS']), AP: parseNum(row['AP']), PR: parseNum(row['PR']),
          LV: parseNum(row['LV'])
        }
      });
    }
    return { tls: Object.values(tlsMap) };
  };

  // --- CÁLCULOS DINÁMICOS ---
  const stats = useMemo(() => {
    if (!data) return null;
    let allAgents = [];
    data.tls.forEach(t => t.agents.forEach(a => allAgents.push(a)));

    const activeInWeek = allAgents.filter(a => a.w[wIdx] !== null);
    const critical = activeInWeek.filter(a => a.w[wIdx] < 70);
    const convertible = activeInWeek.filter(a => a.w[wIdx] >= 70 && a.w[wIdx] < 85);
    const top = activeInWeek.filter(a => a.w[wIdx] >= 90);

    const sum = activeInWeek.reduce((s, a) => s + a.w[wIdx], 0);
    const avg = activeInWeek.length ? (sum / activeInWeek.length).toFixed(1) : 0;

    return { all: activeInWeek, critical, convertible, top, avg };
  }, [data, wIdx]);

  if (loading) return (
    <div style={{background:C.bg, color:C.blue, height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:20, fontWeight:800, letterSpacing:2, marginBottom:10}}>SYNCING LIVE DATA</div>
        <div style={{color:C.dim, fontSize:10}}>{syncInfo.toUpperCase()}</div>
      </div>
    </div>
  );

  const filteredList = filter === "critical" ? stats.critical : filter === "convertible" ? stats.convertible : filter === "top" ? stats.top : stats.all;

  return (
    <div style={{background:C.bg, color:C.text, minHeight:'100vh', fontFamily:'-apple-system, sans-serif'}}>
      {/* BARRA DE ESTADO */}
      <div style={{padding:"8px 28px", background:C.card, borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{fontSize:9, color:C.dim, letterSpacing:1}}>ESTADO: {syncInfo}</div>
        <button onClick={() => {setLoading(true); fetchData(true);}} style={{background:'none', border:`1px solid ${C.muted}`, color:C.dim, fontSize:9, padding:'2px 8px', borderRadius:4, cursor:'pointer'}}>
          ACTUALIZAR NUBE ↻
        </button>
      </div>

      <div style={{padding:"20px 28px", maxWidth:1200, margin:'0 auto'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
          <h1 style={{fontSize:16, fontWeight:800}}>QA INTELLIGENCE <span style={{color:C.blue}}>v2.1</span></h1>
          <div style={{display:'flex', gap:4}}>
            {[1,2,3,4,5,6,7].map((w, i) => (
              <button key={w} onClick={() => setWIdx(i)} style={{padding:"4px 10px", borderRadius:4, border:`1px solid ${wIdx===i?C.blue:C.border}`, background:wIdx===i?`${C.blue}22`:C.bg, color:wIdx===i?C.blue:C.dim, fontSize:10, cursor:'pointer'}}>W{w}</button>
            ))}
          </div>
        </div>

        {/* INDICADORES CLAVE */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginBottom:24}}>
          {[
            { id: 'all', label: 'CAMPAIGN AVG', val: stats.avg + '%', color: C.blue },
            { id: 'critical', label: 'CRITICAL', val: stats.critical.length, color: C.red },
            { id: 'convertible', label: 'CONVERTIBLE', val: stats.convertible.length, color: C.orange },
            { id: 'top', label: 'TOP PERFORMERS', val: stats.top.length, color: C.green }
          ].map(card => (
            <div key={card.id} onClick={() => setFilter(card.id)} style={{
              cursor:'pointer', padding:16, background:C.card, borderRadius:8, border:`1px solid ${filter===card.id?card.color:C.border}`,
              transition:'0.2s'
            }}>
              <div style={{fontSize:9, color:C.dim, fontWeight:700}}>{card.label}</div>
              <div style={{fontSize:22, fontWeight:800, color:card.color}}>{card.val}</div>
            </div>
          ))}
        </div>

        {/* TABLA DE ACCIÓN */}
        <div style={{background:C.card, borderRadius:8, border:`1px solid ${C.border}`, overflow:'hidden'}}>
          <div style={{padding:12, background:`${C.border}22`, borderBottom:`1px solid ${C.border}`, fontSize:11, fontWeight:600}}>
            FOCO: {filter.toUpperCase()} ({filteredList.length} AGENTES)
          </div>
          <div style={{maxHeight:550, overflowY:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
              <thead style={{position:'sticky', top:0, background:C.card, zIndex:1}}>
                <tr style={{textAlign:'left', color:C.dim, fontSize:10, borderBottom:`1px solid ${C.border}`}}>
                  <th style={{padding:12}}>IDENTIFICACIÓN</th>
                  <th style={{padding:12}}>SCORE</th>
                  <th style={{padding:12}}>OPORTUNIDADES (MISSES)</th>
                  <th style={{padding:12}}>TENDENCIA</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map(ag => {
                  const score = ag.w[wIdx];
                  const prev = wIdx > 0 ? ag.w[wIdx-1] : null;
                  const trend = (prev !== null && score !== null) ? (score - prev).toFixed(1) : null;
                  const misses = Object.entries(ag.sc)
                    .filter(([_, v]) => v !== null && v < 85)
                    .sort((a, b) => a[1] - b[1])
                    .slice(0, 2);

                  return (
                    <tr key={ag.n} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:12}}>
                        <div style={{fontWeight:600}}>{ag.n}</div>
                        <div style={{fontSize:9, color:C.dim}}>{ag.tlName} • {ag.site}</div>
                      </td>
                      <td style={{padding:12, fontWeight:800, color: score < 70 ? C.red : score < 85 ? C.orange : C.green}}>
                        {score}%
                      </td>
                      <td style={{padding:12}}>
                        <div style={{display:'flex', gap:4}}>
                          {misses.map(([m, v]) => (
                            <div key={m} style={{padding:'2px 5px', background:`${C.red}10`, border:`1px solid ${C.red}30`, borderRadius:4, fontSize:9}}>
                              <span style={{color:C.dim}}>{m}:</span> <span style={{color:C.red}}>{v}%</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{padding:12, fontSize:10, fontWeight:700}}>
                        {trend !== null ? (
                          <span style={{color: trend >= 0 ? C.green : C.red}}>
                            {trend >= 0 ? `▲ +${trend}` : `▼ ${trend}`}%
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

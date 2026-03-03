import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import Papa from "papaparse";

// CONFIGURACIÓN
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3qt-rkXHja3wwv6HSx3Xi2V1I-NMrOa6VNrjAAFNt2SITNLmCb0gBWtdzUFDCDg/pub?gid=1321743990&single=true&output=csv";
const CACHE_KEY = "qa_system_data_v2";
const CACHE_TIME = 12 * 60 * 60 * 1000; // 12 horas

const C = {
  bg: "#0b0e14", card: "#161b22", border: "#30363d", text: "#c9d1d9",
  dim: "#8b949e", blue: "#58a6ff", purple: "#bc8cff", green: "#3fb950", 
  red: "#f85149", orange: "#d29922", muted: "#484f58"
};

const App = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wIdx, setWIdx] = useState(6); // W7 por defecto
  const [filter, setFilter] = useState("all");
  const [syncInfo, setSyncInfo] = useState("");

  // --- LÓGICA DE CARGA CON CACHÉ ---
  const fetchData = (force = false) => {
    const cached = localStorage.getItem(CACHE_KEY);
    const lastUpdate = localStorage.getItem(CACHE_KEY + "_time");
    const now = new Date().getTime();

    if (!force && cached && lastUpdate && (now - lastUpdate < CACHE_TIME)) {
      setData(JSON.parse(cached));
      const timeStr = new Date(parseInt(lastUpdate)).toLocaleTimeString();
      setSyncInfo(`Usando snapshot local (${timeStr})`);
      setLoading(false);
    } else {
      setSyncInfo("Sincronizando con Google Sheets...");
      Papa.parse(SHEET_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const transformed = transformAndClean(results.data);
          localStorage.setItem(CACHE_KEY, JSON.stringify(transformed));
          localStorage.setItem(CACHE_KEY + "_time", now.toString());
          setData(transformed);
          setSyncInfo("Datos actualizados ahora mismo");
          setLoading(false);
        },
        error: () => {
          setSyncInfo("Error de conexión. Intenta de nuevo.");
          setLoading(false);
        }
      });
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- LIMPIADOR DE DATOS (Solución a los 0's y Formatos) ---
  const transformAndClean = (rows) => {
    const parseNum = (val) => {
      if (val === undefined || val === null || val === "") return null;
      const clean = val.toString().replace(/[%, ]/g, "");
      const num = parseFloat(clean);
      return isNaN(num) ? null : num;
    };

    const tlsMap = {};
    rows.forEach(row => {
      const tl = row['Team Leader'] || "Unknown TL";
      if (!tlsMap[tl]) tlsMap[tl] = { name: tl, site: row['Site'] || 'N/A', agents: [] };

      tlsMap[tl].agents.push({
        n: row['Agent'] || 'Sin Nombre',
        site: row['Site'],
        tlName: tl,
        pr: parseNum(row['QA Score']) || 0,
        nt: parseNum(row['Net Score']) || 0,
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
    });
    return { tls: Object.values(tlsMap) };
  };

  // --- CÁLCULOS DE SEGMENTACIÓN ---
  const stats = useMemo(() => {
    if (!data) return null;
    let allAgents = [];
    data.tls.forEach(t => t.agents.forEach(a => allAgents.push(a)));

    const activeInWeek = allAgents.filter(a => a.w[wIdx] !== null);
    const critical = activeInWeek.filter(a => a.w[wIdx] < 70);
    const convertible = activeInWeek.filter(a => a.w[wIdx] >= 70 && a.w[wIdx] < 85);
    const top = activeInWeek.filter(a => a.w[wIdx] >= 90);

    const avg = activeInWeek.length 
      ? (activeInWeek.reduce((s, a) => s + a.w[wIdx], 0) / activeInWeek.length).toFixed(1) 
      : 0;

    return { all: activeInWeek, critical, convertible, top, avg };
  }, [data, wIdx]);

  const getTopMisses = (sc) => {
    return Object.entries(sc)
      .filter(([_, v]) => v !== null && v < 85)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2);
  };

  if (loading) return (
    <div style={{background:C.bg, color:C.blue, height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace'}}>
      <div style={{textAlign:'center'}}>
        <div style={{marginBottom:15, fontSize:18}}>⚡ SYSTEM INITIALIZING</div>
        <div style={{color:C.dim, fontSize:11}}>{syncInfo}</div>
      </div>
    </div>
  );

  const filteredList = filter === "critical" ? stats.critical : filter === "convertible" ? stats.convertible : filter === "top" ? stats.top : stats.all;

  return (
    <div style={{background:C.bg, color:C.text, minHeight:'100vh', fontFamily:'Inter, sans-serif'}}>
      {/* BARRA SUPERIOR DE ESTADO */}
      <div style={{padding:"10px 28px", background:C.card, borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{fontSize:10, color:C.dim}}>
          <span style={{color:C.green}}>●</span> {syncInfo.toUpperCase()}
        </div>
        <button onClick={() => {setLoading(true); fetchData(true);}} style={{background:'none', border:`1px solid ${C.muted}`, color:C.dim, fontSize:9, padding:'3px 8px', borderRadius:4, cursor:'pointer'}}>
          FORZAR ACTUALIZACIÓN ↻
        </button>
      </div>

      <div style={{padding:"20px 28px", maxWidth:1200, margin:'0 auto'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:30}}>
          <h1 style={{fontSize:18, fontWeight:800, margin:0}}>QA INTELLIGENCE <span style={{color:C.blue}}>v2.1</span></h1>
          <div style={{display:'flex', gap:6}}>
            {[1,2,3,4,5,6,7].map((w, i) => (
              <button key={w} onClick={() => setWIdx(i)} style={{padding:"5px 12px", borderRadius:4, border:`1px solid ${wIdx===i?C.blue:C.border}`, background:wIdx===i?`${C.blue}22`:C.bg, color:wIdx===i?C.blue:C.dim, fontSize:11, cursor:'pointer'}}>W{w}</button>
            ))}
          </div>
        </div>

        {/* TARJETAS DE FILTRO INTERACTIVAS */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16, marginBottom:32}}>
          {[
            { id: 'all', label: 'GENERAL AVG', val: stats.avg + '%', color: C.blue, sub: 'Total Campaign' },
            { id: 'critical', label: 'CRITICAL', val: stats.critical.length, color: C.red, sub: 'Score < 70%' },
            { id: 'convertible', label: 'CONVERTIBLE', val: stats.convertible.length, color: C.orange, sub: 'Score 70-85%' },
            { id: 'top', label: 'TOP PERFORMERS', val: stats.top.length, color: C.green, sub: 'Score > 90%' }
          ].map(card => (
            <div key={card.id} onClick={() => setFilter(card.id)} style={{
              cursor:'pointer', padding:20, background:C.card, borderRadius:8, border:`1px solid ${filter===card.id?card.color:C.border}`,
              transform: filter===card.id ? 'scale(1.02)' : 'scale(1)', transition:'0.2s'
            }}>
              <div style={{fontSize:10, color:C.dim, fontWeight:600}}>{card.label}</div>
              <div style={{fontSize:28, fontWeight:800, color:card.color, margin:'4px 0'}}>{card.val}</div>
              <div style={{fontSize:10, color:C.muted}}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* TABLA DE ACCIÓN */}
        <div style={{background:C.card, borderRadius:8, border:`1px solid ${C.border}`, overflow:'hidden'}}>
          <div style={{padding:16, borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span style={{fontSize:12, fontWeight:600}}>FOCO DE ATENCIÓN: {filter.toUpperCase()}</span>
            <span style={{fontSize:11, color:C.dim}}>{filteredList.length} Agentes mostrados</span>
          </div>
          <div style={{maxHeight:500, overflowY:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <thead style={{position:'sticky', top:0, background:C.card, zIndex:1}}>
                <tr style={{textAlign:'left', color:C.dim, fontSize:11, borderBottom:`1px solid ${C.border}`}}>
                  <th style={{padding:16}}>AGENTE / TL</th>
                  <th style={{padding:16}}>SCORE W{wIdx+1}</th>
                  <th style={{padding:16}}>ÁREAS DE OPORTUNIDAD (MISSES)</th>
                  <th style={{padding:16}}>TENDENCIA</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map(ag => {
                  const score = ag.w[wIdx];
                  const prev = wIdx > 0 ? ag.w[wIdx-1] : null;
                  const trend = (prev !== null && score !== null) ? (score - prev).toFixed(1) : null;
                  const misses = getTopMisses(ag.sc);

                  return (
                    <tr key={ag.n} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:16}}>
                        <div style={{fontWeight:600}}>{ag.n}</div>
                        <div style={{fontSize:10, color:C.dim}}>{ag.tlName} • {ag.site}</div>
                      </td>
                      <td style={{padding:16, fontWeight:800, color: score < 70 ? C.red : score < 85 ? C.orange : C.green}}>
                        {score}%
                      </td>
                      <td style={{padding:16}}>
                        <div style={{display:'flex', gap:6}}>
                          {misses.length > 0 ? misses.map(([m, v]) => (
                            <div key={m} style={{padding:'3px 7px', background:`${C.red}10`, border:`1px solid ${C.red}30`, borderRadius:4, fontSize:10}}>
                              <span style={{color:C.dim}}>{m}:</span> <span style={{color:C.red, fontWeight:600}}>{v}%</span>
                            </div>
                          )) : <span style={{color:C.green, fontSize:10}}>● Métricas óptimas</span>}
                        </div>
                      </td>
                      <td style={{padding:16, fontSize:11, fontWeight:600}}>
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

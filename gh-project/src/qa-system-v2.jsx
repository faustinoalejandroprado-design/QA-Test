import React, { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3qt-rkXHja3wwv6HSx3Xi2V1I-NMrOa6VNrjAAFNt2SITNLmCb0gBWtdzUFDCDg/pub?gid=1321743990&single=true&output=csv";
const CACHE_KEY = "qa_system_final_v5"; 

const C = {
  bg: "#0b0e14", card: "#161b22", border: "#30363d", text: "#c9d1d9",
  dim: "#8b949e", blue: "#58a6ff", green: "#3fb950", red: "#f85149", orange: "#d29922"
};

const App = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wIdx, setWIdx] = useState(6);
  const [filter, setFilter] = useState("all");
  const [syncInfo, setSyncInfo] = useState("");

  const fetchData = (force = false) => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!force && cached) {
      setData(JSON.parse(cached));
      setLoading(false);
      setSyncInfo("Cargado de memoria local");
      return;
    }

    setSyncInfo("Conectando con Google...");
    Papa.parse(SHEET_URL, {
      download: true,
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const transformed = transformData(results.data);
        if (transformed.tls.length === 0) {
          setSyncInfo("Error: No se detectaron columnas válidas.");
        } else {
          localStorage.setItem(CACHE_KEY, JSON.stringify(transformed));
          setData(transformed);
          setSyncInfo("Sincronización exitosa");
        }
        setLoading(false);
      }
    });
  };

  useEffect(() => { fetchData(); }, []);

  const transformData = (rows) => {
    const tlsMap = {};
    
    // Función para buscar columnas aunque cambien de nombre
    const getVal = (row, keys) => {
      const foundKey = Object.keys(row).find(k => 
        keys.some(key => k.toLowerCase().trim().includes(key.toLowerCase()))
      );
      return row[foundKey];
    };

    rows.forEach(row => {
      // Buscamos Agent, TL y Site de forma flexible
      const agent = getVal(row, ['Agent', 'Agente', 'Name']);
      const tl = getVal(row, ['Team Leader', 'TL', 'Lider']);
      const site = getVal(row, ['Site', 'Sede', 'Ubicacion']) || 'N/A';
      
      if (!agent || agent.toString().trim() === "") return;

      const tlName = tl ? tl.toString().trim() : "Sin TL";
      if (!tlsMap[tlName]) tlsMap[tlName] = { name: tlName, site, agents: [] };

      const parse = (v) => {
        if (!v) return null;
        const n = parseFloat(v.toString().replace(/[%, ]/g, ""));
        return isNaN(n) ? null : n;
      };

      tlsMap[tlName].agents.push({
        n: agent,
        tlName: tlName,
        w: [
          parse(getVal(row, ['Week 1', 'W1'])), parse(getVal(row, ['Week 2', 'W2'])),
          parse(getVal(row, ['Week 3', 'W3'])), parse(getVal(row, ['Week 4', 'W4'])),
          parse(getVal(row, ['Week 5', 'W5'])), parse(getVal(row, ['Week 6', 'W6'])),
          parse(getVal(row, ['Week 7', 'W7']))
        ],
        sc: {
          WW: parse(row['WW']), TL: parse(row['TL']), AI: parse(row['AI']), VT: parse(row['VT'])
        }
      });
    });
    return { tls: Object.values(tlsMap) };
  };

  const stats = useMemo(() => {
    if (!data) return null;
    let all = [];
    data.tls.forEach(t => t.agents.forEach(a => all.push(a)));
    const active = all.filter(a => a.w[wIdx] !== null);
    const critical = active.filter(a => a.w[wIdx] < 70);
    const conv = active.filter(a => a.w[wIdx] >= 70 && a.w[wIdx] < 85);
    const top = active.filter(a => a.w[wIdx] >= 90);
    const avg = active.length ? (active.reduce((s, a) => s + a.w[wIdx], 0) / active.length).toFixed(1) : 0;
    return { all, active, critical, conv, top, avg };
  }, [data, wIdx]);

  if (loading) return <div style={{background:C.bg, color:C.blue, height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', fontFamily:'monospace'}}>BUSCANDO DATOS...</div>;

  const list = filter === "critical" ? stats.critical : filter === "conv" ? stats.conv : filter === "top" ? stats.top : stats.active;

  return (
    <div style={{background:C.bg, color:C.text, minHeight:'100vh', fontFamily:'sans-serif', padding:20}}>
      <div style={{maxWidth:1000, margin:'0 auto'}}>
        <div style={{display:'flex', justifyContent:'space-between', borderBottom:`1px solid ${C.border}`, pb:10, mb:20}}>
          <h2 style={{fontSize:14}}>QA SYSTEM <span style={{color:C.blue}}>{syncInfo}</span></h2>
          <button onClick={() => fetchData(true)} style={{background:C.card, border:`1px solid ${C.border}`, color:C.dim, fontSize:10, cursor:'pointer'}}>RECARGAR ↻</button>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, mb:20}}>
          <div onClick={() => setFilter('all')} style={{background:C.card, padding:15, borderRadius:5, border:`1px solid ${filter==='all'?C.blue:C.border}`, cursor:'pointer'}}>
            <div style={{fontSize:10, color:C.dim}}>AVG</div>
            <div style={{fontSize:20, fontWeight:'bold', color:C.blue}}>{stats.avg}%</div>
          </div>
          <div onClick={() => setFilter('critical')} style={{background:C.card, padding:15, borderRadius:5, border:`1px solid ${filter==='critical'?C.red:C.border}`, cursor:'pointer'}}>
            <div style={{fontSize:10, color:C.dim}}>CRITICAL</div>
            <div style={{fontSize:20, fontWeight:'bold', color:C.red}}>{stats.critical.length}</div>
          </div>
          <div onClick={() => setFilter('conv')} style={{background:C.card, padding:15, borderRadius:5, border:`1px solid ${filter==='conv'?C.orange:C.border}`, cursor:'pointer'}}>
            <div style={{fontSize:10, color:C.dim}}>CONVERTIBLE</div>
            <div style={{fontSize:20, fontWeight:'bold', color:C.orange}}>{stats.conv.length}</div>
          </div>
          <div onClick={() => setFilter('top')} style={{background:C.card, padding:15, borderRadius:5, border:`1px solid ${filter==='top'?C.green:C.border}`, cursor:'pointer'}}>
            <div style={{fontSize:10, color:C.dim}}>TOP</div>
            <div style={{fontSize:20, fontWeight:'bold', color:C.green}}>{stats.top.length}</div>
          </div>
        </div>

        <div style={{display:'flex', gap:5, mb:15}}>
          {[1,2,3,4,5,6,7].map((w,i) => (
            <button key={w} onClick={() => setWIdx(i)} style={{flex:1, padding:5, background:wIdx===i?C.blue:C.card, border:'none', color:wIdx===i?C.bg:C.text, borderRadius:3, fontSize:10, cursor:'pointer'}}>W{w}</button>
          ))}
        </div>

        <div style={{background:C.card, borderRadius:5, border:`1px solid ${C.border}`, overflow:'hidden'}}>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
            <thead style={{background:C.border, color:C.dim}}>
              <tr>
                <th style={{padding:10, textAlign:'left'}}>AGENT</th>
                <th style={{padding:10, textAlign:'left'}}>SCORE</th>
                <th style={{padding:10, textAlign:'left'}}>MISSES</th>
              </tr>
            </thead>
            <tbody>
              {list.map((ag, i) => (
                <tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:10}}>{ag.n}<br/><span style={{fontSize:9, color:C.dim}}>{ag.tlName}</span></td>
                  <td style={{padding:10, fontWeight:'bold', color:ag.w[wIdx]<70?C.red:ag.w[wIdx]<85?C.orange:C.green}}>{ag.w[wIdx]}%</td>
                  <td style={{padding:10}}>
                    {Object.entries(ag.sc).filter(([_,v])=>v<85 && v!==null).map(([k,v])=>(
                      <span key={k} style={{fontSize:9, color:C.red, mr:5}}>{k}:{v}% </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default App;

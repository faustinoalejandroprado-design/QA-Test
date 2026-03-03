import { useState, useMemo, useCallback } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from "recharts";

let D=null;

// =================================================================
// DATA LAYER - 217 agents, 18 TLs, 2 sites, 7 weeks, 13 QAs
// =================================================================
let WEEKS=[];
let LATEST_WIDX=0;
const SCS=["WW","TL","RB","VT","AI","OW","SS","AP","PR","LV"];
const SC_FULL={WW:"Warm Welcome",TL:"Thoughtful Listening",RB:"Removing Barriers",VT:"Valuing Time",AI:"Accurate Info",OW:"Ownership",SS:"Sales as Service",AP:"Apologies",PR:"Professionalism",LV:"Living Values"};
const GOAL=72;

// SC question name -> code mapping
const SC_MAP={"Warm Welcome & Respect":"WW","Thoughtful Listening":"TL","Understanding & Removing Barriers":"RB",
  "Valuing the Customer's Time & Reducing Effort":"VT","Accurate Information & Transparency":"AI",
  "Ownership & Follow-Through":"OW","Sales as Service":"SS","Apologies & Gratitude":"AP",
  "Professionalism & Positive Intent":"PR","Living Our Values":"LV"};

function getWeekStart(dateStr){
  const d=new Date(dateStr);
  const day=d.getUTCDay();
  const diff=d.getUTCDate()-day+(day===0?-6:1);
  return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),diff)).toISOString().substring(0,10);
}

function processFiles(csvText,xlsxBuffer){
  const csv=Papa.parse(csvText,{header:true,skipEmptyLines:true});

  const wb=XLSX.read(new Uint8Array(xlsxBuffer),{type:"array"});

  // 1. Build TL map from Leadership sheet
  const tlMap={};
  if(wb.Sheets["Leadership"]){
    XLSX.utils.sheet_to_json(wb.Sheets["Leadership"]).forEach(row=>{
      const email=(row["Email"]||"").toString().trim().toLowerCase();
      const name=row["Full Name"]||"";
      const role=(row["Role"]||"").toString();
      const location=(row["Location"]||"").toString();
      const status=(row["Status (Active/Term)"]||"").toString();
      if(email&&name&&role.includes("Team Lead")){
        const site=location.includes("Mexico")?"HMO":location.includes("Jamaica")?"JAM":"PAN";
        tlMap[email]={name,location,site};
      }
    });
  }

  // 2. Build QA analyst set from Leadership
  const qaSet=new Set();
  if(wb.Sheets["Leadership"]){
    XLSX.utils.sheet_to_json(wb.Sheets["Leadership"]).forEach(row=>{
      const role=(row["Role"]||"").toString();
      if(role==="QA") qaSet.add((row["Email"]||"").toString().trim().toLowerCase());
    });
  }

  // 3. Build agent -> supervisor email mapping from roster sheets
  const agentSup={};
  ["CC MEXICO","CC JAMAICA","ADVANCE CARE TEAM"].forEach(sn=>{
    if(!wb.Sheets[sn])return;
    XLSX.utils.sheet_to_json(wb.Sheets[sn]).forEach(row=>{
      const email=(row["Email"]||"").toString().trim().toLowerCase();
      const supervisor=(row["Supervisor"]||"").toString().trim().toLowerCase();
      if(email&&supervisor) agentSup[email]=supervisor;
    });
  });

  // 4. Filter CSV: Customer First Scorecard + contractor emails only
  const cfs=csv.data.filter(r=>
    r["Scorecard Name"]==="Customer First Scorecard"&&
    (r["Email"]||"").includes("contractor.")
  );

  if(!cfs.length) return{error:"No contractor evaluations found in CSV. Make sure the file contains 'Customer First Scorecard' rows with contractor emails."};

  // 5. Group into interactions
  const interactions={};
  cfs.forEach(r=>{
    const iid=r["Interaction ID"];
    if(!interactions[iid]){
      interactions[iid]={
        agent:r["Name"],email:r["Email"].trim().toLowerCase(),
        qa:r["Taker Name"],score:parseFloat(r["Overall Review Score"])||0,
        channel:(r["Channel"]||"").substring(0,3)||"???",
        date:r["Time Started"],sc:{},proc:null,notes:null
      };
    }
    const q=r["Question Text"]||"";
    if(SC_MAP[q]) interactions[iid].sc[SC_MAP[q]]=r["Answer Text"];
    if(q==="Follows Procedures") interactions[iid].proc=r["Answer Text"]==="Yes";
    if(q.includes("Notes in Gladly")) interactions[iid].notes=r["Answer Text"]==="Yes";
  });

  // 6. Week bucketing
  const weekSet=new Set();
  Object.values(interactions).forEach(i=>weekSet.add(getWeekStart(i.date)));
  const weeks=[...weekSet].sort();
  const weekLabels=weeks.map(w=>{
    const d=new Date(w+"T00:00:00Z");
    return d.toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
  });

  // 7. Group by agent
  const agentData={};
  Object.values(interactions).forEach(int=>{
    if(!agentData[int.email]){
      agentData[int.email]={name:int.agent,email:int.email,interactions:[],channels:[]};
    }
    agentData[int.email].interactions.push(int);
    agentData[int.email].channels.push(int.channel);
  });

  // 8. Build agent objects and group by TL
  const tlGroups={};
  Object.values(agentData).forEach(ad=>{
    const w=weeks.map(wk=>{
      const wi=ad.interactions.filter(i=>getWeekStart(i.date)===wk);
      if(!wi.length)return null;
      return +(wi.reduce((s,i)=>s+i.score,0)/wi.length).toFixed(1);
    });
    const sc={};
    SCS.forEach(code=>{
      const answers=ad.interactions.map(i=>i.sc[code]).filter(Boolean);
      const met=answers.filter(a=>a==="Met"||a==="Exceed").length;
      sc[code]=answers.length?Math.round(met/answers.length*100):0;
    });
    const procA=ad.interactions.filter(i=>i.proc!==null);
    const pr=procA.length?Math.round(procA.filter(i=>i.proc).length/procA.length*100):0;
    const notesA=ad.interactions.filter(i=>i.notes!==null);
    const nt=notesA.length?Math.round(notesA.filter(i=>i.notes).length/notesA.length*100):0;
    const chCount={};
    ad.channels.forEach(c=>{chCount[c]=(chCount[c]||0)+1;});
    const ch=Object.entries(chCount).sort((a,b)=>b[1]-a[1])[0]?.[0]||"???";

    const supEmail=agentSup[ad.email]||"";
    const tlInfo=tlMap[supEmail];
    const tlKey=tlInfo?supEmail:"_unassigned";
    if(!tlGroups[tlKey]){
      tlGroups[tlKey]=tlInfo
        ?{name:tlInfo.name,site:tlInfo.site,lb:"",agents:[]}
        :{name:"Unassigned",site:"???",lb:"",agents:[]};
    }
    tlGroups[tlKey].agents.push({n:ad.name,w,sc,pr,nt,ch});
  });

  // 9. QA analyst stats
  const qaData={};
  Object.values(interactions).forEach(int=>{
    if(!qaData[int.qa]) qaData[int.qa]={name:int.qa,scores:[],weeklyScores:{}};
    qaData[int.qa].scores.push(int.score);
    const wk=getWeekStart(int.date);
    if(!qaData[int.qa].weeklyScores[wk]) qaData[int.qa].weeklyScores[wk]=[];
    qaData[int.qa].weeklyScores[wk].push(int.score);
  });
  const qas=Object.values(qaData).map(q=>{
    const avg=+(q.scores.reduce((s,v)=>s+v,0)/q.scores.length).toFixed(1);
    const variance=q.scores.reduce((s,v)=>s+(v-avg)**2,0)/q.scores.length;
    const sd=+Math.sqrt(variance).toFixed(1);
    const weeklyAvgs=weeks.map(wk=>{
      const ws=q.weeklyScores[wk]||[];
      return ws.length?+(ws.reduce((s,v)=>s+v,0)/ws.length).toFixed(1):null;
    });
    const valid=weeklyAvgs.filter(v=>v!==null);
    const vol=valid.length>1?+(valid.slice(1).reduce((s,v,i)=>s+Math.abs(v-valid[i]),0)/(valid.length-1)).toFixed(1):0;
    return{name:q.name,n:q.scores.length,avg,sd,vol,w:weeklyAvgs};
  });

  const tls=Object.values(tlGroups).filter(t=>t.agents.length>0).sort((a,b)=>a.name.localeCompare(b.name));
  const totalAgents=tls.reduce((s,t)=>s+t.agents.length,0);

  return{weeks:weekLabels,tls,qas,
    stats:{interactions:Object.keys(interactions).length,agents:totalAgents,tlCount:tls.filter(t=>t.name!=="Unassigned").length,weekCount:weeks.length}};
}



// =================================================================
// COMPUTATION ENGINE (v3.0 — all bugs fixed)
// =================================================================
function getAgentAvg(a,wIdx){return a.w[wIdx];}
function getAgentTrend(a,wIdx){
  const cur=a.w[wIdx],prev=wIdx>0?a.w[wIdx-1]:null;
  if(cur==null||prev==null)return null;
  return +(cur-prev).toFixed(1);
}
function slope(a){
  const pts=a.w.map((v,i)=>v!=null?[i,v]:null).filter(Boolean);
  if(pts.length<3)return 0;
  const n=pts.length,sx=pts.reduce((s,p)=>s+p[0],0),sy=pts.reduce((s,p)=>s+p[1],0);
  const sxy=pts.reduce((s,p)=>s+p[0]*p[1],0),sxx=pts.reduce((s,p)=>s+p[0]*p[0],0);
  return +((n*sxy-sx*sy)/(n*sxx-sx*sx)).toFixed(2);
}
function classify(a,wIdx){
  const avg=getAgentAvg(a,wIdx);
  if(avg==null)return"no_data";
  const s=slope(a);
  if(avg>=GOAL)return"stable";
  if(avg>=65&&s>0.3)return"convertible";
  if(avg>=60&&Math.abs(s)<=0.5)return"stagnant";
  if(s<-0.5)return"regressing";
  if(avg<60)return"critical";
  return"stagnant";
}
function distTo72(a,wIdx){const v=getAgentAvg(a,wIdx);return v!=null?+(GOAL-v).toFixed(1):null;}
function weeksTo72(a,wIdx){const d=distTo72(a,wIdx),s=slope(a);return d!=null&&d>0&&s>0?Math.ceil(d/s):null;}
function project(a,weeks){
  const s=slope(a);const last=a.w.filter(v=>v!=null).pop()||0;
  return Array.from({length:weeks},(_,i)=>+(last+s*(i+1)).toFixed(1));
}
function wowDelta(agents,wIdx){
  if(wIdx<1)return null;
  const cur=agents.filter(a=>a.w[wIdx]!=null);
  const prev=agents.filter(a=>a.w[wIdx-1]!=null);
  if(!cur.length||!prev.length)return null;
  const cAvg=cur.reduce((s,a)=>s+a.w[wIdx],0)/cur.length;
  const pAvg=prev.reduce((s,a)=>s+a.w[wIdx-1],0)/prev.length;
  return +(cAvg-pAvg).toFixed(1);
}
function scImpact(a){
  return SCS.map(sc=>({sc,name:SC_FULL[sc],met:a.sc[sc],gap:100-a.sc[sc],
    weight:["WW","VT","AP","LV"].includes(sc)?"high":"standard",
  })).sort((a,b)=>b.gap-a.gap);
}

// Focus cards — English
function genFocusCards(level,context,wIdx){
  const cards=[];
  if(level==="campaign"){
    const allAgents=D.tls.flatMap(t=>t.agents);
    const active=allAgents.filter(a=>a.w[wIdx]!=null);
    const conv=active.filter(a=>classify(a,wIdx)==="convertible");
    const reg=active.filter(a=>classify(a,wIdx)==="regressing");
    const band=active.filter(a=>{const v=a.w[wIdx];return v!=null&&v>=60&&v<72;});
    cards.push({type:"conversion",title:"Conversion Pipeline",
      metric:conv.length,unit:"convertible agents",
      detail:`${band.length} in 60-71 band (${active.length?Math.round(band.length/active.length*100):0}%). ${conv.length} trending positive toward 72.`,
      action:`Focus coaching on: ${conv.slice(0,3).map(a=>a.n.split(" ")[0]).join(", ")||"none identified"}`,
      color:"#10b981",priority:conv.length>0?"high":"medium"});
    if(reg.length>3){
      cards.push({type:"alert",title:"Alert: Active Regression",
        metric:reg.length,unit:"agents regressing",
        detail:`${reg.length} agents with sustained negative trend. ${reg.filter(a=>a.w[wIdx]<60).length} already below 60.`,
        action:"Immediate intervention required in affected TLs.",
        color:"#ef4444",priority:"critical"});
    }
    const hmo=D.tls.filter(t=>t.site==="HMO").flatMap(t=>t.agents).filter(a=>a.w[wIdx]!=null);
    const jam=D.tls.filter(t=>t.site==="JAM").flatMap(t=>t.agents).filter(a=>a.w[wIdx]!=null);
    const hmoAvg=hmo.length?hmo.reduce((s,a)=>s+a.w[wIdx],0)/hmo.length:0;
    const jamAvg=jam.length?jam.reduce((s,a)=>s+a.w[wIdx],0)/jam.length:0;
    const gap=+(hmoAvg-jamAvg).toFixed(1);
    if(Math.abs(gap)>3){
      const higher=gap>0?"HMO":"JAM",lower=gap>0?"JAM":"HMO";
      cards.push({type:"site",title:"Site Gap",
        metric:`${Math.abs(gap)} pts`,unit:`${higher} vs ${lower}`,
        detail:`HMO: ${hmoAvg.toFixed(1)} avg | JAM: ${jamAvg.toFixed(1)} avg. Gap is widening.`,
        action:`Prioritize cross-site calibration and intensive ${lower} coaching.`,
        color:"#f59e0b",priority:"high"});
    }
  } else if(level==="tl"){
    const agents=context.agents.filter(a=>a.w[wIdx]!=null);
    const conv=agents.filter(a=>classify(a,wIdx)==="convertible");
    const crit=agents.filter(a=>a.w[wIdx]!=null&&a.w[wIdx]<55);
    if(conv.length>0){
      const top=[...conv].sort((a,b)=>b.w[wIdx]-a.w[wIdx])[0];
      cards.push({type:"conversion",title:"Conversion Opportunity",
        metric:conv.length,unit:"agents near 72",
        detail:`${top.n} at ${top.w[wIdx]} pts (${distTo72(top,wIdx)} to goal). Trend: +${slope(top).toFixed(1)}/wk.`,
        action:`1:1 session with ${top.n.split(" ")[0]}: focus on ${scImpact(top)[0].name}.`,
        color:"#10b981",priority:"high"});
    }
    if(agents.length>0){
      const scTotals=SCS.map(sc=>({sc,name:SC_FULL[sc],avg:Math.round(agents.reduce((s,a)=>s+a.sc[sc],0)/agents.length)}));
      const worstSC=[...scTotals].sort((a,b)=>a.avg-b.avg)[0];
      cards.push({type:"sc",title:"Top Lever",
        metric:`${worstSC.avg}%`,unit:`Met in ${worstSC.name}`,
        detail:`${worstSC.name} is the lowest compliance category. High impact on final score.`,
        action:`Model ${worstSC.name} in upcoming team sessions.`,
        color:"#8b5cf6",priority:"medium"});
    }
    if(crit.length>0){
      cards.push({type:"critical",title:"Immediate Attention",
        metric:crit.length,unit:"agents below 55",
        detail:crit.map(a=>`${a.n.split(" ")[0]} (${a.w[wIdx]})`).join(", "),
        action:"Structured recovery plan required. Evaluate assignment.",
        color:"#ef4444",priority:"critical"});
    }
  }
  return cards.slice(0,3);
}

// =================================================================
// DESIGN SYSTEM
// =================================================================
const C={bg:"#080810",panel:"#0c0c1a",card:"#111126",card2:"#151528",border:"rgba(255,255,255,0.06)",
  text:"#e4e4f0",dim:"#7a7aa0",muted:"#3d3d60",
  green:"#10b981",amber:"#f59e0b",red:"#ef4444",blue:"#5b7fff",purple:"#8b5cf6",cyan:"#06b6d4",
  pink:"#ec4899",orange:"#f97316"};
const cs={background:`linear-gradient(145deg,${C.card} 0%,${C.card2} 100%)`,border:`1px solid ${C.border}`,borderRadius:12,padding:18};
const clsColor={convertible:C.green,stable:C.blue,stagnant:C.amber,regressing:C.red,critical:C.red,no_data:C.muted};
const clsLabel={convertible:"Convertible",stable:"Stable \u226572",stagnant:"Stagnant",regressing:"Regressing",critical:"Critical",no_data:"No Data"};
const scoreColor=s=>s>=72?C.green:s>=65?C.cyan:s>=60?C.amber:s>=50?C.orange:C.red;

function Tp({active,payload,label}){
  if(!active||!payload)return null;
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",boxShadow:"0 8px 20px rgba(0,0,0,.5)"}}>
    <div style={{color:C.dim,fontSize:10,marginBottom:3}}>{label}</div>
    {payload.map((e,i)=><div key={i} style={{color:e.color,fontSize:11,fontWeight:600}}>{e.name}: {typeof e.value==="number"?e.value.toFixed(1):e.value}</div>)}
  </div>;
}

// NEW: WoW badge
function WoWBadge({delta}){
  if(delta==null)return null;
  const col=delta>0?C.green:delta<0?C.red:C.muted;
  return <span style={{fontSize:10,fontWeight:600,color:col,fontFamily:"monospace",marginLeft:6}}>({delta>0?"+":""}{delta} WoW)</span>;
}

// NEW: Historical week indicator
function HistoricalBanner({wIdx}){
  if(wIdx>=LATEST_WIDX)return null;
  return <div style={{background:`${C.amber}12`,border:`1px solid ${C.amber}30`,borderRadius:8,padding:"8px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
    <span style={{fontSize:14}}>{"\u23f3"}</span>
    <span style={{fontSize:11,color:C.amber,fontWeight:600}}>Viewing historical data: {WEEKS[wIdx]}</span>
    <span style={{fontSize:10,color:C.dim,marginLeft:4}}>Current week is {WEEKS[LATEST_WIDX]}</span>
  </div>;
}

// NEW: Empty state
function EmptyState({message}){
  return <div style={{...cs,textAlign:"center",padding:40}}>
    <div style={{fontSize:32,marginBottom:10,opacity:.3}}>{"\u2014"}</div>
    <div style={{fontSize:12,color:C.dim}}>{message||"No data available for this selection."}</div>
  </div>;
}

// KPI card with WoW delta
function KpiCard({value,label,color,delta}){
  return <div style={{...cs,flex:1,minWidth:140}}>
    <div style={{fontSize:9,fontWeight:600,letterSpacing:"1px",textTransform:"uppercase",color:C.dim,marginBottom:6}}>{label}</div>
    <div style={{display:"flex",alignItems:"baseline",gap:0}}>
      <span style={{fontSize:26,fontWeight:700,color:color,fontFamily:"monospace",lineHeight:1}}>{value}</span>
      {delta!=null&&<WoWBadge delta={delta}/>}
    </div>
  </div>;
}

// =================================================================
// COMPONENTS
// =================================================================
function FocusCard({card}){
  const priorityBorder=card.priority==="critical"?C.red:card.priority==="high"?card.color:C.border;
  return <div style={{...cs,borderLeft:`3px solid ${priorityBorder}`,flex:1,minWidth:280}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
      <span style={{fontSize:10,fontWeight:700,color:card.color,letterSpacing:"1px",textTransform:"uppercase"}}>{card.title}</span>
      {card.priority==="critical"&&<span style={{fontSize:8,padding:"2px 6px",borderRadius:3,background:`${C.red}20`,color:C.red,fontWeight:700}}>URGENT</span>}
    </div>
    <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:8}}>
      <span style={{fontSize:28,fontWeight:700,color:C.text,fontFamily:"monospace",lineHeight:1}}>{card.metric}</span>
      <span style={{fontSize:11,color:C.dim}}>{card.unit}</span>
    </div>
    <p style={{fontSize:11,color:C.dim,lineHeight:1.5,margin:"0 0 8px"}}>{card.detail}</p>
    <div style={{padding:"8px 10px",background:`${card.color}08`,borderRadius:6,border:`1px solid ${card.color}22`}}>
      <span style={{fontSize:10,fontWeight:600,color:card.color}}>{"\u2192"} {card.action}</span>
    </div>
  </div>;
}

function ConvRow({a,wIdx,onClick}){
  const avg=a.w[wIdx],cls=classify(a,wIdx),tr=getAgentTrend(a,wIdx),dist=distTo72(a,wIdx),est=weeksTo72(a,wIdx);
  if(avg==null)return null;
  return <div onClick={onClick} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(255,255,255,.015)",borderRadius:8,marginBottom:3,cursor:"pointer",borderLeft:`3px solid ${clsColor[cls]}`,transition:"background .15s"}}
    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.04)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.015)"}>
    <span style={{fontSize:11,fontWeight:600,color:C.text,flex:1,minWidth:140}}>{a.n}</span>
    <span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:`${clsColor[cls]}15`,color:clsColor[cls],fontWeight:700,width:75,textAlign:"center"}}>{clsLabel[cls]}</span>
    <span style={{fontSize:14,fontWeight:700,color:scoreColor(avg),fontFamily:"monospace",width:36,textAlign:"right"}}>{avg}</span>
    <span style={{fontSize:10,color:C.muted,fontFamily:"monospace",width:40,textAlign:"right"}}>{dist!=null&&dist>0?`-${dist}`:dist<=0?"\u2713":""}</span>
    {tr!=null&&<span style={{fontSize:10,fontWeight:600,color:tr>0?C.green:tr<0?C.red:C.muted,fontFamily:"monospace",width:40,textAlign:"right"}}>{tr>0?"+":""}{tr}</span>}
    <span style={{fontSize:10,color:C.dim,fontFamily:"monospace",width:50,textAlign:"right"}}>{est?"~"+est+"wk":"\u2014"}</span>
    <span style={{fontSize:8,color:C.muted,padding:"1px 4px",background:`${C.muted}10`,borderRadius:2}}>{a.ch}</span>
  </div>;
}

// =================================================================
// CAMPAIGN VIEW
// =================================================================
function CampaignView({wIdx,onSelectTL}){
  const allAgents=D.tls.flatMap(t=>t.agents);
  const active=allAgents.filter(a=>a.w[wIdx]!=null);
  const avg=active.length?(active.reduce((s,a)=>s+a.w[wIdx],0)/active.length).toFixed(1):0;
  const pct72=active.length?Math.round(active.filter(a=>a.w[wIdx]>=GOAL).length/active.length*100):0;
  const conv=active.filter(a=>classify(a,wIdx)==="convertible").length;
  const cards=genFocusCards("campaign",null,wIdx);
  const wow=wowDelta(allAgents,wIdx);
  const prevActive=wIdx>0?allAgents.filter(a=>a.w[wIdx-1]!=null):[];
  const prevPct72=prevActive.length?Math.round(prevActive.filter(a=>a.w[wIdx-1]>=GOAL).length/prevActive.length*100):null;
  const pct72Delta=prevPct72!=null?pct72-prevPct72:null;

  const tlRank=D.tls.map(tl=>{
    const ag=tl.agents.filter(a=>a.w[wIdx]!=null);
    if(!ag.length)return null;
    const tavg=ag.reduce((s,a)=>s+a.w[wIdx],0)/ag.length;
    const t72=Math.round(ag.filter(a=>a.w[wIdx]>=GOAL).length/ag.length*100);
    const tconv=ag.filter(a=>classify(a,wIdx)==="convertible").length;
    const tband=ag.filter(a=>{const v=a.w[wIdx];return v>=60&&v<72;}).length;
    const dist={above72:ag.filter(a=>a.w[wIdx]>=72).length,band:ag.filter(a=>{const v=a.w[wIdx];return v>=60&&v<72;}).length,below:ag.filter(a=>a.w[wIdx]<60).length};
    return{name:tl.name,site:tl.site,avg:+tavg.toFixed(1),pct72:t72,conv:tconv,band:tband,n:ag.length,tl,dist};
  }).filter(Boolean).sort((a,b)=>b.avg-a.avg);

  const buckets={convertible:0,stagnant:0,regressing:0,critical:0,stable:0};
  active.forEach(a=>{const c=classify(a,wIdx);if(buckets[c]!==undefined)buckets[c]++;});
  const pipeData=Object.entries(buckets).map(([k,v])=>({name:clsLabel[k],value:v,color:clsColor[k]}));
  const trendData=WEEKS.map((w,i)=>{
    const wa=allAgents.filter(a=>a.w[i]!=null);
    return{week:w,avg:wa.length?(wa.reduce((s,a)=>s+a.w[i],0)/wa.length):null};
  });

  return <div>
    <HistoricalBanner wIdx={wIdx}/>
    <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
      <KpiCard value={avg} label="QA Score" color={scoreColor(+avg)} delta={wow}/>
      <KpiCard value={`${pct72}%`} label={"\u226572 Baseline"} color={pct72>=25?C.green:C.amber} delta={pct72Delta}/>
      <KpiCard value={conv} label="Convertible" color={C.cyan} delta={null}/>
      <KpiCard value={active.length} label="Active Agents" color={C.text} delta={null}/>
    </div>
    {cards.length>0&&<div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>{cards.map((c,i)=><FocusCard key={i} card={c}/>)}</div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
      <div style={cs}><div style={{fontSize:10,fontWeight:600,color:C.dim,letterSpacing:"1px",textTransform:"uppercase",marginBottom:12}}>QA Score Trend</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.03)"/>
            <XAxis dataKey="week" tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
            <YAxis domain={[54,68]} tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
            <ReferenceLine y={72} stroke={C.green} strokeDasharray="4 4" strokeWidth={1}/>
            <Tooltip content={<Tp/>}/>
            <Line type="monotone" dataKey="avg" stroke={C.blue} strokeWidth={2.5} dot={{r:3,fill:C.blue}} name="Avg Score"/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={cs}><div style={{fontSize:10,fontWeight:600,color:C.dim,letterSpacing:"1px",textTransform:"uppercase",marginBottom:12}}>Conversion Pipeline</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={pipeData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.03)"/>
            <XAxis type="number" tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
            <YAxis dataKey="name" type="category" width={85} tick={{fill:C.dim,fontSize:9}} axisLine={false} tickLine={false}/>
            <Tooltip content={<Tp/>}/>
            <Bar dataKey="value" radius={[0,4,4,0]} name="Agents">{pipeData.map((d,i)=><Cell key={i} fill={d.color}/>)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
    <div style={cs}>
      <div style={{fontSize:10,fontWeight:600,color:C.dim,letterSpacing:"1px",textTransform:"uppercase",marginBottom:12}}>Team Lead Ranking</div>
      <div style={{display:"flex",gap:6,marginBottom:8,padding:"0 12px"}}>
        {["Team Lead","Site","Avg","\u226572","Conv","Band","n"].map((h,i)=>
          <span key={h} style={{fontSize:9,color:C.muted,fontWeight:600,flex:i===0?1:0,width:i===0?"auto":i===1?40:45,textAlign:i===0?"left":"center"}}>{h}</span>)}
      </div>
      {tlRank.map((t,i)=><div key={i} onClick={()=>onSelectTL(t.tl)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",background:"rgba(255,255,255,.015)",borderRadius:6,marginBottom:2,cursor:"pointer",transition:"background .15s",position:"relative"}}
        onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.04)";const tip=e.currentTarget.querySelector('[data-tip]');if(tip)tip.style.opacity=1;}}
        onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.015)";const tip=e.currentTarget.querySelector('[data-tip]');if(tip)tip.style.opacity=0;}}>
        <span style={{fontSize:12,fontWeight:600,color:C.text,flex:1}}>{t.name}</span>
        <span style={{fontSize:9,color:C.cyan,width:40,textAlign:"center",padding:"1px 4px",borderRadius:3,background:`${C.cyan}10`}}>{t.site}</span>
        <span style={{fontSize:13,fontWeight:700,color:scoreColor(t.avg),fontFamily:"monospace",width:45,textAlign:"center"}}>{t.avg}</span>
        <span style={{fontSize:11,fontWeight:600,color:t.pct72>0?C.green:C.muted,fontFamily:"monospace",width:45,textAlign:"center"}}>{t.pct72}%</span>
        <span style={{fontSize:11,fontWeight:600,color:t.conv>0?C.cyan:C.muted,fontFamily:"monospace",width:45,textAlign:"center"}}>{t.conv}</span>
        <span style={{fontSize:11,color:C.amber,fontFamily:"monospace",width:45,textAlign:"center"}}>{t.band}</span>
        <span style={{fontSize:10,color:C.muted,fontFamily:"monospace",width:45,textAlign:"center"}}>{t.n}</span>
        <div data-tip="1" style={{position:"absolute",right:-8,top:"50%",transform:"translateY(-50%) translateX(100%)",opacity:0,transition:"opacity .15s",pointerEvents:"none",zIndex:10,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",boxShadow:"0 8px 20px rgba(0,0,0,.6)",whiteSpace:"nowrap"}}>
          <div style={{fontSize:9,color:C.dim,marginBottom:4}}>Distribution</div>
          <div style={{display:"flex",gap:4,height:12,width:80,borderRadius:3,overflow:"hidden"}}>
            {t.dist.above72>0&&<div style={{flex:t.dist.above72,background:C.green,borderRadius:2}}/>}
            {t.dist.band>0&&<div style={{flex:t.dist.band,background:C.amber,borderRadius:2}}/>}
            {t.dist.below>0&&<div style={{flex:t.dist.below,background:C.red,borderRadius:2}}/>}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
            <span style={{fontSize:8,color:C.green}}>{t.dist.above72}{"\u226572"}</span>
            <span style={{fontSize:8,color:C.amber}}>{t.dist.band} band</span>
            <span style={{fontSize:8,color:C.red}}>{t.dist.below}{"<60"}</span>
          </div>
        </div>
      </div>)}
    </div>
  </div>;
}

// =================================================================
// TL VIEW
// =================================================================
function TLView({tl,wIdx,onSelectAgent}){
  const agents=tl.agents.filter(a=>a.w[wIdx]!=null).sort((a,b)=>(b.w[wIdx]||0)-(a.w[wIdx]||0));
  const avg=agents.length?(agents.reduce((s,a)=>s+a.w[wIdx],0)/agents.length).toFixed(1):0;
  const pct72=agents.length?Math.round(agents.filter(a=>a.w[wIdx]>=GOAL).length/agents.length*100):0;
  const cards=genFocusCards("tl",tl,wIdx);
  const wow=wowDelta(tl.agents,wIdx);
  const groups={};
  agents.forEach(a=>{const c=classify(a,wIdx);if(!groups[c])groups[c]=[];groups[c].push(a);});
  const order=["convertible","stable","stagnant","regressing","critical"];

  if(!agents.length) return <><HistoricalBanner wIdx={wIdx}/><EmptyState message={`No evaluations for ${tl.name} in week ${WEEKS[wIdx]}.`}/></>;

  return <div>
    <HistoricalBanner wIdx={wIdx}/>
    <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
      <KpiCard value={avg} label="Avg Score" color={scoreColor(+avg)} delta={wow}/>
      <KpiCard value={`${pct72}%`} label={"\u226572 Baseline"} color={pct72>0?C.green:C.amber} delta={null}/>
      <KpiCard value={agents.length} label="Agents" color={C.text} delta={null}/>
      <KpiCard value={groups.convertible?.length||0} label="Convertible" color={C.cyan} delta={null}/>
    </div>
    {cards.length>0&&<div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>{cards.map((c,i)=><FocusCard key={i} card={c}/>)}</div>}
    <div style={cs}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontSize:10,fontWeight:600,color:C.dim,letterSpacing:"1px",textTransform:"uppercase"}}>Conversion Monitor</span>
        <div style={{display:"flex",gap:8}}>
          {["Agent","Status","Score","Dist","WoW","Est","Ch"].map(h=>
            <span key={h} style={{fontSize:8,color:C.muted,fontWeight:600,width:h==="Agent"?140:h==="Status"?75:h==="Ch"?30:40,textAlign:h==="Agent"?"left":"right"}}>{h}</span>)}
        </div>
      </div>
      {order.map(cls=>groups[cls]&&groups[cls].length>0&&<div key={cls}>
        <div style={{fontSize:9,fontWeight:700,color:clsColor[cls],letterSpacing:"0.5px",padding:"6px 0 4px",textTransform:"uppercase"}}>{clsLabel[cls]} ({groups[cls].length})</div>
        {groups[cls].sort((a,b)=>(b.w[wIdx]||0)-(a.w[wIdx]||0)).map((a,i)=><ConvRow key={i} a={a} wIdx={wIdx} onClick={()=>onSelectAgent(a)}/>)}
      </div>)}
    </div>
  </div>;
}

// =================================================================
// AGENT DEEP DIVE
// =================================================================
function AgentView({agent,wIdx}){
  const avg=agent.w[wIdx],cls=classify(agent,wIdx),s=slope(agent),est=weeksTo72(agent,wIdx);
  const impacts=scImpact(agent);
  const proj=project(agent,4);
  const chartData=WEEKS.map((w,i)=>({week:w,score:agent.w[i]})).concat(proj.map((v,i)=>({week:`+${i+1}`,score:null,proj:v})));
  const fastest=impacts.filter(sc=>sc.met<100).slice(0,3);
  const tr=getAgentTrend(agent,wIdx);

  if(avg==null) return <><HistoricalBanner wIdx={wIdx}/><EmptyState message={`No evaluations for ${agent.n} in week ${WEEKS[wIdx]}. Try selecting a different week.`}/></>;

  return <div>
    <HistoricalBanner wIdx={wIdx}/>
    <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
      <KpiCard value={avg} label="Current Score" color={scoreColor(avg)} delta={tr}/>
      <KpiCard value={distTo72(agent,wIdx)<=0?"\u2713":distTo72(agent,wIdx)} label="Distance to 72" color={avg>=72?C.green:C.amber} delta={null}/>
      <KpiCard value={`${s>0?"+":""}${s}/wk`} label="Velocity" color={s>0?C.green:s<0?C.red:C.muted} delta={null}/>
      <KpiCard value={est?`~${est} wk`:"\u2014"} label="Projection to 72" color={est&&est<=4?C.green:C.amber} delta={null}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
      <div style={cs}>
        <div style={{fontSize:10,fontWeight:600,color:C.dim,letterSpacing:"1px",textTransform:"uppercase",marginBottom:10}}>Evolution + Projection</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.03)"/>
            <XAxis dataKey="week" tick={{fill:C.muted,fontSize:8}} axisLine={false} tickLine={false}/>
            <YAxis domain={[Math.min(40,...agent.w.filter(Boolean))-5,Math.max(80,...agent.w.filter(Boolean))+5]} tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
            <ReferenceLine y={72} stroke={C.green} strokeDasharray="4 4" strokeWidth={1} label={{value:"72",position:"right",fill:C.green,fontSize:9}}/>
            <Tooltip content={<Tp/>}/>
            <Line type="monotone" dataKey="score" stroke={C.blue} strokeWidth={2.5} dot={{r:4,fill:C.blue}} name="Actual" connectNulls/>
            <Line type="monotone" dataKey="proj" stroke={C.amber} strokeWidth={1.5} strokeDasharray="5 3" dot={{r:2,fill:C.amber}} name="Projection"/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={cs}>
        <div style={{fontSize:10,fontWeight:600,color:C.dim,letterSpacing:"1px",textTransform:"uppercase",marginBottom:10}}>Compliance by Category</div>
        {SCS.map(sc=>{
          const met=agent.sc[sc];
          return <div key={sc} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
            <span style={{fontSize:9,color:C.dim,width:70,flexShrink:0}}>{SC_FULL[sc]}</span>
            <div style={{flex:1,height:7,background:"rgba(255,255,255,.04)",borderRadius:3,overflow:"hidden",position:"relative"}}>
              <div style={{position:"absolute",left:"80%",top:0,width:1,height:"100%",background:`${C.green}44`}}/>
              <div style={{width:`${met}%`,height:"100%",borderRadius:3,background:met>=90?C.green:met>=75?C.amber:C.red}}/>
            </div>
            <span style={{fontSize:10,fontWeight:700,color:met>=90?C.green:met>=75?C.amber:C.red,fontFamily:"monospace",width:32,textAlign:"right"}}>{met}%</span>
          </div>;
        })}
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <div style={{flex:1,padding:8,background:"rgba(255,255,255,.02)",borderRadius:6}}>
            <div style={{fontSize:9,color:C.dim}}>Procedures</div>
            <div style={{fontSize:16,fontWeight:700,color:agent.pr>=80?C.green:C.red,fontFamily:"monospace"}}>{agent.pr}%</div>
          </div>
          <div style={{flex:1,padding:8,background:"rgba(255,255,255,.02)",borderRadius:6}}>
            <div style={{fontSize:9,color:C.dim}}>Gladly Notes</div>
            <div style={{fontSize:16,fontWeight:700,color:agent.nt>=80?C.green:C.red,fontFamily:"monospace"}}>{agent.nt}%</div>
          </div>
        </div>
      </div>
    </div>
    <div style={{...cs,borderLeft:`3px solid ${C.cyan}`,marginBottom:18}}>
      <div style={{fontSize:10,fontWeight:700,color:C.cyan,letterSpacing:"1px",textTransform:"uppercase",marginBottom:10}}>Fastest Path to 72</div>
      {avg>=72?
        <p style={{fontSize:12,color:C.green,margin:0}}>This agent already meets the goal. Focus: consistency and sustainability.</p>:
        <div>
          {fastest.map((sc,i)=><div key={sc.sc} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(255,255,255,.02)",borderRadius:6,marginBottom:4}}>
            <span style={{fontSize:16,fontWeight:700,color:C.cyan,fontFamily:"monospace",width:24}}>#{i+1}</span>
            <div style={{flex:1}}>
              <span style={{fontSize:12,fontWeight:600,color:C.text}}>{sc.name}</span>
              <span style={{fontSize:10,color:C.dim,marginLeft:8}}>({sc.met}% Met {"\u2192"} {sc.gap}pp gap)</span>
            </div>
            <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:sc.weight==="high"?`${C.purple}15`:`${C.muted}10`,color:sc.weight==="high"?C.purple:C.muted,fontWeight:600}}>
              {sc.weight==="high"?"High impact":"Standard"}
            </span>
          </div>)}
          {agent.pr<80&&<div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:`${C.red}06`,borderRadius:6,marginBottom:4,borderLeft:`2px solid ${C.red}`}}>
            <span style={{fontSize:12,color:C.red,fontWeight:600}}>Procedures ({agent.pr}%)</span>
            <span style={{fontSize:10,color:C.dim}}>{"\u2014"} direct deduction of ~8.5 pts per fail</span>
          </div>}
          {agent.nt<80&&<div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:`${C.red}06`,borderRadius:6,borderLeft:`2px solid ${C.red}`}}>
            <span style={{fontSize:12,color:C.red,fontWeight:600}}>Gladly Notes ({agent.nt}%)</span>
            <span style={{fontSize:10,color:C.dim}}>{"\u2014"} direct deduction of ~6.5 pts per fail</span>
          </div>}
        </div>
      }
    </div>
    <div style={{...cs,borderLeft:`3px solid ${C.purple}`,background:`linear-gradient(145deg,${C.purple}06 0%,${C.card} 100%)`}}>
      <div style={{fontSize:10,fontWeight:700,color:C.purple,letterSpacing:"1px",textTransform:"uppercase",marginBottom:6}}>Automated Insight</div>
      <p style={{fontSize:12,color:C.text,lineHeight:1.6,margin:0}}>
        {avg>=72?`${agent.n} maintaining consistency above 72. Velocity: ${s>0?"+":""}${s}/wk. ${fastest.length>0?`Improvement opportunity in ${fastest[0].name} (${fastest[0].met}%).`:"Solid profile across all categories."}`
        :avg>=65?`${distTo72(agent,wIdx)} pts from goal. ${s>0?`Positive trend (+${s}/wk) \u2014 projection: ~${est||"?"}wk.`:"Flat or negative trend \u2014 intervention required."} Top lever: ${fastest[0]?.name||"Proc/Notes"} (${fastest[0]?.met||0}%).`
        :`Score at ${avg}. ${s<0?"Regressing \u2014 high priority.":"Improvement potential identified."} ${fastest[0]?`Focus on ${fastest[0].name} (${fastest[0].met}%) and verify proc compliance (${agent.pr}%) and notes (${agent.nt}%).`:""}`}
      </p>
    </div>
  </div>;
}

// =================================================================
// QA INTELLIGENCE
// =================================================================
function QAIntelView({wIdx}){
  const qas=D.qas;
  const teamAvg=qas.reduce((s,q)=>s+q.avg,0)/qas.length;
  return <div style={cs}>
    <div style={{fontSize:10,fontWeight:600,color:C.dim,letterSpacing:"1px",textTransform:"uppercase",marginBottom:14}}>QA Intelligence {"\u2014"} System Consistency</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
      {[["Team Avg Score",teamAvg.toFixed(1),C.text],["Max Stdev",Math.max(...qas.map(q=>q.sd)).toFixed(1),C.red],["Max Volatility",Math.max(...qas.map(q=>q.vol)).toFixed(1),C.amber]].map(([l,v,c],i)=>
        <div key={i} style={{padding:12,background:"rgba(255,255,255,.02)",borderRadius:8}}>
          <div style={{fontSize:9,color:C.dim}}>{l}</div>
          <div style={{fontSize:20,fontWeight:700,color:c,fontFamily:"monospace"}}>{v}</div>
        </div>)}
    </div>
    {qas.map((qa,i)=>{
      const dev=+(qa.avg-teamAvg).toFixed(1);
      const devColor=Math.abs(dev)>3?(dev<0?C.red:C.amber):C.muted;
      return <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"rgba(255,255,255,.015)",borderRadius:6,marginBottom:3}}>
        <span style={{fontSize:11,fontWeight:600,color:C.text,flex:1,minWidth:130}}>{qa.name}</span>
        <span style={{fontSize:10,color:C.dim,fontFamily:"monospace",width:40}}>n={qa.n}</span>
        <span style={{fontSize:12,fontWeight:700,color:scoreColor(qa.avg),fontFamily:"monospace",width:40,textAlign:"center"}}>{qa.avg}</span>
        <span style={{fontSize:10,color:devColor,fontFamily:"monospace",width:45,textAlign:"center"}}>{dev>0?"+":""}{dev}</span>
        <div style={{width:50}}>
          <div style={{fontSize:8,color:C.muted,textAlign:"center"}}>{"\u03c3"} {qa.sd}</div>
          <div style={{width:"100%",height:4,background:"rgba(255,255,255,.04)",borderRadius:2}}>
            <div style={{width:`${Math.min(qa.sd/15*100,100)}%`,height:"100%",borderRadius:2,background:qa.sd>10?C.red:qa.sd>7?C.amber:C.green}}/>
          </div>
        </div>
        <div style={{width:50}}>
          <div style={{fontSize:8,color:C.muted,textAlign:"center"}}>vol {qa.vol}</div>
          <div style={{width:"100%",height:4,background:"rgba(255,255,255,.04)",borderRadius:2}}>
            <div style={{width:`${Math.min(qa.vol/5*100,100)}%`,height:"100%",borderRadius:2,background:qa.vol>2?C.red:qa.vol>1?C.amber:C.green}}/>
          </div>
        </div>
      </div>;})}
  </div>;
}


// =================================================================
// UPLOAD SCREEN
// =================================================================
function UploadScreen({onDataReady}){
  const[csvFile,setCsvFile]=useState(null);
  const[rosterFile,setRosterFile]=useState(null);
  const[processing,setProcessing]=useState(false);
  const[error,setError]=useState(null);
  const[stats,setStats]=useState(null);

  const handleDrop=(setter)=>(e)=>{
    e.preventDefault();e.stopPropagation();
    e.currentTarget.style.borderColor=C.border;
    const file=e.dataTransfer?.files?.[0]||e.target?.files?.[0];
    if(file)setter(file);
  };
  const handleDragOver=(e)=>{e.preventDefault();e.currentTarget.style.borderColor=C.cyan;};
  const handleDragLeave=(e)=>{e.currentTarget.style.borderColor=C.border;};

  const handleProcess=async()=>{
    if(!csvFile||!rosterFile)return;
    setProcessing(true);setError(null);
    try{
      const csvText=await csvFile.text();
      const xlsxBuf=await rosterFile.arrayBuffer();
      const result=processFiles(csvText,xlsxBuf);
      if(result.error){setError(result.error);setProcessing(false);return;}
      setStats(result.stats);
      setTimeout(()=>onDataReady(result),800);
    }catch(err){
      setError("Processing failed: "+err.message);setProcessing(false);
    }
  };

  const dropZone=(label,file,setter,accept)=>(
    <div onDrop={handleDrop(setter)} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
      style={{flex:1,minWidth:250,border:`2px dashed ${file?C.green:C.border}`,borderRadius:12,padding:32,textAlign:"center",cursor:"pointer",transition:"border-color .2s",background:file?`${C.green}06`:C.card}}
      onClick={()=>{const inp=document.createElement("input");inp.type="file";inp.accept=accept;inp.onchange=e=>{if(e.target.files[0])setter(e.target.files[0]);};inp.click();}}>
      <div style={{fontSize:28,marginBottom:8,opacity:.4}}>{file?"\u2713":"\u2191"}</div>
      <div style={{fontSize:12,fontWeight:600,color:file?C.green:C.text,marginBottom:4}}>{file?file.name:label}</div>
      <div style={{fontSize:10,color:C.dim}}>{file?`${(file.size/1024).toFixed(0)} KB`:"Drag & drop or click to select"}</div>
    </div>
  );

  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"system-ui,-apple-system,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40}}>
    <div style={{maxWidth:700,width:"100%"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:C.cyan,boxShadow:`0 0 12px ${C.cyan}66`}}/>
          <span style={{fontSize:9,fontWeight:600,letterSpacing:"2px",textTransform:"uppercase",color:C.cyan}}>Data Upload</span>
        </div>
        <h1 style={{fontSize:24,fontWeight:700,margin:"0 0 6px"}}>QA Performance System</h1>
        <p style={{fontSize:11,color:C.dim,fontFamily:"monospace",margin:0}}>Phase 2 {"\u00b7"} Drop your files to generate the dashboard</p>
      </div>

      <div style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}>
        {dropZone("QA Reviews CSV (.csv)",csvFile,setCsvFile,".csv")}
        {dropZone("Roster (.xlsx)",rosterFile,setRosterFile,".xlsx,.xls")}
      </div>

      {error&&<div style={{background:`${C.red}12`,border:`1px solid ${C.red}30`,borderRadius:8,padding:"10px 14px",marginBottom:16}}>
        <span style={{fontSize:11,color:C.red}}>{error}</span>
      </div>}

      {stats&&<div style={{background:`${C.green}08`,border:`1px solid ${C.green}30`,borderRadius:8,padding:"10px 14px",marginBottom:16,display:"flex",gap:16,justifyContent:"center"}}>
        {[["Interactions",stats.interactions],["Agents",stats.agents],["Team Leads",stats.tlCount],["Weeks",stats.weekCount]].map(([l,v],i)=>
          <div key={i} style={{textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:700,color:C.green,fontFamily:"monospace"}}>{v}</div>
            <div style={{fontSize:9,color:C.dim}}>{l}</div>
          </div>)}
      </div>}

      <button onClick={handleProcess} disabled={!csvFile||!rosterFile||processing}
        style={{width:"100%",padding:"14px 0",borderRadius:8,border:"none",
          background:csvFile&&rosterFile&&!processing?`linear-gradient(135deg,${C.cyan},${C.blue})`:C.muted,
          color:csvFile&&rosterFile?C.text:`${C.text}66`,fontSize:13,fontWeight:700,cursor:csvFile&&rosterFile&&!processing?"pointer":"not-allowed",
          letterSpacing:"1px",textTransform:"uppercase",transition:"all .2s"}}>
        {processing?"Processing...":"Process & Launch Dashboard"}
      </button>

      <div style={{textAlign:"center",marginTop:20}}>
        <p style={{fontSize:10,color:C.muted,lineHeight:1.6,margin:0}}>
          CSV: AgentConnect QA Reviews export {"\u00b7"} XLSX: SSG General Roster<br/>
          All processing happens in your browser {"\u00b7"} No data leaves your machine
        </p>
      </div>
    </div>
  </div>;
}

// =================================================================
// MAIN APPLICATION (fixed TL dropdown index bug)
// =================================================================
export default function QASystem(){
  const[data,setData]=useState(null);
  const[wIdx,setWIdx]=useState(0);
  const[site,setSite]=useState("all");
  const[selTL,setSelTL]=useState(null);
  const[selAgent,setSelAgent]=useState(null);
  const[showQA,setShowQA]=useState(false);

  // Set module-level D when data is loaded
  if(data&&data!==D){
    D=data;
    WEEKS=D.weeks;
    LATEST_WIDX=WEEKS.length-1;
  }

  // Show upload screen if no data loaded
  if(!D) return <UploadScreen onDataReady={(d)=>{setData(d);setWIdx(d.weeks.length-1);}}/>;

  const filteredTLs=useMemo(()=>site==="all"?D.tls:D.tls.filter(t=>t.site===site),[site]);
  const level=selAgent?"agent":selTL?"tl":"campaign";

  const crumbs=[{label:"Campaign",onClick:()=>{setSelTL(null);setSelAgent(null);setShowQA(false);}}];
  if(selTL)crumbs.push({label:selTL.name,onClick:()=>{setSelAgent(null);}});
  if(selAgent)crumbs.push({label:selAgent.n,onClick:()=>{}});

  function navToTL(tl){setSelTL(tl);setSelAgent(null);setShowQA(false);}
  function navToAgent(a){setSelAgent(a);}

  const sel={fontSize:12,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:"6px 10px",fontFamily:"monospace",cursor:"pointer",outline:"none"};

  // FIX: TL dropdown uses filteredTLs.indexOf for correct mapping
  const handleTLChange=useCallback(e=>{
    const v=e.target.value;
    if(v===""){setSelTL(null);setSelAgent(null);}
    else{const tl=filteredTLs[+v];if(tl)navToTL(tl);}
  },[filteredTLs]);

  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"system-ui,-apple-system,sans-serif"}}>
    <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"16px 28px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:wIdx>=LATEST_WIDX?C.green:C.amber,boxShadow:`0 0 8px ${wIdx>=LATEST_WIDX?C.green:C.amber}66`}}/>
            <span style={{fontSize:9,fontWeight:600,letterSpacing:"2px",textTransform:"uppercase",color:wIdx>=LATEST_WIDX?C.green:C.amber}}>{wIdx>=LATEST_WIDX?"Live":"Historical"}</span>
          </div>
          <h1 style={{fontSize:18,fontWeight:700,margin:0}}>QA Performance System</h1>
          <p style={{fontSize:10,color:C.muted,margin:0,fontFamily:"monospace"}}>Phase 2 {"\u00b7"} Conversion to 72 {"\u00b7"} {D.tls.reduce((s,t)=>s+t.agents.length,0)} agents</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <select value={wIdx} onChange={e=>setWIdx(+e.target.value)} style={{...sel,borderColor:wIdx<LATEST_WIDX?`${C.amber}66`:C.border}}>
            {WEEKS.map((w,i)=><option key={i} value={i}>{w}{i===LATEST_WIDX?" (current)":""}</option>)}
          </select>
          <select value={site} onChange={e=>{setSite(e.target.value);setSelTL(null);setSelAgent(null);}} style={sel}>
            <option value="all">All Sites</option>
            {[...new Set(D.tls.map(t=>t.site))].filter(s=>s&&s!=="???").sort().map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <select value={selTL?filteredTLs.indexOf(selTL):""} onChange={handleTLChange} style={sel}>
            <option value="">All Team Leads</option>
            {filteredTLs.map((t,i)=><option key={i} value={i}>{t.name}</option>)}
          </select>
          {selTL&&<select value={selAgent?selTL.agents.indexOf(selAgent):""} onChange={e=>{const v=e.target.value;if(v==="")setSelAgent(null);else navToAgent(selTL.agents[+v]);}} style={sel}>
            <option value="">All Agents</option>
            {selTL.agents.filter(a=>a.w[wIdx]!=null).sort((a,b)=>(b.w[wIdx]||0)-(a.w[wIdx]||0)).map(a=><option key={selTL.agents.indexOf(a)} value={selTL.agents.indexOf(a)}>{a.n} ({a.w[wIdx]||"\u2014"})</option>)}
          </select>}
          <button onClick={()=>{setShowQA(!showQA);if(!showQA){setSelTL(null);setSelAgent(null);}}} style={{...sel,background:showQA?`${C.purple}15`:C.bg,borderColor:showQA?`${C.purple}44`:C.border,color:showQA?C.purple:C.dim}}>
            QA Intel
          </button>
          <button onClick={()=>{D=null;WEEKS=[];LATEST_WIDX=0;setData(null);setSelTL(null);setSelAgent(null);setShowQA(false);}} style={{...sel,color:C.muted,fontSize:10}} title="Upload new data">
            {"↻"} New Data
          </button>
        </div>
      </div>
      <div style={{display:"flex",gap:4,alignItems:"center",marginTop:10}}>
        {crumbs.map((c,i)=><span key={i} style={{display:"flex",alignItems:"center",gap:4}}>
          {i>0&&<span style={{color:C.muted,fontSize:10}}>{"\u203a"}</span>}
          <button onClick={c.onClick} style={{background:"none",border:"none",color:i===crumbs.length-1?C.text:C.dim,fontSize:11,fontWeight:i===crumbs.length-1?600:400,cursor:"pointer",padding:0,fontFamily:"monospace"}}>{c.label}</button>
        </span>)}
        {showQA&&<><span style={{color:C.muted,fontSize:10}}>{"\u203a"}</span><span style={{fontSize:11,fontWeight:600,color:C.purple}}>QA Intelligence</span></>}
      </div>
    </div>
    <div style={{padding:"20px 28px",maxWidth:1300}}>
      {showQA?<QAIntelView wIdx={wIdx}/>:
       level==="agent"?<AgentView agent={selAgent} wIdx={wIdx}/>:
       level==="tl"?<TLView tl={selTL} wIdx={wIdx} onSelectAgent={navToAgent}/>:
       <CampaignView wIdx={wIdx} onSelectTL={navToTL}/>}
    </div>
    <div style={{padding:"14px 28px",textAlign:"center",borderTop:`1px solid ${C.border}`}}>
      <span style={{fontSize:9,color:C.muted,fontFamily:"monospace"}}>QA Performance System v3.0 {"\u00b7"} Phase 2 {"\u00b7"} Rules Engine {"\u00b7"} 7 weeks {"\u00b7"} {D.tls.length} TLs {"\u00b7"} {D.tls.reduce((s,t)=>s+t.agents.length,0)} agents</span>
    </div>
    <style>{`*{box-sizing:border-box;margin:0}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:3px}select option{background:${C.bg};color:${C.text}}button{font-family:inherit}`}</style>
  </div>;
}

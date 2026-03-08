import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Papa from "papaparse";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine, AreaChart, Area } from "recharts";

let D=null;
let WEEKS=[];
let LATEST_WIDX=0;
const SCS=["WW","TL","RB","VT","AI","OW","SS","AP","PR","LV"];
const SC_FULL={WW:"Warm Welcome",TL:"Thoughtful Listening",RB:"Removing Barriers",VT:"Valuing Time",AI:"Accurate Info",OW:"Ownership",SS:"Sales as Service",AP:"Apologies",PR:"Professionalism",LV:"Living Values"};
const GOAL=72;

const LOGO="data:image/jpeg;base64,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";


const DEFAULT_QA_SHEET="1tH-SwH7OAdMSU-odErm6h8TF2kxCJN1veJ9fhmCzEJU";
const DEFAULT_ROSTER_SHEET="1oY85yRMRQCTsWxzvH43aJsmWsWxLH6PS";
const DEFAULT_SURVEY_SHEET="1KUpnp3oFTLfw0Y9m5qsCaBklYcQYL6L7wE2lTqIZ530";
const ROSTER_TABS=["Leadership","CC MEXICO","CC JAMAICA","ADVANCE CARE TEAM"];
const REFRESH_INTERVAL=12*60*60*1000;

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

function processFiles(csvText,rosterTabs){
  const csv=Papa.parse(csvText,{header:true,skipEmptyLines:true});

  // rosterTabs = {leadership:csvText, ccMexico:csvText, ccJamaica:csvText, act:csvText}

  // 1. Build TL map from Leadership tab
  const tlMap={};
  if(rosterTabs.leadership){
    Papa.parse(rosterTabs.leadership,{header:true,skipEmptyLines:true}).data.forEach(row=>{
      const email=(row["Email"]||"").toString().trim().toLowerCase();
      const name=row["Full Name"]||"";
      const role=(row["Role"]||"").toString();
      const location=(row["Location"]||"").toString();
      if(email&&name&&role.includes("Team Lead")){
        const site=location.includes("Mexico")?"HMO":location.includes("Jamaica")?"JAM":"PAN";
        tlMap[email]={name,location,site};
      }
    });
  }

  // 2. Build agent -> supervisor email mapping from roster tabs
  const agentSup={};
  [rosterTabs.ccMexico,rosterTabs.ccJamaica,rosterTabs.act].forEach(tabCsv=>{
    if(!tabCsv)return;
    Papa.parse(tabCsv,{header:true,skipEmptyLines:true}).data.forEach(row=>{
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

  const rawInts=Object.values(interactions).map(int=>({
    id:int.email+"_"+int.date,agent:int.agent,email:int.email,qa:int.qa,
    score:int.score,channel:int.channel,date:int.date,sc:int.sc,
    proc:int.proc,notes:int.notes
  }));
  return{weeks:weekLabels,weekISO:weeks,tls,qas,rawInts,
    stats:{interactions:Object.keys(interactions).length,agents:totalAgents,tlCount:tls.filter(t=>t.name!=="Unassigned").length,weekCount:weeks.length}};
}



// =================================================================
// COMPUTATION ENGINE (v3.1 — all bugs fixed)
// =================================================================
function getAgentAvg(a,wIdx){return a.w[wIdx];}
function getAgentTrend(a,wIdx){
  const cur=a.w[wIdx],prev=wIdx>0?a.w[wIdx-1]:null;
  if(cur==null||prev==null)return null;



// =================================================================
// SURVEY PROCESSING
// =================================================================
function processSurveys(csvText){
  if(!csvText)return{agents:{},total:0,avgRating:0,responseRate:0};
  const csv=Papa.parse(csvText,{header:true,skipEmptyLines:true});
  const agents={};
  let totalSurveys=0,totalResponded=0,ratingSum=0,ratingCount=0;
  csv.data.forEach(row=>{
    const fn=(row["employee_first_name"]||"").trim();
    const ln=(row["employee_last_name"]||"").trim();
    if(!fn)return;
    const name=fn+" "+ln;
    if(!agents[name])agents[name]={name,surveys:0,responded:0,ratings:[],comments:[],channels:{}};
    agents[name].surveys++;
    totalSurveys++;
    const rating=parseFloat(row["star_rating_response"]);
    if(!isNaN(rating)){
      agents[name].ratings.push(rating);
      ratingSum+=rating;ratingCount++;
      agents[name].responded++;totalResponded++;
    }
    const comment=(row["star_rating_comment"]||"").trim();
    if(comment)agents[name].comments.push(comment);
    const ch=(row["channel"]||"").toLowerCase();
    if(ch)agents[name].channels[ch]=(agents[name].channels[ch]||0)+1;
  });
  Object.values(agents).forEach(a=>{
    a.avgRating=a.ratings.length?+(a.ratings.reduce((s,v)=>s+v,0)/a.ratings.length).toFixed(1):null;
  });
  return{agents,total:totalSurveys,avgRating:ratingCount?+(ratingSum/ratingCount).toFixed(1):0,
    responseRate:totalSurveys?Math.round(totalResponded/totalSurveys*100):0};
}

// =================================================================
// COACHING ENGINE
// =================================================================
function getStrengths(agent,n=3){
  return SCS.map(c=>({code:c,name:SC_FULL[c],pct:agent.sc[c]||0}))
    .sort((a,b)=>b.pct-a.pct).slice(0,n);
}
function getOpportunities(agent,n=3){
  return SCS.map(c=>({code:c,name:SC_FULL[c],pct:agent.sc[c]||0}))
    .sort((a,b)=>a.pct-b.pct).slice(0,n);
}
function getRiskLevel(agent,wIdx){
  const scores=agent.w.filter(v=>v!=null);
  if(scores.length<2)return{level:"LOW",reasons:[]};
  const reasons=[];
  const recent=scores.slice(-3);
  let declining=true;
  for(let i=1;i<recent.length;i++)if(recent[i]>=recent[i-1])declining=false;
  if(declining&&recent.length>=2)reasons.push("Declining trend");
  const belowGoal=agent.w.slice(-3).filter(v=>v!=null&&v<GOAL).length;
  if(belowGoal>=2)reasons.push("Below 72 for "+belowGoal+" weeks");
  if(wIdx>0&&agent.w[wIdx]!=null&&agent.w[wIdx-1]!=null){
    const drop=agent.w[wIdx-1]-agent.w[wIdx];
    if(drop>=10)reasons.push("Dropped "+drop.toFixed(0)+" pts");
  }
  if(agent.pr<50)reasons.push("Low procedures ("+agent.pr+"%)");
  const lowSC=SCS.filter(c=>(agent.sc[c]||0)<50).length;
  if(lowSC>=3)reasons.push(lowSC+" behaviors below 50%");
  const level=reasons.length>=3?"HIGH":reasons.length>=1?"MEDIUM":"LOW";
  return{level,reasons};
}
function generateAlerts(tls,wIdx){
  const alerts=[];
  tls.forEach(tl=>tl.agents.forEach(a=>{
    let consecutive=0;
    for(let i=wIdx;i>=0;i--){if(a.w[i]!=null&&a.w[i]<GOAL)consecutive++;else break;}
    if(consecutive>=2)alerts.push({agent:a.n,tl:tl.name,type:"below_goal",severity:"high",
      msg:"Below "+GOAL+" for "+consecutive+" consecutive weeks (last: "+(a.w[wIdx]||"N/A")+")"});
    if(wIdx>0&&a.w[wIdx]!=null&&a.w[wIdx-1]!=null){
      const drop=a.w[wIdx-1]-a.w[wIdx];
      if(drop>=10)alerts.push({agent:a.n,tl:tl.name,type:"score_drop",severity:"high",
        msg:"Score dropped "+drop.toFixed(1)+" points ("+a.w[wIdx-1]+" \u2192 "+a.w[wIdx]+")"});
    }
    if((a.sc.PR||0)<60)alerts.push({agent:a.n,tl:tl.name,type:"professionalism",severity:"medium",
      msg:"Professionalism at "+(a.sc.PR||0)+"% Met"});
    if(a.pr<50)alerts.push({agent:a.n,tl:tl.name,type:"procedures",severity:"medium",
      msg:"Procedures compliance at "+a.pr+"%"});
  }));
  return alerts.sort((a,b)=>a.severity==="high"?-1:b.severity==="high"?1:0);
}
function exportCoachingCSV(tls,wIdx,surveyData){
  const headers=["Agent","Team Lead","Site","Current Score","4-Wk Avg","Risk Level",
    "Strength 1","Strength 2","Strength 3","Opportunity 1","Opportunity 2","Opportunity 3",
    "Procedures %","Notes %","Surveys","Avg Survey Rating"];
  const rows=[headers.join(",")];
  tls.forEach(tl=>tl.agents.forEach(a=>{
    const risk=getRiskLevel(a,wIdx);
    const str=getStrengths(a);
    const opp=getOpportunities(a);
    const recent=a.w.slice(Math.max(0,wIdx-3),wIdx+1).filter(v=>v!=null);
    const avg4=recent.length?+(recent.reduce((s,v)=>s+v,0)/recent.length).toFixed(1):"N/A";
    const survey=surveyData?.agents?.[a.n];
    rows.push([a.n,tl.name,tl.site,a.w[wIdx]||"N/A",avg4,risk.level,
      ...str.map(s=>s.name+" ("+s.pct+"%)"),
      ...opp.map(o=>o.name+" ("+o.pct+"%)"),
      a.pr,a.nt,survey?.surveys||0,survey?.avgRating||"N/A"
    ].map(v=>typeof v==="string"&&v.includes(",")?'"'+v+'"':v).join(","));
  }));
  const blob=new Blob([rows.join("\n")],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download="nextskill_coaching_report_"+new Date().toISOString().substring(0,10)+".csv";
  link.click();URL.revokeObjectURL(url);
}

// =================================================================
// COMPUTATION ENGINE
// =================================================================
function getAgentAvg(a,wIdx){return a.w[wIdx];}
function getAgentTrend(a,wIdx){
  if(wIdx<1)return null;
  const prev=a.w[wIdx-1],cur=a.w[wIdx];
  return prev!=null&&cur!=null?+(cur-prev).toFixed(1):null;
}
function slope(a){
  const pts=a.w.map((v,i)=>v!=null?[i,v]:null).filter(Boolean);
  if(pts.length<2)return 0;
  const n=pts.length,sx=pts.reduce((s,p)=>s+p[0],0),sy=pts.reduce((s,p)=>s+p[1],0);
  const sxy=pts.reduce((s,p)=>s+p[0]*p[1],0),sxx=pts.reduce((s,p)=>s+p[0]*p[0],0);
  return +((n*sxy-sx*sy)/(n*sxx-sx*sx)).toFixed(2);
}
function classify(a,wIdx){
  const v=getAgentAvg(a,wIdx),s=slope(a);
  if(v==null)return{cat:"No Data",color:"#555"};
  if(v>=GOAL&&s>=0)return{cat:"Stable",color:"#4ade80"};
  if(v>=GOAL&&s<0)return{cat:"Monitor",color:"#facc15"};
  if(v<GOAL&&v>=60&&s>0)return{cat:"Convertible",color:"#38bdf8"};
  if(v<GOAL&&v>=60&&s<=0)return{cat:"Stagnant",color:"#fb923c"};
  if(v<GOAL&&v>=60&&s<-1)return{cat:"Regressing",color:"#f87171"};
  if(v<60)return{cat:"Critical",color:"#ef4444"};
  return{cat:"Convertible",color:"#38bdf8"};
}
function distTo72(a,wIdx){const v=getAgentAvg(a,wIdx);return v!=null?+(GOAL-v).toFixed(1):null;}
function weeksTo72(a,wIdx){const d=distTo72(a,wIdx),s=slope(a);return d!=null&&d>0&&s>0?Math.ceil(d/s):null;}
function project(a,weeks){
  const s=slope(a),last=a.w.filter(v=>v!=null).pop();
  if(last==null)return[];
  return Array.from({length:weeks},(_,i)=>Math.min(100,Math.max(0,+(last+s*(i+1)).toFixed(1))));
}
function wowDelta(agents,wIdx){
  if(wIdx<1)return null;
  const cur=[],prev=[];
  agents.forEach(a=>{
    if(a.w[wIdx]!=null)cur.push(a.w[wIdx]);
    if(a.w[wIdx-1]!=null)prev.push(a.w[wIdx-1]);
  });
  if(!cur.length||!prev.length)return null;
  return +((cur.reduce((s,v)=>s+v,0)/cur.length)-(prev.reduce((s,v)=>s+v,0)/prev.length)).toFixed(1);
}
function scImpact(a){
  const below=SCS.filter(c=>(a.sc[c]||0)<70).map(c=>({code:c,name:SC_FULL[c],val:a.sc[c]||0,gap:70-(a.sc[c]||0)}));
  return below.sort((a,b)=>b.gap-a.gap);
}
function genFocusCards(level,context,wIdx){
  const cards=[];
  if(level==="campaign"){
    const allAgents=D.tls.flatMap(t=>t.agents);
    const atGoal=allAgents.filter(a=>a.w[wIdx]!=null&&a.w[wIdx]>=GOAL).length;
    const convertible=allAgents.filter(a=>{const c=classify(a,wIdx);return c.cat==="Convertible";});
    const critical=allAgents.filter(a=>classify(a,wIdx).cat==="Critical");
    cards.push({title:"Compliance Rate",value:allAgents.length?Math.round(atGoal/allAgents.length*100)+"%":"N/A",
      sub:atGoal+" of "+allAgents.length+" agents at "+GOAL+"+",color:"#4ade80",icon:"\u2713"});
    if(convertible.length)cards.push({title:"Convertible Pipeline",value:convertible.length+" agents",
      sub:"Positive trend, below "+GOAL,color:"#38bdf8",icon:"\u2191"});
    if(critical.length)cards.push({title:"Critical Agents",value:critical.length,
      sub:critical.slice(0,3).map(a=>a.n).join(", "),color:"#ef4444",icon:"\u26a0"});
  } else if(level==="tl"&&context){
    const t=context;
    const avg=t.agents.filter(a=>a.w[wIdx]!=null);
    const mean=avg.length?(avg.reduce((s,a)=>s+a.w[wIdx],0)/avg.length).toFixed(1):"N/A";
    cards.push({title:"Team Average",value:mean,sub:avg.length+" evaluated this week",color:"#38bdf8",icon:"\u2300"});
    const conv=t.agents.filter(a=>classify(a,wIdx).cat==="Convertible");
    if(conv.length){const top=conv.sort((a,b)=>(b.w[wIdx]||0)-(a.w[wIdx]||0))[0];
      cards.push({title:"Fastest Path",value:top.n,sub:"Score "+top.w[wIdx]+" \u2014 only "+distTo72(top,wIdx)+" pts to "+GOAL,color:"#4ade80",icon:"\u21e1"});}
  } else if(level==="agent"&&context){
    const a=context;
    const s=slope(a),cat=classify(a,wIdx);
    cards.push({title:"Trend",value:(s>=0?"+":"")+s+" pts/wk",sub:cat.cat,color:cat.color,icon:s>=0?"\u2197":"\u2198"});
    const proj=project(a,4);
    if(proj.length)cards.push({title:"Projection",value:proj[proj.length-1],sub:"Est. in 4 weeks",color:proj[proj.length-1]>=GOAL?"#4ade80":"#fb923c",icon:"\u21e2"});
    const weak=scImpact(a);
    if(weak[0])cards.push({title:"Top Lever",value:weak[0].name,sub:weak[0].val+"% Met \u2014 "+weak[0].gap+"pt gap",color:"#a78bfa",icon:"\u2699"});
    const wk=weeksTo72(a,wIdx);
    if(wk&&(a.w[wIdx]||0)<GOAL)cards.push({title:"Path to "+GOAL,value:"~"+wk+" weeks",sub:"At current rate (+"+s+"/wk)",color:"#38bdf8",icon:"\u23f1"});
  }
  return cards;
}

// =================================================================
// COLORS & STYLING
// =================================================================
const C={bg:"#0a0f1a",panel:"#111827",card:"#1a2236",border:"#1e293b",text:"#e2e8f0",dim:"#94a3b8",
  muted:"#475569",cyan:"#06b6d4",blue:"#3b82f6",green:"#4ade80",red:"#ef4444",amber:"#f59e0b",
  purple:"#a78bfa",orange:"#f97316",teal:"#14b8a6"};
const cs={background:C.card,borderRadius:10,border:"1px solid "+C.border,padding:16};

// =================================================================
// GOOGLE SHEETS FETCH
// =================================================================
function sheetCsvUrl(sheetId,tabName){
  const base="https://docs.google.com/spreadsheets/d/"+sheetId+"/gviz/tq?tqx=out:csv";
  return tabName?base+"&sheet="+encodeURIComponent(tabName):base;
}
async function fetchFromSheets(qaSheetId,rosterSheetId,surveySheetId){
  const qaResp=await fetch(sheetCsvUrl(qaSheetId));
  if(!qaResp.ok) throw new Error("Failed to fetch QA data ("+qaResp.status+"). Make sure the sheet is shared.");
  const qaText=await qaResp.text();
  const tabKeys=["leadership","ccMexico","ccJamaica","act"];
  const rosterTabs={};
  for(let i=0;i<ROSTER_TABS.length;i++){
    try{
      const resp=await fetch(sheetCsvUrl(rosterSheetId,ROSTER_TABS[i]));
      if(resp.ok) rosterTabs[tabKeys[i]]=await resp.text();
    }catch(e){console.warn("Could not fetch tab:",ROSTER_TABS[i],e);}
  }
  if(!rosterTabs.leadership) throw new Error("Could not fetch Leadership tab from roster.");
  const result=processFiles(qaText,rosterTabs);
  let surveyData={agents:{},total:0,avgRating:0,responseRate:0};
  if(surveySheetId){
    try{
      const sResp=await fetch(sheetCsvUrl(surveySheetId));
      if(sResp.ok)surveyData=processSurveys(await sResp.text());
    }catch(e){console.warn("Survey fetch failed:",e);}
  }
  return{...result,surveyData};
}


// =================================================================
// SHARED UI COMPONENTS
// =================================================================
function Tp({active,payload,label}){
  if(!active||!payload)return null;
  return <div style={{background:C.panel,border:"1px solid "+C.border,borderRadius:8,padding:"8px 12px",fontSize:11}}>
    <div style={{color:C.dim,marginBottom:4}}>{label}</div>
    {payload.map((p,i)=><div key={i} style={{color:p.color||C.text}}>{p.name}: <b>{p.value}</b></div>)}
  </div>;
}
function WoWBadge({delta}){
  if(delta==null)return null;
  const up=delta>=0;
  return <span style={{fontSize:10,fontWeight:700,color:up?C.green:C.red,marginLeft:6}}>{up?"\u25b2":"\u25bc"}{Math.abs(delta).toFixed(1)}</span>;
}
function HistoricalBanner({wIdx}){
  if(wIdx>=LATEST_WIDX)return null;
  return <div style={{background:C.amber+"10",border:"1px solid "+C.amber+"30",borderRadius:8,padding:"8px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
    <span style={{fontSize:14}}>{"\u23f3"}</span>
    <span style={{fontSize:11,color:C.amber}}>Viewing historical data: <b>{WEEKS[wIdx]}</b></span>
    <span style={{fontSize:10,color:C.dim,marginLeft:"auto"}}>Current: {WEEKS[LATEST_WIDX]}</span>
  </div>;
}
function EmptyState({message}){
  return <div style={{...cs,textAlign:"center",padding:40}}>
    <div style={{fontSize:28,opacity:.3,marginBottom:8}}>{"\u2205"}</div>
    <div style={{fontSize:12,color:C.dim}}>{message}</div>
  </div>;
}
function KpiCard({value,label,color,delta,icon,onClick}){
  return <div onClick={onClick} style={{...cs,flex:1,minWidth:140,cursor:onClick?"pointer":"default",transition:"border-color .2s"}}
    onMouseEnter={e=>{if(onClick)e.currentTarget.style.borderColor=color;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;}}>
    {icon&&<div style={{fontSize:14,marginBottom:4,opacity:.5}}>{icon}</div>}
    <div style={{fontSize:22,fontWeight:800,color,fontFamily:"monospace"}}>{value}{delta!=null&&<WoWBadge delta={delta}/>}</div>
    <div style={{fontSize:10,color:C.dim,marginTop:2}}>{label}</div>
  </div>;
}
function FocusCard({card}){
  return <div style={{...cs,flex:1,minWidth:200,borderLeft:"3px solid "+card.color}}>
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
      <span style={{fontSize:14}}>{card.icon}</span>
      <span style={{fontSize:10,fontWeight:600,color:C.dim,textTransform:"uppercase",letterSpacing:"0.5px"}}>{card.title}</span>
    </div>
    <div style={{fontSize:16,fontWeight:700,color:card.color,fontFamily:"monospace"}}>{card.value}</div>
    <div style={{fontSize:10,color:C.dim,marginTop:4}}>{card.sub}</div>
  </div>;
}
function RiskBadge({level}){
  const colors={HIGH:C.red,MEDIUM:C.amber,LOW:C.green};
  return <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:10,
    background:(colors[level]||C.dim)+"18",color:colors[level]||C.dim,letterSpacing:"0.5px"}}>{level}</span>;
}
function TabButton({label,active,onClick,badge}){
  return <button onClick={onClick} style={{fontSize:11,fontWeight:active?700:500,padding:"8px 16px",
    borderRadius:6,border:"none",cursor:"pointer",transition:"all .15s",
    background:active?C.cyan+"15":"transparent",color:active?C.cyan:C.dim,position:"relative"}}>
    {label}
    {badge>0&&<span style={{position:"absolute",top:2,right:2,fontSize:8,fontWeight:700,
      background:C.red,color:"#fff",borderRadius:10,padding:"1px 5px",minWidth:14,textAlign:"center"}}>{badge}</span>}
  </button>;
}

// =================================================================
// INTERACTION MODAL
// =================================================================
function InteractionModal({interactions,onClose}){
  const[idx,setIdx]=useState(0);
  const int=interactions[idx];
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
    onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{background:C.panel,borderRadius:16,border:"1px solid "+C.border,
      maxWidth:600,width:"100%",maxHeight:"85vh",overflow:"auto",padding:24}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h3 style={{fontSize:16,fontWeight:700,margin:0}}>Interaction Detail</h3>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.dim,fontSize:18,cursor:"pointer"}}>{"\u2715"}</button>
      </div>
      {interactions.length>1&&<div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
        {interactions.map((it,i)=><button key={i} onClick={()=>setIdx(i)}
          style={{fontSize:10,padding:"4px 10px",borderRadius:4,border:"1px solid "+(i===idx?C.cyan:C.border),
            background:i===idx?C.cyan+"15":C.card,color:i===idx?C.cyan:C.dim,cursor:"pointer"}}>
          {new Date(it.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})} {"\u2014"} {it.score}
        </button>)}
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <div style={{...cs}}><div style={{fontSize:9,color:C.dim,textTransform:"uppercase",marginBottom:4}}>Agent</div><div style={{fontSize:13,fontWeight:600}}>{int.agent}</div></div>
        <div style={{...cs}}><div style={{fontSize:9,color:C.dim,textTransform:"uppercase",marginBottom:4}}>QA Reviewer</div><div style={{fontSize:13,fontWeight:600}}>{int.qa}</div></div>
        <div style={{...cs}}><div style={{fontSize:9,color:C.dim,textTransform:"uppercase",marginBottom:4}}>Score</div><div style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:int.score>=GOAL?C.green:int.score>=60?C.amber:C.red}}>{int.score}</div></div>
        <div style={{...cs}}><div style={{fontSize:9,color:C.dim,textTransform:"uppercase",marginBottom:4}}>Details</div><div style={{fontSize:11}}>{(int.channel||"").toUpperCase()} {"\u00b7"} {new Date(int.date).toLocaleDateString()}</div></div>
      </div>
      <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>Service Commitments</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        {SCS.map(c=>{const val=int.sc?.[c];const met=val==="Met"||val==="Exceed";const partial=val==="Met Some";
          return <div key={c} style={{padding:"8px 12px",borderRadius:6,fontSize:11,
            background:met?C.green+"10":partial?C.amber+"10":C.red+"10",
            border:"1px solid "+(met?C.green+"30":partial?C.amber+"30":C.red+"30"),
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>{SC_FULL[c]}</span>
            <span style={{fontWeight:700,color:met?C.green:partial?C.amber:C.red}}>{met?"\u2713":partial?"\u25cb":"\u2717"}</span>
          </div>;})}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:8}}>
        {[["Follows Procedures",int.proc],["Notes in Gladly",int.notes]].map(([lbl,val])=>
          <div key={lbl} style={{padding:"8px 12px",borderRadius:6,fontSize:11,
            background:val?C.green+"10":C.red+"10",border:"1px solid "+(val?C.green+"30":C.red+"30"),
            display:"flex",justifyContent:"space-between"}}>
            <span>{lbl}</span><span style={{fontWeight:700,color:val?C.green:C.red}}>{val?"\u2713":"\u2717"}</span>
          </div>)}
      </div>
    </div>
  </div>;
}

// =================================================================
// AGENT PROFILE PANEL
// =================================================================
function AgentProfilePanel({agent,tl,wIdx,interactions,surveyData,onClose,onViewInteraction}){
  if(!agent)return null;
  const risk=getRiskLevel(agent,wIdx);
  const strengths=getStrengths(agent);
  const opps=getOpportunities(agent);
  const agentInts=(interactions||[]).filter(i=>i.agent===agent.n);
  const survey=surveyData?.agents?.[agent.n];
  const trendData=agent.w.map((v,i)=>v!=null?{wk:WEEKS[i],score:v}:null).filter(Boolean);

  return <div style={{position:"fixed",top:0,right:0,bottom:0,width:420,background:C.panel,borderLeft:"1px solid "+C.border,
    zIndex:900,overflowY:"auto",padding:24,boxShadow:"-8px 0 32px rgba(0,0,0,.5)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
      <div>
        <div style={{fontSize:10,color:C.dim,textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>Agent Profile</div>
        <h2 style={{fontSize:18,fontWeight:700,margin:0}}>{agent.n}</h2>
        <div style={{fontSize:11,color:C.dim,marginTop:2}}>{tl?.name||"--"} {"\u00b7"} {tl?.site||"--"}</div>
      </div>
      <button onClick={onClose} style={{background:"none",border:"none",color:C.dim,fontSize:18,cursor:"pointer"}}>{"\u2715"}</button>
    </div>
    <div style={{display:"flex",gap:8,marginBottom:16}}>
      <div style={{...cs,flex:1,textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,fontFamily:"monospace",color:(agent.w[wIdx]||0)>=GOAL?C.green:C.amber}}>{agent.w[wIdx]||"--"}</div><div style={{fontSize:9,color:C.dim}}>Current</div></div>
      <div style={{...cs,flex:1,textAlign:"center"}}><RiskBadge level={risk.level}/><div style={{fontSize:9,color:C.dim,marginTop:4}}>Risk</div></div>
      <div style={{...cs,flex:1,textAlign:"center"}}><div style={{fontSize:14,fontWeight:700,fontFamily:"monospace"}}>{agentInts.length}</div><div style={{fontSize:9,color:C.dim}}>Evals</div></div>
    </div>
    {risk.reasons.length>0&&<div style={{...cs,marginBottom:12,borderLeft:"3px solid "+(risk.level==="HIGH"?C.red:C.amber)}}>
      <div style={{fontSize:10,fontWeight:600,color:C.dim,marginBottom:4}}>Risk Factors</div>
      {risk.reasons.map((r,i)=><div key={i} style={{fontSize:11,color:risk.level==="HIGH"?C.red:C.amber,marginTop:2}}>{"\u2022"} {r}</div>)}
    </div>}
    <div style={{...cs,marginBottom:12}}>
      <div style={{fontSize:10,fontWeight:600,color:C.dim,marginBottom:8}}>Score Trend</div>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={trendData}>
          <defs><linearGradient id="agGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={C.cyan} stopOpacity={0.3}/><stop offset="95%" stopColor={C.cyan} stopOpacity={0}/>
          </linearGradient></defs>
          <CartesianGrid stroke={C.border+"50"} strokeDasharray="3 3"/>
          <XAxis dataKey="wk" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false}/>
          <YAxis domain={[0,100]} tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} width={30}/>
          <ReferenceLine y={GOAL} stroke={C.green+"66"} strokeDasharray="4 4"/>
          <Area type="monotone" dataKey="score" stroke={C.cyan} fill="url(#agGrad)" strokeWidth={2} dot={{r:3,fill:C.cyan}}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
      <div style={{...cs,borderLeft:"3px solid "+C.green}}>
        <div style={{fontSize:10,fontWeight:600,color:C.green,marginBottom:6}}>Strengths</div>
        {strengths.map((s,i)=><div key={i} style={{fontSize:11,marginTop:3,display:"flex",justifyContent:"space-between"}}>
          <span>{s.name}</span><span style={{color:C.green,fontWeight:700,fontFamily:"monospace"}}>{s.pct}%</span></div>)}
      </div>
      <div style={{...cs,borderLeft:"3px solid "+C.red}}>
        <div style={{fontSize:10,fontWeight:600,color:C.red,marginBottom:6}}>Opportunities</div>
        {opps.map((o,i)=><div key={i} style={{fontSize:11,marginTop:3,display:"flex",justifyContent:"space-between"}}>
          <span>{o.name}</span><span style={{color:C.red,fontWeight:700,fontFamily:"monospace"}}>{o.pct}%</span></div>)}
      </div>
    </div>
    <div style={{...cs,marginBottom:12}}>
      <div style={{fontSize:10,fontWeight:600,color:C.dim,marginBottom:6}}>All Behaviors</div>
      {SCS.map(c=><div key={c} style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
        <span style={{fontSize:9,color:C.dim,width:80}}>{SC_FULL[c]}</span>
        <div style={{flex:1,height:6,background:C.bg,borderRadius:3,overflow:"hidden"}}>
          <div style={{width:(agent.sc[c]||0)+"%",height:"100%",borderRadius:3,
            background:(agent.sc[c]||0)>=70?C.green:(agent.sc[c]||0)>=50?C.amber:C.red}}/>
        </div>
        <span style={{fontSize:10,fontWeight:600,fontFamily:"monospace",width:32,textAlign:"right"}}>{agent.sc[c]||0}%</span>
      </div>)}
    </div>
    {survey&&<div style={{...cs,marginBottom:12,borderLeft:"3px solid "+C.purple}}>
      <div style={{fontSize:10,fontWeight:600,color:C.purple,marginBottom:6}}>Survey Insights</div>
      <div style={{display:"flex",gap:16}}>
        <div><span style={{fontSize:16,fontWeight:700,fontFamily:"monospace",color:C.purple}}>{survey.surveys}</span><span style={{fontSize:10,color:C.dim}}> surveys</span></div>
        {survey.avgRating&&<div><span style={{fontSize:16,fontWeight:700,fontFamily:"monospace",color:C.purple}}>{survey.avgRating}</span><span style={{fontSize:10,color:C.dim}}> avg {"\u2605"}</span></div>}
      </div>
    </div>}
    {agentInts.length>0&&<div style={{...cs}}>
      <div style={{fontSize:10,fontWeight:600,color:C.dim,marginBottom:6}}>Recent Evaluations</div>
      {agentInts.slice(-5).reverse().map((int,i)=><div key={i} onClick={()=>onViewInteraction([int])}
        style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",
          borderBottom:i<4?"1px solid "+C.border+"22":undefined,cursor:"pointer"}}>
        <span style={{fontSize:11}}>{new Date(int.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
        <span style={{fontSize:10,color:C.dim}}>{int.qa}</span>
        <span style={{fontSize:12,fontWeight:700,fontFamily:"monospace",
          color:int.score>=GOAL?C.green:int.score>=60?C.amber:C.red}}>{int.score}</span>
      </div>)}
    </div>}
  </div>;
}

// =================================================================
// DASHBOARD VIEWS
// =================================================================
function CampaignView({wIdx,onSelectTL,onSelectAgent}){
  const allAgents=D.tls.flatMap(t=>t.agents);
  const scored=allAgents.filter(a=>a.w[wIdx]!=null);
  const avg=scored.length?(scored.reduce((s,a)=>s+a.w[wIdx],0)/scored.length).toFixed(1):"--";
  const atGoal=scored.filter(a=>a.w[wIdx]>=GOAL).length;
  const pct72=scored.length?Math.round(atGoal/scored.length*100):0;
  const wow=wowDelta(allAgents,wIdx);
  const cards=genFocusCards("campaign",null,wIdx);
  const catCounts={};
  allAgents.forEach(a=>{const c=classify(a,wIdx);catCounts[c.cat]=(catCounts[c.cat]||0)+1;});
  const catData=Object.entries(catCounts).map(([cat,count])=>{
    const colors={Stable:"#4ade80",Monitor:"#facc15",Convertible:"#38bdf8",Stagnant:"#fb923c",Regressing:"#f87171",Critical:"#ef4444","No Data":"#555"};
    return{cat,count,color:colors[cat]||"#555"};});

  return <div>
    <HistoricalBanner wIdx={wIdx}/>
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <KpiCard value={avg} label="QA Score" color={C.cyan} delta={wow} icon={"\u2300"}/>
      <KpiCard value={pct72+"%"} label={"\u2265 "+GOAL} color={C.green} icon={"\u2713"}/>
      <KpiCard value={scored.length} label="Evaluated" color={C.blue} icon={"\ud83d\udc65"}/>
      <KpiCard value={D.tls.length} label="Team Leads" color={C.purple} icon={"\u2302"}/>
    </div>
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      {cards.map((c,i)=><FocusCard key={i} card={c}/>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12,marginBottom:16}}>
      <div style={{...cs}}>
        <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:8}}>Weekly Score Trend</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={WEEKS.map((wk,i)=>{const s=allAgents.filter(a=>a.w[i]!=null);
            return{wk,avg:s.length?(s.reduce((sum,a)=>sum+a.w[i],0)/s.length).toFixed(1):null};})}>
            <defs><linearGradient id="campG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.cyan} stopOpacity={0.3}/><stop offset="95%" stopColor={C.cyan} stopOpacity={0}/>
            </linearGradient></defs>
            <CartesianGrid stroke={C.border+"50"} strokeDasharray="3 3"/>
            <XAxis dataKey="wk" tick={{fontSize:9,fill:C.muted}} axisLine={false}/>
            <YAxis domain={[40,85]} tick={{fontSize:9,fill:C.muted}} axisLine={false} width={30}/>
            <Tooltip content={<Tp/>}/>
            <ReferenceLine y={GOAL} stroke={C.green+"66"} strokeDasharray="4 4"/>
            <Area type="monotone" dataKey="avg" name="Avg Score" stroke={C.cyan} fill="url(#campG)" strokeWidth={2} dot={{r:3,fill:C.cyan}}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{...cs}}>
        <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:8}}>Agent Categories</div>
        {catData.sort((a,b)=>b.count-a.count).map(d=><div key={d.cat} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:d.color}}/><span style={{fontSize:11,flex:1}}>{d.cat}</span>
          <span style={{fontSize:12,fontWeight:700,fontFamily:"monospace",color:d.color}}>{d.count}</span></div>)}
      </div>
    </div>
    <div style={{...cs}}>
      <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:8}}>Team Lead Rankings</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{borderBottom:"1px solid "+C.border}}>
          {["Team Lead","Site","Agents","Avg","\\u2265 72","Trend"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:C.dim,fontWeight:600,fontSize:10}}>{h}</th>)}
        </tr></thead>
        <tbody>{D.tls.map((t,i)=>{
          const ta=t.agents.filter(a=>a.w[wIdx]!=null);
          const tavg=ta.length?(ta.reduce((s,a)=>s+a.w[wIdx],0)/ta.length).toFixed(1):"--";
          const tw=wowDelta(t.agents,wIdx);
          return <tr key={i} onClick={()=>onSelectTL(t)} style={{cursor:"pointer",borderBottom:"1px solid "+C.border+"22"}}
            onMouseEnter={e=>e.currentTarget.style.background=C.cyan+"08"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <td style={{padding:"8px 10px",fontWeight:600}}>{t.name}</td>
            <td style={{padding:"8px 10px",color:C.dim}}>{t.site}</td>
            <td style={{padding:"8px 10px",fontFamily:"monospace"}}>{t.agents.length}</td>
            <td style={{padding:"8px 10px",fontWeight:700,fontFamily:"monospace",color:parseFloat(tavg)>=GOAL?C.green:C.amber}}>{tavg}</td>
            <td style={{padding:"8px 10px",fontFamily:"monospace"}}>{ta.filter(a=>a.w[wIdx]>=GOAL).length}/{ta.length}</td>
            <td style={{padding:"8px 10px"}}>{tw!=null&&<WoWBadge delta={tw}/>}</td>
          </tr>;})}</tbody>
      </table>
    </div>
  </div>;
}

function TLView({tl,wIdx,onSelectAgent}){
  if(!tl)return null;
  const scored=tl.agents.filter(a=>a.w[wIdx]!=null);
  if(!scored.length)return <EmptyState message={"No evaluations for "+tl.name+" in week "+WEEKS[wIdx]}/>;
  const avg=(scored.reduce((s,a)=>s+a.w[wIdx],0)/scored.length).toFixed(1);
  const wow=wowDelta(tl.agents,wIdx);
  const cards=genFocusCards("tl",tl,wIdx);
  return <div>
    <HistoricalBanner wIdx={wIdx}/>
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <KpiCard value={avg} label="Team Avg" color={C.cyan} delta={wow} icon={"\u2300"}/>
      <KpiCard value={scored.filter(a=>a.w[wIdx]>=GOAL).length+"/"+scored.length} label={"\u2265 "+GOAL} color={C.green} icon={"\u2713"}/>
      <KpiCard value={tl.agents.length} label="Agents" color={C.blue} icon={"\ud83d\udc65"}/>
    </div>
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>{cards.map((c,i)=><FocusCard key={i} card={c}/>)}</div>
    <div style={{...cs}}>
      <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:8}}>Agent Rankings</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{borderBottom:"1px solid "+C.border}}>
          {["Agent","Score","Cat.","Trend","\u2192 72","Ch","Risk"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",color:C.dim,fontWeight:600,fontSize:10}}>{h}</th>)}
        </tr></thead>
        <tbody>{[...tl.agents].sort((a,b)=>(b.w[wIdx]||0)-(a.w[wIdx]||0)).map((a,i)=>{
          const cat=classify(a,wIdx),tr=getAgentTrend(a,wIdx),w72=weeksTo72(a,wIdx),risk=getRiskLevel(a,wIdx);
          return <tr key={i} onClick={()=>onSelectAgent(a)} style={{cursor:"pointer",borderBottom:"1px solid "+C.border+"22"}}
            onMouseEnter={e=>e.currentTarget.style.background=C.cyan+"08"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <td style={{padding:"8px",fontWeight:600}}>{a.n}</td>
            <td style={{padding:"8px",fontWeight:700,fontFamily:"monospace",color:cat.color}}>{a.w[wIdx]||"--"}</td>
            <td style={{padding:"8px"}}><span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:cat.color+"18",color:cat.color}}>{cat.cat}</span></td>
            <td style={{padding:"8px"}}>{tr!=null&&<WoWBadge delta={tr}/>}</td>
            <td style={{padding:"8px",fontFamily:"monospace",fontSize:10,color:C.dim}}>{w72?"~"+w72+"w":"--"}</td>
            <td style={{padding:"8px",fontSize:10,color:C.dim}}>{a.ch}</td>
            <td style={{padding:"8px"}}><RiskBadge level={risk.level}/></td>
          </tr>;})}</tbody>
      </table>
    </div>
  </div>;
}

function AgentView({agent,tl,wIdx}){
  if(!agent)return null;
  const v=agent.w[wIdx],cat=classify(agent,wIdx);
  if(v==null)return <EmptyState message={"No evaluations for "+agent.n+" in week "+WEEKS[wIdx]}/>;
  const tr=getAgentTrend(agent,wIdx);
  const cards=genFocusCards("agent",agent,wIdx);
  const trendData=agent.w.map((val,i)=>val!=null?{wk:WEEKS[i],score:val}:null).filter(Boolean);
  const scData=SCS.map(c=>({name:SC_FULL[c],val:agent.sc[c]||0}));
  return <div>
    <HistoricalBanner wIdx={wIdx}/>
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <KpiCard value={v} label="Current Score" color={cat.color} delta={tr}/>
      <KpiCard value={agent.pr+"%"} label="Procedures" color={agent.pr>=70?C.green:C.red}/>
      <KpiCard value={agent.nt+"%"} label="Notes" color={agent.nt>=70?C.green:C.red}/>
    </div>
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>{cards.map((c,i)=><FocusCard key={i} card={c}/>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <div style={{...cs}}>
        <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:8}}>Score Trend</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={trendData}>
            <CartesianGrid stroke={C.border+"50"} strokeDasharray="3 3"/>
            <XAxis dataKey="wk" tick={{fontSize:9,fill:C.muted}} axisLine={false}/>
            <YAxis domain={[0,100]} tick={{fontSize:9,fill:C.muted}} axisLine={false} width={28}/>
            <Tooltip content={<Tp/>}/>
            <ReferenceLine y={GOAL} stroke={C.green+"66"} strokeDasharray="4 4"/>
            <Line type="monotone" dataKey="score" name="Score" stroke={C.cyan} strokeWidth={2} dot={{r:4,fill:C.cyan}}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{...cs}}>
        <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:8}}>Service Commitments</div>
        {scData.map((d,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
          <span style={{fontSize:9,color:C.dim,width:70,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.name}</span>
          <div style={{flex:1,height:6,background:C.bg,borderRadius:3,overflow:"hidden"}}>
            <div style={{width:d.val+"%",height:"100%",borderRadius:3,background:d.val>=70?C.green:d.val>=50?C.amber:C.red}}/></div>
          <span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",width:28,textAlign:"right",color:d.val>=70?C.green:d.val>=50?C.amber:C.red}}>{d.val}%</span>
        </div>)}
      </div>
    </div>
  </div>;
}

// =================================================================
// TABS: COACHING, QA ANALYTICS, SURVEYS
// =================================================================
function CoachingTab({alerts,wIdx,onSelectAgent,tls}){
  const high=alerts.filter(a=>a.severity==="high"),med=alerts.filter(a=>a.severity==="medium");
  return <div>
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <KpiCard value={alerts.length} label="Total Alerts" color={C.red} icon={"\u26a0"}/>
      <KpiCard value={high.length} label="High Severity" color={C.red}/>
      <KpiCard value={med.length} label="Medium" color={C.amber}/>
    </div>
    {high.length>0&&<div style={{...cs,marginBottom:12,borderLeft:"3px solid "+C.red}}>
      <div style={{fontSize:11,fontWeight:600,color:C.red,marginBottom:8}}>{"\u26a0"} High Priority</div>
      {high.map((a,i)=><div key={i} style={{padding:"8px 0",borderBottom:i<high.length-1?"1px solid "+C.border+"22":undefined,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><span style={{fontSize:12,fontWeight:600,cursor:"pointer"}} onClick={()=>{const t=tls.find(t=>t.name===a.tl);const ag=t?.agents.find(x=>x.n===a.agent);if(ag&&t)onSelectAgent(ag,t);}}>{a.agent}</span>
          <span style={{fontSize:10,color:C.dim,marginLeft:8}}>{a.tl}</span></div>
        <span style={{fontSize:10,color:C.red}}>{a.msg}</span></div>)}</div>}
    {med.length>0&&<div style={{...cs,borderLeft:"3px solid "+C.amber}}>
      <div style={{fontSize:11,fontWeight:600,color:C.amber,marginBottom:8}}>{"\u26a0"} Monitor</div>
      {med.map((a,i)=><div key={i} style={{padding:"6px 0",borderBottom:i<med.length-1?"1px solid "+C.border+"22":undefined,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><span style={{fontSize:11,fontWeight:600,cursor:"pointer"}} onClick={()=>{const t=tls.find(t=>t.name===a.tl);const ag=t?.agents.find(x=>x.n===a.agent);if(ag&&t)onSelectAgent(ag,t);}}>{a.agent}</span>
          <span style={{fontSize:10,color:C.dim,marginLeft:8}}>{a.tl}</span></div>
        <span style={{fontSize:10,color:C.amber}}>{a.msg}</span></div>)}</div>}
    {!alerts.length&&<EmptyState message="No coaching alerts this week."/>}
  </div>;
}

function QAAnalyticsTab({wIdx}){
  const qaData=D.qas||[];
  return <div>
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <KpiCard value={qaData.length} label="QA Analysts" color={C.purple}/>
      <KpiCard value={qaData.reduce((s,q)=>s+q.n,0)} label="Total Evaluations" color={C.blue}/>
      <KpiCard value={qaData.length?(qaData.reduce((s,q)=>s+q.avg,0)/qaData.length).toFixed(1):"--"} label="Avg Score Given" color={C.cyan}/>
    </div>
    <div style={{...cs,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:8}}>Calibration Overview</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={[...qaData].sort((a,b)=>a.avg-b.avg)} layout="vertical">
          <CartesianGrid stroke={C.border+"50"} strokeDasharray="3 3"/>
          <XAxis type="number" domain={[40,90]} tick={{fontSize:9,fill:C.muted}} axisLine={false}/>
          <YAxis dataKey="name" type="category" tick={{fontSize:9,fill:C.muted}} width={120} axisLine={false}/>
          <Tooltip content={<Tp/>}/>
          <ReferenceLine x={GOAL} stroke={C.green+"66"} strokeDasharray="4 4"/>
          <Bar dataKey="avg" name="Avg Score" radius={[0,4,4,0]}>
            {[...qaData].sort((a,b)=>a.avg-b.avg).map((q,i)=><Cell key={i} fill={q.avg>=GOAL?C.green:q.avg>=60?C.amber:C.red}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div style={{...cs}}>
      <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:8}}>Reviewer Details</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{borderBottom:"1px solid "+C.border}}>
          {["QA Analyst","Evals","Avg Score","Std Dev","Volatility"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:C.dim,fontWeight:600,fontSize:10}}>{h}</th>)}
        </tr></thead>
        <tbody>{[...qaData].sort((a,b)=>b.n-a.n).map((q,i)=>
          <tr key={i} style={{borderBottom:"1px solid "+C.border+"22"}}>
            <td style={{padding:"8px 10px",fontWeight:600}}>{q.name}</td>
            <td style={{padding:"8px 10px",fontFamily:"monospace"}}>{q.n}</td>
            <td style={{padding:"8px 10px",fontWeight:700,fontFamily:"monospace",color:q.avg>=GOAL?C.green:C.amber}}>{q.avg}</td>
            <td style={{padding:"8px 10px",fontFamily:"monospace",color:q.sd>12?C.red:C.dim}}>{q.sd}</td>
            <td style={{padding:"8px 10px",fontFamily:"monospace",color:q.vol>2?C.red:C.dim}}>{q.vol}</td>
          </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

function SurveyTab({surveyData}){
  if(!surveyData||!surveyData.total)return <EmptyState message="No survey data available."/>;
  const agents=Object.values(surveyData.agents).filter(a=>a.ratings.length>0).sort((a,b)=>b.avgRating-a.avgRating);
  return <div>
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <KpiCard value={surveyData.total} label="Total Surveys" color={C.purple} icon={"\ud83d\udce8"}/>
      <KpiCard value={surveyData.avgRating||"--"} label="Avg Rating" color={C.purple} icon={"\u2605"}/>
      <KpiCard value={surveyData.responseRate+"%"} label="Response Rate" color={C.teal}/>
      <KpiCard value={agents.length} label="Agents w/ Feedback" color={C.blue}/>
    </div>
    <div style={{...cs}}>
      <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:8}}>Agent Survey Performance</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{borderBottom:"1px solid "+C.border}}>
          {["Agent","Surveys","Responded","Avg Rating","Latest Comment"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",color:C.dim,fontWeight:600,fontSize:10}}>{h}</th>)}
        </tr></thead>
        <tbody>{agents.map((a,i)=>
          <tr key={i} style={{borderBottom:"1px solid "+C.border+"22"}}>
            <td style={{padding:"8px 10px",fontWeight:600}}>{a.name}</td>
            <td style={{padding:"8px 10px",fontFamily:"monospace"}}>{a.surveys}</td>
            <td style={{padding:"8px 10px",fontFamily:"monospace"}}>{a.responded}</td>
            <td style={{padding:"8px 10px"}}><span style={{fontWeight:700,fontFamily:"monospace",color:a.avgRating>=4?C.green:a.avgRating>=3?C.amber:C.red}}>{a.avgRating}</span> {"\u2605"}</td>
            <td style={{padding:"8px 10px",fontSize:10,color:C.dim,maxWidth:200,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.comments.length?a.comments[a.comments.length-1].substring(0,80):"--"}</td>
          </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

// =================================================================
// LOADING & SETUP SCREENS
// =================================================================
function LoadingScreen({error,onSetup}){
  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Segoe UI',system-ui,sans-serif",
    display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
    <div style={{textAlign:"center"}}>
      <img src={LOGO} alt="NextSkill" style={{height:48,marginBottom:16,filter:"invert(1)"}}/>
      {error?<><p style={{fontSize:12,color:C.red,margin:"0 0 16px",maxWidth:400}}>{error}</p>
        <button onClick={onSetup} style={{padding:"8px 20px",borderRadius:6,border:"1px solid "+C.cyan,background:"transparent",color:C.cyan,fontSize:11,cursor:"pointer"}}>Configure</button>
      </>:<div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:C.cyan,animation:"pulse 1.5s infinite"}}/>
        <span style={{fontSize:11,color:C.dim,fontFamily:"monospace"}}>Connecting to Google Sheets...</span>
      </div>}
    </div>
    <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
  </div>;
}

function SetupScreen({onDataReady,savedConfig}){
  const[qaId,setQaId]=useState(savedConfig?.qaId||"");
  const[rosterId,setRosterId]=useState(savedConfig?.rosterId||"");
  const[surveyId,setSurveyId]=useState(savedConfig?.surveyId||"");
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState(null);
  const autoFetched=React.useRef(false);
  React.useEffect(()=>{
    if(savedConfig?.qaId&&savedConfig?.rosterId&&!autoFetched.current){
      autoFetched.current=true;handleConnect(savedConfig.qaId,savedConfig.rosterId,savedConfig.surveyId);}
  },[]);
  const extractId=(input)=>{if(!input)return"";const s=input.trim();const m=s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);return m?m[1]:s;};
  const handleConnect=async(qId,rId,sId)=>{
    const q=extractId(qId||qaId),r=extractId(rId||rosterId),s=extractId(sId||surveyId);
    if(!q||!r){setError("QA and Roster Sheet IDs required.");return;}
    setLoading(true);setError(null);
    try{const result=await fetchFromSheets(q,r,s);
      if(result.error){setError(result.error);setLoading(false);return;}
      window.location.hash="qa="+q+"&roster="+r+"&survey="+s;
      onDataReady(result,{qaId:q,rosterId:r,surveyId:s});
    }catch(err){setError(err.message);setLoading(false);}
  };
  const inp={width:"100%",padding:"10px 14px",background:C.bg,border:"1px solid "+C.border,borderRadius:8,color:C.text,fontSize:12,fontFamily:"monospace",outline:"none",boxSizing:"border-box"};
  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Segoe UI',system-ui,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40}}>
    <div style={{maxWidth:500,width:"100%"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <img src={LOGO} alt="NextSkill" style={{height:42,marginBottom:12,filter:"invert(1)"}}/>
        <p style={{fontSize:11,color:C.dim,margin:0}}>Connect your Google Sheets to launch</p>
      </div>
      <div style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:600,color:C.dim,display:"block",marginBottom:4}}>QA REVIEWS SHEET *</label>
        <input value={qaId} onChange={e=>setQaId(e.target.value)} placeholder="Paste URL or Sheet ID" style={inp}/></div>
      <div style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:600,color:C.dim,display:"block",marginBottom:4}}>ROSTER SHEET *</label>
        <input value={rosterId} onChange={e=>setRosterId(e.target.value)} placeholder="Paste URL or Sheet ID" style={inp}/></div>
      <div style={{marginBottom:20}}><label style={{fontSize:10,fontWeight:600,color:C.dim,display:"block",marginBottom:4}}>SURVEY SHEET (optional)</label>
        <input value={surveyId} onChange={e=>setSurveyId(e.target.value)} placeholder="Paste URL or Sheet ID" style={inp}/></div>
      {error&&<div style={{background:C.red+"12",border:"1px solid "+C.red+"30",borderRadius:8,padding:"10px 14px",marginBottom:16}}>
        <span style={{fontSize:11,color:C.red}}>{error}</span></div>}
      <button onClick={()=>handleConnect()} disabled={!qaId||!rosterId||loading}
        style={{width:"100%",padding:"14px 0",borderRadius:8,border:"none",
          background:qaId&&rosterId&&!loading?"linear-gradient(135deg,"+C.cyan+","+C.blue+")":C.muted,
          color:qaId&&rosterId?C.text:C.text+"66",fontSize:13,fontWeight:700,cursor:qaId&&rosterId&&!loading?"pointer":"not-allowed",
          letterSpacing:"1px",textTransform:"uppercase"}}>
        {loading?"Connecting...":"Connect & Launch"}</button>
    </div>
  </div>;
}

// =================================================================
// MAIN APPLICATION
// =================================================================
export default function NextSkill(){
  const[data,setData]=useState(null);
  const[config,setConfig]=useState(()=>{
    const h=window.location.hash.substring(1);const params=new URLSearchParams(h);
    return{qaId:params.get("qa")||DEFAULT_QA_SHEET,rosterId:params.get("roster")||DEFAULT_ROSTER_SHEET,
      surveyId:params.get("survey")||DEFAULT_SURVEY_SHEET};});
  const[wIdx,setWIdx]=useState(0);
  const[site,setSite]=useState("all");
  const[selTL,setSelTL]=useState(null);
  const[selAgent,setSelAgent]=useState(null);
  const[selAgentTL,setSelAgentTL]=useState(null);
  const[tab,setTab]=useState("dashboard");
  const[lastUpdated,setLastUpdated]=useState(null);
  const[refreshing,setRefreshing]=useState(false);
  const[loadError,setLoadError]=useState(null);
  const[showSetup,setShowSetup]=useState(false);
  const[showProfile,setShowProfile]=useState(false);
  const[modalInts,setModalInts]=useState(null);
  const intervalRef=React.useRef(null);
  const initialLoad=React.useRef(false);

  if(data&&data!==D){D=data;WEEKS=D.weeks;LATEST_WIDX=WEEKS.length-1;}

  const filteredTLs=useMemo(()=>!D?[]:site==="all"?D.tls:D.tls.filter(t=>t.site===site),[site,data]);
  const alerts=useMemo(()=>!D?[]:generateAlerts(D.tls,wIdx),[data,wIdx]);
  const handleRefresh=useCallback(async()=>{
    if(!config||refreshing)return;setRefreshing(true);
    try{const result=await fetchFromSheets(config.qaId,config.rosterId,config.surveyId);
      if(!result.error){D=result;WEEKS=result.weeks;LATEST_WIDX=WEEKS.length-1;
        setData(result);setLastUpdated(new Date());setWIdx(result.weeks.length-1);}
    }catch(e){}setRefreshing(false);
  },[config,refreshing]);

  React.useEffect(()=>{
    if(initialLoad.current||!config)return;initialLoad.current=true;
    (async()=>{try{const result=await fetchFromSheets(config.qaId,config.rosterId,config.surveyId);
      if(result.error){setLoadError(result.error);return;}
      D=result;WEEKS=result.weeks;LATEST_WIDX=WEEKS.length-1;
      setData(result);setWIdx(result.weeks.length-1);setLastUpdated(new Date());
    }catch(e){setLoadError(e.message);}})();
  },[config]);

  React.useEffect(()=>{if(!config)return;
    intervalRef.current=setInterval(async()=>{try{const r=await fetchFromSheets(config.qaId,config.rosterId,config.surveyId);
      if(!r.error){D=r;WEEKS=r.weeks;LATEST_WIDX=WEEKS.length-1;setData(r);setLastUpdated(new Date());}}catch(e){}},REFRESH_INTERVAL);
    return()=>clearInterval(intervalRef.current);},[config]);

  if(showSetup) return <SetupScreen savedConfig={config} onDataReady={(d,cfg)=>{setData(d);setConfig(cfg);setWIdx(d.weeks.length-1);setLastUpdated(new Date());setShowSetup(false);}}/>;
  if(!D) return <LoadingScreen error={loadError} onSetup={()=>setShowSetup(true)}/>;

  const onSelectTL=(tl)=>{setSelTL(tl);setSelAgent(null);setShowProfile(false);setTab("dashboard");};
  const onSelectAgent=(a,tl)=>{setSelAgent(a);setSelAgentTL(tl||selTL);setShowProfile(true);setTab("dashboard");};

  const sel={fontSize:11,background:C.bg,border:"1px solid "+C.border,borderRadius:6,color:C.text,padding:"6px 10px",fontFamily:"monospace",cursor:"pointer",outline:"none"};

  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
    {/* HEADER */}
    <div style={{background:C.panel,borderBottom:"1px solid "+C.border,padding:"12px 28px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <img src={LOGO} alt="NextSkill" style={{height:28,filter:"invert(1)"}}/>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:wIdx>=LATEST_WIDX?C.green:C.amber,boxShadow:"0 0 6px "+(wIdx>=LATEST_WIDX?C.green:C.amber)+"66"}}/>
            <span style={{fontSize:8,fontWeight:600,letterSpacing:"1.5px",textTransform:"uppercase",color:wIdx>=LATEST_WIDX?C.green:C.amber}}>{wIdx>=LATEST_WIDX?"Live":"Historical"}</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <select value={wIdx} onChange={e=>setWIdx(+e.target.value)} style={{...sel,borderColor:wIdx<LATEST_WIDX?C.amber+"66":C.border}}>
            {WEEKS.map((w,i)=><option key={i} value={i}>{w}{i===LATEST_WIDX?" (current)":""}</option>)}</select>
          <select value={site} onChange={e=>{setSite(e.target.value);setSelTL(null);setSelAgent(null);}} style={sel}>
            <option value="all">All Sites</option>
            {[...new Set(D.tls.map(t=>t.site))].filter(s=>s&&s!=="???").sort().map(s=><option key={s} value={s}>{s}</option>)}</select>
          <button onClick={handleRefresh} disabled={refreshing} style={{...sel,color:refreshing?C.amber:C.cyan}}>
            {refreshing?"\u23f3":"\u21bb"}</button>
          {lastUpdated&&<span style={{fontSize:8,color:C.muted,fontFamily:"monospace"}}>{lastUpdated.toLocaleTimeString()}</span>}
          <button onClick={()=>setShowSetup(true)} style={{...sel,color:C.muted,fontSize:9}}>{"\u2699"}</button>
        </div>
      </div>
      <div style={{display:"flex",gap:4,marginTop:12}}>
        <TabButton label="Dashboard" active={tab==="dashboard"} onClick={()=>setTab("dashboard")}/>
        <TabButton label="Coaching" active={tab==="coaching"} onClick={()=>setTab("coaching")} badge={alerts.filter(a=>a.severity==="high").length}/>
        <TabButton label="QA Analytics" active={tab==="qa"} onClick={()=>setTab("qa")}/>
        <TabButton label="Surveys" active={tab==="surveys"} onClick={()=>setTab("surveys")}/>
      </div>
    </div>

    {/* BREADCRUMBS + EXPORT */}
    {tab==="dashboard"&&<div style={{padding:"12px 28px 0",display:"flex",alignItems:"center",gap:4}}>
      {[{label:"Campaign",onClick:()=>{setSelTL(null);setSelAgent(null);setShowProfile(false);}},
        ...(selTL?[{label:selTL.name,onClick:()=>{setSelAgent(null);setShowProfile(false);}}]:[]),
        ...(selAgent?[{label:selAgent.n,onClick:()=>{}}]:[]),
      ].map((c,i,arr)=><React.Fragment key={i}>
        {i>0&&<span style={{color:C.muted,fontSize:10}}>{"\u203a"}</span>}
        <button onClick={c.onClick} style={{background:"none",border:"none",color:i===arr.length-1?C.text:C.cyan,
          fontSize:11,cursor:i<arr.length-1?"pointer":"default",fontWeight:i===arr.length-1?700:400,padding:0}}>{c.label}</button>
      </React.Fragment>)}
      <div style={{marginLeft:"auto",display:"flex",gap:4}}>
        <select value={selTL?filteredTLs.indexOf(selTL):""} onChange={e=>{const v=e.target.value;if(v===""){setSelTL(null);setSelAgent(null);}else{const tl=filteredTLs[+v];if(tl)onSelectTL(tl);}}} style={sel}>
          <option value="">All Team Leads</option>
          {filteredTLs.map((t,i)=><option key={i} value={i}>{t.name}</option>)}</select>
        <button onClick={()=>exportCoachingCSV(D.tls,wIdx,D.surveyData)} style={{...sel,color:C.teal,borderColor:C.teal+"44"}} title="Export Coaching Report">
          {"\u2913"} Export</button>
      </div>
    </div>}

    {/* CONTENT */}
    <div style={{padding:"16px 28px 40px"}}>
      {tab==="dashboard"&&(selAgent?<AgentView agent={selAgent} tl={selAgentTL||selTL} wIdx={wIdx}/>:
        selTL?<TLView tl={selTL} wIdx={wIdx} onSelectAgent={a=>onSelectAgent(a,selTL)}/>:
        <CampaignView wIdx={wIdx} onSelectTL={onSelectTL} onSelectAgent={onSelectAgent}/>)}
      {tab==="coaching"&&<CoachingTab alerts={alerts} wIdx={wIdx} onSelectAgent={onSelectAgent} tls={D.tls}/>}
      {tab==="qa"&&<QAAnalyticsTab wIdx={wIdx}/>}
      {tab==="surveys"&&<SurveyTab surveyData={D.surveyData}/>}
    </div>

    {/* FOOTER */}
    <div style={{textAlign:"center",padding:"12px 28px",borderTop:"1px solid "+C.border}}>
      <span style={{fontSize:9,color:C.muted,fontFamily:"monospace"}}>NextSkill v4.0 {"\u00b7"} QA Coaching Platform {"\u00b7"} {D.tls.length} TLs {"\u00b7"} {D.tls.reduce((s,t)=>s+t.agents.length,0)} agents</span>
    </div>

    {/* AGENT PROFILE SIDE PANEL */}
    {showProfile&&selAgent&&<AgentProfilePanel agent={selAgent} tl={selAgentTL||selTL} wIdx={wIdx}
      interactions={D.rawInts} surveyData={D.surveyData}
      onClose={()=>setShowProfile(false)} onViewInteraction={ints=>setModalInts(ints)}/>}

    {/* INTERACTION MODAL */}
    {modalInts&&<InteractionModal interactions={modalInts} onClose={()=>setModalInts(null)}/>}
  </div>;
}

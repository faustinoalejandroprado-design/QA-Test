import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Papa from "papaparse";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine, AreaChart, Area } from "recharts";

let D=null;
let WEEKS=[];
let LATEST_WIDX=0;
const SCS=["WW","TL","RB","VT","AI","OW","SS","AP","PR","LV"];
const SC_FULL={WW:"Warm Welcome",TL:"Thoughtful Listening",RB:"Removing Barriers",VT:"Valuing Time",AI:"Accurate Info",OW:"Ownership",SS:"Sales as Service",AP:"Apologies",PR:"Professionalism",LV:"Living Values"};
const GOAL=72;

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
  const agentSup={};
  [rosterTabs.ccMexico,rosterTabs.ccJamaica,rosterTabs.act].forEach(tabCsv=>{
    if(!tabCsv)return;
    Papa.parse(tabCsv,{header:true,skipEmptyLines:true}).data.forEach(row=>{
      const email=(row["Email"]||"").toString().trim().toLowerCase();
      const supervisor=(row["Supervisor"]||"").toString().trim().toLowerCase();
      if(email&&supervisor) agentSup[email]=supervisor;
    });
  });

  const cfs=csv.data.filter(r=>r["Scorecard Name"]==="Customer First Scorecard"&&(r["Email"]||"").includes("contractor."));
  if(!cfs.length) return{error:"No contractor evaluations found in CSV."};

  const interactions={};
  cfs.forEach(r=>{
    const iid=r["Interaction ID"];
    if(!interactions[iid]){
      interactions[iid]={
        agent:r["Name"],email:r["Email"].trim().toLowerCase(),
        qa:r["Taker Name"],score:parseFloat(r["Overall Review Score"])||0,
        channel:(r["Channel"]||"").substring(0,3)||"???",
        date:r["Time Started"],sc:{},proc:null,notes:null,
        assignmentId:r["Assignment ID"]||"",interactionId:iid,
        url:r["Interaction URL"]||"",comments:{}
      };
    }
    const q=r["Question Text"]||"";
    if(SC_MAP[q]) interactions[iid].sc[SC_MAP[q]]=r["Answer Text"];
    if(q==="Follows Procedures") interactions[iid].proc=r["Answer Text"]==="Yes";
    if(q.includes("Notes in Gladly")) interactions[iid].notes=r["Answer Text"]==="Yes";
    const cmt=(r["Comments"]||"").trim();
    if(cmt&&q) interactions[iid].comments[q]=cmt;
  });

  const weekSet=new Set();
  Object.values(interactions).forEach(i=>weekSet.add(getWeekStart(i.date)));
  const weeks=[...weekSet].sort();
  const weekLabels=weeks.map(w=>{
    const d=new Date(w+"T00:00:00Z");
    return d.toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
  });

  const agentData={};
  Object.values(interactions).forEach(int=>{
    if(!agentData[int.email]) agentData[int.email]={name:int.agent,email:int.email,interactions:[],channels:[]};
    agentData[int.email].interactions.push(int);
    agentData[int.email].channels.push(int.channel);
  });

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
    proc:int.proc,notes:int.notes,comments:int.comments||{},
    assignmentId:int.assignmentId,interactionId:int.interactionId,url:int.url
  }));
  return{weeks:weekLabels,weekISO:weeks,tls,qas,rawInts,
    stats:{interactions:Object.keys(interactions).length,agents:totalAgents,tlCount:tls.filter(t=>t.name!=="Unassigned").length,weekCount:weeks.length}};
}

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
    if(!agents[name])agents[name]={name,surveys:0,responded:0,ratings:[],comments:[],channels:[],entries:[]};
    agents[name].surveys++;
    totalSurveys++;
    const rating=parseFloat(row["star_rating_response"]);
    const surveyUrl=(row["external_url"]||"").trim();
    const convId=surveyUrl.split("/conversation/")[1]||"";
    const surveyDate=(row["request_sent_at"]||"").substring(0,10);
    const comment=(row["star_rating_comment"]||"").trim();
    const ch=(row["channel"]||"").toLowerCase();
    agents[name].entries.push({rating:isNaN(rating)?null:rating,comment,convId,date:surveyDate,url:surveyUrl,channel:ch});
    if(!isNaN(rating)){
      agents[name].ratings.push(rating);
      ratingSum+=rating;ratingCount++;
      agents[name].responded++;totalResponded++;
    }
    if(comment)agents[name].comments.push(comment);
  });
  Object.values(agents).forEach(a=>{a.avgRating=a.ratings.length?+(a.ratings.reduce((s,v)=>s+v,0)/a.ratings.length).toFixed(1):null;});
  const byConvId={};
  Object.values(agents).forEach(a=>a.entries.forEach(e=>{if(e.convId)byConvId[e.convId]={agent:a.name,rating:e.rating,comment:e.comment,date:e.date};}));
  return{agents,byConvId,total:totalSurveys,avgRating:ratingCount?+(ratingSum/ratingCount).toFixed(1):0,responseRate:totalSurveys?Math.round(totalResponded/totalSurveys*100):0};
}

function extractConvId(url){return (url||"").split("/conversation/")[1]||"";}
function pearsonCorrelation(xs,ys){
  if(xs.length<3)return null;
  const n=xs.length;
  const mx=xs.reduce((s,v)=>s+v,0)/n, my=ys.reduce((s,v)=>s+v,0)/n;
  let num=0,dx=0,dy=0;
  for(let i=0;i<n;i++){num+=(xs[i]-mx)*(ys[i]-my);dx+=(xs[i]-mx)**2;dy+=(ys[i]-my)**2;}
  const denom=Math.sqrt(dx*dy);
  return denom===0?0:+(num/denom).toFixed(2);
}

function csatQaCorrelation(tls, surveyData, rawInts) {
  if(!surveyData?.byConvId||!Object.keys(surveyData.byConvId).length)
    return{findings:[],agentMap:{},pairs:[],pearson:null,categoryImpact:[],matched:0};
  const pairs=[];
  const agentPairs={};
  (rawInts||[]).forEach(int=>{
    const convId=extractConvId(int.url);
    const survey=surveyData.byConvId[convId];
    if(survey&&survey.rating!=null){
      pairs.push({agent:int.agent,qaScore:int.score,csatRating:survey.rating,scBreakdown:int.sc,date:int.date,comment:survey.comment});
      if(!agentPairs[int.agent])agentPairs[int.agent]=[];
      agentPairs[int.agent].push({qaScore:int.score,csatRating:survey.rating});
    }
  });
  const qScores=pairs.map(p=>p.qaScore), cScores=pairs.map(p=>p.csatRating*20);
  const pearson=pearsonCorrelation(qScores,cScores);
  const categoryImpact=SCS.map(c=>{
    const valid=pairs.filter(p=>p.scBreakdown?.[c]);
    const xs=valid.map(p=>p.scBreakdown[c]==="Met"||p.scBreakdown[c]==="Exceed"?1:0);
    const ys=valid.map(p=>p.csatRating);
    return{code:c,name:SC_FULL[c],correlation:pearsonCorrelation(xs,ys),n:valid.length};
  }).filter(c=>c.correlation!=null).sort((a,b)=>Math.abs(b.correlation)-Math.abs(a.correlation));
  const agentMap={};
  Object.entries(agentPairs).forEach(([name,ps])=>{
    const avgQA=+(ps.reduce((s,p)=>s+p.qaScore,0)/ps.length).toFixed(1);
    const avgCSAT=+(ps.reduce((s,p)=>s+p.csatRating,0)/ps.length).toFixed(1);
    agentMap[name]={qaScore:avgQA,csatRating:avgCSAT,matchedInteractions:ps.length,
      alignment:avgCSAT>=4&&avgQA>=GOAL?"aligned":avgCSAT>=4&&avgQA<GOAL?"csat_leads":avgCSAT<3&&avgQA>=GOAL?"qa_leads":avgCSAT<3&&avgQA<60?"both_low":"neutral"};
  });
  const findings=[];
  Object.entries(agentMap).forEach(([name,d])=>{
    if(d.csatRating>=4&&d.qaScore<GOAL) findings.push({agent:name,type:"high_csat_low_qa",severity:"insight",msg:"CSAT "+d.csatRating+"\u2605 but QA "+d.qaScore});
    if(d.csatRating<3&&d.qaScore>=GOAL) findings.push({agent:name,type:"low_csat_high_qa",severity:"warning",msg:"CSAT "+d.csatRating+"\u2605 but QA "+d.qaScore});
    if(d.csatRating<3&&d.qaScore<60) findings.push({agent:name,type:"both_low",severity:"critical",msg:"CSAT "+d.csatRating+"\u2605 and QA "+d.qaScore});
  });
  if(categoryImpact.length>=2){
    const top=categoryImpact[0];
    findings.unshift({agent:"Campaign",type:"impact_insight",severity:"insight",msg:top.name+" has highest CSAT impact (r="+top.correlation+")."});
  }
  return{findings:findings.sort((a,b)=>a.severity==="critical"?-1:b.severity==="critical"?1:0),agentMap,pairs,pearson,categoryImpact,matched:pairs.length};
}

function getStrengths(agent,n=3){return SCS.map(c=>({code:c,name:SC_FULL[c],pct:agent.sc[c]||0})).sort((a,b)=>b.pct-a.pct).slice(0,n);}
function getOpportunities(agent,n=3){return SCS.map(c=>({code:c,name:SC_FULL[c],pct:agent.sc[c]||0})).sort((a,b)=>a.pct-b.pct).slice(0,n);}
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
    if(consecutive>=2)alerts.push({agent:a.n,tl:tl.name,type:"below_goal",severity:"high",msg:"Below "+GOAL+" for "+consecutive+" consecutive weeks"});
    if(wIdx>0&&a.w[wIdx]!=null&&a.w[wIdx-1]!=null){
      const drop=a.w[wIdx-1]-a.w[wIdx];
      if(drop>=10)alerts.push({agent:a.n,tl:tl.name,type:"score_drop",severity:"high",msg:"Score dropped "+drop.toFixed(1)+" points"});
    }
  }));
  return alerts.sort((a,b)=>a.severity==="high"?-1:b.severity==="high"?1:0);
}

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
  const v=a.w[wIdx],s=slope(a);
  if(v==null)return{cat:"No Data",color:"#555"};
  if(v>=GOAL&&s>=0)return{cat:"Stable",color:"#4ade80"};
  if(v>=GOAL&&s<0)return{cat:"Monitor",color:"#facc15"};
  if(v<GOAL&&v>=60&&s>0)return{cat:"Convertible",color:"#38bdf8"};
  if(v<GOAL&&v>=60&&s<=0)return{cat:"Stagnant",color:"#fb923c"};
  if(v<GOAL&&v>=60&&s<-1)return{cat:"Regressing",color:"#f87171"};
  if(v<60)return{cat:"Critical",color:"#ef4444"};
  return{cat:"Convertible",color:"#38bdf8"};
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

const C={bg:"#0a0f1a",panel:"#111827",card:"#1a2236",border:"#1e293b",text:"#e2e8f0",dim:"#94a3b8",
  muted:"#475569",cyan:"#06b6d4",blue:"#3b82f6",green:"#4ade80",red:"#ef4444",amber:"#f59e0b",
  purple:"#a78bfa",orange:"#f97316",teal:"#14b8a6"};
const cs={background:C.card,borderRadius:10,border:"1px solid "+C.border,padding:16};

function sheetCsvUrl(sheetId,tabName){
  const base="https://docs.google.com/spreadsheets/d/"+sheetId+"/gviz/tq?tqx=out:csv";
  return tabName?base+"&sheet="+encodeURIComponent(tabName):base;
}
async function fetchFromSheets(qaSheetId,rosterSheetId,surveySheetId){
  const qaResp=await fetch(sheetCsvUrl(qaSheetId));
  if(!qaResp.ok) throw new Error("Failed to fetch QA data.");
  const qaText=await qaResp.text();
  const tabKeys=["leadership","ccMexico","ccJamaica","act"];
  const rosterTabs={};
  for(let i=0;i<ROSTER_TABS.length;i++){
    try{
      const resp=await fetch(sheetCsvUrl(rosterSheetId,ROSTER_TABS[i]));
      if(resp.ok) rosterTabs[tabKeys[i]]=await resp.text();
    }catch(e){}
  }
  const result=processFiles(qaText,rosterTabs);
  let surveyData={agents:{},total:0,avgRating:0,responseRate:0};
  if(surveySheetId){
    try{
      const sResp=await fetch(sheetCsvUrl(surveySheetId));
      if(sResp.ok)surveyData=processSurveys(await sResp.text());
    }catch(e){}
  }
  return{...result,surveyData};
}

function Tp({active,payload,label}){
  if(!active||!payload)return null;
  return <div style={{background:C.panel,border:"1px solid "+C.border,borderRadius:8,padding:"8px 12px",fontSize:11}}>
    <div style={{color:C.dim,marginBottom:4}}>{label}</div>
    {payload.map((p,i)=><div key={i} style={{color:p.color||C.text}}>{p.name}: <b>{p.value}</b></div>)}
  </div>;
}

// ---- MICRO-COMPONENTS NUEVOS Y MEJORADOS ---- //

function WoWBadge({delta}){
  if(delta==null)return null;
  const up=delta>=0;
  return <span style={{fontSize:10,fontWeight:700,color:up?C.green:C.red,marginLeft:6}}>{up?"\u25b2":"\u25bc"}{Math.abs(delta).toFixed(1)}</span>;
}

function PremiumBadge({ text, color }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
      background: color + "1A", color: color, border: "1px solid " + color + "33",
      letterSpacing: "0.5px"
    }}>
      {text}
    </span>
  );
}

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return <div style={{width: 60, height: 30, color: C.dim, fontSize:10}}>--</div>;
  const chartData = data.map(v => ({ val: v }));
  return (
    <ResponsiveContainer width={60} height={30}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
            <stop offset="95%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="val" stroke={color} fill={`url(#grad-${color})`} strokeWidth={2} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SortHeader({columns,sortKey,sortDir,onSort}){
  return <thead><tr style={{borderBottom:"1px solid "+C.border}}>
    {columns.map(([key,label,w])=><th key={key} onClick={()=>onSort(key)}
      style={{textAlign:"left",padding:"6px 10px",color:sortKey===key?C.cyan:C.dim,fontWeight:600,fontSize:10,
        cursor:"pointer",userSelect:"none",width:w||"auto",whiteSpace:"nowrap"}}>
      {label} {sortKey===key?(sortDir==="asc"?"\u25b2":"\u25bc"):"\u25b8"}
    </th>)}
  </tr></thead>;
}

function useSort(defaultKey,defaultDir="desc"){
  const[sk,setSk]=useState(defaultKey);
  const[sd,setSd]=useState(defaultDir);
  const toggle=(key)=>{if(sk===key)setSd(sd==="asc"?"desc":"asc");else{setSk(key);setSd("desc");}};
  const sortFn=(a,b)=>{
    const va=typeof a==="string"?a.toLowerCase():a??-Infinity;
    const vb=typeof b==="string"?b.toLowerCase():b??-Infinity;
    return sd==="asc"?(va>vb?1:va<vb?-1:0):(va<vb?1:va>vb?-1:0);
  };
  return{sk,sd,toggle,sortFn};
}

// ------------------------------------------------ //

function CampaignView({wIdx,onSelectTL,onSelectAgent,catFilter,setCatFilter,csatFindings,site,filteredTLs}){
  const tlSort=useSort("score");
  const allAgents=filteredTLs.flatMap(t=>t.agents);
  
  // -- CÁLCULO DE PRIORITY INSIGHTS --
  let criticalAgent = null;
  let gapAgent = null;
  let topMover = null;

  const validAgents = allAgents.filter(a => a.w[wIdx] != null);
  if (validAgents.length > 0) {
    // Agente crítico (puntaje más bajo < 60)
    const criticals = [...validAgents].filter(a => a.w[wIdx] < 60).sort((a,b) => a.w[wIdx] - b.w[wIdx]);
    if(criticals.length > 0) criticalAgent = criticals[0];

    // Gap detected (del análisis CSAT-QA)
    if(csatFindings) {
      const gapFinding = csatFindings.find(f => f.type === "high_csat_low_qa");
      if (gapFinding) {
        gapAgent = validAgents.find(a => a.n === gapFinding.agent);
      }
    }

    // Top mover
    const movers = [...validAgents].map(a => ({ a, trend: getAgentTrend(a, wIdx) || 0 }))
                                    .filter(x => x.trend > 0)
                                    .sort((a,b) => b.trend - a.trend);
    if(movers.length > 0) topMover = movers[0];
  }

  // Estilo Glassmorphism para las tarjetas Premium
  const glassCard = {
    background: "rgba(15, 23, 42, 0.4)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(30, 41, 59, 0.8)",
    borderRadius: "12px",
    padding: "16px",
    flex: 1,
    minWidth: 200,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    cursor: "pointer",
    transition: "background 0.2s"
  };

  return <div>
    
    {/* SECCIÓN 1: PRIORITY INSIGHTS */}
    <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
      
      {/* Tarjeta Critical */}
      {criticalAgent ? (
        <div style={glassCard} onClick={()=>setCatFilter("Critical")} onMouseEnter={e=>e.currentTarget.style.background="rgba(30, 41, 59, 0.6)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(15, 23, 42, 0.4)"}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.red}}/>
            <span style={{color:C.red,fontWeight:600,fontSize:12}}>Critical Alert</span>
          </div>
          <div style={{fontSize:12,color:C.dim}}>Needs Intervention: <span style={{color:C.text,fontWeight:700}}>{criticalAgent.n}</span></div>
          <div style={{fontSize:10,color:C.dim}}>Score dropped to <span style={{color:C.red}}>{criticalAgent.w[wIdx]}%</span></div>
        </div>
      ) : (
        <div style={{...glassCard, opacity:0.5}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.dim}}/>
            <span style={{color:C.dim,fontWeight:600,fontSize:12}}>All Clear</span>
          </div>
          <div style={{fontSize:12,color:C.dim}}>No critical agents this week.</div>
        </div>
      )}

      {/* Tarjeta Gap Detected */}
      {gapAgent ? (
        <div style={glassCard} onClick={()=>setCatFilter("Convertible")} onMouseEnter={e=>e.currentTarget.style.background="rgba(30, 41, 59, 0.6)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(15, 23, 42, 0.4)"}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.orange}}/>
            <span style={{color:C.orange,fontWeight:600,fontSize:12}}>Gap Detected</span>
          </div>
          <div style={{fontSize:12,color:C.dim}}>Review Required: <span style={{color:C.text,fontWeight:700}}>{gapAgent.n}</span></div>
          <div style={{fontSize:10,color:C.dim}}>QA vs CSAT mismatch detected</div>
        </div>
      ) : (
        <div style={{...glassCard, opacity:0.5}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.dim}}/>
            <span style={{color:C.dim,fontWeight:600,fontSize:12}}>CSAT Aligned</span>
          </div>
          <div style={{fontSize:12,color:C.dim}}>No major QA/CSAT gaps.</div>
        </div>
      )}

      {/* Tarjeta Top Mover */}
      {topMover ? (
        <div style={glassCard} onClick={()=>setCatFilter("Stable")} onMouseEnter={e=>e.currentTarget.style.background="rgba(30, 41, 59, 0.6)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(15, 23, 42, 0.4)"}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.green}}/>
            <span style={{color:C.green,fontWeight:600,fontSize:12}}>Top Mover</span>
          </div>
          <div style={{fontSize:12,color:C.dim}}>Great Progress: <span style={{color:C.text,fontWeight:700}}>{topMover.a.n}</span></div>
          <div style={{fontSize:10,color:C.dim}}>+{topMover.trend.toFixed(1)} pts improvement this week</div>
        </div>
      ) : (
        <div style={{...glassCard, opacity:0.5}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.dim}}/>
            <span style={{color:C.dim,fontWeight:600,fontSize:12}}>Stable Trends</span>
          </div>
          <div style={{fontSize:12,color:C.dim}}>No significant positive movers.</div>
        </div>
      )}
    </div>

    {/* SECCIÓN 2: TABLA EVOLUCIONADA CON PILLS */}
    <div style={{...cs}}>
      
      {/* Action Pills */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {[
          {id:null, label:"Todos"},
          {id:"Critical", label:"Bajo Desempeño"},
          {id:"Convertible", label:"Convertible"},
          {id:"Stable", label:"Top Performers"}
        ].map(pill => (
          <button key={pill.id||'all'} onClick={()=>setCatFilter(pill.id)}
            style={{
              fontSize: 10, padding: "4px 12px", borderRadius: "16px", cursor: "pointer",
              border: "1px solid " + (catFilter === pill.id ? C.cyan : C.border),
              background: catFilter === pill.id ? C.cyan+"1A" : "transparent",
              color: catFilter === pill.id ? C.cyan : C.dim, transition:"all 0.2s"
            }}>
            {pill.label}
          </button>
        ))}
      </div>

      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <SortHeader columns={[["name","Agent"],["tl","Team Lead"],["score","Score ▼",60],["trend","Trend",80],["cat","Status",80],["action","",60]]}
            sortKey={tlSort.sk} sortDir={tlSort.sd} onSort={tlSort.toggle}/>
        <tbody>
          {filteredTLs.flatMap(t=>t.agents
            .filter(a=> !catFilter || classify(a,wIdx).cat === catFilter)
            .map(a=>({a,t,name:a.n,tl:t.name,score:a.w[wIdx]||0,trend:getAgentTrend(a,wIdx)||0,cat:classify(a,wIdx).cat})))
            .sort((x,y)=>tlSort.sortFn(x[tlSort.sk],y[tlSort.sk])).map(({a,t},i)=>{
            
            const cat=classify(a,wIdx);
            const tr=getAgentTrend(a,wIdx);
            const recentScores = a.w.slice(Math.max(0, wIdx - 4), wIdx + 1).filter(v=>v!=null);

            return (
              <tr key={i} className="agent-row" onClick={()=>onSelectAgent(a,t)} style={{cursor:"pointer",borderBottom:"1px solid "+C.border+"22"}}>
                <td style={{padding:"8px 10px",fontWeight:600,color:C.text}}>{a.n}</td>
                <td style={{padding:"8px 10px",fontSize:10,color:C.dim}}>{t.name}</td>
                <td style={{padding:"8px 10px",fontWeight:700,fontFamily:"monospace",color:cat.color}}>{a.w[wIdx]||"--"}</td>
                
                {/* Columna Trend con Sparklines (Ocultamos el WoWBadge para mostrar la mini gráfica) */}
                <td style={{padding:"4px 10px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <Sparkline data={recentScores} color={cat.color} />
                    {tr!=null&&<span style={{fontSize:9,color:tr>=0?C.green:C.red}}>{tr>0?"+":""}{tr}</span>}
                  </div>
                </td>

                {/* Columna Status con Premium Badges */}
                <td style={{padding:"8px 10px"}}>
                  <PremiumBadge text={cat.cat} color={cat.color} />
                </td>

                {/* Columna Acción Hover */}
                <td style={{padding:"8px 10px",textAlign:"right"}}>
                  <button className="schedule-btn" onClick={(e)=>{e.stopPropagation(); alert(`Schedule Coaching con ${a.n}`);}} 
                    style={{fontSize:9, padding:"4px 8px", background:C.cyan+"1A", color:C.cyan, border:"1px solid "+C.cyan+"33", borderRadius:"4px", cursor:"pointer"}}>
                    Coaching
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>;
}

// =================================================================
// EL RESTO DEL CÓDIGO SE MANTIENE BÁSICAMENTE IGUAL,
// PERO DEBEMOS AÑADIR LOS ESTILOS GLOBALES AL COMPONENTE PRINCIPAL
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
  const[catFilter,setCatFilter]=useState(null);

  if(data&&data!==D){D=data;WEEKS=D.weeks;LATEST_WIDX=WEEKS.length-1;}

  const filteredTLs=useMemo(()=>!D?[]:site==="all"?D.tls:D.tls.filter(t=>t.site===site),[site,data]);
  const csatData=useMemo(()=>!D?{findings:[],agentMap:{},pairs:[],pearson:null,categoryImpact:[],matched:0}:csatQaCorrelation(D.tls,D.surveyData,D.rawInts),[data]);

  const onSelectTL=(tl)=>{setSelTL(tl);setSelAgent(null);setTab("dashboard");setCatFilter(null);};
  const onSelectAgent=(a,tl)=>{setSelAgent(a);setSelAgentTL(tl||selTL);setTab("dashboard");};

  // ESTILOS INYECTADOS PARA EL HOVER (SaaS Look)
  const hoverStyles = `
    .agent-row { transition: background 0.2s; }
    .agent-row:hover { background: rgba(30, 41, 59, 0.5) !important; }
    .schedule-btn { opacity: 0; transition: opacity 0.2s, background 0.2s; }
    .agent-row:hover .schedule-btn { opacity: 1; }
    .schedule-btn:hover { background: #06b6d4 !important; color: #fff !important; }
  `;

  if(!D) return <div style={{padding:40, color:"white"}}>Loading configuration... (Simulated)</div>;

  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
    <style>{hoverStyles}</style>
    
    <div style={{background:C.panel,borderBottom:"1px solid "+C.border,padding:"12px 28px"}}>
      <div style={{fontSize:16,fontWeight:800,color:C.text}}>Next<span style={{color:C.cyan}}>Skill</span> <span style={{fontSize:10,fontWeight:400,color:C.dim}}>Premium Console</span></div>
      <div style={{display:"flex",gap:4,marginTop:12}}>
        <button onClick={()=>setTab("dashboard")} style={{fontSize:11,padding:"8px 16px",background:tab==="dashboard"?C.cyan+"15":"transparent",color:tab==="dashboard"?C.cyan:C.dim,border:"none",borderRadius:6,cursor:"pointer"}}>Dashboard</button>
      </div>
    </div>

    <div style={{padding:"16px 28px 40px"}}>
      {tab==="dashboard"&&(selAgent ? <div style={{color:C.dim}}>Agent Profile View (Retained from existing)</div> :
        selTL ? <div style={{color:C.dim}}>TL View (Retained from existing)</div> :
        <CampaignView wIdx={wIdx} onSelectTL={onSelectTL} onSelectAgent={onSelectAgent} catFilter={catFilter} setCatFilter={setCatFilter} csatFindings={csatData.findings} site={site} filteredTLs={filteredTLs}/>)}
    </div>
  </div>;
}

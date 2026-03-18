import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Papa from "papaparse";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine, AreaChart, Area, ScatterChart, Scatter, ZAxis } from "recharts";

let D=null;
let WEEKS=[];
let LATEST_WIDX=0;
const SCS=["WW","TL","RB","VT","AI","OW","SS","AP","PR","LV"];
const SC_FULL={WW:"Warm Welcome",TL:"Thoughtful Listening",RB:"Removing Barriers",VT:"Valuing Time",AI:"Accurate Info",OW:"Ownership",SS:"Sales as Service",AP:"Apologies",PR:"Professionalism",LV:"Living Values"};
const GOAL=72;

const DEFAULT_QA_SHEET="1tH-SwH7OAdMSU-odErm6h8TF2kxCJN1veJ9fhmCzEJU";
const DEFAULT_ROSTER_SHEET="1LExOVMrZ17wJtbHM1jrGilsZchwP6l4q6Mpa_9DG1g0";
const DEFAULT_SURVEY_SHEET="1KUpnp3oFTLfw0Y9m5qsCaBklYcQYL6L7wE2lTqIZ530";
const ROSTER_TABS=["Leadership","CC MEXICO","CC JAMAICA","ADV CARE"];
const REFRESH_INTERVAL=12*60*60*1000;

const SC_MAP={"Warm Welcome & Respect":"WW","Thoughtful Listening":"TL","Understanding & Removing Barriers":"RB",
  "Valuing the Customer's Time & Reducing Effort":"VT","Accurate Information & Transparency":"AI",
  "Ownership & Follow-Through":"OW","Sales as Service":"SS","Apologies & Gratitude":"AP",
  "Professionalism & Positive Intent":"PR","Living Our Values":"LV"};

function safeDate(dStr) {
  if (!dStr) return new Date();
  let d = new Date(dStr);
  if (isNaN(d.getTime())) d = new Date(String(dStr).replace(/-/g, '/').replace('T', ' '));
  return isNaN(d.getTime()) ? new Date() : d;
}

window.CURRENT_WEEK_MODE = "billing";

function getWeekStart(dateStr){
  const mode = window.CURRENT_WEEK_MODE || "billing";
  const d = safeDate(dateStr); 
  
  if (mode === "mtd") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().substring(0,10);
  }

  const day = d.getUTCDay(); 
  let diff;
  if (mode === "qa") {
    const offset = day >= 3 ? day - 3 : day + 4;
    diff = d.getUTCDate() - offset;
  } else {
    diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff)).toISOString().substring(0,10);
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

  const cfs=csv.data.filter(r=>
    r["Scorecard Name"]==="Customer First Scorecard"&&
    (r["Email"]||"").includes("contractor.")
  );

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
    if (window.CURRENT_WEEK_MODE === "mtd") {
      return d.toLocaleDateString("en-US",{month:"long", year:"numeric", timeZone:"UTC"});
    }
    return d.toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
  });

  const agentData={};
  Object.values(interactions).forEach(int=>{
    if(!agentData[int.email]){
      agentData[int.email]={name:int.agent,email:int.email,interactions:[],channels:[]};
    }
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
    if(ch){if(!agents[name].channels.includes)agents[name].channels={};agents[name].channels[ch]=(agents[name].channels[ch]||0)+1;}
  });
  Object.values(agents).forEach(a=>{
    a.avgRating=a.ratings.length?+(a.ratings.reduce((s,v)=>s+v,0)/a.ratings.length).toFixed(1):null;
  });
  const byConvId={};
  Object.values(agents).forEach(a=>a.entries.forEach(e=>{
    if(e.convId)byConvId[e.convId]={agent:a.name,rating:e.rating,comment:e.comment,date:e.date};
  }));
  return{agents,byConvId,total:totalSurveys,avgRating:ratingCount?+(ratingSum/ratingCount).toFixed(1):0,
    responseRate:totalSurveys?Math.round(totalResponded/totalSurveys*100):0};
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
      pairs.push({agent:int.agent,qaScore:int.score,csatRating:survey.rating,
        scBreakdown:int.sc,date:int.date,comment:survey.comment});
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
    if(d.csatRating>=4&&d.qaScore<GOAL)
      findings.push({agent:name,type:"high_csat_low_qa",severity:"insight",
        msg:"CSAT "+d.csatRating+"★ but QA "+d.qaScore+" — customer happy, process gaps"});
    if(d.csatRating<3&&d.qaScore>=GOAL)
      findings.push({agent:name,type:"low_csat_high_qa",severity:"warning",
        msg:"CSAT "+d.csatRating+"★ but QA "+d.qaScore+" — meets process, customer unhappy"});
    if(d.csatRating<3&&d.qaScore<60)
      findings.push({agent:name,type:"both_low",severity:"critical",
        msg:"CSAT "+d.csatRating+"★ and QA "+d.qaScore+" — urgent intervention needed"});
  });

  if(categoryImpact.length>=2){
    const top=categoryImpact[0];
    findings.unshift({agent:"Campaign",type:"impact_insight",severity:"insight",
      msg:top.name+" has highest CSAT impact (r="+top.correlation+"). Prioritize coaching here."});
  }

  return{findings:findings.sort((a,b)=>a.severity==="critical"?-1:b.severity==="critical"?1:0),
    agentMap,pairs,pearson,categoryImpact,matched:pairs.length};
}

// =================================================================
// FEATURE: Most Improved Agents (Momentum)
// =================================================================
function getMostImprovedAgents(agents, wIdx) {
  if (wIdx < 1) return [];
  return agents.map(a => {
    const cur = a.w[wIdx], prev = a.w[wIdx - 1];
    if (cur == null || prev == null) return null;
    return { a, n: a.n, imp: +(cur - prev).toFixed(1), cur };
  }).filter(x => x && x.imp > 0).sort((a, b) => b.imp - a.imp).slice(0, 3);
}

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
        msg:"Score dropped "+drop.toFixed(1)+" points ("+a.w[wIdx-1]+" → "+a.w[wIdx]+")"});
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
      sub:atGoal+" of "+allAgents.length+" agents at "+GOAL+"+",color:"#4ade80",icon:"✓"});
    if(convertible.length)cards.push({title:"Convertible Pipeline",value:convertible.length+" agents",
      sub:"Positive trend, below "+GOAL,color:"#38bdf8",icon:"↑",action:"Convertible"});
    if(critical.length)cards.push({title:"Critical Agents",value:critical.length,
      sub:critical.slice(0,3).map(a=>a.n).join(", "),color:"#ef4444",icon:"⚠",action:"Critical"});
  } else if(level==="tl"&&context){
    const t=context;
    const avg=t.agents.filter(a=>a.w[wIdx]!=null);
    const mean=avg.length?(avg.reduce((s,a)=>s+a.w[wIdx],0)/avg.length).toFixed(1):"N/A";
    cards.push({title:"Team Average",value:mean,sub:avg.length+" evaluated this week",color:"#38bdf8",icon:"⌀"});
    const conv=t.agents.filter(a=>classify(a,wIdx).cat==="Convertible");
    if(conv.length){const top=conv.sort((a,b)=>(b.w[wIdx]||0)-(a.w[wIdx]||0))[0];
      cards.push({title:"Fastest Path",value:top.n,sub:"Score "+top.w[wIdx]+" — only "+distTo72(top,wIdx)+" pts to "+GOAL,color:"#4ade80",icon:"⇡"});}
  } else if(level==="agent"&&context){
    const a=context;
    const s=slope(a),cat=classify(a,wIdx);
    cards.push({title:"Trend",value:(s>=0?"+":"")+s+" pts/wk",sub:cat.cat,color:cat.color,icon:s>=0?"↗":"↘"});
    const proj=project(a,4);
    if(proj.length)cards.push({title:"Projection",value:proj[proj.length-1],sub:"Est. in 4 weeks",color:proj[proj.length-1]>=GOAL?"#4ade80":"#fb923c",icon:"⇢"});
    const weak=scImpact(a);
    if(weak[0])cards.push({title:"Top Lever",value:weak[0].name,sub:weak[0].val+"% Met — "+weak[0].gap+"pt gap",color:"#a78bfa",icon:"⚙"});
    const wk=weeksTo72(a,wIdx);
    if(wk&&(a.w[wIdx]||0)<GOAL)cards.push({title:"Path to "+GOAL,value:"~"+wk+" weeks",sub:"At current rate (+"+s+"/wk)",color:"#38bdf8",icon:"⏱"});
  }
  return cards;
}

const C={bg:"#0b1120",panel:"#0f1729",card:"#131d33",border:"#1c2a42",text:"#e2e8f0",dim:"#94a3b8",
  muted:"#475569",cyan:"#06b6d4",blue:"#3b82f6",green:"#34d399",red:"#f87171",amber:"#fbbf24",
  purple:"#a78bfa",orange:"#f97316",teal:"#14b8a6"};
const cs={background:C.card,borderRadius:12,border:"1px solid "+C.border,padding:16};

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
  return{...result,surveyData, raw: {qaText, rosterTabs}};
}

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
  return <span style={{fontSize:10,fontWeight:700,color:up?C.green:C.red,marginLeft:6}}>{up?"▲":"▼"}{Math.abs(delta).toFixed(1)}</span>;
}
function HistoricalBanner({wIdx}){
  if(wIdx>=LATEST_WIDX)return null;
  return <div style={{background:C.amber+"10",border:"1px solid "+C.amber+"30",borderRadius:8,padding:"8px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
    <span style={{fontSize:14}}>{"⏳"}</span>
    <span style={{fontSize:11,color:C.amber}}>Viewing historical data: <b>{WEEKS[wIdx]}</b></span>
    <span style={{fontSize:10,color:C.dim,marginLeft:"auto"}}>Current: {WEEKS[LATEST_WIDX]}</span>
  </div>;
}
function EmptyState({message}){
  return <div style={{...cs,textAlign:"center",padding:40}}>
    <div style={{fontSize:28,opacity:.3,marginBottom:8}}>{"∅"}</div>
    <div style={{fontSize:12,color:C.dim}}>{message}</div>
  </div>;
}
function KpiCard({value,label,color,delta,icon,onClick,sub}){
  return <div onClick={onClick} style={{...cs,flex:1,minWidth:150,cursor:onClick?"pointer":"default",
    transition:"all .2s",borderBottom:"2px solid "+color+"33",position:"relative",overflow:"hidden"}}
    onMouseEnter={e=>{e.currentTarget.style.borderBottomColor=color;e.currentTarget.style.background=color+"08";}}
    onMouseLeave={e=>{e.currentTarget.style.borderBottomColor=color+"33";e.currentTarget.style.background=C.glass;}}>
    <div style={{position:"absolute",top:-20,right:-20,width:60,height:60,borderRadius:"50%",background:color+"08"}}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <div>
        <div style={{fontSize:10,color:C.dim,marginBottom:6,fontWeight:500}}>{label}</div>
        <div style={{fontSize:26,fontWeight:800,color,fontFamily:"'Geist Mono',monospace",letterSpacing:"-1px",lineHeight:1}}>{value}</div>
      </div>
      {icon&&<div style={{fontSize:18,opacity:.3}}>{icon}</div>}
    </div>
    {delta!=null&&<div style={{marginTop:6}}><WoWBadge delta={delta}/></div>}
    {sub&&<div style={{fontSize:9,color:C.dim,marginTop:4}}>{sub}</div>}
  </div>;
}
function FocusCard({card,onClick}){
  return <div onClick={onClick} style={{...cs,flex:1,minWidth:200,cursor:onClick?"pointer":"default",
    transition:"all .2s",borderLeft:"3px solid "+card.color,position:"relative",overflow:"hidden"}}
    onMouseEnter={e=>{e.currentTarget.style.background=card.color+"0a";e.currentTarget.style.transform="translateY(-1px)";}}
    onMouseLeave={e=>{e.currentTarget.style.background=C.glass;e.currentTarget.style.transform="none";}}>
    <div style={{position:"absolute",top:-15,right:-15,width:50,height:50,borderRadius:"50%",background:card.color+"08"}}/>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
      <div style={{width:28,height:28,borderRadius:7,background:card.color+"15",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:13}}>{card.icon}</span>
      </div>
      <span style={{fontSize:10,fontWeight:600,color:C.dim,textTransform:"uppercase",letterSpacing:"0.5px"}}>{card.title}</span>
    </div>
    <div style={{fontSize:18,fontWeight:800,color:card.color,fontFamily:"'Geist Mono',monospace",letterSpacing:"-0.5px"}}>{card.value}</div>
    <div style={{fontSize:10,color:C.dim,marginTop:4,lineHeight:1.4}}>{card.sub}</div>
  </div>;
}

function SortHeader({columns,sortKey,sortDir,onSort}){
  return <thead><tr style={{borderBottom:"1px solid "+C.border}}>
    {columns.map(([key,label,w])=><th key={key} onClick={()=>onSort(key)}
      style={{textAlign:"left",padding:"6px 10px",color:sortKey===key?C.cyan:C.dim,fontWeight:600,fontSize:10,
        cursor:"pointer",userSelect:"none",width:w||"auto",whiteSpace:"nowrap"}}>
      {label} {sortKey===key?(sortDir==="asc"?"▲":"▼"):"▸"}
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

function DonutChart({value,total,color,size=64}){
  const pct=total?value/total:0;
  const r=(size-6)/2;
  const c=2*Math.PI*r;
  return <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={3}/>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3}
      strokeDasharray={c} strokeDashoffset={c*(1-pct)} strokeLinecap="round" style={{transition:"stroke-dashoffset .8s ease"}}/>
  </svg>;
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
// FEATURE: Quick-Action Command Palette (Ctrl+K)
// =================================================================
function CommandPalette({ isOpen, onClose, tls, onSelectAgent }) {
  const [cmdSearch, setCmdSearch] = useState("");
  const inputRef = useRef(null);
  
  useEffect(() => { 
    if (isOpen) {
      setCmdSearch("");
      setTimeout(() => inputRef.current?.focus(), 50); 
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const results = tls.flatMap(t => t.agents.filter(a => a.n.toLowerCase().includes(cmdSearch.toLowerCase())).map(a => ({a, t}))).slice(0, 5);
  
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",justifyContent:"center",paddingTop:"15vh"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{background:C.panel,border:"1px solid "+C.border,borderRadius:12,width:500,maxWidth:"90%",overflow:"hidden",boxShadow:"0 10px 40px rgba(0,0,0,0.5)", height:"max-content"}}>
      <div style={{padding:16,borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:18,color:C.cyan}}>{"⚡"}</span>
        <input ref={inputRef} value={cmdSearch} onChange={e=>setCmdSearch(e.target.value)} placeholder="Type an agent's name..." style={{flex:1,background:"transparent",border:"none",color:C.text,fontSize:16,outline:"none"}} onKeyDown={e=>{if(e.key==="Escape")onClose(); if(e.key==="Enter" && results.length) {onSelectAgent(results[0].a, results[0].t); onClose();}}}/>
        <span style={{fontSize:10,color:C.dim,background:C.bg,padding:"2px 6px",borderRadius:4}}>ESC to close</span>
      </div>
      {cmdSearch && results.length > 0 && <div style={{padding:8}}>
        {results.map(({a,t}, i) => <div key={i} onClick={()=>{onSelectAgent(a,t); onClose();}} style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",background:i===0?C.cyan+"15":"transparent", border:i===0?"1px solid "+C.cyan+"44":"1px solid transparent"}} onMouseEnter={e=>{e.currentTarget.style.background=C.cyan+"15";}} onMouseLeave={e=>{if(i!==0)e.currentTarget.style.background="transparent";}}>
          <span style={{fontWeight:600,fontSize:13}}>{a.n}</span>
          <span style={{fontSize:10,color:C.dim}}>{t.name} · {a.w[LATEST_WIDX]||"--"} QA</span>
        </div>)}
      </div>}
      {cmdSearch && results.length === 0 && <div style={{padding:24,textAlign:"center",color:C.dim,fontSize:12}}>No agents found</div>}
    </div>
  </div>;
}

const SC_GROUPS=[
  {label:"Customer Experience",codes:["WW","TL","VT","AP"]},
  {label:"Problem Resolution",codes:["RB","OW","AI"]},
  {label:"Professionalism & Values",codes:["PR","LV","SS"]}
];

function ScoreGauge({score,size=80}){
  const pct=Math.min(100,Math.max(0,score))/100;
  const r=(size-8)/2;
  const circumference=2*Math.PI*r;
  const scoreOffset=circumference*(1-pct);
  const clr=score>=GOAL?C.green:score>=60?C.amber:C.red;
  return <div style={{position:"relative",width:size,height:size}}>
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={4}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={clr} strokeWidth={4}
        strokeDasharray={circumference} strokeDashoffset={scoreOffset} strokeLinecap="round" style={{transition:"stroke-dashoffset .6s ease"}}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.green+"44"} strokeWidth={1}
        strokeDasharray={`${circumference*(GOAL/100)} ${circumference*(1-GOAL/100)}`}/>
    </svg>
    <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      <span style={{fontSize:size*0.28,fontWeight:800,fontFamily:"monospace",color:clr,lineHeight:1}}>{score}</span>
      <span style={{fontSize:8,color:C.dim}}>/ 100</span>
    </div>
  </div>;
}

// =================================================================
// INTERACTION MODAL (Fixed Scroll Layout & Zoom collision)
// =================================================================
function InteractionModal({interactions,onClose}){
  const[idx,setIdx]=useState(0);
  const[expandedFb,setExpandedFb]=useState({});
  const int=interactions[idx];
  const comments=int.comments||{};
  const commentKeys=Object.keys(comments);

  const issues=[];
  SCS.forEach(c=>{
    const val=int.sc?.[c];
    if(val==="Did Not Meet")issues.push({name:SC_FULL[c],status:"fail"});
    else if(val==="Met Some")issues.push({name:SC_FULL[c],status:"partial"});
  });
  if(!int.proc)issues.push({name:"Procedures",status:"fail"});
  if(!int.notes)issues.push({name:"Notes",status:"fail"});

  const toggleFb=(key)=>setExpandedFb(p=>({...p,[key]:!p[key]}));

  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
    onClick={onClose}>
    
    {/* MAIN CONTAINER: Changed maxHeight to 70vh to prevent zoom overflow */}
    <div onClick={e=>e.stopPropagation()} style={{background:C.panel,borderRadius:16,border:"1px solid "+C.border,
      maxWidth:680,width:"100%",maxHeight:"70vh",display:"flex",flexDirection:"column",overflow:"hidden",padding:0}}>

      {/* 1. HEADER (Fixed at top): Added flexShrink: 0 */}
      <div style={{padding:"14px 24px",borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <span style={{fontSize:14,fontWeight:700}}>{int.agent}</span>
          <span style={{fontSize:10,color:C.dim}}>{int.qa} {"·"} {(int.channel||"").toUpperCase()} {"·"} {safeDate(int.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {int.assignmentId&&<a href={"https://crateandbarrel.stellaconnect.net/qa/reviews/"+int.assignmentId}
            target="_blank" rel="noopener noreferrer"
            style={{padding:"5px 12px",borderRadius:5,background:C.cyan+"15",border:"1px solid "+C.cyan+"33",color:C.cyan,fontSize:10,fontWeight:600,textDecoration:"none"}}>
            {"↗"} Stella</a>}
          {int.url&&<a href={int.url} target="_blank" rel="noopener noreferrer"
            style={{padding:"5px 12px",borderRadius:5,background:C.purple+"15",border:"1px solid "+C.purple+"33",color:C.purple,fontSize:10,fontWeight:600,textDecoration:"none"}}>
            {"↗"} Gladly</a>}
          <button onClick={onClose} style={{background:"none",border:"none",color:C.dim,fontSize:16,cursor:"pointer",marginLeft:4}}>{"✕"}</button>
        </div>
      </div>

      {/* 2. BODY (Scrollable Area): Added minHeight: 0 to enforce flexbox scrolling */}
      <div style={{padding:"20px 24px", flex: 1, overflowY:"auto", minHeight: 0}}>

        {interactions.length>1&&<div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap"}}>
          {interactions.map((it,i)=><button key={i} onClick={()=>{setIdx(i);setExpandedFb({});}}
            style={{fontSize:10,padding:"4px 10px",borderRadius:4,border:"1px solid "+(i===idx?C.cyan:C.border),
              background:i===idx?C.cyan+"15":C.card,color:i===idx?C.cyan:C.dim,cursor:"pointer"}}>
            {safeDate(it.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})} {"—"} {it.score}
          </button>)}
        </div>}

        <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:20}}>
          <ScoreGauge score={int.score} size={90}/>
          <div>
            <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Distance to target ({GOAL})</div>
            {int.score>=GOAL?
              <div style={{fontSize:13,fontWeight:600,color:C.green}}>{"✓"} At or above goal</div>:
              <div>
                <div style={{fontSize:13,fontWeight:600,color:int.score>=60?C.amber:C.red}}>{GOAL-int.score} points below</div>
                <div style={{width:140,height:4,background:C.border,borderRadius:2,marginTop:6,overflow:"hidden"}}>
                  <div style={{width:Math.round(int.score/GOAL*100)+"%",height:"100%",borderRadius:2,background:int.score>=60?C.amber:C.red}}/>
                </div>
              </div>}
          </div>
        </div>

        {issues.length>0&&<div style={{marginBottom:16,padding:"10px 14px",borderRadius:8,background:C.red+"08",border:"1px solid "+C.red+"20"}}>
          <div style={{fontSize:10,fontWeight:700,color:C.red,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px"}}>{"⚠"} Key Issues ({issues.length})</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {issues.map((iss,i)=><span key={i} style={{fontSize:10,padding:"3px 8px",borderRadius:4,
              background:iss.status==="fail"?C.red+"15":C.amber+"15",color:iss.status==="fail"?C.red:C.amber,fontWeight:600}}>
              {iss.name}{iss.status==="partial"?" (Partial)":""}
            </span>)}
          </div>
        </div>}

        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>Service Commitments</div>
          {SC_GROUPS.map((g,gi)=><div key={gi} style={{marginBottom:10}}>
            <div style={{fontSize:9,fontWeight:600,color:C.muted,marginBottom:4,paddingLeft:4}}>{g.label}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
              {g.codes.map(c=>{const val=int.sc?.[c];const met=val==="Met"||val==="Exceed";const partial=val==="Met Some";
                return <div key={c} style={{padding:"7px 10px",borderRadius:5,fontSize:10,
                  background:met?C.green+"08":partial?C.amber+"08":C.red+"08",
                  borderLeft:"3px solid "+(met?C.green:partial?C.amber:C.red),
                  display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:C.text}}>{SC_FULL[c]}</span>
                  <span style={{fontWeight:700,fontSize:9,color:met?C.green:partial?C.amber:C.red}}>{met?"Met":partial?"Partial":"Not Met"}</span>
                </div>;})}
            </div>
          </div>)}
          <div style={{fontSize:9,fontWeight:600,color:C.muted,marginBottom:4,paddingLeft:4}}>Process & Compliance</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
            {[["Follows Procedures",int.proc],["Notes in Gladly",int.notes]].map(([lbl,val])=>
              <div key={lbl} style={{padding:"7px 10px",borderRadius:5,fontSize:10,
                background:val?C.green+"08":C.red+"08",borderLeft:"3px solid "+(val?C.green:C.red),
                display:"flex",justifyContent:"space-between"}}>
                <span>{lbl}</span><span style={{fontWeight:700,fontSize:9,color:val?C.green:C.red}}>{val?"Met":"Not Met"}</span>
              </div>)}
          </div>
        </div>

        {commentKeys.length>0?<div style={{marginBottom:8}}>
          <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>QA Feedback ({commentKeys.length})</div>
          {commentKeys.map((q,i)=>{
            const text=comments[q];
            const isLong=text.length>120;
            const expanded=expandedFb[q];
            const displayText=isLong&&!expanded?text.substring(0,120)+"...":text;
            return <div key={i} style={{padding:"10px 14px",borderRadius:6,background:C.bg,marginBottom:6,borderLeft:"2px solid "+C.cyan+"44"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:9,color:C.cyan,fontWeight:700}}>{q}</span>
                {isLong&&<button onClick={()=>toggleFb(q)} style={{fontSize:9,color:C.cyan,background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>{expanded

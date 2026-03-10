import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Papa from "papaparse";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine, AreaChart, Area } from "recharts";

let D=null;
let WEEKS=[];
let LATEST_WIDX=0;
const SCS=["WW","TL","RB","VT","AI","OW","SS","AP","PR","LV"];
const SC_FULL={WW:"Warm Welcome",TL:"Thoughtful Listening",RB:"Removing Barriers",VT:"Valuing Time",AI:"Accurate Info",OW:"Ownership",SS:"Sales as Service",AP:"Apologies",PR:"Professionalism",LV:"Living Values"};
const GOAL=72;

const ICON="data:image/jpeg;base64,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";
// Logo rendered as SVG+text
const _LOGOTYPE_UNUSED="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";


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
    proc:int.proc,notes:int.notes,comments:int.comments||{},
    assignmentId:int.assignmentId,interactionId:int.interactionId,url:int.url
  }));
  return{weeks:weekLabels,weekISO:weeks,tls,qas,rawInts,
    stats:{interactions:Object.keys(interactions).length,agents:totalAgents,tlCount:tls.filter(t=>t.name!=="Unassigned").length,weekCount:weeks.length}};
}



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
  // Build conversation ID → survey map for URL correlation
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

  // URL-based matching: QA interaction ↔ Survey response
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

  // Overall Pearson correlation
  const qScores=pairs.map(p=>p.qaScore), cScores=pairs.map(p=>p.csatRating*20);
  const pearson=pearsonCorrelation(qScores,cScores);

  // Per-category impact on CSAT
  const categoryImpact=SCS.map(c=>{
    const valid=pairs.filter(p=>p.scBreakdown?.[c]);
    const xs=valid.map(p=>p.scBreakdown[c]==="Met"||p.scBreakdown[c]==="Exceed"?1:0);
    const ys=valid.map(p=>p.csatRating);
    return{code:c,name:SC_FULL[c],correlation:pearsonCorrelation(xs,ys),n:valid.length};
  }).filter(c=>c.correlation!=null).sort((a,b)=>Math.abs(b.correlation)-Math.abs(a.correlation));

  // Agent-level aggregation
  const agentMap={};
  Object.entries(agentPairs).forEach(([name,ps])=>{
    const avgQA=+(ps.reduce((s,p)=>s+p.qaScore,0)/ps.length).toFixed(1);
    const avgCSAT=+(ps.reduce((s,p)=>s+p.csatRating,0)/ps.length).toFixed(1);
    agentMap[name]={qaScore:avgQA,csatRating:avgCSAT,matchedInteractions:ps.length,
      alignment:avgCSAT>=4&&avgQA>=GOAL?"aligned":avgCSAT>=4&&avgQA<GOAL?"csat_leads":avgCSAT<3&&avgQA>=GOAL?"qa_leads":avgCSAT<3&&avgQA<60?"both_low":"neutral"};
  });

  // Generate findings
  const findings=[];
  Object.entries(agentMap).forEach(([name,d])=>{
    if(d.csatRating>=4&&d.qaScore<GOAL)
      findings.push({agent:name,type:"high_csat_low_qa",severity:"insight",
        msg:"CSAT "+d.csatRating+"\u2605 but QA "+d.qaScore+" \u2014 customer happy, process gaps"});
    if(d.csatRating<3&&d.qaScore>=GOAL)
      findings.push({agent:name,type:"low_csat_high_qa",severity:"warning",
        msg:"CSAT "+d.csatRating+"\u2605 but QA "+d.qaScore+" \u2014 meets process, customer unhappy"});
    if(d.csatRating<3&&d.qaScore<60)
      findings.push({agent:name,type:"both_low",severity:"critical",
        msg:"CSAT "+d.csatRating+"\u2605 and QA "+d.qaScore+" \u2014 urgent intervention needed"});
  });

  // Top insight from category impact
  if(categoryImpact.length>=2){
    const top=categoryImpact[0];
    findings.unshift({agent:"Campaign",type:"impact_insight",severity:"insight",
      msg:top.name+" has highest CSAT impact (r="+top.correlation+"). Prioritize coaching here."});
  }

  return{findings:findings.sort((a,b)=>a.severity==="critical"?-1:b.severity==="critical"?1:0),
    agentMap,pairs,pearson,categoryImpact,matched:pairs.length};
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
      sub:"Positive trend, below "+GOAL,color:"#38bdf8",icon:"\u2191",action:"Convertible"});
    if(critical.length)cards.push({title:"Critical Agents",value:critical.length,
      sub:critical.slice(0,3).map(a=>a.n).join(", "),color:"#ef4444",icon:"\u26a0",action:"Critical"});
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
const C={bg:"#0b1120",panel:"#0f1729",card:"#131d33",border:"#1c2a42",text:"#e2e8f0",dim:"#94a3b8",
  muted:"#475569",cyan:"#06b6d4",blue:"#3b82f6",green:"#34d399",red:"#f87171",amber:"#fbbf24",
  purple:"#a78bfa",orange:"#f97316",teal:"#14b8a6"};
const cs={background:C.card,borderRadius:12,border:"1px solid "+C.border,padding:16};

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
// INTERACTION MODAL — Redesigned for clarity & coaching
// =================================================================
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

function InteractionModal({interactions,onClose}){
  const[idx,setIdx]=useState(0);
  const[expandedFb,setExpandedFb]=useState({});
  const int=interactions[idx];
  const comments=int.comments||{};
  const commentKeys=Object.keys(comments);

  // Quick issue summary: Not Met or Partial items
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
    <div onClick={e=>e.stopPropagation()} style={{background:C.panel,borderRadius:16,border:"1px solid "+C.border,
      maxWidth:680,width:"100%",maxHeight:"90vh",overflow:"auto",padding:0}}>

      {/* HEADER: agent context + action buttons */}
      <div style={{padding:"14px 24px",borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <span style={{fontSize:14,fontWeight:700}}>{int.agent}</span>
          <span style={{fontSize:10,color:C.dim}}>{int.qa} {"·"} {(int.channel||"").toUpperCase()} {"·"} {new Date(int.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
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

      <div style={{padding:"20px 24px"}}>

        {/* Multi-interaction selector */}
        {interactions.length>1&&<div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap"}}>
          {interactions.map((it,i)=><button key={i} onClick={()=>{setIdx(i);setExpandedFb({});}}
            style={{fontSize:10,padding:"4px 10px",borderRadius:4,border:"1px solid "+(i===idx?C.cyan:C.border),
              background:i===idx?C.cyan+"15":C.card,color:i===idx?C.cyan:C.dim,cursor:"pointer"}}>
            {new Date(it.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})} {"—"} {it.score}
          </button>)}
        </div>}

        {/* SCORE GAUGE + DISTANCE */}
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

        {/* QUICK ISSUE SUMMARY */}
        {issues.length>0&&<div style={{marginBottom:16,padding:"10px 14px",borderRadius:8,background:C.red+"08",border:"1px solid "+C.red+"20"}}>
          <div style={{fontSize:10,fontWeight:700,color:C.red,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px"}}>{"⚠"} Key Issues ({issues.length})</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {issues.map((iss,i)=><span key={i} style={{fontSize:10,padding:"3px 8px",borderRadius:4,
              background:iss.status==="fail"?C.red+"15":C.amber+"15",color:iss.status==="fail"?C.red:C.amber,fontWeight:600}}>
              {iss.name}{iss.status==="partial"?" (Partial)":""}
            </span>)}
          </div>
        </div>}

        {/* SERVICE COMMITMENTS — Grouped */}
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

        {/* QA FEEDBACK — Collapsible */}
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
                {isLong&&<button onClick={()=>toggleFb(q)} style={{fontSize:9,color:C.cyan,background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>{expanded?"Collapse":"Read more"}</button>}
              </div>
              <div style={{fontSize:11,color:C.text,lineHeight:1.6}}>{displayText}</div>
            </div>;})}
        </div>:
        <div style={{padding:"12px 14px",borderRadius:6,background:C.bg,marginBottom:8}}>
          <span style={{fontSize:10,color:C.muted,fontStyle:"italic"}}>No written feedback for this evaluation</span>
        </div>}

      </div>
    </div>
  </div>;
}


// =================================================================
// AGENT PROFILE PANEL
// =================================================================
function AgentProfilePanel({agent,tl,wIdx,interactions,surveyData,csatData,weekISO,onClose,onViewInteraction}){
  if(!agent)return null;
  const risk=getRiskLevel(agent,wIdx);
  const strengths=getStrengths(agent);
  const opps=getOpportunities(agent);
  const agentInts=(interactions||[]).filter(i=>i.agent===agent.n);
  const survey=surveyData?.agents?.[agent.n];
  const trendData=agent.w.map((v,i)=>v!=null?{wk:WEEKS[i],score:v}:null).filter(Boolean);

  // Filter survey entries by selected week
  const selectedWeekISO=weekISO?.[wIdx]||"";
  const weekEntries=(survey?.entries||[]).filter(e=>e.date&&getWeekStart(e.date)===selectedWeekISO);
  const weekRatings=weekEntries.filter(e=>e.rating!=null).map(e=>e.rating);
  const weekAvg=weekRatings.length?+(weekRatings.reduce((s,v)=>s+v,0)/weekRatings.length).toFixed(1):null;
  const weekComments=weekEntries.filter(e=>e.comment).map(e=>e.comment);

  return <div style={{width:420,minWidth:420,background:C.panel,borderLeft:"1px solid "+C.border,
    overflowY:"auto",padding:24,height:"calc(100vh - 120px)",position:"sticky",top:0}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
      <div>
        <div style={{fontSize:10,color:C.dim,textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>Agent Profile</div>
        <h2 style={{fontSize:18,fontWeight:700,margin:0}}>{agent.n}</h2>
        <div style={{fontSize:11,color:C.dim,marginTop:2}}>{tl?.name||"--"} {"\u00b7"} {tl?.site||"--"}</div>
      </div>
      <button onClick={onClose} style={{background:"none",border:"none",color:C.dim,fontSize:18,cursor:"pointer"}}>{"\u2715"}</button>
    </div>
    <div style={{display:"flex",gap:8,marginBottom:16}}>
      <div style={{...cs,flex:1,textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,fontFamily:"monospace",color:(agent.w[wIdx]||0)>=GOAL?C.green:C.amber}}>{agent.w[wIdx]||"--"}</div><div style={{fontSize:9,color:C.dim}}>QA Score</div></div>
      <div style={{...cs,flex:1,textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,fontFamily:"monospace",color:weekAvg!=null?(weekAvg>=4?C.green:weekAvg>=3?C.amber:C.red):C.dim}}>{weekAvg!=null?weekAvg+"\u2605":"--"}</div><div style={{fontSize:9,color:C.dim}}>CSAT</div></div>
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
            <stop offset="0%" stopColor={C.cyan} stopOpacity={0.15}/><stop offset="100%" stopColor={C.cyan} stopOpacity={0.01}/>
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
      <div style={{fontSize:10,fontWeight:600,color:C.purple,marginBottom:6}}>CSAT — {WEEKS[wIdx]||"Selected Week"}</div>
      <div style={{display:"flex",gap:16,marginBottom:4}}>
        <div><span style={{fontSize:18,fontWeight:700,fontFamily:"monospace",color:weekAvg!=null?(weekAvg>=4?C.green:weekAvg>=3?C.amber:C.red):C.dim}}>{weekAvg!=null?weekAvg:"--"}</span><span style={{fontSize:10,color:C.dim}}> {"\u2605"} this week</span></div>
        <div><span style={{fontSize:12,fontWeight:600,fontFamily:"monospace",color:C.dim}}>{weekRatings.length}</span><span style={{fontSize:10,color:C.dim}}> surveys</span></div>
      </div>
      <div style={{fontSize:9,color:C.muted,marginBottom:4}}>All-time: {survey.avgRating||"--"}{"\u2605"} ({survey.surveys} surveys)</div>
      {weekComments.length>0&&<div style={{marginTop:6}}>
        <div style={{fontSize:9,color:C.dim,marginBottom:3}}>Comments this week</div>
        {weekComments.slice(0,3).map((c,i)=><div key={i} style={{fontSize:10,color:C.text,fontStyle:"italic",padding:"4px 8px",background:C.bg,borderRadius:4,marginBottom:3,lineHeight:1.4}}>
          {"\u201c"}{c.substring(0,120)}{c.length>120?"...":""}{"\u201d"}
        </div>)}
      </div>}
      {weekRatings.length===0&&<div style={{fontSize:10,color:C.muted,fontStyle:"italic"}}>No surveys received this week</div>}
    </div>}
    
    {csatData?.agentMap?.[agent.n]&&<div style={{...cs,marginBottom:12,borderLeft:"3px solid "+C.teal}}>
      <div style={{fontSize:10,fontWeight:600,color:C.teal,marginBottom:6}}>CSAT vs QA Correlation</div>
      <div style={{display:"flex",gap:16,marginBottom:6}}>
        <div><span style={{fontSize:14,fontWeight:700,fontFamily:"monospace",color:C.teal}}>{csatData.agentMap[agent.n].csatRating}</span><span style={{fontSize:10,color:C.dim}}> {"\u2605"} CSAT</span></div>
        <div><span style={{fontSize:14,fontWeight:700,fontFamily:"monospace",color:C.cyan}}>{csatData.agentMap[agent.n].qaScore||"--"}</span><span style={{fontSize:10,color:C.dim}}> QA Score</span></div>
      </div>
      {(()=>{const al=csatData.agentMap[agent.n].alignment;
        const labels={aligned:{text:"Aligned",desc:"Customer satisfaction matches QA performance",color:C.green},
          csat_leads:{text:"CSAT Leads",desc:"Customer is happy, but QA shows process gaps \u2014 coach on procedures",color:C.amber},
          qa_leads:{text:"QA Leads",desc:"Meets QA standards but customer unhappy \u2014 focus on soft skills & empathy",color:C.amber},
          both_low:{text:"Needs Attention",desc:"Both CSAT and QA are low \u2014 priority intervention",color:C.red},
          neutral:{text:"Moderate",desc:"Metrics in mid-range",color:C.dim}};
        const l=labels[al]||labels.neutral;
        return <div style={{fontSize:10,display:"flex",alignItems:"center",gap:6}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:l.color}}/><span style={{color:l.color,fontWeight:600}}>{l.text}</span>
          <span style={{color:C.dim}}>{"\u2014"} {l.desc}</span></div>;
      })()}
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
        
      {Object.keys(int.comments||{}).length>0&&<div style={{marginTop:12}}>
        <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px"}}>QA Feedback</div>
        {Object.entries(int.comments).map(([q,c],i)=><div key={i} style={{padding:"8px 12px",borderRadius:6,background:C.bg,marginBottom:4}}>
          <div style={{fontSize:9,color:C.cyan,fontWeight:600,marginBottom:2}}>{q}</div>
          <div style={{fontSize:11,color:C.text,fontStyle:"italic",lineHeight:1.5}}>{"“"}{c}{"”"}</div>
        </div>)}
      </div>}
      {int.assignmentId&&<a href={"https://crateandbarrel.stellaconnect.net/qa/reviews/"+int.assignmentId}
          target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
          style={{fontSize:9,color:C.cyan,textDecoration:"none"}}>{"\u2197"}</a>}
      </div>)}
    </div>}
  </div>;
}

// =================================================================
// DASHBOARD VIEWS
// =================================================================
function CampaignView({wIdx,onSelectTL,onSelectAgent,catFilter,setCatFilter,csatFindings,site,filteredTLs}){
  const tlSort=useSort("avg");
  const allAgents=filteredTLs.flatMap(t=>t.agents);
  const scored=allAgents.filter(a=>a.w[wIdx]!=null);
  const avg=scored.length?(scored.reduce((s,a)=>s+a.w[wIdx],0)/scored.length).toFixed(1):"--";
  const atGoal=scored.filter(a=>a.w[wIdx]>=GOAL).length;
  const pct72=scored.length?Math.round(atGoal/scored.length*100):0;
  const wow=wowDelta(allAgents,wIdx);
  const critical=allAgents.filter(a=>classify(a,wIdx).cat==="Critical");
  const catCounts={};
  allAgents.forEach(a=>{const c=classify(a,wIdx);catCounts[c.cat]=(catCounts[c.cat]||0)+1;});
  const catData=Object.entries(catCounts).map(([cat,count])=>{
    const colors={Stable:"#4ade80",Monitor:"#facc15",Convertible:"#38bdf8",Stagnant:"#fb923c",Regressing:"#f87171",Critical:"#ef4444","No Data":"#555"};
    return{cat,count,color:colors[cat]||"#555"};});
  const trendData=WEEKS.map((wk,i)=>{const s=allAgents.filter(a=>a.w[i]!=null);
    return{wk,avg:s.length?+(s.reduce((sum,a)=>sum+a.w[i],0)/s.length).toFixed(1):null};});

  // Helper for initials
  const initials=(name)=>{const p=name.split(" ");return(p[0]?.[0]||"")+(p[p.length-1]?.[0]||"");};
  const siteColors={HMO:"#3b82f6",JAM:"#a78bfa",PAN:"#f59e0b"};

  return <div>
    <HistoricalBanner wIdx={wIdx}/>

    {/* ===== MAIN GRID: 35% left / 65% right ===== */}
    <div style={{display:"grid",gridTemplateColumns:"380px 1fr",gap:16,marginBottom:16}}>

      {/* LEFT COLUMN */}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>

        {/* KPI ROW: QA Score + >= 72 + Critical */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {/* QA Score - green bg */}
          <div style={{background:"#0c2d1e",borderRadius:12,border:"1px solid #1a4a32",padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{fontSize:10,color:"#6ee7b7",fontWeight:500}}>QA Score</div>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 14l4-4 3 3 5-7" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{fontSize:32,fontWeight:800,color:"#34d399",fontFamily:"'Geist Mono',monospace",letterSpacing:"-2px",lineHeight:1,marginTop:6}}>{avg}</div>
            <div style={{marginTop:4}}>{wow!=null&&<WoWBadge delta={wow}/>}</div>
            <div style={{fontSize:9,color:"#6ee7b7",marginTop:4,opacity:.7}}>Goal {"≥"} score of {GOAL}</div>
          </div>

          {/* >= 72 percentage */}
          <div style={{background:C.card,borderRadius:12,border:"1px solid "+C.border,padding:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:10,color:C.dim,fontWeight:500}}>{"≥"} {GOAL}</div>
              <div style={{fontSize:28,fontWeight:800,color:C.text,fontFamily:"'Geist Mono',monospace",letterSpacing:"-1px",lineHeight:1,marginTop:6}}>{pct72}%</div>
            </div>
            <div style={{position:"relative"}}>
              <DonutChart value={atGoal} total={scored.length} color={C.green} size={52}/>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:10,fontWeight:700,fontFamily:"monospace",color:C.green}}>{pct72}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Critical Agents - red bg */}
        <div onClick={()=>setCatFilter(catFilter==="Critical"?null:"Critical")}
          style={{background:"#2a0f0f",borderRadius:12,border:"1px solid #4a1c1c",padding:16,cursor:"pointer",transition:"all .15s"}}
          onMouseEnter={e=>e.currentTarget.style.background="#331414"} onMouseLeave={e=>e.currentTarget.style.background="#2a0f0f"}>
          <div style={{fontSize:10,color:"#fca5a5",fontWeight:500,marginBottom:4}}>Critical Agents</div>
          <div style={{fontSize:28,fontWeight:800,color:"#f87171",fontFamily:"'Geist Mono',monospace",letterSpacing:"-1px",lineHeight:1}}>{critical.length}</div>
          <div style={{fontSize:10,color:"#fca5a5",marginTop:6,opacity:.8,lineHeight:1.3}}>
            {critical.slice(0,3).map(a=>a.n).join(", ")}{critical.length>3?" +"+String(critical.length-3)+" more":""}
          </div>
        </div>

        {/* CSAT-QA Insights */}
        {csatFindings&&csatFindings.length>0&&<div style={{...cs,flex:1}}>
          <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:12}}>CSAT-QA Insights</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {csatFindings.slice(0,5).map((f,i)=>{
              const sev=f.severity;
              const clr=sev==="critical"?C.red:sev==="warning"?C.amber:C.teal;
              const ic=sev==="critical"?"\u26d4":sev==="warning"?"\u26a0":"\u2139";
              return <div key={i} style={{padding:"10px 12px",borderRadius:8,background:clr+"06",border:"1px solid "+clr+"18",
                borderLeft:"3px solid "+clr,display:"flex",gap:10,alignItems:"flex-start",transition:"background .15s"}}
                onMouseEnter={e=>{e.currentTarget.style.background=clr+"10";}} onMouseLeave={e=>{e.currentTarget.style.background=clr+"06";}}>
                <span style={{fontSize:14,flexShrink:0,marginTop:1}}>{ic}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.text}}>{f.agent}</div>
                  <div style={{fontSize:10,color:clr,lineHeight:1.4,marginTop:2}}>{f.msg}</div>
                </div>
              </div>;})}
          </div>
        </div>}
      </div>

      {/* RIGHT COLUMN */}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>

        {/* Weekly Score Trend - full width */}
        <div style={{...cs}}>
          <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:10}}>Weekly Score Trend</div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="campG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.cyan} stopOpacity={0.12}/>
                  <stop offset="100%" stopColor={C.cyan} stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.border+"40"} strokeDasharray="3 3"/>
              <XAxis dataKey="wk" tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false}/>
              <YAxis domain={[0,100]} tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false} width={32}/>
              <Tooltip content={<Tp/>}/>
              <ReferenceLine y={GOAL} stroke={C.green+"55"} strokeDasharray="6 3" label={{value:"Goal "+GOAL,position:"right",fill:C.dim,fontSize:10}}/>
              <Area type="monotone" dataKey="avg" name="Avg Score" stroke={C.cyan} fill="url(#campG)" strokeWidth={2.5}
                dot={{r:4,fill:C.cyan,stroke:C.bg,strokeWidth:2}} activeDot={{r:6,fill:C.cyan,stroke:"#fff",strokeWidth:2}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* BOTTOM ROW: Categories + TL Rankings side by side */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>

          {/* Agent Categories with donuts */}
          <div style={{...cs}}>
            <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:12}}>Agent Categories</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {catData.sort((a,b)=>b.count-a.count).slice(0,6).map(d=><div key={d.cat} onClick={()=>setCatFilter(catFilter===d.cat?null:d.cat)}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:"10px 4px",borderRadius:8,cursor:"pointer",
                  background:catFilter===d.cat?d.color+"12":"transparent",border:catFilter===d.cat?"1px solid "+d.color+"33":"1px solid transparent",transition:"all .15s"}}
                onMouseEnter={e=>{if(catFilter!==d.cat)e.currentTarget.style.background=d.color+"08";}} onMouseLeave={e=>{if(catFilter!==d.cat)e.currentTarget.style.background="transparent";}}>
                <div style={{position:"relative"}}>
                  <DonutChart value={d.count} total={scored.length} color={d.color} size={56}/>
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:14,fontWeight:800,fontFamily:"monospace",color:d.color}}>{d.count}</span>
                  </div>
                </div>
                <span style={{fontSize:9,color:catFilter===d.cat?d.color:C.dim,fontWeight:500,textAlign:"center"}}>{d.cat}</span>
              </div>)}
            </div>
            {catFilter&&<div style={{textAlign:"center",marginTop:8}}><button onClick={()=>setCatFilter(null)} style={{fontSize:9,color:C.cyan,background:C.cyan+"10",border:"1px solid "+C.cyan+"33",borderRadius:12,padding:"4px 14px",cursor:"pointer"}}>Clear filter</button></div>}
          </div>

          {/* Team Lead Rankings */}
          <div style={{...cs,overflow:"hidden"}}>
            <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:10}}>Team Lead Rankings</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{borderBottom:"1px solid "+C.border}}>
                {["Team Lead","","Avg","Trend",""].map((h,hi)=><th key={hi} style={{textAlign:"left",padding:"6px 8px",color:C.dim,fontWeight:600,fontSize:9}}>{h}</th>)}
              </tr></thead>
              <tbody>{filteredTLs.map((t,i)=>{
                const ta=t.agents.filter(a=>a.w[wIdx]!=null);
                const tavg=ta.length?+(ta.reduce((s,a)=>s+a.w[wIdx],0)/ta.length).toFixed(1):0;
                const tw=wowDelta(t.agents,wIdx);
                const sc=siteColors[t.site]||C.muted;
                const rangeLbl=tavg>=GOAL?"72+":tavg>=60?"60-71":tavg<60?("< 60"):"--";
                const rangeClr=tavg>=GOAL?C.green:tavg>=60?C.amber:C.red;
                const rangeBg=tavg>=GOAL?"#0c2d1e":tavg>=60?"#2d2206":"#2a0f0f";
                return <tr key={i} style={{borderBottom:"1px solid "+C.border+"44",cursor:"pointer",transition:"background .1s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background=C.cyan+"06";e.currentTarget.querySelector(".va")&&(e.currentTarget.querySelector(".va").style.opacity="1");}}
                  onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.querySelector(".va")&&(e.currentTarget.querySelector(".va").style.opacity="0.4");}}
                  onClick={()=>onSelectTL(t)}>
                  <td style={{padding:"10px 8px"}}>
                    <div style={{fontWeight:600,fontSize:11}}>{t.name}</div>
                  </td>
                  <td style={{padding:"10px 4px"}}>
                    <div style={{width:26,height:26,borderRadius:"50%",background:sc+"22",border:"1px solid "+sc+"44",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:sc}}>
                      {initials(t.name)}
                    </div>
                  </td>
                  <td style={{padding:"10px 8px"}}>
                    <span style={{fontWeight:700,fontFamily:"monospace",fontSize:11,padding:"3px 10px",borderRadius:5,
                      background:rangeBg,color:rangeClr,border:"1px solid "+rangeClr+"22"}}>{rangeLbl}</span>
                  </td>
                  <td style={{padding:"10px 8px"}}>{tw!=null&&<WoWBadge delta={tw}/>}</td>
                  <td style={{padding:"10px 8px"}}>
                    <button className="va" onClick={e=>{e.stopPropagation();onSelectTL(t);}}
                      style={{fontSize:9,padding:"4px 10px",borderRadius:12,border:"1px solid "+C.cyan+"44",
                        background:C.cyan+"08",color:C.cyan,cursor:"pointer",fontWeight:600,opacity:.4,transition:"opacity .15s"}}>
                      View Agents
                    </button>
                  </td>
                </tr>;})}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    {/* CATEGORY FILTER: Agent list when active */}
    {catFilter&&<div style={{...cs,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text}}>{catFilter} Agents</div>
        <button onClick={()=>setCatFilter(null)} style={{fontSize:10,color:C.cyan,background:"none",border:"1px solid "+C.cyan+"44",borderRadius:12,padding:"4px 14px",cursor:"pointer"}}>Show All</button>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <SortHeader columns={[["name","Agent"],["tl","Team Lead"],["site","Site",50],["score","Score",60],["trend","Trend",60],["risk","Risk",60]]}
            sortKey={tlSort.sk} sortDir={tlSort.sd} onSort={tlSort.toggle}/>
        <tbody>{filteredTLs.flatMap(t=>t.agents.filter(a=>classify(a,wIdx).cat===catFilter).map(a=>({a,t,name:a.n,tl:t.name,site:t.site,score:a.w[wIdx]||0,trend:getAgentTrend(a,wIdx)||0,risk:getRiskLevel(a,wIdx).level})))
          .sort((x,y)=>tlSort.sortFn(x[tlSort.sk],y[tlSort.sk])).map(({a,t},i)=>{
          const cat=classify(a,wIdx),tr=getAgentTrend(a,wIdx),risk=getRiskLevel(a,wIdx);
          return <tr key={i} onClick={()=>onSelectAgent(a,t)} style={{cursor:"pointer",borderBottom:"1px solid "+C.border+"33"}}
            onMouseEnter={e=>e.currentTarget.style.background=C.cyan+"06"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <td style={{padding:"8px",fontWeight:600}}>{a.n}</td>
            <td style={{padding:"8px",fontSize:10,color:C.dim}}>{t.name}</td>
            <td style={{padding:"8px",fontSize:10,color:C.dim}}>{t.site}</td>
            <td style={{padding:"8px",fontWeight:700,fontFamily:"monospace",color:cat.color}}>{a.w[wIdx]||"--"}</td>
            <td style={{padding:"8px"}}>{tr!=null&&<WoWBadge delta={tr}/>}</td>
            <td style={{padding:"8px"}}><RiskBadge level={risk.level}/></td>
          </tr>;})}</tbody>
      </table>
    </div>}
  </div>;
}

function TLView({tl,wIdx,onSelectAgent}){
  const agSort=useSort("score");
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
        <SortHeader columns={[["name","Agent"],["score","Score",60],["cat","Category",80],["trend","Trend",60],["w72","\u2192 72",50],["ch","Channel",50],["risk","Risk",60]]}
            sortKey={agSort.sk} sortDir={agSort.sd} onSort={agSort.toggle}/>
        <tbody>{[...tl.agents].map(a=>{const c=classify(a,wIdx);return{a,name:a.n,score:a.w[wIdx]||0,cat:c.cat,
          trend:getAgentTrend(a,wIdx)||0,w72:weeksTo72(a,wIdx)||999,ch:a.ch,risk:getRiskLevel(a,wIdx).level};})
          .sort((x,y)=>agSort.sortFn(x[agSort.sk],y[agSort.sk]))
          .map(({a},i)=>{
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
  const qaSort=useSort("n");
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
        <SortHeader columns={[["name","QA Analyst"],["n","Evals",60],["avg","Avg Score",70],["sd","Std Dev",60],["vol","Volatility",70]]}
            sortKey={qaSort.sk} sortDir={qaSort.sd} onSort={qaSort.toggle}/>
        <tbody>{[...qaData].sort((a,b)=>qaSort.sortFn(a[qaSort.sk],b[qaSort.sk])).map((q,i)=>
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


function IntelligenceTab({csatData,surveyData,onSelectAgent,tls}){
  const[csatFilter,setCsatFilter]=useState("all");
  const intelSort=useSort("avgRating","asc");
  const agents=Object.values(surveyData?.agents||{}).filter(a=>a.ratings.length>0);
  const filteredAgents=csatFilter==="all"?agents:
    csatFilter==="low"?agents.filter(a=>a.avgRating<3):
    csatFilter==="high"?agents.filter(a=>a.avgRating>=4):agents;

  return <div>
    {/* KPIs */}
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <KpiCard value={csatData.matched} label="Matched Interactions" color={C.teal} icon={"\ud83d\udd17"}/>
      <KpiCard value={csatData.pearson!=null?csatData.pearson:"--"} label="QA-CSAT Correlation" color={csatData.pearson>0.3?C.green:C.amber} icon={"\ud83d\udcca"}/>
      <KpiCard value={surveyData?.total||0} label="Total Surveys" color={C.purple} icon={"\ud83d\udce8"}/>
      <KpiCard value={surveyData?.avgRating||"--"} label="Avg Rating" color={C.purple} icon={"\u2605"}/>
      <KpiCard value={(surveyData?.responseRate||0)+"%"} label="Response Rate" color={C.teal}/>
    </div>

    {/* CSAT Impact Analysis */}
    {csatData.categoryImpact.length>0&&<div style={{...cs,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:8}}>QA Impact on CSAT — Which behaviors drive customer satisfaction?</div>
      {csatData.categoryImpact.map((c,i)=>{
        const w=Math.max(5,Math.abs(c.correlation)*100);
        const clr=c.correlation>0.3?C.green:c.correlation>0.1?C.teal:C.dim;
        return <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
          <span style={{fontSize:10,color:C.dim,width:100,textAlign:"right"}}>{c.name}</span>
          <div style={{flex:1,height:8,background:C.bg,borderRadius:4,overflow:"hidden"}}>
            <div style={{width:w+"%",height:"100%",borderRadius:4,background:clr,transition:"width .3s"}}/>
          </div>
          <span style={{fontSize:11,fontWeight:700,fontFamily:"monospace",color:clr,width:40}}>{c.correlation}</span>
          <span style={{fontSize:9,color:C.dim}}>n={c.n}</span>
        </div>;})}
      {csatData.categoryImpact.length>0&&<div style={{marginTop:8,fontSize:10,color:C.teal,fontStyle:"italic"}}>
        {"\ud83d\udca1"} {csatData.categoryImpact[0].name} has the highest impact on CSAT (r={csatData.categoryImpact[0].correlation}). Prioritize coaching here.
      </div>}
    </div>}

    {/* Findings */}
    {csatData.findings.length>0&&<div style={{...cs,marginBottom:12,borderLeft:"3px solid "+C.purple}}>
      <div style={{fontSize:11,fontWeight:600,color:C.purple,marginBottom:8}}>{"\ud83d\udcca"} QA-CSAT Insights ({csatData.matched} matched interactions)</div>
      {csatData.findings.slice(0,8).map((f,i)=><div key={i} style={{padding:"6px 0",borderBottom:i<Math.min(csatData.findings.length,8)-1?"1px solid "+C.border+"22":undefined,
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><span style={{fontSize:11,fontWeight:600,cursor:f.agent!=="Campaign"?"pointer":"default"}}
          onClick={()=>{if(f.agent!=="Campaign"){const t=tls.find(t=>t.agents.some(a=>a.n===f.agent));const a=t?.agents.find(x=>x.n===f.agent);if(a&&t)onSelectAgent(a,t);}}}>{f.agent}</span></div>
        <span style={{fontSize:10,color:f.severity==="critical"?C.red:f.severity==="warning"?C.amber:C.teal}}>{f.msg}</span>
      </div>)}
    </div>}

    {/* CSAT Filter */}
    <div style={{display:"flex",gap:8,marginBottom:12}}>
      {[["all","All"],["low","CSAT \u2264 3"],["high","CSAT \u2265 4"]].map(([val,label])=>
        <button key={val} onClick={()=>setCsatFilter(val)}
          style={{fontSize:10,padding:"4px 12px",borderRadius:4,cursor:"pointer",border:"1px solid "+(csatFilter===val?C.purple:C.border),
            background:csatFilter===val?C.purple+"15":"transparent",color:csatFilter===val?C.purple:C.dim}}>{label}</button>)}
    </div>

    {/* Agent Survey Table */}
    <div style={{...cs}}>
      <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:8}}>Agent Survey Performance</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <SortHeader columns={[["name","Agent"],["surveys","Surveys",60],["avgRating","Avg Rating",70],["qaScore","QA Score",70],["alignment","Status",80],["comment","Comment"],["actions","",50]]}
            sortKey={intelSort.sk} sortDir={intelSort.sd} onSort={intelSort.toggle}/>
        <tbody>{filteredAgents.map(a=>{const qm=csatData.agentMap[a.name];return{...a,qaScore:qm?.qaScore||0,alignment:qm?.alignment||"neutral",comment:a.comments.length?a.comments[a.comments.length-1]:""}; })
          .sort((a,b)=>intelSort.sortFn(a[intelSort.sk],b[intelSort.sk])).map((a,i)=>{
          return <tr key={i} style={{borderBottom:"1px solid "+C.border+"22"}}>
            <td style={{padding:"8px 10px",fontWeight:600}}>{a.name}</td>
            <td style={{padding:"8px 10px",fontFamily:"monospace"}}>{a.surveys}</td>
            <td style={{padding:"8px 10px"}}><span style={{fontWeight:700,fontFamily:"monospace",color:(a.avgRating||0)>=4?C.green:(a.avgRating||0)>=3?C.amber:C.red}}>{a.avgRating||"--"}</span> {"\u2605"}</td>
            <td style={{padding:"8px 10px",fontFamily:"monospace",color:C.dim}}>{a.qaScore||"--"}</td>
            <td style={{padding:"8px 10px"}}>{(()=>{const colors={aligned:C.green,csat_leads:C.amber,qa_leads:C.amber,both_low:C.red,neutral:C.dim};
              const labels={aligned:"Aligned",csat_leads:"CSAT Leads",qa_leads:"QA Leads",both_low:"Low",neutral:"\u2014"};
              return <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:(colors[a.alignment]||C.dim)+"18",color:colors[a.alignment]||C.dim}}>{labels[a.alignment]||"\u2014"}</span>;})()}</td>
            <td style={{padding:"8px 10px",fontSize:10,color:C.dim,maxWidth:180,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.comments.length?a.comments[a.comments.length-1].substring(0,60):"--"}</td>
            <td style={{padding:"8px 10px"}}>{a.entries?.[0]?.url&&<a href={a.entries[a.entries.length-1].url} target="_blank" rel="noopener noreferrer"
              style={{fontSize:9,color:C.purple,textDecoration:"none"}}>{"\u2197"} Gladly</a>}</td>
          </tr>;})}</tbody>
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
      <div style={{marginBottom:20}}><svg width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="4" r="2.5" fill="#06b6d4"/><circle cx="4" cy="18" r="2.5" fill="#06b6d4"/><circle cx="20" cy="18" r="2.5" fill="#06b6d4"/><circle cx="18" cy="10" r="2" fill="#06b6d4"/><line x1="12" y1="4" x2="4" y2="18" stroke="#06b6d4" strokeWidth="1.5"/><line x1="12" y1="4" x2="20" y2="18" stroke="#06b6d4" strokeWidth="1.5"/><line x1="4" y1="18" x2="20" y2="18" stroke="#06b6d4" strokeWidth="1.5"/><line x1="12" y1="4" x2="18" y2="10" stroke="#06b6d4" strokeWidth="1.5"/><line x1="4" y1="18" x2="18" y2="10" stroke="#06b6d4" strokeWidth="1.5"/></svg></div><div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.5px",marginBottom:16}}>Next<span style={{color:"#06b6d4"}}>Skill</span></div>
      {error?<><p style={{fontSize:12,color:C.red,margin:"0 0 16px",maxWidth:400}}>{error}</p>
        <button onClick={onSetup} style={{padding:"8px 20px",borderRadius:6,border:"1px solid "+C.cyan,background:"transparent",color:C.cyan,fontSize:11,cursor:"pointer"}}>Configure</button>
      </>:<div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:C.cyan,animation:"pulse 1.5s infinite"}}/>
        <span style={{fontSize:11,color:C.dim,fontFamily:"monospace"}}>Initializing platform...</span>
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
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><svg width="40" height="40" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="4" r="2.5" fill="#06b6d4"/><circle cx="4" cy="18" r="2.5" fill="#06b6d4"/><circle cx="20" cy="18" r="2.5" fill="#06b6d4"/><circle cx="18" cy="10" r="2" fill="#06b6d4"/><line x1="12" y1="4" x2="4" y2="18" stroke="#06b6d4" strokeWidth="1.5"/><line x1="12" y1="4" x2="20" y2="18" stroke="#06b6d4" strokeWidth="1.5"/><line x1="4" y1="18" x2="20" y2="18" stroke="#06b6d4" strokeWidth="1.5"/><line x1="12" y1="4" x2="18" y2="10" stroke="#06b6d4" strokeWidth="1.5"/><line x1="4" y1="18" x2="18" y2="10" stroke="#06b6d4" strokeWidth="1.5"/></svg><span style={{fontSize:22,fontWeight:800,letterSpacing:"-0.5px"}}>Next<span style={{color:"#06b6d4"}}>Skill</span></span></div>
        <p style={{fontSize:11,color:C.dim,margin:0}}>Configure your data sources</p>
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
  const[catFilter,setCatFilter]=useState(null);
  const[lastUpdated,setLastUpdated]=useState(null);
  const[refreshing,setRefreshing]=useState(false);
  const[loadError,setLoadError]=useState(null);
  const[showSetup,setShowSetup]=useState(false);
  const[showProfile,setShowProfile]=useState(false);
  const[modalInts,setModalInts]=useState(null);
  const[search,setSearch]=useState("");
  const intervalRef=React.useRef(null);
  const initialLoad=React.useRef(false);

  if(data&&data!==D){D=data;WEEKS=D.weeks;LATEST_WIDX=WEEKS.length-1;}

  const filteredTLs=useMemo(()=>!D?[]:site==="all"?D.tls:D.tls.filter(t=>t.site===site),[site,data]);
  const alerts=useMemo(()=>!D?[]:generateAlerts(D.tls,wIdx),[data,wIdx]);
  const csatData=useMemo(()=>!D?{findings:[],agentMap:{},pairs:[],pearson:null,categoryImpact:[],matched:0}:csatQaCorrelation(D.tls,D.surveyData,D.rawInts),[data]);
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

  
  // Browser back button navigation
  React.useEffect(()=>{
    const onPop=()=>{
      const s=window.history.state||{};
      setTab(s.tab||"dashboard");setSelTL(s.tl||null);setSelAgent(s.agent||null);
      setSelAgentTL(s.agentTL||null);setShowProfile(!!s.agent);setCatFilter(s.catFilter||null);
    };
    window.addEventListener("popstate",onPop);
    return()=>window.removeEventListener("popstate",onPop);
  },[]);
  const navPush=(state)=>window.history.pushState(state,"");

  if(showSetup) return <SetupScreen savedConfig={config} onDataReady={(d,cfg)=>{setData(d);setConfig(cfg);setWIdx(d.weeks.length-1);setLastUpdated(new Date());setShowSetup(false);}}/>;
  if(!D) return <LoadingScreen error={loadError} onSetup={()=>setShowSetup(true)}/>;

  const onSelectTL=(tl)=>{setSelTL(tl);setSelAgent(null);setShowProfile(false);setTab("dashboard");setCatFilter(null);navPush({tab:"dashboard",tl});};
  const onSelectAgent=(a,tl)=>{setSelAgent(a);setSelAgentTL(tl||selTL);setShowProfile(true);setTab("dashboard");navPush({tab:"dashboard",tl:tl||selTL,agent:a,agentTL:tl||selTL});};

  const sel={fontSize:11,background:C.bg,border:"1px solid "+C.border,borderRadius:20,color:C.text,padding:"7px 14px",fontFamily:"inherit",cursor:"pointer",outline:"none"};

  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Inter',-apple-system,'Segoe UI',system-ui,sans-serif"}}>
    {/* HEADER */}
    <div style={{background:C.panel,borderBottom:"1px solid "+C.border,padding:"12px 28px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="4" r="2.5" fill="#06b6d4"/><circle cx="4" cy="18" r="2.5" fill="#06b6d4"/><circle cx="20" cy="18" r="2.5" fill="#06b6d4"/><circle cx="18" cy="10" r="2" fill="#06b6d4"/><line x1="12" y1="4" x2="4" y2="18" stroke="#06b6d4" strokeWidth="1.5"/><line x1="12" y1="4" x2="20" y2="18" stroke="#06b6d4" strokeWidth="1.5"/><line x1="4" y1="18" x2="20" y2="18" stroke="#06b6d4" strokeWidth="1.5"/><line x1="12" y1="4" x2="18" y2="10" stroke="#06b6d4" strokeWidth="1.5"/><line x1="4" y1="18" x2="18" y2="10" stroke="#06b6d4" strokeWidth="1.5"/></svg><span style={{fontSize:16,fontWeight:800,letterSpacing:"-0.5px",color:C.text}}>Next<span style={{color:C.cyan}}>Skill</span></span></div>
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
          
          <div style={{position:"relative"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search agent..."
              style={{...sel,width:160,paddingLeft:28,fontSize:10}}/>
            <span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",fontSize:12,color:C.muted}}>{"??"}</span>
            {search&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:C.panel,border:"1px solid "+C.border,borderRadius:6,maxHeight:200,overflowY:"auto",zIndex:100,marginTop:4}}>
              {D.tls.flatMap(t=>t.agents.filter(a=>a.n.toLowerCase().includes(search.toLowerCase())).map(a=>({a,t})))
                .slice(0,8).map(({a,t},i)=><div key={i} onClick={()=>{onSelectAgent(a,t);setSearch("");}}
                  style={{padding:"8px 12px",cursor:"pointer",borderBottom:"1px solid "+C.border+"22",fontSize:11}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.cyan+"08"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{fontWeight:600}}>{a.n}</div>
                  <div style={{fontSize:9,color:C.dim}}>{t.name} {"·"} {t.site}</div>
                </div>)}
              {D.tls.flatMap(t=>t.agents.filter(a=>a.n.toLowerCase().includes(search.toLowerCase()))).length===0&&
                <div style={{padding:"8px 12px",fontSize:10,color:C.dim}}>No agents found</div>}
            </div>}
          </div>
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
        <TabButton label="Intelligence" active={tab==="intel"} onClick={()=>setTab("intel")}/>
      </div>
    </div>

    {/* BREADCRUMBS + EXPORT */}
    {tab==="dashboard"&&<div style={{padding:"12px 28px 0",display:"flex",alignItems:"center",gap:4}}>
      {[{label:"Campaign",onClick:()=>{setSelTL(null);setSelAgent(null);setShowProfile(false);setCatFilter(null);navPush({tab:"dashboard"});}},
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
    <div style={{display:"flex",gap:0}}>
    <div style={{flex:1,padding:"16px 28px 40px",minWidth:0}}>
      {tab==="dashboard"&&(selAgent?<AgentView agent={selAgent} tl={selAgentTL||selTL} wIdx={wIdx} csatData={csatData}/>:
        selTL?<TLView tl={selTL} wIdx={wIdx} onSelectAgent={a=>onSelectAgent(a,selTL)}/>:
        <CampaignView wIdx={wIdx} onSelectTL={onSelectTL} onSelectAgent={onSelectAgent} catFilter={catFilter} setCatFilter={setCatFilter} csatFindings={csatData.findings} site={site} filteredTLs={filteredTLs}/>)}
      {tab==="coaching"&&<CoachingTab alerts={alerts} wIdx={wIdx} onSelectAgent={onSelectAgent} tls={D.tls}/>}
      {tab==="qa"&&<QAAnalyticsTab wIdx={wIdx}/>}
      {tab==="intel"&&<IntelligenceTab csatData={csatData} surveyData={D.surveyData} onSelectAgent={onSelectAgent} tls={D.tls}/>}
    </div>

        {/* AGENT PROFILE SIDE PANEL */}
    {showProfile&&selAgent&&<AgentProfilePanel agent={selAgent} tl={selAgentTL||selTL} wIdx={wIdx}
      interactions={D.rawInts} surveyData={D.surveyData} csatData={csatData} weekISO={D.weekISO}
      onClose={()=>{setShowProfile(false);window.history.back();}} onViewInteraction={ints=>setModalInts(ints)}/>}
    </div>

    {/* FOOTER */}
    <div style={{textAlign:"center",padding:"12px 28px",borderTop:"1px solid "+C.border}}>
      <span style={{fontSize:9,color:C.muted,fontFamily:"monospace"}}>NextSkill v5.3 {"\u00b7"} QA Coaching Platform {"\u00b7"} {D.tls.length} TLs {"\u00b7"} {D.tls.reduce((s,t)=>s+t.agents.length,0)} agents</span>
    </div>



    {/* INTERACTION MODAL */}
    {modalInts&&<InteractionModal interactions={modalInts} onClose={()=>setModalInts(null)}/>}
  </div>;
}

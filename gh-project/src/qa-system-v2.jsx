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
      // NUEVO: Calculamos la duración en minutos aquí mismo
      const sDate = safeDate(r["Time Started"]);
      const cDate = safeDate(r["Time Completed"]);
      let durationMins = 0;
      if (sDate && cDate && !isNaN(sDate) && !isNaN(cDate)) {
          durationMins = (cDate.getTime() - sDate.getTime()) / 60000;
      }

      interactions[iid]={
        agent:r["Name"],email:r["Email"].trim().toLowerCase(),
        qa:r["Taker Name"],score:parseFloat(r["Overall Review Score"])||0,
        channel:(r["Channel"]||"").substring(0,3)||"???",
        date:r["Time Started"],sc:{},proc:null,notes:null,
        assignmentId:r["Assignment ID"]||"",interactionId:iid,
        url:r["Interaction URL"]||"",comments:{},
        duration: durationMins // Guardamos la duración para usarla en el dashboard
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
    assignmentId:int.assignmentId,interactionId:int.interactionId,url:int.url,
    duration:int.duration // Propagamos la duración
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
function AgentProfilePanel({agent,tl,wIdx,interactions,surveyData,csatData,weekISO,onClose,onViewInteraction,isMobile}){
  if(!agent)return null;
  const[profileTab,setProfileTab]=useState("overview");
  const risk=getRiskLevel(agent,wIdx);
  const strengths=getStrengths(agent);
  const opps=getOpportunities(agent);
  const agentInts=(interactions||[]).filter(i=>i.agent===agent.n);
  const survey=surveyData?.agents?.[agent.n];
  const trendData=agent.w.map((v,i)=>v!=null?{wk:WEEKS[i],score:v}:null).filter(Boolean);
  const selectedWeekISO=weekISO?.[wIdx]||"";
  const weekEntries=(survey?.entries||[]).filter(e=>e.date&&getWeekStart(e.date)===selectedWeekISO);
  const weekRatings=weekEntries.filter(e=>e.rating!=null).map(e=>e.rating);
  const weekAvg=weekRatings.length?+(weekRatings.reduce((s,v)=>s+v,0)/weekRatings.length).toFixed(1):null;
  const weekComments=weekEntries.filter(e=>e.comment).map(e=>e.comment);

  let streak=0;
  for(let i=wIdx;i>=0;i--){if(agent.w[i]!=null&&agent.w[i]>=GOAL)streak++;else break;}

  const teamAgents=tl?.agents||[];
  const teamScores=teamAgents.map(a=>a.w[wIdx]).filter(v=>v!=null).sort((a,b)=>a-b);
  const myScore=agent.w[wIdx];
  const percentile=myScore!=null&&teamScores.length?Math.round((teamScores.filter(s=>s<myScore).length/teamScores.length)*100):null;

  const radarData=SCS.map(c=>({skill:SC_FULL[c],value:agent.sc[c]||0,fullMark:100}));

  const parts=agent.n.split(" ");
  const ini=(parts[0]?.[0]||"")+(parts[parts.length-1]?.[0]||"");

  const csatCorr=csatData?.agentMap?.[agent.n];
  const qaScore=agent.w[wIdx];

  const tabSt=(t)=>({fontSize:11,fontWeight:profileTab===t?700:500,padding:"8px 16px",cursor:"pointer",
    color:profileTab===t?C.cyan:C.dim,borderBottom:profileTab===t?"2px solid "+C.cyan:"2px solid transparent",
    background:"none",border:"none",transition:"all .15s"});

  const handlePrintPDF = () => {
    const style = document.createElement('style');
    style.innerHTML = `@media print { 
      @page { size: portrait; margin: 10mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #0f1729;}
      body * { visibility: hidden; } 
      #agent-profile-panel, #agent-profile-panel * { visibility: visible; } 
      #agent-profile-panel { position: absolute; left: 0; top: 0; width: 100%; height: max-content; overflow: visible !important; border: none; } 
      button { display: none !important; }
    }`;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.head.removeChild(style), 1000);
  };

  return <div id="agent-profile-panel" style={{
    width: isMobile ? "100%" : 460, 
    minWidth: isMobile ? "100%" : 460, 
    background:C.panel,
    borderLeft: isMobile ? "none" : "1px solid "+C.border,
    overflowY:"auto",
    padding:0,
    height: isMobile ? "100vh" : "calc(100vh - 120px)",
    position: isMobile ? "fixed" : "sticky",
    top:0, 
    left: isMobile ? 0 : "auto",
    zIndex: isMobile ? 50 : 1
  }}>

    <div style={{padding:"20px 24px 0",borderBottom:"1px solid "+C.border}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:42,height:42,borderRadius:"50%",background:C.cyan+"20",border:"2px solid "+C.cyan+"44",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:C.cyan}}>
            {ini}
          </div>
          <div>
            <div style={{fontSize:10,color:C.dim,textTransform:"uppercase",letterSpacing:"1px"}}>Agent Growth Profile</div>
            <h2 style={{fontSize:17,fontWeight:700,margin:"2px 0 0"}}>{agent.n}</h2>
            <div style={{fontSize:10,color:C.dim,marginTop:1}}>{tl?.name||"--"} {"·"} {tl?.site||"--"}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button onClick={handlePrintPDF} style={{fontSize:10,padding:"5px 12px",borderRadius:6,border:"1px solid "+C.dim+"44",
            background:C.bg,color:C.text,cursor:"pointer",fontWeight:600}}>📄 PDF</button>
          <button style={{fontSize:10,padding:"5px 12px",borderRadius:6,border:"1px solid "+C.cyan+"44",
            background:C.cyan+"10",color:C.cyan,cursor:"pointer",fontWeight:600}}>+ Log Coaching</button>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.dim,fontSize:16,cursor:"pointer"}}>{"✕"}</button>
        </div>
      </div>
      <div style={{display:"flex",gap:0}}>
        <button onClick={()=>setProfileTab("overview")} style={tabSt("overview")}>Overview</button>
        <button onClick={()=>setProfileTab("skills")} style={tabSt("skills")}>Skills</button>
        <button onClick={()=>setProfileTab("history")} style={tabSt("history")}>History</button>
      </div>
    </div>

    <div style={{padding:"16px 24px 24px"}}>

      {profileTab==="overview"&&<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <div style={{background:"#0c2d1e",borderRadius:10,border:"1px solid #1a4a32",padding:12}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:9,color:"#6ee7b7",fontWeight:500}}>QA SCORE</span>
              <span style={{fontSize:11}}>{qaScore!=null&&qaScore>=GOAL?"⬆":qaScore!=null?"⚠":""}</span>
            </div>
            <div style={{fontSize:26,fontWeight:800,color:C.green,fontFamily:"monospace",lineHeight:1,marginTop:4}}>
              {qaScore!=null?qaScore+"":"--"}
            </div>
            {streak>=2&&<div style={{fontSize:9,marginTop:4,color:"#fbbf24"}}>{"🔥"} {streak} weeks {"≥"} {GOAL}</div>}
            {percentile!=null&&percentile>=75&&<div style={{fontSize:9,marginTop:2,color:C.teal}}>Top {100-percentile}% of team</div>}
          </div>
          <div style={{...cs,padding:12}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:9,color:C.dim,fontWeight:500}}>CSAT</span>
              <span style={{fontSize:11}}>{weekAvg!=null&&weekAvg>=4?"⬆":""}</span>
            </div>
            <div style={{fontSize:26,fontWeight:800,color:weekAvg!=null?(weekAvg>=4?C.green:weekAvg>=3?C.amber:C.red):C.dim,fontFamily:"monospace",lineHeight:1,marginTop:4}}>
              {weekAvg!=null?weekAvg:"--"}
            </div>
            <div style={{fontSize:9,color:C.dim,marginTop:4}}>{weekRatings.length} surveys</div>
          </div>
          <div style={{...cs,padding:12,borderLeft:"3px solid "+(risk.level==="HIGH"?C.red:risk.level==="MEDIUM"?C.amber:C.green)}}>
            <span style={{fontSize:9,color:C.dim,fontWeight:500}}>RISK</span>
            <div style={{marginTop:4}}><RiskBadge level={risk.level}/></div>
            {risk.reasons.length>0&&<div style={{fontSize:9,color:risk.level==="HIGH"?C.red:C.amber,marginTop:4}}>{risk.reasons[0]}</div>}
          </div>
          <div style={{...cs,padding:12}}>
            <span style={{fontSize:9,color:C.dim,fontWeight:500}}>EVALS</span>
            <div style={{fontSize:26,fontWeight:800,color:C.text,fontFamily:"monospace",lineHeight:1,marginTop:4}}>{agentInts.length}</div>
            <div style={{fontSize:9,color:C.dim,marginTop:4}}>Total evals</div>
          </div>
        </div>

        <div style={{...cs,marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:8}}>Weekly Trend</div>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={trendData}>
              <defs><linearGradient id={"agGr_"+agent.n.replace(/\s/g,"")} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.cyan} stopOpacity={0.15}/><stop offset="100%" stopColor={C.cyan} stopOpacity={0.01}/>
              </linearGradient></defs>
              <CartesianGrid stroke={C.border+"40"} strokeDasharray="3 3"/>
              <XAxis dataKey="wk" tick={{fontSize:8,fill:C.muted}} axisLine={false} tickLine={false}/>
              <YAxis domain={[0,100]} tick={{fontSize:8,fill:C.muted}} axisLine={false} tickLine={false} width={26}/>
              <ReferenceLine y={GOAL} stroke={C.green+"55"} strokeDasharray="4 4"/>
              <Area type="monotone" dataKey="score" stroke={C.cyan} fill={"url(#agGr_"+agent.n.replace(/\s/g,"")+")"} strokeWidth={2} dot={{r:3,fill:C.cyan}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {csatCorr&&<div style={{...cs,marginBottom:12,borderLeft:"3px solid "+C.teal}}>
          <div style={{fontSize:10,fontWeight:600,color:C.teal,marginBottom:6}}>CSAT vs QA Correlation</div>
          <div style={{display:"flex",gap:16,marginBottom:6}}>
            <div><span style={{fontSize:14,fontWeight:700,fontFamily:"monospace",color:C.teal}}>{csatCorr.csatRating}</span><span style={{fontSize:10,color:C.dim}}> {"★"} CSAT</span></div>
            <div><span style={{fontSize:14,fontWeight:700,fontFamily:"monospace",color:C.cyan}}>{csatCorr.qaScore||"--"}</span><span style={{fontSize:10,color:C.dim}}> QA</span></div>
          </div>
          {(()=>{const al=csatCorr.alignment;
            const labels={aligned:{text:"Aligned",desc:"CSAT matches QA",color:C.green},
              csat_leads:{text:"CSAT Leads",desc:"Process gaps, customer happy",color:C.amber},
              qa_leads:{text:"QA Leads",desc:"Meets QA but customer unhappy",color:C.amber},
              both_low:{text:"Needs Attention",desc:"Both low — priority",color:C.red},
              neutral:{text:"Moderate",desc:"Metrics in mid-range",color:C.dim}};
            const l=labels[al]||labels.neutral;
            return <div style={{fontSize:10,display:"flex",alignItems:"center",gap:6}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:l.color}}/><span style={{color:l.color,fontWeight:600}}>{l.text}</span>
              <span style={{color:C.dim}}>{"—"} {l.desc}</span></div>;
          })()}
        </div>}

        {risk.reasons.length>0&&<div style={{...cs,marginBottom:12,borderLeft:"3px solid "+(risk.level==="HIGH"?C.red:C.amber)}}>
          <div style={{fontSize:10,fontWeight:600,color:C.dim,marginBottom:6}}>Risk Factors</div>
          {risk.reasons.map((r,i)=><div key={i} style={{fontSize:10,color:risk.level==="HIGH"?C.red:C.amber,marginTop:3,display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:4,height:4,borderRadius:"50%",background:risk.level==="HIGH"?C.red:C.amber,flexShrink:0}}/> {r}
          </div>)}
        </div>}

        {survey&&<div style={{...cs,borderLeft:"3px solid "+C.purple}}>
          <div style={{fontSize:10,fontWeight:600,color:C.purple,marginBottom:6}}>CSAT {"—"} {WEEKS[wIdx]||"Week"}</div>
          <div style={{fontSize:9,color:C.muted,marginBottom:4}}>All-time: {survey.avgRating||"--"}{"★"} ({survey.surveys} surveys)</div>
          {weekComments.length>0?weekComments.slice(0,2).map((c,i)=><div key={i} style={{fontSize:10,color:C.text,fontStyle:"italic",padding:"6px 10px",background:C.bg,borderRadius:6,borderLeft:"2px solid "+C.purple+"66",marginBottom:4,lineHeight:1.4}}>
            {"“"}{c.substring(0,140)}{c.length>140?"...":""}{"”"}
          </div>):<div style={{fontSize:10,color:C.muted,fontStyle:"italic"}}>No surveys this week</div>}
        </div>}
      </>}

      {profileTab==="skills"&&<>
        <div style={{...cs,marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:4}}>Skills Spider Chart</div>
          {(()=>{
            const size=240,cx=size/2,cy=size/2,r=size*0.38,n=radarData.length;
            const angles=radarData.map((_,i)=>(Math.PI*2*i/n)-Math.PI/2);
            const gridLevels=[25,50,75,100];
            const pts=radarData.map((d,i)=>{const a=angles[i];const pr=d.value/100*r;return[cx+pr*Math.cos(a),cy+pr*Math.sin(a)];});
            const polyStr=pts.map(p=>p.join(",")).join(" ");
            return <svg width="100%" height={size} viewBox={`0 0 ${size} ${size}`}>
              {gridLevels.map(lv=>{const gr=lv/100*r;return <polygon key={lv} points={angles.map(a=>`${cx+gr*Math.cos(a)},${cy+gr*Math.sin(a)}`).join(" ")} fill="none" stroke={C.border} strokeWidth={0.5}/>;})}
              {angles.map((a,i)=><line key={i} x1={cx} y1={cy} x2={cx+r*Math.cos(a)} y2={cy+r*Math.sin(a)} stroke={C.border} strokeWidth={0.5}/>)}
              <polygon points={polyStr} fill={C.cyan+"22"} stroke={C.cyan} strokeWidth={2}/>
              {pts.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={3.5} fill={C.cyan} stroke={C.bg} strokeWidth={1.5}/>)}
              {radarData.map((d,i)=>{const a=angles[i];const lx=cx+(r+20)*Math.cos(a);const ly=cy+(r+20)*Math.sin(a);
                const clr=d.value>=70?C.green:d.value>=50?C.amber:C.red;
                return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill={clr} fontSize={8} fontWeight={600}>{d.skill}</text>;})}
            </svg>;
          })()}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div style={{...cs,borderLeft:"3px solid "+C.green}}>
            <div style={{fontSize:10,fontWeight:700,color:C.green,marginBottom:8}}>Strengths</div>
            {strengths.map((s,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:5}}>
              <span style={{fontSize:10}}>{s.name}</span>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:10,fontWeight:700,fontFamily:"monospace",color:C.green}}>{s.pct}%</span>
              </div>
            </div>)}
          </div>
          <div style={{...cs,borderLeft:"3px solid "+C.red}}>
            <div style={{fontSize:10,fontWeight:700,color:C.red,marginBottom:8}}>Opportunities</div>
            {opps.map((o,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:5}}>
              <span style={{fontSize:10}}>{o.name}</span>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:9,color:C.dim}}>Tgt {Math.min(o.pct+10,100)}%</span>
                <DonutChart value={o.pct} total={100} color={C.red} size={20}/>
              </div>
            </div>)}
          </div>
        </div>

        <div style={{...cs}}>
          <div style={{fontSize:10,fontWeight:600,color:C.dim,marginBottom:8}}>All Behaviors</div>
          {SCS.map(c=><div key={c} style={{display:"flex",alignItems:"center",gap:8,marginTop:5}}>
            <span style={{fontSize:9,color:C.dim,width:75,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{SC_FULL[c]}</span>
            <div style={{flex:1,height:5,background:C.bg,borderRadius:3,overflow:"hidden"}}>
              <div style={{width:(agent.sc[c]||0)+"%",height:"100%",borderRadius:3,
                background:(agent.sc[c]||0)>=70?C.green:(agent.sc[c]||0)>=50?C.amber:C.red,transition:"width .4s"}}/>
            </div>
            <span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",width:30,textAlign:"right",
              color:(agent.sc[c]||0)>=70?C.green:(agent.sc[c]||0)>=50?C.amber:C.red}}>{agent.sc[c]||0}%</span>
          </div>)}
        </div>
      </>}

      {profileTab==="history"&&<>
        {agentInts.length>0?<div style={{display:"flex",flexDirection:"column",gap:10}}>
          {agentInts.slice(-8).reverse().map((int,i)=>{
            const convId = extractConvId(int.url);
            const survey = surveyData?.byConvId?.[convId];
            const isBlindSpot = int.score >= 90 && survey?.rating && survey.rating <= 2;
            
            return <div key={i} style={{...cs,padding:14,cursor:"pointer",transition:"all .15s"}}
            onClick={()=>onViewInteraction([int])}
            onMouseEnter={e=>e.currentTarget.style.borderColor=C.cyan+"44"} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18,fontWeight:800,fontFamily:"monospace",
                  color:int.score>=GOAL?C.green:int.score>=60?C.amber:C.red}}>{int.score}</span>
                <div>
                  <div style={{fontSize:10,fontWeight:600}}>{safeDate(int.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
                  <div style={{fontSize:9,color:C.dim}}>{int.qa} {"·"} {(int.channel||"").toUpperCase()}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:4}}>
                {int.assignmentId&&<a href={"https://crateandbarrel.stellaconnect.net/qa/reviews/"+int.assignmentId}
                  target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
                  style={{fontSize:9,color:C.cyan,textDecoration:"none",padding:"3px 8px",borderRadius:4,border:"1px solid "+C.cyan+"33",background:C.cyan+"08"}}>
                  {"↗"} Stella</a>}
                {int.url&&<a href={int.url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
                  style={{fontSize:9,color:C.purple,textDecoration:"none",padding:"3px 8px",borderRadius:4,border:"1px solid "+C.purple+"33",background:C.purple+"08"}}>
                  {"↗"} Gladly</a>}
              </div>
            </div>
            {isBlindSpot && <div style={{marginBottom:8, padding:"3px 8px", background:C.purple+"22", border:"1px solid "+C.purple+"44", borderRadius:4, fontSize:9, color:C.purple, fontWeight:700, display:"inline-block"}}>{"👁"} BLIND SPOT: QA {int.score} but CSAT {survey.rating}★</div>}
            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6}}>
              {SCS.map(c=>{const val=int.sc?.[c];const met=val==="Met"||val==="Exceed";const partial=val==="Met Some";
                return <span key={c} style={{fontSize:8,padding:"2px 5px",borderRadius:3,
                  background:met?C.green+"12":partial?C.amber+"12":C.red+"12",
                  color:met?C.green:partial?C.amber:C.red,fontWeight:600}}>{SC_FULL[c].split(" ")[0]}</span>;})}
            </div>
            {Object.keys(int.comments||{}).length>0&&Object.entries(int.comments).slice(0,2).map(([q,c],ci)=>
              <div key={ci} style={{padding:"8px 12px",borderRadius:6,background:C.bg,borderLeft:"3px solid "+C.cyan+"44",marginBottom:4}}>
                <div style={{fontSize:8,color:C.cyan,fontWeight:600,marginBottom:2}}>{q}</div>
                <div style={{fontSize:10,color:C.text,fontStyle:"italic",lineHeight:1.5,opacity:.85}}>
                  {"“"}{c.substring(0,150)}{c.length>150?"...":""}{"”"}
                </div>
              </div>)}
          </div>;})}
        </div>:<EmptyState message="No evaluations found for this agent"/>}
      </>}
    </div>
  </div>;
}

// =================================================================
// DASHBOARD VIEWS
// =================================================================
function CampaignView({wIdx,onSelectTL,onSelectAgent,catFilter,setCatFilter,csatFindings,site,filteredTLs, isMobile}){
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

  const initials=(name)=>{const p=name.split(" ");return(p[0]?.[0]||"")+(p[p.length-1]?.[0]||"");};
  const siteColors={HMO:"#3b82f6",JAM:"#a78bfa",PAN:"#f59e0b"};
  
  const mostImproved = getMostImprovedAgents(allAgents, wIdx);

  return <div>
    <HistoricalBanner wIdx={wIdx}/>

    <div style={{display:"flex", flexDirection: isMobile ? "column" : "row", gap:16, marginBottom:16}}>

      <div style={{width: isMobile ? "100%" : "380px", flexShrink: 0, display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{background:"#0c2d1e",borderRadius:12,border:"1px solid #1a4a32",padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{fontSize:10,color:"#6ee7b7",fontWeight:500}}>QA Score</div>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 14l4-4 3 3 5-7" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{fontSize:32,fontWeight:800,color:"#34d399",fontFamily:"'Geist Mono',monospace",letterSpacing:"-2px",lineHeight:1,marginTop:6}}>{avg}</div>
            <div style={{marginTop:4}}>{wow!=null&&<WoWBadge delta={wow}/>}</div>
            <div style={{fontSize:9,color:"#6ee7b7",marginTop:4,opacity:.7}}>Goal {"≥"} score of {GOAL}</div>
          </div>

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

        <div onClick={()=>setCatFilter(catFilter==="Critical"?null:"Critical")}
          style={{background:"#2a0f0f",borderRadius:12,border:"1px solid #4a1c1c",padding:16,cursor:"pointer",transition:"all .15s"}}
          onMouseEnter={e=>e.currentTarget.style.background="#331414"} onMouseLeave={e=>e.currentTarget.style.background="#2a0f0f"}>
          <div style={{fontSize:10,color:"#fca5a5",fontWeight:500,marginBottom:4}}>Critical Agents</div>
          <div style={{fontSize:28,fontWeight:800,color:"#f87171",fontFamily:"'Geist Mono',monospace",letterSpacing:"-1px",lineHeight:1}}>{critical.length}</div>
          <div style={{fontSize:10,color:"#fca5a5",marginTop:6,opacity:.8,lineHeight:1.3}}>
            {critical.slice(0,3).map(a=>a.n).join(", ")}{critical.length>3?" +"+String(critical.length-3)+" more":""}
          </div>
        </div>
        
        {mostImproved.length > 0 && (
          <div style={{background:"#0c2d1e",borderRadius:12,border:"1px solid #1a4a32",padding:16}}>
            <div style={{fontSize:10,color:"#6ee7b7",fontWeight:700,marginBottom:8,textTransform:"uppercase"}}>🔥 Most Improved Agents</div>
            {mostImproved.map((mi, i) => (
               <div key={i} onClick={() => {
                 const t = filteredTLs.find(tl => tl.agents.some(x => x.n === mi.n));
                 if(t) onSelectAgent(mi.a, t);
               }} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",cursor:"pointer",borderBottom:i<mostImproved.length-1?"1px solid #1a4a32":"none"}}
               onMouseEnter={e=>e.currentTarget.style.opacity=0.8} onMouseLeave={e=>e.currentTarget.style.opacity=1}>
                 <span style={{fontSize:11,color:C.text,fontWeight:600}}>{mi.n}</span>
                 <span style={{fontSize:10,color:C.green,fontWeight:700}}>+{mi.imp} <span style={{color:C.green,opacity:0.6}}>({mi.cur})</span></span>
               </div>
            ))}
          </div>
        )}

        {csatFindings&&csatFindings.length>0&&<div style={{...cs,flex:1}}>
          <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:12}}>CSAT-QA Insights</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {csatFindings.slice(0,5).map((f,i)=>{
              const sev=f.severity;
              const clr=sev==="critical"?C.red:sev==="warning"?C.amber:C.teal;
              const ic=sev==="critical"?"⛔":sev==="warning"?"⚠":"ℹ";
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

      <div style={{flex: 1, display:"flex",flexDirection:"column",gap:12, minWidth: 0}}>

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

        <div style={{display:"grid",gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",gap:12}}>

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

          <div style={{...cs,overflowX:"auto"}}>
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
                  onMouseEnter={e=>{e.currentTarget.style.background=C.cyan+"06";const b=e.currentTarget.lastElementChild?.firstElementChild;if(b)b.style.opacity="1";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="transparent";const b=e.currentTarget.lastElementChild?.firstElementChild;if(b)b.style.opacity="0.4";}}
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
                    <button onClick={e=>{e.stopPropagation();onSelectTL(t);}}
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

    {catFilter&&<div style={{...cs,marginBottom:16, overflowX: "auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text}}>{catFilter} Agents</div>
        <button onClick={()=>setCatFilter(null)} style={{fontSize:10,color:C.cyan,background:"none",border:"1px solid "+C.cyan+"44",borderRadius:12,padding:"4px 14px",cursor:"pointer"}}>Show All</button>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11, minWidth: "500px"}}>
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

// =================================================================
// TEAM LEAD VIEW
// =================================================================
function TLView({tl,wIdx,onSelectAgent, isMobile}){
  const agSort=useSort("score");
  if(!tl)return null;
  const scored=tl.agents.filter(a=>a.w[wIdx]!=null);
  if(!scored.length)return <EmptyState message={"No evaluations for "+tl.name+" in week "+WEEKS[wIdx]}/>;

  const avg=(scored.reduce((s,a)=>s+a.w[wIdx],0)/scored.length).toFixed(1);
  const wow=wowDelta(tl.agents,wIdx);

  const criticalAgents = tl.agents.filter(a=>classify(a,wIdx).cat==="Critical" || classify(a,wIdx).cat==="Stagnant");
  const convertibleAgents = tl.agents.filter(a=>classify(a,wIdx).cat==="Convertible").sort((a,b)=>(b.w[wIdx]||0)-(a.w[wIdx]||0));
  const fastestPath = convertibleAgents[0];

  const scAvgs = SCS.map(c => {
    const vals = tl.agents.map(a=>a.sc[c]).filter(v=>v!=null);
    return { code: c, val: vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : 0 };
  }).sort((a,b)=>a.val-b.val).slice(0,2);

  const aiText = `Team average ${wow >= 0 ? 'went up by '+wow : 'dropped by '+Math.abs(wow)} pts. Priority focus on ${criticalAgents.length} agents with critical scores${scAvgs[0] ? ` in '${SC_FULL[scAvgs[0].code]}'` : ''}. Tactical coaching recommended ASAP.`;

  return <div>
    <HistoricalBanner wIdx={wIdx}/>

    <div style={{background:"linear-gradient(90deg, #111827, #0d131f)", border:"1px solid "+C.cyan+"33", borderRadius:12, padding:16, marginBottom:20, display:"flex", gap:16, boxShadow:"0 4px 20px "+C.cyan+"0a"}}>
       <div style={{background:C.cyan+"22", padding:"8px 10px", borderRadius:8, fontSize:20, height:"fit-content", border:"1px solid "+C.cyan+"44"}}>✨</div>
       <div>
          <div style={{color:C.cyan, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6}}>AI Executive Summary</div>
          <div style={{fontSize:13, color:C.text, lineHeight:1.5}}>
            {aiText}
          </div>
       </div>
    </div>

    <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:14, marginBottom:24}}>
      <div style={{...cs, position:"relative", overflow:"hidden"}}>
         <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
           <div style={{fontSize:10, color:C.dim, fontWeight:700, textTransform:"uppercase"}}>Team Avg</div>
           {wow!=null&&<WoWBadge delta={wow}/>}
         </div>
         <div style={{fontSize:32, fontWeight:800, color:"#fff", fontFamily:"'Geist Mono',monospace", marginTop:8}}>{avg}</div>
         <div style={{width:"100%", background:C.bg, height:6, borderRadius:3, marginTop:12}}>
           <div style={{width: Math.min(100, (avg/GOAL)*100)+"%", background:C.cyan, height:"100%", borderRadius:3}}/>
         </div>
         <div style={{display:"flex", justifyContent:"space-between", fontSize:9, color:C.dim, marginTop:6, fontFamily:"monospace"}}>
           <span>Current</span><span>Goal: {GOAL}</span>
         </div>
      </div>

      <div style={{...cs, border:"1px solid "+C.red+"44", background:"#1a0f14"}}>
        <div style={{fontSize:10, color:C.dim, fontWeight:700, textTransform:"uppercase", display:"flex", alignItems:"center", gap:6}}>
          <span style={{color:C.red}}>●</span> Critical Risk
        </div>
        <div style={{fontSize:32, fontWeight:800, color:C.red, fontFamily:"'Geist Mono',monospace", marginTop:8}}>
          {criticalAgents.length}<span style={{fontSize:14, color:C.red, opacity:0.5, fontFamily:"sans-serif", marginLeft:4}}>/ {scored.length}</span>
        </div>
        <div style={{fontSize:10, color:C.red, opacity:0.8, marginTop:8, lineHeight:1.3}}>
          Agents stagnated &gt;5pts below goal.
        </div>
      </div>

      <div style={{...cs, borderLeft:"3px solid "+C.cyan}}>
         <div style={{fontSize:10, color:C.cyan, fontWeight:700, textTransform:"uppercase"}}>⇡ Fastest Path to {GOAL}</div>
         {fastestPath ? (
            <>
              <div style={{fontSize:14, fontWeight:700, color:"#fff", marginTop:8, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{fastestPath.n}</div>
              <div style={{display:"flex", alignItems:"center", gap:8, marginTop:6}}>
                <span style={{fontSize:20, fontWeight:700, fontFamily:"'Geist Mono',monospace", color:C.text}}>{fastestPath.w[wIdx]}</span>
                <span style={{fontSize:10, background:C.cyan+"1a", color:C.cyan, padding:"2px 6px", borderRadius:4, border:"1px solid "+C.cyan+"33"}}>- {(GOAL - fastestPath.w[wIdx]).toFixed(1)} pts</span>
              </div>
            </>
         ) : <div style={{fontSize:11, color:C.dim, marginTop:8}}>No agents in convertible range</div>}
      </div>

      <div style={{...cs}}>
         <div style={{fontSize:10, color:C.dim, fontWeight:700, textTransform:"uppercase", marginBottom:12}}>Top Bottlenecks</div>
         {scAvgs.map((b,i) => (
            <div key={b.code} style={{marginBottom: i===0?12:0}}>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:10, color:C.text, marginBottom:6}}>
                <span style={{whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:120}}>{SC_FULL[b.code]}</span>
                <span style={{fontFamily:"monospace", color: i===0?C.orange:C.amber, fontWeight:700}}>{b.val.toFixed(0)}%</span>
              </div>
              <div style={{width:"100%", background:C.bg, height:4, borderRadius:2}}>
                <div style={{width: b.val+"%", background: i===0?C.orange:C.amber, height:"100%", borderRadius:2}}/>
              </div>
            </div>
         ))}
      </div>
    </div>

    <div style={{...cs, padding:0, overflowX: "auto"}}>
      <div style={{padding:"14px 20px", borderBottom:"1px solid "+C.border, display:"flex", justifyContent:"space-between", alignItems:"center", background:C.bg}}>
        <span style={{fontSize:11, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:1}}>Agent Rankings</span>
      </div>
      
      <table style={{width:"100%", borderCollapse:"collapse", fontSize:11, minWidth: "600px"}}>
        <SortHeader columns={[["name","Agent"],["cat","Category"],["risk","Risk"],["score","Score ▼", 70],["gap","Gap to 72", 80], ["actions","", 80]]}
            sortKey={agSort.sk} sortDir={agSort.sd} onSort={agSort.toggle}/>
        <tbody>{[...tl.agents].map(a=>{
          const c=classify(a,wIdx);
          const gap = a.w[wIdx] != null ? +(GOAL - a.w[wIdx]).toFixed(1) : null;
          return{a,name:a.n,score:a.w[wIdx]||0,cat:c.cat, gap: gap, risk:getRiskLevel(a,wIdx).level, color: c.color};})
          .sort((x,y)=>agSort.sortFn(x[agSort.sk],y[agSort.sk]))
          .map(({a, name, score, cat, gap, risk, color},i)=>{

          const isCritical = cat === "Critical" || cat === "Stagnant";
          const isConvertible = cat === "Convertible";
          const rowBg = isCritical ? C.red+"08" : isConvertible ? C.cyan+"08" : "transparent";

          return <tr key={i} onClick={()=>onSelectAgent(a)} style={{cursor:"pointer", borderBottom:"1px solid "+C.border+"33", background: rowBg, transition:"all .15s"}}
            onMouseEnter={e=>{e.currentTarget.style.background = isCritical ? C.red+"15" : isConvertible ? C.cyan+"15" : C.cyan+"08";}}
            onMouseLeave={e=>{e.currentTarget.style.background = rowBg;}}>

            <td style={{padding:"12px 20px", fontWeight:600, display:"flex", alignItems:"center", gap:8}}>
              {name} 
              {isCritical && <span style={{width:6, height:6, borderRadius:"50%", background:C.red, boxShadow:"0 0 4px "+C.red}}/>}
              {isConvertible && fastestPath?.n === name && <span style={{width:6, height:6, borderRadius:"50%", background:C.cyan, boxShadow:"0 0 4px "+C.cyan}} title="Fastest Path"/>}
            </td>
            <td style={{padding:"12px 20px"}}>
              <span style={{fontSize:9, padding:"4px 8px", borderRadius:4, background:color+"15", color:color, fontWeight:700, textTransform:"uppercase", border:"1px solid "+color+"33", letterSpacing:0.5}}>{cat}</span>
            </td>
            <td style={{padding:"12px 20px"}}><RiskBadge level={risk}/></td>
            <td style={{padding:"12px 20px", fontWeight:800, fontFamily:"'Geist Mono',monospace", color:color, fontSize:13}}>{score||"--"}</td>
            <td style={{padding:"12px 20px", fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.dim}}>
              {gap !== null ? (gap > 0 ? <span style={{color:C.dim}}>-{gap} pts</span> : <span style={{color:C.green}}>--</span>) : "--"}
            </td>
            <td style={{padding:"12px 20px", textAlign:"right"}}>
              <button onClick={(e)=>{e.stopPropagation(); onSelectAgent(a);}}
                style={{fontSize:10, fontWeight:700, padding:"6px 14px", borderRadius:6, background:C.cyan+"10", color:C.cyan, border:"1px solid "+C.cyan+"33", cursor:"pointer", textTransform:"uppercase", transition:"all 0.2s"}}
                onMouseEnter={e=>{e.currentTarget.style.background=C.cyan; e.currentTarget.style.color="#fff";}}
                onMouseLeave={e=>{e.currentTarget.style.background=C.cyan+"10"; e.currentTarget.style.color=C.cyan;}}>
                Coach
              </button>
            </td>
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
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))",gap:12}}>
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
      <KpiCard value={alerts.length} label="Total Alerts" color={C.red} icon={"⚠"}/>
      <KpiCard value={high.length} label="High Severity" color={C.red}/>
      <KpiCard value={med.length} label="Medium" color={C.amber}/>
    </div>
    {high.length>0&&<div style={{...cs,marginBottom:12,borderLeft:"3px solid "+C.red}}>
      <div style={{fontSize:11,fontWeight:600,color:C.red,marginBottom:8}}>{"⚠"} High Priority</div>
      {high.map((a,i)=><div key={i} style={{padding:"8px 0",borderBottom:i<high.length-1?"1px solid "+C.border+"22":undefined,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><span style={{fontSize:12,fontWeight:600,cursor:"pointer"}} onClick={()=>{const t=tls.find(t=>t.name===a.tl);const ag=t?.agents.find(x=>x.n===a.agent);if(ag&&t)onSelectAgent(ag,t);}}>{a.agent}</span>
          <span style={{fontSize:10,color:C.dim,marginLeft:8}}>{a.tl}</span></div>
        <span style={{fontSize:10,color:C.red}}>{a.msg}</span></div>)}</div>}
    {med.length>0&&<div style={{...cs,borderLeft:"3px solid "+C.amber}}>
      <div style={{fontSize:11,fontWeight:600,color:C.amber,marginBottom:8}}>{"⚠"} Monitor</div>
      {med.map((a,i)=><div key={i} style={{padding:"6px 0",borderBottom:i<med.length-1?"1px solid "+C.border+"22":undefined,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><span style={{fontSize:11,fontWeight:600,cursor:"pointer"}} onClick={()=>{const t=tls.find(t=>t.name===a.tl);const ag=t?.agents.find(x=>x.n===a.agent);if(ag&&t)onSelectAgent(ag,t);}}>{a.agent}</span>
          <span style={{fontSize:10,color:C.dim,marginLeft:8}}>{a.tl}</span></div>
        <span style={{fontSize:10,color:C.amber}}>{a.msg}</span></div>)}</div>}
    {!alerts.length&&<EmptyState message="No coaching alerts this week."/>}
  </div>;
}

function QAAnalyticsTab({wIdx}){
  const qaSort = useSort("n");
  const [view, setView] = useState("calibration"); 
  
  const targetWeek = D.weekISO[wIdx];
  const weekInts = (D.rawInts || []).filter(int => getWeekStart(int.date) === targetWeek);

  const qaMap = {};
  let totalScore = 0;

  weekInts.forEach(int => {
    if(!qaMap[int.qa]) {
      qaMap[int.qa] = { name: int.qa, scores: [], n: 0, chars: 0, commentsCount: 0, metTotal: 0, metWithNote: 0, criticalFails: 0, totalValidMins: 0, validEvalsCount: 0 };
    }
    const q = qaMap[int.qa];
    q.scores.push(int.score);
    q.n++;
    totalScore += int.score;

    if(int.score < 50) q.criticalFails++;

    const cmts = Object.values(int.comments || {});
    cmts.forEach(c => {
      if (c.trim().length > 0) {
        q.chars += c.trim().length;
        q.commentsCount++;
      }
    });

    Object.keys(int.comments || {}).forEach(qText => {
        const code = SC_MAP[qText];
        if (code && (int.sc?.[code] === "Met" || int.sc?.[code] === "Exceed")) {
            q.metWithNote++;
        }
    });

    SCS.forEach(code => {
       if (int.sc?.[code] === "Met" || int.sc?.[code] === "Exceed") q.metTotal++;
    });

    // NUEVO: Filtro Inteligente de Duración (QA AHT)
    // Solo contamos las evaluaciones que tomaron entre 1 y 120 minutos reales
    if (int.duration >= 1 && int.duration <= 120) {
        q.totalValidMins += int.duration;
        q.validEvalsCount++;
    }
  });

  const teamAvg = weekInts.length ? +(totalScore / weekInts.length).toFixed(1) : 0;

  const qaData = Object.values(qaMap).map(q => {
    const avg = +(q.scores.reduce((s,v)=>s+v,0) / q.n).toFixed(1);
    const variance = q.scores.reduce((s,v)=>s+(v-avg)**2,0) / q.n;
    const sd = +Math.sqrt(variance).toFixed(1);
    const deviation = +(avg - teamAvg).toFixed(1);

    const avgChars = q.commentsCount > 0 ? Math.round(q.chars / q.commentsCount) : 0;
    const metNotePct = q.metTotal > 0 ? Math.round((q.metWithNote / q.metTotal) * 100) : 0;
    const failRate = q.n > 0 ? Math.round((q.criticalFails / q.n) * 100) : 0;
    
    // Promedio de tiempo por evaluación (QA AHT)
    const avgAHT = q.validEvalsCount > 0 ? Math.round(q.totalValidMins / q.validEvalsCount) : 0;

    let focusArea = "Calibrated";
    let statusColor = C.green;
    if (deviation < -5) { focusArea = "Too Severe"; statusColor = C.red; }
    else if (deviation > 5) { focusArea = "Too Lenient"; statusColor = C.amber; }
    else if (sd > 8) { focusArea = "Inconsistent Criteria"; statusColor = C.orange; }
    else if (avgChars > 0 && avgChars < 30) { focusArea = "Poor Feedback"; statusColor = C.purple; }

    return { ...q, avg, sd, deviation, focusArea, statusColor, avgChars, metNotePct, failRate, avgAHT };
  }).filter(q => q.n > 0);

  const alerts = [];
  if (qaData.length > 0) {
    const mostSevere = [...qaData].sort((a,b)=>a.deviation - b.deviation)[0];
    if (mostSevere && mostSevere.deviation < -4) {
      alerts.push({ qa: mostSevere.name, val: mostSevere.deviation, msg: `Scoring ${Math.abs(mostSevere.deviation)} pts below team average. Requires calibration.`, color: C.red, icon: "⛔", title: "Severity Alert" });
    }
    const mostVolatile = [...qaData].sort((a,b)=>b.sd - a.sd)[0];
    if (mostVolatile && mostVolatile.sd > 7) {
      alerts.push({ qa: mostVolatile.name, val: mostVolatile.sd, msg: `Highest standard deviation (${mostVolatile.sd}). Unstable scoring criteria.`, color: C.orange, icon: "⚠", title: "Volatility Alert" });
    }
  }

  const ScatterTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{background:C.panel,border:"1px solid "+C.border,borderRadius:8,padding:"10px 14px",fontSize:11,boxShadow:"0 4px 12px rgba(0,0,0,0.5)"}}>
          <div style={{color:C.text, fontWeight:800, marginBottom:6, fontSize:12}}>{data.name}</div>
          <div style={{color:C.cyan, marginBottom:2}}>Avg Score: <b style={{fontFamily:"monospace",fontSize:12}}>{data.avg}</b></div>
          <div style={{color:data.sd>7?C.red:C.amber}}>Volatility: <b style={{fontFamily:"monospace",fontSize:12}}>{data.sd}</b></div>
          <div style={{color:C.purple, marginBottom:2}}>Avg Feedback: <b style={{fontFamily:"monospace",fontSize:12}}>{data.avgChars} chars</b></div>
        </div>
      );
    }
    return null;
  };

  let tableColumns = [];
  if (view === "calibration") {
    tableColumns = [["name","QA Analyst"],["n","Evals",60],["avg","Avg Score",80],["deviation","Dev. from Avg",100],["sd","Volatility (SD)",100],["focusArea","Focus Area"]];
  } else if (view === "feedback") {
    tableColumns = [["name","QA Analyst"],["n","Evals",60],["avgChars","Avg Comment Length",140],["metNotePct","Positive Reinforcement",150],["commentsCount","Total Notes",90],["focusArea","Focus Area"]];
  } else {
    // NUEVO: Agregamos el AHT a la vista de Operaciones
    tableColumns = [["name","QA Analyst"],["n","Evals",60],["avgAHT","Avg Time (mins)",120],["failRate","Zero-Out Rate (<50)",140],["avg","Avg Score",80],["focusArea","Focus Area"]];
  }

  const btnStyle = (active) => ({
    fontSize:10, padding:"6px 14px", borderRadius:6, cursor:"pointer", fontWeight:600, border:"none",
    background: active ? C.cyan+"22" : "transparent",
    color: active ? C.cyan : C.dim,
    borderBottom: active ? "2px solid "+C.cyan : "2px solid transparent",
    transition: "all 0.2s"
  });

  return <div>
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <KpiCard value={qaData.length} label={`Active Analysts (${WEEKS[wIdx]})`} color={C.purple} icon={"🕵️"}/>
      <KpiCard value={weekInts.length} label="Total Evaluations" color={C.blue} icon={"📋"}/>
      <KpiCard value={teamAvg||"--"} label="Weekly Team Average" color={C.cyan} icon={"⌀"}/>
    </div>

    {alerts.length > 0 && <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))",gap:12,marginBottom:16}}>
      {alerts.map((al, i) => (
        <div key={i} style={{...cs, borderLeft: "3px solid " + al.color, display: "flex", gap: 12, alignItems: "center"}}>
          <div style={{fontSize: 24}}>{al.icon}</div>
          <div>
            <div style={{fontSize: 10, fontWeight: 700, color: al.color, textTransform: "uppercase", letterSpacing: 0.5}}>{al.title}</div>
            <div style={{fontSize: 13, fontWeight: 700, color: C.text, marginTop: 2}}>{al.qa}</div>
            <div style={{fontSize: 10, color: C.dim, marginTop: 2}}>{al.msg}</div>
          </div>
        </div>
      ))}
    </div>}

    <div style={{...cs,marginBottom:16}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text}}>Calibration Quadrant</div>
        <div style={{fontSize:10, color:C.dim}}>X: Average Score | Y: Volatility (Std Dev)</div>
      </div>
      {qaData.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: -20 }}>
            <CartesianGrid stroke={C.border+"50"} strokeDasharray="3 3"/>
            <XAxis type="number" dataKey="avg" name="Avg Score" domain={['dataMin - 2', 'dataMax + 2']} tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false} />
            <YAxis type="number" dataKey="sd" name="Volatility" domain={[0, 'auto']} tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false} />
            <ZAxis type="number" dataKey="n" range={[60, 400]} name="Evaluations" />
            <Tooltip cursor={{strokeDasharray: '3 3'}} content={<ScatterTooltip/>} />
            <ReferenceLine x={teamAvg} stroke={C.cyan+"66"} strokeDasharray="4 4" label={{value:`Team Avg (${teamAvg})`, position:"top", fill:C.cyan, fontSize:10}} />
            <ReferenceLine y={5} stroke={C.amber+"66"} strokeDasharray="4 4" label={{value:"Volatility Threshold", position:"insideRight", fill:C.amber, fontSize:10}} />
            <Scatter name="Analysts" data={qaData}>
              {qaData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.statusColor} opacity={0.8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      ) : <EmptyState message={`No QA evaluations found for ${WEEKS[wIdx]}.`} />}
    </div>

    <div style={{...cs, overflowX: "auto"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text}}>Analyst Performance Lenses <span style={{fontSize:10, fontWeight:400, color:C.dim}}>(Weekly: {WEEKS[wIdx]})</span></div>
        
        <div style={{display:"flex", background:C.bg, borderRadius:8, padding:2, border:"1px solid "+C.border}}>
          <button onClick={() => setView("calibration")} style={btnStyle(view === "calibration")}>🎯 Calibration</button>
          <button onClick={() => setView("feedback")} style={btnStyle(view === "feedback")}>✍️ Coaching & Feedback</button>
          <button onClick={() => setView("ops")} style={btnStyle(view === "ops")}>⏱️ Operations</button>
        </div>
      </div>

      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11, minWidth: "500px"}}>
        <SortHeader columns={tableColumns} sortKey={qaSort.sk} sortDir={qaSort.sd} onSort={qaSort.toggle}/>
        <tbody>{[...qaData].sort((a,b)=>qaSort.sortFn(a[qaSort.sk],b[qaSort.sk])).map((q,i)=>
          <tr key={i} style={{borderBottom:"1px solid "+C.border+"22", transition:"background 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background=C.cyan+"08"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <td style={{padding:"10px",fontWeight:600, color:C.text}}>{q.name}</td>
            <td style={{padding:"10px",fontFamily:"monospace"}}>{q.n}</td>
            
            {view === "calibration" && <>
              <td style={{padding:"10px",fontWeight:800,fontFamily:"monospace",color:q.avg>=GOAL?C.green:C.amber}}>{q.avg}</td>
              <td style={{padding:"10px",fontFamily:"monospace",fontWeight:600}}>
                <span style={{color: q.deviation > 0 ? C.cyan : q.deviation < 0 ? C.red : C.dim}}>
                  {q.deviation > 0 ? "▲ +" : q.deviation < 0 ? "▼ " : ""}{q.deviation !== 0 ? q.deviation : "--"} pts
                </span>
              </td>
              <td style={{padding:"10px",fontFamily:"monospace",color:q.sd>7?C.orange:C.dim}}>{q.sd}</td>
            </>}

            {view === "feedback" && <>
              <td style={{padding:"10px",fontFamily:"monospace",fontWeight:600, color: q.avgChars < 30 ? C.red : C.cyan}}>
                {q.avgChars} chars/eval
              </td>
              <td style={{padding:"10px",fontFamily:"monospace"}}>
                <div style={{display:"flex", alignItems:"center", gap:6}}>
                  <div style={{width:40, height:4, background:C.bg, borderRadius:2}}><div style={{width:q.metNotePct+"%", height:"100%", background:C.purple, borderRadius:2}}/></div>
                  <span>{q.metNotePct}%</span>
                </div>
              </td>
              <td style={{padding:"10px",fontFamily:"monospace", color:C.dim}}>{q.commentsCount} notes</td>
            </>}

            {view === "ops" && <>
              {/* NUEVO: Renderizando el Average Handle Time */}
              <td style={{padding:"10px",fontFamily:"monospace", color:C.text}}>
                {q.avgAHT > 0 ? `${q.avgAHT} mins` : "--"}
              </td>
              <td style={{padding:"10px",fontFamily:"monospace", color: q.failRate > 10 ? C.red : C.dim}}>{q.failRate}% fatals</td>
              <td style={{padding:"10px",fontWeight:800,fontFamily:"monospace",color:C.cyan}}>{q.avg}</td>
            </>}

            <td style={{padding:"10px"}}>
              <span style={{fontSize:9, padding:"4px 8px", borderRadius:4, background: q.statusColor+"15", color: q.statusColor, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, border:"1px solid "+q.statusColor+"33"}}>
                {q.focusArea}
              </span>
            </td>
          </tr>)}
        </tbody>
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
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <KpiCard value={csatData.matched} label="Matched Interactions" color={C.teal} icon={"🔗"}/>
      <KpiCard value={csatData.pearson!=null?csatData.pearson:"--"} label="QA-CSAT Correlation" color={csatData.pearson>0.3?C.green:C.amber} icon={"📊"}/>
      <KpiCard value={surveyData?.total||0} label="Total Surveys" color={C.purple} icon={"📩"}/>
      <KpiCard value={surveyData?.avgRating||"--"} label="Avg Rating" color={C.purple} icon={"★"}/>
      <KpiCard value={(surveyData?.responseRate||0)+"%"} label="Response Rate" color={C.teal}/>
    </div>

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
    </div>}

    {csatData.findings.length>0&&<div style={{...cs,marginBottom:12,borderLeft:"3px solid "+C.purple}}>
      <div style={{fontSize:11,fontWeight:600,color:C.purple,marginBottom:8}}>{"📊"} QA-CSAT Insights</div>
      {csatData.findings.slice(0,8).map((f,i)=><div key={i} style={{padding:"6px 0",borderBottom:i<Math.min(csatData.findings.length,8)-1?"1px solid "+C.border+"22":undefined,
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><span style={{fontSize:11,fontWeight:600,cursor:f.agent!=="Campaign"?"pointer":"default"}}
          onClick={()=>{if(f.agent!=="Campaign"){const t=tls.find(t=>t.agents.some(a=>a.n===f.agent));const a=t?.agents.find(x=>x.n===f.agent);if(a&&t)onSelectAgent(a,t);}}}>{f.agent}</span></div>
        <span style={{fontSize:10,color:f.severity==="critical"?C.red:f.severity==="warning"?C.amber:C.teal}}>{f.msg}</span>
      </div>)}
    </div>}

    <div style={{display:"flex",gap:8,marginBottom:12}}>
      {[["all","All"],["low","CSAT ≤ 3"],["high","CSAT ≥ 4"]].map(([val,label])=>
        <button key={val} onClick={()=>setCsatFilter(val)}
          style={{fontSize:10,padding:"4px 12px",borderRadius:4,cursor:"pointer",border:"1px solid "+(csatFilter===val?C.purple:C.border),
            background:csatFilter===val?C.purple+"15":"transparent",color:csatFilter===val?C.purple:C.dim}}>{label}</button>)}
    </div>

    <div style={{...cs, overflowX: "auto"}}>
      <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:8}}>Agent Survey Performance</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11, minWidth: "600px"}}>
        <SortHeader columns={[["name","Agent"],["surveys","Surveys",60],["avgRating","Avg Rating",70],["qaScore","QA Score",70],["alignment","Status",80],["comment","Comment"],["actions","",50]]}
            sortKey={intelSort.sk} sortDir={intelSort.sd} onSort={intelSort.toggle}/>
        <tbody>{filteredAgents.map(a=>{const qm=csatData.agentMap[a.name];return{...a,qaScore:qm?.qaScore||0,alignment:qm?.alignment||"neutral",comment:a.comments.length?a.comments[a.comments.length-1]:""}; })
          .sort((a,b)=>intelSort.sortFn(a[intelSort.sk],b[intelSort.sk])).map((a,i)=>{
          return <tr key={i} style={{borderBottom:"1px solid "+C.border+"22"}}>
            <td style={{padding:"8px 10px",fontWeight:600}}>{a.name}</td>
            <td style={{padding:"8px 10px",fontFamily:"monospace"}}>{a.surveys}</td>
            <td style={{padding:"8px 10px"}}><span style={{fontWeight:700,fontFamily:"monospace",color:(a.avgRating||0)>=4?C.green:(a.avgRating||0)>=3?C.amber:C.red}}>{a.avgRating||"--"}</span> {"★"}</td>
            <td style={{padding:"8px 10px",fontFamily:"monospace",color:C.dim}}>{a.qaScore||"--"}</td>
            <td style={{padding:"8px 10px"}}>{(()=>{const colors={aligned:C.green,csat_leads:C.amber,qa_leads:C.amber,both_low:C.red,neutral:C.dim};
              const labels={aligned:"Aligned",csat_leads:"CSAT Leads",qa_leads:"QA Leads",both_low:"Low",neutral:"—"};
              return <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:(colors[a.alignment]||C.dim)+"18",color:colors[a.alignment]||C.dim}}>{labels[a.alignment]||"—"}</span>;})()}</td>
            <td style={{padding:"8px 10px",fontSize:10,color:C.dim,maxWidth:180,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.comments.length?a.comments[a.comments.length-1].substring(0,60):"--"}</td>
            <td style={{padding:"8px 10px"}}>{a.entries?.[0]?.url&&<a href={a.entries[a.entries.length-1].url} target="_blank" rel="noopener noreferrer"
              style={{fontSize:9,color:C.purple,textDecoration:"none"}}>{"↗"} Gladly</a>}</td>
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
  
  const [weekMode, setWeekMode] = useState("billing");
  const [isMobile, setIsMobile] = useState(false);

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
  
  // NEW FEATURE: CMD+K State
  const[showCmdK, setShowCmdK] = useState(false);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // NEW FEATURE: CMD+K Listener
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCmdK(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleWeekMode = (mode) => {
    if (mode === weekMode) return;
    window.CURRENT_WEEK_MODE = mode;
    setWeekMode(mode);
    setRefreshing(true); 
    
    setTimeout(() => {
      try {
        const newResult = processFiles(config.qaId, config.rosterId);
      } catch(e) { console.error("Error recalculating weeks:", e); }
    }, 50);
  };

  const changeTab = (newTab) => {
    setTab(newTab);
    if (newTab !== "dashboard") {
      setShowProfile(false); 
    }
  };

  if(data&&data!==D){D=data;WEEKS=D.weeks;LATEST_WIDX=WEEKS.length-1;}

  const filteredTLs=useMemo(()=>!D?[]:site==="all"?D.tls:D.tls.filter(t=>t.site===site),[site,data]);
  const alerts=useMemo(()=>!D?[]:generateAlerts(D.tls,wIdx),[data,wIdx]);
  const csatData=useMemo(()=>!D?{findings:[],agentMap:{},pairs:[],pearson:null,categoryImpact:[],matched:0}:csatQaCorrelation(D.tls,D.surveyData,D.rawInts),[data]);
  
  const handleRefresh=useCallback(async()=>{
    if(!config||refreshing)return;setRefreshing(true);
    try{const result=await fetchFromSheets(config.qaId,config.rosterId,config.surveyId);
      if(!result.error){
        D=result;WEEKS=result.weeks;LATEST_WIDX=WEEKS.length-1;
        setData(result);setLastUpdated(new Date());setWIdx(result.weeks.length-1);}
    }catch(e){}setRefreshing(false);
  },[config,refreshing]);

  React.useEffect(()=>{
    if(initialLoad.current||!config)return;initialLoad.current=true;
    setRefreshing(true);
    (async()=>{try{const result=await fetchFromSheets(config.qaId,config.rosterId,config.surveyId);
      if(result.error){ setLoadError(result.error); return;}
      D=result;WEEKS=result.weeks;LATEST_WIDX=WEEKS.length-1;
      setData(result);setWIdx(result.weeks.length-1);setLastUpdated(new Date());
    }catch(e){ setLoadError(e.message); }
    setRefreshing(false);
    })();
  },[config]);

  React.useEffect(()=>{if(!config)return;
    intervalRef.current=setInterval(async()=>{try{const r=await fetchFromSheets(config.qaId,config.rosterId,config.surveyId);
      if(!r.error){
        D=r;WEEKS=r.weeks;LATEST_WIDX=WEEKS.length-1;setData(r);setLastUpdated(new Date());}}catch(e){}},REFRESH_INTERVAL);
    return()=>clearInterval(intervalRef.current);},[config]);

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

  React.useEffect(() => {
    if(!config || !initialLoad.current) return;
    handleRefresh();
  }, [weekMode, handleRefresh, config]);


  if(showSetup) return <SetupScreen savedConfig={config} onDataReady={(d,cfg)=>{setData(d);setConfig(cfg);setWIdx(d.weeks.length-1);setLastUpdated(new Date());setShowSetup(false);}}/>;
  if(!D) return <LoadingScreen error={loadError} onSetup={()=>setShowSetup(true)}/>;

  const onSelectTL=(tl)=>{setSelTL(tl);setSelAgent(null);setShowProfile(false);setTab("dashboard");setCatFilter(null);navPush({tab:"dashboard",tl});};
  const onSelectAgent=(a,tl)=>{setSelAgent(a);setSelAgentTL(tl||selTL);setShowProfile(true);setTab("dashboard");navPush({tab:"dashboard",tl:tl||selTL,agent:a,agentTL:tl||selTL});};

  const sel={fontSize:11,background:C.bg,border:"1px solid "+C.border,borderRadius:20,color:C.text,padding:"7px 14px",fontFamily:"inherit",cursor:"pointer",outline:"none"};

  return <div style={{
      zoom: isMobile ? 1 : 1.25, 
      minHeight:"100vh",
      background:C.bg,
      color:C.text,
      fontFamily:"'Inter',-apple-system,'Segoe UI',system-ui,sans-serif"
    }}>
    {/* HEADER */}
    <div style={{background:C.panel,borderBottom:"1px solid "+C.border,padding:"12px 28px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          
          <div style={{display:"flex",alignItems:"center",gap:8, cursor:"pointer"}} 
            onClick={()=>{setSelTL(null);setSelAgent(null);setShowProfile(false);setTab("dashboard");navPush({tab:"dashboard"});}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="4" r="2.5" fill="#06b6d4"/><circle cx="4" cy="18" r="2.5" fill="#06b6d4"/><circle cx="20" cy="18" r="2.5" fill="#06b6d4"/><circle cx="18" cy="10" r="2" fill="#06b6d4"/><line x1="12" y1="4" x2="4" y2="18" stroke="#06b6d4" strokeWidth="1.5"/><line x1="12" y1="4" x2="20" y2="18" stroke="#06b6d4" strokeWidth="1.5"/><line x1="4" y1="18" x2="20" y2="18" stroke="#06b6d4" strokeWidth="1.5"/><line x1="12" y1="4" x2="18" y2="10" stroke="#06b6d4" strokeWidth="1.5"/><line x1="4" y1="18" x2="18" y2="10" stroke="#06b6d4" strokeWidth="1.5"/></svg>
            <span style={{fontSize:16,fontWeight:800,letterSpacing:"-0.5px",color:C.text}}>Next<span style={{color:C.cyan}}>Skill</span></span>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:wIdx>=LATEST_WIDX?C.green:C.amber,boxShadow:"0 0 6px "+(wIdx>=LATEST_WIDX?C.green:C.amber)+"66"}}/>
            <span style={{fontSize:8,fontWeight:600,letterSpacing:"1.5px",textTransform:"uppercase",color:wIdx>=LATEST_WIDX?C.green:C.amber}}>{wIdx>=LATEST_WIDX?"Live":"Historical"}</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          
          <div style={{display:"flex", background:C.bg, borderRadius:20, padding:3, border:"1px solid "+C.border, marginRight:4}}>
            <button onClick={()=>toggleWeekMode("billing")} 
              style={{fontSize:9, padding:"5px 12px", borderRadius:16, border:"none", background:weekMode==="billing"?C.cyan+"22":"transparent", color:weekMode==="billing"?C.cyan:C.dim, cursor:"pointer", fontWeight:600, transition:"all .2s"}}>
              Billing Wk
            </button>
            <button onClick={()=>toggleWeekMode("qa")} 
              style={{fontSize:9, padding:"5px 12px", borderRadius:16, border:"none", background:weekMode==="qa"?C.purple+"22":"transparent", color:weekMode==="qa"?C.purple:C.dim, cursor:"pointer", fontWeight:600, transition:"all .2s"}}>
              QA Wk
            </button>
            <button onClick={()=>toggleWeekMode("mtd")} 
              style={{fontSize:9, padding:"5px 12px", borderRadius:16, border:"none", background:weekMode==="mtd"?C.green+"22":"transparent", color:weekMode==="mtd"?C.green:C.dim, cursor:"pointer", fontWeight:600, transition:"all .2s"}}>
              MTD
            </button>
          </div>

          <select value={wIdx} onChange={e=>setWIdx(+e.target.value)} style={{...sel,borderColor:wIdx<LATEST_WIDX?C.amber+"66":C.border}}>
            {WEEKS.map((w,i)=><option key={i} value={i}>{w}{i===LATEST_WIDX?" (current)":""}</option>)}</select>
          <select value={site} onChange={e=>{setSite(e.target.value);setSelTL(null);setSelAgent(null);}} style={sel}>
            <option value="all">All Sites</option>
            {[...new Set(D.tls.map(t=>t.site))].filter(s=>s&&s!=="???").sort().map(s=><option key={s} value={s}>{s}</option>)}</select>
          
          <div style={{position:"relative"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search agent... (Ctrl+K)"
              style={{...sel,width:160,paddingLeft:28,fontSize:10}} onClick={()=>setShowCmdK(true)} readOnly/>
            <span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",fontSize:12,color:C.muted}}>{"🔍"}</span>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} style={{...sel,color:refreshing?C.amber:C.cyan}}>
            {refreshing?"⏳":"↻"}</button>
          {lastUpdated&&<span style={{fontSize:8,color:C.muted,fontFamily:"monospace"}}>{lastUpdated.toLocaleTimeString()}</span>}
          <button onClick={()=>setShowSetup(true)} style={{...sel,color:C.muted,fontSize:9}}>{"⚙"}</button>
        </div>
      </div>
      <div style={{display:"flex",gap:4,marginTop:12, overflowX:"auto"}}>
        <TabButton label="Dashboard" active={tab==="dashboard"} onClick={()=>changeTab("dashboard")}/>
        <TabButton label="Coaching" active={tab==="coaching"} onClick={()=>changeTab("coaching")} badge={alerts.filter(a=>a.severity==="high").length}/>
        <TabButton label="QA Analytics" active={tab==="qa"} onClick={()=>changeTab("qa")}/>
        <TabButton label="Intelligence" active={tab==="intel"} onClick={()=>changeTab("intel")}/>
      </div>
    </div>

    {/* BREADCRUMBS + EXPORT */}
    {tab==="dashboard"&&<div style={{padding:"12px 28px 0",display:"flex",alignItems:"center",gap:4, flexWrap: "wrap"}}>
      {[{label:"Campaign",onClick:()=>{setSelTL(null);setSelAgent(null);setShowProfile(false);setCatFilter(null);navPush({tab:"dashboard"});}},
        ...(selTL?[{label:selTL.name,onClick:()=>{setSelAgent(null);setShowProfile(false);}}]:[]),
        ...(selAgent?[{label:selAgent.n,onClick:()=>{}}]:[]),
      ].map((c,i,arr)=><React.Fragment key={i}>
        {i>0&&<span style={{color:C.muted,fontSize:10}}>{"›"}</span>}
        <button onClick={c.onClick} style={{background:"none",border:"none",color:i===arr.length-1?C.text:C.cyan,
          fontSize:11,cursor:i<arr.length-1?"pointer":"default",fontWeight:i===arr.length-1?700:400,padding:0}}>{c.label}</button>
      </React.Fragment>)}
      <div style={{marginLeft:"auto",display:"flex",gap:4}}>
        <select value={selTL?filteredTLs.indexOf(selTL):""} onChange={e=>{const v=e.target.value;if(v===""){setSelTL(null);setSelAgent(null);}else{const tl=filteredTLs[+v];if(tl)onSelectTL(tl);}}} style={sel}>
          <option value="">All Team Leads</option>
          {filteredTLs.map((t,i)=><option key={i} value={i}>{t.name}</option>)}</select>
        <button onClick={()=>exportCoachingCSV(D.tls,wIdx,D.surveyData)} style={{...sel,color:C.teal,borderColor:C.teal+"44"}} title="Export Coaching Report">
          {"📥"} Export</button>
      </div>
    </div>}

    {/* CONTENT */}
    <div style={{display:"flex",gap:0}}>
    <div style={{flex:1,padding: isMobile ? "16px 12px 40px" : "16px 28px 40px",minWidth:0}}>
      {tab==="dashboard"&&(selAgent?<AgentView agent={selAgent} tl={selAgentTL||selTL} wIdx={wIdx}/>:
        selTL?<TLView tl={selTL} wIdx={wIdx} onSelectAgent={a=>onSelectAgent(a,selTL)} isMobile={isMobile}/>:
        <CampaignView wIdx={wIdx} onSelectTL={onSelectTL} onSelectAgent={onSelectAgent} catFilter={catFilter} setCatFilter={setCatFilter} csatFindings={csatData.findings} site={site} filteredTLs={filteredTLs} isMobile={isMobile}/>)}
      {tab==="coaching"&&<CoachingTab alerts={alerts} wIdx={wIdx} onSelectAgent={onSelectAgent} tls={D.tls}/>}
      {tab==="qa"&&<QAAnalyticsTab wIdx={wIdx}/>}
      {tab==="intel"&&<IntelligenceTab csatData={csatData} surveyData={D.surveyData} onSelectAgent={onSelectAgent} tls={D.tls}/>}
    </div>

    {/* AGENT PROFILE SIDE PANEL */}
    {showProfile&&selAgent&&<AgentProfilePanel agent={selAgent} tl={selAgentTL||selTL} wIdx={wIdx}
      interactions={D.rawInts} surveyData={D.surveyData} csatData={csatData} weekISO={D.weekISO}
      onClose={()=>{setShowProfile(false);window.history.back();}} onViewInteraction={ints=>setModalInts(ints)} isMobile={isMobile}/>}
    </div>

    {/* FOOTER */}
    <div style={{textAlign:"center",padding:"12px 28px",borderTop:"1px solid "+C.border}}>
      <span style={{fontSize:9,color:C.muted,fontFamily:"monospace"}}>NextSkill v5.5 {"·"} QA Coaching Platform {"·"} {D.tls.length} TLs {"·"} {D.tls.reduce((s,t)=>s+t.agents.length,0)} agents</span>
    </div>

    {/* MODALS */}
    {modalInts&&<InteractionModal interactions={modalInts} onClose={()=>setModalInts(null)}/>}
    <CommandPalette isOpen={showCmdK} onClose={()=>setShowCmdK(false)} tls={D.tls} onSelectAgent={onSelectAgent} />
  </div>;
}

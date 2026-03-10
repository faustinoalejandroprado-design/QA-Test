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
        msg:"CSAT "+d.csatRating+"★ but QA "+d.qaScore+" — customer happy, process gaps"});
    if(d.csatRating<3&&d.qaScore>=GOAL)
      findings.push({agent:name,type:"low_csat_high_qa",severity:"warning",
        msg:"CSAT "+d.csatRating+"★ but QA "+d.qaScore+" — meets process, customer unhappy"});
    if(d.csatRating<3&&d.qaScore<60)
      findings.push({agent:name,type:"both_low",severity:"critical",
        msg:"CSAT "+d.csatRating+"★ and QA "+d.qaScore+" — urgent intervention needed"});
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

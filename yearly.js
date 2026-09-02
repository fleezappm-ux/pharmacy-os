"use strict";

const GAS_URL=PHARMACY_CONFIG.GAS_URL;
const loadingMessage=document.getElementById("yearly-loading");
let monthsData=[];
const text=(v,f="―")=>v===null||v===undefined||v===""?f:String(v);

async function loadYearlyData(){
  loadingMessage.className="loading-message";
  loadingMessage.textContent="データを読み込んでいます…";
  try{
    const response=await fetch(`${GAS_URL}?action=yearlyPerformance&idToken=${encodeURIComponent(getIdToken())}&_=${Date.now()}`),result=await response.json();
    if(handleAuthErrorIfNeeded(result,loadYearlyData))return;
    if(!result.success)throw new Error(result.message||"読み込みに失敗しました。");
    monthsData=result.months||[];
    renderCompactView();
    renderDetailSection("generic");
    renderDetailSection("concentration");
    renderDetailSection("insurance");
    renderDetailSection("homecare");
    renderDetailSection("survey");
    loadingMessage.textContent="";
  }catch(e){
    loadingMessage.className="loading-message error";
    loadingMessage.textContent="現在、データを読み込めません。GAS連携を確認してください。";
  }
}

/* ===== 直近3ヶ月のコンパクト表示（実数値） ===== */
const COMPACT_CATEGORIES=[
  {key:"generic",label:"後発品調剤率"},
  {key:"concentration",label:"処方箋集中率"},
  {key:"insurance",label:"保険調剤実績"},
  {key:"homecare",label:"在宅患者管理"},
  {key:"survey",label:"処方箋調べ"}
];

function compactValue(month,key){
  if(key==="generic")return month.generic?`${text(month.generic["新指標割合"])}%`:"未入力";
  if(key==="survey"){const v=month.survey?.["1日平均取扱処方箋枚数"];return(v!==null&&v!==undefined&&v!=="")?`${v}枚`:"未入力"}
  if(key==="concentration"){const rows=month.concentration||[];if(!rows.length)return"未入力";const top=[...rows].sort((a,b)=>(Number(b["全体割合"])||0)-(Number(a["全体割合"])||0))[0];return`${top["医療機関名"]||"―"} ${text(top["全体割合"])}%`}
  const rows=month[key]||[];
  if(!rows.length)return"未入力";
  const sum=rows.reduce((s,r)=>s+(Number(r["件数（件）"])||0),0);
  return`件数合計 ${sum}件`;
}

function renderCompactView(){
  const c=document.getElementById("compact-list");c.textContent="";
  monthsData.slice(1,4).forEach(month=>{
    const card=document.createElement("div");card.className="compact-month-card";
    const title=document.createElement("h3");title.textContent=month.label;card.appendChild(title);
    const grid=document.createElement("div");grid.className="compact-badge-grid";
    COMPACT_CATEGORIES.forEach(cat=>{
      const value=compactValue(month,cat.key);
      const filled=value!=="未入力";
      const chip=document.createElement("span");chip.className=`compact-chip ${filled?"filled":"empty"}`;
      chip.textContent=`${cat.label}：${value}`;
      grid.appendChild(chip);
    });
    card.appendChild(grid);
    c.appendChild(card);
  });
}

document.getElementById("show-full-button").addEventListener("click",()=>{
  document.getElementById("compact-view").hidden=true;
  document.getElementById("full-view").hidden=false;
});
document.getElementById("back-to-compact-button").addEventListener("click",()=>{
  document.getElementById("full-view").hidden=true;
  document.getElementById("compact-view").hidden=false;
});

/* ===== 詳細（項目別・年度アコーディオン） ===== */
function fiscalYearOf(monthKey){
  const[y,m]=monthKey.split("-").map(Number);
  return`${m>=4?y:y-1}年度`;
}
function currentFiscalYear(){
  const now=new Date();
  const y=now.getFullYear(),m=now.getMonth()+1;
  return`${m>=4?y:y-1}年度`;
}

function buildGenericItems(){
  const trend=monthsData.map(m=>({label:m.label,display:m.generic?`${text(m.generic["新指標割合"])}%`:"未入力",key:m.key}));
  return[{name:"新指標割合",trend}];
}
function buildSurveyItems(){
  const trend=monthsData.map(m=>{const v=m.survey?.["1日平均取扱処方箋枚数"];return{label:m.label,display:(v!==null&&v!==undefined&&v!=="")?`${v}枚`:"未入力",key:m.key}});
  return[{name:"1日平均処方箋枚数",trend}];
}
function buildHomecareItems(){
  const trend=monthsData.map(m=>{
    const rows=m.homecare||[];
    if(!rows.length)return{label:m.label,display:"未入力",key:m.key};
    const caseSum=rows.reduce((s,r)=>s+(Number(r["件数（件）"])||0),0);
    const countSum=rows.reduce((s,r)=>s+(Number(r["回数（回）"])||0),0);
    return{label:m.label,display:`件数合計 ${caseSum}件 ／ 回数合計 ${countSum}回`,key:m.key};
  });
  return[{name:"在宅患者管理 合計",trend}];
}
function buildConcentrationItems(){
  const latestByName={};
  monthsData.forEach(m=>(m.concentration||[]).forEach(r=>{
    const name=r["医療機関名"];if(!name)return;
    if(!(name in latestByName))latestByName[name]=Number(r["全体割合"])||0;
  }));
  const top3=Object.entries(latestByName).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]);
  return top3.map(name=>({
    name,
    trend:monthsData.map(m=>{
      const row=(m.concentration||[]).find(r=>r["医療機関名"]===name);
      return{label:m.label,display:row?`${text(row["全体割合"])}%`:"未入力",key:m.key};
    })
  }));
}
function buildInsuranceItems(){
  const names=new Set();
  monthsData.forEach(m=>(m.insurance||[]).forEach(r=>{if(r["区分"])names.add(r["区分"])}));
  return[...names].map(name=>({
    name,
    trend:monthsData.map(m=>{
      const row=(m.insurance||[]).find(r=>r["区分"]===name);
      if(!row)return{label:m.label,display:"未入力",key:m.key};
      const parts=[];
      if(row["件数（件）"]!==null&&row["件数（件）"]!==undefined)parts.push(`件数${text(row["件数（件）"])}`);
      if(row["処方箋回数_医科"]!==null&&row["処方箋回数_医科"]!==undefined)parts.push(`医科${text(row["処方箋回数_医科"])}`);
      if(row["処方箋回数_歯科"]!==null&&row["処方箋回数_歯科"]!==undefined)parts.push(`歯科${text(row["処方箋回数_歯科"])}`);
      if(row["調剤報酬点数_合計"]!==null&&row["調剤報酬点数_合計"]!==undefined)parts.push(`点数${text(row["調剤報酬点数_合計"])}`);
      return{label:m.label,display:parts.length?parts.join(" ／ "):"―",key:m.key};
    })
  }));
}

const ITEM_BUILDERS={generic:buildGenericItems,concentration:buildConcentrationItems,insurance:buildInsuranceItems,homecare:buildHomecareItems,survey:buildSurveyItems};

function monthRow(entry){
  const row=document.createElement("div");row.className="item-month-row";
  const label=document.createElement("span");label.className="item-month-label";label.textContent=entry.label;
  const value=document.createElement("span");value.className="item-month-value";value.textContent=entry.display;
  row.append(label,value);
  return row;
}

function renderItemCard(item){
  const card=document.createElement("div");card.className="item-card";
  const title=document.createElement("p");title.className="item-title";title.textContent=item.name;card.appendChild(title);

  const groups=new Map();
  item.trend.forEach(entry=>{
    const fy=fiscalYearOf(entry.key);
    if(!groups.has(fy))groups.set(fy,[]);
    groups.get(fy).push(entry);
  });
  const curFY=currentFiscalYear();

  groups.forEach((rows,fy)=>{
    if(fy===curFY){
      const list=document.createElement("div");list.className="item-month-list";
      rows.forEach(r=>list.appendChild(monthRow(r)));
      card.appendChild(list);
    }else{
      const details=document.createElement("details");details.className="fy-accordion";
      const summary=document.createElement("summary");summary.textContent=fy;details.appendChild(summary);
      const list=document.createElement("div");list.className="item-month-list";
      rows.forEach(r=>list.appendChild(monthRow(r)));
      details.appendChild(list);
      card.appendChild(details);
    }
  });
  return card;
}

function renderDetailSection(category){
  const c=document.getElementById(`${category}-yearly-list`);c.textContent="";
  const items=ITEM_BUILDERS[category]();
  if(!items.length){c.innerHTML='<p class="empty-message">データがありません。</p>';return}
  items.forEach(item=>c.appendChild(renderItemCard(item)));
}

document.getElementById("reload-button").addEventListener("click",loadYearlyData);
document.querySelectorAll(".edit-tab").forEach(t=>t.addEventListener("click",()=>{
  document.querySelectorAll(".edit-tab").forEach(x=>x.classList.remove("active"));
  t.classList.add("active");
  document.querySelectorAll(".yearly-section").forEach(s=>s.hidden=true);
  document.getElementById(t.dataset.target).hidden=false;
}));

requireAuth(loadYearlyData);

"use strict";

const GAS_URL="https://script.google.com/macros/s/AKfycbzS1F43nO_ZDG6X6gH4qfUeprWmFFOZuthQKjbXxuxkoTWY0QMvbAfURd2speGZEa6x/exec";
const loadingMessage=document.getElementById("yearly-loading");
let monthsData=[];
const text=(v,f="―")=>v===null||v===undefined||v===""?f:String(v);

async function loadYearlyData(){
  loadingMessage.className="loading-message";
  loadingMessage.textContent="データを読み込んでいます…";
  try{
    const response=await fetch(`${GAS_URL}?action=yearlyPerformance&_=${Date.now()}`),result=await response.json();
    if(!result.success)throw new Error(result.message||"読み込みに失敗しました。");
    monthsData=result.months||[];
    renderGenericList();
    renderSubCategoryList("concentration");
    renderSubCategoryList("insurance");
    renderSubCategoryList("homecare");
    renderSurveyList();
    loadingMessage.textContent="";
  }catch(e){
    loadingMessage.className="loading-message error";
    loadingMessage.textContent="現在、データを読み込めません。GAS連携を確認してください。";
  }
}

/* 見るだけの一覧なので、行はボタンではなく静的な表示にしています。 */
function makeStaticRow(title,detail,badgeText,badgeClass){
  const row=document.createElement("div");row.className="list-row static";
  const main=document.createElement("div");main.className="list-main";
  const titleEl=document.createElement("span");titleEl.className="list-title";titleEl.textContent=title;main.appendChild(titleEl);
  const detailEl=document.createElement("span");detailEl.className="list-detail";detailEl.textContent=detail;main.appendChild(detailEl);
  row.appendChild(main);
  const badge=document.createElement("span");badge.className=`badge ${badgeClass}`;badge.textContent=badgeText;
  row.appendChild(badge);
  return row;
}

function renderGenericList(){
  const c=document.getElementById("generic-yearly-list");c.textContent="";
  monthsData.forEach(month=>{
    const filled=!!month.generic;
    const detail=filled?`カットオフ値割合：${text(month.generic["カットオフ値割合"])}%`:"未入力";
    c.appendChild(makeStaticRow(month.label,detail,filled?"入力済み":"未入力",filled?"green":"none"));
  });
}

const CATEGORY_TITLE_PROP={concentration:"医療機関名",insurance:"区分",homecare:"区分"};

function renderSubCategoryList(category){
  const c=document.getElementById(`${category}-yearly-list`);c.textContent="";
  monthsData.forEach(month=>{
    const rows=month[category]||[];
    const detail=rows.length?rows.map(r=>r[CATEGORY_TITLE_PROP[category]]).filter(Boolean).join("、"):"未入力";
    c.appendChild(makeStaticRow(month.label,detail,rows.length?`${rows.length}件`:"未入力",rows.length?"green":"none"));
  });
}

function renderSurveyList(){
  const c=document.getElementById("survey-yearly-list");c.textContent="";
  monthsData.forEach(month=>{
    const s=month.survey;
    const filled=s&&s["処方箋受付回数"]!==null&&s["処方箋受付回数"]!==undefined&&s["処方箋受付回数"]!=="";
    const detail=filled?`合計：${text(s["合計（処方箋受付枚数）"])} ／ 1日平均：${text(s["1日平均取扱処方箋枚数"])}`:"未入力";
    c.appendChild(makeStaticRow(month.label,detail,filled?"入力済み":"未入力",filled?"green":"none"));
  });
}

document.getElementById("reload-button").addEventListener("click",loadYearlyData);
document.querySelectorAll(".edit-tab").forEach(t=>t.addEventListener("click",()=>{
  document.querySelectorAll(".edit-tab").forEach(x=>x.classList.remove("active"));
  t.classList.add("active");
  document.querySelectorAll(".yearly-section").forEach(s=>s.hidden=true);
  document.getElementById(t.dataset.target).hidden=false;
}));

loadYearlyData();

"use strict";

const GAS_URL="https://script.google.com/macros/s/AKfycbzS1F43nO_ZDG6X6gH4qfUeprWmFFOZuthQKjbXxuxkoTWY0QMvbAfURd2speGZEa6x/exec";
const loadingMessage=document.getElementById("edit-loading");
let notices=[]; let licenses=[]; let pharmacists=[]; let sellers=[]; let institutions=[]; let deleteContext=null;
let monthsData=[]; let subrowContext=null;
const text=(v,f="―")=>v===null||v===undefined||v===""?f:String(v);
const pick=(obj,keys,f="")=>{for(const k of keys){if(obj&&obj[k]!==undefined&&obj[k]!==null&&obj[k]!=="")return obj[k]}return f};
function formatDate(v){if(!v)return"—";if(typeof v==="object"&&v!==null)v=v.start||"";if(!v)return"—";const s=String(v).slice(0,10);return/^\d{4}-\d{2}-\d{2}$/.test(s)?s.replaceAll("-","/"):s}

const MODAL_IDS=["daily-modal","notice-modal","license-modal","pharmacist-modal","seller-modal","institution-modal","generic-modal","subrow-modal","survey-modal","delete-modal"];
function showModal(id){document.getElementById(id).hidden=false;document.body.style.overflow="hidden"}
function hideModal(id){document.getElementById(id).hidden=true;if(MODAL_IDS.every(m=>document.getElementById(m).hidden))document.body.style.overflow=""}
function hideAllEditModals(){MODAL_IDS.filter(m=>m!=="delete-modal").forEach(hideModal)}

async function apiWrite(action,payload){const r=await fetch(GAS_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,...payload})});const j=await r.json();if(!j.success)throw new Error(j.message||"保存に失敗しました。");return j}

/* ===== 各種届出 ===== */
function normalizeNotice(raw,index){const type=pick(raw,["届出種別","name","title"],"名称未設定");const condition=pick(raw,["有効期限"],"");const dateRaw=pick(raw,["指定年月日"],"");const date=typeof dateRaw==="object"&&dateRaw!==null?(dateRaw.start||""):dateRaw;const number=pick(raw,["指定番号・備考"],"");const order=Number(pick(raw,["並び順"],index+1))||index+1;const acquisition=pick(raw,["取得状況"],"取得済み");const id=pick(raw,["id"],"");return{raw,id,type,condition,date,number,order,acquisition}}

function renderNoticeList(){const c=document.getElementById("notice-edit-list");c.textContent="";if(!notices.length){c.innerHTML='<p class="empty-message">届出データはありません。</p>';return}notices.slice().sort((a,b)=>a.order-b.order).forEach(n=>{const row=document.createElement("button");row.type="button";row.className="list-row";const main=document.createElement("div");main.className="list-main";const title=document.createElement("span");title.className="list-title";title.textContent=`#${n.order}　${n.type}`;main.appendChild(title);const detail=document.createElement("span");detail.className="list-detail";detail.textContent=`有効期限：${formatDate(n.date)} ／ 指定番号：${text(n.number)}`;main.appendChild(detail);const badge=document.createElement("span");badge.className=`badge ${n.acquisition==="取得済み"?"green":"none"}`;badge.textContent=n.acquisition;row.append(main,badge);row.addEventListener("click",()=>openNoticeForm(n));c.appendChild(row)})}

function openNoticeForm(n){document.getElementById("notice-modal-title").textContent=n?"届出を編集":"新規届出を追加";document.getElementById("notice-id").value=n?.id||"";document.getElementById("notice-type").value=n?.type||"";document.getElementById("notice-acquisition").value=n?.acquisition||"取得済み";document.getElementById("notice-deadline").value=n?.condition||"";document.getElementById("notice-date").value=n?.date?String(n.date).slice(0,10):"";document.getElementById("notice-number").value=n?.number||"";document.getElementById("notice-order").value=n?.order||((notices.at(-1)?.order||0)+1);const btn=document.getElementById("notice-delete-button");btn.hidden=!n;btn.onclick=n?()=>openDeleteConfirm("notice",n):null;showModal("notice-modal")}

document.getElementById("notice-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const payload={id:document.getElementById("notice-id").value,notice:{
    "届出種別":document.getElementById("notice-type").value.trim(),
    "取得状況":document.getElementById("notice-acquisition").value,
    "有効期限":document.getElementById("notice-deadline").value.trim(),
    "指定年月日":document.getElementById("notice-date").value,
    "指定番号・備考":document.getElementById("notice-number").value.trim(),
    "並び順":Number(document.getElementById("notice-order").value)
  }};
  try{
    loadingMessage.textContent="保存しています…";
    await apiWrite("saveStatusNotice",payload);
    hideModal("notice-modal");
    await loadAll();
  }catch(err){
    hideModal("notice-modal");
    loadingMessage.className="loading-message error";
    loadingMessage.textContent=`保存できません：${err.message}`;
  }
});

/* ===== 許可・登録 ===== */
function normalizeLicense(raw,index){const type=pick(raw,["種類"],"名称未設定");const dateRaw=pick(raw,["有効期限"],"");const date=typeof dateRaw==="object"&&dateRaw!==null?(dateRaw.start||""):dateRaw;const number=pick(raw,["許可(登録・認定・免許)番号"],"");const order=Number(pick(raw,["並び順"],index+1))||index+1;const acquisition=pick(raw,["取得状況"],"取得済み");const id=pick(raw,["id"],"");return{raw,id,type,date,number,order,acquisition}}

function renderLicenseList(){const c=document.getElementById("license-edit-list");c.textContent="";if(!licenses.length){c.innerHTML='<p class="empty-message">許可・登録データはありません。</p>';return}licenses.slice().sort((a,b)=>a.order-b.order).forEach(n=>{const row=document.createElement("button");row.type="button";row.className="list-row";const main=document.createElement("div");main.className="list-main";const title=document.createElement("span");title.className="list-title";title.textContent=`#${n.order}　${n.type}`;main.appendChild(title);const detail=document.createElement("span");detail.className="list-detail";detail.textContent=`登録番号：${text(n.number)} ／ 有効期限：${formatDate(n.date)}`;main.appendChild(detail);const badge=document.createElement("span");badge.className=`badge ${n.acquisition==="取得済み"?"green":"none"}`;badge.textContent=n.acquisition;row.append(main,badge);row.addEventListener("click",()=>openLicenseForm(n));c.appendChild(row)})}

function openLicenseForm(n){document.getElementById("license-modal-title").textContent=n?"許可・登録を編集":"新規許可・登録を追加";document.getElementById("license-id").value=n?.id||"";document.getElementById("license-type").value=n?.type||"";document.getElementById("license-acquisition").value=n?.acquisition||"取得済み";document.getElementById("license-number").value=n?.number||"";document.getElementById("license-date").value=n?.date?String(n.date).slice(0,10):"";document.getElementById("license-order").value=n?.order||((licenses.at(-1)?.order||0)+1);const btn=document.getElementById("license-delete-button");btn.hidden=!n;btn.onclick=n?()=>openDeleteConfirm("license",n):null;showModal("license-modal")}

document.getElementById("license-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const payload={id:document.getElementById("license-id").value,license:{
    "種類":document.getElementById("license-type").value.trim(),
    "取得状況":document.getElementById("license-acquisition").value,
    "許可(登録・認定・免許)番号":document.getElementById("license-number").value.trim(),
    "有効期限":document.getElementById("license-date").value,
    "並び順":Number(document.getElementById("license-order").value)
  }};
  try{
    loadingMessage.textContent="保存しています…";
    await apiWrite("saveStatusLicense",payload);
    hideModal("license-modal");
    await loadAll();
  }catch(err){
    hideModal("license-modal");
    loadingMessage.className="loading-message error";
    loadingMessage.textContent=`保存できません：${err.message}`;
  }
});

/* ===== 薬剤師名簿 ===== */
function normalizePharmacist(raw,index){const name=pick(raw,["薬剤師　氏名"],"氏名未設定");const licenseNumber=pick(raw,["薬剤師登録番号"],"");const insuranceNumber=pick(raw,["保険薬剤師登録番号"],"");const dateRaw=pick(raw,["登録年月日"],"");const date=typeof dateRaw==="object"&&dateRaw!==null?(dateRaw.start||""):dateRaw;const note=pick(raw,["備考(異動月日)"],"");const order=Number(pick(raw,["並び順"],index+1))||index+1;const id=pick(raw,["id"],"");return{raw,id,name,licenseNumber,insuranceNumber,date,note,order}}

function renderPharmacistList(){const c=document.getElementById("pharmacist-edit-list");c.textContent="";if(!pharmacists.length){c.innerHTML='<p class="empty-message">薬剤師の登録はありません。</p>';return}pharmacists.slice().sort((a,b)=>a.order-b.order).forEach(n=>{const row=document.createElement("button");row.type="button";row.className="list-row";const main=document.createElement("div");main.className="list-main";const title=document.createElement("span");title.className="list-title";title.textContent=n.name;main.appendChild(title);const parts=[];if(n.licenseNumber)parts.push(`薬剤師登録番号：${n.licenseNumber}`);if(n.insuranceNumber)parts.push(`保険薬剤師登録番号：${n.insuranceNumber}`);if(n.date)parts.push(`登録年月日：${formatDate(n.date)}`);const detail=document.createElement("span");detail.className="list-detail";detail.textContent=parts.length?parts.join(" ／ "):"―";main.appendChild(detail);row.append(main);row.addEventListener("click",()=>openPharmacistForm(n));c.appendChild(row)})}

function openPharmacistForm(n){document.getElementById("pharmacist-modal-title").textContent=n?"薬剤師を編集":"新規薬剤師を追加";document.getElementById("pharmacist-id").value=n?.id||"";document.getElementById("pharmacist-name").value=n?.name||"";document.getElementById("pharmacist-license-number").value=n?.licenseNumber||"";document.getElementById("pharmacist-insurance-number").value=n?.insuranceNumber||"";document.getElementById("pharmacist-date").value=n?.date?String(n.date).slice(0,10):"";document.getElementById("pharmacist-note").value=n?.note||"";document.getElementById("pharmacist-order").value=n?.order||((pharmacists.at(-1)?.order||0)+1);const btn=document.getElementById("pharmacist-delete-button");btn.hidden=!n;btn.onclick=n?()=>openDeleteConfirm("pharmacist",{id:n.id,type:n.name,order:n.order}):null;showModal("pharmacist-modal")}

document.getElementById("pharmacist-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const payload={id:document.getElementById("pharmacist-id").value,pharmacist:{
    "薬剤師　氏名":document.getElementById("pharmacist-name").value.trim(),
    "薬剤師登録番号":document.getElementById("pharmacist-license-number").value.trim(),
    "保険薬剤師登録番号":document.getElementById("pharmacist-insurance-number").value.trim(),
    "登録年月日":document.getElementById("pharmacist-date").value,
    "備考(異動月日)":document.getElementById("pharmacist-note").value.trim(),
    "並び順":Number(document.getElementById("pharmacist-order").value)
  }};
  try{
    loadingMessage.textContent="保存しています…";
    await apiWrite("saveStatusPharmacist",payload);
    hideModal("pharmacist-modal");
    await loadAll();
  }catch(err){
    hideModal("pharmacist-modal");
    loadingMessage.className="loading-message error";
    loadingMessage.textContent=`保存できません：${err.message}`;
  }
});

/* ===== 登録販売者名簿 ===== */
function normalizeSeller(raw,index){const name=pick(raw,["登録販売者　氏名"],"氏名未設定");const dateRaw=pick(raw,["登録年月日"],"");const date=typeof dateRaw==="object"&&dateRaw!==null?(dateRaw.start||""):dateRaw;const note=pick(raw,["備考"],"");const id=pick(raw,["id"],"");return{raw,id,name,date,note,order:index+1}}

function renderSellerList(){const c=document.getElementById("seller-edit-list");c.textContent="";if(!sellers.length){c.innerHTML='<p class="empty-message">登録販売者の登録はありません。</p>';return}sellers.forEach(n=>{const row=document.createElement("button");row.type="button";row.className="list-row";const main=document.createElement("div");main.className="list-main";const title=document.createElement("span");title.className="list-title";title.textContent=n.name;main.appendChild(title);const parts=[];if(n.date)parts.push(`登録年月日：${formatDate(n.date)}`);if(n.note)parts.push(n.note);const detail=document.createElement("span");detail.className="list-detail";detail.textContent=parts.length?parts.join(" ／ "):"―";main.appendChild(detail);row.append(main);row.addEventListener("click",()=>openSellerForm(n));c.appendChild(row)})}

function openSellerForm(n){document.getElementById("seller-modal-title").textContent=n?"登録販売者を編集":"新規登録販売者を追加";document.getElementById("seller-id").value=n?.id||"";document.getElementById("seller-name").value=n?.name||"";document.getElementById("seller-date").value=n?.date?String(n.date).slice(0,10):"";document.getElementById("seller-note").value=n?.note||"";const btn=document.getElementById("seller-delete-button");btn.hidden=!n;btn.onclick=n?()=>openDeleteConfirm("seller",{id:n.id,type:n.name,order:null}):null;showModal("seller-modal")}

document.getElementById("seller-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const payload={id:document.getElementById("seller-id").value,seller:{
    "登録販売者　氏名":document.getElementById("seller-name").value.trim(),
    "登録年月日":document.getElementById("seller-date").value,
    "備考":document.getElementById("seller-note").value.trim()
  }};
  try{
    loadingMessage.textContent="保存しています…";
    await apiWrite("saveStatusSeller",payload);
    hideModal("seller-modal");
    await loadAll();
  }catch(err){
    hideModal("seller-modal");
    loadingMessage.className="loading-message error";
    loadingMessage.textContent=`保存できません：${err.message}`;
  }
});

/* ===== 基本情報（単一レコード） ===== */
function populateBasicForm(info){info=info||{};document.getElementById("basic-id").value=info.id||"";document.getElementById("basic-insurance-pharmacy-id").value=info.insurancePharmacyId||"";document.getElementById("basic-name").value=info["薬局・店舗販売業の名称"]||"";document.getElementById("basic-owner").value=info["開設者氏名(又は代表者)"]||"";document.getElementById("basic-manager").value=info["管理者氏名"]||"";document.getElementById("basic-address").value=info["所在地"]||"";document.getElementById("basic-hours").value=info["開局時間"]||"";document.getElementById("basic-holiday").value=info["休日"]||"";const licenseDate=info["薬局許可年月日"];document.getElementById("basic-license-date").value=licenseDate&&licenseDate.start?String(licenseDate.start).slice(0,10):"";const insuranceDate=info["保険薬局指定年月日"];document.getElementById("basic-insurance-date").value=insuranceDate&&insuranceDate.start?String(insuranceDate.start).slice(0,10):"";document.getElementById("basic-insurance-code").value=info["コード番号"]||"";const renewalDate=info["指定更新期限"];document.getElementById("basic-insurance-renewal").value=renewalDate&&renewalDate.start?String(renewalDate.start).slice(0,10):""}

document.getElementById("basic-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const id=document.getElementById("basic-id").value;
  if(!id){loadingMessage.className="loading-message error";loadingMessage.textContent="基本情報のIDが取得できていません。再読み込みしてください。";return}
  const payload={id,insurancePharmacyId:document.getElementById("basic-insurance-pharmacy-id").value,basicInfo:{
    "薬局・店舗販売業の名称":document.getElementById("basic-name").value.trim(),
    "開設者氏名(又は代表者)":document.getElementById("basic-owner").value.trim(),
    "管理者氏名":document.getElementById("basic-manager").value.trim(),
    "所在地":document.getElementById("basic-address").value.trim(),
    "開局時間":document.getElementById("basic-hours").value.trim(),
    "休日":document.getElementById("basic-holiday").value.trim(),
    "薬局許可年月日":document.getElementById("basic-license-date").value,
    "保険薬局指定年月日":document.getElementById("basic-insurance-date").value,
    "コード番号":document.getElementById("basic-insurance-code").value.trim(),
    "指定更新期限":document.getElementById("basic-insurance-renewal").value
  }};
  try{
    loadingMessage.textContent="保存しています…";
    await apiWrite("saveStatusBasicInfo",payload);
    loadingMessage.textContent="保存しました。";
    await loadAll();
  }catch(err){
    loadingMessage.className="loading-message error";
    loadingMessage.textContent=`保存できません：${err.message}`;
  }
});

/* ===== 試験検査機関の利用契約 ===== */
function normalizeInstitution(raw,index){const name=pick(raw,["利用機関名"],"名称未設定");const dateRaw=pick(raw,["契約更新期限"],"");const date=typeof dateRaw==="object"&&dateRaw!==null?(dateRaw.start||""):dateRaw;const id=pick(raw,["id"],"");return{raw,id,name,date,order:index+1}}

function renderInstitutionList(){const c=document.getElementById("institution-edit-list");c.textContent="";if(!institutions.length){c.innerHTML='<p class="empty-message">試験検査機関の登録はありません。</p>';return}institutions.forEach(n=>{const row=document.createElement("button");row.type="button";row.className="list-row";const main=document.createElement("div");main.className="list-main";const title=document.createElement("span");title.className="list-title";title.textContent=n.name;main.appendChild(title);const detail=document.createElement("span");detail.className="list-detail";detail.textContent=`契約更新期限：${formatDate(n.date)}`;main.appendChild(detail);row.append(main);row.addEventListener("click",()=>openInstitutionForm(n));c.appendChild(row)})}

function openInstitutionForm(n){document.getElementById("institution-modal-title").textContent=n?"試験検査機関を編集":"新規試験検査機関を追加";document.getElementById("institution-id").value=n?.id||"";document.getElementById("institution-name").value=n?.name||"";document.getElementById("institution-date").value=n?.date?String(n.date).slice(0,10):"";const btn=document.getElementById("institution-delete-button");btn.hidden=!n;btn.onclick=n?()=>openDeleteConfirm("institution",{id:n.id,type:n.name,order:null}):null;showModal("institution-modal")}

document.getElementById("institution-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const payload={id:document.getElementById("institution-id").value,institution:{
    "利用機関名":document.getElementById("institution-name").value.trim(),
    "契約更新期限":document.getElementById("institution-date").value
  }};
  try{
    loadingMessage.textContent="保存しています…";
    await apiWrite("saveStatusTestInstitution",payload);
    hideModal("institution-modal");
    await loadAll();
  }catch(err){
    hideModal("institution-modal");
    loadingMessage.className="loading-message error";
    loadingMessage.textContent=`保存できません：${err.message}`;
  }
});

/* ===== 日次業務 ===== */
let dailyReports=[];
function normalizeDailyReport(raw){const date=pick(raw,["日付"],"");const dateStr=typeof date==="object"&&date!==null?(date.start||""):date;return{raw,id:pick(raw,["id"],""),date:dateStr,closed:Boolean(raw["休業日"]),hours:raw["開局時間"]||"",count:raw["処方箋枚数"],managerAbsence:raw["管理者不在時間"]||"",managerResponder:raw["管理者不在時対応者"]||"",pharmacistAbsence:raw["薬剤師不在時間"]||"",pharmacistResponder:raw["薬剤師不在時対応者"]||"",notes:raw["特記事項"]||"",handover:raw["申し送り"]||"",confirmedBy:raw["確認印"]||""}}

async function loadDailyReports(){try{const response=await fetch(`${GAS_URL}?action=dailyReports&_=${Date.now()}`),result=await response.json();if(!result.success)throw new Error(result.message||"読み込みに失敗しました。");dailyReports=(result.reports||[]).map(normalizeDailyReport);renderDailyList()}catch(e){document.getElementById("daily-edit-list").innerHTML='<p class="empty-message">読み込みに失敗しました。</p>'}}

function renderDailyList(){const c=document.getElementById("daily-edit-list");c.textContent="";if(!dailyReports.length){c.innerHTML='<p class="empty-message">日次業務の記録はありません。</p>';return}dailyReports.forEach(n=>{const row=document.createElement("button");row.type="button";row.className="list-row";const main=document.createElement("div");main.className="list-main";const title=document.createElement("span");title.className="list-title";title.textContent=formatDate(n.date);main.appendChild(title);const detail=document.createElement("span");detail.className="list-detail";detail.textContent=n.closed?"休業日":`開局時間：${text(n.hours)} ／ 処方箋枚数：${text(n.count)}`;main.appendChild(detail);const badge=document.createElement("span");badge.className=`badge ${n.closed?"none":"green"}`;badge.textContent=n.closed?"休業日":"営業日";row.append(main,badge);row.addEventListener("click",()=>openDailyForm(n));c.appendChild(row)})}

function openDailyForm(n){document.getElementById("daily-edit-id").value=n.id;document.getElementById("daily-edit-date").value=n.date?String(n.date).slice(0,10):"";document.getElementById("daily-edit-closed").checked=n.closed;document.getElementById("daily-edit-hours").value=n.hours||"";document.getElementById("daily-edit-count").value=n.count??"";document.getElementById("daily-edit-manager-absence").value=n.managerAbsence||"";document.getElementById("daily-edit-manager-responder").value=n.managerResponder||"";document.getElementById("daily-edit-pharmacist-absence").value=n.pharmacistAbsence||"";document.getElementById("daily-edit-pharmacist-responder").value=n.pharmacistResponder||"";document.getElementById("daily-edit-notes").value=n.notes||"";document.getElementById("daily-edit-handover").value=n.handover||"";document.getElementById("daily-edit-confirmed").value=n.confirmedBy||"";document.getElementById("daily-edit-delete-button").onclick=()=>openDeleteConfirm("daily",{id:n.id,type:formatDate(n.date),order:null});showModal("daily-modal")}

document.getElementById("daily-edit-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const id=document.getElementById("daily-edit-id").value;
  const numOrEmpty=v=>v===""?"":Number(v);
  const payload={id,report:{
    "日付":document.getElementById("daily-edit-date").value,
    "休業日":document.getElementById("daily-edit-closed").checked,
    "開局時間":document.getElementById("daily-edit-hours").value.trim(),
    "処方箋枚数":numOrEmpty(document.getElementById("daily-edit-count").value),
    "管理者不在時間":document.getElementById("daily-edit-manager-absence").value.trim(),
    "管理者不在時対応者":document.getElementById("daily-edit-manager-responder").value.trim(),
    "薬剤師不在時間":document.getElementById("daily-edit-pharmacist-absence").value.trim(),
    "薬剤師不在時対応者":document.getElementById("daily-edit-pharmacist-responder").value.trim(),
    "特記事項":document.getElementById("daily-edit-notes").value.trim(),
    "申し送り":document.getElementById("daily-edit-handover").value.trim(),
    "確認印":document.getElementById("daily-edit-confirmed").value
  }};
  try{
    loadingMessage.textContent="保存しています…";
    await apiWrite("updateDailyReport",payload);
    hideModal("daily-modal");
    loadingMessage.textContent="";
    await loadDailyReports();
  }catch(err){
    hideModal("daily-modal");
    loadingMessage.className="loading-message error";
    loadingMessage.textContent=`保存できません：${err.message}`;
  }
});

/* ===== 削除確認（共通） ===== */
const DELETE_LABELS={notice:"この届出を削除しますか？",license:"この許可・登録を削除しますか？",pharmacist:"この薬剤師を削除しますか？",seller:"この登録販売者を削除しますか？",institution:"この試験検査機関を削除しますか？",daily:"この日報を削除しますか？",generic:"この月の後発品調剤率データを削除しますか？",subrow:"この明細を削除しますか？",survey:"この月の処方箋調べデータを削除しますか？"};
const DELETE_ACTIONS={notice:"deleteStatusNotice",license:"deleteStatusLicense",pharmacist:"deleteStatusPharmacist",seller:"deleteStatusSeller",institution:"deleteStatusTestInstitution",daily:"deleteDailyReport",generic:"deleteGenericRateRow",subrow:"deleteMonthlyCategoryRow",survey:"deleteStatusSurveyRow"};
const DELETE_MODALS={notice:"notice-modal",license:"license-modal",pharmacist:"pharmacist-modal",seller:"seller-modal",institution:"institution-modal",daily:"daily-modal",generic:"generic-modal",subrow:"subrow-modal",survey:"survey-modal"};

function openDeleteConfirm(type,item){deleteContext={type,item};document.getElementById("delete-modal-title").textContent=DELETE_LABELS[type];document.getElementById("delete-target-name").textContent=item.order?`${item.type}（並び順：${item.order}）`:item.type;showModal("delete-modal")}

document.getElementById("confirm-delete").addEventListener("click",async()=>{
  if(!deleteContext)return;
  const{type,item}=deleteContext;
  const action=DELETE_ACTIONS[type];
  const modalId=DELETE_MODALS[type];
  try{
    loadingMessage.textContent="削除しています…";
    await apiWrite(action,{id:item.id});
    hideModal("delete-modal");
    loadingMessage.textContent="";
    if(type==="daily"){
      hideModal(modalId);
      await loadDailyReports();
    }else if(type==="subrow"){
      await loadYearlyCategories();
      const{category,month}=subrowContext;
      const refreshedMonth=findMonth(month.key);
      subrowContext={category,month:refreshedMonth};
      resetSubrowForm();
      renderSubrowList();
    }else if(type==="generic"||type==="survey"){
      hideModal(modalId);
      await loadYearlyCategories();
    }else{
      hideModal(modalId);
      await loadAll();
    }
  }catch(err){
    hideModal("delete-modal");
    hideModal(modalId);
    loadingMessage.className="loading-message error";
    loadingMessage.textContent=`削除できません：${err.message}`;
  }
});

/* ===== 後発品調剤率（月1件） ===== */
function findMonth(monthKey){return monthsData.find(m=>m.key===monthKey)}

function renderGenericList(){
  const c=document.getElementById("generic-edit-list");c.textContent="";
  monthsData.forEach(month=>{
    const row=document.createElement("button");row.type="button";row.className="list-row";
    const main=document.createElement("div");main.className="list-main";
    const title=document.createElement("span");title.className="list-title";title.textContent=month.label;main.appendChild(title);
    const filled=!!month.generic;
    const detail=document.createElement("span");detail.className="list-detail";
    detail.textContent=filled?`カットオフ値割合：${text(month.generic["カットオフ値割合"])}%`:"未入力";
    main.appendChild(detail);
    const badge=document.createElement("span");badge.className=`badge ${filled?"green":"none"}`;badge.textContent=filled?"入力済み":"未入力";
    row.append(main,badge);
    row.addEventListener("click",()=>openGenericForm(month));
    c.appendChild(row);
  });
}

function openGenericForm(month){
  const g=month.generic;
  document.getElementById("generic-month-display").textContent=month.label;
  document.getElementById("generic-id").value=g?.id||"";
  document.getElementById("generic-month-key").value=month.key;
  document.getElementById("generic-all").value=g?.["全医薬品規格単位数量"]??"";
  document.getElementById("generic-eligible").value=g?.["後発品あり規格単位数量"]??"";
  document.getElementById("generic-generic").value=g?.["後発医薬品規格単位数量"]??"";
  document.getElementById("generic-new-rate").value=g?.["新指標割合"]??"";
  document.getElementById("generic-cutoff").value=g?.["カットオフ値割合"]??"";
  const btn=document.getElementById("generic-delete-button");
  btn.hidden=!g;
  btn.onclick=g?()=>openDeleteConfirm("generic",{id:g.id,type:month.label}):null;
  showModal("generic-modal");
}

document.getElementById("generic-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const monthKey=document.getElementById("generic-month-key").value;
  const month=findMonth(monthKey);
  const numOrEmpty=id=>{const v=document.getElementById(id).value;return v===""?"":Number(v)};
  const payload={id:document.getElementById("generic-id").value,monthKey,row:{
    "対象月":month.label,
    "全医薬品規格単位数量":numOrEmpty("generic-all"),
    "後発品あり規格単位数量":numOrEmpty("generic-eligible"),
    "後発医薬品規格単位数量":numOrEmpty("generic-generic"),
    "新指標割合":numOrEmpty("generic-new-rate"),
    "カットオフ値割合":numOrEmpty("generic-cutoff")
  }};
  try{
    loadingMessage.textContent="保存しています…";
    await apiWrite("saveGenericRateRow",payload);
    hideModal("generic-modal");
    loadingMessage.textContent="";
    await loadYearlyCategories();
  }catch(err){
    hideModal("generic-modal");
    loadingMessage.className="loading-message error";
    loadingMessage.textContent=`保存できません：${err.message}`;
  }
});

/* ===== 処方箋集中率・保険調剤実績・在宅（月に複数明細） ===== */
const CATEGORY_LABELS={concentration:"処方箋集中率",insurance:"保険調剤実績",homecare:"在宅患者への薬学的管理"};
const CATEGORY_FIELDS={
  concentration:{titleProp:"医療機関名",titleLabel:"医療機関名",numberFields:[{name:"受付回数",label:"受付回数"},{name:"全体割合",label:"全体割合（%）"}]},
  insurance:{titleProp:"区分",titleLabel:"区分",numberFields:[{name:"件数（件）",label:"件数（件）"},{name:"処方箋回数_医科",label:"処方箋回数_医科"},{name:"処方箋回数_歯科",label:"処方箋回数_歯科"},{name:"処方箋回数_合計",label:"処方箋回数_合計"},{name:"調剤報酬点数_合計",label:"調剤報酬点数_合計"}]},
  homecare:{titleProp:"区分",titleLabel:"区分",numberFields:[{name:"件数（件）",label:"件数（件）"},{name:"回数（回）",label:"回数（回）"}]}
};

function renderSubCategoryList(category){
  const c=document.getElementById(`${category}-edit-list`);c.textContent="";
  monthsData.forEach(month=>{
    const rows=month[category]||[];
    const row=document.createElement("button");row.type="button";row.className="list-row";
    const main=document.createElement("div");main.className="list-main";
    const title=document.createElement("span");title.className="list-title";title.textContent=month.label;main.appendChild(title);
    const detail=document.createElement("span");detail.className="list-detail";
    detail.textContent=rows.length?rows.map(r=>r[CATEGORY_FIELDS[category].titleProp]).filter(Boolean).join("、"):"未入力";
    main.appendChild(detail);
    const badge=document.createElement("span");badge.className=`badge ${rows.length?"green":"none"}`;badge.textContent=rows.length?`${rows.length}件`:"未入力";
    row.append(main,badge);
    row.addEventListener("click",()=>openSubrowMonth(category,month));
    c.appendChild(row);
  });
}

function resetSubrowForm(){
  document.getElementById("subrow-id").value="";
  document.getElementById("subrow-title").value="";
  document.querySelectorAll("#subrow-number-fields input").forEach(i=>i.value="");
  document.getElementById("subrow-delete-button").hidden=true;
  document.getElementById("subrow-delete-button").onclick=null;
}

function buildSubrowNumberFields(category){
  const container=document.getElementById("subrow-number-fields");
  container.innerHTML="";
  CATEGORY_FIELDS[category].numberFields.forEach(f=>{
    const label=document.createElement("label");
    label.textContent=f.label;
    const input=document.createElement("input");
    input.type="number";input.step="any";input.dataset.field=f.name;
    label.appendChild(input);
    container.appendChild(label);
  });
}

function renderSubrowList(){
  const{category,month}=subrowContext;
  const config=CATEGORY_FIELDS[category];
  const c=document.getElementById("subrow-list");c.textContent="";
  const rows=month[category]||[];
  if(!rows.length){c.innerHTML='<p class="empty-message">この月の明細はまだありません。</p>';return}
  rows.forEach(r=>{
    const row=document.createElement("button");row.type="button";row.className="list-row";
    const main=document.createElement("div");main.className="list-main";
    const title=document.createElement("span");title.className="list-title";title.textContent=text(r[config.titleProp],"名称未設定");main.appendChild(title);
    const detail=document.createElement("span");detail.className="list-detail";
    detail.textContent=config.numberFields.map(f=>`${f.label}：${text(r[f.name])}`).join(" ／ ");
    main.appendChild(detail);
    row.appendChild(main);
    row.addEventListener("click",()=>{
      document.getElementById("subrow-id").value=r.id;
      document.getElementById("subrow-title").value=r[config.titleProp]||"";
      document.querySelectorAll("#subrow-number-fields input").forEach(i=>{i.value=r[i.dataset.field]??""});
      const btn=document.getElementById("subrow-delete-button");
      btn.hidden=false;
      btn.onclick=()=>openDeleteConfirm("subrow",{id:r.id,type:r[config.titleProp]||"この明細"});
    });
    c.appendChild(row);
  });
}

function openSubrowMonth(category,month){
  subrowContext={category,month};
  document.getElementById("subrow-modal-title").textContent=CATEGORY_LABELS[category];
  document.getElementById("subrow-month-display").textContent=month.label;
  document.getElementById("subrow-title-label").firstChild.textContent=CATEGORY_FIELDS[category].titleLabel+" ";
  buildSubrowNumberFields(category);
  resetSubrowForm();
  renderSubrowList();
  showModal("subrow-modal");
}

document.getElementById("subrow-cancel-button").addEventListener("click",resetSubrowForm);

document.getElementById("subrow-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const{category,month}=subrowContext;
  const config=CATEGORY_FIELDS[category];
  const row={[config.titleProp]:document.getElementById("subrow-title").value.trim()};
  document.querySelectorAll("#subrow-number-fields input").forEach(i=>{
    row[i.dataset.field]=i.value===""?"":Number(i.value);
  });
  const payload={id:document.getElementById("subrow-id").value,category,monthKey:month.key,row};
  try{
    loadingMessage.textContent="保存しています…";
    await apiWrite("saveMonthlyCategoryRow",payload);
    loadingMessage.textContent="";
    await loadYearlyCategories();
    const refreshedMonth=findMonth(month.key);
    subrowContext={category,month:refreshedMonth};
    resetSubrowForm();
    renderSubrowList();
  }catch(err){
    loadingMessage.className="loading-message error";
    loadingMessage.textContent=`保存できません：${err.message}`;
  }
});

/* ===== 処方箋調べ（月1件・自動計算） ===== */
function renderSurveyList(){
  const c=document.getElementById("survey-edit-list");c.textContent="";
  monthsData.forEach(month=>{
    const s=month.survey;
    const row=document.createElement("button");row.type="button";row.className="list-row";
    const main=document.createElement("div");main.className="list-main";
    const title=document.createElement("span");title.className="list-title";title.textContent=month.label;main.appendChild(title);
    const filled=s&&s["処方箋受付回数"]!==null&&s["処方箋受付回数"]!==undefined&&s["処方箋受付回数"]!=="";
    const detail=document.createElement("span");detail.className="list-detail";
    detail.textContent=filled?`合計：${text(s["合計（処方箋受付枚数）"])} ／ 1日平均：${text(s["1日平均取扱処方箋枚数"])}`:"未入力";
    main.appendChild(detail);
    const badge=document.createElement("span");badge.className=`badge ${filled?"green":"none"}`;badge.textContent=filled?"入力済み":"未入力";
    row.append(main,badge);
    row.addEventListener("click",()=>openSurveyForm(month));
    c.appendChild(row);
  });
}

function updateSurveyTotalPreview(){
  const v=id=>Number(document.getElementById(id).value)||0;
  const total=v("survey-dental")+v("survey-ophthalmology")+v("survey-ent")+v("survey-other");
  document.getElementById("survey-total-preview").textContent=total;
}

function openSurveyForm(month){
  const s=month.survey;
  document.getElementById("survey-month-display").textContent=month.label;
  document.getElementById("survey-id").value=s?.id||"";
  document.getElementById("survey-month-key").value=month.key;
  document.getElementById("survey-count").value=s?.["処方箋受付回数"]??"";
  document.getElementById("survey-dental").value=s?.["歯科（処方箋受付枚数）"]??"";
  document.getElementById("survey-ophthalmology").value=s?.["眼科（処方箋受付枚数）"]??"";
  document.getElementById("survey-ent").value=s?.["耳鼻咽喉科（処方箋受付枚数）"]??"";
  document.getElementById("survey-other").value=s?.["その他（処方箋受付枚数）"]??"";
  updateSurveyTotalPreview();
  const btn=document.getElementById("survey-delete-button");
  btn.hidden=!s;
  btn.onclick=s?()=>openDeleteConfirm("survey",{id:s.id,type:month.label}):null;
  showModal("survey-modal");
}

["survey-dental","survey-ophthalmology","survey-ent","survey-other"].forEach(id=>document.getElementById(id).addEventListener("input",updateSurveyTotalPreview));

document.getElementById("survey-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const monthKey=document.getElementById("survey-month-key").value;
  const month=findMonth(monthKey);
  const numOrEmpty=id=>{const v=document.getElementById(id).value;return v===""?"":Number(v)};
  const payload={id:document.getElementById("survey-id").value,row:{
    "年月":month.label,
    "処方箋受付回数":numOrEmpty("survey-count"),
    "歯科（処方箋受付枚数）":numOrEmpty("survey-dental"),
    "眼科（処方箋受付枚数）":numOrEmpty("survey-ophthalmology"),
    "耳鼻咽喉科（処方箋受付枚数）":numOrEmpty("survey-ent"),
    "その他（処方箋受付枚数）":numOrEmpty("survey-other")
  }};
  try{
    loadingMessage.textContent="保存しています…";
    await apiWrite("saveStatusSurveyRow",payload);
    hideModal("survey-modal");
    loadingMessage.textContent="";
    await loadYearlyCategories();
  }catch(err){
    hideModal("survey-modal");
    loadingMessage.className="loading-message error";
    loadingMessage.textContent=`保存できません：${err.message}`;
  }
});

async function loadYearlyCategories(){
  try{
    const response=await fetch(`${GAS_URL}?action=yearlyPerformance&_=${Date.now()}`),result=await response.json();
    if(!result.success)throw new Error(result.message||"読み込みに失敗しました。");
    monthsData=result.months||[];
    renderGenericList();
    renderSubCategoryList("concentration");
    renderSubCategoryList("insurance");
    renderSubCategoryList("homecare");
    renderSurveyList();
  }catch(e){
    ["generic-edit-list","concentration-edit-list","insurance-edit-list","homecare-edit-list","survey-edit-list"].forEach(id=>{
      document.getElementById(id).innerHTML='<p class="empty-message">読み込みに失敗しました。</p>';
    });
  }
}

/* ===== 読み込み ===== */
async function loadAll(){loadingMessage.className="loading-message";loadingMessage.textContent="データを読み込んでいます…";try{const response=await fetch(`${GAS_URL}?action=status&_=${Date.now()}`),result=await response.json();if(!result.success)throw new Error(result.message||"読み込みに失敗しました。");const data=result.data||result;notices=(data.notices||[]).map(normalizeNotice);licenses=(data.licenses||[]).map(normalizeLicense);pharmacists=(data.pharmacists||[]).map(normalizePharmacist);sellers=(data.registeredSellers||[]).map(normalizeSeller);institutions=(data.testInstitutions||[]).map(normalizeInstitution);renderNoticeList();renderLicenseList();renderPharmacistList();renderSellerList();renderInstitutionList();populateBasicForm(data.basicInfo);loadingMessage.textContent=""}catch(e){loadingMessage.className="loading-message error";loadingMessage.textContent="現在、データを読み込めません。GAS連携を確認してください。"}}

document.getElementById("reload-button").addEventListener("click",loadAll);
document.getElementById("add-notice-button").addEventListener("click",()=>openNoticeForm(null));
document.getElementById("add-license-button").addEventListener("click",()=>openLicenseForm(null));
document.getElementById("add-pharmacist-button").addEventListener("click",()=>openPharmacistForm(null));
document.getElementById("add-seller-button").addEventListener("click",()=>openSellerForm(null));
document.getElementById("add-institution-button").addEventListener("click",()=>openInstitutionForm(null));
document.querySelectorAll("[data-close-modal]").forEach(x=>x.addEventListener("click",hideAllEditModals));
document.querySelectorAll("[data-close-delete]").forEach(x=>x.addEventListener("click",()=>hideModal("delete-modal")));
function activateTab(tab){document.querySelectorAll(".edit-tab").forEach(x=>x.classList.remove("active"));tab.classList.add("active");document.querySelectorAll(".edit-section").forEach(s=>s.hidden=true);document.getElementById(tab.dataset.target).hidden=false}
document.querySelectorAll(".edit-tab").forEach(t=>t.addEventListener("click",()=>activateTab(t)));

function showGroup(group){
  document.getElementById("group-select").hidden=true;
  document.getElementById("group-back-button").hidden=false;
  document.querySelector(".edit-tabs").hidden=false;
  const tabs=[...document.querySelectorAll(".edit-tab")];
  const groupTabs=tabs.filter(t=>t.dataset.group===group);
  tabs.forEach(t=>t.hidden=t.dataset.group!==group);
  activateTab(groupTabs[0]);
}
document.querySelectorAll(".group-card").forEach(c=>c.addEventListener("click",()=>showGroup(c.dataset.group)));
document.getElementById("group-back-button").addEventListener("click",()=>{
  document.getElementById("group-select").hidden=false;
  document.getElementById("group-back-button").hidden=true;
  document.querySelector(".edit-tabs").hidden=true;
  document.querySelectorAll(".edit-section").forEach(s=>s.hidden=true);
});

const hashTab=document.querySelector(`.edit-tab[data-hash="${location.hash.slice(1)}"]`);
if(hashTab){showGroup(hashTab.dataset.group);activateTab(hashTab);}

loadAll();
loadDailyReports();
loadYearlyCategories();

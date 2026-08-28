"use strict";

const GAS_URL="https://script.google.com/macros/s/AKfycbzS1F43nO_ZDG6X6gH4qfUeprWmFFOZuthQKjbXxuxkoTWY0QMvbAfURd2speGZEa6x/exec";
const loadingMessage=document.getElementById("edit-loading");
let notices=[]; let licenses=[]; let deleteContext=null;
const text=(v,f="―")=>v===null||v===undefined||v===""?f:String(v);
const pick=(obj,keys,f="")=>{for(const k of keys){if(obj&&obj[k]!==undefined&&obj[k]!==null&&obj[k]!=="")return obj[k]}return f};
function formatDate(v){if(!v)return"—";if(typeof v==="object"&&v!==null)v=v.start||"";if(!v)return"—";const s=String(v).slice(0,10);return/^\d{4}-\d{2}-\d{2}$/.test(s)?s.replaceAll("-","/"):s}

const MODAL_IDS=["notice-modal","license-modal","delete-modal"];
function showModal(id){document.getElementById(id).hidden=false;document.body.style.overflow="hidden"}
function hideModal(id){document.getElementById(id).hidden=true;if(MODAL_IDS.every(m=>document.getElementById(m).hidden))document.body.style.overflow=""}

async function apiWrite(action,payload){const r=await fetch(GAS_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,...payload})});const j=await r.json();if(!j.success)throw new Error(j.message||"保存に失敗しました。");return j}

/* ===== 各種届出 ===== */
function normalizeNotice(raw,index){const type=pick(raw,["届出種別","name","title"],"名称未設定");const condition=pick(raw,["有効期限"],"");const dateRaw=pick(raw,["指定年月日"],"");const date=typeof dateRaw==="object"&&dateRaw!==null?(dateRaw.start||""):dateRaw;const number=pick(raw,["指定番号・備考"],"");const order=Number(pick(raw,["並び順"],index+1))||index+1;const acquisition=pick(raw,["取得状況"],"取得済み");const id=pick(raw,["id"],"");return{raw,id,type,condition,date,number,order,acquisition}}

function renderNoticeList(){const c=document.getElementById("notice-edit-list");c.textContent="";if(!notices.length){c.innerHTML='<p class="empty-message">届出データはありません。</p>';return}notices.slice().sort((a,b)=>a.order-b.order).forEach(n=>{const row=document.createElement("button");row.type="button";row.className="list-row";const main=document.createElement("div");main.className="list-main";const title=document.createElement("span");title.className="list-title";title.textContent=`#${n.order}　${n.type}`;main.appendChild(title);const detail=document.createElement("span");detail.className="list-detail";detail.textContent=`有効期限：${formatDate(n.date)} ／ 指定番号：${text(n.number)}`;main.appendChild(detail);const badge=document.createElement("span");badge.className=`badge ${n.acquisition==="取得済み"?"green":"none"}`;badge.textContent=n.acquisition;row.append(main,badge);row.addEventListener("click",()=>openNoticeForm(n));c.appendChild(row)})}

function openNoticeForm(n){document.getElementById("notice-modal-title").textContent=n?"届出を編集":"新規届出を追加";document.getElementById("notice-id").value=n?.id||"";document.getElementById("notice-type").value=n?.type||"";document.getElementById("notice-acquisition").value=n?.acquisition||"取得済み";document.getElementById("notice-deadline").value=n?.condition||"";document.getElementById("notice-date").value=n?.date?String(n.date).slice(0,10):"";document.getElementById("notice-number").value=n?.number||"";document.getElementById("notice-order").value=n?.order||((notices.at(-1)?.order||0)+1);document.getElementById("notice-delete-button").hidden=!n;const btn=document.getElementById("notice-delete-button");btn.onclick=n?()=>openDeleteConfirm("notice",n):null;showModal("notice-modal")}

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

/* ===== 削除確認（共通） ===== */
function openDeleteConfirm(type,item){deleteContext={type,item};document.getElementById("delete-modal-title").textContent=type==="notice"?"この届出を削除しますか？":"この許可・登録を削除しますか？";document.getElementById("delete-target-name").textContent=`${item.type}（並び順：${item.order}）`;showModal("delete-modal")}

document.getElementById("confirm-delete").addEventListener("click",async()=>{
  if(!deleteContext)return;
  const{type,item}=deleteContext;
  const action=type==="notice"?"deleteStatusNotice":"deleteStatusLicense";
  const modalId=type==="notice"?"notice-modal":"license-modal";
  try{
    loadingMessage.textContent="削除しています…";
    await apiWrite(action,{id:item.id});
    hideModal("delete-modal");
    hideModal(modalId);
    await loadAll();
  }catch(err){
    hideModal("delete-modal");
    hideModal(modalId);
    loadingMessage.className="loading-message error";
    loadingMessage.textContent=`削除できません：${err.message}`;
  }
});

/* ===== 読み込み ===== */
async function loadAll(){loadingMessage.className="loading-message";loadingMessage.textContent="データを読み込んでいます…";try{const response=await fetch(`${GAS_URL}?action=status&_=${Date.now()}`),result=await response.json();if(!result.success)throw new Error(result.message||"読み込みに失敗しました。");const data=result.data||result;notices=(data.notices||[]).map(normalizeNotice);licenses=(data.licenses||[]).map(normalizeLicense);renderNoticeList();renderLicenseList();loadingMessage.textContent=""}catch(e){loadingMessage.className="loading-message error";loadingMessage.textContent="現在、データを読み込めません。GAS連携を確認してください。"}}

document.getElementById("reload-button").addEventListener("click",loadAll);
document.getElementById("add-notice-button").addEventListener("click",()=>openNoticeForm(null));
document.getElementById("add-license-button").addEventListener("click",()=>openLicenseForm(null));
document.querySelectorAll("[data-close-modal]").forEach(x=>x.addEventListener("click",()=>{hideModal("notice-modal");hideModal("license-modal")}));
document.querySelectorAll("[data-close-delete]").forEach(x=>x.addEventListener("click",()=>hideModal("delete-modal")));
document.querySelectorAll(".edit-tab").forEach(t=>t.addEventListener("click",()=>{document.querySelectorAll(".edit-tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");document.querySelectorAll(".edit-section").forEach(s=>s.hidden=true);document.getElementById(t.dataset.target).hidden=false}));

loadAll();

"use strict";

const GAS_URL="https://script.google.com/macros/s/AKfycbzS1F43nO_ZDG6X6gH4qfUeprWmFFOZuthQKjbXxuxkoTWY0QMvbAfURd2speGZEa6x/exec";
const loadingMessage=document.getElementById("edit-loading");
let notices=[]; let selectedNotice=null;
const text=(v,f="―")=>v===null||v===undefined||v===""?f:String(v);
const pick=(obj,keys,f="")=>{for(const k of keys){if(obj&&obj[k]!==undefined&&obj[k]!==null&&obj[k]!=="")return obj[k]}return f};
function formatDate(v){if(!v)return"—";if(typeof v==="object"&&v!==null)v=v.start||"";if(!v)return"—";const s=String(v).slice(0,10);return/^\d{4}-\d{2}-\d{2}$/.test(s)?s.replaceAll("-","/"):s}

function normalizeNotice(raw,index){const type=pick(raw,["届出種別","name","title"],"名称未設定");const condition=pick(raw,["有効期限"],"");const dateRaw=pick(raw,["指定年月日"],"");const date=typeof dateRaw==="object"&&dateRaw!==null?(dateRaw.start||""):dateRaw;const number=pick(raw,["指定番号・備考"],"");const order=Number(pick(raw,["並び順"],index+1))||index+1;const acquisition=pick(raw,["取得状況"],"取得済み");const id=pick(raw,["id"],"");return{raw,id,type,condition,date,number,order,acquisition}}

function renderNoticeList(){const c=document.getElementById("notice-edit-list");c.textContent="";if(!notices.length){c.innerHTML='<p class="empty-message">届出データはありません。</p>';return}notices.slice().sort((a,b)=>a.order-b.order).forEach(n=>{const row=document.createElement("button");row.type="button";row.className="list-row";const main=document.createElement("div");main.className="list-main";const title=document.createElement("span");title.className="list-title";title.textContent=`#${n.order}　${n.type}`;main.appendChild(title);const detail=document.createElement("span");detail.className="list-detail";detail.textContent=`有効期限：${formatDate(n.date)} ／ 指定番号：${text(n.number)}`;main.appendChild(detail);const badge=document.createElement("span");badge.className=`badge ${n.acquisition==="取得済み"?"green":"none"}`;badge.textContent=n.acquisition;row.append(main,badge);row.addEventListener("click",()=>openNoticeForm(n));c.appendChild(row)})}

function openNoticeForm(n){selectedNotice=n||null;document.getElementById("notice-modal-title").textContent=n?"届出を編集":"新規届出を追加";document.getElementById("notice-id").value=n?.id||"";document.getElementById("notice-type").value=n?.type||"";document.getElementById("notice-acquisition").value=n?.acquisition||"取得済み";document.getElementById("notice-deadline").value=n?.condition||"";document.getElementById("notice-date").value=n?.date?String(n.date).slice(0,10):"";document.getElementById("notice-number").value=n?.number||"";document.getElementById("notice-order").value=n?.order||((notices.at(-1)?.order||0)+1);document.getElementById("notice-delete-button").hidden=!n;showModal("notice-modal")}
function openDeleteConfirm(n){selectedNotice=n;document.getElementById("delete-target-name").textContent=`${n.type}（並び順：${n.order}）`;showModal("delete-modal")}
function showModal(id){document.getElementById(id).hidden=false;document.body.style.overflow="hidden"}
function hideModal(id){document.getElementById(id).hidden=true;if(document.getElementById("notice-modal").hidden&&document.getElementById("delete-modal").hidden)document.body.style.overflow=""}

async function apiWrite(action,payload){const r=await fetch(GAS_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,...payload})});const j=await r.json();if(!j.success)throw new Error(j.message||"保存に失敗しました。");return j}

async function loadNotices(){loadingMessage.className="loading-message";loadingMessage.textContent="データを読み込んでいます…";try{const response=await fetch(`${GAS_URL}?action=status&_=${Date.now()}`),result=await response.json();if(!result.success)throw new Error(result.message||"読み込みに失敗しました。");const data=result.data||result;notices=(data.notices||[]).map(normalizeNotice);renderNoticeList();loadingMessage.textContent=""}catch(e){loadingMessage.className="loading-message error";loadingMessage.textContent="現在、データを読み込めません。GAS連携を確認してください。"}}

document.getElementById("reload-button").addEventListener("click",loadNotices);
document.getElementById("add-notice-button").addEventListener("click",()=>openNoticeForm(null));
document.getElementById("notice-delete-button").addEventListener("click",()=>{if(selectedNotice)openDeleteConfirm(selectedNotice)});
document.querySelectorAll("[data-close-modal]").forEach(x=>x.addEventListener("click",()=>hideModal("notice-modal")));
document.querySelectorAll("[data-close-delete]").forEach(x=>x.addEventListener("click",()=>hideModal("delete-modal")));
document.querySelectorAll(".edit-tab").forEach(t=>t.addEventListener("click",()=>{document.querySelectorAll(".edit-tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");document.querySelectorAll(".edit-section").forEach(s=>s.hidden=true);document.getElementById(t.dataset.target).hidden=false}));

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
    await loadNotices();
  }catch(err){
    hideModal("notice-modal");
    loadingMessage.className="loading-message error";
    loadingMessage.textContent=`保存できません：${err.message}`;
  }
});

document.getElementById("confirm-delete").addEventListener("click",async()=>{
  if(!selectedNotice)return;
  try{
    loadingMessage.textContent="削除しています…";
    await apiWrite("deleteStatusNotice",{id:selectedNotice.id});
    hideModal("delete-modal");
    hideModal("notice-modal");
    await loadNotices();
  }catch(err){
    hideModal("delete-modal");
    hideModal("notice-modal");
    loadingMessage.className="loading-message error";
    loadingMessage.textContent=`削除できません：${err.message}`;
  }
});

loadNotices();

"use strict";

const GAS_URL = "https://script.google.com/macros/s/AKfycbzS1F43nO_ZDG6X6gH4qfUeprWmFFOZuthQKjbXxuxkoTWY0QMvbAfURd2speGZEa6x/exec";
const loadingMessage = document.getElementById("status-loading");

function text(value, fallback = "―") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function setBasicInfo(info = {}) {
  document.getElementById("basic-name").textContent = text(info.name || info["薬局・店舗販売業の名称"]);
  document.getElementById("basic-owner").textContent = text(info.owner || info["開設者氏名(又は代表者)"]);
  document.getElementById("basic-manager").textContent = text(info.manager || info["管理者氏名"]);
  document.getElementById("basic-address").textContent = text(info.address || info["所在地"]);
  document.getElementById("basic-hours").textContent = text(info.openingHours || info["開局時間"]);
}

function statusClass(item) {
  if (item.status === "expired" || item.status === "red") return "red";
  if (item.status === "soon" || item.status === "orange") return "orange";
  if (item.status === "valid" || item.status === "green") return "green";
  return "gray";
}

function statusLabel(item) {
  if (item.statusLabel) return item.statusLabel;
  const kind = statusClass(item);
  return { red:"期限切れ", orange:"3ヶ月以内", green:"有効", gray:"期限未設定" }[kind];
}

function makeRow(item, deadline = false) {
  const row = document.createElement("div");
  const kind = statusClass(item);
  row.className = `list-row${deadline ? ` deadline-row ${kind}` : ""}`;
  const main = document.createElement("div");
  main.className = "list-main";
  const title = document.createElement("span");
  title.className = "list-title";
  title.textContent = text(item.title || item.type || item.name || item.種類, "名称未設定");
  main.appendChild(title);
  const details = [item.number || item.licenseNumber || item.許可番号, item.deadline || item.expiration || item.有効期限, item.remaining].filter(Boolean);
  if (details.length) {
    const detail = document.createElement("span");
    detail.className = "list-detail";
    detail.textContent = details.join(" ／ ");
    main.appendChild(detail);
  }
  const badge = document.createElement("span");
  badge.className = `badge ${kind}`;
  badge.textContent = statusLabel(item);
  row.append(main, badge);
  return row;
}

function renderList(id, items, options = {}) {
  const container = document.getElementById(id);
  container.textContent = "";
  if (!items || !items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = options.empty || "登録データはありません。";
    container.appendChild(empty);
    return;
  }
  items.slice(0, options.limit || items.length).forEach((item) => container.appendChild(makeRow(item, options.deadline)));
}

function setAllLink(id, url) {
  const link = document.getElementById(id);
  if (!url) return;
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.hidden = false;
}

function renderNames(id, names, emptyText) {
  const container = document.getElementById(id);
  container.textContent = "";
  if (!names || !names.length) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }
  names.forEach((name) => {
    const chip = document.createElement("div");
    chip.className = "name-chip";
    chip.textContent = typeof name === "string" ? name : text(name.name || name.氏名);
    container.appendChild(chip);
  });
}

function renderStatus(data) {
  setBasicInfo(data.basicInfo);
  renderList("deadline-alerts", data.alerts, { deadline:true, empty:"3ヶ月以内の更新期限はありません。" });
  renderList("license-list", data.licenses, { limit:6, empty:"許可・登録データはありません。" });
renderList("notice-list", data.notices, { empty:"届出データはありません。" });
  setAllLink("license-all-link", data.licenseDatabaseUrl);
  setAllLink("notice-all-link", data.noticeDatabaseUrl);

  const survey = data.prescriptionSurvey || {};
  const completed = Number(survey.completed || 0);
  const total = Number(survey.total || 13);
  document.getElementById("survey-count").textContent = `${completed}/${total}`;
  const surveyBadge = document.getElementById("survey-label");
  surveyBadge.textContent = completed >= total ? "入力済み" : `${total - completed}件 未入力`;
  surveyBadge.className = `badge ${completed >= total ? "green" : "orange"}`;

  const pharmacists = data.pharmacists || [];
  const featured = ["降旗敏文", "藤川律子", "金井佳美"].filter((name) => pharmacists.some((item) => (typeof item === "string" ? item : item.name || item.氏名) === name));
  const rest = Math.max(0, pharmacists.length - featured.length);
  if (rest) featured.push(`その他${rest}名`);
  renderNames("pharmacist-list", featured, "薬剤師の登録はありません。");
  renderNames("seller-list", data.registeredSellers, "在籍なし");
}

async function loadStatus() {
  loadingMessage.className = "loading-message";
  loadingMessage.textContent = "データを読み込んでいます…";
  try {
    const response = await fetch(`${GAS_URL}?action=status&_=${Date.now()}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || "読み込みに失敗しました。");
    renderStatus(result.data || result);
    loadingMessage.textContent = "";
  } catch (error) {
    loadingMessage.className = "loading-message error";
    loadingMessage.textContent = "現在、データを読み込めません。GAS連携の更新後に表示されます。";
    setBasicInfo();
    renderList("deadline-alerts", [], { empty:"GAS連携の更新後に表示されます。" });
    renderList("license-list", [], { empty:"GAS連携の更新後に表示されます。" });
    renderList("notice-list", [], { empty:"GAS連携の更新後に表示されます。" });
    renderNames("pharmacist-list", [], "GAS連携の更新後に表示されます。");
    renderNames("seller-list", [], "在籍なし");
  }
}

document.getElementById("reload-button").addEventListener("click", loadStatus);
loadStatus();

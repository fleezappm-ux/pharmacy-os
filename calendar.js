"use strict";

const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"];
const TYPE_CLASS = { "勉強会": "study", "当番医": "duty", "当番薬局": "duty", "その他": "other" };
const TYPE_LABEL_PLACE = { "勉強会": "場所", "当番医": "医療機関名", "当番薬局": "薬局名", "その他": "場所" };

let viewYear, viewMonth; // viewMonth: 1-12
let monthEvents = [];    // getCalendarEventsの結果（表示中の月＋前後の空白日を含む範囲）
let oneppoOccurrences = []; // 一包化の次回予定日を、擬似的な予定として保持
let activeFilter = "all";
let selectedDateStr = null;
let editingEvent = null; // 編集中の元イベント（保存/削除時に使用）

const monthLabel = document.getElementById("month-label");
const monthGrid = document.getElementById("month-grid");
const calendarLoading = document.getElementById("calendar-loading");
const dayDetail = document.getElementById("day-detail");
const dayDetailHeading = document.getElementById("day-detail-heading");
const dayDetailList = document.getElementById("day-detail-list");

function pad2(n) { return String(n).padStart(2, "0"); }
function dateStr(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }
function todayStr() {
  const t = new Date();
  return dateStr(t.getFullYear(), t.getMonth() + 1, t.getDate());
}
function formatJapaneseMonth(y, m) { return `${y}年${m}月`; }

document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  viewYear = today.getFullYear();
  viewMonth = today.getMonth() + 1;

  requireAuth(() => {
    loadMonth();
  });

  document.getElementById("reload-button").addEventListener("click", loadMonth);
  document.getElementById("prev-month-button").addEventListener("click", () => changeMonth(-1));
  document.getElementById("next-month-button").addEventListener("click", () => changeMonth(1));
  document.getElementById("today-button").addEventListener("click", () => {
    const t = new Date();
    viewYear = t.getFullYear();
    viewMonth = t.getMonth() + 1;
    loadMonth();
  });

  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.dataset.filter;
      if (activeFilter === "oneppo" && !oneppoOccurrences.length) {
        loadOneppoOccurrences().then(renderGrid);
      } else {
        renderGrid();
      }
    });
  });

  document.getElementById("add-event-fab").addEventListener("click", () => openEventModal(null, selectedDateStr || todayStr()));
  document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.currentTarget.closest(".modal").hidden = true;
    });
  });

  document.getElementById("event-allday").addEventListener("change", updateTimeFieldsVisibility);
  document.getElementById("event-has-prep").addEventListener("change", updatePrepFieldsVisibility);
  document.getElementById("event-repeat").addEventListener("change", updateRepeatFieldsVisibility);
  document.getElementById("event-type").addEventListener("change", updateTypeFieldsVisibility);
  document.getElementById("save-event-button").addEventListener("click", handleSaveEvent);
  document.getElementById("delete-event-button").addEventListener("click", handleDeleteEvent);
});

function changeMonth(diff) {
  viewMonth += diff;
  if (viewMonth < 1) { viewMonth = 12; viewYear -= 1; }
  if (viewMonth > 12) { viewMonth = 1; viewYear += 1; }
  loadMonth();
}

/** カレンダーグリッドは月をまたいで前後の空白日も表示するため、その範囲を計算します。 */
function getGridRange(year, month) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - firstOfMonth.getDay());
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - lastOfMonth.getDay()));
  return {
    start: dateStr(gridStart.getFullYear(), gridStart.getMonth() + 1, gridStart.getDate()),
    end: dateStr(gridEnd.getFullYear(), gridEnd.getMonth() + 1, gridEnd.getDate())
  };
}

async function loadMonth() {
  calendarLoading.hidden = false;
  calendarLoading.classList.remove("error");
  calendarLoading.textContent = "読み込んでいます…";
  monthLabel.textContent = formatJapaneseMonth(viewYear, viewMonth);
  dayDetail.hidden = true;
  selectedDateStr = null;

  try {
    const range = getGridRange(viewYear, viewMonth);
    const result = await authFetch("getCalendarEvents", { startDate: range.start, endDate: range.end });
    if (!result.success) throw new Error(result.message || "取得に失敗しました。");
    monthEvents = result.events || [];
    if (activeFilter === "oneppo") await loadOneppoOccurrences();
    calendarLoading.hidden = true;
    renderGrid();
  } catch (e) {
    console.error(e);
    calendarLoading.hidden = false;
    calendarLoading.classList.add("error");
    calendarLoading.textContent = "読み込みに失敗しました。しばらくしてから再読み込みしてください。";
  }
}

/** 一包化患者の「次回来局予定日」を、カレンダー表示用の擬似的な予定に変換します。 */
async function loadOneppoOccurrences() {
  try {
    const result = await authFetch("getOneppoPatients");
    if (!result.success) return;
    oneppoOccurrences = (result.patients || [])
      .filter((p) => p["状態"] === "継続中" && p["現在の予定状態"] === "未完了")
      .map((p) => {
        const manual = p["手動指定優先フラグ"] && p["手動指定の次回来局予定日"] && p["手動指定の次回来局予定日"].start;
        const auto = p["自動計算した次回来局予定日"] && p["自動計算した次回来局予定日"].start;
        const nextDate = manual || auto;
        if (!nextDate) return null;
        return {
          実施日: String(nextDate).slice(0, 10),
          予定名: `一包化：${p["カレンダー表示名"] || p["氏名（フルネーム）"] || ""}`,
          予定種別: "一包化",
          isOneppo: true,
          patientId: p.id
        };
      })
      .filter(Boolean);
  } catch (e) {
    console.error(e);
  }
}

function typeClassFor(event) {
  if (event.isOneppo) return "oneppo";
  return TYPE_CLASS[event.予定種別] || "other";
}

function passesFilter(event) {
  if (activeFilter === "all") return !event.isOneppo;
  if (activeFilter === "duty") return event.予定種別 === "当番医" || event.予定種別 === "当番薬局";
  if (activeFilter === "oneppo") return !!event.isOneppo;
  return event.予定種別 === activeFilter;
}

function renderGrid() {
  monthGrid.innerHTML = "";
  const range = getGridRange(viewYear, viewMonth);
  const [sy, sm, sd] = range.start.split("-").map(Number);
  const cursor = new Date(sy, sm - 1, sd);
  const today = todayStr();

  const eventsByDate = {};
  const allEvents = activeFilter === "oneppo" ? oneppoOccurrences : monthEvents;
  allEvents.filter(passesFilter).forEach((ev) => {
    if (!eventsByDate[ev.実施日]) eventsByDate[ev.実施日] = [];
    eventsByDate[ev.実施日].push(ev);
  });

  for (let i = 0; i < 42; i++) {
    const y = cursor.getFullYear(), m = cursor.getMonth() + 1, d = cursor.getDate();
    const cellDate = dateStr(y, m, d);
    const outside = m !== viewMonth;

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day-cell" + (outside ? " outside" : "") + (cellDate === today ? " today" : "") + (cellDate === selectedDateStr ? " selected" : "");
    cell.dataset.date = cellDate;

    const num = document.createElement("span");
    num.className = "day-number";
    num.textContent = d;
    cell.appendChild(num);

    const evWrap = document.createElement("div");
    evWrap.className = "day-events";
    const dayEvents = eventsByDate[cellDate] || [];
    dayEvents.slice(0, 3).forEach((ev) => {
      const chip = document.createElement("span");
      chip.className = "evt-chip " + typeClassFor(ev);
      chip.textContent = ev.予定名;
      evWrap.appendChild(chip);
    });
    if (dayEvents.length > 3) {
      const more = document.createElement("span");
      more.className = "day-more";
      more.textContent = `ほか${dayEvents.length - 3}件`;
      evWrap.appendChild(more);
    }
    cell.appendChild(evWrap);

    cell.addEventListener("click", () => selectDate(cellDate, dayEvents));
    monthGrid.appendChild(cell);

    cursor.setDate(cursor.getDate() + 1);
  }
}

function selectDate(dateStrValue, dayEvents) {
  selectedDateStr = dateStrValue;
  renderGrid();

  dayDetail.hidden = false;
  const [y, m, d] = dateStrValue.split("-").map(Number);
  dayDetailHeading.textContent = `${y}年${m}月${d}日（${WEEKDAY_JP[new Date(y, m - 1, d).getDay()]}）`;
  dayDetailList.innerHTML = "";

  if (!dayEvents.length) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = "この日の予定はありません。";
    dayDetailList.appendChild(empty);
    return;
  }

  dayEvents.forEach((ev) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "event-row";
    const dot = document.createElement("span");
    dot.className = "dot " + typeClassFor(ev);
    const main = document.createElement("div");
    main.className = "event-main";
    const title = document.createElement("p");
    title.className = "event-title";
    title.textContent = ev.予定名;
    const sub = document.createElement("p");
    sub.className = "event-sub";
    sub.textContent = ev.isOneppo ? "一包化サポート（一包化管理画面で操作します）" : buildEventSubText(ev);
    main.appendChild(title);
    main.appendChild(sub);
    row.appendChild(dot);
    row.appendChild(main);
    row.addEventListener("click", () => {
      if (ev.isOneppo) { location.href = "oneppo.html"; return; }
      openEventModal(ev, ev.実施日);
    });
    dayDetailList.appendChild(row);
  });
}

function buildEventSubText(ev) {
  const parts = [];
  if (ev.終日) parts.push("終日");
  else if (ev.開始時刻 || ev.終了時刻) parts.push(`${ev.開始時刻 || ""}〜${ev.終了時刻 || ""}`);
  if (ev["場所・機関名"]) parts.push(ev["場所・機関名"]);
  return parts.join(" ・ ");
}

/* ============================================================
 * 予定の追加・編集モーダル
 * ============================================================ */

function updateTimeFieldsVisibility() {
  document.getElementById("event-time-fields").hidden = document.getElementById("event-allday").checked;
}
function updatePrepFieldsVisibility() {
  document.getElementById("event-prep-fields").hidden = !document.getElementById("event-has-prep").checked;
}
function updateRepeatFieldsVisibility() {
  document.getElementById("event-repeat-end-field").hidden = document.getElementById("event-repeat").value === "なし";
}
function updateTypeFieldsVisibility() {
  const type = document.getElementById("event-type").value;
  document.getElementById("event-place-label").textContent = TYPE_LABEL_PLACE[type] || "場所・機関名";
  document.getElementById("event-phone-field").hidden = !(type === "当番医" || type === "当番薬局");
  document.getElementById("event-people-field").hidden = !(type === "勉強会" || type === "その他");
  document.getElementById("event-people-label").textContent = type === "勉強会" ? "参加者" : "関係者";
}

function openEventModal(event, defaultDate) {
  editingEvent = event;
  const modal = document.getElementById("event-modal");
  document.getElementById("event-modal-title").textContent = event ? "予定を編集" : "予定を追加";
  document.getElementById("event-form-status").textContent = "";
  document.getElementById("delete-event-button").hidden = !event;

  document.getElementById("event-type").value = (event && event.予定種別) || "勉強会";
  document.getElementById("event-title").value = (event && event.予定名) || "";
  document.getElementById("event-date").value = (event && event.実施日) || defaultDate || todayStr();
  document.getElementById("event-allday").checked = !!(event && event.終日);
  document.getElementById("event-start-time").value = (event && event.開始時刻) || "";
  document.getElementById("event-end-time").value = (event && event.終了時刻) || "";
  document.getElementById("event-place").value = (event && event["場所・機関名"]) || "";
  document.getElementById("event-phone").value = (event && event.電話番号) || "";
  document.getElementById("event-people").value = (event && event["参加者・関係者"]) || "";
  document.getElementById("event-note").value = (event && event.備考) || "";
  document.getElementById("event-has-prep").checked = !!(event && event.準備期間あり);
  document.getElementById("event-prep-start").value = 0;
  document.getElementById("event-prep-end").value = 0;
  document.getElementById("event-repeat").value = "なし";
  document.getElementById("event-repeat-end").value = "";

  updateTypeFieldsVisibility();
  updateTimeFieldsVisibility();
  updatePrepFieldsVisibility();
  updateRepeatFieldsVisibility();

  modal.hidden = false;
}

/** 準備開始・終了の相対日数から、単発予定用の絶対日付も一緒に計算します。 */
function computeAbsoluteDate(baseDateStr, daysBefore) {
  const [y, m, d] = baseDateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - Number(daysBefore || 0));
  return dateStr(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

function collectEventFormData() {
  const date = document.getElementById("event-date").value;
  const allDay = document.getElementById("event-allday").checked;
  const hasPrep = document.getElementById("event-has-prep").checked;
  const prepStartDays = Number(document.getElementById("event-prep-start").value || 0);
  const prepEndDays = Number(document.getElementById("event-prep-end").value || 0);

  return {
    "予定名": document.getElementById("event-title").value.trim(),
    "予定種別": document.getElementById("event-type").value,
    "実施日": date,
    "終日": allDay,
    "開始時刻": allDay ? "" : document.getElementById("event-start-time").value,
    "終了時刻": allDay ? "" : document.getElementById("event-end-time").value,
    "場所・機関名": document.getElementById("event-place").value.trim(),
    "電話番号": document.getElementById("event-phone").value.trim(),
    "参加者・関係者": document.getElementById("event-people").value.trim(),
    "備考": document.getElementById("event-note").value.trim(),
    "準備期間あり": hasPrep,
    "準備開始日": hasPrep ? computeAbsoluteDate(date, prepStartDays) : "",
    "準備終了日": hasPrep ? computeAbsoluteDate(date, prepEndDays) : "",
    "準備開始相対日数": hasPrep ? -Math.abs(prepStartDays) : 0,
    "準備終了相対日数": hasPrep ? -Math.abs(prepEndDays) : 0,
    "繰り返し種別": document.getElementById("event-repeat").value,
    "繰り返し終了日": document.getElementById("event-repeat-end").value
  };
}

function askEditScope() {
  return new Promise((resolve) => {
    const modal = document.getElementById("scope-modal");
    modal.hidden = false;
    const buttons = modal.querySelectorAll("[data-scope]");
    const cleanup = () => {
      buttons.forEach((b) => b.replaceWith(b.cloneNode(true)));
      modal.hidden = true;
    };
    modal.querySelectorAll("[data-scope]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const scope = btn.dataset.scope;
        cleanup();
        resolve(scope);
      }, { once: true });
    });
    modal.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => { cleanup(); resolve(null); }, { once: true });
    });
  });
}

async function handleSaveEvent() {
  const statusEl = document.getElementById("event-form-status");
  const ev = collectEventFormData();
  if (!ev["予定名"]) { statusEl.textContent = "予定名を入力してください。"; return; }
  if (!ev["実施日"]) { statusEl.textContent = "実施日を入力してください。"; return; }

  const payload = { event: ev };
  if (editingEvent) {
    payload.id = editingEvent.ruleId;
    const isRecurring = (editingEvent.繰り返し種別 || "なし") !== "なし";
    if (isRecurring) {
      const scope = await askEditScope();
      if (!scope) return;
      payload.editScope = scope;
      if (scope !== "all") payload.targetDate = editingEvent.実施日;
    } else {
      payload.editScope = "all";
    }
  }

  statusEl.textContent = "保存しています…";
  try {
    const result = await authFetch("saveCalendarEvent", payload);
    if (!result.success) { statusEl.textContent = result.message || "保存に失敗しました。"; return; }
    document.getElementById("event-modal").hidden = true;
    await loadMonth();
  } catch (e) {
    console.error(e);
    statusEl.textContent = "通信エラーが発生しました。";
  }
}

async function handleDeleteEvent() {
  if (!editingEvent) return;
  const statusEl = document.getElementById("event-form-status");
  const payload = { id: editingEvent.ruleId };

  const isRecurring = (editingEvent.繰り返し種別 || "なし") !== "なし";
  if (isRecurring) {
    const scope = await askEditScope();
    if (!scope) return;
    payload.editScope = scope;
    if (scope !== "all") payload.targetDate = editingEvent.実施日;
  } else {
    if (!confirm("この予定を削除します。よろしいですか？")) return;
    payload.editScope = "all";
  }

  statusEl.textContent = "削除しています…";
  try {
    const result = await authFetch("deleteCalendarEvent", payload);
    if (!result.success) { statusEl.textContent = result.message || "削除に失敗しました。"; return; }
    document.getElementById("event-modal").hidden = true;
    await loadMonth();
  } catch (e) {
    console.error(e);
    statusEl.textContent = "通信エラーが発生しました。";
  }
}


"use strict";

const GAS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzS1F43nO_ZDG6X6gH4qfUeprWmFFOZuthQKjbXxuxkoTWY0QMvbAfURd2speGZEa6x/exec";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const DEFAULT_HOURS = {
  0: "休局",
  1: "8:45\n18:00",
  2: "8:45\n18:00",
  3: "8:45\n18:00",
  4: "8:30\n16:30",
  5: "8:45\n18:00",
  6: "8:30\n13:00",
};

const todayLabel = document.querySelector("#today-label");
const weekCalendar = document.querySelector("#week-calendar");
const handoverList = document.querySelector("#handover-list");
const averageLabel = document.querySelector("#average-label");
const averageValue = document.querySelector("#average-value");
const averageNote = document.querySelector("#average-note");
const genericRateValue = document.querySelector("#generic-rate-value");
const genericRateLabel = document.querySelector("#generic-rate-label");
const genericRateUnit = document.querySelector("#generic-rate-unit");
const monthlyHeading = document.querySelector("#monthly-heading");
const concentrationLabel = document.querySelector("#concentration-label");
const concentrationList = document.querySelector("#concentration-list");
const homeStatus = document.querySelector("#home-status");
const refreshButton = document.querySelector("#refresh-button");
const toast = document.querySelector("#toast");

function formatJapaneseDate(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function isSameDate(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function renderWeekCalendar() {
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);

  weekCalendar.replaceChildren();

  for (let index = 0; index < 7; index += 1) {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    const dayOfWeek = date.getDay();
    const card = document.createElement("div");
    card.className = "day-card";
    if (isSameDate(date, today)) card.classList.add("today");
    if (dayOfWeek === 0) card.classList.add("closed");

    const weekday = document.createElement("span");
    weekday.className = "weekday";
    weekday.textContent = WEEKDAY_LABELS[dayOfWeek];

    const day = document.createElement("span");
    day.className = "date";
    day.textContent = date.getDate();

    const hours = document.createElement("span");
    hours.className = "hours";
    hours.textContent = DEFAULT_HOURS[dayOfWeek];

    card.append(weekday, day, hours);
    weekCalendar.append(card);
  }
}

function formatShortDate(dateString) {
  if (!dateString) return "日付なし";
  const [year, month, day] = dateString.split("-").map(Number);
  return `${month}月${day}日`;
}

function renderHandovers(handovers) {
  handoverList.replaceChildren();

  if (!handovers.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state compact";
    empty.innerHTML = "<span aria-hidden=\"true\">✅</span><p>現在、申し送りはありません。</p>";
    handoverList.append(empty);
    return;
  }

  handovers.forEach((handover) => {
    const item = document.createElement("article");
    item.className = "handover-item";

    const date = document.createElement("p");
    date.className = "handover-date";
    date.textContent = formatShortDate(handover.date);

    const text = document.createElement("p");
    text.className = "handover-text";
    text.textContent = handover.text;

    item.append(date, text);
    handoverList.append(item);
  });
}

async function loadHomeData() {
  refreshButton.disabled = true;
  refreshButton.textContent = "…";
  homeStatus.textContent = "";

  try {
    const url = `${GAS_ENDPOINT}?action=home&t=${Date.now()}`;
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.success) throw new Error(data.message || "取得に失敗しました。");

    averageLabel.textContent = `${data.previousMonthLabel} 1日平均処方箋枚数`;
    averageValue.textContent = data.previousMonthAverage ?? "―";
    averageNote.textContent = data.previousMonthRecordedDays
      ? `${data.previousMonthRecordedDays}日分から算出`
      : "記録なし";
    const summaryMonthLabel = data.summaryMonthLabel || data.previousMonthLabel || "前月";
    const hasGeneric = data.genericRate !== null && data.genericRate !== undefined;
    monthlyHeading.textContent = `${summaryMonthLabel}の状況`;
    genericRateValue.textContent = hasGeneric ? data.genericRate : "未入力";
    genericRateUnit.hidden = !hasGeneric;
    genericRateLabel.textContent = `${summaryMonthLabel} 後発品使用率`;
    renderConcentration(data.concentrationTop4 || [], summaryMonthLabel);
    renderHandovers(data.handovers || []);
  } catch (error) {
    console.error("Home data error:", error);
    homeStatus.textContent = `最新情報を取得できませんでした：${error.message}`;
    renderHandovers([]);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "↻";
  }
}

function renderConcentration(entries, monthLabel) {
  concentrationLabel.textContent = monthLabel && monthLabel !== "未設定"
    ? `${monthLabel} 処方箋集中率 上位4医療機関`
    : "処方箋集中率 上位4医療機関";
  concentrationList.replaceChildren();
  if (!entries.length) {
    const item = document.createElement("li");
    item.textContent = "未入力";
    concentrationList.append(item);
    return;
  }
  entries.forEach((entry) => {
    const item = document.createElement("li");
    item.append(document.createTextNode(entry.medicalInstitution));
    const percentage = document.createElement("span");
    percentage.textContent = `${entry.percentage}%`;
    item.append(percentage);
    concentrationList.append(item);
  });
}

let toastTimer;
function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

document.querySelectorAll("[data-pending]").forEach((element) => {
  element.addEventListener("click", (event) => {
    event.preventDefault();
    showToast("この機能は準備中です。");
  });
});

const reminderModal = document.querySelector("#reminder-modal");
const reminderClose = document.querySelector("#reminder-close");
const reminderSnooze = document.querySelector("#reminder-snooze");
const reminderSummary = document.querySelector("#reminder-summary");
const reminderList = document.querySelector("#reminder-list");
const REMINDER_SNOOZE_KEY = "pharmacy-os-reminder-snoozed";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function closeReminder() {
  reminderModal.hidden = true;
}

function renderReminderStatus(data) {
  if (localStorage.getItem(REMINDER_SNOOZE_KEY) === localDateKey()) return;

  const missing = [];
  if (data.dailyMissing) {
    missing.push({ label: "本日の日次業務", href: "index.html" });
  }
  (data.monthlyMissing || []).forEach((item) => {
    missing.push({
      label: `${data.previousMonthLabel || "前月"} ${item.label}`,
      href: item.href,
    });
  });

  if (!missing.length) {
    closeReminder();
    return;
  }

  reminderSummary.textContent = `${missing.length}件の入力を確認してください。`;
  reminderList.replaceChildren();
  missing.forEach((item) => {
    const link = document.createElement("a");
    link.className = "reminder-link";
    link.href = item.href;
    link.textContent = item.label;
    reminderList.append(link);
  });
  reminderModal.hidden = false;
}

async function loadReminderStatus() {
  try {
    const response = await fetch(`${GAS_ENDPOINT}?action=reminders&t=${Date.now()}`, { redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || "未入力確認に失敗しました。");
    renderReminderStatus(data);
  } catch (error) {
    console.error("Reminder status error:", error);
  }
}

async function refreshHome() {
  await Promise.all([loadHomeData(), loadReminderStatus()]);
}

reminderClose.addEventListener("click", closeReminder);
reminderSnooze.addEventListener("click", () => {
  localStorage.setItem(REMINDER_SNOOZE_KEY, localDateKey());
  closeReminder();
});
reminderModal.addEventListener("click", (event) => {
  if (event.target === reminderModal) closeReminder();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !reminderModal.hidden) closeReminder();
});

todayLabel.textContent = formatJapaneseDate(new Date());
renderWeekCalendar();
refreshButton.addEventListener("click", refreshHome);
refreshHome();

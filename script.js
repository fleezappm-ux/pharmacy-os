/*
 * Pharmacy OS - 日次業務入力
 * GASのURLを変更する場合はGAS_ENDPOINTだけを書き換えてください。
 */

"use strict";

const GAS_ENDPOINT = PHARMACY_CONFIG.GAS_URL;

const DEFAULT_HOURS = {
  0: "休局",
  1: "08:45～18:00",
  2: "08:45～18:00",
  3: "08:45～18:00",
  4: "08:30～16:30",
  5: "08:45～18:00",
  6: "08:30～13:00",
};

const form = document.querySelector("#daily-form");
const dateInput = document.querySelector("#date");
const openingType = document.querySelector("#opening-type");
const openingSummary = document.querySelector("#opening-summary");
const submitButton = document.querySelector("#submit-button");
const statusMessage = document.querySelector("#status-message");

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayOfWeek(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

function getDefaultOpeningHours() {
  return DEFAULT_HOURS[getDayOfWeek(dateInput.value)] || "";
}

function updateOpeningFields() {
  const isCustom = openingType.value === "custom";
  const isClosed = openingType.value === "closed";
  const panel = document.querySelector("#custom-opening-fields");
  const start = document.querySelector("#opening-start");
  const end = document.querySelector("#opening-end");
  const prescriptionCount = document.querySelector("#prescription-count");

  panel.hidden = !isCustom;
  start.required = isCustom;
  end.required = isCustom;
  prescriptionCount.required = !isClosed;
  if (isClosed) prescriptionCount.value = prescriptionCount.value || "0";

  if (isClosed) {
    openingSummary.textContent = "この日は休業日として記録されます。";
  } else if (isCustom) {
    openingSummary.textContent = "開始・終了時刻を入力してください。";
  } else {
    openingSummary.textContent = `選択日の通常営業時間：${getDefaultOpeningHours()}`;
  }
}

let openingTypeTouched = false;
openingType.addEventListener("change", () => { openingTypeTouched = true; });

async function applyDefaultClosedState() {
  if (openingTypeTouched || !dateInput.value) return;
  try {
    const response = await fetch(
      `${GAS_ENDPOINT}?action=dayType&date=${dateInput.value}&idToken=${encodeURIComponent(getIdToken())}&t=${Date.now()}`
    );
    const data = await response.json();
    if (data.success && data.isDefaultClosed && openingType.value === "normal") {
      openingType.value = "closed";
      updateOpeningFields();
    }
  } catch (_) {
    // 判定できない場合は何もしない（通常営業時間のまま）。
  }
}

function setupConditionalSelect(selectId, panelId, requiredIds = []) {
  const select = document.querySelector(selectId);
  const panel = document.querySelector(panelId);

  function update() {
    const enabled = select.value === "yes";
    panel.hidden = !enabled;
    requiredIds.forEach((id) => {
      document.querySelector(id).required = enabled;
    });
  }

  select.addEventListener("change", update);
  update();
}

function showStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = "status-message";
  if (type) statusMessage.classList.add(`is-${type}`);
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "送信中…" : "Notionへ保存";
}

function formatRange(start, end) {
  return start && end ? `${start}～${end}` : "";
}

function createPayload(formData) {
  const isClosed = formData.get("openingType") === "closed";
  const openingHours = isClosed
    ? "休業日"
    : formData.get("openingType") === "custom"
      ? formatRange(formData.get("openingStart"), formData.get("openingEnd"))
      : getDefaultOpeningHours();

  const managerAbsence =
    formData.get("managerAbsenceEnabled") === "yes"
      ? formatRange(formData.get("managerStart"), formData.get("managerEnd"))
      : "";
  const managerResponder =
    formData.get("managerAbsenceEnabled") === "yes"
      ? formData.get("managerResponder").trim()
      : "";

  const pharmacistAbsence =
    formData.get("pharmacistAbsenceEnabled") === "yes"
      ? formatRange(
          formData.get("pharmacistStart"),
          formData.get("pharmacistEnd"),
        )
      : "";
  const pharmacistResponder =
    formData.get("pharmacistAbsenceEnabled") === "yes"
      ? formData.get("pharmacistResponder").trim()
      : "";

  return {
    workDate: formData.get("date"),
    idToken: getIdToken(),
    openingHours,
    isClosed,
    prescriptionCount: Number(formData.get("prescriptionCount") || 0),
    managerAbsence,
    pharmacistAbsence,
    managerResponder,
    pharmacistResponder,
    inquiryOccurred: formData.get("inquiryOccurred") === "yes",
    inquiryDetails: formData.get("inquiryDetails").trim(),
    specialNotes: formData.get("specialNotes").trim(),
    handover: formData.get("handover").trim(),
    confirmedBy: formData.get("confirmedBy") || "",
  };
}

async function sendDailyRecord(payload) {
  // まずはno-corsを使わず、GASの成功・失敗レスポンスを実機で確認します。
  const response = await fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`通信エラー（HTTP ${response.status}）`);
  }

  const result = await response.json();
  if (result.authError) {
    clearAuth();
    throw new Error("ログインの有効期限が切れています。ページを再読み込みしてログインし直してください。");
  }
  if (!result.success) {
    throw new Error(result.message || "Notionへの保存に失敗しました。");
  }

  return result;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showStatus("");

  if (!form.checkValidity()) {
    form.reportValidity();
    showStatus("未入力または入力内容に誤りがあります。", "error");
    return;
  }

  setSubmitting(true);

  try {
    const payload = createPayload(new FormData(form));
    const result = await sendDailyRecord(payload);
    showStatus(result.message || "保存しました。", "success");
  } catch (error) {
    console.error("Pharmacy OS send error:", error);
    showStatus(`送信できませんでした：${error.message}`, "error");
  } finally {
    setSubmitting(false);
  }
});

requireAuth(() => {
  dateInput.value = getLocalDateString();
  dateInput.addEventListener("change", () => {
    openingTypeTouched = false;
    openingType.value = "normal";
    updateOpeningFields();
    applyDefaultClosedState();
  });
  openingType.addEventListener("change", updateOpeningFields);
  updateOpeningFields();
  applyDefaultClosedState();

  setupConditionalSelect("#manager-absence", "#manager-absence-fields", [
    "#manager-start",
    "#manager-end",
  ]);
  setupConditionalSelect("#pharmacist-absence", "#pharmacist-absence-fields", [
    "#pharmacist-start",
    "#pharmacist-end",
  ]);
  setupConditionalSelect("#inquiry", "#inquiry-fields", ["#inquiry-details"]);

  const confirmedBySelect = document.querySelector("#confirmed-by");
  (PHARMACY_CONFIG.PHARMACISTS || []).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    confirmedBySelect.appendChild(option);
  });
});

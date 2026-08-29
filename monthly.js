"use strict";

const GAS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzS1F43nO_ZDG6X6gH4qfUeprWmFFOZuthQKjbXxuxkoTWY0QMvbAfURd2speGZEa6x/exec";

const controls = {
  generic: {
    file: document.querySelector("#generic-file"),
    fileName: document.querySelector("#generic-file-name"),
    button: document.querySelector("#generic-upload-button"),
    badge: document.querySelector("#generic-badge"),
    result: document.querySelector("#generic-result"),
    action: "importGenericCsv",
  },
  concentration: {
    file: document.querySelector("#concentration-file"),
    fileName: document.querySelector("#concentration-file-name"),
    button: document.querySelector("#concentration-upload-button"),
    badge: document.querySelector("#concentration-badge"),
    result: document.querySelector("#concentration-result"),
    action: "importConcentrationCsv",
  },
};

const refreshButton = document.querySelector("#refresh-button");
const monthlyStatus = document.querySelector("#monthly-status");
const summaryHeading = document.querySelector("#summary-heading");
const genericSummaryLabel = document.querySelector("#generic-summary-label");
const genericSummaryValue = document.querySelector("#generic-summary-value");
const genericSummaryUnit = document.querySelector("#generic-summary-unit");
const genericSummaryLink = document.querySelector("#generic-summary-link");
const concentrationSummaryLabel = document.querySelector("#concentration-summary-label");
const concentrationSummaryList = document.querySelector("#concentration-summary-list");
const concentrationSummaryLink = document.querySelector("#concentration-summary-link");

Object.values(controls).forEach((control) => {
  control.file.addEventListener("change", () => {
    const selectedFile = control.file.files[0];
    control.fileName.textContent = selectedFile
      ? `${selectedFile.name}（${formatFileSize(selectedFile.size)}）`
      : "ファイルが選択されていません。";
    control.button.disabled = !selectedFile;
    setBadge(control, selectedFile ? "取込可能" : "未選択", selectedFile ? "ready" : "");
    setResult(control, "");
  });

  control.button.addEventListener("click", () => uploadCsv(control));
});

async function uploadCsv(control) {
  const selectedFile = control.file.files[0];
  if (!selectedFile) return;

  setBusy(control, true);
  setResult(control, "CSVを読み込んでいます…");
  try {
    const csvBase64 = await fileToBase64(selectedFile);
    setResult(control, "Notionへ保存しています。画面を閉じずにお待ちください…");
    const response = await fetch(GAS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: control.action,
        fileName: selectedFile.name,
        csvBase64,
      }),
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || "取込に失敗しました。");

    setBadge(control, "取込済み", "success");
    setResult(control, `${data.message}（新規${data.created}件・更新${data.updated}件）`);
    await loadMonthlyData();
  } catch (error) {
    console.error(error);
    setBadge(control, "エラー", "error");
    setResult(control, error.message, true);
  } finally {
    setBusy(control, false);
  }
}

async function loadMonthlyData() {
  refreshButton.disabled = true;
  refreshButton.textContent = "…";
  monthlyStatus.textContent = "";
  try {
    const response = await fetch(`${GAS_ENDPOINT}?action=monthly&t=${Date.now()}`, {
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || "取得に失敗しました。");
    renderSummary(data);
  } catch (error) {
    console.error(error);
    monthlyStatus.textContent = `最新情報を取得できませんでした：${error.message}`;
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "↻";
  }
}

function renderSummary(data) {
  const monthLabel = data.summaryMonthLabel || "前月";
  const hasGeneric = data.genericRate !== null && data.genericRate !== undefined;
  summaryHeading.textContent = `${monthLabel}のまとめ`;
  genericSummaryLabel.textContent = `${monthLabel} 後発品使用率`;
  genericSummaryValue.textContent = hasGeneric ? data.genericRate : "未入力";
  genericSummaryUnit.hidden = !hasGeneric;
  genericSummaryLink.hidden = hasGeneric;

  concentrationSummaryLabel.textContent = `${monthLabel} 処方箋集中率 上位4医療機関`;
  concentrationSummaryList.replaceChildren();
  const ranking = data.concentrationTop4 || [];
  concentrationSummaryLink.hidden = ranking.length > 0;
  if (!ranking.length) {
    const item = document.createElement("li");
    item.textContent = "未入力";
    concentrationSummaryList.append(item);
    return;
  }
  ranking.forEach((entry) => {
    const item = document.createElement("li");
    item.append(document.createTextNode(entry.medicalInstitution));
    const rate = document.createElement("span");
    rate.textContent = `${entry.percentage}%`;
    item.append(rate);
    concentrationSummaryList.append(item);
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result);
      let binary = "";
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }
      resolve(btoa(binary));
    };
    reader.onerror = () => reject(new Error("ファイルを読み込めませんでした。"));
    reader.readAsArrayBuffer(file);
  });
}

function setBusy(control, busy) {
  control.button.disabled = busy;
  control.file.disabled = busy;
  control.button.textContent = busy ? "取込中…" : control.action === "importGenericCsv"
    ? "後発品CSVを取り込む"
    : "集中率CSVを取り込む";
}

function setBadge(control, text, className) {
  control.badge.textContent = text;
  control.badge.className = `status-chip${className ? ` ${className}` : ""}`;
}

function setResult(control, message, isError = false) {
  control.result.textContent = message;
  control.result.className = `result-message${isError ? " error" : ""}`;
}

function formatFileSize(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
}

refreshButton.addEventListener("click", loadMonthlyData);
loadMonthlyData();

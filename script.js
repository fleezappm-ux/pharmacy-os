/*
 * Pharmacy OS - 日次業務入力
 *
 * GitHub PagesからGoogle Apps Scriptへデータを送信します。
 * GASのURLを変更する場合は、下のGAS_ENDPOINTだけを書き換えてください。
 */

"use strict";

const GAS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzS1F43nO_ZDG6X6gH4qfUeprWmFFOZuthQKjbXxuxkoTWY0QMvbAfURd2speGZEa6x/exec";

const form = document.querySelector("#daily-form");
const dateInput = document.querySelector("#date");
const submitButton = document.querySelector("#submit-button");
const statusMessage = document.querySelector("#status-message");

/**
 * ローカル日付をYYYY-MM-DD形式で返します。
 * toISOString()はUTC基準で日付がずれる可能性があるため使用しません。
 */
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 画面下部へ送信状態を表示します。 */
function showStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = "status-message";

  if (type) {
    statusMessage.classList.add(`is-${type}`);
  }
}

/** 二重送信を防ぐため、通信中はボタンを無効化します。 */
function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "送信中…" : "Notionへ保存";
}

/** フォームの内容をGASへ渡すデータ形式に整えます。 */
function createPayload(formData) {
  return {
    date: formData.get("date"),
    openingTime: formData.get("openingTime"),
    prescriptionCount: Number(formData.get("prescriptionCount")),
    absenceTime: Number(formData.get("absenceTime")),
  };
}

/**
 * GASへ日次記録を送信します。
 * text/plainはブラウザのCORSプリフライトを避けやすく、
 * GAS側では e.postData.contents をJSON.parseして受け取れます。
 */
async function sendDailyRecord(payload) {
  const response = await fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`送信に失敗しました（HTTP ${response.status}）`);
  }

  // GASがJSONを返す場合だけ内容を確認します。空レスポンスでも成功扱いです。
  const responseText = await response.text();
  if (!responseText) return;

  try {
    const result = JSON.parse(responseText);
    if (result.success === false) {
      throw new Error(result.message || "Notionへの保存に失敗しました。");
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      // GASがJSON以外を返しても、HTTP通信が成功していれば処理を続けます。
      return;
    }
    throw error;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showStatus("");

  // HTML標準の入力チェックを利用し、問題のある項目を表示します。
  if (!form.checkValidity()) {
    form.reportValidity();
    showStatus("未入力または入力内容に誤りがあります。", "error");
    return;
  }

  setSubmitting(true);

  try {
    const payload = createPayload(new FormData(form));
    await sendDailyRecord(payload);

    showStatus("保存しました。", "success");

    // 続けて入力しやすいよう、日付は残して数値項目だけ初期化します。
    form.reset();
    dateInput.value = getLocalDateString();
  } catch (error) {
    console.error("Pharmacy OS send error:", error);
    showStatus(
      "送信できませんでした。通信環境を確認して、もう一度お試しください。",
      "error",
    );
  } finally {
    setSubmitting(false);
  }
});

// 初回表示時の日付を自動入力します。
dateInput.value = getLocalDateString();

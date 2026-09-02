"use strict";

const statusMessage = document.getElementById("status-message");
const lineWarning = document.getElementById("line-warning");
const introText = document.getElementById("intro-text");
const signinButtonEl = document.getElementById("google-signin-button");

function getInviteTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") || "";
}

function isLineInAppBrowser() {
  return /Line/i.test(navigator.userAgent);
}

function setStatus(message, className) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${className || ""}`;
}

const inviteToken = getInviteTokenFromUrl();

if (isLineInAppBrowser()) {
  lineWarning.classList.add("show");
}

if (!inviteToken) {
  introText.textContent = "招待コードが見つかりません。招待してくれた方に、正しいURLをもう一度共有してもらってください。";
  signinButtonEl.hidden = true;
} else {
  initGoogleSignin();
}

function initGoogleSignin() {
  if (!(window.google && google.accounts && google.accounts.id)) {
    setTimeout(initGoogleSignin, 200);
    return;
  }
  google.accounts.id.initialize({
    client_id: PHARMACY_CONFIG.GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse
  });
  google.accounts.id.renderButton(signinButtonEl, {
    theme: "outline",
    size: "large",
    text: "signin_with",
    locale: "ja",
    width: 280
  });
}

async function handleCredentialResponse(response) {
  signinButtonEl.hidden = true;
  setStatus("登録処理をしています…", "");
  try {
    const result = await fetch(PHARMACY_CONFIG.GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "registerViaInvite",
        idToken: response.credential,
        inviteToken: inviteToken
      })
    });
    const data = await result.json();
    if (data.success) {
      setStatus(data.message || "登録が完了しました。", "success");
      introText.textContent = "登録が完了しました。下のリンクからPharmacy OSを開いてください。";
      const link = document.createElement("a");
      link.href = "home.html";
      link.textContent = "Pharmacy OSを開く";
      link.style.display = "inline-block";
      link.style.marginTop = "8px";
      link.style.fontWeight = "800";
      link.style.color = "var(--green)";
      statusMessage.after(link);
    } else {
      setStatus(data.message || "登録に失敗しました。", "error");
      signinButtonEl.hidden = false;
    }
  } catch (e) {
    console.error(e);
    setStatus("通信エラーが発生しました。しばらくしてから再度お試しください。", "error");
    signinButtonEl.hidden = false;
  }
}

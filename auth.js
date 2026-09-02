"use strict";

const AUTH_TOKEN_KEY = "pharmacyOsIdToken";
const AUTH_EMAIL_KEY = "pharmacyOsAuthEmail";

function getIdToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY) || "";
}

function getAuthEmail() {
  return sessionStorage.getItem(AUTH_EMAIL_KEY) || "";
}

function clearAuth() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_EMAIL_KEY);
}

function decodeJwtPayload(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function showAuthGate() {
  const gate = document.getElementById("auth-gate");
  if (gate) gate.hidden = false;
  document.body.style.overflow = "hidden";
}

function hideAuthGate() {
  const gate = document.getElementById("auth-gate");
  if (gate) gate.hidden = true;
  document.body.style.overflow = "";
}

let authReadyCallback = null;

function handleCredentialResponse(response) {
  const payload = decodeJwtPayload(response.credential);
  sessionStorage.setItem(AUTH_TOKEN_KEY, response.credential);
  if (payload && payload.email) sessionStorage.setItem(AUTH_EMAIL_KEY, payload.email);
  hideAuthGate();
  if (authReadyCallback) {
    const cb = authReadyCallback;
    authReadyCallback = null;
    cb();
  }
}

/**
 * ページの初期化前に必ず呼び出します。
 * すでに有効なログイン状態ならすぐにonReadyを呼び、そうでなければログイン画面を出し、
 * ログイン成功後にonReadyを呼びます。
 */
function requireAuth(onReady) {
  const token = getIdToken();
  const payload = token ? decodeJwtPayload(token) : null;
  const now = Math.floor(Date.now() / 1000);
  if (token && payload && payload.exp && payload.exp > now) {
    onReady();
    return;
  }
  clearAuth();
  authReadyCallback = onReady;
  showAuthGate();
  renderGoogleButton();
}

function renderGoogleButton() {
  if (!(window.google && google.accounts && google.accounts.id)) {
    // GISライブラリの読み込みが間に合っていない場合、少し待って再試行します。
    setTimeout(renderGoogleButton, 200);
    return;
  }
  google.accounts.id.initialize({
    client_id: PHARMACY_CONFIG.GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse
  });
  const target = document.getElementById("google-signin-button");
  if (target && !target.dataset.rendered) {
    google.accounts.id.renderButton(target, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      locale: "ja",
      width: 280
    });
    target.dataset.rendered = "1";
  }
}

/**
 * GASからの応答が認証エラー(authError:true)だった場合、ログイン状態をクリアして
 * ログイン画面を出し直します。処理した場合はtrueを返します。
 */
function handleAuthErrorIfNeeded(result, retryCallback) {
  if (result && result.authError) {
    clearAuth();
    requireAuth(retryCallback || (() => location.reload()));
    return true;
  }
  return false;
}

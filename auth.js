"use strict";

const AUTH_TOKEN_KEY = "pharmacyOsIdToken";
const AUTH_EMAIL_KEY = "pharmacyOsAuthEmail";

// 期限のこの秒数前になったら、静かに（画面を出さず）トークンの更新を試みます。
const AUTH_REFRESH_MARGIN_SECONDS = 300;

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

function isTokenValid(token) {
  const payload = token ? decodeJwtPayload(token) : null;
  const now = Math.floor(Date.now() / 1000);
  return !!(token && payload && payload.exp && payload.exp > now);
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

// ログイン待ちのコールバックは、同時に複数箇所から呼ばれる可能性があるため配列で管理します。
let authReadyCallbacks = [];
let refreshTimer = null;
let silentRefreshInFlight = false;

function handleCredentialResponse(response) {
  const payload = decodeJwtPayload(response.credential);
  sessionStorage.setItem(AUTH_TOKEN_KEY, response.credential);
  if (payload && payload.email) sessionStorage.setItem(AUTH_EMAIL_KEY, payload.email);
  hideAuthGate();
  silentRefreshInFlight = false;
  scheduleTokenRefresh();

  const callbacks = authReadyCallbacks;
  authReadyCallbacks = [];
  callbacks.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error(e);
    }
  });
}

/**
 * ページの初期化前に必ず呼び出します。
 * すでに有効なログイン状態ならすぐにonReadyを呼び、そうでなければログイン画面を出し、
 * ログイン成功後にonReadyを呼びます。
 */
function requireAuth(onReady) {
  if (isTokenValid(getIdToken())) {
    scheduleTokenRefresh();
    onReady();
    return;
  }
  clearAuth();
  authReadyCallbacks.push(onReady);
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
 * トークンの期限が近づいたら、画面を出さずに静かな更新を1回だけ試みるようタイマーを設定します。
 * 更新に成功すればログイン継続、失敗しても何もしません（次のGAS呼び出し時に
 * authFetchが検知して、その時初めてログイン画面を出します）。無限ループや
 * 連続表示を避けるため、更新の試行は毎回1回きりです。
 */
function scheduleTokenRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  const token = getIdToken();
  const payload = token ? decodeJwtPayload(token) : null;
  if (!payload || !payload.exp) return;

  const now = Math.floor(Date.now() / 1000);
  const secondsUntilExpiry = payload.exp - now;
  const refreshInSeconds = Math.max(5, secondsUntilExpiry - AUTH_REFRESH_MARGIN_SECONDS);

  refreshTimer = setTimeout(attemptSilentRefresh, refreshInSeconds * 1000);
}

function attemptSilentRefresh() {
  if (silentRefreshInFlight) return;
  if (!(window.google && google.accounts && google.accounts.id)) return;

  silentRefreshInFlight = true;
  try {
    google.accounts.id.initialize({
      client_id: PHARMACY_CONFIG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });
    // Googleのログイン状態が有効であれば、画面を出さずに新しい資格情報を受け取れます。
    // ブラウザの制限（FedCM無効化やサードパーティCookieブロック等）で
    // 表示できない場合は、静かに諦めます（無理に突破しません）。
    google.accounts.id.prompt(() => {
      // 成功時はhandleCredentialResponseが呼ばれてsilentRefreshInFlightがリセットされます。
      // 失敗・非表示時は、次にGASへアクセスした時にauthFetchがログイン画面を出します。
      silentRefreshInFlight = false;
    });
  } catch (e) {
    silentRefreshInFlight = false;
  }
}

/**
 * GASへ認証付きでリクエストします。読み取り・書き込みどちらも、
 * ログイントークンをURLに含めず、POSTのJSON本文で送ります。
 * 認証エラー(authError)が返ってきた場合は、入力内容（extraBody）を保持したまま
 * ログイン画面を出し、ログイン成功後に同じリクエストを自動的にやり直します。
 * これにより、保存中にトークンが切れても入力内容を失いません。
 */
async function authFetch(action, extraBody) {
  const response = await fetch(PHARMACY_CONFIG.GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, idToken: getIdToken(), ...(extraBody || {}) })
  });
  const result = await response.json();

  if (result.authError) {
    clearAuth();
    return new Promise((resolve, reject) => {
      requireAuth(async () => {
        try {
          const retryResult = await authFetch(action, extraBody);
          resolve(retryResult);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  return result;
}

/**
 * GASからの応答が認証エラー(authError:true)だった場合、ログイン状態をクリアして
 * ログイン画面を出し直します。処理した場合はtrueを返します。
 * （authFetchを使わない一部の呼び出し箇所との互換のために残しています。）
 */
function handleAuthErrorIfNeeded(result, retryCallback) {
  if (result && result.authError) {
    clearAuth();
    requireAuth(retryCallback || (() => location.reload()));
    return true;
  }
  return false;
}

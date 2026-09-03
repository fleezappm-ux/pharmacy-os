"use strict";

const loadingMessage = document.getElementById("loading-message");
const deniedArea = document.getElementById("denied-area");
const adminContent = document.getElementById("admin-content");

let isAdmin = false;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

function formatDateTime(value) {
  if (!value) return "―";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function init() {
  requireAuth(async () => {
    try {
      const who = await authFetch("whoAmI");
      if (!who.success) throw new Error(who.message || "確認に失敗しました。");
      if (who.role !== "admin") {
        loadingMessage.hidden = true;
        deniedArea.hidden = false;
        return;
      }
      isAdmin = true;
      loadingMessage.hidden = true;
      adminContent.hidden = false;
      await Promise.all([loadUsers(), loadInvites()]);
    } catch (e) {
      loadingMessage.className = "loading-message error";
      loadingMessage.textContent = "確認できませんでした。時間をおいて開き直してください。";
    }
  });
}

/* ===== アカウント枠・利用者一覧 ===== */
async function loadUsers() {
  const result = await authFetch("adminListUsers");
  if (!result.success) {
    document.getElementById("user-list").innerHTML = `<p class="empty-message">取得できませんでした：${escapeHtml(result.message)}</p>`;
    return;
  }
  document.getElementById("slot-limit").textContent = result.slotLimit;
  document.getElementById("slot-used").textContent = result.usedSlots;
  document.getElementById("slot-remaining").textContent = result.remainingSlots;
  document.getElementById("slot-limit-input").value = result.slotLimit;
  renderUserList(result.users || []);
}

function renderUserList(users) {
  const c = document.getElementById("user-list");
  c.textContent = "";
  if (!users.length) {
    c.innerHTML = '<p class="empty-message">登録済みの利用者はいません。</p>';
    return;
  }
  const methodLabel = { existing: "既存登録", group: "グループ招待", individual: "個別招待" };
  users.slice().sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt)).forEach((u) => {
    const row = document.createElement("div");
    row.className = "list-row";

    const main = document.createElement("div");
    main.className = "list-main";
    const title = document.createElement("span");
    title.className = "list-title";
    title.textContent = u.email;
    main.appendChild(title);

    const detail = document.createElement("span");
    detail.className = "list-detail";
    detail.textContent = `${u.role === "admin" ? "管理者" : "従業員"} ／ 登録：${formatDateTime(u.registeredAt)}（${methodLabel[u.registrationMethod] || u.registrationMethod}） ／ 最終利用：${formatDateTime(u.lastUsedAt)}`;
    main.appendChild(detail);
    row.appendChild(main);

    const badge = document.createElement("span");
    badge.className = `badge ${u.status === "active" ? "green" : "orange"}`;
    badge.textContent = u.status === "active" ? "利用中" : "一時停止";
    row.appendChild(badge);

    if (u.confirmedByAdmin !== true && u.confirmedByAdmin !== "TRUE" && u.role !== "admin") {
      const newBadge = document.createElement("span");
      newBadge.className = "badge orange";
      newBadge.textContent = "未確認";
      row.appendChild(newBadge);
    }

    if (u.role !== "admin") {
      const actions = document.createElement("div");
      actions.className = "list-actions";

      if (u.confirmedByAdmin !== true && u.confirmedByAdmin !== "TRUE") {
        const confirmBtn = document.createElement("button");
        confirmBtn.className = "small secondary";
        confirmBtn.type = "button";
        confirmBtn.textContent = "確認済みにする";
        confirmBtn.addEventListener("click", () => confirmUser(u.email));
        actions.appendChild(confirmBtn);
      }

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "small secondary";
      toggleBtn.type = "button";
      toggleBtn.textContent = u.status === "active" ? "一時停止" : "利用再開";
      toggleBtn.addEventListener("click", () => toggleUserStatus(u.email, u.status === "active" ? "suspended" : "active"));
      actions.appendChild(toggleBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "small danger";
      deleteBtn.type = "button";
      deleteBtn.textContent = "削除";
      deleteBtn.addEventListener("click", () => deleteUser(u.email));
      actions.appendChild(deleteBtn);

      row.appendChild(actions);
    }

    c.appendChild(row);
  });
}

async function toggleUserStatus(email, newStatus) {
  const result = await authFetch("adminUpdateUserStatus", { targetEmail: email, newStatus });
  if (!result.success) { alert(result.message || "更新に失敗しました。"); return; }
  await loadUsers();
}

async function deleteUser(email) {
  if (!confirm(`${email} を削除しますか？この操作は取り消せません。`)) return;
  const result = await authFetch("adminDeleteUser", { targetEmail: email });
  if (!result.success) { alert(result.message || "削除に失敗しました。"); return; }
  await loadUsers();
}

async function confirmUser(email) {
  const result = await authFetch("adminConfirmUser", { targetEmail: email });
  if (!result.success) { alert(result.message || "更新に失敗しました。"); return; }
  await loadUsers();
}

document.getElementById("slot-limit-save").addEventListener("click", async () => {
  const newLimit = document.getElementById("slot-limit-input").value;
  const result = await authFetch("adminSetSlotLimit", { newLimit: Number(newLimit) });
  if (!result.success) { alert(result.message || "更新に失敗しました。"); return; }
  await loadUsers();
});

/* ===== 招待URL ===== */
async function loadInvites() {
  const result = await authFetch("adminListInvites");
  if (!result.success) {
    document.getElementById("invite-list").innerHTML = `<p class="empty-message">取得できませんでした：${escapeHtml(result.message)}</p>`;
    return;
  }
  renderInviteList(result.invites || []);
}

const inviteStatusLabel = { active: "有効", expired: "期限切れ", used_up: "使用済み", invalidated: "無効化済み" };
const inviteStatusClass = { active: "green", expired: "gray", used_up: "gray", invalidated: "gray" };

function renderInviteList(invites) {
  const c = document.getElementById("invite-list");
  c.textContent = "";
  if (!invites.length) {
    c.innerHTML = '<p class="empty-message">発行された招待はありません。</p>';
    return;
  }
  invites.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach((inv) => {
    const row = document.createElement("div");
    row.className = "list-row";

    const main = document.createElement("div");
    main.className = "list-main";
    const title = document.createElement("span");
    title.className = "list-title";
    title.textContent = `${inv.type === "group" ? "グループ招待" : "個別招待"}（${inv.usesCount}/${inv.maxUses}人）`;
    main.appendChild(title);

    const detail = document.createElement("span");
    detail.className = "list-detail";
    detail.textContent = `発行：${formatDateTime(inv.createdAt)}（${inv.createdBy}） ／ 期限：${formatDateTime(inv.expiresAt)}`;
    main.appendChild(detail);
    row.appendChild(main);

    const badge = document.createElement("span");
    badge.className = `badge ${inviteStatusClass[inv.status] || "gray"}`;
    badge.textContent = inviteStatusLabel[inv.status] || inv.status;
    row.appendChild(badge);

    if (inv.status === "active") {
      const actions = document.createElement("div");
      actions.className = "list-actions";
      const invalidateBtn = document.createElement("button");
      invalidateBtn.className = "small danger";
      invalidateBtn.type = "button";
      invalidateBtn.textContent = "無効化";
      invalidateBtn.addEventListener("click", () => invalidateInvite(inv.inviteId));
      actions.appendChild(invalidateBtn);
      row.appendChild(actions);
    }

    c.appendChild(row);
  });
}

async function invalidateInvite(inviteId) {
  if (!confirm("この招待を無効化しますか？")) return;
  const result = await authFetch("adminInvalidateInvite", { inviteId });
  if (!result.success) { alert(result.message || "更新に失敗しました。"); return; }
  await loadInvites();
}

function updateInviteTypeFields() {
  const isIndividual = document.getElementById("invite-type").value === "individual";
  document.getElementById("invite-max-uses-label").style.display = isIndividual ? "none" : "";
}
document.getElementById("invite-type").addEventListener("change", updateInviteTypeFields);
updateInviteTypeFields();

document.getElementById("invite-create-button").addEventListener("click", async () => {
  const inviteType = document.getElementById("invite-type").value;
  const maxUses = document.getElementById("invite-max-uses").value;
  const expiresInDays = document.getElementById("invite-expires").value;

  const result = await authFetch("adminCreateInvite", {
    inviteType,
    maxUses: Number(maxUses),
    expiresInDays: Number(expiresInDays)
  });

  const box = document.getElementById("invite-result");
  if (!result.success) {
    box.hidden = false;
    box.textContent = result.message || "発行に失敗しました。";
    return;
  }

  const url = `${location.origin}${location.pathname.replace(/admin\.html$/, "")}invite.html?token=${result.token}`;
  box.hidden = false;
  box.innerHTML = "";

  const urlText = document.createElement("p");
  urlText.style.margin = "0 0 8px";
  urlText.textContent = url;
  box.appendChild(urlText);

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "small secondary";
  copyBtn.textContent = "URLをコピー";
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(url).then(() => { copyBtn.textContent = "コピーしました"; });
  });
  box.appendChild(copyBtn);

  const lineBtn = document.createElement("a");
  lineBtn.className = "small secondary";
  lineBtn.style.display = "inline-block";
  lineBtn.style.marginLeft = "8px";
  lineBtn.style.textDecoration = "none";
  lineBtn.style.padding = "6px 10px";
  lineBtn.style.border = "1px solid var(--line)";
  lineBtn.style.borderRadius = "10px";
  lineBtn.textContent = "LINEで送る";
  lineBtn.href = `https://line.me/R/msg/text/?${encodeURIComponent(url)}`;
  lineBtn.target = "_blank";
  lineBtn.rel = "noopener noreferrer";
  box.appendChild(lineBtn);

  await loadInvites();
});

init();

/**
 * DPRO DAYCARE - LINE ID Token contract-ready helper
 * Version: DAYCARE-LINE-IDTOKEN-HELPER-R3-20260823
 *
 * Pre-contract capability only. This file does NOT contain a LINE Channel ID,
 * LIFF ID, Channel Secret, access token, or any customer credential.
 * The real customer LIFF/channel binding remains contract-time.
 */
(function initDproDaycareLineIdentity(global) {
  "use strict";

  const VERIFY_PATH = "/api/line/verify";

  function resolveWorkerBase(options = {}) {
    const configured = options.workerBase
      || global.DPRO_DAYCARE_CONFIG?.URLS?.workerBase
      || global.DPRODaycare?.URLS?.workerBase;
    if (!configured) throw new Error("Worker URLが未設定です。");
    return String(configured).replace(/\/+$/, "");
  }

  function getLiffIdToken(liffInstance = global.liff) {
    if (!liffInstance || typeof liffInstance.getIDToken !== "function") {
      throw new Error("LIFFが未初期化です。契約時にLIFFを設定してください。");
    }
    const idToken = String(liffInstance.getIDToken() || "").trim();
    if (!idToken) throw new Error("LINE ID Tokenを取得できませんでした。");
    return idToken;
  }

  async function verifyCurrentLiffIdentity(options = {}) {
    const idToken = getLiffIdToken(options.liff || global.liff);
    const response = await fetch(`${resolveWorkerBase(options)}${VERIFY_PATH}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({ id_token: idToken }),
    });

    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; }
    catch { data = { ok: false, error: text || "LINE本人確認に失敗しました。" }; }

    if (!response.ok) {
      const error = new Error(data.error || data.message || `LINE本人確認に失敗しました。HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  global.DPRODaycareLineIdentity = Object.freeze({
    verifyPath: VERIFY_PATH,
    getLiffIdToken,
    verifyCurrentLiffIdentity,
  });
})(typeof window !== "undefined" ? window : globalThis);

/**
 * ============================================================
 * DPRO デイサービス LINE
 * STEP DAYCARE-4
 * 共通設定 config.js 完全版
 * Version: DAYCARE-4-R2-INTEGRATION-CHECK-ENDPOINT-20260713
 * ============================================================
 *
 * GitHub配置先:
 *   dpro-dayservice-line/config.js
 *
 * GitHub Pages:
 *   https://dpromstk2000-lab.github.io/dpro-dayservice-line/config.js
 *
 * Cloudflare Worker:
 *   https://dpro-dayservice-line-api.dpromstk2000.workers.dev
 *
 * 注意:
 *   このファイルにはSUPABASE_SERVICE_ROLE_KEYなどの秘密情報を
 *   絶対に記載しないでください。
 */

(function initDproDaycareConfig(global) {
  "use strict";

  const APP = Object.freeze({
    serviceName: "DPRO デイサービス LINE",
    subtitle: "デイサービス向け 家族連絡・お休み連絡・送迎案内システム",
    appVersion: "DAYCARE-4-R2-INTEGRATION-CHECK-ENDPOINT-20260713",
    workerVersion: "DAYCARE-3-R3-INTEGRATION-CHECK-20260713",
    facilityCode: "dpro_dayservice_demo",
    facilityName: "DPROデイサービス",
    timezone: "Asia/Tokyo",
    locale: "ja-JP",
    adminCodeDemo: "1234",
  });

  const URLS = Object.freeze({
    siteBase: "https://dpromstk2000-lab.github.io/dpro-dayservice-line",
    workerBase: "https://dpro-dayservice-line-api.dpromstk2000.workers.dev",
    repository: "https://github.com/dpromstk2000-lab/dpro-dayservice-line",

    index: "https://dpromstk2000-lab.github.io/dpro-dayservice-line/index.html",
    member: "https://dpromstk2000-lab.github.io/dpro-dayservice-line/member.html",
    owner: "https://dpromstk2000-lab.github.io/dpro-dayservice-line/owner.html",
    ownerIpad: "https://dpromstk2000-lab.github.io/dpro-dayservice-line/owner-ipad.html",
    systemCheck: "https://dpromstk2000-lab.github.io/dpro-dayservice-line/system-check.html",
    config: "https://dpromstk2000-lab.github.io/dpro-dayservice-line/config.js",
  });

  const ENDPOINTS = Object.freeze({
    root: "/",
    health: "/api/health",

    publicConfig: "/api/public/config",
    publicAbsence: "/api/public/absence",
    publicChangeRequest: "/api/public/change-request",
    publicContact: "/api/public/contact",
    memberProfile: "/api/member/profile",

    adminDemoPrepare: "/api/admin/demo/prepare",
    adminDashboard: "/api/admin/dashboard",
    adminDay: "/api/admin/day",
    adminSearch: "/api/admin/search",
    adminUserDetail: "/api/admin/user-detail",
    adminScheduleCreate: "/api/admin/schedules/create",
    adminAttendanceStatus: "/api/admin/attendance/status",
    adminDailyCheckStatus: "/api/admin/daily-checks/status",
    adminIntegrationCheck: "/api/admin/integration-check",
    adminTransportStatus: "/api/admin/transport/status",
    adminTaskStatus: "/api/admin/tasks/status",
    adminMessageLogCopy: "/api/admin/messages/log-copy",
    adminFamilyRequestStatus: "/api/admin/family-requests/status",
    adminPhoneNormalizeCheck: "/api/admin/phone-normalize-check",
  });

  const STORAGE_KEYS = Object.freeze({
    adminCode: "dpro_daycare_admin_code",
    lastFamilyPhone: "dpro_daycare_last_family_phone",
    lastUserNumber: "dpro_daycare_last_user_number",
    selectedDate: "dpro_daycare_selected_date",
    operatorName: "dpro_daycare_operator_name",
    deviceType: "dpro_daycare_device_type",
  });

  const ATTENDANCE_STATUSES = Object.freeze({
    scheduled: Object.freeze({
      label: "利用予定",
      shortLabel: "予定",
      order: 10,
    }),
    absent: Object.freeze({
      label: "お休み",
      shortLabel: "休み",
      order: 20,
    }),
    arrived: Object.freeze({
      label: "来所済み",
      shortLabel: "来所",
      order: 30,
    }),
    in_service: Object.freeze({
      label: "利用中",
      shortLabel: "利用中",
      order: 40,
    }),
    ready_to_go_home: Object.freeze({
      label: "帰宅準備",
      shortLabel: "帰宅準備",
      order: 50,
    }),
    transport_departed: Object.freeze({
      label: "送迎出発",
      shortLabel: "出発",
      order: 60,
    }),
    completed: Object.freeze({
      label: "帰宅完了",
      shortLabel: "完了",
      order: 70,
    }),
    cancelled: Object.freeze({
      label: "予定取消",
      shortLabel: "取消",
      order: 80,
    }),
  });

  const DAILY_CHECKS = Object.freeze({
    lunch: Object.freeze({
      label: "昼食確認",
      completedLabel: "昼食確認済み",
      icon: "🍱",
      order: 10,
    }),
    bath: Object.freeze({
      label: "入浴確認",
      completedLabel: "入浴確認済み",
      icon: "🛁",
      order: 20,
    }),
    recreation: Object.freeze({
      label: "レク確認",
      completedLabel: "レク確認済み",
      icon: "🎨",
      order: 30,
    }),
    family_contact: Object.freeze({
      label: "家族連絡確認",
      completedLabel: "家族連絡済み",
      icon: "💬",
      order: 40,
    }),
    go_home_preparation: Object.freeze({
      label: "帰宅準備確認",
      completedLabel: "帰宅準備済み",
      icon: "👜",
      order: 50,
    }),
    other: Object.freeze({
      label: "その他確認",
      completedLabel: "確認済み",
      icon: "✓",
      order: 90,
    }),
  });

  const REQUEST_TYPES = Object.freeze({
    absence: Object.freeze({
      label: "お休み連絡",
      shortLabel: "お休み",
      order: 10,
    }),
    change_date: Object.freeze({
      label: "利用日変更希望",
      shortLabel: "日程変更",
      order: 20,
    }),
    contact: Object.freeze({
      label: "施設への連絡",
      shortLabel: "施設連絡",
      order: 30,
    }),
    transport_question: Object.freeze({
      label: "送迎について",
      shortLabel: "送迎",
      order: 40,
    }),
    item_question: Object.freeze({
      label: "持ち物について",
      shortLabel: "持ち物",
      order: 50,
    }),
    other: Object.freeze({
      label: "その他",
      shortLabel: "その他",
      order: 90,
    }),
  });

  const REQUEST_STATUSES = Object.freeze({
    new: Object.freeze({
      label: "未確認",
      order: 10,
    }),
    acknowledged: Object.freeze({
      label: "確認済み",
      order: 20,
    }),
    in_progress: Object.freeze({
      label: "対応中",
      order: 30,
    }),
    resolved: Object.freeze({
      label: "対応済み",
      order: 40,
    }),
    rejected: Object.freeze({
      label: "対応不可",
      order: 50,
    }),
    cancelled: Object.freeze({
      label: "取消",
      order: 60,
    }),
  });

  const TASK_STATUSES = Object.freeze({
    open: Object.freeze({
      label: "未対応",
      order: 10,
    }),
    in_progress: Object.freeze({
      label: "対応中",
      order: 20,
    }),
    completed: Object.freeze({
      label: "対応済み",
      order: 30,
    }),
    cancelled: Object.freeze({
      label: "取消",
      order: 40,
    }),
  });

  const TASK_TYPES = Object.freeze({
    reply_absence: Object.freeze({
      label: "お休み連絡へ返信",
      order: 10,
    }),
    reply_change: Object.freeze({
      label: "利用日変更希望へ返信",
      order: 20,
    }),
    send_transport_time: Object.freeze({
      label: "送迎時間を案内",
      order: 30,
    }),
    send_item_notice: Object.freeze({
      label: "持ち物を案内",
      order: 40,
    }),
    follow_up_family: Object.freeze({
      label: "家族へ連絡",
      order: 50,
    }),
    staff_note_check: Object.freeze({
      label: "申し送りを確認",
      order: 60,
    }),
    other: Object.freeze({
      label: "その他",
      order: 90,
    }),
  });

  const TRANSPORT_MODES = Object.freeze({
    facility_transport: Object.freeze({
      label: "施設送迎",
      shortLabel: "施設送迎",
    }),
    family_transport: Object.freeze({
      label: "家族送迎",
      shortLabel: "家族送迎",
    }),
    family_pickup: Object.freeze({
      label: "家族お迎え",
      shortLabel: "家族迎え",
    }),
    no_transport: Object.freeze({
      label: "送迎なし",
      shortLabel: "送迎なし",
    }),
    other: Object.freeze({
      label: "その他",
      shortLabel: "その他",
    }),
  });

  const PICKUP_STATUSES = Object.freeze({
    pickup_planned: Object.freeze({ label: "お迎え予定" }),
    pickup_departed: Object.freeze({ label: "お迎え出発" }),
    pickup_done: Object.freeze({ label: "お迎え完了" }),
    family_dropoff: Object.freeze({ label: "家族送迎" }),
    not_required: Object.freeze({ label: "お迎え不要" }),
  });

  const DROPOFF_STATUSES = Object.freeze({
    dropoff_planned: Object.freeze({ label: "お帰り予定" }),
    dropoff_departed: Object.freeze({ label: "お帰り送迎出発" }),
    dropoff_done: Object.freeze({ label: "お帰り完了" }),
    family_pickup: Object.freeze({ label: "家族お迎え" }),
    not_required: Object.freeze({ label: "お帰り送迎不要" }),
  });

  const PRIORITIES = Object.freeze({
    low: Object.freeze({
      label: "低",
      order: 10,
    }),
    normal: Object.freeze({
      label: "通常",
      order: 20,
    }),
    high: Object.freeze({
      label: "高",
      order: 30,
    }),
    urgent: Object.freeze({
      label: "緊急",
      order: 40,
    }),
  });

  const DEMO = Object.freeze({
    adminCode: "1234",
    member: Object.freeze({
      phone: "090-9999-1111",
      userNumber: "DAY-DEMO-001",
      userName: "佐藤 花子",
      familyName: "佐藤 太郎",
    }),
    testMember: Object.freeze({
      phone: "090-9999-0000",
      userNumber: "DAY-DEMO-999",
      userName: "テスト 利用者",
      familyName: "テスト 家族",
    }),
  });

  function getStorage() {
    try {
      if (global.localStorage) {
        return global.localStorage;
      }
    } catch (error) {
      console.warn("localStorageを利用できません。", error);
    }
    return null;
  }

  function getStoredValue(key, fallback = "") {
    const storage = getStorage();
    if (!storage) return fallback;

    try {
      const value = storage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      console.warn(`保存値の取得に失敗しました: ${key}`, error);
      return fallback;
    }
  }

  function setStoredValue(key, value) {
    const storage = getStorage();
    if (!storage) return false;

    try {
      if (value === null || value === undefined || value === "") {
        storage.removeItem(key);
      } else {
        storage.setItem(key, String(value));
      }
      return true;
    } catch (error) {
      console.warn(`保存値の更新に失敗しました: ${key}`, error);
      return false;
    }
  }

  function removeStoredValue(key) {
    const storage = getStorage();
    if (!storage) return false;

    try {
      storage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`保存値の削除に失敗しました: ${key}`, error);
      return false;
    }
  }

  function getAdminCode() {
    return getStoredValue(STORAGE_KEYS.adminCode, "");
  }

  function saveAdminCode(adminCode) {
    const value = String(adminCode ?? "").trim();
    if (!value) {
      throw new Error("管理コードを入力してください。");
    }
    return setStoredValue(STORAGE_KEYS.adminCode, value);
  }

  function clearAdminCode() {
    return removeStoredValue(STORAGE_KEYS.adminCode);
  }

  function getOperatorName(fallback = "スタッフ") {
    return getStoredValue(STORAGE_KEYS.operatorName, fallback);
  }

  function saveOperatorName(name) {
    const value = String(name ?? "").trim();
    return setStoredValue(STORAGE_KEYS.operatorName, value);
  }

  function detectDeviceType() {
    if (!global.navigator) return "pc";

    const userAgent = global.navigator.userAgent || "";
    const touchPoints = global.navigator.maxTouchPoints || 0;
    const isIpad =
      /iPad/i.test(userAgent) ||
      (/Macintosh/i.test(userAgent) && touchPoints > 1);

    if (isIpad) return "ipad";
    if (/Android|iPhone|iPod|Mobile/i.test(userAgent)) return "mobile";
    return "pc";
  }

  function getDeviceType() {
    const stored = getStoredValue(STORAGE_KEYS.deviceType, "");
    if (["pc", "ipad", "mobile", "api", "system"].includes(stored)) {
      return stored;
    }
    return detectDeviceType();
  }

  function saveDeviceType(deviceType) {
    const value = ["pc", "ipad", "mobile", "api", "system"].includes(deviceType)
      ? deviceType
      : detectDeviceType();
    return setStoredValue(STORAGE_KEYS.deviceType, value);
  }

  function normalizePhone(value) {
    let phone = String(value ?? "")
      .replace(/[０-９]/g, function convertFullWidth(char) {
        return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
      })
      .replace(/[^\d+]/g, "");

    if (phone.startsWith("+81")) {
      phone = `0${phone.slice(3)}`;
    } else if (phone.startsWith("0081")) {
      phone = `0${phone.slice(4)}`;
    } else if (phone.startsWith("81") && phone.length >= 11) {
      phone = `0${phone.slice(2)}`;
    }

    return phone.replace(/\D/g, "");
  }

  function formatPhone(value) {
    const phone = normalizePhone(value);

    if (/^0[789]0\d{8}$/.test(phone)) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
    }

    if (/^0\d{9}$/.test(phone)) {
      return `${phone.slice(0, 2)}-${phone.slice(2, 6)}-${phone.slice(6)}`;
    }

    return phone || String(value ?? "");
  }

  function normalizeNewlines(value) {
    return String(value ?? "")
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cleanText(value, maxLength = 1000) {
    return String(value ?? "").trim().slice(0, maxLength);
  }

  function isValidDateText(value) {
    const text = String(value ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;

    const parts = text.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));

    return (
      date.getUTCFullYear() === parts[0] &&
      date.getUTCMonth() === parts[1] - 1 &&
      date.getUTCDate() === parts[2]
    );
  }

  function todayJst() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const values = Object.fromEntries(
      parts.map(function toPair(part) {
        return [part.type, part.value];
      }),
    );

    return `${values.year}-${values.month}-${values.day}`;
  }

  function addDays(dateText, days) {
    if (!isValidDateText(dateText)) {
      throw new Error("日付はYYYY-MM-DD形式で指定してください。");
    }

    const parts = dateText.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return date.toISOString().slice(0, 10);
  }

  function formatDateJa(value, options = {}) {
    if (!value) return options.emptyText || "未設定";

    const dateText = String(value).slice(0, 10);
    if (!isValidDateText(dateText)) {
      return options.emptyText || String(value);
    }

    const parts = dateText.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));

    return new Intl.DateTimeFormat(APP.locale, {
      timeZone: "UTC",
      year: options.hideYear ? undefined : "numeric",
      month: "long",
      day: "numeric",
      weekday: options.hideWeekday ? undefined : "short",
    }).format(date);
  }

  function formatDateShortJa(value, options = {}) {
    if (!value) return options.emptyText || "未設定";

    const dateText = String(value).slice(0, 10);
    if (!isValidDateText(dateText)) {
      return options.emptyText || String(value);
    }

    const parts = dateText.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));

    return new Intl.DateTimeFormat(APP.locale, {
      timeZone: "UTC",
      month: "numeric",
      day: "numeric",
      weekday: options.hideWeekday ? undefined : "short",
    }).format(date);
  }

  function formatDateTimeJa(value, options = {}) {
    if (!value) return options.emptyText || "未設定";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return options.emptyText || String(value);
    }

    return new Intl.DateTimeFormat(APP.locale, {
      timeZone: APP.timezone,
      year: options.hideYear ? undefined : "numeric",
      month: "numeric",
      day: "numeric",
      weekday: options.hideWeekday ? undefined : "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function formatTimeJa(value, options = {}) {
    if (!value) return options.emptyText || "未設定";

    const text = String(value).trim();

    if (/^\d{2}:\d{2}/.test(text)) {
      return text.slice(0, 5);
    }

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      return options.emptyText || text;
    }

    return new Intl.DateTimeFormat(APP.locale, {
      timeZone: APP.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function formatUpdatedTime(value) {
    if (!value) return "未更新";
    return `更新 ${formatDateTimeJa(value, {
      hideYear: true,
      hideWeekday: true,
    })}`;
  }

  function buildUrl(path, params = {}) {
    const normalizedPath = String(path || "/").startsWith("/")
      ? String(path || "/")
      : `/${String(path || "")}`;

    const url = new URL(`${URLS.workerBase}${normalizedPath}`);

    Object.entries(params).forEach(function appendParameter(entry) {
      const key = entry[0];
      const value = entry[1];

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        url.searchParams.set(key, String(value));
      }
    });

    return url.toString();
  }

  function endpointUrl(endpointKey, params = {}) {
    const endpoint = ENDPOINTS[endpointKey];
    if (!endpoint) {
      throw new Error(`未登録のAPIです: ${endpointKey}`);
    }
    return buildUrl(endpoint, params);
  }

  function withFacility(payload = {}) {
    return {
      facility_code: APP.facilityCode,
      ...payload,
    };
  }

  function adminHeaders(adminCode = getAdminCode()) {
    const headers = {
      "Content-Type": "application/json",
    };

    if (adminCode) {
      headers["X-Admin-Code"] = String(adminCode);
    }

    return headers;
  }

  async function parseApiResponse(response) {
    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        data = {
          ok: false,
          error: text,
        };
      }
    }

    if (!response.ok) {
      const message =
        data?.error ||
        data?.message ||
        `通信に失敗しました。HTTP ${response.status}`;

      const apiError = new Error(message);
      apiError.status = response.status;
      apiError.data = data;
      throw apiError;
    }

    return data ?? {
      ok: true,
    };
  }

  async function request(endpointKey, options = {}) {
    const endpoint = ENDPOINTS[endpointKey];
    if (!endpoint) {
      throw new Error(`未登録のAPIです: ${endpointKey}`);
    }

    const method = String(options.method || "GET").toUpperCase();
    const isAdmin = Boolean(options.admin);
    const params = {
      facility_code: APP.facilityCode,
      ...(options.params || {}),
    };

    const headers = {
      Accept: "application/json",
      ...(isAdmin ? adminHeaders(options.adminCode) : {}),
      ...(options.headers || {}),
    };

    const fetchOptions = {
      method,
      headers,
      cache: "no-store",
    };

    if (!["GET", "HEAD"].includes(method)) {
      headers["Content-Type"] = "application/json";
      const payload = withFacility(options.body || {});

      if (isAdmin) {
        payload.operator_name =
          payload.operator_name ||
          getOperatorName("スタッフ");
        payload.device_type =
          payload.device_type ||
          getDeviceType();
      }

      fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(buildUrl(endpoint, params), fetchOptions);
    return parseApiResponse(response);
  }

  function apiGet(endpointKey, params = {}, options = {}) {
    return request(endpointKey, {
      ...options,
      method: "GET",
      params,
    });
  }

  function apiPost(endpointKey, body = {}, options = {}) {
    return request(endpointKey, {
      ...options,
      method: "POST",
      body,
    });
  }

  function adminGet(endpointKey, params = {}, options = {}) {
    return request(endpointKey, {
      ...options,
      admin: true,
      method: "GET",
      params,
    });
  }

  function adminPost(endpointKey, body = {}, options = {}) {
    return request(endpointKey, {
      ...options,
      admin: true,
      method: "POST",
      body,
    });
  }

  async function copyText(value) {
    const text = normalizeNewlines(value);
    if (!text) {
      throw new Error("コピーする内容がありません。");
    }

    if (global.navigator?.clipboard?.writeText) {
      await global.navigator.clipboard.writeText(text);
      return true;
    }

    if (!global.document) {
      throw new Error("この環境ではコピーできません。");
    }

    const textArea = global.document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    global.document.body.appendChild(textArea);
    textArea.select();

    let copied = false;
    try {
      copied = global.document.execCommand("copy");
    } finally {
      textArea.remove();
    }

    if (!copied) {
      throw new Error("コピーに失敗しました。");
    }

    return true;
  }

  function setButtonLoading(button, loading, options = {}) {
    if (!button) return function noop() {};

    const originalText =
      button.dataset.dproOriginalText ||
      button.textContent ||
      "";

    if (!button.dataset.dproOriginalText) {
      button.dataset.dproOriginalText = originalText;
    }

    if (loading) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = options.loadingText || "処理中…";
    } else {
      button.disabled = Boolean(options.keepDisabled);
      button.removeAttribute("aria-busy");
      button.textContent =
        options.completedText ||
        button.dataset.dproOriginalText ||
        originalText;
    }

    return function restoreButton() {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent =
        button.dataset.dproOriginalText ||
        originalText;
    };
  }

  async function runWithButton(button, task, options = {}) {
    const restore = setButtonLoading(button, true, options);

    try {
      return await task();
    } finally {
      restore();
    }
  }

  function createToastContainer() {
    if (!global.document) return null;

    let container = global.document.getElementById("dpro-toast-container");
    if (container) return container;

    container = global.document.createElement("div");
    container.id = "dpro-toast-container";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-atomic", "true");
    Object.assign(container.style, {
      position: "fixed",
      top: "16px",
      right: "16px",
      zIndex: "99999",
      display: "grid",
      gap: "10px",
      width: "min(92vw, 360px)",
      pointerEvents: "none",
    });

    global.document.body.appendChild(container);
    return container;
  }

  function showToast(message, options = {}) {
    const text = cleanText(message, 500);
    if (!text) return null;

    if (!global.document) {
      console.log(text);
      return null;
    }

    const container = createToastContainer();
    const toast = global.document.createElement("div");
    const type = options.type || "success";

    const backgroundByType = {
      success: "#166534",
      error: "#b91c1c",
      warning: "#92400e",
      info: "#1d4ed8",
    };

    toast.textContent = text;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    Object.assign(toast.style, {
      padding: "13px 15px",
      borderRadius: "12px",
      background: backgroundByType[type] || backgroundByType.info,
      color: "#ffffff",
      boxShadow: "0 10px 25px rgba(0,0,0,.18)",
      fontSize: "14px",
      lineHeight: "1.5",
      fontWeight: "700",
      opacity: "0",
      transform: "translateY(-8px)",
      transition: "opacity .18s ease, transform .18s ease",
      pointerEvents: "auto",
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
    });

    container.appendChild(toast);

    global.requestAnimationFrame(function revealToast() {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    const duration = Number(options.duration || 3200);
    const timer = global.setTimeout(function hideToast() {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-8px)";
      global.setTimeout(function removeToast() {
        toast.remove();
      }, 220);
    }, duration);

    toast.addEventListener("click", function dismissToast() {
      global.clearTimeout(timer);
      toast.remove();
    });

    return toast;
  }

  function showSuccess(message, options = {}) {
    return showToast(message, {
      ...options,
      type: "success",
    });
  }

  function showError(error, options = {}) {
    const message =
      typeof error === "string"
        ? error
        : error?.message || "処理に失敗しました。";

    return showToast(message, {
      ...options,
      type: "error",
      duration: options.duration || 5000,
    });
  }

  function showWarning(message, options = {}) {
    return showToast(message, {
      ...options,
      type: "warning",
    });
  }

  function showInfo(message, options = {}) {
    return showToast(message, {
      ...options,
      type: "info",
    });
  }

  function getQueryParams() {
    if (!global.location) return {};

    const params = new URLSearchParams(global.location.search);
    return Object.fromEntries(params.entries());
  }

  function getQueryParam(name, fallback = "") {
    const params = getQueryParams();
    return params[name] ?? fallback;
  }

  function setQueryParams(values = {}, options = {}) {
    if (!global.location || !global.history) return false;

    const url = new URL(global.location.href);

    Object.entries(values).forEach(function updateQuery(entry) {
      const key = entry[0];
      const value = entry[1];

      if (value === null || value === undefined || value === "") {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, String(value));
      }
    });

    const method = options.replace === false ? "pushState" : "replaceState";
    global.history[method]({}, "", url.toString());
    return true;
  }

  function labelOf(collection, key, fallback = "") {
    return collection[key]?.label || fallback || key || "";
  }

  function statusLabel(status) {
    return labelOf(ATTENDANCE_STATUSES, status, "状態未設定");
  }

  function requestTypeLabel(type) {
    return labelOf(REQUEST_TYPES, type, "その他");
  }

  function requestStatusLabel(status) {
    return labelOf(REQUEST_STATUSES, status, "状態未設定");
  }

  function taskStatusLabel(status) {
    return labelOf(TASK_STATUSES, status, "状態未設定");
  }

  function taskTypeLabel(type) {
    return labelOf(TASK_TYPES, type, "その他");
  }

  function transportModeLabel(mode) {
    return labelOf(TRANSPORT_MODES, mode, "送迎未設定");
  }

  function pickupStatusLabel(status) {
    return labelOf(PICKUP_STATUSES, status, "お迎え未設定");
  }

  function dropoffStatusLabel(status) {
    return labelOf(DROPOFF_STATUSES, status, "お帰り未設定");
  }

  function dailyCheckLabel(checkType) {
    return labelOf(DAILY_CHECKS, checkType, "確認項目");
  }

  function priorityLabel(priority) {
    return labelOf(PRIORITIES, priority, "通常");
  }

  function sortByDefinition(rows, key, definition) {
    return [...(rows || [])].sort(function compareRows(left, right) {
      const leftOrder = definition[left?.[key]]?.order ?? 999;
      const rightOrder = definition[right?.[key]]?.order ?? 999;
      return leftOrder - rightOrder;
    });
  }

  function memberUrl(phone, userNumber, extraParams = {}) {
    const url = new URL(URLS.member);
    const normalized = normalizePhone(phone);

    if (normalized) url.searchParams.set("phone", normalized);
    if (userNumber) url.searchParams.set("user_number", String(userNumber));

    Object.entries(extraParams).forEach(function appendExtra(entry) {
      const key = entry[0];
      const value = entry[1];
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    return url.toString();
  }

  function pageUrl(pageName, params = {}) {
    const target = URLS[pageName];
    if (!target) {
      throw new Error(`未登録の画面URLです: ${pageName}`);
    }

    const url = new URL(target);
    Object.entries(params).forEach(function appendParam(entry) {
      const key = entry[0];
      const value = entry[1];
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    return url.toString();
  }

  const API = Object.freeze({
    request,
    get: apiGet,
    post: apiPost,
    adminGet,
    adminPost,
    buildUrl,
    endpointUrl,
    parseResponse: parseApiResponse,
  });

  const storage = Object.freeze({
    get: getStoredValue,
    set: setStoredValue,
    remove: removeStoredValue,
    getAdminCode,
    saveAdminCode,
    clearAdminCode,
    getOperatorName,
    saveOperatorName,
    getDeviceType,
    saveDeviceType,
  });

  const utils = Object.freeze({
    normalizePhone,
    formatPhone,
    normalizeNewlines,
    escapeHtml,
    cleanText,
    isValidDateText,
    todayJst,
    addDays,
    formatDateJa,
    formatDateShortJa,
    formatDateTimeJa,
    formatTimeJa,
    formatUpdatedTime,
    copyText,
    setButtonLoading,
    runWithButton,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    getQueryParams,
    getQueryParam,
    setQueryParams,
    labelOf,
    statusLabel,
    requestTypeLabel,
    requestStatusLabel,
    taskStatusLabel,
    taskTypeLabel,
    transportModeLabel,
    pickupStatusLabel,
    dropoffStatusLabel,
    dailyCheckLabel,
    priorityLabel,
    sortByDefinition,
    memberUrl,
    pageUrl,
    detectDeviceType,
  });

  const CONFIG = Object.freeze({
    APP,
    URLS,
    ENDPOINTS,
    STORAGE_KEYS,
    ATTENDANCE_STATUSES,
    DAILY_CHECKS,
    REQUEST_TYPES,
    REQUEST_STATUSES,
    TASK_TYPES,
    TASK_STATUSES,
    TRANSPORT_MODES,
    PICKUP_STATUSES,
    DROPOFF_STATUSES,
    PRIORITIES,
    DEMO,
    API,
    storage,
    utils,
  });

  global.DPRO_DAYCARE_CONFIG = CONFIG;
  global.DPRODaycare = CONFIG;

  if (global.document) {
    global.document.documentElement.dataset.dproDaycareVersion =
      APP.appVersion;
  }

  console.info(
    `[${APP.serviceName}] config loaded: ${APP.appVersion}`,
  );
})(typeof window !== "undefined" ? window : globalThis);

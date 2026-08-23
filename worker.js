/**
 * ============================================================
 * DPRO デイサービス LINE
 * STEP DAYCARE-3
 * Cloudflare Worker API 完全版
 * Version: DAYCARE-3-R5-PRODUCT-READY-R3-LINE-IDTOKEN-20260823
 * ============================================================
 *
 * Cloudflare Worker名:
 *   dpro-dayservice-line-api
 *
 * Worker URL:
 *   https://dpro-dayservice-line-api.dpromstk2000.workers.dev
 *
 * 必須Secrets:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 任意Variables:
 *   DEFAULT_FACILITY_CODE = dpro_dayservice_demo
 *   ALLOWED_ORIGINS = https://dpromstk2000-lab.github.io
 *   LINE_LOGIN_CHANNEL_ID = <customer LINE Login Channel ID; contract-time server binding>
 *
 * 重要:
 *   SUPABASE_SERVICE_ROLE_KEYは、HTML・config.js・GitHubへ絶対に置かない。
 *   Cloudflare WorkerのSettings → Variables and Secretsで暗号化保存する。
 *
 * このWorkerは介護請求・法定介護記録・医療記録を扱わない。
 * 家族連絡、お休み連絡、利用日変更希望、送迎案内、
 * 今日の利用者確認、簡易申し送りを対象とする。
 */

const SERVICE_NAME = "DPRO Dayservice LINE API";
const VERSION = "DAYCARE-3-R5-PRODUCT-READY-R3-LINE-IDTOKEN-20260823";
const FRONTEND_VERSION = "DAYCARE screen set: FAMILY-6 / MEMBER-7 / OWNER-8 / IPAD-9 / SYSTEM-CHECK-10";
const DATABASE_VERSION_EXPECTED = "DAYCARE-DB-R2-20260823-01";
const ADAPTER_VERSION = "DPRO-CONTROL-ADAPTER-1.0";
const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  "https://dpromstk2000-lab.github.io",
]);
const DEFAULT_FACILITY_CODE = "dpro_dayservice_demo";
const JST_TIME_ZONE = "Asia/Tokyo";

const TABLES = Object.freeze({
  facilities: "dayservice_facilities",
  businessDays: "dayservice_business_days",
  specialDays: "dayservice_special_days",
  users: "dayservice_users",
  families: "dayservice_family_members",
  userFamilies: "dayservice_user_families",
  staff: "dayservice_staff",
  servicePlans: "dayservice_service_plans",
  schedules: "dayservice_use_schedules",
  attendanceLogs: "dayservice_attendance_logs",
  dailyChecks: "dayservice_daily_checks",
  transports: "dayservice_transport_schedules",
  familyRequests: "dayservice_family_requests",
  tasks: "dayservice_tasks",
  messageTemplates: "dayservice_message_templates",
  messageLogs: "dayservice_message_logs",
  operationLogs: "dayservice_operation_logs",
  announcements: "dayservice_announcements",
  notes: "dayservice_care_notes_simple",
  systemVersions: "dayservice_system_versions",
  lineIdentities: "dayservice_line_identities",
});

const VALID_ATTENDANCE_STATUSES = new Set([
  "scheduled",
  "absent",
  "arrived",
  "in_service",
  "ready_to_go_home",
  "transport_departed",
  "completed",
  "cancelled",
]);

const VALID_REQUEST_STATUSES = new Set([
  "new",
  "acknowledged",
  "in_progress",
  "resolved",
  "rejected",
  "cancelled",
]);

const VALID_TASK_STATUSES = new Set([
  "open",
  "in_progress",
  "completed",
  "cancelled",
]);

const VALID_REQUEST_TYPES = new Set([
  "absence",
  "change_date",
  "contact",
  "transport_question",
  "item_question",
  "other",
]);

class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors,
      });
    }

    try {
      validateEnvironment(env);

      const url = new URL(request.url);
      const path = normalizePath(url.pathname);
      const method = request.method.toUpperCase();
      const body = method === "POST" || method === "PUT" || method === "PATCH"
        ? await readJsonBody(request)
        : {};

      const result = await routeRequest({
        request,
        env,
        url,
        path,
        method,
        body,
      });

      return jsonResponse(result.body, result.status ?? 200, cors);
    } catch (error) {
      console.error("DPRO Dayservice API error:", error);

      if (error instanceof ApiError) {
        return jsonResponse(
          {
            ok: false,
            service: SERVICE_NAME,
            version: VERSION,
            error: error.message,
            details: error.details,
          },
          error.status,
          cors,
        );
      }

      return jsonResponse(
        {
          ok: false,
          service: SERVICE_NAME,
          version: VERSION,
          error: "サーバー処理中にエラーが発生しました。",
        },
        500,
        cors,
      );
    }
  },
};

async function routeRequest(context) {
  const { request, env, url, path, method, body } = context;

  if ((path === "/" || path === "/api") && method === "GET") {
    return {
      body: {
        ok: true,
        service: SERVICE_NAME,
        version: VERSION,
        production_guard: true,
        timezone: JST_TIME_ZONE,
        endpoints: {
          health: "/api/health",
          public_config: "/api/public/config",
          public_calendar: "/api/public/calendar",
          line_identity_verify: "/api/line/verify",
          public_absence: "/api/public/absence",
          public_change_request: "/api/public/change-request",
          public_contact: "/api/public/contact",
          member_profile: "/api/member/profile",
          admin_demo_prepare: "/api/admin/demo/prepare",
          admin_dashboard: "/api/admin/dashboard",
          admin_day: "/api/admin/day",
          admin_search: "/api/admin/search",
          admin_user_detail: "/api/admin/user-detail",
          admin_schedule_create: "/api/admin/schedules/create",
          admin_attendance_status: "/api/admin/attendance/status",
          admin_daily_check_status: "/api/admin/daily-checks/status",
          admin_integration_check: "/api/admin/integration-check",
          admin_transport_status: "/api/admin/transport/status",
          admin_task_status: "/api/admin/tasks/status",
          admin_message_log_copy: "/api/admin/messages/log-copy",
          admin_family_request_status: "/api/admin/family-requests/status",
          admin_phone_normalize_check: "/api/admin/phone-normalize-check",
        },
      },
    };
  }

  if (path === "/api/health" && method === "GET") {
    return {
      body: await handleHealth(env, url),
    };
  }

  if (path === "/api/public/config" && method === "GET") {
    return {
      body: await handlePublicConfig(env, url),
    };
  }

  if (path === "/api/public/calendar" && method === "GET") {
    return {
      body: await handlePublicCalendar(env, url),
    };
  }

  if (path === "/api/line/verify" && method === "POST") {
    return {
      body: await handleLineIdentityVerify(env, url, body),
    };
  }

  if (path === "/api/public/absence" && method === "POST") {
    return {
      status: 201,
      body: await handlePublicAbsence(env, body),
    };
  }

  if (path === "/api/public/change-request" && method === "POST") {
    return {
      status: 201,
      body: await handlePublicChangeRequest(env, body),
    };
  }

  if (path === "/api/public/contact" && method === "POST") {
    return {
      status: 201,
      body: await handlePublicContact(env, body),
    };
  }

  if (path === "/api/member/profile" && method === "GET") {
    return {
      body: await handleMemberProfile(env, url),
    };
  }

  if (path.startsWith("/api/admin/")) {
    const facility = await requireAdmin({
      request,
      env,
      url,
      body,
    });

    if (path === "/api/admin/demo/prepare" && method === "POST") {
      return {
        body: await handleAdminDemoPrepare(env, facility),
      };
    }

    if (path === "/api/admin/dashboard" && method === "GET") {
      return {
        body: await handleAdminDashboard(env, facility, url),
      };
    }

    if (path === "/api/admin/day" && method === "GET") {
      return {
        body: await handleAdminDay(env, facility, url),
      };
    }

    if (path === "/api/admin/search" && method === "GET") {
      return {
        body: await handleAdminSearch(env, facility, url),
      };
    }

    if (path === "/api/admin/user-detail" && method === "GET") {
      return {
        body: await handleAdminUserDetail(env, facility, url),
      };
    }

    if (path === "/api/admin/schedules/create" && method === "POST") {
      return {
        status: 201,
        body: await handleAdminScheduleCreate(env, facility, body),
      };
    }

    if (path === "/api/admin/attendance/status" && method === "POST") {
      return {
        body: await handleAdminAttendanceStatus(env, facility, body),
      };
    }

    if (path === "/api/admin/daily-checks/status" && method === "POST") {
      return {
        body: await handleAdminDailyCheckStatus(env, facility, body),
      };
    }

    if (path === "/api/admin/integration-check" && method === "GET") {
      return {
        body: await handleAdminIntegrationCheck(env, facility, url),
      };
    }

    if (path === "/api/admin/transport/status" && method === "POST") {
      return {
        body: await handleAdminTransportStatus(env, facility, body),
      };
    }

    if (path === "/api/admin/tasks/status" && method === "POST") {
      return {
        body: await handleAdminTaskStatus(env, facility, body),
      };
    }

    if (path === "/api/admin/messages/log-copy" && method === "POST") {
      return {
        status: 201,
        body: await handleAdminMessageLogCopy(env, facility, body),
      };
    }

    if (path === "/api/admin/family-requests/status" && method === "POST") {
      return {
        body: await handleAdminFamilyRequestStatus(env, facility, body),
      };
    }

    if (path === "/api/admin/phone-normalize-check" && method === "GET") {
      return {
        body: handlePhoneNormalizeCheck(),
      };
    }
  }

  throw new ApiError(404, "指定されたAPIが見つかりません。");
}

/* ============================================================
 * Health / Config
 * ============================================================
 */

async function handleHealth(env, url) {
  const facilityCode = getFacilityCode(url, env);
  let database = {
    ok: false,
    facility_count: 0,
  };
  let versionContract = null;

  try {
    const [facilities, contract] = await Promise.all([
      supabaseRequest(env, TABLES.facilities, {
        query: {
          select: "id,facility_code,facility_name,is_active",
          facility_code: `eq.${facilityCode}`,
          limit: "1",
        },
      }),
      getVersionContract(env),
    ]);
    versionContract = contract;
    database = {
      ok: true,
      facility_count: facilities.length,
      facility_found: facilities.length === 1,
      facility_name: facilities[0]?.facility_name ?? null,
    };
  } catch (error) {
    database = {
      ok: false,
      facility_count: 0,
      error: error.message,
    };
  }

  const current = versionContract?.current || {};
  return {
    ok: database.ok && versionContract?.versionsAligned === true,
    service: SERVICE_NAME,
    version: VERSION,
    workerVersion: current.workerVersion || VERSION,
    databaseVersion: current.databaseVersion || null,
    frontendVersion: current.frontendVersion || FRONTEND_VERSION,
    adapterVersion: current.adapterVersion || ADAPTER_VERSION,
    versionsAligned: versionContract?.versionsAligned === true,
    versionContract,
    database,
    production_guard: true,
    demo_prepare_guard: true,
    integration_check: true,
    cors_allowlist: getAllowedOrigins(env),
    features: {
      family_portal: true,
      member_card: true,
      owner_pc: true,
      owner_ipad: true,
      attendance_status_api: true,
      daily_check_status_api: true,
      transport_status_api: true,
      special_day_calendar: true,
      line_identity_server_verify: true,
      line_identity_id_token_sub_authority: true,
    },
    timezone: JST_TIME_ZONE,
    time: new Date().toISOString(),
  };
}

async function handlePublicConfig(env, url) {
  const facilityCode = getFacilityCode(url, env);
  const facility = await getFacilityByCode(env, facilityCode);

  const [businessDays, specialDays, announcements] = await Promise.all([
    supabaseRequest(env, TABLES.businessDays, {
      query: {
        select: [
          "weekday",
          "is_open",
          "service_start_time",
          "service_end_time",
          "pickup_start_time",
          "pickup_end_time",
          "dropoff_start_time",
          "dropoff_end_time",
          "note",
        ].join(","),
        facility_id: `eq.${facility.id}`,
        order: "weekday.asc",
      },
    }),
    supabaseRequest(env, TABLES.specialDays, {
      query: {
        select: [
          "special_date",
          "day_type",
          "service_start_time",
          "service_end_time",
          "pickup_start_time",
          "pickup_end_time",
          "dropoff_start_time",
          "dropoff_end_time",
          "title",
          "note",
        ].join(","),
        facility_id: `eq.${facility.id}`,
        order: "special_date.asc",
      },
    }),
    getActiveAnnouncements(env, facility.id, "family"),
  ]);

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    facility: publicFacility(facility),
    business_days: businessDays,
    special_days: specialDays,
    announcements,
  };
}

async function handlePublicCalendar(env, url) {
  const facilityCode = getFacilityCode(url, env);
  const date = requireDate(url.searchParams.get("date") || todayJst(), "確認日");
  const facility = await getFacilityByCode(env, facilityCode);
  const weekday = weekdayFromIsoDate(date);
  const [weeklyRows, specialRows] = await Promise.all([
    supabaseRequest(env, TABLES.businessDays, {
      query: {
        select: "weekday,is_open,service_start_time,service_end_time,pickup_start_time,pickup_end_time,dropoff_start_time,dropoff_end_time,note",
        facility_id: `eq.${facility.id}`,
        weekday: `eq.${weekday}`,
        limit: "1",
      },
    }),
    supabaseRequest(env, TABLES.specialDays, {
      query: {
        select: "special_date,day_type,service_start_time,service_end_time,pickup_start_time,pickup_end_time,dropoff_start_time,dropoff_end_time,title,note",
        facility_id: `eq.${facility.id}`,
        special_date: `eq.${date}`,
        limit: "1",
      },
    }),
  ]);
  const effective = resolveEffectiveBusinessDay(date, weeklyRows[0] || null, specialRows[0] || null);
  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    date,
    facility: publicFacility(facility),
    effective,
  };
}

async function handleLineIdentityVerify(env, url, body) {
  const idToken = cleanText(body?.id_token, 12000);
  if (!idToken) {
    throw new ApiError(400, "LINE ID Tokenが必要です。", {
      code: "id_token_required",
    });
  }

  // Contract-time binding only. The expected LINE Login Channel ID must stay on the server.
  const expectedChannelId = cleanText(env.LINE_LOGIN_CHANNEL_ID, 200);
  if (!expectedChannelId) {
    throw new ApiError(409, "LINE Login Channelが未設定です。", {
      code: "contract_binding_required",
    });
  }

  const verifyBody = new URLSearchParams({
    id_token: idToken,
    client_id: expectedChannelId,
  });
  const verifyResponse = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: verifyBody.toString(),
  });

  if (!verifyResponse.ok) {
    throw new ApiError(401, "LINE ID Tokenの本人確認に失敗しました。", {
      code: "id_token_verification_failed",
    });
  }

  const verified = await verifyResponse.json();
  const verifiedSub = cleanText(verified?.sub, 200);
  const verifiedAud = verified?.aud;
  const expiresAt = Number(verified?.exp);
  const nowEpoch = Math.floor(Date.now() / 1000);
  const audienceMatches = Array.isArray(verifiedAud)
    ? verifiedAud.map(String).includes(expectedChannelId)
    : String(verifiedAud || "") === expectedChannelId;

  if (!verifiedSub) {
    throw new ApiError(401, "LINE ID Tokenのsubが確認できません。", {
      code: "verified_sub_missing",
    });
  }
  if (!audienceMatches) {
    throw new ApiError(401, "LINE ID Tokenのaudが一致しません。", {
      code: "audience_mismatch",
    });
  }
  if (!Number.isFinite(expiresAt) || expiresAt <= nowEpoch) {
    throw new ApiError(401, "LINE ID Tokenの有効期限が切れています。", {
      code: "id_token_expired",
    });
  }

  const facilityCode = getFacilityCode(url, env);
  const facility = await getFacilityByCode(env, facilityCode);
  const identityHash = await sha256Hex(verifiedSub);
  const bindings = await supabaseRequest(env, TABLES.lineIdentities, {
    query: {
      select: "id,family_member_id,user_id,is_active,bound_at",
      facility_id: `eq.${facility.id}`,
      line_user_id_hash: `eq.${identityHash}`,
      is_active: "eq.true",
      limit: "1",
    },
  });

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    verified: true,
    identity_source: "LINE_ID_TOKEN_OAUTH_VERIFY",
    identity_authority: "verified_sub",
    server_verified: true,
    audience_verified: true,
    expiry_verified: true,
    client_line_user_id_trusted: false,
    bound: Boolean(bindings[0]),
    customer_binding_deferred: !bindings[0],
  };
}

async function getVersionContract(env) {
  const rows = await supabaseRequest(env, TABLES.systemVersions, {
    query: {
      select: "database_version,adapter_version",
      id: "eq.current",
      limit: "1",
    },
  });
  const row = rows[0] || {};
  const current = {
    workerVersion: VERSION,
    databaseVersion: row.database_version || null,
    frontendVersion: FRONTEND_VERSION,
    adapterVersion: row.adapter_version || ADAPTER_VERSION,
  };
  const expected = {
    workerVersion: VERSION,
    databaseVersion: DATABASE_VERSION_EXPECTED,
    frontendVersion: FRONTEND_VERSION,
    adapterVersion: ADAPTER_VERSION,
  };
  const versionsAligned = Object.keys(expected).every((key) => current[key] === expected[key]);
  return { current, expected, versionsAligned };
}

function resolveEffectiveBusinessDay(date, weekly, special) {
  if (special) {
    if (special.day_type === "closed") {
      return { date, source: "special_day", day_type: "closed", is_open: false, title: special.title || null, note: special.note || null };
    }
    const base = weekly || {};
    return {
      date, source: "special_day", day_type: special.day_type, is_open: true,
      service_start_time: special.service_start_time || base.service_start_time || null,
      service_end_time: special.service_end_time || base.service_end_time || null,
      pickup_start_time: special.pickup_start_time || base.pickup_start_time || null,
      pickup_end_time: special.pickup_end_time || base.pickup_end_time || null,
      dropoff_start_time: special.dropoff_start_time || base.dropoff_start_time || null,
      dropoff_end_time: special.dropoff_end_time || base.dropoff_end_time || null,
      title: special.title || null, note: special.note || null,
    };
  }
  if (!weekly) return { date, source: "weekly", day_type: "unconfigured", is_open: false };
  return { date, source: "weekly", day_type: weekly.is_open ? "open" : "closed", is_open: Boolean(weekly.is_open), ...weekly };
}

function weekdayFromIsoDate(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/* ============================================================
 * Public / Family
 * ============================================================
 */

async function handlePublicAbsence(env, body) {
  const facilityCode = body.facility_code || DEFAULT_FACILITY_CODE;
  const targetDate = requireDate(body.target_date, "お休みする日");
  ensureNotPastDate(targetDate);

  const member = await resolveMember(env, {
    facilityCode,
    phone: body.phone,
    userNumber: body.user_number,
  });

  const reason = cleanText(body.reason, 200) || "理由未入力";
  const message = normalizeNewlines(cleanText(body.message, 2000));
  const subject = `お休み連絡：${member.user.full_name}様 ${targetDate}`;

  const inserted = await supabaseRequest(env, TABLES.familyRequests, {
    method: "POST",
    body: {
      facility_id: member.facility.id,
      user_id: member.user.id,
      family_member_id: member.family.id,
      request_type: "absence",
      request_status: "new",
      request_source: body.request_source === "phone" ? "phone" : "line",
      target_date: targetDate,
      subject,
      message: normalizeNewlines(
        [reason ? `理由：${reason}` : "", message].filter(Boolean).join("\n"),
      ),
      is_demo: Boolean(member.user.is_demo),
      created_by: member.family.full_name,
      updated_by: member.family.full_name,
    },
    prefer: "return=representation",
  });

  const existingSchedules = await supabaseRequest(env, TABLES.schedules, {
    query: {
      select: "id,status",
      user_id: `eq.${member.user.id}`,
      service_date: `eq.${targetDate}`,
      limit: "1",
    },
  });

  let schedule;
  if (existingSchedules[0]) {
    const updated = await supabaseRequest(env, TABLES.schedules, {
      method: "PATCH",
      query: {
        id: `eq.${existingSchedules[0].id}`,
      },
      body: {
        status: "absent",
        absence_reason: reason,
        current_status_note: "家族からお休み連絡を受付",
        updated_by: member.family.full_name,
      },
      prefer: "return=representation",
    });
    schedule = updated[0];
  } else {
    const created = await supabaseRequest(env, TABLES.schedules, {
      method: "POST",
      body: {
        facility_id: member.facility.id,
        user_id: member.user.id,
        service_date: targetDate,
        status: "absent",
        source: "family_request",
        transport_mode: member.user.standard_transport_mode,
        absence_reason: reason,
        schedule_note: "家族からお休み連絡を受付",
        current_status_note: "お休み",
        is_demo: Boolean(member.user.is_demo),
        created_by: member.family.full_name,
        updated_by: member.family.full_name,
      },
      prefer: "return=representation",
    });
    schedule = created[0];
  }

  await createTaskIfMissing(env, {
    facilityId: member.facility.id,
    userId: member.user.id,
    scheduleId: schedule?.id ?? null,
    familyRequestId: inserted[0].id,
    taskType: "reply_absence",
    title: `${member.user.full_name}様のお休み連絡を確認`,
    description: `${targetDate}のお休み連絡に返信してください。`,
    priority: targetDate === todayJst() ? "high" : "normal",
    dueAt: targetDate === todayJst() ? new Date().toISOString() : null,
    isDemo: Boolean(member.user.is_demo),
  });

  await logOperation(env, {
    facilityId: member.facility.id,
    actorType: "family",
    actorId: member.family.id,
    actorName: member.family.full_name,
    action: "public_absence_created",
    targetTable: TABLES.familyRequests,
    targetId: inserted[0].id,
    deviceType: "mobile",
    isDemo: Boolean(member.user.is_demo),
    details: {
      user_id: member.user.id,
      target_date: targetDate,
    },
  });

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    message: "お休み連絡を受け付けました。施設から確認の連絡がある場合があります。",
    request: sanitizeFamilyRequest(inserted[0]),
    schedule: {
      id: schedule?.id ?? null,
      service_date: targetDate,
      status: "absent",
    },
  };
}

async function handlePublicChangeRequest(env, body) {
  const facilityCode = body.facility_code || DEFAULT_FACILITY_CODE;
  const targetDate = requireDate(body.target_date, "現在の利用予定日");
  const requestedChangeDate = requireDate(
    body.requested_change_date,
    "希望する利用日",
  );

  ensureNotPastDate(targetDate);
  ensureNotPastDate(requestedChangeDate);

  if (targetDate === requestedChangeDate) {
    throw new ApiError(400, "現在の利用予定日と希望日は別の日を選択してください。");
  }

  const member = await resolveMember(env, {
    facilityCode,
    phone: body.phone,
    userNumber: body.user_number,
  });

  const reason = cleanText(body.reason, 500);
  const message = normalizeNewlines(cleanText(body.message, 2000));
  const subject = `利用日変更希望：${member.user.full_name}様`;

  const inserted = await supabaseRequest(env, TABLES.familyRequests, {
    method: "POST",
    body: {
      facility_id: member.facility.id,
      user_id: member.user.id,
      family_member_id: member.family.id,
      request_type: "change_date",
      request_status: "new",
      request_source: body.request_source === "phone" ? "phone" : "line",
      target_date: targetDate,
      requested_change_date: requestedChangeDate,
      subject,
      message: normalizeNewlines(
        [
          `現在の利用予定日：${targetDate}`,
          `希望日：${requestedChangeDate}`,
          reason ? `理由：${reason}` : "",
          message,
        ].filter(Boolean).join("\n"),
      ),
      is_demo: Boolean(member.user.is_demo),
      created_by: member.family.full_name,
      updated_by: member.family.full_name,
    },
    prefer: "return=representation",
  });

  await createTaskIfMissing(env, {
    facilityId: member.facility.id,
    userId: member.user.id,
    scheduleId: null,
    familyRequestId: inserted[0].id,
    taskType: "reply_change",
    title: `${member.user.full_name}様の利用日変更希望を確認`,
    description: `${targetDate}から${requestedChangeDate}への変更希望です。`,
    priority: "normal",
    dueAt: null,
    isDemo: Boolean(member.user.is_demo),
  });

  await logOperation(env, {
    facilityId: member.facility.id,
    actorType: "family",
    actorId: member.family.id,
    actorName: member.family.full_name,
    action: "public_change_request_created",
    targetTable: TABLES.familyRequests,
    targetId: inserted[0].id,
    deviceType: "mobile",
    isDemo: Boolean(member.user.is_demo),
    details: {
      user_id: member.user.id,
      target_date: targetDate,
      requested_change_date: requestedChangeDate,
    },
  });

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    message: "利用日変更希望を受け付けました。施設で確認後、改めてご連絡します。",
    request: sanitizeFamilyRequest(inserted[0]),
  };
}

async function handlePublicContact(env, body) {
  const facilityCode = body.facility_code || DEFAULT_FACILITY_CODE;
  const member = await resolveMember(env, {
    facilityCode,
    phone: body.phone,
    userNumber: body.user_number,
  });

  const requestedType = cleanText(body.request_type, 50) || "contact";
  const requestType = VALID_REQUEST_TYPES.has(requestedType)
    ? requestedType
    : "other";
  const subject = cleanText(body.subject, 200)
    || `施設への連絡：${member.user.full_name}様`;
  const message = normalizeNewlines(cleanText(body.message, 3000));

  if (!message) {
    throw new ApiError(400, "施設への連絡内容を入力してください。");
  }

  const inserted = await supabaseRequest(env, TABLES.familyRequests, {
    method: "POST",
    body: {
      facility_id: member.facility.id,
      user_id: member.user.id,
      family_member_id: member.family.id,
      request_type: requestType,
      request_status: "new",
      request_source: body.request_source === "phone" ? "phone" : "line",
      target_date: optionalDate(body.target_date),
      subject,
      message,
      is_demo: Boolean(member.user.is_demo),
      created_by: member.family.full_name,
      updated_by: member.family.full_name,
    },
    prefer: "return=representation",
  });

  const taskType = requestType === "item_question"
    ? "send_item_notice"
    : requestType === "transport_question"
      ? "send_transport_time"
      : "follow_up_family";

  await createTaskIfMissing(env, {
    facilityId: member.facility.id,
    userId: member.user.id,
    scheduleId: null,
    familyRequestId: inserted[0].id,
    taskType,
    title: `${member.user.full_name}様の家族連絡を確認`,
    description: subject,
    priority: "normal",
    dueAt: null,
    isDemo: Boolean(member.user.is_demo),
  });

  await logOperation(env, {
    facilityId: member.facility.id,
    actorType: "family",
    actorId: member.family.id,
    actorName: member.family.full_name,
    action: "public_contact_created",
    targetTable: TABLES.familyRequests,
    targetId: inserted[0].id,
    deviceType: "mobile",
    isDemo: Boolean(member.user.is_demo),
    details: {
      user_id: member.user.id,
      request_type: requestType,
    },
  });

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    message: "施設への連絡を受け付けました。",
    request: sanitizeFamilyRequest(inserted[0]),
  };
}

async function handleMemberProfile(env, url) {
  const facilityCode = getFacilityCode(url, env);
  const phone = url.searchParams.get("phone");
  const userNumber = url.searchParams.get("user_number");

  const member = await resolveMember(env, {
    facilityCode,
    phone,
    userNumber,
  });

  const today = todayJst();
  const futureDate = addDaysToDate(today, 90);

  const [plans, schedules, requests, announcements] = await Promise.all([
    supabaseRequest(env, TABLES.servicePlans, {
      query: {
        select: [
          "id",
          "plan_name",
          "standard_weekdays",
          "effective_from",
          "effective_to",
          "transport_mode",
          "default_pickup_time",
          "default_dropoff_time",
          "note",
        ].join(","),
        user_id: `eq.${member.user.id}`,
        is_active: "eq.true",
        order: "effective_from.desc",
      },
    }),
    supabaseRequest(env, TABLES.schedules, {
      query: {
        select: [
          "id",
          "service_date",
          "status",
          "planned_arrival_time",
          "planned_departure_time",
          "transport_mode",
          "absence_reason",
          "schedule_note",
          "current_status_note",
          "updated_at",
        ].join(","),
        user_id: `eq.${member.user.id}`,
        service_date: `gte.${today}`,
        and: `(service_date.lte.${futureDate})`,
        order: "service_date.asc",
        limit: "100",
      },
    }),
    supabaseRequest(env, TABLES.familyRequests, {
      query: {
        select: [
          "id",
          "request_type",
          "request_status",
          "request_source",
          "target_date",
          "requested_change_date",
          "subject",
          "message",
          "response_message",
          "created_at",
          "updated_at",
        ].join(","),
        user_id: `eq.${member.user.id}`,
        order: "created_at.desc",
        limit: "50",
      },
    }),
    getActiveAnnouncements(env, member.facility.id, "family", member.user.id),
  ]);

  const scheduleIds = schedules.map((row) => row.id);
  const transports = scheduleIds.length
    ? await supabaseRequest(env, TABLES.transports, {
        query: {
          select: [
            "id",
            "schedule_id",
            "transport_mode",
            "pickup_planned_at",
            "pickup_status",
            "dropoff_planned_at",
            "dropoff_status",
            "family_notice_note",
            "updated_at",
          ].join(","),
          schedule_id: `in.(${scheduleIds.join(",")})`,
        },
      })
    : [];

  const transportBySchedule = new Map(
    transports.map((row) => [row.schedule_id, row]),
  );

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    facility: publicFacility(member.facility),
    user: {
      id: member.user.id,
      user_number: member.user.user_number,
      full_name: member.user.full_name,
      full_name_kana: member.user.full_name_kana,
      standard_transport_mode: member.user.standard_transport_mode,
      item_note: member.user.item_note,
    },
    family: {
      id: member.family.id,
      full_name: member.family.full_name,
      relationship: member.family.relationship,
      phone: member.family.phone,
      preferred_contact_method: member.family.preferred_contact_method,
    },
    service_plans: plans,
    schedules: schedules.map((schedule) => ({
      ...schedule,
      transport: transportBySchedule.get(schedule.id) ?? null,
    })),
    family_requests: requests.map(sanitizeFamilyRequest),
    announcements,
  };
}

/* ============================================================
 * Admin / Dashboard / Day
 * ============================================================
 */

async function handleAdminDashboard(env, facility, url) {
  const date = optionalDate(url.searchParams.get("date")) || todayJst();

  const [schedules, requests, tasks, transports, notes] = await Promise.all([
    supabaseRequest(env, TABLES.schedules, {
      query: {
        select: "id,user_id,status,service_date,transport_mode",
        facility_id: `eq.${facility.id}`,
        service_date: `eq.${date}`,
        order: "created_at.asc",
      },
    }),
    supabaseRequest(env, TABLES.familyRequests, {
      query: {
        select: [
          "id",
          "user_id",
          "request_type",
          "request_status",
          "subject",
          "target_date",
          "requested_change_date",
          "created_at",
        ].join(","),
        facility_id: `eq.${facility.id}`,
        request_status: "in.(new,acknowledged,in_progress)",
        order: "created_at.desc",
        limit: "100",
      },
    }),
    supabaseRequest(env, TABLES.tasks, {
      query: {
        select: [
          "id",
          "user_id",
          "task_type",
          "title",
          "description",
          "priority",
          "task_status",
          "due_at",
          "created_at",
        ].join(","),
        facility_id: `eq.${facility.id}`,
        task_status: "in.(open,in_progress)",
        order: "priority.desc,created_at.asc",
        limit: "100",
      },
    }),
    supabaseRequest(env, TABLES.transports, {
      query: {
        select: [
          "id",
          "schedule_id",
          "user_id",
          "transport_mode",
          "pickup_planned_at",
          "pickup_status",
          "dropoff_planned_at",
          "dropoff_status",
        ].join(","),
        facility_id: `eq.${facility.id}`,
      },
    }),
    supabaseRequest(env, TABLES.notes, {
      query: {
        select: "id,user_id,note_type,note_text,is_important,is_resolved,created_at",
        facility_id: `eq.${facility.id}`,
        is_resolved: "eq.false",
        order: "is_important.desc,created_at.desc",
        limit: "50",
      },
    }),
  ]);

  const todayScheduleIds = new Set(schedules.map((row) => row.id));
  const todayTransports = transports.filter((row) =>
    todayScheduleIds.has(row.schedule_id)
  );

  const counts = countStatuses(schedules);

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    facility: publicFacility(facility),
    date,
    counts: {
      scheduled_total: schedules.filter((row) => row.status !== "cancelled").length,
      arrived: counts.arrived || 0,
      in_service: counts.in_service || 0,
      absent: counts.absent || 0,
      ready_to_go_home: counts.ready_to_go_home || 0,
      transport_departed: counts.transport_departed || 0,
      completed: counts.completed || 0,
      pending_family_requests: requests.length,
      open_tasks: tasks.length,
      unresolved_notes: notes.length,
      transport_time_missing: todayTransports.filter((row) =>
        row.transport_mode === "facility_transport"
        && (!row.pickup_planned_at || !row.dropoff_planned_at)
      ).length,
    },
    today_tasks: tasks,
    pending_family_requests: requests,
    unresolved_notes: notes,
  };
}

async function handleAdminDay(env, facility, url) {
  const date = optionalDate(url.searchParams.get("date")) || todayJst();

  const schedules = await supabaseRequest(env, TABLES.schedules, {
    query: {
      select: [
        "id",
        "user_id",
        "service_date",
        "status",
        "source",
        "planned_arrival_time",
        "planned_departure_time",
        "actual_arrival_at",
        "actual_departure_at",
        "transport_mode",
        "absence_reason",
        "schedule_note",
        "current_status_note",
        "updated_at",
      ].join(","),
      facility_id: `eq.${facility.id}`,
      service_date: `eq.${date}`,
      order: "planned_arrival_time.asc,created_at.asc",
    },
  });

  const userIds = unique(schedules.map((row) => row.user_id));
  const scheduleIds = schedules.map((row) => row.id);

  const [users, transports, checks, notes, requests] = await Promise.all([
    userIds.length
      ? supabaseRequest(env, TABLES.users, {
          query: {
            select: [
              "id",
              "user_number",
              "full_name",
              "full_name_kana",
              "standard_transport_mode",
              "item_note",
              "facility_note",
            ].join(","),
            id: `in.(${userIds.join(",")})`,
          },
        })
      : [],
    scheduleIds.length
      ? supabaseRequest(env, TABLES.transports, {
          query: {
            select: "*",
            schedule_id: `in.(${scheduleIds.join(",")})`,
          },
        })
      : [],
    scheduleIds.length
      ? supabaseRequest(env, TABLES.dailyChecks, {
          query: {
            select: [
              "id",
              "schedule_id",
              "user_id",
              "check_type",
              "is_completed",
              "completed_at",
              "completed_by_name",
              "note",
              "updated_at",
            ].join(","),
            schedule_id: `in.(${scheduleIds.join(",")})`,
          },
        })
      : [],
    userIds.length
      ? supabaseRequest(env, TABLES.notes, {
          query: {
            select: [
              "id",
              "user_id",
              "schedule_id",
              "note_type",
              "note_text",
              "visibility",
              "is_important",
              "is_resolved",
              "created_by_name",
              "created_at",
            ].join(","),
            user_id: `in.(${userIds.join(",")})`,
            is_resolved: "eq.false",
            order: "is_important.desc,created_at.desc",
          },
        })
      : [],
    userIds.length
      ? supabaseRequest(env, TABLES.familyRequests, {
          query: {
            select: [
              "id",
              "user_id",
              "request_type",
              "request_status",
              "subject",
              "message",
              "created_at",
            ].join(","),
            user_id: `in.(${userIds.join(",")})`,
            request_status: "in.(new,acknowledged,in_progress)",
            order: "created_at.desc",
          },
        })
      : [],
  ]);

  const userMap = new Map(users.map((row) => [row.id, row]));
  const transportMap = new Map(transports.map((row) => [row.schedule_id, row]));
  const checksMap = groupBy(checks, "schedule_id");
  const notesMap = groupBy(notes, "user_id");
  const requestsMap = groupBy(requests, "user_id");

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    facility: publicFacility(facility),
    date,
    counts: countStatuses(schedules),
    users: schedules.map((schedule) => ({
      schedule,
      user: userMap.get(schedule.user_id) ?? null,
      transport: transportMap.get(schedule.id) ?? null,
      daily_checks: checksMap.get(schedule.id) ?? [],
      notes: notesMap.get(schedule.user_id) ?? [],
      pending_family_requests: requestsMap.get(schedule.user_id) ?? [],
    })),
  };
}

/* ============================================================
 * Admin / Search / Detail
 * ============================================================
 */

async function handleAdminSearch(env, facility, url) {
  const rawQuery = cleanText(url.searchParams.get("q"), 100);
  if (!rawQuery) {
    throw new ApiError(400, "検索文字を入力してください。");
  }

  const term = sanitizePostgrestSearch(rawQuery);
  const normalizedPhone = normalizePhone(rawQuery);

  const userSearches = [
    supabaseRequest(env, TABLES.users, {
      query: {
        select: [
          "id",
          "user_number",
          "full_name",
          "full_name_kana",
          "standard_transport_mode",
          "item_note",
          "is_active",
        ].join(","),
        facility_id: `eq.${facility.id}`,
        or: `(full_name.ilike.*${term}*,full_name_kana.ilike.*${term}*,user_number.ilike.*${term}*)`,
        order: "full_name.asc",
        limit: "50",
      },
    }),
  ];

  const familySearches = [
    supabaseRequest(env, TABLES.families, {
      query: {
        select: [
          "id",
          "full_name",
          "full_name_kana",
          "relationship",
          "phone",
          "phone_normalized",
          "is_primary",
          "is_active",
        ].join(","),
        facility_id: `eq.${facility.id}`,
        or: `(full_name.ilike.*${term}*,full_name_kana.ilike.*${term}*)`,
        order: "full_name.asc",
        limit: "50",
      },
    }),
  ];

  if (normalizedPhone.length >= 4) {
    familySearches.push(
      supabaseRequest(env, TABLES.families, {
        query: {
          select: [
            "id",
            "full_name",
            "full_name_kana",
            "relationship",
            "phone",
            "phone_normalized",
            "is_primary",
            "is_active",
          ].join(","),
          facility_id: `eq.${facility.id}`,
          phone_normalized: `like.*${normalizedPhone}*`,
          order: "full_name.asc",
          limit: "50",
        },
      }),
    );
  }

  const [userResults, familyResultGroups] = await Promise.all([
    Promise.all(userSearches),
    Promise.all(familySearches),
  ]);

  const users = deduplicateById(userResults.flat());
  const families = deduplicateById(familyResultGroups.flat());

  let relations = [];
  if (families.length) {
    relations = await supabaseRequest(env, TABLES.userFamilies, {
      query: {
        select: "user_id,family_member_id,relationship_to_user,is_primary_contact",
        family_member_id: `in.(${families.map((row) => row.id).join(",")})`,
        is_active: "eq.true",
      },
    });
  }

  const relatedUserIds = unique(relations.map((row) => row.user_id));
  const missingRelatedUserIds = relatedUserIds.filter(
    (id) => !users.some((user) => user.id === id),
  );

  const relatedUsers = missingRelatedUserIds.length
    ? await supabaseRequest(env, TABLES.users, {
        query: {
          select: [
            "id",
            "user_number",
            "full_name",
            "full_name_kana",
            "standard_transport_mode",
            "item_note",
            "is_active",
          ].join(","),
          id: `in.(${missingRelatedUserIds.join(",")})`,
        },
      })
    : [];

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    query: rawQuery,
    normalized_phone: normalizedPhone || null,
    count: {
      users: deduplicateById([...users, ...relatedUsers]).length,
      families: families.length,
    },
    users: deduplicateById([...users, ...relatedUsers]),
    families: families.map((family) => ({
      ...family,
      related_user_ids: relations
        .filter((row) => row.family_member_id === family.id)
        .map((row) => row.user_id),
    })),
  };
}

async function handleAdminUserDetail(env, facility, url) {
  const userId = url.searchParams.get("user_id");
  const userNumber = url.searchParams.get("user_number");

  if (!userId && !userNumber) {
    throw new ApiError(400, "user_idまたはuser_numberを指定してください。");
  }

  const userRows = await supabaseRequest(env, TABLES.users, {
    query: {
      select: "*",
      facility_id: `eq.${facility.id}`,
      ...(userId ? { id: `eq.${userId}` } : {}),
      ...(userNumber ? { user_number: `eq.${userNumber}` } : {}),
      limit: "1",
    },
  });

  const user = userRows[0];
  if (!user) {
    throw new ApiError(404, "利用者が見つかりません。");
  }

  const relations = await supabaseRequest(env, TABLES.userFamilies, {
    query: {
      select: "*",
      user_id: `eq.${user.id}`,
      is_active: "eq.true",
    },
  });

  const familyIds = relations.map((row) => row.family_member_id);

  const [families, plans, schedules, requests, notes, messageLogs] = await Promise.all([
    familyIds.length
      ? supabaseRequest(env, TABLES.families, {
          query: {
            select: "*",
            id: `in.(${familyIds.join(",")})`,
          },
        })
      : [],
    supabaseRequest(env, TABLES.servicePlans, {
      query: {
        select: "*",
        user_id: `eq.${user.id}`,
        order: "effective_from.desc",
      },
    }),
    supabaseRequest(env, TABLES.schedules, {
      query: {
        select: "*",
        user_id: `eq.${user.id}`,
        order: "service_date.desc",
        limit: "100",
      },
    }),
    supabaseRequest(env, TABLES.familyRequests, {
      query: {
        select: "*",
        user_id: `eq.${user.id}`,
        order: "created_at.desc",
        limit: "100",
      },
    }),
    supabaseRequest(env, TABLES.notes, {
      query: {
        select: "*",
        user_id: `eq.${user.id}`,
        order: "created_at.desc",
        limit: "100",
      },
    }),
    supabaseRequest(env, TABLES.messageLogs, {
      query: {
        select: "*",
        user_id: `eq.${user.id}`,
        order: "action_at.desc",
        limit: "100",
      },
    }),
  ]);

  const scheduleIds = schedules.map((row) => row.id);
  const [transports, checks] = await Promise.all([
    scheduleIds.length
      ? supabaseRequest(env, TABLES.transports, {
          query: {
            select: "*",
            schedule_id: `in.(${scheduleIds.join(",")})`,
          },
        })
      : [],
    scheduleIds.length
      ? supabaseRequest(env, TABLES.dailyChecks, {
          query: {
            select: "*",
            schedule_id: `in.(${scheduleIds.join(",")})`,
          },
        })
      : [],
  ]);

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    facility: publicFacility(facility),
    user,
    families: families.map((family) => ({
      ...family,
      relation: relations.find((row) => row.family_member_id === family.id) ?? null,
    })),
    service_plans: plans,
    schedules,
    transports,
    daily_checks: checks,
    family_requests: requests,
    notes,
    message_logs: messageLogs,
  };
}

/* ============================================================
 * Admin / Schedule / Status
 * ============================================================
 */

async function handleAdminScheduleCreate(env, facility, body) {
  const userId = requireUuid(body.user_id, "利用者ID");
  const serviceDate = requireDate(body.service_date, "利用日");
  const status = cleanText(body.status, 50) || "scheduled";

  if (!VALID_ATTENDANCE_STATUSES.has(status)) {
    throw new ApiError(400, "利用状況ステータスが正しくありません。");
  }

  const user = await getUserInFacility(env, facility.id, userId);

  const payload = {
    facility_id: facility.id,
    user_id: user.id,
    service_date: serviceDate,
    status,
    source: cleanText(body.source, 50) || "staff",
    planned_arrival_time: optionalTime(body.planned_arrival_time),
    planned_departure_time: optionalTime(body.planned_departure_time),
    transport_mode: cleanText(body.transport_mode, 50)
      || user.standard_transport_mode
      || "facility_transport",
    absence_reason: cleanText(body.absence_reason, 500) || null,
    schedule_note: normalizeNewlines(cleanText(body.schedule_note, 2000)) || null,
    current_status_note: normalizeNewlines(
      cleanText(body.current_status_note, 1000),
    ) || null,
    is_demo: Boolean(user.is_demo),
    created_by: cleanText(body.operator_name, 100) || "管理画面",
    updated_by: cleanText(body.operator_name, 100) || "管理画面",
  };

  const schedules = await supabaseRequest(env, TABLES.schedules, {
    method: "POST",
    query: {
      on_conflict: "user_id,service_date",
    },
    body: payload,
    prefer: "resolution=merge-duplicates,return=representation",
  });

  const schedule = schedules[0];

  if (payload.transport_mode !== "no_transport") {
    await upsertTransportPlan(env, facility, user, schedule, body);
  }

  await ensureDailyChecks(env, facility, user, schedule);

  await logOperation(env, {
    facilityId: facility.id,
    actorType: "admin",
    actorName: payload.updated_by,
    action: "schedule_upserted",
    targetTable: TABLES.schedules,
    targetId: schedule.id,
    deviceType: cleanDeviceType(body.device_type),
    isDemo: Boolean(user.is_demo),
    details: {
      service_date: serviceDate,
      status,
    },
  });

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    message: `${user.full_name}様の利用予定を保存しました。`,
    schedule,
  };
}

async function handleAdminAttendanceStatus(env, facility, body) {
  const scheduleId = requireUuid(body.schedule_id, "利用予定ID");
  const toStatus = cleanText(body.to_status, 50);

  if (!VALID_ATTENDANCE_STATUSES.has(toStatus)) {
    throw new ApiError(400, "変更先の利用状況ステータスが正しくありません。");
  }

  const schedules = await supabaseRequest(env, TABLES.schedules, {
    query: {
      select: "*",
      id: `eq.${scheduleId}`,
      facility_id: `eq.${facility.id}`,
      limit: "1",
    },
  });

  const schedule = schedules[0];
  if (!schedule) {
    throw new ApiError(404, "利用予定が見つかりません。");
  }

  const user = await getUserInFacility(env, facility.id, schedule.user_id);
  const operatorName = cleanText(body.operator_name, 100) || "スタッフ";
  const now = new Date().toISOString();

  const updatePayload = {
    status: toStatus,
    current_status_note: normalizeNewlines(
      cleanText(body.note, 1000),
    ) || schedule.current_status_note,
    updated_by: operatorName,
  };

  if (toStatus === "arrived" && !schedule.actual_arrival_at) {
    updatePayload.actual_arrival_at = now;
  }
  if (toStatus === "completed" && !schedule.actual_departure_at) {
    updatePayload.actual_departure_at = now;
  }

  const updated = await supabaseRequest(env, TABLES.schedules, {
    method: "PATCH",
    query: {
      id: `eq.${schedule.id}`,
    },
    body: updatePayload,
    prefer: "return=representation",
  });

  await supabaseRequest(env, TABLES.attendanceLogs, {
    method: "POST",
    body: {
      facility_id: facility.id,
      schedule_id: schedule.id,
      user_id: schedule.user_id,
      from_status: schedule.status,
      to_status: toStatus,
      changed_by_staff_id: optionalUuid(body.staff_id),
      changed_by_name: operatorName,
      device_type: cleanDeviceType(body.device_type),
      note: normalizeNewlines(cleanText(body.note, 1000)) || null,
      changed_at: now,
      is_demo: Boolean(schedule.is_demo),
    },
    prefer: "return=minimal",
  });

  if (toStatus === "transport_departed") {
    const transports = await supabaseRequest(env, TABLES.transports, {
      query: {
        select: "id,dropoff_status",
        schedule_id: `eq.${schedule.id}`,
        limit: "1",
      },
    });

    if (transports[0]) {
      await supabaseRequest(env, TABLES.transports, {
        method: "PATCH",
        query: {
          id: `eq.${transports[0].id}`,
        },
        body: {
          dropoff_status: "dropoff_departed",
          dropoff_departed_at: now,
          updated_by: operatorName,
        },
        prefer: "return=minimal",
      });
    }
  }

  await logOperation(env, {
    facilityId: facility.id,
    actorType: "staff",
    actorId: optionalUuid(body.staff_id),
    actorName: operatorName,
    action: "attendance_status_changed",
    targetTable: TABLES.schedules,
    targetId: schedule.id,
    deviceType: cleanDeviceType(body.device_type),
    isDemo: Boolean(schedule.is_demo),
    details: {
      user_id: schedule.user_id,
      from_status: schedule.status,
      to_status: toStatus,
    },
  });

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    message: `${user.full_name}様を「${attendanceStatusLabel(toStatus)}」に変更しました。`,
    schedule: updated[0],
  };
}

async function handleAdminDailyCheckStatus(env, facility, body) {
  const scheduleId = requireUuid(body.schedule_id, "利用予定ID");
  const checkType = cleanText(body.check_type, 50);
  const validCheckTypes = new Set([
    "lunch",
    "bath",
    "recreation",
    "family_contact",
    "go_home_preparation",
    "other",
  ]);

  if (!validCheckTypes.has(checkType)) {
    throw new ApiError(400, "確認項目が正しくありません。");
  }

  if (typeof body.is_completed !== "boolean") {
    throw new ApiError(
      400,
      "is_completedはtrueまたはfalseで指定してください。",
    );
  }

  const schedules = await supabaseRequest(env, TABLES.schedules, {
    query: {
      select: "*",
      id: `eq.${scheduleId}`,
      facility_id: `eq.${facility.id}`,
      limit: "1",
    },
  });

  const schedule = schedules[0];
  if (!schedule) {
    throw new ApiError(404, "利用予定が見つかりません。");
  }

  const user = await getUserInFacility(
    env,
    facility.id,
    schedule.user_id,
  );

  const operatorName =
    cleanText(body.operator_name, 100) || "スタッフ";
  const completed = body.is_completed;
  const now = new Date().toISOString();

  const rows = await supabaseRequest(env, TABLES.dailyChecks, {
    method: "POST",
    query: {
      on_conflict: "schedule_id,check_type",
    },
    body: {
      facility_id: facility.id,
      schedule_id: schedule.id,
      user_id: schedule.user_id,
      check_type: checkType,
      is_completed: completed,
      completed_at: completed ? now : null,
      completed_by_staff_id: completed
        ? optionalUuid(body.staff_id)
        : null,
      completed_by_name: completed ? operatorName : null,
      note:
        normalizeNewlines(cleanText(body.note, 1000)) || null,
      is_demo: Boolean(schedule.is_demo),
      created_by: operatorName,
      updated_by: operatorName,
    },
    prefer: "resolution=merge-duplicates,return=representation",
  });

  await logOperation(env, {
    facilityId: facility.id,
    actorType: "staff",
    actorId: optionalUuid(body.staff_id),
    actorName: operatorName,
    action: "daily_check_status_changed",
    targetTable: TABLES.dailyChecks,
    targetId: rows[0]?.id || null,
    deviceType: cleanDeviceType(body.device_type),
    isDemo: Boolean(schedule.is_demo),
    details: {
      user_id: schedule.user_id,
      schedule_id: schedule.id,
      check_type: checkType,
      is_completed: completed,
    },
  });

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    message: `${user.full_name}様の「${dailyCheckLabelServer(
      checkType,
    )}」を${completed ? "確認済み" : "未確認"}に変更しました。`,
    daily_check: rows[0],
  };
}

function dailyCheckLabelServer(checkType) {
  const labels = {
    lunch: "昼食",
    bath: "入浴",
    recreation: "レク",
    family_contact: "家族連絡",
    go_home_preparation: "帰宅準備",
    other: "その他",
  };

  return labels[checkType] || checkType;
}

async function handleAdminIntegrationCheck(env, facility, url) {
  const date =
    optionalDate(url.searchParams.get("date")) || todayJst();

  const schedules = await supabaseRequest(env, TABLES.schedules, {
    query: {
      select: "id,user_id,status,is_demo",
      facility_id: `eq.${facility.id}`,
      service_date: `eq.${date}`,
      order: "created_at.asc",
    },
  });

  const scheduleIds = schedules.map((row) => row.id);

  const [
    demoUsers,
    demoFamilies,
    transports,
    dailyChecks,
    pendingRequests,
    openTasks,
    unresolvedNotes,
    specialDays,
    versionContract,
  ] = await Promise.all([
    supabaseRequest(env, TABLES.users, {
      query: {
        select: "id,user_number,full_name,is_demo",
        facility_id: `eq.${facility.id}`,
        is_demo: "eq.true",
        is_active: "eq.true",
      },
    }),
    supabaseRequest(env, TABLES.families, {
      query: {
        select: "id,full_name,phone,is_demo",
        facility_id: `eq.${facility.id}`,
        is_demo: "eq.true",
        is_active: "eq.true",
      },
    }),
    scheduleIds.length
      ? supabaseRequest(env, TABLES.transports, {
          query: {
            select: "id,schedule_id,transport_mode",
            schedule_id: `in.(${scheduleIds.join(",")})`,
          },
        })
      : [],
    scheduleIds.length
      ? supabaseRequest(env, TABLES.dailyChecks, {
          query: {
            select:
              "id,schedule_id,check_type,is_completed,updated_at",
            schedule_id: `in.(${scheduleIds.join(",")})`,
          },
        })
      : [],
    supabaseRequest(env, TABLES.familyRequests, {
      query: {
        select: "id,request_status,is_demo",
        facility_id: `eq.${facility.id}`,
        request_status: "in.(new,acknowledged,in_progress)",
        is_demo: "eq.true",
      },
    }),
    supabaseRequest(env, TABLES.tasks, {
      query: {
        select: "id,task_status,is_demo",
        facility_id: `eq.${facility.id}`,
        task_status: "in.(open,in_progress)",
        is_demo: "eq.true",
      },
    }),
    supabaseRequest(env, TABLES.notes, {
      query: {
        select: "id,is_resolved,is_demo",
        facility_id: `eq.${facility.id}`,
        is_resolved: "eq.false",
        is_demo: "eq.true",
      },
    }),
    supabaseRequest(env, TABLES.specialDays, {
      query: {
        select: "special_date,day_type,service_start_time,service_end_time,title,note",
        facility_id: `eq.${facility.id}`,
        limit: "100",
      },
    }),
    getVersionContract(env),
  ]);

  const requiredCheckTypes = [
    "lunch",
    "bath",
    "recreation",
    "family_contact",
    "go_home_preparation",
  ];

  const actualCheckTypes = unique(
    dailyChecks.map((row) => row.check_type),
  );

  const expectedDailyCheckCount =
    schedules.length * requiredCheckTypes.length;

  const calendarSelfTests = {
    normal_weekly: resolveEffectiveBusinessDay("2099-12-28", { weekday: 1, is_open: true, service_start_time: "09:00:00", service_end_time: "16:00:00" }, null).is_open === true,
    exceptional_closed: resolveEffectiveBusinessDay("2099-12-29", { weekday: 2, is_open: true }, { special_date: "2099-12-29", day_type: "closed" }).is_open === false,
    special_open: resolveEffectiveBusinessDay("2099-12-30", { weekday: 3, is_open: false }, { special_date: "2099-12-30", day_type: "special_hours", service_start_time: "10:00:00", service_end_time: "15:00:00" }).is_open === true,
  };

  const checks = {
    facility_found: Boolean(facility.id),
    demo_users_ready: demoUsers.length >= 4,
    demo_families_ready: demoFamilies.length >= 4,
    today_schedules_ready: schedules.length >= 4,
    transports_ready: transports.length >= schedules.length,
    daily_checks_ready:
      dailyChecks.length >= expectedDailyCheckCount,
    daily_check_types_ready: requiredCheckTypes.every((type) =>
      actualCheckTypes.includes(type),
    ),
    family_requests_ready: pendingRequests.length >= 3,
    tasks_ready: openTasks.length >= 3,
    notes_ready: unresolvedNotes.length >= 3,
    special_day_table_ready: Array.isArray(specialDays),
    calendar_exception_logic_ready: Object.values(calendarSelfTests).every(Boolean),
    version_contract_ready: versionContract.versionsAligned === true,
  };

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    date,
    facility: publicFacility(facility),
    integration_ready: Object.values(checks).every(Boolean),
    checks,
    counts: {
      demo_users: demoUsers.length,
      demo_families: demoFamilies.length,
      today_schedules: schedules.length,
      transports: transports.length,
      daily_checks: dailyChecks.length,
      expected_daily_checks: expectedDailyCheckCount,
      completed_daily_checks: dailyChecks.filter(
        (row) => row.is_completed,
      ).length,
      pending_family_requests: pendingRequests.length,
      open_tasks: openTasks.length,
      unresolved_notes: unresolvedNotes.length,
    },
    daily_check_types: actualCheckTypes,
    required_daily_check_types: requiredCheckTypes,
    special_day_count: specialDays.length,
    calendar_self_tests: calendarSelfTests,
    versionContract,
  };
}

async function handleAdminTransportStatus(env, facility, body) {
  const scheduleId = requireUuid(body.schedule_id, "利用予定ID");
  const operatorName = cleanText(body.operator_name, 100) || "スタッフ";
  const now = new Date().toISOString();

  const schedules = await supabaseRequest(env, TABLES.schedules, {
    query: {
      select: "*",
      id: `eq.${scheduleId}`,
      facility_id: `eq.${facility.id}`,
      limit: "1",
    },
  });

  const schedule = schedules[0];
  if (!schedule) {
    throw new ApiError(404, "利用予定が見つかりません。");
  }

  const user = await getUserInFacility(env, facility.id, schedule.user_id);
  const existing = await supabaseRequest(env, TABLES.transports, {
    query: {
      select: "*",
      schedule_id: `eq.${schedule.id}`,
      limit: "1",
    },
  });

  const transport = existing[0];
  const payload = {
    facility_id: facility.id,
    schedule_id: schedule.id,
    user_id: schedule.user_id,
    transport_mode: cleanText(body.transport_mode, 50)
      || transport?.transport_mode
      || schedule.transport_mode
      || "facility_transport",
    pickup_planned_at: optionalDateTime(body.pickup_planned_at)
      ?? transport?.pickup_planned_at
      ?? null,
    dropoff_planned_at: optionalDateTime(body.dropoff_planned_at)
      ?? transport?.dropoff_planned_at
      ?? null,
    driver_staff_id: optionalUuid(body.driver_staff_id)
      ?? transport?.driver_staff_id
      ?? null,
    vehicle_name: cleanText(body.vehicle_name, 100)
      || transport?.vehicle_name
      || null,
    pickup_note: normalizeNewlines(cleanText(body.pickup_note, 1000))
      || transport?.pickup_note
      || null,
    dropoff_note: normalizeNewlines(cleanText(body.dropoff_note, 1000))
      || transport?.dropoff_note
      || null,
    family_notice_note: normalizeNewlines(
      cleanText(body.family_notice_note, 1000),
    ) || transport?.family_notice_note || null,
    is_demo: Boolean(schedule.is_demo),
    created_by: operatorName,
    updated_by: operatorName,
  };

  const direction = cleanText(body.direction, 20);
  const status = cleanText(body.status, 50);

  if (direction === "pickup") {
    const valid = new Set([
      "pickup_planned",
      "pickup_departed",
      "pickup_done",
      "family_dropoff",
      "not_required",
    ]);
    if (!valid.has(status)) {
      throw new ApiError(400, "お迎えステータスが正しくありません。");
    }
    payload.pickup_status = status;
    if (status === "pickup_departed") payload.pickup_departed_at = now;
    if (status === "pickup_done") payload.pickup_done_at = now;
  } else if (direction === "dropoff") {
    const valid = new Set([
      "dropoff_planned",
      "dropoff_departed",
      "dropoff_done",
      "family_pickup",
      "not_required",
    ]);
    if (!valid.has(status)) {
      throw new ApiError(400, "お帰りステータスが正しくありません。");
    }
    payload.dropoff_status = status;
    if (status === "dropoff_departed") payload.dropoff_departed_at = now;
    if (status === "dropoff_done") payload.dropoff_done_at = now;
  } else if (!body.pickup_planned_at && !body.dropoff_planned_at) {
    throw new ApiError(
      400,
      "directionはpickupまたはdropoffを指定するか、送迎予定時間を指定してください。",
    );
  }

  const saved = await supabaseRequest(env, TABLES.transports, {
    method: "POST",
    query: {
      on_conflict: "schedule_id",
    },
    body: payload,
    prefer: "resolution=merge-duplicates,return=representation",
  });

  if (direction === "dropoff" && status === "dropoff_departed") {
    await supabaseRequest(env, TABLES.schedules, {
      method: "PATCH",
      query: {
        id: `eq.${schedule.id}`,
      },
      body: {
        status: "transport_departed",
        updated_by: operatorName,
      },
      prefer: "return=minimal",
    });
  }

  if (direction === "dropoff" && status === "dropoff_done") {
    await supabaseRequest(env, TABLES.schedules, {
      method: "PATCH",
      query: {
        id: `eq.${schedule.id}`,
      },
      body: {
        status: "completed",
        actual_departure_at: now,
        updated_by: operatorName,
      },
      prefer: "return=minimal",
    });
  }

  await logOperation(env, {
    facilityId: facility.id,
    actorType: "staff",
    actorId: optionalUuid(body.staff_id),
    actorName: operatorName,
    action: "transport_status_changed",
    targetTable: TABLES.transports,
    targetId: saved[0].id,
    deviceType: cleanDeviceType(body.device_type),
    isDemo: Boolean(schedule.is_demo),
    details: {
      user_id: schedule.user_id,
      direction: direction || "plan",
      status: status || "planned_time_updated",
    },
  });

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    message: `${user.full_name}様の送迎情報を更新しました。`,
    transport: saved[0],
  };
}

async function handleAdminTaskStatus(env, facility, body) {
  const taskId = requireUuid(body.task_id, "タスクID");
  const status = cleanText(body.status, 50);

  if (!VALID_TASK_STATUSES.has(status)) {
    throw new ApiError(400, "タスクの状態が正しくありません。");
  }

  const tasks = await supabaseRequest(env, TABLES.tasks, {
    query: {
      select: "*",
      id: `eq.${taskId}`,
      facility_id: `eq.${facility.id}`,
      limit: "1",
    },
  });

  const task = tasks[0];
  if (!task) {
    throw new ApiError(404, "タスクが見つかりません。");
  }

  const operatorName = cleanText(body.operator_name, 100) || "スタッフ";
  const payload = {
    task_status: status,
    updated_by: operatorName,
  };

  if (status === "completed") {
    payload.completed_at = new Date().toISOString();
    payload.completed_by_staff_id = optionalUuid(body.staff_id);
    payload.completed_by_name = operatorName;
  } else {
    payload.completed_at = null;
    payload.completed_by_staff_id = null;
    payload.completed_by_name = null;
  }

  const updated = await supabaseRequest(env, TABLES.tasks, {
    method: "PATCH",
    query: {
      id: `eq.${task.id}`,
    },
    body: payload,
    prefer: "return=representation",
  });

  await logOperation(env, {
    facilityId: facility.id,
    actorType: "staff",
    actorId: optionalUuid(body.staff_id),
    actorName: operatorName,
    action: "task_status_changed",
    targetTable: TABLES.tasks,
    targetId: task.id,
    deviceType: cleanDeviceType(body.device_type),
    isDemo: Boolean(task.is_demo),
    details: {
      from_status: task.task_status,
      to_status: status,
    },
  });

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    message: status === "completed"
      ? "対応済みに変更しました。"
      : "タスクの状態を更新しました。",
    task: updated[0],
  };
}

async function handleAdminMessageLogCopy(env, facility, body) {
  const messageBody = normalizeNewlines(cleanText(body.message_body, 5000));
  if (!messageBody) {
    throw new ApiError(400, "コピーする連絡文面がありません。");
  }

  const operatorName = cleanText(body.operator_name, 100) || "スタッフ";
  const actionType = cleanText(body.action_type, 20) || "copied";
  const validActionTypes = new Set(["generated", "copied", "sent", "failed"]);

  if (!validActionTypes.has(actionType)) {
    throw new ApiError(400, "文面履歴の操作種別が正しくありません。");
  }

  const inserted = await supabaseRequest(env, TABLES.messageLogs, {
    method: "POST",
    body: {
      facility_id: facility.id,
      user_id: optionalUuid(body.user_id),
      family_member_id: optionalUuid(body.family_member_id),
      family_request_id: optionalUuid(body.family_request_id),
      template_id: optionalUuid(body.template_id),
      action_type: actionType,
      subject: cleanText(body.subject, 200) || null,
      message_body: messageBody,
      destination_type: cleanText(body.destination_type, 20) || "line",
      handled_by_staff_id: optionalUuid(body.staff_id),
      handled_by_name: operatorName,
      action_at: new Date().toISOString(),
      result_note: normalizeNewlines(cleanText(body.result_note, 1000)) || null,
      is_demo: Boolean(body.is_demo),
    },
    prefer: "return=representation",
  });

  await logOperation(env, {
    facilityId: facility.id,
    actorType: "staff",
    actorId: optionalUuid(body.staff_id),
    actorName: operatorName,
    action: `message_${actionType}`,
    targetTable: TABLES.messageLogs,
    targetId: inserted[0].id,
    deviceType: cleanDeviceType(body.device_type),
    isDemo: Boolean(body.is_demo),
    details: {
      user_id: optionalUuid(body.user_id),
      family_request_id: optionalUuid(body.family_request_id),
    },
  });

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    message: actionType === "copied"
      ? "連絡文面をコピーした履歴を保存しました。"
      : "連絡文面の履歴を保存しました。",
    log: inserted[0],
  };
}

async function handleAdminFamilyRequestStatus(env, facility, body) {
  const requestId = requireUuid(body.request_id, "家族連絡ID");
  const status = cleanText(body.status, 50);

  if (!VALID_REQUEST_STATUSES.has(status)) {
    throw new ApiError(400, "家族連絡の対応状態が正しくありません。");
  }

  const requests = await supabaseRequest(env, TABLES.familyRequests, {
    query: {
      select: "*",
      id: `eq.${requestId}`,
      facility_id: `eq.${facility.id}`,
      limit: "1",
    },
  });

  const familyRequest = requests[0];
  if (!familyRequest) {
    throw new ApiError(404, "家族からの連絡が見つかりません。");
  }

  const operatorName = cleanText(body.operator_name, 100) || "スタッフ";
  const now = new Date().toISOString();
  const payload = {
    request_status: status,
    response_message: normalizeNewlines(
      cleanText(body.response_message, 3000),
    ) || familyRequest.response_message,
    handled_by_staff_id: optionalUuid(body.staff_id),
    handled_by_name: operatorName,
    updated_by: operatorName,
  };

  if (
    ["acknowledged", "in_progress", "resolved", "rejected"].includes(status)
    && !familyRequest.acknowledged_at
  ) {
    payload.acknowledged_at = now;
  }

  if (["resolved", "rejected", "cancelled"].includes(status)) {
    payload.resolved_at = now;
  } else {
    payload.resolved_at = null;
  }

  const updated = await supabaseRequest(env, TABLES.familyRequests, {
    method: "PATCH",
    query: {
      id: `eq.${familyRequest.id}`,
    },
    body: payload,
    prefer: "return=representation",
  });

  if (["resolved", "rejected", "cancelled"].includes(status)) {
    await supabaseRequest(env, TABLES.tasks, {
      method: "PATCH",
      query: {
        family_request_id: `eq.${familyRequest.id}`,
        task_status: "in.(open,in_progress)",
      },
      body: {
        task_status: "completed",
        completed_at: now,
        completed_by_staff_id: optionalUuid(body.staff_id),
        completed_by_name: operatorName,
        updated_by: operatorName,
      },
      prefer: "return=minimal",
    });
  }

  await logOperation(env, {
    facilityId: facility.id,
    actorType: "staff",
    actorId: optionalUuid(body.staff_id),
    actorName: operatorName,
    action: "family_request_status_changed",
    targetTable: TABLES.familyRequests,
    targetId: familyRequest.id,
    deviceType: cleanDeviceType(body.device_type),
    isDemo: Boolean(familyRequest.is_demo),
    details: {
      from_status: familyRequest.request_status,
      to_status: status,
    },
  });

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    message: "家族連絡の対応状態を更新しました。",
    request: sanitizeFamilyRequest(updated[0]),
  };
}

/* ============================================================
 * Admin / Demo Prepare
 * ============================================================
 */

async function handleAdminDemoPrepare(env, facility) {
  if (!facility.is_demo) {
    throw new ApiError(
      403,
      "営業前デモ準備はデモ施設でのみ実行できます。",
    );
  }

  const today = todayJst();
  const operatorName = "営業前デモ準備";
  let phase = "start";

  try {
    const definitions = [
      {
        user_number: "DAY-DEMO-001",
        full_name: "佐藤 花子",
        full_name_kana: "サトウ ハナコ",
        standard_transport_mode: "facility_transport",
        item_note: "連絡帳、上履き",
        facility_note: "帰宅前に家族へ連絡",
        weekdays: [1, 3, 5],
        status: "arrived",
        planned_arrival_time: "09:00:00",
        planned_departure_time: "16:20:00",
        pickup_time: "08:35:00",
        dropoff_time: "16:20:00",
        family: {
          full_name: "佐藤 太郎",
          full_name_kana: "サトウ タロウ",
          relationship: "長男",
          phone: "090-9999-1111",
        },
      },
      {
        user_number: "DAY-DEMO-002",
        full_name: "田中 一郎",
        full_name_kana: "タナカ イチロウ",
        standard_transport_mode: "facility_transport",
        item_note: "タオル",
        facility_note: "送迎時間変更の確認あり",
        weekdays: [2, 4],
        status: "scheduled",
        planned_arrival_time: "09:10:00",
        planned_departure_time: "16:10:00",
        pickup_time: "08:50:00",
        dropoff_time: "16:10:00",
        family: {
          full_name: "田中 美咲",
          full_name_kana: "タナカ ミサキ",
          relationship: "長女",
          phone: "090-9999-2222",
        },
      },
      {
        user_number: "DAY-DEMO-003",
        full_name: "山本 梅子",
        full_name_kana: "ヤマモト ウメコ",
        standard_transport_mode: "family_pickup",
        item_note: "飲み物",
        facility_note: "本日は家族迎え",
        weekdays: [1, 2, 4],
        status: "in_service",
        planned_arrival_time: "09:00:00",
        planned_departure_time: "16:00:00",
        pickup_time: null,
        dropoff_time: null,
        family: {
          full_name: "山本 健",
          full_name_kana: "ヤマモト ケン",
          relationship: "次男",
          phone: "090-9999-3333",
        },
      },
      {
        user_number: "DAY-DEMO-999",
        full_name: "テスト 利用者",
        full_name_kana: "テスト リヨウシャ",
        standard_transport_mode: "facility_transport",
        item_note: "営業デモ確認用",
        facility_note: "電話番号正規化・検索確認用",
        weekdays: [1, 2, 3, 4, 5],
        status: "scheduled",
        planned_arrival_time: "09:20:00",
        planned_departure_time: "15:50:00",
        pickup_time: "09:00:00",
        dropoff_time: "15:50:00",
        family: {
          full_name: "テスト 家族",
          full_name_kana: "テスト カゾク",
          relationship: "家族",
          phone: "090-9999-0000",
        },
      },
    ];

    phase = "users_bulk_upsert";
    const users = await supabaseRequest(env, TABLES.users, {
      method: "POST",
      query: {
        on_conflict: "facility_id,user_number",
      },
      body: definitions.map((definition) => ({
        facility_id: facility.id,
        user_number: definition.user_number,
        full_name: definition.full_name,
        full_name_kana: definition.full_name_kana,
        standard_transport_mode: definition.standard_transport_mode,
        item_note: definition.item_note,
        facility_note: definition.facility_note,
        start_date: today,
        is_active: true,
        is_demo: true,
        created_by: operatorName,
        updated_by: operatorName,
      })),
      prefer: "resolution=merge-duplicates,return=representation",
    });

    const userByNumber = new Map(
      users.map((row) => [row.user_number, row]),
    );

    for (const definition of definitions) {
      if (!userByNumber.get(definition.user_number)) {
        throw new Error(
          `デモ利用者を取得できませんでした: ${definition.user_number}`,
        );
      }
    }

    phase = "families_select";
    const normalizedPhones = definitions.map((definition) =>
      normalizePhone(definition.family.phone)
    );

    const existingFamilies = await supabaseRequest(env, TABLES.families, {
      query: {
        select: "*",
        facility_id: `eq.${facility.id}`,
        phone_normalized: `in.(${normalizedPhones.join(",")})`,
        is_active: "eq.true",
      },
    });

    const existingFamilyByPhone = new Map(
      existingFamilies.map((row) => [row.phone_normalized, row]),
    );

    const missingFamilyPayloads = definitions
      .filter((definition) =>
        !existingFamilyByPhone.has(
          normalizePhone(definition.family.phone),
        )
      )
      .map((definition) => ({
        facility_id: facility.id,
        full_name: definition.family.full_name,
        full_name_kana: definition.family.full_name_kana,
        relationship: definition.family.relationship,
        phone: definition.family.phone,
        is_primary: true,
        contact_allowed: true,
        preferred_contact_method: "line",
        is_active: true,
        is_demo: true,
        created_by: operatorName,
        updated_by: operatorName,
      }));

    phase = "families_bulk_insert";
    const insertedFamilies = missingFamilyPayloads.length
      ? await supabaseRequest(env, TABLES.families, {
          method: "POST",
          body: missingFamilyPayloads,
          prefer: "return=representation",
        })
      : [];

    const familyByPhone = new Map(
      [...existingFamilies, ...insertedFamilies].map((row) => [
        row.phone_normalized || normalizePhone(row.phone),
        row,
      ]),
    );

    for (const definition of definitions) {
      const normalized = normalizePhone(definition.family.phone);
      if (!familyByPhone.get(normalized)) {
        throw new Error(
          `デモ家族を取得できませんでした: ${definition.family.full_name}`,
        );
      }
    }

    phase = "relations_bulk_upsert";
    await supabaseRequest(env, TABLES.userFamilies, {
      method: "POST",
      query: {
        on_conflict: "user_id,family_member_id",
      },
      body: definitions.map((definition) => {
        const user = userByNumber.get(definition.user_number);
        const family = familyByPhone.get(
          normalizePhone(definition.family.phone),
        );

        return {
          facility_id: facility.id,
          user_id: user.id,
          family_member_id: family.id,
          relationship_to_user: definition.family.relationship,
          is_primary_contact: true,
          can_view_schedule: true,
          can_submit_request: true,
          is_active: true,
          is_demo: true,
          created_by: operatorName,
          updated_by: operatorName,
        };
      }),
      prefer: "resolution=merge-duplicates,return=minimal",
    });

    const userIds = users.map((row) => row.id);

    phase = "service_plans_select";
    const existingPlans = await supabaseRequest(
      env,
      TABLES.servicePlans,
      {
        query: {
          select: "id,user_id",
          user_id: `in.(${userIds.join(",")})`,
          is_active: "eq.true",
        },
      },
    );

    const existingPlanUserIds = new Set(
      existingPlans.map((row) => row.user_id),
    );

    const missingPlanPayloads = definitions
      .filter((definition) => {
        const user = userByNumber.get(definition.user_number);
        return !existingPlanUserIds.has(user.id);
      })
      .map((definition) => {
        const user = userByNumber.get(definition.user_number);

        return {
          facility_id: facility.id,
          user_id: user.id,
          plan_name: "通常利用",
          standard_weekdays: definition.weekdays,
          effective_from: today,
          transport_mode: definition.standard_transport_mode,
          default_pickup_time: definition.pickup_time,
          default_dropoff_time: definition.dropoff_time,
          note: "営業デモ用通常利用プラン",
          is_active: true,
          is_demo: true,
          created_by: operatorName,
          updated_by: operatorName,
        };
      });

    phase = "service_plans_bulk_insert";
    if (missingPlanPayloads.length) {
      await supabaseRequest(env, TABLES.servicePlans, {
        method: "POST",
        body: missingPlanPayloads,
        prefer: "return=minimal",
      });
    }

    phase = "schedules_bulk_upsert";
    const schedules = await supabaseRequest(env, TABLES.schedules, {
      method: "POST",
      query: {
        on_conflict: "user_id,service_date",
      },
      body: definitions.map((definition) => {
        const user = userByNumber.get(definition.user_number);

        return {
          facility_id: facility.id,
          user_id: user.id,
          service_date: today,
          status: definition.status,
          source: "demo",
          planned_arrival_time: definition.planned_arrival_time,
          planned_departure_time: definition.planned_departure_time,
          actual_arrival_at: ["arrived", "in_service"].includes(
            definition.status,
          )
            ? `${today}T09:00:00+09:00`
            : null,
          actual_departure_at: null,
          transport_mode: definition.standard_transport_mode,
          schedule_note: "営業デモ用本日の利用予定",
          current_status_note: attendanceStatusLabel(
            definition.status,
          ),
          is_demo: true,
          created_by: operatorName,
          updated_by: operatorName,
        };
      }),
      prefer: "resolution=merge-duplicates,return=representation",
    });

    const scheduleByUserId = new Map(
      schedules.map((row) => [row.user_id, row]),
    );

    for (const user of users) {
      if (!scheduleByUserId.get(user.id)) {
        throw new Error(
          `本日の利用予定を取得できませんでした: ${user.full_name}`,
        );
      }
    }

    phase = "transports_bulk_upsert";
    await supabaseRequest(env, TABLES.transports, {
      method: "POST",
      query: {
        on_conflict: "schedule_id",
      },
      body: definitions.map((definition) => {
        const user = userByNumber.get(definition.user_number);
        const schedule = scheduleByUserId.get(user.id);
        const isFacilityTransport =
          definition.standard_transport_mode === "facility_transport";

        return {
          facility_id: facility.id,
          schedule_id: schedule.id,
          user_id: user.id,
          transport_mode: definition.standard_transport_mode,
          pickup_planned_at: definition.pickup_time
            ? `${today}T${definition.pickup_time}+09:00`
            : null,
          pickup_status: isFacilityTransport
            ? "pickup_planned"
            : "family_dropoff",
          pickup_departed_at: null,
          pickup_done_at: null,
          dropoff_planned_at: definition.dropoff_time
            ? `${today}T${definition.dropoff_time}+09:00`
            : null,
          dropoff_status:
            definition.standard_transport_mode === "family_pickup"
              ? "family_pickup"
              : isFacilityTransport
                ? "dropoff_planned"
                : "not_required",
          dropoff_departed_at: null,
          dropoff_done_at: null,
          family_notice_note: isFacilityTransport
            ? "送迎時間案内を家族へ連絡"
            : "家族送迎予定",
          is_demo: true,
          created_by: operatorName,
          updated_by: operatorName,
        };
      }),
      prefer: "resolution=merge-duplicates,return=minimal",
    });

    phase = "daily_checks_bulk_upsert";
    const checkTypes = [
      "lunch",
      "bath",
      "recreation",
      "family_contact",
      "go_home_preparation",
    ];

    const dailyCheckPayloads = [];

    for (const definition of definitions) {
      const user = userByNumber.get(definition.user_number);
      const schedule = scheduleByUserId.get(user.id);

      for (const checkType of checkTypes) {
        const completed =
          definition.user_number === "DAY-DEMO-003"
          && checkType === "lunch";

        dailyCheckPayloads.push({
          facility_id: facility.id,
          schedule_id: schedule.id,
          user_id: user.id,
          check_type: checkType,
          is_completed: completed,
          completed_at: completed ? new Date().toISOString() : null,
          completed_by_staff_id: null,
          completed_by_name: completed ? operatorName : null,
          note: null,
          is_demo: true,
          created_by: operatorName,
          updated_by: operatorName,
        });
      }
    }

    await supabaseRequest(env, TABLES.dailyChecks, {
      method: "POST",
      query: {
        on_conflict: "schedule_id,check_type",
      },
      body: dailyCheckPayloads,
      prefer: "resolution=merge-duplicates,return=minimal",
    });

    const satoUser = userByNumber.get("DAY-DEMO-001");
    const tanakaUser = userByNumber.get("DAY-DEMO-002");
    const yamamotoUser = userByNumber.get("DAY-DEMO-003");

    const satoFamily = familyByPhone.get("09099991111");
    const tanakaFamily = familyByPhone.get("09099992222");
    const yamamotoFamily = familyByPhone.get("09099993333");

    const requestDefinitions = [
      {
        marker: "[DEMO:ABSENCE:SATO] 次回のお休み連絡",
        user: satoUser,
        family: satoFamily,
        request_type: "absence",
        target_date: addDaysToDate(today, 2),
        requested_change_date: null,
        message: "通院のため、次回はお休みします。",
      },
      {
        marker: "[DEMO:CHANGE:TANAKA] 利用日変更希望",
        user: tanakaUser,
        family: tanakaFamily,
        request_type: "change_date",
        target_date: addDaysToDate(today, 3),
        requested_change_date: addDaysToDate(today, 4),
        message: "家庭の都合により利用日の変更を希望します。",
      },
      {
        marker: "[DEMO:ITEM:YAMAMOTO] 持ち物について",
        user: yamamotoUser,
        family: yamamotoFamily,
        request_type: "item_question",
        target_date: addDaysToDate(today, 1),
        requested_change_date: null,
        message: "次回の持ち物を確認したいです。",
      },
    ];

    phase = "family_requests_select";
    const existingRequests = await supabaseRequest(
      env,
      TABLES.familyRequests,
      {
        query: {
          select: "*",
          facility_id: `eq.${facility.id}`,
          is_demo: "eq.true",
        },
      },
    );

    const requestByMarker = new Map(
      existingRequests
        .filter((row) =>
          requestDefinitions.some(
            (definition) => definition.marker === row.subject,
          )
        )
        .map((row) => [row.subject, row]),
    );

    const missingRequestPayloads = requestDefinitions
      .filter((definition) => !requestByMarker.has(definition.marker))
      .map((definition) => ({
        facility_id: facility.id,
        user_id: definition.user.id,
        family_member_id: definition.family.id,
        request_type: definition.request_type,
        request_status: "new",
        request_source: "demo",
        target_date: definition.target_date,
        requested_change_date: definition.requested_change_date,
        subject: definition.marker,
        message: definition.message,
        response_message: null,
        handled_by_staff_id: null,
        handled_by_name: null,
        acknowledged_at: null,
        resolved_at: null,
        is_demo: true,
        created_by: operatorName,
        updated_by: operatorName,
      }));

    phase = "family_requests_bulk_insert";
    const insertedRequests = missingRequestPayloads.length
      ? await supabaseRequest(env, TABLES.familyRequests, {
          method: "POST",
          body: missingRequestPayloads,
          prefer: "return=representation",
        })
      : [];

    for (const row of insertedRequests) {
      requestByMarker.set(row.subject, row);
    }

    phase = "family_requests_reset";
    for (const definition of requestDefinitions) {
      const requestRow = requestByMarker.get(definition.marker);
      if (!requestRow) {
        throw new Error(
          `デモ家族連絡を取得できませんでした: ${definition.marker}`,
        );
      }

      if (
        requestRow.request_status !== "new"
        || requestRow.target_date !== definition.target_date
        || requestRow.requested_change_date
          !== definition.requested_change_date
      ) {
        const updatedRows = await supabaseRequest(
          env,
          TABLES.familyRequests,
          {
            method: "PATCH",
            query: {
              id: `eq.${requestRow.id}`,
            },
            body: {
              request_status: "new",
              target_date: definition.target_date,
              requested_change_date:
                definition.requested_change_date,
              message: definition.message,
              response_message: null,
              handled_by_staff_id: null,
              handled_by_name: null,
              acknowledged_at: null,
              resolved_at: null,
              updated_by: operatorName,
            },
            prefer: "return=representation",
          },
        );

        if (updatedRows[0]) {
          requestByMarker.set(definition.marker, updatedRows[0]);
        }
      }
    }

    const taskDefinitions = [
      {
        marker: "[DEMO:TASK:ABSENCE] 佐藤花子様のお休み連絡に返信",
        user: satoUser,
        schedule: scheduleByUserId.get(satoUser.id),
        request: requestByMarker.get(
          "[DEMO:ABSENCE:SATO] 次回のお休み連絡",
        ),
        task_type: "reply_absence",
        description:
          "お休み連絡の内容を確認して返信してください。",
        priority: "high",
        due_at: new Date().toISOString(),
      },
      {
        marker: "[DEMO:TASK:CHANGE] 田中一郎様の利用日変更希望に返信",
        user: tanakaUser,
        schedule: scheduleByUserId.get(tanakaUser.id),
        request: requestByMarker.get(
          "[DEMO:CHANGE:TANAKA] 利用日変更希望",
        ),
        task_type: "reply_change",
        description:
          "変更希望日を確認して家族へ連絡してください。",
        priority: "normal",
        due_at: null,
      },
      {
        marker: "[DEMO:TASK:ITEM] 山本梅子様へ持ち物案内",
        user: yamamotoUser,
        schedule: scheduleByUserId.get(yamamotoUser.id),
        request: requestByMarker.get(
          "[DEMO:ITEM:YAMAMOTO] 持ち物について",
        ),
        task_type: "send_item_notice",
        description:
          "次回の持ち物案内文面をコピーしてください。",
        priority: "normal",
        due_at: null,
      },
    ];

    phase = "tasks_select";
    const existingTasks = await supabaseRequest(env, TABLES.tasks, {
      query: {
        select: "*",
        facility_id: `eq.${facility.id}`,
        is_demo: "eq.true",
      },
    });

    const taskByMarker = new Map(
      existingTasks
        .filter((row) =>
          taskDefinitions.some(
            (definition) => definition.marker === row.title,
          )
        )
        .map((row) => [row.title, row]),
    );

    const missingTaskPayloads = taskDefinitions
      .filter((definition) => !taskByMarker.has(definition.marker))
      .map((definition) => ({
        facility_id: facility.id,
        user_id: definition.user.id,
        schedule_id: definition.schedule.id,
        family_request_id: definition.request.id,
        task_type: definition.task_type,
        title: definition.marker,
        description: definition.description,
        priority: definition.priority,
        task_status: "open",
        due_at: definition.due_at,
        assigned_staff_id: null,
        completed_at: null,
        completed_by_staff_id: null,
        completed_by_name: null,
        is_demo: true,
        created_by: operatorName,
        updated_by: operatorName,
      }));

    phase = "tasks_bulk_insert";
    const insertedTasks = missingTaskPayloads.length
      ? await supabaseRequest(env, TABLES.tasks, {
          method: "POST",
          body: missingTaskPayloads,
          prefer: "return=representation",
        })
      : [];

    for (const row of insertedTasks) {
      taskByMarker.set(row.title, row);
    }

    phase = "tasks_reset";
    for (const definition of taskDefinitions) {
      const taskRow = taskByMarker.get(definition.marker);
      if (!taskRow) {
        throw new Error(
          `デモタスクを取得できませんでした: ${definition.marker}`,
        );
      }

      if (taskRow.task_status !== "open") {
        await supabaseRequest(env, TABLES.tasks, {
          method: "PATCH",
          query: {
            id: `eq.${taskRow.id}`,
          },
          body: {
            task_status: "open",
            completed_at: null,
            completed_by_staff_id: null,
            completed_by_name: null,
            updated_by: operatorName,
          },
          prefer: "return=minimal",
        });
      }
    }

    const noteDefinitions = [
      {
        marker: "[DEMO:NOTE:SATO]",
        user: satoUser,
        schedule: scheduleByUserId.get(satoUser.id),
        note_type: "family_contact",
        note_text:
          "[DEMO:NOTE:SATO] ご家族へ帰宅前の連絡をお願いします。",
        is_important: true,
      },
      {
        marker: "[DEMO:NOTE:TANAKA]",
        user: tanakaUser,
        schedule: scheduleByUserId.get(tanakaUser.id),
        note_type: "transport",
        note_text:
          "[DEMO:NOTE:TANAKA] 送迎時間変更の確認があります。",
        is_important: true,
      },
      {
        marker: "[DEMO:NOTE:YAMAMOTO]",
        user: yamamotoUser,
        schedule: scheduleByUserId.get(yamamotoUser.id),
        note_type: "transport",
        note_text:
          "[DEMO:NOTE:YAMAMOTO] 本日は家族迎え予定です。",
        is_important: false,
      },
    ];

    phase = "notes_select";
    const existingNotes = await supabaseRequest(env, TABLES.notes, {
      query: {
        select: "*",
        facility_id: `eq.${facility.id}`,
        is_demo: "eq.true",
      },
    });

    const noteByMarker = new Map();

    for (const note of existingNotes) {
      const definition = noteDefinitions.find((item) =>
        String(note.note_text || "").startsWith(item.marker)
      );
      if (definition && !noteByMarker.has(definition.marker)) {
        noteByMarker.set(definition.marker, note);
      }
    }

    const missingNotePayloads = noteDefinitions
      .filter((definition) => !noteByMarker.has(definition.marker))
      .map((definition) => ({
        facility_id: facility.id,
        user_id: definition.user.id,
        schedule_id: definition.schedule.id,
        note_type: definition.note_type,
        note_text: definition.note_text,
        visibility: "staff",
        is_important: definition.is_important,
        is_resolved: false,
        resolved_at: null,
        resolved_by_staff_id: null,
        created_by_staff_id: null,
        created_by_name: operatorName,
        is_demo: true,
        created_by: operatorName,
        updated_by: operatorName,
      }));

    phase = "notes_bulk_insert";
    const insertedNotes = missingNotePayloads.length
      ? await supabaseRequest(env, TABLES.notes, {
          method: "POST",
          body: missingNotePayloads,
          prefer: "return=representation",
        })
      : [];

    for (const row of insertedNotes) {
      const definition = noteDefinitions.find((item) =>
        String(row.note_text || "").startsWith(item.marker)
      );
      if (definition) {
        noteByMarker.set(definition.marker, row);
      }
    }

    phase = "notes_reset";
    for (const definition of noteDefinitions) {
      const noteRow = noteByMarker.get(definition.marker);
      if (!noteRow) {
        throw new Error(
          `デモ申し送りを取得できませんでした: ${definition.marker}`,
        );
      }

      if (noteRow.is_resolved) {
        await supabaseRequest(env, TABLES.notes, {
          method: "PATCH",
          query: {
            id: `eq.${noteRow.id}`,
          },
          body: {
            is_resolved: false,
            resolved_at: null,
            resolved_by_staff_id: null,
            updated_by: operatorName,
          },
          prefer: "return=minimal",
        });
      }
    }

    phase = "operation_log";
    await logOperation(env, {
      facilityId: facility.id,
      actorType: "admin",
      actorName: operatorName,
      action: "demo_prepare_completed_bulk",
      targetTable: TABLES.facilities,
      targetId: facility.id,
      deviceType: "pc",
      isDemo: true,
      details: {
        date: today,
        users: users.length,
        strategy: "bulk",
      },
    });

    phase = "verification";
    const verification = await getDemoVerification(
      env,
      facility,
      today,
    );

    return {
      ok: true,
      service: SERVICE_NAME,
      version: VERSION,
      message: "営業前デモデータを準備しました。",
      production_guard: true,
      duplicate_guard: true,
      bulk_prepare: true,
      subrequest_safe: true,
      date: today,
      facility: publicFacility(facility),
      verification,
      demo_member_test: {
        phone: "090-9999-1111",
        user_number: "DAY-DEMO-001",
      },
    };
  } catch (error) {
    console.error("demo prepare failed", {
      phase,
      error,
    });

    if (error instanceof ApiError) {
      error.details = {
        ...(error.details || {}),
        phase,
      };
      throw error;
    }

    throw new ApiError(
      500,
      "営業前デモ準備中にエラーが発生しました。",
      {
        phase,
        message: error?.message || String(error),
      },
    );
  }
}

/* ============================================================
 * Demo helpers
 * ============================================================
 */

async function upsertDemoUser(env, facility, definition, operatorName) {
  const rows = await supabaseRequest(env, TABLES.users, {
    method: "POST",
    query: {
      on_conflict: "facility_id,user_number",
    },
    body: {
      facility_id: facility.id,
      user_number: definition.user_number,
      full_name: definition.full_name,
      full_name_kana: definition.full_name_kana,
      standard_transport_mode: definition.standard_transport_mode,
      item_note: definition.item_note,
      facility_note: definition.facility_note,
      start_date: todayJst(),
      is_active: true,
      is_demo: true,
      created_by: operatorName,
      updated_by: operatorName,
    },
    prefer: "resolution=merge-duplicates,return=representation",
  });

  return rows[0];
}

async function upsertDemoFamily(env, facility, definition, operatorName) {
  const normalized = normalizePhone(definition.phone);
  const existing = await supabaseRequest(env, TABLES.families, {
    query: {
      select: "*",
      facility_id: `eq.${facility.id}`,
      phone_normalized: `eq.${normalized}`,
      limit: "1",
    },
  });

  const payload = {
    facility_id: facility.id,
    full_name: definition.full_name,
    full_name_kana: definition.full_name_kana,
    relationship: definition.relationship,
    phone: definition.phone,
    is_primary: true,
    contact_allowed: true,
    preferred_contact_method: "line",
    is_active: true,
    is_demo: true,
    created_by: operatorName,
    updated_by: operatorName,
  };

  if (existing[0]) {
    const updated = await supabaseRequest(env, TABLES.families, {
      method: "PATCH",
      query: {
        id: `eq.${existing[0].id}`,
      },
      body: payload,
      prefer: "return=representation",
    });
    return updated[0];
  }

  const inserted = await supabaseRequest(env, TABLES.families, {
    method: "POST",
    body: payload,
    prefer: "return=representation",
  });

  return inserted[0];
}

async function upsertUserFamilyRelation(
  env,
  facility,
  user,
  family,
  operatorName,
) {
  const rows = await supabaseRequest(env, TABLES.userFamilies, {
    method: "POST",
    query: {
      on_conflict: "user_id,family_member_id",
    },
    body: {
      facility_id: facility.id,
      user_id: user.id,
      family_member_id: family.id,
      relationship_to_user: family.relationship,
      is_primary_contact: true,
      can_view_schedule: true,
      can_submit_request: true,
      is_active: true,
      is_demo: true,
      created_by: operatorName,
      updated_by: operatorName,
    },
    prefer: "resolution=merge-duplicates,return=representation",
  });

  return rows[0];
}

async function upsertServicePlan(
  env,
  facility,
  user,
  definition,
  operatorName,
) {
  const existing = await supabaseRequest(env, TABLES.servicePlans, {
    query: {
      select: "*",
      user_id: `eq.${user.id}`,
      is_active: "eq.true",
      limit: "1",
    },
  });

  const payload = {
    facility_id: facility.id,
    user_id: user.id,
    plan_name: "通常利用",
    standard_weekdays: definition.weekdays,
    effective_from: todayJst(),
    transport_mode: definition.standard_transport_mode,
    default_pickup_time: definition.pickup_time,
    default_dropoff_time: definition.dropoff_time,
    note: "営業デモ用通常利用プラン",
    is_active: true,
    is_demo: true,
    created_by: operatorName,
    updated_by: operatorName,
  };

  if (existing[0]) {
    const updated = await supabaseRequest(env, TABLES.servicePlans, {
      method: "PATCH",
      query: {
        id: `eq.${existing[0].id}`,
      },
      body: payload,
      prefer: "return=representation",
    });
    return updated[0];
  }

  const inserted = await supabaseRequest(env, TABLES.servicePlans, {
    method: "POST",
    body: payload,
    prefer: "return=representation",
  });

  return inserted[0];
}

async function upsertDemoSchedule(
  env,
  facility,
  user,
  definition,
  date,
  operatorName,
) {
  const rows = await supabaseRequest(env, TABLES.schedules, {
    method: "POST",
    query: {
      on_conflict: "user_id,service_date",
    },
    body: {
      facility_id: facility.id,
      user_id: user.id,
      service_date: date,
      status: definition.status,
      source: "demo",
      planned_arrival_time: definition.planned_arrival_time,
      planned_departure_time: definition.planned_departure_time,
      actual_arrival_at: ["arrived", "in_service"].includes(definition.status)
        ? `${date}T09:00:00+09:00`
        : null,
      transport_mode: definition.standard_transport_mode,
      schedule_note: "営業デモ用本日の利用予定",
      current_status_note: attendanceStatusLabel(definition.status),
      is_demo: true,
      created_by: operatorName,
      updated_by: operatorName,
    },
    prefer: "resolution=merge-duplicates,return=representation",
  });

  return rows[0];
}

async function upsertDemoTransport(
  env,
  facility,
  user,
  schedule,
  definition,
  date,
  operatorName,
) {
  const familyTransport = definition.standard_transport_mode !== "facility_transport";

  const rows = await supabaseRequest(env, TABLES.transports, {
    method: "POST",
    query: {
      on_conflict: "schedule_id",
    },
    body: {
      facility_id: facility.id,
      schedule_id: schedule.id,
      user_id: user.id,
      transport_mode: definition.standard_transport_mode,
      pickup_planned_at: definition.pickup_time
        ? `${date}T${definition.pickup_time}+09:00`
        : null,
      pickup_status: familyTransport ? "family_dropoff" : "pickup_planned",
      dropoff_planned_at: definition.dropoff_time
        ? `${date}T${definition.dropoff_time}+09:00`
        : null,
      dropoff_status: definition.standard_transport_mode === "family_pickup"
        ? "family_pickup"
        : familyTransport
          ? "not_required"
          : "dropoff_planned",
      family_notice_note: familyTransport
        ? "家族送迎予定"
        : "送迎時間案内を家族へ連絡",
      is_demo: true,
      created_by: operatorName,
      updated_by: operatorName,
    },
    prefer: "resolution=merge-duplicates,return=representation",
  });

  return rows[0];
}

async function ensureDemoFamilyRequest(env, options) {
  const {
    facility,
    user,
    family,
    requestType,
    subject,
    message,
    targetDate,
    requestedChangeDate,
    operatorName,
  } = options;

  const existing = await supabaseRequest(env, TABLES.familyRequests, {
    query: {
      select: "*",
      facility_id: `eq.${facility.id}`,
      subject: `eq.${subject}`,
      is_demo: "eq.true",
      limit: "1",
    },
  });

  const payload = {
    facility_id: facility.id,
    user_id: user.id,
    family_member_id: family.id,
    request_type: requestType,
    request_status: "new",
    request_source: "demo",
    target_date: targetDate,
    requested_change_date: requestedChangeDate,
    subject,
    message,
    response_message: null,
    handled_by_staff_id: null,
    handled_by_name: null,
    acknowledged_at: null,
    resolved_at: null,
    is_demo: true,
    created_by: operatorName,
    updated_by: operatorName,
  };

  if (existing[0]) {
    const updated = await supabaseRequest(env, TABLES.familyRequests, {
      method: "PATCH",
      query: {
        id: `eq.${existing[0].id}`,
      },
      body: payload,
      prefer: "return=representation",
    });
    return updated[0];
  }

  const inserted = await supabaseRequest(env, TABLES.familyRequests, {
    method: "POST",
    body: payload,
    prefer: "return=representation",
  });

  return inserted[0];
}

async function ensureDemoNote(env, options) {
  const {
    facility,
    user,
    schedule,
    marker,
    noteText,
    noteType,
    isImportant,
    operatorName,
  } = options;

  const existing = await supabaseRequest(env, TABLES.notes, {
    query: {
      select: "id",
      facility_id: `eq.${facility.id}`,
      user_id: `eq.${user.id}`,
      note_text: `like.${marker}*`,
      is_demo: "eq.true",
      limit: "1",
    },
  });

  const payload = {
    facility_id: facility.id,
    user_id: user.id,
    schedule_id: schedule.id,
    note_type: noteType,
    note_text: noteText,
    visibility: "staff",
    is_important: isImportant,
    is_resolved: false,
    created_by_name: operatorName,
    is_demo: true,
    created_by: operatorName,
    updated_by: operatorName,
  };

  if (existing[0]) {
    await supabaseRequest(env, TABLES.notes, {
      method: "PATCH",
      query: {
        id: `eq.${existing[0].id}`,
      },
      body: payload,
      prefer: "return=minimal",
    });
    return existing[0].id;
  }

  const inserted = await supabaseRequest(env, TABLES.notes, {
    method: "POST",
    body: payload,
    prefer: "return=representation",
  });

  return inserted[0].id;
}

async function getDemoVerification(env, facility, date) {
  const [users, schedules, requests, tasks, notes] = await Promise.all([
    supabaseRequest(env, TABLES.users, {
      query: {
        select: "id,user_number,full_name",
        facility_id: `eq.${facility.id}`,
        is_demo: "eq.true",
        order: "user_number.asc",
      },
    }),
    supabaseRequest(env, TABLES.schedules, {
      query: {
        select: "id,user_id,service_date,status",
        facility_id: `eq.${facility.id}`,
        service_date: `eq.${date}`,
        is_demo: "eq.true",
      },
    }),
    supabaseRequest(env, TABLES.familyRequests, {
      query: {
        select: "id,request_type,request_status,subject",
        facility_id: `eq.${facility.id}`,
        is_demo: "eq.true",
        request_status: "in.(new,acknowledged,in_progress)",
      },
    }),
    supabaseRequest(env, TABLES.tasks, {
      query: {
        select: "id,task_type,task_status,title",
        facility_id: `eq.${facility.id}`,
        is_demo: "eq.true",
        task_status: "in.(open,in_progress)",
      },
    }),
    supabaseRequest(env, TABLES.notes, {
      query: {
        select: "id,note_type,note_text,is_resolved",
        facility_id: `eq.${facility.id}`,
        is_demo: "eq.true",
        is_resolved: "eq.false",
      },
    }),
  ]);

  const userMap = new Map(users.map((row) => [row.id, row]));

  return {
    demo_user_count: users.length,
    today_schedule_count: schedules.length,
    pending_request_count: requests.length,
    open_task_count: tasks.length,
    unresolved_note_count: notes.length,
    today_users: schedules.map((schedule) => ({
      user_number: userMap.get(schedule.user_id)?.user_number ?? null,
      full_name: userMap.get(schedule.user_id)?.full_name ?? null,
      status: schedule.status,
    })),
  };
}

/* ============================================================
 * Shared database helpers
 * ============================================================
 */

async function resolveMember(env, options) {
  const facilityCode = options.facilityCode || DEFAULT_FACILITY_CODE;
  const phone = cleanText(options.phone, 100);
  const userNumber = cleanText(options.userNumber, 100);

  if (!phone || !userNumber) {
    throw new ApiError(400, "電話番号と利用者番号を入力してください。");
  }

  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone.length < 10) {
    throw new ApiError(400, "電話番号を正しく入力してください。");
  }

  const facility = await getFacilityByCode(env, facilityCode);

  const [families, users] = await Promise.all([
    supabaseRequest(env, TABLES.families, {
      query: {
        select: "*",
        facility_id: `eq.${facility.id}`,
        phone_normalized: `eq.${normalizedPhone}`,
        is_active: "eq.true",
        limit: "20",
      },
    }),
    supabaseRequest(env, TABLES.users, {
      query: {
        select: "*",
        facility_id: `eq.${facility.id}`,
        user_number: `eq.${userNumber}`,
        is_active: "eq.true",
        limit: "1",
      },
    }),
  ]);

  const user = users[0];
  if (!user || families.length === 0) {
    throw new ApiError(
      404,
      "電話番号または利用者番号を確認してください。",
    );
  }

  const relations = await supabaseRequest(env, TABLES.userFamilies, {
    query: {
      select: "*",
      user_id: `eq.${user.id}`,
      family_member_id: `in.(${families.map((row) => row.id).join(",")})`,
      is_active: "eq.true",
      can_view_schedule: "eq.true",
      limit: "20",
    },
  });

  const relation = relations[0];
  if (!relation) {
    throw new ApiError(
      403,
      "この利用者の情報を確認する権限がありません。",
    );
  }

  const family = families.find(
    (row) => row.id === relation.family_member_id,
  );

  return {
    facility,
    user,
    family,
    relation,
  };
}

async function getFacilityByCode(env, facilityCode) {
  const rows = await supabaseRequest(env, TABLES.facilities, {
    query: {
      select: "*",
      facility_code: `eq.${facilityCode}`,
      is_active: "eq.true",
      limit: "1",
    },
  });

  if (!rows[0]) {
    throw new ApiError(404, "施設情報が見つかりません。");
  }

  return rows[0];
}

async function getUserInFacility(env, facilityId, userId) {
  const rows = await supabaseRequest(env, TABLES.users, {
    query: {
      select: "*",
      id: `eq.${userId}`,
      facility_id: `eq.${facilityId}`,
      is_active: "eq.true",
      limit: "1",
    },
  });

  if (!rows[0]) {
    throw new ApiError(404, "利用者が見つかりません。");
  }

  return rows[0];
}

async function getActiveAnnouncements(
  env,
  facilityId,
  targetType,
  userId = null,
) {
  const now = new Date().toISOString();

  const rows = await supabaseRequest(env, TABLES.announcements, {
    query: {
      select: [
        "id",
        "title",
        "body",
        "target_type",
        "target_user_id",
        "publish_from",
        "publish_until",
        "is_pinned",
        "created_at",
      ].join(","),
      facility_id: `eq.${facilityId}`,
      is_active: "eq.true",
      or: `(target_type.eq.all,target_type.eq.${targetType}${userId ? `,and(target_type.eq.specific_user,target_user_id.eq.${userId})` : ""})`,
      order: "is_pinned.desc,created_at.desc",
      limit: "50",
    },
  });

  return rows.filter((row) => {
    if (row.publish_from && row.publish_from > now) return false;
    if (row.publish_until && row.publish_until < now) return false;
    return true;
  });
}

async function createTaskIfMissing(env, options) {
  const {
    facilityId,
    userId,
    scheduleId,
    familyRequestId,
    taskType,
    title,
    description,
    priority,
    dueAt,
    isDemo,
  } = options;

  const query = {
    select: "id",
    facility_id: `eq.${facilityId}`,
    title: `eq.${title}`,
    task_status: "in.(open,in_progress)",
    limit: "1",
  };

  if (familyRequestId) {
    query.family_request_id = `eq.${familyRequestId}`;
  }

  const existing = await supabaseRequest(env, TABLES.tasks, { query });
  if (existing[0]) return existing[0];

  const inserted = await supabaseRequest(env, TABLES.tasks, {
    method: "POST",
    body: {
      facility_id: facilityId,
      user_id: userId,
      schedule_id: scheduleId,
      family_request_id: familyRequestId,
      task_type: taskType,
      title,
      description,
      priority: priority || "normal",
      task_status: "open",
      due_at: dueAt,
      is_demo: Boolean(isDemo),
      created_by: "system",
      updated_by: "system",
    },
    prefer: "return=representation",
  });

  return inserted[0];
}

async function upsertTransportPlan(env, facility, user, schedule, body) {
  const date = schedule.service_date;
  const pickupTime = optionalTime(body.pickup_time);
  const dropoffTime = optionalTime(body.dropoff_time);

  const payload = {
    facility_id: facility.id,
    schedule_id: schedule.id,
    user_id: user.id,
    transport_mode: body.transport_mode
      || schedule.transport_mode
      || user.standard_transport_mode,
    pickup_planned_at: pickupTime
      ? `${date}T${pickupTime}+09:00`
      : optionalDateTime(body.pickup_planned_at),
    dropoff_planned_at: dropoffTime
      ? `${date}T${dropoffTime}+09:00`
      : optionalDateTime(body.dropoff_planned_at),
    pickup_status: body.transport_mode === "family_transport"
      ? "family_dropoff"
      : "pickup_planned",
    dropoff_status: body.transport_mode === "family_pickup"
      ? "family_pickup"
      : "dropoff_planned",
    family_notice_note: normalizeNewlines(
      cleanText(body.family_notice_note, 1000),
    ) || null,
    is_demo: Boolean(user.is_demo),
    created_by: cleanText(body.operator_name, 100) || "管理画面",
    updated_by: cleanText(body.operator_name, 100) || "管理画面",
  };

  const rows = await supabaseRequest(env, TABLES.transports, {
    method: "POST",
    query: {
      on_conflict: "schedule_id",
    },
    body: payload,
    prefer: "resolution=merge-duplicates,return=representation",
  });

  return rows[0];
}

async function ensureDailyChecks(
  env,
  facility,
  user,
  schedule,
  completion = {},
) {
  const checkTypes = [
    "lunch",
    "bath",
    "recreation",
    "family_contact",
    "go_home_preparation",
  ];

  const rows = checkTypes.map((checkType) => {
    const isCompleted = Boolean(completion[checkType]);
    return {
      facility_id: facility.id,
      schedule_id: schedule.id,
      user_id: user.id,
      check_type: checkType,
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
      completed_by_name: isCompleted ? "営業前デモ準備" : null,
      note: null,
      is_demo: Boolean(user.is_demo),
      created_by: "system",
      updated_by: "system",
    };
  });

  return supabaseRequest(env, TABLES.dailyChecks, {
    method: "POST",
    query: {
      on_conflict: "schedule_id,check_type",
    },
    body: rows,
    prefer: "resolution=merge-duplicates,return=representation",
  });
}

async function logOperation(env, options) {
  try {
    await supabaseRequest(env, TABLES.operationLogs, {
      method: "POST",
      body: {
        facility_id: options.facilityId || null,
        actor_type: options.actorType || "system",
        actor_id: options.actorId || null,
        actor_name: options.actorName || null,
        action: options.action,
        target_table: options.targetTable || null,
        target_id: options.targetId || null,
        details: options.details || {},
        device_type: options.deviceType || "api",
        is_demo: Boolean(options.isDemo),
      },
      prefer: "return=minimal",
    });
  } catch (error) {
    console.error("operation log failed:", error);
  }
}

async function supabaseRequest(env, table, options = {}) {
  const baseUrl = String(env.SUPABASE_URL).replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/rest/v1/${table}`);

  for (const [key, value] of Object.entries(options.query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const method = options.method || "GET";
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: method === "GET" || method === "HEAD"
      ? undefined
      : JSON.stringify(options.body ?? {}),
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    console.error("Supabase error", {
      table,
      method,
      status: response.status,
      data,
    });

    throw new ApiError(
      502,
      "データベース処理に失敗しました。",
      {
        table,
        status: response.status,
        message: typeof data === "object"
          ? data?.message || data?.hint || data?.details || null
          : data,
      },
    );
  }

  if (data === null) return [];
  return Array.isArray(data) ? data : data;
}

/* ============================================================
 * Admin authentication
 * ============================================================
 */

async function requireAdmin({ request, env, url, body }) {
  const facilityCode = body.facility_code
    || getFacilityCode(url, env);
  const adminCode = request.headers.get("x-admin-code")
    || url.searchParams.get("admin_key")
    || body.admin_code
    || body.admin_key;

  if (!adminCode) {
    throw new ApiError(401, "管理コードを入力してください。");
  }

  const facility = await getFacilityByCode(env, facilityCode);
  const suppliedHash = await sha256Hex(String(adminCode));

  if (!secureStringEqual(suppliedHash, facility.admin_code_hash)) {
    throw new ApiError(401, "管理コードが正しくありません。");
  }

  return facility;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function secureStringEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");

  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

/* ============================================================
 * Validation / formatting
 * ============================================================
 */

function validateEnvironment(env) {
  if (!env.SUPABASE_URL) {
    throw new ApiError(500, "SUPABASE_URLが設定されていません。");
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new ApiError(
      500,
      "SUPABASE_SERVICE_ROLE_KEYが設定されていません。",
    );
  }
}

function normalizePath(pathname) {
  const normalized = pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return normalized || "/";
}

async function readJsonBody(request) {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new ApiError(
      415,
      "Content-Typeはapplication/jsonを指定してください。",
    );
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("invalid body");
    }
    return body;
  } catch {
    throw new ApiError(400, "JSON形式のリクエスト本文を確認してください。");
  }
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}

function getAllowedOrigins(env) {
  const raw = cleanText(env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || "", 4000);
  const configured = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value && value !== "*" && /^https:\/\//i.test(value));
  return unique([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function corsHeaders(request, env) {
  const requestOrigin = request.headers.get("Origin");
  const allowedOrigins = getAllowedOrigins(env);
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": [
      "Content-Type",
      "Authorization",
      "X-Admin-Code",
      "X-Requested-With",
    ].join(", "),
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    headers["Access-Control-Allow-Origin"] = requestOrigin;
  }
  return headers;
}

function getFacilityCode(url, env) {
  return url.searchParams.get("facility_code")
    || env.DEFAULT_FACILITY_CODE
    || DEFAULT_FACILITY_CODE;
}

function cleanText(value, maxLength = 1000) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, maxLength);
}

function normalizeNewlines(value) {
  if (!value) return "";
  return String(value)
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizePhone(value) {
  let phone = String(value || "")
    .replace(/[０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
    )
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

function requireDate(value, label) {
  const date = optionalDate(value);
  if (!date) {
    throw new ApiError(400, `${label}を正しく入力してください。`);
  }
  return date;
}

function optionalDate(value) {
  const text = cleanText(value, 20);
  if (!text) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return text;
}

function optionalTime(value) {
  const text = cleanText(value, 20);
  if (!text) return null;

  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(text)) {
    throw new ApiError(400, "時刻はHH:mm形式で入力してください。");
  }

  const [hour, minute, second = 0] = text.split(":").map(Number);
  if (
    hour < 0 || hour > 23
    || minute < 0 || minute > 59
    || second < 0 || second > 59
  ) {
    throw new ApiError(400, "時刻を正しく入力してください。");
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

function optionalDateTime(value) {
  const text = cleanText(value, 100);
  if (!text) return null;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, "日時を正しく入力してください。");
  }

  return parsed.toISOString();
}

function ensureNotPastDate(date) {
  if (date < todayJst()) {
    throw new ApiError(400, "過去の日付は選択できません。");
  }
}

function todayJst() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function addDaysToDate(dateText, days) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function requireUuid(value, label) {
  const uuid = optionalUuid(value);
  if (!uuid) {
    throw new ApiError(400, `${label}を正しく指定してください。`);
  }
  return uuid;
}

function optionalUuid(value) {
  const text = cleanText(value, 100);
  if (!text) return null;

  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return pattern.test(text) ? text : null;
}

function cleanDeviceType(value) {
  const deviceType = cleanText(value, 20) || "pc";
  return ["pc", "ipad", "mobile", "api", "system"].includes(deviceType)
    ? deviceType
    : "pc";
}

function sanitizePostgrestSearch(value) {
  return cleanText(value, 100)
    .replace(/[%*(),."']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function publicFacility(facility) {
  return {
    facility_code: facility.facility_code,
    facility_name: facility.facility_name,
    phone: facility.phone,
    postal_code: facility.postal_code,
    address: facility.address,
    timezone: facility.timezone,
    contact_note: facility.contact_note,
    settings: facility.settings || {},
  };
}

function sanitizeFamilyRequest(row) {
  return {
    id: row.id,
    request_type: row.request_type,
    request_status: row.request_status,
    request_source: row.request_source,
    target_date: row.target_date,
    requested_change_date: row.requested_change_date,
    subject: row.subject,
    message: row.message,
    response_message: row.response_message,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function countStatuses(rows) {
  return rows.reduce((counts, row) => {
    counts[row.status] = (counts[row.status] || 0) + 1;
    return counts;
  }, {});
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  }
  return map;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function deduplicateById(rows) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function attendanceStatusLabel(status) {
  const labels = {
    scheduled: "利用予定",
    absent: "お休み",
    arrived: "来所済み",
    in_service: "利用中",
    ready_to_go_home: "帰宅準備",
    transport_departed: "送迎出発",
    completed: "帰宅完了",
    cancelled: "予定取消",
  };
  return labels[status] || status;
}

function handlePhoneNormalizeCheck() {
  const samples = [
    "090-9999-1111",
    "09099991111",
    "090 9999 1111",
    "０９０－９９９９－１１１１",
    "+81 90-9999-1111",
  ];

  return {
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    expected: "09099991111",
    results: samples.map((input) => ({
      input,
      normalized: normalizePhone(input),
      matched: normalizePhone(input) === "09099991111",
    })),
  };
}
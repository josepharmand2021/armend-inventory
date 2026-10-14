// ARMEND — POS API: terima hitungan menu terjual dari kasir/POS.
//
// POST https://<project>.supabase.co/functions/v1/pos-menu-count
//   Header : x-api-key: armend_pos_xxxxxxxx   (atau Authorization: Bearer armend_pos_xxxxxxxx)
//   Body   : {
//     "date":   "2026-10-14",          // opsional, default hari ini (WIB). Maks 31 hari ke belakang, tidak boleh ke depan.
//     "mode":   "set",                 // opsional. "set" (default) = total harian per menu, idempotent / aman di-retry
//                                      //           "add" = tambahan di atas qty yang sudah tercatat hari itu
//     "source": "Moka",                // opsional, nama POS — muncul di ledger sebagai "POS: Moka"
//     "strict": false,                 // opsional. true = tolak SEMUA kalau ada item yang tidak cocok
//     "items": [                       // 1..500 baris. Satu menu boleh muncul berkali-kali (qty dijumlahkan)
//       { "pos_code": "KOPI-001", "qty": 12 },   // dicocokkan ke menu.pos_code (Master Data -> Menu -> Kode POS)
//       { "menu_id":  "hara-bar-es-kopi-susu", "qty": 3 },
//       { "name":     "Es Kopi Susu", "qty": 5 } // dicocokkan ke nama menu (tidak peka huruf besar/kecil)
//     ]
//   }
//
// API key terikat ke SATU area (dibuat di app: Pengaturan -> Integrasi POS), jadi POS tidak perlu
// (dan tidak bisa) menyebut outlet. Menu nonaktif tidak diterima (supaya produk yang stoknya dikelola
// lewat Catat Produksi tidak kepotong dobel).
//
// Deploy: Supabase dashboard -> Edge Functions -> Deploy new function
//   name: pos-menu-count   (paste file ini)
//   PENTING: matikan "Verify JWT" (POS tidak punya JWT Supabase — autentikasinya pakai API key di atas).
// Atau CLI: supabase functions deploy pos-menu-count --no-verify-jwt
// Tidak perlu secret tambahan — SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY otomatis tersedia.

import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION = "v1";
const MAX_ITEMS = 500;
const MAX_BODY = 200_000;
const MAX_BACKDAYS = 31;
const MAX_QTY = 100_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// YYYY-MM-DD in Asia/Jakarta
function todayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}

type Hit = { ref: Record<string, unknown>; reason: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Gunakan POST" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return json({ error: "Server belum diset — SUPABASE_SERVICE_ROLE_KEY tidak ada" }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // ---- auth: API key -> area ----
  let rawKey = (req.headers.get("x-api-key") ?? "").trim();
  if (!rawKey) {
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (bearer.startsWith("armend_pos_")) rawKey = bearer;
  }
  if (!rawKey) return json({ error: "API key tidak ada (header x-api-key)" }, 401);

  const { data: keyRow, error: kErr } = await admin
    .from("pos_api_keys").select("id, outlet_id, active").eq("key_hash", await sha256Hex(rawKey)).maybeSingle();
  if (kErr) return json({ error: "Gagal cek API key: " + kErr.message }, 500);
  if (!keyRow || !keyRow.active) return json({ error: "API key tidak valid atau sudah dicabut" }, 401);
  const outletId: string = keyRow.outlet_id;

  let payload: Record<string, unknown> = {};
  const log = async (status: string, applied: number, entryDate: string | null, mode: string | null, result: unknown) => {
    try {
      await admin.from("pos_import_log").insert({
        outlet_id: outletId, key_id: keyRow.id, entry_date: entryDate, mode, status, applied, payload, result,
      });
    } catch (_) { /* log is best-effort */ }
  };

  try {
    // ---- parse body ----
    const text = await req.text();
    if (text.length > MAX_BODY) return json({ error: "Body terlalu besar" }, 413);
    try { payload = JSON.parse(text); } catch (_) { return json({ error: "Body bukan JSON yang valid" }, 400); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json({ error: "Body harus object JSON" }, 400);

    const mode = payload.mode === undefined ? "set" : String(payload.mode);
    if (mode !== "set" && mode !== "add") return json({ error: 'mode harus "set" atau "add"' }, 400);
    const strict = payload.strict === true;

    const today = todayWIB();
    const date = payload.date === undefined ? today : String(payload.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date + "T00:00:00Z"))) {
      return json({ error: "date harus format YYYY-MM-DD" }, 400);
    }
    if (date > today) return json({ error: "date tidak boleh di masa depan" }, 400);
    if (daysBetween(date, today) > MAX_BACKDAYS) return json({ error: `date maksimal ${MAX_BACKDAYS} hari ke belakang` }, 400);

    const items = payload.items;
    if (!Array.isArray(items) || !items.length) return json({ error: "items harus array berisi minimal 1 baris" }, 400);
    if (items.length > MAX_ITEMS) return json({ error: `items maksimal ${MAX_ITEMS} baris per request` }, 400);

    // ---- resolve items -> menu ----
    const { data: menus, error: mErr } = await admin
      .from("menu").select("id, name, pos_code, active").eq("outlet_id", outletId);
    if (mErr) return json({ error: "Gagal baca menu: " + mErr.message }, 500);
    const byId = new Map<string, any>(), byCode = new Map<string, any>(), byName = new Map<string, any>();
    for (const m of menus ?? []) {
      byId.set(m.id, m);
      if (m.pos_code) byCode.set(String(m.pos_code).trim().toLowerCase(), m);
      byName.set(String(m.name).trim().toLowerCase(), m);
    }

    const totals = new Map<string, number>();
    const unmatched: Hit[] = [];
    items.forEach((raw: any, idx: number) => {
      const ref: Record<string, unknown> = { index: idx };
      if (!raw || typeof raw !== "object") { unmatched.push({ ref, reason: "baris bukan object" }); return; }
      if (raw.menu_id !== undefined) ref.menu_id = raw.menu_id;
      if (raw.pos_code !== undefined) ref.pos_code = raw.pos_code;
      if (raw.name !== undefined) ref.name = raw.name;

      const qty = Number(raw.qty);
      if (raw.qty === undefined || raw.qty === null || raw.qty === "" || !Number.isFinite(qty) || qty < 0 || qty > MAX_QTY) {
        unmatched.push({ ref, reason: `qty tidak valid (harus angka 0..${MAX_QTY})` }); return;
      }
      let m: any = null;
      if (raw.menu_id !== undefined) m = byId.get(String(raw.menu_id));
      if (!m && raw.pos_code !== undefined) m = byCode.get(String(raw.pos_code).trim().toLowerCase());
      if (!m && raw.name !== undefined) m = byName.get(String(raw.name).trim().toLowerCase());
      if (!m) {
        const given = raw.menu_id !== undefined || raw.pos_code !== undefined || raw.name !== undefined;
        unmatched.push({ ref, reason: given ? "menu tidak ditemukan di area ini" : "isi salah satu: menu_id, pos_code, atau name" });
        return;
      }
      if (!m.active) { unmatched.push({ ref, reason: `menu "${m.name}" nonaktif` }); return; }
      totals.set(m.id, (totals.get(m.id) ?? 0) + qty);
    });

    if (strict && unmatched.length) {
      const result = { ok: false, error: "strict: ada item yang tidak cocok, tidak ada yang diterapkan", unmatched };
      await log("rejected", 0, date, mode, result);
      return json(result, 422);
    }
    if (!totals.size) {
      const result = { ok: false, error: "Tidak ada item yang cocok dengan menu", unmatched };
      await log("rejected", 0, date, mode, result);
      return json(result, 422);
    }

    // ---- apply ----
    const quantities: Record<string, number> = {};
    for (const [id, q] of totals) quantities[id] = Math.round(q * 10000) / 10000;
    const source = String(payload.source ?? "").trim().replace(/[^\w .\-]/g, "").slice(0, 30);
    const { error: rErr } = await admin.rpc("submit_menu_count_pos", {
      p_outlet: outletId, p_date: date, p_quantities: quantities,
      p_by_name: source ? `POS: ${source}` : "POS", p_mode: mode,
    });
    if (rErr) {
      const result = { ok: false, error: "Gagal menerapkan: " + rErr.message };
      await log("error", 0, date, mode, result);
      return json(result, 500);
    }

    await admin.from("pos_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);
    const applied = [...totals.keys()].map((id) => ({ menu_id: id, name: byId.get(id).name, qty: quantities[id] }));
    const status = unmatched.length ? "partial" : "ok";
    const result = { ok: true, status, version: VERSION, outlet_id: outletId, date, mode, applied: applied.length, menus: applied, unmatched };
    await log(status, applied.length, date, mode, result);
    return json(result);
  } catch (e) {
    const result = { ok: false, error: String((e as Error)?.message ?? e) };
    await log("error", 0, null, null, result);
    return json(result, 500);
  }
});

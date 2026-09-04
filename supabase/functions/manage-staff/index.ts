// ARMEND — staff management edge function.
// Lets an admin create staff accounts, reset passwords, and remove staff
// from inside the app, without ever exposing the service_role key to the browser.
//
// Deploy: Supabase dashboard -> Edge Functions -> Deploy new function
//   name: manage-staff   (paste this file)
// Or CLI: supabase functions deploy manage-staff
// Keep "Verify JWT" ON (default). No extra secrets needed — SUPABASE_URL,
// SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION = "v6";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Tidak ada sesi" }, 401);

    const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    if (!url || !serviceKey) {
      return json({ error: "Server belum diset — SUPABASE_SERVICE_ROLE_KEY tidak ada. Tambahkan di Edge Functions > Secrets." }, 500);
    }

    // Who is calling?
    const caller = createClient(url, anonKey || serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "Sesi tidak valid" }, 401);

    // Service-role client (bypasses RLS).
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: prof, error: pErr } = await admin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    const isOwner = prof?.role === "admin" || prof?.role === "manager";  // manajer = admin semua outlet

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "create";
    const outletId = String(body.outlet_id ?? "").trim();
    const dbg = `${VERSION} uid=${user.id.slice(0, 8)} role=${prof?.role ?? "null"} pErr=${pErr?.message ?? "-"} keyLen=${serviceKey.length}`;
    console.log("manage-staff", dbg, JSON.stringify({ action, outletId }));

    // Caller must be owner, or an admin member of the target area (directly
    // or via its parent group).
    async function authorized(): Promise<boolean> {
      if (isOwner) return true;
      if (!outletId) return false;
      const { data: o } = await admin.from("outlets").select("parent_id").eq("id", outletId).maybeSingle();
      const ids = [outletId, o?.parent_id].filter(Boolean);
      const { data } = await admin.from("outlet_members")
        .select("role").in("outlet_id", ids).eq("user_id", user.id).eq("role", "admin");
      return (data?.length ?? 0) > 0;
    }
    if (!(await authorized())) return json({ error: `Akses ditolak [${dbg}]` }, 403);

    if (action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const name = String(body.name ?? "").trim();
      const role = ["admin","supervisor","staff"].includes(body.role) ? body.role : "staff";
      if (!email || !password) return json({ error: "Email & password wajib diisi" }, 400);
      if (password.length < 6) return json({ error: "Password minimal 6 karakter" }, 400);
      if (!outletId) return json({ error: "outlet_id wajib" }, 400);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { name },
      });
      if (cErr) return json({ error: cErr.message }, 400);
      const uid = created.user!.id;

      await admin.from("profiles")
        .update({ name: name || email.split("@")[0], email })
        .eq("id", uid);
      await admin.from("outlet_members")
        .upsert({ outlet_id: outletId, user_id: uid, role }, { onConflict: "outlet_id,user_id" });

      return json({ ok: true, id: uid });
    }

    if (action === "add_member") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const role = ["admin","supervisor","staff"].includes(body.role) ? body.role : "staff";
      if (!email || !outletId) return json({ error: "Email & outlet_id wajib" }, 400);
      const { data: p } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
      if (!p) return json({ error: "Belum ada akun dengan email itu. Pakai Undang Staff untuk buat baru." }, 404);
      const { error } = await admin.from("outlet_members")
        .upsert({ outlet_id: outletId, user_id: p.id, role }, { onConflict: "outlet_id,user_id" });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, id: p.id });
    }

    // for non-owners, the target must be a member of the area (or its group)
    async function targetInOutlet(targetId: string): Promise<boolean> {
      if (isOwner) return true;
      const { data: o } = await admin.from("outlets").select("parent_id").eq("id", outletId).maybeSingle();
      const ids = [outletId, o?.parent_id].filter(Boolean);
      const { data } = await admin.from("outlet_members")
        .select("user_id").in("outlet_id", ids).eq("user_id", targetId);
      return (data?.length ?? 0) > 0;
    }

    if (action === "set_password") {
      const id = String(body.id ?? "");
      const password = String(body.password ?? "");
      if (!id) return json({ error: "id wajib" }, 400);
      if (password.length < 6) return json({ error: "Password minimal 6 karakter" }, 400);
      if (!(await targetInOutlet(id))) return json({ error: "Pengguna bukan anggota outlet ini" }, 403);
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      if (!isOwner) return json({ error: "Hanya owner yang boleh menghapus akun" }, 403);
      const id = String(body.id ?? "");
      if (!id) return json({ error: "id wajib" }, 400);
      if (id === user.id) return json({ error: "Tidak bisa menghapus akun sendiri" }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

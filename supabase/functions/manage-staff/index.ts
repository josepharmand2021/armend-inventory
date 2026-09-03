// ARMEND — staff management edge function.
// Lets an admin create staff accounts, reset passwords, and remove staff
// from inside the app, without ever exposing the service_role key to the browser.
//
// Deploy: Supabase dashboard -> Edge Functions -> Deploy new function
//   name: manage-staff   (paste this file)
// Or CLI: supabase functions deploy manage-staff
// Keep "Verify JWT" ON (default). No extra secrets needed — SUPABASE_URL,
// SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

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

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Who is calling?
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "Sesi tidak valid" }, 401);

    // Service-role client (bypasses RLS) — used only after the admin check below.
    const admin = createClient(url, serviceKey);

    const { data: prof } = await admin
      .from("profiles").select("role").eq("id", user.id).single();
    if (!prof || prof.role !== "admin") return json({ error: "Khusus admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "create";

    if (action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const name = String(body.name ?? "").trim();
      const role = body.role === "admin" ? "admin" : "staff";
      if (!email || !password) return json({ error: "Email & password wajib diisi" }, 400);
      if (password.length < 6) return json({ error: "Password minimal 6 karakter" }, 400);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (cErr) return json({ error: cErr.message }, 400);

      // handle_new_user trigger already made the profile row; set name + role.
      await admin.from("profiles")
        .update({ name: name || email.split("@")[0], role, email })
        .eq("id", created.user!.id);

      return json({ ok: true, id: created.user!.id });
    }

    if (action === "set_password") {
      const id = String(body.id ?? "");
      const password = String(body.password ?? "");
      if (!id) return json({ error: "id wajib" }, 400);
      if (password.length < 6) return json({ error: "Password minimal 6 karakter" }, 400);
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
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

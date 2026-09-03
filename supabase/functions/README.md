# Edge Functions — deploy

## manage-staff

Lets an admin create staff accounts, reset passwords, and remove staff from
inside the ARMEND app (halaman **Pengguna**). The service-role key stays on
Supabase's servers — never in the browser.

### Deploy lewat dashboard (paling gampang, tanpa install apa-apa)

1. Buka project Supabase → sidebar **Edge Functions**
2. **Deploy a new function** (atau **Create a new function**)
3. Nama: `manage-staff`
4. Hapus kode contoh, tempel **seluruh isi** `manage-staff/index.ts`
5. Biarkan **Verify JWT = ON** (default)
6. **Deploy**

Nggak perlu set secret apa pun — `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` sudah otomatis tersedia di edge function.

### Deploy lewat CLI (kalau punya Supabase CLI)

```bash
supabase functions deploy manage-staff
```

### Cek berhasil

Di app: login sebagai admin → **Pengguna** → **+ Undang Staff** → isi email +
password → staff langsung bisa login.

Kalau muncul "Khusus admin" padahal kamu admin: pastikan `profiles.role` kamu
sudah `'admin'` (jalankan `update public.profiles set role='admin' where email='...'`).

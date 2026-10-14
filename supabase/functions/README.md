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

## pos-menu-count

API buat nerima **hitungan menu terjual dari POS/kasir** — gantinya ngisi
Hitung Menu Terjual manual. Dokumentasi request ada di komentar atas
`pos-menu-count/index.ts` dan di app (Pengaturan → Integrasi POS → "Cara pakai").

Urutan setup:

1. Jalankan `supabase/pos_api.sql` di SQL Editor (kolom `menu.pos_code`, tabel API key & log, RPC khusus POS)
2. Deploy function: Edge Functions → **Deploy a new function** → nama `pos-menu-count` → tempel `pos-menu-count/index.ts`
3. **Matikan "Verify JWT"** — POS nggak punya JWT Supabase, autentikasinya pakai API key
   (CLI: `supabase functions deploy pos-menu-count --no-verify-jwt`)
4. Di app: Master Data → Menu → isi **Kode POS** tiap menu (SKU di kasir)
5. Pengaturan (di area yang mau dihubungkan) → Integrasi POS → **+ Buat API key** → salin key-nya (tampil sekali)
6. Kasih endpoint + key ke vendor POS

Catatan: 1 API key = 1 area. Kalau 1 POS melayani beberapa area, bikin 1 key per area.
`mode: "set"` (default) = total harian per menu, aman dikirim ulang; `mode: "add"` = tambahan.
Menu yang diisi manual lewat Hitung Menu Terjual di hari yang sama akan ketimpa angka terakhir yang disubmit
(POS atau manual) — pilih satu sumber per area biar nggak bingung.

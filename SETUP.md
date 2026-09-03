# HARA Bar Control — Panduan Setup & Deploy

Panduan ini ditulis untuk yang belum pernah deploy website sebelumnya. Tidak perlu install apa-apa di komputer — semua langkah di bawah dilakukan lewat browser (klik-klik di website).

Total waktu: sekitar 30-45 menit. Semua langkah pakai *free tier* (gratis), kecuali domain sendiri (opsional, biasanya Rp100-200rb/tahun kalau mau pakai domain kayak harabar.id).

Ada 4 tahap:
1. Buat database (Supabase)
2. Isi database dengan struktur tabel + data awal
3. Jadikan diri kamu admin pertama
4. Upload kode ke GitHub, lalu deploy ke Vercel

---

## Tahap 1 — Buat project Supabase (database + login)

1. Buka https://supabase.com, klik **Start your project**, daftar pakai akun Google/GitHub/email (gratis).
2. Klik **New project**.
3. Isi:
   - **Name**: `hara-bar-control` (bebas)
   - **Database Password**: buat password yang kuat, **simpan di tempat aman** (dipakai lagi kalau suatu saat perlu akses langsung ke database)
   - **Region**: pilih yang paling dekat (misalnya Southeast Asia (Singapore))
4. Klik **Create new project**. Tunggu 1-2 menit sampai project selesai dibuat.

---

## Tahap 2 — Isi database

1. Di sidebar kiri project kamu, klik **SQL Editor**.
2. Klik **New query**.
3. Buka file `supabase/schema.sql` (ada di folder project yang saya kirim), **copy semua isinya**, paste ke SQL Editor.
4. Klik **Run** (atau tekan Ctrl/Cmd+Enter). Tunggu sampai muncul "Success. No rows returned".
5. Klik **New query** lagi. Buka file `supabase/seed.sql`, copy semua isinya, paste, lalu **Run** lagi.
   - Ini akan mengisi database dengan 92 item bahan, 51 menu, dan semua resep — persis seperti yang ada di spreadsheet HARA_BAR_CONTROL kamu sekarang.

Kalau kedua langkah ini sukses tanpa error merah, database kamu sudah siap.

---

## Tahap 3 — Buat akun staff & jadikan dirimu admin

Aplikasi ini **tidak punya tombol daftar sendiri** — sengaja, supaya cuma orang yang kamu undang yang bisa login. Kamu (sebagai admin) yang mengundang tiap staff dari dashboard Supabase.

**3a. Undang dirimu sendiri dulu:**
1. Di sidebar Supabase, klik **Authentication** → **Users**.
2. Klik **Add user** → **Send invite email** (atau **Create new user** kalau mau langsung set password tanpa email).
3. Masukkan email kamu. User akan menerima email untuk set password (cek folder spam kalau tidak muncul).

**3b. Jadikan akun itu admin** (langkah ini WAJIB dan cuma perlu dilakukan sekali, untuk admin pertama):
1. Balik ke **SQL Editor** → **New query**.
2. Jalankan (ganti dengan email kamu):
   ```sql
   update public.profiles set role = 'admin' where email = 'emailkamu@contoh.com';
   ```
3. Klik **Run**.

Setelah ini, login pertama kamu ke aplikasi akan otomatis berperan **admin** — bisa mengatur staff lain, ubah resep, dsb, langsung dari menu **Pengguna** di aplikasi (tidak perlu balik ke SQL Editor lagi untuk staff berikutnya — cukup invite via Authentication → Users seperti 3a, defaultnya otomatis jadi "staff", lalu kamu naikkan ke admin lewat menu Pengguna kalau perlu).

---

## Tahap 4 — Deploy website

### 4a. Upload kode ke GitHub

1. Buka https://github.com, daftar/login (gratis).
2. Klik **+** di kanan atas → **New repository**. Kasih nama `hara-bar-control`, set **Private**, klik **Create repository**.
3. Di halaman repo kosong itu, klik link **uploading an existing file**.
4. Drag & drop **semua isi folder project** (kecuali folder `node_modules` kalau ada — tidak perlu diupload) ke area upload.
5. Klik **Commit changes**.

### 4b. Deploy ke Vercel

1. Buka https://vercel.com, klik **Sign Up**, pilih **Continue with GitHub** (paling gampang karena langsung nyambung).
2. Di dashboard Vercel, klik **Add New** → **Project**.
3. Cari repo `hara-bar-control` yang tadi diupload, klik **Import**.
4. Vercel otomatis mendeteksi ini project Vite — biarkan default settingnya.
5. Sebelum klik Deploy, buka bagian **Environment Variables**, tambahkan 2 baris:
   - `VITE_SUPABASE_URL` = (dari Supabase: **Project Settings** → **API** → **Project URL**)
   - `VITE_SUPABASE_ANON_KEY` = (dari Supabase: **Project Settings** → **API** → key **anon public**)
6. Klik **Deploy**. Tunggu 1-2 menit.
7. Selesai! Vercel kasih link seperti `hara-bar-control.vercel.app` — ini sudah live dan bisa diakses siapa saja yang kamu kasih link + akun login, dari HP atau komputer manapun, tanpa perlu akun Claude.

### 4c. (Opsional) Pasang domain sendiri, misalnya harabar.id

1. Beli domain di penyedia mana saja (Niagahoster, Rumahweb, Namecheap, dll).
2. Di Vercel, buka project kamu → **Settings** → **Domains** → masukkan domain kamu (mis. `harabar.id`) → **Add**.
3. Vercel akan kasih instruksi DNS (biasanya 1-2 baris record tipe `A` atau `CNAME`) — masukkan itu ke pengaturan DNS di tempat kamu beli domain.
4. Tunggu propagasi DNS (biasanya 10 menit - beberapa jam). Setelah itu, `harabar.id` langsung mengarah ke aplikasi ini.

---

## Menambah staff baru (dipakai terus-menerus ke depannya)

Setiap kali ada staff baru:
1. Supabase → **Authentication** → **Users** → **Add user** → **Send invite email**, masukkan email staff.
2. Staff terima email, set password, lalu login di website pakai email+password itu.
3. Otomatis dapat peran **staff** (bisa input stok, hitung menu terjual, isi opname — tapi tidak bisa ubah data master/resep atau peran orang lain).
4. Kalau mau naikkan jadi admin: login sebagai admin → menu **Pengguna** → ubah perannya.

## Kalau lupa password

Di halaman login Supabase Authentication → Users, klik user yang bersangkutan → kamu (admin) bisa reset/kirim ulang link set password dari sana.

---

## Apa yang beda dari versi sebelumnya (Claude Artifact)

- **Login staff sungguhan** dengan email+password masing-masing, bukan sekadar ketik nama — dan setiap perubahan tercatat siapa yang melakukannya.
- **Peran admin/staff ditegakkan di level database** (row-level security), bukan cuma disembunyikan di tampilan — jadi staff secara teknis memang tidak bisa mengubah data master meskipun mencoba lewat cara lain.
- **Transaksi atomik**: saat submit hitung menu terjual atau stock opname, semua perubahan stok tersimpan sekaligus atau tidak sama sekali (tidak ada risiko data setengah tersimpan kalau koneksi putus di tengah jalan).
- **Bisa diakses dari domain sendiri**, tanpa perlu akun Claude — tinggal share link ke staff.
- **Database lebih tahan lama untuk jangka panjang** (Postgres asli via Supabase, bukan penyimpanan ringan bawaan Artifact).

Kalau ada error saat setup, screenshot pesan errornya dan kirim ke saya — saya bantu telusuri.

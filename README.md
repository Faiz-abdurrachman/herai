# Woman in Tech - HerAI Fellowship 2026

## Cara Menjalankan Aplikasi

### Opsi 1: Menggunakan Live Server (VS Code)
1. Install ekstensi "Live Server" di VS Code
2. Klik kanan pada `index.html`
3. Pilih "Open with Live Server"

### Opsi 2: Menggunakan Python HTTP Server
```bash
# Jalankan di folder root project
python -m http.server 8000
```
Buka browser: `http://localhost:8000`

### Opsi 3: Menggunakan Node.js http-server
```bash
# Install http-server (sekali saja)
npm install -g http-server

# Jalankan di folder root project
http-server -p 8000
```
Buka browser: `http://localhost:8000`

### Opsi 4: Deploy ke Hosting dengan Apache
Upload semua file termasuk `.htaccess` ke hosting Anda.
File `.htaccess` akan menangani routing SPA secara otomatis.

## Perbaikan yang Sudah Dilakukan

### 1. Dashboard Tidak Muncul ✅
- Menambahkan delay 100ms untuk memastikan DOM sudah siap
- Menambahkan console log untuk debugging
- Memperbaiki selector element dashboard

### 2. Dynamic Field di Register ✅
- Menggunakan `querySelectorAll` langsung pada parent element
- Memperbaiki selector dari class ke query yang lebih robust
- Menambahkan console log untuk debugging
- Auto-trigger event saat halaman dimuat

### 3. Refresh 404 ✅
- Menambahkan `<base href="/">` di index.html
- Membuat file `.htaccess` untuk Apache server
- Semua route akan di-redirect ke index.html

## Troubleshooting

### Jika Dashboard Masih Tidak Muncul:
1. Buka Console Browser (F12)
2. Lihat log yang dimulai dengan emoji (🔵, ✅, ❌)
3. Pastikan tidak ada error JavaScript

### Jika Dynamic Field Tidak Berfungsi:
1. Buka Console Browser
2. Cari log "📝 Register Logic Initialized"
3. Periksa apakah semua element terdeteksi (true)

### Jika Masih 404 Saat Refresh:
- **Python/Node Server**: Tidak support .htaccess, tapi aplikasi tetap berfungsi jika navigasi dari home
- **Apache Server**: Pastikan file .htaccess ter-upload dan mod_rewrite aktif
- **Nginx**: Perlu konfigurasi berbeda (lihat dokumentasi Nginx)

## Struktur File
```
woman-in-tech-fix/
├── .htaccess              # Apache rewrite rules (NEW)
├── index.html             # Entry point dengan <base href="/">
├── assets/                # Gambar dan media
├── components/            # Navbar & Footer
├── css/                   # Semua stylesheet
├── js/                    # JavaScript files
│   ├── router.js          # SPA routing (FIXED)
│   ├── dashboard.js       # Dashboard logic (FIXED)
│   ├── register.js        # Register form logic (FIXED)
│   ├── main.js
│   ├── twibbon.js
│   └── data-penduduk.js
└── pages/                 # HTML pages
    ├── home.html
    ├── dashboard.html
    ├── register.html
    └── ...
```

## Fitur Utama

- ✅ Single Page Application (SPA) dengan custom routing
- ✅ Dashboard admin dengan autentikasi
- ✅ Stage Control untuk mengatur fase acara end-to-end
- ✅ Form registrasi dengan validasi NIK otomatis
- ✅ Dynamic form fields berdasarkan status
- ✅ Essay word counter (max 500 kata)
- ✅ Modal Terms & Conditions
- ✅ Integrasi Google Apps Script
- ✅ Responsive design

## Modul Control Panel

- Overview
- Stage Control
- Seleksi Tahap 1
- Seleksi Tahap 2 / Competency Test
- AI Pre-Screening
- Sistem Skoring
- Video Conference berbasis WebRTC + Gorilla WebSocket signaling
- Announcement Manager via Global Settings
- Communication Engine
- Bootcamp Control
- Final Project Tracker
- Certificate Manager
- Assets & Links
- Audit Trail
- RBAC Admin
- Global Settings

## Setup Database Google Apps Script

Backend GAS siap pakai ada di `gas/Code.gs`.

1. Buat Google Spreadsheet kosong.
2. Buka `Extensions > Apps Script`.
3. Paste isi `gas/Code.gs`.
4. Isi `SPREADSHEET_ID` dengan ID spreadsheet.
5. Jalankan `setupDatabase()` sekali untuk membuat sheet:
   - `Participants`
   - `Admins`
   - `AuditTrail`
   - `Settings`
   - `Stages`
   - `BootcampSessions`
   - `Attendance`
   - `FinalProjects`
   - `Certificates`
   - `Assets`
6. Deploy sebagai Web App, lalu ganti URL GAS di file JavaScript dashboard/frontend jika URL deployment berubah.

## Setup Video Conference Signaling

Video conference menggunakan WebRTC untuk audio/video peer-to-peer dan service Go kecil untuk signaling room. Service ini memakai `github.com/gorilla/websocket`.

1. Install Go 1.22+.
2. Jalankan SPA seperti biasa:
   ```bash
   node server.js
   ```
3. Jalankan signaling server di terminal kedua:
   ```bash
   cd signaling
   go mod tidy
   go run .
   ```
4. Buka dashboard admin:
   `http://127.0.0.1:3000/#/video-conference`
5. Pastikan field `Signaling WebSocket URL` mengarah ke:
   `ws://127.0.0.1:8080/ws`
6. Klik `Generate Room` untuk membuat kode 12 karakter seperti `ABCD-EFGH-JK2M`.
7. Klik `Copy Link` dan kirim ke peserta. Peserta juga bisa membuka:
   `http://127.0.0.1:3000/#/meeting`
   lalu memasukkan kode room secara manual.

Catatan: untuk produksi HTTPS, WebSocket perlu memakai `wss://` dan signaling server harus berada di domain/sertifikat yang aman.

### Deploy Video Conference

- Frontend SPA bisa dideploy ke Vercel sebagai static app.
- Link undangan room sekarang ikut membawa parameter `signal`, sehingga admin bisa mengisi `Signaling WebSocket URL` produksi seperti `wss://meet-signal.domainmu.com/ws` sebelum menekan `Copy Link`.
- Jangan gunakan `ws://127.0.0.1:8080/ws` di production, karena itu hanya menunjuk komputer masing-masing peserta.
- Vercel Functions/Go Runtime cocok untuk HTTP handler, tetapi WebSocket room membutuhkan koneksi persistent. Jika deploy di Vercel belum menyediakan runtime serverful persistent untuk project ini, taruh service `signaling/` di host yang memang support long-running process/WebSocket seperti Fly.io, Railway, Render, VPS, atau container service, lalu arahkan field `Signaling WebSocket URL` ke endpoint `wss://.../ws`.

### Deploy Signaling ke Render

Repo ini sudah menyediakan `render.yaml` untuk service Go `signaling/`.

1. Push repo ke GitHub/GitLab/Bitbucket.
2. Buka Render Dashboard.
3. Pilih `New` -> `Blueprint`, lalu pilih repo ini.
4. Render akan membaca `render.yaml` dan membuat web service `herai-signaling`.
5. Setelah deploy selesai, cek:
   `https://<nama-service>.onrender.com/healthz`
6. Gunakan endpoint WebSocket ini di dashboard admin:
   `wss://<nama-service>.onrender.com/ws`
7. Di halaman `Video Conference`, isi `Signaling WebSocket URL` dengan endpoint `wss://.../ws`, klik `Generate Room`, lalu `Copy Link`.

Catatan: Render free instance bisa sleep saat tidak aktif. Untuk acara live yang penting, gunakan plan berbayar agar signaling tidak cold start saat peserta join.

### Uji Multi-User dengan Ngrok

Untuk uji banyak user sebelum deploy:

1. Jalankan SPA lokal:
   ```bash
   node server.js
   ```
2. Jalankan signaling:
   ```bash
   cd signaling
   GOCACHE=/private/tmp/go-build GOPATH=/private/tmp/go-path go run .
   ```
3. Buat tunnel frontend:
   ```bash
   ngrok http 3000
   ```
4. Buat tunnel signaling:
   ```bash
   ngrok http 8080
   ```
5. Di admin `Video Conference`, isi `Signaling WebSocket URL` dengan URL tunnel signaling versi WebSocket:
   `wss://<domain-ngrok-signaling>/ws`
6. Klik `Generate Room`, lalu `Copy Link`. Link itu akan membawa room id, judul room, dan URL signaling yang benar untuk peserta eksternal.

## Browser Support
- Chrome (recommended)
- Firefox
- Safari
- Edge

## Catatan Penting
- Dashboard memerlukan login (cek file dashboard.js untuk credentials)
- Form register terhubung ke Google Apps Script
- Semua navigasi menggunakan JavaScript routing
- Refresh tetap bekerja dengan .htaccess di Apache server

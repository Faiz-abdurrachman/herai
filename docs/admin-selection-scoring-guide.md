# Panduan Admin Penilaian HerAI Fellowship

Dokumen ini menjelaskan alur kerja panitia dari pre-screening, skoring, decision Tahap 1, monitoring Tahap 2, sampai pengumuman.

## Prinsip Alur

Penilaian dilakukan bertahap dan keputusan akhir tetap berada di panitia. AI hanya membantu membaca data awal, bukan menjadi keputusan final.

1. **AI Pre-Screening** menghasilkan ringkasan, ekstraksi skill, motivasi, dan `ai_score`.
2. **Sistem Skoring & Leaderboard** memakai `ai_score` sebagai baseline ranking.
3. **Reviewer** dapat mengedit nilai rubrik. Jika nilai reviewer sudah ada, ranking memakai reviewer override.
4. **Decision Tahap 1** ditetapkan oleh panitia sebagai `lolos` atau `gugur`.
5. **Pengumuman Tahap 1** menampilkan hasil berdasarkan decision Tahap 1.
6. **Seleksi Tahap 2** hanya untuk peserta lolos Tahap 1.
7. **Live Monitor Tahap 2** dipakai untuk memantau tes, melihat riwayat pengerjaan, skor, dan menetapkan decision Tahap 2.
8. **Pengumuman Tahap 2** menampilkan hasil berdasarkan decision Tahap 2.

## 1. AI Pre-Screening

Buka menu **AI Pre-Screening**.

Langkah kerja:

1. Klik **Sync/Refresh** untuk mengambil data peserta terbaru.
2. Pilih kandidat dari antrean.
3. Klik **Generate Insight**.
4. Tunggu sampai hasil AI muncul.
5. Pastikan kandidat berubah menjadi **Scanned**.

Data yang disimpan:

- `is_scanned`
- `ai_summary`
- `ai_motivation`
- `ai_skills`
- `ai_score`

Catatan operasional:

- Jangan menjalankan terlalu banyak scan secara beruntun. Sistem sudah diberi jeda aman agar tidak mudah terkena limit Google Apps Script/Sheet.
- Jika hasil AI terasa tidak sesuai, lakukan **Pindai Ulang** lalu lanjutkan review manual.

## 2. Skoring & Leaderboard Tahap 1

Buka menu **Sistem Skoring**.

Leaderboard memakai aturan:

- Jika belum ada nilai reviewer, ranking memakai `ai_score` dari AI Pre-Screening.
- Jika reviewer sudah mengisi nilai, ranking memakai rata-rata reviewer sebagai override.
- AI Score tetap tampil sebagai baseline untuk membantu pembanding.

Langkah kerja:

1. Klik **Sync Data**.
2. Urutkan kandidat dari leaderboard.
3. Klik **Nilai / Decision** pada kandidat.
4. Baca baseline AI Score.
5. Atur nilai reviewer:
   - Logika Berpikir & Problem Solving
   - Motivasi Belajar & Komitmen
   - Kesiapan Teknis Dasar
   - Kesesuaian Latar Belakang / Afirmasi
6. Klik **Simpan Penilaian**.
7. Jika sudah yakin, klik **Lolos Tahap 1** atau **Gugur**.

Efek decision Tahap 1:

- `lolos` akan membuat peserta muncul sebagai lolos pada Pengumuman Tahap 1.
- `gugur` akan membuat peserta muncul sebagai tidak lolos pada Pengumuman Tahap 1.
- Peserta lolos Tahap 1 dapat masuk ke alur Tes Kompetensi saat Stage Control membuka Tahap 2.

## 3. Pengumuman Tahap 1

Gunakan **Stage Control** untuk mengaktifkan fase **Pengumuman Lolos Tahap 1**.

Halaman yang digunakan:

- `#/announcement-stage-1`
- `#/announcement`

Data yang dibaca:

- `status_seleksi`
- `status_tahap_1` jika tersedia
- `participant_stage`

Status yang dianggap lolos:

- `lolos`
- `accepted`
- `accepted_stage_1`
- `passed_stage_1`

Status yang dianggap gugur:

- `gugur`
- `rejected`
- `rejected_stage_1`
- `failed_stage_1`

## 4. Seleksi Tahap 2 / Tes Kompetensi

Buka fase **Seleksi Tahap 2 / Tes Kompetensi** dari **Stage Control**.

Efek fase ini:

- `competencyTestOpen` aktif.
- Halaman `#/competency-test` dapat diakses peserta.
- Peserta yang belum lolos Tahap 1 tetap tidak boleh mengikuti tes.

Peserta mengerjakan tes dengan kamera/mic aktif sesuai aturan halaman tes. Jawaban yang belum submit tetap dapat dipulihkan, sedangkan jawaban yang sudah submit dikunci.

## 5. Live Monitor & Decision Tahap 2

Buka menu **Seleksi Tahap 2**.

Gunakan halaman ini untuk:

- Melihat peserta yang sedang/selesai tes.
- Membuka detail peserta.
- Melihat riwayat aktivitas pengerjaan.
- Melihat skor hasil perhitungan.
- Menetapkan decision Tahap 2.

Decision tersedia:

- **Pending**: belum diputuskan.
- **Gugur Tahap 2**: peserta tidak lanjut.
- **Lolos Tahap 2**: peserta lanjut ke tahap berikutnya.

Efek decision Tahap 2:

- `status_tahap_2`
- `competency_status`
- `participant_stage`

Status `lolos` Tahap 2 akan tampil pada Pengumuman Tahap 2. Status `gugur` akan tampil sebagai tidak lolos.

## 6. Pengumuman Tahap 2

Gunakan **Stage Control** untuk mengaktifkan fase **Pengumuman Lolos Tahap 2**.

Halaman yang digunakan:

- `#/announcement-stage-2`
- `#/announcement` jika stage aktif adalah Pengumuman Tahap 2.

Data yang dibaca:

- `status_tahap_2`
- `status_seleksi_tahap2`
- `competency_status`
- `participant_stage`

Status `competency_submitted`, `competency_test`, dan `accepted_stage_1` masih dianggap **pending**, bukan lolos.

## 7. Pengumuman Final

Gunakan **Stage Control** untuk mengaktifkan fase **Pengumuman Final**.

Halaman yang digunakan:

- `#/announcement-final`
- `#/announcement` jika stage aktif adalah Pengumuman Final.

Data yang dibaca:

- `status_final`
- `final_status`
- `graduation_status`
- `certificate_status`

## Checklist Harian Panitia

Sebelum pengumuman:

- Pastikan semua kandidat relevan sudah discan di AI Pre-Screening.
- Pastikan leaderboard sudah tersinkron.
- Pastikan nilai reviewer yang penting sudah tersimpan.
- Pastikan decision Tahap 1/Tahap 2 sudah bukan `pending`.
- Uji minimal satu NIK peserta lolos dan satu NIK peserta gugur di halaman pengumuman.
- Pastikan Stage Control berada di fase pengumuman yang benar.

Saat pengumuman dibuka:

- Jangan mengubah decision massal tanpa koordinasi.
- Jika ada koreksi, ubah decision di dashboard, lalu minta peserta refresh halaman pengumuman.
- Simpan catatan perubahan penting di audit trail internal.

/* ==========================================================================
   js/announcement.js
   ATM Engine: Menggunakan Trik Canvas dari Project Register Mas Chen
   FITUR: Anti-definition Error, HD Canvas Drawing, Lolos/Gugur Themes, Centered Layout
========================================================================== */

const ANNOUNCEMENT_API_URL = '/__gas';

window.initAnnouncement = async function() {
    console.log('📢 Announcement ATM Engine Initialized');
    const settings = typeof window.getGlobalSettingsAsync === 'function'
        ? await window.getGlobalSettingsAsync()
        : (typeof window.getGlobalSettings === 'function' ? window.getGlobalSettings() : {});
    const container = document.querySelector('.announcement-container');
    const stage = getAnnouncementStage();
    const launchTime = getAnnouncementLaunchTime(settings, stage);
    const isScheduledOpen = launchTime && Date.now() >= launchTime;

    if (settings.announcementLive !== true && !isScheduledOpen) {
        if (container && typeof window.renderPublicNotice === 'function') {
            if (launchTime && launchTime > Date.now()) {
                container.innerHTML = renderAnnouncementCountdown(launchTime);
                startAnnouncementCountdown(launchTime);
            } else {
                container.innerHTML = window.renderPublicNotice({
                    icon: 'fa-lock',
                    title: 'Pengumuman Belum Dibuka',
                    message: 'Portal pengecekan hasil seleksi belum dibuka. Silakan pantau kanal resmi HerAI Fellowship untuk jadwal pengumuman.',
                    actionHref: '#/home',
                    actionLabel: 'Kembali ke Beranda'
                });
            }
        }
        return;
    }

    resetAnnouncementView(); // Pastikan form bersih setiap kali halaman dibuka
    applyAnnouncementStageCopy();
};

function renderAnnouncementCountdown(launchTime) {
    return `
        <section style="min-height: 70vh; display: flex; align-items: center; justify-content: center; padding: 120px 20px 70px;">
            <div style="width: 100%; max-width: 720px; text-align: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 22px; padding: 44px 34px; box-shadow: 0 20px 45px rgba(26,11,46,0.08);">
                <div style="width: 72px; height: 72px; margin: 0 auto 20px; border-radius: 50%; background: #ffe6f2; color: #ff1493; display: flex; align-items: center; justify-content: center; font-size: 2rem;">
                    <i class="fas fa-hourglass-half"></i>
                </div>
                <h1 style="margin: 0 0 12px; color: #1a0b2e; font-family: 'Space Grotesk', sans-serif; font-size: 2rem;">Pengumuman Dibuka Dalam</h1>
                <p style="margin: 0 auto 26px; color: #6b7a90; line-height: 1.7; max-width: 520px;">Portal pengecekan hasil akan otomatis terbuka pada jadwal yang sudah ditentukan.</p>
                <div id="announcementCountdown" data-launch="${launchTime}" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; max-width: 520px; margin: 0 auto;">
                    <div class="countdown-box"><strong id="countDays">00</strong><span>Hari</span></div>
                    <div class="countdown-box"><strong id="countHours">00</strong><span>Jam</span></div>
                    <div class="countdown-box"><strong id="countMinutes">00</strong><span>Menit</span></div>
                    <div class="countdown-box"><strong id="countSeconds">00</strong><span>Detik</span></div>
                </div>
            </div>
        </section>
    `;
}

function startAnnouncementCountdown(launchTime) {
    const tick = () => {
        const diff = launchTime - Date.now();
        if (diff <= 0) {
            window.location.reload();
            return;
        }
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        const set = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = String(value).padStart(2, '0');
        };
        set('countDays', days);
        set('countHours', hours);
        set('countMinutes', minutes);
        set('countSeconds', seconds);
    };
    tick();
    clearInterval(window.__HERAI_ANNOUNCEMENT_TIMER__);
    window.__HERAI_ANNOUNCEMENT_TIMER__ = setInterval(tick, 1000);
}

// ==========================================
// KUNCI: EVENT DELEGATION (Metode SPA)
// ==========================================
document.addEventListener('click', e => {
    // 1. Tombol "Lihat Hasil Seleksi"
    const btnCheck = e.target.closest('#btnCheck');
    if (btnCheck) {
        const nikValue   = document.getElementById('nik').value.trim();
        const emailValue = document.getElementById('email').value.trim().toLowerCase();
        
        if (!nikValue || !emailValue) {
            alert("Harap lengkapi NIK dan Email Anda terlebih dahulu!");
            return;
        }

        checkParticipantStatus(nikValue, emailValue, btnCheck);
    }

    // 2. Tombol Kembali
    if (e.target.closest('#btnKembaliCek')) resetAnnouncementView();
});

// ==========================================
// 1. CEK STATUS KE DATABASE (GAS)
// ==========================================
async function checkParticipantStatus(nik, email, btnElement) {
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...';
    btnElement.disabled = true;

    // UI ke Mode Loading
    document.getElementById('formSection').style.display = 'none';
    const loadingSection = document.getElementById('loadingSection');
    if(loadingSection) loadingSection.style.display = 'block';

    try {
        const response = await fetch(ANNOUNCEMENT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'getData' }) 
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            const participant = result.data.find(p => String(p.nik || '') == nik && String(p.email || '').toLowerCase() == email);
            
            // Efek deg-degan 2 detik
            setTimeout(() => {
                if(loadingSection) loadingSection.style.display = 'none';
                
                if (participant) {
                    processRenderResult(participant);
                } else {
                    alert("Data tidak ditemukan! Pastikan NIK dan Email sesuai dengan yang didaftarkan.");
                    resetAnnouncementView();
                }
            }, 2000); 

        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error("Error Detail:", error);
        alert("Terjadi kesalahan jaringan.");
        resetAnnouncementView();
    } finally {
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
    }
}

// ==========================================
// 2. LOGIKA RENDER PREPARATION
// ==========================================
function processRenderResult(p) {
    const qrContainer = document.getElementById('hidden-qr-builder');
    const previewContainer = document.getElementById('certificate-preview-container');
    const downloadBtn = document.getElementById('btnDownloadPng');

    // 1. Bersihkan state lama (KUNCI ANTI DUPLIKAT)
    qrContainer.innerHTML = '';
    previewContainer.innerHTML = '';
    
    // 2. Generate QR mentah (Resolusi Tinggi H) di Hidden Container
    const stage = getAnnouncementStage();
    const stageStatus = getParticipantStageStatus(p, stage);
    const qrText = `VERIFIED::ID-${p.rowId}::NIK-${p.nik}::NAMA-${p.nama_lengkap}::STAGE-${stage.key}::STATUS-${stageStatus.toUpperCase()}`;
    
    new QRCode(qrContainer, {
        text: qrText,
        width: 400,
        height: 400,
        colorDark: '#1a0b2e', // Pakai warna Data Sorcerers
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    // 3. Beri buffer 300ms agar QRCode.js selesai render kanvas internal
    setTimeout(() => {
        // 4. Jurus Sihir: Gambar ke Canvas Utama
        drawHerAiResultCanvas(qrContainer, p, previewContainer, downloadBtn);
        
        // 5. Munculkan area hasil
        document.getElementById('resultSection').style.display = 'block';
        applyAnnouncementSettingsToResult(p);
        if (stageStatus === 'pending') {
             document.getElementById('downloadActions').style.display = 'none';
        } else {
             document.getElementById('downloadActions').style.display = 'flex';
        }
        
        console.log('Digital Announcement Document Materialized!');
    }, 300);
}

function applyAnnouncementSettingsToResult(p) {
    const settings = typeof window.getGlobalSettings === 'function' ? window.getGlobalSettings() : {};
    const status = getParticipantStageStatus(p, getAnnouncementStage());
    const downloadActions = document.getElementById('downloadActions');
    if (!downloadActions) return;

    document.getElementById('announcementExtraInfo')?.remove();
    document.getElementById('btnOpenTwibbonFromResult')?.remove();

    if (status !== 'lolos') return;

    const info = document.createElement('div');
    info.id = 'announcementExtraInfo';
    info.style.cssText = 'margin: 18px 0 0; padding: 14px 16px; border-radius: 12px; background: rgba(5,205,153,0.1); color: #047857; font-weight: 700; line-height: 1.5; text-align: center;';
    info.innerHTML = `<i class="fas fa-circle-info"></i> ${settings.passedInfoMessage || 'Harap periksa email Anda untuk undangan grup Telegram.'}`;
    downloadActions.parentNode.insertBefore(info, downloadActions);

    const twibbonLink = document.createElement('a');
    twibbonLink.id = 'btnOpenTwibbonFromResult';
    twibbonLink.href = settings.twibbonUrl || '#/twibbon';
    twibbonLink.className = 'btn-check nav-link';
    twibbonLink.style.cssText = 'background: #ff1493; flex: 1; text-decoration: none;';
    twibbonLink.innerHTML = '<i class="fas fa-camera"></i> Buat Twibbon';
    downloadActions.appendChild(twibbonLink);
}

// =========================================================================
// 3. CORE LOGIC: FUNGSI GAMBAR CANVAS UTAMA (KARTU UTBK STYLE)
// =========================================================================
function drawHerAiResultCanvas(qrSourceElement, p, previewContainer, downloadBtn) {
    const qrCanvasRaw = qrSourceElement.querySelector('canvas');
    if (!qrCanvasRaw) {
        console.error("Gagal mengambil mentahan QR Code.");
        return;
    }

    const mainCanvas = document.createElement('canvas');
    const ctx = mainCanvas.getContext('2d');
    
    // Ukuran Portrait (A4-ish)
    const bWidth = 700;
    const bHeight = 990; 
    mainCanvas.width = bWidth;
    mainCanvas.height = bHeight;

    const stage = getAnnouncementStage();
    const statusText = getParticipantStageStatus(p, stage);
    
    // Warna Tema HerAI
    const colorPrimaryPink = "#FF1493";
    const colorDarkPurple  = "#1a0b2e";
    const colorTextMuted   = "#6b7a90";
    
    // Warna Tema Status Lolos/Gugur
    let colorTheme      = "#f59e0b"; // Kuning Pending
    let colorThemeBg    = "rgba(245, 158, 11, 0.05)";
    if (statusText === 'lolos') { colorTheme = "#05cd99"; colorThemeBg = "rgba(5, 205, 153, 0.05)"; }
    if (statusText === 'gugur') { colorTheme = "#e63946"; colorThemeBg = "rgba(230, 57, 70, 0.05)"; }

    // --- A. BACKGROUND ---
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, bWidth, bHeight);

    const gradient = ctx.createRadialGradient(bWidth/2, bHeight/2, 100, bWidth/2, bHeight/2, bWidth);
    gradient.addColorStop(0, "rgba(160, 32, 240, 0.05)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0.0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, bWidth, bHeight);

    // Frame Border
    ctx.strokeStyle = colorTheme;
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, bWidth - 40, bHeight - 40);

    // --- B. HEADER (HerAI Dominan) ---
    ctx.textAlign = "left";
    
    // Judul Program (Besar)
    ctx.fillStyle = colorDarkPurple;
    ctx.font = "800 42px Space Grotesk, sans-serif";
    ctx.fillText("HerAI Fellowship 2026", 60, 85);

    // Attribution (Kecil)
    ctx.fillStyle = colorTextMuted;
    ctx.font = "500 18px Inter, sans-serif";
    ctx.fillText("by Data Sorcerers x Womanhub.id", 60, 115);
    
    // Gradient Bar
    const gradBar = ctx.createLinearGradient(60, 0, bWidth - 60, 0);
    gradBar.addColorStop(0, colorPrimaryPink);
    gradBar.addColorStop(1, "#8A2BE2");
    ctx.fillStyle = gradBar;
    ctx.fillRect(60, 145, bWidth - 120, 8);

    // --- C. JUDUL KARTU (Senter Tengah) ---
    ctx.textAlign = "center";
    ctx.fillStyle = colorDarkPurple;
    ctx.font = "700 28px Inter, sans-serif";
    ctx.fillText(stage.cardTitle, bWidth / 2, 210);
    
    ctx.font = "500 18px Inter, sans-serif";
    ctx.fillStyle = colorTextMuted;
    ctx.fillText(stage.subtitle, bWidth / 2, 240);

    // --- D. DATA PESERTA ---
    // Box
    ctx.fillStyle = "#fafbfe";
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(60, 275, bWidth - 120, 140, 12);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = colorTextMuted;
    ctx.font = "400 16px Inter, sans-serif";
    ctx.fillText("NAMA PESERTA:", 85, 315);
    
    ctx.fillStyle = colorDarkPurple;
    ctx.font = "700 36px Inter, sans-serif";
    let displayName = p.nama_lengkap || "-";
    if (displayName.length > 25) displayName = displayName.substring(0, 22) + "...";
    ctx.fillText(displayName, 85, 360);

    ctx.fillStyle = colorTextMuted;
    ctx.font = "400 16px Inter, sans-serif";
    ctx.fillText("NIK:", 85, 390);
    ctx.fillStyle = colorDarkPurple;
    ctx.font = "600 20px Inter, sans-serif";
    ctx.fillText(p.nik || "-", 125, 390);

    // --- E. STATUS BOX DINAMIS ---
    ctx.fillStyle = colorThemeBg;
    ctx.strokeStyle = colorTheme;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(60, 445, bWidth - 120, 150, 12);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = colorTheme;
    ctx.font = "700 32px Space Grotesk, sans-serif";
    
    let msgTitle = "STATUS MENUNGGU";
    let msgBody1 = "Dokumen Anda masih dalam tahap evaluasi.";
    let msgBody2 = "Harap cek kembali secara berkala.";

    if (statusText === 'lolos') {
        msgTitle = "SELAMAT! DINYATAKAN LOLOS";
        msgBody1 = stage.passLine1;
        msgBody2 = stage.passLine2;
    } else if (statusText === 'gugur') {
        msgTitle = "MOHON MAAF, ANDA BELUM LOLOS";
        msgBody1 = "Terima kasih atas partisipasi Anda. Jangan patah";
        msgBody2 = "semangat dan terus kembangkan kemampuan Anda.";
    }

    ctx.fillText(msgTitle, bWidth / 2, 505);
    ctx.fillStyle = colorDarkPurple;
    ctx.font = "400 18px Inter, sans-serif";
    ctx.fillText(msgBody1, bWidth / 2, 540);
    ctx.fillText(msgBody2, bWidth / 2, 565);

    // --- F. QR CODE & FOOTER ---
    const qrSize = 250;
    const qrX = (bWidth / 2) - (qrSize / 2);
    const qrY = 630;

    // Background putih untuk QR
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
    ctx.drawImage(qrCanvasRaw, qrX, qrY, qrSize, qrSize);

    ctx.fillStyle = "rgba(107, 122, 144, 0.5)";
    ctx.font = "400 14px Courier New, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`UNIQUE ID: DS-HERAI-26-${p.rowId}-${Math.floor(Math.random() * 1000)}`, bWidth / 2, 910);
    ctx.fillText(`Generated at: ${new Date().toLocaleString('id-ID')}`, bWidth / 2, 930);
    
    ctx.fillStyle = colorDarkPurple;
    ctx.font = "600 16px Inter, sans-serif";
    ctx.fillText("Validasi Digital melalui QR Code", bWidth / 2, 955);

    // --- G. KONVERSI KE PNG & INJECT PREVIEW ---
    const certificatePngUrl = mainCanvas.toDataURL('image/png');
    
    // Inject link ke tombol download
    const safeName = p.nama_lengkap ? p.nama_lengkap.replace(/\s+/g, '-') : "Peserta";
    downloadBtn.href = certificatePngUrl;
    downloadBtn.download = `Pengumuman_HerAI_${stage.key}_${statusText.toUpperCase()}_${safeName}.png`;

    // Buat canvas preview (biar ukurannya responsive di layar HP/Desktop)
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = bWidth;
    previewCanvas.height = bHeight;
    previewCanvas.style.width = '100%';
    previewCanvas.style.height = 'auto';

    const previewCtx = previewCanvas.getContext('2d');
    previewCtx.drawImage(mainCanvas, 0, 0);

    // Masukkan preview ke DOM
    previewContainer.innerHTML = '';
    previewContainer.appendChild(previewCanvas);
}

// ==========================================
// 5. RESET VIEW
// ==========================================
function resetAnnouncementView() {
    const nikInput   = document.getElementById('nik');
    const emailInput = document.getElementById('email');
    if(nikInput) nikInput.value = '';
    if(emailInput) emailInput.value = '';
    
    const loadingSection  = document.getElementById('loadingSection');
    const resultSection   = document.getElementById('resultSection');
    const formSection     = document.getElementById('formSection');
    
    if(loadingSection) loadingSection.style.display = 'none';
    if(resultSection) resultSection.style.display = 'none';
    if(formSection) formSection.style.display = 'block';
    document.getElementById('announcementExtraInfo')?.remove();
    document.getElementById('btnOpenTwibbonFromResult')?.remove();
    applyAnnouncementStageCopy();
}

function applyAnnouncementStageCopy() {
    const stage = getAnnouncementStage();
    const badge = document.getElementById('badgeStatus');
    const header = document.querySelector('.announcement-header');
    const button = document.getElementById('btnCheck');
    if (badge) badge.innerHTML = `<i class="${stage.icon}"></i> ${stage.badge}`;
    if (header) {
        header.querySelector('h1').innerHTML = `${stage.heading} <span>HerAI Fellowship 2026</span>`;
        header.querySelector('p').textContent = stage.description;
    }
    if (button) button.innerHTML = `<i class="fas fa-search"></i> ${stage.button}`;
}

function getAnnouncementStage() {
    const path = (window.location.hash || '#/announcement').replace('#', '');
    if (path.includes('stage-2')) {
        return {
            key: 'final',
            badge: 'PENGUMUMAN FINAL',
            heading: 'Pengumuman Final',
            description: 'Cek hasil Tes Kompetensi dan status akhir HerAI Fellowship.',
            button: 'Lihat Hasil Final',
            icon: 'fas fa-laptop-code',
            cardTitle: 'KARTU HASIL FINAL',
            subtitle: 'Final Admission Result',
            passLine1: 'Anda dinyatakan lolos hasil akhir',
            passLine2: 'HerAI Fellowship 2026. Selamat bergabung.'
        };
    }
    if (path.includes('final')) {
        return {
            key: 'final',
            badge: 'PENGUMUMAN FINAL',
            heading: 'Pengumuman Final',
            description: 'Cek status akhir penerimaan fellowship dan instruksi onboarding peserta final.',
            button: 'Lihat Hasil Final',
            icon: 'fas fa-trophy',
            cardTitle: 'KARTU HASIL FINAL',
            subtitle: 'Final Admission Result',
            passLine1: 'Anda dinyatakan sebagai peserta final',
            passLine2: 'HerAI Fellowship 2026. Selamat bergabung.'
        };
    }
    if (path === '/announcement') {
        const settings = typeof window.getGlobalSettings === 'function' ? window.getGlobalSettings() : {};
        if (['announcement_stage_2', 'competency_result'].includes(settings.currentStage)) {
            return {
                key: 'final',
                badge: 'PENGUMUMAN FINAL',
                heading: 'Pengumuman Final',
                description: 'Cek hasil Tes Kompetensi dan status akhir HerAI Fellowship.',
                button: 'Lihat Hasil Final',
                icon: 'fas fa-laptop-code',
                cardTitle: 'KARTU HASIL FINAL',
                subtitle: 'Final Admission Result',
                passLine1: 'Anda dinyatakan lolos hasil akhir',
                passLine2: 'HerAI Fellowship 2026. Selamat bergabung.'
            };
        }
        if (['announcement_final', 'graduation'].includes(settings.currentStage)) {
            return {
                key: 'final',
                badge: 'PENGUMUMAN FINAL',
                heading: 'Pengumuman Final',
                description: 'Cek status akhir penerimaan fellowship dan instruksi onboarding peserta final.',
                button: 'Lihat Hasil Final',
                icon: 'fas fa-trophy',
                cardTitle: 'KARTU HASIL FINAL',
                subtitle: 'Final Admission Result',
                passLine1: 'Anda dinyatakan sebagai peserta final',
                passLine2: 'HerAI Fellowship 2026. Selamat bergabung.'
            };
        }
    }
    return {
        key: 'tahap-1',
        badge: 'PENGUMUMAN LOLOS TAHAP 1',
        heading: 'Pengumuman Lolos Tahap 1',
        description: 'Silakan masukkan NIK dan Email untuk mengecek hasil seleksi administrasi menuju Tes Kompetensi.',
        button: 'Lihat Hasil Tahap 1',
        icon: 'fas fa-award',
        cardTitle: 'KARTU HASIL TAHAP 1',
        subtitle: 'Tahap Seleksi Administrasi',
        passLine1: 'Anda lolos seleksi Tahap 1 dan berhak',
        passLine2: 'mengikuti Tes Kompetensi HerAI Fellowship 2026.'
    };
}

function getAnnouncementLaunchTime(settings, stage) {
    const defaults = {
        'tahap-1': '2026-05-25T19:00:00+07:00',
        final: '2026-05-31T19:00:00+07:00'
    };
    const customKey = stage.key === 'tahap-1' ? 'announcementStage1LaunchAt' : 'announcementFinalLaunchAt';
    const value = settings[customKey] || (stage.key === 'tahap-1' ? settings.announcementLaunchAt : '') || defaults[stage.key];
    return value ? new Date(value).getTime() : 0;
}

function getParticipantStageStatus(p, stage) {
    const pick = (...keys) => keys.find(key => p[key] !== undefined && p[key] !== null && String(p[key]).trim() !== '');
    let raw = 'pending';
    if (stage.key === 'tahap-2' || stage.key === 'final') {
        const explicitKey = pick('status_tahap_2', 'status_seleksi_tahap2', 'competency_status');
        raw = explicitKey ? String(p[explicitKey]).toLowerCase() : String(p.participant_stage || 'pending').toLowerCase();
        if (['accepted_stage_2', 'passed_stage_2'].includes(raw)) return 'lolos';
        if (['rejected_stage_2', 'failed_stage_2'].includes(raw)) return 'gugur';
        if (['competency_submitted', 'competency_test', 'accepted_stage_1'].includes(raw)) return 'pending';
    } else {
        const key = pick('status_seleksi', 'status_tahap_1');
        raw = String(key ? p[key] : 'pending').toLowerCase();
        if (['accepted_stage_1', 'accepted', 'passed_stage_1'].includes(raw)) return 'lolos';
    }
    if (['lolos', 'passed', 'pass', 'lulus', 'accepted'].includes(raw)) return 'lolos';
    if (['gugur', 'rejected', 'failed', 'fail', 'tidak_lolos'].includes(raw)) return 'gugur';
    return raw || 'pending';
}

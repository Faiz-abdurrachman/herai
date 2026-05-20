/* ==========================================================================
   js/audit-trail.js
   Logic Khusus: Menarik & Menampilkan Data Audit Trail dari GAS
   (Fokus pada Data Rendering & Search)
========================================================================== */

const AUDIT_API_URL = '/__gas';

let globalAuditData = []; // Buffer data untuk fitur search

// ==========================================
// 1. INISIALISASI UTAMA (Dipanggil oleh Router)
// ==========================================
window.initAuditTrail = async function() {
    console.log("🛡️ Audit Trail Engine Initialized");
    
    // 1. Sinkronisasi UI (Sidebar, Profil, & Log Kunjungan)
    // Fungsi-fungsi ini diambil dari admin-modules.js agar konsisten
    if (typeof window.loadSidebar === 'function') await window.loadSidebar();
    if (typeof window.updateAdminProfile === 'function') window.updateAdminProfile();
    
    // Catat aktivitas bahwa admin sedang melihat audit trail
    if (typeof window.logAdminActivity === 'function') {
        window.logAdminActivity("Sedang melihat halaman Audit Trail");
    }

    // 2. Pasang Event Listener untuk Fitur Search
    const searchInput = document.getElementById('searchLog');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const keyword = e.target.value.toLowerCase();
            const filtered = globalAuditData.filter(log => 
                String(log.nama_admin || log.adminId || '').toLowerCase().includes(keyword) || 
                String(log.tindakan || '').toLowerCase().includes(keyword) ||
                String(log.id_admin || log.adminId || '').toLowerCase().includes(keyword)
            );
            renderAuditTable(filtered);
        });
    }

    // 3. Pasang Event Listener Tombol Refresh
    const btnRefresh = document.getElementById('btnRefreshAudit');
    if (btnRefresh) {
        btnRefresh.onclick = () => loadAllAuditData();
    }

    // 4. Tarik data dari server untuk pertama kali
    loadAllAuditData();
};

// ==========================================
// 2. FUNGSI PENARIKAN DATA (FETCH)
// ==========================================
async function loadAllAuditData() {
    const tableBody = document.getElementById('auditTableBody');
    const loading = document.getElementById('loadingAudit');
    const activeContainer = document.getElementById('active-users-container');

    if (!tableBody || !loading || !activeContainer) return;

    // UI State: Loading
    tableBody.innerHTML = '';
    loading.classList.remove('hidden');
    activeContainer.innerHTML = `<div class="audit-loading-small"><i class="fas fa-spinner fa-spin"></i> Memantau sesi...</div>`;

    try {
        const response = await fetch(AUDIT_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getAuditData' })
        });
        
        const result = await response.json();

        if (result.status === 'success') {
            globalAuditData = result.logs || result.data || []; 
            renderAuditTable(globalAuditData);
            renderActiveSessions(result.sessions || []);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error("Audit Fetch Error:", error);
        tableBody.innerHTML = `<tr><td colspan="5" class="empty-row" style="color:var(--danger);">Gagal memuat data dari server.</td></tr>`;
    } finally {
        loading.classList.add('hidden');
    }
}

// ==========================================
// 3. RENDER TABEL LOG (DINAMIS)
// ==========================================
function renderAuditTable(logs) {
    const tableBody = document.getElementById('auditTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';

    if (logs.length === 0) {
        tableBody.innerHTML = `<tr class="empty-row"><td colspan="5">Tidak ada jejak aktivitas ditemukan.</td></tr>`;
        return;
    }

    // Render dari yang paling baru (Data terakhir di array)
    [...logs].reverse().forEach(log => {
        // Logika warna badge
        let badgeClass = "log-update";
        const tindak = (log.tindakan || "").toLowerCase();
        
        if (tindak.includes('login')) badgeClass = 'log-login';
        else if (tindak.includes('status') || tindak.includes('lolos')) badgeClass = 'log-status';
        else if (tindak.includes('ai') || tindak.includes('screening')) badgeClass = 'log-ai';
        else if (tindak.includes('setting')) badgeClass = 'log-settings';

        // Parsing Ikon OS
        let osIcon = 'fas fa-desktop';
        const dev = (log.perangkat || "").toLowerCase();
        if (dev.includes('mac')) osIcon = 'fab fa-apple';
        else if (dev.includes('windows')) osIcon = 'fab fa-windows';
        else if (dev.includes('android')) osIcon = 'fab fa-android';

        // Format Waktu
        const dateObj = new Date(log.time_stamp || log.timestamp);
        const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

        const row = `
            <tr>
                <td class="col-time">${dateStr}<br><strong>${timeStr}</strong></td>
                <td class="col-actor">
                    <strong>${escapeAuditHtml(log.nama_admin || log.adminId || 'Admin')}</strong><br>
                    <small>${escapeAuditHtml(log.id_admin || log.adminId || '-')}</small>
                </td>
                <td class="col-action">
                    <span class="log-badge ${badgeClass}">${tindak.split(' ')[0].toUpperCase()}</span>
                    <div class="log-desc">${escapeAuditHtml(log.tindakan || '-')}</div>
                </td>
                <td class="col-location">
                    <i class="fas fa-map-marker-alt"></i> ${escapeAuditHtml(log.lokasi_ip || log.lokasi || '-').replace(' (', '<br>(')}
                </td>
                <td class="col-device">
                    <i class="${osIcon}"></i> ${escapeAuditHtml(log.perangkat || '-').replace(' • ', '<br>')}
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    });
}

function escapeAuditHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
}

// ==========================================
// 4. RENDER ACTIVE SESSIONS (SIDE PANEL)
// ==========================================
function renderActiveSessions(sessions) {
    const container = document.getElementById('active-users-container');
    if (!container) return;
    
    container.innerHTML = '';
    const myId = localStorage.getItem('adminId');

    if (sessions.length === 0) {
        container.innerHTML = `<div class="empty-session">Tidak ada admin lain aktif.</div>`;
        return;
    }

    sessions.forEach(sess => {
        const isMe = sess.id_admin === myId;
        const initials = sess.nama_admin.substring(0, 2).toUpperCase();
        
        const card = `
            <div class="active-user-card ${isMe ? 'is-me' : ''}">
                <div class="user-avatar ${isMe ? 'avatar-pink' : 'avatar-blue'}">${initials}</div>
                <div class="user-info">
                    <h4 class="user-name">${sess.nama_admin} ${isMe ? '(You)' : ''}</h4>
                    <p class="user-role">${sess.lokasi_ip.split('(')[0]}</p>
                    <div class="current-action">
                        <i class="fas fa-circle fa-beat" style="color:var(--success); font-size:8px;"></i>
                        <span>Online via ${sess.perangkat.split(' • ')[0]}</span>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', card);
    });
}

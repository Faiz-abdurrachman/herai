/* ==========================================================================
   Admin Monitor - Re-Test Seleksi Tahap 2
   ========================================================================== */

const RETEST_MONITOR_API = '/__gas';
let retestAccessRows = [];
let retestSessions = [];
let retestRows = [];
let retestLoadInFlight = false;
let activeReTestTab = 'access';

window.initReTestMonitor = async function() {
    if (typeof window.loadSidebar === 'function') await window.loadSidebar();
    if (typeof window.checkAdminAccess === 'function' && !window.checkAdminAccess()) return;
    if (typeof window.updateAdminProfile === 'function') window.updateAdminProfile();
    if (typeof window.logAdminActivity === 'function') window.logAdminActivity('Sedang memantau Re-Test Seleksi Tahap 2');

    document.getElementById('btnSyncReTest')?.addEventListener('click', loadReTestMonitorData);
    document.querySelector('.retest-page-tabs')?.addEventListener('click', event => {
        const button = event.target.closest('[data-retest-tab]');
        if (!button) return;
        switchReTestTab(button.dataset.retestTab);
    });
    document.getElementById('retestAccessForm')?.addEventListener('submit', generateReTestAccess);
    document.getElementById('retestSearch')?.addEventListener('input', renderReTestSessions);
    document.getElementById('retestStatusFilter')?.addEventListener('change', renderReTestSessions);
    document.getElementById('retestAccessBody')?.addEventListener('click', handleReTestAccessAction);
    document.getElementById('retestMonitorBody')?.addEventListener('click', event => {
        const button = event.target.closest('[data-open-retest-detail]');
        if (!button) return;
        const row = retestRows.find(item => normalizeReTestNik(item.nik) === normalizeReTestNik(button.dataset.openRetestDetail));
        if (row) openReTestDetail(row);
    });
    document.getElementById('btnCloseReTestDetail')?.addEventListener('click', () => {
        document.getElementById('retestDetailModal')?.classList.remove('active');
    });
    await loadReTestMonitorData();
    switchReTestTab(activeReTestTab);
};

async function loadReTestMonitorData() {
    if (retestLoadInFlight) return;
    retestLoadInFlight = true;
    const syncButton = document.getElementById('btnSyncReTest');
    const original = syncButton?.innerHTML || '';
    if (syncButton) {
        syncButton.disabled = true;
        syncButton.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Syncing...';
    }
    try {
        const [accessResult, sessionsResult] = await Promise.all([
            postReTestMonitor({ action: 'getReTestAccess' }),
            postReTestMonitor({ action: 'getReTestSessions' })
        ]);
        retestAccessRows = accessResult.access || [];
        retestSessions = sessionsResult.sessions || [];
        retestRows = mergeReTestRows(retestAccessRows, retestSessions);
        renderReTestAccess();
        renderReTestSessions();
        updateReTestStats();
    } catch (error) {
        const body = document.getElementById('retestMonitorBody');
        if (body) body.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--danger);">${escapeReTestHtml(error.message || 'Gagal memuat Re-Test.')}</td></tr>`;
    } finally {
        retestLoadInFlight = false;
        if (syncButton) {
            syncButton.disabled = false;
            syncButton.innerHTML = original;
        }
    }
}

async function generateReTestAccess(event) {
    event.preventDefault();
    const nik = document.getElementById('retestAccessNik').value.replace(/\D/g, '');
    const nama_lengkap = document.getElementById('retestAccessName').value.trim();
    const notes = document.getElementById('retestAccessNotes').value.trim();
    if (nik.length !== 16) return setReTestMessage('NIK harus 16 digit.', true);
    if (!nama_lengkap) return setReTestMessage('Nama peserta wajib diisi.', true);
    const button = document.getElementById('btnGenerateReTestCode');
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Generating...';
    try {
        const result = await postReTestMonitor({ action: 'generateReTestAccess', nik, nama_lengkap, notes });
        setReTestMessage(`Kode ${result.access.access_code} berhasil dibuat untuk ${result.access.nama_lengkap}.`);
        document.getElementById('retestAccessForm').reset();
        if (typeof window.logAdminActivity === 'function') window.logAdminActivity(`Generate kode Re-Test untuk NIK ${nik}`);
        await loadReTestMonitorData();
    } catch (error) {
        setReTestMessage(error.message || 'Gagal membuat kode.', true);
    } finally {
        button.disabled = false;
        button.innerHTML = original;
    }
}

async function handleReTestAccessAction(event) {
    const copyButton = event.target.closest('[data-copy-retest-code]');
    if (copyButton) {
        await navigator.clipboard.writeText(copyButton.dataset.copyRetestCode);
        setReTestMessage('Kode unik disalin.');
        return;
    }
    const deleteButton = event.target.closest('[data-delete-retest-access]');
    if (!deleteButton || !confirm('Hapus akses Re-Test peserta ini?')) return;
    try {
        await postReTestMonitor({ action: 'deleteReTestAccess', access_id: deleteButton.dataset.deleteRetestAccess });
        await loadReTestMonitorData();
    } catch (error) {
        alert(error.message || 'Gagal menghapus akses.');
    }
}

function renderReTestAccess() {
    const body = document.getElementById('retestAccessBody');
    if (!body) return;
    if (!retestAccessRows.length) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:32px; color:var(--text-muted);">Belum ada akses Re-Test.</td></tr>';
        return;
    }
    body.innerHTML = retestAccessRows.map(access => `
        <tr>
            <td><div class="competency-participant"><strong>${escapeReTestHtml(access.nama_lengkap || '-')}</strong><span>${escapeReTestHtml(access.nik || '-')}</span></div></td>
            <td><span class="retest-code">${escapeReTestHtml(access.access_code || '-')}</span></td>
            <td><span class="monitor-pill ${String(access.status || 'active') === 'active' ? 'ok' : 'warn'}">${escapeReTestHtml(access.status || 'active')}</span></td>
            <td>${formatReTestDate(access.used_at)}</td>
            <td>
                <button type="button" class="btn-action" data-copy-retest-code="${escapeReTestHtml(access.access_code || '')}" title="Salin kode"><i class="fas fa-copy"></i></button>
                <button type="button" class="btn-action" data-delete-retest-access="${escapeReTestHtml(access.access_id || '')}" title="Hapus akses"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderReTestSessions() {
    const body = document.getElementById('retestMonitorBody');
    if (!body) return;
    const keyword = (document.getElementById('retestSearch')?.value || '').toLowerCase();
    const filter = document.getElementById('retestStatusFilter')?.value || 'all';
    const rows = retestRows.filter(row => {
        const haystack = `${row.nama_lengkap || ''} ${row.nik || ''}`.toLowerCase();
        return haystack.includes(keyword) && (filter === 'all' || row.status === filter);
    });
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--text-muted);">Belum ada sesi Re-Test pada filter ini.</td></tr>';
        return;
    }
    body.innerHTML = rows.map(row => {
        const mediaOk = row.camera_status === 'granted' && row.mic_status === 'granted';
        return `
            <tr>
                <td><div class="competency-participant"><strong>${escapeReTestHtml(row.nama_lengkap || '-')}</strong><span>${escapeReTestHtml(row.nik || '-')}</span></div></td>
                <td>${renderReTestPill(row.status)}</td>
                <td>${renderReTestSnapshot(row)}</td>
                <td><span class="monitor-pill ${mediaOk ? 'ok' : 'bad'}">Cam: ${escapeReTestHtml(row.camera_status || '-')}</span> <span class="monitor-pill ${mediaOk ? 'ok' : 'bad'}">Mic: ${escapeReTestHtml(row.mic_status || '-')}</span></td>
                <td>${renderReTestAnswerProgress(row)}</td>
                <td>${renderReTestScoreVisual(row)}</td>
                <td><span class="monitor-pill ${Number(row.focus_flags || 0) ? 'warn' : 'ok'}">${Number(row.focus_flags || 0)} focus flag</span></td>
                <td>${formatReTestDate(row.updated_at || row.started_at)}</td>
                <td><button type="button" class="btn-action" data-open-retest-detail="${escapeReTestHtml(row.nik || '')}" title="Lihat hasil"><i class="fas fa-chart-column"></i></button></td>
            </tr>
        `;
    }).join('');
}

function mergeReTestRows(accessRows, sessions) {
    const latestByNik = new Map();
    sessions.forEach(session => {
        const nik = normalizeReTestNik(session.nik);
        const existing = latestByNik.get(nik);
        if (!existing || new Date(session.updated_at || 0) > new Date(existing.updated_at || 0)) latestByNik.set(nik, session);
    });
    return accessRows.map(access => {
        const session = latestByNik.get(normalizeReTestNik(access.nik)) || {};
        return {
            ...access,
            ...session,
            nama_lengkap: access.nama_lengkap,
            nik: access.nik,
            status: session.status || 'not_started',
            camera_status: session.camera_status || 'not_started',
            mic_status: session.mic_status || 'not_started'
        };
    });
}

function updateReTestStats() {
    setReTestText('retestAuthorizedCount', retestAccessRows.filter(row => String(row.status || 'active') === 'active').length);
    setReTestText('retestLiveCount', retestRows.filter(row => row.status === 'started').length);
    setReTestText('retestSubmittedCount', retestRows.filter(row => row.status === 'submitted').length);
    setReTestText('retestMediaCount', retestRows.filter(row => row.camera_status === 'granted' && row.mic_status === 'granted').length);
}

function renderReTestAnswerProgress(row) {
    const answered = Number(row.answered_count || 0);
    const total = Number(row.total_questions || 0);
    const percent = total ? Math.min(100, Math.round((answered / total) * 100)) : 0;
    return `
        <div class="test-progress-visual">
            <div class="test-progress-label"><strong>${answered}</strong><span>/${total || '-'} jawaban</span></div>
            <div class="test-progress-track"><span style="width:${percent}%"></span></div>
            <small>${percent}% terisi</small>
        </div>
    `;
}

function renderReTestScoreVisual(row) {
    if (row.status !== 'submitted') return '<span class="monitor-pill warn">Belum submit</span>';
    return `
        <div class="test-score-visual">
            <span><small>Raw</small><strong>${escapeReTestHtml(row.score || 0)}</strong></span>
            <span><small>Bobot</small><strong>${escapeReTestHtml(row.weighted_score || 0)}</strong></span>
        </div>
    `;
}

function renderReTestSectionScores(sectionScores) {
    const labels = { math: 'Math', logic: 'Logic', psychology: 'Psikologi' };
    return Object.keys(labels).map(section => {
        const value = Number(sectionScores[section] || 0);
        const width = Math.min(100, Math.max(0, Math.round((Math.max(0, value) / 50) * 100)));
        return `
            <div class="test-section-score">
                <div><strong>${labels[section]}</strong><span>${value.toFixed(2)}</span></div>
                <div class="test-progress-track"><span style="width:${width}%"></span></div>
            </div>
        `;
    }).join('');
}

function openReTestDetail(row) {
    const modal = document.getElementById('retestDetailModal');
    const body = document.getElementById('retestDetailBody');
    if (!modal || !body) return;
    const sectionScores = parseReTestJson(row.section_scores, {});
    const history = parseReTestJson(row.history_events, []);
    body.innerHTML = `
        <div class="competency-detail-grid">
            <div><strong>Peserta</strong><span>${escapeReTestHtml(row.nama_lengkap || '-')}<br>${escapeReTestHtml(row.nik || '-')}</span></div>
            <div><strong>Status</strong><span>${escapeReTestHtml(row.status || 'not_started')}</span></div>
            <div><strong>Section Aktif</strong><span>${escapeReTestHtml(row.active_section || '-')}</span></div>
            <div><strong>Skor Raw</strong><span>${escapeReTestHtml(row.score || '-')}</span></div>
            <div><strong>Skor Bobot</strong><span>${escapeReTestHtml(row.weighted_score || '-')}</span></div>
            <div><strong>Focus Flag</strong><span>${escapeReTestHtml(row.focus_flags || 0)}</span></div>
        </div>
        <h3 class="competency-detail-title">Progress Jawaban</h3>
        ${renderReTestAnswerProgress(row)}
        <h3 class="competency-detail-title">Hasil Pembobotan Section</h3>
        <div class="test-section-score-list">${renderReTestSectionScores(sectionScores)}</div>
        <h3 class="competency-detail-title">Riwayat Aktivitas</h3>
        <div class="competency-history-list">
            ${(Array.isArray(history) ? history.slice(-20).reverse() : []).map(item => `
                <div><strong>${formatReTestDate(item.at)}</strong><span>${escapeReTestHtml(item.event || '-')} • ${escapeReTestHtml(item.section || '-')} • ${escapeReTestHtml(item.answered_count || 0)} terjawab</span></div>
            `).join('') || '<p class="profile-message">Belum ada riwayat aktivitas.</p>'}
        </div>
    `;
    modal.classList.add('active');
}

function parseReTestJson(value, fallback) {
    if (!value) return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function switchReTestTab(tabName) {
    if (!['access', 'live'].includes(tabName)) return;
    activeReTestTab = tabName;
    document.querySelectorAll('[data-retest-tab]').forEach(button => {
        button.classList.toggle('active', button.dataset.retestTab === tabName);
    });
    document.querySelectorAll('[data-retest-panel]').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.retestPanel === tabName);
    });
}

async function postReTestMonitor(payload) {
    if (typeof window.heraiPostJson === 'function') {
        const result = await window.heraiPostJson(payload);
        if (result.status !== 'success') throw new Error(result.message || 'Permintaan Re-Test ditolak.');
        return result;
    }
    const response = await fetch(RETEST_MONITOR_API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Server Re-Test tidak merespons.');
    const result = await response.json();
    if (result.status !== 'success') throw new Error(result.message || 'Permintaan Re-Test ditolak.');
    return result;
}

function renderReTestPill(status) {
    const value = String(status || 'not_started');
    const cls = value === 'submitted' ? 'ok' : value === 'media_denied' ? 'bad' : 'warn';
    const label = value === 'submitted' ? 'Submitted' : value === 'media_denied' ? 'Media Ditolak' : value === 'started' ? 'Sedang Tes' : 'Belum Mulai';
    return `<span class="monitor-pill ${cls}">${label}</span>`;
}

function renderReTestSnapshot(row) {
    return row.camera_snapshot
        ? `<img class="competency-live-snapshot" src="${row.camera_snapshot}" alt="Live camera ${escapeReTestHtml(row.nama_lengkap || 'peserta')}">`
        : '<span class="monitor-pill warn">Menunggu frame</span>';
}

function normalizeReTestNik(nik) {
    return String(nik || '').replace(/\D/g, '');
}

function formatReTestDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
}

function setReTestText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setReTestMessage(message, isError = false) {
    const el = document.getElementById('retestGeneratedMessage');
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? 'var(--danger)' : 'var(--success)';
}

function escapeReTestHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
}

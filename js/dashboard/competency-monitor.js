/* ==========================================================================
   Admin Monitor - Seleksi Tahap 2
   ========================================================================== */

const COMPETENCY_MONITOR_API = '/__gas';
let competencySessions = [];
let competencyParticipants = [];
let competencyRows = [];

window.initCompetencyMonitor = async function() {
    if (typeof window.loadSidebar === 'function') await window.loadSidebar();
    if (typeof window.checkAdminAccess === 'function' && !window.checkAdminAccess()) return;
    if (typeof window.updateAdminProfile === 'function') window.updateAdminProfile();
    if (typeof window.logAdminActivity === 'function') window.logAdminActivity('Sedang memantau Seleksi Tahap 2');

    document.getElementById('btnSyncCompetency')?.addEventListener('click', loadCompetencyData);
    document.getElementById('competencySearch')?.addEventListener('input', renderCompetencyMonitor);
    document.getElementById('competencyStatusFilter')?.addEventListener('change', renderCompetencyMonitor);
    document.getElementById('competencyMonitorBody')?.addEventListener('click', event => {
        const action = event.target.closest('[data-open-competency-detail]');
        if (action) {
            const data = competencyRows.find(item => normalizeMonitorNik(item.nik) === normalizeMonitorNik(action.dataset.openCompetencyDetail));
            if (data) openCompetencyDetail(data);
            return;
        }
        const row = event.target.closest('[data-session-nik]');
        if (!row) return;
        const data = competencyRows.find(item => normalizeMonitorNik(item.nik) === normalizeMonitorNik(row.dataset.sessionNik));
        if (data) openCompetencyDetail(data);
    });
    document.getElementById('btnCloseCompetencyDetail')?.addEventListener('click', () => {
        document.getElementById('competencyDetailModal')?.classList.remove('active');
    });
    document.getElementById('competencyDetailBody')?.addEventListener('click', async event => {
        const button = event.target.closest('[data-competency-decision]');
        if (!button) return;
        const nik = button.dataset.nik;
        const decision = button.dataset.competencyDecision;
        await setCompetencyDecision(nik, decision, button);
    });
    await loadCompetencyData();
    setInterval(loadCompetencyData, 30000);
};

async function loadCompetencyData() {
    const body = document.getElementById('competencyMonitorBody');
    if (body) body.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:34px; color:var(--text-muted);"><i class="fas fa-circle-notch fa-spin"></i> Memuat peserta lolos tahap 1...</td></tr>';
    try {
        const [participantsResult, sessionsResult] = await Promise.all([
            postCompetencyMonitor({ action: 'getData' }),
            postCompetencyMonitor({ action: 'getCompetencySessions' })
        ]);
        const participants = participantsResult.data || [];
        competencyParticipants = participants.filter(isEligibleForCompetency);
        competencySessions = sessionsResult.sessions || [];
        competencyRows = mergeParticipantsWithSessions(competencyParticipants, competencySessions);
        renderCompetencyMonitor();
    } catch (error) {
        if (body) body.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:34px; color:var(--danger);">${error.message || 'Gagal memuat data tahap 2.'}</td></tr>`;
    }
}

async function postCompetencyMonitor(payload) {
    const response = await fetch(COMPETENCY_MONITOR_API, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.status !== 'success') throw new Error(result.message || 'Gagal memuat data');
    return result;
}

function renderCompetencyMonitor() {
    const body = document.getElementById('competencyMonitorBody');
    if (!body) return;
    const keyword = (document.getElementById('competencySearch')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('competencyStatusFilter')?.value || 'all';
    const filtered = competencyRows.filter(session => {
        const haystack = `${session.nama_lengkap || ''} ${session.nik || ''}`.toLowerCase();
        const status = String(session.status || 'not_started');
        return haystack.includes(keyword) && (statusFilter === 'all' || status === statusFilter);
    });

    updateCompetencyStats(competencyRows);
    if (filtered.length === 0) {
        body.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:34px; color:var(--text-muted);">Belum ada peserta lolos tahap 1 untuk tes kompetensi.</td></tr>';
        return;
    }

    body.innerHTML = filtered.map(session => {
        const answered = Number(session.answered_count || 0);
        const total = Number(session.total_questions || 0);
        const score = session.status === 'submitted' ? `${session.score || 0}/${total || '-'}` : '-';
        const mediaOk = session.camera_status === 'granted' && session.mic_status === 'granted';
        const focusFlags = Number(session.focus_flags || 0);
        const stage2Status = normalizeStageTwoDecision(session.status_tahap_2 || session.competency_status || 'pending');
        return `
            <tr data-session-nik="${escapeMonitorHtml(session.nik || '')}" class="competency-click-row">
                <td><div class="competency-participant"><strong>${escapeMonitorHtml(session.nama_lengkap || '-')}</strong><span>${escapeMonitorHtml(session.nik || '-')}</span></div></td>
                <td>${renderMonitorPill(session.status || 'started')}</td>
                <td>${renderCameraSnapshot(session)}</td>
                <td>
                    <span class="monitor-pill ${mediaOk ? 'ok' : 'bad'}">Cam: ${escapeMonitorHtml(session.camera_status || '-')}</span>
                    <span class="monitor-pill ${mediaOk ? 'ok' : 'bad'}">Mic: ${escapeMonitorHtml(session.mic_status || '-')}</span>
                </td>
                <td>${answered}/${total || '-'} soal</td>
                <td><strong>${score}</strong></td>
                <td>
                    <span class="monitor-pill ${focusFlags ? 'warn' : 'ok'}">${focusFlags} focus flag</span>
                    <span class="monitor-pill ${session.page_visible === false || session.page_visible === 'false' ? 'warn' : 'ok'}">${session.page_visible === false || session.page_visible === 'false' ? 'Hidden' : 'Visible'}</span>
                </td>
                <td>${renderStageTwoDecisionBadge(stage2Status)}</td>
                <td>${formatMonitorDate(session.updated_at || session.started_at)}</td>
                <td>
                    <button type="button" class="btn-action" data-open-competency-detail="${escapeMonitorHtml(session.nik || '')}">
                        <i class="fas fa-gavel"></i> Detail / Decision
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateCompetencyStats(data) {
    const live = data.filter(item => String(item.status || 'started') === 'started').length;
    const submitted = data.filter(item => String(item.status) === 'submitted').length;
    const media = data.filter(item => item.camera_status === 'granted' && item.mic_status === 'granted').length;
    const flags = data.reduce((sum, item) => sum + Number(item.focus_flags || 0), 0);
    setText('competencyLiveCount', live);
    setText('competencySubmittedCount', submitted);
    setText('competencyMediaCount', media);
    setText('competencyFlagCount', flags);
}

function renderMonitorPill(status) {
    const cls = status === 'submitted' ? 'ok' : status === 'media_denied' ? 'bad' : status === 'not_started' ? 'warn' : 'warn';
    const label = status === 'submitted' ? 'Submitted' : status === 'media_denied' ? 'Media Ditolak' : status === 'not_started' ? 'Belum Mulai' : 'Sedang Tes';
    return `<span class="monitor-pill ${cls}">${label}</span>`;
}

function normalizeStageTwoDecision(value) {
    const raw = String(value || 'pending').toLowerCase();
    if (['lolos', 'accepted', 'accepted_stage_2', 'passed_stage_2'].includes(raw)) return 'lolos';
    if (['gugur', 'rejected', 'rejected_stage_2', 'failed_stage_2'].includes(raw)) return 'gugur';
    return 'pending';
}

function renderStageTwoDecisionBadge(status) {
    const label = status === 'lolos' ? 'Lolos T2' : status === 'gugur' ? 'Gugur T2' : 'Pending';
    const cls = status === 'lolos' ? 'ok' : status === 'gugur' ? 'bad' : 'warn';
    return `<span class="monitor-pill ${cls}">${label}</span>`;
}

function mergeParticipantsWithSessions(participants, sessions) {
    const sessionByNik = new Map();
    sessions.forEach(session => {
        const nik = normalizeMonitorNik(session.nik);
        if (!nik) return;
        const existing = sessionByNik.get(nik);
        if (!existing || new Date(session.updated_at || session.started_at || 0) > new Date(existing.updated_at || existing.started_at || 0)) {
            sessionByNik.set(nik, session);
        }
    });

    return participants.map(participant => {
        const nik = normalizeMonitorNik(participant.nik);
        const session = sessionByNik.get(nik) || {};
        return {
            ...participant,
            ...session,
            nik: participant.nik,
            nama_lengkap: participant.nama_lengkap,
            status: session.status || 'not_started',
            camera_status: session.camera_status || 'not_started',
            mic_status: session.mic_status || 'not_started',
            answered_count: session.answered_count || 0,
            total_questions: session.total_questions || 0,
            focus_flags: session.focus_flags || 0,
            camera_snapshot: session.camera_snapshot || ''
        };
    });
}

function isEligibleForCompetency(participant) {
    const status = String(participant.status_seleksi || '').toLowerCase();
    const stage = String(participant.participant_stage || '').toLowerCase();
    return status === 'lolos' || ['accepted_stage_1', 'competency_test', 'competency_submitted'].includes(stage);
}

function normalizeMonitorNik(nik) {
    return String(nik || '').replace(/\D/g, '');
}

function renderCameraSnapshot(session) {
    if (!session.camera_snapshot) {
        return '<span class="monitor-pill warn">Menunggu frame</span>';
    }
    return `<img class="competency-live-snapshot" src="${session.camera_snapshot}" alt="Live camera ${escapeMonitorHtml(session.nama_lengkap || 'peserta')}">`;
}

function openCompetencyDetail(session) {
    const modal = document.getElementById('competencyDetailModal');
    const body = document.getElementById('competencyDetailBody');
    if (!modal || !body) return;
    const answers = parseJsonSafe(session.answers, {});
    const sectionScores = parseJsonSafe(session.section_scores, {});
    const history = parseJsonSafe(session.history_events, []);
    const stage2Status = session.status_tahap_2 || session.competency_status || 'pending';
    body.innerHTML = `
        <div class="competency-detail-grid">
            <div><strong>Peserta</strong><span>${escapeMonitorHtml(session.nama_lengkap || '-')}<br>${escapeMonitorHtml(session.nik || '-')}</span></div>
            <div><strong>Status</strong><span>${escapeMonitorHtml(session.status || 'not_started')}</span></div>
            <div><strong>Keputusan Tahap 2</strong><span>${escapeMonitorHtml(stage2Status)}</span></div>
            <div><strong>Skor Raw</strong><span>${escapeMonitorHtml(session.score || '-')}</span></div>
            <div><strong>Skor Bobot</strong><span>${escapeMonitorHtml(session.weighted_score || '-')}</span></div>
            <div><strong>Section Aktif</strong><span>${escapeMonitorHtml(session.active_section || '-')}</span></div>
            <div><strong>Focus Flag</strong><span>${escapeMonitorHtml(session.focus_flags || 0)}</span></div>
        </div>
        <div class="competency-decision-actions">
            <button type="button" class="btn btn-outline" data-competency-decision="pending" data-nik="${escapeMonitorHtml(session.nik || '')}">Kembalikan Pending</button>
            <button type="button" class="btn-reject" data-competency-decision="gugur" data-nik="${escapeMonitorHtml(session.nik || '')}"><i class="fas fa-times"></i> Gugur Tahap 2</button>
            <button type="button" class="btn-accept" data-competency-decision="lolos" data-nik="${escapeMonitorHtml(session.nik || '')}"><i class="fas fa-check"></i> Lolos Tahap 2</button>
        </div>
        <h3 class="competency-detail-title">Section Score</h3>
        <pre class="competency-detail-pre">${escapeMonitorHtml(JSON.stringify(sectionScores, null, 2))}</pre>
        <h3 class="competency-detail-title">Jawaban Tersimpan</h3>
        <pre class="competency-detail-pre">${escapeMonitorHtml(JSON.stringify(answers, null, 2))}</pre>
        <h3 class="competency-detail-title">Riwayat Aktivitas</h3>
        <div class="competency-history-list">
            ${(Array.isArray(history) ? history.slice(-20).reverse() : []).map(item => `
                <div><strong>${formatMonitorDate(item.at)}</strong><span>${escapeMonitorHtml(item.event || '-')} • ${escapeMonitorHtml(item.section || '-')} • ${escapeMonitorHtml(item.answered_count || 0)} terjawab</span></div>
            `).join('') || '<p class="profile-message">Belum ada riwayat aktivitas.</p>'}
        </div>
    `;
    modal.classList.add('active');
}

async function setCompetencyDecision(nik, decision, button) {
    if (!nik || !decision) return;
    const labels = { lolos: 'meloloskan peserta ke tahap berikutnya', gugur: 'menandai peserta gugur tahap 2', pending: 'mengembalikan keputusan ke pending' };
    if (!confirm(`Yakin ingin ${labels[decision] || 'mengubah keputusan'}?`)) return;
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    try {
        await postCompetencyMonitor({ action: 'updateCompetencyDecision', nik, decision });
        if (typeof window.logAdminActivity === 'function') {
            window.logAdminActivity(`Mengubah keputusan Seleksi Tahap 2 NIK ${nik} menjadi ${decision}`);
        }
        document.getElementById('competencyDetailModal')?.classList.remove('active');
        await loadCompetencyData();
    } catch (error) {
        alert(error.message || 'Gagal menyimpan keputusan tahap 2.');
    } finally {
        button.disabled = false;
        button.innerHTML = original;
    }
}

function parseJsonSafe(value, fallback) {
    if (!value) return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatMonitorDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
}

function escapeMonitorHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
}

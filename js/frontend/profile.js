/* ==========================================================================
   Participant Profile Portal
   ========================================================================== */

const PARTICIPANT_PROFILE_API = '/__gas';
const PARTICIPANT_SESSION_KEY = 'heraiParticipantSession';
const PARTICIPANT_LOCAL_KEY = 'heraiParticipantProfiles';

window.initParticipantProfile = function() {
    const authView = document.getElementById('participantAuthView');
    const dashboardView = document.getElementById('participantDashboardView');
    if (!authView || !dashboardView) return;

    const session = readParticipantSession();
    if (session?.nik) {
        loadParticipantProfile(session.nik, session.password).then(profile => {
            if (profile) showParticipantDashboard(profile);
            else showAuthView();
        });
    } else {
        showAuthView();
    }

    bindParticipantEvents();
};

function bindParticipantEvents() {
    const loginForm = document.getElementById('participantLoginForm');
    const firstLoginBtn = document.getElementById('btnFirstLoginMode');
    const newPasswordBox = document.getElementById('newPasswordBox');

    firstLoginBtn?.addEventListener('click', () => {
        newPasswordBox.style.display = newPasswordBox.style.display === 'none' ? 'grid' : 'none';
    });

    loginForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const nik = document.getElementById('profileNik').value.replace(/\D/g, '');
        const password = document.getElementById('profilePassword').value;
        const confirm = document.getElementById('profilePasswordConfirm').value;
        const isFirstLogin = newPasswordBox.style.display !== 'none';

        if (nik.length !== 16) return setProfileMessage('NIK harus 16 digit.', true);
        if (!password || password.length < 6) return setProfileMessage('Password minimal 6 karakter.', true);
        if (isFirstLogin && password !== confirm) return setProfileMessage('Konfirmasi password tidak sama.', true);

        const btn = document.getElementById('btnParticipantLogin');
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        btn.disabled = true;

        try {
            const profile = isFirstLogin
                ? await setParticipantPassword(nik, password)
                : await loadParticipantProfile(nik, password);

            if (!profile) throw new Error('Profil tidak ditemukan atau password salah.');
            saveParticipantSession({ nik, password });
            showParticipantDashboard(profile);
        } catch (error) {
            setProfileMessage(error.message || 'Gagal masuk profil.', true);
        } finally {
            btn.innerHTML = original;
            btn.disabled = false;
        }
    });

    const logoutParticipant = () => {
        sessionStorage.removeItem(PARTICIPANT_SESSION_KEY);
        showAuthView();
    };
    document.getElementById('btnLogoutParticipant')?.addEventListener('click', logoutParticipant);
    document.getElementById('btnLogoutParticipantHold')?.addEventListener('click', logoutParticipant);

    document.getElementById('participantProfileForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const session = readParticipantSession();
        if (!session?.nik || !session?.password) return showAuthView();

        const updates = {
            nik: session.nik,
            password: session.password,
            nama_lengkap: document.getElementById('editName').value,
            email: document.getElementById('editEmail').value,
            whatsapp: document.getElementById('editWhatsapp').value,
            alamat: document.getElementById('editAddress').value,
            cv_link: document.getElementById('editPortfolio').value
        };
        try {
            const profile = await updateParticipantProfile(updates);
            showParticipantDashboard(profile);
            alert('Profil berhasil diperbarui.');
        } catch (error) {
            alert(error.message || 'Gagal memperbarui profil.');
        }
    });

    document.getElementById('btnGenerateAtsCv')?.addEventListener('click', () => {
        const profile = getCurrentProfileFromForm();
        document.getElementById('atsCvOutput').value = generateAtsCv(profile);
    });

    document.getElementById('btnCopyAtsCv')?.addEventListener('click', async () => {
        const text = document.getElementById('atsCvOutput').value;
        if (!text) return;
        await navigator.clipboard.writeText(text);
        alert('Draft CV ATS disalin.');
    });
}

function showAuthView() {
    setPublicChromeVisible(true);
    document.getElementById('participantAuthView').style.display = 'grid';
    document.getElementById('participantDashboardView').style.display = 'none';
    setProfileMessage('');
}

function showParticipantDashboard(profile) {
    const dashboard = profile.__dashboard || {};
    window.__CURRENT_PARTICIPANT_PROFILE__ = profile;
    window.__CURRENT_PARTICIPANT_DASHBOARD__ = dashboard;
    setPublicChromeVisible(false);
    document.getElementById('participantAuthView').style.display = 'none';
    document.getElementById('participantDashboardView').style.display = 'grid';

    setText('profileName', profile.nama_lengkap || 'Peserta HerAI');
    setText('profileGreeting', `Halo, ${profile.nama_lengkap || 'Fellow'}! 👋`);
    setText('profileAvatar', getInitials(profile.nama_lengkap || 'HerAI'));
    setValue('editNik', profile.nik || '');
    setValue('editName', profile.nama_lengkap || '');
    setValue('editEmail', profile.email || '');
    setValue('editWhatsapp', profile.whatsapp || '');
    setValue('editAddress', profile.alamat || '');
    setValue('editPortfolio', profile.cv_link || '');

    renderProfileProgress(profile);
    renderParticipantModules(dashboard.assets || []);
    renderParticipantEvents(dashboard.assets || []);
    renderParticipantCommunity(profile);
    renderParticipantLeaderboard(profile);
    renderParticipantTracks();
    renderParticipantChallenge(profile, dashboard);
    updateParticipantNotifications(profile, dashboard);
    bindFellowNavigation();
    showFellowHome();
}

async function loadParticipantProfile(nik, password) {
    try {
        const result = await postProfileApi({ action: 'participantLogin', nik, password });
        if (result.status === 'success') return hydrateProfileFromParticipantData(nik, password, result.profile);
        throw new Error(result.message || 'Profil tidak ditemukan atau password salah.');
    } catch (error) {
        if (error?.isApiError) throw error;
        const local = getLocalProfiles()[nik];
        if (local?.password && local.password === password) return hydrateProfileFromParticipantData(nik, password, stripLocalPassword(local));
        throw new Error('Tidak bisa memuat profil dari database. Pastikan koneksi dan password benar.');
    }
}

async function setParticipantPassword(nik, password) {
    try {
        const result = await postProfileApi({ action: 'setParticipantPassword', nik, password });
        if (result.status === 'success') return hydrateProfileFromParticipantData(nik, password, result.profile || result.participant);
        throw new Error(result.message);
    } catch (error) {
        if (error?.isApiError) throw error;
        throw new Error('Password belum bisa dibuat karena database peserta tidak dapat diakses.');
    }
}

async function updateParticipantProfile(updates) {
    try {
        const result = await postProfileApi({ action: 'updateParticipantProfile', ...updates });
        if (result.status === 'success') return hydrateProfileFromParticipantData(updates.nik, updates.password, result.profile || result.participant);
        throw new Error(result.message || 'Gagal memperbarui profil.');
    } catch (error) {
        if (error?.isApiError) throw error;
        throw new Error('Gagal memperbarui profil di database. Silakan coba lagi.');
    }
}

async function postProfileApi(payload) {
    const response = await fetch(PARTICIPANT_PROFILE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Database peserta tidak merespons.');
    const result = await response.json();
    if (result.status && result.status !== 'success') {
        const error = new Error(result.message || 'Permintaan profil ditolak.');
        error.isApiError = true;
        throw error;
    }
    return result;
}

async function hydrateProfileFromParticipantData(nik, password, baseProfile = {}) {
    const normalizedNik = normalizeNik(nik || baseProfile.nik);
    try {
        const result = await postProfileApi({ action: 'getParticipantDashboard', nik: normalizedNik, password });
        if (result.status === 'success') {
            const profile = normalizeParticipantProfile({ ...baseProfile, ...(result.profile || {}) });
            profile.__dashboard = normalizeParticipantDashboard(result);
            return profile;
        }
    } catch (error) {
        console.warn('Gagal hydrate dashboard peserta, memakai data login.', error);
    }
    return normalizeParticipantProfile(baseProfile);
}

function normalizeParticipantProfile(profile = {}) {
    const normalized = { ...profile };
    normalized.nik = normalizeNik(normalized.nik);
    normalized.participant_stage = normalizeParticipantStage(normalized.participant_stage);
    normalized.status_seleksi = normalized.status_seleksi || 'pending';
    normalized.status_tahap_2 = normalized.status_tahap_2 || normalized.competency_status || 'pending';
    normalized.final_status = normalized.final_status || normalized.status_final || 'pending';
    delete normalized.participant_password;
    delete normalized.password;
    return normalized;
}

function normalizeParticipantStage(stage) {
    if (!stage || stage === 'profile_created') return 'registered';
    return stage;
}

function normalizeNik(nik) {
    return String(nik || '').replace(/\D/g, '');
}

function normalizeParticipantDashboard(result = {}) {
    const data = result.dashboard || result.data || {};
    return {
        assets: asArray(result.assets || data.assets),
        projects: asArray(result.projects || data.projects),
        certificates: asArray(result.certificates || data.certificates),
        competencySessions: asArray(result.competencySessions || data.competencySessions),
        retestSessions: asArray(result.retestSessions || data.retestSessions)
    };
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function getLocalProfiles() {
    try {
        return JSON.parse(localStorage.getItem(PARTICIPANT_LOCAL_KEY) || '{}');
    } catch {
        return {};
    }
}

function createLocalPlaceholder(nik, password, persist = true) {
    const profile = {
        nik,
        password,
        nama_lengkap: 'Peserta HerAI',
        email: '',
        whatsapp: '',
        alamat: '',
        status_seleksi: 'pending',
        participant_stage: 'registered',
        tasks: [],
        mentoring: []
    };
    if (persist) {
        const profiles = getLocalProfiles();
        profiles[nik] = profile;
        localStorage.setItem(PARTICIPANT_LOCAL_KEY, JSON.stringify(profiles));
    }
    return profile;
}

function stripLocalPassword(profile) {
    const clone = { ...profile };
    delete clone.password;
    delete clone.participant_password;
    return clone;
}

function saveParticipantSession(session) {
    sessionStorage.setItem(PARTICIPANT_SESSION_KEY, JSON.stringify(session));
}

function readParticipantSession() {
    try {
        return JSON.parse(sessionStorage.getItem(PARTICIPANT_SESSION_KEY) || 'null');
    } catch {
        return null;
    }
}

function setProfileMessage(message, isError = false) {
    const el = document.getElementById('participantLoginMessage');
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? '#e63946' : 'var(--text-muted)';
}

function renderProfileProgress(profile) {
    const stages = [
        ['registered', 'Foundation Phase', 'Pemahaman dasar AI'],
        ['accepted_stage_1', 'Specialization', 'Pilih dan dalami track AI'],
        ['bootcamp_active', 'Project Building', 'Bangun proyek nyata'],
        ['final_project', 'Final Project', 'Presentasi dan kurasi akhir'],
        ['graduated', 'Graduation', 'Karier dan sertifikasi']
    ];
    const current = profile.participant_stage || 'registered';
    const currentIndex = Math.max(0, stages.findIndex(item => item[0] === current));
    const journeyPercent = Math.round(((currentIndex + 1) / stages.length) * 100);
    const percentEl = document.getElementById('participantJourneyPercent');
    if (percentEl) percentEl.textContent = `${journeyPercent}%`;
    document.getElementById('profileProgressList').innerHTML = stages.map(([key, label, caption], index) => {
        const percent = index < currentIndex ? 100 : index === currentIndex ? Math.max(35, journeyPercent) : 0;
        const status = key === current ? 'Sedang aktif' : (index < currentIndex ? 'Selesai' : 'Belum dimulai');
        return `
            <div class="profile-progress-item ${key === current ? 'active' : ''}">
                <div>
                    <strong>${escapeProfileHtml(label)}</strong>
                    <span>${escapeProfileHtml(caption)}</span>
                </div>
                <small>${escapeProfileHtml(status)}</small>
                <div class="participant-progress-track"><i style="width:${percent}%"></i></div>
            </div>
        `;
    }).join('');
}

function renderRegistrationDetails(profile) {
    const container = document.getElementById('profileRegistrationDetails');
    if (!container) return;
    const field = (...keys) => {
        for (const key of keys) {
            const value = profile?.[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') return value;
        }
        return '';
    };

    const details = [
        ['NIK', field('nik')],
        ['Nama Lengkap', field('nama_lengkap')],
        ['Tempat/Tanggal Lahir', [field('tempat_lahir'), field('tanggal_lahir')].filter(Boolean).join(', ')],
        ['Email', field('email')],
        ['WhatsApp', field('whatsapp')],
        ['Alamat', field('alamat')],
        ['Jalur Pendaftaran', field('jalur', 'jalur_pendaftaran')],
        ['Status Kerja', field('status_kerja', 'status')],
        ['Universitas', field('univ', 'universitas')],
        ['Program Studi', field('program_studi', 'jurusan')],
        ['Instansi', field('instansi', 'nama_instansi')],
        ['Posisi', field('posisi')],
        ['Pengalaman Kerja', field('pengalaman_kerja', 'peng_kerja')],
        ['Kejuaraan', field('kejuaraan')],
        ['Organisasi', field('organisasi', 'pengalaman_organisasi')],
        ['CV / Portfolio', field('cv_link', 'link_cv')],
        ['Status Seleksi', field('status_seleksi')],
        ['Tahap Peserta', field('participant_stage')],
        ['Status Tahap 2', field('status_tahap_2', 'competency_status')],
        ['Reviewer', field('assigned_reviewer')],
        ['Skor Reviewer', field('skor_akhir')],
        ['AI Score', field('ai_score')],
        ['Ringkasan AI', field('ai_summary')],
        ['Motivasi AI', field('ai_motivation')],
        ['Skill AI', field('ai_skills')],
        ['Essay 1', field('essay_1', 'essay1')],
        ['Essay 2', field('essay_2', 'essay2')],
        ['Essay 3', field('essay_3', 'essay3')],
        ['Essay 4', field('essay_4', 'essay4')],
        ['Essay 5', field('essay_5', 'essay5')]
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');

    container.innerHTML = details.length ? details.map(([label, value]) => `
        <div class="profile-detail-item">
            <strong>${escapeProfileHtml(label)}</strong>
            <span>${escapeProfileHtml(value)}</span>
        </div>
    `).join('') : '<div class="profile-detail-item"><span>Data pendaftaran belum tersedia.</span></div>';
}

function escapeProfileHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function isStagePassed(stages, current, key) {
    return stages.findIndex(item => item[0] === key) < stages.findIndex(item => item[0] === current);
}

function renderParticipantTasks(profile) {
    const defaultTasks = [
        { title: 'Lengkapi profil peserta', status: 'open', due: 'Sebelum bootcamp' },
        { title: 'Upload portfolio / LinkedIn', status: 'open', due: 'Opsional' }
    ];
    if (String(profile.status_seleksi || '').toLowerCase() === 'lolos' || String(profile.participant_stage || '').toLowerCase() === 'accepted_stage_1') {
        defaultTasks.unshift({ title: 'Kerjakan Tes Kompetensi Tahap 2', status: 'open', due: 'Sesuai jadwal seleksi', link: '#/competency-test' });
    }
    const tasks = profile.tasks?.length ? profile.tasks : defaultTasks;
    document.getElementById('participantTaskList').innerHTML = tasks.map(task => `
        <div class="profile-list-item"><strong>${task.link ? `<a href="${task.link}" class="nav-link" style="display:inline-flex; padding:0; color:inherit;">${task.title}</a>` : task.title}</strong><span>${task.status} • ${task.due || '-'}</span></div>
    `).join('');
}

function renderParticipantMentoring(profile) {
    const mentoring = profile.mentoring?.length ? profile.mentoring : [
        { title: 'Mentor belum ditentukan', date: 'TBD', link: '-' }
    ];
    document.getElementById('participantMentoringList').innerHTML = mentoring.map(item => `
        <div class="profile-list-item"><strong>${item.title}</strong><span>${item.date || 'TBD'} • ${item.link || '-'}</span></div>
    `).join('');
}

function getCurrentProfileFromForm() {
    return {
        ...(window.__CURRENT_PARTICIPANT_PROFILE__ || {}),
        nik: document.getElementById('editNik').value,
        nama_lengkap: document.getElementById('editName').value,
        email: document.getElementById('editEmail').value,
        whatsapp: document.getElementById('editWhatsapp').value,
        alamat: document.getElementById('editAddress').value,
        cv_link: document.getElementById('editPortfolio').value
    };
}

function generateAtsCv(profile) {
    return `${profile.nama_lengkap || 'Nama Peserta'}
${profile.email || '-'} | ${profile.whatsapp || '-'} | ${profile.cv_link || '-'}

RINGKASAN PROFIL
Peserta HerAI Fellowship dengan ketertarikan pada Artificial Intelligence, data, dan pengembangan solusi teknologi berdampak. Memiliki komitmen belajar, mengikuti proses seleksi/program, dan siap membangun portofolio berbasis proyek.

PENDIDIKAN / AFILIASI
${profile.univ || profile.instansi || '-'}
${profile.program_studi || profile.posisi || ''}

PENGALAMAN PROGRAM
HerAI Fellowship 2026
- Status: ${profile.participant_stage || 'registered'}
- Seleksi: ${profile.status_seleksi || 'pending'}
- AI Score: ${profile.ai_score || '-'}

KEAHLIAN
Artificial Intelligence, Data Analysis, Problem Solving, Communication, Project Collaboration

PROYEK
${profile.final_project_title || 'Final project akan ditambahkan setelah tersedia.'}

PENGHARGAAN / ORGANISASI
${profile.kejuaraan || profile.organisasi || '-'}
`;
}

function renderParticipantTasks(profile) {
    const defaultTasks = [
        { title: 'Lengkapi profil peserta', status: 'open', due: 'Sebelum bootcamp' },
        { title: 'Upload portfolio / LinkedIn', status: 'open', due: 'Opsional' }
    ];
    if (String(profile.status_seleksi || '').toLowerCase() === 'lolos' || String(profile.participant_stage || '').toLowerCase() === 'accepted_stage_1') {
        defaultTasks.unshift({ title: 'Kerjakan Tes Kompetensi Tahap 2', status: 'open', due: 'Sesuai jadwal seleksi', link: '#/competency-test' });
    }
    const tasks = profile.tasks?.length ? profile.tasks : defaultTasks;
    const summary = document.getElementById('participantTaskSummary');
    if (summary) summary.textContent = `${tasks.filter(task => String(task.status || '').toLowerCase() !== 'done').length} aktif`;
    document.getElementById('participantTaskList').innerHTML = tasks.map(task => `
        <div class="profile-list-item">
            <strong>${task.link ? `<a href="${escapeAttr(task.link)}" class="nav-link">${escapeProfileHtml(task.title)}</a>` : escapeProfileHtml(task.title)}</strong>
            <span>${escapeProfileHtml(task.status || 'open')} - ${escapeProfileHtml(task.due || '-')}</span>
        </div>
    `).join('');
}

function renderParticipantMentoring(profile) {
    const mentoring = profile.mentoring?.length ? profile.mentoring : [
        { title: 'Mentor belum ditentukan', date: 'TBD', link: '-' }
    ];
    document.getElementById('participantMentoringList').innerHTML = mentoring.map(item => `
        <div class="profile-list-item"><strong>${escapeProfileHtml(item.title)}</strong><span>${escapeProfileHtml(item.date || 'TBD')} - ${escapeProfileHtml(item.link || '-')}</span></div>
    `).join('');
}

function renderParticipantModules(assets = []) {
    const container = document.getElementById('participantModuleList');
    if (!container) return;
    const modules = assets
        .filter(asset => isAssetVisible(asset) && ['kurikulum', 'module', 'modul', 'material'].includes(normalizeAssetType(asset)))
        .slice(0, 4);
    const fallback = [
        { title: 'Python for AI Beginner', notes: 'Modul 3 dari 10', url: '#/curriculum' },
        { title: 'Machine Learning Fundamentals', notes: 'Modul 6 dari 12', url: '#/curriculum' },
        { title: 'Data Analysis with Pandas', notes: 'Modul 2 dari 8', url: '#/curriculum' }
    ];
    const rows = modules.length ? modules : fallback;
    container.innerHTML = rows.map((asset, index) => {
        const title = asset.title || asset.name || `Modul ${index + 1}`;
        const notes = asset.notes || asset.description || 'Materi pembelajaran';
        const url = asset.url || '#/curriculum';
        return `
            <a class="participant-module-card nav-link" href="${escapeAttr(url)}">
                <span><i class="${moduleIcon(index)}"></i></span>
                <strong>${escapeProfileHtml(title)}</strong>
                <small>${escapeProfileHtml(notes)}</small>
            </a>
        `;
    }).join('');
}

function renderParticipantEvents(assets = []) {
    const container = document.getElementById('participantEventList');
    if (!container) return;
    const events = assets
        .filter(asset => isAssetVisible(asset) && ['webinar', 'event', 'meeting', 'komunitas'].includes(normalizeAssetType(asset)))
        .slice(0, 3);
    const rows = events.length ? events : [
        { title: 'Live Session: Build RAG Chatbot', notes: '10.00 - 12.00 WIB', url: '#/meeting' },
        { title: 'Mentor Clinic: Career in AI', notes: '19.00 - 20.30 WIB', url: '#/meeting' }
    ];
    container.innerHTML = rows.map(item => `
        <div class="profile-list-item event-item">
            <strong>${escapeProfileHtml(item.title || item.name || 'Event HerAI')}</strong>
            <span>${escapeProfileHtml(item.notes || item.description || 'Jadwal menyusul')}</span>
            <a href="${escapeAttr(item.url || '#/meeting')}" class="nav-link">Gabung</a>
        </div>
    `).join('');
}

function renderParticipantProjects(projects = [], profile = {}) {
    const container = document.getElementById('participantProjectList');
    if (!container) return;
    const rows = projects.length ? projects : [{
        title: profile.final_project_title || 'Final project belum dikirim',
        status: profile.final_project_status || profile.final_status || 'pending',
        mentor: 'Mentor TBD'
    }];
    container.innerHTML = rows.slice(0, 3).map(project => `
        <div class="profile-list-item">
            <strong>${escapeProfileHtml(project.project_title || project.title || project.team_name || 'Final Project')}</strong>
            <span>${escapeProfileHtml(project.status || 'pending')} - ${escapeProfileHtml(project.mentor || project.track || 'Mentor TBD')}</span>
        </div>
    `).join('');
}

function renderParticipantCertificates(certificates = [], profile = {}) {
    const container = document.getElementById('participantCertificateList');
    const status = document.getElementById('participantCertificateStatus');
    if (!container) return;
    const rows = certificates.length ? certificates : [{
        certificate_no: '-',
        status: profile.certificate_status || 'pending',
        certificate_url: ''
    }];
    const firstStatus = rows[0]?.status || 'pending';
    if (status) status.textContent = formatStatusLabel(firstStatus);
    container.innerHTML = rows.slice(0, 2).map(cert => `
        <div class="profile-list-item">
            <strong>${escapeProfileHtml(cert.certificate_no || 'Sertifikat HerAI')}</strong>
            <span>${escapeProfileHtml(formatStatusLabel(cert.status || 'pending'))}${cert.certificate_url ? ` - <a href="${escapeAttr(cert.certificate_url)}" target="_blank" rel="noopener">Unduh</a>` : ''}</span>
        </div>
    `).join('');
}

function renderParticipantChallenge(profile, dashboard) {
    const el = document.getElementById('participantChallengeText');
    if (!el) return;
    const competency = dashboard.competencySessions?.[0];
    if (String(profile.status_seleksi || '').toLowerCase() === 'lolos' && !competency) {
        el.textContent = 'Tes kompetensi sudah tersedia. Selesaikan tahap ini sebelum deadline panitia.';
        return;
    }
    if (!profile.cv_link) {
        el.textContent = 'Tambahkan LinkedIn atau portfolio agar profil fellowship kamu makin siap.';
        return;
    }
    el.textContent = 'Buka satu modul dan catat insight terbaikmu untuk diskusi mentoring berikutnya.';
}

function updateParticipantNotifications(profile, dashboard) {
    return null;
}

function isAssetVisible(asset = {}) {
    const status = String(asset.status || (asset.active === false ? 'inactive' : 'active')).toLowerCase();
    const visibleTo = String(asset.visible_to || asset.visibleTo || 'all').toLowerCase();
    return status !== 'inactive' && status !== 'disabled' && status !== 'hidden' && ['all', 'peserta', 'participant', 'fellow', 'fellows'].some(key => visibleTo.includes(key));
}

function normalizeAssetType(asset = {}) {
    return String(asset.type || asset.category || '').toLowerCase();
}

function moduleIcon(index) {
    return ['fas fa-rocket', 'fas fa-brain', 'fas fa-chart-line', 'fas fa-plus'][index % 4];
}

function formatStageLabel(value) {
    const labels = {
        registered: 'Foundation Phase',
        reviewed: 'Review Tahap 1',
        accepted_stage_1: 'Specialization',
        rejected_stage_1: 'Seleksi Tahap 1',
        competency_submitted: 'Tes Kompetensi Terkirim',
        accepted_stage_2: 'Bootcamp Active',
        bootcamp_active: 'Bootcamp Active',
        final_project: 'Final Project',
        graduated: 'Graduated'
    };
    return labels[value] || String(value || 'registered').replace(/_/g, ' ');
}

function formatStatusLabel(value) {
    return String(value || 'pending').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function getInitials(name) {
    return String(name || 'H')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase();
}

function escapeAttr(value) {
    return escapeProfileHtml(value).replace(/`/g, '&#096;');
}

function renderProfileProgress(profile) {
    const stage = profile.participant_stage || 'registered';
    const passedStageOne = String(profile.status_seleksi || '').toLowerCase() === 'lolos' || stage !== 'registered';
    const rows = [
        { label: 'Foundation Phase', caption: 'Pemahaman dasar AI', percent: passedStageOne ? 80 : 45, icon: 'fa-book-open', tone: 'pink' },
        { label: 'Specialization', caption: 'Pilih & dalami track AI', percent: passedStageOne ? 35 : 0, icon: 'fa-code', tone: 'purple' },
        { label: 'Project Building', caption: 'Bangun proyek nyata', percent: ['bootcamp_active', 'final_project', 'graduated'].includes(stage) ? 55 : 20, icon: 'fa-briefcase', tone: 'yellow' },
        { label: 'Graduation', caption: 'Persiapan karier & sertifikasi', percent: stage === 'graduated' ? 100 : 0, icon: 'fa-graduation-cap', tone: 'green' }
    ];
    const container = document.getElementById('profileProgressList');
    if (!container) return;
    container.innerHTML = rows.map(row => `
        <article class="fellow-journey-item is-${row.tone}">
            <span><i class="fas ${row.icon}"></i></span>
            <div>
                <strong>${escapeProfileHtml(row.label)}</strong>
                <small>${escapeProfileHtml(row.caption)}</small>
                <i><b style="width:${row.percent}%"></b></i>
            </div>
            <em>${row.percent}%</em>
        </article>
    `).join('');
}

function renderParticipantModules(assets = []) {
    const container = document.getElementById('participantModuleList');
    if (!container) return;
    const modules = assets
        .filter(asset => isAssetVisible(asset) && ['kurikulum', 'module', 'modul', 'material'].includes(normalizeAssetType(asset)))
        .slice(0, 3);
    const rows = modules.length ? modules : [
        { title: 'Python for AI Beginner', notes: 'Modul 3 dari 10', percent: 80, url: '#/curriculum', tone: 'pink', icon: 'fa-rocket' },
        { title: 'Machine Learning Fundamentals', notes: 'Modul 6 dari 12', percent: 50, url: '#/curriculum', tone: 'purple', icon: 'fa-brain' },
        { title: 'Data Analysis with Pandas', notes: 'Modul 2 dari 8', percent: 30, url: '#/curriculum', tone: 'orange', icon: 'fa-share-nodes' }
    ];
    container.innerHTML = rows.map((item, index) => `
        <a class="fellow-module is-${escapeAttr(item.tone || ['pink', 'purple', 'orange'][index] || 'pink')} nav-link" href="${escapeAttr(item.url || '#/curriculum')}">
            <span><i class="fas ${escapeAttr(item.icon || moduleIcon(index))}"></i></span>
            <b>${Number(item.percent || [80, 50, 30][index] || 20)}%</b>
            <strong>${escapeProfileHtml(item.title || item.name || `Modul ${index + 1}`)}</strong>
            <small>${escapeProfileHtml(item.notes || item.description || 'Materi pembelajaran')}</small>
        </a>
    `).join('') + `
        <a class="fellow-module is-add nav-link" href="#/curriculum">
            <span><i class="fas fa-plus"></i></span>
            <strong>Pilih Modul Lainnya</strong>
            <small>Jelajahi semua modul</small>
        </a>
    `;
}

function renderParticipantEvents(assets = []) {
    const container = document.getElementById('participantEventList');
    if (!container) return;
    const events = assets
        .filter(asset => isAssetVisible(asset) && ['webinar', 'event', 'meeting', 'komunitas'].includes(normalizeAssetType(asset)))
        .slice(0, 3);
    const rows = events.length ? events : [
        { date: '22', month: 'MEI', title: 'Live Session: Build RAG Chatbot with LangChain', notes: '10.00 - 12.00 WIB', url: '#/meeting' },
        { date: '25', month: 'MEI', title: 'Mentor Clinic: Career in AI', notes: '19.00 - 20.30 WIB', url: '#/meeting' },
        { date: '30', month: 'MEI', title: 'Workshop: Data Visualization with Python', notes: '13.00 - 15.00 WIB', url: '#/meeting' }
    ];
    container.innerHTML = rows.map((item, index) => `
        <article class="fellow-event">
            <time><strong>${escapeProfileHtml(item.date || String(22 + index * 3))}</strong><span>${escapeProfileHtml(item.month || 'MEI')}</span></time>
            <div><strong>${escapeProfileHtml(item.title || item.name || 'Event HerAI')}</strong><small>${escapeProfileHtml(item.notes || item.description || 'Jadwal menyusul')}</small></div>
            <a href="${escapeAttr(item.url || '#/meeting')}" class="nav-link">Gabung</a>
        </article>
    `).join('');
}

function renderParticipantCommunity(profile) {
    const container = document.getElementById('participantCommunityList');
    if (!container) return;
    const rows = [
        ['Mentor Rani', 'membagikan materi baru di room #Machine Learning', '2 jam yang lalu', 'pink'],
        ['Siti Aulia', 'menyelesaikan tugas “Data Preprocessing”', '3 jam yang lalu', 'blue'],
        ['Dewi Lestari', 'bergabung di chat room #Python', '5 jam yang lalu', 'green']
    ];
    container.innerHTML = rows.map(([name, text, time, tone]) => `
        <article class="fellow-activity">
            <span>${getInitials(name)}</span>
            <p><strong>${escapeProfileHtml(name)}</strong> ${escapeProfileHtml(text)}<small>${escapeProfileHtml(time)}</small></p>
            <i class="is-${tone}"></i>
        </article>
    `).join('');
}

function renderParticipantLeaderboard(profile) {
    const container = document.getElementById('participantLeaderboardList');
    if (!container) return;
    const name = profile.nama_lengkap || 'Aisyah Putri';
    const rows = [
        [1, 'Dewi Lestari', '2.450 Poin', 'gold', false],
        [2, `${name} (Kamu)`, '2.120 Poin', 'silver', true],
        [3, 'Siti Aulia', '1.890 Poin', 'bronze', false]
    ];
    container.innerHTML = rows.map(([rank, person, points, medal, active]) => `
        <article class="fellow-rank ${active ? 'active' : ''}">
            <span>${rank}</span>
            <b>${getInitials(person)}</b>
            <strong>${escapeProfileHtml(person)}</strong>
            <em>${escapeProfileHtml(points)}</em>
            <i class="fas fa-medal is-${medal}"></i>
        </article>
    `).join('');
}

function renderParticipantTracks() {
    const container = document.getElementById('participantTrackList');
    if (!container) return;
    const rows = [
        ['Computer Vision', 'Pelajari AI untuk memahami visual', 'fa-eye', 'pink'],
        ['Natural Language Processing', 'Pahami bahasa manusia dengan AI', 'fa-message', 'purple'],
        ['Speech AI', 'Bangun aplikasi berbasis suara', 'fa-microphone', 'blue'],
        ['AI Infrastructure', 'Pelajari sistem dan deploy AI', 'fa-hexagon-nodes', 'green'],
        ['Bioinformatics', 'Kombinasikan AI dan biologi', 'fa-dna', 'orange'],
        ['Multimodal AI', 'Gabungkan berbagai jenis data', 'fa-object-group', 'yellow']
    ];
    container.innerHTML = rows.map(([title, caption, icon, tone]) => `
        <a href="#/curriculum" class="fellow-track is-${tone} nav-link">
            <span><i class="fas ${icon}"></i></span>
            <strong>${escapeProfileHtml(title)}</strong>
            <small>${escapeProfileHtml(caption)}</small>
        </a>
    `).join('');
}

function renderParticipantChallenge(profile, dashboard) {
    const el = document.getElementById('participantChallengeText');
    if (!el) return;
    el.textContent = String(profile.status_seleksi || '').toLowerCase() === 'lolos' && !dashboard.competencySessions?.length
        ? 'Selesaikan Tes Kompetensi dan kumpulkan poin tambahan minggu ini.'
        : 'Selesaikan tantangan mingguan dan dapatkan poin & badge menarik.';
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function setPublicChromeVisible(isVisible) {
    const display = isVisible ? 'block' : 'none';
    const nav = document.getElementById('navbar-container');
    const footer = document.getElementById('footer-container');
    document.body.classList.toggle('participant-dashboard-open', !isVisible);
    if (nav) nav.style.display = display;
    if (footer) footer.style.display = display;
}

function renderProfileProgress(profile) {
    const stage = profile.participant_stage || 'registered';
    const activeBoost = String(profile.status_seleksi || '').toLowerCase() === 'lolos' ? 1 : 0;
    const items = [
        { key: 'registered', label: 'Foundation Phase', caption: 'Pemahaman dasar AI', percent: stage === 'registered' && !activeBoost ? 80 : 100, icon: 'fa-book-open', tone: 'pink' },
        { key: 'accepted_stage_1', label: 'Specialization', caption: 'Pilih & dalami track AI', percent: stage === 'registered' && !activeBoost ? 35 : 70, icon: 'fa-code', tone: 'purple' },
        { key: 'bootcamp_active', label: 'Project Building', caption: 'Bangun proyek nyata', percent: ['bootcamp_active', 'final_project', 'graduated'].includes(stage) ? 55 : 20, icon: 'fa-briefcase', tone: 'yellow' },
        { key: 'graduated', label: 'Graduation', caption: 'Persiapan karier & sertifikasi', percent: stage === 'graduated' ? 100 : 0, icon: 'fa-graduation-cap', tone: 'green' }
    ];
    const container = document.getElementById('profileProgressList');
    if (!container) return;
    container.innerHTML = items.map(item => `
        <div class="profile-progress-item is-${item.tone}">
            <span class="journey-icon"><i class="fas ${item.icon}"></i></span>
            <div class="journey-copy">
                <strong>${escapeProfileHtml(item.label)}</strong>
                <small>${escapeProfileHtml(item.caption)}</small>
                <div class="participant-progress-track"><i style="width:${item.percent}%"></i></div>
            </div>
            <em>${item.percent}%</em>
        </div>
    `).join('');
}

function renderParticipantModules(assets = []) {
    const container = document.getElementById('participantModuleList');
    if (!container) return;
    const modules = assets
        .filter(asset => isAssetVisible(asset) && ['kurikulum', 'module', 'modul', 'material'].includes(normalizeAssetType(asset)))
        .slice(0, 3);
    const rows = modules.length ? modules : [
        { title: 'Python for AI Beginner', notes: 'Modul 3 dari 10', percent: 80, url: '#/curriculum', tone: 'pink', icon: 'fa-rocket' },
        { title: 'Machine Learning Fundamentals', notes: 'Modul 6 dari 12', percent: 50, url: '#/curriculum', tone: 'purple', icon: 'fa-brain' },
        { title: 'Data Analysis with Pandas', notes: 'Modul 2 dari 8', percent: 30, url: '#/curriculum', tone: 'orange', icon: 'fa-share-nodes' }
    ];
    container.innerHTML = rows.map((asset, index) => {
        const title = asset.title || asset.name || `Modul ${index + 1}`;
        const notes = asset.notes || asset.description || 'Materi pembelajaran';
        const percent = asset.percent || [80, 50, 30][index] || 20;
        const tone = asset.tone || ['pink', 'purple', 'orange'][index] || 'pink';
        const icon = asset.icon || moduleIcon(index);
        return `
            <a class="participant-module-card is-${tone} nav-link" href="${escapeAttr(asset.url || '#/curriculum')}">
                <span class="module-icon"><i class="fas ${icon}"></i></span>
                <b>${percent}%</b>
                <strong>${escapeProfileHtml(title)}</strong>
                <small>${escapeProfileHtml(notes)}</small>
            </a>
        `;
    }).join('') + `
        <a class="participant-module-card is-add nav-link" href="#/curriculum">
            <span class="module-icon"><i class="fas fa-plus"></i></span>
            <strong>Pilih Modul Lainnya</strong>
            <small>Jelajahi semua modul</small>
        </a>
    `;
}

function renderParticipantEvents(assets = []) {
    const container = document.getElementById('participantEventList');
    if (!container) return;
    const events = assets
        .filter(asset => isAssetVisible(asset) && ['webinar', 'event', 'meeting', 'komunitas'].includes(normalizeAssetType(asset)))
        .slice(0, 3);
    const rows = events.length ? events : [
        { date: '22', month: 'MEI', title: 'Live Session: Build RAG Chatbot with LangChain', notes: '10.00 - 12.00 WIB', url: '#/meeting' },
        { date: '25', month: 'MEI', title: 'Mentor Clinic: Career in AI', notes: '19.00 - 20.30 WIB', url: '#/meeting' },
        { date: '30', month: 'MEI', title: 'Workshop: Data Visualization with Python', notes: '13.00 - 15.00 WIB', url: '#/meeting' }
    ];
    container.innerHTML = rows.map((item, index) => `
        <div class="participant-event-item">
            <time><strong>${escapeProfileHtml(item.date || String(22 + index * 3))}</strong><span>${escapeProfileHtml(item.month || 'MEI')}</span></time>
            <div>
                <strong>${escapeProfileHtml(item.title || item.name || 'Event HerAI')}</strong>
                <small>${escapeProfileHtml(item.notes || item.description || 'Jadwal menyusul')}</small>
            </div>
            <a href="${escapeAttr(item.url || '#/meeting')}" class="nav-link">Gabung</a>
        </div>
    `).join('');
}

function renderParticipantCommunity(profile) {
    const container = document.getElementById('participantCommunityList');
    if (!container) return;
    const rows = [
        { name: 'Mentor Rani', text: 'membagikan materi baru di room #Machine Learning', time: '2 jam yang lalu', tone: 'pink' },
        { name: 'Siti Aulia', text: 'menyelesaikan tugas “Data Preprocessing”', time: '3 jam yang lalu', tone: 'blue' },
        { name: 'Dewi Lestari', text: 'bergabung di chat room #Python', time: '5 jam yang lalu', tone: 'green' }
    ];
    container.innerHTML = rows.map((item, index) => `
        <div class="participant-community-item">
            <span class="mini-avatar">${getInitials(item.name)}</span>
            <p><strong>${escapeProfileHtml(item.name)}</strong> ${escapeProfileHtml(item.text)}<small>${escapeProfileHtml(item.time)}</small></p>
            <i class="dot-${item.tone}"></i>
        </div>
    `).join('');
}

function renderParticipantLeaderboard(profile) {
    const container = document.getElementById('participantLeaderboardList');
    if (!container) return;
    const name = profile.nama_lengkap || 'Aisyah Putri';
    const rows = [
        { rank: 1, name: 'Dewi Lestari', points: '2.450 Poin', medal: 'gold' },
        { rank: 2, name: `${name} (Kamu)`, points: '2.120 Poin', medal: 'silver', active: true },
        { rank: 3, name: 'Siti Aulia', points: '1.890 Poin', medal: 'bronze' }
    ];
    container.innerHTML = rows.map(row => `
        <div class="participant-leaderboard-item ${row.active ? 'active' : ''}">
            <span>${row.rank}</span>
            <span class="mini-avatar">${getInitials(row.name)}</span>
            <strong>${escapeProfileHtml(row.name)}</strong>
            <em>${escapeProfileHtml(row.points)}</em>
            <i class="fas fa-medal medal-${row.medal}"></i>
        </div>
    `).join('');
}

function renderParticipantTracks() {
    const container = document.getElementById('participantTrackList');
    if (!container) return;
    const rows = [
        ['Computer Vision', 'Pelajari AI untuk memahami visual', 'fa-eye', 'pink'],
        ['Natural Language Processing', 'Pahami bahasa manusia dengan AI', 'fa-message', 'purple'],
        ['Speech AI', 'Bangun aplikasi berbasis suara', 'fa-microphone', 'blue'],
        ['AI Infrastructure', 'Pelajari sistem dan deploy AI', 'fa-hexagon-nodes', 'green'],
        ['Bioinformatics', 'Kombinasikan AI dan biologi', 'fa-dna', 'orange'],
        ['Multimodal AI', 'Gabungkan berbagai jenis data', 'fa-object-group', 'yellow']
    ];
    container.innerHTML = rows.map(([title, caption, icon, tone]) => `
        <a href="#/curriculum" class="participant-track-card is-${tone} nav-link">
            <span><i class="fas ${icon}"></i></span>
            <strong>${escapeProfileHtml(title)}</strong>
            <small>${escapeProfileHtml(caption)}</small>
        </a>
    `).join('');
}

function renderParticipantChallenge(profile, dashboard) {
    const el = document.getElementById('participantChallengeText');
    if (!el) return;
    const competency = dashboard.competencySessions?.[0];
    if (String(profile.status_seleksi || '').toLowerCase() === 'lolos' && !competency) {
        el.textContent = 'Selesaikan tantangan mingguan dan Tes Kompetensi untuk menaikkan progress fellowship.';
        return;
    }
    el.textContent = 'Selesaikan tantangan mingguan dan dapatkan poin & badge menarik.';
}

// Final dashboard-home renderers. Keep these last so the focused home UI wins over legacy profile renderers above.
function renderProfileProgress(profile) {
    const stage = profile.participant_stage || 'registered';
    const passedStageOne = String(profile.status_seleksi || '').toLowerCase() === 'lolos' || stage !== 'registered';
    const rows = [
        { label: 'Foundation Phase', caption: 'Pemahaman dasar AI', percent: passedStageOne ? 80 : 45, icon: 'fa-book-open', tone: 'pink' },
        { label: 'Specialization', caption: 'Pilih & dalami track AI', percent: passedStageOne ? 35 : 0, icon: 'fa-code', tone: 'purple' },
        { label: 'Project Building', caption: 'Bangun proyek nyata', percent: ['bootcamp_active', 'final_project', 'graduated'].includes(stage) ? 55 : 20, icon: 'fa-briefcase', tone: 'yellow' },
        { label: 'Graduation', caption: 'Persiapan karier & sertifikasi', percent: stage === 'graduated' ? 100 : 0, icon: 'fa-graduation-cap', tone: 'green' }
    ];
    const container = document.getElementById('profileProgressList');
    if (!container) return;
    container.innerHTML = rows.map(row => `
        <article class="fellow-journey-item is-${row.tone}">
            <span><i class="fas ${row.icon}"></i></span>
            <div><strong>${escapeProfileHtml(row.label)}</strong><small>${escapeProfileHtml(row.caption)}</small><i><b style="width:${row.percent}%"></b></i></div>
            <em>${row.percent}%</em>
        </article>
    `).join('');
}

function renderParticipantModules(assets = []) {
    const container = document.getElementById('participantModuleList');
    if (!container) return;
    const modules = assets
        .filter(asset => isAssetVisible(asset) && ['kurikulum', 'module', 'modul', 'material'].includes(normalizeAssetType(asset)))
        .slice(0, 3);
    const rows = modules.length ? modules : [
        { title: 'Python for AI Beginner', notes: 'Modul 3 dari 10', percent: 80, url: '#/curriculum', tone: 'pink', icon: 'fa-rocket' },
        { title: 'Machine Learning Fundamentals', notes: 'Modul 6 dari 12', percent: 50, url: '#/curriculum', tone: 'purple', icon: 'fa-brain' },
        { title: 'Data Analysis with Pandas', notes: 'Modul 2 dari 8', percent: 30, url: '#/curriculum', tone: 'orange', icon: 'fa-share-nodes' }
    ];
    container.innerHTML = rows.map((item, index) => `
        <a class="fellow-module is-${escapeAttr(item.tone || ['pink', 'purple', 'orange'][index] || 'pink')} nav-link" href="${escapeAttr(item.url || '#/curriculum')}">
            <span><i class="fas ${escapeAttr(item.icon || moduleIcon(index))}"></i></span>
            <b>${Number(item.percent || [80, 50, 30][index] || 20)}%</b>
            <strong>${escapeProfileHtml(item.title || item.name || `Modul ${index + 1}`)}</strong>
            <small>${escapeProfileHtml(item.notes || item.description || 'Materi pembelajaran')}</small>
        </a>
    `).join('') + `
        <a class="fellow-module is-add nav-link" href="#/curriculum"><span><i class="fas fa-plus"></i></span><strong>Pilih Modul Lainnya</strong><small>Jelajahi semua modul</small></a>
    `;
}

function renderParticipantEvents(assets = []) {
    const container = document.getElementById('participantEventList');
    if (!container) return;
    const rows = [
        { date: '22', month: 'MEI', title: 'Live Session: Build RAG Chatbot with LangChain', notes: '10.00 - 12.00 WIB', url: '#/meeting' },
        { date: '25', month: 'MEI', title: 'Mentor Clinic: Career in AI', notes: '19.00 - 20.30 WIB', url: '#/meeting' },
        { date: '30', month: 'MEI', title: 'Workshop: Data Visualization with Python', notes: '13.00 - 15.00 WIB', url: '#/meeting' }
    ];
    container.innerHTML = rows.map(item => `
        <article class="fellow-event"><time><strong>${item.date}</strong><span>${item.month}</span></time><div><strong>${escapeProfileHtml(item.title)}</strong><small>${escapeProfileHtml(item.notes)}</small></div><a href="${escapeAttr(item.url)}" class="nav-link">Gabung</a></article>
    `).join('');
}

function renderParticipantCommunity() {
    const container = document.getElementById('participantCommunityList');
    if (!container) return;
    const rows = [
        ['Mentor Rani', 'membagikan materi baru di room #Machine Learning', '2 jam yang lalu', 'pink'],
        ['Siti Aulia', 'menyelesaikan tugas “Data Preprocessing”', '3 jam yang lalu', 'blue'],
        ['Dewi Lestari', 'bergabung di chat room #Python', '5 jam yang lalu', 'green']
    ];
    container.innerHTML = rows.map(([name, text, time, tone]) => `
        <article class="fellow-activity"><span>${getInitials(name)}</span><p><strong>${escapeProfileHtml(name)}</strong> ${escapeProfileHtml(text)}<small>${escapeProfileHtml(time)}</small></p><i class="is-${tone}"></i></article>
    `).join('');
}

function renderParticipantLeaderboard(profile) {
    const container = document.getElementById('participantLeaderboardList');
    if (!container) return;
    const name = profile.nama_lengkap || 'Aisyah Putri';
    const rows = [[1, 'Dewi Lestari', '2.450 Poin', 'gold', false], [2, `${name} (Kamu)`, '2.120 Poin', 'silver', true], [3, 'Siti Aulia', '1.890 Poin', 'bronze', false]];
    container.innerHTML = rows.map(([rank, person, points, medal, active]) => `
        <article class="fellow-rank ${active ? 'active' : ''}"><span>${rank}</span><b>${getInitials(person)}</b><strong>${escapeProfileHtml(person)}</strong><em>${escapeProfileHtml(points)}</em><i class="fas fa-medal is-${medal}"></i></article>
    `).join('');
}

function renderParticipantTracks() {
    const container = document.getElementById('participantTrackList');
    if (!container) return;
    const rows = [
        ['Computer Vision', 'Pelajari AI untuk memahami visual', 'fa-eye', 'pink'],
        ['Natural Language Processing', 'Pahami bahasa manusia dengan AI', 'fa-message', 'purple'],
        ['Speech AI', 'Bangun aplikasi berbasis suara', 'fa-microphone', 'blue'],
        ['AI Infrastructure', 'Pelajari sistem dan deploy AI', 'fa-hexagon-nodes', 'green'],
        ['Bioinformatics', 'Kombinasikan AI dan biologi', 'fa-dna', 'orange'],
        ['Multimodal AI', 'Gabungkan berbagai jenis data', 'fa-object-group', 'yellow']
    ];
    container.innerHTML = rows.map(([title, caption, icon, tone]) => `
        <a href="#/curriculum" class="fellow-track is-${tone} nav-link"><span><i class="fas ${icon}"></i></span><strong>${escapeProfileHtml(title)}</strong><small>${escapeProfileHtml(caption)}</small></a>
    `).join('');
}

const FELLOW_MODULE_WELCOME = {
    'participant-chatroom': {
        icon: 'fa-comment-dots',
        title: 'Selamat datang di Chatroom',
        message: 'Modul percakapan peserta akan disiapkan untuk room, thread, dan pesan real-time.'
    },
    'participant-mentor': {
        icon: 'fa-user-group',
        title: 'Selamat datang di Mentor',
        message: 'Modul ini akan menampilkan mentor, jadwal, dan request mentoring.'
    },
    'participant-modules': {
        icon: 'fa-book-open',
        title: 'Selamat datang di Modul Belajar',
        message: 'Progress dan materi real akan dihubungkan ke Assets dan progress peserta.'
    },
    'participant-tasks': {
        icon: 'fa-clipboard-list',
        title: 'Selamat datang di Tugas',
        message: 'Deadline dan submission peserta akan diimplementasikan di modul ini.'
    },
    'participant-project': {
        icon: 'fa-folder-plus',
        title: 'Selamat datang di Proyek',
        message: 'Final project, repo, deck, dan demo akan dikelola di sini.'
    },
    'participant-events': {
        icon: 'fa-calendar-days',
        title: 'Selamat datang di Events',
        message: 'RSVP dan join link akan dihubungkan ke backend.'
    },
    'participant-community': {
        icon: 'fa-users',
        title: 'Selamat datang di Komunitas',
        message: 'Activity feed real akan menggantikan data sementara.'
    },
    'participant-certificate': {
        icon: 'fa-bookmark',
        title: 'Selamat datang di Sertifikat',
        message: 'Eligibility dan link unduh akan tampil di sini.'
    },
    'participant-leaderboard': {
        icon: 'fa-chess-queen',
        title: 'Selamat datang di Leaderboard',
        message: 'Rank dan poin real akan dihitung backend.'
    },
    'participant-help': {
        icon: 'fa-circle-question',
        title: 'Selamat datang di Bantuan',
        message: 'FAQ dan support CTA akan disiapkan di sini.'
    },
    'participant-settings': {
        icon: 'fa-gear',
        title: 'Selamat datang di Pengaturan',
        message: 'Profile, preferensi, dan logout akan dirapikan di sini.'
    },
    'participant-journey': {
        icon: 'fa-route',
        title: 'Selamat datang di Perjalanan Fellowship',
        message: 'Detail fase, milestone, dan status peserta akan disiapkan di sini.'
    }
};

function bindFellowNavigation() {
    const dashboardView = document.getElementById('participantDashboardView');
    if (!dashboardView || dashboardView.dataset.fellowNavBound === 'true') return;
    dashboardView.dataset.fellowNavBound = 'true';

    dashboardView.addEventListener('click', (event) => {
        const link = event.target.closest('a[href^="#participant-"]');
        if (!link || !dashboardView.contains(link)) return;

        const key = link.getAttribute('href').slice(1);
        if (key === 'participant-home') {
            event.preventDefault();
            showFellowHome();
            return;
        }

        if (FELLOW_MODULE_WELCOME[key]) {
            event.preventDefault();
            showFellowModuleWelcome(key);
        }
    });

    document.getElementById('btnBackToFellowHome')?.addEventListener('click', showFellowHome);
}

function showFellowHome() {
    const grid = document.querySelector('#participant-home .fellow-grid');
    const welcome = document.getElementById('participantModuleWelcome');
    if (grid) grid.hidden = false;
    if (welcome) welcome.hidden = true;
    setFellowActiveNav('participant-home');
}

function showFellowModuleWelcome(key) {
    const item = FELLOW_MODULE_WELCOME[key];
    if (!item) return;

    const grid = document.querySelector('#participant-home .fellow-grid');
    const welcome = document.getElementById('participantModuleWelcome');
    if (grid) grid.hidden = true;
    if (welcome) welcome.hidden = false;

    setText('participantModuleWelcomeTitle', item.title);
    setText('participantModuleWelcomeMessage', item.message);
    const icon = document.getElementById('participantModuleWelcomeIcon');
    if (icon) icon.innerHTML = `<i class="fas ${item.icon}"></i>`;
    setFellowActiveNav(key);
}

function setFellowActiveNav(key) {
    document.querySelectorAll('#participantDashboardView .fellow-nav a').forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === `#${key}`);
    });
}

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
        { title: 'Python for AI Beginner', notes: 'Modul 3 dari 10', percent: 80, tone: 'pink', icon: 'fa-rocket', url: '#/curriculum', image: '/assets/modules/python-for-ai.png' },
        { title: 'Machine Learning Fundamentals', notes: 'Modul 6 dari 12', percent: 50, tone: 'purple', icon: 'fa-brain', url: '#/curriculum', image: '/assets/modules/machine-learning.png' }
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

function moduleImage(index, item = {}) {
    const explicit = item.image || item.image_url || item.imageUrl || item.thumbnail || item.thumbnail_url || item.cover_url;
    if (explicit) return explicit;
    return [
        '/assets/modules/python-for-ai.png',
        '/assets/modules/machine-learning.png',
        '/assets/modules/data-analysis.png'
    ][index % 3];
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
        { title: 'Python for AI Beginner', notes: 'Modul 3 dari 10', percent: 80, url: '#/curriculum', tone: 'pink', icon: 'fa-rocket', image: '/assets/modules/python-for-ai.png' },
        { title: 'Machine Learning Fundamentals', notes: 'Modul 6 dari 12', percent: 50, url: '#/curriculum', tone: 'purple', icon: 'fa-brain', image: '/assets/modules/machine-learning.png' },
        { title: 'Data Analysis with Pandas', notes: 'Modul 2 dari 8', percent: 30, url: '#/curriculum', tone: 'orange', icon: 'fa-share-nodes', image: '/assets/modules/data-analysis.png' }
    ];
    container.innerHTML = rows.map((item, index) => `
        <a class="fellow-module is-${escapeAttr(item.tone || ['pink', 'purple', 'orange'][index] || 'pink')} nav-link" href="${escapeAttr(item.url || '#/curriculum')}">
            <span class="fellow-module-thumb"><img src="${escapeAttr(moduleImage(index, item))}" alt="" loading="lazy"><i class="fas ${escapeAttr(item.icon || moduleIcon(index))}"></i></span>
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
        <a href="#/curriculum" class="fellow-track is-${tone}">
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
        { title: 'Python for AI Beginner', notes: 'Modul 3 dari 10', percent: 80, url: '#/curriculum', tone: 'pink', icon: 'fa-rocket', image: '/assets/modules/python-for-ai.png' },
        { title: 'Machine Learning Fundamentals', notes: 'Modul 6 dari 12', percent: 50, url: '#/curriculum', tone: 'purple', icon: 'fa-brain', image: '/assets/modules/machine-learning.png' },
        { title: 'Data Analysis with Pandas', notes: 'Modul 2 dari 8', percent: 30, url: '#/curriculum', tone: 'orange', icon: 'fa-share-nodes', image: '/assets/modules/data-analysis.png' }
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
        <a href="#/curriculum" class="participant-track-card is-${tone}">
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
        .slice(0, 2);
    const rows = modules.length ? modules : [
        { title: 'Python for AI Beginner', notes: 'Modul 3 dari 10', percent: 80, url: '#/curriculum', tone: 'pink', icon: 'fa-rocket', image: '/assets/modules/python-for-ai.png' },
        { title: 'Machine Learning Fundamentals', notes: 'Modul 6 dari 12', percent: 50, url: '#/curriculum', tone: 'purple', icon: 'fa-brain', image: '/assets/modules/machine-learning.png' }
    ];
    container.innerHTML = rows.map((item, index) => `
        <a class="fellow-module is-${escapeAttr(item.tone || ['pink', 'purple'][index] || 'pink')}" href="${escapeAttr(item.url || '#/curriculum')}">
            <span class="fellow-module-thumb"><img src="${escapeAttr(moduleImage(index, item))}" alt="" loading="lazy"><i class="fas ${escapeAttr(item.icon || moduleIcon(index))}"></i><b>${Number(item.percent || [80, 50][index] || 20)}%</b></span>
            <strong>${escapeProfileHtml(item.title || item.name || `Modul ${index + 1}`)}</strong>
            <small>${escapeProfileHtml(item.notes || item.description || 'Materi pembelajaran')}</small>
        </a>
    `).join('') + `
        <a class="fellow-module is-add" href="#/curriculum"><span><i class="fas fa-plus"></i></span><strong>Pilih Modul Lainnya</strong><small>Jelajahi semua modul</small></a>
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
        ['Natural Language Processing', 'Pahami bahasa manusia dengan AI', 'fa-comment-dots', 'pink'],
        ['Speech AI', 'Bangun aplikasi berbasis suara', 'fa-microphone', 'blue'],
        ['AI Infrastructure', 'Pelajari sistem dan deploy AI', 'fa-server', 'green'],
        ['Bioinformatics', 'Kombinasikan AI dan biologi', 'fa-dna', 'orange'],
        ['Multimodal AI', 'Gabungkan berbagai jenis data', 'fa-photo-video', 'pink']
    ];
    container.innerHTML = rows.map(([title, caption, icon, tone]) => `
        <a href="#/curriculum" class="fellow-track is-${tone}"><span><i class="fas ${icon}"></i></span><strong>${escapeProfileHtml(title)}</strong><small>${escapeProfileHtml(caption)}</small></a>
    `).join('');
}

const FELLOW_SECTION_ASSETS = {
    project: '/assets/participant-sections/project-folder.png',
    event: '/assets/participant-sections/event-live-robot.png',
    task: '/assets/participant-sections/task-trophy.png',
    moduleHelp: '/assets/participant-sections/module-help-robot.png'
};

const FELLOW_SECTION_RENDERERS = {
    'participant-modules': renderFellowModulesPage,
    'participant-tasks': renderFellowTasksPage,
    'participant-project': renderFellowProjectsPage,
    'participant-events': renderFellowEventsPage
};

function renderFellowModulesPage() {
    return `
        <div class="fellow-section-page">
            ${renderFellowTabs(['Semua Modul', 'Foundation Phase', 'Specialization Track'])}
            <div class="fellow-stat-grid">
                ${renderFellowStat('fa-book-open', 'Total Modul', '27', 'Modul', 'pink')}
                ${renderFellowStat('fa-check', 'Modul Selesai', '8', 'Modul', 'green')}
                ${renderFellowStat('fa-chart-simple', 'Progres Belajar', '32%', 'Keseluruhan', 'purple')}
                ${renderFellowStat('fa-clock', 'Waktu Belajar', '48', 'Jam', 'orange')}
            </div>
            <div class="fellow-section-layout">
                <div class="fellow-section-stack">
                    <section class="fellow-panel">
                        <header><h3>Foundation Phase</h3><button type="button"><i class="fas fa-chevron-up"></i></button></header>
                        <div class="fellow-course-list">
                            ${[
                                ['1', 'AI & Data Literacy', 'Pengenalan AI, data, dan penerapannya di dunia nyata.', '100', 'Selesai', 'pink', 'fa-brain'],
                                ['2', 'Python for AI Beginner', 'Dasar pemrograman Python untuk pemula.', '100', 'Selesai', 'blue', 'fa-python'],
                                ['3', 'Math for AI', 'Matematika dasar yang penting untuk AI.', '60', 'Lanjutkan', 'green', 'fa-square-root-variable'],
                                ['4', 'Data Handling & SQL', 'Mengelola data dan dasar-dasar SQL.', '40', 'Lanjutkan', 'purple', 'fa-database'],
                                ['5', 'Data Visualization', 'Visualisasi data untuk insight yang lebih baik.', '0', 'Mulai', 'pink', 'fa-chart-line']
                            ].map(renderFellowCourse).join('')}
                        </div>
                    </section>
                    <section class="fellow-panel">
                        <header><h3>Specialization Track</h3><button type="button"><i class="fas fa-chevron-up"></i></button></header>
                        <div class="fellow-track-grid">
                            ${[
                                ['Computer Vision', 'Pelajari AI untuk memahami visual seperti gambar & video.', '6 Modul', 'fa-eye', 'pink'],
                                ['NLP & LLM', 'Pahami bahasa manusia dan bangun LLM.', '6 Modul', 'fa-message', 'purple'],
                                ['Speech AI', 'Bangun aplikasi AI berbasis suara.', '5 Modul', 'fa-microphone', 'blue'],
                                ['Data Science', 'Analisis data untuk pengambilan keputusan.', '5 Modul', 'fa-chart-line', 'green'],
                                ['AI Engineering', 'Bangun dan deploy sistem AI yang scalable.', '5 Modul', 'fa-gears', 'orange'],
                                ['Generative AI', 'Kreativitas tanpa batas dengan GenAI.', '5 Modul', 'fa-wand-magic-sparkles', 'pink']
                            ].map(renderFellowTrackCard).join('')}
                        </div>
                    </section>
                </div>
                <aside class="fellow-section-side">
                    ${renderFellowProgressCard('Ringkasan Progres', '32%', [['Selesai', '8 Modul', 'green'], ['Sedang Berlangsung', '7 Modul', 'pink'], ['Belum Dimulai', '12 Modul', 'muted']])}
                    ${renderFellowImageCard('Jadwal Belajar', FELLOW_SECTION_ASSETS.moduleHelp, 'Konsisten belajar adalah kunci!', 'Atur Jadwal')}
                    ${renderFellowLinkList('Sumber Belajar', ['Reading Materials', 'Cheat Sheet', 'Video Playlist', 'Practice Dataset', 'AI Tools Directory'])}
                </aside>
            </div>
        </div>
    `;
}

function renderFellowTasksPage() {
    return `
        <div class="fellow-section-page">
            ${renderFellowTabs(['Semua Tugas', 'Belum Dikerjakan 8', 'Sedang Dikerjakan 2', 'Sudah Dikumpulkan', 'Terlambat'])}
            <div class="fellow-filter-row"><button>Semua Modul <i class="fas fa-chevron-down"></i></button><button>Terbaru <i class="fas fa-chevron-down"></i></button></div>
            <div class="fellow-section-layout">
                <div class="fellow-section-stack">
                    ${[
                        ['Data Preprocessing dengan Python', 'Data Analysis with Pandas', 'Lakukan pembersihan dan transformasi data pada dataset yang diberikan menggunakan Python dan Pandas.', 'Belum Dikerjakan', 'Kerjakan Tugas', '25 Mei 2024', '100 Poin', 'pink', 'fa-clipboard-list', ''],
                        ['Eksplorasi Data COVID-19', 'Data Visualization', 'Buat visualisasi data COVID-19 dan berikan insight dari data tersebut.', 'Sedang Dikerjakan', 'Lanjutkan', '28 Mei 2024', '100 Poin', 'purple', 'fa-chart-line', '60%'],
                        ['Klasifikasi Sentimen dengan Machine Learning', 'Machine Learning Fundamentals', 'Bangun model klasifikasi untuk analisis sentimen menggunakan dataset teks yang tersedia.', 'Belum Dikerjakan', 'Kerjakan Tugas', '31 Mei 2024', '150 Poin', 'orange', 'fa-file-lines', ''],
                        ['Mini Project: Prediksi Harga Rumah', 'Project Building', 'Bangun model prediksi harga rumah menggunakan algoritma regresi.', 'Sudah Dikumpulkan', 'Lihat Submission', '7 Juni 2024', '200 Poin', 'green', 'fa-circle-check', 'Dinilai'],
                        ['NLP: Text Summarization', 'NLP & LLM', 'Buat program untuk meringkas teks menggunakan teknik NLP.', 'Belum Dikerjakan', 'Kerjakan Tugas', '10 Juni 2024', '150 Poin', 'pink', 'fa-comments', '']
                    ].map(renderFellowTaskItem).join('')}
                </div>
                <aside class="fellow-section-side">
                    ${renderFellowProgressCard('Ringkasan Tugas', '12', [['Belum Dikerjakan', '8', 'pink'], ['Sedang Dikerjakan', '2', 'purple'], ['Sudah Dikumpulkan', '2', 'green'], ['Terlambat', '0', 'orange']])}
                    ${renderFellowMiniCalendar('Kalender Deadline')}
                    ${renderFellowLinkList('Deadline Terdekat', ['Eksplorasi Data COVID-19', 'Klasifikasi Sentimen dengan Machine Learning', 'Mini Project: Prediksi Harga Rumah'])}
                    ${renderFellowImageCard('Raih poin lebih banyak', FELLOW_SECTION_ASSETS.task, 'Kerjakan tugas secara konsisten dan naik level.', 'Lihat Leaderboard')}
                </aside>
            </div>
        </div>
    `;
}

function renderFellowProjectsPage() {
    return `
        <div class="fellow-section-page">
            ${renderFellowTabs(['Semua Proyek', 'Proyek Saya', 'Proyek Tim', 'Arsip'], '<button class="fellow-primary-action"><i class="fas fa-plus"></i> Buat Proyek Baru</button>')}
            <div class="fellow-stat-grid">
                ${renderFellowStat('fa-folder-open', 'Total Proyek', '24', 'Proyek', 'pink')}
                ${renderFellowStat('fa-users', 'Proyek Saya', '6', 'Proyek', 'purple')}
                ${renderFellowStat('fa-user-group', 'Proyek Tim', '8', 'Proyek', 'orange')}
                ${renderFellowStat('fa-check', 'Selesai', '10', 'Proyek', 'green')}
            </div>
            <div class="fellow-section-layout">
                <section class="fellow-panel fellow-project-panel">
                    <header><h3>Daftar Proyek</h3><div><button>Semua Status <i class="fas fa-chevron-down"></i></button><button>Terbaru <i class="fas fa-chevron-down"></i></button></div></header>
                    ${[
                        ['AI Chatbot Kesehatan Mental', 'Chatbot berbasis NLP untuk memberikan dukungan kesehatan mental awal bagi perempuan muda.', 'Machine Learning', 'Selesai', '100%', 'pink', 'fa-heart-pulse'],
                        ['Prediksi Harga Rumah', 'Model prediksi harga rumah menggunakan algoritma regresi dan feature engineering.', 'Data Analysis', 'Sedang Dikerjakan', '65%', 'purple', 'fa-chart-line'],
                        ['Rekomendasi Produk Skincare', 'Sistem rekomendasi produk skincare berdasarkan preferensi dan jenis kulit pengguna.', 'Recommendation System', 'Review', '80%', 'orange', 'fa-cart-shopping'],
                        ['Deteksi Penyakit Tanaman', 'Aplikasi deteksi penyakit pada tanaman menggunakan image classification.', 'Computer Vision', 'Belum Dimulai', '0%', 'green', 'fa-seedling']
                    ].map(renderFellowProjectItem).join('')}
                </section>
                <aside class="fellow-section-side">
                    ${renderFellowLinkList('Aktivitas Terbaru', ['AI Chatbot Kesehatan Mental selesai', 'Prediksi Harga Rumah diunggah', 'Rekomendasi Produk Skincare mendapat feedback', 'Anggota baru bergabung di proyek'])}
                    ${renderFellowImageCard('Mulai Proyek Baru', FELLOW_SECTION_ASSETS.project, 'Punya ide proyek keren? Wujudkan bersama tim.', 'Buat Proyek Baru')}
                    ${renderFellowLinkList('Tips Proyek', ['Pilih topik yang relevan dengan skill kamu.', 'Diskusikan ide dengan mentor atau tim.', 'Gunakan data berkualitas untuk hasil lebih akurat.'])}
                </aside>
            </div>
        </div>
    `;
}

function renderFellowEventsPage() {
    return `
        <div class="fellow-section-page">
            ${renderFellowTabs(['Semua Events', 'Webinar', 'Workshop', 'Mentor Session', 'Komunitas', 'Lomba', 'Career'])}
            <div class="fellow-filter-row"><button>Semua Kategori <i class="fas fa-chevron-down"></i></button><button><i class="far fa-calendar"></i> Tanggal</button><button>Format <i class="fas fa-chevron-down"></i></button><button>Online & Offline <i class="fas fa-chevron-down"></i></button><button>Terbaru <i class="fas fa-chevron-down"></i></button></div>
            <div class="fellow-section-layout">
                <section class="fellow-panel fellow-event-panel">
                    <header><h3>Event Mendatang <span>5</span></h3><a href="#">Lihat Semua <i class="fas fa-arrow-right"></i></a></header>
                    ${[
                        ['Build RAG Chatbot with LangChain', 'Pelajari cara membangun chatbot cerdas dengan Retrieval Augmented Generation menggunakan LangChain.', 'Webinar', '22', 'MEI', '10.00 - 12.00 WIB', '120 peserta terdaftar', 'pink', FELLOW_SECTION_ASSETS.event],
                        ['Data Visualization with Python', 'Buat visualisasi data informatif dan menarik menggunakan Matplotlib, Seaborn, dan Plotly.', 'Workshop', '25', 'MEI', '13.00 - 16.00 WIB', '86 peserta terdaftar', 'purple', '/assets/modules/machine-learning.png'],
                        ['Career in AI: Ask Me Anything', 'Sesi tanya jawab bersama mentor berpengalaman seputar karier di bidang AI/ML.', 'Mentor Session', '30', 'MEI', '19.00 - 20.30 WIB', '64 peserta terdaftar', 'orange', FELLOW_SECTION_ASSETS.project],
                        ['AI Project Challenge 2024', 'Tunjukkan ide dan kreasimu dalam kompetisi proyek AI untuk semua Fellow HerAI.', 'Lomba', '5', 'JUN', '23.59 WIB', '35 tim terdaftar', 'green', FELLOW_SECTION_ASSETS.task]
                    ].map(renderFellowEventItem).join('')}
                </section>
                <aside class="fellow-section-side">
                    ${renderFellowMiniCalendar('Kalender Events')}
                    ${renderFellowLinkList('Event yang Kamu Ikuti', ['Build RAG Chatbot with LangChain', 'Data Visualization with Python', 'Career in AI: Ask Me Anything'])}
                    ${renderFellowImageCard('Jangan Lewatkan!', FELLOW_SECTION_ASSETS.event, 'AI for Social Good Hackathon hadir bulan ini.', 'Lihat Detail')}
                </aside>
            </div>
        </div>
    `;
}

function renderFellowTabs(items, action = '') {
    return `<div class="fellow-section-tabs"><nav>${items.map((item, index) => `<button class="${index === 0 ? 'active' : ''}" type="button">${escapeProfileHtml(item)}</button>`).join('')}</nav>${action}</div>`;
}

function renderFellowStat(icon, label, value, caption, tone) {
    return `<article class="fellow-stat is-${tone}"><span><i class="fas ${icon}"></i></span><div><small>${escapeProfileHtml(label)}</small><strong>${escapeProfileHtml(value)}</strong><em>${escapeProfileHtml(caption)}</em></div></article>`;
}

function renderFellowCourse([num, title, desc, progress, action, tone, icon]) {
    const done = Number(progress) >= 100;
    return `<article class="fellow-course"><b>${num}</b><span class="is-${tone}"><i class="fas ${icon}"></i></span><div><strong>${escapeProfileHtml(title)}</strong><small>${escapeProfileHtml(desc)}</small></div><i><b style="width:${progress}%"></b></i><em>${progress}%</em><button class="${done ? 'done' : ''}">${done ? '<i class="fas fa-check"></i>' : ''}${escapeProfileHtml(action)}</button></article>`;
}

function renderFellowTrackCard([title, desc, count, icon, tone]) {
    return `<a class="fellow-section-track is-${tone}" href="#/curriculum"><span><i class="fas ${icon}"></i></span><div><strong>${escapeProfileHtml(title)}</strong><small>${escapeProfileHtml(desc)}</small><em>${escapeProfileHtml(count)}</em></div><i class="fas fa-arrow-right"></i></a>`;
}

function renderFellowTaskItem([title, tag, desc, status, action, deadline, points, tone, icon, progress]) {
    return `<article class="fellow-task-row"><span class="is-${tone}"><i class="fas ${icon}"></i></span><div><strong>${escapeProfileHtml(title)}</strong><b>${escapeProfileHtml(tag)}</b><p>${escapeProfileHtml(desc)}</p><small><i class="far fa-calendar"></i> Deadline: ${escapeProfileHtml(deadline)}, 23:59 WIB <i class="far fa-star"></i> ${escapeProfileHtml(points)}</small></div><aside><em>${escapeProfileHtml(status)}</em><button>${escapeProfileHtml(action)}</button>${progress ? `<small>${escapeProfileHtml(progress)}</small>` : ''}</aside></article>`;
}

function renderFellowProjectItem([title, desc, tag, status, progress, tone, icon]) {
    return `<article class="fellow-project-row"><span class="is-${tone}"><i class="fas ${icon}"></i></span><div><strong>${escapeProfileHtml(title)}</strong><b>${escapeProfileHtml(tag)}</b><p>${escapeProfileHtml(desc)}</p><small>Diperbarui 2 hari yang lalu</small></div><aside><em>${escapeProfileHtml(status)}</em><i><b style="width:${progress}"></b></i><small>${escapeProfileHtml(progress)}</small></aside></article>`;
}

function renderFellowEventItem([title, desc, tag, date, month, time, count, tone, image]) {
    return `<article class="fellow-event-row"><img src="${escapeAttr(image)}" alt="" loading="lazy"><div><b>${escapeProfileHtml(tag)}</b><strong>${escapeProfileHtml(title)}</strong><p>${escapeProfileHtml(desc)}</p><small>Mentor HerAI</small></div><time><strong>${date}</strong><span>${month}</span><small>${escapeProfileHtml(time)}</small></time><aside><button>${tag === 'Lomba' ? 'Ikut Lomba' : 'Daftar'}</button><small>${escapeProfileHtml(count)}</small><i class="far fa-bookmark"></i></aside></article>`;
}

function renderFellowProgressCard(title, value, rows) {
    return `<section class="fellow-side-card"><h3>${escapeProfileHtml(title)}</h3><div class="fellow-donut"><strong>${escapeProfileHtml(value)}</strong><small>Keseluruhan</small></div><div class="fellow-legend">${rows.map(([label, count, tone]) => `<p><i class="is-${tone}"></i><span>${escapeProfileHtml(label)}</span><b>${escapeProfileHtml(count)}</b></p>`).join('')}</div></section>`;
}

function renderFellowImageCard(title, image, text, action) {
    return `<section class="fellow-side-card fellow-image-card"><h3>${escapeProfileHtml(title)}</h3><img src="${escapeAttr(image)}" alt="" loading="lazy"><p>${escapeProfileHtml(text)}</p><button>${escapeProfileHtml(action)}</button></section>`;
}

function renderFellowLinkList(title, items) {
    return `<section class="fellow-side-card"><h3>${escapeProfileHtml(title)}</h3><div class="fellow-side-list">${items.map((item, index) => `<article><span>${index + 1}</span><p>${escapeProfileHtml(item)}</p><i class="fas fa-chevron-right"></i></article>`).join('')}</div></section>`;
}

function renderFellowMiniCalendar(title) {
    const days = ['28', '29', '30', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31'];
    return `<section class="fellow-side-card fellow-calendar"><h3>${escapeProfileHtml(title)}</h3><header><button><i class="fas fa-chevron-left"></i></button><strong>Mei 2024</strong><button><i class="fas fa-chevron-right"></i></button></header><div>${['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => `<b>${day}</b>`).join('')}${days.map(day => `<span class="${['22', '25', '28', '31'].includes(day) ? 'active' : ''}">${day}</span>`).join('')}</div></section>`;
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
        handleFellowSectionClick(event);

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

    document.querySelector('#participant-home .fellow-search input')?.addEventListener('input', filterActiveFellowSection);
    document.getElementById('btnBackToFellowHome')?.addEventListener('click', showFellowHome);
}

function showFellowHome() {
    const grid = document.querySelector('#participant-home .fellow-grid');
    const welcome = document.getElementById('participantModuleWelcome');
    if (grid) grid.hidden = false;
    if (welcome) welcome.hidden = true;
    if (welcome) welcome.classList.remove('is-section-page');
    const profile = window.__CURRENT_PARTICIPANT_PROFILE__ || {};
    setFellowHeader(`Halo, ${profile.nama_lengkap || 'Fellow'}! 👋`, 'Semangat belajar hari ini! Setiap langkah kecil membawamu lebih dekat ke masa depan yang kamu impikan.', 'Cari modul, topik, atau teman...');
    setFellowActiveNav('participant-home');
}

function showFellowModuleWelcome(key) {
    const item = FELLOW_MODULE_WELCOME[key];
    if (!item) return;

    const grid = document.querySelector('#participant-home .fellow-grid');
    const welcome = document.getElementById('participantModuleWelcome');
    if (grid) grid.hidden = true;
    if (welcome) welcome.hidden = false;

    if (FELLOW_SECTION_RENDERERS[key]) {
        const sectionMeta = {
            'participant-modules': ['Modul', 'Belajar terstruktur dengan 25+ modul yang dirancang untuk membawamu menjadi AI Talent yang siap berdampak.', 'Cari modul...'],
            'participant-tasks': ['Tugas', 'Selesaikan tugas untuk mengasah skill dan dapatkan poin!', 'Cari tugas...'],
            'participant-project': ['Proyek', 'Bangun solusi nyata dan terapkan ilmu AI yang kamu pelajari.', 'Cari proyek...'],
            'participant-events': ['Events', 'Ikuti berbagai acara seru untuk menambah wawasan, relasi, dan pengalamanmu.', 'Cari event, topik, atau pembicara...']
        }[key];
        setFellowHeader(sectionMeta[0], sectionMeta[1], sectionMeta[2]);
        welcome.classList.add('is-section-page');
        welcome.innerHTML = FELLOW_SECTION_RENDERERS[key]();
        filterActiveFellowSection();
        setFellowActiveNav(key);
        return;
    }

    welcome.classList.remove('is-section-page');
    welcome.innerHTML = `
        <span id="participantModuleWelcomeIcon"><i class="fas fa-sparkles"></i></span>
        <div>
            <p class="fellow-welcome-kicker">Modul Dashboard</p>
            <h2 id="participantModuleWelcomeTitle">Selamat datang</h2>
            <p id="participantModuleWelcomeMessage">Modul ini sedang disiapkan untuk implementasi lanjutan.</p>
        </div>
        <button type="button" id="btnBackToFellowHome" class="fellow-btn">Kembali ke Beranda</button>
    `;
    document.getElementById('btnBackToFellowHome')?.addEventListener('click', showFellowHome);
    setText('participantModuleWelcomeTitle', item.title);
    setText('participantModuleWelcomeMessage', item.message);
    const icon = document.getElementById('participantModuleWelcomeIcon');
    if (icon) icon.innerHTML = `<i class="fas ${item.icon}"></i>`;
    setFellowActiveNav(key);
}

function setFellowHeader(title, subtitle, searchPlaceholder) {
    setText('profileGreeting', title);
    const headerText = document.querySelector('#participant-home .fellow-header > div > p');
    if (headerText) headerText.textContent = subtitle;
    const search = document.querySelector('#participant-home .fellow-search input');
    if (search) {
        search.placeholder = searchPlaceholder;
        search.value = '';
    }
}

function handleFellowSectionClick(event) {
    const section = event.target.closest('.fellow-section-page');
    if (!section) return;

    const tab = event.target.closest('.fellow-section-tabs button');
    if (tab) {
        section.querySelectorAll('.fellow-section-tabs button').forEach(button => button.classList.remove('active'));
        tab.classList.add('active');
        filterActiveFellowSection();
        return;
    }

    const filterButton = event.target.closest('.fellow-filter-row button, .fellow-panel header button');
    if (filterButton) {
        filterButton.classList.toggle('is-open');
        const panel = filterButton.closest('.fellow-panel');
        if (panel && filterButton.closest('header')) panel.classList.toggle('is-collapsed');
        return;
    }

    const date = event.target.closest('.fellow-calendar span');
    if (date) {
        const calendar = date.closest('.fellow-calendar');
        calendar.querySelectorAll('span').forEach(item => item.classList.remove('is-selected'));
        date.classList.add('is-selected');
        return;
    }

    const action = event.target.closest('.fellow-course button, .fellow-task-row button, .fellow-event-row button, .fellow-primary-action, .fellow-image-card button');
    if (action) {
        action.classList.add('is-pressed');
        showFellowSectionToast(action.textContent.trim() || 'Aksi dipilih');
        setTimeout(() => action.classList.remove('is-pressed'), 450);
    }
}

function filterActiveFellowSection() {
    const section = document.querySelector('#participantModuleWelcome.is-section-page .fellow-section-page');
    if (!section) return;
    const search = document.querySelector('#participant-home .fellow-search input');
    const query = String(search?.value || '').trim().toLowerCase();
    const activeTab = section.querySelector('.fellow-section-tabs button.active')?.textContent.trim().toLowerCase() || '';
    const rows = section.querySelectorAll('.fellow-course, .fellow-section-track, .fellow-task-row, .fellow-project-row, .fellow-event-row');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const matchesSearch = !query || text.includes(query);
        const matchesTab = activeTab.startsWith('semua') || !activeTab || text.includes(activeTab.replace(/\s+\d+$/, '')) || row.classList.contains('fellow-course') || row.classList.contains('fellow-section-track');
        row.classList.toggle('is-hidden', !(matchesSearch && matchesTab));
    });
}

function showFellowSectionToast(message) {
    const welcome = document.getElementById('participantModuleWelcome');
    if (!welcome) return;
    let toast = welcome.querySelector('.fellow-section-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'fellow-section-toast';
        welcome.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 1400);
}

function setFellowActiveNav(key) {
    document.querySelectorAll('#participantDashboardView .fellow-nav a').forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === `#${key}`);
    });
}

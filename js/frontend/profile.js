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
    document.getElementById('btnLogoutParticipantHold')?.addEventListener('click', logoutParticipant);
    document.getElementById('btnOpenProfile')?.addEventListener('click', () => {
        window.location.hash = '#participant-settings';
        // Mock a hash change click to trigger the router manually if needed
        const a = document.createElement('a');
        a.href = '#participant-settings';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

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

    const hash = window.location.hash;
    const initialRouteMap = {
        '#/chatroom': 'participant-chatroom',
        '#/modul': 'participant-modules',
        '#/tugas': 'participant-tasks',
        '#/fellow-proyek': 'participant-project',
        '#/events': 'participant-events',
        '#/komunitas': 'participant-community',
        '#/sertifikat': 'participant-certificate',
        '#/leaderboard': 'participant-leaderboard',
        '#/faq': 'participant-help',
        '#/profil': 'participant-profile',
        '#/profile': 'participant-profile'
    };
    
    if (initialRouteMap[hash]) {
        setTimeout(() => {
            if (initialRouteMap[hash] === 'participant-profile') {
                const btnProfile = document.getElementById('btnOpenProfile');
                if (btnProfile) {
                    btnProfile.click();
                } else {
                    showFellowModuleWelcome('participant-profile');
                }
            } else {
                const link = document.querySelector(`a[href="#${initialRouteMap[hash]}"]`);
                if (link) {
                    link.click();
                } else if (document.body.classList.contains('participant-dashboard-open')) {
                    setFellowHeader('Halo, Fellow HerAI!', 'Semangat belajar hari ini! Setiap langkah kecil membawamu lebih dekat ke masa depan yang kamu impikan.');
                    document.querySelector('.fellow-grid').hidden = false;
                    document.getElementById('participantModuleWelcome').hidden = true;
                    setFellowActiveNav('participant-home');
                }
            }
        }, 100);
    } else {
        showFellowHome();
    }
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
    container.innerHTML = rows.map((item, index) => {
        const bgColors = ['', 'background: #f0f0ff; color: #4c3cff;', 'background: #fff8f0; color: #ff9800;'];
        return `
        <a class="card-course" href="${escapeAttr(item.url || '#/curriculum')}" style="text-decoration: none; cursor: pointer;">
            <div class="card-course-progress-circle">${Number(item.percent || [80, 50, 30][index] || 20)}%</div>
            <div class="card-course-icon" style="${bgColors[index] || ''}"><i class="fas ${escapeAttr(item.icon || moduleIcon(index))}"></i></div>
            <div class="card-course-info">
                <h4 style="font: var(--font-card-title); color: var(--fellow-text-main); margin: 0 0 4px 0; line-height: 1.2;">${escapeProfileHtml(item.title || item.name || `Modul ${index + 1}`)}</h4>
                <p style="font: var(--font-caption); color: var(--fellow-text-muted); margin: 0;">${escapeProfileHtml(item.notes || item.description || 'Materi pembelajaran')}</p>
            </div>
        </a>
    `;}).join('') + `
        <a class="card-course" href="#/curriculum" style="border: 2px dashed #f0f0f0; text-decoration: none; cursor: pointer;">
            <div class="card-course-icon" style="background: #fcfcfd; color: #B0B7C3; border: 1px solid #f0f0f0;"><i class="fas fa-plus"></i></div>
            <div class="card-course-info">
                <h4 style="font: var(--font-card-title); color: var(--fellow-text-main); margin: 0 0 4px 0; line-height: 1.2;">Pilih Modul Lainnya</h4>
                <p style="font: var(--font-caption); color: var(--fellow-text-muted); margin: 0;">Jelajahi semua modul</p>
            </div>
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
    container.innerHTML = rows.map(([name, text, time, tone], index) => {
        const toneColors = {'pink': '#f53f7c', 'blue': '#3b82f6', 'green': '#10b981'};
        const color = toneColors[tone] || '#f53f7c';
        const img = index === 1 ? '/assets/referensi/persona2.png' : '/assets/referensi/persona-her-ai.png';
        return `
        <div class="activity-item" style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
            <img src="${img}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">
            <div style="flex: 1;">
                <p style="font: var(--font-body); margin: 0; font-size: 13px;"><b>${escapeProfileHtml(name)}</b> ${escapeProfileHtml(text)}</p>
                <small style="font: var(--font-caption); color: var(--fellow-text-muted);">${escapeProfileHtml(time)}</small>
            </div>
            <div style="width: 8px; height: 8px; background: ${color}; border-radius: 50%;"></div>
        </div>
    `;}).join('');
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
    container.innerHTML = rows.map(([title, caption, icon, tone]) => {
        const toneColors = {
            'pink': 'background: #fdf5f7; color: #f53f7c;',
            'purple': 'background: #f5f3ff; color: #7c3aed;',
            'blue': 'background: #eff6ff; color: #3b82f6;',
            'green': 'background: #ecfdf5; color: #10b981;',
            'orange': 'background: #fff7ed; color: #ea580c;',
            'yellow': 'background: #fefce8; color: #ca8a04;'
        };
        const colorStyle = toneColors[tone] || toneColors['pink'];
        return `
        <a href="#/curriculum" class="track-card" style="background: white; border: 1px solid #f0f0f0; border-radius: 20px; padding: 20px; text-align: left; transition: all 0.2s ease; cursor: pointer; text-decoration: none; display: block;">
            <div class="track-icon" style="${colorStyle} width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 12px;"><i class="fas ${icon}"></i></div>
            <h5 style="font: var(--font-card-title); font-size: 13px; margin: 0 0 4px 0; color: var(--fellow-text-main);">${escapeProfileHtml(title)}</h5>
            <p style="font: var(--font-caption); color: var(--fellow-text-muted); font-size: 11px; margin: 0; line-height: 1.4;">${escapeProfileHtml(caption)}</p>
        </a>
    `;}).join('');
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
    container.innerHTML = items.map((item, index) => {
        const colors = {
            'pink': { bg: '#fdf5f7', text: '#f53f7c' },
            'purple': { bg: '#f5f3ff', text: '#7c3aed' },
            'yellow': { bg: '#fffbeb', text: '#f59e0b' },
            'green': { bg: '#ecfdf5', text: '#10b981' }
        };
        const c = colors[item.tone] || colors['pink'];
        return `
        <div class="journey-item" style="display: flex; gap: 16px; align-items: center; margin-bottom: ${index === items.length - 1 ? '0' : '24px'};">
            <div class="journey-icon-box" style="background: ${c.bg}; color: ${c.text}; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;"><i class="fas ${item.icon}"></i></div>
            <div class="journey-content" style="flex: 1;">
                <div class="journey-label" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font: var(--font-card-title); color: var(--fellow-text-main);">${escapeProfileHtml(item.label)}</span>
                        <span style="font: var(--font-caption); color: var(--fellow-text-muted);">${escapeProfileHtml(item.caption)}</span>
                    </div>
                    <span style="font: var(--font-caption); color: ${c.text}; font-weight: 800;">${item.percent}%</span>
                </div>
                <div class="journey-bar-bg" style="height: 6px; background: #f8f9fa; border-radius: 10px; overflow: hidden;"><div class="journey-bar-fill" style="width: ${item.percent}%; height: 100%; background: ${c.text}; border-radius: 10px;"></div></div>
            </div>
        </div>
    `;}).join('');
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
        { label: 'Foundation Phase', caption: 'Pemahaman dasar AI', percent: passedStageOne ? 80 : 45, icon: 'fa-book-open', bg: '#ffeef4', color: '#f53f7c' },
        { label: 'Specialization', caption: 'Pilih & dalami track AI', percent: passedStageOne ? 35 : 0, icon: 'fa-code', bg: '#9333ea', color: 'white' },
        { label: 'Project Building', caption: 'Bangun proyek nyata', percent: ['bootcamp_active', 'final_project', 'graduated'].includes(stage) ? 55 : 20, icon: 'fa-briefcase', bg: '#f59e0b', color: 'white' },
        { label: 'Graduation', caption: 'Persiapan karier & sertifikasi', percent: stage === 'graduated' ? 100 : 0, icon: 'fa-graduation-cap', bg: '#10b981', color: 'white' }
    ];
    const container = document.getElementById('profileProgressList');
    if (!container) return;
    container.innerHTML = rows.map((row, i) => `
        <div class="journey-item" style="display: flex; gap: 16px; align-items: center; ${i < rows.length - 1 ? 'margin-bottom: 24px;' : ''} position: relative;">
            <div class="journey-icon${i===0?'-box':''}" style="background: ${escapeAttr(row.bg)}; color: ${escapeAttr(row.color)}; width: ${i===0?'44px':'40px'}; height: ${i===0?'44px':'40px'}; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: ${i===0?'18px':'16px'}; flex-shrink: 0;"><i class="fas ${escapeAttr(row.icon)}"></i></div>
            <div class="journey-content" style="flex: 1;">
                <div class="journey-label" style="display: flex; justify-content: space-between; margin-bottom: ${i===0?'10px':'8px'};">
                    ${i === 0 ? `
                        <div style="display: flex; flex-direction: column;">
                            <span style="font: var(--font-card-title); color: var(--fellow-text-main);">${escapeProfileHtml(row.label)}</span>
                            <span style="font: var(--font-caption); color: var(--fellow-text-muted);">${escapeProfileHtml(row.caption)}</span>
                        </div>
                        <span style="font: var(--font-caption); color: #f53f7c; font-weight: 800;">${row.percent}%</span>
                    ` : `
                        <div>
                            <h5 style="margin: 0 0 4px 0; font-size: 13px; color: var(--fellow-text-main);">${escapeProfileHtml(row.label)}</h5>
                            <p style="margin: 0; font-size: 11px; color: var(--fellow-text-muted);">${escapeProfileHtml(row.caption)}</p>
                        </div>
                        <b style="font-size: 13px; color: var(--fellow-text-main);">${row.percent}%</b>
                    `}
                </div>
                ${i === 0 ? `
                <div class="journey-bar-bg" style="height: 6px; background: #f8f9fa; border-radius: 10px; overflow: hidden;"><div class="journey-bar-fill" style="width: ${row.percent}%; height: 100%; background: #f53f7c; border-radius: 10px;"></div></div>
                ` : `
                <div style="height: 6px; background: #f0f0f0; border-radius: 4px; overflow: hidden;"><div style="height: 100%; width: ${row.percent}%; background: ${escapeAttr(row.bg)}; border-radius: 4px;"></div></div>
                `}
            </div>
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
        { title: 'Python for AI Beginner', notes: 'Modul 3 dari 10', percent: 80, url: '#/curriculum', bg: '#fff5f8', border: '#fce7f3', circleBg: '#f53f7c', circleColor: 'white', circleBorder: 'none', image: '/assets/modules/python-for-ai.png' },
        { title: 'Machine Learning Fundamentals', notes: 'Modul 6 dari 12', percent: 50, url: '#/curriculum', bg: '#f5f3ff', border: '#ede9fe', circleBg: 'transparent', circleColor: '#8b5cf6', circleBorder: '3px solid #e5e7eb', btColor: '#8b5cf6', brColor: '#8b5cf6', image: '/assets/modules/machine-learning.png' },
        { title: 'Data Analysis with Pandas', notes: 'Modul 2 dari 8', percent: 30, url: '#/curriculum', bg: '#fff7ed', border: '#ffedd5', circleBg: 'transparent', circleColor: '#f97316', circleBorder: '3px solid #e5e7eb', btColor: '#f97316', brColor: 'transparent', image: '/assets/modules/data-analysis.png' }
    ];
    container.innerHTML = rows.map((item, index) => {
        let styleStr = '';
        if (item.circleBg === 'transparent') {
            styleStr = `border: ${item.circleBorder} !important; border-top-color: ${item.btColor} !important;`;
            if (item.brColor !== 'transparent') styleStr += ` border-right-color: ${item.brColor} !important;`;
            styleStr += ` box-sizing: border-box;`;
        } else {
            styleStr = `border: none !important;`;
        }
        return `
        <div class="card-course" onclick="location.hash='${escapeAttr(item.url || '#/curriculum')}'" style="cursor:pointer; background: ${escapeAttr(item.bg)} !important; border: 1px solid ${escapeAttr(item.border)} !important; border-radius: 16px; padding: 20px !important; display: flex !important; flex-direction: column !important; align-items: flex-start !important; text-align: left !important; position: relative; min-height: 200px;">
            <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: auto;">
                <div class="card-course-icon" style="width: 64px; height: 64px; margin: 0; background: transparent; overflow: hidden; border-radius: 12px;">
                    <img src="${escapeAttr(item.image || moduleImage(index, item))}" alt="" style="width: 100%; height: 100%; object-fit: cover; transform: scale(1.35);">
                </div>
                <div class="card-course-progress-circle" style="width: 40px !important; height: 40px !important; background: ${item.circleBg} !important; color: ${item.circleColor} !important; font-size: 12px !important; font-weight: 800 !important; display: flex !important; align-items: center !important; justify-content: center !important; border-radius: 50% !important; flex-shrink: 0; ${styleStr}">${Number(item.percent || [80, 50, 30][index] || 20)}%</div>
            </div>
            <div class="card-course-info" style="width: 100% !important; text-align: left !important; margin-top: 20px;">
                <h4 style="font-size: 14px !important; margin-bottom: 6px !important; line-height: 1.3 !important; color: #1f2937 !important; font-weight: 700;">${escapeProfileHtml(item.title || item.name || `Modul ${index + 1}`).replace(' ', '<br>')}</h4>
                <p style="font-size: 11px !important; color: #6b7280 !important; margin: 0;">${escapeProfileHtml(item.notes || item.description || 'Materi pembelajaran')}</p>
            </div>
        </div>
    `;}).join('') + `
        <div class="card-course" onclick="location.hash='#/curriculum'" style="background: transparent !important; border: 1px dashed #fbcfe8 !important; border-radius: 16px; padding: 20px !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; text-align: center !important; cursor: pointer; min-height: 200px; box-sizing: border-box;">
            <div class="card-course-icon" style="background: transparent !important; color: #f53f7c !important; width: 44px !important; height: 44px !important; border-radius: 50% !important; border: 1px dashed #fbcfe8 !important; margin-bottom: 12px !important; display: flex !important; align-items: center !important; justify-content: center !important; flex-shrink: 0;"><i class="fas fa-plus" style="font-size: 16px;"></i></div>
            <div class="card-course-info" style="width: 100% !important; text-align: center !important;">
                <h4 style="font-size: 14px !important; margin-bottom: 6px !important; color: #1f2937 !important; font-weight: 700;">Pilih Modul<br>Lainnya</h4>
                <p style="font-size: 11px !important; color: #6b7280 !important; margin: 0;">Jelajahi semua modul</p>
            </div>
        </div>
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
    container.innerHTML = rows.map((item, index) => {
        const titleStr = item.title || item.name || 'Event HerAI';
        const displayTitle = titleStr.length > 30 ? titleStr.substring(0, 30) + '...' : titleStr;
        return `
        <div class="event-item" style="display: flex; gap: 16px; align-items: center; ${index < rows.length-1 ? 'padding-bottom: 16px; border-bottom: 1px solid var(--fellow-border);' : ''}">
            <div class="event-date" style="background: #ffeef4; color: #f53f7c; padding: 10px; border-radius: 12px; text-align: center; min-width: 54px; flex-shrink: 0;">
                <b style="display: block; font-size: 18px; line-height: 1;">${escapeProfileHtml(item.date || String(22 + index * 3))}</b>
                <small style="font-size: 10px; font-weight: 700;">${escapeProfileHtml(item.month || 'MEI')}</small>
            </div>
            <div class="event-info" style="flex: 1;">
                <h5 style="font: var(--font-card-title); font-size: 13px; margin: 0 0 4px 0; color: var(--fellow-text-main);">${escapeProfileHtml(displayTitle)}</h5>
                <p style="font: var(--font-caption); color: var(--fellow-text-muted); margin: 0;">${escapeProfileHtml(item.notes || item.description || 'Jadwal menyusul')}</p>
            </div>
            <a href="${escapeAttr(item.url || '#/meeting')}" style="padding: 6px 14px; border: 1px solid #f53f7c; color: #f53f7c; background: white; border-radius: 8px; font-size: 12px; font-weight: 700; text-decoration: none;">Gabung</a>
        </div>
    `}).join('');
}

function renderParticipantCommunity() {
    const container = document.getElementById('participantCommunityList');
    if (!container) return;
    const rows = [
        ['Mentor Rani', 'membagikan materi baru di room', '#Machine Learning', '2 jam yang lalu', 'MR'],
        ['Siti Aulia', 'menyelesaikan tugas', '"Data Preprocessing"', '3 jam yang lalu', 'SA'],
        ['Dewi Lestari', 'bergabung di chat room', '#Python', '5 jam yang lalu', 'DL']
    ];
    container.innerHTML = rows.map(([name, action, highlight, time, init]) => `
        <div class="activity-item" style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #ffeef4; color: #f53f7c; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0;">${init}</div>
            <div style="flex: 1; line-height: 1.4;">
                <p style="font: var(--font-body); margin: 0; font-size: 12px; color: #374151;"><b>${escapeProfileHtml(name)}</b> ${escapeProfileHtml(action)} <b>${escapeProfileHtml(highlight)}</b></p>
                <small style="font: var(--font-caption); color: #9ca3af; font-size: 11px;">${escapeProfileHtml(time)}</small>
            </div>
        </div>
    `).join('');
}

function renderParticipantLeaderboard(profile) {
    const container = document.getElementById('participantLeaderboardList');
    if (!container) return;
    const name = profile.nama_lengkap || 'Aisyah Putri';
    const initName = getInitials(name);
    const rows = [[1, 'Dewi Lestari', '2.450 Poin', '#f59e0b', false, 'DL'], [2, `${name} (Kamu)`, '2.120 Poin', '#cbd5e1', true, initName], [3, 'Siti Aulia', '1.890 Poin', '#b45309', false, 'SA']];
    container.innerHTML = rows.map(([rank, person, points, medalColor, active, init]) => `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <b style="font-size: 16px; color: var(--fellow-text-main); width: 16px;">${rank}</b>
                <div style="width: 32px; height: 32px; border-radius: 50%; background: #ffeef4; color: #f53f7c; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">${init}</div>
                <span style="font: var(--font-body); font-size: 13px; font-weight: 700; color: var(--fellow-text-main);">${escapeProfileHtml(person.length > 20 ? person.substring(0,20)+'...' : person)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <small style="color: var(--fellow-text-muted); font-size: 11px;">${escapeProfileHtml(points)}</small>
                <i class="fas fa-medal" style="color: ${medalColor}; font-size: 16px;"></i>
            </div>
        </div>
    `).join('');
}

function renderParticipantTracks() {
    const container = document.getElementById('participantTrackList');
    if (!container) return;
    const rows = [
        ['Computer Vision', 'Pelajari AI untuk memahami visual', 'fa-eye', '#ffeef4', '#f53f7c'],
        ['Natural Language Processing', 'Pahami bahasa manusia dengan AI', 'fa-comment-dots', '#f3e8ff', '#8b5cf6'],
        ['Speech AI', 'Bangun aplikasi berbasis suara', 'fa-microphone-alt', '#eff6ff', '#3b82f6'],
        ['AI Infrastructure', 'Pelajari sistem dan deploy AI', 'fa-shield-alt', '#ecfdf5', '#10b981'],
        ['Bioinformatics', 'Kombinasikan AI dan biologi', 'fa-dna', '#fff7ed', '#f97316'],
        ['Multimodal AI', 'Gabungkan berbagai jenis data', 'fa-id-badge', '#fef9c3', '#eab308']
    ];
    container.innerHTML = rows.map(([title, caption, icon, bg, color]) => `
        <div class="track-card" onclick="location.hash='#/curriculum'" style="cursor: pointer; background: transparent; border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; align-items: flex-start; min-width: 120px;">
            <div class="track-icon" style="background: ${escapeAttr(bg)}; color: ${escapeAttr(color)}; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; margin-bottom: 12px;"><i class="fas ${escapeAttr(icon)}"></i></div>
            <h5 style="font-size: 13px; margin: 0 0 6px 0; color: #1f2937; line-height: 1.3; font-weight: 700;">${escapeProfileHtml(title)}</h5>
            <p style="font-size: 11px; color: #6b7280; margin: 0; line-height: 1.4;">${escapeProfileHtml(caption)}</p>
        </div>
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
    'participant-events': renderFellowEventsPage,
    'participant-mentor': renderFellowMentorPage,
    'participant-community': renderFellowCommunityPage,
    'participant-certificate': renderFellowCertificatePage,
    'participant-leaderboard': renderFellowLeaderboardPage,
    'participant-profile': renderFellowMyProfilePage
,
    'participant-help': renderFellowHelpPage,
    'participant-settings': renderFellowSettingsPage};

function renderFellowMentorPage() {
    return `
        <div class="fellow-mentor-page">
            <div class="mentor-actions">
                <select class="mentor-select">
                    <option>Semua Keahlian</option>
                    <option>Machine Learning</option>
                    <option>UI/UX Design</option>
                </select>
                <select class="mentor-select">
                    <option>Rekomendasi</option>
                    <option>Terbaru</option>
                </select>
            </div>
            
            <div class="mentor-layout">
                <div class="mentor-list">
                    <div class="mentor-card">
                        <div class="mentor-avatar pink">AP</div>
                        <div class="mentor-info">
                            <div class="mentor-header">
                                <div>
                                    <h3 class="mentor-name">Dr. Alya Putri</h3>
                                    <span class="mentor-role">Senior Data Scientist di TechCorp</span>
                                </div>
                            </div>
                            <p class="mentor-desc">Ahli di bidang Machine Learning, Natural Language Processing, dan AI Research.</p>
                            <div class="mentor-badges">
                                <span class="m-badge pink">Machine Learning</span>
                                <span class="m-badge green">Career Prep</span>
                            </div>
                        </div>
                        <div class="mentor-btns">
                            <button class="btn-schedule">Jadwalkan Sesi</button>
                            <button class="btn-profile">Lihat Profil</button>
                        </div>
                    </div>
                    
                    <div class="mentor-card">
                        <div class="mentor-avatar orange">SJ</div>
                        <div class="mentor-info">
                            <div class="mentor-header">
                                <div>
                                    <h3 class="mentor-name">Sarah Jenkins</h3>
                                    <span class="mentor-role">UI/UX Designer di Creativ AI</span>
                                </div>
                            </div>
                            <p class="mentor-desc">Membantu fellow merancang antarmuka pengguna untuk aplikasi AI yang intuitif.</p>
                            <div class="mentor-badges">
                                <span class="m-badge orange">UI/UX</span>
                                <span class="m-badge blue">Product Design</span>
                            </div>
                        </div>
                        <div class="mentor-btns">
                            <button class="btn-schedule">Jadwalkan Sesi</button>
                            <button class="btn-profile">Lihat Profil</button>
                        </div>
                    </div>
                    
                    <div class="mentor-card">
                        <div class="mentor-avatar purple">BS</div>
                        <div class="mentor-info">
                            <div class="mentor-header">
                                <div>
                                    <h3 class="mentor-name">Budi Santoso</h3>
                                    <span class="mentor-role">Lead AI Engineer di StartupX</span>
                                </div>
                            </div>
                            <p class="mentor-desc">Expertise dalam deployment model AI ke sistem cloud (AWS/GCP).</p>
                            <div class="mentor-badges">
                                <span class="m-badge purple">AI Engineering</span>
                                <span class="m-badge blue">Cloud Computing</span>
                            </div>
                        </div>
                        <div class="mentor-btns">
                            <button class="btn-schedule">Jadwalkan Sesi</button>
                            <button class="btn-profile">Lihat Profil</button>
                        </div>
                    </div>
                </div>
                
                <aside class="mentor-side">
                    <div class="ms-card">
                        <h3>Sesi Mendatang</h3>
                        <div class="ms-session-list">
                            <div class="ms-session">
                                <div class="ms-session-num">1</div>
                                <span class="ms-session-text">Mentoring dengan Dr. Alya<br>(20 Juni, 15:00 WIB)</span>
                                <i class="fas fa-chevron-right"></i>
                            </div>
                            <div class="ms-session">
                                <div class="ms-session-num">2</div>
                                <span class="ms-session-text">Review CV dengan Sarah<br>(25 Juni, 10:00 WIB)</span>
                                <i class="fas fa-chevron-right"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="ms-card">
                        <h3>Mau jadi Mentor?</h3>
                        <img src="/assets/referensi/trophy-illustration.png" alt="Trophy" class="ms-hero-art" onerror="this.src='/assets/placeholder.png'">
                        <p class="ms-hero-desc">Bagikan ilmumu dan bantu kembangkan talenta AI.</p>
                        <button class="btn-solid-pink">Daftar Sekarang</button>
                    </div>
                </aside>
            </div>
        </div>
    `;
}

function renderFellowCertificatePage() {
    return `
        <div class="dash-wrapper-override">
<!-- FASE 2: Tabs Sertifikat -->
<div class="sert-tabs-container">
<div class="sert-tabs">
<button class="s-tab-btn active">Semua Sertifikat</button>
<button class="s-tab-btn">Pencapaian Modul</button>
<button class="s-tab-btn">Event &amp; Workshop</button>
<button class="s-tab-btn">Proyek</button>
<button class="s-tab-btn">Komunitas</button>
</div>
</div>
<div class="dash-grid" style="grid-template-columns: 1fr 300px; gap: 30px; align-items: start; margin-top: 24px;">
<div class="dash-left-col">
<!-- FASE 2: Stats Cards -->
<div class="sert-stats">
<div class="sert-stat-card">
<div class="ss-icon bg-pink"><i class="fas fa-award"></i></div>
<div class="ss-info">
<span class="ss-label">Total Sertifikat</span>
<span class="ss-value">12</span>
<span class="ss-desc">Sertifikat</span>
</div>
</div>
<div class="sert-stat-card">
<div class="ss-icon bg-green"><i class="far fa-check-circle"></i></div>
<div class="ss-info">
<span class="ss-label">Sertifikat Terselesaikan</span>
<span class="ss-value">10</span>
<span class="ss-desc">Sertifikat</span>
</div>
</div>
<div class="sert-stat-card">
<div class="ss-icon bg-orange"><i class="far fa-clock"></i></div>
<div class="ss-info">
<span class="ss-label">Sedang Diproses</span>
<span class="ss-value">2</span>
<span class="ss-desc">Sertifikat</span>
</div>
</div>
<div class="sert-stat-card">
<div class="ss-icon bg-purple"><i class="fas fa-trophy"></i></div>
<div class="ss-info">
<span class="ss-label">Total Poin dari Sertifikat</span>
<span class="ss-value">1.250</span>
<span class="ss-desc">Poin</span>
</div>
</div>
</div>
<!-- FASE 3: Filter & Pencarian Sertifikat -->
<div class="sert-filter-row">
<div class="sf-dropdown">
<span>Terbaru</span> <i class="fas fa-chevron-down"></i>
</div>
<div class="sf-right">
<div class="sf-search">
<i class="fas fa-search"></i>
<input placeholder="Cari sertifikat..." type="text"/>
</div>
<button class="sf-view-btn active"><i class="fas fa-th-large"></i></button>
</div>
</div>
<!-- FASE 4: Grid Sertifikat -->
<div class="sert-grid">
<!-- Card 1: Pink -->
<div class="s-card">
<div class="sc-image-wrapper">
<div class="sc-badge-corner bg-pink"><i class="fas fa-ribbon"></i></div>
<div class="sc-cert-visual">
<div class="sc-cert-title text-pink">SERTIFIKAT</div>
<div class="sc-cert-subtitle">DIBERIKAN KEPADA</div>
<div class="sc-cert-name">Aisyah Putri</div>
<div class="sc-cert-desc">atas pencapaian dalam menyelesaikan</div>
<div class="sc-cert-course">Python for AI Beginner</div>
<div class="sc-cert-footer">
<div class="sc-cert-sign">HerAI Team</div>
<div class="sc-cert-seal bg-pink"><i class="fas fa-star"></i></div>
<div class="sc-cert-date">Mei 2024</div>
</div>
</div>
</div>
<div class="sc-body">
<h4>Python for AI Beginner</h4>
<div class="sc-meta">Modul • Foundation Phase</div>
<div class="sc-footer">
<span class="sc-date">25 Mei 2024</span>
<span class="sc-points text-pink"><i class="far fa-star"></i> 100 Poin</span>
</div>
</div>
</div>
<!-- Card 2: Purple -->
<div class="s-card">
<div class="sc-image-wrapper">
<div class="sc-badge-corner bg-purple"><i class="fas fa-medal"></i></div>
<div class="sc-cert-visual">
<div class="sc-cert-title text-purple">SERTIFIKAT</div>
<div class="sc-cert-subtitle">DIBERIKAN KEPADA</div>
<div class="sc-cert-name">Aisyah Putri</div>
<div class="sc-cert-desc">atas pencapaian dalam menyelesaikan</div>
<div class="sc-cert-course">Machine Learning Fundamentals</div>
<div class="sc-cert-footer">
<div class="sc-cert-sign">HerAI Team</div>
<div class="sc-cert-seal bg-purple"><i class="fas fa-star"></i></div>
<div class="sc-cert-date">Juni 2024</div>
</div>
</div>
</div>
<div class="sc-body">
<h4>Machine Learning Fundamentals</h4>
<div class="sc-meta">Modul • Foundation Phase</div>
<div class="sc-footer">
<span class="sc-date">15 Juni 2024</span>
<span class="sc-points text-purple"><i class="far fa-star"></i> 150 Poin</span>
</div>
</div>
</div>
<!-- Card 3: Orange -->
<div class="s-card">
<div class="sc-image-wrapper">
<div class="sc-badge-corner bg-orange"><i class="far fa-calendar-alt"></i></div>
<div class="sc-cert-visual">
<div class="sc-cert-title text-orange">SERTIFIKAT</div>
<div class="sc-cert-subtitle">DIBERIKAN KEPADA</div>
<div class="sc-cert-name">Aisyah Putri</div>
<div class="sc-cert-desc">atas partisipasi sebagai peserta</div>
<div class="sc-cert-course">Data Visualization with Python Workshop</div>
<div class="sc-cert-footer">
<div class="sc-cert-sign">HerAI Team</div>
<div class="sc-cert-seal bg-orange"><i class="fas fa-star"></i></div>
<div class="sc-cert-date">Mei 2024</div>
</div>
</div>
</div>
<div class="sc-body">
<h4>Data Visualization with Python</h4>
<div class="sc-meta">Event • Workshop</div>
<div class="sc-footer">
<span class="sc-date">25 Mei 2024</span>
<span class="sc-points text-orange"><i class="far fa-star"></i> 75 Poin</span>
</div>
</div>
</div>
<!-- Card 4: Green -->
<div class="s-card">
<div class="sc-image-wrapper">
<div class="sc-badge-corner bg-green"><i class="fas fa-desktop"></i></div>
<div class="sc-cert-visual">
<div class="sc-cert-title text-green">SERTIFIKAT</div>
<div class="sc-cert-subtitle">DIBERIKAN KEPADA</div>
<div class="sc-cert-name">Aisyah Putri</div>
<div class="sc-cert-desc">atas pencapaian dalam menyelesaikan</div>
<div class="sc-cert-course">Data Analysis with Pandas</div>
<div class="sc-cert-footer">
<div class="sc-cert-sign">HerAI Team</div>
<div class="sc-cert-seal bg-green"><i class="fas fa-star"></i></div>
<div class="sc-cert-date">Juni 2024</div>
</div>
</div>
</div>
<div class="sc-body">
<h4>Data Analysis with Pandas</h4>
<div class="sc-meta">Modul • Foundation Phase</div>
<div class="sc-footer">
<span class="sc-date">10 Juni 2024</span>
<span class="sc-points text-green"><i class="far fa-star"></i> 125 Poin</span>
</div>
</div>
</div>
<!-- Card 5: Blue (using primary or custom blue) -->
<div class="s-card">
<div class="sc-image-wrapper">
<div class="sc-badge-corner bg-blue"><i class="fas fa-trophy"></i></div>
<div class="sc-cert-visual">
<div class="sc-cert-title text-blue">SERTIFIKAT</div>
<div class="sc-cert-subtitle">DIBERIKAN KEPADA</div>
<div class="sc-cert-name">Aisyah Putri</div>
<div class="sc-cert-desc">atas partisipasi sebagai peserta</div>
<div class="sc-cert-course">AI for Social Good Hackathon</div>
<div class="sc-cert-footer">
<div class="sc-cert-sign">HerAI Team</div>
<div class="sc-cert-seal bg-blue"><i class="fas fa-star"></i></div>
<div class="sc-cert-date">Juni 2024</div>
</div>
</div>
</div>
<div class="sc-body">
<h4>AI for Social Good Hackathon</h4>
<div class="sc-meta">Event • Hackathon</div>
<div class="sc-footer">
<span class="sc-date">8 Juni 2024</span>
<span class="sc-points text-blue"><i class="far fa-star"></i> 200 Poin</span>
</div>
</div>
</div>
<!-- Card 6: Pink (Komunitas) -->
<div class="s-card">
<div class="sc-image-wrapper">
<div class="sc-badge-corner bg-pink-dark"><i class="fas fa-users"></i></div>
<div class="sc-cert-visual">
<div class="sc-cert-title text-pink-dark">SERTIFIKAT</div>
<div class="sc-cert-subtitle">DIBERIKAN KEPADA</div>
<div class="sc-cert-name">Aisyah Putri</div>
<div class="sc-cert-desc">atas kontribusinya sebagai</div>
<div class="sc-cert-course">Top Contributor Komunitas</div>
<div class="sc-cert-footer">
<div class="sc-cert-sign">HerAI Team</div>
<div class="sc-cert-seal bg-pink-dark"><i class="fas fa-star"></i></div>
<div class="sc-cert-date">Mei 2024</div>
</div>
</div>
</div>
<div class="sc-body">
<h4>Top Contributor Komunitas</h4>
<div class="sc-meta">Komunitas • Pencapaian</div>
<div class="sc-footer">
<span class="sc-date">18 Mei 2024</span>
<span class="sc-points text-pink-dark"><i class="far fa-star"></i> 50 Poin</span>
</div>
</div>
</div>
</div>
</div>
<div class="dash-right-col">
<!-- FASE 5 & 6: Widget Sidebar Kanan -->
<div class="sert-widgets">
<!-- Widget 1: Ringkasan Pencapaian -->
<div class="sert-widget">
<h4 class="sw-title">Ringkasan Pencapaian</h4>
<div class="sw-chart-container">
<div class="donut-chart">
<div class="donut-inner">
<b>12</b>
<small>Total</small>
</div>
</div>
<div class="chart-legend">
<div class="legend-item"><span class="lg-dot bg-pink"></span> <span class="lg-text">Modul</span> <span class="lg-val">7</span></div>
<div class="legend-item"><span class="lg-dot bg-purple"></span> <span class="lg-text">Event</span> <span class="lg-val">3</span></div>
<div class="legend-item"><span class="lg-dot bg-orange"></span> <span class="lg-text">Proyek</span> <span class="lg-val">1</span></div>
<div class="legend-item"><span class="lg-dot bg-green"></span> <span class="lg-text">Komunitas</span> <span class="lg-val">1</span></div>
</div>
</div>
</div>
<!-- Widget 2: Filter Sertifikat -->
<div class="sert-widget">
<div class="sw-header">
<h4 class="sw-title">Filter Sertifikat</h4>
<a class="sw-link" href="#">Reset</a>
</div>
<div class="sw-filters">
<div class="sw-select"><span>Semua Kategori</span> <i class="fas fa-chevron-down"></i></div>
<div class="sw-select"><span>Semua Sumber</span> <i class="fas fa-chevron-down"></i></div>
<div class="sw-select"><span>Semua Status</span> <i class="fas fa-chevron-down"></i></div>
<div class="sw-select"><span>Semua Tahun</span> <i class="fas fa-chevron-down"></i></div>
</div>
</div>
<!-- Widget 3: Status Sertifikat -->
<div class="sert-widget">
<h4 class="sw-title">Status Sertifikat</h4>
<div class="sw-status-list">
<div class="sw-status-item">
<div class="ssi-left"><i class="far fa-check-circle text-green"></i> Terselesaikan</div>
<div class="ssi-right">10</div>
</div>
<div class="sw-status-item">
<div class="ssi-left"><i class="far fa-clock text-orange"></i> Sedang Diproses</div>
<div class="ssi-right">2</div>
</div>
<div class="sw-status-item">
<div class="ssi-left"><i class="far fa-calendar-times text-pink"></i> Akan Kedaluwarsa</div>
<div class="ssi-right">0</div>
</div>
<div class="sw-status-item">
<div class="ssi-left"><i class="fas fa-history text-gray"></i> Kedaluwarsa</div>
<div class="ssi-right">0</div>
</div>
</div>
</div>
<!-- Widget 4: Butuh Bantuan -->
<div class="sw-help-card">
<div class="sw-help-content">
<h4>Butuh Bantuan?</h4>
<p>Punya pertanyaan tentang sertifikatmu? Hubungi HerAI Assistant sekarang!</p>
<button>Chat Sekarang</button>
</div>
<i class="fas fa-robot sw-help-icon"></i>
</div>
</div>
</div>
</div>
        </div>
    `;
}

function renderFellowCourse(c) {
    return `
        <div class="fellow-course-item">
            <span><i class="fas ${c[6]}"></i></span>
            <div>
                <h4>${c[1]}</h4>
                <p>${c[2]}</p>
            </div>
            <div class="fellow-course-status">
                <span class="is-${c[5]}">${c[4]}</span>
                <div class="fellow-course-progress">
                    <b><i style="width:${c[3]}%"></i></b>
                    <small>${c[3]}%</small>
                </div>
            </div>
        </div>
    `;
}

function renderFellowCertCard(title, subtitle, date, points, color, icon) {
    return `
        <div class="fcert-card">
            <div class="fcert-img-wrapper">
                <div class="fcert-img is-${color}">
                    <div class="fcert-badge is-${color}"><i class="fas ${icon}"></i></div>
                    <h4>SERTIFIKAT</h4>
                    <small>DIBERIKAN KEPADA</small>
                    <strong>Aisyah Putri</strong>
                    <p class="fcert-context">atas pencapaian dalam menyelesaikan</p>
                    <p class="fcert-course">${title}</p>
                    <div class="fcert-signatures">
                        <div>
                            <img src="/assets/referensi/signature-faiz.png" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 20\\'><path d=\\'M10,15 Q30,5 50,15 T90,15\\' fill=\\'none\\' stroke=\\'%2394A3B8\\' stroke-width=\\'2\\'/></svg>'">
                            <span>HerAI Team</span>
                        </div>
                        <div>
                            <img src="/assets/referensi/signature-mentor.png" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 20\\'><path d=\\'M10,10 Q40,20 60,10 T90,10\\' fill=\\'none\\' stroke=\\'%2394A3B8\\' stroke-width=\\'2\\'/></svg>'">
                            <span>${date.split(' ').slice(1).join(' ')}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="fcert-info">
                <h5>${title}</h5>
                <p>${subtitle}</p>
                <div class="fcert-footer">
                    <span>${date}</span>
                    <strong class="is-${color}"><i class="far fa-star"></i> ${points} Poin</strong>
                </div>
            </div>
        </div>
    `;
}

function renderFellowLeaderboardPage() {
    return `
        <div class="dash-wrapper-override">
<div class="dash-grid" style="grid-template-columns: 1fr 340px; gap: 30px; align-items: start; margin-top: 24px;">
<div class="dash-left-col">
<!-- FASE 2: Banner & Tabs -->
<div class="lb-banner">
<div class="lbb-content">
<h3>Terus belajar, terus bertumbuh!</h3>
<p>Setiap poin mencerminkan usaha dan dedikasimu. Pertahankan posisimu di leaderboard atau kejar puncaknya! <i class="fas fa-sparkles" style="color:#f59e0b"></i></p>
<button class="lbb-btn">Pelajari Cara Mendapat Poin <i class="fas fa-arrow-right"></i></button>
</div>
<div class="lbb-ill">
<!-- Trophy CSS Art / Icon -->
<i class="fas fa-trophy" style="font-size: 110px; color: #fbbf24; filter: drop-shadow(0 10px 15px rgba(251,191,36,0.5));"></i>
</div>
</div>
<div class="lb-tabs-container">
<nav class="lb-tabs">
<a class="lbt-link active" href="#">Leaderboard Global</a>
<a class="lbt-link" href="#">Leaderboard Mingguan</a>
<a class="lbt-link" href="#">Leaderboard Bulanan</a>
<a class="lbt-link" href="#">Leaderboard All Time</a>
</nav>
</div>
<!-- FASE 3: Tabel Peringkat -->
<div class="lb-filters">
<div class="lb-select">
<select>
<option>Semua Kategori</option>
<option>Data Science</option>
<option>Machine Learning</option>
</select>
<i class="fas fa-chevron-down"></i>
</div>
<div class="lb-select">
<i class="far fa-calendar-alt" style="margin-right: 8px; color: #8f9bba;"></i>
<select>
<option>Minggu Ini</option>
<option>Bulan Ini</option>
</select>
<i class="fas fa-chevron-down"></i>
</div>
</div>
<div class="lb-table-wrapper">
<table class="lb-table">
<thead>
<tr>
<th width="50">#</th>
<th>Fellow</th>
<th style="text-align: right;">Poin</th>
<th style="text-align: right;">Minggu Ini</th>
<th style="text-align: center;" width="80">Badge</th>
</tr>
</thead>
<tbody>
<!-- Rank 1 -->
<tr>
<td><i class="fas fa-crown text-gold" style="font-size:18px;"></i> 1</td>
<td>
<div class="lbt-user">
<img alt="Dewi Lestari" src="https://ui-avatars.com/api/?name=Dewi+Lestari&amp;background=FF1493&amp;color=fff"/>
<div class="lbt-user-info">
<b>Dewi Lestari</b>
<small>@dewilestari</small>
</div>
</div>
</td>
<td style="text-align: right;"><b class="text-pink">2.450</b></td>
<td style="text-align: right;"><span class="text-green"><i class="fas fa-arrow-up"></i> 450</span></td>
<td style="text-align: center;"><div class="lbt-badge hex-orange"><i class="fas fa-medal"></i></div></td>
</tr>
<!-- Rank 2 (Kamu) -->
<tr class="lbt-highlight">
<td><i class="fas fa-crown text-silver" style="font-size:18px;"></i> 2</td>
<td>
<div class="lbt-user">
<img alt="Aisyah Putri" src="https://ui-avatars.com/api/?name=Aisyah+Putri&amp;background=FF1493&amp;color=fff"/>
<div class="lbt-user-info">
<b class="text-pink">Aisyah Putri (Kamu)</b>
<small class="text-pink">@aisyahputri</small>
</div>
</div>
</td>
<td style="text-align: right;"><b class="text-pink">2.120</b></td>
<td style="text-align: right;"><span class="text-green"><i class="fas fa-arrow-up"></i> 320</span></td>
<td style="text-align: center;"><div class="lbt-badge hex-gray"><i class="fas fa-medal"></i></div></td>
</tr>
<!-- Rank 3 -->
<tr>
<td><i class="fas fa-crown text-bronze" style="font-size:18px;"></i> 3</td>
<td>
<div class="lbt-user">
<img alt="Siti Aulia" src="https://ui-avatars.com/api/?name=Siti+Aulia&amp;background=FF1493&amp;color=fff"/>
<div class="lbt-user-info">
<b>Siti Aulia</b>
<small>@sitiaulia</small>
</div>
</div>
</td>
<td style="text-align: right;"><b class="text-pink">1.890</b></td>
<td style="text-align: right;"><span class="text-green"><i class="fas fa-arrow-up"></i> 280</span></td>
<td style="text-align: center;"><div class="lbt-badge hex-orange"><i class="fas fa-medal"></i></div></td>
</tr>
<!-- Rank 4 -->
<tr>
<td><b>4</b></td>
<td>
<div class="lbt-user">
<img alt="Rani Mentari" src="/assets/referensi/persona-her-ai.png"/>
<div class="lbt-user-info">
<b>Rani Mentari</b>
<small>@ranimentari</small>
</div>
</div>
</td>
<td style="text-align: right;"><b class="text-pink">1.450</b></td>
<td style="text-align: right;"><span class="text-green"><i class="fas fa-arrow-up"></i> 210</span></td>
<td style="text-align: center;"><div class="lbt-badge hex-pink-dark"><i class="fas fa-star"></i></div></td>
</tr>
<!-- Rank 5 -->
<tr>
<td><b>5</b></td>
<td>
<div class="lbt-user">
<img alt="Nadia Putri" src="/assets/referensi/persona-her-ai.png"/>
<div class="lbt-user-info">
<b>Nadia Putri</b>
<small>@nadiaputri</small>
</div>
</div>
</td>
<td style="text-align: right;"><b class="text-pink">1.230</b></td>
<td style="text-align: right;"><span class="text-green"><i class="fas fa-arrow-up"></i> 180</span></td>
<td style="text-align: center;"><div class="lbt-badge hex-pink-dark"><i class="fas fa-star"></i></div></td>
</tr>
<!-- Rank 6 -->
<tr>
<td><b>6</b></td>
<td>
<div class="lbt-user">
<img alt="Putri Ananda" src="/assets/referensi/persona-her-ai.png"/>
<div class="lbt-user-info">
<b>Putri Ananda</b>
<small>@putriananda</small>
</div>
</div>
</td>
<td style="text-align: right;"><b class="text-pink">1.120</b></td>
<td style="text-align: right;"><span class="text-green"><i class="fas fa-arrow-up"></i> 160</span></td>
<td style="text-align: center;"><div class="lbt-badge hex-pink-dark"><i class="fas fa-star"></i></div></td>
</tr>
<!-- Rank 7 -->
<tr>
<td><b>7</b></td>
<td>
<div class="lbt-user">
<img alt="Larasati Dewi" src="/assets/referensi/persona-her-ai.png"/>
<div class="lbt-user-info">
<b>Larasati Dewi</b>
<small>@larasatidewi</small>
</div>
</div>
</td>
<td style="text-align: right;"><b class="text-pink">980</b></td>
<td style="text-align: right;"><span class="text-green"><i class="fas fa-arrow-up"></i> 120</span></td>
<td style="text-align: center;"><div class="lbt-badge hex-pink-dark"><i class="fas fa-star"></i></div></td>
</tr>
<!-- Rank 8 -->
<tr>
<td><b>8</b></td>
<td>
<div class="lbt-user">
<img alt="Maya Pratiwi" src="/assets/referensi/persona-her-ai.png"/>
<div class="lbt-user-info">
<b>Maya Pratiwi</b>
<small>@mayapratiwi</small>
</div>
</div>
</td>
<td style="text-align: right;"><b class="text-pink">860</b></td>
<td style="text-align: right;"><span class="text-green"><i class="fas fa-arrow-up"></i> 110</span></td>
<td style="text-align: center;"><div class="lbt-badge hex-pink-dark"><i class="fas fa-star"></i></div></td>
</tr>
</tbody>
</table>
<div class="lb-view-more">
<a class="text-pink" href="#">Lihat Selengkapnya <i class="fas fa-chevron-down"></i></a>
</div>
</div>
</div>
<div class="dash-right-col">
<!-- FASE 4 & 5: Widget Kanan -->
<div class="lb-widgets">
<!-- Ringkasan Saya -->
<div class="lb-widget">
<h4 class="lb-widget-title">Ringkasan Saya</h4>
<div class="lb-summary-grid">
<div class="lb-summary-item">
<div class="lb-summary-icon bg-pink-light"><i class="fas fa-chess-queen text-pink"></i></div>
<div class="lb-summary-info">
<small>Peringkat</small>
<b class="text-pink">2</b>
<span>dari 1.250 Fellow</span>
</div>
</div>
<div class="lb-summary-item" style="border-left: 1px solid #f0f0f0; padding-left: 16px;">
<div class="lb-summary-icon bg-orange-light"><i class="fas fa-star text-orange"></i></div>
<div class="lb-summary-info">
<small>Total Poin</small>
<b class="text-orange">2.120 <span style="font-size: 13px; font-weight: 500; color: #1a0b2e;">Poin</span></b>
<span><i class="fas fa-arrow-up text-green"></i> 320 poin dari minggu lalu</span>
</div>
</div>
</div>
<div class="lb-summary-progress">
<div class="lbs-prog-top">
<small>Menuju Peringkat 1</small>
<small>2.120 / 2.450</small>
</div>
<div class="lbs-prog-bar">
<div class="lbs-prog-fill" style="width: 86%;"></div>
</div>
<small class="lbs-prog-hint">Anda hanya perlu 330 poin lagi!</small>
</div>
</div>
<!-- Cara Mendapat Poin -->
<div class="lb-widget">
<div class="lb-widget-header">
<h4 class="lb-widget-title">Cara Mendapat Poin</h4>
<a class="lb-widget-link" href="#">Lihat Semua <i class="fas fa-arrow-right"></i></a>
</div>
<div class="lb-action-list">
<div class="lb-action-item">
<div class="lb-action-icon bg-pink-light text-pink"><i class="fas fa-book-open"></i></div>
<div class="lb-action-info">
<b>Menyelesaikan Modul</b>
<small>+100 poin</small>
</div>
</div>
<div class="lb-action-item">
<div class="lb-action-icon bg-purple-light text-purple"><i class="fas fa-clipboard-check"></i></div>
<div class="lb-action-info">
<b>Menyelesaikan Tugas</b>
<small>+150 poin</small>
</div>
</div>
<div class="lb-action-item">
<div class="lb-action-icon bg-orange-light text-orange"><i class="fas fa-folder-open"></i></div>
<div class="lb-action-info">
<b>Menyelesaikan Proyek</b>
<small>+200 poin</small>
</div>
</div>
<div class="lb-action-item">
<div class="lb-action-icon bg-green-light text-green"><i class="fas fa-calendar-alt"></i></div>
<div class="lb-action-info">
<b>Mengikuti Event / Workshop</b>
<small>+50 poin</small>
</div>
</div>
<div class="lb-action-item">
<div class="lb-action-icon bg-blue-light text-blue"><i class="fas fa-users"></i></div>
<div class="lb-action-info">
<b>Aktif di Komunitas</b>
<small>+20 poin</small>
</div>
</div>
</div>
</div>
<!-- Pencapaian Terbaru -->
<div class="lb-widget">
<div class="lb-widget-header">
<h4 class="lb-widget-title">Pencapaian Terbaru</h4>
<a class="lb-widget-link" href="#">Lihat Semua <i class="fas fa-arrow-right"></i></a>
</div>
<div class="lb-achieve-list">
<div class="lb-achieve-item">
<div class="lba-icon"><div class="pac-hex-wrap hex-pink-dark" style="transform: scale(0.65);"><div class="pac-hex"><i class="fas fa-star"></i></div></div></div>
<div class="lba-info">
<b>Rising Star</b>
<small>Masuk 3 besar leaderboard mingguan</small>
<span>Diraih 20 Mei 2024</span>
</div>
</div>
<div class="lb-achieve-item">
<div class="lba-icon"><div class="pac-hex-wrap hex-purple" style="transform: scale(0.65);"><div class="pac-hex"><i class="fas fa-fire"></i></div></div></div>
<div class="lba-info">
<b>Consistent Learner</b>
<small>Belajar 7 hari berturut-turut</small>
<span>Diraih 18 Mei 2024</span>
</div>
</div>
<div class="lb-achieve-item">
<div class="lba-icon"><div class="pac-hex-wrap hex-orange" style="transform: scale(0.65);"><div class="pac-hex"><i class="fas fa-medal"></i></div></div></div>
<div class="lba-info">
<b>Task Master</b>
<small>Menyelesaikan 10 tugas</small>
<span>Diraih 15 Mei 2024</span>
</div>
</div>
</div>
</div>
</div>
</div>
</div>
        </div>
    `;
}

function renderFellowMyProfilePage() {
    return `
            <div class="dash-grid" style="grid-template-columns: 1fr 300px; gap: 30px; align-items: start; margin-top: 32px;">
                <div class="dash-left-col">
                    <!-- FASE 2: Hero Profil Utama -->
                    <div class="p-hero">
                        <div class="ph-bg"></div>
                        <div class="ph-content">
                            <div class="ph-avatar-box">
                                <img src="/assets/referensi/persona-her-ai.png" alt="Aisyah Putri" class="ph-avatar">
                                <button class="ph-cam-btn"><i class="fas fa-camera"></i></button>
                            </div>
                            <div class="ph-info">
                                <div class="phi-top">
                                    <div class="phi-name">
                                        <h2>Aisyah Putri</h2>
                                        <span class="phi-badge">Fellow</span>
                                    </div>
                                    <button class="phi-edit-btn"><i class="fas fa-pencil-alt"></i> Edit Profil</button>
                                </div>
                                <div class="phi-tagline">AI Enthusiast & Lifelong Learner <i class="fas fa-sparkles" style="color: #f59e0b; margin-left: 4px;"></i></div>
                                <div class="phi-meta">
                                    <span><i class="fas fa-map-marker-alt"></i> Jakarta, Indonesia</span>
                                    <span><i class="far fa-envelope"></i> aisyah.putri@example.com</span>
                                    <span><i class="far fa-calendar-alt"></i> Bergabung sejak April 2024</span>
                                </div>
                                <div class="phi-skills">
                                    <span class="ps-tag">Machine Learning</span>
                                    <span class="ps-tag">NLP</span>
                                    <span class="ps-tag">Python</span>
                                    <span class="ps-tag">Data Analysis</span>
                                    <span class="ps-tag ps-add"><i class="fas fa-plus"></i></span>
                                </div>
                            </div>
                        </div>
                        <div class="ph-quote">
                            <i class="fas fa-quote-left"></i>
                            <p>Berlearning AI bukan hanya tentang teknologi,<br>tapi tentang berdampak untuk masa depan.</p>
                            <div class="phq-deco">
                                <i class="fas fa-sparkles phq-spark"></i>
                                <i class="fas fa-heart phq-heart"></i>
                            </div>
                        </div>
                    </div>

                    <!-- FASE 3: Tabs Profil -->
                    <div class="p-tabs-container">
                        <nav class="p-tabs">
                            <a href="#" class="pt-link active">Ringkasan</a>
                            <a href="#" class="pt-link">Perjalanan Belajar</a>
                            <a href="#" class="pt-link">Proyek</a>
                            <a href="#" class="pt-link">Sertifikat</a>
                            <a href="#" class="pt-link">Aktivitas</a>
                            <a href="#" class="pt-link">Pengaturan Akun</a>
                        </nav>
                    </div>

                    <!-- FASE 4: Tentang Saya & Statistik -->
                    <div class="p-summary-grid">
                        <!-- Tentang Saya -->
                        <div class="p-box p-about">
                            <div class="pb-header">
                                <div class="pb-title">
                                    <i class="far fa-user text-pink"></i> <h3>Tentang Saya</h3>
                                </div>
                                <button class="pb-edit-btn">Edit</button>
                            </div>
                            <p class="pa-bio">Saya seorang mahasiswa Informatika yang sangat tertarik dengan Artificial Intelligence. Saya bergabung di HerAI Fellowship untuk memperdalam ilmu AI, berkolaborasi dengan teman-teman hebat, dan membangun proyek yang bermanfaat.</p>
                            
                            <ul class="pa-details">
                                <li>
                                    <div class="pad-icon"><i class="fas fa-university"></i> Universitas</div>
                                    <div class="pad-val">Universitas Indonesia</div>
                                </li>
                                <li>
                                    <div class="pad-icon"><i class="fas fa-book-open"></i> Jurusan</div>
                                    <div class="pad-val">Informatika</div>
                                </li>
                                <li>
                                    <div class="pad-icon"><i class="fas fa-graduation-cap"></i> Tingkat</div>
                                    <div class="pad-val">Mahasiswa S1</div>
                                </li>
                                <li>
                                    <div class="pad-icon"><i class="fab fa-linkedin"></i> LinkedIn</div>
                                    <div class="pad-val"><a href="#" class="text-pink">linkedin.com/in/aisyahputri <i class="fas fa-external-link-alt"></i></a></div>
                                </li>
                            </ul>
                        </div>

                        <!-- Statistik -->
                        <div class="p-box p-stats">
                            <div class="pb-title">
                                <i class="fas fa-chart-bar text-purple"></i> <h3>Statistik</h3>
                            </div>
                            <div class="ps-grid">
                                <div class="ps-card">
                                    <i class="far fa-file-alt text-pink"></i>
                                    <div>
                                        <small>Modul Selesai</small>
                                        <b>18</b>
                                        <span>dari 25 modul</span>
                                    </div>
                                </div>
                                <div class="ps-card">
                                    <i class="fas fa-clipboard-check text-pink"></i>
                                    <div>
                                        <small>Tugas Selesai</small>
                                        <b>12</b>
                                        <span>dari 18 tugas</span>
                                    </div>
                                </div>
                                <div class="ps-card">
                                    <i class="fas fa-graduation-cap text-pink"></i>
                                    <div>
                                        <small>Proyek</small>
                                        <b>2</b>
                                        <span>proyek dibuat</span>
                                    </div>
                                </div>
                                <div class="ps-card">
                                    <i class="far fa-clock text-pink"></i>
                                    <div>
                                        <small>Jam Belajar</small>
                                        <b>48</b>
                                        <span>jam total</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="ps-track">
                                <div class="pst-icon"><i class="fas fa-layer-group text-pink"></i></div>
                                <div class="pst-info">
                                    <small>Specialization Track</small>
                                    <b>Machine Learning</b>
                                </div>
                                <button class="pst-btn">Lihat Detail</button>
                            </div>
                        </div>
                    </div>

                    <!-- Pencapaian (Hexagons) -->
                    <div class="p-box p-achievements">
                        <div class="pb-header">
                            <div class="pb-title">
                                <i class="fas fa-trophy text-pink"></i> <h3>Pencapaian</h3>
                            </div>
                            <a href="#" class="pb-link text-pink">Lihat Semua</a>
                        </div>
                        <div class="pac-list">
                            <!-- Hex 1 -->
                            <div class="pac-item">
                                <div class="pac-hex-wrap hex-pink">
                                    <div class="pac-hex"><i class="fas fa-rocket"></i></div>
                                </div>
                                <b>Welcome Aboard</b>
                                <small>Bergabung di HerAI</small>
                            </div>
                            <!-- Hex 2 -->
                            <div class="pac-item">
                                <div class="pac-hex-wrap hex-orange">
                                    <div class="pac-hex"><i class="fas fa-book-open"></i></div>
                                </div>
                                <b>First Steps</b>
                                <small>Selesaikan 5 modul</small>
                            </div>
                            <!-- Hex 3 -->
                            <div class="pac-item">
                                <div class="pac-hex-wrap hex-red">
                                    <div class="pac-hex"><i class="fas fa-fire"></i></div>
                                </div>
                                <b>Consistent Learner</b>
                                <small>Belajar 7 hr berturut</small>
                            </div>
                            <!-- Hex 4 -->
                            <div class="pac-item">
                                <div class="pac-hex-wrap hex-pink-dark">
                                    <div class="pac-hex"><i class="fas fa-clipboard-check"></i></div>
                                </div>
                                <b>Task Master</b>
                                <small>Selesaikan 10 tugas</small>
                            </div>
                            <!-- Hex 5 -->
                            <div class="pac-item">
                                <div class="pac-hex-wrap hex-purple">
                                    <div class="pac-hex"><i class="fas fa-code"></i></div>
                                </div>
                                <b>Project Starter</b>
                                <small>Buat proyek pertama</small>
                            </div>
                            <!-- Hex 6 Locked -->
                            <div class="pac-item pac-locked">
                                <div class="pac-hex-wrap hex-gray">
                                    <div class="pac-hex"><i class="fas fa-lock"></i></div>
                                </div>
                                <b>AI Explorer</b>
                                <small>Selesaikan 20 modul</small>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="dash-right-col">
                    <!-- FASE 5 & 6: Widget Kanan -->
                    <div class="p-widgets">
                        <!-- Widget 1: Perjalanan Fellowship -->
                        <div class="p-widget">
                            <div class="pw-header">
                                <h4 class="pw-title">Perjalanan Fellowship</h4>
                                <a href="#" class="pb-link text-pink">Lihat Detail ></a>
                            </div>
                            <div class="pw-journey">
                                <!-- Step 1 -->
                                <div class="pwj-item">
                                    <div class="pwj-icon bg-pink"><i class="fas fa-book-open"></i></div>
                                    <div class="pwj-info">
                                        <div class="pwj-top">
                                            <b>Foundation Phase</b>
                                            <span>80%</span>
                                        </div>
                                        <small>Pemahaman dasar AI</small>
                                        <div class="pwj-bar"><div class="pwj-fill bg-pink" style="width: 80%;"></div></div>
                                    </div>
                                </div>
                                <!-- Step 2 -->
                                <div class="pwj-item">
                                    <div class="pwj-icon bg-purple"><i class="fas fa-code"></i></div>
                                    <div class="pwj-info">
                                        <div class="pwj-top">
                                            <b>Specialization</b>
                                            <span>35%</span>
                                        </div>
                                        <small>Pilih & dalami track AI</small>
                                        <div class="pwj-bar"><div class="pwj-fill bg-purple" style="width: 35%;"></div></div>
                                    </div>
                                </div>
                                <!-- Step 3 -->
                                <div class="pwj-item">
                                    <div class="pwj-icon bg-orange"><i class="fas fa-camera"></i></div>
                                    <div class="pwj-info">
                                        <div class="pwj-top">
                                            <b>Project Building</b>
                                            <span>20%</span>
                                        </div>
                                        <small>Bangun proyek nyata</small>
                                        <div class="pwj-bar"><div class="pwj-fill bg-orange" style="width: 20%;"></div></div>
                                    </div>
                                </div>
                                <!-- Step 4 -->
                                <div class="pwj-item">
                                    <div class="pwj-icon bg-green"><i class="fas fa-graduation-cap"></i></div>
                                    <div class="pwj-info">
                                        <div class="pwj-top">
                                            <b>Graduation</b>
                                            <span>0%</span>
                                        </div>
                                        <small>Persiapan karier & sertifikasi</small>
                                        <div class="pwj-bar"><div class="pwj-fill bg-green" style="width: 0%;"></div></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Widget 2: Badge Saya -->
                        <div class="p-widget">
                            <div class="pw-header">
                                <h4 class="pw-title">Badge Saya</h4>
                                <a href="#" class="pb-link text-pink">Lihat Semua ></a>
                            </div>
                            <div class="pwb-list">
                                <div class="pwb-item border-pink"><div class="pwb-inner bg-pink-grad"><i class="fas fa-rocket"></i></div></div>
                                <div class="pwb-item border-purple"><div class="pwb-inner bg-purple-grad"><i class="fas fa-book-open"></i></div></div>
                                <div class="pwb-item border-orange"><div class="pwb-inner bg-orange-grad"><i class="fas fa-fire"></i></div></div>
                                <div class="pwb-item border-pink-dark"><div class="pwb-inner bg-pink-dark-grad"><i class="fas fa-clipboard-check"></i></div></div>
                                <div class="pwb-more">+6</div>
                            </div>
                        </div>

                        <!-- Widget 3: Aktivitas Terbaru -->
                        <div class="p-widget">
                            <div class="pw-header">
                                <h4 class="pw-title">Aktivitas Terbaru</h4>
                                <a href="#" class="pb-link text-pink">Lihat Semua ></a>
                            </div>
                            <div class="pwa-timeline">
                                <!-- Activity 1 -->
                                <div class="pwa-item">
                                    <div class="pwa-icon bg-pink-light text-pink"><i class="fas fa-book-open"></i></div>
                                    <div class="pwa-info">
                                        <small>Menyelesaikan modul</small>
                                        <b>"Linear Regression"</b>
                                        <span class="pwa-time">2 jam yang lalu</span>
                                    </div>
                                </div>
                                <!-- Activity 2 -->
                                <div class="pwa-item">
                                    <div class="pwa-icon bg-purple-light text-purple"><i class="fas fa-clipboard-check"></i></div>
                                    <div class="pwa-info">
                                        <small>Mengumpulkan tugas</small>
                                        <b>"Data Preprocessing"</b>
                                        <span class="pwa-time">Kemarin</span>
                                    </div>
                                </div>
                                <!-- Activity 3 -->
                                <div class="pwa-item">
                                    <div class="pwa-icon bg-blue-light text-blue"><i class="fas fa-comment-dots"></i></div>
                                    <div class="pwa-info">
                                        <small>Bergabung di chat room</small>
                                        <b>"Machine Learning"</b>
                                        <span class="pwa-time">2 hari yang lalu</span>
                                    </div>
                                </div>
                                <!-- Activity 4 -->
                                <div class="pwa-item">
                                    <div class="pwa-icon bg-orange-light text-orange"><i class="fas fa-code"></i></div>
                                    <div class="pwa-info">
                                        <small>Membuat proyek baru</small>
                                        <b>"Movie Recommendation"</b>
                                        <span class="pwa-time">3 hari yang lalu</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        

    `;
}

function renderFellowCommunityPage() {
    return `
        <div class="dash-wrapper-override">
<!-- FASE 2: Tabs Komunitas -->
<div class="komunitas-tabs-container">
<div class="komunitas-tabs">
<button class="k-tab-btn active">Untukmu</button>
<button class="k-tab-btn">Grup</button>
<button class="k-tab-btn">Diskusi</button>
<button class="k-tab-btn">Mentor Corner</button>
<button class="k-tab-btn">Pengumuman</button>
</div>
</div>
<div class="dash-grid" style="grid-template-columns: 1fr 300px; gap: 30px; align-items: start; margin-top: 32px;">
<div class="dash-left-col">
<!-- FASE 3: Hero Banner -->
<div class="kom-hero">
<div class="kom-hero-content">
<h3>Bergabung dan tumbuh<br/>bersama komunitas AI wanita<br/>terbesar di Indonesia!</h3>
<p>Temukan teman, mentor, dan peluang baru.</p>
<button class="btn-buat-postingan">Buat Postingan <i class="fas fa-edit"></i></button>
</div>
<div class="kom-hero-ill">
<div class="ill-circle ill-circle-1"><i class="fas fa-heart"></i></div>
<div class="ill-circle ill-circle-2"><i class="fas fa-user-friends"></i></div>
<img alt="Komunitas HerAI" class="ill-main" src="/assets/referensi/persona2.png"/>
</div>
</div>
<!-- FASE 4: Grup Populer -->
<div class="kom-section">
<div class="kom-section-header">
<h4>Grup Populer</h4>
<a href="#">Lihat Semua <i class="fas fa-arrow-right"></i></a>
</div>
<div class="kom-groups-grid">
<!-- Card 1 -->
<div class="k-group-card">
<div class="kg-icon bg-pink"><i class="fas fa-code"></i></div>
<h5>AI &amp; Machine Learning Indonesia</h5>
<span class="kg-members">12.4K anggota</span>
<p>Diskusi seputar AI, ML, dan perkembangannya di Indonesia.</p>
<button class="btn-bergabung txt-pink">Bergabung</button>
</div>
<!-- Card 2 -->
<div class="k-group-card">
<div class="kg-icon bg-purple"><i class="fas fa-rocket"></i></div>
<h5>Data Scientist Community</h5>
<span class="kg-members">8.7K anggota</span>
<p>Belajar dan berbagi seputar data science, analisis, dan visualisasi.</p>
<button class="btn-bergabung txt-purple">Bergabung</button>
</div>
<!-- Card 3 -->
<div class="k-group-card">
<div class="kg-icon bg-orange"><i class="fas fa-brain"></i></div>
<h5>NLP Enthusiast</h5>
<span class="kg-members">6.1K anggota</span>
<p>Membahas Natural Language Processing dan aplikasinya.</p>
<button class="btn-bergabung txt-orange">Bergabung</button>
</div>
<!-- Card 4 -->
<div class="k-group-card">
<div class="kg-icon bg-green"><i class="fas fa-address-card"></i></div>
<h5>Project Collaborators</h5>
<span class="kg-members">5.3K anggota</span>
<p>Cari partner untuk mengerjakan proyek AI bersama.</p>
<button class="btn-bergabung txt-green">Bergabung</button>
</div>
<!-- Card 5 (Action) -->
<div class="k-group-card k-group-action">
<div class="kg-icon bg-light"><i class="fas fa-plus"></i></div>
<h5>Lihat Semua Grup</h5>
<span class="kg-members" style="opacity:0;">-</span>
<p>Temukan lebih banyak grup yang sesuai denganmu.</p>
<button class="btn-bergabung txt-pink">Jelajahi</button>
</div>
</div>
</div>
<!-- FASE 5: Diskusi Terbaru -->
<div class="kom-section">
<div class="kom-section-header">
<h4>Diskusi Terbaru</h4>
<div class="kom-filters">
<button class="k-filter-btn active">Terbaru</button>
<button class="k-filter-btn">Populer</button>
<button class="k-filter-btn">Mengikuti</button>
</div>
</div>
<div class="kom-discussions">
<!-- Diskusi 1 -->
<div class="k-discussion-item">
<img alt="Siti Aulia" class="kd-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 24 24\' fill=\'%23ddd\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'12\'/%3E%3C/svg%3E'" src="https://ui-avatars.com/api/?name=Siti+Aulia&amp;background=FF1493&amp;color=fff"/>
<div class="kd-content">
<div class="kd-title-row">
<a class="kd-title" href="#">Tips belajar Python untuk pemula di bidang AI</a>
<span class="kd-badge bg-pink">Pemula</span>
</div>
<div class="kd-meta">
<b class="text-pink">Siti Aulia</b> • 2 jam yang lalu
                                    </div>
</div>
<div class="kd-actions">
<div class="kd-action"><i class="far fa-comment-dots"></i> 24</div>
<div class="kd-action"><i class="far fa-heart"></i> 128</div>
<button class="kd-btn-icon"><i class="far fa-bookmark"></i></button>
<button class="kd-btn-icon"><i class="fas fa-ellipsis-h"></i></button>
</div>
</div>
<!-- Diskusi 2 -->
<div class="k-discussion-item">
<img alt="Dewi Lestari" class="kd-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 24 24\' fill=\'%23ddd\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'12\'/%3E%3C/svg%3E'" src="https://ui-avatars.com/api/?name=Dewi+Lestari&amp;background=FF1493&amp;color=fff"/>
<div class="kd-content">
<div class="kd-title-row">
<a class="kd-title" href="#">Rekomendasi dataset untuk project NLP</a>
<span class="kd-badge bg-purple">NLP</span>
</div>
<div class="kd-meta">
<b class="text-dark">Dewi Lestari</b> • 5 jam yang lalu
                                    </div>
</div>
<div class="kd-actions">
<div class="kd-action"><i class="far fa-comment-dots"></i> 18</div>
<div class="kd-action"><i class="far fa-heart"></i> 96</div>
<button class="kd-btn-icon"><i class="far fa-bookmark"></i></button>
<button class="kd-btn-icon"><i class="fas fa-ellipsis-h"></i></button>
</div>
</div>
<!-- Diskusi 3 -->
<div class="k-discussion-item">
<img alt="Rani Mentari" class="kd-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 24 24\' fill=\'%23ddd\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'12\'/%3E%3C/svg%3E'" src="https://ui-avatars.com/api/?name=Rani+Mentari&amp;background=FF1493&amp;color=fff"/>
<div class="kd-content">
<div class="kd-title-row">
<a class="kd-title" href="#">Pengalaman ikut AI Hackathon pertama kali 🚀</a>
<span class="kd-badge bg-green">Pengalaman</span>
</div>
<div class="kd-meta">
<b class="text-pink">Rani Mentari</b> • 1 hari yang lalu
                                    </div>
</div>
<div class="kd-actions">
<div class="kd-action"><i class="far fa-comment-dots"></i> 32</div>
<div class="kd-action"><i class="far fa-heart"></i> 156</div>
<button class="kd-btn-icon"><i class="far fa-bookmark"></i></button>
<button class="kd-btn-icon"><i class="fas fa-ellipsis-h"></i></button>
</div>
</div>
<!-- Diskusi 4 -->
<div class="k-discussion-item">
<img alt="Aisyah Putri" class="kd-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 24 24\' fill=\'%23ddd\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'12\'/%3E%3C/svg%3E'" src="https://ui-avatars.com/api/?name=Aisyah+Putri&amp;background=FF1493&amp;color=fff"/>
<div class="kd-content">
<div class="kd-title-row">
<a class="kd-title" href="#">Cara membangun portofolio AI yang menarik</a>
<span class="kd-badge bg-orange">Karier</span>
</div>
<div class="kd-meta">
<b class="text-pink">Aisyah Putri</b> • 2 hari yang lalu
                                    </div>
</div>
<div class="kd-actions">
<div class="kd-action"><i class="far fa-comment-dots"></i> 27</div>
<div class="kd-action"><i class="far fa-heart"></i> 134</div>
<button class="kd-btn-icon"><i class="far fa-bookmark"></i></button>
<button class="kd-btn-icon"><i class="fas fa-ellipsis-h"></i></button>
</div>
</div>
</div>
<div style="text-align: center; margin-top: 16px;">
<a class="kd-lihat-semua" href="#">Lihat Semua Diskusi <i class="fas fa-arrow-right"></i></a>
</div>
</div>
</div>
<div class="dash-right-col">
<!-- FASE 6: Widget Sidebar Kanan -->
<div class="kom-widgets">
<!-- Widget 1: Top Kontributor -->
<div class="kom-widget">
<div class="widget-header">
<h4>Top Kontributor</h4>
<a href="#">Lihat Semua <i class="fas fa-arrow-right"></i></a>
</div>
<div class="top-contributors">
<div class="tc-item">
<div class="tc-rank">1</div>
<img alt="Dewi Lestari" class="tc-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'32\\' viewBox=\\'0 0 24 24\\' fill=\\'%23ddd\\'%3E%3Ccircle cx=\\'12\\' cy=\\'12\\' r=\\'12\\'/%3E%3C/svg%3E'" src="/assets/referensi/11profil.png"/>
<div class="tc-info">
<b>Dewi Lestari</b>
<small>@dewilestari</small>
</div>
<div class="tc-score">
                                        2,450 poin <i class="fas fa-medal" style="color: #f59e0b;"></i>
</div>
</div>
<div class="tc-item tc-highlight">
<div class="tc-rank">2</div>
<img alt="Aisyah Putri" class="tc-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'32\\' viewBox=\\'0 0 24 24\\' fill=\\'%23ddd\\'%3E%3Ccircle cx=\\'12\\' cy=\\'12\\' r=\\'12\\'/%3E%3C/svg%3E'" src="/assets/referensi/persona2.png"/>
<div class="tc-info">
<b class="text-pink">Aisyah Putri (Kamu)</b>
<small>@aisyahputri</small>
</div>
<div class="tc-score">
                                        2,120 poin <i class="fas fa-medal" style="color: #9ca3af;"></i>
</div>
</div>
<div class="tc-item">
<div class="tc-rank">3</div>
<img alt="Siti Aulia" class="tc-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'32\\' viewBox=\\'0 0 24 24\\' fill=\\'%23ddd\\'%3E%3Ccircle cx=\\'12\\' cy=\\'12\\' r=\\'12\\'/%3E%3C/svg%3E'" src="/assets/referensi/persona-her-ai.png"/>
<div class="tc-info">
<b>Siti Aulia</b>
<small>@sitiaulia</small>
</div>
<div class="tc-score">
                                        1,890 poin <i class="fas fa-medal" style="color: #d97706;"></i>
</div>
</div>
<div class="tc-item">
<div class="tc-rank">4</div>
<img alt="Rani Mentari" class="tc-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'32\\' viewBox=\\'0 0 24 24\\' fill=\\'%23ddd\\'%3E%3Ccircle cx=\\'12\\' cy=\\'12\\' r=\\'12\\'/%3E%3C/svg%3E'" src="/assets/referensi/11profil.png"/>
<div class="tc-info">
<b>Rani Mentari</b>
<small>@ranimentari</small>
</div>
<div class="tc-score">
                                        1,450 poin <i class="fas fa-ellipsis-v" style="color: #cbd5e1; margin-left:4px;"></i>
</div>
</div>
<div class="tc-item">
<div class="tc-rank">5</div>
<img alt="Nadia Putri" class="tc-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'32\\' viewBox=\\'0 0 24 24\\' fill=\\'%23ddd\\'%3E%3Ccircle cx=\\'12\\' cy=\\'12\\' r=\\'12\\'/%3E%3C/svg%3E'" src="/assets/referensi/persona2.png"/>
<div class="tc-info">
<b>Nadia Putri</b>
<small>@nadiaputri</small>
</div>
<div class="tc-score">
                                        1,230 poin <i class="fas fa-ellipsis-v" style="color: #cbd5e1; margin-left:4px;"></i>
</div>
</div>
</div>
</div>
<!-- Widget 2: Upcoming Events -->
<div class="kom-widget">
<div class="widget-header">
<h4>Upcoming Community Events</h4>
<a href="#">Lihat Semua <i class="fas fa-arrow-right"></i></a>
</div>
<div class="upcoming-events">
<div class="ue-item">
<div class="ue-date">
<span class="ue-day">24</span>
<span class="ue-month">MEI</span>
</div>
<div class="ue-info">
<b>Community Study: LangChain untuk Pemula</b>
<small>Sab, 24 Mei 2024 • 10.00 WIB</small>
</div>
<button class="btn-gabung">Gabung</button>
</div>
<div class="ue-item">
<div class="ue-date">
<span class="ue-day">31</span>
<span class="ue-month">MEI</span>
</div>
<div class="ue-info">
<b>Data Talk: Tren AI 2024</b>
<small>Sab, 31 Mei 2024 • 13.00 WIB</small>
</div>
<button class="btn-gabung">Gabung</button>
</div>
<div class="ue-item">
<div class="ue-date">
<span class="ue-day">7</span>
<span class="ue-month">JUN</span>
</div>
<div class="ue-info">
<b>AI Project Showcase</b>
<small>Jum, 7 Juni 2024 • 19.00 WIB</small>
</div>
<button class="btn-gabung">Gabung</button>
</div>
</div>
</div>
<!-- Widget 3: Topik Populer -->
<div class="kom-widget">
<div class="widget-header">
<h4>Topik Populer</h4>
<a href="#">Lihat Semua <i class="fas fa-arrow-right"></i></a>
</div>
<div class="topik-grid">
<div class="topik-item">
<div class="topik-tag"><span class="txt-purple">#</span> MachineLearning</div>
<small>1.2K posts</small>
</div>
<div class="topik-item">
<div class="topik-tag"><span class="txt-purple">#</span> NLP</div>
<small>654 posts</small>
</div>
<div class="topik-item">
<div class="topik-tag"><span class="txt-purple">#</span> Python</div>
<small>980 posts</small>
</div>
<div class="topik-item">
<div class="topik-tag"><span class="txt-purple">#</span> AIProject</div>
<small>543 posts</small>
</div>
<div class="topik-item">
<div class="topik-tag"><span class="txt-purple">#</span> DataScience</div>
<small>876 posts</small>
</div>
</div>
</div>
</div>
</div>
</div>
        </div>
    `;
}

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
                    
                    <section class="fellow-side-card" style="padding: 24px;">
                        <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                            <h3 style="margin:0; font-size:16px; font-weight:800; color:#1E293B;">Jadwal Belajar</h3>
                            <a href="#" style="color:#F74281; font-size:12px; font-weight:700; text-decoration:none;">Lihat Kalender</a>
                        </header>
                        <div style="background:#FFF0F5; border-radius:12px; padding:24px; text-align:center; display:flex; flex-direction:column; align-items:center;">
                            <i class="far fa-calendar-alt" style="font-size:32px; color:#F74281; margin-bottom:16px;"></i>
                            <strong style="font-size:14px; color:#1E293B; margin-bottom:8px; display:block; font-weight:800;">Konsisten belajar adalah kunci!</strong>
                            <p style="font-size:12px; color:#64748B; margin:0 0 16px 0; line-height:1.5;">Kamu tidak memiliki jadwal hari ini. Yuk atur jadwal belajarmu!</p>
                            <button style="background:#F74281; color:#fff; border:none; border-radius:8px; padding:8px 24px; font-weight:700; font-size:13px; cursor:pointer; width:100%;">Atur Jadwal</button>
                        </div>
                    </section>

                    <section class="fellow-side-card" style="padding: 24px;">
                        <h3 style="margin:0 0 16px 0; font-size:16px; font-weight:800; color:#1E293B;">Sumber Belajar</h3>
                        <div style="display:flex; flex-direction:column; gap:12px;">
                            ${[
                                ['Reading Materials', 'fa-book-open'],
                                ['Cheat Sheet', 'fa-file-lines'],
                                ['Video Playlist', 'fa-circle-play'],
                                ['Practice Dataset', 'fa-database'],
                                ['AI Tools Directory', 'fa-cubes']
                            ].map(item => `
                                <a href="#" style="display:flex; align-items:center; gap:12px; text-decoration:none; color:#1E293B; padding:4px 0; border-radius:8px; transition:background 0.2s;">
                                    <div style="width:36px; height:36px; background:#F5F3FF; color:#8B5CF6; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                        <i class="fas ${item[1]}"></i>
                                    </div>
                                    <span style="font-size:13px; font-weight:600; flex:1;">${item[0]}</span>
                                    <i class="fas fa-chevron-right" style="color:#A0AEC0; font-size:12px;"></i>
                                </a>
                            `).join('')}
                        </div>
                    </section>

                    <section class="fellow-side-card" style="background:#FFF0F5; border: 1px solid #FFD6E8; border-radius:12px; padding:24px; position:relative; overflow:hidden;">
                        <h3 style="color:#F74281; margin:0 0 12px 0; font-size:16px; font-weight:800; position:relative; z-index:2;">Butuh Bantuan?</h3>
                        <p style="font-size:13px; color:#64748B; margin:0 0 20px 0; line-height:1.5; width:65%; position:relative; z-index:2;">Tanya apapun ke HerAI Assistant tentang modul yang kamu pelajari.</p>
                        <button style="background:#F74281; color:#fff; border:none; border-radius:8px; padding:10px 20px; font-weight:700; font-size:13px; cursor:pointer; position:relative; z-index:2;">Chat Sekarang</button>
                        <img src="${FELLOW_SECTION_ASSETS.moduleHelp}" style="position:absolute; right:-30px; bottom:-10px; width:160px; z-index:1;" alt="HerAI Assistant" onerror="this.style.display='none'">
                    </section>
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
        <div class="dash-wrapper-override">
<div class="dash-grid" style="grid-template-columns: 1fr 300px; gap: 30px; align-items: start; margin-top: 32px;">
<div class="dash-left-col">
<!-- FASE 3: Tabs & Filter -->
<div class="events-tabs-area">
<div class="events-tabs">
<button class="event-tab active">Semua Events</button>
<button class="event-tab">Webinar</button>
<button class="event-tab">Workshop</button>
<button class="event-tab">Mentor Session</button>
<button class="event-tab">Komunitas</button>
<button class="event-tab">Lomba</button>
<button class="event-tab">Career</button>
</div>
<div class="events-filters">
<div class="filter-group-left">
<button class="event-filter-btn">
<span>Semua Kategori</span> <i class="fas fa-chevron-down"></i>
</button>
<button class="event-filter-btn">
<i class="far fa-calendar"></i> <span>Tanggal</span>
</button>
<button class="event-filter-btn">
<span>Format</span> <i class="fas fa-chevron-down"></i>
</button>
<button class="event-filter-btn">
<span>Online &amp; Offline</span> <i class="fas fa-chevron-down"></i>
</button>
</div>
<div class="filter-group-right">
<button class="event-filter-btn">
<span>Terbaru</span> <i class="fas fa-chevron-down"></i>
</button>
</div>
</div>
</div>
<!-- FASE 4: List Event -->
<div class="events-list-area">
<div class="events-list-header">
<h3 class="events-list-title">Event Mendatang <span class="events-badge">5</span></h3>
<a class="events-link-all" href="#">Lihat Semua <i class="fas fa-arrow-right"></i></a>
</div>
<div class="events-cards">
<!-- Card 1 -->
<div class="event-card">
<div class="event-card-img" style="background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%);">
<div class="event-card-placeholder-icon"><i class="fas fa-robot"></i></div>
</div>
<div class="event-card-body">
<span class="event-category badge-webinar">Webinar</span>
<h4 class="event-title">Build RAG Chatbot with LangChain</h4>
<p class="event-desc">Pelajari cara membangun chatbot cerdas dengan Retrieval Augmented Generation menggunakan LangChain.</p>
<div class="event-speaker">
<img alt="Dewi Lestari" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'32\\' viewBox=\\'0 0 24 24\\' fill=\\'%23ddd\\'%3E%3Ccircle cx=\\'12\\' cy=\\'12\\' r=\\'12\\'/%3E%3C/svg%3E'" src="/assets/referensi/persona-her-ai.png"/>
<div class="speaker-info">
<b>Dewi Lestari</b>
<small>AI Engineer at TechNova</small>
</div>
</div>
</div>
<div class="event-card-right">
<div class="event-date-box">
<span class="date-num">22</span>
<span class="date-month">MEI</span>
<span class="date-time">10.00 - 12.00 WIB</span>
<span class="date-type">Online</span>
</div>
<div class="event-action-box">
<button class="btn-daftar">Daftar</button>
<span class="registered-count"><b>120</b> peserta terdaftar</span>
<button class="btn-bookmark"><i class="far fa-bookmark"></i></button>
</div>
</div>
</div>
<!-- Card 2 -->
<div class="event-card">
<div class="event-card-img" style="background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);">
<div class="event-card-placeholder-icon"><i class="fas fa-code"></i></div>
</div>
<div class="event-card-body">
<span class="event-category badge-workshop">Workshop</span>
<h4 class="event-title">Data Visualization with Python</h4>
<p class="event-desc">Buat visualisasi data yang informatif dan menarik menggunakan Matplotlib, Seaborn, dan Plotly.</p>
<div class="event-speaker">
<img alt="Rizka Amelia" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'32\\' viewBox=\\'0 0 24 24\\' fill=\\'%23ddd\\'%3E%3Ccircle cx=\\'12\\' cy=\\'12\\' r=\\'12\\'/%3E%3C/svg%3E'" src="/assets/referensi/persona2.png"/>
<div class="speaker-info">
<b>Rizka Amelia</b>
<small>Data Scientist</small>
</div>
</div>
</div>
<div class="event-card-right">
<div class="event-date-box">
<span class="date-num">25</span>
<span class="date-month">MEI</span>
<span class="date-time">13.00 - 16.00 WIB</span>
<span class="date-type">Online</span>
</div>
<div class="event-action-box">
<button class="btn-daftar">Daftar</button>
<span class="registered-count"><b>86</b> peserta terdaftar</span>
<button class="btn-bookmark"><i class="far fa-bookmark"></i></button>
</div>
</div>
</div>
<!-- Card 3 -->
<div class="event-card">
<div class="event-card-img" style="background: linear-gradient(120deg, #f6d365 0%, #fda085 100%);">
<div class="event-card-placeholder-icon"><i class="fas fa-user-friends"></i></div>
</div>
<div class="event-card-body">
<span class="event-category badge-mentor">Mentor Session</span>
<h4 class="event-title">Career in AI: Ask Me Anything</h4>
<p class="event-desc">Sesi tanya jawab bersama mentor berpengalaman seputar karier di bidang AI/ML.</p>
<div class="event-speaker">
<img alt="Mentor Rani" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'32\\' viewBox=\\'0 0 24 24\\' fill=\\'%23ddd\\'%3E%3Ccircle cx=\\'12\\' cy=\\'12\\' r=\\'12\\'/%3E%3C/svg%3E'" src="/assets/referensi/persona-her-ai.png"/>
<div class="speaker-info">
<b>Mentor Rani</b>
<small>ML Lead at Inovasi AI</small>
</div>
</div>
</div>
<div class="event-card-right">
<div class="event-date-box">
<span class="date-num">30</span>
<span class="date-month">MEI</span>
<span class="date-time">19.00 - 20.30 WIB</span>
<span class="date-type">Online</span>
</div>
<div class="event-action-box">
<button class="btn-daftar">Daftar</button>
<span class="registered-count"><b>64</b> peserta terdaftar</span>
<button class="btn-bookmark"><i class="far fa-bookmark"></i></button>
</div>
</div>
</div>
<!-- Card 4 (Lomba) -->
<div class="event-card">
<div class="event-card-img" style="background: linear-gradient(to top, #0ba360 0%, #3cba92 100%);">
<div class="event-card-placeholder-icon"><i class="fas fa-trophy"></i></div>
</div>
<div class="event-card-body">
<span class="event-category badge-lomba">Lomba</span>
<h4 class="event-title">AI Project Challenge 2024</h4>
<p class="event-desc">Tunjukkan ide dan kreasimu! Kompetisi proyek AI untuk semua Fellow HerAI.</p>
<div class="event-speaker" style="opacity: 0;">
<div class="speaker-info"><b>-</b></div>
</div>
</div>
<div class="event-card-right">
<div class="event-date-box">
<span class="date-num">5</span>
<span class="date-month">JUN</span>
<span class="date-time">23.59 WIB</span>
<span class="date-type">Deadline Pengumpulan</span>
</div>
<div class="event-action-box">
<button class="btn-daftar btn-lomba">Ikut Lomba</button>
<span class="registered-count"><b>35</b> tim terdaftar</span>
<button class="btn-bookmark"><i class="far fa-bookmark"></i></button>
</div>
</div>
</div>
</div>
</div>
</div>
<div class="dash-right-col">
<!-- FASE 5: Widget Sidebar Kanan -->
<div class="events-widgets">
<!-- Widget 1: Kalender -->
<div class="events-widget">
<div class="widget-header">
<h4>Kalender Events</h4>
<a href="#">Lihat Kalender</a>
</div>
<div class="calendar-widget">
<div class="calendar-nav">
<button><i class="fas fa-chevron-left"></i></button>
<strong>Mei 2024</strong>
<button><i class="fas fa-chevron-right"></i></button>
</div>
<div class="calendar-grid">
<div class="cal-day-header">Min</div>
<div class="cal-day-header">Sen</div>
<div class="cal-day-header">Sel</div>
<div class="cal-day-header">Rab</div>
<div class="cal-day-header">Kam</div>
<div class="cal-day-header">Jum</div>
<div class="cal-day-header">Sab</div>
<div class="cal-day text-muted">28</div>
<div class="cal-day text-muted">29</div>
<div class="cal-day text-muted">30</div>
<div class="cal-day">1</div>
<div class="cal-day">2</div>
<div class="cal-day">3</div>
<div class="cal-day">4</div>
<div class="cal-day">5</div>
<div class="cal-day">6</div>
<div class="cal-day">7</div>
<div class="cal-day">8</div>
<div class="cal-day">9</div>
<div class="cal-day">10</div>
<div class="cal-day">11</div>
<div class="cal-day">12</div>
<div class="cal-day">13</div>
<div class="cal-day">14</div>
<div class="cal-day">15</div>
<div class="cal-day">16</div>
<div class="cal-day">17</div>
<div class="cal-day">18</div>
<div class="cal-day">19</div>
<div class="cal-day">20</div>
<div class="cal-day">21</div>
<div class="cal-day active-pink">22</div>
<div class="cal-day">23</div>
<div class="cal-day">24</div>
<div class="cal-day active-purple">25</div>
<div class="cal-day">26</div>
<div class="cal-day">27</div>
<div class="cal-day">28</div>
<div class="cal-day">29</div>
<div class="cal-day active-orange">30</div>
<div class="cal-day">31</div>
<div class="cal-day text-muted">1</div>
</div>
</div>
</div>
<!-- Widget 2: Event yang Kamu Ikuti -->
<div class="events-widget">
<div class="widget-header">
<h4>Event yang Kamu Ikuti</h4>
<a href="#">Lihat Semua</a>
</div>
<div class="joined-events-list">
<div class="joined-event-item">
<div class="je-icon bg-pink"><i class="fas fa-robot"></i></div>
<div class="je-info">
<b>Build RAG Chatbot with LangChain</b>
<small>22 Mei 2024, 10.00 WIB</small>
</div>
<span class="je-badge">Terdaftar</span>
</div>
<div class="joined-event-item">
<div class="je-icon bg-purple"><i class="fas fa-code"></i></div>
<div class="je-info">
<b>Data Visualization with Python</b>
<small>25 Mei 2024, 13.00 WIB</small>
</div>
<span class="je-badge">Terdaftar</span>
</div>
<div class="joined-event-item">
<div class="je-icon bg-orange"><i class="fas fa-user-friends"></i></div>
<div class="je-info">
<b>Career in AI: Ask Me Anything</b>
<small>30 Mei 2024, 19.00 WIB</small>
</div>
<span class="je-badge">Terdaftar</span>
</div>
</div>
</div>
<!-- Widget 3: Jangan Lewatkan! -->
<div class="events-widget">
<div class="widget-header">
<h4>Jangan Lewatkan!</h4>
<a href="#">Lihat Semua</a>
</div>
<div class="promo-card">
<div class="promo-img">
<!-- Use an inline SVG to mimic the hackathon banner visually since we don't have the exact image -->
<div style="width:100%;height:100%;background:linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%);display:flex;align-items:center;justify-content:center;color:white;font-size:40px;">
<i class="fas fa-rocket"></i>
</div>
</div>
<div class="promo-content">
<h5>AI for Social Good Hackathon</h5>
<p>Buat solusi AI untuk masalah sosial dan menangkan total hadiah jutaan rupiah!</p>
<div class="promo-footer">
<span>15 - 16 Juni 2024</span>
<button class="btn-promo">Lihat Detail</button>
</div>
</div>
</div>
</div>
</div>
</div>
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
    const statusTone = status === 'Selesai' ? 'green' : (status === 'Sedang Dikerjakan' ? 'orange' : (status === 'Review' ? 'pink' : 'muted'));
    return `<article class="fellow-project-row">
        <span class="is-${tone}"><i class="fas ${icon}"></i></span>
        <div class="fp-content">
            <div class="fp-header">
                <strong>${escapeProfileHtml(title)}</strong>
                <b class="fp-tag is-${tone}">${escapeProfileHtml(tag)}</b>
            </div>
            <p>${escapeProfileHtml(desc)}</p>
            <div class="fp-meta">
                <div class="fp-avatars">
                    <img src="/assets/referensi/persona-her-ai.png" alt="">
                    <img src="/assets/referensi/persona2.png" alt="">
                    <img src="/assets/referensi/persona-her-ai.png" alt="">
                    <span class="fp-avatar-more">+2</span>
                </div>
                <small>Diperbarui 2 hari yang lalu</small>
            </div>
        </div>
        <aside class="fp-actions">
            <div class="fp-status-row">
                <em class="fp-status is-${statusTone}">${escapeProfileHtml(status)}</em>
                <button class="fp-menu-btn"><i class="fas fa-ellipsis"></i></button>
            </div>
            <div class="fp-progress-row">
                <i class="fp-progress-bar"><b class="is-${tone}" style="width:${progress}"></b></i>
                <small>${escapeProfileHtml(progress)}</small>
            </div>
        </aside>
    </article>`;
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

function renderFellowHelpPage() {
    return `
        <div class="dash-wrapper-override">
<div class="faq-content-area" style="padding-top: 32px;">
<style>
                    .faq-grid-custom {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                        gap: 24px;
                    }
                    .faq-card-custom {
                        background: white;
                        border: 1px solid #f0f0f0;
                        border-radius: 16px;
                        padding: 24px;
                        transition: all 0.3s ease;
                        position: relative;
                        overflow: hidden;
                    }
                    .faq-card-custom:hover {
                        border-color: #fecfef;
                        box-shadow: 0 10px 30px rgba(245, 63, 124, 0.05);
                        transform: translateY(-2px);
                    }
                    .faq-card-custom::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 4px;
                        height: 100%;
                        background: #f53f7c;
                        opacity: 0;
                        transition: opacity 0.3s;
                    }
                    .faq-card-custom:hover::before {
                        opacity: 1;
                    }
                    .faq-num-custom {
                        font-size: 32px;
                        font-weight: 800;
                        color: #ffeef4;
                        position: absolute;
                        top: 16px;
                        right: 24px;
                        z-index: 0;
                    }
                    .faq-card-custom h4 {
                        font-size: 16px;
                        font-weight: 700;
                        color: #1a0b2e;
                        margin: 0 0 12px 0;
                        position: relative;
                        z-index: 1;
                    }
                    .faq-card-custom p {
                        font-size: 14px;
                        color: #6b7a90;
                        line-height: 1.6;
                        margin: 0;
                        position: relative;
                        z-index: 1;
                    }
                    .faq-contact-box {
                        background: linear-gradient(to right, #fff1f6, #fde7ee);
                        border-radius: 16px;
                        padding: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-top: 40px;
                    }
                    .faq-contact-text h3 {
                        font-size: 20px;
                        font-weight: 700;
                        color: #1a0b2e;
                        margin: 0 0 8px 0;
                    }
                    .faq-contact-text p {
                        color: #6b7a90;
                        font-size: 14px;
                        margin: 0;
                    }
                    .faq-contact-btn {
                        background: #f53f7c;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                    }
                </style>
<div class="faq-grid-custom">
<div class="faq-card-custom">
<div class="faq-num-custom">01</div>
<h4>Apakah program ini berbayar?</h4>
<p>Tidak. Program ini 100% Gratis bagi peserta yang lolos seleksi.</p>
</div>
<div class="faq-card-custom">
<div class="faq-num-custom">02</div>
<h4>Harus background IT?</h4>
<p>Tidak wajib, namun memiliki minat yang kuat dan komitmen tinggi sangat diutamakan.</p>
</div>
<div class="faq-card-custom">
<div class="faq-num-custom">03</div>
<h4>Apa itu Jalur Afirmasi 3T?</h4>
<p>Kuota khusus (30%) untuk pendaftar dari 122 kabupaten tertinggal (3T) di Indonesia (KTP/Domisili).</p>
</div>
<div class="faq-card-custom">
<div class="faq-num-custom">04</div>
<h4>Bagaimana sistem belajarnya?</h4>
<p>Intensif 8 minggu yang terbagi menjadi 3 fase: Foundation, Specialization, dan Application.</p>
</div>
<div class="faq-card-custom">
<div class="faq-num-custom">05</div>
<h4>Sertifikasi resmi NVIDIA?</h4>
<p>Ya, peserta yang lulus ujian akan mendapatkan sertifikasi resmi global dari NVIDIA.</p>
</div>
<div class="faq-card-custom">
<div class="faq-num-custom">06</div>
<h4>Mentoring di Weekday?</h4>
<p>Tidak, seluruh sesi mentoring dan kelas akan dilaksanakan setiap weekend.</p>
</div>
<div class="faq-card-custom">
<div class="faq-num-custom">07</div>
<h4>Bentuk Tes Kompetensi?</h4>
<p>Tes seputar logika dasar, pengetahuan umum tentang data, dan matematika.</p>
</div>
<div class="faq-card-custom">
<div class="faq-num-custom">08</div>
<h4>Belum pernah belajar AI?</h4>
<p>Tentu bisa! Fase Foundation akan mengajarkan dari nol (Math for AI &amp; Data Fundamental).</p>
</div>
<div class="faq-card-custom">
<div class="faq-num-custom">09</div>
<h4>Benefit Awardee HerAI?</h4>
<p>2 sertifikasi, networking expert, akses Woman Hub, dan akselerasi karir.</p>
</div>
<div class="faq-card-custom">
<div class="faq-num-custom">10</div>
<h4>Boleh mundur di tengah jalan?</h4>
<p>Diharapkan komitmen penuh karena kuota beasiswa ini sangat terbatas.</p>
</div>
<div class="faq-card-custom">
<div class="faq-num-custom">11</div>
<h4>Apakah ada sesi mentorship?</h4>
<p>Ya, bimbingan langsung eksklusif dari para expert Data Sorcerers.</p>
</div>
<div class="faq-card-custom">
<div class="faq-num-custom">12</div>
<h4>Online atau Offline?</h4>
<p>Program dilakukan secara Online, bisa diikuti dari mana saja di seluruh Indonesia.</p>
</div>
</div>
<div class="faq-contact-box">
<div class="faq-contact-text">
<h3>Masih punya pertanyaan?</h3>
<p>Tim support kami siap membantu menjawab kebingunganmu tentang HerAI Fellowship.</p>
</div>
<button class="faq-contact-btn"><i class="far fa-envelope"></i> Hubungi Bantuan</button>
</div>
</div>
        </div>
    `;
}

function renderFellowSettingsPage() {
    return `
        <div id="participant-settings-view">
            <div class="settings-container">
                <!-- Sidebar Pengaturan -->
                <aside class="settings-sidebar">
                    <nav class="settings-nav">
                        <a href="#participant-settings" class="active"><i class="far fa-user-circle"></i> Profil Publik</a>
                        <a href="#participant-settings"><i class="far fa-bell"></i> Notifikasi</a>
                        <a href="#participant-settings"><i class="fas fa-shield-alt"></i> Keamanan</a>
                        <a href="#participant-settings"><i class="fas fa-link"></i> Akun Tertaut</a>
                        <a href="#participant-home" style="color: #ef4444; margin-top: 16px;"><i class="fas fa-sign-out-alt"></i> Keluar</a>
                    </nav>
                </aside>

                <!-- Konten Pengaturan -->
                <main class="settings-content">
                    <h2 class="settings-title">Profil Publik</h2>
                    
                    <div class="settings-avatar-section">
                        <div class="settings-avatar-circle">
                            A
                        </div>
                        <div class="settings-avatar-actions">
                            <button class="btn-ubah-foto">Ubah Foto</button>
                            <p>JPG, GIF atau PNG. Maksimal ukuran 2MB</p>
                        </div>
                    </div>

                    <form class="settings-form" onsubmit="event.preventDefault(); alert('Pengaturan berhasil disimpan!');">
                        <div class="form-group">
                            <label>Nama Lengkap</label>
                            <input type="text" value="Aisyah Putri" required>
                        </div>
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" value="aisyah.putri" required>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" value="aisyah@example.com" disabled style="background-color: #f9fafb;">
                        </div>
                        <div class="form-group">
                            <label>Bio Singkat</label>
                            <textarea placeholder="Tuliskan sedikit tentang dirimu..."></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn-save">Simpan Perubahan</button>
                        </div>
                    </form>
                </main>
            </div>
        </div>
    `;
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
        title: 'Komunitas',
        message: 'Berkolaborasi, berbagi ilmu, dan tumbuh bersama komunitas HerAI Fellowship.'
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
    'participant-profile': {
        icon: 'fa-user',
        title: 'Profil Saya',
        message: 'Kelola informasi profilmu.'
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

        if (key === 'participant-chatroom') {
            event.preventDefault();
            const grid = document.querySelector('.fellow-grid');
            const welcome = document.getElementById('participantModuleWelcome');
            const chatroomView = document.getElementById('participant-chatroom-view');
            const modulView = document.getElementById('participant-modul-view');
            const tugasView = document.getElementById('participant-tugas-view');
            const proyekView = document.getElementById('participant-proyek-view');
            const eventsView = document.getElementById('participant-events-view');
            const komView = document.getElementById('participant-community-view');
            const certView = document.getElementById('participant-certificate-view');
            const leadView = document.getElementById('participant-leaderboard-view');
            const helpView = document.getElementById('participant-help-view');
            const settingsView = document.getElementById('participant-settings-view');
            const fellowHeader = document.querySelector('.fellow-header');
            
            if (grid) grid.hidden = true;
            if (welcome) welcome.hidden = true;
            if (chatroomView) chatroomView.style.display = 'flex';
            if (modulView) modulView.style.display = 'none';
            if (tugasView) tugasView.style.display = 'none';
            if (proyekView) proyekView.style.display = 'none';
            if (eventsView) eventsView.style.display = 'none';
            if (komView) komView.style.display = 'none';
            if (certView) certView.style.display = 'none';
            if (leadView) leadView.style.display = 'none';
            if (helpView) helpView.style.display = 'none';
            if (settingsView) settingsView.style.display = 'none';
            if (fellowHeader) fellowHeader.style.display = 'none';
            
            const crSearch = document.getElementById('cr-sidebar-search');
            const crProfile = document.getElementById('cr-sidebar-profile');
            if (crSearch) crSearch.style.display = 'block';
            if (crProfile) crProfile.style.display = 'flex';
            
            setFellowActiveNav('participant-chatroom');
            return;
        }


        if (FELLOW_MODULE_WELCOME[key]) {
            event.preventDefault();
            const chatroomView = document.getElementById('participant-chatroom-view');
            const modulView = document.getElementById('participant-modul-view');
            const tugasView = document.getElementById('participant-tugas-view');
            const proyekView = document.getElementById('participant-proyek-view');
            const eventsView = document.getElementById('participant-events-view');
            const komView = document.getElementById('participant-community-view');
            const certView = document.getElementById('participant-certificate-view');
            const leadView = document.getElementById('participant-leaderboard-view');
            const helpView = document.getElementById('participant-help-view');
            const settingsView = document.getElementById('participant-settings-view');
            const fellowHeader = document.querySelector('.fellow-header');
            if (chatroomView) chatroomView.style.display = 'none';
            if (modulView) modulView.style.display = 'none';
            if (tugasView) tugasView.style.display = 'none';
            if (proyekView) proyekView.style.display = 'none';
            if (eventsView) eventsView.style.display = 'none';
            if (komView) komView.style.display = 'none';
            if (certView) certView.style.display = 'none';
            if (leadView) leadView.style.display = 'none';
            if (helpView) helpView.style.display = 'none';
            if (settingsView) settingsView.style.display = 'none';
            if (fellowHeader) fellowHeader.style.display = 'flex';
            
            const crSearch = document.getElementById('cr-sidebar-search');
            const crProfile = document.getElementById('cr-sidebar-profile');
            if (crSearch) crSearch.style.display = 'none';
            if (crProfile) crProfile.style.display = 'none';
            
            showFellowModuleWelcome(key);
        }
    });

    document.querySelector('.fellow-search input')?.addEventListener('input', filterActiveFellowSection);
    document.getElementById('btnBackToFellowHome')?.addEventListener('click', showFellowHome);
}

function showFellowHome() {
    const grid = document.querySelector('.fellow-grid');
    const welcome = document.getElementById('participantModuleWelcome');
    const chatroomView = document.getElementById('participant-chatroom-view');
    const modulView = document.getElementById('participant-modul-view');
    const tugasView = document.getElementById('participant-tugas-view');
    const proyekView = document.getElementById('participant-proyek-view');
    const eventsView = document.getElementById('participant-events-view');
            const komView = document.getElementById('participant-community-view');
            const certView = document.getElementById('participant-certificate-view');
            const leadView = document.getElementById('participant-leaderboard-view');
            const helpView = document.getElementById('participant-help-view');
            const settingsView = document.getElementById('participant-settings-view');
    const fellowHeader = document.querySelector('.fellow-header');
    
    if (grid) grid.hidden = false;
    if (welcome) welcome.hidden = true;
    if (chatroomView) chatroomView.style.display = 'none';
    if (modulView) modulView.style.display = 'none';
    if (tugasView) tugasView.style.display = 'none';
    if (proyekView) proyekView.style.display = 'none';
    if (eventsView) eventsView.style.display = 'none';
            if (komView) komView.style.display = 'none';
            if (certView) certView.style.display = 'none';
            if (leadView) leadView.style.display = 'none';
            if (helpView) helpView.style.display = 'none';
            if (settingsView) settingsView.style.display = 'none';
    if (fellowHeader) fellowHeader.style.display = 'flex';
    
    const crSearch = document.getElementById('cr-sidebar-search');
    const crProfile = document.getElementById('cr-sidebar-profile');
    
    if (crSearch) crSearch.style.display = 'none';
    if (crProfile) crProfile.style.display = 'none';
    
    if (welcome) welcome.classList.remove('is-section-page');
    const profile = window.__CURRENT_PARTICIPANT_PROFILE__ || {};
    setFellowHeader(`Halo, ${profile.nama_lengkap || 'Fellow'}! 👋`, 'Semangat belajar hari ini! Setiap langkah kecil membawamu lebih dekat ke masa depan yang kamu impikan.', 'Cari modul, topik, atau teman...');
    setFellowActiveNav('participant-home');
}

function showFellowModuleWelcome(key) {
    const item = FELLOW_MODULE_WELCOME[key];
    if (!item) return;

    const grid = document.querySelector('.fellow-grid');
    const welcome = document.getElementById('participantModuleWelcome');
    if (grid) grid.hidden = true;
    if (welcome) welcome.hidden = false;

    if (FELLOW_SECTION_RENDERERS[key]) {
        const sectionMeta = {
            'participant-modules': ['Modul', 'Belajar terstruktur dengan 25+ modul yang dirancang untuk membawamu menjadi AI Talent yang siap berdampak.', 'Cari modul...'],
            'participant-tasks': ['Tugas', 'Selesaikan tugas untuk mengasah skill dan dapatkan poin!', 'Cari tugas...'],
            'participant-project': ['Proyek', 'Bangun solusi nyata dan terapkan ilmu AI yang kamu pelajari.', 'Cari proyek...'],
            'participant-events': ['Events', 'Ikuti berbagai acara seru untuk menambah wawasan, relasi, dan pengalamanmu.', 'Cari event, topik, atau pembicara...'],
            'participant-mentor': ['Direktori Mentor', 'Temukan dan jadwalkan sesi 1-on-1 dengan mentor pilihanmu.', 'Cari mentor...'],
            'participant-community': ['Komunitas', 'Berkolaborasi, berbagi ilmu, dan tumbuh bersama komunitas HerAI Fellowship.', 'Cari komunitas, topik, atau anggota...'],
            'participant-certificate': ['Sertifikat', 'Kumpulkan sertifikat dari setiap pencapaian belajar dan kegiatanmu.', 'Cari sertifikat, modul, atau event...'],
            'participant-leaderboard': ['Leaderboard', 'Apresiasi untuk para perempuan inspiratif yang terus belajar dan berkembang.', 'Cari nama atau pengguna...'],
            'participant-profile': ['Profil Saya', 'Kelola informasi profil dan lihat perjalanan belajarmu', 'Cari di HerAI...'],
            'participant-help': ['FAQ & Bantuan', 'Temukan jawaban dan bantuan untuk penggunaan HerAI.', 'Cari bantuan...'],
            'participant-settings': ['Pengaturan', 'Kelola pengaturan akun dan preferensi Anda.', 'Cari pengaturan...']
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
    const headerText = document.querySelector('.fellow-header > div > p');
    if (headerText) headerText.textContent = subtitle;
    const search = document.querySelector('.fellow-search input');
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
    const search = document.querySelector('.fellow-search input');
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

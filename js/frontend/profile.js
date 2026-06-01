/* ==========================================================================
   Participant Profile Portal
   ========================================================================== */

const PARTICIPANT_PROFILE_API = '/__gas';
const PARTICIPANT_SESSION_KEY = 'heraiParticipantSession';
const PARTICIPANT_LOCAL_KEY = 'heraiParticipantProfiles';
const PARTICIPANT_PROFILE_DETAILS_VISIBLE = false;

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
    document.getElementById('participantAuthView').style.display = 'grid';
    document.getElementById('participantDashboardView').style.display = 'none';
    setProfileMessage('');
}

function showParticipantDashboard(profile) {
    window.__CURRENT_PARTICIPANT_PROFILE__ = profile;
    document.getElementById('participantAuthView').style.display = 'none';
    document.getElementById('participantDashboardView').style.display = 'grid';
    document.getElementById('participantProfileHoldView').hidden = PARTICIPANT_PROFILE_DETAILS_VISIBLE;
    document.getElementById('participantProfileContent').hidden = !PARTICIPANT_PROFILE_DETAILS_VISIBLE;

    if (!PARTICIPANT_PROFILE_DETAILS_VISIBLE) return;

    document.getElementById('profileName').textContent = profile.nama_lengkap || 'Peserta HerAI';
    document.getElementById('profileStage').textContent = `${profile.participant_stage || 'registered'} • ${profile.status_seleksi || 'pending'}`;
    document.getElementById('editNik').value = profile.nik || '';
    document.getElementById('editName').value = profile.nama_lengkap || '';
    document.getElementById('editEmail').value = profile.email || '';
    document.getElementById('editWhatsapp').value = profile.whatsapp || '';
    document.getElementById('editAddress').value = profile.alamat || '';
    document.getElementById('editPortfolio').value = profile.cv_link || '';

    renderProfileProgress(profile);
    renderRegistrationDetails(profile);
    renderParticipantTasks(profile);
    renderParticipantMentoring(profile);
}

async function loadParticipantProfile(nik, password) {
    try {
        const result = await postProfileApi({ action: 'participantLogin', nik, password });
        if (result.status === 'success') return hydrateProfileFromParticipantData(nik, result.profile);
        throw new Error(result.message || 'Profil tidak ditemukan atau password salah.');
    } catch (error) {
        if (error?.isApiError) throw error;
        const local = getLocalProfiles()[nik];
        if (local?.password && local.password === password) return hydrateProfileFromParticipantData(nik, stripLocalPassword(local));
        throw new Error('Tidak bisa memuat profil dari database. Pastikan koneksi dan password benar.');
    }
}

async function setParticipantPassword(nik, password) {
    try {
        const result = await postProfileApi({ action: 'setParticipantPassword', nik, password });
        if (result.status === 'success') return hydrateProfileFromParticipantData(nik, result.profile);
        throw new Error(result.message);
    } catch (error) {
        if (error?.isApiError) throw error;
        throw new Error('Password belum bisa dibuat karena database peserta tidak dapat diakses.');
    }
}

async function updateParticipantProfile(updates) {
    try {
        const result = await postProfileApi({ action: 'updateParticipantProfile', ...updates });
        if (result.status === 'success') return hydrateProfileFromParticipantData(updates.nik, result.profile);
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

async function hydrateProfileFromParticipantData(nik, baseProfile = {}) {
    const normalizedNik = normalizeNik(nik || baseProfile.nik);
    try {
        const result = await postProfileApi({ action: 'getData' });
        const participants = Array.isArray(result.data) ? result.data : [];
        const participant = participants.find(item => normalizeNik(item.nik) === normalizedNik);
        if (participant) {
            return normalizeParticipantProfile({ ...baseProfile, ...participant });
        }
    } catch (error) {
        console.warn('Gagal hydrate data pendaftaran, memakai data login.', error);
    }
    return normalizeParticipantProfile(baseProfile);
}

function normalizeParticipantProfile(profile = {}) {
    const normalized = { ...profile };
    normalized.nik = normalizeNik(normalized.nik);
    normalized.participant_stage = normalizeParticipantStage(normalized.participant_stage);
    normalized.status_seleksi = normalized.status_seleksi || 'pending';
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
        ['registered', 'Pendaftaran diterima'],
        ['accepted_stage_1', 'Lolos tahap 1'],
        ['bootcamp_active', 'Mengikuti bootcamp'],
        ['final_project', 'Final project'],
        ['graduated', 'Graduated']
    ];
    const current = profile.participant_stage || 'registered';
    document.getElementById('profileProgressList').innerHTML = stages.map(([key, label]) => `
        <div class="profile-progress-item">
            <strong>${label}</strong>
            <span>${key === current ? 'Sedang aktif' : 'Status: ' + (isStagePassed(stages, current, key) ? 'Selesai' : 'Belum dimulai')}</span>
        </div>
    `).join('');
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

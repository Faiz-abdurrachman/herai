// Simple development server untuk SPA routing
// Jalankan dengan: node server.js

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const DEBUG_LOG_PATH = path.join(__dirname, '.cursor', 'debug-86a842.log');
const SETTINGS_PATH = path.join(__dirname, '.cursor', 'global-settings.json');
const PARTICIPANTS_PATH = path.join(__dirname, '.cursor', 'participants.json');
const COMPETENCY_SESSIONS_PATH = path.join(__dirname, '.cursor', 'competency-sessions.json');
const PROJECT_SUBMISSIONS_PATH = path.join(__dirname, '.cursor', 'project-submissions.json');
const GAS_WEB_APP_URL = process.env.GAS_WEB_APP_URL || '';
const PUBLIC_PARTICIPANTS_CSV_URL = 'https://docs.google.com/spreadsheets/d/120NQtFqErJiIfITlPfVo8wV6G0_79qFKMTaptxNF-RA/export?format=csv';

const TEST_PARTICIPANT = {
    rowId: 'TEST-001',
    created_at: '2026-05-19T00:00:00.000Z',
    nama_lengkap: 'Alya Putri Demo',
    nik: '3276010101010001',
    tempat_lahir: 'Bandung',
    tanggal_lahir: '2001-01-01',
    whatsapp: '081234567890',
    email: 'alya.demo@herai.test',
    alamat: 'Bandung, Jawa Barat',
    jalur: 'reguler',
    status_kerja: 'mahasiswa',
    univ: 'Universitas Demo Indonesia',
    program_studi: 'Informatika',
    instansi: '',
    posisi: '',
    pengalaman_kerja: 'Asisten riset data dan AI dasar.',
    kejuaraan: 'Finalis lomba data analytics kampus.',
    organisasi: 'Komunitas Women in Tech kampus.',
    cv_link: 'https://example.com/cv-alya-demo',
    essay_1: 'Saya ingin belajar AI untuk membangun solusi edukasi yang inklusif.',
    essay_2: 'Motivasi saya adalah memperluas akses teknologi untuk perempuan muda.',
    essay_3: 'Saya pernah membuat dashboard data sederhana dan chatbot FAQ.',
    essay_4: 'Saya ingin membangun proyek AI untuk rekomendasi pembelajaran.',
    essay_5: 'Saya siap mengikuti seluruh rangkaian program.',
    status_seleksi: 'lolos',
    participant_stage: 'accepted_stage_1',
    assigned_reviewer: 'demo-reviewer',
    skor_logika: 8,
    skor_motivasi: 9,
    skor_teknis: 7,
    skor_latar: 8,
    skor_akhir: 80,
    is_scanned: true,
    ai_summary: 'Kandidat demo memiliki motivasi kuat, pengalaman dasar data, dan potensi berkembang.',
    ai_motivation: 'Tinggi',
    ai_skills: 'Data analysis, dashboarding, chatbot basics',
    ai_score: 82,
    bootcamp_status: 'pending',
    attendance_rate: '',
    final_project_status: 'pending',
    certificate_status: 'pending',
    profile_updated_at: ''
};

const TEST_PASSWORD = 'herai2026';

const TEST_COMPETENCY_QUESTIONS = buildTestCompetencyQuestions();

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
    if (isBlockedSourcePath(pathname)) {
        res.writeHead(404, { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' });
        res.end('Not Found');
        return;
    }

    if (req.method === 'POST' && pathname === '/__debug') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const line = JSON.stringify(parsed) + '\n';
                fs.mkdir(path.dirname(DEBUG_LOG_PATH), { recursive: true }, (mkdirErr) => {
                    if (mkdirErr) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: false, error: 'mkdir_failed', detail: mkdirErr.message, code: mkdirErr.code }));
                        return;
                    }
                    fs.appendFile(DEBUG_LOG_PATH, line, (appendErr) => {
                        if (appendErr) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ ok: false, error: 'append_failed', detail: appendErr.message, code: appendErr.code }));
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: true }));
                    });
                });
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
            }
        });
        return;
    }

    if (pathname === '/__settings') {
        if (req.method === 'GET') {
            fs.readFile(SETTINGS_PATH, 'utf8', (err, content) => {
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store'
                });
                if (err) {
                    res.end(JSON.stringify({ ok: true, settings: {} }));
                    return;
                }
                try {
                    res.end(JSON.stringify({ ok: true, settings: JSON.parse(content || '{}') }));
                } catch {
                    res.end(JSON.stringify({ ok: true, settings: {} }));
                }
            });
            return;
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(body || '{}');
                    const settings = parsed.settings || parsed;
                    fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true }, (mkdirErr) => {
                        if (mkdirErr) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ ok: false, error: mkdirErr.message }));
                            return;
                        }
                        fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), (writeErr) => {
                            if (writeErr) {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ ok: false, error: writeErr.message }));
                                return;
                            }
                            res.writeHead(200, {
                                'Content-Type': 'application/json',
                                'Cache-Control': 'no-store'
                            });
                            res.end(JSON.stringify({ ok: true, settings }));
                        });
                    });
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
                }
            });
            return;
        }
    }

    if (req.method === 'POST' && pathname === '/__gas') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            proxyGasRequest(body, res);
        });
        return;
    }

    let filePath = path.join(__dirname, pathname);
    
    // SPA Routing: jika bukan file static, serve index.html
    let ext = path.extname(filePath);
    
    // Jika tidak ada extension, kemungkinan ini route SPA
    if (!ext && pathname !== '/') {
        filePath = path.join(__dirname, 'index.html');
    } else if (pathname === '/') {
        filePath = path.join(__dirname, 'index.html');
    } else if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    // Recompute extension after potential SPA path rewrite.
    ext = path.extname(filePath);
    
    // Baca file
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // File tidak ditemukan, serve index.html untuk SPA routing
                fs.readFile(path.join(__dirname, 'index.html'), (err, content) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Server Error');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(content, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + err.code);
            }
        } else {
            // Success
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

function proxyGasRequest(body, res) {
    if (!GAS_WEB_APP_URL) {
        if (handleLocalGasFallback(body, res)) return;
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'GAS_WEB_APP_URL belum dikonfigurasi.' }));
        return;
    }
    const target = new URL(GAS_WEB_APP_URL);
    const request = https.request({
        hostname: target.hostname,
        path: target.pathname + target.search,
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8',
            'Content-Length': Buffer.byteLength(body || '{}')
        }
    }, gasRes => {
        let responseBody = '';
        gasRes.on('data', chunk => {
            responseBody += chunk.toString();
        });
        gasRes.on('end', () => {
            if ([301, 302, 303, 307, 308].includes(gasRes.statusCode) && gasRes.headers.location) {
                proxyGasRedirect(gasRes.headers.location, body, res);
                return;
            }
            if (!looksLikeJson(responseBody)) {
                if (handleLocalGasFallback(body, res)) return;
            }
            res.writeHead(gasRes.statusCode || 200, {
                'Content-Type': gasRes.headers['content-type'] || 'application/json',
                'Cache-Control': 'no-store'
            });
            res.end(responseBody);
        });
    });

    request.on('error', error => {
        if (handleLocalGasFallback(body, res)) return;
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: error.message }));
    });

    request.write(body || '{}');
    request.end();
}

function isBlockedSourcePath(pathname) {
    return pathname.startsWith('/gas/') ||
        pathname.startsWith('/signaling/') ||
        pathname === '/render.yaml' ||
        pathname === '/server.js' ||
        pathname === '/.gitignore';
}

function proxyGasRedirect(location, body, res) {
    const target = new URL(location);
    const request = https.request({
        hostname: target.hostname,
        path: target.pathname + target.search,
        method: 'GET'
    }, redirectRes => {
        let responseBody = '';
        redirectRes.on('data', chunk => {
            responseBody += chunk.toString();
        });
        redirectRes.on('end', () => {
            if (!looksLikeJson(responseBody)) {
                if (handleLocalGasFallback(body, res)) return;
            }
            res.writeHead(redirectRes.statusCode || 200, {
                'Content-Type': redirectRes.headers['content-type'] || 'application/json',
                'Cache-Control': 'no-store'
            });
            res.end(responseBody);
        });
    });

    request.on('error', error => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: error.message }));
    });

    request.end();
}

function looksLikeJson(value) {
    const trimmed = String(value || '').trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function handleLocalGasFallback(body, res) {
    let payload;
    try {
        payload = JSON.parse(body || '{}');
    } catch {
        return false;
    }

    const action = payload.action || 'register';
    const routes = {
        register: () => saveLocalParticipant(payload),
        getData: () => {
            fetchPublicParticipants()
                .then(data => sendJson(res, { status: 'success', data }))
                .catch(() => sendJson(res, { status: 'success', data: readLocalParticipants(), source: 'local-fallback' }));
            return null;
        },
        login: () => {
            if (String(payload.id_admin || payload.adminId || '') === 'super-admin' && String(payload.password || '') === 'admin123') {
                return { status: 'success', admin: { adminId: 'super-admin', name: 'Super Admin', role: 'super_admin', permissions: 'all', status: 'active' } };
            }
            return { status: 'error', message: 'ID admin atau password salah.' };
        },
        participantLogin: () => {
            const participant = findLocalParticipantByNik(payload.nik);
            if (!participant) {
                return { status: 'error', message: 'NIK belum terdaftar.' };
            }
            if (!participant.participant_password && participant.nik !== TEST_PARTICIPANT.nik) {
                return { status: 'needs_password', message: 'Password belum dibuat.' };
            }
            const expectedPassword = participant.participant_password || TEST_PASSWORD;
            if (String(payload.password || '') !== String(expectedPassword)) {
                return { status: 'error', message: 'Password salah.' };
            }
            return { status: 'success', profile: stripLocalParticipantSensitive(participant) };
        },
        setParticipantPassword: () => setLocalParticipantPassword(payload),
        updateParticipantProfile: () => updateLocalParticipantProfile(payload),
        updateStatus: () => updateLocalParticipantByKey('rowId', payload.rowId, {
            status_seleksi: payload.status || payload.newStatus,
            participant_stage: (payload.status || payload.newStatus) === 'lolos' ? 'accepted_stage_1' : 'rejected_stage_1'
        }),
        updateScore: () => updateLocalParticipantByKey('rowId', payload.rowId, {
            skor_logika: payload.skor_logika,
            skor_motivasi: payload.skor_motivasi,
            skor_teknis: payload.skor_teknis,
            skor_latar: payload.skor_latar,
            skor_akhir: payload.skor_akhir
        }),
        runAiAnalysis: () => runLocalAiAnalysis(payload),
        updateCompetencyDecision: () => updateLocalCompetencyDecision(payload),
        getCompetencyQuestions: () => ({ status: 'success', questions: stripCompetencyAnswers(TEST_COMPETENCY_QUESTIONS) }),
        getCompetencySessions: () => ({ status: 'success', sessions: readLocalCompetencySessions() }),
        startCompetencySession: () => saveLocalCompetencySession(payload, 'started'),
        heartbeatCompetencySession: () => saveLocalCompetencySession(payload, payload.status || 'started'),
        saveCompetencyAnswer: () => saveLocalCompetencySession(payload, payload.status || 'started'),
        submitCompetencyTest: () => submitLocalCompetencyTest(payload),
        getFinalProjects: () => ({ status: 'success', projects: readLocalProjectSubmissions() }),
        submitFinalProject: () => saveLocalProjectSubmission(payload)
    };

    if (!routes[action]) return false;

    const result = routes[action]();
    if (result === null) return true;
    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(result));
    return true;
}

function sendJson(res, payload, statusCode = 200) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(payload));
}

function readLocalParticipants() {
    let participants = [];
    try {
        participants = JSON.parse(fs.readFileSync(PARTICIPANTS_PATH, 'utf8') || '[]');
    } catch {
        participants = [];
    }
    const hasTest = participants.some(item => normalizeLocalNik(item.nik) === TEST_PARTICIPANT.nik);
    return hasTest ? participants : [TEST_PARTICIPANT, ...participants];
}

function writeLocalParticipants(participants) {
    const withoutTestSeed = participants.filter(item => normalizeLocalNik(item.nik) !== TEST_PARTICIPANT.nik || item.rowId !== TEST_PARTICIPANT.rowId);
    fs.mkdirSync(path.dirname(PARTICIPANTS_PATH), { recursive: true });
    fs.writeFileSync(PARTICIPANTS_PATH, JSON.stringify(withoutTestSeed, null, 2));
}

function saveLocalParticipant(payload) {
    const participants = readLocalParticipants();
    const nik = normalizeLocalNik(payload.nik);
    if (!nik || nik.length !== 16) return { status: 'error', message: 'NIK harus 16 digit.' };
    if (participants.some(item => normalizeLocalNik(item.nik) === nik)) {
        return { status: 'error', message: 'NIK sudah terdaftar.' };
    }
    const participant = {
        rowId: String(Date.now()),
        created_at: new Date().toISOString(),
        nama_lengkap: payload.nama_lengkap || '',
        nik,
        tempat_lahir: payload.tempat_lahir || '',
        tanggal_lahir: payload.tanggal_lahir || '',
        whatsapp: payload.whatsapp || '',
        email: payload.email || '',
        alamat: payload.alamat || '',
        jalur: payload.jalur_pendaftaran || payload.jalur || '',
        status_kerja: payload.status || payload.status_kerja || '',
        univ: payload.universitas || payload.univ || '',
        program_studi: payload.program_studi || '',
        instansi: payload.nama_instansi || payload.instansi || '',
        posisi: payload.posisi || '',
        pengalaman_kerja: payload.pengalaman_kerja || '',
        kejuaraan: payload.kejuaraan || '',
        organisasi: payload.pengalaman_organisasi || payload.organisasi || '',
        cv_link: payload.link_cv || payload.cv_link || '',
        essay_1: payload.essay_1 || '',
        essay_2: payload.essay_2 || '',
        essay_3: payload.essay_3 || '',
        essay_4: payload.essay_4 || '',
        essay_5: payload.essay_5 || '',
        status_seleksi: 'pending',
        participant_stage: 'registered',
        status_tahap_2: 'pending',
        final_status: 'pending',
        is_scanned: false,
        certificate_status: 'pending',
        profile_updated_at: ''
    };
    participants.unshift(participant);
    writeLocalParticipants(participants);
    return { status: 'success', rowId: participant.rowId, participant };
}

function findLocalParticipantByNik(nik) {
    const cleanNik = normalizeLocalNik(nik);
    return readLocalParticipants().find(item => normalizeLocalNik(item.nik) === cleanNik);
}

function updateLocalParticipantByKey(key, value, updates) {
    const participants = readLocalParticipants();
    const index = participants.findIndex(item => String(item[key]) === String(value));
    if (index < 0) return { status: 'error', message: `${key} tidak ditemukan.` };
    participants[index] = { ...participants[index], ...updates, profile_updated_at: updates.profile_updated_at || participants[index].profile_updated_at || '' };
    writeLocalParticipants(participants);
    return { status: 'success', participant: stripLocalParticipantSensitive(participants[index]) };
}

function setLocalParticipantPassword(payload) {
    const participant = findLocalParticipantByNik(payload.nik);
    if (!participant) return { status: 'error', message: 'NIK belum terdaftar.' };
    if (!payload.password || String(payload.password).length < 6) return { status: 'error', message: 'Password minimal 6 karakter.' };
    if (participant.participant_password) return { status: 'error', message: 'Password sudah dibuat. Silakan login.' };
    return updateLocalParticipantByKey('nik', participant.nik, {
        participant_password: payload.password,
        participant_stage: participant.participant_stage || 'registered',
        profile_updated_at: new Date().toISOString()
    });
}

function updateLocalParticipantProfile(payload) {
    const participant = findLocalParticipantByNik(payload.nik);
    if (!participant) return { status: 'error', message: 'NIK belum terdaftar.' };
    const expectedPassword = participant.participant_password || TEST_PASSWORD;
    if (String(expectedPassword) !== String(payload.password || '')) return { status: 'error', message: 'Session tidak valid. Silakan login ulang.' };
    return updateLocalParticipantByKey('nik', participant.nik, {
        nama_lengkap: payload.nama_lengkap || participant.nama_lengkap,
        email: payload.email || participant.email,
        whatsapp: payload.whatsapp || participant.whatsapp,
        alamat: payload.alamat || participant.alamat,
        cv_link: payload.cv_link || participant.cv_link,
        profile_updated_at: new Date().toISOString()
    });
}

function runLocalAiAnalysis(payload) {
    const p = payload.participant || {};
    const analysis = {
        essay_analysis: {
            q1_about: summarizeLocalText(p.essay_1),
            q2_reason: summarizeLocalText(p.essay_2),
            q3_impact: summarizeLocalText(p.essay_3),
            q4_expectations: summarizeLocalText(p.essay_4),
            q5_outstanding: summarizeLocalText(p.essay_5)
        },
        motivation: summarizeLocalText([p.essay_2, p.essay_3, p.essay_4].join(' ')),
        skills: ['AI Enthusiasm', 'Learning Agility'],
        score: Math.min(95, Math.max(55, Math.round(((p.essay_1 || '').length + (p.essay_2 || '').length) / 45)))
    };
    updateLocalParticipantByKey('rowId', p.rowId, {
        is_scanned: true,
        ai_summary: JSON.stringify(analysis.essay_analysis),
        ai_motivation: analysis.motivation,
        ai_skills: analysis.skills.join(', '),
        ai_score: analysis.score
    });
    return { status: 'success', data: analysis };
}

function updateLocalCompetencyDecision(payload) {
    const nik = normalizeLocalNik(payload.nik);
    const decision = String(payload.decision || payload.status || '').toLowerCase();
    if (!nik) return { status: 'error', message: 'NIK wajib diisi.' };
    if (!['lolos', 'gugur', 'pending'].includes(decision)) return { status: 'error', message: 'Decision tidak valid.' };
    const participant = findLocalParticipantByNik(nik);
    if (!participant) return { status: 'error', message: 'Peserta tidak ditemukan.' };
    const stage = decision === 'lolos' ? 'accepted_stage_2' : decision === 'gugur' ? 'rejected_stage_2' : 'competency_submitted';
    return updateLocalParticipantByKey('nik', participant.nik, {
        status_tahap_2: decision,
        participant_stage: stage,
        competency_status: decision,
        competency_decided_at: new Date().toISOString()
    });
}

function stripLocalParticipantSensitive(participant) {
    const clone = { ...participant };
    delete clone.participant_password;
    return clone;
}

function normalizeLocalNik(nik) {
    return String(nik || '').replace(/\D/g, '');
}

function summarizeLocalText(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    return clean ? clean.slice(0, 180) + (clean.length > 180 ? '...' : '') : 'Tidak ada jawaban.';
}

function readLocalProjectSubmissions() {
    try {
        return JSON.parse(fs.readFileSync(PROJECT_SUBMISSIONS_PATH, 'utf8') || '[]');
    } catch {
        return [];
    }
}

function saveLocalProjectSubmission(payload) {
    const submissions = readLocalProjectSubmissions();
    const project = {
        project_id: payload.project_id || `fp_${Date.now()}`,
        team_name: payload.teamName || payload.team_name || '',
        title: payload.title || '',
        members: payload.members || '',
        institution: payload.institution || '',
        track: payload.track || '',
        deck_url: payload.deckUrl || payload.deck_url || '',
        demo_url: payload.demoUrl || payload.demo_url || '',
        repo_url: payload.repoUrl || payload.repo_url || '',
        overview: payload.overview || '',
        details: payload.details || '',
        status: payload.status || 'submitted',
        submitted_at: payload.submittedAt || new Date().toISOString()
    };
    const existingIndex = submissions.findIndex(item => item.project_id === project.project_id);
    if (existingIndex >= 0) submissions[existingIndex] = project;
    else submissions.unshift(project);
    fs.mkdirSync(path.dirname(PROJECT_SUBMISSIONS_PATH), { recursive: true });
    fs.writeFileSync(PROJECT_SUBMISSIONS_PATH, JSON.stringify(submissions, null, 2));
    return { status: 'success', project, projects: submissions };
}

function readLocalCompetencySessions() {
    try {
        return JSON.parse(fs.readFileSync(COMPETENCY_SESSIONS_PATH, 'utf8') || '[]');
    } catch {
        return [];
    }
}

function saveLocalCompetencySession(payload, status) {
    const sessions = readLocalCompetencySessions();
    const sessionId = payload.session_id || ['ct', payload.nik || TEST_PARTICIPANT.nik, Date.now()].join('_');
    const existingIndex = sessions.findIndex(session => session.session_id === sessionId);
    const existing = existingIndex >= 0 ? sessions[existingIndex] : {};
    const now = new Date().toISOString();
    const scoreResult = status === 'submitted' ? calculateLocalCompetencyScores(payload) : {};
    const session = {
        ...existing,
        session_id: sessionId,
        nik: payload.nik || existing.nik || TEST_PARTICIPANT.nik,
        nama_lengkap: payload.nama_lengkap || existing.nama_lengkap || TEST_PARTICIPANT.nama_lengkap,
        status,
        camera_status: payload.camera_status || existing.camera_status || 'unknown',
        mic_status: payload.mic_status || existing.mic_status || 'unknown',
        answered_count: Number(payload.answered_count || existing.answered_count || 0),
        total_questions: Number(payload.total_questions || existing.total_questions || TEST_COMPETENCY_QUESTIONS.length),
        score: scoreResult.rawScore ?? payload.score ?? existing.score ?? '',
        answers: JSON.stringify(payload.answers || {}),
        focus_flags: Number(payload.focus_flags || existing.focus_flags || 0),
        page_visible: payload.page_visible ?? existing.page_visible ?? true,
        active_section: payload.active_section || existing.active_section || '',
        section_remaining: JSON.stringify(payload.section_remaining || {}),
        completed_sections: JSON.stringify(payload.completed_sections || []),
        weighted_score: scoreResult.weightedScore ?? payload.weighted_score ?? existing.weighted_score ?? '',
        section_scores: JSON.stringify(scoreResult.sectionScores || payload.section_scores || {}),
        camera_snapshot: payload.camera_snapshot || existing.camera_snapshot || '',
        history_events: JSON.stringify(appendHistoryEvent(existing.history_events, {
            at: now,
            event: status,
            section: payload.active_section || existing.active_section || '',
            answered_count: Number(payload.answered_count || existing.answered_count || 0),
            focus_flags: Number(payload.focus_flags || existing.focus_flags || 0)
        })),
        started_at: existing.started_at || now,
        updated_at: now,
        submitted_at: status === 'submitted' ? now : (existing.submitted_at || '')
    };

    if (existingIndex >= 0) sessions[existingIndex] = session;
    else sessions.push(session);

    fs.mkdirSync(path.dirname(COMPETENCY_SESSIONS_PATH), { recursive: true });
    fs.writeFileSync(COMPETENCY_SESSIONS_PATH, JSON.stringify(sessions, null, 2));
    return { status: 'success', session };
}

function submitLocalCompetencyTest(payload) {
    const result = saveLocalCompetencySession(payload, 'submitted');
    const participant = findLocalParticipantByNik(payload.nik);
    if (participant) {
        updateLocalParticipantByKey('nik', participant.nik, {
            participant_stage: 'competency_submitted',
            competency_status: 'pending',
            status_tahap_2: participant.status_tahap_2 || 'pending'
        });
    }
    return result;
}

function stripCompetencyAnswers(questions) {
    return questions.map(({ answer, ...question }) => question);
}

function calculateLocalCompetencyScores(payload) {
    const answers = payload.answers || {};
    const variant = getLocalCompetencyVariant(payload.nik || '');
    const byId = new Map();
    TEST_COMPETENCY_QUESTIONS.forEach(question => {
        byId.set(String(question.id), question);
        byId.set(`${question.id}_v${variant}`, question);
    });

    const sectionScores = {};
    let rawScore = 0;
    let weightedScore = 0;
    Object.entries(answers).forEach(([answerId, submitted]) => {
        const question = byId.get(String(answerId));
        if (!question) return;
        const expected = applyLocalCompetencyVariantText(question.answer, variant);
        const selected = String(submitted || '');
        const correct = selected !== '' && selected === expected;
        const base = selected === '' ? 0 : correct ? 1 : -0.3;
        const weight = getLocalCompetencyWeight(question);
        rawScore += base;
        weightedScore += base * weight;
        sectionScores[question.section] = (sectionScores[question.section] || 0) + base * weight;
    });

    Object.keys(sectionScores).forEach(section => {
        sectionScores[section] = Number(sectionScores[section].toFixed(2));
    });

    return {
        rawScore: Number(rawScore.toFixed(2)),
        weightedScore: Number(weightedScore.toFixed(2)),
        sectionScores
    };
}

function getLocalCompetencyWeight(question) {
    if (question.section === 'math' && question.difficulty === 'advanced') return 1.35;
    if (question.section === 'math' && question.difficulty === 'medium') return 1.1;
    if (question.section === 'psychology') return 0.9;
    return 1;
}

function getLocalCompetencyVariant(nik) {
    const sum = String(nik || '').replace(/\D/g, '').split('').reduce((total, value) => total + Number(value || 0), 0);
    return (sum % 3) + 1;
}

function applyLocalCompetencyVariantText(value, variant) {
    if (variant === 1) return String(value || '');
    const swaps = variant === 2
        ? [['HerAI', 'program fellowship'], ['Rina', 'Nadia'], ['Program A', 'Program B'], ['proposal', 'proyek']]
        : [['HerAI', 'kohort AI'], ['Rina', 'Salsabila'], ['Program A', 'Program C'], ['proposal', 'portofolio']];
    return swaps.reduce((text, [from, to]) => text.split(from).join(to), String(value || ''));
}

function appendHistoryEvent(historyJson, event) {
    let history = [];
    try {
        history = JSON.parse(historyJson || '[]');
    } catch {
        history = [];
    }
    history.push(event);
    return history.slice(-80);
}

function fetchPublicParticipants() {
    return httpsGetText(PUBLIC_PARTICIPANTS_CSV_URL)
        .then(csv => {
            const rows = parseCsv(csv);
            if (rows.length < 2) return readLocalParticipants();
            const headers = rows[0].map(header => String(header || '').trim());
            const participants = rows.slice(1)
                .filter(row => row.some(cell => String(cell || '').trim() !== ''))
                .map((row, index) => {
                    const raw = {};
                    headers.forEach((header, colIndex) => {
                        raw[header] = row[colIndex] || '';
                    });
                    return normalizeSpreadsheetParticipant(raw, index + 2);
                });

            const localByNik = new Map(readLocalParticipants().map(item => [normalizeLocalNik(item.nik), item]));
            return participants.map(participant => ({
                ...participant,
                ...(localByNik.get(normalizeLocalNik(participant.nik)) || {}),
                ...participant
            }));
        });
}

function normalizeSpreadsheetParticipant(raw, rowNumber) {
    const value = (...keys) => {
        for (const key of keys) {
            const found = raw[key];
            if (found !== undefined && found !== null && String(found).trim() !== '') return found;
        }
        return '';
    };
    const statusSeleksi = value('status_seleksi') || 'pending';
    return {
        rowId: value('rowId') || rowNumber,
        created_at: value('created_at'),
        nama_lengkap: value('nama_lengkap'),
        nik: value('nik'),
        tempat_lahir: value('tempat_lahir'),
        tanggal_lahir: value('tanggal_lahir'),
        whatsapp: value('whatsapp'),
        email: value('email'),
        alamat: value('alamat'),
        jalur: value('jalur', 'jalur_pendaftaran'),
        jalur_pendaftaran: value('jalur_pendaftaran', 'jalur'),
        status_kerja: value('status_kerja', 'status'),
        status: value('status', 'status_kerja'),
        kejuaraan: value('kejuaraan'),
        organisasi: value('organisasi', 'pengalaman_organisasi'),
        pengalaman_organisasi: value('pengalaman_organisasi', 'organisasi'),
        univ: value('univ', 'universitas'),
        universitas: value('universitas', 'univ'),
        program_studi: value('program_studi', 'jurusan'),
        jurusan: value('jurusan', 'program_studi'),
        instansi: value('instansi', 'nama_instansi'),
        nama_instansi: value('nama_instansi', 'instansi'),
        posisi: value('posisi'),
        pengalaman_kerja: value('pengalaman_kerja', 'peng_kerja'),
        peng_kerja: value('peng_kerja', 'pengalaman_kerja'),
        cv_link: value('cv_link', 'link_cv'),
        link_cv: value('link_cv', 'cv_link'),
        essay_1: value('essay_1', 'essay1'),
        essay_2: value('essay_2', 'essay2'),
        essay_3: value('essay_3', 'essay3'),
        essay_4: value('essay_4', 'essay4'),
        essay_5: value('essay_5', 'essay5'),
        essay1: value('essay1', 'essay_1'),
        essay2: value('essay2', 'essay_2'),
        essay3: value('essay3', 'essay_3'),
        essay4: value('essay4', 'essay_4'),
        essay5: value('essay5', 'essay_5'),
        status_seleksi: statusSeleksi,
        status_tahap_2: value('status_tahap_2') || 'pending',
        competency_status: value('competency_status', 'status_tahap_2') || 'pending',
        final_status: value('final_status', 'status_final') || 'pending',
        participant_stage: value('participant_stage') || (String(statusSeleksi).toLowerCase() === 'lolos' ? 'accepted_stage_1' : String(statusSeleksi).toLowerCase() === 'gugur' ? 'rejected_stage_1' : 'registered'),
        skor_logika: value('skor_logika') || 0,
        skor_motivasi: value('skor_motivasi') || 0,
        skor_teknis: value('skor_teknis') || 0,
        skor_latar: value('skor_latar') || 0,
        skor_akhir: value('skor_akhir') || 0,
        is_scanned: ['true', '1', 'yes', 'scanned', 'done'].includes(String(value('is_scanned')).toLowerCase()) || !!value('ai_score', 'ai_summary', 'ai_motivation', 'ai_skills'),
        ai_summary: value('ai_summary'),
        ai_motivation: value('ai_motivation'),
        ai_skills: value('ai_skills'),
        ai_score: value('ai_score')
    };
}

function httpsGetText(url, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        const target = new URL(url);
        const request = https.get({
            hostname: target.hostname,
            path: target.pathname + target.search,
            headers: { 'User-Agent': 'HerAI-local-dev-server' }
        }, response => {
            if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location && redirectCount < 5) {
                response.resume();
                resolve(httpsGetText(response.headers.location, redirectCount + 1));
                return;
            }
            let body = '';
            response.on('data', chunk => {
                body += chunk.toString();
            });
            response.on('end', () => {
                if (response.statusCode >= 400) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                resolve(body);
            });
        });
        request.on('error', reject);
    });
}

function parseCsv(csv) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    for (let index = 0; index < csv.length; index += 1) {
        const char = csv[index];
        const next = csv[index + 1];
        if (char === '"' && inQuotes && next === '"') {
            cell += '"';
            index += 1;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            row.push(cell);
            cell = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') index += 1;
            row.push(cell);
            if (row.some(value => value !== '')) rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += char;
        }
    }
    row.push(cell);
    if (row.some(value => value !== '')) rows.push(row);
    return rows;
}

function buildTestCompetencyQuestions() {
    const math = [
        ['m1', 'math', 'easy', '12 + 18 = ...', ['20', '28', '30', '32'], '30'],
        ['m2', 'math', 'easy', '45 - 17 = ...', ['18', '26', '28', '32'], '28'],
        ['m3', 'math', 'easy', '7 x 8 = ...', ['48', '54', '56', '64'], '56'],
        ['m4', 'math', 'easy', '72 / 9 = ...', ['6', '7', '8', '9'], '8'],
        ['m5', 'math', 'easy', '25% dari 80 adalah...', ['15', '20', '25', '30'], '20'],
        ['m6', 'math', 'medium', 'Jika 3x + 5 = 20, maka x = ...', ['3', '5', '7', '9'], '5'],
        ['m7', 'math', 'medium', 'Rata-rata dari 6, 8, 10, 12 adalah...', ['8', '9', '10', '11'], '9'],
        ['m8', 'math', 'medium', 'Barang Rp200.000 diskon 15%. Harga akhirnya...', ['Rp160.000', 'Rp170.000', 'Rp175.000', 'Rp185.000'], 'Rp170.000'],
        ['m9', 'math', 'medium', 'Perbandingan 2:3 total 50. Bagian pertama adalah...', ['15', '20', '25', '30'], '20'],
        ['m10', 'math', 'medium', 'Jika 5 pekerja selesai 12 hari, 10 pekerja selesai dalam...', ['4 hari', '5 hari', '6 hari', '8 hari'], '6 hari'],
        ['m11', 'math', 'advanced', 'Jika f(x)=e^(2x) sin(x), nilai f\'(0) adalah...', ['0', '1', '2', '3'], '1'],
        ['m12', 'math', 'advanced', 'Untuk g(x)=ln(x^2+1), nilai g\'(1) adalah...', ['1/2', '1', '2', '4'], '1'],
        ['m13', 'math', 'advanced', 'Nilai integral dari 0 sampai 1 untuk 6x(1-x) dx adalah...', ['1/2', '1', '3/2', '2'], '1'],
        ['m14', 'math', 'advanced', 'Limit sin(3x)/x saat x mendekati 0 adalah...', ['0', '1', '3', 'Tidak ada'], '3'],
        ['m15', 'math', 'advanced', 'Jika A=[[3,1],[0,2]], hasil kali eigenvalue A adalah...', ['2', '3', '5', '6'], '6']
    ];
    const logic = Array.from({ length: 50 }, (_, index) => {
        const id = `l${index + 1}`;
        const variants = [
            ['Semua proposal yang lolos review memiliki data valid. Sebagian proposal HerAI lolos review. Kesimpulan paling kuat adalah...', ['Semua proposal HerAI valid', 'Sebagian proposal HerAI memiliki data valid', 'Tidak ada proposal HerAI valid', 'Semua data valid lolos review'], 'Sebagian proposal HerAI memiliki data valid'],
            ['Kecukupan data: x dan y bilangan bulat positif. Apakah x > y? (1) x+y=11 (2) x-y=3', ['Pernyataan 1 saja cukup', 'Pernyataan 2 saja cukup', 'Keduanya bersama cukup', 'Keduanya tidak cukup'], 'Pernyataan 2 saja cukup'],
            ['Pola analitis: 4, 9, 19, 39, 79, ... berikutnya adalah...', ['119', '139', '159', '179'], '159'],
            ['Program A meningkatkan skor rata-rata 20% pada kelompok kecil yang sukarela ikut. Kesimpulan "semua peserta wajib ikut A" paling lemah karena...', ['Mengasumsikan efek sama untuk semua peserta', 'Menggunakan angka persentase', 'Membahas program', 'Tidak menyebut lokasi'], 'Mengasumsikan efek sama untuk semua peserta'],
            ['Jika hanya kandidat dengan skor AI tinggi atau reviewer tinggi lolos. Rina lolos tetapi skor AI rendah. Maka...', ['Reviewer Rina tinggi', 'AI Rina tinggi', 'Rina tidak lolos', 'Tidak ada kesimpulan'], 'Reviewer Rina tinggi']
        ];
        const selected = variants[index % variants.length];
        return [id, 'logic', 'standard', selected[0], selected[1], selected[2]];
    });
    const psychology = Array.from({ length: 50 }, (_, index) => {
        const id = `p${index + 1}`;
        const variants = [
            ['Saat tim berbeda pendapat, respons terbaik adalah...', ['Memaksakan pendapat sendiri', 'Mendengar alasan tiap pihak lalu mencari titik temu', 'Diam agar konflik selesai', 'Menyalahkan anggota paling pasif'], 'Mendengar alasan tiap pihak lalu mencari titik temu'],
            ['Ketika mendapat feedback keras, sikap paling adaptif adalah...', ['Menolak feedback', 'Mencatat poin valid dan membuat rencana perbaikan', 'Menghindari pemberi feedback', 'Membalas dengan kritik'], 'Mencatat poin valid dan membuat rencana perbaikan'],
            ['Jika deadline mendekat dan tugas belum selesai, prioritas utama adalah...', ['Panik', 'Memecah tugas, komunikasikan risiko, dan selesaikan bagian kritis', 'Menunggu instruksi', 'Mengabaikan kualitas sepenuhnya'], 'Memecah tugas, komunikasikan risiko, dan selesaikan bagian kritis'],
            ['Dalam belajar teknologi baru, perilaku paling sehat adalah...', ['Menyerah saat error pertama', 'Mencoba, mencari referensi, dan meminta bantuan saat buntu', 'Menyalin tanpa memahami', 'Menyalahkan tools'], 'Mencoba, mencari referensi, dan meminta bantuan saat buntu']
        ];
        const selected = variants[index % variants.length];
        return [id, 'psychology', 'situational', selected[0], selected[1], selected[2]];
    });
    return [...math, ...logic, ...psychology].map(item => ({
        id: item[0],
        section: item[1],
        type: item[1],
        difficulty: item[2],
        question: item[3],
        options: item[4],
        answer: item[5],
        points: 1
    }));
}

server.listen(PORT, HOST, () => {
    console.log(`🚀 Server running at http://${HOST}:${PORT}/`);
    console.log(`📝 Press Ctrl+C to stop`);
});

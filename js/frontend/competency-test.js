/* ==========================================================================
   Seleksi Tahap 2 - Competency Test
   ========================================================================== */

const COMPETENCY_API_URL = '/__gas';

(function() {
    const SECTION_META = {
        math: { label: 'Math', duration: 40 * 60, description: '15 soal: 5 mudah, 5 menengah, 5 advanced ekstrem' },
        logic: { label: 'Logic', duration: 50 * 60, description: '50 soal penalaran analitis HOTS' },
        psychology: { label: 'Psikologi', duration: 60 * 60, description: '50 soal situational judgement' }
    };
    const SECTION_ORDER = ['math', 'logic', 'psychology'];
    const STORAGE_PREFIX = 'heraiCompetencyState:';

    let participant = null;
    let sessionId = null;
    let questions = [];
    let sections = {};
    let activeSection = 'math';
    let activeIndex = 0;
    let answers = {};
    let mediaStream = null;
    let heartbeatTimer = null;
    let timerTimer = null;
    let snapshotTimer = null;
    let sectionRemaining = {};
    let completedSections = [];
    let focusFlags = 0;
    let latestSnapshot = '';
    let submitted = false;

    window.initCompetencyTest = function() {
        resetRuntime();
        installAntiCopyGuards();
        bindCompetencyLogin();
        bindCompetencyExam();
    };

    function resetRuntime() {
        participant = null;
        sessionId = null;
        questions = [];
        sections = {};
        activeSection = 'math';
        activeIndex = 0;
        answers = {};
        completedSections = [];
        focusFlags = 0;
        latestSnapshot = '';
        submitted = false;
        sectionRemaining = Object.fromEntries(Object.entries(SECTION_META).map(([key, meta]) => [key, meta.duration]));
    }

    function bindCompetencyLogin() {
        const form = document.getElementById('competencyLoginForm');
        if (!form) return;

        form.onsubmit = async (event) => {
            event.preventDefault();
            const nik = document.getElementById('competencyNik').value.replace(/\D/g, '');
            const password = document.getElementById('competencyPassword').value;
            if (nik.length !== 16) return setCompetencyMessage('NIK harus 16 digit.', true);
            if (!password) return setCompetencyMessage('Password wajib diisi.', true);

            const btn = document.getElementById('btnCompetencyLogin');
            const original = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...';
            try {
                const login = await postCompetencyApi({ action: 'participantLogin', nik, password });
                participant = login.profile;
                if (!['lolos', 'accepted', 'accepted_stage_1'].includes(String(participant.status_seleksi || '').toLowerCase()) &&
                    !['accepted_stage_1', 'competency_test', 'competency_submitted'].includes(String(participant.participant_stage || '').toLowerCase())) {
                    throw new Error('Tes kompetensi hanya untuk peserta yang lolos tahap 1.');
                }
                const questionResult = await postCompetencyApi({ action: 'getCompetencyQuestions' });
                questions = normalizeQuestionBank(questionResult.questions || [], participant.nik);
                sections = groupQuestionsBySection(questions);
                const saved = readSavedState(participant.nik);
                if (saved?.submitted) {
                    answers = saved.answers || {};
                    submitted = true;
                    showThankYouView();
                    return;
                }
                restoreSavedState(saved);
                showAgreementView();
            } catch (error) {
                setCompetencyMessage(error.message || 'Gagal masuk tes.', true);
            } finally {
                btn.disabled = false;
                btn.innerHTML = original;
            }
        };
    }

    function bindCompetencyExam() {
        document.getElementById('btnStartCompetency')?.addEventListener('click', startCompetencySession);
        document.getElementById('btnSubmitCompetency')?.addEventListener('click', submitCompetencyTest);
        document.getElementById('competencySectionTabs')?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-section]');
            if (!button || submitted) return;
            if (button.disabled) return;
            activeSection = button.dataset.section;
            activeIndex = 0;
            renderExamWorkspace();
        });
        document.getElementById('competencyQuestionNav')?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-index]');
            if (!button || submitted) return;
            activeIndex = Number(button.dataset.index) || 0;
            renderActiveQuestion();
        });
        document.addEventListener('visibilitychange', () => {
            if (!sessionId || submitted) return;
            if (document.hidden) focusFlags += 1;
            sendCompetencyHeartbeat();
        });
        window.addEventListener('blur', () => {
            if (!sessionId || submitted) return;
            focusFlags += 1;
            sendCompetencyHeartbeat();
        });
        window.addEventListener('beforeunload', () => {
            persistState();
        });
    }

    function showAgreementView() {
        document.getElementById('competencyGateView').style.display = 'none';
        document.getElementById('competencyExamView').style.display = 'grid';
        document.getElementById('competencyAgreementPanel').style.display = 'block';
        document.getElementById('competencyWorkspace').style.display = 'none';
        document.getElementById('competencyParticipantName').textContent = participant.nama_lengkap || 'Peserta HerAI';
        document.getElementById('competencyMeta').textContent = `${participant.nik || '-'} • Math 40 menit • Logic 50 menit • Psikologi 60 menit`;
        renderSectionSummary();
    }

    async function startCompetencySession() {
        const btn = document.getElementById('btnStartCompetency');
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuka media...';
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const preview = document.getElementById('competencyCameraPreview');
            preview.srcObject = mediaStream;
            document.getElementById('mediaStatus').className = 'monitor-pill ok';
            document.getElementById('mediaStatus').textContent = 'Kamera & mic aktif';
            latestSnapshot = captureCameraSnapshot();
            const started = await postCompetencyApi({
                action: 'startCompetencySession',
                session_id: sessionId,
                nik: participant.nik,
                nama_lengkap: participant.nama_lengkap,
                camera_status: 'granted',
                mic_status: 'granted',
                total_questions: questions.length,
                camera_snapshot: latestSnapshot
            });
            sessionId = started.session.session_id;
            persistState();
            document.getElementById('competencyAgreementPanel').style.display = 'none';
            document.getElementById('competencyWorkspace').style.display = 'grid';
            preview.classList.add('camera-hidden-active');
            startTimers();
            renderExamWorkspace();
            sendCompetencyHeartbeat();
        } catch (error) {
            document.getElementById('mediaStatus').className = 'monitor-pill bad';
            document.getElementById('mediaStatus').textContent = 'Media ditolak';
            await postCompetencyApi({
                action: 'startCompetencySession',
                nik: participant?.nik || '',
                nama_lengkap: participant?.nama_lengkap || '',
                camera_status: 'denied',
                mic_status: 'denied',
                status: 'media_denied',
                total_questions: questions.length
            }).catch(() => {});
            alert('Kamera dan mikrofon wajib aktif untuk memulai tes.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }

    function renderSectionSummary() {
        const target = document.getElementById('competencySectionSummary');
        if (!target) return;
        target.innerHTML = Object.entries(SECTION_META).map(([key, meta]) => `
            <div class="competency-section-summary">
                <strong>${meta.label}</strong>
                <span>${meta.description}</span>
                <small>${Math.round(meta.duration / 60)} menit</small>
            </div>
        `).join('');
    }

    function renderExamWorkspace() {
        renderSectionTabs();
        renderQuestionNavigation();
        renderActiveQuestion();
        updateTimerDisplay();
        updateProgressLabel();
    }

    function renderSectionTabs() {
        const tabs = document.getElementById('competencySectionTabs');
        if (!tabs) return;
        tabs.innerHTML = Object.entries(SECTION_META).map(([key, meta]) => `
            <button type="button" class="${key === activeSection ? 'active' : ''} ${isSectionUnlocked(key) ? '' : 'locked'}" data-section="${key}" ${isSectionUnlocked(key) ? '' : 'disabled'}>
                <strong>${meta.label}</strong>
                <span>${isSectionUnlocked(key) ? `${answeredCount(key)}/${sections[key].length}` : 'Terkunci'}</span>
            </button>
        `).join('');
    }

    function renderQuestionNavigation() {
        const nav = document.getElementById('competencyQuestionNav');
        if (!nav) return;
        nav.innerHTML = sections[activeSection].map((question, index) => `
            <button type="button" class="${answers[question.id] ? 'answered' : ''} ${index === activeIndex ? 'active' : ''}" data-index="${index}">
                ${index + 1}
            </button>
        `).join('');
    }

    function renderActiveQuestion() {
        const target = document.getElementById('competencyActiveQuestion');
        const list = sections[activeSection] || [];
        const question = list[activeIndex];
        if (!target || !question) return;

        target.innerHTML = `
            <div class="competency-question-card active-question">
                <div class="competency-question-meta">
                    <span>${SECTION_META[activeSection].label}</span>
                    <span>${question.difficulty || 'standard'}</span>
                    <span>Soal ${activeIndex + 1} dari ${list.length}</span>
                </div>
                <strong>${activeIndex + 1}. ${escapeCompetencyHtml(question.question)}</strong>
                <div class="competency-options">
                    ${(question.options || []).map(option => `
                        <label class="${answers[question.id] === option ? 'selected' : ''}">
                            <input type="radio" name="question_${question.id}" value="${escapeCompetencyHtml(option)}" ${answers[question.id] === option ? 'checked' : ''}>
                            <span>${escapeCompetencyHtml(option)}</span>
                        </label>
                    `).join('')}
                </div>
                <div class="competency-question-actions">
                    <button type="button" class="btn btn-outline" id="btnPrevQuestion" ${activeIndex === 0 ? 'disabled' : ''}>Sebelumnya</button>
                    <button type="button" class="btn btn-primary" id="btnNextQuestion">${activeIndex === list.length - 1 ? 'Selesai Section' : 'Berikutnya'}</button>
                </div>
            </div>
        `;

        target.querySelectorAll('input[type="radio"]').forEach(input => {
            input.addEventListener('change', () => {
                answers[question.id] = input.value;
                saveCompetencyProgress();
                renderExamWorkspace();
            });
        });
        document.getElementById('btnPrevQuestion')?.addEventListener('click', () => {
            activeIndex = Math.max(0, activeIndex - 1);
            renderActiveQuestion();
            renderQuestionNavigation();
        });
        document.getElementById('btnNextQuestion')?.addEventListener('click', () => {
            if (activeIndex === list.length - 1) {
                finishCurrentSection();
                return;
            }
            activeIndex = Math.min(list.length - 1, activeIndex + 1);
            renderActiveQuestion();
            renderQuestionNavigation();
        });
    }

    async function saveCompetencyProgress() {
        if (!sessionId) return;
        await postCompetencyApi({
            action: 'saveCompetencyAnswer',
            session_id: sessionId,
            nik: participant.nik,
            answers,
            answered_count: Object.keys(answers).length,
            total_questions: questions.length,
            active_section: activeSection,
            section_remaining: sectionRemaining,
            completed_sections: completedSections,
            focus_flags: focusFlags,
            camera_snapshot: latestSnapshot
        }).catch(() => {});
        persistState();
    }

    async function submitCompetencyTest(event) {
        event.preventDefault();
        if (!sessionId) return alert('Aktifkan kamera dan mulai tes terlebih dahulu.');
        const unanswered = questions.length - Object.keys(answers).length;
        if (unanswered > 0) {
            const ok = await showSubmitConfirm(unanswered);
            if (!ok) return;
        }

        const scorePayload = calculateScores();
        const result = await postCompetencyApi({
            action: 'submitCompetencyTest',
            session_id: sessionId,
            nik: participant.nik,
            answers,
            score: scorePayload.rawScore,
            weighted_score: scorePayload.weightedScore,
            section_scores: scorePayload.sectionScores,
            total_questions: questions.length,
            focus_flags: focusFlags,
            camera_snapshot: latestSnapshot
        });
        submitted = true;
        persistState({ submitted: true });
        stopCompetencyRuntime();
        showThankYouView();
        document.getElementById('btnSubmitCompetency').disabled = true;
    }

    function calculateScores() {
        const sectionScores = {};
        let rawScore = 0;
        let weightedScore = 0;
        questions.forEach(question => {
            const answer = answers[question.id];
            const correct = answer && answer === question.answer;
            const base = !answer ? 0 : correct ? 1 : -0.3;
            const weight = getQuestionWeight(question);
            rawScore += base;
            weightedScore += base * weight;
            sectionScores[question.section] = (sectionScores[question.section] || 0) + base * weight;
        });
        return {
            rawScore: Number(rawScore.toFixed(2)),
            weightedScore: Number(weightedScore.toFixed(2)),
            sectionScores
        };
    }

    function getQuestionWeight(question) {
        if (question.section === 'math' && question.difficulty === 'advanced') return 1.35;
        if (question.section === 'math' && question.difficulty === 'medium') return 1.1;
        if (question.section === 'psychology') return 0.9;
        return 1;
    }

    function startTimers() {
        heartbeatTimer = setInterval(sendCompetencyHeartbeat, 15000);
        snapshotTimer = setInterval(() => {
            latestSnapshot = captureCameraSnapshot();
        }, 7000);
        timerTimer = setInterval(() => {
            if (submitted) return;
            sectionRemaining[activeSection] = Math.max(0, sectionRemaining[activeSection] - 1);
            persistState();
            updateTimerDisplay();
            if (sectionRemaining[activeSection] === 0) {
                markSectionCompleted(activeSection);
                const next = nextAvailableSection();
                if (next) {
                    activeSection = next;
                    activeIndex = 0;
                    renderExamWorkspace();
                } else {
                    document.getElementById('btnSubmitCompetency')?.click();
                }
            }
        }, 1000);
    }

    async function sendCompetencyHeartbeat() {
        if (!sessionId) return;
        latestSnapshot = latestSnapshot || captureCameraSnapshot();
        await postCompetencyApi({
            action: 'heartbeatCompetencySession',
            session_id: sessionId,
            nik: participant.nik,
            status: 'started',
            camera_status: mediaStream ? 'granted' : 'unknown',
            mic_status: mediaStream ? 'granted' : 'unknown',
            answered_count: Object.keys(answers).length,
            total_questions: questions.length,
            active_section: activeSection,
            section_remaining: sectionRemaining,
            completed_sections: completedSections,
            focus_flags: focusFlags,
            page_visible: !document.hidden,
            camera_snapshot: latestSnapshot
        }).catch(() => {});
        updateProgressLabel();
    }

    function captureCameraSnapshot() {
        const video = document.getElementById('competencyCameraPreview');
        const canvas = document.getElementById('competencySnapshotCanvas');
        if (!video || !canvas || !video.videoWidth) return latestSnapshot;
        canvas.width = 320;
        canvas.height = Math.round(320 * (video.videoHeight / video.videoWidth));
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.5);
    }

    function stopCompetencyRuntime() {
        clearInterval(heartbeatTimer);
        clearInterval(timerTimer);
        clearInterval(snapshotTimer);
        if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
    }

    function updateTimerDisplay() {
        const remaining = sectionRemaining[activeSection] || 0;
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        document.getElementById('competencyTimer').textContent = `${SECTION_META[activeSection].label} ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function updateProgressLabel() {
        const progress = document.getElementById('competencyProgress');
        if (progress) progress.textContent = `${Object.keys(answers).length}/${questions.length} soal terjawab`;
    }

    function answeredCount(section) {
        return sections[section].filter(question => answers[question.id]).length;
    }

    function nextAvailableSection() {
        return SECTION_ORDER.find(key => sectionRemaining[key] > 0 && key !== activeSection && isSectionUnlocked(key));
    }

    async function finishCurrentSection() {
        const next = SECTION_ORDER[SECTION_ORDER.indexOf(activeSection) + 1];
        if (next) {
            const ok = await showNextSectionConfirm(activeSection, next);
            if (!ok) return;
            markSectionCompleted(activeSection);
            activeSection = next;
            activeIndex = 0;
            persistState();
            renderExamWorkspace();
            return;
        }
        const unanswered = questions.length - Object.keys(answers).length;
        if (unanswered === 0) {
            document.getElementById('btnSubmitCompetency')?.click();
            return;
        }
        showSubmitConfirm(unanswered).then(ok => {
            if (ok) document.getElementById('btnSubmitCompetency')?.click();
        });
    }

    function markSectionCompleted(section) {
        if (!completedSections.includes(section)) completedSections.push(section);
    }

    function isSectionUnlocked(section) {
        const index = SECTION_ORDER.indexOf(section);
        if (completedSections.includes(section) && section !== activeSection) return false;
        if (index <= 0) return !completedSections.includes(section) || section === activeSection;
        return completedSections.includes(SECTION_ORDER[index - 1]);
    }

    async function postCompetencyApi(payload) {
        const response = await fetch(COMPETENCY_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Server tes tidak merespons.');
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message || 'Permintaan tes ditolak.');
        return result;
    }

    function normalizeQuestionBank(incoming, nik = '') {
        const bank = buildDefaultQuestionBank();
        if (!Array.isArray(incoming) || incoming.length < 115) return prepareQuestionVariant(bank, nik);
        const normalized = incoming.map((q, index) => ({
            ...q,
            id: q.id || `q${index + 1}`,
            section: q.section || inferSection(q.type, index),
            difficulty: q.difficulty || 'standard'
        }));
        return prepareQuestionVariant(normalized.length >= 115 ? normalized : bank, nik);
    }

    function groupQuestionsBySection(bank) {
        return {
            math: bank.filter(q => q.section === 'math').slice(0, 15),
            logic: bank.filter(q => q.section === 'logic').slice(0, 50),
            psychology: bank.filter(q => q.section === 'psychology').slice(0, 50)
        };
    }

    function inferSection(type, index) {
        if (type === 'math' || index < 15) return 'math';
        if (type === 'psychology' || index >= 65) return 'psychology';
        return 'logic';
    }

    function prepareQuestionVariant(bank, nik = '') {
        const variant = getVariantNumber(nik);
        const sectionsByKey = SECTION_ORDER.map(section => {
            const sectionQuestions = bank
                .filter(question => question.section === section)
                .map(question => ({
                    ...applyQuestionVariant(question, variant),
                    variant
                }));
            return seededShuffle(sectionQuestions, `${nik || 'guest'}-${section}-${variant}`);
        });

        return sectionsByKey.flat().map((question, index) => ({
            ...question,
            order_no: index + 1
        }));
    }

    function getVariantNumber(nik = '') {
        const digits = String(nik).replace(/\D/g, '').split('').map(Number);
        const sum = digits.reduce((total, value) => total + value, 0);
        return (sum % 3) + 1;
    }

    function applyQuestionVariant(question, variant) {
        if (variant === 1) return question;
        const swaps = variant === 2
            ? [['HerAI', 'program fellowship'], ['Rina', 'Nadia'], ['Program A', 'Program B'], ['proposal', 'proyek']]
            : [['HerAI', 'kohort AI'], ['Rina', 'Salsabila'], ['Program A', 'Program C'], ['proposal', 'portofolio']];
        const mutate = value => swaps.reduce((text, [from, to]) => text.replaceAll(from, to), String(value));
        return {
            ...question,
            id: `${question.id}_v${variant}`,
            question: mutate(question.question),
            options: (question.options || []).map(mutate),
            answer: mutate(question.answer)
        };
    }

    function seededShuffle(items, seedText) {
        const output = [...items];
        let seed = 0;
        for (let i = 0; i < seedText.length; i++) {
            seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
        }
        const random = () => {
            seed = (1664525 * seed + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (let i = output.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [output[i], output[j]] = [output[j], output[i]];
        }
        return output;
    }

    function buildDefaultQuestionBank() {
        const mathEasy = [
            ['m1', 'easy', '12 + 18 = ...', ['20', '28', '30', '32'], '30'],
            ['m2', 'easy', '45 - 17 = ...', ['18', '26', '28', '32'], '28'],
            ['m3', 'easy', '7 x 8 = ...', ['48', '54', '56', '64'], '56'],
            ['m4', 'easy', '72 / 9 = ...', ['6', '7', '8', '9'], '8'],
            ['m5', 'easy', '25% dari 80 adalah...', ['15', '20', '25', '30'], '20']
        ];
        const mathMedium = [
            ['m6', 'medium', 'Jika 3x + 5 = 20, maka x = ...', ['3', '5', '7', '9'], '5'],
            ['m7', 'medium', 'Rata-rata dari 6, 8, 10, 12 adalah...', ['8', '9', '10', '11'], '9'],
            ['m8', 'medium', 'Sebuah barang Rp200.000 diskon 15%. Harga akhirnya...', ['Rp160.000', 'Rp170.000', 'Rp175.000', 'Rp185.000'], 'Rp170.000'],
            ['m9', 'medium', 'Perbandingan 2:3 total 50. Bagian pertama adalah...', ['15', '20', '25', '30'], '20'],
            ['m10', 'medium', 'Jika 5 pekerja selesai 12 hari, 10 pekerja selesai dalam...', ['4 hari', '5 hari', '6 hari', '8 hari'], '6 hari']
        ];
        const mathAdvanced = [
            ['m11', 'advanced', 'Jika f(x)=e^(2x) sin(x), nilai f\'(0) adalah...', ['0', '1', '2', '3'], '1'],
            ['m12', 'advanced', 'Untuk g(x)=ln(x^2+1), nilai g\'(1) adalah...', ['1/2', '1', '2', '4'], '1'],
            ['m13', 'advanced', 'Nilai integral dari 0 sampai 1 untuk 6x(1-x) dx adalah...', ['1/2', '1', '3/2', '2'], '1'],
            ['m14', 'advanced', 'Limit sin(3x)/x saat x mendekati 0 adalah...', ['0', '1', '3', 'Tidak ada'], '3'],
            ['m15', 'advanced', 'Jika A=[[3,1],[0,2]], hasil kali eigenvalue A adalah...', ['2', '3', '5', '6'], '6']
        ];
        const logic = Array.from({ length: 50 }, (_, i) => {
            const n = i + 1;
            const templates = [
                [`l${n}`, `Semua proposal yang lolos review memiliki data valid. Sebagian proposal HerAI lolos review. Kesimpulan paling kuat adalah...`, ['Semua proposal HerAI valid', 'Sebagian proposal HerAI memiliki data valid', 'Tidak ada proposal HerAI valid', 'Semua data valid lolos review'], 'Sebagian proposal HerAI memiliki data valid'],
                [`l${n}`, `Kecukupan data: x dan y bilangan bulat positif. Apakah x > y? (1) x+y=11 (2) x-y=3`, ['Pernyataan 1 saja cukup', 'Pernyataan 2 saja cukup', 'Keduanya bersama cukup', 'Keduanya tidak cukup'], 'Pernyataan 2 saja cukup'],
                [`l${n}`, `Pola analitis: 4, 9, 19, 39, 79, ... berikutnya adalah...`, ['119', '139', '159', '179'], '159'],
                [`l${n}`, `Program A meningkatkan skor rata-rata 20% pada kelompok kecil yang sukarela ikut. Kesimpulan "semua peserta wajib ikut A" paling lemah karena...`, ['Mengasumsikan efek sama untuk semua peserta', 'Menggunakan angka persentase', 'Membahas program', 'Tidak menyebut lokasi'], 'Mengasumsikan efek sama untuk semua peserta'],
                [`l${n}`, `Jika hanya kandidat dengan skor AI tinggi atau reviewer tinggi yang lolos. Rina lolos tetapi skor AI rendah. Maka...`, ['Reviewer Rina tinggi', 'AI Rina tinggi', 'Rina tidak lolos', 'Tidak ada kesimpulan'], 'Reviewer Rina tinggi']
            ];
            const selected = templates[i % templates.length];
            return [selected[0], 'standard', selected[1], selected[2], selected[3]];
        });
        const psych = Array.from({ length: 50 }, (_, i) => {
            const n = i + 1;
            const prompts = [
                [`p${n}`, 'Saat tim berbeda pendapat, respons terbaik adalah...', ['Memaksakan pendapat sendiri', 'Mendengar alasan tiap pihak lalu mencari titik temu', 'Diam agar konflik selesai', 'Menyalahkan anggota paling pasif'], 'Mendengar alasan tiap pihak lalu mencari titik temu'],
                [`p${n}`, 'Ketika mendapat feedback keras, sikap paling adaptif adalah...', ['Menolak feedback', 'Mencatat poin valid dan membuat rencana perbaikan', 'Menghindari pemberi feedback', 'Membalas dengan kritik'], 'Mencatat poin valid dan membuat rencana perbaikan'],
                [`p${n}`, 'Jika deadline mendekat dan tugas belum selesai, prioritas utama adalah...', ['Panik', 'Memecah tugas, komunikasikan risiko, dan selesaikan bagian kritis', 'Menunggu instruksi', 'Mengabaikan kualitas sepenuhnya'], 'Memecah tugas, komunikasikan risiko, dan selesaikan bagian kritis'],
                [`p${n}`, 'Dalam belajar teknologi baru, perilaku paling sehat adalah...', ['Menyerah saat error pertama', 'Mencoba, mencari referensi, dan meminta bantuan saat buntu', 'Menyalin tanpa memahami', 'Menyalahkan tools'], 'Mencoba, mencari referensi, dan meminta bantuan saat buntu']
            ];
            const selected = prompts[i % prompts.length];
            return [selected[0], 'situational', selected[1], selected[2], selected[3]];
        });

        return [...mathEasy, ...mathMedium, ...mathAdvanced].map(toMathQuestion)
            .concat(logic.map(item => toQuestion(item, 'logic')))
            .concat(psych.map(item => toQuestion(item, 'psychology')));
    }

    function toMathQuestion(item) {
        return toQuestion(item, 'math');
    }

    function toQuestion(item, section) {
        return { id: item[0], section, difficulty: item[1], question: item[2], options: item[3], answer: item[4], points: 1 };
    }

    function setCompetencyMessage(message, isError = false) {
        const el = document.getElementById('competencyLoginMessage');
        if (!el) return;
        el.textContent = message;
        el.style.color = isError ? '#e63946' : 'var(--text-muted)';
    }

    function persistState(extra = {}) {
        if (!participant?.nik) return;
        const state = {
            nik: participant.nik,
            sessionId,
            answers,
            activeSection,
            activeIndex,
            sectionRemaining,
            completedSections,
            focusFlags,
            submitted,
            updatedAt: new Date().toISOString(),
            ...extra
        };
        localStorage.setItem(STORAGE_PREFIX + participant.nik, JSON.stringify(state));
    }

    function readSavedState(nik) {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_PREFIX + nik) || 'null');
        } catch {
            return null;
        }
    }

    function restoreSavedState(saved) {
        if (!saved) return;
        sessionId = saved.sessionId || sessionId;
        answers = saved.answers || {};
        activeSection = saved.activeSection || 'math';
        activeIndex = Number(saved.activeIndex || 0);
        sectionRemaining = { ...sectionRemaining, ...(saved.sectionRemaining || {}) };
        if (!saved.submitted && saved.updatedAt && saved.activeSection) {
            const elapsed = Math.max(0, Math.floor((Date.now() - new Date(saved.updatedAt).getTime()) / 1000));
            sectionRemaining[saved.activeSection] = Math.max(0, Number(sectionRemaining[saved.activeSection] || 0) - elapsed);
        }
        completedSections = Array.isArray(saved.completedSections) ? saved.completedSections : [];
        focusFlags = Number(saved.focusFlags || 0);
    }

    function showThankYouView() {
        document.getElementById('competencyGateView').style.display = 'none';
        document.getElementById('competencyExamView').style.display = 'grid';
        document.getElementById('competencyWorkspace').style.display = 'none';
        document.getElementById('mediaStatus').className = 'monitor-pill ok';
        document.getElementById('mediaStatus').textContent = 'Submitted';
        document.getElementById('competencyAgreementPanel').style.display = 'block';
        document.getElementById('competencyAgreementPanel').innerHTML = `
            <div class="competency-finish-card">
                <i class="fas fa-circle-check"></i>
                <h3>Terima Kasih</h3>
                <p>Semua jawaban sudah terkirim dan dikunci. Anda boleh menutup halaman ini. Jika login lagi, jawaban final tidak dapat diubah.</p>
            </div>
        `;
    }

    function showSubmitConfirm(unanswered) {
        return new Promise(resolve => {
            const modal = document.getElementById('competencySubmitModal');
            const text = document.getElementById('competencySubmitModalText');
            if (!modal || !text) return resolve(confirm(`Masih ada ${unanswered} soal kosong. Kosong bernilai 0. Tetap kirim?`));
            text.textContent = `Masih ada ${unanswered} soal kosong. Kosong bernilai 0. Tetap kirim?`;
            modal.classList.add('active');
            const yes = document.getElementById('btnConfirmSubmitCompetency');
            const no = document.getElementById('btnCancelSubmitCompetency');
            const cleanup = (value) => {
                modal.classList.remove('active');
                yes.onclick = null;
                no.onclick = null;
                resolve(value);
            };
            yes.onclick = () => cleanup(true);
            no.onclick = () => cleanup(false);
        });
    }

    function showNextSectionConfirm(current, next) {
        return new Promise(resolve => {
            const modal = document.getElementById('competencyNextSectionModal');
            const text = document.getElementById('competencyNextSectionModalText');
            if (!modal || !text) {
                resolve(confirm(`Lanjut ke ${SECTION_META[next].label}? Setelah lanjut, ${SECTION_META[current].label} akan dikunci dan tidak bisa diubah.`));
                return;
            }
            text.textContent = `Lanjut ke ${SECTION_META[next].label}? Setelah setuju, ${SECTION_META[current].label} akan dikunci dan tidak bisa diubah lagi.`;
            modal.classList.add('active');
            const yes = document.getElementById('btnConfirmNextSectionCompetency');
            const no = document.getElementById('btnCancelNextSectionCompetency');
            const cleanup = (value) => {
                modal.classList.remove('active');
                yes.onclick = null;
                no.onclick = null;
                resolve(value);
            };
            yes.onclick = () => cleanup(true);
            no.onclick = () => cleanup(false);
        });
    }

    function installAntiCopyGuards() {
        const block = (event) => {
            if (!document.querySelector('.competency-test-page')) return;
            event.preventDefault();
        };
        ['copy', 'cut', 'contextmenu', 'selectstart'].forEach(type => document.addEventListener(type, block));
        document.addEventListener('keydown', event => {
            if (!document.querySelector('.competency-test-page')) return;
            const key = event.key.toLowerCase();
            if ((event.ctrlKey || event.metaKey) && ['c', 'x', 'a', 's', 'p'].includes(key)) event.preventDefault();
        });
    }

    function escapeCompetencyHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[char]));
    }
})();

/* ==========================================================================
   Projects Showcase
   ========================================================================== */

(function() {
    const STORAGE_KEY = 'heraiProjectSubmissions';
    const PROJECTS_API_URL = '/__gas';

    const seedProjects = [
        {
            teamName: 'Team Aurora',
            title: 'AI Mentor Matching System',
            members: 'Nadia, Putri, Salma',
            institution: 'Universitas Indonesia / Komunitas AI',
            track: 'AI Product',
            deckUrl: '#',
            demoUrl: '#',
            repoUrl: '#',
            overview: 'Platform rekomendasi mentor berbasis profil skill, tujuan belajar, dan preferensi komunikasi peserta.',
            details: 'Menggabungkan scoring rules, embedding similarity, dan dashboard monitoring untuk membantu panitia memasangkan mentor secara lebih tepat.'
        },
        {
            teamName: 'Team Lestari',
            title: 'Community Impact Analytics',
            members: 'Alya, Dinda, Kania',
            institution: 'Institut Teknologi Bandung',
            track: 'Data & Analytics',
            deckUrl: '#',
            demoUrl: '#',
            repoUrl: '#',
            overview: 'Analitik dampak sosial untuk memetakan program edukasi berbasis wilayah dan kebutuhan komunitas.',
            details: 'Dashboard menyatukan data survei, partisipasi, dan capaian pembelajaran untuk menentukan prioritas intervensi.'
        }
    ];

    window.initProjectsPage = async function() {
        bindProjectForm();
        bindProjectFilters();
        await loadRemoteProjects();
        renderProjects('all');
    };

    function bindProjectForm() {
        const form = document.getElementById('projectSubmissionForm');
        if (!form) return;
        form.onsubmit = async event => {
            event.preventDefault();
            const project = readProjectForm();
            const projects = getStoredProjects();
            projects.unshift(project);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
            const synced = await submitProjectToApi(project).then(() => true).catch(() => false);
            form.reset();
            setProjectMessage(synced
                ? 'Submission tersimpan di database final project.'
                : 'Submission tersimpan sebagai draft lokal. Database akan disinkronkan saat koneksi tersedia.');
            renderProjects('all');
        };
    }

    function bindProjectFilters() {
        const wrapper = document.getElementById('projectTrackFilters');
        if (!wrapper) return;
        wrapper.onclick = event => {
            const button = event.target.closest('[data-track]');
            if (!button) return;
            wrapper.querySelectorAll('.filter-btn').forEach(item => item.classList.remove('active'));
            button.classList.add('active');
            renderProjects(button.dataset.track);
        };
    }

    function readProjectForm() {
        return {
            teamName: valueOf('projectTeamName'),
            title: valueOf('projectTitle'),
            members: valueOf('projectMembers'),
            institution: valueOf('projectInstitution'),
            track: valueOf('projectTrack'),
            deckUrl: valueOf('projectDeckUrl'),
            demoUrl: valueOf('projectDemoUrl'),
            repoUrl: valueOf('projectRepoUrl'),
            overview: valueOf('projectOverview'),
            details: valueOf('projectDetails'),
            submittedAt: new Date().toISOString()
        };
    }

    function renderProjects(track = 'all') {
        const grid = document.getElementById('projectsGrid');
        if (!grid) return;
        const projects = getStoredProjects();
        const visible = track === 'all' ? projects : projects.filter(project => project.track === track);
        grid.innerHTML = visible.map(renderProjectCard).join('');
    }

    function renderProjectCard(project) {
        const icon = project.track === 'Data & Analytics' ? 'fa-chart-line'
            : project.track === 'Automation' ? 'fa-gears'
            : project.track === 'Social Impact' ? 'fa-hands-holding-circle'
            : 'fa-wand-magic-sparkles';
        return `
            <article class="project-card" data-track="${escapeProjectHtml(project.track)}">
                <div class="project-thumb"><i class="fas ${icon}"></i></div>
                <div class="project-info">
                    <span class="track-tag">${escapeProjectHtml(project.track)}</span>
                    <h3>${escapeProjectHtml(project.title)}</h3>
                    <p>${escapeProjectHtml(project.overview)}</p>
                    <div>
                        <strong class="author">${escapeProjectHtml(project.teamName)}</strong>
                        <p class="author">${escapeProjectHtml(project.institution)}</p>
                    </div>
                    <div class="project-links">
                        ${project.deckUrl ? `<a href="${escapeProjectHtml(project.deckUrl)}" target="_blank">Deck PDF</a>` : ''}
                        ${project.demoUrl ? `<a href="${escapeProjectHtml(project.demoUrl)}" target="_blank">Demo</a>` : ''}
                        ${project.repoUrl ? `<a href="${escapeProjectHtml(project.repoUrl)}" target="_blank">Repo</a>` : ''}
                    </div>
                </div>
            </article>
        `;
    }

    function getStoredProjects() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return stored.length ? stored : seedProjects;
        } catch {
            return seedProjects;
        }
    }

    async function loadRemoteProjects() {
        const response = await fetch(PROJECTS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'getFinalProjects' })
        }).catch(() => null);
        if (!response?.ok) return;
        const result = await response.json().catch(() => null);
        if (result?.status !== 'success' || !Array.isArray(result.projects) || !result.projects.length) return;
        const mapped = result.projects.map(project => ({
            teamName: project.team_name || project.teamName || '',
            title: project.title || '',
            members: project.members || '',
            institution: project.institution || '',
            track: project.track || '',
            deckUrl: project.deck_url || project.deckUrl || '',
            demoUrl: project.demo_url || project.demoUrl || '',
            repoUrl: project.repo_url || project.repoUrl || '',
            overview: project.overview || '',
            details: project.details || '',
            submittedAt: project.submitted_at || project.submittedAt || ''
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
    }

    async function submitProjectToApi(project) {
        const response = await fetch(PROJECTS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'submitFinalProject', ...project })
        });
        if (!response.ok) throw new Error('Project API unavailable');
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message || 'Project rejected');
        return result;
    }

    function setProjectMessage(message) {
        const el = document.getElementById('projectSubmitMessage');
        if (el) el.textContent = message;
    }

    function valueOf(id) {
        return document.getElementById(id)?.value.trim() || '';
    }

    function escapeProjectHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[char]));
    }
})();

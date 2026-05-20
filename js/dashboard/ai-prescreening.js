/* ==========================================================================
   js/ai-prescreening.js
   Ultimate AI Pre-Screening Engine (Groq Llama 3)
   ========================================================================== */

   const AI_API_URL = '/__gas';
   const AI_CACHE_KEY = 'heraiAiCandidatesCache';
   const AI_CACHE_TTL_MS = 5 * 60 * 1000;
   const AI_MIN_REQUEST_GAP_MS = 8000;
   let aiCandidatesData = [];
   let activeCandidateId = null;
   
   let aiAbortController = null; 
   let scanTimes = []; 
   let analyzedCount = 0;
   let lastAiRequestAt = 0;
   
   window.initAiPreScreening = async function() {
       console.log('🤖 AI Engine Initialized');
       if (typeof window.loadSidebar === 'function') await window.loadSidebar('nav-ai');
       if (!sessionStorage.getItem('isAdminLoggedIn')) {
           window.location.hash = "#/dashboard"; return;
       }
   
       injectCustomWarningModal(); // Injeksi UI untuk pop-up peringatan
   
       const searchAiQueue = document.getElementById('searchAiQueue');
       const filterAiQueue = document.getElementById('filterAiQueue');
       const btnRefreshAiQueue = document.getElementById('btnRefreshAiQueue');
       const btnSelectNextAi = document.getElementById('btnSelectNextAi');
       const btnRunAi = document.getElementById('btnRunAi');
   
       if (searchAiQueue) {
           const newSearch = searchAiQueue.cloneNode(true);
           searchAiQueue.parentNode.replaceChild(newSearch, searchAiQueue);
           newSearch.addEventListener('input', renderAiQueue);
       }

       if (filterAiQueue) {
           const newFilter = filterAiQueue.cloneNode(true);
           filterAiQueue.parentNode.replaceChild(newFilter, filterAiQueue);
           newFilter.addEventListener('change', renderAiQueue);
       }

       if (btnRefreshAiQueue) {
           const newRefresh = btnRefreshAiQueue.cloneNode(true);
           btnRefreshAiQueue.parentNode.replaceChild(newRefresh, btnRefreshAiQueue);
           newRefresh.addEventListener('click', () => fetchAiCandidates({ force: true }));
       }

       if (btnSelectNextAi) {
           const newNext = btnSelectNextAi.cloneNode(true);
           btnSelectNextAi.parentNode.replaceChild(newNext, btnSelectNextAi);
           newNext.addEventListener('click', selectNextUnscannedCandidate);
       }
   
       if (btnRunAi) {
           const newBtnRunAi = btnRunAi.cloneNode(true);
           btnRunAi.parentNode.replaceChild(newBtnRunAi, btnRunAi);
           document.getElementById('btnRunAi').addEventListener('click', handleAiButtonClick);
       }
   
       const queueList = document.getElementById('aiCandidateList');
       if (queueList) {
           queueList.replaceWith(queueList.cloneNode(true));
           document.getElementById('aiCandidateList').addEventListener('click', function(e) {
               const item = e.target.closest('.queue-item');
               if (item) selectCandidateForAi(parseInt(item.getAttribute('data-id')));
           });
       }
   
       // Pastikan kotak Motivasi terlihat (menimpa kode lama yang menyembunyikan)
       const motiBox = document.getElementById('aiMotivationText');
       if (motiBox) motiBox.closest('div').style.display = 'block';
   
       fetchAiCandidates();
   };
   
   // --- FUNGSI INJEKSI MODAL CUSTOM UNTUK WARNING ---
   function injectCustomWarningModal() {
       if (document.getElementById('aiWarningModal')) return;
       const modalHTML = `
           <div class="modal-overlay" id="aiWarningModal" style="z-index: 10000;">
               <div class="modal-content glass-panel" style="max-width: 400px; text-align: center; padding: 30px;">
                   <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--warning); margin-bottom: 15px;"></i>
                   <h3 style="color: var(--dark-purple); margin: 0 0 10px 0;">Analisis Sedang Berjalan</h3>
                   <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">Harap tunggu proses analisis AI selesai untuk kandidat saat ini, atau klik tombol <strong>Batalkan Analisis</strong> terlebih dahulu.</p>
                   <button class="btn-cyber" onclick="document.getElementById('aiWarningModal').classList.remove('active'); document.body.style.overflow='auto';" style="background: var(--dark-purple); width: 100%; justify-content: center;">Mengerti</button>
               </div>
           </div>
       `;
       document.body.insertAdjacentHTML('beforeend', modalHTML);
   }
   
   function showWarningModal() {
       document.getElementById('aiWarningModal').classList.add('active');
       document.body.style.overflow = 'hidden';
   }
   
   async function fetchAiCandidates(options = {}) {
       const listContainer = document.getElementById('aiCandidateList');
       if (!listContainer) return;
   
       listContainer.innerHTML = `<div style="text-align: center; padding: 40px 0;"><i class="fas fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--icon-blue);"></i></div>`;
   
       try {
           if (!options.force) {
               const cached = readAiCandidateCache();
               if (cached) {
                   aiCandidatesData = cached;
                   analyzedCount = aiCandidatesData.filter(isParticipantScanned).length;
                   updateTopStats();
                   renderAiQueue();
                   updateAiRateStatus('Data kandidat memakai cache lokal. Klik refresh jika perlu sinkron ulang.');
                   return;
               }
           }

           const response = await fetch(AI_API_URL, {
               method: 'POST',
               headers: { 'Content-Type': 'text/plain;charset=utf-8' },
               body: JSON.stringify({ action: 'getData' })
           });
           const result = await response.json();
           
           if (result.status === 'success') {
               aiCandidatesData = result.data.reverse();
               writeAiCandidateCache(aiCandidatesData);
               analyzedCount = aiCandidatesData.filter(isParticipantScanned).length;
               updateTopStats();
               renderAiQueue();
               updateAiRateStatus('Data kandidat tersinkron. Mode aman GAS aktif: jeda minimal 8 detik per analisis.');
           }
       } catch (error) {
           listContainer.innerHTML = `<div style="color: var(--danger); padding: 20px;">Gagal memuat kandidat.</div>`;
       }
   }

   function readAiCandidateCache() {
       try {
           const cache = JSON.parse(sessionStorage.getItem(AI_CACHE_KEY) || 'null');
           if (!cache || !Array.isArray(cache.data)) return null;
           if (Date.now() - cache.savedAt > AI_CACHE_TTL_MS) return null;
           return cache.data;
       } catch {
           return null;
       }
   }

   function writeAiCandidateCache(data) {
       sessionStorage.setItem(AI_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
   }
   
   function updateTopStats() {
       const statAnalyzed = document.getElementById('statAiAnalyzed');
       const statTime = document.getElementById('statAiTime'); 
   
       if (statAnalyzed) statAnalyzed.innerText = `${analyzedCount} / ${aiCandidatesData.length}`;
       
       if (statTime) {
           if (scanTimes.length === 0) {
               statTime.innerText = "0.0s";
           } else {
               const avg = scanTimes.reduce((a, b) => a + b, 0) / scanTimes.length;
               statTime.innerText = `${avg.toFixed(1)}s`;
           }
       }
   }
   
   function renderAiQueue() {
       const listContainer = document.getElementById('aiCandidateList');
       const searchVal = document.getElementById('searchAiQueue') ? document.getElementById('searchAiQueue').value.toLowerCase() : '';
       const filterVal = document.getElementById('filterAiQueue') ? document.getElementById('filterAiQueue').value : 'all';
       if (!listContainer) return;
       
       listContainer.innerHTML = '';
       const filtered = aiCandidatesData.filter(p => {
           const matchSearch = String(p.nama_lengkap || "").toLowerCase().includes(searchVal);
           const isScanned = isParticipantScanned(p);
           const matchFilter = filterVal === 'all' || (filterVal === 'scanned' && isScanned) || (filterVal === 'unscanned' && !isScanned);
           return matchSearch && matchFilter;
       });

       if (filtered.length === 0) {
           listContainer.innerHTML = `<div style="text-align:center; color: var(--text-muted); padding: 30px 10px;">Tidak ada kandidat pada filter ini.</div>`;
           return;
       }
   
       filtered.forEach(p => {
           let statusBadge = p.is_scanned 
               ? `<span class="badge lolos" style="font-size: 0.7rem;"><i class="fas fa-check-circle"></i> Scanned</span>`
               : `<span class="badge pending" style="font-size: 0.7rem;"><i class="fas fa-clock"></i> Unscanned</span>`;
           
           const isActive = activeCandidateId === p.rowId ? 'active' : '';
   
           const itemHTML = `
               <div class="queue-item ${isActive}" data-id="${p.rowId}" style="padding: 15px; border: 1px solid var(--gray-border); border-radius: 12px; margin-bottom: 10px; cursor: pointer;">
                   <div style="display: flex; justify-content: space-between; align-items: center;">
                       <div>
                           <h4 style="color: var(--dark-purple); margin: 0 0 5px 0; font-size: 0.95rem;">${p.nama_lengkap || "Unknown"}</h4>
                           <p style="color: var(--text-muted); font-size: 0.8rem; margin: 0;">${p.univ || p.instansi || p.status_kerja || "-"}</p>
                       </div>
                       <div class="status-container">${statusBadge}</div>
                   </div>
               </div>
           `;
           listContainer.insertAdjacentHTML('beforeend', itemHTML);
       });
   }

   function selectNextUnscannedCandidate() {
       if (aiAbortController) {
           showWarningModal();
           return;
       }
       const next = aiCandidatesData.find(p => !isParticipantScanned(p));
       if (!next) {
           updateAiRateStatus('Semua kandidat sudah discan.');
           return;
       }
       activeCandidateId = next.rowId;
       selectCandidateForAi(next.rowId);
   }
   
   function selectCandidateForAi(rowId) {
       if (aiAbortController) {
           showWarningModal(); // Tampilkan Pop-Up custom
           return;
       }
   
       activeCandidateId = rowId;
       renderAiQueue(); 
   
       const p = aiCandidatesData.find(x => x.rowId === rowId);
       if (!p) return;
   
       document.getElementById('aiEmptyState').style.display = 'none';
       document.getElementById('aiResultState').style.display = 'flex';
       document.getElementById('aiTargetName').innerText = p.nama_lengkap || "-";
       document.getElementById('aiTargetBackground').innerText = `${p.status_kerja ? p.status_kerja.toUpperCase() : ''} - ${p.univ || p.instansi || '-'}`;
   
       const btnRun = document.getElementById('btnRunAi');
   
       const aiData = getAiAnalysisData(p);
       if (isParticipantScanned(p) && aiData) {
           btnRun.innerHTML = '<i class="fas fa-sync-alt"></i> Pindai Ulang (Rescan)';
           btnRun.style.background = '#f59e0b'; 
           btnRun.style.borderColor = '#f59e0b';
           
           let parsedAnalysis = {};
           try { parsedAnalysis = JSON.parse(aiData.ai_summary); } catch(e) {}
           
           renderAiResults({
               essay_analysis: parsedAnalysis,
               motivation: aiData.ai_motivation,
               skills: String(aiData.ai_skills || '').split(", ").filter(Boolean),
               score: aiData.ai_score,
               rubric: getAiRubricScores(p)
           });
       } else {
           btnRun.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Generate Insight';
           btnRun.style.background = 'var(--dark-purple)';
           btnRun.style.borderColor = 'var(--dark-purple)';
   
           document.getElementById('aiSummaryList').innerHTML = `<p style="color: var(--text-muted);">Belum ada data analisis.</p>`;
           document.getElementById('aiSkillsTags').innerHTML = `<span style="color: var(--text-muted);">-</span>`;
           document.getElementById('aiMotivationText').innerHTML = `<span style="color: var(--text-muted);">-</span>`;
           document.getElementById('aiScoreWidget').style.display = 'none';
           document.getElementById('aiRubricWidget').style.display = 'none';
       }
   }
   
   function handleAiButtonClick() {
       if (aiAbortController) cancelAiAnalysis();
       else executeAiAnalysis();
   }
   
   function cancelAiAnalysis() {
       if (aiAbortController) {
           aiAbortController.abort(); 
           aiAbortController = null;
           
           const btnRun = document.getElementById('btnRunAi');
           btnRun.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Generate Insight';
           btnRun.style.background = 'var(--dark-purple)';
           btnRun.style.borderColor = 'var(--dark-purple)';
           
           document.getElementById('aiScanningOverlay').style.display = 'none';
           document.getElementById('aiSummaryList').innerHTML = `<p style="color: var(--danger);"><i class="fas fa-ban"></i> Analisis dibatalkan.</p>`;
       }
   }
   
   async function executeAiAnalysis() {
       if (!activeCandidateId) return;
       const participant = aiCandidatesData.find(p => p.rowId === activeCandidateId);
       const waitMs = AI_MIN_REQUEST_GAP_MS - (Date.now() - lastAiRequestAt);
       if (waitMs > 0) {
           await waitForAiCooldown(waitMs);
       }
   
       const overlay = document.getElementById('aiScanningOverlay');
       const btnRun = document.getElementById('btnRunAi');
       
       overlay.style.display = 'flex';
       btnRun.innerHTML = '<i class="fas fa-times-circle"></i> Batalkan Analisis';
       btnRun.style.background = 'var(--danger)';
       btnRun.style.borderColor = 'var(--danger)';
   
       aiAbortController = new AbortController();
       lastAiRequestAt = Date.now();
       const startTime = Date.now();
   
       try {
           const response = await fetch(AI_API_URL, {
               method: 'POST',
               headers: { 'Content-Type': 'text/plain;charset=utf-8' },
               body: JSON.stringify({ action: 'runAiAnalysis', participant: participant }),
               signal: aiAbortController.signal 
           });
           const result = await response.json();
   
           if (result.status === 'success') {
               const timeInSeconds = (Date.now() - startTime) / 1000;
               scanTimes.push(timeInSeconds);
   
               if (!isParticipantScanned(participant)) {
                   participant.is_scanned = true;
                   analyzedCount++;
               }
               participant.ai_data = {
                   ai_summary: JSON.stringify(result.data.essay_analysis),
                   ai_motivation: result.data.motivation || "-",
                   ai_skills: Array.isArray(result.data.skills) ? result.data.skills.join(", ") : "-",
                   ai_score: result.data.score || 0
               };
               participant.ai_summary = participant.ai_data.ai_summary;
               participant.ai_motivation = participant.ai_data.ai_motivation;
               participant.ai_skills = participant.ai_data.ai_skills;
               participant.ai_score = participant.ai_data.ai_score;
               writeAiCandidateCache(aiCandidatesData);
   
               renderAiResults(result.data);
               updateTopStats();
               renderAiQueue(); 
               selectCandidateForAi(activeCandidateId); 
           } else {
                throw new Error(result.message);
           }
       } catch (error) {
           if (error.name !== 'AbortError') {
               document.getElementById('aiSummaryList').innerHTML = `<p style="color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> Gagal: ${error.message}</p>`;
           }
       } finally {
           if (aiAbortController) {
               overlay.style.display = 'none';
               aiAbortController = null;
               if(!isParticipantScanned(participant)) selectCandidateForAi(activeCandidateId);
           }
       }
   }

   function getAiAnalysisData(participant) {
       if (!participant) return null;
       if (participant.ai_data) return participant.ai_data;
       if (!participant.ai_summary && !participant.ai_score && !participant.ai_motivation && !participant.ai_skills) return null;
       return {
           ai_summary: participant.ai_summary || '{}',
           ai_motivation: participant.ai_motivation || '-',
           ai_skills: participant.ai_skills || '',
           ai_score: participant.ai_score || 0
       };
   }

   function isParticipantScanned(participant) {
       const scanned = String(participant?.is_scanned ?? '').toLowerCase();
       if (participant?.is_scanned === true || ['true', 'yes', '1', 'scanned', 'done'].includes(scanned)) return true;
       return !!getAiAnalysisData(participant);
   }

   function waitForAiCooldown(waitMs) {
       return new Promise(resolve => {
           const endAt = Date.now() + waitMs;
           const btnRun = document.getElementById('btnRunAi');
           const tick = () => {
               const remaining = Math.max(0, endAt - Date.now());
               updateAiRateStatus(`Menunggu cooldown GAS ${(remaining / 1000).toFixed(1)} detik sebelum request berikutnya...`);
               if (btnRun) btnRun.disabled = true;
               if (remaining <= 0) {
                   if (btnRun) btnRun.disabled = false;
                   updateAiRateStatus('Cooldown selesai. Mengirim analisis...');
                   resolve();
               } else {
                   setTimeout(tick, 250);
               }
           };
           tick();
       });
   }

   function updateAiRateStatus(message) {
       const status = document.getElementById('aiRateStatus');
       if (status) status.textContent = message;
   }
   
   function renderAiResults(insight) {
       // 1. Render 5 Esai
       let analysisHtml = '';
       if (insight.essay_analysis) {
           const qMap = {
               "q1_about": "About Yourself",
               "q2_reason": "Reason Choosing Program",
               "q3_impact": "Future Career Impact",
               "q4_expectations": "Expectations to Join",
               "q5_outstanding": "Outstanding Traits"
           };
           
           for (const [key, title] of Object.entries(qMap)) {
               let content = insight.essay_analysis[key] || "Tidak ada jawaban.";
               if (typeof content === 'object') {
                   content = Object.values(content).join(" | ");
               }
   
               analysisHtml += `
                   <div style="margin-bottom: 15px; padding: 15px; background: #fafbfe; border: 1px solid var(--gray-border); border-radius: 8px;">
                       <h5 style="margin: 0 0 5px 0; color: var(--dark-purple); font-size: 0.85rem; text-transform: uppercase;">${title}</h5>
                       <p style="margin: 0; font-size: 0.9rem; color: var(--text-dark); line-height: 1.5;">${content}</p>
                   </div>
               `;
           }
       } else {
           analysisHtml = '<p style="color: var(--danger);">Format analisis JSON gagal digenerate.</p>';
       }
       document.getElementById('aiSummaryList').innerHTML = analysisHtml;
   
       // 2. Render Motivasi
       document.getElementById('aiMotivationText').innerHTML = insight.motivation || "Tidak ada data motivasi.";
   
       // 3. Render Skills
       let skillsArray = Array.isArray(insight.skills) ? insight.skills : (insight.skills ? insight.skills.split(",") : []);
       let skillsHtml = skillsArray.length > 0 ? skillsArray.map(s => `<span class="skill-tag">${s.trim()}</span>`).join('') : '<span class="skill-tag">No skills extracted</span>';
       document.getElementById('aiSkillsTags').innerHTML = skillsHtml;
   
       // 4. Render Skor AI
       const scoreWidget = document.getElementById('aiScoreWidget');
       const scoreValue = document.getElementById('aiScoreValue');
       
       if (insight.score !== undefined && insight.score !== null) {
           scoreValue.innerText = insight.score;
           scoreWidget.style.display = 'block'; 
           renderAiRubricWidget(insight);
           
           if (insight.score >= 80) {
               scoreValue.style.color = 'var(--success)'; 
               scoreWidget.style.borderColor = 'rgba(5, 205, 153, 0.2)';
               scoreWidget.style.background = 'rgba(5, 205, 153, 0.05)';
           } else if (insight.score >= 60) {
               scoreValue.style.color = '#f59e0b';
               scoreWidget.style.borderColor = 'rgba(245, 158, 11, 0.2)';
               scoreWidget.style.background = 'rgba(245, 158, 11, 0.05)';
           } else {
               scoreValue.style.color = 'var(--danger)';
               scoreWidget.style.borderColor = 'rgba(230, 57, 70, 0.2)';
               scoreWidget.style.background = 'rgba(230, 57, 70, 0.05)';
           }
       } else {
           scoreWidget.style.display = 'none';
           document.getElementById('aiRubricWidget').style.display = 'none';
       }
   }

   function renderAiRubricWidget(insight) {
       const widget = document.getElementById('aiRubricWidget');
       const grid = document.getElementById('aiRubricGrid');
       if (!widget || !grid) return;
       const rubric = insight.rubric || getAiRubricScores({ ai_score: insight.score });
       grid.innerHTML = [
           ['Logika', rubric.logika],
           ['Motivasi', rubric.motivasi],
           ['Teknis', rubric.teknis],
           ['Latar', rubric.latar]
       ].map(([label, value]) => `<span><small>${label}</small>${value}/10</span>`).join('');
       widget.style.display = 'block';
   }

   function getAiRubricScores(participant) {
       const score = Math.max(0, Math.min(100, Number(participant?.ai_score || participant?.ai_data?.ai_score || 0)));
       const base = Math.max(1, Math.round(score / 10));
       return {
           logika: clampRubric(Number(participant?.skor_logika) || base),
           motivasi: clampRubric(Number(participant?.skor_motivasi) || base),
           teknis: clampRubric(Number(participant?.skor_teknis) || base),
           latar: clampRubric(Number(participant?.skor_latar) || base)
       };
   }

   function clampRubric(value) {
       return Math.max(0, Math.min(10, Number(value) || 0));
   }

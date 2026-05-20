/* ==========================================================================
   js/skoring.js
   Logic Sistem Skoring & Leaderboard Data Sorcerers
   ========================================================================== */

   const SKORING_API_URL = '/__gas';
   let scoringData = [];
   let filteredScoringData = [];
   let currentSkoringPage = 1;
   let skoringPageSize = 25;
   
   // INI KUNCINYA: Harus ada "async" sebelum function()
   window.initSkoringLogic = async function() {
       console.log('📊 Scoring System Initialized');
       
       // Panggil Sidebar dengan aman
       if (typeof window.loadSidebar === 'function') {
           await window.loadSidebar('nav-skoring');
       }
       
       const btnSyncSkor = document.getElementById('btnSyncSkor');
       const searchSkoring = document.getElementById('searchSkoring');
       const skoringPageSizeSelect = document.getElementById('skoringPageSizeSelect');
       
       if (!btnSyncSkor || !searchSkoring || !skoringPageSizeSelect) return;
   
       // Hapus event listener lama (Metode SPA Safe)
       const newBtnSync = btnSyncSkor.cloneNode(true);
       btnSyncSkor.parentNode.replaceChild(newBtnSync, btnSyncSkor);
       newBtnSync.addEventListener('click', fetchSkoringData);
   
       const newSearch = searchSkoring.cloneNode(true);
       searchSkoring.parentNode.replaceChild(newSearch, searchSkoring);
       newSearch.addEventListener('input', () => {
           currentSkoringPage = 1;
           renderSkoringTable();
       });

       const newPageSizeSelect = skoringPageSizeSelect.cloneNode(true);
       skoringPageSizeSelect.parentNode.replaceChild(newPageSizeSelect, skoringPageSizeSelect);
       newPageSizeSelect.addEventListener('change', () => {
           skoringPageSize = Number(newPageSizeSelect.value) || 25;
           currentSkoringPage = 1;
           renderSkoringTable();
       });

       const btnPrevSkoringPage = document.getElementById('btnPrevSkoringPage');
       const btnNextSkoringPage = document.getElementById('btnNextSkoringPage');
       if (btnPrevSkoringPage) {
           btnPrevSkoringPage.onclick = () => {
               if (currentSkoringPage > 1) {
                   currentSkoringPage -= 1;
                   renderSkoringTable();
               }
           };
       }
       if (btnNextSkoringPage) {
           btnNextSkoringPage.onclick = () => {
               const totalPages = Math.max(1, Math.ceil(filteredScoringData.length / skoringPageSize));
               if (currentSkoringPage < totalPages) {
                   currentSkoringPage += 1;
                   renderSkoringTable();
               }
           };
       }
   
       // Event Tutup Modal
       const btnCloseSkoring = document.getElementById('btnCloseSkoring');
       if (btnCloseSkoring) {
           btnCloseSkoring.addEventListener('click', () => {
               document.getElementById('skoringModal').classList.remove('active');
               document.body.style.overflow = 'auto';
           });
       }
   
       // Event Slider Live Update
       const sliders = ['skorLogika', 'skorMotivasi', 'skorTeknis', 'skorLatarBelakang'];
       sliders.forEach(id => {
           const slider = document.getElementById(id);
           if (slider) slider.addEventListener('input', updateLiveScore);
       });
   
       // Event Simpan Skor
       const btnSaveSkor = document.getElementById('btnSaveSkor');
       if (btnSaveSkor) {
           btnSaveSkor.addEventListener('click', saveSkor);
       }
       document.getElementById('btnAcceptSkoring')?.addEventListener('click', () => setStageOneDecision('lolos'));
       document.getElementById('btnRejectSkoring')?.addEventListener('click', () => setStageOneDecision('gugur'));
   
       // Buka Modal Detail (Event Delegation)
       const skoringTableBody = document.getElementById('skoringTableBody');
       if (skoringTableBody) {
           // Clone untuk cegah listener numpuk
           skoringTableBody.replaceWith(skoringTableBody.cloneNode(true));
           const freshTableBody = document.getElementById('skoringTableBody');
           
           freshTableBody.addEventListener('click', function(e) {
               const btnScore = e.target.closest('.btn-score');
               if (btnScore) {
                   const rowId = parseInt(btnScore.getAttribute('data-id'));
                   openSkoringModal(rowId);
                   return;
               }
               const btnDecision = e.target.closest('[data-skoring-decision]');
               if (btnDecision) {
                   const rowId = parseInt(btnDecision.getAttribute('data-id'));
                   setStageOneDecision(btnDecision.dataset.skoringDecision, rowId);
               }
           });
       }
   
       // Jika belum login, redirect ke halaman Overview (karena login overlay ada di sana)
       if (!sessionStorage.getItem('isAdminLoggedIn')) {
           alert("Sesi Admin belum aktif. Silakan login dari halaman Overview.");
           window.location.hash = "#/dashboard";
       } else {
           fetchSkoringData();
       }
   };
   
   async function fetchSkoringData() {
       const tableBody = document.getElementById('skoringTableBody');
       const btnSync = document.getElementById('btnSyncSkor');
       
       if (!tableBody || !btnSync) return;
   
       btnSync.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Syncing...';
       tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px;"><i class="fas fa-circle-notch fa-spin" style="color: var(--primary-pink); font-size: 2rem;"></i><p style="color: var(--text-muted); margin-top: 10px;">Mengambil data kalkulasi...</p></td></tr>`;
   
       try {
           const payload = { action: 'getData' };
           const response = await fetch(SKORING_API_URL, {
               method: 'POST',
               headers: { 'Content-Type': 'text/plain;charset=utf-8' },
               body: JSON.stringify(payload)
           });
           
           const result = await response.json();
           
           if (result.status === 'success') {
               scoringData = result.data;
               scoringData = scoringData.map(p => ({
                   ...p,
                   ai_score: toNumber(p.ai_score),
                   skor_logika: toNumber(p.skor_logika),
                   skor_motivasi: toNumber(p.skor_motivasi),
                   skor_teknis: toNumber(p.skor_teknis),
                   skor_latar: toNumber(p.skor_latar),
                   skor_akhir: toNumber(p.skor_akhir)
               }));
               
               // Leaderboard berbasis AI Pre-Screening, lalu bisa dioverride nilai reviewer.
               scoringData.sort((a, b) => getEffectiveRankingScore(b) - getEffectiveRankingScore(a));
               renderSkoringTable();
           } else {
               throw new Error(result.message);
           }
       } catch (error) {
           console.error(error);
           tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--danger); padding:20px;">Gagal menarik data.</td></tr>`;
       } finally {
           btnSync.innerHTML = '<i class="fas fa-sync-alt"></i> Sync Data';
       }
   }
   
   function renderSkoringTable() {
       const tableBody = document.getElementById('skoringTableBody');
       const searchInput = document.getElementById('searchSkoring');
       const pageSizeSelect = document.getElementById('skoringPageSizeSelect');
       const searchVal = searchInput ? searchInput.value.toLowerCase() : "";
       skoringPageSize = pageSizeSelect ? Number(pageSizeSelect.value) || 25 : skoringPageSize;
       
       if (!tableBody) return;
       
       tableBody.innerHTML = '';
   
       filteredScoringData = scoringData.filter(p => String(p.nama_lengkap || "").toLowerCase().includes(searchVal));
       const totalItems = filteredScoringData.length;
       const totalPages = Math.max(1, Math.ceil(totalItems / skoringPageSize));
       if (currentSkoringPage > totalPages) currentSkoringPage = totalPages;
       const startIndex = (currentSkoringPage - 1) * skoringPageSize;
       const visibleRows = filteredScoringData.slice(startIndex, startIndex + skoringPageSize);
   
       if (totalItems === 0) {
           tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px; color: var(--text-muted);">Tidak ada kandidat ditemukan.</td></tr>';
           updateSkoringPagination(0, 0, 0, 1, 1);
           updateSkoringStats(filteredScoringData);
           return;
       }
   
       visibleRows.forEach((p, index) => {
           const rankNumber = startIndex + index + 1;
           const tr = document.createElement('tr');
           const aiScore = getAiScore(p);
           const reviewerAverage = getReviewerAverage(p);
           const displayAverage = reviewerAverage > 0 ? reviewerAverage : getAiBaselineAverage(p);
           const rankingScore = getEffectiveRankingScore(p);
           const sourceLabel = hasReviewerScore(p) ? 'Reviewer override' : 'AI baseline';
           const decisionStatus = getStageOneStatus(p);
           const displayRubric = getDisplayRubric(p);
           
           // Peringkat Top 3 diberi warna khusus
           let rankBadge = `<span class="rank-badge">#${rankNumber}</span>`;
           if(rankNumber === 1 && rankingScore > 0) rankBadge = `<span class="rank-badge top gold"><i class="fas fa-crown"></i> #1</span>`;
           if(rankNumber === 2 && rankingScore > 0) rankBadge = `<span class="rank-badge top silver"><i class="fas fa-medal"></i> #2</span>`;
           if(rankNumber === 3 && rankingScore > 0) rankBadge = `<span class="rank-badge top bronze"><i class="fas fa-medal"></i> #3</span>`;
   
           tr.innerHTML = `
               <td class="rank-cell">${rankBadge}</td>
               <td class="candidate-info-cell">
                   <span class="candidate-cell" title="${escapeAttr(p.nama_lengkap || "-")}">${escapeHtml(p.nama_lengkap || "-")}</span>
                   <span class="candidate-meta">${escapeHtml(p.univ || p.instansi || p.status_kerja || '-')}</span>
                   <span class="score-source ${hasReviewerScore(p) ? 'reviewer' : 'ai'}">${sourceLabel}</span>
               </td>
               <td class="score-number-cell"><strong>${aiScore > 0 ? aiScore.toFixed(0) : '-'}</strong><small>/100</small></td>
               <td class="score-number-cell reviewer-score"><strong>${displayAverage > 0 ? displayAverage.toFixed(1) : '-'}</strong><small>/10 ${reviewerAverage > 0 ? '' : 'AI'}</small></td>
               <td class="rubric-cell">${renderRubricCluster(displayRubric, reviewerAverage > 0)}</td>
               <td class="status-cell">${renderDecisionBadge(decisionStatus)}</td>
               <td class="actions-cell">
                   <div class="skoring-row-actions">
                       <button class="btn-action btn-score" data-id="${p.rowId}" title="Edit nilai lengkap" aria-label="Edit nilai"><i class="fas fa-pen"></i></button>
                       <button class="btn-action btn-mini-accept" data-skoring-decision="lolos" data-id="${p.rowId}" title="Lolos Tahap 1"><i class="fas fa-check"></i></button>
                       <button class="btn-action btn-mini-reject" data-skoring-decision="gugur" data-id="${p.rowId}" title="Gugur Tahap 1"><i class="fas fa-times"></i></button>
                   </div>
               </td>
           `;
           tableBody.appendChild(tr);
       });

       updateSkoringPagination(startIndex + 1, startIndex + visibleRows.length, totalItems, currentSkoringPage, totalPages);
       updateSkoringStats(filteredScoringData);
   }

   function updateSkoringStats(data) {
       let dinilaiCount = 0;
       let totalScoreAll = 0;
       let highestScore = 0;

       data.forEach(p => {
           const score = getEffectiveRankingScore(p);
           if(score > 0) {
               dinilaiCount++;
               totalScoreAll += score;
               if(score > highestScore) highestScore = score;
           }
       });

       const statDinilai = document.getElementById('statDinilai');
       const statTertinggi = document.getElementById('statTertinggi');
       const statRataRata = document.getElementById('statRataRata');
       
       if (statDinilai) statDinilai.innerText = dinilaiCount;
       if (statTertinggi) statTertinggi.innerText = highestScore.toFixed(0);
       if (statRataRata) statRataRata.innerText = dinilaiCount > 0 ? (totalScoreAll / dinilaiCount).toFixed(0) : "0";
   }

   function toNumber(value) {
       const number = parseFloat(value);
       return Number.isFinite(number) ? number : 0;
   }

   function getAiScore(participant) {
       if (toNumber(participant.ai_score) > 0) return toNumber(participant.ai_score);
       if (participant.ai_data && toNumber(participant.ai_data.ai_score) > 0) return toNumber(participant.ai_data.ai_score);
       return 0;
   }

   function getStageOneStatus(participant) {
       const raw = String(participant.status_seleksi || participant.status_tahap_1 || participant.participant_stage || 'pending').toLowerCase();
       if (['lolos', 'accepted', 'accepted_stage_1', 'passed_stage_1'].includes(raw)) return 'lolos';
       if (['gugur', 'rejected', 'rejected_stage_1', 'failed_stage_1'].includes(raw)) return 'gugur';
       return 'pending';
   }

   function renderDecisionBadge(status) {
       const label = status === 'lolos' ? 'Lolos Tahap 1' : status === 'gugur' ? 'Gugur Tahap 1' : 'Pending Review';
       const badgeClass = status === 'lolos' ? 'lolos' : status === 'gugur' ? 'gugur' : 'pending';
       const icon = status === 'lolos' ? 'fa-check-circle' : status === 'gugur' ? 'fa-times-circle' : 'fa-clock';
       return `<span class="decision-pill ${badgeClass}"><i class="fas ${icon}"></i>${label}</span>`;
   }

   function hasReviewerScore(participant) {
       return getReviewerAverage(participant) > 0;
   }

   function getReviewerAverage(participant) {
       const savedAverage = toNumber(participant.skor_akhir);
       if (savedAverage > 10) return savedAverage / 10;
       if (savedAverage > 0) return savedAverage;

       const scores = [
           toNumber(participant.skor_logika),
           toNumber(participant.skor_motivasi),
           toNumber(participant.skor_teknis),
           toNumber(participant.skor_latar)
       ];
       const filled = scores.filter(score => score > 0);
       if (filled.length === 0) return 0;
       return filled.reduce((sum, score) => sum + score, 0) / filled.length;
   }

   function getAiBaselineAverage(participant) {
       const score = getAiScore(participant);
       return score > 0 ? Math.max(1, Math.min(10, score / 10)) : 0;
   }

   function getDisplayRubric(participant) {
       const aiBase = Math.round(getAiBaselineAverage(participant));
       return {
           logika: toNumber(participant.skor_logika) || aiBase,
           motivasi: toNumber(participant.skor_motivasi) || aiBase,
           teknis: toNumber(participant.skor_teknis) || aiBase,
           latar: toNumber(participant.skor_latar) || aiBase
       };
   }

   function renderRubricCell(value, isReviewer) {
       if (!value) return '-';
       return `${value}<small class="score-caption">${isReviewer ? '' : ' AI'}</small>`;
   }

   function renderRubricCluster(rubric, isReviewer) {
       const source = isReviewer ? 'REV' : 'AI';
       return `
           <div class="rubric-cluster">
               <span><small>L</small>${rubric.logika || '-'}<em>${source}</em></span>
               <span><small>M</small>${rubric.motivasi || '-'}<em>${source}</em></span>
               <span><small>T</small>${rubric.teknis || '-'}<em>${source}</em></span>
               <span><small>B</small>${rubric.latar || '-'}<em>${source}</em></span>
           </div>
       `;
   }

   function getEffectiveRankingScore(participant) {
       const reviewerAverage = getReviewerAverage(participant);
       if (reviewerAverage > 0) return reviewerAverage * 10;
       return getAiScore(participant);
   }

   function updateSkoringPagination(start, end, total, page, totalPages) {
       const pageInfo = document.getElementById('skoringPageInfo');
       const pageIndicator = document.getElementById('skoringPageIndicator');
       const btnPrev = document.getElementById('btnPrevSkoringPage');
       const btnNext = document.getElementById('btnNextSkoringPage');

       if (pageInfo) {
           pageInfo.textContent = total === 0
               ? 'Menampilkan 0 data'
               : `Menampilkan ${start}-${end} dari ${total} data`;
       }
       if (pageIndicator) pageIndicator.textContent = `${page} / ${totalPages}`;
       if (btnPrev) btnPrev.disabled = page <= 1 || total === 0;
       if (btnNext) btnNext.disabled = page >= totalPages || total === 0;
   }

   function escapeAttr(value) {
       return String(value || "")
           .replace(/&/g, "&amp;")
           .replace(/"/g, "&quot;")
           .replace(/</g, "&lt;")
           .replace(/>/g, "&gt;");
   }

   function escapeHtml(value) {
       return String(value || "")
           .replace(/&/g, "&amp;")
           .replace(/</g, "&lt;")
           .replace(/>/g, "&gt;")
           .replace(/"/g, "&quot;")
           .replace(/'/g, "&#039;");
   }
   
   function openSkoringModal(rowId) {
       const participant = scoringData.find(p => p.rowId === rowId);
       if(!participant) return;
   
       document.getElementById('skoringRowId').value = rowId;
       document.getElementById('kandidatNama').innerText = participant.nama_lengkap || "Nama Kosong";
       document.getElementById('kandidatUniv').innerText = `${participant.univ || participant.instansi || "Afiliasi Kosong"} • AI Score: ${getAiScore(participant) || 0}/100 • Status: ${getStageOneStatus(participant).toUpperCase()}`;
   
       const aiBaseline = Math.max(0, Math.min(10, Math.round(getAiScore(participant) / 10)));
       document.getElementById('skorLogika').value = participant.skor_logika || aiBaseline;
       document.getElementById('skorMotivasi').value = participant.skor_motivasi || aiBaseline;
       document.getElementById('skorTeknis').value = participant.skor_teknis || aiBaseline;
       document.getElementById('skorLatarBelakang').value = participant.skor_latar || aiBaseline;
   
       updateLiveScore();
   
       document.getElementById('skoringModal').classList.add('active');
       document.body.style.overflow = 'hidden';
   }
   
   function updateLiveScore() {
       const sLogika = parseInt(document.getElementById('skorLogika').value);
       const sMotivasi = parseInt(document.getElementById('skorMotivasi').value);
       const sTeknis = parseInt(document.getElementById('skorTeknis').value);
       const sLatar = parseInt(document.getElementById('skorLatarBelakang').value);
   
       // Update Label Angka di atas slider
       document.getElementById('valLogika').innerText = sLogika;
       document.getElementById('valMotivasi').innerText = sMotivasi;
       document.getElementById('valTeknis').innerText = sTeknis;
       document.getElementById('valLatarBelakang').innerText = sLatar;
   
       // Kalkulasi Rata-rata
       const avg = (sLogika + sMotivasi + sTeknis + sLatar) / 4;
       document.getElementById('liveAvgScore').innerText = avg.toFixed(1);
   }
   
   async function saveSkor(e) {
       e.preventDefault();
       const btn = document.getElementById('btnSaveSkor');
       const rowId = parseInt(document.getElementById('skoringRowId').value);
       
       const sLogika = parseInt(document.getElementById('skorLogika').value);
       const sMotivasi = parseInt(document.getElementById('skorMotivasi').value);
       const sTeknis = parseInt(document.getElementById('skorTeknis').value);
       const sLatar = parseInt(document.getElementById('skorLatarBelakang').value);
       const sAkhir = ((sLogika + sMotivasi + sTeknis + sLatar) / 4).toFixed(1);
   
       btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Menyimpan...';
       btn.disabled = true;
   
       // Update Lokal Sementara (Optimistic UI)
       const index = scoringData.findIndex(p => p.rowId === rowId);
       if(index !== -1) {
           scoringData[index].skor_logika = sLogika;
           scoringData[index].skor_motivasi = sMotivasi;
           scoringData[index].skor_teknis = sTeknis;
           scoringData[index].skor_latar = sLatar;
           scoringData[index].skor_akhir = sAkhir;
       }
   
       try {
           const payload = {
               action: 'updateScore',
               rowId: rowId,
               skor_logika: sLogika,
               skor_motivasi: sMotivasi,
               skor_teknis: sTeknis,
               skor_latar: sLatar,
               skor_akhir: sAkhir
           };
   
           // Kirim update ke Google Sheets tanpa harus nungguin selesai untuk update UI
           fetch(SKORING_API_URL, {
               method: 'POST',
               headers: { 'Content-Type': 'text/plain;charset=utf-8' },
               body: JSON.stringify(payload)
           }).catch(err => console.log("GAS Error (Silakan abaikan jika GAS belum siap):", err));
   
           // Sorting & Render ulang berdasarkan score efektif: reviewer override > AI baseline
           scoringData.sort((a, b) => getEffectiveRankingScore(b) - getEffectiveRankingScore(a));
           renderSkoringTable();
           
           document.getElementById('skoringModal').classList.remove('active');
           document.body.style.overflow = 'auto';
   
       } finally {
           btn.innerHTML = '<i class="fas fa-save"></i> Simpan Penilaian';
           btn.disabled = false;
       }
   }

   async function setStageOneDecision(decision, directRowId) {
       const rowId = parseInt(directRowId || document.getElementById('skoringRowId')?.value || '0');
       if (!rowId) return;
       const label = decision === 'lolos' ? 'meloloskan kandidat ke Tahap 2' : 'menggugurkan kandidat pada Tahap 1';
       if (!confirm(`Yakin ingin ${label}? Status ini akan tampil di halaman Pengumuman Tahap 1.`)) return;

       const acceptBtn = document.getElementById('btnAcceptSkoring');
       const rejectBtn = document.getElementById('btnRejectSkoring');
       [acceptBtn, rejectBtn].forEach(btn => { if (btn) btn.disabled = true; });

       try {
           const response = await fetch(SKORING_API_URL, {
               method: 'POST',
               headers: { 'Content-Type': 'text/plain;charset=utf-8' },
               body: JSON.stringify({ action: 'updateStatus', rowId, newStatus: decision })
           });
           const result = await response.json();
           if (result.status !== 'success') throw new Error(result.message || 'Gagal menyimpan keputusan');

           const index = scoringData.findIndex(p => p.rowId === rowId);
           if (index !== -1) {
               scoringData[index].status_seleksi = decision;
               scoringData[index].status_tahap_1 = decision;
               scoringData[index].participant_stage = decision === 'lolos' ? 'accepted_stage_1' : 'rejected_stage_1';
           }
           renderSkoringTable();
           document.getElementById('skoringModal')?.classList.remove('active');
           document.body.style.overflow = 'auto';
       } catch (error) {
           alert(error.message || 'Keputusan belum tersimpan.');
       } finally {
           [acceptBtn, rejectBtn].forEach(btn => { if (btn) btn.disabled = false; });
       }
   }

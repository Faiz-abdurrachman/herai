/* ==========================================================================
   js/admin-modules.js
   Logic UI terpusat untuk Modul Tambahan Data Sorcerers Panel
   + SISTEM MATA-MATA (LOG AKTIVITAS) FULL TRACKING & SIDEBAR GLOBAL
   ========================================================================== */

   const API_URL = '/__gas';

   function escapeHtml(value) {
       return String(value ?? '')
           .replace(/&/g, '&amp;')
           .replace(/</g, '&lt;')
           .replace(/>/g, '&gt;')
           .replace(/"/g, '&quot;')
           .replace(/'/g, '&#039;');
   }

   function escapeAttr(value) {
       return escapeHtml(value);
   }

   // ==========================================
   // 0. GLOBAL HELPERS: DEVICE, LOCATION & LOGGING
   // ==========================================
   
   window.getAdminSystemContext = async function() {
       if (window.__HERAI_ADMIN_CONTEXT__) return window.__HERAI_ADMIN_CONTEXT__;
       const ua = navigator.userAgent;
       let os = "Unknown OS";
       if (/windows/i.test(ua)) os = "Windows";
       else if (/mac/i.test(ua)) os = "Mac OS";
       else if (/android/i.test(ua)) os = "Android";
       else if (/iphone|ipad/i.test(ua)) os = "iOS";
   
       let browser = "Unknown Browser";
       if (/chrome|crios/i.test(ua)) browser = "Chrome";
       else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
       else if (/safari/i.test(ua)) browser = "Safari";
       else if (/edge/i.test(ua)) browser = "Edge";
   
       let loc = "Unknown Location";
       let gps = "";
       try {
           const res = await fetch('https://ipapi.co/json/');
           if (res.ok) {
               const data = await res.json();
               loc = `IP ${data.ip || 'Unknown'} (${data.city || 'Unknown City'}, ${data.country_code || 'ID'})`;
           }
       } catch (e) {
           console.warn("Tracker lokasi diblokir oleh browser.");
       }

       if (navigator.geolocation) {
           try {
               const position = await new Promise((resolve, reject) => {
                   navigator.geolocation.getCurrentPosition(resolve, reject, {
                       enableHighAccuracy: true,
                       timeout: 7000,
                       maximumAge: 10 * 60 * 1000
                   });
               });
               const { latitude, longitude, accuracy } = position.coords;
               gps = `GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)} ±${Math.round(accuracy || 0)}m`;
           } catch (error) {
               gps = "GPS permission not granted";
           }
       }
   
       window.__HERAI_ADMIN_CONTEXT__ = { device: `${os} • ${browser}`, lokasi: gps ? `${loc} • ${gps}` : loc };
       return window.__HERAI_ADMIN_CONTEXT__;
   };
   
   window.logAdminActivity = async function(tindakan) {
       const adminId = localStorage.getItem('adminId');
       if (!adminId) return; 
   
       const sys = await window.getAdminSystemContext();
   
       try {
           await fetch(API_URL, {
               method: 'POST',
               body: JSON.stringify({
                   action: 'logActivity', 
                   adminId: adminId,
                   tindakan: tindakan,
                   perangkat: sys.device,
                   lokasi: sys.lokasi
               })
           });
           console.log(`[Audit Logged] ${tindakan}`);
       } catch (e) {
           console.error("Gagal mencatat log aktivitas:", e);
       }
   };
   
   window.checkAdminAccess = function() {
       if (!localStorage.getItem('adminId') && !sessionStorage.getItem('isAdminLoggedIn')) {
           alert("Sesi Admin belum aktif atau terputus.");
           window.location.hash = "#/dashboard"; 
           return false;
       }
       return true;
   };
   
   // PERBAIKAN LOGOUT: Synchronous & Clean
   window.handleAdminLogout = function(event) {
       if (event) event.preventDefault();
       
       const adminId = localStorage.getItem('adminId');
       if (!adminId) {
           window.location.hash = "#/dashboard";
           window.location.reload();
           return;
       }
       
       // Log aktivitas (fire and forget)
       window.logAdminActivity("Melakukan Logout dari sistem").catch(() => {});
       
       // Hapus sesi
       localStorage.removeItem('adminId');
       sessionStorage.clear();
       
       // Redirect dan reload
       window.location.hash = "#/dashboard";
       setTimeout(() => {
           window.location.reload(true);
       }, 50);
   };
   
   window.toggleModal = function(modalId, action) {
       const modal = document.getElementById(modalId);
       if (modal) {
           if (action === 'open') {
               modal.classList.add('active');
               document.body.style.overflow = 'hidden';
           } else {
               modal.classList.remove('active');
               document.body.style.overflow = 'auto';
           }
       }
   };
   
   // ==========================================
   // PERBAIKAN SIDEBAR: Sinkron dengan hashchange
   // ==========================================
   window.loadSidebar = async function() {
       const sidebarContainer = document.getElementById('sidebar-container');
       if (!sidebarContainer) return;
   
       // Load sidebar HTML jika belum ada
       if (sidebarContainer.innerHTML.trim() === "") {
           try {
               if (!window.__HERAI_SIDEBAR_HTML__) {
                   const response = await fetch('/components/sidebar.html'); 
                   if (response.ok) {
                       window.__HERAI_SIDEBAR_HTML__ = await response.text();
                   }
               }
               sidebarContainer.innerHTML = window.__HERAI_SIDEBAR_HTML__ || '';
           } catch (error) {
               console.error("Gagal memuat sidebar:", error);
               return;
           }
       }
   
       // Update active state berdasarkan hash saat ini
       updateSidebarActiveState();
   };
   
   // Fungsi terpisah untuk update active state (dipanggil saat hashchange)
   window.updateSidebarActiveState = function() {
       const sidebarContainer = document.getElementById('sidebar-container');
       if (!sidebarContainer) return;
       
       // Hapus semua active class
       const allLinks = sidebarContainer.querySelectorAll('a');
       allLinks.forEach(link => link.classList.remove('active'));
       
       // Dapatkan hash saat ini
       let currentHash = window.location.hash;
       if(currentHash === "" || currentHash === "#/") currentHash = "#/dashboard";
   
       // Set active pada link yang sesuai
       const activeLink = sidebarContainer.querySelector(`a[href="${currentHash}"]`);
       if (activeLink) {
           activeLink.classList.add('active');
       }
   };
   
   // Update admin profile info
   window.updateAdminProfile = function() {
       const adminId = localStorage.getItem('adminId');
       if (!adminId) return;
       
       const adminName = adminId.split('-')[0] || 'Admin';
       const adminProfileElements = document.querySelectorAll('.admin-profile');
       
       adminProfileElements.forEach(el => {
           const nameEl = el.querySelector('.admin-name');
           const idEl = el.querySelector('.admin-id');
           
           if (nameEl) nameEl.textContent = adminName.toUpperCase();
           if (idEl) idEl.textContent = adminId;
       });
   };
   
   
   // ==========================================
   // 1. ANTI-FRAUD CHECKER
   // ==========================================
   window.initAntiFraud = async function() {
       await window.loadSidebar();
       if (!window.checkAdminAccess()) return;
       window.updateAdminProfile();
   
       window.logAdminActivity("Sedang melihat halaman Anti-Fraud Check");
   
       const btnRunScan = document.getElementById('btnRunScan');
       const scanArea = document.getElementById('scanProgressArea');
       if (btnRunScan && scanArea) {
           btnRunScan.onclick = async () => {
               window.logAdminActivity("Menjalankan pemindaian Anti-Fraud System (System Scan)"); 
               scanArea.style.display = 'block';
               btnRunScan.disabled = true;
               btnRunScan.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Scanning...';
               await runDuplicateIdentityScan();
               setTimeout(() => {
                   scanArea.style.display = 'none';
                   btnRunScan.disabled = false;
                   btnRunScan.innerHTML = '<i class="fas fa-radar"></i> Jalankan System Scan';
               }, 350);
           };
       }

       document.getElementById('searchFraud')?.addEventListener('input', renderFraudRows);
       document.getElementById('filterRisk')?.addEventListener('change', renderFraudRows);
       await runDuplicateIdentityScan();
   
       document.addEventListener('click', e => {
           if (window.location.hash !== '#/anti-fraud') return;
           const detailBtn = e.target.closest('.btn-fraud-detail');
           if (detailBtn) {
               window.logAdminActivity("Membuka detail investigasi duplikasi pendaftar");
               openFraudDetail(detailBtn.dataset.id);
           }
           if (e.target.closest('#btnCloseInvestigate') || e.target.closest('#btnCancelInvestigate')) {
               window.logAdminActivity("Menutup Modal Investigasi Fraud");
               window.toggleModal('investigationModal', 'close');
           }
       });
   };

   let fraudFindings = [];

   async function runDuplicateIdentityScan() {
       const tbody = document.getElementById('fraudTableBody');
       if (tbody) {
           tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fas fa-circle-notch fa-spin"></i> Membaca database pendaftar...</td></tr>`;
       }
       try {
           const response = await fetch(API_URL, {
               method: 'POST',
               body: JSON.stringify({ action: 'getData' })
           });
           const result = await response.json();
           if (result.status !== 'success') throw new Error(result.message || 'Gagal mengambil data pendaftar');
           fraudFindings = buildDuplicateFindings(result.data || []);
           renderFraudRows();
           updateFraudStats();
       } catch (error) {
           if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:35px; color:var(--danger);">Gagal memindai database: ${escapeHtml(error.message)}</td></tr>`;
       }
   }

   function buildDuplicateFindings(participants) {
       const buckets = new Map();
       const addToBucket = (type, value, participant) => {
           const clean = normalizeFraudValue(type, value);
           if (!clean) return;
           const key = `${type}:${clean}`;
           if (!buckets.has(key)) buckets.set(key, { id: key, type, value: clean, participants: [] });
           buckets.get(key).participants.push(participant);
       };

       participants.forEach(participant => {
           addToBucket('nik', participant.nik, participant);
           addToBucket('email', participant.email, participant);
           addToBucket('whatsapp', participant.whatsapp, participant);
       });

       return [...buckets.values()]
           .filter(item => item.participants.length > 1)
           .map(item => ({
               ...item,
               risk: item.type === 'nik' ? 'high' : 'medium',
               label: item.type === 'nik' ? 'NIK dobel' : item.type === 'email' ? 'Email dobel' : 'WhatsApp dobel'
           }))
           .sort((a, b) => (a.risk === b.risk ? b.participants.length - a.participants.length : a.risk === 'high' ? -1 : 1));
   }

   function normalizeFraudValue(type, value) {
       const raw = String(value || '').trim().toLowerCase();
       if (!raw || raw === '-') return '';
       if (type === 'email') return raw;
       const digits = raw.replace(/\D/g, '');
       if (type === 'nik') return digits.length >= 12 ? digits : '';
       if (type === 'whatsapp') {
           if (digits.length < 8) return '';
           return digits.replace(/^62/, '0');
       }
       return raw;
   }

   function renderFraudRows() {
       const tbody = document.getElementById('fraudTableBody');
       if (!tbody) return;
       const search = String(document.getElementById('searchFraud')?.value || '').toLowerCase();
       const risk = document.getElementById('filterRisk')?.value || 'all';
       const rows = fraudFindings.filter(item => {
           const names = item.participants.map(p => p.nama_lengkap || '').join(' ').toLowerCase();
           const matchSearch = !search || names.includes(search) || item.value.includes(search) || item.label.toLowerCase().includes(search);
           const matchRisk = risk === 'all' || item.risk === risk;
           return matchSearch && matchRisk;
       });

       if (rows.length === 0) {
           tbody.innerHTML = `<tr class="loading-row"><td colspan="5" style="text-align:center; padding:40px;"><i class="fas fa-check-circle" style="font-size:2.5rem; color:var(--success);"></i><h3 style="color:var(--dark-purple); margin:10px 0 5px;">Tidak ada duplikasi identitas</h3><p style="color:var(--text-muted); margin:0;">NIK, email, dan WhatsApp terlihat unik pada data yang terambil.</p></td></tr>`;
           return;
       }

       tbody.innerHTML = rows.map(item => {
           const first = item.participants[0] || {};
           const names = item.participants.slice(0, 3).map(p => p.nama_lengkap || '-').join(', ');
           const riskBadge = item.risk === 'high'
               ? '<span class="badge gugur"><i class="fas fa-triangle-exclamation"></i> High</span>'
               : '<span class="badge pending"><i class="fas fa-circle-exclamation"></i> Medium</span>';
           return `
               <tr>
                   <td><strong>${escapeHtml(first.nama_lengkap || '-')}</strong><br><small>${escapeHtml(names)}${item.participants.length > 3 ? ' ...' : ''}</small></td>
                   <td><span class="fraud-badge duplicate"><i class="fas fa-fingerprint"></i> ${escapeHtml(item.label)}</span><br><small>${escapeHtml(maskFraudValue(item.type, item.value))}</small></td>
                   <td><strong>${item.participants.length}</strong> data</td>
                   <td>${riskBadge}</td>
                   <td><button class="btn-action btn-fraud-detail" data-id="${escapeAttr(item.id)}"><i class="fas fa-eye"></i> Detail</button></td>
               </tr>
           `;
       }).join('');
   }

   function updateFraudStats() {
       const duplicateNik = fraudFindings.filter(item => item.type === 'nik').length;
       const duplicateContact = fraudFindings.filter(item => item.type !== 'nik').length;
       const highRisk = fraudFindings.filter(item => item.risk === 'high').length;
       const setHtml = (id, value) => { const el = document.getElementById(id); if (el) el.innerHTML = value; };
       setHtml('statDuplicate', `${duplicateNik} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Kasus</span>`);
       setHtml('statPlagiarism', `${duplicateContact} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Kasus</span>`);
       const riskEl = document.getElementById('statHighRisk');
       if (riskEl) {
           riskEl.textContent = highRisk ? `${highRisk} High` : 'Aman';
           riskEl.style.color = highRisk ? 'var(--danger)' : 'var(--success)';
       }
   }

   function openFraudDetail(id) {
       const item = fraudFindings.find(finding => finding.id === id);
       if (!item) return;
       const modalScore = document.getElementById('modalSimScore');
       const suspect1Name = document.getElementById('suspect1Name');
       const suspect1ID = document.getElementById('suspect1ID');
       const suspect1Text = document.getElementById('suspect1Text');
       const suspect2Name = document.getElementById('suspect2Name');
       const suspect2ID = document.getElementById('suspect2ID');
       const suspect2Text = document.getElementById('suspect2Text');
       const [first, second] = item.participants;
       if (modalScore) modalScore.textContent = `${item.participants.length} data`;
       if (suspect1Name) suspect1Name.textContent = first?.nama_lengkap || 'Kandidat A';
       if (suspect1ID) suspect1ID.textContent = `${item.label}: ${maskFraudValue(item.type, item.value)}`;
       if (suspect1Text) suspect1Text.innerHTML = renderFraudParticipant(first);
       if (suspect2Name) suspect2Name.textContent = second?.nama_lengkap || 'Kandidat B';
       if (suspect2ID) suspect2ID.textContent = `${item.label}: ${maskFraudValue(item.type, item.value)}`;
       if (suspect2Text) suspect2Text.innerHTML = renderFraudParticipant(second);
       window.toggleModal('investigationModal', 'open');
   }

   function renderFraudParticipant(p = {}) {
       return `
           <p><strong>NIK:</strong> ${escapeHtml(maskFraudValue('nik', p.nik || '-'))}</p>
           <p><strong>Email:</strong> ${escapeHtml(p.email || '-')}</p>
           <p><strong>WhatsApp:</strong> ${escapeHtml(p.whatsapp || '-')}</p>
           <p><strong>Jalur:</strong> ${escapeHtml(p.jalur || p.jalur_pendaftaran || '-')}</p>
           <p><strong>Latar:</strong> ${escapeHtml(p.status_kerja || p.status || '-')}</p>
           <p><strong>Alamat:</strong> ${escapeHtml(p.alamat || '-')}</p>
           <p><strong>Status:</strong> ${escapeHtml(p.status_seleksi || 'pending')}</p>
       `;
   }

   function maskFraudValue(type, value) {
       const text = String(value || '-');
       if (type === 'nik' && text.length >= 16) return `${text.slice(0, 6)}******${text.slice(-4)}`;
       if (type === 'email') return text.replace(/^(.{2}).*(@.*)$/, '$1***$2');
       if (type === 'whatsapp' && text.length > 6) return `${text.slice(0, 4)}****${text.slice(-3)}`;
       return text;
   }
   
   // ==========================================
   // 2. COMM ENGINE (BLAST)
   // ==========================================
   window.initCommEngine = async function() {
       await window.loadSidebar();
       if (!window.checkAdminAccess()) return;
       window.updateAdminProfile();
   
       window.logAdminActivity("Sedang melihat halaman Comm. Engine");
   
       const radios = document.querySelectorAll('input[name="channel"]');
       const subjectArea = document.getElementById('subjectArea');
       radios.forEach(radio => {
           radio.addEventListener('change', (e) => {
               window.logAdminActivity("Mengubah jalur komunikasi Blast ke: " + e.target.value.toUpperCase());
               if (e.target.value === 'whatsapp') subjectArea.style.display = 'none';
               else subjectArea.style.display = 'block';
           });
       });
   
       const tags = document.querySelectorAll('.var-tag');
       const textarea = document.getElementById('msgBody');
       tags.forEach(tag => {
           tag.onclick = () => {
               window.logAdminActivity("Menyisipkan variabel [" + tag.innerText + "] ke dalam pesan Blast");
               if (textarea) textarea.value += ` ${tag.innerText} `;
               textarea.focus();
           };
       });
   
       const btnBlast = document.getElementById('btnBlastExecute');
       if (btnBlast) {
           btnBlast.onclick = () => {
               window.logAdminActivity("Membuka modal Konfirmasi Blast Pesan");
               window.toggleModal('blastConfirmModal', 'open');
           };
       }
       const btnCancelBlast = document.getElementById('btnCancelBlast');
       if (btnCancelBlast) {
           btnCancelBlast.onclick = () => {
               window.logAdminActivity("Membatalkan eksekusi Blast Pesan");
               window.toggleModal('blastConfirmModal', 'close');
           };
       }
   };

   // ==========================================
   // 2B. VIDEO CONFERENCE ROOM
   // ==========================================
   window.initVideoConference = async function() {
       await window.loadSidebar();
       if (!window.checkAdminAccess()) return;
       window.updateAdminProfile();
       window.logAdminActivity("Sedang melihat halaman Video Conference");

       const statusEl = document.getElementById('manualConferenceStatus');
       const signalStatusEl = document.getElementById('manualSignalStatus');
       const peerCountEl = document.getElementById('manualPeerCount');
       const localVideo = document.getElementById('manualLocalVideo');
       const remoteGrid = document.getElementById('manualRemoteGrid');
       const signalServerInput = document.getElementById('signalServerUrl');
       const roomInput = document.getElementById('signalRoomId');
       const titleInput = document.getElementById('signalRoomTitle');
       const inviteLinkEl = document.getElementById('signalInviteLink');
       const roomList = document.getElementById('meetingRoomList');
       let localStream = null;
       let socket = null;
       const clientId = getOrCreateSignalClientId();
       const peers = new Map();

       const setStatus = (value) => {
           if (statusEl) statusEl.textContent = value;
       };
       const setSignalStatus = (value) => {
           if (signalStatusEl) signalStatusEl.textContent = value;
       };
       const updatePeerCount = () => {
           if (peerCountEl) peerCountEl.textContent = String(peers.size);
           if (remoteGrid && peers.size === 0) {
               remoteGrid.innerHTML = '<div class="manual-empty-remote">Remote stream akan muncul setelah peer bergabung.</div>';
           }
       };
       const closePeer = (peerId) => {
           const pc = peers.get(peerId);
           if (pc) pc.close();
           peers.delete(peerId);
           removeRemoteStream(peerId);
           updatePeerCount();
       };
       const roomId = () => formatSignalRoomCode(roomInput?.value || 'ABCD-EFGH-JKLM');
       const roomTitle = () => String(titleInput?.value || 'HerAI Meeting').trim() || 'HerAI Meeting';
       const inviteUrl = () => `${location.origin}${location.pathname}#/meeting?room=${encodeURIComponent(roomId())}&title=${encodeURIComponent(roomTitle())}&signal=${encodeURIComponent((signalServerInput?.value || 'ws://127.0.0.1:8080/ws').trim())}`;
       const updateInviteLink = () => {
           if (inviteLinkEl) inviteLinkEl.textContent = inviteUrl();
       };
       const signalUrl = () => {
           const base = (signalServerInput?.value || 'ws://127.0.0.1:8080/ws').trim();
           const url = new URL(base);
           url.searchParams.set('room', roomId());
           url.searchParams.set('clientId', clientId);
           return url.toString();
       };
       const sendSignal = (type, to, payload) => {
           if (!socket || socket.readyState !== WebSocket.OPEN) return;
           socket.send(JSON.stringify({ type, room: roomId(), to, payload }));
       };
       const ensureLocalMedia = async () => {
           if (localStream) return localStream;
           localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
           if (localVideo) localVideo.srcObject = localStream;
           setStatus('Media Ready');
           return localStream;
       };
       const createPeer = (peerId) => {
           if (peers.has(peerId)) return peers.get(peerId);
           const pc = new RTCPeerConnection({
               iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
           });
           if (localStream) {
               localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
           }
           pc.ontrack = event => {
               renderRemoteStream(peerId, event.streams[0]);
           };
           pc.onicecandidate = event => {
               if (event.candidate) sendSignal('ice', peerId, event.candidate);
           };
           pc.onconnectionstatechange = () => {
               setStatus(`${peerId.slice(0, 6)}: ${pc.connectionState || 'connecting'}`);
               if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
                   closePeer(peerId);
               }
           };
           peers.set(peerId, pc);
           updatePeerCount();
           return pc;
       };
       const createOfferForPeer = async (peerId) => {
           const pc = createPeer(peerId);
           const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
           await pc.setLocalDescription(offer);
           sendSignal('offer', peerId, pc.localDescription);
       };
       const handleSignal = async (message) => {
           const { type, from, payload } = message;
           if (!from || from === clientId) return;
           if (type === 'joined') return;
           if (type === 'peer-joined') {
               createPeer(from);
               return;
           }
           if (type === 'peer-left') {
               closePeer(from);
               return;
           }
           if (type === 'offer') {
               const pc = createPeer(from);
               await pc.setRemoteDescription(new RTCSessionDescription(payload));
               const answer = await pc.createAnswer();
               await pc.setLocalDescription(answer);
               sendSignal('answer', from, pc.localDescription);
               return;
           }
           if (type === 'answer') {
               const pc = createPeer(from);
               await pc.setRemoteDescription(new RTCSessionDescription(payload));
               return;
           }
           if (type === 'ice') {
               const pc = createPeer(from);
               await pc.addIceCandidate(new RTCIceCandidate(payload));
           }
       };
       const connectRoom = async () => {
           await ensureLocalMedia();
           if (socket && socket.readyState === WebSocket.OPEN) socket.close();
           socket = new WebSocket(signalUrl());
           setSignalStatus('Connecting');
           socket.onopen = () => {
               setSignalStatus('Online');
               setStatus(`Joined ${roomId()}`);
               window.logAdminActivity(`Bergabung ke video room ${roomId()}`);
           };
           socket.onmessage = async event => {
               const message = JSON.parse(event.data);
               if (message.type === 'joined') {
                   const existingPeers = message.payload?.peers || [];
                   for (const peerId of existingPeers) {
                       await createOfferForPeer(peerId);
                   }
                   return;
               }
               await handleSignal(message);
           };
           socket.onclose = () => {
               setSignalStatus('Offline');
               setStatus('Disconnected');
           };
           socket.onerror = () => {
               setSignalStatus('Error');
               setStatus('Signal Error');
           };
       };

       document.getElementById('btnStartManualMedia')?.addEventListener('click', async () => {
           try {
               await ensureLocalMedia();
               peers.forEach(pc => localStream.getTracks().forEach(track => pc.addTrack(track, localStream)));
               if (!socket || socket.readyState !== WebSocket.OPEN) {
                   await connectRoom();
               }
               window.logAdminActivity("Mengaktifkan kamera dan mic video conference");
           } catch (error) {
               alert('Kamera/mic tidak bisa diakses. Pastikan permission browser diizinkan.');
               setStatus('Media Blocked');
           }
       });

       document.getElementById('btnGenerateSignalRoom')?.addEventListener('click', () => {
           if (roomInput) roomInput.value = generateHeraiRoomCode();
           persistAdminMeetingRoom();
           updateInviteLink();
           renderAdminMeetingRooms();
           setStatus('Room Generated');
           window.logAdminActivity(`Generate room video conference ${roomId()}`);
       });

       roomInput?.addEventListener('input', () => {
           roomInput.value = formatSignalRoomCode(roomInput.value);
           updateInviteLink();
       });
       titleInput?.addEventListener('input', updateInviteLink);

       document.getElementById('btnCopyRoomLink')?.addEventListener('click', async () => {
           persistAdminMeetingRoom();
           renderAdminMeetingRooms();
           updateInviteLink();
           await navigator.clipboard.writeText(inviteUrl());
           setStatus('Room Link Copied');
       });

       document.getElementById('btnHangupManualCall')?.addEventListener('click', () => {
           if (socket) socket.close();
           socket = null;
           peers.forEach(pc => pc.close());
           peers.clear();
           if (localStream) localStream.getTracks().forEach(track => track.stop());
           localStream = null;
           if (localVideo) localVideo.srcObject = null;
           if (remoteGrid) remoteGrid.innerHTML = '<div class="manual-empty-remote">Remote stream akan muncul setelah peer bergabung.</div>';
           updatePeerCount();
           setStatus('Closed');
           setSignalStatus('Offline');
           window.logAdminActivity("Menutup video conference");
       });

       const roomFromHash = new URLSearchParams((location.hash.split('?')[1] || '')).get('room');
       if (roomFromHash && roomInput) roomInput.value = formatSignalRoomCode(roomFromHash);
       document.getElementById('btnRefreshMeetingRooms')?.addEventListener('click', refreshActiveMeetingRooms);
       updateInviteLink();
       renderAdminMeetingRooms();
       refreshActiveMeetingRooms();
       const meetingMonitorTimer = setInterval(() => {
           if (window.location.hash !== '#/video-conference') {
               clearInterval(meetingMonitorTimer);
               return;
           }
           refreshActiveMeetingRooms();
       }, 5000);
       updatePeerCount();

       function persistAdminMeetingRoom() {
           const rooms = readAdminMeetingRooms().filter(room => room.id !== roomId());
           rooms.unshift({
               id: roomId(),
               title: roomTitle(),
               inviteUrl: inviteUrl(),
               createdAt: new Date().toISOString()
           });
           localStorage.setItem('herai_admin_meeting_rooms', JSON.stringify(rooms.slice(0, 20)));
       }

       function renderAdminMeetingRooms(activeRooms = []) {
           if (!roomList) return;
           const rooms = readAdminMeetingRooms();
           if (rooms.length === 0 && activeRooms.length === 0) {
               roomList.innerHTML = '<div class="manual-note">Belum ada room tersimpan.</div>';
               return;
           }
           const activeMap = new Map(activeRooms.map(room => [normalizeRoomId(room.room), room]));
           const savedIds = new Set(rooms.map(room => normalizeRoomId(room.id)));
           const activeOnly = activeRooms
               .filter(room => !savedIds.has(normalizeRoomId(room.room)))
               .map(room => ({ id: room.room, title: 'Active External Room', inviteUrl: `${location.origin}${location.pathname}#/meeting?room=${encodeURIComponent(room.room)}` }));
           roomList.innerHTML = [...rooms, ...activeOnly].map(room => {
               const active = activeMap.get(normalizeRoomId(room.id));
               return `
                   <div class="meeting-room-card ${active ? 'is-online' : ''}">
                       <div>
                           <strong>${escapeHtml(room.title)}</strong>
                           <small>${escapeHtml(room.id)} • ${active ? `${active.clients} online` : 'offline'}</small>
                       </div>
                       <button class="btn-action btn-copy-saved-room" data-url="${escapeAttr(room.inviteUrl)}"><i class="far fa-copy"></i> Copy</button>
                   </div>
               `;
           }).join('');
           roomList.querySelectorAll('.btn-copy-saved-room').forEach(button => {
               button.addEventListener('click', async () => {
                   await navigator.clipboard.writeText(button.dataset.url || '');
                   setStatus('Saved Link Copied');
               });
           });
       }

       async function refreshActiveMeetingRooms() {
           try {
               const base = (signalServerInput?.value || 'ws://127.0.0.1:8080/ws').replace(/^ws/, 'http').replace(/\/ws.*$/, '/rooms');
               const response = await fetch(base);
               const result = await response.json();
               renderAdminMeetingRooms(result.rooms || []);
           } catch (error) {
               renderAdminMeetingRooms();
           }
       }
   };

   function normalizeRoomId(value) {
       return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
   }

   function generateHeraiRoomCode() {
       const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
       let code = '';
       for (let i = 0; i < 12; i++) {
           code += alphabet[Math.floor(Math.random() * alphabet.length)];
       }
       return formatSignalRoomCode(code);
   }

   function getOrCreateSignalClientId() {
       const key = 'herai_signal_client_id';
       let id = sessionStorage.getItem(key);
       if (!id) {
           id = crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
           sessionStorage.setItem(key, id);
       }
       return id;
   }

   function sanitizeSignalValue(value) {
       return formatSignalRoomCode(value) || 'ABCD-EFGH-JKLM';
   }

   function formatSignalRoomCode(value) {
       const compact = String(value || '')
           .trim()
           .replace(/[^a-zA-Z0-9_-]/g, '')
           .replace(/-/g, '')
           .toUpperCase()
           .slice(0, 12);
       return compact.match(/.{1,4}/g)?.join('-') || '';
   }

   function readAdminMeetingRooms() {
       try {
           return JSON.parse(localStorage.getItem('herai_admin_meeting_rooms') || '[]');
       } catch (error) {
           return [];
       }
   }

   function renderRemoteStream(peerId, stream) {
       const remoteGrid = document.getElementById('manualRemoteGrid');
       if (!remoteGrid) return;
       remoteGrid.querySelector('.manual-empty-remote')?.remove();
       const safeId = peerId.replace(/[^a-zA-Z0-9_-]/g, '');
       let tile = document.getElementById(`remote-peer-${safeId}`);
       if (!tile) {
           tile = document.createElement('div');
           tile.id = `remote-peer-${safeId}`;
           tile.className = 'manual-remote-tile';
           tile.innerHTML = `<video autoplay playsinline></video><span>${peerId.slice(0, 8)}</span>`;
           remoteGrid.appendChild(tile);
       }
       const video = tile.querySelector('video');
       if (video) video.srcObject = stream;
   }

   function removeRemoteStream(peerId) {
       const safeId = peerId.replace(/[^a-zA-Z0-9_-]/g, '');
       const tile = document.getElementById(`remote-peer-${safeId}`);
       tile?.remove();
   }
   
   // ==========================================
   // 3. ASSET & LINKS MANAGER
   // ==========================================
   window.initAssets = async function() {
       await window.loadSidebar();
       if (!window.checkAdminAccess()) return;
       window.updateAdminProfile();
   
       window.logAdminActivity("Sedang melihat halaman Asset & Links");

       loadAssetsFromStorage();
       renderAssetTable();

       const btnAdd = document.getElementById('btnAddAsset');
       if (btnAdd) {
           btnAdd.onclick = () => {
               const form = document.getElementById('assetForm');
               form?.reset();
               form?.removeAttribute('data-edit-id');
               const title = document.getElementById('assetModalTitle');
               if (title) title.textContent = 'Tambah Tautan Baru';
               window.logAdminActivity("Membuka form Tambah Asset/Link Baru");
               window.toggleModal('assetModal', 'open');
           };
       }

       document.getElementById('searchAsset')?.addEventListener('input', renderAssetTable);
       document.getElementById('filterCategory')?.addEventListener('change', renderAssetTable);
       document.getElementById('btnSaveAsset')?.addEventListener('click', saveAssetFromForm);
       
       document.addEventListener('click', e => {
           if (window.location.hash !== '#/assets') return;
           const btnCopy = e.target.closest('.btn-copy-url');
           if (btnCopy) {
               window.logAdminActivity("Menyalin URL Asset/Link ke Clipboard");
               const urlText = btnCopy.dataset.url || btnCopy.previousElementSibling?.innerText || '';
               navigator.clipboard.writeText(urlText);
               const icon = btnCopy.querySelector('i');
               icon.className = 'fas fa-check text-success';
               setTimeout(() => icon.className = 'far fa-copy', 2000);
           }
           const btnEdit = e.target.closest('.btn-edit-asset');
           if (btnEdit) editAsset(btnEdit.dataset.id);
           const btnDelete = e.target.closest('.btn-delete-asset');
           if (btnDelete) deleteAsset(btnDelete.dataset.id);
           const toggle = e.target.closest('.asset-access-toggle');
           if (toggle) {
               const asset = assetState.find(item => item.id === toggle.dataset.id);
               if (asset) {
                   asset.active = toggle.checked;
                   persistAssets();
                   window.logAdminActivity(`Mengubah akses asset ${asset.name} menjadi ${asset.active ? 'aktif' : 'nonaktif'}`);
               }
           }
           if (e.target.closest('#btnCloseAsset') || e.target.closest('#btnCancelAsset')) {
               window.logAdminActivity("Menutup/Membatalkan form Tambah Asset");
               window.toggleModal('assetModal', 'close');
           }
       });
   };

   let assetState = [];
   const defaultAssets = [
       { id: 'asset-telegram', name: 'Grup Telegram Resmi HerAI', category: 'komunitas', url: 'https://t.me/+HerAI2026SecureLink', notes: 'Batch 1 (2026)', active: true, icon: 'fab fa-telegram-plane' },
       { id: 'asset-zoom-kickoff', name: 'Zoom: Kick-off ASCEND 2026', category: 'webinar', url: 'https://zoom.us/j/123456789', notes: 'Passcode: HERAI26', active: true, icon: 'fas fa-video' },
       { id: 'asset-module-python', name: 'Modul 1: Intro to Python & AI', category: 'kurikulum', url: 'https://drive.google.com/file/d/...', notes: 'Pyronyx Academy Syllabus', active: false, icon: 'fas fa-file-pdf' },
       { id: 'asset-vbg-herai', name: 'HerAI Virtual Background', category: 'branding', url: 'https://datasorcerers.id/vbg-herai', notes: 'Gunakan saat sesi Mentoring', active: true, icon: 'fas fa-image' }
   ];

   function loadAssetsFromStorage() {
       try {
           assetState = JSON.parse(localStorage.getItem('herai_assets') || '[]');
       } catch (error) {
           assetState = [];
       }
       if (!Array.isArray(assetState) || assetState.length === 0) assetState = [...defaultAssets];
   }

   function persistAssets() {
       localStorage.setItem('herai_assets', JSON.stringify(assetState));
   }

   function renderAssetTable() {
       const tbody = document.getElementById('assetTableBody');
       if (!tbody) return;
       const search = String(document.getElementById('searchAsset')?.value || '').toLowerCase();
       const category = document.getElementById('filterCategory')?.value || 'all';
       const categoryLabels = { komunitas: 'Komunitas', webinar: 'Webinar', kurikulum: 'Kurikulum', branding: 'Branding Kit' };
       const iconBg = { komunitas: '#e0f2fe', webinar: '#eff6ff', kurikulum: '#dcfce7', branding: 'var(--light-pink)' };
       const iconColor = { komunitas: '#0284c7', webinar: '#3b82f6', kurikulum: '#16a34a', branding: 'var(--primary-pink)' };
       const rows = assetState.filter(asset => {
           const matchSearch = asset.name.toLowerCase().includes(search) || asset.url.toLowerCase().includes(search);
           const matchCategory = category === 'all' || asset.category === category;
           return matchSearch && matchCategory;
       });

       if (rows.length === 0) {
           tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">Tidak ada asset sesuai filter.</td></tr>';
       } else {
           tbody.innerHTML = rows.map(asset => `
               <tr>
                   <td>
                       <div style="font-weight: 700; color: var(--dark-purple); display: flex; align-items: center; gap: 10px;">
                           <div style="width: 35px; height: 35px; border-radius: 8px; background: ${iconBg[asset.category] || '#f8fafc'}; color: ${iconColor[asset.category] || 'var(--icon-purple)'}; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                               <i class="${asset.icon || 'fas fa-link'}"></i>
                           </div>
                           <div>${escapeHtml(asset.name)}<div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">${escapeHtml(asset.notes || '-')}</div></div>
                       </div>
                   </td>
                   <td><span class="badge cat-${asset.category}">${categoryLabels[asset.category] || asset.category}</span></td>
                   <td><div class="url-display"><span class="url-text">${escapeHtml(asset.url)}</span><button class="btn-copy-url" data-url="${escapeAttr(asset.url)}" title="Salin Tautan"><i class="far fa-copy"></i></button></div></td>
                   <td><label class="cyber-switch"><input class="asset-access-toggle" data-id="${asset.id}" type="checkbox" ${asset.active ? 'checked' : ''}><span class="slider round"></span></label></td>
                   <td><div style="display:flex; gap:8px; justify-content:center;"><button class="btn-action btn-edit-asset" data-id="${asset.id}" title="Edit"><i class="fas fa-pen"></i></button><button class="btn-action btn-delete-asset" data-id="${asset.id}" style="color: var(--danger); border-color: rgba(230,57,70,0.3);" title="Hapus"><i class="fas fa-trash"></i></button></div></td>
               </tr>
           `).join('');
       }

       const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
       setText('statTotalLinks', assetState.filter(asset => asset.active).length);
       setText('statModules', `${assetState.filter(asset => asset.category === 'kurikulum').length} File`);
       setText('statMeetings', `${assetState.filter(asset => asset.category === 'webinar').length} Ruang`);
   }

   async function saveAssetFromForm() {
       const form = document.getElementById('assetForm');
       const name = document.getElementById('assetName')?.value.trim();
       const category = document.getElementById('assetCategory')?.value || 'komunitas';
       const url = document.getElementById('assetUrl')?.value.trim();
       const notes = document.getElementById('assetNotes')?.value.trim();
       if (!name || !url) {
           alert('Nama dan URL wajib diisi.');
           return;
       }
       const editId = form?.dataset.editId;
       const payload = { id: editId || `asset-${Date.now()}`, name, category, url, notes, active: true };
       if (editId) {
           assetState = assetState.map(asset => asset.id === editId ? { ...asset, ...payload, active: asset.active } : asset);
       } else {
           assetState.unshift(payload);
       }
       persistAssets();
       renderAssetTable();
       window.toggleModal('assetModal', 'close');
       window.logAdminActivity(`${editId ? 'Mengedit' : 'Menambahkan'} asset/link: ${name}`);
       try {
           await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'saveAsset', asset: payload }) });
       } catch (error) {
           console.warn('Asset tersimpan lokal, GAS belum merespons.', error);
       }
   }

   function editAsset(id) {
       const asset = assetState.find(item => item.id === id);
       if (!asset) return;
       const form = document.getElementById('assetForm');
       if (form) form.dataset.editId = id;
       const title = document.getElementById('assetModalTitle');
       if (title) title.textContent = 'Edit Tautan';
       document.getElementById('assetName').value = asset.name;
       document.getElementById('assetCategory').value = asset.category;
       document.getElementById('assetUrl').value = asset.url;
       document.getElementById('assetNotes').value = asset.notes || '';
       window.toggleModal('assetModal', 'open');
   }

   function deleteAsset(id) {
       const asset = assetState.find(item => item.id === id);
       if (!asset || !confirm(`Hapus asset "${asset.name}"?`)) return;
       assetState = assetState.filter(item => item.id !== id);
       persistAssets();
       renderAssetTable();
       window.logAdminActivity(`Menghapus asset/link: ${asset.name}`);
   }
   
   // ==========================================
   // 4. GLOBAL SETTINGS
   // ==========================================
   window.initGlobalSettings = async function() {
       await window.loadSidebar();
       if (!window.checkAdminAccess()) return;
       window.updateAdminProfile();
   
       window.logAdminActivity("Sedang melihat halaman Global Settings");

       const fields = {
           registrationOpen: document.getElementById('toggleRegis'),
           afirmasiOpen: document.getElementById('toggleAfirmasi'),
           announcementLive: document.getElementById('togglePengumuman'),
           participantPortalOpen: document.getElementById('toggleParticipantPortal'),
           competencyTestOpen: document.getElementById('toggleCompetencyTest'),
           maintenanceMode: document.getElementById('toggleMaintenance'),
           registrationClosedMessage: document.getElementById('msgRegisClosed'),
           twibbonUrl: document.getElementById('urlTwibbon'),
           announcementLaunchAt: document.getElementById('announcementLaunchAt'),
           passedInfoMessage: document.getElementById('msgLolosInfo')
       };
       const statusText = document.getElementById('globalSettingsStatus');

       async function loadSettingsToForm() {
           const settings = typeof window.getGlobalSettingsAsync === 'function'
               ? await window.getGlobalSettingsAsync()
               : (typeof window.getGlobalSettings === 'function' ? window.getGlobalSettings() : {});
           if (fields.registrationOpen) fields.registrationOpen.checked = settings.registrationOpen !== false;
           if (fields.afirmasiOpen) fields.afirmasiOpen.checked = settings.afirmasiOpen !== false;
           if (fields.announcementLive) fields.announcementLive.checked = settings.announcementLive === true;
           if (fields.participantPortalOpen) fields.participantPortalOpen.checked = settings.participantPortalOpen === true;
           if (fields.competencyTestOpen) fields.competencyTestOpen.checked = settings.competencyTestOpen === true;
           if (fields.maintenanceMode) fields.maintenanceMode.checked = settings.maintenanceMode === true;
           if (fields.registrationClosedMessage) fields.registrationClosedMessage.value = settings.registrationClosedMessage || '';
           if (fields.twibbonUrl) fields.twibbonUrl.value = settings.twibbonUrl || '#/twibbon';
           if (fields.announcementLaunchAt) fields.announcementLaunchAt.value = settings.announcementLaunchAt || '';
           if (fields.passedInfoMessage) fields.passedInfoMessage.value = settings.passedInfoMessage || '';
       }

       function readSettingsFromForm() {
           return {
               registrationOpen: !!fields.registrationOpen?.checked,
               afirmasiOpen: !!fields.afirmasiOpen?.checked,
               announcementLive: !!fields.announcementLive?.checked,
               participantPortalOpen: !!fields.participantPortalOpen?.checked,
               competencyTestOpen: !!fields.competencyTestOpen?.checked,
               maintenanceMode: !!fields.maintenanceMode?.checked,
               registrationClosedMessage: fields.registrationClosedMessage?.value.trim() || 'Pendaftaran HerAI Fellowship Batch 1 (2026) telah resmi ditutup.',
               twibbonUrl: fields.twibbonUrl?.value.trim() || '#/twibbon',
               announcementLaunchAt: fields.announcementLaunchAt?.value || '',
               announcementStage1LaunchAt: '2026-05-25T19:00:00+07:00',
               announcementFinalLaunchAt: '2026-05-31T19:00:00+07:00',
               passedInfoMessage: fields.passedInfoMessage?.value.trim() || 'Harap periksa email Anda untuk undangan grup Telegram.'
           };
       }

       await loadSettingsToForm();

       const btnSave = document.getElementById('btnSaveGlobalSettings');
       if (btnSave) {
           btnSave.onclick = async () => {
               window.logAdminActivity("Mengeksekusi penyimpanan perubahan di Global Settings");
               btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menerapkan...';
               btnSave.disabled = true;
               const settings = typeof window.saveGlobalSettingsAsync === 'function'
                   ? await window.saveGlobalSettingsAsync(readSettingsFromForm())
                   : window.saveGlobalSettings(readSettingsFromForm());
               setTimeout(() => {
                   btnSave.innerHTML = '<i class="fas fa-check"></i> Pengaturan Diterapkan';
                   btnSave.disabled = false;
                   if (statusText) {
                       statusText.textContent = `Tersimpan ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
                       statusText.style.color = settings.maintenanceMode ? 'var(--danger)' : 'var(--success)';
                   }
                   if (typeof window.applyPublicVisibilitySettings === 'function') {
                       window.applyPublicVisibilitySettings(settings);
                   }
                   setTimeout(() => btnSave.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Terapkan Pengaturan Global', 2000);
               }, 500);
           };
       }

       const btnClearCache = document.getElementById('btnClearGlobalCache');
       if (btnClearCache) {
           btnClearCache.onclick = () => {
               window.resetGlobalSettings();
               loadSettingsToForm();
               if (statusText) {
                   statusText.textContent = 'Cache pengaturan direset';
                   statusText.style.color = 'var(--warning)';
               }
               window.logAdminActivity("Melakukan reset cache Global Settings");
           };
       }
   };

   // ==========================================
   // 4B. PROGRAM OPERATIONS MODULES
   // ==========================================
   window.initStageControl = async function() {
       await window.loadSidebar();
       if (!window.checkAdminAccess()) return;
       window.updateAdminProfile();
       window.logAdminActivity("Sedang melihat halaman Stage Control");

       const settings = typeof window.getGlobalSettings === 'function' ? window.getGlobalSettings() : {};
       const stageSelect = document.getElementById('stageSelect');
       const stageNotes = document.getElementById('stageNotes');
       const badge = document.getElementById('stageLiveBadge');
       const stageLabels = {
           draft: 'Draft / Preparation',
           registration_open: 'Pendaftaran Dibuka',
           registration_closed: 'Pendaftaran Ditutup',
           selection_1: 'Seleksi Tahap 1',
           ai_prescreening: 'AI Pre-Screening',
           review_scoring: 'Reviewer Scoring',
           announcement_stage_1: 'Pengumuman Lolos Tahap 1',
           competency_test: 'Seleksi Tahap 2',
           announcement_stage_2: 'Pengumuman Final',
           announcement_live: 'Pengumuman Tahap 1 Live',
           bootcamp_active: 'Bootcamp Aktif',
           final_project: 'Final Project',
           announcement_final: 'Pengumuman Final',
           graduation: 'Graduation',
           alumni: 'Alumni / Wall of Fame'
       };

       if (stageSelect) stageSelect.value = settings.currentStage || 'draft';
       if (stageNotes) stageNotes.value = settings.stageNotes || '';
       if (badge) badge.textContent = stageSelect?.selectedOptions?.[0]?.textContent || 'Draft';
       renderStageControlOverview({ ...settings, currentStage: stageSelect?.value || settings.currentStage || 'draft' }, stageLabels);

       stageSelect?.addEventListener('change', () => {
           if (badge) badge.textContent = stageSelect.selectedOptions[0].textContent;
           renderStageControlOverview({ ...settings, currentStage: stageSelect.value }, stageLabels);
       });

       document.getElementById('btnSaveStage')?.addEventListener('click', async () => {
           const nextSettings = {
               ...settings,
               currentStage: stageSelect?.value || 'draft',
               stageNotes: stageNotes?.value || '',
               registrationOpen: ['registration_open'].includes(stageSelect?.value),
               competencyTestOpen: ['competency_test'].includes(stageSelect?.value),
               announcementLive: ['announcement_stage_1', 'announcement_stage_2', 'announcement_final', 'announcement_live', 'bootcamp_active', 'final_project', 'graduation', 'alumni'].includes(stageSelect?.value),
               announcementStage1LaunchAt: '2026-05-25T19:00:00+07:00',
               announcementFinalLaunchAt: '2026-05-31T19:00:00+07:00'
           };
           if (typeof window.saveGlobalSettingsAsync === 'function') await window.saveGlobalSettingsAsync(nextSettings);
           else window.saveGlobalSettings(nextSettings);
           window.logAdminActivity(`Mengubah stage acara menjadi ${nextSettings.currentStage}`);
           alert('Stage acara tersimpan dan sinkron ke pengaturan publik.');
           renderStageControlOverview(nextSettings, stageLabels);
       });
   };

   function renderStageControlOverview(settings, stageLabels) {
       const currentStage = settings.currentStage || 'draft';
       const setText = (id, value) => {
           const el = document.getElementById(id);
           if (el) el.textContent = value;
       };

       setText('stageSummaryActive', stageLabels[currentStage] || currentStage);
       setText('stageSummaryRegistration', settings.registrationOpen ? 'Open' : 'Closed');
       setText('stageSummaryAnnouncement', settings.announcementLive ? 'Live' : 'Locked');
       setText('stageSummaryPortal', settings.participantPortalOpen ? 'Open' : 'Hidden');

       const timeline = [
           ['draft', 'Persiapan program, audit form, dan sinkronisasi sheet.', 'fa-clipboard-check'],
           ['registration_open', 'Form pendaftaran publik dibuka dan data masuk ke Participants.', 'fa-file-signature'],
           ['selection_1', 'Kurasi administrasi dan validasi jalur afirmasi.', 'fa-users-cog'],
           ['ai_prescreening', 'AI membaca essay dan menyiapkan baseline skor.', 'fa-robot'],
           ['review_scoring', 'Reviewer mengedit nilai sebelum keputusan tahap 1.', 'fa-sliders'],
           ['announcement_stage_1', 'Pengumuman lolos tahap 1 dan instruksi tes kompetensi tampil.', 'fa-bullhorn'],
           ['competency_test', 'Peserta lolos tahap 1 mengerjakan tes logika dan matematika daring.', 'fa-square-root-variable'],
           ['announcement_stage_2', 'Pengumuman final dari hasil tes kompetensi tampil.', 'fa-clipboard-list'],
           ['bootcamp_active', 'Kelas, task, mentoring, dan attendance berjalan.', 'fa-chalkboard-user'],
           ['final_project', 'Tim mengerjakan final project dan demo.', 'fa-laptop-code'],
           ['graduation', 'Sertifikat, graduation, dan wall of fame.', 'fa-certificate']
       ];
       const currentIndex = timeline.findIndex(([key]) => key === currentStage);
       const list = document.getElementById('stageFlowList');
       if (list) {
           list.innerHTML = timeline.map(([key, desc, icon], index) => {
               const status = index < currentIndex ? 'Selesai' : index === currentIndex ? 'Aktif' : 'Planned';
               const badgeClass = index < currentIndex ? 'lolos' : index === currentIndex ? 'reguler' : 'pending';
               return `
                   <div class="stage-flow-item">
                       <div class="stage-flow-icon"><i class="fas ${icon}"></i></div>
                       <div><strong>${stageLabels[key] || key}</strong><p>${desc}</p></div>
                       <span class="badge ${badgeClass}">${status}</span>
                   </div>
               `;
           }).join('');
       }
   }

   window.initBootcamp = async function() {
       await initOpsModule('Bootcamp Control', 'getBootcampSessions', 'bootcampSessionBody', renderBootcampSessions);
       document.getElementById('btnAddBootcampSession')?.addEventListener('click', () => {
           const title = prompt('Nama sesi bootcamp:');
           if (!title) return;
           const mentor = prompt('Nama mentor:', 'Mentor Team') || 'Mentor Team';
           const date = prompt('Tanggal sesi:', 'TBD') || 'TBD';
           const rows = readLocalRows('herai_bootcamp_sessions');
           rows.unshift({ title, mentor, date, link: '#/assets', attendance: '0 / 100', status: 'Planned' });
           writeLocalRows('herai_bootcamp_sessions', rows);
           renderBootcampSessions(rows);
           window.logAdminActivity(`Menambahkan sesi bootcamp: ${title}`);
       });
   };

   window.initFinalProject = async function() {
       await initOpsModule('Final Project Tracker', 'getFinalProjects', 'projectBoardBody', renderFinalProjects);
       document.getElementById('btnAddProjectTeam')?.addEventListener('click', () => {
           const team = prompt('Nama tim:');
           if (!team) return;
           const project = prompt('Nama project:', 'Untitled AI Project') || 'Untitled AI Project';
           const rows = readLocalRows('herai_final_projects');
           rows.unshift({ team, project, mentor: 'TBD', repository: '-', score: 0, status: 'Draft' });
           writeLocalRows('herai_final_projects', rows);
           renderFinalProjects(rows);
           window.logAdminActivity(`Menambahkan final project team: ${team}`);
       });
   };

   window.initCertificates = async function() {
       await initOpsModule('Certificate Manager', 'getCertificates', 'certificateRegistryBody', renderCertificates);
       document.getElementById('btnGenerateCertificates')?.addEventListener('click', () => {
           const rows = readLocalRows('herai_certificates');
           if (rows.length === 0) {
               rows.push({ no: 'HERAI-2026-0001', name: 'Sample Fellow', score: 0, status: 'Pending', issuedAt: '-' });
           }
           writeLocalRows('herai_certificates', rows);
           renderCertificates(rows);
           window.logAdminActivity('Menjalankan generate eligible certificates');
           alert('Registry sertifikat siap. Data final akan mengikuti peserta eligible dari database.');
       });
   };

   async function initOpsModule(label, action, tableBodyId, renderer) {
       await window.loadSidebar();
       if (!window.checkAdminAccess()) return;
       window.updateAdminProfile();
       window.logAdminActivity(`Sedang melihat halaman ${label}`);

       const syncBtn = document.querySelector(`#${tableBodyId}`)?.closest('.data-section, .ops-panel')?.querySelector('.btn-action');
       if (syncBtn) {
           syncBtn.onclick = () => loadOpsTable(action, tableBodyId, renderer);
       }
       await loadOpsTable(action, tableBodyId, renderer);
   }

   async function loadOpsTable(action, tableBodyId, renderer) {
       const tableBody = document.getElementById(tableBodyId);
       if (!tableBody) return;

       tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);"><i class="fas fa-circle-notch fa-spin"></i> Sinkronisasi data...</td></tr>`;
       try {
           const response = await fetch(API_URL, {
               method: 'POST',
               body: JSON.stringify({ action })
           });
           const result = await response.json();
           if (result.status !== 'success') throw new Error(result.message || 'Gagal memuat data');
           const rows = result.data || result.sessions || result.projects || result.certificates || [];
           renderer(Array.isArray(rows) && rows.length ? rows : getDefaultOpsRows(tableBodyId));
       } catch (error) {
           renderer(getDefaultOpsRows(tableBodyId));
       }
   }

   function readLocalRows(key) {
       try { return JSON.parse(localStorage.getItem(key) || '[]'); }
       catch (error) { return []; }
   }

   function writeLocalRows(key, rows) {
       localStorage.setItem(key, JSON.stringify(rows));
   }

   function getDefaultOpsRows(tableBodyId) {
       if (tableBodyId === 'bootcampSessionBody') {
           const local = readLocalRows('herai_bootcamp_sessions');
           return local.length ? local : [{ title: 'AI Fundamentals', date: 'TBD', mentor: 'Mentor Team', link: '#/assets', attendance: '0 / 100', status: 'Planned' }];
       }
       if (tableBodyId === 'projectBoardBody') {
           const local = readLocalRows('herai_final_projects');
           return local.length ? local : [{ team: 'Team A', project: 'Untitled AI Project', mentor: 'TBD', repository: '-', score: 0, status: 'Draft' }];
       }
       const local = readLocalRows('herai_certificates');
       return local.length ? local : [{ no: 'HERAI-2026-0001', name: '-', score: 0, status: 'Pending', issuedAt: '-' }];
   }

   function renderBootcampSessions(rows) {
       const tbody = document.getElementById('bootcampSessionBody');
       if (!tbody) return;
       tbody.innerHTML = rows.map(row => `
           <tr><td>${escapeHtml(row.title || row.session || '-')}</td><td>${escapeHtml(row.date || '-')}</td><td>${escapeHtml(row.mentor || '-')}</td><td><a href="${escapeAttr(row.link || '#/assets')}">Open Link</a></td><td>${escapeHtml(row.attendance || '0 / 100')}</td><td><span class="badge pending">${escapeHtml(row.status || 'Planned')}</span></td></tr>
       `).join('');
       document.getElementById('bootcampActiveCount').textContent = '0';
       document.getElementById('bootcampDoneCount').textContent = rows.filter(row => String(row.status).toLowerCase() === 'done').length;
       document.getElementById('bootcampAttendanceAvg').textContent = rows.length ? '0%' : '0%';
   }

   function renderFinalProjects(rows) {
       const tbody = document.getElementById('projectBoardBody');
       if (!tbody) return;
       tbody.innerHTML = rows.map(row => `
           <tr><td>${escapeHtml(row.team || '-')}</td><td>${escapeHtml(row.project || '-')}</td><td>${escapeHtml(row.mentor || '-')}</td><td>${row.repository && row.repository !== '-' ? `<a href="${escapeAttr(row.repository)}" target="_blank">Repo</a>` : '-'}</td><td>${escapeHtml(row.score ?? 0)}</td><td><span class="badge pending">${escapeHtml(row.status || 'Draft')}</span></td></tr>
       `).join('');
       document.getElementById('projectTeamCount').textContent = rows.length;
       document.getElementById('projectSubmittedCount').textContent = rows.filter(row => String(row.status).toLowerCase().includes('submit')).length;
       document.getElementById('projectReadyCount').textContent = rows.filter(row => String(row.status).toLowerCase().includes('ready')).length;
   }

   function renderCertificates(rows) {
       const tbody = document.getElementById('certificateRegistryBody');
       if (!tbody) return;
       tbody.innerHTML = rows.map(row => `
           <tr><td>${escapeHtml(row.no || row.certificateNo || '-')}</td><td>${escapeHtml(row.name || '-')}</td><td>${escapeHtml(row.score ?? row.finalScore ?? 0)}</td><td><span class="badge pending">${escapeHtml(row.status || 'Pending')}</span></td><td>${escapeHtml(row.issuedAt || '-')}</td><td><button class="btn-action" onclick="alert('Preview sertifikat akan mengikuti template final.')">Preview</button></td></tr>
       `).join('');
       document.getElementById('certEligibleCount').textContent = rows.length;
       document.getElementById('certSentCount').textContent = rows.filter(row => String(row.status).toLowerCase() === 'sent').length;
       document.getElementById('certPendingCount').textContent = rows.filter(row => String(row.status).toLowerCase() !== 'sent').length;
   }
   
   // ==========================================
   // 5. RBAC AUTH
   // ==========================================
   window.initRbac = async function() {
       await window.loadSidebar();
       if (!window.checkAdminAccess()) return;
       window.updateAdminProfile();
   
       window.logAdminActivity("Sedang melihat halaman RBAC Auth");
   
       // Load data admin dari Google Sheets
       await loadAdminData();
       
       const btnAdd = document.getElementById('btnAddAdmin');
       if (btnAdd) {
           btnAdd.onclick = () => {
               window.logAdminActivity("Membuka form Tambah Admin/Role Baru");
               window.toggleModal('adminModal', 'open');
           };
       }
       
       const btnSaveAdmin = document.getElementById('btnSaveAdmin');
       if (btnSaveAdmin) {
           btnSaveAdmin.onclick = () => {
               window.logAdminActivity("Menyimpan data Admin/Role baru");
               saveNewAdmin();
           };
       }
       
       document.addEventListener('click', e => {
           if (window.location.hash !== '#/rbac') return;
           if (e.target.closest('#btnCloseAdmin') || e.target.closest('#btnCancelAdmin')) {
               window.logAdminActivity("Membatalkan/Menutup form Tambah Admin");
               window.toggleModal('adminModal', 'close');
           }
           
           // Handle edit & delete buttons
           if (e.target.closest('.btn-edit-admin')) {
               const adminId = e.target.closest('.btn-edit-admin').dataset.id;
               window.logAdminActivity(`Mengedit data Admin ID: ${adminId}`);
               editAdmin(adminId);
           }
           
           if (e.target.closest('.btn-delete-admin')) {
               const adminId = e.target.closest('.btn-delete-admin').dataset.id;
               window.logAdminActivity(`Menghapus Admin ID: ${adminId}`);
               deleteAdmin(adminId);
           }
       });
   };
   
   // Helper functions untuk RBAC
   async function loadAdminData() {
       const tableBody = document.getElementById('adminTableBody');
       const loading = document.getElementById('loadingAdmins');
       
       if (!tableBody) return;
       
       loading?.classList.remove('hidden');
       tableBody.innerHTML = '';
       
       try {
           const response = await fetch(API_URL, {
               method: 'POST',
               body: JSON.stringify({ action: 'getAdmins' })
           });
           
           const result = await response.json();
           
           const admins = result.admins || result.data || [];
           if (result.status === 'success' && admins.length) {
               renderAdminTable(admins);
           } else {
               renderAdminTable(getDefaultAdmins());
           }
       } catch (error) {
           console.error('Error loading admin data:', error);
           renderAdminTable(getDefaultAdmins());
       } finally {
           loading?.classList.add('hidden');
       }
   }

   function getDefaultAdmins() {
       return [
           { adminId: 'ROOT-CHEN', name: 'Marchel Andrian', role: 'superadmin', active: true, lastLogin: 'Baru saja' },
           { adminId: 'REV-FENDY', name: 'Fendy Hendriyanto', role: 'reviewer', active: true, lastLogin: '-' },
           { adminId: 'KUR-DITHA', name: 'Ditha Adinda', role: 'kurator', active: true, lastLogin: '-' }
       ];
   }
   
   function renderAdminTable(admins) {
       const tableBody = document.getElementById('adminTableBody');
       if (!tableBody) return;
       
       tableBody.innerHTML = '';
       
       admins.forEach(rawAdmin => {
           const admin = normalizeAdminRecord(rawAdmin);
           const roleClass = admin.role === 'superadmin' ? 'role-super' : 
                            admin.role === 'kurator' ? 'role-kurator' : 'role-reviewer';
           const moduleAccess = admin.role === 'superadmin' ? 'ALL MODULES'
                              : admin.role === 'kurator' ? 'Seleksi Tahap 1, Anti-Fraud'
                              : 'Skoring, AI Pre-Screening';
           
           const row = `
               <tr>
                   <td>
                       <div style="font-weight: 700; color: var(--dark-purple);">${escapeHtml(admin.name)}</div>
                       <div style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace;">ID: ${escapeHtml(admin.adminId)}</div>
                   </td>
                   <td><span class="role-badge ${roleClass}">${admin.roleLabel}</span></td>
                   <td style="font-size: 0.85rem; color: var(--text-muted);">${moduleAccess}</td>
                   <td style="font-size: 0.85rem; color: var(--text-dark);">${escapeHtml(admin.lastLogin || '-')}</td>
                   <td><span class="badge" style="background: rgba(5, 205, 153, 0.1); color: var(--success); border: 1px solid rgba(5, 205, 153, 0.3);">${admin.active ? 'Active' : 'Inactive'}</span></td>
                   <td>
                       <div style="display:flex; gap:8px; justify-content:center;">
                           <button class="btn-action btn-edit-admin" data-id="${escapeAttr(admin.adminId)}" title="Reset password"><i class="fas fa-key"></i></button>
                           <button class="btn-action btn-delete-admin" data-id="${escapeAttr(admin.adminId)}" style="color: var(--danger); border-color: rgba(230,57,70,0.3);" title="Cabut akses"><i class="fas fa-user-slash"></i></button>
                       </div>
                   </td>
               </tr>
           `;
           tableBody.insertAdjacentHTML('beforeend', row);
       });

       const setStat = (id, value) => { const el = document.getElementById(id); if (el) el.innerHTML = `${value} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">User</span>`; };
       setStat('statTotalAdmins', admins.length);
       setStat('statSuperAdmins', admins.map(normalizeAdminRecord).filter(admin => admin.role === 'superadmin').length);
   }

   function normalizeAdminRecord(admin) {
       const roleRaw = String(admin.role || admin.peran_admin || 'reviewer').toLowerCase().replace(/\s+/g, '');
       const role = roleRaw.includes('super') ? 'superadmin' : roleRaw.includes('kurator') || roleRaw.includes('admin') ? 'kurator' : 'reviewer';
       const roleLabel = role === 'superadmin' ? 'Super Admin' : role === 'kurator' ? 'Kurator Data' : 'Reviewer';
       return {
           adminId: admin.adminId || admin.id_admin || admin.id || '-',
           name: admin.name || admin.nama_admin || admin.adminName || admin.adminId || admin.id_admin || 'Admin',
           role,
           roleLabel,
           lastLogin: admin.lastLogin || admin.last_login || '-',
           active: admin.active !== false && admin.status !== 'inactive'
       };
   }
   
   async function saveNewAdmin() {
       const name = document.getElementById('adminName')?.value.trim();
       const adminId = document.getElementById('adminUsername')?.value.trim();
       const password = document.getElementById('adminPass')?.value.trim();
       const role = document.querySelector('input[name="role"]:checked')?.value || 'reviewer';
       
       if (!name || !adminId || !password || !role) {
           alert('Semua field harus diisi!');
           return;
       }
       
       try {
           const response = await fetch(API_URL, {
               method: 'POST',
               body: JSON.stringify({
                   action: 'addAdmin',
                   adminId,
                   id_admin: adminId,
                   name,
                   password,
                   role,
                   peran_admin: role
               })
           });
           
           const result = await response.json();
           
           if (result.status === 'success') {
               alert('Admin berhasil ditambahkan!');
               window.toggleModal('adminModal', 'close');
               await loadAdminData();
               
               // Reset form
               document.getElementById('adminForm')?.reset();
           } else {
               alert('Gagal menambahkan admin: ' + result.message);
           }
       } catch (error) {
           console.error('Error saving admin:', error);
           alert('Terjadi kesalahan saat menyimpan data');
       }
   }
   
   async function editAdmin(adminId) {
       // Implementasi edit - bisa di-customize sesuai kebutuhan
       const newPassword = prompt(`Masukkan password baru untuk ${adminId}:`);
       if (!newPassword) return;
       
       try {
           const response = await fetch(API_URL, {
               method: 'POST',
               body: JSON.stringify({
                   action: 'updateAdmin',
                   adminId,
                   id_admin: adminId,
                   password: newPassword
               })
           });
           
           const result = await response.json();
           
           if (result.status === 'success') {
               alert('Password berhasil diupdate!');
               await loadAdminData();
           } else {
               alert('Gagal mengupdate password: ' + result.message);
           }
       } catch (error) {
           console.error('Error updating admin:', error);
           alert('Terjadi kesalahan saat mengupdate data');
       }
   }
   
   async function deleteAdmin(adminId) {
       if (!confirm(`Apakah Anda yakin ingin menghapus admin ${adminId}?`)) return;
       
       try {
           const response = await fetch(API_URL, {
               method: 'POST',
               body: JSON.stringify({
                   action: 'deleteAdmin',
                   adminId,
                   id_admin: adminId
               })
           });
           
           const result = await response.json();
           
           if (result.status === 'success') {
               alert('Admin berhasil dihapus!');
               await loadAdminData();
           } else {
               alert('Gagal menghapus admin: ' + result.message);
           }
       } catch (error) {
           console.error('Error deleting admin:', error);
           alert('Terjadi kesalahan saat menghapus data');
       }
   }

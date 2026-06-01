/**
 * js/main.js
 * Dioptimalkan untuk Arsitektur SPA (Single Page Application)
 * Data Sorcerers - HerAI Fellowship
 */

(function() {
    'use strict';

    const GLOBAL_SETTINGS_KEY = 'heraiGlobalSettings';
    const DEFAULT_GLOBAL_SETTINGS = {
        registrationOpen: true,
        afirmasiOpen: true,
        announcementLive: false,
        announcementLaunchAt: '',
        participantPortalOpen: false,
        competencyTestOpen: false,
        maintenanceMode: false,
        registrationClosedMessage: 'Pendaftaran HerAI Fellowship Batch 1 (2026) telah resmi ditutup.',
        twibbonUrl: '#/twibbon',
        passedInfoMessage: 'Harap periksa email Anda untuk undangan grup Telegram.'
    };

    window.getGlobalSettings = function() {
        try {
            const saved = JSON.parse(localStorage.getItem(GLOBAL_SETTINGS_KEY) || '{}');
            return { ...DEFAULT_GLOBAL_SETTINGS, ...saved };
        } catch (error) {
            console.warn('Global settings rusak, memakai default.', error);
            return { ...DEFAULT_GLOBAL_SETTINGS };
        }
    };

    window.getGlobalSettingsAsync = async function() {
        const localSettings = window.getGlobalSettings();
        try {
            const response = await fetch('/__settings', { cache: 'no-store' });
            if (!response.ok) return localSettings;
            const result = await response.json();
            const remoteSettings = result.settings || {};
            const merged = Object.keys(remoteSettings).length > 0
                ? { ...DEFAULT_GLOBAL_SETTINGS, ...localSettings, ...remoteSettings }
                : localSettings;
            localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(merged));
            return merged;
        } catch {
            return localSettings;
        }
    };

    window.saveGlobalSettings = function(settings) {
        const merged = { ...DEFAULT_GLOBAL_SETTINGS, ...settings };
        localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('globalSettingsUpdated', { detail: merged }));
        return merged;
    };

    window.saveGlobalSettingsAsync = async function(settings) {
        const merged = window.saveGlobalSettings(settings);
        try {
            await fetch('/__settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: merged })
            });
        } catch (error) {
            console.warn('Gagal menyimpan settings ke server lokal, memakai localStorage.', error);
        }
        return merged;
    };

    window.resetGlobalSettings = function() {
        localStorage.removeItem(GLOBAL_SETTINGS_KEY);
        window.dispatchEvent(new CustomEvent('globalSettingsUpdated', { detail: { ...DEFAULT_GLOBAL_SETTINGS } }));
        return { ...DEFAULT_GLOBAL_SETTINGS };
    };

    window.renderPublicNotice = function(options = {}) {
        const {
            icon = 'fa-circle-info',
            title = 'Informasi',
            message = '',
            actionHref = '#/home',
            actionLabel = 'Kembali ke Beranda'
        } = options;

        return `
            <section style="min-height: 70vh; display: flex; align-items: center; justify-content: center; padding: 140px 20px 80px; background: #fcfcfd;">
                <div style="width: 100%; max-width: 640px; text-align: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 42px 34px; box-shadow: 0 20px 45px rgba(26,11,46,0.08);">
                    <div style="width: 68px; height: 68px; margin: 0 auto 20px; border-radius: 50%; background: #ffe6f2; color: #ff1493; display: flex; align-items: center; justify-content: center; font-size: 1.8rem;">
                        <i class="fas ${icon}"></i>
                    </div>
                    <h1 style="margin: 0 0 12px; color: #1a0b2e; font-family: 'Space Grotesk', sans-serif; font-size: 2rem;">${title}</h1>
                    <p style="margin: 0 auto 26px; color: #6b7a90; line-height: 1.7; max-width: 520px;">${message}</p>
                    <a href="${actionHref}" class="btn btn-primary nav-link" style="display: inline-flex; text-decoration: none;">${actionLabel}</a>
                </div>
            </section>
        `;
    };

    window.applyPublicVisibilitySettings = function(settings = window.getGlobalSettings()) {
        document.querySelectorAll('[data-setting-link="participant-portal"]').forEach(link => {
            link.style.display = settings.participantPortalOpen ? '' : 'none';
        });
    };

    // ==========================================
    // 1. FUNGSI KHUSUS NAVBAR (Dipanggil oleh router.js)
    // ==========================================
    window.initNavbar = function() {
        window.applyPublicVisibilitySettings();
        const burger = document.querySelector('.burger');
        const nav = document.querySelector('.nav-links');
        const navLinks = document.querySelectorAll('.nav-links > li');
        const dropBtn = document.querySelector('.dropbtn');
        const header = document.querySelector('header');

        // --- A. Mobile Burger Menu ---
        if (burger && nav && !burger.dataset.initialized) {
            burger.dataset.initialized = "true"; // Flagging SPA
            
            burger.addEventListener('click', () => {
                nav.classList.toggle('nav-active');
                burger.classList.toggle('toggle');

                // Animate Links
                navLinks.forEach((link, index) => {
                    if (link.style.animation) {
                        link.style.animation = '';
                    } else {
                        link.style.animation = `navLinkFade 0.5s ease forwards ${index / 7 + 0.3}s`;
                    }
                });
            });
        }

        // --- B. Dropdown Menu (Touch Support) ---
        if (dropBtn && !dropBtn.dataset.initialized) {
            dropBtn.dataset.initialized = "true";
            
            dropBtn.addEventListener('click', (e) => {
                if (window.innerWidth <= 992) {
                    e.preventDefault();
                    e.stopPropagation();
                    const dropContent = document.querySelector('.dropdown-content');
                    if(dropContent) {
                        dropContent.classList.toggle('show-dropdown-mobile');
                        dropContent.style.display = dropContent.classList.contains('show-dropdown-mobile') ? 'block' : 'none';
                    }
                }
            });

            // Tutup dropdown kalau klik di luar
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.dropdown')) {
                    const dropContent = document.querySelector('.dropdown-content');
                    if (dropContent && dropContent.classList.contains('show-dropdown-mobile')) {
                        dropContent.classList.remove('show-dropdown-mobile');
                        if (window.innerWidth <= 992) dropContent.style.display = 'none';
                    }
                }
            });
        }

        // --- C. Navbar Shadow on Scroll ---
        if (header && !header.dataset.initialized) {
            header.dataset.initialized = "true";
            window.addEventListener('scroll', () => {
                if (window.scrollY > 50) {
                    header.style.boxShadow = '0 5px 20px rgba(0,0,0,0.1)';
                } else {
                    header.style.boxShadow = '0 2px 15px rgba(0,0,0,0.05)';
                }
            }, { passive: true });
        }

        // --- D. Auto-Close Mobile Menu Saat Link Diklik ---
        document.querySelectorAll('.nav-link').forEach(link => {
            if(!link.dataset.clickInit) {
                link.dataset.clickInit = "true";
                link.addEventListener('click', () => {
                    if (window.innerWidth <= 992 && nav && nav.classList.contains('nav-active')) {
                        nav.classList.remove('nav-active');
                        if (burger) burger.classList.remove('toggle');
                        
                        const dropContent = document.querySelector('.dropdown-content');
                        if (dropContent) {
                            dropContent.classList.remove('show-dropdown-mobile');
                            dropContent.style.display = 'none';
                        }
                        
                        navLinks.forEach(li => li.style.animation = '');
                    }
                });
            }
        });
    };

    // ==========================================
    // 2. FUNGSI INTERAKSI HALAMAN (FAQ, dll)
    // ==========================================
    window.initPageInteractions = function() {
        
        // --- FAQ Accordion Logic ---
        const faqQuestions = document.querySelectorAll('.faq-question');
        
        faqQuestions.forEach(question => {
            if (question.dataset.initialized) return; // Mencegah klik ganda di SPA
            question.dataset.initialized = "true";
            
            question.addEventListener('click', function() {
                const currentItem = this.parentElement;
                const answer = this.nextElementSibling;
                const icon = this.querySelector('i');
                const isActive = currentItem.classList.contains('active');
                
                // Tutup semua accordion yang terbuka
                document.querySelectorAll('.faq-item').forEach(item => {
                    item.classList.remove('active');
                    const itemAnswer = item.querySelector('.faq-answer');
                    if(itemAnswer) {
                        itemAnswer.style.maxHeight = null;
                        itemAnswer.style.paddingTop = '0';
                        itemAnswer.style.paddingBottom = '0';
                    }
                    const itemIcon = item.querySelector('i');
                    if(itemIcon) itemIcon.style.transform = 'rotate(0deg)';
                });
                
                // Buka yang diklik
                if (!isActive) {
                    currentItem.classList.add('active');
                    answer.style.maxHeight = answer.scrollHeight + 40 + "px";
                    answer.style.paddingTop = '15px';
                    answer.style.paddingBottom = '20px';
                    if(icon) icon.style.transform = 'rotate(180deg)';
                }
            });
        });
    };

    // ==========================================
    // 3. LEGAL MODAL LOGIC (Privacy & Terms)
    // ==========================================
    window.openLegal = function(type) {
        const modalId = type === 'privacy' ? 'modal-privacy' : 'modal-terms';
        const modal = document.getElementById(modalId);
        
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Kunci scroll
            console.log(`🔓 Opening ${type} modal`);
        }
    };

    window.closeLegal = function() {
        const modals = document.querySelectorAll('.legal-modal');
        modals.forEach(modal => modal.classList.remove('active'));
        document.body.style.overflow = 'auto'; // Lepas scroll
    };

    // Klik di luar area putih modal untuk menutup
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('legal-modal')) {
            window.closeLegal();
        }
    });

    // Tekan ESC untuk menutup modal
    window.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            window.closeLegal();
        }
    });

    // ==========================================
    // 4. GLOBAL SECURITY (ANTI-COPY & INSPECT)
    // ==========================================
    // Cegah Klik Kanan (Kecuali pada elemen yang diizinkan)
    // document.addEventListener('contextmenu', function(e) {
    //     if (e.target.closest('.allow-select') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    //         return; // Biarkan klik kanan berfungsi di input/textarea/twibbon
    //     }
    //     e.preventDefault();
    // });

    // // Cegah Copy/Paste sembarangan (Kecuali pada elemen yang diizinkan)
    // document.addEventListener('copy', function(e) {
    //     if (e.target.closest('.allow-select') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    //         return;
    //     }
    //     e.preventDefault();
    //     // Opsional: alert('Menyalin konten dilarang pada halaman ini.');
    // });

    // ==========================================
    // 5. COMPONENT INJECTOR (SIDEBAR)
    // ==========================================
    window.loadSidebar = async function(activeMenuId) {
        const container = document.getElementById('sidebar-container');
        // Kalau nggak ada containernya (berarti lagi di halaman Home/Regis), skip aja
        if (!container) return; 

        try {
            const previousScrollTop = window.__HERAI_SIDEBAR_SCROLL_TOP__ || 0;
            // Ambil file HTML dari folder components
            if (!window.__HERAI_SIDEBAR_HTML__) {
                const response = await fetch('/components/sidebar.html');
                if (!response.ok) throw new Error('Gagal mengambil komponen sidebar');
                window.__HERAI_SIDEBAR_HTML__ = await response.text();
            }
            
            // Suntikkan HTML ke dalam container
            container.innerHTML = window.__HERAI_SIDEBAR_HTML__;
            if (typeof window.applyAdminSidebarAccess === 'function') {
                window.applyAdminSidebarAccess(container);
            }

            // Atur menu mana yang menyala (active)
            const navLinks = document.querySelectorAll('.sidebar .nav-link');
            navLinks.forEach(link => {
                link.classList.remove('active');
                link.addEventListener('click', () => {
                    const menu = container.querySelector('.nav-menu');
                    window.__HERAI_SIDEBAR_SCROLL_TOP__ = menu ? menu.scrollTop : 0;
                });
            });
            
            const activeLink = document.getElementById(activeMenuId);
            if (activeLink) activeLink.classList.add('active');

            const menu = container.querySelector('.nav-menu');
            if (menu) {
                menu.scrollTop = previousScrollTop;
                if (activeLink) {
                    activeLink.scrollIntoView({ block: 'nearest' });
                    window.__HERAI_SIDEBAR_SCROLL_TOP__ = menu.scrollTop;
                }
                menu.addEventListener('scroll', () => {
                    window.__HERAI_SIDEBAR_SCROLL_TOP__ = menu.scrollTop;
                }, { passive: true });
            }

            // Pasang ulang tombol Logout karena elemennya baru saja di-render
            const logoutBtn = document.querySelector('.logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    sessionStorage.removeItem('isAdminLoggedIn');
                    localStorage.removeItem('adminId');
                    localStorage.removeItem('heraiAdminProfile');
                    window.location.hash = "#/home"; // Lempar ke halaman depan
                });
            }

        } catch (error) {
            console.error('Sihir inject sidebar gagal:', error);
            container.innerHTML = `<div style="padding: 20px; color: red;">Gagal memuat sidebar. Pastikan jalan di Live Server.</div>`;
        }
    };

})(); // Akhir IIFE (Immediately Invoked Function Expression)

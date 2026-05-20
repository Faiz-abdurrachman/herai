/* ==========================================================================
   TWIBBON LOGIC (js/twibbon.js)
   VERSI FINAL: AUTO-INJECT LIBRARY & SPA STABLE
   ========================================================================== */

   (function() {
    'use strict';

    // Jurus Ninja: Fungsi untuk memanggil html2canvas secara dinamis
    function loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            if (typeof html2canvas !== 'undefined') {
                resolve(); // Kalau udah ada, langsung gas
                return;
            }
            console.log("🪄 Memanggil library html2canvas dari awan (CDN)...");
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Gagal memuat library pembuat gambar. Cek koneksi internet."));
            document.head.appendChild(script);
        });
    }

    window.initTwibbon = function() {
        const twibbonContainer = document.getElementById('twibbonContainer');
        
        if (!twibbonContainer || twibbonContainer.dataset.initialized === "true") return;
        twibbonContainer.dataset.initialized = "true";

        console.log("🪄 HerAI Twibbon Editor Initialized...");

        // --- DOM Elements ---
        const imageUpload = document.getElementById('imageUpload');
        const userPhoto = document.getElementById('userPhoto');
        const uploadPlaceholder = document.getElementById('uploadPlaceholder');
        const photoControls = document.getElementById('photoControls');
        const zoomSlider = document.getElementById('zoomSlider');
        const btnDownload = document.getElementById('btnDownload');
        const btnCopyCaption = document.getElementById('btnCopyCaption');
        const captionText = document.getElementById('captionText');
        const magicOverlay = document.getElementById('magicOverlay');
        const magicBar = document.getElementById('magicBar');

        if (!imageUpload) return;

        let currentScale = 1;
        let posX = 0;
        let posY = 0;
        let isDragging = false;
        let startX, startY;
        let isPhotoUploaded = false;

        // 1. UPLOAD
        imageUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (!file.type.match('image.*')) {
                    alert('Tolong unggah file gambar yang valid (JPG/PNG).');
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(event) {
                    userPhoto.src = event.target.result;
                    uploadPlaceholder.style.display = 'none';
                    twibbonContainer.style.display = 'block';
                    photoControls.style.display = 'flex';
                    isPhotoUploaded = true;
                    btnDownload.disabled = false;
                    resetTransform();
                };
                reader.readAsDataURL(file);
            }
        });

        // 2. TRANSFORM
        const updateTransform = () => {
            userPhoto.style.transform = `translate(calc(-50% + ${posX}px), calc(-50% + ${posY}px)) scale(${currentScale})`;
        };

        function resetTransform() {
            currentScale = 1; posX = 0; posY = 0;
            if(zoomSlider) zoomSlider.value = 1;
            updateTransform();
        }

        twibbonContainer.addEventListener('mousedown', (e) => {
            if (!isPhotoUploaded) return;
            isDragging = true;
            startX = e.clientX - posX; startY = e.clientY - posY;
            twibbonContainer.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            posX = e.clientX - startX; posY = e.clientY - startY;
            updateTransform();
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            if (twibbonContainer) twibbonContainer.style.cursor = 'move';
        });

        twibbonContainer.addEventListener('touchstart', (e) => {
            if (!isPhotoUploaded) return;
            isDragging = true;
            const touch = e.touches[0];
            startX = touch.clientX - posX; startY = touch.clientY - posY;
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            posX = touch.clientX - startX; posY = touch.clientY - startY;
            updateTransform();
        }, { passive: true });

        window.addEventListener('touchend', () => { isDragging = false; });

        if (zoomSlider) zoomSlider.addEventListener('input', (e) => {
            currentScale = parseFloat(e.target.value); updateTransform();
        });

        if (document.getElementById('btnZoomIn')) document.getElementById('btnZoomIn').addEventListener('click', () => {
            currentScale = Math.min(currentScale + 0.1, 3); zoomSlider.value = currentScale; updateTransform();
        });

        if (document.getElementById('btnZoomOut')) document.getElementById('btnZoomOut').addEventListener('click', () => {
            currentScale = Math.max(currentScale - 0.1, 0.1); zoomSlider.value = currentScale; updateTransform();
        });

        if (document.getElementById('btnReset')) document.getElementById('btnReset').addEventListener('click', resetTransform);

        // 3. RENDER (WITH AUTO-LOADER)
        if (btnDownload) {
            btnDownload.addEventListener('click', async () => {
                if (btnDownload.disabled) return;

                if(magicOverlay) {
                    magicOverlay.style.display = 'flex';
                    magicOverlay.classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
                
                if(magicBar) magicBar.style.width = '20%';

                try {
                    // Panggil fungsi ninja kita sebelum nge-render
                    await loadHtml2Canvas();
                    
                    if(magicBar) magicBar.style.width = '50%';

                    // Sekarang html2canvas PASTI sudah defined
                    const canvas = await window.html2canvas(twibbonContainer, {
                        scale: 3, 
                        useCORS: true, 
                        allowTaint: false,
                        backgroundColor: null,
                        logging: true
                    });

                    if(magicBar) magicBar.style.width = '100%';

                    setTimeout(() => {
                        const link = document.createElement('a');
                        link.download = `Twibbon-HerAI-2026.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                        
                        if(magicOverlay) {
                            magicOverlay.classList.remove('active');
                            magicOverlay.style.display = 'none';
                            document.body.style.overflow = 'auto';
                        }
                        if(magicBar) magicBar.style.width = '0%';
                    }, 500);

                } catch (error) {
                    console.error('Render Error Asli:', error);
                    alert('Gagal! ' + error.message);
                    if(magicOverlay) {
                        magicOverlay.classList.remove('active');
                        magicOverlay.style.display = 'none';
                        document.body.style.overflow = 'auto';
                    }
                }
            });
        }

        // 4. COPY CAPTION
        if (btnCopyCaption && captionText) {
            window.copyCaption = function() {
                captionText.select();
                captionText.setSelectionRange(0, 99999);
                navigator.clipboard.writeText(captionText.value).then(() => {
                    const originalHTML = btnCopyCaption.innerHTML;
                    btnCopyCaption.innerHTML = '<i class="fas fa-check"></i> Tersalin!';
                    btnCopyCaption.style.backgroundColor = 'var(--primary-pink)';
                    btnCopyCaption.style.color = '#fff';
                    btnCopyCaption.style.borderColor = 'var(--primary-pink)';
                    setTimeout(() => {
                        btnCopyCaption.innerHTML = originalHTML;
                        btnCopyCaption.style.backgroundColor = 'var(--dark-purple)';
                        btnCopyCaption.style.color = '#fff';
                        btnCopyCaption.style.borderColor = 'transparent';
                    }, 2500);
                }).catch(() => {
                    document.execCommand("copy"); alert("Teks berhasil disalin!");
                });
            };
            btnCopyCaption.addEventListener('click', window.copyCaption);
        }
    };

    const twibbonInterval = setInterval(() => {
        if (document.getElementById('twibbonContainer')) {
            window.initTwibbon();
            clearInterval(twibbonInterval);
        }
    }, 300);

})();
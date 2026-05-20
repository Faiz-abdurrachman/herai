/* ==========================================================================
   Scripts Khusus Halaman Register (js/register.js)
   VERSI FINAL: POP-UP DYNAMIC FORM & FULL LOGIC INTEGRATION
   ========================================================================== */

   window.initRegisterLogic = function() {
    
    // 🛡️ SAFETY CHECK: Pastikan form benar-benar ada di layar
    const form = document.getElementById('registrationForm');
    if (!form) return;

    const globalSettings = typeof window.getGlobalSettings === 'function' ? window.getGlobalSettings() : {};
    const formContainer = document.querySelector('.form-container');

    if (globalSettings.registrationOpen === false) {
        if (formContainer && typeof window.renderPublicNotice === 'function') {
            formContainer.innerHTML = window.renderPublicNotice({
                icon: 'fa-door-closed',
                title: 'Pendaftaran Ditutup',
                message: globalSettings.registrationClosedMessage || 'Pendaftaran HerAI Fellowship Batch 1 (2026) telah resmi ditutup.',
                actionHref: '#/home',
                actionLabel: 'Kembali ke Beranda'
            });
            formContainer.style.padding = '0';
            formContainer.style.boxShadow = 'none';
            formContainer.style.background = 'transparent';
        }
        return;
    }

    // ==========================================
    // 1. POP-UP DYNAMIC FORM LOGIC
    // ==========================================
    const statusSelect = document.getElementById('statusSelect');
    const statusFeedback = document.getElementById('statusFeedback');
    const btnEditDetail = document.getElementById('btnEditDetail');
    
    const modalMahasiswa = document.getElementById('modalMahasiswa');
    const modalProfesional = document.getElementById('modalProfesional');
    
    // Hidden Inputs (Tempat menyimpan data dari Pop-Up secara diam-diam)
    const hiddenAsalKampus = document.getElementById('asalKampus');
    const hiddenProgramStudi = document.getElementById('programStudi');
    const hiddenNamaInstansi = document.getElementById('namaInstansi');
    const hiddenPosisiJabatan = document.getElementById('posisiJabatan');
    const hiddenDeskripsiKerja = document.getElementById('deskripsiKerja');

    let currentStatus = '';
    let isDetailSaved = false;

    const jalurPendaftaran = document.getElementById('jalurPendaftaran');
    const afirmasiOption = jalurPendaftaran?.querySelector('option[value="afirmasi"]');
    if (afirmasiOption && globalSettings.afirmasiOpen === false) {
        afirmasiOption.disabled = true;
        afirmasiOption.textContent = 'Jalur Afirmasi Khusus (Ditutup)';
    }

    jalurPendaftaran?.addEventListener('change', function() {
        if (globalSettings.afirmasiOpen === false && this.value === 'afirmasi') {
            alert('Jalur Afirmasi 3T sedang ditutup oleh admin. Silakan pilih Jalur Reguler Umum.');
            this.value = '';
        }
    });

    if (statusSelect) {
        // Trigger Popup saat dropdown dipilih
        statusSelect.addEventListener('change', function() {
            currentStatus = this.value;
            statusFeedback.style.display = 'none';
            isDetailSaved = false;

            // Reset Hidden Data setiap kali ganti pilihan
            hiddenAsalKampus.value = ''; 
            hiddenProgramStudi.value = '';
            hiddenNamaInstansi.value = ''; 
            hiddenPosisiJabatan.value = ''; 
            hiddenDeskripsiKerja.value = '';

            // Munculkan modal yang sesuai
            if (currentStatus === 'mahasiswa' || currentStatus === 'fresh_graduate') {
                modalMahasiswa.classList.add('active');
            } else if (currentStatus === 'profesional') {
                modalProfesional.classList.add('active');
            } else if (currentStatus === 'lainnya') {
                isDetailSaved = true; // "Lainnya" tidak butuh detail, langsung pass
            }
        });
    }

    // Tombol Edit Detail (jika ingin mengubah data pop-up)
    if (btnEditDetail) {
        btnEditDetail.addEventListener('click', () => {
            if (currentStatus === 'mahasiswa' || currentStatus === 'fresh_graduate') {
                modalMahasiswa.classList.add('active');
            } else if (currentStatus === 'profesional') {
                modalProfesional.classList.add('active');
            }
        });
    }

    // Logika Simpan Data Pop-Up Mahasiswa
    document.getElementById('btnSaveMahasiswa')?.addEventListener('click', () => {
        const popKampus = document.getElementById('popAsalKampus').value;
        const popProdi = document.getElementById('popProgramStudi').value;
        
        if(!popKampus || !popProdi) { 
            alert('Harap isi semua bidang detail akademik!'); 
            return; 
        }
        
        hiddenAsalKampus.value = popKampus;
        hiddenProgramStudi.value = popProdi;
        isDetailSaved = true;
        
        modalMahasiswa.classList.remove('active');
        statusFeedback.style.display = 'flex'; // Munculkan teks "Detail Tersimpan"
    });

    // Logika Simpan Data Pop-Up Profesional
    document.getElementById('btnSaveProfesional')?.addEventListener('click', () => {
        const popInstansi = document.getElementById('popNamaInstansi').value;
        const popPosisi = document.getElementById('popPosisiJabatan').value;
        const popDeskripsi = document.getElementById('popDeskripsiKerja').value;
        
        if(!popInstansi || !popPosisi || !popDeskripsi) { 
            alert('Harap isi semua bidang detail profesional!'); 
            return; 
        }
        
        hiddenNamaInstansi.value = popInstansi;
        hiddenPosisiJabatan.value = popPosisi;
        hiddenDeskripsiKerja.value = popDeskripsi;
        isDetailSaved = true;
        
        modalProfesional.classList.remove('active');
        statusFeedback.style.display = 'flex'; // Munculkan teks "Detail Tersimpan"
    });

    // Logika Tutup Modal (Batal) - Reset pilihan dropdown jika dibatalkan
    const handleCloseCancel = (modalId) => {
        document.getElementById(modalId).classList.remove('active');
        if (!isDetailSaved) {
            statusSelect.value = ''; // Kembalikan ke opsi kosong
            currentStatus = '';
        }
    }
    document.getElementById('btnCloseMahasiswa')?.addEventListener('click', () => handleCloseCancel('modalMahasiswa'));
    document.getElementById('btnCloseProfesional')?.addEventListener('click', () => handleCloseCancel('modalProfesional'));


    // ==========================================
    // 2. NIK API EXTRACTOR LOGIC
    // ==========================================
    const inputNIK = document.getElementById('inputNIK');
    const nikInfo = document.getElementById('nikInfo');
    const nikTitle = document.getElementById('nikTitle');
    const nikProv = document.getElementById('nikProv');
    const nikKab = document.getElementById('nikKab');
    const nikKec = document.getElementById('nikKec');
    const nikGender = document.getElementById('nikGender');
    const inputTanggalLahir = document.getElementById('inputTanggalLahir');

    const URL_PROV = "https://raw.githubusercontent.com/yusufsyaifudin/wilayah-indonesia/master/data/list_of_area/provinces.json";
    const URL_KAB = "https://raw.githubusercontent.com/yusufsyaifudin/wilayah-indonesia/master/data/list_of_area/regencies.json";
    const URL_KEC = "https://raw.githubusercontent.com/yusufsyaifudin/wilayah-indonesia/master/data/list_of_area/districts.json";

    // Caching agar ringan
    let cachedProvinces = null;
    let cachedRegencies = null;
    let cachedDistricts = null;

    const updateUI = (el, icon, label, text, isDim) => {
        const color = isDim ? 'var(--gray-medium)' : 'var(--primary-pink)';
        const textClass = isDim ? 'text-dim' : '';
        el.innerHTML = `<i class="fas ${icon}" style="width: 20px; color: ${color};"></i> <span class="${textClass}">${label}: <strong>${text}</strong></span>`;
    };

    if(inputNIK) {
        inputNIK.addEventListener('input', function() {
            let nik = this.value.replace(/\D/g, ''); 
            this.value = nik; 
            
            if (nik.length >= 2) {
                nikInfo.style.display = 'block';
                nikTitle.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mendeteksi NIK...';

                // PROVINSI
                let kodeProv = nik.substring(0, 2);
                if (!cachedProvinces) {
                    updateUI(nikProv, 'fa-map', 'Provinsi', 'Memuat data...', false);
                    fetch(URL_PROV).then(r => r.json()).then(data => {
                        cachedProvinces = data; processProv(kodeProv);
                    }).catch(() => updateUI(nikProv, 'fa-map', 'Provinsi', 'Error API', false));
                } else {
                    processProv(kodeProv);
                }

                // KABUPATEN
                if (nik.length >= 4) {
                    let kodeKab = nik.substring(0, 4);
                    if (!cachedRegencies) {
                        updateUI(nikKab, 'fa-city', 'Kab/Kota', 'Memuat data...', false);
                        fetch(URL_KAB).then(r => r.json()).then(data => {
                            cachedRegencies = data; processKab(kodeKab);
                        }).catch(() => updateUI(nikKab, 'fa-city', 'Kab/Kota', 'Error API', false));
                    } else {
                        processKab(kodeKab);
                    }
                } else {
                    updateUI(nikKab, 'fa-city', 'Kab/Kota', '-', true);
                }

                // KECAMATAN
                if (nik.length >= 6) {
                    let kodeKec = nik.substring(0, 6);
                    if (!cachedDistricts) {
                        updateUI(nikKec, 'fa-map-marker-alt', 'Kecamatan', 'Memuat data...', false);
                        fetch(URL_KEC).then(r => r.json()).then(data => {
                            cachedDistricts = data; processKec(kodeKec);
                        }).catch(() => updateUI(nikKec, 'fa-map-marker-alt', 'Kecamatan', 'Error API', false));
                    } else {
                        processKec(kodeKec);
                    }
                } else {
                    updateUI(nikKec, 'fa-map-marker-alt', 'Kecamatan', '-', true);
                }

                // VALIDASI 16 DIGIT (TANGGAL LAHIR & GENDER)
                if (nik.length === 16) {
                    nikTitle.innerHTML = '<i class="fas fa-check-circle" style="color: var(--secondary-purple);"></i> NIK Tervalidasi';
                    
                    let dd = parseInt(nik.substring(6, 8));
                    let mm = parseInt(nik.substring(8, 10));
                    let yy = parseInt(nik.substring(10, 12));

                    let isFemale = false;
                    if (dd > 40) { 
                        isFemale = true; 
                        dd -= 40; 
                    }
                    
                    let currentYear = new Date().getFullYear();
                    let yearPrefix = (yy > (currentYear % 100)) ? 1900 : 2000;
                    let fullYear = yearPrefix + yy;
                    
                    if(mm > 0 && mm <= 12 && dd > 0 && dd <= 31) {
                        inputTanggalLahir.value = `${fullYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
                    }

                    if(!isFemale) {
                        nikGender.innerHTML = `<i class="fas fa-mars" style="width: 20px; color: var(--primary-pink);"></i> Jenis Kelamin: <strong>Laki-laki</strong> <br><small style="color:red; margin-left:25px; font-weight:600;">(Peringatan: Program ini eksklusif untuk Perempuan)</small>`;
                    } else {
                        nikGender.innerHTML = `<i class="fas fa-venus" style="width: 20px; color: var(--primary-pink);"></i> Jenis Kelamin: <strong>Perempuan</strong>`;
                    }
                } else {
                    inputTanggalLahir.value = '';
                    updateUI(nikGender, 'fa-venus-mars', 'Jenis Kelamin', '-', true);
                }

            } else {
                nikInfo.style.display = 'none';
                inputTanggalLahir.value = '';
            }
        });
    }

    function processProv(kode) {
        const obj = cachedProvinces?.find(p => p.id === kode);
        updateUI(nikProv, 'fa-map', 'Provinsi', obj ? obj.name : 'Tidak Ditemukan', false);
    }
    function processKab(kode) {
        const obj = cachedRegencies?.find(k => k.id === kode);
        updateUI(nikKab, 'fa-city', 'Kab/Kota', obj ? obj.name : 'Tidak Ditemukan', false);
    }
    function processKec(kode) {
        const obj = cachedDistricts?.find(k => k.id === kode || k.id.startsWith(kode));
        updateUI(nikKec, 'fa-map-marker-alt', 'Kecamatan', obj ? obj.name : 'Tidak Ditemukan', false);
    }


    // ==========================================
    // 3. WORD COUNTER & MODAL T&C LOGIC
    // ==========================================
    const textareas = document.querySelectorAll('.word-count-textarea');
    textareas.forEach(textarea => {
        const maxWords = parseInt(textarea.getAttribute('data-max'));
        const counterDisplay = textarea.nextElementSibling; 

        textarea.addEventListener('input', function() {
            let words = this.value.match(/\S+/g);
            let wordCount = words ? words.length : 0;
            counterDisplay.textContent = `${wordCount} / ${maxWords} kata`;

            if (wordCount > maxWords) {
                counterDisplay.classList.add('limit-reached');
                this.style.borderColor = '#e74c3c';
            } else {
                counterDisplay.classList.remove('limit-reached');
                this.style.borderColor = '';
            }
        });

        textarea.addEventListener('paste', function(e) {
            let pasteContent = (e.clipboardData || window.clipboardData).getData('text');
            let pasteWordsCount = (pasteContent.match(/\S+/g) || []).length;
            let currentCount = (this.value.match(/\S+/g) || []).length;
            if (currentCount + pasteWordsCount > maxWords + 20) {
                alert('Teks yang disalin melebihi batas 500 kata. Harap diringkas kembali.');
            }
        });
    });

    const tncModal = document.getElementById('tncModal');
    const scrollArea = document.getElementById('scrollArea');
    const btnAgreeTnc = document.getElementById('btnAgreeTnc');
    const agreeCheckbox = document.getElementById('agreeCheckbox');
    const scrollAlertText = document.getElementById('scrollAlertText');

    document.getElementById('btnOpenModal')?.addEventListener('click', (e) => {
        e.preventDefault();
        tncModal.classList.add('active');
        document.body.style.overflow = 'hidden'; 
    });

    scrollArea?.addEventListener('scroll', function() {
        if (this.scrollTop + this.clientHeight >= this.scrollHeight - 20) {
            btnAgreeTnc.disabled = false;
            scrollAlertText.innerHTML = '<i class="fas fa-check-circle" style="color: var(--primary-pink);"></i> Anda sudah membaca seluruh ketentuan.';
        }
    });

    btnAgreeTnc?.addEventListener('click', (e) => {
        e.preventDefault();
        agreeCheckbox.disabled = false; 
        agreeCheckbox.checked = true; 
        document.querySelector('.terms-label').style.cursor = 'pointer';
        tncModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    });

    document.getElementById('btnCloseModal')?.addEventListener('click', (e) => {
        e.preventDefault();
        tncModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    });


    // ==========================================
    // 4. INTEGRASI SUBMISSION GAS
    // ==========================================
    const successModal = document.getElementById('successModal');
    const scriptURL = '/__gas';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const latestSettings = typeof window.getGlobalSettings === 'function' ? window.getGlobalSettings() : globalSettings;
        if (latestSettings.registrationOpen === false) {
            alert(latestSettings.registrationClosedMessage || 'Pendaftaran sedang ditutup.');
            return;
        }

        if (latestSettings.afirmasiOpen === false && document.getElementById('jalurPendaftaran')?.value === 'afirmasi') {
            alert('Jalur Afirmasi 3T sedang ditutup. Silakan pilih jalur pendaftaran lain.');
            return;
        }

        // 1. Validasi Pop-Up Detail
        if (!isDetailSaved && currentStatus !== 'lainnya' && currentStatus !== '') {
            alert('Harap isi Detail Akademik/Profesional Anda terlebih dahulu dengan mengklik "Edit Detail".');
            return;
        }
        
        // 2. Validasi T&C
        if (!agreeCheckbox.checked) {
            alert('Anda wajib menyetujui Syarat dan Ketentuan dengan mengklik teks yang tersedia pada formulir.');
            return;
        }

        // 3. Validasi Essay
        let hasError = false;
        textareas.forEach(t => {
            let words = t.value.match(/\S+/g);
            if (words && words.length > 500) hasError = true;
        });
        if (hasError) {
            alert('Gagal mengirim! Ada esai yang melebihi batas 500 kata. Harap tinjau kembali jawaban Anda.');
            return;
        }

        const btnSubmit = document.getElementById('btnSubmit');
        const originalBtnText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses Data...';
        btnSubmit.disabled = true;

        // Kumpulkan Data (Termasuk dari Hidden Inputs)
        const formData = {
            action: 'register',
            nama_lengkap: document.getElementById('namaLengkap').value,
            nik: document.getElementById('inputNIK').value,
            tempat_lahir: document.getElementById('tempatLahir').value,
            tanggal_lahir: document.getElementById('inputTanggalLahir').value,
            whatsapp: document.getElementById('whatsapp').value,
            email: document.getElementById('email').value,
            alamat: document.getElementById('alamat').value,
            jalur_pendaftaran: document.getElementById('jalurPendaftaran').value,
            status: statusSelect.value,
            
            universitas: hiddenAsalKampus.value,
            program_studi: hiddenProgramStudi.value,
            nama_instansi: hiddenNamaInstansi.value,
            posisi: hiddenPosisiJabatan.value,
            pengalaman_kerja: hiddenDeskripsiKerja.value,
            
            kejuaraan: document.getElementById('kejuaraan').value, 
            pengalaman_organisasi: document.getElementById('organisasi').value, 
            link_cv: document.getElementById('linkCv').value,
            
            essay_1: document.getElementById('essay1').value,
            essay_2: document.getElementById('essay2').value,
            essay_3: document.getElementById('essay3').value,
            essay_4: document.getElementById('essay4').value,
            essay_5: document.getElementById('essay5').value
        };

        try {
            const response = await fetch(scriptURL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if(result.status === 'success') {
                successModal.classList.add('active');
                document.body.style.overflow = 'hidden';
                form.reset(); 
                
                // Reset State UI Pop-Up
                statusFeedback.style.display = 'none';
                isDetailSaved = false;
                currentStatus = '';
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error pengiriman:', error);
            alert('Pendaftaran gagal terkirim. Mohon periksa kembali koneksi internet Anda atau coba beberapa saat lagi.');
        } finally {
            btnSubmit.innerHTML = originalBtnText;
            btnSubmit.disabled = false;
        }
    });

    // Routing Navigasi Sukses
    document.getElementById('btnSuccessClose')?.addEventListener('click', (e) => {
        e.preventDefault(); 
        successModal.classList.remove('active');
        document.body.style.overflow = 'auto'; 
        
        window.history.pushState({}, "", "/home");
        if(typeof router !== 'undefined' && router.handleRouting) {
            router.handleRouting();
        } else {
            window.location.href = "/home";
        }
    });
};

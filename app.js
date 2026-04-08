const firebaseConfig = {
  apiKey: "AIzaSyBSGtR2EZmewdFvUrmiSCsvvr_syZx3ieo",
  authDomain: "pengering-ikan-asin-4210c.firebaseapp.com",
  databaseURL: "https://pengering-ikan-asin-4210c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pengering-ikan-asin-4210c",
  storageBucket: "pengering-ikan-asin-4210c.firebasestorage.app",
  messagingSenderId: "1072915752651",
  appId: "1:1072915752651:web:4dae86275f2e9bf6fadd4e",
  measurementId: "G-DBPJXDZZM5"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 2. TAMPILAN HARI, TANGGAL, TAHUN
function updateDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    document.getElementById("dateDisplay").innerText = today.toLocaleDateString('id-ID', options);
}
updateDate(); // Panggil sekali saat load

// 3. VARIABEL GLOBAL UNTUK SISTEM
let systemStatus = "OFF";
let startTime = 0;
let timerInterval;

// Referensi Database
const refSuhu = db.ref('sensor/suhu');
const refKelembaban = db.ref('sensor/kelembaban');
const refStatus = db.ref('kontrol/status');
const refMode = db.ref('kontrol/mode');
const refStartTime = db.ref('kontrol/startTime');
const refServo = db.ref('sensor/servo');

// 4. MEMBACA DATA DARI FIREBASE SECARA REALTIME
refSuhu.on('value', (snapshot) => {
    document.getElementById("valSuhu").innerHTML = (snapshot.val() || 0) + " &deg;C";
});

refKelembaban.on('value', (snapshot) => {
    document.getElementById("valKelembaban").innerText = (snapshot.val() || 0) + " %";
});
// Membaca Sudut Servo dan Menerjemahkan ke Status Panas
refServo.on('value', (snapshot) => {
    let sudut = snapshot.val() || 0;
    document.getElementById("valServo").innerHTML = sudut + " &deg;";

    let status = "Tertutup";
    let warna = "#666"; // Abu-abu

    // Logika Indikator (Asumsi maksimal servo 180 derajat)
    // Silakan sesuaikan angka derajatnya dengan hasil defuzzifikasi Sugeno Anda
    if (sudut > 0 && sudut <= 60) {
        status = "Kurang Panas (Bukaan Sedikit)";
        warna = "#ffc107"; // Kuning
    } else if (sudut > 60 && sudut <= 120) {
        status = "Lumayan Panas (Bukaan Setengah)";
        warna = "#fd7e14"; // Oranye
    } else if (sudut > 120) {
        status = "Panas (Bukaan Full)";
        warna = "#dc3545"; // Merah
    } else {
        status = "Tertutup";
        warna = "#666";
    }

    let elStatus = document.getElementById("statusPanas");
    elStatus.innerText = status;
    elStatus.style.color = warna;
});

// Membaca Status ON/OFF dari Firebase untuk menyinkronkan Button
refStatus.on('value', (snapshot) => {
    systemStatus = snapshot.val() || "OFF";
    updateButtonUI();
    manageTimer(); // <-- TAMBAHKAN BARIS INI (Agar timer otomatis di-refresh saat status berubah)
});

// Membaca Mode Ikan dari Firebase
refMode.on('value', (snapshot) => {
    const mode = snapshot.val();
    if(mode) {
        document.getElementById("pilihIkan").value = mode;
    }
});

// Membaca Waktu Mulai (Start Time) untuk kalkulasi Timer
refStartTime.on('value', (snapshot) => {
    startTime = snapshot.val() || 0;
    manageTimer();
});

// 5. FUNGSI MENGENDALIKAN SISTEM (TOMBOL ON/OFF)
window.toggleSystem = function() {
    const selectedMode = document.getElementById("pilihIkan").value;
    
    if (systemStatus === "OFF") {
        // Menyalakan Sistem
        db.ref('kontrol').update({
            status: "ON",
            mode: selectedMode,
            startTime: Date.now(), // Catat waktu mulai dalam milidetik
            totalGasTerakhir: 0    // Reset data laporan sebelumnya menjadi 0 saat mulai baru
        });
    } else {
        // --- PROSES MENGHITUNG GAS AKHIR SEBELUM DIMATIKAN ---
        let now = Date.now();
        let diff = now - startTime; 
        let totalDetik = Math.floor(diff / 1000); 
        
        let rateGas = 0;
        if (selectedMode === "Ikan Bilis") {
            rateGas = 0.5;
        } else if (selectedMode === "Ikan Tamban") {
            rateGas = 0.8;
        } else if (selectedMode === "Sotong") {
            rateGas = 1.2;
        }

        let totalGasSelesai = totalDetik * rateGas; // Hasil akhir gas yang terpakai

        // Mematikan Sistem dan Menyimpan Laporan Gas ke Firebase
        db.ref('kontrol').update({
            status: "OFF",
            startTime: 0,
            totalGasTerakhir: totalGasSelesai // <--- MENGIRIM DATA GAS KE FIREBASE
        });
    }
}

// Update tampilan tombol menyesuaikan status
function updateButtonUI() {
    const btn = document.getElementById("btnPower");
    const select = document.getElementById("pilihIkan");
    
    if (systemStatus === "ON") {
        btn.innerText = "Hentikan Proses (OFF)";
        btn.classList.add("off");
        select.disabled = true; // Kunci pilihan saat sistem berjalan
    } else {
        btn.innerText = "Mulai Proses (ON)";
        btn.classList.remove("off");
        select.disabled = false;
    }
}

// 6. LOGIKA TIMER DAN PERHITUNGAN GAS
// (Catatan Peneliti: Ubah angka di bawah ini sesuai hasil kalibrasi gas Anda)
const konsumsiGasPerDetik = {
    "Ikan Bilis": 0.5,   // Contoh: butuh 0.5 gram gas per detik
    "Ikan Tamban": 0.8,  // Contoh: butuh 0.8 gram gas per detik
    "Sotong": 1.2        // Contoh: butuh 1.2 gram gas per detik
};

function manageTimer() {
    clearInterval(timerInterval);
    
    if (systemStatus === "ON" && startTime > 0) {
        timerInterval = setInterval(() => {
            let now = Date.now();
            let diff = now - startTime; // Selisih dalam milidetik

            // --- BAGIAN MENGHITUNG WAKTU ---
            let hours = Math.floor(diff / (1000 * 60 * 60));
            let minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            let seconds = Math.floor((diff % (1000 * 60)) / 1000);

            // Format string dengan angka nol di depan
            let formattedTime = 
                String(hours).padStart(2, '0') + ":" + 
                String(minutes).padStart(2, '0') + ":" + 
                String(seconds).padStart(2, '0');

            document.getElementById("valTimer").innerText = formattedTime;

            // --- BAGIAN MENGHITUNG GAS ---
            let totalDetik = Math.floor(diff / 1000); // Total waktu berjalan dalam detik
            let modeAktif = document.getElementById("pilihIkan").value; // Cek mode yang sedang dipilih
            let rateGas = konsumsiGasPerDetik[modeAktif] || 0; // Ambil nilai sesuai jenis ikan
            
            let gasTerpakai = totalDetik * rateGas; // Rumus: Detik x Konsumsi gas per detik

            // Menampilkan data Gas (Jika lebih dari 1000 gram, ubah jadi Kg)
            if(gasTerpakai >= 1000) {
                document.getElementById("valGas").innerText = (gasTerpakai / 1000).toFixed(2) + " Kg";
            } else {
                document.getElementById("valGas").innerText = gasTerpakai.toFixed(1) + " Gram";
            }

        }, 1000); // Update tampilan setiap 1 detik
    } else {
        // Reset tampilan saat sistem dimatikan (OFF)
        document.getElementById("valTimer").innerText = "00:00:00";
        document.getElementById("valGas").innerText = "0 Gram";
    }
}

// ================= FUNGSI JAM REAL-TIME =================
function jalankanJam() {
    const waktuSekarang = new Date(); // Ambil waktu dari komputer/HP pengguna
    
    // Ambil Jam, Menit, Detik dan pastikan formatnya 2 digit (contoh: 09 bukan 9)
    const jam = waktuSekarang.getHours().toString().padStart(2, '0');
    const menit = waktuSekarang.getMinutes().toString().padStart(2, '0');
    const detik = waktuSekarang.getSeconds().toString().padStart(2, '0');

    // Gabungkan menjadi format HH:MM:SS
    const formatJam = `${jam}:${menit}:${detik} WIB`;

    // Cari elemen HTML dengan ID 'jam-realtime' dan ubah teksnya
    const elemenJam = document.getElementById('jam-realtime');
    if (elemenJam) {
        elemenJam.innerText = formatJam;
    }
}
// ================= FUNGSI MENAMPILKAN TABEL RIWAYAT =================
const dbRiwayat = firebase.database().ref('history');

dbRiwayat.on('value', (snapshot) => {
    const tabelBody = document.getElementById('tabelRiwayat');
    tabelBody.innerHTML = ''; // Kosongkan tabel sebelum diisi ulang agar tidak ganda

    // Jika data riwayat kosong
    if (!snapshot.exists()) {
        tabelBody.innerHTML = '<tr><td colspan="5" style="padding: 15px; color: #777;">Belum ada data riwayat. Silakan nyalakan sistem.</td></tr>';
        return;
    }
    snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();
        
        // Buat satu baris tabel baru (Tr)
        const barisBaru = `
            <tr style="border-bottom: 1px solid #eee; transition: background 0.3s;">
                <td style="padding: 10px;">${data.waktu || '-'}</td>
                <td style="padding: 10px;">${data.timer || '-'}</td>
                <td style="padding: 10px; font-weight: bold; color: #e67e22;">${data.suhu || 0} °C</td>
                <td style="padding: 10px; color: #2980b9;">${data.kelembaban || 0} %</td>
                <td style="padding: 10px;">${data.servo || 0}°</td>
            </tr>
        `;
        // Tambahkan baris tersebut dari URUTAN PALING ATAS (Data terbaru di atas)
        tabelBody.insertAdjacentHTML('afterbegin', barisBaru);
    });
});

// ================= FUNGSI HAPUS RIWAYAT (TOMBOL MERAH) =================
function hapusRiwayat() {
    // Tampilkan pesan konfirmasi (Mencegah terhapus tidak sengaja)
    const konfirmasi = confirm("Apakah Anda yakin ingin menghapus SELURUH data riwayat? Data yang dihapus tidak dapat dikembalikan.");
    
    if (konfirmasi) {
        // Hapus folder 'history' dari Firebase
        firebase.database().ref('history').remove()
            .then(() => {
                alert("Data riwayat berhasil dihapus!");
            })
            .catch((error) => {
                alert("Gagal menghapus data: " + error.message);
            });
    }
}

// Jalankan fungsi satu kali langsung saat web dibuka
jalankanJam();

// Perintahkan web untuk memperbarui jam setiap 1000 milidetik (1 detik)
setInterval(jalankanJam, 1000);

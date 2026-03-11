// 1. KONFIGURASI FIREBASE (GANTI DENGAN MILIK ANDA)
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

// 4. MEMBACA DATA DARI FIREBASE SECARA REALTIME
refSuhu.on('value', (snapshot) => {
    document.getElementById("valSuhu").innerHTML = (snapshot.val() || 0) + " &deg;C";
});

refKelembaban.on('value', (snapshot) => {
    document.getElementById("valKelembaban").innerText = (snapshot.val() || 0) + " %";
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
            startTime: Date.now() // Catat waktu mulai dalam ms
        });
    } else {
        // Mematikan Sistem
        db.ref('kontrol').update({
            status: "OFF",
            startTime: 0
        });
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

// 6. LOGIKA TIMER (WAKTU LAMANYA OVEN BERJALAN)
function manageTimer() {
    clearInterval(timerInterval);
    
    if (systemStatus === "ON" && startTime > 0) {
        timerInterval = setInterval(() => {
            let now = Date.now();
            let diff = now - startTime; // Selisih dalam milidetik

            // Konversi ke Jam, Menit, Detik
            let hours = Math.floor(diff / (1000 * 60 * 60));
            let minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            let seconds = Math.floor((diff % (1000 * 60)) / 1000);

            // Format string dengan leading zero
            let formattedTime = 
                String(hours).padStart(2, '0') + ":" + 
                String(minutes).padStart(2, '0') + ":" + 
                String(seconds).padStart(2, '0');

            document.getElementById("valTimer").innerText = formattedTime;
        }, 1000); // Update setiap 1 detik
    } else {
        document.getElementById("valTimer").innerText = "00:00:00";
    }

}


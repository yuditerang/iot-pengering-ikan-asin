// 1. KONFIGURASI FIREBASE
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

function fmtDesimal(nilai, digit = 2) {
    let n = Number(nilai);
    return isNaN(n) ? (0).toFixed(digit) : n.toFixed(digit);
}

// Format angka gas jadi teks (dipakai di 2 tempat, disatukan biar konsisten)
function fmtGas(gram) {
    let g = Number(gram) || 0;
    if (g >= 1000) {
        return (g / 1000).toFixed(2) + " Kg";
    }
    return g.toFixed(1) + " Gram";
}

// 2. TAMPILAN HARI, TANGGAL, TAHUN
function updateDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    document.getElementById("dateDisplay").innerText = today.toLocaleDateString('id-ID', options);
}
updateDate();

// 3. VARIABEL GLOBAL UNTUK SISTEM
let systemStatus = "OFF";

// Referensi Database
const refSuhu      = db.ref('sensor/suhu');
const refKelembaban= db.ref('sensor/kelembaban');
const refServo     = db.ref('sensor/servo');
const refTimerOven = db.ref('sensor/timerOven'); // <-- Sumber timer dari Arduino
const refGas       = db.ref('sensor/gas');       // <-- [BARU] Sumber gas dari Arduino
const refStatus    = db.ref('kontrol/status');
const refMode      = db.ref('kontrol/mode');

// 4. MEMBACA DATA SENSOR DARI FIREBASE SECARA REALTIME

refSuhu.on('value', (snapshot) => {
    document.getElementById("valSuhu").innerHTML = fmtDesimal(snapshot.val()) + " &deg;C";
});

refKelembaban.on('value', (snapshot) => {
    document.getElementById("valKelembaban").innerText = (snapshot.val() || 0) + " %";
});

// Membaca Sudut Servo — disesuaikan dengan konstanta Sugeno Arduino
refServo.on('value', (snapshot) => {
    let sudut = snapshot.val() || 0;
    document.getElementById("valServo").innerHTML = sudut + " &deg;";

    let status, warna;

    if (sudut <= 7) {
        // C_NS — suhu sudah melebihi setpoint, api dikecilkan ke minimum
        status = "Api Minimum (Suhu Melewati Target)";
        warna  = "#666";
    } else if (sudut <= 17) {
        // Antara C_NS dan C_Z — suhu mendekati setpoint
        status = "Api Kecil (Suhu Mendekati Target)";
        warna  = "#ffc107";
    } else if (sudut <= 30) {
        // Sekitar C_Z hingga C_PS — suhu masih di bawah target
        status = "Api Sedang (Suhu Di Bawah Target)";
        warna  = "#fd7e14";
    } else if (sudut <= 45) {
        // Mendekati C_PB — suhu jauh di bawah target, api penuh
        status = "Api Besar (Suhu Jauh Di Bawah Target)";
        warna  = "#dc3545";
    } else {
        status = "Tertutup";
        warna  = "#666";
    }

    let elStatus = document.getElementById("statusPanas");
    elStatus.innerText = status;
    elStatus.style.color = warna;
});

// ===============================================================
// 5. TIMER — SUMBER DATA DARI ARDUINO (timerOven)
//    Tidak lagi menggunakan Date.now() browser agar sinkron dengan LCD
// ===============================================================
refTimerOven.on('value', (snapshot) => {
    let totalDetik = snapshot.val() || 0;

    if (systemStatus !== "ON" || totalDetik <= 0) return;

    // Hitung tampilan waktu dari detik Arduino
    let hours   = Math.floor(totalDetik / 3600);
    let minutes = Math.floor((totalDetik % 3600) / 60);
    let seconds = totalDetik % 60;

    document.getElementById("valTimer").innerText =
        String(hours).padStart(2, '0')   + ":" +
        String(minutes).padStart(2, '0') + ":" +
        String(seconds).padStart(2, '0');
});

// ===============================================================
// [BARU] GAS — dibaca langsung dari 'sensor/gas', dihitung oleh ESP32.
// Tidak ada rumus di sini lagi -> pasti identik dengan LCD alat.
// ===============================================================
refGas.on('value', (snapshot) => {
    if (systemStatus !== "ON") return; // saat OFF, biarkan tampilan direset oleh refStatus
    let gasTerpakai = snapshot.val() || 0;
    document.getElementById("valGas").innerText = fmtGas(gasTerpakai);
});

// Membaca Status ON/OFF dari Firebase
refStatus.on('value', (snapshot) => {
    systemStatus = snapshot.val() || "OFF";
    updateButtonUI();

    // Reset tampilan timer dan gas saat sistem OFF
    if (systemStatus === "OFF") {
        document.getElementById("valTimer").innerText = "00:00:00";
        document.getElementById("valGas").innerText   = "0 Gram";
    }
});

// Membaca Mode Ikan dari Firebase
refMode.on('value', (snapshot) => {
    const mode = snapshot.val();
    if (mode) {
        document.getElementById("pilihIkan").value = mode;
    }
});

// 6. FUNGSI MENGENDALIKAN SISTEM (TOMBOL ON/OFF)
window.toggleSystem = function() {
    const selectedMode = document.getElementById("pilihIkan").value;

    if (systemStatus === "OFF") {
        db.ref('kontrol').update({
            status:    "ON",
            mode:      selectedMode,
            startTime: Date.now()
        });
    } else {
        db.ref('kontrol').update({
            status:    "OFF",
            startTime: 0
        });
    }
};

// Update tampilan tombol menyesuaikan status
function updateButtonUI() {
    const btn    = document.getElementById("btnPower");
    const select = document.getElementById("pilihIkan");

    if (systemStatus === "ON") {
        btn.innerText = "Hentikan Proses (OFF)";
        btn.classList.add("off");
        select.disabled = true;
    } else {
        btn.innerText = "Mulai Proses (ON)";
        btn.classList.remove("off");
        select.disabled = false;
    }
}

// ================= FUNGSI JAM REAL-TIME =================
function jalankanJam() {
    const waktuSekarang = new Date();
    const jam    = waktuSekarang.getHours().toString().padStart(2, '0');
    const menit  = waktuSekarang.getMinutes().toString().padStart(2, '0');
    const detik  = waktuSekarang.getSeconds().toString().padStart(2, '0');
    const formatJam = `${jam}:${menit}:${detik} WIB`;
    const elemenJam = document.getElementById('jam-realtime');
    if (elemenJam) elemenJam.innerText = formatJam;
}

// ================= FUNGSI MENAMPILKAN TABEL RIWAYAT =================
const dbRiwayat = firebase.database().ref('history');

dbRiwayat.on('value', (snapshot) => {
    const tabelBody = document.getElementById('tabelRiwayat');
    tabelBody.innerHTML = '';

    if (!snapshot.exists()) {
        tabelBody.innerHTML = '<tr><td colspan="5" style="padding: 15px; color: #777;">Belum ada data riwayat. Silakan nyalakan sistem.</td></tr>';
        return;
    }

    snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();
        const barisBaru = `
            <tr style="border-bottom: 1px solid #eee; transition: background 0.3s;">
                <td style="padding: 10px;">${data.waktu || '-'}</td>
                <td style="padding: 10px;">${data.timer || '-'}</td>
                <td style="padding: 10px; font-weight: bold; color: #e67e22;">${data.suhu || 0} °C</td>
                <td style="padding: 10px; color: #2980b9;">${data.kelembaban || 0} %</td>
                <td style="padding: 10px;">${data.servo || 0}°</td>
            </tr>
        `;
        tabelBody.insertAdjacentHTML('afterbegin', barisBaru);
    });
});

// ================= FUNGSI HAPUS RIWAYAT =================
function hapusRiwayat() {
    const konfirmasi = confirm("Apakah Anda yakin ingin menghapus SELURUH data riwayat? Data yang dihapus tidak dapat dikembalikan.");
    if (konfirmasi) {
        firebase.database().ref('history').remove()
            .then(() => alert("Data riwayat berhasil dihapus!"))
            .catch((error) => alert("Gagal menghapus data: " + error.message));
    }
}

jalankanJam();
setInterval(jalankanJam, 1000);

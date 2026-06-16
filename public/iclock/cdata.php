<?php
/**
 * PENTING: File ini adalah Jembatan (Bridge) untuk Mesin Absensi ADMS.
 * File ini TIDAK merubah program atau tampilan website Anda sama sekali.
 * 
 * CARA PENGGUNAAN:
 * Setelah Anda build dan upload ke cPanel, pastikan file ini berada di:
 * public_html/iclock/cdata.php (atau sesuai root folder domain absensikita.id Anda)
 */

// Set Timezone ke Indonesia (WIB)
date_default_timezone_set('Asia/Jakarta');

// Ganti URL dan KEY di bawah ini dengan Supabase URL & Key proyek Anda
// Ini penting agar Mesin bisa mengirim data langsung ke Database Supabase Anda.
$SUPABASE_URL = "https://api.absensikita.id"; 
$SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1cGFiYXNlLWRlbW8iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTU2MTk3MTAwMCwiZXhwIjoyODc3NzMxMDAwfQ.6u7m6FvKexZ8p0O8yZc3p7Bq3v8m_U3P2fW_5Yg1Y6c";

function getClientIP() {
    $ip = isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? $_SERVER['HTTP_X_FORWARDED_FOR'] : (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '');
    if (strpos($ip, ',') !== false) {
        $ips = explode(',', $ip);
        $ip = trim($ips[0]);
    }
    return $ip;
}

function sendToSupabase($table, $data, $method = 'POST', $query = '') {
    global $SUPABASE_URL, $SUPABASE_ANON_KEY;
    $url = $SUPABASE_URL . "/rest/v1/" . $table . ($query ? "?" . $query : "");
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    if ($method === 'PATCH') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
    } else {
        curl_setopt($ch, CURLOPT_POST, 1);
    }
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        "apikey: " . $SUPABASE_ANON_KEY,
        "Authorization: Bearer " . $SUPABASE_ANON_KEY,
        "Content-Type: application/json",
        "Prefer: return=minimal"
    ));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $result = curl_exec($ch);
    curl_close($ch);
    return $result;
}

function fetchFromSupabase($table, $query) {
    global $SUPABASE_URL, $SUPABASE_ANON_KEY;
    $url = $SUPABASE_URL . "/rest/v1/" . $table . "?" . $query;
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        "apikey: " . $SUPABASE_ANON_KEY,
        "Authorization: Bearer " . $SUPABASE_ANON_KEY,
        "Content-Type: application/json"
    ));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $result = curl_exec($ch);
    curl_close($ch);
    return json_decode($result, true);
}

// 1. Terima Request GET dari Mesin saat inisialisasi / handshake
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $sn = isset($_GET['SN']) ? $_GET['SN'] : '';
    
    // Mesin ADMS memerlukan response setting/parameter untuk GET request awal cdata
    if (!empty($sn)) {
        // Catat sebagai terkoneksi ke tabel adms_connections
        $ip = getClientIP();
        
        $connection = fetchFromSupabase("adms_connections", "sn_mesin=eq." . $sn . "&limit=1");
        
        $offset = 420;
        if (!empty($connection) && !empty($connection[0]['timezone'])) {
            $tz = $connection[0]['timezone'];
            if ($tz === 'Asia/Makassar') $offset = 480;
            if ($tz === 'Asia/Jayapura') $offset = 540;
        }

        if (!empty($connection)) {
            $updateData = array(
                "ip_mesin" => $ip,
                "realtime" => gmdate("c")
            );
            sendToSupabase("adms_connections", $updateData, 'PATCH', "sn_mesin=eq." . $sn);
        } else {
            $connData = array(
                "sn_mesin" => $sn,
                "ip_mesin" => $ip,
                "status" => "ONLINE",
                "merk_tipe" => "Mesin Absensi (ADMS)",
                "realtime" => gmdate("c")
            );
            sendToSupabase("adms_connections", $connData);
        }
        
        // Output setting untuk mesin ADMS
        echo "GETOPTION FROM:" . $sn . "\n";
        echo "Stamp=9999\n";
        echo "OpStamp=9999\n";
        echo "ErrorDelay=60\n";
        echo "Delay=10\n";
        echo "TransTimes=00:00;14:00\n";
        echo "TransInterval=1\n";
        echo "TransFlag=1111000000\n";
        echo "TimeZone={$offset}\n";
        echo "Realtime=1\n";
        echo "Encrypt=0\n";
    } else {
        echo "ERROR";
    }
    
    exit;
}

// 2. Terima Request POST Data Absensi atau Operasi Mesin
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $sn = isset($_GET['SN']) ? $_GET['SN'] : '';
    $table = isset($_GET['table']) ? $_GET['table'] : ''; 
    
    // Mesin mengirim data POST dalam bentuk text/plain
    $body = file_get_contents('php://input');
    
    // Update selalu waktu realtime terkoneksi saat ada ping/data
    if (!empty($sn)) {
        $ip = getClientIP();
        
        $connection = fetchFromSupabase("adms_connections", "sn_mesin=eq." . $sn . "&limit=1");
        
        if (!empty($connection)) {
            $updateData = array(
                "ip_mesin" => $ip,
                "realtime" => gmdate("c")
            );
            sendToSupabase("adms_connections", $updateData, 'PATCH', "sn_mesin=eq." . $sn);
        } else {
            $connData = array(
                "sn_mesin" => $sn,
                "ip_mesin" => $ip,
                "status" => "ONLINE",
                "merk_tipe" => "Mesin Absensi (ADMS)",
                "realtime" => gmdate("c")
            );
            sendToSupabase("adms_connections", $connData);
        }
    }

    if (empty($body)) {
        echo "OK";
        exit;
    }
    
    if ($table === 'ATTLOG') {
        // Contoh format baris dari mesin (ATTLOG):
        // PIN  Date Time           Status VerifyType
        // 1    2026-05-08 08:00:00 0      1
        
        $lines = explode("\n", trim($body));
        $records = [];
        
        $company_id = (!empty($connection) && isset($connection[0]['company_id'])) ? $connection[0]['company_id'] : '';
        
        // Caching Data Karyawan
        $userMap = [];
        if (!empty($company_id)) {
            $users = fetchFromSupabase("karyawan", "company_id=eq." . $company_id . "&select=nip,nama");
            if (!empty($users) && is_array($users)) {
                foreach ($users as $u) {
                    $userMap[$u['nip']] = $u['nama'];
                }
            }
        }
        
        foreach ($lines as $line) {
            $cols = preg_split('/\s+/', trim($line)); // Split by spaces/tabs
            if (count($cols) >= 2) {
                $pin = $cols[0];
                $datetime = $cols[1] . " " . (isset($cols[2]) ? $cols[2] : "00:00:00");
                $statusFlag = isset($cols[3]) ? $cols[3] : "0";
                
                // Pastikan hanya sinkronisasi absensi untuk karyawan yg sudah didaftarkan
                if (isset($userMap[$pin])) {
                    $tipe = "MASUK";
                    if ($statusFlag === "1") $tipe = "PULANG";
                    elseif ($statusFlag === "2") $tipe = "KELUAR";
                    elseif ($statusFlag === "3") $tipe = "KEMBALI";
                    elseif ($statusFlag === "4") $tipe = "LEMBUR_MASUK";
                    elseif ($statusFlag === "5") $tipe = "LEMBUR_KELUAR";
                    
                    $records[] = array(
                        "company_id" => $company_id,
                        "nip" => $pin,
                        "nama" => $userMap[$pin],
                        "waktu_masuk" => str_replace(" ", "T", $datetime) . "+07:00",
                        "tipe" => $tipe,
                        "keterangan" => "Log Mesin " . $sn
                    );
                }
            }
        }
        
        // Kirim massal ke Supabase
        if (!empty($records)) {
            sendToSupabase("absensi", $records);
        }
    }
    
    // WAJIB: Mesin ADMS memerlukan respon "OK" saat berhasil kirim log
    echo "OK";
    exit;
}
?>

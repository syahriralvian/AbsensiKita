<?php
// Endpoint ini di-hit (ping) oleh mesin ADMS secara berkala untuk mengecek
// apakah ada command/perintah dari server yang harus dijalankan.
date_default_timezone_set('Asia/Jakarta');

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

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $sn = isset($_GET['SN']) ? $_GET['SN'] : '';
    
    // Update selalu waktu realtime terkoneksi saat ada ping
    if (!empty($sn)) {
        $ip = getClientIP();
        
        // Cek apakah SN sudah ada
        $connection = fetchFromSupabase("adms_connections", "sn_mesin=eq." . $sn . "&limit=1");
        
        if (!empty($connection)) {
            // Jika sudah ada, UPDATE saja (PATCH)
            $updateData = array(
                "ip_mesin" => $ip,
                "realtime" => gmdate("c")
            );
            sendToSupabase("adms_connections", $updateData, 'PATCH', "sn_mesin=eq." . $sn);
        } else {
            // Jika belum ada, INSERT baru (POST)
            $connData = array(
                "sn_mesin" => $sn,
                "ip_mesin" => $ip,
                "status" => "ONLINE",
                "merk_tipe" => "Mesin Absensi (ADMS)",
                "realtime" => gmdate("c")
            );
            sendToSupabase("adms_connections", $connData);
        }

        // CEK APAKAH ADA COMMAND PENDING UNTUK MESIN INI
        $commands = [];
        if (!empty($connection) && !empty($connection[0]['company_id'])) {
            $cid = $connection[0]['company_id'];
            $commands = fetchFromSupabase("machine_commands", "company_id=eq." . $cid . "&status=eq.PENDING&order=id.asc&limit=10");
        }

        if (!empty($commands)) {
            foreach ($commands as $cmd) {
                $cmd_id = $cmd['id'];
                $cmd_str = $cmd['command'];
                
                // Parse format "SN|COMMAND" or just "COMMAND"
                $parts = explode("|", $cmd_str, 2);
                if (count($parts) == 2) {
                    $target_sn = $parts[0];
                    $actual_cmd = $parts[1];
                    
                    if ($target_sn === $sn) {
                        echo "C:" . $cmd_id . ":" . $actual_cmd;
                        exit;
                    }
                } else {
                    // Old format (no SN prefix), we can send to any machine in the company or just this one
                    echo "C:" . $cmd_id . ":" . $cmd_str;
                    exit;
                }
            }
        }
    }
    
    // Mesin membutuhkan respon "OK" agar ia tahu server menyala dan tidak terputus (untuk membuang icon X).
    echo "OK";
}
?>

<?php
date_default_timezone_set('Asia/Jakarta');

$SUPABASE_URL = "https://api.absensikita.id"; 
$SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE";

function updateSupabase($table, $id, $data) {
    global $SUPABASE_URL, $SUPABASE_ANON_KEY;
    $url = $SUPABASE_URL . "/rest/v1/" . $table . "?id=eq." . $id;
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
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

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $sn = isset($_GET['SN']) ? $_GET['SN'] : '';
    $body = file_get_contents('php://input');
    
    // Format body biasanya: ID=123&Return=0
    // Atau multiple lines jika banyak command di-ACK sekaligus
    
    if (!empty($body)) {
        $lines = explode("\n", trim($body));
        foreach ($lines as $line) {
            parse_str(trim($line), $params);
            if (isset($params['ID'])) {
                $cmd_id = $params['ID'];
                $ret = isset($params['Return']) ? $params['Return'] : '-1';
                
                $status = ($ret == '0') ? 'SUCCESS' : 'FAILED';
                
                updateSupabase("machine_commands", $cmd_id, array(
                    "status" => $status,
                    "updated_at" => gmdate("c") // Jika ada kolom updated_at
                ));
            }
        }
    }
    
    echo "OK";
}
?>

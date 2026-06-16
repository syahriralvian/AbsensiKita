<?php
date_default_timezone_set('Asia/Jakarta');

$SUPABASE_URL = "https://api.absensikita.id"; 
$SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1cGFiYXNlLWRlbW8iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTU2MTk3MTAwMCwiZXhwIjoyODc3NzMxMDAwfQ.6u7m6FvKexZ8p0O8yZc3p7Bq3v8m_U3P2fW_5Yg1Y6c";

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

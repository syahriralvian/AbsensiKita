<?php
// cpanel-webhook.php
// Script ini digunakan untuk menerima webhook dan menjalankan perintah update dari github ke cPanel.

// Ganti URL dengan secret key yang Anda inginkan agar tidak sembarangan orang bisa mengakses.
// Contoh cara panggil: https://domain-anda.com/cpanel-webhook.php?secret=SECRET_ANDA_DISINI
$secret_key = 'Hajimekojo12345'; 

if (!isset($_GET['secret']) || $_GET['secret'] !== $secret_key) {
    http_response_code(403);
    die("Forbidden");
}

// Mendapatkan data body (jika webhook mengirim POST request)
$payload = file_get_contents('php://input');

// Perintah shell yang akan dijalankan
// Sesuaikan path dan perintah dengan struktur folder di cPanel Anda.
// Contoh:
// 1. cd ke direktori project Anda (misal: public_html/app)
// 2. git pull asal (jika repository dihubungkan ke git)
// 3. npm install (jika ada update library)
// 4. npm run build (untuk re-build react/vite app)

$command = "export PATH=\$PATH:/usr/local/bin:/usr/bin:/bin && cd /home/tugeowfj/public_html && pwd && git status 2>&1 && git pull origin main 2>&1 && npm install 2>&1 && npm run build 2>&1";

// Cek apakah shell_exec bisa dijalankan
if (!function_exists('shell_exec')) {
    $output = "ERROR: function shell_exec() is disabled in this PHP server.";
} else {
    $output = shell_exec($command);
    if ($output === null) {
        $output = "ERROR: Command failed to execute or returned null. Permssion denied or command not found.";
    }
}

// Menyimpan log
$log = date('Y-m-d H:i:s') . "\n";
$log .= "Payload: " . $payload . "\n";
$log .= "Output: " . $output . "\n";
$log .= "-------------------------\n";

file_put_contents('deploy-log.txt', $log, FILE_APPEND);

echo "Deploy process started. Check deploy-log.txt for result.";
?>

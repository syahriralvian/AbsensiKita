// MASTER SCRIPT GOOGLE SHEETS - ABSENSIKITA
// ------------------------------------------
// Cara Pasang:
// 1. Buka Google Sheets > Ekstensi > Apps Script.
// 2. Hapus semua kode default dan tempel kode ini.
// 3. Klik "Terapkan" (Deploy) > "Deployment Baru".
// 4. Jenis: Aplikasi Web (Web App).
// 5. Eksekusi sebagai: "Saya" (Me).
// 6. Siapa yang memiliki akses: "Siapa saja" (Anyone).
// 7. Salin URL Web App yang Dihasilkan dan paste ke menu Pengaturan > Webhook Kartu Absensi.

function doPost(e) {
  try {
    // 1. Pastikan ada data yang dikirim
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Tidak ada data yang diterima"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. Parse data JSON yang dikirim oleh aplikasi
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || "export"; // Bisa 'export' atau 'realtime'
    var title = payload.title || "Laporan Absensi";
    var csvContent = payload.csvContent || "";
    
    if (!csvContent) {
      return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Isi CSV kosong"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 3. Konversi format CSV menjadi Array 2 Dimensi agar bisa dibaca Sheet
    var csvData = Utilities.parseCsv(csvContent);
    if (csvData.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Data CSV tidak valid / kosong"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 4. Buka Spreadsheet saat ini
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // ==========================================
    // LOGIKA REALTIME / SATUAN (Saat Karyawan Absen)
    // ==========================================
    if (action === "realtime") {
      var sheetName = "Realtime Log";
      var sheet = ss.getSheetByName(sheetName);
      
      // Buat sheet 'Realtime Log' jika belum ada
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        // Tambahkan Header
        sheet.appendRow(["NIP", "Nama", "Tanggal", "Jam", "Status Absen", "Waktu Masuk Sistem"]);
        sheet.getRange("A1:F1").setFontWeight("bold");
      }
      
      // csvData untuk realtime hanya 1 baris
      var rowData = csvData[0];
      // Tambahkan timestamp saat data masuk ke GS
      rowData.push(new Date()); 
      
      sheet.appendRow(rowData);
      
      return ContentService.createTextOutput(JSON.stringify({"status": "success", "message": "Data realtime berhasil disimpan"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ==========================================
    // LOGIKA EXPORT (Bulk Data / Dari Menu Rekap)
    // ==========================================
    if (action === "export") {
      // Membersihkan nama Sheet dari karakter aneh dan membatasi panjangnya
      var exportSheetName = title.substring(0, 100).replace(/[^a-zA-Z0-9 _-]/g, '');
      var exportSheet = ss.getSheetByName(exportSheetName);
      
      // Buat sheet baru jika belum ada, atau bersihkan isinya jika sudah ada
      if (!exportSheet) {
        exportSheet = ss.insertSheet(exportSheetName);
      } else {
        exportSheet.clear();
      }
      
      // Masukkan data ke Sheet
      exportSheet.getRange(1, 1, csvData.length, csvData[0].length).setValues(csvData);
      
      // Rapikan lebar kolom secara otomatis
      for (var i = 1; i <= csvData[0].length; i++) {
        exportSheet.autoResizeColumn(i);
      }
      
      return ContentService.createTextOutput(JSON.stringify({"status": "success", "message": "Data export berhasil disimpan"})).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

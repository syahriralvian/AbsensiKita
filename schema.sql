CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(100) UNIQUE NOT NULL,
  nama_perusahaan VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  api_key VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS departemen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(100) NOT NULL,
  nama_departemen VARCHAR(255) NOT NULL,
  keterangan TEXT,
  calculation_rule INT DEFAULT 1,
  fixed_shift_id INT,
  siklus_id INT,
  auto_shift_ids JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(100) NOT NULL,
  nama_shift VARCHAR(255) NOT NULL,
  jam_masuk VARCHAR(50) NOT NULL,
  jam_pulang VARCHAR(50) NOT NULL,
  late_tolerance INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  isAuto BOOLEAN DEFAULT FALSE,
  hari VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS siklus_shift (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(100) NOT NULL,
  nama_siklus VARCHAR(255) NOT NULL,
  hari_1 INT, hari_2 INT, hari_3 INT, hari_4 INT, hari_5 INT, hari_6 INT, hari_7 INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hari_libur (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(100) NOT NULL,
  tanggal DATE NOT NULL,
  keterangan VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS karyawan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(100) NOT NULL,
  nip VARCHAR(100) NOT NULL,
  nama VARCHAR(255) NOT NULL,
  departemen_id INT,
  no_hp VARCHAR(50),
  role VARCHAR(50) DEFAULT 'USER',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  otp_code VARCHAR(10),
  telegram_link_code VARCHAR(50),
  wajah_template TEXT,
  pin VARCHAR(50),
  foto_wajah TEXT,
  rfid VARCHAR(100),
  last_updated BIGINT
);

CREATE TABLE IF NOT EXISTS absensi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(100) NOT NULL,
  nip VARCHAR(100) NOT NULL,
  nama VARCHAR(255),
  tipe VARCHAR(50) NOT NULL,
  waktu_masuk TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  keterangan VARCHAR(255),
  late_minutes INT DEFAULT 0,
  image LONGTEXT,
  waktu_foto VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS adms_connections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(100),
  sn_mesin VARCHAR(100) NOT NULL UNIQUE,
  ip_mesin VARCHAR(50),
  lokasi VARCHAR(255),
  zona_waktu VARCHAR(50),
  status VARCHAR(50),
  merk_tipe VARCHAR(100),
  realtime VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS machine_commands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(100),
  sn_mesin VARCHAR(100),
  command VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(100),
  nip_executor VARCHAR(100),
  nama_executor VARCHAR(255),
  action_type VARCHAR(100),
  target_table VARCHAR(100),
  target_id VARCHAR(100),
  old_data TEXT,
  new_data TEXT,
  ip_address VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_downloads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version VARCHAR(50),
  url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jam_break (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(100),
  nama_break VARCHAR(100),
  jam_mulai VARCHAR(50),
  jam_selesai VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS overtime_matrix (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(100),
  tipe_hari VARCHAR(50),
  jam_ke INT,
  multiplier DECIMAL(5,2)
);

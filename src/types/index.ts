export interface JamBreak {
  id: number;
  company_id: string;
  kode_break: string;
  nama_break: string;
  jam_keluar: string;
  jam_kembali: string;
  durasi: number;
  is_mengurangi_jam_kerja: boolean;
}

export interface Holiday {
  id: number;
  company_id: string;
  nama_libur: string;
  tanggal: string;
  tipe: 'NASIONAL' | 'PERUSAHAAN' | 'LAINNYA';
  is_potong_cuti: boolean;
}

export type UserRole = 'MASTER_ADMIN' | 'OWNER' | 'SUPER ADMIN' | 'USER';

export interface User {
  nip: string;
  nama: string;
  email?: string;
  role: UserRole;
  company_id: string;
  departemen_id?: number;
  foto_wajah_base64?: string;
  face_embedding?: string | any;
  no_hp_notif?: string;
  nfc_uid?: string;
  is_biometric_enabled?: boolean;
  admin_permissions?: string;
  gaji_pokok?: number;
  uang_makan?: number;
  tunjangan?: number;
  potongan?: number;
  denda_telat?: number;
  bonus_lembur?: number;
  last_seen?: string;
  fcm_token?: string;
  last_updated?: number;
  device_id?: string;
  is_admin_notif?: boolean;
  otp_code?: string;
  otp_expired_at?: string;
  telegram_chat_id?: string;
  telegram_link_code?: string;
}

export interface Company {
  company_id: string;
  nama_perusahaan: string;
  email?: string;
  whatsapp?: string;
  logo_base64?: string;
  trial_end_date: string;
  gsheet_enabled: boolean;
  gsheet_url_kartu?: string;
  gsheet_url_rekap?: string;
  gsheet_url_total?: string;
  office_lat?: number;
  office_lng?: number;
  office_radius?: number;
  location_enabled?: boolean;
  enable_half_day_rule?: boolean;
  whatsapp_enabled?: boolean;
  wa_n8n_webhook_url?: string;
  telegram_bot_token?: string;
  subscription_plan?: 'Standart' | 'Premium';
}

export interface Attendance {
  id: number;
  company_id: string;
  nip: string;
  nama: string;
  tipe: 'MASUK' | 'KELUAR' | 'PULANG' | 'KEMBALI' | 'LEMBUR_MASUK' | 'LEMBUR_KELUAR' | 'IJIN' | 'SAKIT' | 'CUTI' | 'LUPA_ABSEN';
  waktu_masuk: string;
  image?: string;
  late_minutes?: number;
  status_acc?: number;
  keterangan?: string;
  lat?: number;
  lng?: number;
}

export interface Shift {
  id: number;
  company_id: string;
  nama_shift: string;
  jam_masuk: string;
  jam_pulang: string;
  late_tolerance: number;
  awal_masuk: string;
  akhir_masuk: string;
  awal_pulang: string;
  akhir_pulang: string;
  pulang_awal_tolerance: number;
  work_day: number;
  work_time: number;
  is_cross_day: boolean;
  harus_clock_in?: boolean;
  harus_clock_out?: boolean;
  no_clock_in_action?: string;
  no_clock_in_mins?: number;
  no_clock_out_action?: string;
  no_clock_out_mins?: number;
  telat_lebih_action?: string;
  telat_lebih_mins?: number;
  pulang_awal_lebih_action?: string;
  pulang_awal_lebih_mins?: number;
  pulang_larut_lebih_action?: string;
  pulang_larut_lebih_mins?: number;
  round_overtime_mins?: number;
  overtime_status_action?: string;
  jadwal_auto_statistik?: string;
}

export interface Department {
  id: number;
  company_id: string;
  nama_departemen: string;
  calculation_rule: number;
  fixed_shift_id?: number | null;
  siklus_id?: number | null;
  auto_shift_ids?: string | null;
  is_lembur_larut: boolean;
  menit_lembur?: number;
  jam_kerja_wajib?: number;
  is_clock_in_limit: boolean;
  clock_in_limit_time?: string;
  last_updated?: number;
  timezone_id?: string;
  lat?: number;
  lng?: number;
  radius?: number;
}

export interface Cycle {
  id: number;
  company_id: string;
  kode_siklus: string;
  nama_siklus: string;
  tipe_periode?: string;
  periode_angka?: number;
  working_days?: string;
  auto_shift_ids: string;
  last_updated?: number;
}

export interface OvertimeMatrix {
  id: number;
  company_id: string;
  tipe_hari: 'KERJA' | 'LIBUR';
  jam_ke: number;
  pengali: number;
}

export interface AuditLog {
  id: number;
  company_id: string;
  nip_executor: string;
  nama_executor: string;
  action_type: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'SETTING_CHANGE';
  target_table: string;
  target_id: string;
  old_data: any;
  new_data: any;
  ip_address?: string;
  created_at: string;
}

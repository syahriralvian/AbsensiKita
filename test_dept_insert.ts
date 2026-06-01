import { createClient } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://api.absensikita.biz.id";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  const payload = {
    nama_departemen: "TEST_DEPT",
    company_id: "CO-TEST123",
    calculation_rule: 1,
    is_lembur_larut: false,
    menit_lembur: 0,
    jam_kerja_wajib: 8,
    is_clock_in_limit: false,
    clock_in_limit_time: "09:00",
    fixed_shift_id: null,
    siklus_id: null,
    auto_shift_ids: "[]",
    timezone_id: "Asia/Jakarta",
    lat: 10,
    lng: 10,
    radius: 100,
    last_updated: Date.now()
  };
  const { error } = await supabase.from('departemen').insert([payload]);
  console.log("Insert with loc error:", error);

  const payloadNoLoc = {
    nama_departemen: "TEST_DEPT_2",
    company_id: "CO-TEST123",
    calculation_rule: 1,
    is_lembur_larut: false,
    menit_lembur: 0,
    jam_kerja_wajib: 8,
    is_clock_in_limit: false,
    clock_in_limit_time: "09:00",
    fixed_shift_id: null,
    siklus_id: null,
    auto_shift_ids: "[]",
    timezone_id: "Asia/Jakarta",
    last_updated: Date.now()
  };
  const { error: error2 } = await supabase.from('departemen').insert([payloadNoLoc]);
  console.log("Insert without loc error:", error2);
}
testInsert();

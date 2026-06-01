import { useState, useEffect } from "react";
import { Department, Shift, Cycle } from "../../types";
import { supabase } from "../../lib/supabase";
import { safeJsonParse } from "../../lib/utils";
import { Plus, Edit, Trash2, Building2, Loader2, X, Crosshair, Globe } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import MapPicker from "../MapPicker";
import { toast } from "sonner";
import { confirmDialog } from '../../lib/confirmDialog';

interface DepartmentsTabProps {
  companyId: string;
}

export default function DepartmentsTab({ companyId }: DepartmentsTabProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);

  const [formData, setFormData] = useState({
    nama_departemen: "",
    calculation_rule: 1,
    is_lembur_larut: false,
    menit_lembur: 0,
    jam_kerja_wajib: 8,
    is_clock_in_limit: false,
    clock_in_limit_time: "09:00",
    fixed_shift_id: null as number | null,
    siklus_id: null as number | null,
    auto_shift_ids: "[]",
    timezone_id: "Asia/Jakarta",
    lat: null as number | null,
    lng: null as number | null,
    radius: null as number | null
  });

  const loadInitialData = async () => {
    setLoading(true);
    const [deptsRes, shiftsRes, cyclesRes] = await Promise.all([
      supabase.from("departemen").select("*").eq("company_id", companyId).order("nama_departemen", { ascending: true }),
      supabase.from("shifts").select("*").eq("company_id", companyId),
      supabase.from("siklus_shift").select("*").eq("company_id", companyId)
    ]);
    
    if (deptsRes.data) setDepartments(deptsRes.data);
    if (shiftsRes.data) setShifts(shiftsRes.data);
    if (cyclesRes.data) setCycles(cyclesRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadInitialData();
  }, [companyId]);

  const handleOpenModal = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setFormData({
        nama_departemen: dept.nama_departemen,
        calculation_rule: dept.calculation_rule,
        is_lembur_larut: dept.is_lembur_larut,
        menit_lembur: dept.menit_lembur || 0,
        jam_kerja_wajib: dept.jam_kerja_wajib || 8,
        is_clock_in_limit: dept.is_clock_in_limit,
        clock_in_limit_time: dept.clock_in_limit_time || "09:00",
        fixed_shift_id: dept.fixed_shift_id || null,
        siklus_id: dept.siklus_id || null,
        auto_shift_ids: dept.auto_shift_ids || "[]",
        timezone_id: dept.timezone_id || "Asia/Jakarta",
        lat: dept.lat || null,
        lng: dept.lng || null,
        radius: dept.radius || null
      });
    } else {
      setEditingDept(null);
      setFormData({
        nama_departemen: "",
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
        lat: null,
        lng: null,
        radius: null
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {

    setSaving(true);
    try {
      const { lat, lng, radius, ...restFormData } = formData;
      
      // Try with all fields first
      const fullPayload = { 
        ...formData, 
        company_id: companyId,
        last_updated: Date.now()
      };

      // Fallback payload without geofence columns
      const fallbackPayload = {
        ...restFormData,
        company_id: companyId,
        last_updated: Date.now()
      };

      if (editingDept) {
        let { error } = await supabase.from("departemen").update(fullPayload).eq("id", editingDept.id);
        if (error && error.code === 'PGRST204') {
          const fallbackRes = await supabase.from("departemen").update(fallbackPayload).eq("id", editingDept.id);
          error = fallbackRes.error;
        }
        if (error) throw error;
      } else {
        let { error } = await supabase.from("departemen").insert([fullPayload]);
        if (error && error.code === 'PGRST204') {
          const fallbackRes = await supabase.from("departemen").insert([fallbackPayload]);
          error = fallbackRes.error;
        }
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      loadInitialData();
      toast.success(editingDept ? 'Departemen berhasil diupdate' : 'Departemen berhasil ditambahkan');
    } catch (e: any) {
      toast.error('Gagal menyimpan departemen: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleAutoShift = (id: number) => {
    const current = safeJsonParse<number[]>(formData.auto_shift_ids, []);
    const next = current.includes(id) 
      ? current.filter((sid: number) => sid !== id)
      : [...current, id];
    setFormData({...formData, auto_shift_ids: JSON.stringify(next)});
  };

  const handleDelete = async (id: number, name: string) => {
    if ((await confirmDialog(`Hapus departemen ${name}?`))) {
      await supabase.from("departemen").delete().eq("id", id);
      loadInitialData();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Departemen</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Klasifikasikan karyawan berdasarkan divisi dan aturan perhitungan.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
          <Plus className="w-5 h-5" /> Tambah Departemen
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-slate-50 dark:bg-slate-800/30 p-4 sm:p-6 rounded-[2rem] border-2 border-slate-200 dark:border-slate-800 border-dashed shadow-sm group relative overflow-hidden">
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="w-12 h-12 bg-slate-200 text-slate-500 rounded-2xl flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex gap-2 opacity-50">
              <span className="px-3 py-1.5 text-[10px] font-black text-slate-500 bg-slate-200 uppercase rounded-lg">
                DEFAULT SYSTEM
              </span>
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4 relative z-10">General</h3>
          <div className="space-y-2 relative z-10">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
              <span className="text-slate-400">Aturan Kalkulasi</span>
              <span className="text-slate-500">Tanpa Shift & Status</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
              <span className="text-slate-400">Jam Kerja</span>
              <span className="text-slate-500">Normal (Non-Shift)</span>
            </div>
          </div>
        </div>

        {departments
          .filter(dept => dept.nama_departemen.toLowerCase() !== "management")
          .map(dept => (
          <div key={dept.id} className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800/60 shadow-sm hover:shadow-xl transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(dept)}
                  title="Edit"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200 hover:bg-blue-200 rounded-lg transition-all"
                >
                  <Edit className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(dept.id, dept.nama_departemen)}
                  title="Hapus"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 hover:bg-rose-200 rounded-lg transition-all"
                >
                  <Trash2 className="w-3 h-3" /> Hapus
                </button>
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">{dept.nama_departemen}</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className="text-slate-500 dark:text-slate-400">Aturan Kalkulasi</span>
                <span className="text-blue-600">
                  {dept.calculation_rule === 1 && `Siklus: ${cycles.find(c => c.id === dept.siklus_id)?.nama_siklus || 'Siklus Shift'}`}
                  {dept.calculation_rule === 2 && `Shift: ${shifts.find(s => s.id === dept.fixed_shift_id)?.nama_shift || 'Fix Shift'}`}
                  {dept.calculation_rule === 3 && "FixStatus (Auto Detect)"}
                  {dept.calculation_rule === 4 && "Tanpa Shift & Status"}
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className="text-slate-500 dark:text-slate-400">Jam Kerja</span>
                <span className="text-slate-600 dark:text-slate-300">{dept.jam_kerja_wajib} Jam/Hari</span>
              </div>
            </div>
          </div>
        ))}
        {loading && <div className="col-span-full py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-slate-500 dark:text-slate-300" /></div>}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg relative z-10 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-5 md:p-8 shrink-0 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{editingDept ? 'Edit Departemen' : 'Tambah Departemen'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-5 md:p-8 overflow-y-auto custom-scrollbar space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nama Departemen</label>
                  <input value={formData.nama_departemen} onChange={e => setFormData({...formData, nama_departemen: e.target.value})} type="text" className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-bold" placeholder="E.g. Engineering" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Pakai Aturan Kalkulasi</label>
                    <div className="flex flex-col gap-3 ml-2">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="radio" name="calc_rule" value={1} checked={formData.calculation_rule === 1} onChange={() => setFormData({...formData, calculation_rule: 1})} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">Pakai Jadwal Siklus Shift</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="radio" name="calc_rule" value={2} checked={formData.calculation_rule === 2} onChange={() => setFormData({...formData, calculation_rule: 2})} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">JamKerja Tanpa Siklus Shift</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="radio" name="calc_rule" value={3} checked={formData.calculation_rule === 3} onChange={() => setFormData({...formData, calculation_rule: 3})} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">Pakai FixStatus Tanpa Shift</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="radio" name="calc_rule" value={4} checked={formData.calculation_rule === 4} onChange={() => setFormData({...formData, calculation_rule: 4})} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">Tanpa Status & Tanpa Shift</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Jam Wajib</label>
                    <input type="number" value={formData.jam_kerja_wajib} onChange={e => setFormData({...formData, jam_kerja_wajib: parseInt(e.target.value)})} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none font-bold text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Menit Lembur</label>
                    <input type="number" value={formData.menit_lembur} onChange={e => setFormData({...formData, menit_lembur: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none font-bold text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Zona Waktu</label>
                    <select value={formData.timezone_id} onChange={e => setFormData({...formData, timezone_id: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none font-bold text-sm">
                      <option value="Asia/Jakarta">WIB (Jakarta)</option>
                      <option value="Asia/Makassar">WITA (Makassar)</option>
                      <option value="Asia/Jayapura">WIT (Jayapura)</option>
                    </select>
                  </div>
                </div>

                {formData.calculation_rule === 1 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3 block">Default Pakai Siklus Shift</label>
                    <select 
                      value={formData.siklus_id || ""} 
                      onChange={e => setFormData({...formData, siklus_id: parseInt(e.target.value) || null})}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none font-bold text-sm mb-4"
                    >
                      <option value="">-- Pilih Siklus --</option>
                      {cycles.map(c => <option key={c.id} value={c.id}>{c.nama_siklus}</option>)}
                    </select>
                    
                    {formData.siklus_id && (
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Preview Siklus Shift</label>
                        {(() => {
                          const cycle = cycles.find(c => c.id === formData.siklus_id);
                          if (!cycle) return null;
                          const parsed = safeJsonParse<any>(cycle.auto_shift_ids, null);
                          const isWeekly = cycle.tipe_periode === "Mingguan" || cycle.tipe_periode === "WEEKLY";
                          
                          if (isWeekly && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                            const days = [{n:1, l:'Senin'}, {n:2, l:'Selasa'}, {n:3, l:'Rabu'}, {n:4, l:'Kamis'}, {n:5, l:'Jumat'}, {n:6, l:'Sabtu'}, {n:0, l:'Minggu'}];
                            return (
                              <div className="space-y-3">
                                {days.map(d => {
                                  const c = parsed[d.n];
                                  const enabled = c && c.enabled && c.shift_id;
                                  const s = enabled ? shifts.find(sh => sh.id == c.shift_id) : null;
                                  return (
                                    <div key={d.n} className="flex items-center gap-4">
                                      <label className="flex items-center gap-3 w-32 opacity-80">
                                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                                          enabled
                                          ? 'bg-blue-600 border-blue-600 text-white' 
                                          : 'bg-white border-slate-300 dark:border-slate-700 dark:bg-slate-800'
                                        }`}>
                                          {enabled && <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                        </div>
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{d.l}</span>
                                      </label>
                                      
                                      <div className={`flex-1 px-4 py-2 rounded-lg text-sm border font-medium ${
                                          enabled
                                          ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                                          : 'border-transparent bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400'
                                        }`}>
                                        {enabled ? (s ? `${s.jam_masuk.slice(0,5)} - ${s.jam_pulang.slice(0,5)} ${s.nama_shift}` : 'Unknown Shift') : '-'}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          } else if (Array.isArray(parsed) && parsed.length > 0) {
                            return (
                              <div className="flex flex-wrap gap-2">
                                {parsed.map((sid: number, idx: number) => {
                                  const s = shifts.find(sh => sh.id == sid);
                                  return (
                                    <div key={idx} className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center gap-2">
                                      <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Hari Ke-{idx + 1}</span>
                                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{s?.nama_shift || 'Shift?'}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                          return <div className="text-sm text-slate-500 dark:text-slate-400">Siklus belum diatur</div>;
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {formData.calculation_rule === 2 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3 block">Default Pakai Jam Kerja</label>
                    <select 
                      value={formData.fixed_shift_id || ""} 
                      onChange={e => setFormData({...formData, fixed_shift_id: parseInt(e.target.value) || null})}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none font-bold text-sm mb-4"
                    >
                      <option value="">-- Pilih Shift --</option>
                      {shifts.map(s => <option key={s.id} value={s.id}>{s.nama_shift} ({s.jam_masuk}-{s.jam_pulang})</option>)}
                    </select>
                  </div>
                )}

                {formData.calculation_rule === 3 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3 block">Pilih Jam Kerja Otomatis</label>
                    <div className="flex flex-col gap-2 ml-2">
                      {shifts.map(s => (
                        <label key={s.id} className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="checkbox"
                            checked={safeJsonParse<number[]>(formData.auto_shift_ids, []).includes(s.id)}
                            onChange={() => toggleAutoShift(s.id)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">
                            {s.jam_masuk} - {s.jam_pulang} {s.nama_shift}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Lembur Larut Malam</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Bolehkan lembur melewati jam 12 malam</p>
                    </div>
                    <input type="checkbox" checked={formData.is_lembur_larut} onChange={e => setFormData({...formData, is_lembur_larut: e.target.checked})} className="w-5 h-5 text-blue-600 rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Batasi Jam Masuk</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Karyawan tidak bisa absen jika lewat dari jam tertentu</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {formData.is_clock_in_limit && (
                        <input 
                          type="time" 
                          value={formData.clock_in_limit_time} 
                          onChange={e => setFormData({...formData, clock_in_limit_time: e.target.value})}
                          className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold"
                        />
                      )}
                      <input type="checkbox" checked={formData.is_clock_in_limit} onChange={e => setFormData({...formData, is_clock_in_limit: e.target.checked})} className="w-5 h-5 text-blue-600 rounded" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Mode Geofencing Departemen</label>
                  <select
                     value={
                       formData.radius === -1 ? "-1" : 
                       (formData.radius === null || formData.radius === undefined ? "null" : "1")
                     }
                     onChange={e => {
                       const val = e.target.value;
                       if (val === "-1") setFormData({...formData, radius: -1, lat: null, lng: null});
                       else if (val === "null") setFormData({...formData, radius: null, lat: null, lng: null});
                       else setFormData({...formData, radius: 100, lat: formData.lat || 0, lng: formData.lng || 0}); 
                     }}
                     className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none font-bold text-sm"
                  >
                     <option value="null">Ikuti Pengaturan LOKASI Perusahaan</option>
                     <option value="1">Aktifkan Konfigurasi KHUSUS Departemen</option>
                     <option value="-1">Nonaktifkan Geofencing (Abaikan Jarak/Lokasi)</option>
                  </select>
                  
                  {formData.radius !== null && formData.radius !== undefined && formData.radius !== -1 && (
                    <>
                      <MapPicker 
                    lat={formData.lat || 0} 
                    lng={formData.lng || 0} 
                    radius={formData.radius || 100}
                    height="200px"
                    onChange={(lat, lng) => setFormData({...formData, lat, lng})}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-2 block text-center">Latitude</label>
                      <input 
                        type="number" 
                        step="any" 
                        value={formData.lat || ""} 
                        onChange={e => setFormData({...formData, lat: parseFloat(e.target.value) || null})}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none font-bold text-xs" 
                        placeholder="-6.123"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-2 block text-center">Longitude</label>
                      <input 
                        type="number" 
                        step="any" 
                        value={formData.lng || ""} 
                        onChange={e => setFormData({...formData, lng: parseFloat(e.target.value) || null})}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none font-bold text-xs" 
                        placeholder="106.123"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Radius Aman (Meter)</label>
                      <input 
                        type="number" 
                        value={formData.radius || ""} 
                        onChange={e => setFormData({...formData, radius: parseInt(e.target.value) || null})} 
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none font-bold text-xs" 
                        placeholder="Default 100m"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => {
                        if (navigator.geolocation) {
                          toast.info("Mencoba mendapatkan lokasi...");
                          const getLoc = (highAcc: boolean) => {
                            navigator.geolocation.getCurrentPosition(
                              (pos) => {
                                setFormData({
                                  ...formData,
                                  lat: pos.coords.latitude,
                                  lng: pos.coords.longitude
                                });
                                toast.success("Lokasi berhasil dideteksi!");
                              },
                              (err) => {
                                if (highAcc) getLoc(false);
                                else toast.error("Gagal mendapatkan lokasi: " + err.message);
                              },
                              { enableHighAccuracy: highAcc, timeout: highAcc ? 8000 : 15000, maximumAge: 0 }
                            );
                          };
                          getLoc(true);
                        } else {
                          toast.error("Browser tidak mendukung GPS");
                        }
                      }}
                      className="text-blue-600 font-bold text-[10px] flex items-center gap-1.5 hover:underline"
                    >
                      <Crosshair className="w-3 h-3" /> Gunakan Lokasi Saya Sekarang
                    </button>

                    {formData.lat && formData.lng && (
                      <button 
                        type="button"
                        onClick={() => {
                          window.open(`https://www.google.com/maps?q=${formData.lat},${formData.lng}`, '_blank');
                        }}
                        className="text-slate-500 font-bold text-[10px] flex items-center gap-1.5 hover:underline"
                      >
                        <Globe className="w-3 h-3" /> Google Maps
                      </button>
                    )}
                  </div>
                  </>
                  )}
                </div>
              </div>

              <div className="p-5 md:p-8 shrink-0 border-t border-slate-100 dark:border-slate-800">
                <button disabled={saving} onClick={handleSave} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Building2 className="w-5 h-5" />}
                  {editingDept ? 'Simpan Perubahan' : 'Buat Departemen'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

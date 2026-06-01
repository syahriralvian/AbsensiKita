import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { safeJsonParse } from "../../lib/utils";
import { Plus, Edit, Trash2, Repeat, Loader2, X, Clock, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Cycle, Shift } from "../../types";
import { confirmDialog } from '../../lib/confirmDialog';

interface CyclesTabProps {
  companyId: string;
  shifts: Shift[];
}

export default function CyclesTab({ companyId, shifts }: CyclesTabProps) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);

  const initWeeklyShifts = () => ({
    1: { enabled: true, shift_id: '' as number | '' },
    2: { enabled: true, shift_id: '' as number | '' },
    3: { enabled: true, shift_id: '' as number | '' },
    4: { enabled: true, shift_id: '' as number | '' },
    5: { enabled: true, shift_id: '' as number | '' },
    6: { enabled: true, shift_id: '' as number | '' },
    0: { enabled: false, shift_id: '' as number | '' }
  });

  const [formData, setFormData] = useState({
    kode_siklus: "",
    nama_siklus: "",
    tipe_periode: "Mingguan",
    periode_angka: 1,
    selectedShifts: [] as number[],
    weekly_shifts: initWeeklyShifts() as Record<number, { enabled: boolean, shift_id: number | '' }>
  });

  const loadCycles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("siklus_shift")
      .select("*")
      .eq("company_id", companyId);
    if (data) setCycles(data);
    if (error) console.error("Error loading cycles:", error);
    setLoading(false);
  };

  useEffect(() => {
    loadCycles();
  }, [companyId]);

  const handleOpenModal = (cycle?: Cycle) => {
    if (cycle) {
      setEditingCycle(cycle);
      const isWeekly = cycle.tipe_periode === "Mingguan" || cycle.tipe_periode === "WEEKLY";
      const parsedData = safeJsonParse<any>(cycle.auto_shift_ids, null);
      
      setFormData({
        kode_siklus: cycle.kode_siklus || "",
        nama_siklus: cycle.nama_siklus,
        tipe_periode: isWeekly ? "Mingguan" : (cycle.tipe_periode || "DAYS"),
        periode_angka: cycle.periode_angka || 1,
        selectedShifts: (!isWeekly && Array.isArray(parsedData)) ? parsedData : [],
        weekly_shifts: isWeekly && typeof parsedData === 'object' && !Array.isArray(parsedData) 
                       ? { ...initWeeklyShifts(), ...parsedData } 
                       : initWeeklyShifts()
      });
    } else {
      setEditingCycle(null);
      setFormData({
        kode_siklus: "",
        nama_siklus: "",
        tipe_periode: "Mingguan",
        periode_angka: 1,
        selectedShifts: [],
        weekly_shifts: initWeeklyShifts()
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nama_siklus) return toast.error("Nama Siklus wajib diisi!");

    setSaving(true);
    try {
      const isWeekly = formData.tipe_periode === "Mingguan" || formData.tipe_periode === "WEEKLY";
      const payload = {
        company_id: companyId,
        kode_siklus: formData.kode_siklus,
        nama_siklus: formData.nama_siklus,
        tipe_periode: formData.tipe_periode,
        periode_angka: formData.periode_angka,
        auto_shift_ids: isWeekly 
            ? JSON.stringify(formData.weekly_shifts) 
            : JSON.stringify(formData.selectedShifts),
        last_updated: Date.now()
      };

      if (editingCycle) {
        await supabase.from("siklus_shift").update(payload).eq("id", editingCycle.id);
      } else {
        await supabase.from("siklus_shift").insert([payload]);
      }
      setIsModalOpen(false);
      loadCycles();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if ((await confirmDialog(`Hapus siklus "${name}"?`))) {
      await supabase.from("siklus_shift").delete().eq("id", id);
      loadCycles();
    }
  };

  const toggleShift = (id: number) => {
    setFormData(prev => ({
      ...prev,
      selectedShifts: prev.selectedShifts.includes(id) 
        ? prev.selectedShifts.filter(sid => sid !== id)
        : [...prev.selectedShifts, id]
    }));
  };

  const handleWeeklyToggle = (day: number) => {
    setFormData(prev => ({
      ...prev,
      weekly_shifts: {
        ...prev.weekly_shifts,
        [day]: { 
          ...prev.weekly_shifts[day], 
          enabled: !prev.weekly_shifts[day].enabled 
        }
      }
    }));
  };

  const handleWeeklyShiftSelect = (day: number, shiftId: string) => {
    setFormData(prev => ({
      ...prev,
      weekly_shifts: {
        ...prev.weekly_shifts,
        [day]: { 
          ...prev.weekly_shifts[day], 
          shift_id: shiftId ? parseInt(shiftId) : '' 
        }
      }
    }));
  };

  const daysOfWeek = [
    { num: 1, name: 'Senin' },
    { num: 2, name: 'Selasa' },
    { num: 3, name: 'Rabu' },
    { num: 4, name: 'Kamis' },
    { num: 5, name: 'Jumat' },
    { num: 6, name: 'Sabtu' },
    { num: 0, name: 'Minggu' },
  ];

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1e293b] tracking-tight">Siklus Shift</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Buat rangkaian shift mingguan atau bulanan.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-6 py-3 bg-[#2563eb] text-white rounded-2xl font-bold text-sm hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all border border-blue-500/50">
          <Plus className="w-4 h-4" /> Tambah Siklus
        </button>
      </div>

      <div className="grid md:grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {cycles.map(cycle => (
          <div key={cycle.id} className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800/60 shadow-sm hover:shadow-xl transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                  <Repeat className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest leading-none block mb-1">
                    {cycle.kode_siklus || 'NO CODE'}
                  </span>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">{cycle.nama_siklus}</h3>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(cycle)}
                  title="Edit"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200 hover:bg-blue-200 rounded-lg transition-all"
                >
                  <Edit className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(cycle.id, cycle.nama_siklus)}
                  title="Hapus"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 hover:bg-rose-200 rounded-lg transition-all"
                >
                  <Trash2 className="w-3 h-3" /> Hapus
                </button>
              </div>
            </div>
            
            <div className="mb-4 flex items-center gap-4">
              <div className="px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-[10px] font-black text-blue-600 uppercase">
                {cycle.tipe_periode}: {cycle.periode_angka} HARI
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 sm:gap-3">
              {(() => {
                const parsed = safeJsonParse<any>(cycle.auto_shift_ids, null);
                const isWeekly = cycle.tipe_periode === "Mingguan" || cycle.tipe_periode === "WEEKLY";
                
                if (isWeekly && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  const days = [{n:1, l:'Senin'}, {n:2, l:'Selasa'}, {n:3, l:'Rabu'}, {n:4, l:'Kamis'}, {n:5, l:'Jumat'}, {n:6, l:'Sabtu'}, {n:0, l:'Minggu'}];
                  return days.map(d => {
                    const c = parsed[d.n];
                    if (!c || !c.enabled || !c.shift_id) return null;
                    const s = shifts.find(sh => sh.id == c.shift_id);
                    return (
                      <div key={d.n} className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-xl flex flex-col justify-center items-center text-center gap-1 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{d.l}</span>
                        <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 truncate w-full px-1">{s?.nama_shift || 'Shift?'}</span>
                      </div>
                    );
                  });
                } else if (Array.isArray(parsed)) {
                  return parsed.map((sid: number, idx: number) => {
                    const s = shifts.find(sh => sh.id == sid);
                    return (
                      <div key={idx} className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-xl flex flex-col justify-center items-center text-center gap-1 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">HARI {idx + 1}</span>
                        <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 truncate w-full px-1">{s?.nama_shift || 'Shift?'}</span>
                      </div>
                    );
                  });
                }
                return null;
              })()}
            </div>
          </div>
        ))}
        {loading && <div className="col-span-full py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-slate-500 dark:text-slate-300" /></div>}
        {!loading && cycles.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
            Belum ada siklus shift yang dibuat.
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-3xl relative z-10 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-5 md:p-8 shrink-0 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{editingCycle ? 'Edit Siklus' : 'Tambah Siklus'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-5 md:p-8 overflow-y-auto custom-scrollbar space-y-6">
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <label className="md:w-1/3 text-sm font-bold text-slate-500">Kode Siklus Shift</label>
                  <div className="md:w-2/3">
                    <input value={formData.kode_siklus} onChange={e => setFormData({...formData, kode_siklus: e.target.value})} type="text" className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold" />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <label className="md:w-1/3 text-sm font-bold text-slate-500">Nama Siklus Shift</label>
                  <div className="md:w-2/3">
                    <input value={formData.nama_siklus} onChange={e => setFormData({...formData, nama_siklus: e.target.value})} type="text" className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold" />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                  <label className="md:w-1/3 text-sm font-bold text-slate-500">Periode Siklus</label>
                  <div className="md:w-2/3 flex items-center gap-4">
                    <input value={formData.periode_angka} onChange={e => setFormData({...formData, periode_angka: parseInt(e.target.value) || 1})} type="number" className="w-24 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold" />
                    <select value={formData.tipe_periode} onChange={e => setFormData({...formData, tipe_periode: e.target.value})} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold">
                      <option value="Mingguan">Mingguan</option>
                      <option value="DAYS">Harian (Sequensial)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-2 md:gap-4">
                  <label className="md:w-1/3 text-sm font-bold text-slate-500 md:pt-2">
                    {formData.tipe_periode === "Mingguan" || formData.tipe_periode === "WEEKLY" ? "Default Hari Kerja" : "Pilih Shift Berurutan"}
                  </label>
                  <div className="md:w-2/3">
                    {(formData.tipe_periode === "Mingguan" || formData.tipe_periode === "WEEKLY") ? (
                      <div className="space-y-3">
                        {daysOfWeek.map(day => (
                          <div key={day.num} className="flex items-center gap-4">
                            <label className="flex items-center gap-3 w-32 cursor-pointer">
                              <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                                formData.weekly_shifts[day.num]?.enabled 
                                ? 'bg-blue-600 border-blue-600 text-white' 
                                : 'bg-white border-slate-300 dark:border-slate-700 dark:bg-slate-800'
                              }`}>
                                {formData.weekly_shifts[day.num]?.enabled && <Check className="w-3.5 h-3.5" />}
                              </div>
                              <input 
                                type="checkbox" 
                                className="hidden"
                                checked={formData.weekly_shifts[day.num]?.enabled}
                                onChange={() => handleWeeklyToggle(day.num)}
                              />
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{day.name}</span>
                            </label>
                            
                            <select 
                              className={`flex-1 px-4 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium ${
                                formData.weekly_shifts[day.num]?.enabled
                                ? 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                                : 'border border-transparent bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 cursor-not-allowed hidden md:block'
                              }`}
                              value={formData.weekly_shifts[day.num]?.shift_id || ''}
                              onChange={(e) => handleWeeklyShiftSelect(day.num, e.target.value)}
                              disabled={!formData.weekly_shifts[day.num]?.enabled}
                            >
                              <option value="">Pilih Salah Satu...</option>
                              {shifts.map(s => (
                                <option key={s.id} value={s.id}>{s.jam_masuk.slice(0,5)} - {s.jam_pulang.slice(0,5)} {s.nama_shift}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {shifts.map(shift => (
                          <button
                            key={shift.id}
                            onClick={() => toggleShift(shift.id)}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              formData.selectedShifts.includes(shift.id)
                                ? 'bg-blue-50 border-blue-500 shadow-md shadow-blue-500/10'
                                : 'bg-slate-50 dark:bg-slate-950 border-slate-100 hover:border-slate-300 dark:border-slate-800'
                            }`}
                          >
                            <p className={`text-xs font-bold ${formData.selectedShifts.includes(shift.id) ? 'text-blue-700' : 'text-slate-600 dark:text-slate-300'}`}>{shift.nama_shift}</p>
                            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">{shift.jam_masuk} - {shift.jam_pulang}</p>
                            <div className="flex justify-between mt-3">
                              <span className="text-[8px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest">Urutan</span>
                              <span className="text-xs font-black text-blue-600">
                                {formData.selectedShifts.indexOf(shift.id) !== -1 ? `#${formData.selectedShifts.indexOf(shift.id) + 1}` : '-'}
                              </span>
                            </div>
                          </button>
                        ))}
                        <button 
                           onClick={() => setFormData(p => ({...p, selectedShifts: []}))}
                           className="p-4 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700 transition-all text-xs"
                        >
                          Reset Urutan
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-5 md:p-8 shrink-0 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                <button 
                   onClick={() => setFormData(p => ({...p, selectedShifts: []}))}
                   className="px-6 py-4 rounded-2xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-700 transition-all"
                >
                  Reset Urutan
                </button>
                <button disabled={saving} onClick={handleSave} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Repeat className="w-5 h-5" />}
                  {editingCycle ? 'Simpan Perubahan' : 'Buat Siklus'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

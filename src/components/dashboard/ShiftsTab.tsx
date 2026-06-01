import { useState, useEffect } from "react";
import { Shift } from "../../types";
import { supabase } from "../../lib/supabase";
import { Plus, Edit, Trash2, Clock, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { confirmDialog } from '../../lib/confirmDialog';

interface ShiftsTabProps {
  companyId: string;
}

export default function ShiftsTab({ companyId }: ShiftsTabProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'spesifikasi' | 'aturan'>('spesifikasi');
  const [saving, setSaving] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  const [formData, setFormData] = useState({
    nama_shift: "",
    jam_masuk: "08:00",
    jam_pulang: "17:00",
    late_tolerance: 30,
    awal_masuk: "07:00",
    akhir_masuk: "09:00",
    awal_pulang: "15:00",
    akhir_pulang: "18:00",
    pulang_awal_tolerance: 30,
    work_day: 1,
    work_time: 8,
    is_cross_day: false,
    harus_clock_in: true,
    harus_clock_out: true,
    no_clock_in_action: "TELAT_MASUK",
    no_clock_in_mins: 60,
    no_clock_out_action: "PULANG_AWAL",
    no_clock_out_mins: 60,
    telat_lebih_action: "ALPHA",
    telat_lebih_mins: 61,
    pulang_awal_lebih_action: "ALPHA",
    pulang_awal_lebih_mins: 61,
    pulang_larut_lebih_action: "OVERTIME",
    pulang_larut_lebih_mins: 61,
    round_overtime_mins: 30,
    overtime_status_action: "ABAIKAN",
    jadwal_auto_statistik: "12:30:00"
  });

  const loadShifts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .eq("company_id", companyId)
      .order("nama_shift", { ascending: true });
    if (data) setShifts(data);
    if (error) console.error("Error loading shifts:", error);
    setLoading(false);
  };

  useEffect(() => {
    loadShifts();
  }, [companyId]);

  const handleOpenModal = (shift?: Shift) => {
    setActiveTab('spesifikasi');
    if (shift) {
      setEditingShift(shift);
      setFormData({
        nama_shift: shift.nama_shift,
        jam_masuk: shift.jam_masuk?.slice(0, 5) || "08:00",
        jam_pulang: shift.jam_pulang?.slice(0, 5) || "17:00",
        late_tolerance: shift.late_tolerance,
        awal_masuk: shift.awal_masuk?.slice(0, 5) || "07:00",
        akhir_masuk: shift.akhir_masuk?.slice(0, 5) || "10:00",
        awal_pulang: shift.awal_pulang?.slice(0, 5) || "16:00",
        akhir_pulang: shift.akhir_pulang?.slice(0, 5) || "20:00",
        pulang_awal_tolerance: shift.pulang_awal_tolerance || 0,
        work_day: shift.work_day || 1,
        work_time: shift.work_time !== undefined && shift.work_time !== null ? shift.work_time : 8,
        is_cross_day: !!shift.is_cross_day,
        harus_clock_in: shift.harus_clock_in ?? true,
        harus_clock_out: shift.harus_clock_out ?? true,
        no_clock_in_action: shift.no_clock_in_action || "TELAT_MASUK",
        no_clock_in_mins: shift.no_clock_in_mins ?? 60,
        no_clock_out_action: shift.no_clock_out_action || "PULANG_AWAL",
        no_clock_out_mins: shift.no_clock_out_mins ?? 60,
        telat_lebih_action: shift.telat_lebih_action || "ALPHA",
        telat_lebih_mins: shift.telat_lebih_mins ?? 61,
        pulang_awal_lebih_action: shift.pulang_awal_lebih_action || "ALPHA",
        pulang_awal_lebih_mins: shift.pulang_awal_lebih_mins ?? 61,
        pulang_larut_lebih_action: shift.pulang_larut_lebih_action || "OVERTIME",
        pulang_larut_lebih_mins: shift.pulang_larut_lebih_mins ?? 61,
        round_overtime_mins: shift.round_overtime_mins ?? 30,
        overtime_status_action: shift.overtime_status_action || "ABAIKAN",
        jadwal_auto_statistik: shift.jadwal_auto_statistik || "12:30:00"
      });
    } else {
      setEditingShift(null);
      setFormData({
        nama_shift: "",
        jam_masuk: "08:00",
        jam_pulang: "17:00",
        late_tolerance: 30,
        awal_masuk: "07:00",
        akhir_masuk: "09:00",
        awal_pulang: "15:00",
        akhir_pulang: "18:00",
        pulang_awal_tolerance: 30,
        work_day: 1,
        work_time: 8,
        is_cross_day: false,
        harus_clock_in: true,
        harus_clock_out: true,
        no_clock_in_action: "TELAT_MASUK",
        no_clock_in_mins: 60,
        no_clock_out_action: "PULANG_AWAL",
        no_clock_out_mins: 60,
        telat_lebih_action: "ALPHA",
        telat_lebih_mins: 61,
        pulang_awal_lebih_action: "ALPHA",
        pulang_awal_lebih_mins: 61,
        pulang_larut_lebih_action: "OVERTIME",
        pulang_larut_lebih_mins: 61,
        round_overtime_mins: 30,
        overtime_status_action: "ABAIKAN",
        jadwal_auto_statistik: "12:30:00"
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {

    setSaving(true);
    try {
      const payload = { 
        ...formData, 
        company_id: companyId 
      };

      if (editingShift) {
        const { error } = await supabase.from("shifts").update(payload).eq("id", editingShift.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shifts").insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      loadShifts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if ((await confirmDialog(`Hapus jam kerja "${name}"?`))) {
      await supabase.from("shifts").delete().eq("id", id);
      loadShifts();
    }
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1e293b] tracking-tight">Manajemen Jam Kerja</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Atur jadwal shift dan toleransi keterlambatan staff.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-6 py-3 bg-[#2563eb] text-white rounded-2xl font-bold text-sm hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all border border-blue-500/50"
        >
          <Plus className="w-4 h-4" /> Tambah Shift
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap min-w-max">
            <thead>
              <tr className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-50">
                <th className="px-8 py-5">Nama Shift</th>
                <th className="px-8 py-5 text-center">Jam Masuk</th>
                <th className="px-8 py-5 text-center">Jam Pulang</th>
                <th className="px-8 py-5 text-center">Toleransi</th>
                <th className="px-8 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {shifts.map((shift) => (
                <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-950 transition-colors group">
                  <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-200">{shift.nama_shift}</td>
                  <td className="px-8 py-5 text-center font-mono font-bold text-blue-600">{shift.jam_masuk?.slice(0,5)}</td>
                  <td className="px-8 py-5 text-center font-mono font-bold text-amber-600">{shift.jam_pulang?.slice(0,5)}</td>
                  <td className="px-8 py-5 text-center">
                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold">
                      {shift.late_tolerance}m
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(shift)}
                          title="Edit"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200 hover:bg-blue-200 rounded-lg transition-all"
                        >
                          <Edit className="w-3 h-3" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(shift.id, shift.nama_shift)}
                          title="Hapus"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 hover:bg-rose-200 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3 h-3" /> Hapus
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></td></tr>}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
          {shifts.map((shift) => (
            <div key={`mobile-shift-${shift.id}`} className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-extrabold text-slate-800 dark:text-slate-100 text-sm tracking-tight">{shift.nama_shift}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Shift Kerja</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenModal(shift)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200 hover:bg-blue-200 rounded-lg transition-all">
                    <Edit className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => handleDelete(shift.id, shift.nama_shift)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 hover:bg-rose-200 rounded-lg transition-all">
                    <Trash2 className="w-3 h-3" /> Hapus
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                  <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">Masuk</p>
                  <p className="font-mono text-xs font-black text-slate-700 dark:text-slate-200">{shift.jam_masuk?.slice(0,5)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                  <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-1">Pulang</p>
                  <p className="font-mono text-xs font-black text-slate-700 dark:text-slate-200">{shift.jam_pulang?.slice(0,5)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-extrabold text-slate-500">Toleransi Terlambat</span>
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                  {shift.late_tolerance}m
                </span>
              </div>
            </div>
          ))}
          {loading && !shifts.length && (
            <div className="py-20 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600 opacity-20" />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-3xl relative z-10 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-5 md:p-8 shrink-0 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{editingShift ? 'Edit Shift' : 'Tambah Shift'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X className="w-6 h-6" /></button>
              </div>

              <div className="flex border-b border-slate-100 dark:border-slate-800 shrink-0">
                <button 
                  onClick={() => setActiveTab('spesifikasi')} 
                  className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'spesifikasi' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Spesifikasi JamKerja
                </button>
                <button 
                  onClick={() => setActiveTab('aturan')} 
                  className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'aturan' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Aturan Jam Kehadiran
                </button>
              </div>

              <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar">
                {activeTab === 'spesifikasi' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nama Shift</label>
                      <input value={formData.nama_shift} onChange={e => setFormData({...formData, nama_shift: e.target.value})} type="text" className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-bold" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                      <div className="space-y-4">
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest border-l-4 border-blue-600 pl-2">Pengaturan Masuk</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Jam Masuk</label>
                            <p className="text-[9px] text-slate-400 mb-2">Jam resmi dimulainya pekerjaan.</p>
                            <input type="time" value={formData.jam_masuk} onChange={e => setFormData({...formData, jam_masuk: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none font-mono font-bold" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Awal Masuk</label>
                            <p className="text-[9px] text-slate-400 mb-2">Paling awal boleh absen.</p>
                            <input type="time" value={formData.awal_masuk} onChange={e => setFormData({...formData, awal_masuk: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none font-mono" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Akhir Masuk</label>
                            <p className="text-[9px] text-slate-400 mb-2">Batas terakhir absen masuk.</p>
                            <input type="time" value={formData.akhir_masuk} onChange={e => setFormData({...formData, akhir_masuk: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none font-mono" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest border-l-4 border-amber-600 pl-2">Pengaturan Pulang</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Jam Pulang</label>
                            <p className="text-[9px] text-slate-400 mb-2">Jam resmi berakhirnya pekerjaan.</p>
                            <input type="time" value={formData.jam_pulang} onChange={e => setFormData({...formData, jam_pulang: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none font-mono font-bold" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Awal Pulang</label>
                            <p className="text-[9px] text-slate-400 mb-2">Batasi absen pulang terlalu dini.</p>
                            <input type="time" value={formData.awal_pulang} onChange={e => setFormData({...formData, awal_pulang: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none font-mono" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Akhir Pulang</label>
                            <p className="text-[9px] text-slate-400 mb-2">Batas terakhir sistem merekam pulang.</p>
                            <input type="time" value={formData.akhir_pulang} onChange={e => setFormData({...formData, akhir_pulang: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none font-mono" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8 pt-4 border-t border-slate-50 dark:border-slate-800">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Toleransi Telat</span>
                          <div className="flex items-center gap-2">
                            <input type="number" value={formData.late_tolerance} onChange={e => setFormData({...formData, late_tolerance: parseInt(e.target.value)})} className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-950 rounded border dark:border-slate-800 text-center text-xs font-bold" />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Menit</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Pulang Awal</span>
                          <div className="flex items-center gap-2">
                            <input type="number" value={formData.pulang_awal_tolerance} onChange={e => setFormData({...formData, pulang_awal_tolerance: parseInt(e.target.value)})} className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-950 rounded border dark:border-slate-800 text-center text-xs font-bold" />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Menit</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Lembur Lintas Hari</span>
                          <input type="checkbox" checked={formData.is_cross_day} onChange={e => setFormData({...formData, is_cross_day: e.target.checked})} className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Jam Kerja Efektif</span>
                          <div className="flex items-center gap-2">
                            <input type="number" value={formData.work_time} onChange={e => setFormData({...formData, work_time: parseFloat(e.target.value)})} className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-950 rounded border dark:border-slate-800 text-center text-xs font-bold" />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Jam</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {activeTab === 'aturan' && (
                  <div className="space-y-5">
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                       <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                         <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Harus Clock In</span>
                         <select value={formData.harus_clock_in ? 'Yes' : 'No'} onChange={e => setFormData({...formData, harus_clock_in: e.target.value === 'Yes'})} className="px-3 py-1.5 rounded-lg border dark:border-slate-700 text-xs font-bold outline-none bg-white dark:bg-slate-900">
                           <option value="Yes">Yes</option>
                           <option value="No">No</option>
                         </select>
                       </div>
                       <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                         <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Harus Clock Out</span>
                         <select value={formData.harus_clock_out ? 'Yes' : 'No'} onChange={e => setFormData({...formData, harus_clock_out: e.target.value === 'Yes'})} className="px-3 py-1.5 rounded-lg border dark:border-slate-700 text-xs font-bold outline-none bg-white dark:bg-slate-900">
                           <option value="Yes">Yes</option>
                           <option value="No">No</option>
                         </select>
                       </div>
                     </div>

                     <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                       <div className="space-y-2">
                         <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                           <span className="text-xs font-bold text-slate-600 dark:text-slate-400 w-48">Jika Tidak Ada CLOCK IN</span>
                           <div className="flex items-center gap-2 flex-1">
                             <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-500 border border-slate-200 dark:border-slate-700 font-medium">di Anggap</span>
                             <select value={formData.no_clock_in_action} onChange={e => setFormData({...formData, no_clock_in_action: e.target.value})} className="flex-1 px-3 py-1.5 rounded-lg border dark:border-slate-700 text-xs font-bold outline-none bg-white dark:bg-slate-900">
                               <option value="TELAT_MASUK">Telat Masuk</option>
                               <option value="ALPHA">Tidak Hadir (Alpha)</option>
                               <option value="PULANG_AWAL">Pulang Awal</option>
                             </select>
                           </div>
                         </div>
                         <div className="flex flex-col sm:flex-row sm:items-center gap-2 pl-0 sm:pl-50 lg:pl-[12.5rem]">
                           <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-1 w-full sm:w-auto bg-white dark:bg-slate-900">
                             <span className="px-3 text-xs text-slate-500 font-medium">Selama</span>
                             <input type="number" value={formData.no_clock_in_mins} onChange={e => setFormData({...formData, no_clock_in_mins: parseInt(e.target.value)})} className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-950 rounded text-center text-xs font-bold outline-none" />
                             <span className="px-3 text-xs text-slate-500 font-medium border-l border-slate-200 dark:border-slate-700">Menit</span>
                           </div>
                         </div>
                       </div>

                       <div className="space-y-2 pt-2">
                         <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                           <span className="text-xs font-bold text-slate-600 dark:text-slate-400 w-48">Jika Tidak Ada CLOCK OUT</span>
                           <div className="flex items-center gap-2 flex-1">
                             <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-500 border border-slate-200 dark:border-slate-700 font-medium">di Anggap</span>
                             <select value={formData.no_clock_out_action} onChange={e => setFormData({...formData, no_clock_out_action: e.target.value})} className="flex-1 px-3 py-1.5 rounded-lg border dark:border-slate-700 text-xs font-bold outline-none bg-white dark:bg-slate-900">
                               <option value="PULANG_AWAL">Pulang Awal</option>
                               <option value="ALPHA">Tidak Hadir (Alpha)</option>
                               <option value="TELAT_MASUK">Telat Masuk</option>
                             </select>
                           </div>
                         </div>
                         <div className="flex flex-col sm:flex-row sm:items-center gap-2 pl-0 sm:pl-50 lg:pl-[12.5rem]">
                           <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-1 w-full sm:w-auto bg-white dark:bg-slate-900">
                             <span className="px-3 text-xs text-slate-500 font-medium">Selama</span>
                             <input type="number" value={formData.no_clock_out_mins} onChange={e => setFormData({...formData, no_clock_out_mins: parseInt(e.target.value)})} className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-950 rounded text-center text-xs font-bold outline-none" />
                             <span className="px-3 text-xs text-slate-500 font-medium border-l border-slate-200 dark:border-slate-700">Menit</span>
                           </div>
                         </div>
                       </div>
                     </div>

                     <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 w-48">Jika TELAT Masuk Lebih Dari</span>
                            <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-1 flex-1 bg-white dark:bg-slate-900">
                              <input type="number" value={formData.telat_lebih_mins} onChange={e => setFormData({...formData, telat_lebih_mins: parseInt(e.target.value)})} className="w-full px-2 py-1 bg-transparent text-xs font-bold outline-none" />
                              <span className="px-4 py-1.5 text-xs text-slate-500 font-medium border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-r">Menit</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium pl-0 sm:pl-[12.5rem]">di Anggap Tidak Hadir Masuk</p>
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 w-48">Jika Pulang AWAL Lebih Dari</span>
                            <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-1 flex-1 bg-white dark:bg-slate-900">
                              <input type="number" value={formData.pulang_awal_lebih_mins} onChange={e => setFormData({...formData, pulang_awal_lebih_mins: parseInt(e.target.value)})} className="w-full px-2 py-1 bg-transparent text-xs font-bold outline-none" />
                              <span className="px-4 py-1.5 text-xs text-slate-500 font-medium border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-r">Menit</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium pl-0 sm:pl-[12.5rem]">di Anggap Tidak Hadir Masuk</p>
                        </div>

                        <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 w-48">Jika Pulang LARUT Lebih Dari</span>
                            <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-1 flex-1 bg-white dark:bg-slate-900">
                              <input type="number" value={formData.pulang_larut_lebih_mins} onChange={e => setFormData({...formData, pulang_larut_lebih_mins: parseInt(e.target.value)})} className="w-full px-2 py-1 bg-transparent text-xs font-bold outline-none" />
                              <span className="px-4 py-1.5 text-xs text-slate-500 font-medium border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-r">Menit</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium pl-0 sm:pl-[12.5rem]">di Anggap Ada OverTime Pulang LARUT</p>
                        </div>
                     </div>

                     <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 w-48">Round Unit OverTime</span>
                            <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-1 flex-1 bg-white dark:bg-slate-900">
                              <input type="number" value={formData.round_overtime_mins} onChange={e => setFormData({...formData, round_overtime_mins: parseInt(e.target.value)})} className="w-full px-2 py-1 bg-transparent text-xs font-bold outline-none" />
                              <span className="px-4 py-1.5 text-xs text-slate-500 font-medium border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-r">Menit</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium pl-0 sm:pl-[12.5rem]">Pembulatan ke Bawah Lama OverTime</p>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 w-48">Jika Ada Status OverTime</span>
                          <div className="flex items-center gap-2 flex-1">
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-500 border border-slate-200 dark:border-slate-700 font-medium">di Anggap</span>
                            <select value={formData.overtime_status_action} onChange={e => setFormData({...formData, overtime_status_action: e.target.value})} className="flex-1 px-3 py-1.5 rounded-lg border dark:border-slate-700 text-xs font-bold outline-none bg-white dark:bg-slate-900">
                              <option value="ABAIKAN">Abaikan Semua OverTime</option>
                              <option value="HITUNG">Hitung Semua OverTime</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 w-48">Jadwal Auto Statistik</span>
                          <div className="flex items-center gap-2 flex-1">
                            <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-1 w-full bg-white dark:bg-slate-900">
                               <Clock className="w-4 h-4 text-slate-400 ml-2" />
                               <input type="time" step="1" value={formData.jadwal_auto_statistik} onChange={e => setFormData({...formData, jadwal_auto_statistik: e.target.value})} className="w-full px-2 py-1.5 bg-transparent text-xs font-bold outline-none" />
                            </div>
                            <button type="button" className="shrink-0 px-4 py-2 border border-rose-500 text-rose-500 font-bold text-xs rounded-lg hover:bg-rose-50 transition-colors">ReJadwal</button>
                          </div>
                        </div>
                     </div>
                  </div>
                )}
              </div>
              <div className="p-5 md:p-8 shrink-0 border-t border-slate-100 dark:border-slate-800">
                <button disabled={saving} onClick={handleSave} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
                  {editingShift ? 'Simpan Perubahan' : 'Tambah Shift'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

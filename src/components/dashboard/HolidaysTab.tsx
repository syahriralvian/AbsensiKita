import { useState, useEffect } from "react";
import { Holiday } from "../../types";
import { supabase } from "../../lib/supabase";
import { Plus, Edit, Trash2, Calendar, Loader2, X, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { toLocalDateString } from "../../lib/utils";
import { confirmDialog } from '../../lib/confirmDialog';

interface HolidaysTabProps {
  companyId: string;
}

export default function HolidaysTab({ companyId }: HolidaysTabProps) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);

  const [formData, setFormData] = useState({
    nama_libur: "",
    tanggal: toLocalDateString(new Date()),
    tipe: "NASIONAL" as Holiday['tipe'],
    is_potong_cuti: false
  });

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("hari_libur")
        .select("*")
        .eq("company_id", companyId)
        .order("tanggal", { ascending: false });
      if (data) setHolidays(data);
      if (error) console.error("Error loading holidays:", error);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, [companyId]);

  const handleOpenModal = (h?: Holiday) => {
    if (h) {
      setEditingHoliday(h);
      setFormData({
        nama_libur: h.nama_libur,
        tanggal: h.tanggal,
        tipe: h.tipe,
        is_potong_cuti: h.is_potong_cuti
      });
    } else {
      setEditingHoliday(null);
      setFormData({
        nama_libur: "",
        tanggal: toLocalDateString(new Date()),
        tipe: "NASIONAL",
        is_potong_cuti: false
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nama_libur) return toast.error("Nama libur harus diisi");

    
    setSaving(true);
    try {
      const payload = { 
        ...formData, 
        company_id: companyId 
      };

      if (editingHoliday) {
        const { error } = await supabase.from("hari_libur").update(payload).eq("id", editingHoliday.id);
        if (error) throw error;
        toast.success("Hari libur diperbarui");
      } else {
        const { error } = await supabase.from("hari_libur").insert([payload]);
        if (error) throw error;
        toast.success("Hari libur ditambahkan");
      }

      setIsModalOpen(false);
      loadHolidays();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if ((await confirmDialog(`Hapus hari libur "${name}"?`))) {
      await supabase.from("hari_libur").delete().eq("id", id);
      toast.success("Hari libur dihapus");
      loadHolidays();
    }
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1e293b] dark:text-white tracking-tight">Kelola Hari Libur</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Management pengecualian siklus shift untuk hari libur nasional & perusahaan.</p>
        </div>
        <div className="flex w-full md:w-auto">
          <button 
            onClick={() => handleOpenModal()}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-[#334155] dark:bg-slate-700 text-white rounded-2xl font-bold text-sm hover:bg-slate-700 dark:hover:bg-slate-600 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all border border-transparent dark:border-slate-600"
          >
            <Plus className="w-4 h-4 shrink-0" /> Tambah Hari Libur
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white dark:bg-slate-900 md:rounded-[2.5rem] rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden">
          <div className="overflow-hidden md:overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap min-w-max hidden md:table">
              <thead>
                <tr className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-50 dark:border-slate-800/50">
                  <th className="px-8 py-5">Tanggal / Nama Libur</th>
                  <th className="px-8 py-5">Tipe</th>
                  <th className="px-8 py-5 text-center">Status Cuti</th>
                  <th className="px-8 py-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {holidays.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-200">
                      <span className="text-[10px] text-rose-500 dark:text-rose-400 block mb-1 font-mono tracking-widest">
                        {new Date(h.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </span>
                      {h.nama_libur}
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-tight ${
                        h.tipe === 'NASIONAL' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' : 
                        h.tipe === 'PERUSAHAAN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {h.tipe}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      {h.is_potong_cuti ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 text-[9px] font-black rounded border border-amber-100 dark:border-amber-500/20">POTONG CUTI</span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-[10px] font-bold">-</span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenModal(h)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(h.id, h.nama_libur)} className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300 dark:text-slate-600" /></td></tr>}
                {!loading && holidays.length === 0 && <tr><td colSpan={4} className="py-20 text-center text-slate-400 dark:text-slate-500 font-medium">Belum ada hari libur.</td></tr>}
              </tbody>
            </table>

            {/* Mobile View */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading && <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300 dark:text-slate-600" /></div>}
              {!loading && holidays.length === 0 && <div className="py-20 text-center text-slate-400 dark:text-slate-500 font-medium">Belum ada hari libur.</div>}
              {holidays.map((h) => (
                <div key={h.id} className="p-5 flex flex-col gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[10px] text-rose-500 dark:text-rose-400 block mb-1 font-mono tracking-widest">
                        {new Date(h.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </span>
                      <h4 className="font-bold text-slate-700 dark:text-slate-200">{h.nama_libur}</h4>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] whitespace-nowrap font-black tracking-tight ${
                        h.tipe === 'NASIONAL' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' : 
                        h.tipe === 'PERUSAHAAN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {h.tipe}
                      </span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-1">
                    <div>
                      {h.is_potong_cuti ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 text-[9px] font-black rounded border border-amber-100 dark:border-amber-500/20">POTONG CUTI</span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-[10px] font-bold">-</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handleOpenModal(h)} className="px-4 py-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 active:scale-95 transition-all rounded-xl font-bold flex items-center gap-2 text-xs"><Edit className="w-3.5 h-3.5" /> Edit</button>
                        <button onClick={() => handleDelete(h.id, h.nama_libur)} className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-95 transition-all rounded-xl"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="p-8 bg-indigo-50 dark:bg-indigo-500/10 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-500/20">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl w-fit mb-6 shadow-sm"><AlertCircle className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /></div>
              <h4 className="font-bold text-indigo-900 dark:text-indigo-300 mb-2">Informasi Logic</h4>
              <p className="text-sm text-indigo-700 dark:text-indigo-400/80 leading-relaxed">
                Hari libur yang didaftarkan di sini akan menginterupsi siklus shift normal. 
                <br /><br />
                Karyawan tidak akan dianggap "Alpa" pada tanggal ini, dan setiap kehadiran akan dihitung sebagai <b className="dark:text-indigo-300">Lembur Hari Libur</b>.
              </p>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
              onClick={() => setIsModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg relative z-10 overflow-hidden"
            >
               <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Setting Hari Libur</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 uppercase tracking-wider">Exception Management</p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
               </div>
               
               <div className="p-6 md:p-10 space-y-6 md:space-y-8 max-h-[75vh] overflow-y-auto">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nama Hari Libur</label>
                     <input 
                       value={formData.nama_libur} 
                       onChange={e => setFormData({...formData, nama_libur: e.target.value})} 
                       type="text" 
                       className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-indigo-500 outline-none rounded-2xl font-bold transition-all dark:text-white" 
                       placeholder="Contoh: Tahun Baru Hijriah" 
                     />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tanggal</label>
                       <div className="relative">
                          <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="date" 
                            value={formData.tanggal} 
                            onChange={e => setFormData({...formData, tanggal: e.target.value})} 
                            className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all dark:text-white dark:[color-scheme:dark]" 
                          />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tipe Libur</label>
                       <select 
                         value={formData.tipe} 
                         onChange={e => setFormData({...formData, tipe: e.target.value as Holiday['tipe']})} 
                         className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all appearance-none dark:text-white"
                       >
                          <option value="NASIONAL">National Holiday</option>
                          <option value="PERUSAHAAN">Company Holiday</option>
                          <option value="LAINNYA">Others</option>
                       </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-slate-950/50 rounded-3xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-all border-2 border-transparent hover:border-slate-200 dark:hover:border-slate-800">
                     <input 
                       type="checkbox" 
                       checked={formData.is_potong_cuti} 
                       onChange={e => setFormData({...formData, is_potong_cuti: e.target.checked})} 
                       className="w-6 h-6 text-indigo-600 rounded-lg dark:bg-slate-900 dark:border-slate-700" 
                     />
                     <div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 block">Potong Kuota Cuti</span>
                        <span className="text-[10px] text-slate-400 font-medium">Jika dicentang, libur ini akan mengurangi jatah cuti tahunan.</span>
                     </div>
                  </label>

                  <button 
                    disabled={saving}
                    onClick={handleSave}
                    className="w-full py-4 md:py-5 bg-indigo-600 text-white rounded-3xl font-black text-sm md:text-sm uppercase tracking-[0.2em] hover:bg-indigo-700 shadow-xl shadow-indigo-200/50 dark:shadow-none flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                     {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                     Simpan Konfigurasi
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

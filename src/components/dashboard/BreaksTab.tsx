import { useState, useEffect } from "react";
import { JamBreak } from "../../types";
import { supabase } from "../../lib/supabase";
import { Plus, Edit, Trash2, Coffee, Loader2, X, Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { confirmDialog } from '../../lib/confirmDialog';

interface BreaksTabProps {
  companyId: string;
}

export default function BreaksTab({ companyId }: BreaksTabProps) {
  const [breaks, setBreaks] = useState<JamBreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingBreak, setEditingBreak] = useState<JamBreak | null>(null);

  const [formData, setFormData] = useState({
    kode_break: "",
    nama_break: "",
    jam_keluar: "12:00",
    jam_kembali: "13:00",
    durasi: 60,
    is_mengurangi_jam_kerja: true
  });

  const loadBreaks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("jam_break")
        .select("*")
        .eq("company_id", companyId)
        .order("nama_break", { ascending: true });
      if (data) setBreaks(data);
      if (error) console.error("Error loading breaks:", error);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBreaks();
  }, [companyId]);

  const handleOpenModal = (b?: JamBreak) => {
    if (b) {
      setEditingBreak(b);
      setFormData({
        kode_break: b.kode_break,
        nama_break: b.nama_break,
        jam_keluar: b.jam_keluar?.slice(0, 5) || "12:00",
        jam_kembali: b.jam_kembali?.slice(0, 5) || "13:00",
        durasi: b.durasi,
        is_mengurangi_jam_kerja: b.is_mengurangi_jam_kerja
      });
    } else {
      setEditingBreak(null);
      setFormData({
        kode_break: "",
        nama_break: "",
        jam_keluar: "12:00",
        jam_kembali: "13:30",
        durasi: 90,
        is_mengurangi_jam_kerja: true
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

      if (editingBreak) {
        const { error } = await supabase.from("jam_break").update(payload).eq("id", editingBreak.id);
        if (error) throw error;
        toast.success("Jam break berhasil diperbarui");
      } else {
        const { error } = await supabase.from("jam_break").insert([payload]);
        if (error) throw error;
        toast.success("Jam break berhasil ditambahkan");
      }

      setIsModalOpen(false);
      loadBreaks();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if ((await confirmDialog(`Hapus jam break "${name}"?`))) {
      await supabase.from("jam_break").delete().eq("id", id);
      toast.success("Jam break dihapus");
      loadBreaks();
    }
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1e293b] tracking-tight">Spesifikasi JamBreak</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Atur jam istirahat yang akan memotong durasi jam kerja karyawan.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-6 py-3 bg-[#10b981] text-white rounded-2xl font-bold text-sm hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 transition-all border border-emerald-500/50"
        >
          <Plus className="w-4 h-4" /> Tambah JamBreak
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap min-w-max">
            <thead>
              <tr className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-50">
                <th className="px-8 py-5">Kode / Nama Break</th>
                <th className="px-8 py-5 text-center">Jam Keluar</th>
                <th className="px-8 py-5 text-center">Jam Kembali</th>
                <th className="px-8 py-5 text-center">Durasi</th>
                <th className="px-8 py-5 text-center">Potong Jam Kerja</th>
                <th className="px-8 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {breaks.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                  <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-200">
                    <span className="text-[10px] text-emerald-600 block mb-1 uppercase tracking-widest">{b.kode_break}</span>
                    {b.nama_break}
                  </td>
                  <td className="px-8 py-5 text-center font-mono font-bold text-blue-600">{b.jam_keluar?.slice(0,5)}</td>
                  <td className="px-8 py-5 text-center font-mono font-bold text-amber-600">{b.jam_kembali?.slice(0,5)}</td>
                  <td className="px-8 py-5 text-center">
                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold">
                      {b.durasi}m
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    {b.is_mengurangi_jam_kerja ? (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md">AKTIF</span>
                    ) : (
                      <span className="px-2 py-1 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-md">NONAKTIF</span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(b)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(b.id, b.nama_break)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" /></td></tr>}
              {!loading && breaks.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-slate-500 font-medium">Belum ada data break.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
           {breaks.map(b => (
             <div key={b.id} className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                   <div>
                      <p className="text-[10px] text-emerald-600 font-black uppercase mb-1">{b.kode_break}</p>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200">{b.nama_break}</h4>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={() => handleOpenModal(b)} className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(b.id, b.nama_break)} className="p-2 bg-rose-50 text-rose-600 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[8px] font-black text-blue-500 uppercase mb-1">Keluar</p>
                      <p className="font-mono text-sm font-bold">{b.jam_keluar?.slice(0,5)}</p>
                   </div>
                   <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[8px] font-black text-amber-500 uppercase mb-1">Kembali</p>
                      <p className="font-mono text-sm font-bold">{b.jam_kembali?.slice(0,5)}</p>
                   </div>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold">
                   <span className="text-slate-500 uppercase">Durasi: <span className="text-slate-800 dark:text-slate-200 font-black">{b.durasi} Menit</span></span>
                   {b.is_mengurangi_jam_kerja && <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Mengurangi Jam Kerja</span>}
                </div>
             </div>
           ))}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-xl relative z-10 overflow-hidden">
               <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Spesifikasi JamBreak</h3>
                  <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
               </div>
               
               <div className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Kode JamBreak</label>
                        <input value={formData.kode_break} onChange={e => setFormData({...formData, kode_break: e.target.value.toUpperCase()})} type="text" className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 dark:text-white border-2 border-transparent focus:border-emerald-500 outline-none rounded-2xl font-bold uppercase transition-all" placeholder="BREAK" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nama JamBreak</label>
                        <input value={formData.nama_break} onChange={e => setFormData({...formData, nama_break: e.target.value})} type="text" className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 dark:text-white border-2 border-transparent focus:border-emerald-500 outline-none rounded-2xl font-bold transition-all" placeholder="Default Break" />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Jam Keluar</label>
                        <div className="relative">
                           <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                           <input type="time" step="1" value={formData.jam_keluar} onChange={e => setFormData({...formData, jam_keluar: e.target.value})} className="w-full pl-12 pr-5 py-3 bg-slate-50 dark:bg-slate-950 dark:text-white dark:[color-scheme:dark] rounded-2xl font-mono text-sm font-bold outline-none border-2 border-transparent focus:border-emerald-500" />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Jam Kembali</label>
                        <div className="relative">
                           <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                           <input type="time" step="1" value={formData.jam_kembali} onChange={e => setFormData({...formData, jam_kembali: e.target.value})} className="w-full pl-12 pr-5 py-3 bg-slate-50 dark:bg-slate-950 dark:text-white dark:[color-scheme:dark] rounded-2xl font-mono text-sm font-bold outline-none border-2 border-transparent focus:border-emerald-500" />
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center gap-6">
                     <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Durasi (Menit)</label>
                        <input type="number" value={formData.durasi} onChange={e => setFormData({...formData, durasi: parseInt(e.target.value) || 0})} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 dark:text-white rounded-2xl font-bold outline-none border-2 border-transparent focus:border-emerald-500" />
                     </div>
                     <div className="pt-6">
                        <span className="text-xs font-bold text-slate-400">Menit</span>
                     </div>
                  </div>

                  <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors border-2 border-transparent hover:border-slate-200 dark:hover:border-slate-800">
                     <input type="checkbox" checked={formData.is_mengurangi_jam_kerja} onChange={e => setFormData({...formData, is_mengurangi_jam_kerja: e.target.checked})} className="w-5 h-5 text-emerald-600 rounded dark:bg-slate-900 dark:border-slate-700" />
                     <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Durasi Break Mengurangi Lama Jam Kerja</span>
                  </label>

                  <button 
                    disabled={saving}
                    onClick={handleSave}
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                     {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                     Simpan JamBreak
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

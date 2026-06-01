import { useState, useEffect } from "react";
import { Company } from "../../types";
import { Building2, Plus, Search, Edit, ServerCog, AlertTriangle, X, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getLogoSrc } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

interface CompaniesTabProps {
  onSelectCompany: (id: string) => void;
  activeCompanyId: string;
}

export default function CompaniesTab({ onSelectCompany, activeCompanyId }: CompaniesTabProps) {
  const [companies, setCompanies] = useState<(Company & { employeeCount?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, action: 'enable' | 'disable' | null}>({isOpen: false, action: null});
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; companyId: string; companyName: string }>({ show: false, companyId: "", companyName: "" });

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const { data: comps } = await supabase.from("companies").select("*").order("nama_perusahaan");
      if (comps) {
        
        // Find MASTER_GLOBAL to check maintenance mode
        const masterGlobal = comps.find(c => c.company_id === 'MASTER_GLOBAL');
        if (masterGlobal) {
          setIsMaintenanceMode(!masterGlobal.is_active);
        }

        // Fetch employee counts for each company using the table directly
        const formatted = await Promise.all((comps as Company[]).map(async (c) => {
           const { count } = await supabase
             .from('karyawan')
             .select('*', { count: 'exact', head: true })
             .eq('company_id', c.company_id);
           return { ...c, employeeCount: count || 0 };
        }));

        setCompanies(formatted);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMaintenance = async () => {
    const newVal = confirmModal.action === 'enable';

    setMaintenanceLoading(true);
    setConfirmModal({ isOpen: false, action: null });
    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_active: !newVal })
        .eq('company_id', 'MASTER_GLOBAL');
      
      if (error) throw error;
      
      setIsMaintenanceMode(newVal);
      toast.success(`Mode Maintenance berhasil ${newVal ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (e: any) {
      toast.error(e.message || "Gagal mengubah mode maintenance.");
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!confirmDelete.companyId) return;

    try {
      // Dihapus secara berurutan karena di Supabase mungkin belum ada ON DELETE CASCADE
      await supabase.from("billing_history").delete().eq("company_id", confirmDelete.companyId);
      await supabase.from("registered_devices").delete().eq("company_id", confirmDelete.companyId);
      await supabase.from("machine_commands").delete().eq("company_id", confirmDelete.companyId);
      await supabase.from("overtime_matrix").delete().eq("company_id", confirmDelete.companyId);
      await supabase.from("siklus_shift").delete().eq("company_id", confirmDelete.companyId);
      await supabase.from("absensi").delete().eq("company_id", confirmDelete.companyId);
      await supabase.from("karyawan").delete().eq("company_id", confirmDelete.companyId);
      await supabase.from("departemen").delete().eq("company_id", confirmDelete.companyId);
      await supabase.from("shifts").delete().eq("company_id", confirmDelete.companyId);
      await supabase.from("hari_libur").delete().eq("company_id", confirmDelete.companyId);
      await supabase.from("jam_break").delete().eq("company_id", confirmDelete.companyId);

      const { error } = await supabase
        .from("companies")
        .delete()
        .eq("company_id", confirmDelete.companyId);

      if (error) throw error;

      toast.success(`Perusahaan "${confirmDelete.companyName}" berhasil dihapus.`);
      setConfirmDelete({ show: false, companyId: "", companyName: "" });
      
      if (activeCompanyId === confirmDelete.companyId) {
        // Fallback to MASTER_GLOBAL if deleted currently active
        onSelectCompany("MASTER_GLOBAL");
      }
      
      loadCompanies();
    } catch (e: any) {
      toast.error(e.message || "Gagal menghapus perusahaan.");
    }
  };

  const filtered = companies.filter((c) =>
    (c.nama_perusahaan.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.company_id.toLowerCase().includes(searchTerm.toLowerCase())) &&
    c.company_id !== 'MASTER_GLOBAL'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            Daftar Perusahaan
          </h2>
          <p className="text-slate-500 font-medium text-sm">Pilih perusahaan di bawah untuk mengelola data absensi, karyawan, dan pengaturannya secara spesifik.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl ${isMaintenanceMode ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
            <ServerCog className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
              Global Maintenance Mode
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-lg">
              Saat aktif, seluruh pengguna (selain Master Admin) tidak dapat mengakses website dan akan melihat halaman Perbaikan Sistem.
            </p>
          </div>
        </div>
        <button
          onClick={() => setConfirmModal({ isOpen: true, action: isMaintenanceMode ? 'disable' : 'enable' })}
          disabled={maintenanceLoading}
          className={`shrink-0 px-6 py-3 rounded-2xl font-bold transition-all disabled:opacity-50 ${isMaintenanceMode ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'}`}
        >
          {maintenanceLoading ? 'Memproses...' : isMaintenanceMode ? 'Matikan Maintenance' : 'Aktifkan Maintenance'}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari perusahaan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 outline-none transition-all font-medium"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">Loading...</div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/50">
                  <th className="p-4 md:p-5 text-sm font-bold text-slate-600 dark:text-slate-300">Company ID</th>
                  <th className="p-4 md:p-5 text-sm font-bold text-slate-600 dark:text-slate-300">Nama Perusahaan</th>
                  <th className="p-4 md:p-5 text-sm font-bold text-slate-600 dark:text-slate-300 text-center">Karyawan</th>
                  <th className="p-4 md:p-5 text-sm font-bold text-slate-600 dark:text-slate-300">Trial End</th>
                  <th className="p-4 md:p-5 text-sm font-bold text-slate-600 dark:text-slate-300 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filtered.map((comp) => (
                  <motion.tr
                    key={comp.company_id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${activeCompanyId === comp.company_id ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  >
                    <td className="p-4 md:p-5 text-sm font-bold text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-2">
                        {comp.company_id}
                        {activeCompanyId === comp.company_id && (
                          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Aktif</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 md:p-5 text-sm font-bold text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-3">
                        {comp.logo_base64 ? (
                          <img src={getLogoSrc(comp.logo_base64)} alt="" className="w-8 h-8 object-contain bg-white rounded-lg border border-slate-100 dark:border-slate-800" />
                        ) : (
                          <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                        {comp.nama_perusahaan}
                      </div>
                    </td>
                    <td className="p-4 md:p-5 text-sm font-bold text-slate-700 dark:text-slate-200 text-center">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs">
                        {comp.employeeCount}
                      </span>
                    </td>
                    <td className="p-4 md:p-5 text-sm font-bold text-slate-500">
                      {comp.trial_end_date ? new Date(comp.trial_end_date).toLocaleDateString("id-ID") : "-"}
                    </td>
                    <td className="p-4 md:p-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            if (activeCompanyId !== comp.company_id) {
                              onSelectCompany(comp.company_id);
                            } else {
                              toast.info("Sudah dalam konteks perusahaan ini");
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                            activeCompanyId === comp.company_id
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 ring-2 ring-blue-500/50'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white active:scale-95'
                          }`}
                        >
                          {activeCompanyId === comp.company_id ? 'Sedang Dikelola' : 'Kelola'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ show: true, companyId: comp.company_id, companyName: comp.nama_perusahaan })}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                          title="Hapus Perusahaan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-center text-slate-800 dark:text-white mb-2">
                  Konfirmasi Mode Maintenance
                </h3>
                <p className="text-center text-slate-500 dark:text-slate-400 font-medium">
                  {confirmModal.action === 'enable' 
                    ? "Peringatan: Mengaktifkan Mode Maintenance akan memblokir semua akses user ke seluruh website. Lanjutkan?" 
                    : "Nonaktifkan Mode Maintenance dan kembalikan akses ke semua user?"}
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmModal({ isOpen: false, action: null })}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleToggleMaintenance}
                  className={`flex-1 px-4 py-3 rounded-xl font-bold text-white shadow-lg transition-colors ${
                    confirmModal.action === 'enable' 
                      ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' 
                      : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                  }`}
                >
                  Ya, Lanjutkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
        
        {confirmDelete.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6">
                <div className="w-16 h-16 bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-center text-slate-800 dark:text-white mb-2">
                  Hapus Perusahaan
                </h3>
                <p className="text-center text-slate-500 dark:text-slate-400 font-medium">
                  Apakah Anda yakin ingin menghapus perusahaan <span className="font-bold text-slate-800 dark:text-slate-200">"{confirmDelete.companyName}"</span>? 
                  <br/><br/>
                  <span className="text-red-500 dark:text-red-400 font-bold">Peringatan:</span> Semua data karyawan, absensi, dan pengaturan terkait perusahaan ini akan terhapus secara permanen dari database.
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDelete({ show: false, companyId: "", companyName: "" })}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCompany}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 transition-colors"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Company } from "../../types";
import { Wallet, Search, CreditCard, ChevronRight, CheckCircle2, Clock, AlertCircle, PlusCircle, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getLogoSrc } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { confirmDialog } from '../../lib/confirmDialog';

export default function BillingTab() {
  const [companies, setCompanies] = useState<(Company & { employeeCount: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [extendMonths, setExtendMonths] = useState(1);
  const [isExtending, setIsExtending] = useState(false);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    setLoading(true);
    try {
      const { data: comps } = await supabase.from("companies").select("*").order("nama_perusahaan");
      if (comps) {
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

  const handleExtend = async () => {
    if (!selectedCompany) return;
    if (!(await confirmDialog(`Apakah Anda yakin ingin memperpanjang layanan selama ${extendMonths} bulan?`))) return;
    setIsExtending(true);
    try {
      let currentEndDate = selectedCompany.trial_end_date
        ? new Date(selectedCompany.trial_end_date)
        : new Date();
      if (isNaN(currentEndDate.getTime()) || currentEndDate < new Date()) {
        currentEndDate = new Date();
      }
      currentEndDate.setMonth(currentEndDate.getMonth() + parseInt(extendMonths.toString()));
      const newDateStr = currentEndDate.toISOString();

      const { error } = await supabase
        .from("companies")
        .update({ trial_end_date: newDateStr })
        .eq("company_id", selectedCompany.company_id);

      if (error) throw error;

      toast.success(`Masa aktif ${selectedCompany.nama_perusahaan} berhasil diperpanjang!`);
      setSelectedCompany(null);
      setExtendMonths(1);
      loadBillingData();
    } catch (e: any) {
      toast.error("Gagal memperpanjang masa aktif: " + e.message);
    } finally {
      setIsExtending(false);
    }
  };

  const filtered = companies.filter((c) =>
    c.nama_perusahaan.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.company_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const calculateMonthlyBill = (employeeCount: number) => {
    // Assuming 10000 IDR per employee per month
    return employeeCount * 10000;
  };

  const getStatus = (trialEndDate: string) => {
    const end = new Date(trialEndDate);
    const now = new Date();
    if (end < now) return { label: 'Expired', color: 'text-red-500 bg-red-50 dark:bg-red-950/30', icon: <AlertCircle className="w-3 h-3" /> };
    const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) return { label: `${diffDays} Hari Lagi`, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30', icon: <Clock className="w-3 h-3" /> };
    return { label: 'Active', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30', icon: <CheckCircle2 className="w-3 h-3" /> };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-blue-600" />
            Billing Overview
          </h2>
          <p className="text-slate-500 font-medium text-sm">Monitoring pendapatan dan status langganan perusahaan.</p>
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari perusahaan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 focus:border-blue-500 outline-none transition-all text-sm font-medium"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-600 p-6 rounded-[2rem] text-white shadow-xl shadow-blue-500/20">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">Total Perusahaan</p>
          <p className="text-3xl font-black mt-2">{companies.length}</p>
        </div>
        <div className="bg-emerald-600 p-6 rounded-[2rem] text-white shadow-xl shadow-emerald-500/20">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">Estimasi Pendapatan/Bulan</p>
          <p className="text-3xl font-black mt-2">
            {formatCurrency(companies.reduce((acc, c) => acc + calculateMonthlyBill(c.employeeCount), 0))}
          </p>
        </div>
        <div className="bg-slate-800 p-6 rounded-[2rem] text-white shadow-xl shadow-slate-800/20">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">Total Karyawan Terdaftar</p>
          <p className="text-3xl font-black mt-2">
            {companies.reduce((acc, c) => acc + c.employeeCount, 0)}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-500">Perusahaan</th>
                <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-500 text-center">Status</th>
                <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-500 text-center">Karyawan</th>
                <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-500 text-right">Tagihan Bulanan</th>
                <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-500 text-right">Trial End</th>
                <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-500 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((comp) => {
                const status = getStatus(comp.trial_end_date);
                return (
                  <tr key={comp.company_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        {comp.logo_base64 ? (
                          <img src={getLogoSrc(comp.logo_base64)} alt="" className="w-10 h-10 object-contain bg-white rounded-xl border border-slate-100 dark:border-slate-800" />
                        ) : (
                          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                            <Wallet className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white">{comp.nama_perusahaan}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{comp.company_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${status.color}`}>
                        {status.icon}
                        {status.label}
                      </span>
                    </td>
                    <td className="p-6 text-center font-bold text-slate-700 dark:text-slate-300">
                      {comp.employeeCount}
                    </td>
                    <td className="p-6 text-right font-black text-slate-800 dark:text-white">
                      {formatCurrency(calculateMonthlyBill(comp.employeeCount))}
                    </td>
                    <td className="p-6 text-right text-xs font-bold text-slate-500">
                      {new Date(comp.trial_end_date).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-6 text-center">
                       <button
                         onClick={() => setSelectedCompany(comp)}
                         className="px-3 py-1.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                       >
                         <PlusCircle className="w-3.5 h-3.5" />
                         Perpanjang
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedCompany && (
           <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
           >
             <motion.div
               initial={{ scale: 0.95, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.95, opacity: 0 }}
               className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800"
             >
               <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                 <h3 className="text-lg font-black text-slate-800 dark:text-white">Perpanjang Masa Aktif</h3>
                 <button
                   onClick={() => setSelectedCompany(null)}
                   className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                 >
                   <X className="w-5 h-5" />
                 </button>
               </div>
               
               <div className="p-6 space-y-6">
                 <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Perusahaan</p>
                   <p className="font-bold text-slate-800 dark:text-white">{selectedCompany.nama_perusahaan}</p>
                 </div>
                 
                 <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Masa Aktif Berakhir</p>
                   <p className="font-bold text-slate-800 dark:text-white">
                      {new Date(selectedCompany.trial_end_date).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}
                   </p>
                 </div>

                 <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tambah Berapa Bulan?</p>
                   <input
                     type="number"
                     min="1"
                     value={extendMonths}
                     onChange={(e) => setExtendMonths(parseInt(e.target.value) || 1)}
                     className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 outline-none transition-colors font-bold text-slate-800 dark:text-white"
                   />
                 </div>

                 <button
                   onClick={handleExtend}
                   disabled={isExtending}
                   className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50"
                 >
                   {isExtending ? "Memproses..." : "Konfirmasi Perpanjangan"}
                 </button>
               </div>
             </motion.div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Attendance, User, Department } from "../../types";
import { supabase } from "../../lib/supabase";
import { toLocalISOString, toLocalDateString } from "../../lib/utils";
import {
  Plus,
  Edit,
  Trash2,
  CalendarCheck2,
  Loader2,
  CheckCircle,
  Info,
  X,
  Calendar,
  Search,
  Database
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { confirmDialog } from '../../lib/confirmDialog';

interface IzinTabProps {
  companyId: string;
  employees: User[];
  departments: Department[];
  user: User;
}

export default function IzinTab({ companyId, employees, departments, user }: IzinTabProps) {
  const getLocalDateString = () => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  };

  const getLocalDateEndString = () => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [izinList, setIzinList] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState(getLocalDateString());
  const [endDate, setEndDate] = useState(getLocalDateEndString());
  const [selectedDept, setSelectedDept] = useState<string>("all");

  const [formData, setFormData] = useState({
    id: undefined as number | undefined,
    nip: "",
    tipe: "IJIN",
    tanggal: toLocalDateString(new Date()),
    keterangan: "",
  });

  const loadIzin = async () => {
    setLoading(true);
    let query = supabase
      .from("absensi")
      .select("*")
      .eq("company_id", companyId)
      .in("tipe", ["IJIN", "SAKIT", "CUTI", "LUPA_ABSEN"])
      .gte("waktu_masuk", toLocalISOString(new Date(`${startDate}T00:00:00`)))
      .lte("waktu_masuk", toLocalISOString(new Date(`${endDate}T23:59:59.999`)))
      .order("waktu_masuk", { ascending: false });

    if (searchTerm.trim()) {
      query = query.or(`nama.ilike.%${searchTerm}%,nip.ilike.%${searchTerm}%`);
    }

    if (user.role === 'USER') {
      query = query.eq('nip', user.nip);
    } else if (selectedDept !== "all") {
      const selectedDeptId = selectedDept === "null" ? null : parseInt(selectedDept);
      const empNips = employees
        .filter((e) => {
          if (selectedDeptId === null) {
            return !e.departemen_id;
          }
          return e.departemen_id === selectedDeptId;
        })
        .map((e) => e.nip);
      if (empNips.length > 0) {
        query = query.in("nip", empNips);
      } else if (employees.length > 0) {
        query = query.in("nip", ["__NONE__"]);
      }
    }

    const { data } = await query;
    if (data) setIzinList(data);
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadIzin();
    }, 300);
    return () => clearTimeout(timer);
  }, [companyId, startDate, endDate, searchTerm, selectedDept]);

  const handleOpenModal = (izin?: Attendance) => {
    if (izin) {
      setFormData({
        id: izin.id,
        nip: izin.nip,
        tipe: izin.tipe || "IJIN",
        tanggal:
          izin.waktu_masuk?.split("T")[0] ||
          toLocalDateString(new Date()),
        keterangan: izin.keterangan || "",
      });
    } else {
      setFormData({
        id: undefined,
        nip: "",
        tipe: "IJIN",
        tanggal: toLocalDateString(new Date()),
        keterangan: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nip || !formData.tanggal) return toast.error("Lengkapi data!");

    setSaving(true);
    try {
      const emp = employees.find((e) => e.nip === formData.nip);
      if (!emp) throw new Error("Staff tidak ditemukan");

      const startOfTheDay = new Date(`${formData.tanggal}T08:00:00`);
      const localWaktu = toLocalISOString(startOfTheDay);
      const payload = {
        company_id: companyId,
        nip: emp.nip,
        nama: emp.nama,
        tipe: formData.tipe,
        waktu_masuk: localWaktu,
        keterangan: formData.keterangan,
        status_acc: 0,
      };

      if (formData.id) {
        const { error } = await supabase
          .from("absensi")
          .update(payload)
          .eq("id", formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("absensi").insert([payload]);
        if (error) throw error;
      }

      // Auto Cleanup
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      supabase.from('absensi').delete().eq('company_id', companyId).lt('waktu_masuk', oneYearAgo.toISOString()).then(() => {}, () => {});

      setIsModalOpen(false);
      loadIzin();
      toast.success("Data berhasil disimpan");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSetStatus = async (id: number, status: number) => {
    try {
      const { error } = await supabase
        .from("absensi")
        .update({ status_acc: status })
        .eq("id", id);
      if (error) throw error;
      toast.success(status === 1 ? "Izin Disetujui" : "Izin Ditolak");
      loadIzin();
    } catch (e: any) {
      toast.error("Gagal memperbarui status: " + e.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirmDialog("Hapus record ini?"))) return;
    try {
      const { error } = await supabase.from("absensi").delete().eq("id", id);
      if (error) throw error;
      toast.success("Data berhasil dihapus");
      loadIzin();
    } catch (e: any) {
      toast.error("Gagal Hapus: " + e.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Izin & Koreksi
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
            Riwayat pendaftaran izin dan absen manual karyawan.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#2563eb] text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" /> Input Manual
        </button>
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-slate-900 p-5 md:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800/60 shadow-sm space-y-6">
        <div className="grid lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 xl:col-span-4 space-y-2 uppercase">
            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 ml-1 tracking-widest">
              Rentang Tanggal
            </label>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-[0.625rem] border border-slate-100 dark:border-slate-800 rounded-2xl">
              <div className="flex flex-1 items-center gap-2 min-w-0 w-full">
                <span className="text-xs font-bold text-slate-400 sm:hidden w-8 shrink-0">Dari</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full min-w-0 bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer p-0 dark:text-slate-200 dark:[color-scheme:dark]"
                />
              </div>
              <span className="text-slate-300 hidden sm:block shrink-0">-</span>
              <div className="flex flex-1 items-center gap-2 min-w-0 w-full">
                <span className="text-xs font-bold text-slate-400 sm:hidden w-8 shrink-0">Smpi</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full min-w-0 bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer p-0 dark:text-slate-200 dark:[color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 xl:col-span-3 space-y-2 uppercase">
            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 ml-1 tracking-widest">
              Departemen
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 px-4 py-[0.625rem] rounded-2xl border border-slate-100 dark:border-slate-800 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              <option value="all">Semua Departemen</option>
              <option value="null">General</option>
              {departments?.filter(d => d.nama_departemen?.toLowerCase() !== "management").map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nama_departemen}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-4 xl:col-span-5 space-y-2 uppercase">
            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 ml-1 tracking-widest">
              Pencarian
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 truncate" />
              <input
                type="text"
                placeholder="Cari nama atau NIP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-[0.625rem] bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden flex flex-col relative z-0">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[600px] text-[13px] custom-scrollbar scroll-smooth">
          <table className="w-full text-left border-separate border-spacing-0 min-w-[1000px] whitespace-nowrap">
            <thead>
              <tr className="sticky top-0 bg-slate-50 dark:bg-slate-950 z-30 shadow-sm text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="sticky left-0 bg-slate-50 dark:bg-slate-950 z-40 px-5 py-4 border-b border-r border-slate-200 dark:border-slate-800">No</th>
                <th className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">Tanggal</th>
                <th className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">Nama Karyawan</th>
                <th className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">Tipe Izin</th>
                <th className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">Keterangan</th>
                <th className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 text-center">Status ACC</th>
                <th className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && izinList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-20 text-center bg-white dark:bg-slate-900">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-500 font-bold text-sm">Memuat data izin...</p>
                    </div>
                  </td>
                </tr>
              ) : izinList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-20 text-center bg-white dark:bg-slate-900">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Database className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Tidak ada data izin masuk pada rentang ini.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                izinList.map((izin, index) => (
                  <tr
                    key={izin.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    <td className="sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-5 py-4 border-r border-slate-100 dark:border-slate-800 font-mono font-medium text-slate-500 dark:text-slate-400">
                      {index + 1}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {izin.waktu_masuk?.split("T")[0]}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
                        {izin.nama}
                      </p>
                      <p className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">
                        {izin.nip}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          izin.tipe === "CUTI"
                            ? "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20"
                            : izin.tipe === "SAKIT"
                              ? "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
                              : "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                        } border`}
                      >
                        {izin.tipe}
                      </span>
                    </td>
                    <td className="px-5 py-4 max-w-[200px] lg:max-w-[300px]">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate italic">
                        "{izin.keterangan || "Tanpa keterangan"}"
                      </p>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {izin.status_acc === 1 ? (
                        <span className="px-3 py-1.5 bg-[#ecfdf5] text-[#059669] rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" /> DISETUJUI
                        </span>
                      ) : izin.status_acc === 2 ? (
                        <span className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 border border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
                          <X className="w-3 h-3" /> DITOLAK
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 bg-[#fffbeb] text-[#d97706] rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                          <Loader2 className="w-3 h-3 animate-spin" /> MENUNGGU
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        {user.role !== 'USER' && (
                          <>
                            <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                              <button
                                onClick={() => handleSetStatus(izin.id, 1)}
                                title="Setujui"
                                className={`p-1.5 rounded-lg transition-all ${izin.status_acc === 1 ? "bg-emerald-500 text-white shadow-sm" : "text-slate-400 hover:text-emerald-600"}`}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleSetStatus(izin.id, 2)}
                                title="Tolak"
                                className={`p-1.5 rounded-lg transition-all ${izin.status_acc === 2 ? "bg-rose-500 text-white shadow-sm" : "text-slate-400 hover:text-rose-600"}`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleSetStatus(izin.id, 0)}
                                title="Kembalikan ke Pending"
                                className={`p-1.5 rounded-lg transition-all ${izin.status_acc === 0 ? "bg-amber-500 text-white shadow-sm" : "text-slate-400 hover:text-amber-600"}`}
                              >
                                <CalendarCheck2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="w-[1px] h-8 bg-slate-100 dark:bg-slate-800 mx-1" />
                          </>
                        )}
                        {(user.role !== 'USER' || izin.status_acc === 0) && (
                          <>
                            <button
                              onClick={() => handleOpenModal(izin)}
                              title="Edit"
                              className="flex items-center justify-center w-8 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 rounded-lg transition-all"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(izin.id)}
                              title="Hapus"
                              className="flex items-center justify-center w-8 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Card List */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/50">
          {loading && izinList.length === 0 ? (
            <div className="px-5 py-20 text-center bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 font-bold text-sm">Memuat data...</p>
            </div>
          ) : izinList.length === 0 ? (
            <div className="px-5 py-20 text-center bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Database className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Tidak ada data izin.</p>
            </div>
          ) : (
            izinList.map((izin) => (
              <div key={`mobile-${izin.id}`} className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="font-extrabold text-slate-800 dark:text-slate-100 text-sm tracking-tight">
                      {izin.nama}
                    </p>
                    <p className="font-mono text-[10px] font-bold text-slate-400">
                      {izin.nip} &bull; {izin.waktu_masuk?.split("T")[0]}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                      izin.tipe === "CUTI"
                        ? "bg-purple-50 text-purple-600 border-purple-100"
                        : izin.tipe === "SAKIT"
                          ? "bg-rose-50 text-rose-600 border-rose-100"
                          : "bg-amber-50 text-amber-600 border-amber-100"
                    } border`}
                  >
                    {izin.tipe}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 italic leading-relaxed">
                    "{izin.keterangan || "Tanpa keterangan"}"
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {izin.status_acc === 1 ? (
                      <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> ACC
                      </span>
                    ) : izin.status_acc === 2 ? (
                      <span className="text-[10px] font-black text-rose-600 flex items-center gap-1">
                        <X className="w-3.5 h-3.5" /> TOLAK
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-amber-600 flex items-center gap-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> PENDING
                      </span>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    {user.role !== 'USER' && (
                      <div className="flex bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                         <button
                            onClick={() => handleSetStatus(izin.id, 1)}
                            className={`p-2 transition-all ${izin.status_acc === 1 ? "bg-emerald-500 text-white" : "text-slate-400"}`}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSetStatus(izin.id, 2)}
                            className={`p-2 transition-all ${izin.status_acc === 2 ? "bg-rose-500 text-white" : "text-slate-400"}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                      </div>
                    )}
                    {(user.role !== 'USER' || izin.status_acc === 0) && (
                      <>
                        <button
                          onClick={() => handleOpenModal(izin)}
                          className="flex items-center justify-center p-2 text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200 hover:bg-blue-200 rounded-lg transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(izin.id)}
                          className="flex items-center justify-center p-2 text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 hover:bg-rose-200 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg relative z-10 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center p-5 md:p-8 shrink-0 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  Input Izin / Koreksi
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-5 md:p-8 overflow-y-auto custom-scrollbar space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                    Karyawan
                  </label>
                  <select
                    value={formData.nip}
                    onChange={(e) =>
                      setFormData({ ...formData, nip: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-medium text-slate-700 dark:text-slate-200"
                  >
                    <option value="">Pilih Karyawan</option>
                    {employees.map((emp) => (
                      <option key={emp.nip} value={emp.nip}>
                        {emp.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                      Tipe
                    </label>
                    <select
                      value={formData.tipe}
                      onChange={(e) =>
                        setFormData({ ...formData, tipe: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all text-slate-700 dark:text-slate-200"
                    >
                      <option value="IJIN">Izin</option>
                      <option value="SAKIT">Sakit</option>
                      <option value="CUTI">Cuti</option>
                      <option value="LUPA_ABSEN">Lupa Absen</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                      Tanggal
                    </label>
                    <input
                      type="date"
                      value={formData.tanggal}
                      onChange={(e) =>
                        setFormData({ ...formData, tanggal: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-mono text-slate-700 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                    Keterangan / Alasan
                  </label>
                  <textarea
                    value={formData.keterangan}
                    onChange={(e) =>
                      setFormData({ ...formData, keterangan: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all text-slate-700 dark:text-slate-200"
                    placeholder="Contoh: Surat dokter dikirim menyusul"
                  />
                </div>
              </div>

              <div className="p-4 mx-5 md:mx-8 mb-5 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex gap-3 border border-blue-100 dark:border-blue-500/20">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <p className="text-[10px] text-blue-700 dark:text-blue-400 leading-relaxed font-semibold">
                  Mencatat izin akan membuat record kehadiran dummy untuk
                  tanggal tersebut. Status akan otomatis "IJIN/SAKIT/CUTI" pada
                  laporan.
                </p>
              </div>
              <div className="p-5 md:p-8 shrink-0 border-t border-slate-100 dark:border-slate-800">
                <button
                  disabled={saving}
                  onClick={handleSave}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CalendarCheck2 className="w-5 h-5" />
                  )}
                  Simpan Record Izin
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

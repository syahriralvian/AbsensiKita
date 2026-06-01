import { useState, useEffect, useRef, useMemo } from "react";
import { confirmDialog } from '../../lib/confirmDialog';
import {
  Database,
  Search,
  Filter,
  Calendar,
  MapPin,
  ChevronDown,
  Navigation,
  UserCheck,
  User,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Download,
  Upload,
  Loader2,
  Plus,
  X,
  Clock,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Attendance, User as UserType, Department, Company } from "../../types";
import { calculateDistance, toLocalISOString } from "../../lib/utils";
import { exportToExcel, exportToPDF } from "../../lib/export";
import { toast } from "sonner";

interface RecordTabProps {
  companyId: string;
  employees: UserType[];
  departments: Department[];
  user: UserType;
}

export default function RecordTab({
  companyId,
  employees,
  departments,
  user,
}: RecordTabProps) {
  const getLocalDateString = () => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [logs, setLogs] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState(getLocalDateString());
  const [endDate, setEndDate] = useState(getLocalDateString());
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(100);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [selectedDept, setSelectedDept] = useState<string>("all");

  const employeesMap = useMemo(() => {
    const map = new Map<string, UserType>();
    employees.forEach(e => map.set(e.nip, e));
    return map;
  }, [employees]);
  const [importing, setImporting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualFormData, setManualFormData] = useState({
    nip: "",
    tipe: "MASUK",
    waktu: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
    keterangan: ""
  });
  const [savingManual, setSavingManual] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCompanyInfo();
    setPage(1);

    // Add real-time subscription
    const channel = supabase
      .channel("record_tab_changes_" + companyId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "absensi",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          setRefreshTrigger(prev => prev + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const fetchCompanyInfo = async () => {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .eq("company_id", companyId)
      .single();
    if (data) setCompany(data);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 300);
    return () => clearTimeout(timer);
  }, [startDate, endDate, page, selectedDept, searchTerm, refreshTrigger]);

  const fetchLogs = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      // Use literal local boundary formats to safely compare DB dates uniformly 
      const start = toLocalISOString(new Date(`${startDate}T00:00:00`));
      const end = toLocalISOString(new Date(`${endDate}T23:59:59.999`));

      let query = supabase
        .from("absensi")
        .select("*", { count: "exact" })
        .eq("company_id", companyId)
        .gte("waktu_masuk", start)
        .lte("waktu_masuk", end);

      // Search functionality
      if (searchTerm.trim()) {
        query = query.or(`nama.ilike.%${searchTerm}%,nip.ilike.%${searchTerm}%`);
      }

      // If regular USER, only show their own logs
      if (user.role === 'USER') {
        query = query.eq('nip', user.nip);
      }

      query = query.order("waktu_masuk", { ascending: false });

      if (selectedDept !== "all") {
        const selectedDeptId = selectedDept === "null" ? null : parseInt(selectedDept);
        const empNips = employees
          .filter((e) => {
            if (selectedDeptId === null) {
              return !e.departemen_id;
            }
            return e.departemen_id === selectedDeptId;
          })
          .map((e) => e.nip);
        
        // Only apply in filter if we have nips or if employees were already loaded
        if (empNips.length > 0) {
          query = query.in("nip", empNips);
        } else if (employees.length > 0) {
          // If employees are loaded but none match the dept, we should show nothing
          query = query.in("nip", ["__NONE__"]);
        }
      }

      const { data, count, error } = await query.range(
        (page - 1) * pageSize,
        page * pageSize - 1,
      );

      if (error) throw error;
      if (data) setLogs(data);
      if (count !== null) setTotalCount(count);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateRecordStatus = async (id: number, newTipe: string) => {
    try {
      const { error } = await supabase
        .from("absensi")
        .update({ tipe: newTipe })
        .eq("id", id);

      if (error) throw error;
      toast.success("Status absensi berhasil diubah");
      fetchLogs();
      setOpenMenuId(null);
    } catch (e: any) {
      toast.error("Gagal update status", {
        description: e.message,
      });
    }
  };

  const getStatusColor = (tipe: string) => {
    switch (tipe?.toUpperCase()) {
      case "MASUK":
        return "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
      case "PULANG":
        return "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
      case "KELUAR":
        return "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
      case "KEMBALI":
        return "bg-teal-50 text-teal-600 border-teal-100 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20";
      case "LEMBUR_MASUK":
        return "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20";
      case "LEMBUR_KELUAR":
        return "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20";
      default:
        return "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20";
    }
  };

  const handleExport = (type: "excel" | "pdf") => {
    if (logs.length === 0) return toast.error("Tidak ada data untuk diekspor");

    if (type === "excel") {
      const exportData = logs.map((log) => ({
        nip: log.nip,
        nama: log.nama || employeesMap.get(log.nip)?.nama || "-",
        waktu: new Date(log.waktu_masuk.replace(' ', 'T')).toLocaleString("id-ID"),
        tipe: log.tipe,
        lat: log.lat,
        lng: log.lng,
      }));
      exportToExcel(
        exportData,
        [
          { header: "NIP", key: "nip" },
          { header: "Nama", key: "nama" },
          { header: "Waktu", key: "waktu" },
          { header: "Tipe", key: "tipe" },
          { header: "Lat", key: "lat" },
          { header: "Lng", key: "lng" },
        ],
        `Log_Absensi_${startDate}_to_${endDate}`,
      );
    } else {
      const headers = ["NIP", "Nama", "Waktu", "Tipe", "Lokasi"];
      const rows = logs.map((log) => [
        log.nip,
        log.nama || employeesMap.get(log.nip)?.nama || "-",
        new Date(log.waktu_masuk.replace(' ', 'T')).toLocaleString("id-ID"),
        log.tipe,
        log.lat && log.lng ? `${log.lat}, ${log.lng}` : "-",
      ]);
      exportToPDF(
        "Log Absensi Kehadiran",
        headers,
        rows,
        `Log_Absensi_${startDate}_to_${endDate}`,
        `Periode: ${startDate} s/d ${endDate}`,
      );
    }
  };

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let text = event.target?.result as string;
        // Remove NUL bytes (\x00), Postgres doesn't support them
        text = text.replace(/\0/g, '');
        
        const rows = text.split("\n").filter((row) => row.trim() !== "");
        const newLogs = [];
        
        // Coba deteksi header (opsional) atau gunakan urutan kolom (id, nama, status, template, absensi)
        const isDat = file.name.toLowerCase().endsWith('.dat');
        const hasHeader = rows[0].toLowerCase().includes("nama") || rows[0].toLowerCase().includes("status");
        const startIndex = hasHeader && !isDat ? 1 : 0;
        
        const now = new Date().toISOString();

        for (let i = startIndex; i < rows.length; i++) {
          let nipStr = "";
          let namaStr = "";
          let statusStr = "";
          let absensiStr = "";

          if (isDat || rows[i].includes('\t')) {
            // ZKTeco .dat format
            // Often has multiple tabs or leading tabs, easiest is to split by any whitespace, but date and time becomes 2 tokens
            let cols = rows[i].trim().split(/\s+/);

            if (cols.length >= 4) {
              nipStr = cols[0].trim();
              // In ZKTeco attlog, usually format is: PIN Date Time Status
              // Example: 1  2020-02-13 10:45:10 1 0 1 0
              absensiStr = cols[1].trim() + ' ' + cols[2].trim();
              
              // Biasanya format: PIN Date Time VerifyType VerifyState WorkCode Reserved
              // VerityType: 1=Fingerprint, 0=Password, 15=Face, dll
              // VerifyState (Status): 0=Masuk, 1=Pulang, 4=Lembur Masuk, 5=Lembur Keluar, 2=Keluar, 3=Kembali
              if (cols.length >= 6) {
                // Jika panjang kolom cukup (misal 7 kolom), kemunginan besar cols[4] adalah Status dan cols[3] adalah Verify Type
                statusStr = cols[4].trim();
              } else {
                statusStr = cols[3].trim();
              }

              const emp = employeesMap.get(nipStr);
              namaStr = emp?.nama || "Unknown";
            }
          } else {
            const cols = rows[i].split(",");
            if (cols.length >= 5) {
              nipStr = cols[0].trim().replace(/^"|"$/g, '');
              namaStr = cols[1].trim().replace(/^"|"$/g, '');
              statusStr = cols[2].trim().toLowerCase().replace(/^"|"$/g, '');
              absensiStr = cols[4].trim().replace(/^"|"$/g, '');
            }
          }

          if (!nipStr || !absensiStr) continue;

          // Mapping tipe/status dari mesin
          let tipe = 'MASUK';
          if (statusStr.includes('pulang') || statusStr.includes('out') || statusStr === '1') tipe = 'PULANG';
            else if (statusStr.includes('keluar') || statusStr === '2') tipe = 'KELUAR';
            else if (statusStr.includes('kembali') || statusStr === '3') tipe = 'KEMBALI';
            else if (statusStr.includes('lembur masuk') || statusStr === '4') tipe = 'LEMBUR_MASUK';
            else if (statusStr.includes('lembur keluar') || statusStr === '5') tipe = 'LEMBUR_KELUAR';
            else tipe = 'MASUK'; // default check-in/0 fallback
            
            // Perbaiki spasi pada date mesin yang sering YYYY-MM-DD HH:mm:ss menjadi format ISO kompatibel
            let parsedDate = null;
            try {
              if (absensiStr.includes(" ")) {
                parsedDate = new Date(absensiStr.replace(" ", "T"));
              } else {
                parsedDate = new Date(absensiStr);
              }
            } catch(err) {}

          if (isDat || rows[i].includes('\t')) {
            // ...handled above
            if (parsedDate && !isNaN(parsedDate.getTime())) {
              newLogs.push({
                company_id: companyId,
                nip: nipStr,
                nama: namaStr,
                tipe: tipe,
                waktu_masuk: parsedDate.toISOString(),
                status_acc: 1,
                keterangan: isDat ? "Import DAT Mesin Absensi" : "Import CSV Mesin Absensi",
              });
            }
          } else {
            if (parsedDate && !isNaN(parsedDate.getTime())) {
              newLogs.push({
                company_id: companyId,
                nip: nipStr,
                nama: namaStr,
                tipe: tipe,
                waktu_masuk: parsedDate.toISOString(),
                status_acc: 1,
                keterangan: "Import CSV Mesin Absensi",
              });
            }
          }
        }

        if (newLogs.length === 0) {
          throw new Error("Tidak ada data presensi valid atau format file salah.");
        }

        // Batch insert 1000 records at a time
        const batchSize = 1000;
        for (let i = 0; i < newLogs.length; i += batchSize) {
          const batch = newLogs.slice(i, i + batchSize);
          const { error } = await supabase.from('absensi').insert(batch);
          if (error) throw error;
        }

        // Auto Cleanup
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        supabase.from('absensi').delete().eq('company_id', companyId).lt('waktu_masuk', oneYearAgo.toISOString()).then(() => {}, () => {});

        toast.success(`Berhasil import ${newLogs.length} data absensi!`);
        fetchLogs();
      } catch(err: any) {
        toast.error("Gagal Import Data", { description: err.message });
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleSaveManual = async () => {
    if (!manualFormData.nip || !manualFormData.waktu) {
      return toast.error("NIP dan Waktu wajib diisi");
    }

    setSavingManual(true);
    try {
      const emp = employeesMap.get(manualFormData.nip);
      const { error } = await supabase.from("absensi").insert([
        {
          company_id: companyId,
          nip: manualFormData.nip,
          nama: emp?.nama || "Manual Entry",
          tipe: manualFormData.tipe,
          waktu_masuk: new Date(manualFormData.waktu).toISOString(),
          keterangan: manualFormData.keterangan || "Input Manual oleh Admin",
        },
      ]);

      if (error) throw error;

      // Auto Cleanup
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      supabase.from('absensi').delete().eq('company_id', companyId).lt('waktu_masuk', oneYearAgo.toISOString()).then(() => {}, () => {});

      toast.success("Absensi manual berhasil disimpan");
      setIsManualModalOpen(false);
      fetchLogs();
    } catch (e: any) {
      toast.error("Gagal simpan: " + e.message);
    } finally {
      setSavingManual(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Log Presensi
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
            Daftar lengkap aktivitas masuk dan pulang karyawan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <input
            type="file"
            accept=".csv,.dat"
            ref={fileInputRef}
            className="hidden"
            onChange={importCSV}
          />
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="flex-[1_1_auto] md:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-100 dark:border-blue-500/20 rounded-xl hover:bg-blue-100 transition-all text-xs sm:text-sm shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" /> Manual
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex-[1_1_auto] md:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#fff7ed] dark:bg-orange-500/10 text-[#9a3412] dark:text-orange-400 font-bold border border-orange-200/50 dark:border-orange-500/20 rounded-xl hover:bg-orange-100 transition-all text-xs sm:text-sm shadow-sm active:scale-95"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import
          </button>
          <button
            onClick={() => handleExport("excel")}
            className="flex-[1_1_auto] md:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-100 dark:border-emerald-500/20 rounded-xl hover:bg-emerald-100 transition-all text-xs sm:text-sm shadow-sm active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="flex-[1_1_auto] md:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-100 dark:border-rose-500/20 rounded-xl hover:bg-rose-100 transition-all text-xs sm:text-sm shadow-sm active:scale-95"
          >
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
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
              {departments.filter(d => d.nama_departemen?.toLowerCase() !== "management").map((d) => (
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

      {/* Main Table Content */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col relative z-0">
        <div className="hidden md:block overflow-x-auto max-h-[600px] text-[13px] custom-scrollbar scroll-smooth">
          <table className="w-full text-left border-separate border-spacing-0 min-w-[1000px] whitespace-nowrap">
            <thead>
              <tr className="sticky top-0 bg-slate-50 dark:bg-slate-950 z-30 shadow-sm">
                <th className="sticky left-0 bg-slate-50 dark:bg-slate-950 z-40 px-5 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b border-r border-slate-200 dark:border-slate-800 w-[180px]">
                  Pilihan
                </th>
                <th className="px-5 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                  No
                </th>
                <th className="px-5 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                  Karyawan
                </th>
                <th className="px-5 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800 text-center">
                  Tipe / Status
                </th>
                <th className="px-5 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                  Hari & Tanggal
                </th>
                <th className="px-5 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                  Waktu
                </th>
                <th className="px-5 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                  Lokasi & Geo
                </th>
                <th className="px-5 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                  Verifikasi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading && logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-20 text-center bg-white dark:bg-slate-900"
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-500 font-bold text-sm">
                        Memuat data log presensi...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-20 text-center bg-white dark:bg-slate-900"
                  >
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Database className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                        Tidak ada log presensi pada tanggal ini.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => (
                  <tr
                    key={log.id || `${log.nip}-${index}`}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group ${openMenuId === log.id ? "relative z-50" : ""}`}
                  >
                    <td
                      className={`sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-5 py-4 border-r border-slate-100 dark:border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.02)] ${openMenuId === log.id ? "z-50" : "z-20"}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {log.id && (
                        <div className="relative flex items-center gap-1.5 z-10 w-full max-w-[170px]">
                          {log.tipe === "PULANG" ? (
                            <button
                              onClick={() =>
                                updateRecordStatus(log.id!, "MASUK")
                              }
                              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition whitespace-nowrap"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-emerald-500" />{" "}
                              Set Masuk
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                updateRecordStatus(log.id!, "PULANG")
                              }
                              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition whitespace-nowrap"
                            >
                              <User className="w-3.5 h-3.5 text-blue-500" /> Set
                              Pulang
                            </button>
                          )}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setMenuPosition({
                                  top: rect.bottom,
                                  left: rect.left,
                                });
                                setOpenMenuId(
                                  openMenuId === log.id ? null : log.id,
                                );
                              }}
                              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-lg shadow-sm flex items-center gap-1 transition"
                            >
                              Opsi <ChevronDown className="w-3 h-3" />
                            </button>
                            {openMenuId === log.id && menuPosition && (
                              <>
                                <div 
                                  className="fixed inset-0 z-[90] bg-transparent" 
                                  onClick={() => setOpenMenuId(null)}
                                />
                                <div 
                                  className="fixed w-44 bg-white dark:bg-slate-800 rounded-xl shadow-[0_0_40px_-10px_rgba(0,0,0,0.3)] border border-slate-200 dark:border-slate-700 z-[100] py-1.5 overflow-hidden"
                                  style={{
                                    top: `${index > logs.length - 3 ? menuPosition.top - 160 : menuPosition.top + 4}px`,
                                    left: `${menuPosition.left - 80}px`,
                                  }}
                                >
                                  <button
                                    onClick={() => {
                                      updateRecordStatus(log.id!, "PULANG");
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"
                                  >
                                    <User className="w-3.5 h-3.5 opacity-50" />{" "}
                                    Set Pulang
                                  </button>
                                  <button
                                    onClick={() => {
                                      updateRecordStatus(log.id!, "LEMBUR_MASUK");
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"
                                  >
                                    <User className="w-3.5 h-3.5 opacity-50" />{" "}
                                    Set Lembur Msk
                                  </button>
                                  <button
                                    onClick={() => {
                                      updateRecordStatus(log.id!, "LEMBUR_KELUAR");
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"
                                  >
                                    <User className="w-3.5 h-3.5 opacity-50" />{" "}
                                    Set Lembur Klr
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono font-medium text-slate-500 dark:text-slate-400">
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
                        {log.nama || employeesMap.get(log.nip)?.nama || "-"}
                      </div>
                      <div className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                        {log.nip}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(log.tipe)}`}
                        >
                          {log.tipe.replace("_", " ")}
                        </span>
                        {log.late_minutes && log.late_minutes > 0 ? (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded">
                            Telat {log.late_minutes} menit
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-700 dark:text-slate-200">
                        {new Date(log.waktu_masuk.replace(' ', 'T')).toLocaleDateString("id-ID", {
                          weekday: "long",
                        })}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {new Date(log.waktu_masuk.replace(' ', 'T')).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-mono font-bold text-lg text-slate-800 dark:text-slate-100 tracking-tighter whitespace-nowrap">
                        {new Date(log.waktu_masuk.replace(' ', 'T')).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        <span className="text-[10px] text-slate-400 font-medium ml-1">
                          {new Date(log.waktu_masuk.replace(' ', 'T')).toLocaleTimeString("en-GB", {
                            second: "2-digit"
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {log.lat && log.lng ? (
                        <div className="flex flex-col gap-1.5">
                          <a
                            href={`https://www.google.com/maps?q=${log.lat},${log.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-blue-600 hover:underline font-bold text-[11px]"
                          >
                            <MapPin className="w-3 h-3" /> Lihat Peta
                          </a>
                          {(() => {
                            const emp = employeesMap.get(log.nip);
                            const dept = departments.find(
                              (d) => d.id === emp?.departemen_id,
                            );
                            const targetLat = dept?.lat || company?.office_lat;
                            const targetLng = dept?.lng || company?.office_lng;
                            const targetRadius =
                              dept?.radius || company?.office_radius || 100;

                            if (targetLat && targetLng) {
                              const dist = calculateDistance(
                                log.lat!,
                                log.lng!,
                                targetLat,
                                targetLng,
                              );
                              const isWithin = dist <= targetRadius;
                              return (
                                <span
                                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border w-fit ${isWithin ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"}`}
                                >
                                  {isWithin
                                    ? "OK (Dalam Radius)"
                                    : `Luar Area (${Math.round(dist)}m)`}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium">
                          <Navigation className="w-3 h-3 opacity-30" /> No GPS
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {log.image ? (
                          <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm">
                            <img
                              src={
                                log.image.startsWith("data:image") ||
                                log.image.startsWith("http")
                                  ? log.image
                                  : `data:image/jpeg;base64,${log.image}`
                              }
                              alt="Verify"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                        )}
                        <span className="font-bold text-slate-600 dark:text-slate-300 text-[11px]">
                          {log.keterangan === 'Mesin Absensi' ? 'Mesin ADMS' : (log.image ? "Wajah (AI)" : "Manual")}
                        </span>
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
          {loading && logs.length === 0 ? (
            <div className="px-5 py-20 text-center bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 font-bold text-sm">Memuat data...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="px-5 py-20 text-center bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Database className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                Tidak ada data absensi.
              </p>
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={`mobile-log-${log.id || index}`}
                className="p-5 space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-extrabold text-slate-800 dark:text-slate-100 text-sm tracking-tight">
                      {log.nama || employeesMap.get(log.nip)?.nama || "-"}
                    </p>
                    <p className="font-mono text-[10px] font-bold text-slate-400 mt-0.5">
                      {log.nip}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border ${getStatusColor(log.tipe)}`}
                  >
                    {log.tipe.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Waktu
                    </p>
                    <p className="font-mono text-sm font-black text-slate-800 dark:text-slate-100">
                      {new Date(log.waktu_masuk.replace(' ', 'T')).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                      {new Date(log.waktu_masuk.replace(' ', 'T')).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Verifikasi
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {log.image ? (
                        <img
                          src={
                            log.image.startsWith("data:image") ||
                            log.image.startsWith("http")
                              ? log.image
                              : `data:image/jpeg;base64,${log.image}`
                          }
                          alt="Verify"
                          className="w-6 h-6 rounded-md object-cover border border-slate-200 shadow-sm"
                        />
                      ) : (
                        <User className="w-6 h-6 text-slate-300" />
                      )}
                      <span className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-300 tracking-tight">
                        {log.keterangan === 'Mesin Absensi' ? 'MESIN ADMS' : (log.image ? "WAJAH AI" : "MANUAL")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  {log.lat && log.lng ? (
                    <a
                      href={`https://www.google.com/maps?q=${log.lat},${log.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-blue-600 hover:underline font-bold text-[10px] bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-xl border border-blue-100 dark:border-blue-500/20 shadow-sm"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Buka Peta
                    </a>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">
                      Lokasi tidak tersedia
                    </span>
                  )}

                  <div
                    className="flex gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => updateRecordStatus(log.id!, "MASUK")}
                      className="p-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl shadow-sm"
                    >
                      <UserCheck className="w-4 h-4" />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenMenuId(openMenuId === log.id ? null : log.id)
                        }
                        className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 shadow-sm"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {openMenuId === log.id && (
                        <div className="fixed right-4 bottom-24 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-300 dark:border-slate-700 z-[100] py-1.5 overflow-hidden transition-all shadow-black/20">
                          <button
                            onClick={() =>
                              updateRecordStatus(log.id!, "PULANG")
                            }
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 border-b border-slate-50 dark:border-slate-800/50"
                          >
                            Set Pulang
                          </button>
                          <button
                            onClick={() =>
                              updateRecordStatus(log.id!, "LEMBUR_MASUK")
                            }
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 border-b border-slate-50 dark:border-slate-800/50"
                          >
                            Set Lembur Msk
                          </button>
                          <button
                            onClick={() =>
                              updateRecordStatus(log.id!, "LEMBUR_KELUAR")
                            }
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 text-[11px] font-bold"
                          >
                            Set Lembur Klr
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Footer */}
        <div className="p-5 md:p-8 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-950/20">
          <div className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            Menampilkan{" "}
            <span className="text-slate-900 dark:text-white">
              {logs.length}
            </span>{" "}
            dari{" "}
            <span className="text-slate-900 dark:text-white">{totalCount}</span>{" "}
            data
          </div>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 disabled:opacity-30 active:scale-90 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex gap-1">
              {[...Array(Math.min(5, Math.ceil(totalCount / pageSize)))].map(
                (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${page === i + 1 ? "bg-blue-600 text-white shadow-lg shadow-blue-500/40" : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-500 hover:bg-slate-50"}`}
                  >
                    {i + 1}
                  </button>
                ),
              )}
            </div>
            <button
              disabled={page >= Math.ceil(totalCount / pageSize)}
              onClick={() => setPage(page + 1)}
              className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 disabled:opacity-30 active:scale-90 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Manual Entry Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Tambah Presensi Manual</h3>
                <p className="text-xs text-slate-500 font-medium">Input kehadiran karyawan manual.</p>
              </div>
              <button onClick={() => setIsManualModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Karyawan</label>
                <select 
                  value={manualFormData.nip}
                  onChange={(e) => setManualFormData({...manualFormData, nip: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                >
                  <option value="">Pilih Karyawan</option>
                  {employees.map(e => (
                    <option key={e.nip} value={e.nip}>{e.nama} ({e.nip})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipe Absen</label>
                  <select 
                    value={manualFormData.tipe}
                    onChange={(e) => setManualFormData({...manualFormData, tipe: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="MASUK">MASUK</option>
                    <option value="PULANG">PULANG</option>
                    <option value="KELUAR">KELUAR (Istirahat)</option>
                    <option value="KEMBALI">KEMBALI (Istirahat)</option>
                    <option value="LEMBUR_MASUK">LEMBUR MASUK</option>
                    <option value="LEMBUR_KELUAR">LEMBUR KELUAR</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Waktu</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="datetime-local"
                      value={manualFormData.waktu}
                      onChange={(e) => setManualFormData({...manualFormData, waktu: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 pl-11 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Keterangan</label>
                <textarea 
                  value={manualFormData.keterangan}
                  onChange={(e) => setManualFormData({...manualFormData, keterangan: e.target.value})}
                  placeholder="Contoh: Lupa absen, HP Rusak, dsb."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none h-24 resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setIsManualModalOpen(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-3 rounded-2xl font-bold hover:bg-slate-200 transition"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveManual}
                  disabled={savingManual}
                  className="flex-3 bg-blue-600 text-white py-3 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {savingManual ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  Simpan Absensi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

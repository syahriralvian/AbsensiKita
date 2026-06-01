import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
  User,
  Company,
  Attendance,
  Department,
  Shift,
  Cycle,
} from "../../types";
import {
  Download,
  Calendar,
  ArrowLeft,
  Loader2,
  FileSpreadsheet,
  Wallet,
  ScanFace,
  ChevronRight,
  FileText,
  RefreshCcw,
} from "lucide-react";
import { exportToExcel, exportToPDF, exportPayslipPDF } from "../../lib/export";
import {
  checkIsDayOff,
  toLocalDateString,
  getShiftForDate,
  evaluateAttendanceStatus,
  calculateLateMinutes,
} from "../../lib/utils";
import { toast } from "sonner";

interface PayrollTabProps {
  companyInfo: Company | null;
  user: User;
  activeCompanyId: string;
  employees: User[];
  departments: Department[];
  shifts: Shift[];
  cycles: Cycle[];
}

export default function PayrollTab({
  companyInfo,
  user,
  activeCompanyId,
  employees,
  departments,
  shifts,
  cycles,
}: PayrollTabProps) {
  const [loading, setLoading] = useState(false);
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Set default range to current month
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return toLocalDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  });

  useEffect(() => {
    setPayrollData([]);
  }, [activeCompanyId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const isDayOff = (dateObj: Date, deptId?: number) => {
    return checkIsDayOff(dateObj, deptId, departments, cycles);
  };

  const generatePayroll = async () => {
    setLoading(true);
    try {
      const start = new Date(`${startDate}T00:00:00`).toISOString();
      const end = new Date(`${endDate}T23:59:59.999`).toISOString();

      const [{ data, error }, { data: holidayData }, { data: matrixData }] =
        await Promise.all([
          supabase
            .from("absensi")
            .select("*")
            .eq("company_id", activeCompanyId)
            .gte("waktu_masuk", start)
            .lte("waktu_masuk", end)
            .order("waktu_masuk", { ascending: true }),
          supabase
            .from("hari_libur")
            .select("*")
            .eq("company_id", activeCompanyId),
          supabase
            .from("overtime_matrix")
            .select("*")
            .eq("company_id", activeCompanyId),
        ]);

      if (error) throw error;
      const holidays = holidayData || [];
      const matrix = matrixData || [
        { tipe_hari: "KERJA", jam_ke: 1, pengali: 1.5 },
        { tipe_hari: "KERJA", jam_ke: 2, pengali: 2.0 },
        { tipe_hari: "LIBUR", jam_ke: 1, pengali: 2.0 },
        { tipe_hari: "LIBUR", jam_ke: 8, pengali: 3.0 },
        { tipe_hari: "LIBUR", jam_ke: 9, pengali: 4.0 },
      ];

      const calculateOTWeightedHours = (
        hours: number,
        tipe: "KERJA" | "LIBUR",
      ) => {
        if (hours <= 0) return 0;
        const matchingRules = matrix
          .filter((m) => m.tipe_hari === tipe)
          .sort((a: any, b: any) => a.jam_ke - b.jam_ke);

        if (matchingRules.length === 0) return hours;

        let totalWeighted = 0;
        for (let h = 1; h <= Math.ceil(hours); h++) {
          const actualH = h > hours ? hours - (h - 1) : 1;
          const rule =
            [...matchingRules].reverse().find((r: any) => r.jam_ke <= h) ||
            matchingRules[0];
          if (rule) {
            totalWeighted += actualH * rule.pengali;
          }
        }
        return totalWeighted;
      };

      const payrollMap: Record<string, any> = {};
      if (employees && employees.length > 0) {
        employees.forEach((e) => {
          payrollMap[e.nip] = {
            nip: e.nip,
            nama: e.nama,
            foto: e.foto_wajah_base64,
            gaji_pokok: e.gaji_pokok || 0,
            tunjangan: e.tunjangan || 0,
            uang_makan_per_hari: e.uang_makan || 0,
            potongan_per_alpha: e.potongan || 0,
            denda_telat_per_hari: e.denda_telat || 0,
            bonus_lembur_per_jam: e.bonus_lembur || 0,
            departemen_id: e.departemen_id,
            hadir: 0,
            izin: 0,
            telat: 0,
            alpha: 0,
            totalJkm: 0,
            totalOT: 0,
            totalBonus: 0,
            setengah_hari: 0,
            processedDates: new Set(),
            daily: {},
          };
        });
      }

      const startD = new Date(`${startDate}T00:00:00`);
      const endD = new Date(`${endDate}T00:00:00`);
      const daysDiff =
        Math.round(
          (endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;

      (data || []).forEach((log) => {
        if (!payrollMap[log.nip]) return;
        const dateStr = log.waktu_masuk.split("T")[0];
        const dayNumStr = dateStr.replace(/-/g, "_");
        const rec = payrollMap[log.nip];

        if (!rec.daily[dayNumStr])
          rec.daily[dayNumStr] = { masukDate: null, ctx: [] };
        rec.daily[dayNumStr].ctx.push(log);

        if (
          ["IJIN", "SAKIT", "CUTI", "LUPA_ABSEN"].includes(log.tipe) &&
          Number(log.status_acc) === 1
        ) {
          rec.processedDates.add(dateStr);
        }

        if (log.tipe === "MASUK") {
          rec.daily[dayNumStr].masukDate = new Date(
            log.waktu_masuk.replace(" ", "T"),
          );
        }
      });

      const results: any[] = [];
      Object.keys(payrollMap).forEach((nip) => {
        const rec = payrollMap[nip];

        let countKerja = 0;
        let countLibur = 0;

        for (let i = 0; i < daysDiff; i++) {
          const current = new Date(startD);
          current.setDate(startD.getDate() + i);
          const dateStrChar = toLocalDateString(current);
          const holidayOnDate = holidays.find((h) => h.tanggal === dateStrChar);
          const isWeekend = isDayOff(current, rec.departemen_id);
          const isDayOffActual = isWeekend || !!holidayOnDate;

          if (!isDayOffActual) {
            countKerja++;
            // Check log status on this work day
            const dayNumStr = dateStrChar.replace(/-/g, "_");
            const dayData = rec.daily[dayNumStr];
            const logs = dayData && dayData.ctx ? dayData.ctx : [];
            const isIzin = rec.processedDates.has(dateStrChar);

            if (isIzin) {
              rec.izin++;
            } else {
              const masukLog = logs.find((l: any) => l.tipe === "MASUK");
              const pPulang = logs.find((l: any) =>
                ["PULANG", "KELUAR", "LEMBUR_KELUAR"].includes(l.tipe),
              );

              const activeShiftOnDate = getShiftForDate(
                current,
                rec.departemen_id,
                departments,
                cycles,
                shifts,
              );

              if (masukLog && activeShiftOnDate) {
                  if (!masukLog.late_minutes_recalculated) {
                     masukLog.late_minutes = calculateLateMinutes(masukLog, activeShiftOnDate);
                     masukLog.late_minutes_recalculated = true;
                  }
              }

              const st = evaluateAttendanceStatus(
                masukLog,
                pPulang,
                activeShiftOnDate,
                companyInfo,
              );

              if (st.isHadir) rec.hadir += 1;
              else if (st.isSetengahHari) {
                rec.hadir += 0.5;
                rec.setengah_hari++;
              }

              if (st.isTelat) rec.telat++;
              if (st.isAlpha) rec.alpha++;
            }
          } else countLibur++;

          // Check if user worked on this day off
          const dayNumStr = dateStrChar.replace(/-/g, "_");
          const dayData = rec.daily[dayNumStr];
          if (dayData && dayData.ctx && dayData.ctx.length > 0) {
            const logs = dayData.ctx;
            const masukLog = logs.find((l: any) => l.tipe === "MASUK");
            const pulangLog = [...logs]
              .reverse()
              .find((l: any) =>
                ["PULANG", "KELUAR", "LEMBUR_KELUAR"].includes(l.tipe),
              );

            if (masukLog && pulangLog) {
              const mDate = new Date(masukLog.waktu_masuk.replace(" ", "T"));
              const pDate = new Date(pulangLog.waktu_masuk.replace(" ", "T"));
              const durationHours = Math.max(
                0,
                (pDate.getTime() - mDate.getTime()) / (1000 * 60 * 60),
              );

              if (isDayOffActual) {
                // Holiday Overtime
                rec.totalOT += durationHours;
                rec.totalBonus +=
                  calculateOTWeightedHours(durationHours, "LIBUR") *
                  rec.bonus_lembur_per_jam;
              } else {
                // Workday Overtime (needs to check if it exceeds shift hours)
                // For now, let's look for explicit LEMBUR logs or if it's > 9 hours
                const lemburLogs = logs.filter((l: any) =>
                  l.tipe.startsWith("LEMBUR"),
                );
                if (lemburLogs.length > 0 || durationHours > 9) {
                  const otHours =
                    lemburLogs.length > 0
                      ? durationHours
                      : Math.max(0, durationHours - 9);
                  rec.totalOT += otHours;
                  rec.totalBonus +=
                    calculateOTWeightedHours(otHours, "KERJA") *
                    rec.bonus_lembur_per_jam;
                }
              }
            }
          }
        }

        // Perhitungan Alpha dan Setengah Hari sudah diproses di dalam loop harian di atas

        const totalUangMakan = rec.hadir * rec.uang_makan_per_hari;
        // Potongan dihitung 100% untuk alpha, dan 50% untuk setengah hari
        const totalPotongan =
          rec.alpha * rec.potongan_per_alpha +
          rec.setengah_hari * (rec.potongan_per_alpha / 2);
        const totalDenda = rec.telat * rec.denda_telat_per_hari;

        const gajiBersih =
          rec.gaji_pokok +
          rec.tunjangan +
          totalUangMakan +
          rec.totalBonus -
          (totalPotongan + totalDenda);

        rec.totalUangMakan = totalUangMakan;
        rec.totalPotongan = totalPotongan;
        rec.totalDenda = totalDenda;
        rec.gajiBersih = Math.max(0, gajiBersih); // Prevents negative salary

        results.push(rec);
      });

      setPayrollData(results.sort((a, b) => a.nama.localeCompare(b.nama)));
    } catch (e) {
      console.error(e);
      alert("Gagal menarik data");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (payrollData.length === 0) return;
    const data = payrollData.map((d) => ({
      nip: d.nip,
      nama: d.nama,
      gaji_pokok: d.gaji_pokok,
      tunjangan: d.tunjangan,
      hadir: `${d.hadir} Hari`,
      totalUangMakan: d.totalUangMakan,
      telat: `${d.telat} Kali`,
      totalDenda: d.totalDenda,
      alpha: `${d.alpha} Hari`,
      totalPotongan: d.totalPotongan,
      totalOT: d.totalOT ? parseFloat(d.totalOT.toFixed(2)) : 0,
      totalBonus: d.totalBonus,
      setengah_hari: `${d.setengah_hari} Hari`,
      gajiBersih: d.gajiBersih,
    }));
    const columns = [
      { header: "NIP", key: "nip" },
      { header: "Nama Karyawan", key: "nama" },
      { header: "Gaji Pokok", key: "gaji_pokok" },
      { header: "Tunjangan", key: "tunjangan" },
      { header: "Kehadiran", key: "hadir" },
      { header: "Total Uang Makan", key: "totalUangMakan" },
      { header: "Telat", key: "telat" },
      { header: "Denda Telat", key: "totalDenda" },
      { header: "Alpha", key: "alpha" },
      { header: "Setengah Hari", key: "setengah_hari" },
      { header: "Potongan", key: "totalPotongan" },
      { header: "Lembur (Jam)", key: "totalOT" },
      { header: "Bonus Lembur", key: "totalBonus" },
      { header: "Gaji Bersih", key: "gajiBersih" },
    ];

    exportToExcel(data, columns, `Payroll_${startDate}_to_${endDate}`);
    setShowExportMenu(false);
  };

  return (
    <div
      className="space-y-6 max-w-7xl mx-auto relative pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500"
      onClick={() => setShowExportMenu(false)}
    >
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800/60">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2 sm:gap-3">
            <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500" />
            Laporan Payroll
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 text-xs sm:text-sm font-medium">
            Buat laporan penggajian karyawan berdasarkan periode absensi.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto mt-2 xl:mt-0">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full md:w-auto bg-slate-50 dark:bg-slate-950 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 px-1 sm:px-3 w-full sm:w-auto justify-between sm:justify-start">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none outline-none text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer min-w-0 flex-1 sm:flex-none"
              />
              <span className="text-slate-400 text-[9px] sm:text-[10px] font-bold shrink-0 px-2 bg-slate-200/50 dark:bg-slate-800 rounded-lg py-1">
                S/D
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none outline-none text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer min-w-0 text-right sm:text-left flex-1 sm:flex-none"
              />
            </div>
          </div>

          <button
            onClick={generatePayroll}
            disabled={loading}
            className="w-full md:w-auto bg-blue-600 text-white px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl hover:bg-blue-700 transition font-bold disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-blue-500/20 text-xs sm:text-sm uppercase tracking-wider"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Buat Laporan"
            )}
          </button>
          <button
            onClick={() => {
              if (!loading) {
                toast.loading("Memuat ulang & kalkulasi perhitungan payroll...", { id: "recalc" });
                setTimeout(() => {
                  toast.success("Kalkulasi ulang selesai didasarkan pada pengaturan terbaru.", { id: "recalc" });
                  generatePayroll();
                }, 1500);
              }
            }}
            disabled={loading}
            className="w-full md:w-auto bg-amber-500 text-white px-4 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl hover:bg-amber-600 transition font-bold disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-amber-500/20 text-xs sm:text-sm uppercase tracking-wider"
          >
            <RefreshCcw className="w-4 h-4" /> Kalkulasi Ulang
          </button>
        </div>
      </div>

      {payrollData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base sm:text-lg">
                Hasil Payroll
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                {startDate} s/d {endDate}
              </p>
            </div>

            <div className="relative w-full sm:w-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExportMenu(!showExportMenu);
                }}
                className="w-full sm:w-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 sm:px-5 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2 font-bold shadow-sm text-xs sm:text-sm uppercase tracking-wider sm:tracking-normal"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5" /> Export Data
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-full sm:w-48 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-20 animate-in fade-in slide-in-from-top-2">
                  <button
                    onClick={handleExportExcel}
                    className="w-full text-left px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center gap-2 transition-colors border-b border-slate-100 dark:border-slate-700"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Export ke Excel
                  </button>
                  <button
                    onClick={() => {
                      const header = [
                        "NIP",
                        "Karyawan",
                        "Gaji Pokok",
                        "Tunjangan",
                        "Kehadiran",
                        "U. Makan",
                        "Telat",
                        "D. Telat",
                        "Alpha",
                        "1/2 Hari",
                        "Potongan",
                        "Lembur",
                        "B. Lembur",
                        "Gaji Bersih",
                      ];
                      const rows = payrollData.map((d) => [
                        d.nip,
                        d.nama,
                        formatCurrency(d.gaji_pokok),
                        formatCurrency(d.tunjangan),
                        `${d.hadir} Hari`,
                        formatCurrency(d.totalUangMakan),
                        `${d.telat} Kali`,
                        formatCurrency(d.totalDenda),
                        `${d.alpha} Hari`,
                        `${d.setengah_hari} Hari`,
                        formatCurrency(d.totalPotongan),
                        d.totalOT ? d.totalOT.toFixed(2) : "0",
                        formatCurrency(d.totalBonus),
                        formatCurrency(d.gajiBersih),
                      ]);
                      exportToPDF(
                        "Laporan Payroll Karyawan",
                        header,
                        rows,
                        `Laporan_Payroll_${startDate}_to_${endDate}`,
                        `Periode: ${startDate} s/d ${endDate}\nPerusahaan: ${companyInfo?.nama_perusahaan}`,
                      );
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 font-bold text-sm flex items-center gap-2 transition-colors"
                  >
                    <FileText className="w-4 h-4" /> Export ke PDF
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto pb-4 custom-scrollbar">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-bold md:sticky left-0 z-10 bg-slate-50 dark:bg-slate-900 shadow-[1px_0_0_0_#f1f5f9] dark:shadow-[1px_0_0_0_#1e293b]">
                    Karyawan
                  </th>
                  <th className="px-6 py-4 font-bold text-right text-emerald-600 dark:text-emerald-400 min-w-[180px]">
                    Gaji Pokok / Tunjangan
                  </th>
                  <th className="px-6 py-4 font-bold text-center min-w-[180px]">
                    Kehadiran / Uang Makan
                  </th>
                  <th className="px-6 py-4 font-bold text-center text-red-600 dark:text-red-400 min-w-[180px]">
                    Keterlambatan / Denda
                  </th>
                  <th className="px-6 py-4 font-bold text-center text-red-600 dark:text-red-400 min-w-[150px]">
                    Alpha/½ Hari/Potongan
                  </th>
                  <th className="px-6 py-4 font-bold text-center text-blue-600 dark:text-blue-400 min-w-[150px]">
                    Lembur / Bonus
                  </th>
                  <th className="px-6 py-4 font-bold text-right text-emerald-600 dark:text-emerald-400 md:sticky right-0 z-10 bg-slate-50 dark:bg-slate-900 shadow-[-1px_0_0_0_#f1f5f9] dark:shadow-[-1px_0_0_0_#1e293b] min-w-[180px]">
                    Total Gaji Bersih
                  </th>
                  <th className="px-6 py-4 font-bold text-center bg-slate-50 dark:bg-slate-900 w-[100px]">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                {payrollData.map((d, i) => (
                  <tr
                    key={i}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4 md:sticky left-0 z-10 bg-white dark:bg-slate-900 md:shadow-[1px_0_0_0_#f1f5f9] md:dark:shadow-[1px_0_0_0_#1e293b]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                          {d.foto ? (
                            <img
                              src={
                                d.foto.startsWith("data:image")
                                  ? d.foto
                                  : `data:image/jpeg;base64,${d.foto}`
                              }
                              alt="profil"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ScanFace className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {d.nama}
                          </div>
                          <div className="text-xs text-slate-400">{d.nip}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-slate-800 dark:text-slate-100">
                        {formatCurrency(d.gaji_pokok)}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        + {formatCurrency(d.tunjangan)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="font-bold text-slate-800 dark:text-slate-100">
                        {d.hadir} Hari
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        + {formatCurrency(d.totalUangMakan)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="font-bold text-red-600 dark:text-red-400">
                        {d.telat} Kali
                      </div>
                      <div className="text-xs text-red-400 font-medium">
                        - {formatCurrency(d.totalDenda)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="font-bold text-red-600 dark:text-red-400">
                        {d.alpha > 0 ? `${d.alpha} Alpha` : ""}
                        {d.alpha > 0 && d.setengah_hari > 0 ? " & " : ""}
                        {d.setengah_hari > 0
                          ? `${d.setengah_hari} ½ Hari`
                          : d.alpha === 0
                            ? "0 Hari"
                            : ""}
                      </div>
                      <div className="text-xs text-red-400 font-medium">
                        - {formatCurrency(d.totalPotongan)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="font-bold text-blue-600 dark:text-blue-400">
                        {d.totalOT ? parseFloat(d.totalOT.toFixed(2)) : 0} Jam
                      </div>
                      <div className="text-xs text-blue-400 font-medium">
                        + {formatCurrency(d.totalBonus)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right md:sticky right-0 z-10 bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800/60 md:shadow-[-1px_0_0_0_#f1f5f9] md:dark:shadow-[-1px_0_0_0_#1e293b]">
                      <div className="font-black text-lg text-emerald-600 dark:text-emerald-400 tracking-tight">
                        {formatCurrency(d.gajiBersih)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => exportPayslipPDF(d, companyInfo?.nama_perusahaan || "", `${startDate} s/d ${endDate}`, `Slip_Gaji_${d.nip}_${startDate}`)}
                        className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        title="Cetak Slip Gaji"
                      >
                        <FileText className="w-5 h-5 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

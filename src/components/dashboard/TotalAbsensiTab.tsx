import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { User, Attendance, Shift, Holiday } from "../../types";
import {
  Download,
  Calendar,
  ArrowLeft,
  Loader2,
  FileText,
  FileSpreadsheet,
  ScanFace,
  RefreshCcw,
} from "lucide-react";
import { exportToExcel, exportToPDF } from "../../lib/export";
import {
  toLocalISOString,
  checkIsDayOff,
  toLocalDateString,
  getShiftForDate,
  calculateOvertimeIndex,
  evaluateAttendanceStatus,
  calculateLateMinutes,
} from "../../lib/utils";
import { toast } from "sonner";

interface TotalAbsensiTabProps {
  companyId: string;
}

export default function TotalAbsensiTab({ companyId }: TotalAbsensiTabProps) {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [breaks, setBreaks] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [reportRekapData, setReportRekapData] = useState<any[]>([]);
  const [overtimeMatrix, setOvertimeMatrix] = useState<any[]>([]);

  const getLocalMonthRange = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const pad = (n: number) => n.toString().padStart(2, "0");

    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);

    return {
      startStr: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      endStr: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    };
  };

  const defaultRange = getLocalMonthRange();
  const [startDate, setStartDate] = useState(defaultRange.startStr);
  const [endDate, setEndDate] = useState(defaultRange.endStr);

  const [companySettings, setCompanySettings] = useState<any>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    setReportRekapData([]);
    fetchEmployees();
    fetchCompanySettings();
    fetchDepsAndCycles();
  }, [companyId]);

  const fetchDepsAndCycles = async () => {
    const [
      { data: depts },
      { data: siks },
      { data: shfs },
      { data: brks },
      { data: hls },
      { data: matrix },
    ] = await Promise.all([
      supabase.from("departemen").select("*").eq("company_id", companyId),
      supabase.from("siklus_shift").select("*").eq("company_id", companyId),
      supabase.from("shifts").select("*").eq("company_id", companyId),
      supabase.from("jam_break").select("*").eq("company_id", companyId),
      supabase.from("hari_libur").select("*").eq("company_id", companyId),
      supabase.from("overtime_matrix").select("*").eq("company_id", companyId),
    ]);
    if (depts) setDepartments(depts);
    if (siks) setCycles(siks);
    if (shfs) setShifts(shfs);
    if (brks) setBreaks(brks);
    if (hls) setHolidays(hls);
    if (matrix) setOvertimeMatrix(matrix);
  };

  const fetchCompanySettings = async () => {
    try {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("company_id", companyId)
        .single();
      if (data) setCompanySettings(data);
    } catch (e) {
      console.error("Failed to load company settings", e);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data: emps } = await supabase
        .from("karyawan")
        .select("*")
        .eq("company_id", companyId)
        .neq("role", "OWNER");

      if (emps) setEmployees(emps);
    } catch (e) {
      console.error(e);
    }
  };

  const generateReportRekap = async () => {
    setLoading(true);
    try {
      const start = toLocalISOString(new Date(`${startDate}T00:00:00`));
      const end = toLocalISOString(new Date(`${endDate}T23:59:59.999`));

      const { data, error } = await supabase
        .from("absensi")
        .select("*")
        .eq("company_id", companyId)
        .gte("waktu_masuk", start)
        .lte("waktu_masuk", end)
        .order("waktu_masuk", { ascending: true });

      if (error) throw error;

      const rekapMap: Record<string, any> = {};
      if (employees && employees.length > 0) {
        employees.forEach((e) => {
          rekapMap[e.nip] = {
            nip: e.nip,
            nama: e.nama,
            foto: e.foto_wajah_base64,
            departemen_id: e.departemen_id,
            hadir: 0,
            izin: 0,
            telat: 0,
            early: 0,
            lembur: 0,
            jamHd: 0,
            jamOT: 0,
            breakTime: 0,
            processedDates: new Set(),
            daily: {},
          };
        });
      }

      const isDayOff = (dateObj: Date, deptId?: number) => {
        return checkIsDayOff(dateObj, deptId, departments, cycles);
      };

      const getShift = (dateObj: Date, deptId?: number) => {
        return getShiftForDate(dateObj, deptId, departments, cycles, shifts);
      };

      const timeToMinutes = (timeStr: string | undefined): number => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
      };

      const startD = new Date(`${startDate}T00:00:00`);
      const endD = new Date(`${endDate}T00:00:00`);
      const daysDiff =
        Math.round(
          (endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;

      const sortedData = (data || []).sort(
        (a, b) =>
          new Date(a.waktu_masuk.replace(" ", "T")).getTime() -
          new Date(b.waktu_masuk.replace(" ", "T")).getTime(),
      );

      const logsByNip = new Map<string, typeof sortedData>();
      sortedData.forEach(log => {
        if (!logsByNip.has(log.nip)) logsByNip.set(log.nip, []);
        logsByNip.get(log.nip)!.push(log);
      });

      employees.forEach((emp) => {
        const empLogs = logsByNip.get(emp.nip) || [];
        const rec = rekapMap[emp.nip];
        if (!rec) return;

        for (let i = 0; i < daysDiff; i++) {
          const current = new Date(startD);
          current.setDate(startD.getDate() + i);
          const dateStr = toLocalDateString(current);
          const dayNumStr = dateStr.replace(/-/g, "_");

          const isRecordOnDate = (dateString: string) => {
            const localDate = new Date(dateString);
            const yyyy = localDate.getFullYear();
            const mm = String(localDate.getMonth() + 1).padStart(2, "0");
            const dd = String(localDate.getDate()).padStart(2, "0");
            return `${yyyy}-${mm}-${dd}` === dateStr;
          };

          const tipes: string[] = [];
          empLogs.forEach((log) => {
            if (isRecordOnDate(log.waktu_masuk)) {
              tipes.push(log.tipe);
              if (
                ["IJIN", "SAKIT", "CUTI", "LUPA_ABSEN"].includes(log.tipe) &&
                Number(log.status_acc) === 1
              ) {
                if (!rec.processedDates.has(dateStr)) {
                  rec.izin++;
                  rec.processedDates.add(dateStr);
                }
              }
            }
          });

          const activeShiftOnDate = getShift(current, rec.departemen_id);
          const ruleOnDate = activeShiftOnDate?.rule || 4;

          let pMasuk: any = null;
          let pPulang = null;

          if (ruleOnDate === 4) {
            const allLogsToday = empLogs.filter(
              (a) =>
                isRecordOnDate(a.waktu_masuk) &&
                ![
                  "CUTI",
                  "SAKIT",
                  "IJIN",
                  "LUPA_ABSEN",
                  "KEMBALI",
                  "KELUAR",
                ].includes(a.tipe),
            );
            if (allLogsToday.length > 0) {
              const sorted = [...allLogsToday].sort(
                (a, b) =>
                  new Date(a.waktu_masuk.replace(" ", "T")).getTime() -
                  new Date(b.waktu_masuk.replace(" ", "T")).getTime(),
              );
              pMasuk = sorted[0];
              if (sorted.length > 1) {
                pPulang = sorted[sorted.length - 1];
                if (!tipes.includes("PULANG")) tipes.push("PULANG");
              }
              if (!tipes.includes("MASUK")) tipes.push("MASUK");
            }
          } else {
            pMasuk = empLogs.find(
              (a) => a.tipe === "MASUK" && isRecordOnDate(a.waktu_masuk),
            );
            if (pMasuk) {
              pPulang = [...empLogs]
                .reverse()
                .find(
                  (a) =>
                    typeof a.tipe === "string" &&
                    a.tipe.includes("PULANG") &&
                    !a.tipe.includes("LEMBUR") &&
                    new Date(a.waktu_masuk.replace(" ", "T")).getTime() >
                      new Date(
                        pMasuk.waktu_masuk.replace(" ", "T"),
                      ).getTime() &&
                    new Date(a.waktu_masuk.replace(" ", "T")).getTime() -
                      new Date(
                        pMasuk.waktu_masuk.replace(" ", "T"),
                      ).getTime() <=
                      24 * 60 * 60 * 1000,
                );
            } else {
              const pulangToday = empLogs.find(
                (a) =>
                  typeof a.tipe === "string" &&
                  a.tipe.includes("PULANG") &&
                  !a.tipe.includes("LEMBUR") &&
                  isRecordOnDate(a.waktu_masuk),
              );
              if (pulangToday) {
                const prevDate = new Date(
                  current.getTime() - 24 * 60 * 60 * 1000,
                );
                const prevDateStr = toLocalDateString(prevDate);
                const isRecordOnPrev = (ds: string) => {
                  const ld = new Date(ds);
                  return (
                    `${ld.getFullYear()}-${String(ld.getMonth() + 1).padStart(2, "0")}-${String(ld.getDate()).padStart(2, "0")}` ===
                    prevDateStr
                  );
                };
                const prevMasuk = empLogs.find(
                  (a) => a.tipe === "MASUK" && isRecordOnPrev(a.waktu_masuk),
                );
                if (
                  !(
                    prevMasuk &&
                    new Date(
                      pulangToday.waktu_masuk.replace(" ", "T"),
                    ).getTime() -
                      new Date(
                        prevMasuk.waktu_masuk.replace(" ", "T"),
                      ).getTime() <=
                      24 * 60 * 60 * 1000
                  )
                ) {
                  pPulang = pulangToday;
                  if (!tipes.includes(pulangToday.tipe))
                    tipes.push(pulangToday.tipe);
                }
              }
            }
          }

          const ltMasuk = empLogs.find(
            (a) => a.tipe === "LEMBUR_MASUK" && isRecordOnDate(a.waktu_masuk),
          );
          let ltPulang = null;
          if (ltMasuk) {
            ltPulang = [...empLogs]
              .reverse()
              .find(
                (a) =>
                  typeof a.tipe === "string" &&
                  a.tipe.includes("LEMBUR_KELUAR") &&
                  new Date(a.waktu_masuk.replace(" ", "T")).getTime() >
                    new Date(ltMasuk.waktu_masuk.replace(" ", "T")).getTime() &&
                  new Date(a.waktu_masuk.replace(" ", "T")).getTime() -
                    new Date(ltMasuk.waktu_masuk.replace(" ", "T")).getTime() <=
                    24 * 60 * 60 * 1000,
              );
          }

          const isHoliday = holidays.some((h) => h.tanggal === dateStr);
          const isWeekend = !activeShiftOnDate;
          const isDayOff = isWeekend || isHoliday;

          if (isDayOff) {
            pMasuk = null;
            pPulang = null;
          }

          if (pMasuk && activeShiftOnDate) {
            if (!pMasuk.late_minutes) {
               pMasuk.late_minutes = calculateLateMinutes(pMasuk, activeShiftOnDate);
               pMasuk.late_minutes_recalculated = true;
            }
          }

          if ((pMasuk || pPulang) && !rec.processedDates.has(dateStr)) {
            const st = evaluateAttendanceStatus(
              pMasuk,
              pPulang,
              activeShiftOnDate,
              companySettings,
            );
            if (st.isHadir) rec.hadir += 1;
            else if (st.isSetengahHari) rec.hadir += 0.5;

            if (st.isTelat && ruleOnDate !== 2) rec.telat++;
            // Early is calculated later via early++, alpha doesn't add to hadir.
            rec.processedDates.add(dateStr);
          }

          if (ltPulang) {
            rec.lembur++;
          }

          rec.daily[dayNumStr] = {
            tipes,
            masukDate: pMasuk
              ? new Date(pMasuk.waktu_masuk.replace(" ", "T"))
              : null,
            pulangDate: pPulang
              ? new Date(pPulang.waktu_masuk.replace(" ", "T"))
              : null,
            late_minutes: pMasuk?.late_minutes || 0,
            ltMasukDate: ltMasuk
              ? new Date(ltMasuk.waktu_masuk.replace(" ", "T"))
              : null,
            ltPulangDate: ltPulang
              ? new Date(ltPulang.waktu_masuk.replace(" ", "T"))
              : null,
          };
        }
      });

      Object.keys(rekapMap).forEach((nip) => {
        const rec = rekapMap[nip];

        // Calculate per-employee Kerja and Libur
        let countKerja = 0;
        let countLibur = 0;
        let sumJamHd = 0;
        let sumJamOT = 0;
        let totalAbsen = 0;

        for (let i = 0; i < daysDiff; i++) {
          const current = new Date(startD);
          current.setDate(startD.getDate() + i);
          const activeShift = getShift(current, rec.departemen_id);
          const isWeekend = !activeShift;
          const dateStr = toLocalDateString(current);
          const isHoliday = holidays.some((h) => h.tanggal === dateStr);
          const isDayOff = isWeekend || isHoliday;

          if (isDayOff) countLibur++;
          else countKerja++;

          const dayNumStr = dateStr.replace(/-/g, "_");
          const d = rec.daily[dayNumStr];

          const today = new Date();
          const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
          const pastNoonBoundary = dateStr < todayDateStr;

          if (d) {
            if (d.masukDate && d.pulangDate) {
              let diffMs = d.pulangDate.getTime() - d.masukDate.getTime();
              let diffMins = Math.floor(diffMs / 60000);

              // Apply Breaks
              let dayBreakReduction = 0;
              const pStartMins =
                d.masukDate.getHours() * 60 + d.masukDate.getMinutes();
              const pEndMins =
                d.pulangDate.getHours() * 60 + d.pulangDate.getMinutes();

              breaks.forEach((b) => {
                if (!b.is_mengurangi_jam_kerja) return;
                const bOut = timeToMinutes(b.jam_keluar);
                const bIn = timeToMinutes(b.jam_kembali);
                if (pStartMins <= bOut && pEndMins >= bIn) {
                  dayBreakReduction += b.durasi;
                }
              });

              if (dayBreakReduction > 0) {
                diffMins -= dayBreakReduction;
                rec.breakTime += dayBreakReduction;
              }

              if (diffMins < 0) diffMins = 0;
              if (isHoliday) {
                sumJamOT += calculateOvertimeIndex(
                  diffMins,
                  true,
                  overtimeMatrix,
                );
                rec.overT++;
              } else {
                sumJamHd += diffMins / 60;
              }

              const ruleOnDate = activeShift?.rule || 4;

              // Calculate Early Leave & Lembur Larut
              if (
                activeShift &&
                !activeShift.isAuto &&
                activeShift.jam_pulang
              ) {
                const shiftPulangMins = timeToMinutes(activeShift.jam_pulang);
                const actualPulangMins =
                  d.pulangDate.getHours() * 60 + d.pulangDate.getMinutes();
                const tolerance = activeShift.pulang_awal_tolerance || 0;
                if (actualPulangMins < shiftPulangMins - tolerance) {
                  rec.early++;
                }

                // Lembur Larut check
                const empDept = departments.find(
                  (dep) => dep.id === rec.departemen_id,
                );
                if (empDept && empDept.is_lembur_larut && !isHoliday) {
                  const menit_lembur = empDept.menit_lembur || 0;
                  if (actualPulangMins >= shiftPulangMins + menit_lembur) {
                    const lemburExtraMins = actualPulangMins - shiftPulangMins;
                    sumJamOT += calculateOvertimeIndex(
                      lemburExtraMins,
                      false,
                      overtimeMatrix,
                    );
                    rec.overT++;
                  }
                }
              }
            }
            if (d.ltMasukDate && d.ltPulangDate) {
              const diffMs = d.ltPulangDate.getTime() - d.ltMasukDate.getTime();
              const otMins = Math.floor(diffMs / 60000);
              sumJamOT += calculateOvertimeIndex(
                otMins,
                isHoliday,
                overtimeMatrix,
              );
            }
            const isSetengahHariRule =
              companySettings?.enable_half_day_rule ?? false;

            // Base condition for totally empty
            if (
              !d.masukDate &&
              !d.pulangDate &&
              !d.tipes.some((t: string) =>
                ["IJIN", "SAKIT", "CUTI", "LUPA_ABSEN"].includes(t),
              ) &&
              !isDayOff &&
              pastNoonBoundary
            ) {
              totalAbsen++;
            } else if (
              (d.masukDate || d.pulangDate) &&
              !isDayOff &&
              pastNoonBoundary
            ) {
              // Determine using rules
              const st = evaluateAttendanceStatus(
                d.masukDate
                  ? {
                      waktu_masuk: d.masukDate.toISOString(),
                      late_minutes: d.late_minutes,
                    }
                  : null,
                d.pulangDate
                  ? { waktu_masuk: d.pulangDate.toISOString() }
                  : null,
                activeShift,
                companySettings,
              );
              if (st.isAlpha) totalAbsen++;
            }
          } else {
            if (!isDayOff && pastNoonBoundary) {
              totalAbsen++;
            }
          }
        }

        rec.kerja = countKerja;
        rec.libur = countLibur;
        rec.jamHd = sumJamHd;
        rec.jamOT = sumJamOT;
        rec.absen = totalAbsen;
      });

      setReportRekapData(Object.values(rekapMap));
    } catch (e: any) {
      alert("Gagal rekap: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const syncToSheetsIfEnabled = async () => {
    if (companySettings?.gsheet_enabled && companySettings?.gsheet_url_total) {
      try {
        const title = `Total Absensi ${startDate} to ${endDate}`;

        let csvContent = "NIP,Nama,Kerja,Libur,Hadir,Absen,Ijin,Telat,OverT\n";
        reportRekapData.forEach((r) => {
          csvContent += `${r.nip},"${r.nama}",${r.kerja || 0},${r.libur || 0},${r.hadir},${r.absen || 0},${r.izin},${r.telat},${r.lembur}\n`;
        });

        await fetch(companySettings.gsheet_url_total, {
          method: "POST",
          body: JSON.stringify({ action: "export", title, csvContent }),
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          mode: "no-cors",
        });
      } catch (e) {
        console.error("Webhook failed:", e);
      }
    }
  };

  const handleExportExcel = async () => {
    setShowExportMenu(false);
    if (reportRekapData.length === 0)
      return alert("Proses Laporan Absensi terlebih dahulu!");

    await syncToSheetsIfEnabled();

    const data = reportRekapData.map((r) => ({
      nip: r.nip,
      nama: r.nama,
      foto: r.foto && r.foto !== "-" ? "Ada" : "-",
      kerja: r.kerja || 0,
      libur: r.libur || 0,
      hadir: r.hadir || 0,
      absen: r.absen || 0,
      ijin: r.izin || 0,
      telat: r.telat || 0,
      early: r.early || 0,
      breakTime: r.breakTime || 0,
      lembur: r.lembur || 0,
      jamHd: r.jamHd ? parseFloat(r.jamHd.toFixed(2)) : 0,
      jamOT: r.jamOT ? parseFloat(r.jamOT.toFixed(2)) : 0,
    }));

    const columns = [
      { header: "ID", key: "nip" },
      { header: "Nama", key: "nama" },
      { header: "Foto VL", key: "foto" },
      { header: "Kerja", key: "kerja" },
      { header: "Libur", key: "libur" },
      { header: "Hadir", key: "hadir" },
      { header: "Absen", key: "absen" },
      { header: "C.Ijin", key: "ijin" },
      { header: "Telat", key: "telat" },
      { header: "Early", key: "early" },
      { header: "Break", key: "breakTime" },
      { header: "OverT", key: "lembur" },
      { header: "JamHd", key: "jamHd" },
      { header: "JamOT", key: "jamOT" },
    ];

    exportToExcel(
      data,
      columns,
      `Total_Absensi_Kehadiran_${startDate}_to_${endDate}`,
    );
  };

  const handleExportPDF = async () => {
    setShowExportMenu(false);
    if (reportRekapData.length === 0)
      return alert("Proses Laporan Absensi terlebih dahulu!");

    await syncToSheetsIfEnabled();

    const headers = [
      "ID",
      "Nama",
      "Foto VL",
      "Kerja",
      "Libur",
      "Hadir",
      "Absen",
      "C.Ijin",
      "Telat",
      "Early",
      "Break",
      "OverT",
      "JamHd",
      "JamOT",
    ];
    const rows = reportRekapData.map((r) => [
      r.nip,
      r.nama,
      r.foto && r.foto !== "-" ? "Ada" : "-",
      (r.kerja || 0).toString(),
      (r.libur || 0).toString(),
      r.hadir.toString(),
      (r.absen || 0).toString(),
      r.izin.toString(),
      r.telat.toString(),
      (r.early || 0).toString(),
      (r.breakTime || 0).toString(),
      r.lembur.toString(),
      (r.jamHd ? parseFloat(r.jamHd.toFixed(2)) : 0).toString(),
      (r.jamOT ? parseFloat(r.jamOT.toFixed(2)) : 0).toString(),
    ]);

    exportToPDF(
      "Total Absensi Kehadiran",
      headers,
      rows,
      `Total_Absensi_Kehadiran_${startDate}_to_${endDate}`,
      `Periode: ${startDate} s/d ${endDate}\nDepart: ALL`,
    );
  };

  return (
    <div
      className="space-y-6 max-w-7xl mx-auto relative pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500"
      onClick={() => setShowExportMenu(false)}
    >
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 p-4 sm:p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 sm:gap-6">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            Total Absensi
          </h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm mt-0.5 sm:mt-1">
            Laporan rekapitulasi kehadiran bulanan.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto bg-slate-50 dark:bg-slate-950 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 px-1 sm:px-3 w-full md:w-auto justify-between sm:justify-start">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none outline-none text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer min-w-0"
            />
            <span className="text-slate-400 text-[9px] sm:text-[10px] font-bold shrink-0 px-2 bg-slate-200/50 dark:bg-slate-800 rounded-lg py-1">
              S/D
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none outline-none text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer min-w-0 text-right sm:text-left"
            />
          </div>

          <div className="w-px h-8 bg-slate-200 dark:bg-slate-800 hidden md:block"></div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={generateReportRekap}
              disabled={loading}
              className="flex-1 md:flex-none uppercase tracking-wider text-[10px] sm:text-xs font-black bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}{" "}
              Proses
            </button>
            <button
              onClick={() => {
                if (!loading) {
                  toast.loading("Memuat ulang & kalkulasi data absensi...", { id: "recalc" });
                  setTimeout(() => {
                    toast.success("Kalkulasi ulang selesai. Data telah disesuaikan dengan aturan terbaru.", { id: "recalc" });
                    generateReportRekap();
                  }, 1500);
                }
              }}
              disabled={loading}
              className="flex-1 md:flex-none uppercase tracking-wider text-[10px] sm:text-xs font-black bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl shadow-[0_4px_12px_rgba(245,158,11,0.2)] hover:shadow-[0_6px_16px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-3 h-3" /> Kalkulasi Ulang
            </button>
            <div
              className="relative z-20 flex-1 md:flex-none w-full md:w-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                disabled={reportRekapData.length === 0}
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="w-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-bold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-[10px] sm:text-xs uppercase tracking-wider"
              >
                <Download className="w-3 h-3" /> Export
              </button>
              {showExportMenu && reportRekapData.length > 0 && (
                <div className="absolute right-0 top-full mt-2 w-full md:w-48 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden py-1">
                  <button
                    onClick={handleExportPDF}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-red-500" /> Export PDF
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />{" "}
                    Export Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {reportRekapData.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col relative z-0">
          <div className="flex flex-col md:flex-row justify-between md:items-center p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 gap-4">
            <div className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 space-y-1 sm:space-y-1.5 flex-1">
              <div className="flex gap-2">
                <span className="w-16 sm:w-20 shrink-0">Depart</span>
                <span className="font-bold uppercase break-words flex-1">
                  : ALL
                </span>
              </div>
              <div className="flex gap-2">
                <span className="w-16 sm:w-20 shrink-0">Periode</span>
                <span className="font-bold uppercase break-words flex-1">
                  : {startDate} s/d {endDate}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="w-16 sm:w-20 shrink-0">Laporan</span>
                <span className="font-bold uppercase break-words flex-1">
                  : Total Absensi Kehadiran
                </span>
              </div>
            </div>
            <button
              onClick={() => setReportRekapData([])}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm w-full md:w-max md:self-start mt-2 md:mt-0"
            >
              <ArrowLeft className="w-4 h-4" /> Tutup Laporan
            </button>
          </div>

          <div className="p-0 sm:p-6">
            <div className="overflow-x-auto pb-4 custom-scrollbar sm:rounded-xl sm:border border-slate-200 dark:border-slate-800">
              <table className="w-full text-center whitespace-nowrap min-w-max text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 md:sticky left-0 z-10 bg-slate-50 dark:bg-slate-950">
                      ID
                    </th>
                    <th className="px-4 py-3 md:sticky left-[50px] md:left-[80px] z-10 bg-slate-50 dark:bg-slate-950 text-left">
                      Nama
                    </th>
                    <th className="px-4 py-3">Foto VL</th>
                    <th className="px-4 py-3">Kerja</th>
                    <th className="px-4 py-3">Libur</th>
                    <th className="px-4 py-3">Hadir</th>
                    <th className="px-4 py-3">Absen</th>
                    <th className="px-4 py-3">C.Ijin</th>
                    <th className="px-4 py-3">Telat</th>
                    <th className="px-4 py-3">Early</th>
                    <th className="px-4 py-3">Break</th>
                    <th className="px-4 py-3">OverT</th>
                    <th className="px-4 py-3">JamHd</th>
                    <th className="px-4 py-3">JamOT</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 divide-y divide-slate-100 dark:divide-slate-800/50">
                  {reportRekapData.map((rek) => {
                    return (
                      <tr
                        key={rek.nip}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-950/50 transition-colors"
                      >
                        <td className="px-4 py-3 md:sticky left-0 z-10 bg-white dark:bg-slate-900 font-medium">
                          {rek.nip}
                        </td>
                        <td className="px-4 py-3 md:sticky left-[50px] md:left-[80px] z-10 bg-white dark:bg-slate-900 text-left uppercase font-bold">
                          {rek.nama}
                        </td>
                        <td className="px-4 py-3">
                          {rek.foto && rek.foto !== "-" ? (
                            <img
                              src={
                                rek.foto.startsWith("data:image")
                                  ? rek.foto
                                  : `data:image/jpeg;base64,${rek.foto}`
                              }
                              alt="Foto VL"
                              className="w-8 h-8 rounded-full object-cover mx-auto bg-slate-100 shadow-sm border border-slate-200"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center mx-auto border border-dashed border-slate-200">
                              <ScanFace className="w-4 h-4 text-slate-300" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">{rek.kerja || ""}</td>
                        <td className="px-4 py-3">{rek.libur || ""}</td>
                        <td className="px-4 py-3">{rek.hadir || ""}</td>
                        <td className="px-4 py-3">{rek.absen || ""}</td>
                        <td className="px-4 py-3">{rek.izin || ""}</td>
                        <td className="px-4 py-3">{rek.telat || ""}</td>
                        <td className="px-4 py-3">{rek.early || ""}</td>
                        <td className="px-4 py-3">{rek.breakTime || ""}</td>
                        <td className="px-4 py-3">{rek.lembur || ""}</td>
                        <td className="px-4 py-3">
                          {rek.jamHd ? parseFloat(rek.jamHd.toFixed(2)) : ""}
                        </td>
                        <td className="px-4 py-3">
                          {rek.jamOT ? parseFloat(rek.jamOT.toFixed(2)) : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-16 text-center shadow-sm">
          <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 border border-slate-200 dark:border-slate-700">
            <FileText className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">
            Belum ada data dimuat
          </h3>
          <p className="text-slate-500 font-medium">
            Pilih periode lalu klik Proses untuk melihat dan mengekspor laporan.
          </p>
        </div>
      )}
    </div>
  );
}

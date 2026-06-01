import { useState, useEffect } from "react";
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
import { supabase } from "../../lib/supabase";
import { User as UserType, Attendance, Shift, Holiday } from "../../types";
import { exportToExcel, exportToPDF } from "../../lib/export";
import {
  toLocalISOString,
  checkIsDayOff,
  getShiftForDate,
  evaluateAttendanceStatus,
  calculateLateMinutes,
} from "../../lib/utils";
import { toast } from "sonner";

interface RekapTabProps {
  companyId: string;
}

export default function RekapTab({ companyId }: RekapTabProps) {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [breaks, setBreaks] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [reportRekapLengkapData, setReportRekapLengkapData] = useState<any[]>(
    [],
  );

  const timeToMinutes = (timeStr: string | undefined): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(":").map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };

  const getLocalMonthRange = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const pad = (n: number) => n.toString().padStart(2, "0");

    const start = new Date(y, m, 1);
    // endDate is last day of the month
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
    setReportRekapLengkapData([]);
    fetchData();
    fetchCompanySettings();
  }, [companyId]);

  const fetchData = async () => {
    try {
      const [
        { data: emps },
        { data: depts },
        { data: siks },
        { data: shfs },
        { data: brks },
        { data: hls },
      ] = await Promise.all([
        supabase
          .from("karyawan")
          .select("*")
          .eq("company_id", companyId)
          .neq("role", "OWNER")
          .order("nama", { ascending: true }),
        supabase.from("departemen").select("*").eq("company_id", companyId),
        supabase.from("siklus_shift").select("*").eq("company_id", companyId),
        supabase.from("shifts").select("*").eq("company_id", companyId),
        supabase.from("jam_break").select("*").eq("company_id", companyId),
        supabase.from("hari_libur").select("*").eq("company_id", companyId),
      ]);

      if (emps) setEmployees(emps);
      if (depts) setDepartments(depts);
      if (siks) setCycles(siks);
      if (shfs) setShifts(shfs);
      if (brks) setBreaks(brks);
      if (hls) setHolidays(hls);
    } catch (e) {
      console.error(e);
    }
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

  const getShift = (dateObj: Date, deptId?: number) => {
    return getShiftForDate(dateObj, deptId, departments, cycles, shifts);
  };

  const generateReportLengkap = async () => {
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
      employees.forEach((e) => {
        rekapMap[e.nip] = {
          nip: e.nip,
          nama: e.nama,
          foto: e.foto_wajah_base64,
          departemen_id: e.departemen_id,
          hadir: 0,
          izin: 0,
          telat: 0,
          processedDates: new Set(),
          daily: {},
        };
      });

      const sD = new Date(`${startDate}T00:00:00`);
      const eD = new Date(`${endDate}T00:00:00`);
      const daysDiff =
        Math.round((eD.getTime() - sD.getTime()) / (1000 * 60 * 60 * 24)) + 1;

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

        for (let i = 0; i < daysDiff; i++) {
          const current = new Date(sD);
          current.setDate(sD.getDate() + i);
          const yyyy = current.getFullYear();
          const mm = String(current.getMonth() + 1).padStart(2, "0");
          const dd = String(current.getDate()).padStart(2, "0");
          const dateStr = `${yyyy}-${mm}-${dd}`;
          const dayNumStr = dateStr.replace(/-/g, "_");

          const isRecordOnDate = (dateString: string) => {
            const localDate = new Date(dateString);
            const yyyy = localDate.getFullYear();
            const mm = String(localDate.getMonth() + 1).padStart(2, "0");
            const dd = String(localDate.getDate()).padStart(2, "0");
            return `${yyyy}-${mm}-${dd}` === dateStr;
          };

          const activeShiftOnDate = getShift(current, emp.departemen_id);
          const ruleOnDate = activeShiftOnDate?.rule || 4;

          const khususStatus = empLogs.find(
            (a) =>
              ["CUTI", "SAKIT", "IJIN", "LUPA_ABSEN"].includes(a.tipe) &&
              Number(a.status_acc) === 1 &&
              isRecordOnDate(a.waktu_masuk),
          );

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
              if (sorted.length > 1) pPulang = sorted[sorted.length - 1];
            }
          } else {
            const allMasuk = empLogs.filter(
              (a) => a.tipe === "MASUK" && isRecordOnDate(a.waktu_masuk),
            );
            pMasuk = allMasuk.sort(
              (a, b) =>
                new Date(a.waktu_masuk.replace(" ", "T")).getTime() -
                new Date(b.waktu_masuk.replace(" ", "T")).getTime(),
            )[0];

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
                const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(prevDate.getDate()).padStart(2, "0")}`;
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
                }
              }
            }
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

          if (khususStatus) {
            rec.daily[dayNumStr] = { status: khususStatus.tipe };
            if (!rec.processedDates.has(dateStr)) {
              rec.izin++;
              rec.processedDates.add(dateStr);
            }
          } else if (pMasuk || pPulang) {
            const st = evaluateAttendanceStatus(
              pMasuk,
              pPulang,
              activeShiftOnDate,
              companySettings,
            );
            rec.daily[dayNumStr] = {
              masuk: pMasuk
                ? new Date(
                    pMasuk.waktu_masuk.replace(" ", "T"),
                  ).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "",
              pulang: pPulang
                ? new Date(
                    pPulang.waktu_masuk.replace(" ", "T"),
                  ).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "",
              masukDate: pMasuk
                ? new Date(pMasuk.waktu_masuk.replace(" ", "T"))
                : null,
              pulangDate: pPulang
                ? new Date(pPulang.waktu_masuk.replace(" ", "T"))
                : null,
              late_minutes: st.assumed_late_minutes || 0,
              isSetengahHari: st.isSetengahHari,
              isAlpha: st.isAlpha,
              isHadir: st.isHadir,
              isTelat: st.isTelat,
            };
            if (!rec.processedDates.has(dateStr)) {
              if (st.isHadir) rec.hadir += 1;
              else if (st.isSetengahHari) rec.hadir += 0.5;

              if (st.isTelat && ruleOnDate !== 2) rec.telat++;
              rec.processedDates.add(dateStr);
            }
          }
        }
      });

      setReportRekapLengkapData(Object.values(rekapMap));
    } catch (e: any) {
      alert("Gagal rekap: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const syncToSheetsIfEnabled = async () => {
    if (companySettings?.gsheet_enabled && companySettings?.gsheet_url_rekap) {
      try {
        const sD = new Date(`${startDate}T00:00:00`);
        const eD = new Date(`${endDate}T00:00:00`);
        const daysDiff =
          Math.round((eD.getTime() - sD.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        let csvContent = "NIP,Nama,";
        for (let i = 0; i < daysDiff; i++) {
          const current = new Date(sD);
          current.setDate(sD.getDate() + i);
          csvContent += `${current.getDate()},`;
        }
        csvContent += "Hadir,Absen\n";

        reportRekapLengkapData.forEach((r) => {
          let row = `${r.nip},"${r.nama}",`;
          let totalAbsen = 0;
          for (let i = 0; i < daysDiff; i++) {
            const current = new Date(sD);
            current.setDate(sD.getDate() + i);
            const yC = current.getFullYear();
            const mC = String(current.getMonth() + 1).padStart(2, "0");
            const dC = String(current.getDate()).padStart(2, "0");
            const dateStr = `${yC}-${mC}-${dC}`;
            const dayNumStr = dateStr.replace(/-/g, "_");
            const d = r.daily[dayNumStr];
            const activeShift = getShift(current, r.departemen_id);
            const isWeekend = !activeShift;
            const isHoliday = holidays.some((h) => h.tanggal === dateStr);
            const isDayOff = isWeekend || isHoliday;

            if (d && d.status) row += `${d.status},`;
            else if (d && d.masuk) row += `${d.masuk} - ${d.pulang || "?"},`;
            else row += `-,`;

            const today = new Date();
            const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            if (
              !isDayOff &&
              dateStr < todayDateStr &&
              (!d || (!d.masuk && !d.status))
            ) {
              totalAbsen++;
            }
          }
          row += `${r.hadir},${totalAbsen}\n`;
          csvContent += row;
        });

        const title = `Rekap Lengkap ${startDate} to ${endDate}`;
        await fetch(companySettings.gsheet_url_rekap, {
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
    if (reportRekapLengkapData.length === 0)
      return alert("Proses Laporan Absensi terlebih dahulu!");

    await syncToSheetsIfEnabled();

    const sD = new Date(`${startDate}T00:00:00`);
    const eD = new Date(`${endDate}T00:00:00`);
    const daysDiff =
      Math.round((eD.getTime() - sD.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const data = reportRekapLengkapData.map((r) => {
      const rowData: any = {
        nip: r.nip,
        nama: r.nama,
        foto: r.foto && r.foto !== "-" ? "Ada" : "-",
      };
      const isSetengahHariRule = companySettings?.enable_half_day_rule ?? false;

      for (let i = 0; i < daysDiff; i++) {
        const current = new Date(sD);
        current.setDate(sD.getDate() + i);
        const yC = current.getFullYear();
        const mC = String(current.getMonth() + 1).padStart(2, "0");
        const dC = String(current.getDate()).padStart(2, "0");
        const dateStr = `${yC}-${mC}-${dC}`;
        const dayNumStr = dateStr.replace(/-/g, "_");
        const d = r.daily[dayNumStr];
        const activeShift = getShift(current, r.departemen_id);
        const isWeekend = !activeShift;
        const isHoliday = holidays.some((h) => h.tanggal === dateStr);
        const isDayOff = isWeekend || isHoliday;

        let content = "";
        if (d?.status) {
          content = `Absen X`;
          if (d.status === "IJIN") content = `Ijin`;
          else if (d.status === "SAKIT") content = `Sakit`;
          else if (d.status === "CUTI") content = `Cuti`;
        } else if (d?.masuk || d?.pulang) {
          let total = 0;
          if (d.masukDate && d.pulangDate) {
            const diffMs = d.pulangDate.getTime() - d.masukDate.getTime();
            let diffMins = Math.floor(diffMs / 60000);

            const pStartMins =
              d.masukDate.getHours() * 60 + d.masukDate.getMinutes();
            const pEndMins =
              d.pulangDate.getHours() * 60 + d.pulangDate.getMinutes();

            let dayBreakReduction = 0;
            breaks.forEach((b) => {
              if (!b.is_mengurangi_jam_kerja) return;
              const bOut = ((h) => h[0] * 60 + h[1])(
                b.jam_keluar.split(":").map(Number),
              );
              const bIn = ((h) => h[0] * 60 + h[1])(
                b.jam_kembali.split(":").map(Number),
              );
              if (pStartMins <= bOut && pEndMins >= bIn) {
                dayBreakReduction += b.durasi;
              }
            });
            total = Math.max(0, diffMins - dayBreakReduction);
          }

          if (d.isAlpha) {
            content = `${d.masuk || "?"} - ${d.pulang || "?"} (Absen X)`;
          } else if (d.isSetengahHari) {
            content = `${d.masuk || "?"} - ${d.pulang || "?"} (½ Hari)`;
          } else {
            let totalStr = "";
            if (total > 0) {
              const hrs = Math.floor(total / 60);
              const mins = total % 60;
              totalStr = ` \n(${hrs}j ${mins}m)`;
            }
            content = `${d.masuk || "??:??"} - ${d.pulang || "??:??"}${totalStr}`;
          }
        } else {
          const today = new Date();
          const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
          if (!isDayOff && dateStr < todayDateStr) {
            content = "Absen X";
          }
        }
        rowData[`hr_${i}`] = content;
      }
      return rowData;
    });

    const columns = [
      { header: "ID", key: "nip" },
      { header: "Nama", key: "nama" },
      { header: "Foto VL", key: "foto" },
    ];
    for (let i = 0; i < daysDiff; i++) {
      const current = new Date(sD);
      current.setDate(sD.getDate() + i);
      const dayName = current.toLocaleDateString("id-ID", { weekday: "long" });
      const dayLabel = current.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
      });
      columns.push({ header: `${dayLabel}\n${dayName}`, key: `hr_${i}` });
    }

    exportToExcel(
      data,
      columns,
      `Rekap_Absensi_Lengkap_${startDate}_to_${endDate}`,
    );
  };

  const handleExportPDF = async () => {
    setShowExportMenu(false);
    if (reportRekapLengkapData.length === 0)
      return alert("Proses Laporan Absensi terlebih dahulu!");

    await syncToSheetsIfEnabled();

    const sD = new Date(`${startDate}T00:00:00`);
    const eD = new Date(`${endDate}T00:00:00`);
    const daysDiff =
      Math.round((eD.getTime() - sD.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const headers = ["ID", "Nama", "Foto VL"];
    for (let i = 0; i < daysDiff; i++) {
      const current = new Date(sD);
      current.setDate(sD.getDate() + i);
      const dayName = current.toLocaleDateString("id-ID", { weekday: "long" });
      const dayLabel = current.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
      });
      headers.push(`${dayLabel}\n${dayName}`);
    }

    const rows = reportRekapLengkapData.map((r) => {
      const rowData = [r.nip, r.nama, r.foto && r.foto !== "-" ? "Ada" : "-"];
      const isSetengahHariRule = companySettings?.enable_half_day_rule ?? false;

      for (let i = 0; i < daysDiff; i++) {
        const current = new Date(sD);
        current.setDate(sD.getDate() + i);
        const yC = current.getFullYear();
        const mC = String(current.getMonth() + 1).padStart(2, "0");
        const dC = String(current.getDate()).padStart(2, "0");
        const dateStr = `${yC}-${mC}-${dC}`;
        const dayNumStr = dateStr.replace(/-/g, "_");
        const d = r.daily[dayNumStr];
        const activeShift = getShift(current, r.departemen_id);
        const isWeekend = !activeShift;
        const isHoliday = holidays.some((h) => h.tanggal === dateStr);
        const isDayOff = isWeekend || isHoliday;

        let content = "";
        if (d?.status) {
          content = `Absen X`;
          if (d.status === "IJIN") content = `Ijin`;
          else if (d.status === "SAKIT") content = `Sakit`;
          else if (d.status === "CUTI") content = `Cuti`;
        } else if (d?.masuk || d?.pulang) {
          let total = 0;
          if (d.masukDate && d.pulangDate) {
            const diffMs = d.pulangDate.getTime() - d.masukDate.getTime();
            let diffMins = Math.floor(diffMs / 60000);

            const pStartMins =
              d.masukDate.getHours() * 60 + d.masukDate.getMinutes();
            const pEndMins =
              d.pulangDate.getHours() * 60 + d.pulangDate.getMinutes();

            let dayBreakReduction = 0;
            breaks.forEach((b) => {
              if (!b.is_mengurangi_jam_kerja) return;
              const bOut = ((h) => h[0] * 60 + h[1])(
                b.jam_keluar.split(":").map(Number),
              );
              const bIn = ((h) => h[0] * 60 + h[1])(
                b.jam_kembali.split(":").map(Number),
              );
              if (pStartMins <= bOut && pEndMins >= bIn) {
                dayBreakReduction += b.durasi;
              }
            });
            total = Math.max(0, diffMins - dayBreakReduction);
          }

          if (d.isAlpha) {
            content = `${d.masuk || "?"} - ${d.pulang || "?"} (Absen X)`;
          } else if (d.isSetengahHari) {
            content = `${d.masuk || "?"} - ${d.pulang || "?"} (½ Hari)`;
          } else {
            let totalStr = "";
            if (total > 0) {
              const hrs = Math.floor(total / 60);
              const mins = total % 60;
              totalStr = ` \n(${hrs}j ${mins}m)`;
            }
            content = `${d.masuk || "??:??"} - ${d.pulang || "??:??"}${totalStr}`;
          }
        } else {
          const today = new Date();
          const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
          if (!isDayOff && dateStr < todayDateStr) {
            content = "Absen X";
          }
        }
        rowData.push(content);
      }
      return rowData;
    });

    exportToPDF(
      "Rekap Absensi Kehadiran",
      headers,
      rows,
      `Rekap_Absensi_Lengkap_${startDate}_to_${endDate}`,
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
            Rekap Absensi
          </h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm mt-0.5 sm:mt-1">
            Laporan rekap kehadiran harian per bulan.
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

          <button
            onClick={generateReportLengkap}
            disabled={loading}
            className="w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2 text-xs"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Proses
          </button>

          <button
            onClick={() => {
              if (!loading) {
                toast.loading("Memuat ulang & kalkulasi data absensi...", { id: "recalc" });
                setTimeout(() => {
                  toast.success("Kalkulasi ulang selesai. Data telah disesuaikan dengan aturan terbaru.", { id: "recalc" });
                  generateReportLengkap();
                }, 1500);
              }
            }}
            disabled={loading}
            className="w-full md:w-auto bg-amber-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-amber-600 transition-all shadow-lg flex items-center justify-center gap-2 text-xs"
          >
            <RefreshCcw className="w-3 h-3" /> Kalkulasi Ulang
          </button>

          <div
            className="relative z-20 w-full md:w-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              disabled={reportRekapLengkapData.length === 0}
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="w-full md:w-auto bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 px-4 py-2 rounded-xl font-bold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-xs"
            >
              <Download className="w-3 h-3" /> Export
            </button>
            {showExportMenu && reportRekapLengkapData.length > 0 && (
              <div className="absolute right-0 top-full mt-2 w-full md:w-48 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden py-1 z-50">
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

      {reportRekapLengkapData.length > 0 ? (
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
                  : Rekap Absensi Kehadiran
                </span>
              </div>
            </div>
            <button
              onClick={() => setReportRekapLengkapData([])}
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
                    <th className="px-4 py-3 md:sticky left-0 z-10 bg-slate-50 dark:bg-slate-950 min-w-[80px]">
                      ID
                    </th>
                    <th className="px-4 py-3 md:sticky left-[80px] z-10 bg-slate-50 dark:bg-slate-950 text-left min-w-[200px]">
                      Nama
                    </th>
                    <th className="px-4 py-3 min-w-[100px]">Foto VL</th>
                    {(() => {
                      const sD = new Date(startDate);
                      const eD = new Date(endDate);
                      const diff =
                        Math.ceil(
                          (eD.getTime() - sD.getTime()) / (1000 * 60 * 60 * 24),
                        ) + 1;
                      return Array.from({ length: diff }).map((_, i) => {
                        const current = new Date(sD);
                        current.setDate(sD.getDate() + i);
                        return (
                          <th key={i} className="px-4 py-3 min-w-[70px]">
                            {current.toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "2-digit",
                            })}
                            <br />
                            <span className="font-normal opacity-80 uppercase text-[9px]">
                              {current.toLocaleDateString("id-ID", {
                                weekday: "short",
                              })}
                            </span>
                          </th>
                        );
                      });
                    })()}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 divide-y divide-slate-100 dark:divide-slate-800/50">
                  {reportRekapLengkapData.map((rek, idx) => {
                    return (
                      <tr
                        key={rek.nip}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-950/50 transition-colors`}
                      >
                        <td className="px-4 py-3 md:sticky left-0 z-10 bg-white dark:bg-slate-900 font-medium border-r border-slate-100 dark:border-slate-800/50">
                          {rek.nip}
                        </td>
                        <td className="px-4 py-3 md:sticky left-[80px] z-10 bg-white dark:bg-slate-900 text-left uppercase font-bold border-r border-slate-100 dark:border-slate-800/50 max-w-[200px] truncate">
                          {rek.nama}
                        </td>
                        <td className="px-4 py-3 min-w-[100px]">
                          <div className="w-10 h-10 mx-auto relative overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 flex items-center justify-center">
                            {rek.foto && rek.foto !== "-" ? (
                              <img
                                src={
                                  rek.foto.startsWith("data:image")
                                    ? rek.foto
                                    : `data:image/jpeg;base64,${rek.foto}`
                                }
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as any).style.display = "none";
                                  (e.target as any).nextSibling.style.display =
                                    "flex";
                                }}
                              />
                            ) : null}
                            <div
                              className="flex items-center justify-center w-full h-full text-slate-300 bg-slate-50"
                              style={{
                                display:
                                  !rek.foto || rek.foto === "-"
                                    ? "flex"
                                    : "none",
                              }}
                            >
                              <ScanFace className="w-5 h-5" />
                            </div>
                          </div>
                        </td>
                        {(() => {
                          const sD = new Date(startDate);
                          const eD = new Date(endDate);
                          const diff =
                            Math.ceil(
                              (eD.getTime() - sD.getTime()) /
                                (1000 * 60 * 60 * 24),
                            ) + 1;
                          return Array.from({ length: diff }).map((_, i) => {
                            const current = new Date(sD);
                            current.setDate(sD.getDate() + i);
                            const yC = current.getFullYear();
                            const mC = String(current.getMonth() + 1).padStart(
                              2,
                              "0",
                            );
                            const dC = String(current.getDate()).padStart(
                              2,
                              "0",
                            );
                            const dateStr = `${yC}-${mC}-${dC}`;
                            const dayNumStr = dateStr.replace(/-/g, "_");
                            const daily = rek.daily[dayNumStr];
                            const activeShift = getShift(
                              current,
                              rek.departemen_id,
                            );
                            const isWeekend = !activeShift;
                            const isHoliday = holidays.some(
                              (h) => h.tanggal === dateStr,
                            );
                            const isDayOff = isWeekend || isHoliday;
                            let content = "";
                            let textClass = "";
                            if (daily?.status) {
                              content = `Absen X`;
                              if (daily.status === "IJIN") content = `Ijin`;
                              else if (daily.status === "SAKIT")
                                content = `Sakit`;
                              else if (daily.status === "CUTI")
                                content = `Cuti`;
                            } else if (daily?.masuk || daily?.pulang) {
                              let total = 0;
                              if (daily.masukDate && daily.pulangDate) {
                                const diffMs =
                                  daily.pulangDate.getTime() -
                                  daily.masukDate.getTime();
                                let diffMins = Math.floor(diffMs / 60000);

                                const pStartMins =
                                  daily.masukDate.getHours() * 60 +
                                  daily.masukDate.getMinutes();
                                const pEndMins =
                                  daily.pulangDate.getHours() * 60 +
                                  daily.pulangDate.getMinutes();

                                let dayBreakReduction = 0;
                                breaks.forEach((b) => {
                                  if (!b.is_mengurangi_jam_kerja) return;
                                  const bOut = ((h) => h[0] * 60 + h[1])(
                                    b.jam_keluar.split(":").map(Number),
                                  );
                                  const bIn = ((h) => h[0] * 60 + h[1])(
                                    b.jam_kembali.split(":").map(Number),
                                  );
                                  if (pStartMins <= bOut && pEndMins >= bIn) {
                                    dayBreakReduction += b.durasi;
                                  }
                                });
                                total = Math.max(
                                  0,
                                  diffMins - dayBreakReduction,
                                );
                              }

                              textClass = "text-slate-700 dark:text-slate-300";

                              if (daily.isAlpha) {
                                content = `${daily.masuk || "?"} - ${daily.pulang || "?"} (Absen X)`;
                                textClass = "text-red-500 font-bold";
                              } else if (daily.isSetengahHari) {
                                content = `${daily.masuk || "?"} - ${daily.pulang || "?"} (½ Hari)`;
                                textClass = "text-orange-500 font-bold";
                              } else {
                                let totalStr = "";
                                if (total > 0) {
                                  const hrs = Math.floor(total / 60);
                                  const mins = total % 60;
                                  totalStr = ` (${hrs}j ${mins}m)`;
                                }
                                content = `${daily.masuk || "??:??"} - ${daily.pulang || "??:??"}${totalStr}`;
                              }
                            } else {
                              if (isDayOff) {
                                const hd = holidays.find(
                                  (h) => h.tanggal === dateStr,
                                );
                                content = hd ? hd.nama_libur : "LIBUR";
                                textClass = "text-slate-400 italic font-medium";
                              } else {
                                const today = new Date();
                                const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                                if (dateStr < todayDateStr) {
                                  content = "Absen X";
                                }
                              }
                            }

                            return (
                              <td key={i} className={`px-4 py-3 ${textClass}`}>
                                {content}
                              </td>
                            );
                          });
                        })()}
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

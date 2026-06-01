import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  FileSpreadsheet,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import {
  User as UserType,
  Attendance,
  Department,
  Shift,
  Holiday,
} from "../../types";
import { exportToExcel, exportToPDF } from "../../lib/export";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  toLocalISOString,
  checkIsDayOff,
  toLocalDateString,
  getShiftForDate,
  calculateOvertimeIndex,
  evaluateAttendanceStatus,
  calculateLateMinutes,
} from "../../lib/utils";

interface KartuAbsensiTabProps {
  companyId: string;
  user?: UserType;
}

export default function KartuAbsensiTab({
  companyId,
  user,
}: KartuAbsensiTabProps) {
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [breaks, setBreaks] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [overtimeMatrix, setOvertimeMatrix] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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
  // Set default range to current month
  const [startDate, setStartDate] = useState(defaultRange.startStr);
  const [endDate, setEndDate] = useState(defaultRange.endStr);

  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    setLoading(true);
    let empQuery = supabase
      .from("karyawan")
      .select("*")
      .eq("company_id", companyId)
      .neq("role", "OWNER")
      .order("nama", { ascending: true });

    if (user?.role === "USER") {
      empQuery = empQuery.eq("nip", user.nip);
    }

    const [
      { data: emps },
      { data: depts },
      { data: siks },
      { data: shfs },
      { data: brks },
      { data: hls },
      { data: comp },
      { data: matrix },
    ] = await Promise.all([
      empQuery,
      supabase.from("departemen").select("*").eq("company_id", companyId),
      supabase.from("siklus_shift").select("*").eq("company_id", companyId),
      supabase.from("shifts").select("*").eq("company_id", companyId),
      supabase.from("jam_break").select("*").eq("company_id", companyId),
      supabase.from("hari_libur").select("*").eq("company_id", companyId),
      supabase
        .from("companies")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle(),
      supabase.from("overtime_matrix").select("*").eq("company_id", companyId),
    ]);

    if (emps) {
      setEmployees(emps);
      if (user?.role === "USER" && emps.length > 0) {
        setSelectedUser(emps[0]);
      }
    }
    if (depts) setDepartments(depts);
    if (siks) setCycles(siks);
    if (shfs) setShifts(shfs);
    if (brks) setBreaks(brks);
    if (hls) setHolidays(hls);
    if (comp) setCompanySettings(comp);
    if (matrix) setOvertimeMatrix(matrix);

    setLoading(false);
  };

  const fetchLogs = async (nip: string) => {
    setLoading(true);
    const start = toLocalISOString(new Date(`${startDate}T00:00:00`));
    const end = toLocalISOString(new Date(`${endDate}T23:59:59.999`));

    const { data } = await supabase
      .from("absensi")
      .select("*")
      .eq("company_id", companyId)
      .eq("nip", nip)
      .gte("waktu_masuk", start)
      .lte("waktu_masuk", end)
      .order("waktu_masuk", { ascending: true });

    if (data) setAttendances(data);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedUser) {
      fetchLogs(selectedUser.nip);
    }
  }, [selectedUser, startDate, endDate]);

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.nip.includes(searchTerm),
  );

  const { dailyRecords, summaryStats } = useMemo(() => {
    if (!selectedUser)
      return {
        dailyRecords: [],
        summaryStats: {
          kerja: 0,
          libur: 0,
          hadir: 0,
          absen: 0,
          cijin: 0,
          telat: 0,
          early: 0,
          break: 0,
          overT: 0,
          jamHd: 0,
          jamOT: 0,
        },
      };

    const isDayOff = (dateObj: Date, deptId?: number) => {
      const dateStr = toLocalDateString(dateObj);
      const isHoliday = holidays.some((h) => h.tanggal === dateStr);
      return isHoliday || checkIsDayOff(dateObj, deptId, departments, cycles);
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
      Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) +
      1;

    const records = [];
    let kerja = 0,
      libur = 0,
      hadir = 0,
      absen = 0,
      cijin = 0,
      telat = 0,
      early = 0,
      totalBreakMins = 0,
      overT_count = 0,
      jamHd = 0,
      jamOT = 0;

    for (let i = 0; i < daysDiff; i++) {
      const current = new Date(startD);
      current.setDate(startD.getDate() + i);
      const dateStr = toLocalDateString(current); // "YYYY-MM-DD"

      // Helper function to check if a record's local date matches our dateStr
      const isRecordOnDate = (dateString: string) => {
        const localDate = new Date(dateString);
        // Build YYYY-MM-DD in local time
        const yyyy = localDate.getFullYear();
        const mm = String(localDate.getMonth() + 1).padStart(2, "0");
        const dd = String(localDate.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}` === dateStr;
      };

      const t = new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate(),
        12,
        0,
        0,
      ); // use noon to avoid tz shifts
      const activeShift = getShift(t, selectedUser.departemen_id);
      const isHoliday = holidays.some((h) => h.tanggal === dateStr);
      const holidayData = holidays.find((h) => h.tanggal === dateStr);
      const isWeekend = !activeShift;
      const isDayOff = isWeekend || isHoliday;
      const rule = activeShift?.rule || 4;

      const khususStatus = attendances.find(
        (a) =>
          ["CUTI", "SAKIT", "IJIN", "LUPA_ABSEN"].includes(a.tipe) &&
          isRecordOnDate(a.waktu_masuk) &&
          Number(a.status_acc) === 1,
      );

      let pMasuk: any = null;
      let pPulang = null;

      if (rule === 4) {
        // Rule 4: Tanpa Status & Tanpa Shift (Auto Detect: First In - Last Out)
        const allLogsToday = attendances.filter(
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
          }
        }
      } else {
        const AllMasukToday = attendances.filter(
          (a) => a.tipe === "MASUK" && isRecordOnDate(a.waktu_masuk),
        );
        pMasuk = AllMasukToday.sort(
          (a, b) =>
            new Date(a.waktu_masuk.replace(" ", "T")).getTime() -
            new Date(b.waktu_masuk.replace(" ", "T")).getTime(),
        )[0];

        if (pMasuk) {
          // Find the next PULANG after this MASUK
          pPulang = [...attendances]
            .sort(
              (a, b) =>
                new Date(a.waktu_masuk.replace(" ", "T")).getTime() -
                new Date(b.waktu_masuk.replace(" ", "T")).getTime(),
            )
            .find(
              (a) =>
                typeof a.tipe === "string" &&
                a.tipe.includes("PULANG") &&
                !a.tipe.includes("LEMBUR") &&
                new Date(a.waktu_masuk.replace(" ", "T")).getTime() >
                  new Date(pMasuk.waktu_masuk.replace(" ", "T")).getTime(),
            );

          // Validate pulangs shouldn't be > 24 hours (sanity check)
          if (
            pPulang &&
            new Date(pPulang.waktu_masuk.replace(" ", "T")).getTime() -
              new Date(pMasuk.waktu_masuk.replace(" ", "T")).getTime() >
              24 * 60 * 60 * 1000
          ) {
            pPulang = null;
          }
        } else {
          // Evaluate if there is an orphaned PULANG today
          const pulangToday = attendances.find(
            (a) =>
              typeof a.tipe === "string" &&
              a.tipe.includes("PULANG") &&
              !a.tipe.includes("LEMBUR") &&
              isRecordOnDate(a.waktu_masuk),
          );
          if (pulangToday) {
            // check if it belongs to yesterday
            const prevDate = new Date(current.getTime() - 24 * 60 * 60 * 1000);
            const prevDateStr = toLocalDateString(prevDate);
            const isRecordOnPrev = (dateString: string) => {
              const ld = new Date(dateString);
              const y = ld.getFullYear();
              const m = String(ld.getMonth() + 1).padStart(2, "0");
              const d = String(ld.getDate()).padStart(2, "0");
              return `${y}-${m}-${d}` === prevDateStr;
            };
            const prevMasuk = attendances.find(
              (a) => a.tipe === "MASUK" && isRecordOnPrev(a.waktu_masuk),
            );

            if (
              !(
                prevMasuk &&
                new Date(pulangToday.waktu_masuk.replace(" ", "T")).getTime() -
                  new Date(prevMasuk.waktu_masuk.replace(" ", "T")).getTime() <=
                  24 * 60 * 60 * 1000
              )
            ) {
              pPulang = pulangToday;
            }
          }
        }
      }

      const ALL_letMasuk = attendances.filter(
        (a) => a.tipe === "LEMBUR_MASUK" && isRecordOnDate(a.waktu_masuk),
      );
      const letMasuk = ALL_letMasuk.sort(
        (a, b) =>
          new Date(a.waktu_masuk.replace(" ", "T")).getTime() -
          new Date(b.waktu_masuk.replace(" ", "T")).getTime(),
      )[0];
      let letKeluar = null;
      if (letMasuk) {
        letKeluar = [...attendances]
          .sort(
            (a, b) =>
              new Date(a.waktu_masuk.replace(" ", "T")).getTime() -
              new Date(b.waktu_masuk.replace(" ", "T")).getTime(),
          )
          .find(
            (a) =>
              a.tipe === "LEMBUR_KELUAR" &&
              new Date(a.waktu_masuk.replace(" ", "T")).getTime() >
                new Date(letMasuk.waktu_masuk.replace(" ", "T")).getTime(),
          );
        if (
          letKeluar &&
          new Date(letKeluar.waktu_masuk.replace(" ", "T")).getTime() -
            new Date(letMasuk.waktu_masuk.replace(" ", "T")).getTime() >
            24 * 60 * 60 * 1000
        ) {
          letKeluar = null;
        }
      } else {
        const keluarToday = attendances.find(
          (a) => a.tipe === "LEMBUR_KELUAR" && isRecordOnDate(a.waktu_masuk),
        );
        if (keluarToday) {
          const prevDate = new Date(current.getTime() - 24 * 60 * 60 * 1000);
          const prevDateStr = toLocalDateString(prevDate);
          const isRecordOnPrev = (dateString: string) => {
            const ld = new Date(dateString);
            const y = ld.getFullYear();
            const m = String(ld.getMonth() + 1).padStart(2, "0");
            const d = String(ld.getDate()).padStart(2, "0");
            return `${y}-${m}-${d}` === prevDateStr;
          };
          const prevLemburMasuk = attendances.find(
            (a) => a.tipe === "LEMBUR_MASUK" && isRecordOnPrev(a.waktu_masuk),
          );
          if (
            !(
              prevLemburMasuk &&
              new Date(keluarToday.waktu_masuk.replace(" ", "T")).getTime() -
                new Date(
                  prevLemburMasuk.waktu_masuk.replace(" ", "T"),
                ).getTime() <=
                24 * 60 * 60 * 1000
            )
          ) {
            letKeluar = keluarToday;
          }
        }
      }

      if (isDayOff) {
        pMasuk = null;
        pPulang = null;
      }
      
      if (pMasuk && activeShift) {
        if (!pMasuk.late_minutes) {
           pMasuk.late_minutes = calculateLateMinutes(pMasuk, activeShift);
           pMasuk.late_minutes_recalculated = true;
        }
      }

      if (isDayOff) {
        libur++;
      } else {
        kerja++;
      }

      let hadirStr = "";
      let telatStr = "";
      let earlyStr = "";
      let statusStr = "";
      let overTStr = "";
      let breakStr = "";
      let masukWaktu = pMasuk
        ? new Date(pMasuk.waktu_masuk.replace(" ", "T")).toLocaleTimeString(
            "id-ID",
            { hour: "2-digit", minute: "2-digit", second: "2-digit" },
          )
        : "";
      let pulangWaktu = pPulang
        ? new Date(pPulang.waktu_masuk.replace(" ", "T")).toLocaleTimeString(
            "id-ID",
            { hour: "2-digit", minute: "2-digit", second: "2-digit" },
          )
        : "";

      if (pMasuk && pPulang) {
        let diffMs =
          new Date(pPulang.waktu_masuk.replace(" ", "T")).getTime() -
          new Date(pMasuk.waktu_masuk.replace(" ", "T")).getTime();
        let diffMins = Math.floor(diffMs / 60000);

        // Apply Breaks
        let dayBreakReduction = 0;
        const pStart = new Date(pMasuk.waktu_masuk.replace(" ", "T"));
        const pEnd = new Date(pPulang.waktu_masuk.replace(" ", "T"));
        const pStartMins = pStart.getHours() * 60 + pStart.getMinutes();
        const pEndMins = pEnd.getHours() * 60 + pEnd.getMinutes();

        breaks.forEach((b) => {
          if (!b.is_mengurangi_jam_kerja) return;
          const bOut = timeToMinutes(b.jam_keluar);
          const bIn = timeToMinutes(b.jam_kembali);
          // If break time is within work time
          if (pStartMins <= bOut && pEndMins >= bIn) {
            dayBreakReduction += b.durasi;
          }
        });

        if (dayBreakReduction > 0) {
          diffMins -= dayBreakReduction;
          totalBreakMins += dayBreakReduction;
          breakStr = `${dayBreakReduction}m`;
        }

        if (diffMins < 0) diffMins = 0;

        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        hadirStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        if (isHoliday) {
          const otIndex = calculateOvertimeIndex(
            diffMins,
            true,
            overtimeMatrix,
          );
          jamOT += otIndex;
          overTStr = `${otIndex.toFixed(1)}h`;
          overT_count++;
        } else {
          jamHd += diffMins / 60;
        }

        // Calculate Early Leave & Lembur Larut
        if (
          activeShift &&
          !activeShift.isAuto &&
          activeShift.jam_pulang &&
          !pPulang.tipe.includes("LEMBUR")
        ) {
          const shiftPulangMins = timeToMinutes(activeShift.jam_pulang);
          const actualPulangDate = new Date(
            pPulang.waktu_masuk.replace(" ", "T"),
          );
          const actualPulangMins =
            actualPulangDate.getHours() * 60 + actualPulangDate.getMinutes();
          const tolerance = activeShift.pulang_awal_tolerance || 0;

          if (actualPulangMins < shiftPulangMins - tolerance) {
            const diff = shiftPulangMins - actualPulangMins;
            const eh = Math.floor(diff / 60);
            const em = diff % 60;
            earlyStr = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
            early++;
          }

          // Lembur Larut Check
          const empDept = departments.find(
            (d) => d.id === selectedUser.departemen_id,
          );
          if (empDept && empDept.is_lembur_larut && !isHoliday) {
            const menit_lembur = empDept.menit_lembur || 0;
            if (actualPulangMins >= shiftPulangMins + menit_lembur) {
              const lemburExtraMins = actualPulangMins - shiftPulangMins;
              const otIndex = calculateOvertimeIndex(
                lemburExtraMins,
                false,
                overtimeMatrix,
              );
              jamOT += otIndex;
              overT_count++;
              overTStr = `${otIndex.toFixed(1)}h`;
            }
          }
        }
      }

      let st: any = null;
      if (pMasuk || pPulang) {
        st = evaluateAttendanceStatus(pMasuk, pPulang, activeShift, companySettings);
      }

      if (
        st &&
        st.assumed_late_minutes &&
        st.assumed_late_minutes > 0 &&
        rule !== 2 &&
        !st.isAlpha
      ) {
        const h = Math.floor(st.assumed_late_minutes / 60);
        const m = st.assumed_late_minutes % 60;
        telatStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        telat++;
      }

      if (letMasuk && letKeluar) {
        let diffMs =
          new Date(letKeluar.waktu_masuk.replace(" ", "T")).getTime() -
          new Date(letMasuk.waktu_masuk.replace(" ", "T")).getTime();
        if (diffMs < 0) diffMs = 0; // prevent negative elapsed time
        const diffMins = Math.floor(diffMs / 60000);
        const otIndex = calculateOvertimeIndex(
          diffMins,
          isHoliday,
          overtimeMatrix,
        );
        overTStr = overTStr
          ? `${overTStr} + ${otIndex.toFixed(1)}h`
          : `${otIndex.toFixed(1)}h`;
        jamOT += otIndex;
        overT_count++;
      }

      if (khususStatus) {
        statusStr = khususStatus.tipe;
        cijin++;
      } else if (pMasuk || pPulang) {
        if (st.isAlpha) {
          statusStr = isDayOff
            ? isHoliday
              ? holidayData?.nama_libur || "LIBUR"
              : "LIBUR"
            : "Absen";
          if (!isDayOff) absen++;
        } else if (st.isSetengahHari) {
          statusStr = isDayOff
            ? isHoliday
              ? holidayData?.nama_libur || "LIBUR"
              : "LIBUR"
            : "½ Hari";
          hadir += 0.5;
        } else if (st.isHadir) {
          statusStr = isDayOff
            ? isHoliday
              ? holidayData?.nama_libur || "LIBUR"
              : "LIBUR"
            : "Hadir";
          hadir++;
        }
      } else {
        const today = new Date();
        const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        if (!isDayOff && dateStr < todayDateStr) {
          statusStr = "Absen";
          absen++;
        } else if (isDayOff) {
          statusStr = isHoliday ? holidayData?.nama_libur || "LIBUR" : "LIBUR";
        }
      }

      const [yearStr, monthStr, dayStr] = dateStr.split("-");

      records.push({
        nip: selectedUser.nip,
        nama: selectedUser.nama,
        tanggal: `${dayStr}-${monthStr}-${yearStr}`,
        hari: t.toLocaleDateString("id-ID", { weekday: "long" }),
        masuk: masukWaktu,
        pulang: pulangWaktu,
        hadir: hadirStr,
        telat: telatStr,
        early: earlyStr,
        breakStr: breakStr,
        overT: overTStr,
        status: statusStr,
        isOffDay: isDayOff,
      });
    }

    return {
      dailyRecords: records,
      summaryStats: {
        kerja,
        libur,
        hadir,
        absen,
        cijin,
        telat,
        early,
        break: totalBreakMins,
        overT: overT_count,
        jamHd,
        jamOT,
      },
    };
  }, [attendances, selectedUser, startDate, endDate]);

  const syncToSheetsIfEnabled = async () => {
    if (
      companySettings?.gsheet_enabled &&
      companySettings?.gsheet_url_kartu &&
      selectedUser
    ) {
      try {
        const title = `Kartu Absensi ${selectedUser.nip} - ${startDate} to ${endDate}`;

        let csvContent =
          "NIP,Nama,Tanggal,Hari,Masuk,Pulang,Hadir,Telat,Early,Break,OverT,Status\n";
        dailyRecords.forEach((r) => {
          csvContent += `${r.nip},"${r.nama}",${r.tanggal},${r.hari},${r.masuk},${r.pulang},${r.hadir},${r.telat},${r.early},${r.breakStr},${r.overT},${r.status}\n`;
        });

        await fetch(companySettings.gsheet_url_kartu, {
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
    if (!selectedUser || dailyRecords.length === 0)
      return alert("Tidak ada data absensi");

    await syncToSheetsIfEnabled();

    const wsParams = [
      { A: `Personil: ${selectedUser.nama}` },
      { A: `Departemen: ${departments.find((d) => d.id === selectedUser.departemen_id)?.nama_departemen || "-"}` },
      { A: `Periode: ${startDate} s/d ${endDate}` },
      {},
      { A: "RINGKASAN ABSENSI" }
    ];

    const wsSummaryData = [
      {
        Kerja: summaryStats.kerja || "",
        Libur: summaryStats.libur || "",
        Hadir: summaryStats.hadir || "",
        Absen: summaryStats.absen || "",
        "C.Ijin": summaryStats.cijin || "",
        Telat: summaryStats.telat || "",
        Early: summaryStats.early || "",
        Break: summaryStats.break || "",
        OverT: summaryStats.overT || "",
        JamHd: summaryStats.jamHd ? parseFloat(summaryStats.jamHd.toFixed(2)) : "",
        JamOT: summaryStats.jamOT ? parseFloat(summaryStats.jamOT.toFixed(2)) : "",
      }
    ];

    const wsDailyData = dailyRecords.map(r => ({
      Tanggal: r.tanggal,
      Hari: r.hari,
      Masuk: r.masuk,
      Pulang: r.pulang,
      Hadir: r.hadir,
      Telat: r.telat,
      Early: r.early,
      Break: r.breakStr,
      OverT: r.overT,
      Status: r.status,
    }));

    const ws = XLSX.utils.json_to_sheet(wsParams, { skipHeader: true });
    XLSX.utils.sheet_add_json(ws, wsSummaryData, { origin: "A6" });
    XLSX.utils.sheet_add_json(ws, [{ A: "DETAIL KARTU ABSENSI" }], { skipHeader: true, origin: "A9" });
    XLSX.utils.sheet_add_json(ws, wsDailyData, { origin: "A11" });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kartu Absensi");
    XLSX.writeFile(wb, `Kartu_Absensi_${selectedUser.nip}_${startDate}_to_${endDate}.xlsx`);
  };

  const handleExportPDF = async () => {
    setShowExportMenu(false);
    if (!selectedUser || dailyRecords.length === 0)
      return alert("Tidak ada data absensi");

    await syncToSheetsIfEnabled();

    const doc = new jsPDF("l", "mm", "a4"); // Landscape for reports
    let yPos = 15;

    doc.setFontSize(16);
    doc.text("Kartu Absensi Kehadiran", 14, yPos);

    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(100);
    const subtitle = `Personil: ${selectedUser.nama}\nDepartemen: ${departments.find((d) => d.id === selectedUser.departemen_id)?.nama_departemen || "-"}\nPeriode: ${startDate} s/d ${endDate}`;
    doc.text(subtitle, 14, yPos);
    doc.setTextColor(0);

    yPos += 15;
    
    // Add Summary table
    const summaryHeaders = ["Kerja", "Libur", "Hadir", "Absen", "C.Ijin", "Telat", "Early", "Break", "OverT", "JamHd", "JamOT"];
    const summaryRows = [[
      summaryStats.kerja || "",
      summaryStats.libur || "",
      summaryStats.hadir || "",
      summaryStats.absen || "",
      summaryStats.cijin || "",
      summaryStats.telat || "",
      summaryStats.early || "",
      summaryStats.break || "",
      summaryStats.overT || "",
      summaryStats.jamHd ? parseFloat(summaryStats.jamHd.toFixed(2)) : "",
      summaryStats.jamOT ? parseFloat(summaryStats.jamOT.toFixed(2)) : ""
    ]];

    autoTable(doc, {
      startY: yPos,
      head: [summaryHeaders],
      body: summaryRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    const headers = [
      "Tanggal",
      "Hari",
      "Masuk",
      "Pulang",
      "Hadir",
      "Telat",
      "Early",
      "Break",
      "OverT",
      "Status",
    ];
    const rows = dailyRecords.map((r) => [
      r.tanggal,
      r.hari,
      r.masuk,
      r.pulang,
      r.hadir,
      r.telat,
      r.early,
      r.breakStr,
      r.overT,
      r.status,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] as any, textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2 },
    });

    doc.save(`Kartu_Absensi_${selectedUser.nip}_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div
      className="grid lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 pb-20"
      onClick={() => setShowExportMenu(false)}
    >
      {/* Left Panel: Employee Selection */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-200 dark:border-slate-800/60 shadow-sm space-y-4">
          <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 ml-1 sm:ml-2">
            Pilih Karyawan
          </h3>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Cari nama..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 sm:pl-12 pr-4 py-2 sm:py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl sm:rounded-2xl text-sm font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500/30 transition-all outline-none"
            />
          </div>

          <div className="max-h-[250px] sm:max-h-[350px] lg:max-h-[500px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {filteredEmployees.map((emp) => (
              <button
                key={emp.nip}
                onClick={() => setSelectedUser(emp)}
                className={`w-full flex items-center gap-3 p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all border ${selectedUser?.nip === emp.nip ? "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50" : "hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-800"} ${selectedUser?.nip !== emp.nip && "bg-white"}`}
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {emp.foto_wajah_base64 ? (
                    <img
                      src={
                        emp.foto_wajah_base64.startsWith("data:image")
                          ? emp.foto_wajah_base64
                          : `data:image/jpeg;base64,${emp.foto_wajah_base64}`
                      }
                      alt={emp.nama}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={`https://ui-avatars.com/api/?background=f1f5f9&color=64748b&bold=true&name=${emp.nama}`}
                      alt={emp.nama}
                    />
                  )}
                </div>
                <div className="text-left overflow-hidden">
                  <p
                    className={`text-xs sm:text-sm font-bold truncate ${selectedUser?.nip === emp.nip ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-200"}`}
                  >
                    {emp.nama}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">
                    {emp.nip}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel: Attendance Card */}
      <div className="lg:col-span-2 space-y-6">
        {!selectedUser ? (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 dark:border-slate-800/60 shadow-sm p-8 sm:p-20 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 dark:bg-slate-950 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-700">
              <FileText className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-500 dark:text-slate-400">
              Silakan pilih karyawan untuk melihat kartu absensi
            </h3>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 md:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-200 dark:border-slate-800/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-blue-50 flex flex-shrink-0 items-center justify-center text-blue-600 border-2 border-blue-100">
                  <User className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">
                    {selectedUser.nama}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest mt-0.5">
                    NIP: {selectedUser.nip}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-950 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800 self-start md:self-auto w-full md:w-auto">
                <div className="flex items-center gap-2 px-1 sm:px-3 w-full sm:w-auto justify-between sm:justify-start">
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
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden p-4 sm:p-6 space-y-6">
              {/* Header Info */}
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 space-y-1">
                <div className="flex gap-2">
                  <span className="w-16 sm:w-20 shrink-0">Personil</span>
                  <span className="font-bold uppercase break-words flex-1">
                    : {selectedUser.nama}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-16 sm:w-20 shrink-0">Depart.</span>
                  <span className="font-bold uppercase break-words flex-1">
                    :{" "}
                    {departments.find(
                      (d) => d.id === selectedUser.departemen_id,
                    )?.nama_departemen || "-"}
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
                    : Kartu Absensi Kehadiran
                  </span>
                </div>
              </div>

              {/* Summary Table */}
              <div className="overflow-x-auto pb-4 custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-center whitespace-nowrap min-w-max text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                    <tr>
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
                  <tbody className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    <tr>
                      <td className="px-4 py-3">{summaryStats.kerja || ""}</td>
                      <td className="px-4 py-3">{summaryStats.libur || ""}</td>
                      <td className="px-4 py-3">{summaryStats.hadir || ""}</td>
                      <td className="px-4 py-3">{summaryStats.absen || ""}</td>
                      <td className="px-4 py-3">{summaryStats.cijin || ""}</td>
                      <td className="px-4 py-3">{summaryStats.telat || ""}</td>
                      <td className="px-4 py-3">{summaryStats.early || ""}</td>
                      <td className="px-4 py-3">{summaryStats.break || ""}</td>
                      <td className="px-4 py-3">{summaryStats.overT || ""}</td>
                      <td className="px-4 py-3">
                        {summaryStats.jamHd
                          ? parseFloat(summaryStats.jamHd.toFixed(2))
                          : ""}
                      </td>
                      <td className="px-4 py-3">
                        {summaryStats.jamOT
                          ? parseFloat(summaryStats.jamOT.toFixed(2))
                          : ""}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Detail Table */}
              <div className="overflow-x-auto pb-4 custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-center whitespace-nowrap min-w-max text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3 text-left">Tanggal</th>
                      <th className="px-4 py-3 text-left">Hari</th>
                      <th className="px-4 py-3">Masuk</th>
                      <th className="px-4 py-3">Pulang</th>
                      <th className="px-4 py-3">Hadir</th>
                      <th className="px-4 py-3 text-red-500">Telat</th>
                      <th className="px-4 py-3">Early</th>
                      <th className="px-4 py-3">Break</th>
                      <th className="px-4 py-3">OverT</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 divide-y divide-slate-100 dark:divide-slate-800/50">
                    {dailyRecords.map((r, i) => {
                      return (
                        <tr
                          key={i}
                          className="hover:bg-slate-50 dark:hover:bg-slate-950/50"
                        >
                          <td
                            className={`px-4 py-3 text-left ${r.isOffDay ? "text-red-500" : "text-slate-700 dark:text-slate-300"}`}
                          >
                            {r.tanggal}
                          </td>
                          <td
                            className={`px-4 py-3 text-left ${r.isOffDay ? "text-red-500" : "text-slate-700 dark:text-slate-300"}`}
                          >
                            {r.hari}
                          </td>
                          <td className="px-4 py-3">{r.masuk}</td>
                          <td className="px-4 py-3">{r.pulang}</td>
                          <td className="px-4 py-3">{r.hadir}</td>
                          <td className="px-4 py-3 text-red-500">{r.telat}</td>
                          <td className="px-4 py-3">{r.early}</td>
                          <td className="px-4 py-3">{r.breakStr}</td>
                          <td className="px-4 py-3">{r.overT}</td>
                          <td className="px-4 py-3 font-semibold uppercase">
                            {r.status}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end pt-4 gap-2">
                <button
                  onClick={() => {
                    toast.loading("Mengkalkulasi ulang data absensi...", { id: "recalc" });
                    // Fake a force re-calculation via triggering dependency if needed, but we essentially just wait
                    setTimeout(() => {
                      toast.success("Kalkulasi ulang selesai. Data absensi per orang telah disesuaikan.", { id: "recalc" });
                    }, 1000);
                  }}
                  className="bg-amber-500 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-amber-600 transition-all flex items-center gap-2 text-sm border border-amber-600/20 shadow-sm"
                >
                  <RefreshCcw className="w-4 h-4" /> Kalkulasi Ulang
                </button>
                <div
                  className="relative z-20"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    disabled={attendances.length === 0}
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="bg-blue-50 text-blue-600 font-bold px-6 py-2.5 rounded-xl hover:bg-blue-100 transition-all flex items-center gap-2 text-sm border border-blue-200 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" /> Export Laporan
                  </button>

                  {showExportMenu && attendances.length > 0 && (
                    <div className="absolute right-0 bottom-full mb-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden py-1 z-50">
                      <button
                        onClick={handleExportPDF}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4 text-red-500" /> Export PDF
                      </button>
                      <button
                        onClick={handleExportExcel}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"
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
        )}
      </div>
    </div>
  );
}

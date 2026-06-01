import { useState, useEffect } from "react";
import { useMasterData } from "../store/useMasterData";
import { checkIsDayOff, toLocalDateString } from "../lib/utils";

export interface DashboardStats {
  hadir: number;
  alpha: number;
  izin: number;
  telat: number;
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({ hadir: 0, alpha: 0, izin: 0, telat: 0 });
  const { employees, attendances, departments, cycles, holidays, activeCompanyId } = useMasterData();

  useEffect(() => {
    let hadirCount = 0;
    let izinCount = 0;
    let telatCount = 0;
    let alphaCount = 0;

    const resetTimeStr = localStorage.getItem(`live_reset_time_${activeCompanyId}`) || "00:00";
    const [resetHour, resetMinute] = resetTimeStr.split(":").map(Number);
    const resetOffsetMs = (resetHour * 60 + resetMinute) * 60 * 1000;
    const logicalNow = new Date(new Date().getTime() - resetOffsetMs);

    const isDayOff = (dateObj: Date, deptId?: number) => {
      const dateStr = toLocalDateString(dateObj);
      const isHoliday = holidays.some(h => h.tanggal === dateStr);
      return isHoliday || checkIsDayOff(dateObj, deptId, departments, cycles);
    };

    const logsByNip = new Map<string, any[]>();
    attendances.forEach(l => {
      if (!logsByNip.has(l.nip)) logsByNip.set(l.nip, []);
      logsByNip.get(l.nip)!.push(l);
    });

    employees.forEach((emp) => {
      let empLogs = logsByNip.get(emp.nip) || [];
      if (empLogs.length > 1) {
        empLogs = [...empLogs].sort(
          (a, b) => new Date(a.waktu_masuk.replace(' ', 'T')).getTime() - new Date(b.waktu_masuk.replace(' ', 'T')).getTime()
        );
      }

      const firstMasuk = empLogs.find((l) => l.tipe === "MASUK");
      const hasPresence = empLogs.some((l) => ['MASUK', 'PULANG', 'KEMBALI', 'KELUAR', 'LEMBUR_MASUK', 'LEMBUR_KELUAR'].includes(l.tipe));
      const firstIzin = empLogs.find(
        (l) => ["IJIN", "SAKIT", "CUTI", "LUPA_ABSEN"].includes(l.tipe) && Number(l.status_acc) === 1,
      );

      const isOff = isDayOff(logicalNow, emp.departemen_id);

      if (firstIzin) {
        izinCount++;
      } else if (hasPresence && !isOff) {
        hadirCount++;
        if (firstMasuk && (firstMasuk.late_minutes ?? 0) > 0) {
          telatCount++;
        }
      } else {
        if (!isOff) {
          alphaCount++;
        }
      }
    });

    setStats({
      hadir: hadirCount,
      alpha: alphaCount,
      izin: izinCount,
      telat: telatCount,
    });
  }, [employees, attendances, departments, cycles, holidays, activeCompanyId]);

  return { stats, setStats };
}

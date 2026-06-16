let timeDrift = 0; // clientTime - serverTime

export async function syncTime() {
  try {
    const start = Date.now();
    // Use Supabase backend for time to avoid third-party rate limits (like worldtimeapi)
    const envUrl = (typeof process !== 'undefined' && process?.env?.VITE_SUPABASE_URL) || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '';
    const supabaseUrl = envUrl.includes('absensikita.id') ? 'https://urvzweahwbbwvtkyrscd.supabase.co' : (envUrl || 'https://urvzweahwbbwvtkyrscd.supabase.co');
    const supabaseKey = (typeof process !== 'undefined' && process?.env?.VITE_SUPABASE_ANON_KEY) || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "HEAD",
      headers: supabaseKey
        ? { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        : {},
    });
    const dateHeader = res.headers.get("date");

    if (dateHeader) {
      const serverTime = new Date(dateHeader).getTime();
      const end = Date.now();
      const latency = (end - start) / 2;
      timeDrift = Date.now() - (serverTime + latency);
      console.log(`Time synchronized via Supabase. Drift: ${timeDrift}ms`);
    } else {
      // Fallback if no date header
      console.debug("Time sync fallback to local");
      timeDrift = 0;
    }
  } catch (e) {
    console.debug("Time sync offline");
  }
}

export function getSyncedDate(): Date {
  return new Date(Date.now() - timeDrift);
}

/**
 * Safe JSON parse that doesn't throw errors
 * @param jsonString The string to parse
 * @param fallback Fallback value if parsing fails
 */
export function safeJsonParse<T>(
  jsonString: string | null | undefined,
  fallback: T,
): T {
  if (!jsonString || jsonString === "undefined") return fallback;
  try {
    return JSON.parse(jsonString) as T;
  } catch (e) {
    console.error("JSON parse error:", e, "for string:", jsonString);
    return fallback;
  }
}

/**
 * Calculate distance between two GPS coordinates in meters
 */
export function toLocalISOString(date: Date): string {
  const tzo = -date.getTimezoneOffset();
  const dif = tzo >= 0 ? "+" : "-";
  const pad = (num: number) => (num < 10 ? "0" : "") + num;

  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes()) +
    ":" +
    pad(date.getSeconds()) +
    dif +
    pad(Math.floor(Math.abs(tzo) / 60)) +
    ":" +
    pad(Math.abs(tzo) % 60)
  );
}

export function toLocalDateString(date: Date): string {
  const pad = (num: number) => (num < 10 ? "0" : "") + num;
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate())
  );
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

export function calculateLateMinutes(pMasuk: any, shift: any): number {
  if (!pMasuk || !shift || !shift.jam_masuk || shift.rule === 2 || shift.rule === 4) {
    return pMasuk?.late_minutes || 0;
  }
  const shiftStartInMinutes = timeToMinutes(shift.jam_masuk);
  const tolerance = shift.late_tolerance || 0;
  const pDate = new Date(pMasuk.waktu_masuk.replace(" ", "T"));
  const currentInMinutes = pDate.getHours() * 60 + pDate.getMinutes();
  
  if (currentInMinutes > (shiftStartInMinutes + tolerance)) {
      return currentInMinutes - shiftStartInMinutes;
  }
  return 0;
}

export function evaluateAttendanceStatus(
  pMasuk: any,
  pPulang: any,
  shift: any,
  companySettings: any,
) {
  let isHadir = false;
  let isSetengahHari = false;
  let isTelat = false;
  let isPulangAwal = false;
  let isAlpha = false;

  // Dynamic late minutes calculation
  if (pMasuk && shift && shift.jam_masuk && shift.rule !== 2 && shift.rule !== 4) {
      if (!pMasuk.late_minutes_recalculated) {
          pMasuk.late_minutes = calculateLateMinutes(pMasuk, shift);
          pMasuk.late_minutes_recalculated = true;
      }
  }

  const isSetengahHariRule = companySettings?.enable_half_day_rule ?? false;
  const harusIn = shift?.harus_clock_in ?? true;
  const harusOut = shift?.harus_clock_out ?? true;
  const actionNoIn = shift?.no_clock_in_action || "TELAT_MASUK";
  const actionNoOut = shift?.no_clock_out_action || "PULANG_AWAL";

  if (!pMasuk && !pPulang) {
      return {
        isHadir: false,
        isSetengahHari: false,
        isTelat: false,
        isPulangAwal: false,
        isAlpha: true,
      };
  }

  if (!pMasuk && harusIn) {
    if (actionNoIn === "ALPHA") isAlpha = true;
    else if (actionNoIn === "TELAT_MASUK") isTelat = true;
    else if (actionNoIn === "PULANG_AWAL") isPulangAwal = true;
  }
  
  if (!pPulang && harusOut) {
    if (actionNoOut === "ALPHA") isAlpha = true;
    else if (actionNoOut === "TELAT_MASUK") isTelat = true;
    else if (actionNoOut === "PULANG_AWAL") isPulangAwal = true;
  }

  if (
    pMasuk && shift &&
    (pMasuk.late_minutes ?? 0) > (shift.telat_lebih_mins ?? 99999)
  ) {
    if (shift.telat_lebih_action === "ALPHA" || !shift.telat_lebih_action)
      isAlpha = true;
  }

  if (shift && !shift.isAuto && shift.jam_pulang && pPulang) {
    const shiftPulangMins = timeToMinutes(shift.jam_pulang);
    const pDate = new Date(pPulang.waktu_masuk.replace(" ", "T"));
    const actualPulangMins = pDate.getHours() * 60 + pDate.getMinutes();
    if (actualPulangMins < shiftPulangMins) {
      const awalMins = shiftPulangMins - actualPulangMins;
      
      if (awalMins > (shift.pulang_awal_tolerance || 0)) {
         isPulangAwal = true;
      }

      if (awalMins > (shift.pulang_awal_lebih_mins ?? 99999)) {
        if (
          shift.pulang_awal_lebih_action === "ALPHA" ||
          !shift.pulang_awal_lebih_action
        )
          isAlpha = true;
      }
    }
  }

  if (pMasuk && (pMasuk.late_minutes ?? 0) > 0) isTelat = true;

  let assumed_late_minutes = pMasuk?.late_minutes || 0;
  if (!pMasuk && harusIn && actionNoIn === "TELAT_MASUK") {
      assumed_late_minutes = shift?.no_clock_in_mins || 0;
  }

  if (isAlpha) {
     isTelat = false;
  } else {
    if (pMasuk && pPulang) {
      isHadir = true;
    } else {
      if (isSetengahHariRule) {
        isSetengahHari = true;
      } else {
        isHadir = true;
      }
    }
  }

  return { isHadir, isSetengahHari, isTelat, isPulangAwal, isAlpha, assumed_late_minutes };
}

/**
 * Calculate overtime index based on overtime matrix rules
 */
export function calculateOvertimeIndex(
  actualMinutes: number,
  isHoliday: boolean,
  matrix: any[],
): number {
  if (!matrix || matrix.length === 0) {
    return actualMinutes / 60; // fallback to raw hours
  }

  const tipeHari = isHoliday ? "LIBUR" : "KERJA";
  const relevantMatrix = matrix
    .filter((m) => m.tipe_hari === tipeHari)
    .sort((a, b) => a.jam_ke - b.jam_ke);

  if (relevantMatrix.length === 0) {
    return actualMinutes / 60;
  }

  let totalIndex = 0;
  let remainingMinutes = actualMinutes;
  let currentHour = 1;

  while (remainingMinutes > 0) {
    const minutesToCalculate = Math.min(60, remainingMinutes);

    // Find the multiplier for the current hour, or use the last available one
    const matrixEntry =
      relevantMatrix.find((m) => m.jam_ke === currentHour) ||
      relevantMatrix[relevantMatrix.length - 1];
    const multiplier = matrixEntry.pengali;

    totalIndex += (minutesToCalculate / 60) * multiplier;

    remainingMinutes -= 60;
    currentHour++;
  }

  return totalIndex;
}

/**
 * Ensures a base64 image string has the correct data URL prefix
 */
export function getLogoSrc(base64Str?: string | null): string | undefined {
  if (!base64Str) return undefined;
  if (base64Str.startsWith("data:")) return base64Str;

  if (base64Str.startsWith("/9j/"))
    return `data:image/jpeg;base64,${base64Str}`;
  if (base64Str.startsWith("iVBORw"))
    return `data:image/png;base64,${base64Str}`;
  if (base64Str.startsWith("R0lGOD"))
    return `data:image/gif;base64,${base64Str}`;
  if (base64Str.startsWith("UklGR"))
    return `data:image/webp;base64,${base64Str}`;

  // Default fallback for unknown base64
  return `data:image/png;base64,${base64Str}`;
}

export function checkIsDayOff(
  dateObj: Date,
  deptId: number | undefined | null,
  departments: any[],
  cycles: any[],
): boolean {
  const shift = getShiftForDate(dateObj, deptId, departments, cycles, []);
  if (shift === null) return true; // No shift assigned = off day
  return false;
}

export function getShiftForDate(
  dateObj: Date,
  deptId: number | undefined | null,
  departments: any[],
  cycles: any[],
  shifts: any[],
): any | null {
  if (!deptId) return null;
  const dept = departments.find((d: any) => d.id === deptId);
  if (!dept) return null;

  if (dept.calculation_rule === 4) return { isAuto: true, rule: 4 }; // flexible auto

  if (dept.calculation_rule === 1 && dept.siklus_id) {
    const sik = cycles.find((c: any) => c.id === dept.siklus_id);
    if (sik) {
      const isWeekly =
        sik.tipe_periode === "Mingguan" || sik.tipe_periode === "WEEKLY";
      if (isWeekly) {
        try {
          const parsed = JSON.parse(sik.auto_shift_ids || "{}");
          const dayNum = dateObj.getDay();
          const config = parsed[dayNum] || parsed[String(dayNum)];
          if (config && config.enabled && config.shift_id) {
            return {
              ...(shifts.find((s) => s.id === config.shift_id) || {
                id: config.shift_id,
                isPlaceholder: true,
              }),
              rule: 1,
            };
          }
        } catch (e) {}
        return null; // Disabled day
      } else {
        try {
          const shiftIds = JSON.parse(sik.auto_shift_ids || "[]");
          if (Array.isArray(shiftIds) && shiftIds.length > 0) {
            const daysSinceEpoch = Math.floor(
              Date.UTC(
                dateObj.getFullYear(),
                dateObj.getMonth(),
                dateObj.getDate(),
              ) / 86400000,
            );
            const cycleDay = Math.abs(daysSinceEpoch) % shiftIds.length;
            const targetShiftId = shiftIds[cycleDay];
            if (!targetShiftId) return null;
            return {
              ...(shifts.find((s) => s.id === targetShiftId) || {
                id: targetShiftId,
                isPlaceholder: true,
              }),
              rule: 1,
            };
          }
        } catch (e) {}
      }
    }
  }

  if (dept.calculation_rule === 2 && dept.fixed_shift_id) {
    return {
      ...(shifts.find((s) => s.id === dept.fixed_shift_id) || {
        id: dept.fixed_shift_id,
        isPlaceholder: true,
      }),
      rule: 2,
    };
  }

  // Rule 3 (FixStatus) is status based.
  if (dept.calculation_rule === 3) return { isAuto: true, rule: 3 };

  return null;
}

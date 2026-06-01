import { reqSupabase } from "./supabase";

export const processAttendanceRecord = async (cid: string, pinRaw: string, namaRaw: string, timeRaw: string, statusRaw: string | number, photo64: string | null = null) => {
    let tipeAbsen = "MASUK";
    if (["1", "PULANG", "OUT"].includes(String(statusRaw).toUpperCase())) {
      tipeAbsen = "PULANG";
    }
    const pin = String(pinRaw);
    let nama = namaRaw;
    const time3 = timeRaw.replace(" ", "T");
    const userDate = new Date(time3);
    const empResp = await reqSupabase(`/rest/v1/karyawan?company_id=eq.${cid}&nip=eq.${pin}&limit=1`);
    let emp = empResp && empResp.length > 0 ? empResp[0] : null;
    if (!emp) {
      nama = nama !== "System" && nama ? nama : `Staff ${pin}`;
      const new_emp = { company_id: cid, nip: pin, nama, role: "USER" };
      await reqSupabase("/rest/v1/karyawan", "POST", new_emp);
      const newlyCreated = await reqSupabase(`/rest/v1/karyawan?company_id=eq.${cid}&nip=eq.${pin}&limit=1`);
      if (newlyCreated && newlyCreated.length > 0) emp = newlyCreated[0];
    } else {
      nama = nama || emp.nama;
    }
    const deptId = emp?.departemen_id || null;
    let calcRule = 1;
    if (deptId) {
      const deptResp = await reqSupabase(`/rest/v1/departemen?id=eq.${deptId}&limit=1`);
      if (deptResp && deptResp.length > 0 && deptResp[0].calculation_rule) {
        calcRule = deptResp[0].calculation_rule;
      }
    }
    const recentLimit = new Date(userDate.getTime() - 6e4).toISOString();
    const existResp = await reqSupabase(`/rest/v1/absensi?company_id=eq.${cid}&nip=eq.${pin}&tipe=eq.${tipeAbsen}&waktu_masuk=gte.${recentLimit}&waktu_masuk=lte.${time3}&limit=1`);
    if (existResp && existResp.length > 0) {
      return;
    }
    const timeToMinutes = (timeStr: string) => {
      if (!timeStr) return 0;
      const clean = timeStr.trim().toUpperCase();
      const parts = clean.split(/\s+/);
      const timePart = parts[0];
      const ampm = parts[1];
      let [h, m] = timePart.split(":").map(Number);
      if (isNaN(h)) return 0;
      if (isNaN(m)) m = 0;
      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      return h * 60 + m;
    };
    let lateMinutes = 0;
    if (deptId) {
      const shiftResp = await reqSupabase(`/rest/v1/shift_schedules?departemen_id=eq.${deptId}`);
      if (shiftResp && shiftResp.length > 0) {
        const shifts = shiftResp;
        const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const dayStr = dayNames[userDate.getDay()];
        const currentInMinutes = userDate.getHours() * 60 + userDate.getMinutes();
        let activeShift = null;
        if (calcRule === 1 || calcRule === 4) {
          activeShift = shifts.find((s: any) => s.hari === dayStr && !s.isAuto);
        } else if (calcRule === 3) {
          const todayShifts = shifts.filter((s: any) => s.hari === dayStr && s.isAuto);
          if (todayShifts.length > 0) {
            let closest = todayShifts[0];
            let minDiff = 999999;
            for (let s of todayShifts) {
              const startMins = timeToMinutes(s.jam_masuk);
              const diff = Math.abs(currentInMinutes - startMins);
              if (diff < minDiff) {
                minDiff = diff;
                closest = s;
              }
            }
            activeShift = closest;
          }
        }
        const dateOnlyStr = time3.substring(0, 10);
        const todayLogs = await reqSupabase(`/rest/v1/absensi?company_id=eq.${cid}&nip=eq.${pin}&waktu_masuk=gte.${dateOnlyStr}T00:00:00&waktu_masuk=lte.${dateOnlyStr}T23:59:59&select=tipe,waktu_masuk`);
        if (tipeAbsen === "MASUK" && (calcRule === 1 || calcRule === 3)) {
          if (todayLogs && todayLogs.length > 0) {
            const hasMasuk = todayLogs.some((l: any) => l.tipe === "MASUK");
            if (hasMasuk) {
              tipeAbsen = "PULANG";
            }
          }
        }
        if (activeShift && tipeAbsen === "MASUK" && (calcRule === 1 || calcRule === 3)) {
          const shiftStartInMinutes = timeToMinutes(activeShift.jam_masuk);
          const tolerance = activeShift.late_tolerance || 0;
          if (currentInMinutes > shiftStartInMinutes + tolerance) {
            lateMinutes = currentInMinutes - shiftStartInMinutes;
          }
        }
      }
    }
    const data: any = {
      company_id: cid,
      nip: pin,
      nama,
      tipe: tipeAbsen,
      waktu_masuk: time3,
      late_minutes: lateMinutes || 0,
      keterangan: "Mesin Absensi"
    };
    if (photo64) {
      data.image = `data:image/jpeg;base64,${photo64}`;
    }
    await reqSupabase("/rest/v1/absensi", "POST", data);
  };

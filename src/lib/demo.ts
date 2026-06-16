import { supabase } from "./supabase";

export const generateDemoDataIfNeeded = async () => {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Get the latest attendance date
    const { data: latestAbsen } = await supabase
      .from('absensi')
      .select('waktu_masuk')
      .eq('company_id', 'DEMO-123')
      .order('waktu_masuk', { ascending: false })
      .limit(1);

    let startDate = new Date();
    startDate.setDate(startDate.getDate() - 60); // Default up to 60 days of history
    startDate.setHours(0, 0, 0, 0);

    if (latestAbsen && latestAbsen.length > 0) {
      const rawVal = latestAbsen[0].waktu_masuk; const lastDate = typeof rawVal === 'string' ? new Date(rawVal.replace(' ', 'T')) : new Date(rawVal);
      startDate = new Date(lastDate);
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(0,0,0,0);
    }
    
    const todayNormalized = new Date();
    todayNormalized.setHours(0, 0, 0, 0);

    const baseNames = ["Ahmad Faiz", "Siti Aminah", "Budi Santoso", "Dewi Lestari", "Eko Prasetyo", "Fitri Handayani", "Gilang Ananta", "Hana Pertiwi", "Indra Wijaya", "Joko Wibowo", "Kiki Amalia", "Lilis Setiawati", "Rudi Hartono", "Nia Ramadhani", "Rian Saputra", "Putri Permatasari", "Surya Dharma", "Tari Utami", "Bagas Saputra", "Vina Panduwinata", "Wahyu Hidayat", "Yulia Citra", "Zizi Kirana", "Fajar Nugraha", "Ratna Sari"];
    
    // 1. Create Shifts
    const { data: existingShifts } = await supabase.from('shifts').select('*').eq('company_id', 'DEMO-123');
    
    let shiftPagiId = existingShifts?.find(s => s.nama_shift === 'Shift Pagi')?.id;
    let shiftSiangId = existingShifts?.find(s => s.nama_shift === 'Shift Siang')?.id;
    let shiftMalamId = existingShifts?.find(s => s.nama_shift === 'Shift Malam')?.id;

    if (!shiftPagiId) {
      const { data } = await supabase.from('shifts').insert({
        company_id: 'DEMO-123', nama_shift: 'Shift Pagi', jam_masuk: '08:00:00', jam_pulang: '17:00:00',
        awal_masuk: '06:00:00', akhir_masuk: '09:00:00', awal_pulang: '16:00:00', akhir_pulang: '20:00:00', 
        late_tolerance: 15, pulang_awal_tolerance: 0, work_day: 1, work_time: 480, is_cross_day: false
      }).select();
      if(data) shiftPagiId = data[0].id;
    }
    if (!shiftSiangId) {
      const { data } = await supabase.from('shifts').insert({
        company_id: 'DEMO-123', nama_shift: 'Shift Siang', jam_masuk: '13:00:00', jam_pulang: '21:00:00',
        awal_masuk: '11:00:00', akhir_masuk: '14:00:00', awal_pulang: '20:00:00', akhir_pulang: '23:00:00', 
        late_tolerance: 15, pulang_awal_tolerance: 0, work_day: 1, work_time: 480, is_cross_day: false
      }).select();
      if(data) shiftSiangId = data[0].id;
    }
    if (!shiftMalamId) {
      const { data } = await supabase.from('shifts').insert({
        company_id: 'DEMO-123', nama_shift: 'Shift Malam', jam_masuk: '21:00:00', jam_pulang: '05:00:00',
        awal_masuk: '19:00:00', akhir_masuk: '22:00:00', awal_pulang: '04:00:00', akhir_pulang: '08:00:00', 
        late_tolerance: 15, pulang_awal_tolerance: 0, work_day: 1, work_time: 480, is_cross_day: true
      }).select();
      if(data) shiftMalamId = data[0].id;
    }

    // 2. Create Cycles
    const { data: existingCycles } = await supabase.from('siklus_shift').select('*').eq('company_id', 'DEMO-123');
    let siklusNormalId = existingCycles?.find(c => c.nama_siklus === 'Siklus Normal')?.id;
    let siklusPuterId = existingCycles?.find(c => c.nama_siklus === 'Siklus Putar (Pagi-Siang-Malam)')?.id;

    if (!siklusNormalId) {
      const { data } = await supabase.from('siklus_shift').insert({
        company_id: 'DEMO-123', kode_siklus: 'NRML', nama_siklus: 'Siklus Normal', tipe_periode: 'Mingguan', periode_angka: 1,
        auto_shift_ids: JSON.stringify({
          1: { enabled: true, shift_id: shiftPagiId },
          2: { enabled: true, shift_id: shiftPagiId },
          3: { enabled: true, shift_id: shiftPagiId },
          4: { enabled: true, shift_id: shiftPagiId },
          5: { enabled: true, shift_id: shiftPagiId },
          6: { enabled: true, shift_id: shiftPagiId },
          0: { enabled: false, shift_id: '' }
        })
      }).select();
      if(data) siklusNormalId = data[0].id;
    }
    if (!siklusPuterId) {
      const { data } = await supabase.from('siklus_shift').insert({
        company_id: 'DEMO-123', kode_siklus: 'PTR', nama_siklus: 'Siklus Putar (Pagi-Siang-Malam)', tipe_periode: 'DAYS', periode_angka: 3,
        auto_shift_ids: JSON.stringify([shiftPagiId, shiftSiangId, shiftMalamId])
      }).select();
      if(data) siklusPuterId = data[0].id;
    }

    // 3. Ensure departments exist and link them properly
    const { data: deptsData } = await supabase.from('departemen').select('*').eq('company_id', 'DEMO-123');
    let dept1Id = deptsData?.find(d => d.nama_departemen === 'Kantor Pusat')?.id;
    let dept2Id = deptsData?.find(d => d.nama_departemen === 'Tim Gudang (Fleks)')?.id;
    let dept3Id = deptsData?.find(d => d.nama_departemen === 'Tim Keamanan (Siklus)')?.id;
    let dept4Id = deptsData?.find(d => d.nama_departemen === 'Tim Support (Siklus Mingguan)')?.id;

    if (!dept1Id) {
      const { data } = await supabase.from('departemen').insert({
        nama_departemen: 'Kantor Pusat', company_id: 'DEMO-123', calculation_rule: 2, fixed_shift_id: shiftPagiId
      }).select();
      if(data) dept1Id = data[0].id;
    } else {
      await supabase.from('departemen').update({ fixed_shift_id: shiftPagiId, calculation_rule: 2 }).eq('id', dept1Id);
    }

    if (!dept2Id) {
      const { data } = await supabase.from('departemen').insert({
        nama_departemen: 'Tim Gudang (Fleks)', company_id: 'DEMO-123', calculation_rule: 3, jam_kerja_wajib: 8, auto_shift_ids: JSON.stringify([shiftPagiId, shiftSiangId, shiftMalamId])
      }).select();
      if(data) dept2Id = data[0].id;
    } else {
      await supabase.from('departemen').update({ calculation_rule: 3, jam_kerja_wajib: 8, auto_shift_ids: JSON.stringify([shiftPagiId, shiftSiangId, shiftMalamId]) }).eq('id', dept2Id);
    }

    if (!dept3Id) {
      const { data } = await supabase.from('departemen').insert({
        nama_departemen: 'Tim Keamanan (Siklus)', company_id: 'DEMO-123', calculation_rule: 1, siklus_id: siklusPuterId
      }).select();
      if(data) dept3Id = data[0].id;
    } else {
      await supabase.from('departemen').update({ calculation_rule: 1, siklus_id: siklusPuterId }).eq('id', dept3Id);
    }

    if (!dept4Id) {
      const { data } = await supabase.from('departemen').insert({
        nama_departemen: 'Tim Support (Siklus Mingguan)', company_id: 'DEMO-123', calculation_rule: 1, siklus_id: siklusNormalId
      }).select();
      if(data) dept4Id = data[0].id;
    } else {
      await supabase.from('departemen').update({ calculation_rule: 1, siklus_id: siklusNormalId }).eq('id', dept4Id);
    }

    const deptIds = [dept1Id, dept2Id, dept3Id, dept4Id].filter(Boolean);
    const getDeptId = (index: number) => deptIds[index % deptIds.length];

    // Ensure a demo active machine exists
    const { data: existingConnections } = await supabase.from('adms_connections').select('sn_mesin').eq('company_id', 'DEMO-123');
    if (!existingConnections || existingConnections.length === 0) {
       await supabase.from('adms_connections').insert([
          { 
             company_id: 'DEMO-123', 
             sn_mesin: 'DEMO-MACHINE-X1', 
             ip_mesin: '192.168.1.101',
             status: 'REGISTERED',
             merk_tipe: 'Mesin Absensi (ADMS)',
             timezone: 'Asia/Jakarta',
             realtime: new Date().toISOString()
          }
       ]);
    } else {
       // Just update the realtime ping
       await supabase.from('adms_connections')
          .update({ realtime: new Date().toISOString() })
          .eq('company_id', 'DEMO-123');
    }

    // Insert holidays for the last couple of months to align with demo data
    const curYear = new Date().getFullYear();
    const curMonth = new Date().getMonth() + 1;
    const pastMonth = curMonth === 1 ? 12 : curMonth - 1;
    const pastMonthYear = curMonth === 1 ? curYear - 1 : curYear;
    
    // Check if holidays already generated
    const { data: existingHols } = await supabase.from('hari_libur').select('id').eq('company_id', 'DEMO-123').limit(1);
    if (!existingHols || existingHols.length === 0) {
        await supabase.from('hari_libur').insert([
            { company_id: 'DEMO-123', tanggal: `${curYear}-${String(curMonth).padStart(2, '0')}-01`, nama_libur: 'Awal Bulan Demo Holiday 1' },
            { company_id: 'DEMO-123', tanggal: `${curYear}-${String(curMonth).padStart(2, '0')}-17`, nama_libur: 'Pertengahan Bulan Demo Holiday 2' },
            { company_id: 'DEMO-123', tanggal: `${pastMonthYear}-${String(pastMonth).padStart(2, '0')}-01`, nama_libur: 'Awal Bulan Demo Holiday (Bulan Lalu)' },
            { company_id: 'DEMO-123', tanggal: `${pastMonthYear}-${String(pastMonth).padStart(2, '0')}-17`, nama_libur: 'Pertengahan Bulan Demo Holiday (Bulan Lalu)' }
        ]);
    }

    let karyawans = [
      { nip: 'DEMO-ADMIN', nama: 'Admin Demo', role: 'SUPER ADMIN', deptIdx: 0, admin_permissions: "dashboard,log,karyawan,izin,jam_kerja,jam_break,hari_libur,siklus,departemen,kartu,rekap,total,payroll,maintenance,pengaturan" },
      { nip: 'DEMO-BOT', nama: 'Super Smart Bot 🤖', role: 'USER', deptIdx: 0, admin_permissions: "dashboard,chat" }
    ];
    for (let i = 0; i < 100; i++) {
        const baseName = baseNames[i % baseNames.length];
        const suffix = i >= baseNames.length ? ` ${Math.floor(i / baseNames.length) + 1}` : "";
        karyawans.push({ nip: `DEMO-USER${i+1}`, nama: `${baseName}${suffix}`, role: 'USER', deptIdx: i, admin_permissions: "" });
    }

    const { data: existingUsers } = await supabase.from('karyawan').select('nip, departemen_id').eq('company_id', 'DEMO-123');
    const existingNips = new Set(existingUsers?.map(u => u.nip) || []);

    const missingKaryawans = karyawans.filter(k => !existingNips.has(k.nip)).map(k => ({
       nip: k.nip,
       nama: k.nama,
       company_id: 'DEMO-123',
       role: k.role,
       departemen_id: getDeptId(k.deptIdx),
       gaji_pokok: 3000000,
       uang_makan: 50000,
       is_biometric_enabled: true,
       admin_permissions: k.admin_permissions
    }));

    if (missingKaryawans.length > 0) {
      await supabase.from('karyawan').insert(missingKaryawans);
    }
    
    // Also update existing users to have varied departments and permissions
    const usersToUpdate = karyawans.filter(k => existingNips.has(k.nip));
    for (const u of usersToUpdate) {
        await supabase.from('karyawan').update({ 
           departemen_id: getDeptId(u.deptIdx),
           admin_permissions: u.admin_permissions 
        }).eq('nip', u.nip).eq('company_id', 'DEMO-123');
    }
    
    // Refresh the local set of users and their departments for log generation
    const { data: updatedUsers } = await supabase.from('karyawan').select('nip, departemen_id').eq('company_id', 'DEMO-123');
    // Using a map for quick lookup if needed, though we primarily use the karyawans list below

    const newAbsensis = [];

    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 60);
    defaultStartDate.setHours(0, 0, 0, 0);

    for (const k of karyawans) {
        let empStartDate = new Date(defaultStartDate);
        
        if (existingNips.has(k.nip)) {
             empStartDate = new Date(startDate); // from latestAbsen + 1
        }

        if (empStartDate > todayNormalized) continue;

        const deptType = k.deptIdx % 4; // 0: Kantor Pusat (Rule 2), 1: Fleks (Rule 3), 2: Siklus DAYS (Rule 1), 3: Siklus WEEKLY (Rule 1)

        for (let d = new Date(empStartDate); d <= todayNormalized; d.setDate(d.getDate() + 1)) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            
            const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            // Simplified logic: determine if today is a holiday (we'll simulate some random days as holiday if it's the 1st or 17th of the month)
            const isPublicHoliday = d.getDate() === 1 || d.getDate() === 17;
            const isDayOff = (deptType === 0 && isWeekend) || isPublicHoliday;

            if (isDayOff) {
                // On a day off, mostly no one works. Some might do overtime (LEMBUR)
                if (k.nip !== 'DEMO-ADMIN' && Math.random() < 0.05) {
                    const h = 9;
                    const masukStr = `09:00:00`;
                    const p_h = 16; 
                    const p_m = Math.floor(Math.random() * 30);
                    const pulangStr = `${p_h}:${p_m.toString().padStart(2, '0')}:00`;
                    
                    newAbsensis.push({
                        company_id: 'DEMO-123', nip: k.nip, nama: k.nama, tipe: 'LEMBUR_MASUK',
                        waktu_masuk: `${dateString}T${masukStr}+07:00`, late_minutes: 0, status_acc: 1
                    });
                    newAbsensis.push({
                        company_id: 'DEMO-123', nip: k.nip, nama: k.nama, tipe: 'LEMBUR_KELUAR',
                        waktu_masuk: `${dateString}T${pulangStr}+07:00`, status_acc: 1
                    });
                }
                continue; // otherwise day off is no work
            }

            if (k.nip !== 'DEMO-ADMIN') {
                const randAction = Math.random();
                if (randAction < 0.05) {
                    // Izin / Cuti / Sakit / Lupa Absen
                    const tipeIzinChoices = ['IJIN', 'SAKIT', 'CUTI', 'LUPA_ABSEN'];
                    const tipe = tipeIzinChoices[Math.floor(Math.random() * tipeIzinChoices.length)];
                    newAbsensis.push({
                        company_id: 'DEMO-123', nip: k.nip, nama: k.nama, tipe: tipe,
                        waktu_masuk: `${dateString}T08:00:00+07:00`, status_acc: 1,
                        keterangan: tipe === 'LUPA_ABSEN' ? 'Lupa absen masuk' : `Testing bot ${tipe.toLowerCase()}`
                    });
                    continue;
                } else if (deptType === 0 && randAction < 0.08) {
                    // Alpha (tidak absen sama sekali)
                    continue;
                }
            }

            // Determine check in/out time based on department heuristics
            let baseHMasuk = 8;
            let baseHPulang = 17;
            let isCrossDay = false;

            const isVariabelShift = deptType !== 0; // Fleks and Siklus have varied shifts

            if (isVariabelShift) {
              const randShift = Math.random();
              if (randShift < 0.33) {
                 // Pagi
                 baseHMasuk = 8; baseHPulang = 17;
              } else if (randShift < 0.66) {
                 // Siang
                 baseHMasuk = 13; baseHPulang = 21;
              } else {
                 // Malam
                 baseHMasuk = 21; baseHPulang = 5;
                 isCrossDay = true;
              }
            }

            const isLate = k.nip !== 'DEMO-ADMIN' ? Math.random() > 0.7 : false;
            const h = isLate ? baseHMasuk : Math.max(0, baseHMasuk - 1);
            const m = isLate ? Math.floor(Math.random() * 45 + 1) : Math.floor(Math.random() * 30 + 15);
            const masukStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
            const lateMinutes = isLate ? m : 0;

            const isLembur = k.nip !== 'DEMO-ADMIN' ? Math.random() > 0.8 : false;
            let p_h = isLembur ? baseHPulang + 1 + Math.floor(Math.random() * 2) : baseHPulang; 
            if (p_h >= 24) p_h -= 24;
            const p_m = Math.floor(Math.random() * 59);
            const pulangStr = `${p_h.toString().padStart(2, '0')}:${p_m.toString().padStart(2, '0')}:00`;

            // Normal masuk
            newAbsensis.push({
                company_id: 'DEMO-123',
                nip: k.nip,
                nama: k.nama,
                tipe: 'MASUK',
                waktu_masuk: `${dateString}T${masukStr}+07:00`,
                late_minutes: lateMinutes,
                status_acc: 1
            });

            // Random chance for break (KELUAR and KEMBALI)
            if (k.nip !== 'DEMO-ADMIN' && Math.random() > 0.85) {
                let diff = baseHPulang - baseHMasuk;
                if (diff < 0) diff += 24; // Cross day handling
                let break_h = baseHMasuk + Math.floor(diff / 2);
                let breakStartDayStr = dateString;
                
                if (break_h >= 24) {
                    break_h -= 24;
                    if (isCrossDay) {
                        const nextDay = new Date(d);
                        nextDay.setDate(nextDay.getDate() + 1);
                        const numMonth = nextDay.getMonth() + 1;
                        breakStartDayStr = `${nextDay.getFullYear()}-${String(numMonth).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
                    }
                }
                
                // End break 1 hour later
                let breakEndH = break_h + 1;
                let breakEndDayStr = breakStartDayStr;
                if (breakEndH >= 24) {
                    breakEndH -= 24;
                    const bEndD = new Date(breakStartDayStr);
                    bEndD.setDate(bEndD.getDate() + 1);
                    breakEndDayStr = `${bEndD.getFullYear()}-${String(bEndD.getMonth() + 1).padStart(2, '0')}-${String(bEndD.getDate()).padStart(2, '0')}`;
                }

                const breakStart = `${break_h.toString().padStart(2, '0')}:00:00`;
                const breakEnd = `${breakEndH.toString().padStart(2, '0')}:00:00`;
                
                newAbsensis.push({
                    company_id: 'DEMO-123', nip: k.nip, nama: k.nama, tipe: 'KELUAR',
                    waktu_masuk: `${breakStartDayStr}T${breakStart}+07:00`, status_acc: 1
                });
                newAbsensis.push({
                    company_id: 'DEMO-123', nip: k.nip, nama: k.nama, tipe: 'KEMBALI',
                    waktu_masuk: `${breakEndDayStr}T${breakEnd}+07:00`, status_acc: 1
                });
            }

            // Handle pulang dates (might be cross day)
            let pulangDate = new Date(d);
            if (isCrossDay) {
                pulangDate.setDate(pulangDate.getDate() + 1);
            }
            const pYear = pulangDate.getFullYear();
            const pMonth = String(pulangDate.getMonth() + 1).padStart(2, '0');
            const pDay = String(pulangDate.getDate()).padStart(2, '0');
            const pDateString = `${pYear}-${pMonth}-${pDay}`;

            newAbsensis.push({
                company_id: 'DEMO-123',
                nip: k.nip,
                nama: k.nama,
                tipe: 'PULANG',
                waktu_masuk: `${pDateString}T${pulangStr}+07:00`,
                status_acc: 1
            });
            
            // If they did overtime on a normal day, we might also record it as LEMBUR_MASUK / LEMBUR_KELUAR specifically if the rule demands
            if (isLembur && Math.random() > 0.5) {
                const otStartStr = `${baseHPulang.toString().padStart(2, '0')}:30:00`;
                newAbsensis.push({
                    company_id: 'DEMO-123', nip: k.nip, nama: k.nama, tipe: 'LEMBUR_MASUK',
                    waktu_masuk: `${pDateString}T${otStartStr}+07:00`, status_acc: 1
                });
                newAbsensis.push({
                    company_id: 'DEMO-123', nip: k.nip, nama: k.nama, tipe: 'LEMBUR_KELUAR',
                    waktu_masuk: `${pDateString}T${pulangStr}+07:00`, status_acc: 1
                });
            }
        }
    }

    if (newAbsensis.length > 0) {
       // Insert in chunks of 50 to avoid any limits
       for(let i = 0; i < newAbsensis.length; i += 50) {
           const chunk = newAbsensis.slice(i, i + 50);
           await supabase.from('absensi').insert(chunk);
       }
    }

  } catch (e) {
    console.error("Failed to generate demo data:", e);
  }
};

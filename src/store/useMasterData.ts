import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User, Attendance, Department, Shift, Cycle, Holiday, Company } from '../types';
import { toLocalISOString } from '../lib/utils';
import { toast } from 'sonner';

interface MasterDataState {
  companyInfo: Company | null;
  employees: User[];
  attendances: Attendance[];
  departments: Department[];
  shifts: Shift[];
  cycles: Cycle[];
  holidays: Holiday[];
  loading: boolean;
  activeCompanyId: string | null;

  setActiveCompanyId: (id: string | null) => void;
  loadInitialData: (companyId: string, user: User, onLogout: () => void) => Promise<void>;
  
  reloadCompanyInfo: () => Promise<void>;
  reloadEmployees: () => Promise<void>;
  reloadAttendances: () => Promise<void>;
  reloadDepartemen: () => Promise<void>;
  reloadShift: () => Promise<void>;
  reloadSiklus: () => Promise<void>;
  reloadHolidays: () => Promise<void>;

  reset: () => void;
}

export const useMasterData = create<MasterDataState>((set, get) => ({
  companyInfo: null,
  employees: [],
  attendances: [],
  departments: [],
  shifts: [],
  cycles: [],
  holidays: [],
  loading: false,
  activeCompanyId: null,

  setActiveCompanyId: (id) => set({ activeCompanyId: id }),

  reset: () => set({
    companyInfo: null,
    employees: [],
    attendances: [],
    departments: [],
    shifts: [],
    cycles: [],
    holidays: [],
  }),

  loadInitialData: async (companyId, user, onLogout) => {
    set({ loading: true });
    get().reset();
    set({ activeCompanyId: companyId });

    try {
      if (companyId) {
        const { data: comp } = await supabase
          .from("companies")
          .select("*")
          .eq("company_id", companyId)
          .single();

        if (comp) {
          set({ companyInfo: comp });
        } else if (user.role !== "MASTER_ADMIN") {
          toast.error("Perusahaan tidak ditemukan. Akun perusahaan mungkin telah dihapus.");
          onLogout();
          set({ loading: false });
          return;
        }

        await Promise.all([
          get().reloadEmployees(),
          get().reloadAttendances(),
          get().reloadDepartemen(),
          get().reloadShift(),
          get().reloadSiklus(),
          get().reloadHolidays(),
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      set({ loading: false });
    }
  },

  reloadCompanyInfo: async () => {
    const { activeCompanyId } = get();
    if (!activeCompanyId) return;
    const { data } = await supabase.from('companies').select('*').eq('company_id', activeCompanyId).single();
    if (data) set({ companyInfo: data });
  },

  reloadEmployees: async () => {
    const { activeCompanyId } = get();
    if (!activeCompanyId) return;
    const { data } = await supabase
      .from("karyawan")
      .select("*")
      .eq("company_id", activeCompanyId)
      .neq("role", "OWNER")
      .order("nama", { ascending: true });
    if (data) set({ employees: data });
  },

  reloadAttendances: async () => {
    const { activeCompanyId } = get();
    if (!activeCompanyId) return;

    const now = new Date();
    const resetTimeStr = localStorage.getItem(`live_reset_time_${activeCompanyId}`) || "00:00";
    const [resetHour, resetMinute] = resetTimeStr.split(":").map(Number);
    const resetOffsetMs = (resetHour * 60 + resetMinute) * 60 * 1000;
    const logicalNow = new Date(now.getTime() - resetOffsetMs);
    const activeDateStr = `${logicalNow.getFullYear()}-${String(logicalNow.getMonth() + 1).padStart(2, '0')}-${String(logicalNow.getDate()).padStart(2, '0')}`;

    const fetchStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const fetchStr = toLocalISOString(fetchStart).split('T')[0];

    const { data: logs } = await supabase
      .from("absensi")
      .select("*")
      .eq("company_id", activeCompanyId)
      .gte("waktu_masuk", fetchStr)
      .order("waktu_masuk", { ascending: false });

    if (logs) {
      const activeLogs = logs.filter((l: any) => {
        const d = new Date(l.waktu_masuk.replace(' ', 'T'));
        d.setTime(d.getTime() - resetOffsetMs);
        const recordDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return recordDate === activeDateStr;
      });
      set({ attendances: activeLogs });
    }
  },

  reloadDepartemen: async () => {
    const { activeCompanyId } = get();
    if (!activeCompanyId) return;
    const { data } = await supabase.from("departemen").select("*").eq("company_id", activeCompanyId);
    if (data) set({ departments: data });
  },

  reloadShift: async () => {
    const { activeCompanyId } = get();
    if (!activeCompanyId) return;
    const { data } = await supabase.from("shifts").select("*").eq("company_id", activeCompanyId);
    if (data) set({ shifts: data });
  },

  reloadSiklus: async () => {
    const { activeCompanyId } = get();
    if (!activeCompanyId) return;
    const { data } = await supabase.from("siklus_shift").select("*").eq("company_id", activeCompanyId);
    if (data) set({ cycles: data });
  },

  reloadHolidays: async () => {
    const { activeCompanyId } = get();
    if (!activeCompanyId) return;
    const { data } = await supabase.from("hari_libur").select("*").eq("company_id", activeCompanyId);
    if (data) set({ holidays: data || [] });
  },
}));

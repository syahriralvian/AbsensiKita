import { useState, useEffect, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
  Link,
} from "react-router-dom";
import {
  ShieldCheck,
  LayoutDashboard,
  Database,
  Users,
  FileCheck2,
  Clock,
  Repeat,
  Building2,
  Settings,
  Contact,
  ClipboardList,
  LogOut,
  Menu,
  CalendarDays,
  Calendar,
  X,
  User as UserIcon,
  FileText,
  Wallet,
  CreditCard,
  Smartphone,
  Server,
  Layers,
  BarChart,
  Settings2,
  RotateCcw,
  Coffee,
  Activity,
  Download,
} from "lucide-react";
import { User, Company, Attendance, Department, Shift, Cycle, Holiday } from "../types";
import { calculateDistance, toLocalISOString, toLocalDateString, getLogoSrc, checkIsDayOff } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import SidebarItem from "../components/layout/SidebarItem";
import SidebarGroup from "../components/layout/SidebarGroup";
import TopNav from "../components/layout/TopNav";

import { lazyRetry } from "../lib/lazyRetry";

import { useAutoLogout } from "../hooks/useAutoLogout";
import { usePermissions } from "../hooks/usePermissions";
import { useDashboardStats } from "../hooks/useDashboardStats";
import { useMasterData } from "../store/useMasterData";

// Tabs
const RegisteredDevicesTab = lazyRetry(() => import("../components/dashboard/RegisteredDevicesTab"));
const MonitoringTab = lazyRetry(() => import("../components/dashboard/MonitoringTab"));
const KaryawanTab = lazyRetry(() => import("../components/dashboard/KaryawanTab"));
const RecordTab = lazyRetry(() => import("../components/dashboard/RecordTab"));
const ShiftsTab = lazyRetry(() => import("../components/dashboard/ShiftsTab"));
const IzinTab = lazyRetry(() => import("../components/dashboard/IzinTab"));
const DepartmentsTab = lazyRetry(() => import("../components/dashboard/DepartmentsTab"));
const CyclesTab = lazyRetry(() => import("../components/dashboard/CyclesTab"));
const RekapTab = lazyRetry(() => import("../components/dashboard/RekapTab"));
const SettingsTab = lazyRetry(() => import("../components/dashboard/SettingsTab"));
const MaintenanceTab = lazyRetry(() => import("../components/dashboard/MaintenanceTab"));
const KartuAbsensiTab = lazyRetry(() => import("../components/dashboard/KartuAbsensiTab"));
const TotalAbsensiTab = lazyRetry(() => import("../components/dashboard/TotalAbsensiTab"));
const PayrollTab = lazyRetry(() => import("../components/dashboard/PayrollTab"));
const CompaniesTab = lazyRetry(() => import("../components/dashboard/CompaniesTab"));
const BillingTab = lazyRetry(() => import("../components/dashboard/BillingTab"));
const TagihanTab = lazyRetry(() => import("../components/dashboard/TagihanTab"));
const BreaksTab = lazyRetry(() => import("../components/dashboard/BreaksTab"));
const HolidaysTab = lazyRetry(() => import("../components/dashboard/HolidaysTab"));
const TrafficTab = lazyRetry(() => import("../components/dashboard/TrafficTab"));
const DownloadsTab = lazyRetry(() => import("../components/dashboard/DownloadsTab"));
const BlockedMachinesTab = lazyRetry(() => import("../components/dashboard/BlockedMachinesTab"));
const AutomatedTestingTab = lazyRetry(() => import("../components/dashboard/AutomatedTestingTab"));

// Modals
import AttendanceModal from "../components/AttendanceModal";
const FaceRegistrationModal = lazyRetry(() => import("../components/FaceRegistrationModal"));

import ExpirationWarningModal from "../components/ExpirationWarningModal";

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
    className="h-full"
  >
    {children}
  </motion.div>
);

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState(user.company_id);

  useEffect(() => {
    if (activeCompanyId === 'DEMO-123') {
      import('../lib/demo').then(mod => mod.generateDemoDataIfNeeded());
    }
  }, [activeCompanyId]);

  // Use Custom Hooks for Logic
  const {
    loading,
    companyInfo,
    loadInitialData,
    reloadEmployees,
    reloadAttendances,
    reloadDepartemen,
    reloadShift,
    reloadSiklus,
    reloadHolidays,
    // Add these so we can pass them as props for now to keep things working
    employees,
    attendances,
    departments,
    shifts,
    cycles,
    holidays
  } = useMasterData();

  const { hasPermission, getDefaultRoute } = usePermissions(user);
  useAutoLogout(onLogout, 15);
  const { stats } = useDashboardStats();

  // Modal States
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showFaceRegModal, setShowFaceRegModal] = useState(false);
  const [showExpirationModal, setShowExpirationModal] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);

  const [selectedUserForFace, setSelectedUserForFace] = useState<User | null>(
    null,
  );

  // Get active tab from path
  const activeTab = location.pathname.split("/")[2] || "monitor";

  // Normalize paths to prevent double segments like /dashboard/monitor/monitor
  useEffect(() => {
    const segments = location.pathname.split("/");
    if (segments.length > 3 && segments[2] === segments[3] && segments[1] === "dashboard") {
      navigate(`/dashboard/${segments[2]}`, { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    // Handling base dashboard path
    if (location.pathname === "/dashboard" || location.pathname === "/dashboard/") {
      navigate(getDefaultRoute(), { replace: true });
      return;
    }

    // Handling restricted paths for non-MASTER_ADMIN users
    if (user.role !== "MASTER_ADMIN") {
      const restrictedPaths = ["/dashboard/companies", "/dashboard/billing"];
      if (restrictedPaths.includes(location.pathname)) {
        navigate(getDefaultRoute(), { replace: true });
      }
    }
  }, [user.role, location.pathname, navigate, getDefaultRoute]);

  useEffect(() => {
    if (activeCompanyId && user) {
      loadInitialData(activeCompanyId, user, onLogout);
    }
  }, [user, activeCompanyId]);

  useEffect(() => {
    if (companyInfo?.trial_end_date && user.role !== "MASTER_ADMIN") {
      const remaining = Math.ceil(
        (new Date(companyInfo.trial_end_date).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24),
      );
      
      if (remaining <= 5) {
        setDaysRemaining(remaining);
        
        const storageKey = `expiration_popup_shown_${activeCompanyId}`;
        const hasShownInSession = sessionStorage.getItem(storageKey);
        
        if (!hasShownInSession) {
          setShowExpirationModal(true);
          sessionStorage.setItem(storageKey, "true");
          
          toast.info("Mengirim peringatan langganan via Email & WhatsApp...", {
            icon: "⚠️",
            duration: 5000,
          });

          import('../lib/waha').then(({ n8nApi }) => {
            n8nApi.notifyExpiration({
              companyName: companyInfo.nama_perusahaan,
              daysRemaining: remaining,
              email: companyInfo.email || user.email,
              whatsapp: (companyInfo.whatsapp || user.no_hp_notif || "085157004261").replace(/^0/, '62').replace(/[^0-9]/g, '')
            }).catch(err => console.error("Gagal mengirim webhook", err));
          });
        }
      }
    }
  }, [companyInfo, activeCompanyId, user.role]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("attendance_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "absensi",
          filter: `company_id=eq.${activeCompanyId}`,
        },
        (payload) => {
          console.log("Realtime change:", payload);
          reloadAttendances();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCompanyId]);

  // Auto refresh data saat pindah tab untuk mencegah stale data antar menu pemicu bug "harus refresh F5"
  useEffect(() => {
    if (!activeCompanyId) return;
    
    // Refresh semua master data saat navigasi
    // Kita panggil reload agar state Dashboard (yang disalurkan sebagai props) selalu mutakhir.
    const path = location.pathname;
    
    if (path.includes('/karyawan')) {
      reloadEmployees();
      reloadDepartemen();
    } else if (path.includes('/shifts')) {
      reloadShift();
    } else if (path.includes('/cycles')) {
      reloadSiklus();
      reloadShift();
    } else if (path.includes('/depts')) {
      reloadDepartemen();
      reloadSiklus();
      reloadShift();
    } else if (path.includes('/holidays')) {
      reloadHolidays();
    } else if (path.includes('/breaks')) {
      // no Dashboard-level break state to reload
    } else if (path.includes('/record') || path.includes('/rekap') || path.includes('/total') || path.includes('/payroll') || path.includes('/izin') || path.includes('/card')) {
      reloadEmployees();
      reloadDepartemen();
      reloadShift();
      reloadSiklus();
      reloadAttendances();
    }
  }, [location.pathname, activeCompanyId]);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`
        fixed md:relative inset-y-0 left-0 z-50 flex flex-col w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full transition-transform duration-300
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
      >
        <div className="h-20 flex items-center justify-between px-8 border-b border-slate-100 dark:border-slate-800">
          <Link
            to="/"
            className="flex items-center gap-3 overflow-hidden outline-none hover:opacity-80 transition-opacity"
          >
            {companyInfo?.logo_base64 ? (
              <img 
                src={getLogoSrc(companyInfo.logo_base64)} 
                alt="Logo" 
                className="w-10 h-10 object-contain bg-white rounded-lg flex-shrink-0 border border-slate-100 dark:border-slate-800" 
              />
            ) : (
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex-shrink-0 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
            )}
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none truncate uppercase">
                {companyInfo?.nama_perusahaan || "Admin Panel"}
              </span>
              <span className="text-[9px] font-bold text-blue-600/60 uppercase tracking-widest mt-1">
                Sistem Absensi AI
              </span>
            </div>
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-2 text-slate-500 dark:text-slate-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 custom-scrollbar">
          {user.role === "MASTER_ADMIN" && (
            <div className="mb-4">
              <SidebarItem
                icon={<Building2 />}
                label="Perusahaan"
                to="/dashboard/companies"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                icon={<Download />}
                label="Kelola Unduhan"
                to="/dashboard/downloads"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                icon={<Activity />}
                label="Traffic Monitor"
                to="/dashboard/traffic"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                icon={<ShieldCheck />}
                label="Mesin Diblokir"
                to="/dashboard/blocked"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                icon={<CreditCard />}
                label="Billing"
                to="/dashboard/billing"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                icon={<Server />}
                label="Automated Testing"
                to="/dashboard/testing"
                onClick={() => setIsMobileMenuOpen(false)}
              />
            </div>
          )}

          {/* Master Admin Context Indicator */}
          {user.role === "MASTER_ADMIN" && activeCompanyId !== user.company_id && (
            <div className="mx-4 mb-4 p-3 bg-blue-600/10 border border-blue-500/20 rounded-2xl">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 leading-none">Managing Context:</p>
              <div className="flex items-center justify-between gap-2 overflow-hidden">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                  {companyInfo?.nama_perusahaan || activeCompanyId}
                </p>
                <button 
                  onClick={() => {
                    setActiveCompanyId(user.company_id);
                    toast.info("Kembali ke Master Dashboard");
                  }}
                  className="bg-blue-600 p-1 rounded-md text-white hover:bg-blue-700 transition-colors shrink-0"
                  title="Reset Context"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Utama (always expanded usually, so we just put items directly here) */}
          <div className="mb-4">
            {hasPermission('dashboard') && (
              <SidebarItem
                icon={<LayoutDashboard />}
                label="Dashboard"
                to="/dashboard/monitor"
                onClick={() => setIsMobileMenuOpen(false)}
              />
            )}
            <SidebarItem
              icon={<ShieldCheck />}
              label="QR Absensi"
              to={`/portal/${user.nip}`}
              onClick={() => setIsMobileMenuOpen(false)}
            />
            {hasPermission('log') && (
              <SidebarItem
                icon={<Database />}
                label="Log Presensi"
                to="/dashboard/record"
                onClick={() => setIsMobileMenuOpen(false)}
              />
            )}
            {hasPermission('karyawan') && (
              <SidebarItem
                icon={<Users />}
                label="Data Karyawan"
                to="/dashboard/karyawan"
                onClick={() => setIsMobileMenuOpen(false)}
              />
            )}
            {hasPermission('izin') && (
              <SidebarItem
                icon={<CalendarDays />}
                label="Izin & Koreksi"
                to="/dashboard/izin"
                onClick={() => setIsMobileMenuOpen(false)}
              />
            )}
          </div>

          {(hasPermission('jam_kerja') || hasPermission('siklus') || hasPermission('departemen') || hasPermission('jam_break') || hasPermission('hari_libur')) && (
            <SidebarGroup
              icon={<Layers />}
              label="Data Master"
              activePaths={[
                "/dashboard/shifts",
                "/dashboard/cycles",
                "/dashboard/depts",
                "/dashboard/breaks",
                "/dashboard/holidays",
              ]}
            >
              {hasPermission('jam_kerja') && (
                <SidebarItem
                  icon={<Clock />}
                  label="Jam Kerja"
                  to="/dashboard/shifts"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}
              {hasPermission('jam_break') && (
                <SidebarItem
                  icon={<Coffee className="text-emerald-500" />}
                  label="JamBreak"
                  to="/dashboard/breaks"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}
              {hasPermission('hari_libur') && (
                <SidebarItem
                  icon={<Calendar className="text-rose-500" />}
                  label="Hari Libur"
                  to="/dashboard/holidays"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}
              {hasPermission('siklus') && (
                <SidebarItem
                  icon={<Repeat />}
                  label="Siklus Shift"
                  to="/dashboard/cycles"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}
              {hasPermission('departemen') && (
                <SidebarItem
                  icon={<Building2 />}
                  label="Departemen"
                  to="/dashboard/depts"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}
            </SidebarGroup>
          )}

          {(hasPermission('kartu') || hasPermission('rekap') || hasPermission('total') || hasPermission('payroll')) && (
            <SidebarGroup
              icon={<BarChart />}
              label="Laporan"
              activePaths={[
                "/dashboard/card",
                "/dashboard/rekap",
                "/dashboard/total",
                "/dashboard/payroll",
              ]}
            >
              {hasPermission('kartu') && (
                <SidebarItem
                  icon={<Contact />}
                  label="Kartu Absensi"
                  to="/dashboard/card"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}
              {hasPermission('rekap') && (
                <SidebarItem
                  icon={<FileCheck2 />}
                  label="Rekap Absensi"
                  to="/dashboard/rekap"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}
              {hasPermission('total') && (
                <SidebarItem
                  icon={<FileText />}
                  label="Total Absensi"
                  to="/dashboard/total"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}
              {hasPermission('payroll') && (
                <SidebarItem
                  icon={<Wallet />}
                  label="Payroll"
                  to="/dashboard/payroll"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}
            </SidebarGroup>
          )}

          {(hasPermission('maintenance') || hasPermission('pengaturan')) && (
            <SidebarGroup
              icon={<Settings2 />}
              label="Konfigurasi"
              activePaths={["/dashboard/maintenance", "/dashboard/settings"]}
            >
                {hasPermission('maintenance') && (
                  <SidebarItem
                    icon={<Smartphone className="text-blue-500" />}
                    label="Registrasi Mesin"
                    to="/dashboard/devices"
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                )}
              {hasPermission('maintenance') && (
                <SidebarItem
                  icon={<Server className="text-emerald-500" />}
                  label="Maintenance Mesin"
                  to="/dashboard/maintenance"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}
              {hasPermission('pengaturan') && (
                <SidebarItem
                  icon={<Settings />}
                  label="Pengaturan"
                  to="/dashboard/settings"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}
            </SidebarGroup>
          )}

          <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800">
            <div className="px-4 py-2 mt-2">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-relaxed">
                &copy; 2026 AbsensiKita Cloud
                <br />
                All Rights Reserved.
              </p>
            </div>
          </div>
        </nav>

        <div className="p-4 sm:p-6">
          <div className="p-4 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <CalendarDays className="w-12 h-12" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-80">
              Masa Aktif
            </p>
            <div className="flex items-baseline justify-between gap-1 mt-1">
              <p className="text-sm font-black whitespace-nowrap">
                {companyInfo?.trial_end_date
                  ? new Date(companyInfo.trial_end_date).toLocaleDateString(
                      "id-ID",
                      { day: "numeric", month: "short", year: "numeric" },
                    )
                  : "..."}
              </p>
              {companyInfo?.trial_end_date && (
                <span className="text-[9px] font-black bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                  {Math.max(
                    0,
                    Math.ceil(
                      (new Date(companyInfo.trial_end_date).getTime() -
                        new Date().getTime()) /
                        (1000 * 60 * 60 * 24),
                    ),
                  )}{" "}
                  Hari Lagi
                </span>
              )}
            </div>
            <div className="mt-3 w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-white h-full transition-all duration-1000"
                style={{
                  width: companyInfo?.trial_end_date
                    ? `${Math.min(100, Math.max(5, (Math.ceil((new Date(companyInfo.trial_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) / 365) * 100))}%`
                    : "50%",
                }}
              />
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <TopNav
          user={user}
          companyName={companyInfo?.nama_perusahaan || "Loading..."}
          onMenuClick={() => setIsMobileMenuOpen(true)}
          onLogoutClick={() => setShowLogoutModal(true)}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 custom-scrollbar relative">
          <Suspense fallback={<div className="flex h-full min-h-[50vh] items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
            <Route
              index
              element={
                <Navigate
                  to={getDefaultRoute()}
                  replace
                />
                }
              />
              <Route
                path="monitor"
                element={
                  hasPermission('dashboard') ? (
                    <PageWrapper>
                      <MonitoringTab
                        stats={user.role === 'USER' ? {
                          hadir: stats.hadir > 0 && attendances.some(a => a.nip === user.nip && ['MASUK', 'PULANG', 'KEMBALI', 'KELUAR', 'LEMBUR_MASUK', 'LEMBUR_KELUAR'].includes(a.tipe)) && !attendances.some(a => a.nip === user.nip && ['IJIN', 'SAKIT', 'CUTI', 'LUPA_ABSEN'].includes(a.tipe) && Number(a.status_acc) === 1) ? 1 : 0,
                          alpha: stats.alpha > 0 && !attendances.some(a => a.nip === user.nip && ['MASUK', 'PULANG', 'KEMBALI', 'KELUAR', 'LEMBUR_MASUK', 'LEMBUR_KELUAR'].includes(a.tipe)) && !attendances.some(a => a.nip === user.nip && ['IJIN', 'SAKIT', 'CUTI', 'LUPA_ABSEN'].includes(a.tipe) && Number(a.status_acc) === 1) ? 1 : 0,
                          izin: stats.izin > 0 && attendances.some(a => a.nip === user.nip && ['IJIN', 'SAKIT', 'CUTI', 'LUPA_ABSEN'].includes(a.tipe) && Number(a.status_acc) === 1) ? 1 : 0,
                          telat: stats.telat > 0 && attendances.some(a => a.nip === user.nip && a.tipe === 'MASUK' && (a.late_minutes ?? 0) > 0) ? 1 : 0
                        } : stats}
                        user={user}
                        attendances={user.role === 'USER' ? attendances.filter(a => a.nip === user.nip) : attendances}
                        employees={user.role === 'USER' ? [user] : employees}
                        departments={departments}
                        shifts={shifts}
                        cycles={cycles}
                        holidays={holidays}
                        onOpenAttendance={() => setShowAttendanceModal(true)}
                        company={companyInfo}
                      />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard" replace />
                }
              />
              <Route
                path="record"
                element={
                  hasPermission('log') ? (
<PageWrapper>
                      <RecordTab
                        companyId={activeCompanyId}
                        employees={user.role === 'USER' ? [user] : employees}
                        departments={departments}
                        user={user}
                      />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />
              <Route
                path="karyawan"
                element={
                  hasPermission('karyawan') ? (
<PageWrapper>
                      <KaryawanTab
                        user={user}
                        employees={employees}
                        departments={departments}
                        loading={loading}
                        onRefresh={reloadEmployees}
                        companyId={activeCompanyId}
                      />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />
              <Route
                path="izin"
                element={
                  hasPermission('izin') ? (
<PageWrapper>
                      <IzinTab
                        companyId={activeCompanyId}
                        employees={user.role === 'USER' ? [user] : employees}
                        departments={departments}
                        user={user}
                      />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />
              <Route
                path="shifts"
                element={
                  hasPermission('jam_kerja') ? (
<PageWrapper>
                      <ShiftsTab companyId={activeCompanyId} />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />
              <Route
                path="cycles"
                element={
                  hasPermission('siklus') ? (
<PageWrapper>
                      <CyclesTab companyId={activeCompanyId} shifts={shifts} />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />
              <Route
                path="depts"
                element={
                  hasPermission('departemen') ? (
<PageWrapper>
                      <DepartmentsTab companyId={activeCompanyId} />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />
              <Route
                path="breaks"
                element={
                  hasPermission('jam_break') ? (
<PageWrapper>
                      <BreaksTab companyId={activeCompanyId} />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />
              <Route
                path="holidays"
                element={
                  hasPermission('hari_libur') ? (
<PageWrapper>
                      <HolidaysTab companyId={activeCompanyId} />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />
              <Route
                path="devices"
                element={
                  hasPermission('maintenance') ? (
<PageWrapper>
                      <RegisteredDevicesTab activeCompanyId={activeCompanyId} />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />
              <Route
                path="maintenance"
                element={
                  hasPermission('maintenance') ? (
<PageWrapper>
                      <MaintenanceTab 
                        companyInfo={companyInfo} 
                        user={user} 
                        activeCompanyId={activeCompanyId}
                      />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />
              <Route path="unauthorized" element={<div className="flex items-center justify-center h-[60vh]"><div className="text-center"><h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Akses Ditolak</h2><p className="text-slate-500 dark:text-slate-400 mt-2">Anda tidak memiliki izin untuk melihat modul apa pun di dashboard.</p></div></div>} />
              <Route
                path="settings"
                element={
                  hasPermission('pengaturan') ? (
<PageWrapper>
                      <SettingsTab user={user} activeCompanyId={activeCompanyId} />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />
              <Route
                path="card"
                element={
                  hasPermission('kartu') ? (
<PageWrapper>
                      <KartuAbsensiTab companyId={activeCompanyId} user={user} />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />
              <Route
                path="rekap"
                element={
                  hasPermission('rekap') ? (
<PageWrapper>
                      <RekapTab companyId={activeCompanyId} />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />
              <Route
                path="total"
                element={
                  hasPermission('total') ? (
<PageWrapper>
                      <TotalAbsensiTab companyId={activeCompanyId} />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />
              <Route
                path="payroll"
                element={
                  hasPermission('payroll') ? (
<PageWrapper>
                      <PayrollTab
                        companyInfo={companyInfo}
                        user={user}
                        activeCompanyId={activeCompanyId}
                        employees={employees}
                        departments={departments}
                        shifts={shifts}
                        cycles={cycles}
                      />
                    </PageWrapper>
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />
              {user.role === "MASTER_ADMIN" && (
                <Route
                  path="downloads"
                  element={
                    <PageWrapper>
                      <DownloadsTab />
                    </PageWrapper>
                  }
                />
              )}
              {user.role === "MASTER_ADMIN" && (
                <Route
                  path="traffic"
                  element={
                    <PageWrapper>
                      <TrafficTab />
                    </PageWrapper>
                  }
                />
              )}
              {user.role === "MASTER_ADMIN" && (
                <Route
                  path="blocked"
                  element={
                    <PageWrapper>
                      <BlockedMachinesTab />
                    </PageWrapper>
                  }
                />
              )}
              {user.role === "MASTER_ADMIN" && (
                <Route
                  path="companies"
                  element={
                    <PageWrapper>
                      <CompaniesTab
                        onSelectCompany={(id: string) => {
                          setActiveCompanyId(id);
                          toast.success("Berhasil beralih perusahaan");
                          navigate("/dashboard/monitor");
                        }}
                        activeCompanyId={activeCompanyId}
                      />
                    </PageWrapper>
                  }
                />
              )}
              {user.role === "MASTER_ADMIN" && (
                <Route
                  path="billing"
                  element={
                    <PageWrapper>
                      <BillingTab />
                    </PageWrapper>
                  }
                />
              )}
              {user.role === "MASTER_ADMIN" && (
                <Route
                  path="testing"
                  element={
                    <PageWrapper>
                      <AutomatedTestingTab />
                    </PageWrapper>
                  }
                />
              )}
              {(user.role === 'OWNER' || user.role === 'SUPER ADMIN') && (
                <Route
                  path="tagihan"
                  element={
                    <PageWrapper>
                      <TagihanTab companyId={activeCompanyId} />
                    </PageWrapper>
                  }
                />
              )}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AnimatePresence>
          </Suspense>
        </div>
      </main>

      <AttendanceModal
        isOpen={showAttendanceModal}
        onClose={() => setShowAttendanceModal(false)}
        employees={user.role === 'USER' ? [user] : employees}
        departments={departments}
        shifts={shifts}
        cycles={cycles}
        companyId={activeCompanyId}
        onSuccess={reloadAttendances}
      />

      {selectedUserForFace && (
        <Suspense fallback={<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
          <FaceRegistrationModal
            isOpen={showFaceRegModal}
            onClose={() => setShowFaceRegModal(false)}
            employee={selectedUserForFace}
            onSuccess={reloadEmployees}
          />
        </Suspense>
      )}

      <ExpirationWarningModal
        isOpen={showExpirationModal}
        onClose={() => setShowExpirationModal(false)}
        daysRemaining={daysRemaining}
        companyName={companyInfo?.nama_perusahaan || ""}
        userRole={user.role}
      />

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setShowLogoutModal(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-slate-900/10 dark:shadow-black/50 border border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-8 text-center relative">
                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-rose-50/50 to-transparent dark:from-rose-950/20 pointer-events-none" />
                <div className="relative w-20 h-20 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 rotate-3 shadow-inner">
                  <LogOut className="w-10 h-10 -rotate-3" />
                </div>
                <h3 className="relative text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 mb-2">
                  Konfirmasi Keluar
                </h3>
                <p className="relative text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  Apakah Anda yakin ingin mengakhiri sesi dan keluar dari sistem?
                </p>
              </div>
              
              <div className="flex bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-4 font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <div className="w-px bg-slate-200 dark:bg-slate-800" />
                <button
                  onClick={() => {
                    setShowLogoutModal(false);
                    onLogout();
                  }}
                  className="flex-1 py-4 font-black text-white bg-rose-600 hover:bg-rose-700 transition-colors"
                >
                  Keluar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

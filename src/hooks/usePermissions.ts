import { User } from "../types";

export function usePermissions(user: User) {
  const hasPermission = (permission: string) => {
    if (user.role === 'MASTER_ADMIN' || user.role === 'OWNER') return true;
    if (user.role === 'SUPER ADMIN') {
      if (!user.admin_permissions) return false;
      const perms = user.admin_permissions.split(',').map(p => p.trim().toLowerCase());
      return perms.includes(permission.toLowerCase());
    }
    if (user.role === 'USER') {
      return ['dashboard', 'log', 'izin', 'kartu', 'pengaturan'].includes(permission.toLowerCase());
    }
    return false;
  };

  const getDefaultRoute = () => {
    if (user.role === "MASTER_ADMIN") return "/dashboard/companies";
    if (hasPermission('dashboard')) return "/dashboard/monitor";
    if (hasPermission('log')) return "/dashboard/record";
    if (hasPermission('karyawan')) return "/dashboard/karyawan";
    if (hasPermission('izin')) return "/dashboard/izin";
    if (hasPermission('jam_kerja')) return "/dashboard/shifts";
    if (hasPermission('jam_break')) return "/dashboard/breaks";
    if (hasPermission('departemen')) return "/dashboard/depts";
    if (hasPermission('siklus')) return "/dashboard/cycles";
    if (hasPermission('hari_libur')) return "/dashboard/holidays";
    if (hasPermission('kartu')) return "/dashboard/card";
    if (hasPermission('rekap')) return "/dashboard/rekap";
    if (hasPermission('total')) return "/dashboard/total";
    if (hasPermission('payroll')) return "/dashboard/payroll";
    if (hasPermission('pengaturan')) return "/dashboard/settings";
    if (hasPermission('maintenance')) return "/dashboard/maintenance";
    return "/dashboard/unauthorized";
  };

  return { hasPermission, getDefaultRoute };
}

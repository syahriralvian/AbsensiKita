import { motion } from "motion/react";
import { ServerCog, Lock } from "lucide-react";
import { Link } from "react-router-dom";

export default function MaintenancePage() {
  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10" />
        
        <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6 relative">
          <ServerCog className="w-12 h-12 text-amber-500 animate-[spin_4s_linear_infinite]" />
        </div>
        
        <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-4 relative">
          Sistem Sedang<br />Maintenance
        </h1>
        
        <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 relative">
          Kami sedang melakukan perbaikan dan pembaruan sistem untuk memberikan layanan yang lebih baik. Silakan kembali beberapa saat lagi.
        </p>

        <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-bold p-4 rounded-xl text-sm relative">
          Estimasi Waktu Selesai: Segera
        </div>
        
        <div className="mt-8 flex flex-col items-center gap-2 relative">
          <p className="text-xs text-slate-400 font-medium">
            Butuh bantuan segera? Hubungi TIm IT.
          </p>
          <Link to="/login" className="text-[10px] text-slate-300 dark:text-slate-700 hover:text-slate-400 flex items-center gap-1 transition-colors">
            <Lock className="w-3 h-3" /> Admin Access
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

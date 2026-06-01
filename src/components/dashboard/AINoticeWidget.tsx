import { useState, useEffect } from "react";
import { Sparkles, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Attendance, User, Department } from "../../types";

interface AINoticeWidgetProps {
  attendances: Attendance[];
  employees: User[];
  departments: Department[];
}

export default function AINoticeWidget({ attendances, employees, departments }: AINoticeWidgetProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only analyze if there's enough data and we haven't dismissed it
    if (dismissed || attendances.length === 0 || employees.length === 0) return;

    // To prevent calling API too frequently, we can cache the result for the session or day
    const cacheKey = `ai_notice_cache`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setInsight(cached);
      return;
    }

    const generateInsight = async () => {
      setLoading(true);
      try {
        // Prepare a summary of data to send to Gemini (to avoid token limits)
        // Group attendances by department and calculate late rates
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        let deptStats: Record<string, { totalMasuk: number, totalLate: number, lateDuration: number }> = {};
        
        // Initialize dept names
        departments.forEach(d => {
          deptStats[d.nama_departemen] = { totalMasuk: 0, totalLate: 0, lateDuration: 0 };
        });

        // Map NIP to Dept
        const empToDept: Record<string, string> = {};
        employees.forEach(e => {
          const d = departments.find(dep => dep.id === e.departemen_id);
          empToDept[e.nip] = d ? d.nama_departemen : "Umum";
          if (!deptStats[empToDept[e.nip]]) {
            deptStats[empToDept[e.nip]] = { totalMasuk: 0, totalLate: 0, lateDuration: 0 };
          }
        });

        attendances.forEach(a => {
          const date = new Date(a.waktu_masuk.replace(' ', 'T'));
          if (date >= startOfMonth && a.tipe === "MASUK") {
            const dept = empToDept[a.nip] || "Umum";
            if (deptStats[dept]) {
              deptStats[dept].totalMasuk++;
              if (a.late_minutes && a.late_minutes > 0) {
                deptStats[dept].totalLate++;
                deptStats[dept].lateDuration += a.late_minutes;
              }
            }
          }
        });

        const dataSummary = JSON.stringify(deptStats);

        const response = await fetch("/api/gemini/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", text: `Data Absensi Bulan Ini per Departemen (total masuk, total telat, total menit telat): ${dataSummary}` }],
            systemInstruction: "Anda adalah AI Analis HR bernama Gemini. Tugas Anda adalah membaca data absensi karyawan per departemen bulan ini, mendeteksi anomali (misalnya lonjakan keterlambatan yang signifikan di satu departemen), dan memunculkan tepat SATU kalimat notifikasi pintar. Kalimat HARUS dimulai dengan 'AI Notice: '. Contoh: 'AI Notice: Terdeteksi karyawan Departemen Produksi memiliki rasio keterlambatan 40% bulan ini.' Buat sesingkat dan setepat mungkin. Jika tidak ada data telat sama sekali, berikan pujian singkat."
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.reply) {
            setInsight(data.reply);
            sessionStorage.setItem(cacheKey, data.reply);
          }
        }
      } catch (error) {
        console.error("Failed to generate AI insight", error);
      } finally {
        setLoading(false);
      }
    };

    generateInsight();
  }, [attendances, employees, departments, dismissed]);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {(loading || insight) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="mb-6 relative overflow-hidden bg-gradient-to-r from-indigo-50 to-indigo-100/50 dark:from-indigo-900/20 dark:to-indigo-900/10 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl p-4 flex items-start gap-4 shadow-sm"
        >
          <div className="absolute top-0 right-0 p-3 pt-4">
             <button 
               onClick={() => setDismissed(true)}
               className="text-indigo-400 hover:text-indigo-600 transition-colors"
             >
               <X className="w-4 h-4" />
             </button>
          </div>
          <div className="p-2.5 bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-500/20 shrink-0">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 pt-1 pr-6">
            <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider mb-1">
              AI Insight
            </h4>
            {loading ? (
              <div className="h-4 bg-indigo-200/50 dark:bg-indigo-800/50 rounded animate-pulse w-3/4 mt-1"></div>
            ) : (
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                {insight}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, Clock, X, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ExpirationWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  daysRemaining: number;
  companyName: string;
  userRole: string;
}

export default function ExpirationWarningModal({ isOpen, onClose, daysRemaining, companyName, userRole }: ExpirationWarningModalProps) {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-red-100 dark:border-red-900/30"
          >
            <div className="bg-red-50 dark:bg-red-900/20 p-6 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-2xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-red-700 dark:text-red-400">Peringatan Masa Aktif!</h3>
                  <p className="text-sm font-medium text-red-600/80 dark:text-red-400/80">{companyName}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-white/50 dark:bg-slate-800/50 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-black">
                  <Clock className="w-5 h-5 animate-pulse" />
                  {daysRemaining < 0 ? "MASA AKTIF TELAH HABIS" : `SISA ${daysRemaining} HARI LAGI`}
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">
                  Masa aktif layanan absensi perusahaan Anda {daysRemaining < 0 ? "telah berakhir" : "akan segera berakhir"}. Segera lakukan perpanjangan agar sistem tetap dapat digunakan.
                </p>
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Tutup
                </button>
                {(userRole === 'OWNER' || userRole === 'SUPER ADMIN') && (
                  <button
                    onClick={() => {
                      onClose();
                      navigate("/dashboard/tagihan");
                    }}
                    className="flex-[2] px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-5 h-5" />
                    Perpanjang Sekarang
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

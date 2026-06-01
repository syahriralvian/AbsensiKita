import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { motion } from "motion/react";
import { ShieldCheck, Timer, ArrowLeft } from "lucide-react";

export function EmployeePortal() {
  const { nip } = useParams<{ nip: string }>();
  const navigate = useNavigate();
  const [timestamp, setTimestamp] = useState(Date.now());
  const [timeLeft, setTimeLeft] = useState(15);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setTimestamp(now);
      setTimeLeft(15);
    }, 15000);

    const countdown = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 15));
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(countdown);
    };
  }, []);

  if (!nip) return <div>Invalid NIP</div>;

  const qrData = JSON.stringify({ nip, t: timestamp });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative">
      <button 
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors font-medium bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100"
      >
        <ArrowLeft className="w-5 h-5" /> Kembali
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden p-8 text-center space-y-6"
      >
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-2">
          <ShieldCheck className="w-8 h-8 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">QR Dinamis</h2>
          <p className="text-slate-500 text-sm mt-1">Gunakan QR Code ini untuk absensi. QR akan berganti secara otomatis.</p>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 inline-block relative overflow-hidden">
          <QRCodeSVG 
            value={qrData}
            size={250}
            level={"H"}
            includeMargin={true}
          />
        </div>

        <div className="flex items-center justify-center gap-2 text-slate-600 font-medium bg-slate-100 py-2.5 px-4 rounded-xl">
          <Timer className="w-4 h-4" />
          <span>Berubah dalam {timeLeft}s</span>
        </div>

        <div className="pt-4 border-t border-slate-100">
           <p className="text-xs text-slate-400">Pegawai ID</p>
           <p className="text-lg font-mono font-bold text-slate-700">{nip}</p>
        </div>
      </motion.div>
    </div>
  );
}

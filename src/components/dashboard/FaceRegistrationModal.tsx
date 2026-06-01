import { useState, useRef, useEffect } from "react";
import {
  X,
  Camera,
  Upload,
  Loader2,
  CheckCircle2,
  ScanFace,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as faceapi from "@vladmandic/face-api";
import { supabase } from "../../lib/supabase";

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string; // NIP
  companyId: string;
  employeeName: string;
  onSuccess: () => void;
}

export default function FaceRegistrationModal({
  isOpen,
  onClose,
  employeeId,
  companyId,
  employeeName,
  onSuccess,
}: FaceRegistrationModalProps) {
  const [step, setStep] = useState<
    "INITIAL" | "CAMERA" | "PROCESSING" | "SUCCESS"
  >("INITIAL");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const stabilityCounterRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      loadModels();
    } else {
      stopCamera();
      resetForm();
    }
    return () => stopDetection();
  }, [isOpen]);

  const resetForm = () => {
    setStep("INITIAL");
    setImage(null);
    setError(null);
    setLoading(false);
    setIsFaceDetected(false);
    setCaptureProgress(0);
    stabilityCounterRef.current = 0;
  };

  const loadModels = async () => {
    try {
      await (faceapi.tf as any).setBackend('webgl');
      await (faceapi.tf as any).ready();
      const MODEL_URL =
        "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
    } catch (err) {
      console.error("Failed to load face-api models", err);
    }
  };

  const startCamera = async () => {
    setError(null);
    setStep("CAMERA");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          startDetection();
        };
      }
    } catch (err: any) {
      setError("Gagal mengakses kamera. Pastikan izin kamera diberikan.");
      setStep("INITIAL");
    }
  };

  const stopCamera = () => {
    stopDetection();
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startDetection = () => {
    if (detectionIntervalRef.current) return;

    const detect = async () => {
      if (
        step !== "CAMERA" ||
        !videoRef.current ||
        videoRef.current.paused ||
        videoRef.current.ended
      ) {
        detectionIntervalRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        const detection = await faceapi.detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.45,
          }),
        );

        if (detection) {
          setIsFaceDetected(true);
        } else {
          setIsFaceDetected(false);
        }
      } catch (err) {
        console.error("Detection error", err);
      }

      detectionIntervalRef.current = requestAnimationFrame(detect);
    };

    detectionIntervalRef.current = requestAnimationFrame(detect);
  };

  const stopDetection = () => {
    if (detectionIntervalRef.current) {
      cancelAnimationFrame(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Use higher quality for the actual capture
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Flip horizontal if it's a front camera for more natural look
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setImage(dataUrl);
        stopCamera();
        processFace(dataUrl);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImage(dataUrl);
        processFace(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const processFace = async (dataUrl: string) => {
    setStep("PROCESSING");
    setLoading(true);
    setError(null);

    try {
      // 1. Convert dataUrl to Image element for face-api
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => (img.onload = resolve));

      // 2. Generate Embedding using face-api.js
      const detection = await faceapi
        .detectSingleFace(
          img,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.45,
          }),
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error(
          "Wajah tidak terdeteksi. Pastikan wajah terlihat jelas dan pencahayaan cukup.",
        );
      }

      const embedding = Array.from(detection.descriptor);

      // 4. Save to Database
      // Strip data:image/...;base64, prefix to be consistent with mobile app
      const rawBase64 = dataUrl.split(",")[1] || dataUrl;
      const { error: dbError } = await supabase
        .from("karyawan")
        .update({
          foto_wajah_base64: rawBase64,
          face_embedding: JSON.stringify(embedding),
          is_biometric_enabled: true,
          last_updated: Date.now(),
        })
        .eq("nip", employeeId)
        .eq("company_id", companyId);

      if (dbError) throw dbError;

      setStep("SUCCESS");
      onSuccess();

      // Auto close after 3 seconds
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Gagal memproses data wajah.");
      setStep("INITIAL");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-xl relative z-10 overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 md:p-8 pb-4 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                  <ScanFace className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
                    Registrasi Wajah
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
                    {employeeName} • {employeeId}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-3 hover:bg-white dark:bg-slate-900 rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-100 dark:border-slate-800"
              >
                <X className="w-6 h-6 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            <div className="p-5 md:p-8">
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-3">
                  <X className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {step === "INITIAL" && (
                <div className="grid grid-cols-1 md:grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={startCamera}
                    className="flex flex-col items-center justify-center gap-4 p-10 bg-blue-50 border-2 border-dashed border-blue-200 rounded-[2rem] text-blue-600 hover:bg-blue-100 transition-all group"
                  >
                    <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                      <Camera className="w-8 h-8" />
                    </div>
                    <span className="font-black text-sm uppercase tracking-widest">
                      Gunakan Kamera
                    </span>
                  </button>

                  <label className="flex flex-col items-center justify-center gap-4 p-10 bg-slate-50 dark:bg-slate-950 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 transition-all group cursor-pointer">
                    <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8" />
                    </div>
                    <span className="font-black text-sm uppercase tracking-widest">
                      Unggah Foto
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              )}

              {step === "CAMERA" && (
                <div className="relative w-full max-w-sm mx-auto aspect-video md:aspect-[4/3] bg-black rounded-[2.5rem] overflow-hidden group">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  />

                  {/* Scanning Overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {/* Animated Scan Line */}
                      {isFaceDetected && (
                        <motion.rect
                          x="0%"
                          width="100%"
                          height="2%"
                          fill={
                            isFaceDetected
                              ? "rgba(16, 185, 129, 0.5)"
                              : "rgba(37, 99, 235, 0.5)"
                          }
                          animate={{ y: ["0%", "100%", "0%"] }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="shadow-[0_0_15px_rgba(16,185,129,0.8)]"
                        />
                      )}

                      {/* Corners */}
                      <g
                        stroke={isFaceDetected ? "#10b981" : "#2563eb"}
                        strokeWidth="2"
                        strokeLinecap="round"
                        fill="none"
                      >
                        <path d="M 5 15 L 5 5 L 15 5" />
                        <path d="M 95 15 L 95 5 L 85 5" />
                        <path d="M 5 85 L 5 95 L 15 95" />
                        <path d="M 95 85 L 95 95 L 85 95" />
                      </g>
                    </svg>
                  </div>

                  {/* Status & Progress */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex items-center gap-2">
                        {isFaceDetected ? (
                          <div className="flex items-center gap-2 text-emerald-400 font-black text-[10px] uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 animate-pulse">
                            <CheckCircle2 className="w-3 h-3" /> Wajah
                            Terdeteksi
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-blue-400 font-black text-[10px] uppercase tracking-widest bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" />{" "}
                            Posisikan Wajah...
                          </div>
                        )}
                      </div>

                      <button
                        onClick={captureImage}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/30 flex justify-center items-center gap-2 mt-2"
                      >
                        <Camera className="w-4 h-4" />
                        AMBIL FOTO
                      </button>

                      <button
                        onClick={() => setStep("INITIAL")}
                        className="mt-1 px-6 py-2 bg-white/5 text-white/70 backdrop-blur-md rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all border border-white/5"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === "PROCESSING" && (
                <div className="py-12 flex flex-col items-center gap-4 sm:gap-6">
                  <div className="relative">
                    <div className="relative z-10 w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center border-2 border-blue-100 shadow-xl overflow-hidden">
                      {image && (
                        <img
                          src={image}
                          className="w-full h-full object-cover opacity-50"
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                      </div>
                    </div>
                    <motion.div
                      animate={{ top: ["0%", "100%", "0%"] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="absolute left-0 right-0 h-1 bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.8)] z-20"
                    />
                  </div>
                  <div className="text-center">
                    <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">
                      Menganalisis Biometrik...
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto">
                      AI sedang memproses fitur wajah dan menghasilkan embedding
                      unik.
                    </p>
                  </div>
                </div>
              )}

              {step === "SUCCESS" && (
                <div className="py-8 flex flex-col items-center gap-4 sm:gap-6 text-center">
                  <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[2.5rem] flex items-center justify-center border-2 border-emerald-100 shadow-xl animate-bounce">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100">
                      Registrasi Berhasil
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2">
                      Data wajah {employeeName} telah disimpan dan aktif untuk
                      sistem absensi.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="mt-4 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20"
                  >
                    Selesai
                  </button>
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

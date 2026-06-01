import { useState, useRef, useEffect } from "react";
import * as faceapi from "@vladmandic/face-api";
import { motion, AnimatePresence } from "motion/react";
import { Camera, X, Loader2, ScanFace, UploadCloud } from "lucide-react";
import { User } from "../types";
import { supabase } from "../lib/supabase";

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: User;
  onSuccess: () => void;
}

export default function FaceRegistrationModal({ isOpen, onClose, employee, onSuccess }: FaceRegistrationModalProps) {
  const [loading, setLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [method, setMethod] = useState<'camera' | 'upload'>('camera');
  const [status, setStatus] = useState("Memuat AI...");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen && method === 'camera') {
      initFaceApi().then(() => {
        if (isOpen && method === 'camera') startCamera();
      });
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, method]);

  const initFaceApi = async () => {
    try {
      await (faceapi.tf as any).setBackend('webgl');
      await (faceapi.tf as any).ready();
      const modelPath = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelPath)
      ]);
      setStatus("Arahkan wajah ke kamera...");
    } catch (e) {
      console.error(e);
      setStatus("Gagal memuat AI.");
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        detectFace();
      }
    } catch (e) {
      console.error(e);
      setStatus("Akses kamera ditolak.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const detectFace = async () => {
    if (!videoRef.current || capturedImage) return;

    if (videoRef.current.readyState === 4) {
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 }));
      if (detection) {
        setStatus("Wajah terdeteksi! Tahan...");
        // In real registration, we might wait for a few frames of stability
      } else {
        setStatus("Cari wajah...");
      }
    }
    
    if (isOpen && method === 'camera' && !capturedImage) {
      requestAnimationFrame(detectFace);
    }
  };

  const takeSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const img = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(img);
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setCapturedImage(evt.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!capturedImage) return;
    setLoading(true);
    setStatus("Memproses wajah...");
    try {
      const img = await faceapi.fetchImage(capturedImage);
      const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) throw new Error("AI gagal membaca wajah di foto ini.");

      const embedding = Array.from(detection.descriptor);
      
      const rawBase64 = capturedImage.split(',')[1] || capturedImage;
      
      const { error } = await supabase
        .from('karyawan')
        .update({
          face_embedding: JSON.stringify(embedding),
          foto_wajah_base64: rawBase64
        })
        .eq('nip', employee.nip)
        .eq('company_id', employee.company_id);

      if (error) throw error;
      
      alert("Wajah berhasil didaftarkan!");
      onSuccess();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
      setStatus("Selesai");
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
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg relative z-10 p-5 md:p-8 space-y-6"
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Registrasi Wajah</h3>
                <p className="text-xs font-bold text-blue-600 mt-1 uppercase tracking-wider">{employee.nama}</p>
              </div>
              <button onClick={onClose} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-xl transition">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-2xl border border-slate-100 dark:border-slate-800">
              <button 
                onClick={() => {setMethod('camera'); setCapturedImage(null);}}
                className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${method === 'camera' ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-300'}`}
              >
                <Camera className="w-4 h-4" /> Kamera AI
              </button>
              <button 
                onClick={() => {setMethod('upload'); setCapturedImage(null);}}
                className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${method === 'upload' ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-300'}`}
              >
                <UploadCloud className="w-4 h-4" /> Upload Foto
              </button>
            </div>

            <div className="flex flex-col items-center">
              <div className="relative w-full aspect-video md:aspect-[4/3] max-w-sm rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-4 border-slate-50 shadow-inner">
                {method === 'camera' && !capturedImage ? (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                ) : capturedImage ? (
                  <img src={capturedImage} className="w-full h-full object-cover" alt="Preview" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-300 p-5 md:p-8 text-center cursor-pointer" onClick={() => document.getElementById('face-upload')?.click()}>
                    <UploadCloud className="w-12 h-12 mb-2" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Klik untuk pilih foto</span>
                  </div>
                )}
                <input id="face-upload" type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </div>
              <p className="mt-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{status}</p>
              
              <div className="mt-6 flex gap-3 w-full">
                {method === 'camera' && !capturedImage ? (
                  <button 
                    onClick={takeSnapshot}
                    className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition"
                  >
                    Ambil Foto
                  </button>
                ) : (
                  <button 
                    onClick={() => { setCapturedImage(null); if (method === 'camera') startCamera(); }}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-bold hover:bg-slate-200 dark:bg-slate-700 transition"
                  >
                    Ulangi
                  </button>
                )}
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={loading || !capturedImage}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanFace className="w-5 h-5" />}
              Daftarkan Wajah Sekarang
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

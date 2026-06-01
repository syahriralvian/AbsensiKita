import { useState, useRef, useEffect } from "react";
import * as faceapi from "@vladmandic/face-api";
import jsQR from "jsqr";
import { motion, AnimatePresence } from "motion/react";
import { Camera, X, Loader2, ScanFace, Mic, CheckCircle2 as UserCheck, Check, MapPin, QrCode } from "lucide-react";
import { User, Attendance, Department, Shift, Cycle } from "../types";
import { supabase } from "../lib/supabase";
import { safeJsonParse, toLocalISOString, toLocalDateString, getSyncedDate, calculateDistance } from "../lib/utils";
import { wahaApi } from "../lib/waha";
import { toast } from "sonner";

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: User[];
  departments: Department[];
  shifts: Shift[];
  cycles: Cycle[];
  companyId: string;
  onSuccess: () => void;
}

export default function AttendanceModal({ 
  isOpen, 
  onClose, 
  employees, 
  departments,
  shifts,
  cycles,
  companyId, 
  onSuccess 
}: AttendanceModalProps) {
  const [loading, setLoading] = useState(false);
  const [scanMode, setScanMode] = useState<'face' | 'qr'>('face');
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectedUser, setDetectedUser] = useState<User | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [attendanceType, setAttendanceType] = useState<'MASUK' | 'KELUAR' | 'PULANG' | 'KEMBALI' | 'LEMBUR_MASUK' | 'LEMBUR_KELUAR'>('MASUK');
  const [statusMessage, setStatusMessage] = useState("Memuat AI...");
  const [isListening, setIsListening] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successLateMinutes, setSuccessLateMinutes] = useState(0);
  const [gpsLocation, setGpsLocation] = useState<{lat: number, lng: number} | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const scanModeRef = useRef(scanMode);

  useEffect(() => {
    scanModeRef.current = scanMode;
    if (isOpen) {
      startCamera();
    }
  }, [scanMode]);

  const fetchGPS = (highAccuracy = true) => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError("Browser tidak mendukung GPS");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsError(null);
      },
      (err) => {
        console.warn("GPS Error:", err.message);
        if (highAccuracy) {
           // iOS safari workaround: if high accuracy fails, retry with low accuracy immediately
           fetchGPS(false);
        } else {
           setGpsError(err.message === "User denied Geolocation" ? "Akses GPS Ditolak" : err.message || "GPS Timeout/Error");
        }
      },
      { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 8000 : 15000, maximumAge: 0 }
    );
  };

  // Get GPS on load
  useEffect(() => {
    if (isOpen) {
      fetchGPS(true);
    } else {
      setGpsLocation(null);
      setGpsError(null);
    }
  }, [isOpen]);

  // Refs for voice recognition (avoid stale closures)
  const stateRef = useRef({ detectedUser, capturedImage, attendanceType });
  useEffect(() => {
    stateRef.current = { detectedUser, capturedImage, attendanceType };
  }, [detectedUser, capturedImage, attendanceType]);

  // Helper for voice feedback
  const speak = async (text: string) => {
    // Fallback to Web Speech API
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      
      let voices = window.speechSynthesis.getVoices();
      
      // Known male identifiers to avoid
      const maleNames = ['ardi', 'andika', 'radith', 'male', 'laki-laki', 'bimo', 'putra', 'jaka', 'cowo', 'pria', 'anton', 'budi'];
      
      // Try to find a high quality female Indonesian voice
      const isIndonesian = (v: SpeechSynthesisVoice) => 
        v.lang.replace('_', '-').toLowerCase() === 'id-id' || v.lang.toLowerCase() === 'id';
        
      const isExplicitFemale = (v: SpeechSynthesisVoice) => 
        v.name.toLowerCase().includes('female') || 
        v.name.toLowerCase().includes('gadis') || 
        v.name.toLowerCase().includes('damayanti') || 
        v.name.toLowerCase().includes('perempuan') || 
        v.name.toLowerCase().includes('google bahasa indonesia');

      const idFemaleVoice = voices.find(v => isIndonesian(v) && isExplicitFemale(v) && !maleNames.some(m => v.name.toLowerCase().includes(m)));
      const fallbackIdVoice = voices.find(v => isIndonesian(v) && !maleNames.some(m => v.name.toLowerCase().includes(m)));
      const anyIdVoice = voices.find(v => isIndonesian(v));

      const selectedVoice = idFemaleVoice || fallbackIdVoice || anyIdVoice;

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      utterance.rate = 0.95; // Slightly slower is often perceived as more human for TTS
      // Increase pitch slightly more if we are not sure it's a native female voice
      utterance.pitch = idFemaleVoice ? 1.15 : 1.5; 
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const resetAttendance = () => {
    setDetectedUser(null);
    setCapturedImage(null);
    setSuccess(false);
    setSuccessLateMinutes(0);
    setFaceDetected(false);
    setStatusMessage("Menyiapkan kamera untuk karyawan selanjutnya...");
    
    // Give it a tiny moment for React state to propagate before starting camera/detection
    setTimeout(() => {
      setStatusMessage("Arahkan wajah ke kamera...");
      startCamera();
    }, 100);
  };
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const matcherRef = useRef<faceapi.FaceMatcher | null>(null);

  // Voice Recognition Logic
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let shouldBeRunning = true;
    
    const startRecognition = () => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition || !isOpen || !shouldBeRunning) return;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'id-ID';

      recognition.onstart = () => {
        setIsListening(true);
        console.log("Speech Recognition: ON");
      };

      recognition.onend = () => {
        setIsListening(false);
        console.log("Speech Recognition: OFF");
        
        // Only restart if the modal is still open and we haven't stopped intentionally
        if (isOpen && shouldBeRunning) {
          setTimeout(() => {
            if (isOpen && shouldBeRunning) {
              try { 
                // Ensure we don't have multiple instances
                if (recognitionRef.current === recognition) {
                  recognition.start(); 
                }
              } catch (e) {
                // Silently handle if already started
              }
            }
          }, 2000); // Increased delay for stability
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error === 'aborted' || e.error === 'no-speech') {
          // Aborted is normal behavior when stopping or restarting.
          // no-speech just means silence timeout, safe to ignore.
          return;
        }

        console.warn("Speech Recognition Error:", e.error);
        
        if (e.error === 'not-allowed') {
          setStatusMessage("Izin mikrofon ditolak.");
          shouldBeRunning = false;
        }
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
        console.log("Voice Transcript:", transcript);

        let matchedType = false;

        if (transcript.includes('masuk') && transcript.includes('lembur')) {
          setAttendanceType('LEMBUR_MASUK');
          matchedType = true;
        } else if (transcript.includes('keluar') && transcript.includes('lembur')) {
          setAttendanceType('LEMBUR_KELUAR');
          matchedType = true;
        } else if (transcript.includes('masuk')) {
          setAttendanceType('MASUK');
          matchedType = true;
        } else if (transcript.includes('keluar')) {
          setAttendanceType('KELUAR');
          matchedType = true;
        } else if (transcript.includes('pulang')) {
          setAttendanceType('PULANG');
          matchedType = true;
        } else if (transcript.includes('kembali')) {
          setAttendanceType('KEMBALI');
          matchedType = true;
        }

        // Auto-trigger submission
        const isConfirm = transcript.includes('kirim') || transcript.includes('absen') || transcript.includes('oke') || transcript.includes('konfirmasi') || transcript.includes('siap') || transcript.includes('simpan');
        
        if (matchedType || isConfirm) {
          console.log("Voice Command Recognized:", { matchedType, isConfirm });
          setStatusMessage("Perintah suara dikenali. Mengirim otomatis...");
          
          setTimeout(() => {
            if (stateRef.current.detectedUser && stateRef.current.capturedImage) {
              const btn = document.getElementById('btn-submit-absensi') as HTMLButtonElement;
              if (btn && !btn.disabled) {
                btn.click();
              }
            }
          }, 1500);
        }
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.error("Failed to start recognition:", e);
      }
    };

    if (isOpen) {
      startRecognition();
    }

    return () => {
      shouldBeRunning = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      initFaceApi().then(() => {
        if (isOpen) startCamera();
      });
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

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
      
      const labeledDescriptors: faceapi.LabeledFaceDescriptors[] = [];
      employees.forEach(emp => {
        if (emp.face_embedding) {
          try {
            let parsed = emp.face_embedding;
            if (typeof parsed === 'string') parsed = safeJsonParse(parsed, []);
            if (Array.isArray(parsed) && parsed.length === 128) {
              labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(emp.nip, [new Float32Array(parsed)]));
            }
          } catch (e) {
            console.error("Invalid embedding for", emp.nama);
          }
        }
      });

      if (labeledDescriptors.length > 0) {
        matcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, 0.40);
        setStatusMessage("Arahkan wajah ke kamera...");
      } else {
        setStatusMessage("Belum ada wajah terdaftar.");
      }
    } catch (e) {
      console.error(e);
      setStatusMessage("Gagal memuat AI.");
    }
  };

  const startCamera = async () => {
    try {
      // Clean up first to avoid multi-stream issues
      stopCamera();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Wait for video to be ready before starting detection
        videoRef.current.onloadedmetadata = () => {
          processVideoFrame();
        };
      }
    } catch (e: any) {
      console.error("Camera Error:", e);
      if (e.name === "NotAllowedError") {
        setStatusMessage("Izin kamera ditolak. Silakan aktifkan.");
      } else {
        setStatusMessage("Gagal mengakses kamera.");
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        t.stop();
        console.log("Track stopped:", t.label);
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const detectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDetectingRef = useRef(false);
  const qrThrottleRef = useRef<number>(0);

  const processVideoFrame = async () => {
    if (!videoRef.current || capturedImage || success) {
      isDetectingRef.current = false;
      return;
    }

    isDetectingRef.current = true;

    if (scanModeRef.current === 'face') {
      if (!matcherRef.current) {
         if (isOpen && !capturedImage && !success) {
           requestAnimationFrame(processVideoFrame);
         } else {
           isDetectingRef.current = false;
         }
         return;
      }
      
      if (videoRef.current.readyState === 4) {
        const detection = await faceapi.detectSingleFace(
          videoRef.current, 
          new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 })
        )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          const bestMatch = matcherRef.current.findBestMatch(detection.descriptor);
          if (bestMatch.label !== "unknown") {
            const user = employees.find(e => e.nip === bestMatch.label);
            if (user) {
              setDetectedUser(user);
              setFaceDetected(true);
              setStatusMessage(`Halo, ${user.nama}! Menjepret...`);
              
              // Auto capture after a short delay
              if (detectionTimeoutRef.current) clearTimeout(detectionTimeoutRef.current);
              detectionTimeoutRef.current = setTimeout(() => {
                if (stateRef.current.detectedUser && !stateRef.current.capturedImage) {
                  takeSnapshot();
                }
              }, 1200);
              return;
            }
          } else {
            if (detectionTimeoutRef.current) {
              clearTimeout(detectionTimeoutRef.current);
              detectionTimeoutRef.current = null;
            }
            setDetectedUser(null);
            setFaceDetected(false);
            setStatusMessage("Wajah tidak dikenali.");
          }
        } else {
          if (detectionTimeoutRef.current) {
            clearTimeout(detectionTimeoutRef.current);
            detectionTimeoutRef.current = null;
          }
          setDetectedUser(null);
          setFaceDetected(false);
          setStatusMessage("Arahkan wajah ke kamera...");
        }
      }
    } else if (scanModeRef.current === 'qr') {
      const nowMs = Date.now();
      if (videoRef.current.readyState === 4 && canvasRef.current && (nowMs - qrThrottleRef.current > 200)) {
         qrThrottleRef.current = nowMs;
         const video = videoRef.current;
         const canvas = canvasRef.current;
         if (video.videoWidth > 0 && video.videoHeight > 0) {
            const scale = Math.min(1, 640 / video.videoWidth);
            canvas.width = video.videoWidth * scale;
            canvas.height = video.videoHeight * scale;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
               ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
               const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
               const code = jsQR(imageData.data, imageData.width, imageData.height, {
                 inversionAttempts: "attemptBoth"
               });
               if (code && code.data) {
                  try {
                    let userNip = "";
                    
                    try {
                      const parsed = JSON.parse(code.data);
                      if (parsed.nip && parsed.t) {
                        const timeDiff = Date.now() - parsed.t;
                        if (timeDiff > 60000 || timeDiff < -5000) {
                           setDetectedUser(null);
                           setFaceDetected(false);
                           setStatusMessage("QR Code Kadaluarsa, silakan refresh dari device.");
                           return;
                        }
                        userNip = parsed.nip;
                      } else {
                        userNip = code.data; 
                      }
                    } catch (err) {
                      userNip = code.data;
                    }

                    const user = employees.find(e => e.nip === userNip);
                    if (user) {
                       setDetectedUser(user);
                       setFaceDetected(true);
                       setStatusMessage(`Halo, ${user.nama}! QR Tervalidasi...`);
                        
                       // Auto capture after a short delay
                       if (detectionTimeoutRef.current) clearTimeout(detectionTimeoutRef.current);
                       detectionTimeoutRef.current = setTimeout(() => {
                         if (stateRef.current.detectedUser && !stateRef.current.capturedImage) {
                           takeSnapshot();
                         }
                       }, 1000);
                       return;
                    } else {
                       setDetectedUser(null);
                       setFaceDetected(false);
                       setStatusMessage("QR Code Karyawan tidak terdaftar.");
                    }
                  } catch (e) {
                     setDetectedUser(null);
                     setFaceDetected(false);
                     setStatusMessage("QR Code tidak valid!");
                  }
               } else {
                  if (detectionTimeoutRef.current) clearTimeout(detectionTimeoutRef.current);
                  setDetectedUser(null);
                  setFaceDetected(false);
                  setStatusMessage("Arahkan QR Code ke kamera...");
               }
            }
         }
      }
    }
    
    if (isOpen && !capturedImage && !success) {
      requestAnimationFrame(processVideoFrame);
    } else {
      isDetectingRef.current = false;
    }
  };

  const takeSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const maxW = 400;
    const scale = Math.min(1, maxW / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = canvas.toDataURL('image/jpeg', 0.6);
      setCapturedImage(img);
      stopCamera();
      
      setStatusMessage("Wajah diverifikasi. Silakan pilih tipe absen dan klik tombol Kirim.");
    }
  };

  const handleSubmit = async () => {
    if (!detectedUser || !capturedImage) {
      console.warn("Submit aborted: detectedUser or capturedImage is missing", { detectedUser, capturedImage });
      return;
    }
    setLoading(true);
    console.log("Submitting attendance for:", detectedUser.nama, "Type:", attendanceType);
    
    try {
      const dept = departments.find(d => d.id === detectedUser.departemen_id);

      // GPS Radius Check logic
      const { data: companyData, error: compError } = await supabase
        .from("companies")
        .select("*")
        .eq("company_id", companyId)
        .single();
        
      let requireGps = false;
      let targetLat = 0;
      let targetLng = 0;
      let targetRadius = 0;

      // Check Department first
      if (dept && dept.radius !== null && dept.radius !== undefined) {
        if (dept.radius > 0 && dept.lat !== null && dept.lng !== null) {
           requireGps = true;
           targetLat = dept.lat as number;
           targetLng = dept.lng as number;
           targetRadius = dept.radius as number;
        } else if (dept.radius === -1) {
           // Explicitly disabled for this department
           requireGps = false;
        }
      } else if (!compError && companyData && companyData.location_enabled && companyData.office_radius && companyData.office_lat && companyData.office_lng) {
        // Fallback to Company
        requireGps = true;
        targetLat = parseFloat(companyData.office_lat);
        targetLng = parseFloat(companyData.office_lng);
        targetRadius = parseFloat(companyData.office_radius);
      }

      if (requireGps) {
        if (!gpsLocation) {
          const msg = "GPS Lokasi wajib diaktifkan!";
          speak(msg);
          toast.error(msg);
          setLoading(false);
          setTimeout(() => resetAttendance(), 3000);
          return;
        }
        
        const dist = calculateDistance(
          gpsLocation.lat,
          gpsLocation.lng,
          targetLat,
          targetLng
        );
        
        if (dist > targetRadius) {
          const msg = `Malfungsi GPS, atau Anda berada di luar jangkauan area absen! Toleransi: ${targetRadius}m. Anda berjarak: ${Math.round(dist)}m.`;
          speak(msg);
          toast.error(msg);
          setLoading(false);
          setTimeout(() => resetAttendance(), 5000);
          return;
        }
      }

      const now = getSyncedDate();
      let lateMinutes = 0;
      let assignedShiftId: number | undefined;
      
      const timeToMinutes = (timeStr: string | undefined): number => {
        if (!timeStr) return 0;
        const clean = timeStr.trim().toUpperCase();
        const parts = clean.split(/\s+/);
        const timePart = parts[0];
        const ampm = parts[1]; // AM or PM
        
        let [h, m] = timePart.split(':').map(Number);
        if (isNaN(h)) return 0;
        if (isNaN(m)) m = 0;

        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        
        return h * 60 + m;
      };

      if (dept && (['MASUK', 'LEMBUR_MASUK', 'PULANG', 'LEMBUR_KELUAR'].includes(attendanceType))) {
        let activeShift: Shift | undefined;
        
        console.log("Detecting shift for rule:", dept.calculation_rule, "Siklus:", dept.siklus_id);

        if (dept.calculation_rule === 1 && dept.siklus_id) {
          // Rolling cycle logic (Day-based since epoch / reference)
          const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const daysSinceEpoch = Math.floor(localDate.getTime() / 86400000);
          const cycle = cycles.find(c => c.id === dept.siklus_id);
          if (cycle) {
            const isWeekly = cycle.tipe_periode === "Mingguan" || cycle.tipe_periode === "WEEKLY";
            if (isWeekly) {
              const shiftConfig = safeJsonParse<any>(cycle.auto_shift_ids, null);
              if (shiftConfig && typeof shiftConfig === 'object' && !Array.isArray(shiftConfig)) {
                const dayOfWeek = now.getDay();
                // Both string and number keys should work, but let's be explicit
                const config = shiftConfig[dayOfWeek] || shiftConfig[String(dayOfWeek)];
                if (config && config.enabled && config.shift_id) {
                  activeShift = shifts.find(s => s.id === config.shift_id);
                }
              }
            } else {
              const shiftIds = safeJsonParse<number[]>(cycle.auto_shift_ids, []);
              if (shiftIds.length > 0) {
                const cycleDay = daysSinceEpoch % shiftIds.length;
                activeShift = shifts.find(s => s.id === shiftIds[cycleDay]);
              }
            }
          }
        } else if (dept.calculation_rule === 2 && dept.fixed_shift_id) {
          activeShift = shifts.find(s => s.id === dept.fixed_shift_id);
        } else if (dept.calculation_rule === 3 && dept.auto_shift_ids) {
          try {
            const shiftIds = safeJsonParse<number[]>(dept.auto_shift_ids, []);
            const possibleShifts = shifts.filter(s => shiftIds.includes(s.id));
            
            const currentVal = now.getHours() * 60 + now.getMinutes();
            
            activeShift = possibleShifts.find(s => {
              const startVal = timeToMinutes(s.awal_masuk);
              const endVal = timeToMinutes(s.akhir_masuk);
              return currentVal >= startVal && currentVal <= endVal;
            }) || possibleShifts[0];
          } catch(e) {
            activeShift = undefined;
          }
        }

        // If no shift found by rule but we have shifts, try to find the closest one as fallback (except for rule 4)
        if (!activeShift && shifts.length > 0 && dept.calculation_rule !== 4) {
          console.log("No active shift found by rule, using fallback.");
          const currentVal = now.getHours() * 60 + now.getMinutes();
          activeShift = shifts.reduce((prev, curr) => {
            const prevStart = timeToMinutes(prev.jam_masuk);
            const currStart = timeToMinutes(curr.jam_masuk);
            const prevDiff = Math.abs(currentVal - prevStart);
            const currDiff = Math.abs(currentVal - currStart);
            return currDiff < prevDiff ? curr : prev;
          });
        }

        if (activeShift) {
          assignedShiftId = activeShift.id;
          console.log("Active shift selected:", activeShift.nama_shift, "Start:", activeShift.jam_masuk);

          const currentInMinutes = now.getHours() * 60 + now.getMinutes();

          // Department clock in limit
          if (attendanceType === 'MASUK' && dept.is_clock_in_limit && dept.clock_in_limit_time) {
            const limitMins = timeToMinutes(dept.clock_in_limit_time);
            if (currentInMinutes > limitMins) {
              const msg = `Batas absen hari ini sudah ditutup pukul ${dept.clock_in_limit_time.slice(0, 5)}!`;
              speak(msg);
              toast.error(msg);
              setLoading(false);
              setTimeout(() => resetAttendance(), 3000);
              return;
            }
          }

          // 1. Validate 'Awal Masuk'
          if (attendanceType === 'MASUK' && activeShift.awal_masuk && dept.calculation_rule === 1) {
            const awalVal = timeToMinutes(activeShift.awal_masuk);
            if (currentInMinutes < awalVal) {
              const msg = `Terlalu awal! Absen masuk mulai pukul ${activeShift.awal_masuk.slice(0, 5)}`;
              speak(msg);
              toast.error(msg);
              setLoading(false);
              setTimeout(() => resetAttendance(), 3000);
              return;
            }
          }

          // 2. Validate 'Akhir Masuk'
          if (attendanceType === 'MASUK' && activeShift.akhir_masuk && dept.calculation_rule === 1) {
            const akhirVal = timeToMinutes(activeShift.akhir_masuk);
            if (currentInMinutes > akhirVal) {
              const msg = `Absen Masuk ditutup! Batas terakhir adalah pukul ${activeShift.akhir_masuk.slice(0, 5)}.`;
              speak(msg);
              toast.error(msg);
              setLoading(false);
              setTimeout(() => resetAttendance(), 3000);
              return;
            }
          }

          // 3. Validate 'Awal Pulang'
          if (attendanceType === 'PULANG' && activeShift.awal_pulang && dept.calculation_rule === 1) {
            const awalPulangVal = timeToMinutes(activeShift.awal_pulang);
            if (currentInMinutes < awalPulangVal) {
              const msg = `Terlalu awal untuk pulang! Absen pulang mulai pukul ${activeShift.awal_pulang.slice(0, 5)}`;
              speak(msg);
              toast.error(msg);
              setLoading(false);
              setTimeout(() => resetAttendance(), 3000);
              return;
            }
          }

          // 4. Validate 'Akhir Pulang'
          if (attendanceType === 'PULANG' && activeShift.akhir_pulang && dept.calculation_rule === 1) {
            const akhirPulangVal = timeToMinutes(activeShift.akhir_pulang);
            if (currentInMinutes > akhirPulangVal) {
              const msg = `Batas waktu absen pulang sudah lewat (${activeShift.akhir_pulang.slice(0, 5)}).`;
              speak(msg);
              toast.error(msg);
              setLoading(false);
              setTimeout(() => resetAttendance(), 3000);
              return;
            }
          }

          // Lateness only applies strictly to Rule 1 and Rule 3 (optionally)
          // Rule 2 is duration based, rarely shows late.
          if (attendanceType === 'MASUK' && (dept.calculation_rule === 1 || dept.calculation_rule === 3)) {
            const shiftStartInMinutes = timeToMinutes(activeShift.jam_masuk);
            const tolerance = activeShift.late_tolerance || 0;
            
            console.log(`Checking Lateness: Now=${currentInMinutes}, ShiftStart=${shiftStartInMinutes}, Tolerance=${tolerance}`);

            if (currentInMinutes > (shiftStartInMinutes + tolerance)) {
              lateMinutes = currentInMinutes - shiftStartInMinutes;
              console.log("Employee is late by:", lateMinutes, "mins");
            }
          }
        }
      }

      const payload: Partial<Attendance> = {
        company_id: companyId,
        nip: detectedUser.nip,
        nama: detectedUser.nama,
        tipe: attendanceType,
        status_acc: 1,
        waktu_masuk: toLocalISOString(now),
        image: capturedImage.includes(',') ? capturedImage.split(',')[1] : capturedImage,
        late_minutes: lateMinutes,
        ...(gpsLocation ? { lat: gpsLocation.lat, lng: gpsLocation.lng } : {})
      };

      // CHECK: Duplicate Attendance for today
      const dateStr = toLocalDateString(getSyncedDate());

      const { data: existingAttendance, error: checkError } = await supabase
        .from("absensi")
        .select("id")
        .eq("company_id", companyId)
        .eq("nip", detectedUser.nip)
        .eq("tipe", attendanceType)
        .like("waktu_masuk", `${dateStr}%`)
        .limit(1);

      if (checkError) {
        console.error("Duplicate Check Error:", checkError);
      }

      if (existingAttendance && existingAttendance.length > 0) {
        speak(`Maaf ${detectedUser.nama}, Anda sudah melakukan absen ${attendanceType.replace('_', ' ')} hari ini.`);
        toast.error(`Anda sudah melakukan absen ${attendanceType.replace('_', ' ')} hari ini.`);
        setLoading(false);
        setTimeout(() => {
          onClose();
          resetAttendance();
        }, 1500);
        return;
      }

      const { error } = await supabase.from("absensi").insert([payload]);
      if (error) {
        console.error("Supabase Error:", error);
        throw new Error(`Gagal menyimpan ke database: ${error.message}`);
      }

      // Realtime GSheet Sync
      if (companyData?.gsheet_enabled && companyData?.gsheet_url_kartu) {
        try {
          const title = "Realtime Absensi";
          const dStr = toLocalDateString(getSyncedDate());
          const timeStr = payload.waktu_masuk!.slice(11, 16);
          const attType = (payload as any).tipe.replace('_', ' ');
          const csvContent = `${payload.nip},"${detectedUser.nama}",${dStr},${timeStr},${attType}\n`;
          fetch(companyData.gsheet_url_kartu, {
            method: 'POST',
            body: JSON.stringify({ action: "realtime", title, csvContent }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            mode: 'no-cors'
          }).catch(err => console.error("Realtime webhook failed:", err));
        } catch (e) {
          console.error("GSheet Realtime err", e);
        }
      }

      // WhatsApp Notification Sync
      if (companyData?.whatsapp_enabled) {
        try {
          // Send natively via WAHA API proxy
          const formatWaktu = new Date(payload.waktu_masuk as string).toLocaleString('id-ID');
          const latLng = `${payload.lat},${payload.lng}`;
          const mapsLink = `https://www.google.com/maps?q=${latLng}`;
          const textMsg = `=*Notifikasi Kehadiran* 🟢\n\nHalo *${detectedUser.nama}*,\n\nAbsensi Anda untuk *${(payload as any).tipe}* telah berhasil dicatat pada sistem.\n\nWaktu: ${formatWaktu}\nKeterlambatan: ${lateMinutes} menit\nLokasi: ${mapsLink}\nPerusahaan: ${companyData?.nama_perusahaan || "Perusahaan"}\n\n_Terima kasih telah melakukan absensi!_`;

          // 1. Notify the Employee
          if (detectedUser.no_hp_notif) {
            let cleanHp = detectedUser.no_hp_notif.replace(/\D/g, "");
            if (cleanHp.startsWith("0")) cleanHp = "62" + cleanHp.substring(1);
            const chatId = `${cleanHp}@c.us`;
            
            wahaApi.sendText(companyId, chatId, textMsg).catch(err => console.error("Native WAHA call failed for user:", err));
          }

          // 2. Notify Super Admins
          const { data: admins } = await supabase
            .from('karyawan')
            .select('nip, nama, no_hp_notif, role')
            .eq('company_id', companyId)
            .in('role', ['MASTER_ADMIN', 'OWNER']); 
            
          if (admins && admins.length > 0) {
            const adminMsg = `=*Info Kehadiran* 🟢\n\nKaryawan *${detectedUser.nama}* baru saja melakukan absensi *${(payload as any).tipe}*.\n\nWaktu: ${formatWaktu}\nKeterlambatan: ${lateMinutes} menit\nLokasi: ${mapsLink}`;
            for (const admin of admins) {
              if (admin.no_hp_notif) {
                let cleanHp = admin.no_hp_notif.replace(/\D/g, "");
                if (cleanHp.startsWith("0")) cleanHp = "62" + cleanHp.substring(1);
                const chatId = `${cleanHp}@c.us`;
                wahaApi.sendText(companyId, chatId, adminMsg).catch((err: any) => console.error("Native WAHA call failed for admin:", err));
              }
            }
          }
        } catch (e) {
          console.error("WA Notification err", e);
        }
      }

      // Telegram Notification Sync
      if (companyData?.telegram_bot_token && capturedImage) {
        try {
          const dataURItoBlob = (dataURI: string) => {
            const byteString = atob(dataURI.split(',')[1]);
            const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            return new Blob([ab], { type: mimeString });
          };

          const formatWaktu = new Date(payload.waktu_masuk as string).toLocaleString('id-ID');
          const latLng = `${payload.lat},${payload.lng}`;
          const mapsLink = `https://www.google.com/maps?q=${latLng}`;
          const attType = (payload as any).tipe.replace('_', ' ');
          
          const imageBlob = dataURItoBlob(capturedImage);
          const botToken = companyData.telegram_bot_token.trim();
          const tgUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
          
          console.log("Preparing to send Telegram notifications. Target token:", botToken.substring(0, 5) + "...");
          
          if (detectedUser.telegram_chat_id) {
            const safeEmployeeName = detectedUser.nama.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '');
            const textMsg = `*Notifikasi Kehadiran🟢*\n\nHalo *${safeEmployeeName}*,\n\nAbsensi Anda untuk *${attType}* telah berhasil dicatat pada sistem.\n\nWaktu: ${formatWaktu}\nKeterlambatan: ${lateMinutes} menit\n[Lihat Lokasi di Peta](${mapsLink})\nPerusahaan: ${companyData?.nama_perusahaan || "Perusahaan"}`;
            
            const formData = new FormData();
            formData.append('chat_id', detectedUser.telegram_chat_id);
            formData.append('photo', imageBlob, 'attendance.jpg');
            formData.append('caption', textMsg);
            formData.append('parse_mode', 'Markdown');
            
            console.log("Sending TG notif to employee, chat_id:", detectedUser.telegram_chat_id);
            try {
              const res = await fetch(tgUrl, { method: "POST", body: formData });
              const json = await res.json();
              if (!res.ok) console.error("TG API Error (employee):", json);
              else console.log("TG employee success");
            } catch (e) {
              console.error("Fetch TG employee failed:", e);
            }
          }

          // Notify Owners via Telegram
          const { data: admins } = await supabase
            .from('karyawan')
            .select('nip, nama, telegram_chat_id, role')
            .eq('company_id', companyId)
            .in('role', ['OWNER', 'MASTER_ADMIN']);
            
          if (admins && admins.length > 0) {
            const safeName = detectedUser.nama.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '');
            const adminMsg = `*Info Kehadiran🟢*\n\nKaryawan *${safeName}* baru saja melakukan absensi *${attType}*.\n\nWaktu: ${formatWaktu}\nKeterlambatan: ${lateMinutes} menit\n[Lihat Lokasi di Peta](${mapsLink})`;

            for (const admin of admins) {
              if (admin.telegram_chat_id && admin.telegram_chat_id !== detectedUser.telegram_chat_id) {
                const adminFormData = new FormData();
                adminFormData.append('chat_id', admin.telegram_chat_id);
                // Recreate blob for each request to avoid any FormData consumption issues
                adminFormData.append('photo', dataURItoBlob(capturedImage), 'attendance.jpg');
                adminFormData.append('caption', adminMsg);
                adminFormData.append('parse_mode', 'Markdown');
                
                console.log("Sending TG notif to admin, chat_id:", admin.telegram_chat_id);
                try {
                  const res = await fetch(tgUrl, { method: "POST", body: adminFormData });
                  const json = await res.json();
                  if (!res.ok) console.error("TG API Error (admin):", json);
                  else console.log("TG admin success");
                } catch(e) {
                  console.error("Fetch TG admin failed:", e);
                }
              }
            }
          }
        } catch (e) {
          console.error("TG Notification root err", e);
        }
      }
      
      // Auto Cleanup: Delete records older than 1 year (1 tahun berjalan)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      supabase
        .from('absensi')
        .delete()
        .eq('company_id', companyId)
        .lt('waktu_masuk', toLocalISOString(oneYearAgo))
        .then(() => {}, () => {});
      
      console.log("Attendance submitted successfully!");
      setSuccess(true);
      setSuccessLateMinutes(lateMinutes);
      
      let voiceMsg = `Terima kasih ${detectedUser.nama}, silakan beraktivitas.`;
      
      if (attendanceType === 'MASUK') {
        if (lateMinutes > 0) {
          voiceMsg = `Halo ${detectedUser.nama}, absen masuk berhasil. Perhatian, Anda terlambat ${lateMinutes} menit.`;
        } else {
          voiceMsg = `Halo ${detectedUser.nama}, absen masuk berhasil tepat waktu. Selamat bekerja.`;
        }
      } else if (attendanceType === 'PULANG') {
        voiceMsg = `Halo ${detectedUser.nama}, absen pulang berhasil. Terima kasih atas kerja keras Anda hari ini.`;
      } else if (attendanceType === 'LEMBUR_MASUK') {
        voiceMsg = `Halo ${detectedUser.nama}, absen lembur masuk berhasil. Selamat bekerja.`;
      } else if (attendanceType === 'LEMBUR_KELUAR') {
        voiceMsg = `Halo ${detectedUser.nama}, absen lembur keluar berhasil. Terima kasih.`;
      }
      
      speak(voiceMsg);
      
      onSuccess();
      
      // Auto reset for next employee after a short delay
      setTimeout(() => {
        onClose();
        resetAttendance();
      }, 1000);

    } catch (e: any) {
      console.error("Submission Catch Block:", e);
      toast.error(e.message || "Terjadi kesalahan saat menyimpan absensi.");
      setTimeout(() => {
        onClose();
        resetAttendance();
      }, 3500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto pt-safe pb-safe">
          <div className="min-h-full p-3 sm:p-6 flex items-center sm:items-center justify-center py-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={onClose}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-4xl relative z-10 flex flex-col md:flex-row overflow-hidden"
            >
              {/* Success Overlay */}
              <AnimatePresence>
                {success && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-white dark:bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-5 md:p-8 text-center"
                  >
                    <motion.div 
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white mb-6 shadow-2xl shadow-emerald-500/30"
                    >
                      <Check className="w-10 h-10" />
                    </motion.div>
                    
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="space-y-3"
                    >
                      <h2 className="text-4xl md:text-6xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                        Halo, <span className="text-blue-600">{detectedUser?.nama.split(' ')[0]}</span>!
                      </h2>
                      <p className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 font-bold max-w-sm mx-auto leading-tight">
                        Absensi <span className="text-blue-600">{attendanceType.replace('_', ' ')}</span> berhasil.
                      </p>
                    </motion.div>

                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="mt-8 grid grid-cols-2 gap-4 w-full max-w-xs"
                    >
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Waktu</p>
                        <p className="text-lg font-black text-slate-800 dark:text-white text-center">
                          {getSyncedDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Status</p>
                        <p className="text-lg font-black text-emerald-600 text-center uppercase tracking-tighter">SUKSES</p>
                      </div>
                      {successLateMinutes > 0 && attendanceType === 'MASUK' && (
                        <div className="col-span-2 bg-red-50 dark:bg-red-500/10 p-3 rounded-2xl border border-red-200 dark:border-red-500/30 w-full mb-2">
                          <p className="text-xs font-bold text-red-600 dark:text-red-400 text-center uppercase tracking-wider">Terlambat</p>
                          <p className="text-base font-black text-red-700 dark:text-red-300 text-center mt-0.5">{successLateMinutes} Menit</p>
                        </div>
                      )}
                    </motion.div>
                    
                    <motion.div 
                       initial={{ y: 20, opacity: 0 }}
                       animate={{ y: 0, opacity: 1 }}
                       transition={{ delay: 0.3 }}
                       className="mt-10 flex items-center gap-3 bg-emerald-50 dark:bg-emerald-500/10 px-6 py-3 rounded-full border border-emerald-100 dark:border-emerald-500/20 shadow-sm"
                    >
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Kembali ke Dashboard...</span>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            {/* Camera Area */}
            <div className="p-5 md:p-8 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 md:w-[45%] shrink-0">
              <div className={`
                relative w-full aspect-video md:aspect-[4/3] max-w-sm mx-auto bg-black rounded-[2rem] overflow-hidden shadow-inner border-4 transition-all duration-500
                ${faceDetected ? 'border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.3)]' : 'border-slate-200 dark:border-slate-800'}
              `}>
                {!capturedImage ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
                  </>
                ) : (
                  <img src={capturedImage} className="absolute inset-0 w-full h-full object-cover" alt="Captured" />
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <p className={`mt-6 text-sm font-bold text-center tracking-tight ${faceDetected ? 'text-emerald-600' : 'text-slate-500 dark:text-slate-400'}`}>
                {statusMessage}
              </p>
              {capturedImage && (
                <button 
                  onClick={() => { setCapturedImage(null); startCamera(); }}
                  className="mt-4 text-xs font-bold text-blue-600 hover:underline"
                >
                  Ulangi Foto
                </button>
              )}
            </div>

            {/* Form Area */}
            <div className="p-8 md:p-12 md:w-[55%] flex flex-col justify-center space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Verifikasi Kehadiran</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Informasi kehadiran otomatis.</p>
                </div>
                {/* Toggle Scanner */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 self-start sm:self-auto">
                  <button 
                    onClick={() => { setScanMode('face'); setDetectedUser(null); setFaceDetected(false); setStatusMessage("Arahkan wajah ke kamera..."); }}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${scanMode === 'face' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <ScanFace className="w-3.5 h-3.5" /> Face
                  </button>
                  <button 
                    onClick={() => { setScanMode('qr'); setDetectedUser(null); setFaceDetected(false); setStatusMessage("Arahkan QR Code ke kamera..."); }}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${scanMode === 'qr' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <QrCode className="w-3.5 h-3.5" /> QR Code
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Identitas Karyawan</label>
                  <div className={`p-4 rounded-2xl border-2 transition-all ${detectedUser ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 dark:bg-slate-950 border-slate-50'}`}>
                    {detectedUser ? (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white">
                          <UserCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-emerald-900">{detectedUser.nama}</p>
                          <p className="text-xs font-semibold text-emerald-600 opacity-80">NIP: {detectedUser.nip}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic">Mencari {scanMode === 'face' ? 'wajah' : 'QR code'}...</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Pilih Manual</label>
                    <div className="flex items-center gap-3">
                      {gpsLocation ? (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                          <MapPin className="w-3 h-3" /> GPS Aktif
                        </div>
                      ) : gpsError ? (
                        <button onClick={() => fetchGPS(true)} title="Coba lagi" className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 hover:text-red-700 active:scale-95 transition-all outline-none">
                          <MapPin className="w-3 h-3" /> GPS Error (Klik)
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" /> GPS Mencari...
                        </div>
                      )}
                      {isListening && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 animate-pulse">
                          <Mic className="w-3 h-3" /> Voice Ready
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['MASUK', 'KELUAR', 'PULANG', 'KEMBALI', 'LEMBUR_MASUK', 'LEMBUR_KELUAR'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setAttendanceType(type as any)}
                        className={`
                          py-3 rounded-xl text-[10px] font-bold uppercase transition-all
                          ${attendanceType === type 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 ring-4 ring-blue-500/10' 
                            : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800'}
                        `}
                      >
                        {type.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button 
                  id="btn-submit-absensi"
                  onClick={handleSubmit}
                  disabled={loading || !capturedImage || !detectedUser}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanFace className="w-5 h-5" />}
                  Kirim Absensi Sekarang
                </button>
                <button 
                  onClick={onClose}
                  className="w-full text-slate-500 dark:text-slate-400 font-bold text-xs hover:text-slate-600 dark:text-slate-300 transition"
                >
                  Batal & Tutup
                </button>
              </div>
            </div>
          </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

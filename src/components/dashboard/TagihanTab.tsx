import { useState, useEffect, useRef } from "react";
import { User, Company } from "../../types";
import {
  Wallet,
  CreditCard,
  Building2,
  Upload,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Crown,
  FileText,
  Download
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

interface TagihanTabProps {
  companyId: string;
}

interface BillingHistory {
  id: string;
  total_amount: number;
  payment_status: string;
  created_at: string;
}

export default function TagihanTab({ companyId }: TagihanTabProps) {
  const [loading, setLoading] = useState(true);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [companyInfo, setCompanyInfo] = useState<Company | null>(null);
  const [history, setHistory] = useState<BillingHistory[]>([]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<
    "Standart" | "Premium"
  >("Standart");
  const [showInvoice, setShowInvoice] = useState<BillingHistory | null>(null);

  useEffect(() => {
    loadBillingInfo();
  }, [companyId]);

  useEffect(() => {
    // Load Midtrans Snap script dynamically
    fetch("/api/midtrans/config")
      .then(res => res.json())
      .then(config => {
        const clientKey = config.clientKey?.trim();
        if (!clientKey) {
           console.warn("Midtrans Client Key belum di-set di server.");
           return;
        }
        
        const scriptId = 'midtrans-snap-script';
        let script = document.getElementById(scriptId) as HTMLScriptElement;
        if (!script) {
          script = document.createElement("script");
          script.id = scriptId;
          script.src = clientKey.startsWith("SB-") 
            ? "https://app.sandbox.midtrans.com/snap/snap.js" 
            : "https://app.midtrans.com/snap/snap.js";
          script.setAttribute("data-client-key", clientKey);
          script.async = true;
          document.body.appendChild(script);
        }
      })
      .catch(err => console.error("Gagal memuat config midtrans:", err));
  }, []);

  const handlePayment = async () => {
    setIsProcessingPayment(true);
    try {
      toast.loading("Mempersiapkan pembayaran...");
      // Example logic for dynamically choosing base price
      let targetPlan = selectedPlanForPayment;
      let pricePerEmployee =
        selectedPlanForPayment === "Premium" ? 10000 : 5000;

      const subTotal = employeeCount * pricePerEmployee;
      const ppnPercentage = 12;
      const ppnAmount = Math.ceil(subTotal * (ppnPercentage / 100));
      const totalAmount = subTotal + ppnAmount;
      
      // Hanya hapus transaksi PENDING yang belum kadaluarsa agar histori tidak bertumpuk
      // Transaksi yang sudah kadaluarsa (> 24 jam) akan dipertahankan sebagai histori
      const now = new Date().getTime();
      const { data: pendingTx } = await supabase.from('billing_history')
        .select('id, created_at')
        .eq('company_id', companyId)
        .eq('payment_status', 'PENDING');
        
      if (pendingTx && pendingTx.length > 0) {
        const idsToDelete = pendingTx.filter(tx => {
           const txTime = new Date(tx.created_at).getTime();
           return now - txTime <= 24 * 60 * 60 * 1000;
        }).map(tx => tx.id);
        
        if (idsToDelete.length > 0) {
           await supabase.from('billing_history').delete().in('id', idsToDelete);
        }
      }
      
      // 1. Insert into billing_history to get an ID
      const { data: bData, error: bError } = await supabase.from('billing_history').insert({
         company_id: companyId,
         total_amount: totalAmount,
         employee_count: employeeCount,
         payment_status: 'PENDING',
         billing_period: new Date().toISOString()
      }).select().single();
      
      if (bError) throw new Error("Gagal membuat data transaksi: " + bError.message);
      
      const orderId = bData.id;

      const res = await fetch("/api/midtrans/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderId,
          amount: totalAmount,
          planName: targetPlan,
          customerDetails: {
            name: companyInfo?.nama_perusahaan || "Perusahaan X",
            email: companyInfo?.email || "admin@absensikita.id",
            phone: companyInfo?.whatsapp || "",
          },
        }),
      });

      toast.dismiss();

      if (!res.ok) {
        let errorMsg = "Gagal mengambil token Midtrans";
        try {
          const errJson = await res.json();
          if (errJson.error) errorMsg = errJson.error;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const json = await res.json();

      if (json.token) {
        // @ts-ignore
        if (typeof window.snap === 'undefined') {
          toast.error('Sistem pembayaran belum siap atau script Midtrans gagal dimuat.');
          setLoading(false);
          return;
        }
        (window as any).snap.pay(json.token, {
          onSuccess: function (result: any) {
            toast.success("Pembayaran berhasil!");
            loadBillingInfo();
          },
          onPending: function (result: any) {
            toast.info("Menunggu pembayaran Anda.");
            loadBillingInfo();
          },
          onError: function (result: any) {
            toast.error("Pembayaran gagal!");
            loadBillingInfo();
          },
          onClose: function () {
            toast.info("Menu pembayaran ditutup sebelum diselesaikan.");
            loadBillingInfo();
          },
        });
      }
    } catch (e: any) {
      toast.dismiss();
      toast.error(e.message || "Gagal memproses pembayaran");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleRepay = async (tx: BillingHistory) => {
    setIsProcessingPayment(true);
    try {
      toast.loading("Menyiapkan ulang pembayaran...");
      
      await supabase.from('billing_history').delete().eq('id', tx.id);

      const { data: bData, error: bError } = await supabase.from('billing_history').insert({
         company_id: companyId,
         total_amount: tx.total_amount,
         employee_count: employeeCount,
         payment_status: 'PENDING',
         billing_period: new Date().toISOString()
      }).select().single();
      
      if (bError) throw new Error("Gagal membuat data transaksi: " + bError.message);
      
      const orderId = bData.id;

      const res = await fetch("/api/midtrans/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderId,
          amount: tx.total_amount,
          planName: "Perpanjangan Tagihan",
          customerDetails: {
            name: companyInfo?.nama_perusahaan || "Perusahaan X",
            email: companyInfo?.email || "admin@absensikita.id",
            phone: companyInfo?.whatsapp || "",
          },
        }),
      });

      toast.dismiss();

      if (!res.ok) {
        let errorMsg = "Gagal mengambil token Midtrans";
        try {
          const errJson = await res.json();
          if (errJson.error) errorMsg = errJson.error;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const json = await res.json();

      if (json.token) {
        // @ts-ignore
        if (typeof window.snap === 'undefined') {
          toast.error('Sistem pembayaran belum siap atau terhalang ad-blocker.');
          return;
        }
        (window as any).snap.pay(json.token, {
          onSuccess: function () {
            toast.success("Pembayaran berhasil!");
            loadBillingInfo();
          },
          onPending: function () {
            toast.info("Menunggu pembayaran Anda.");
            loadBillingInfo();
          },
          onError: function () {
            toast.error("Pembayaran gagal!");
            loadBillingInfo();
          },
          onClose: function () {
            toast.info("Menu pembayaran ditutup sebelum diselesaikan.");
            loadBillingInfo();
          },
        });
      }
    } catch (e: any) {
      toast.dismiss();
      toast.error(e.message || "Gagal memproses pembayaran ulang");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const loadBillingInfo = async () => {
    setLoading(true);
    try {
      const [compRes, empRes, histRes] = await Promise.all([
        supabase
          .from("companies")
          .select("*")
          .eq("company_id", companyId)
          .single(),
        supabase
          .from("karyawan")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId),
        supabase
          .from("billing_history")
          .select("id, total_amount, payment_status, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
      ]);

      if (compRes.data) {
        setCompanyInfo(compRes.data as Company);
      }
      if (empRes.count !== null) {
        setEmployeeCount(empRes.count);
      }
      if (histRes.data) {
        const now = new Date().getTime();
        const updatedHistory = histRes.data.map(tx => {
           if (tx.payment_status === 'PENDING') {
              const txTime = new Date(tx.created_at).getTime();
              // 24 hours expiry
              if (now - txTime > 24 * 60 * 60 * 1000) {
                 return { ...tx, payment_status: 'EXPIRED' };
              }
           }
           return tx;
        });
        setHistory(updatedHistory);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // Default trial end date or expiration
  const expiryDate = companyInfo?.trial_end_date
    ? new Date(companyInfo.trial_end_date)
    : new Date();
  const diffDays = Math.ceil(
    (expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
  );

  let statusInfo = {
    label: "Active (Free Trial)",
    color: "text-emerald-600 bg-emerald-50",
    icon: <CheckCircle2 className="w-5 h-5" />,
  };
  if (diffDays < 0) {
    statusInfo = {
      label: "Expired",
      color: "text-red-600 bg-red-50",
      icon: <AlertCircle className="w-5 h-5" />,
    };
  } else if (diffDays <= 7) {
    statusInfo = {
      label: `${diffDays} Hari Lagi`,
      color: "text-amber-600 bg-amber-50",
      icon: <Clock className="w-5 h-5" />,
    };
  }

  // Determine current active package (dummy logic based on employee count for UI visualization)
  // In a real app this would read from `companyInfo.subscription_tier`.
  let currentPackage = "Pro";
  let maxEmployees = 100;
  if (employeeCount <= 20) {
    currentPackage = "Standart";
    maxEmployees = 20;
  }
  if (employeeCount > 20) {
    currentPackage = "Premium";
    maxEmployees = 999999;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 sm:p-10 shadow-sm relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Wallet className="w-64 h-64" />
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between relative z-10">
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
              <CreditCard className="w-8 h-8 text-emerald-600" />
              Langganan & Tagihan
            </h2>
            <p className="text-slate-500 font-medium text-sm mt-2 max-w-md">
              Tingkatkan paket layanan untuk membuka batas fitur dan jumlah
              karyawan.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div
              className={`flex items-center gap-3 px-5 py-3 rounded-2xl ${statusInfo.color}`}
            >
              {statusInfo.icon}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">
                  Masa Aktif
                </p>
                <p className="text-lg font-bold">{statusInfo.label}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10 relative z-10">
          {/* Standard Plan */}
          <div
            className={`rounded-3xl border p-6 flex flex-col ${currentPackage === "Standart" ? "bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm relative" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}
          >
            {currentPackage === "Standart" && (
              <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-3xl uppercase tracking-wider">
                Paket Saat Ini
              </div>
            )}
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-1">
              <CheckCircle2
                className={`w-5 h-5 ${currentPackage === "Standart" ? "text-blue-500" : "text-slate-400"}`}
              />
              Standart
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 h-8">
              Cocok untuk UMKM pemula.
            </p>
            <div className="mb-6">
              <span className="text-3xl font-black text-slate-800 dark:text-white">
                Rp 5.000
              </span>
              <span className="text-xs text-slate-500 font-medium">
                /pegawai/bulan
              </span>
            </div>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300 font-medium flex-1 mb-6">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />{" "}
                Karyawan Tidak Terbatas
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />{" "}
                Manajemen Shift Lengkap
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />{" "}
                Penyimpanan Data 3 Bulan
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />{" "}
                Absen Wajah AI & GPS
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />{" "}
                Laporan Excel Dasar
              </li>
            </ul>
          </div>

          {/* Premium Plan */}
          <div
            className={`rounded-3xl border p-6 flex flex-col ${currentPackage === "Premium" ? "bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-500/20 relative" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}
          >
            {currentPackage === "Premium" && (
              <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-3xl uppercase tracking-wider">
                Paket Saat Ini
              </div>
            )}
            <h3
              className={`text-lg font-bold flex items-center gap-2 mb-1 ${currentPackage === "Premium" ? "text-white" : "text-slate-800 dark:text-white"}`}
            >
              <Zap
                className={`w-5 h-5 ${currentPackage === "Premium" ? "text-amber-400" : "text-amber-500"}`}
              />
              Premium
            </h3>
            <p
              className={`text-xs h-8 ${currentPackage === "Premium" ? "text-blue-100" : "text-slate-500 dark:text-slate-400"} mb-4`}
            >
              Untuk usaha menengah yang berkembang.
            </p>
            <div className="mb-6">
              <span
                className={`text-3xl font-black ${currentPackage === "Premium" ? "text-white" : "text-slate-800 dark:text-white"}`}
              >
                Rp 10.000
              </span>
              <span
                className={`text-xs font-medium ${currentPackage === "Premium" ? "text-blue-200" : "text-slate-500"}`}
              >
                /pegawai/bulan
              </span>
            </div>
            <ul
              className={`space-y-2 text-sm font-medium flex-1 mb-6 ${currentPackage === "Premium" ? "text-blue-50" : "text-slate-600 dark:text-slate-300"}`}
            >
              <li className="flex items-start gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${currentPackage === "Premium" ? "bg-amber-400" : "bg-amber-500"}`}
                />{" "}
                Semua Fitur Standart
              </li>
              <li className="flex items-start gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${currentPackage === "Premium" ? "bg-amber-400" : "bg-amber-500"}`}
                />{" "}
                Penyimpanan Data 1 Tahun
              </li>
              <li className="flex items-start gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${currentPackage === "Premium" ? "bg-amber-400" : "bg-amber-500"}`}
                />{" "}
                Auto-Sync G-Sheets & WhatsApp
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 bg-white dark:bg-slate-800 rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex flex-col lg:flex-row gap-8 items-start justify-between">
            <div className="flex-1 min-w-0 w-full">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-2 text-lg">
                Ingin Mengubah / Berlangganan Paket?
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mb-6 leading-relaxed">
                Perpanjang masa aktif atau ubah paket secara otomatis melalui{" "}
                <strong className="text-slate-800 dark:text-slate-200">Midtrans</strong>. Pembayaran otomatis terverifikasi dan paket langsung diperbarui.
              </p>
              
              <div className="inline-flex w-full sm:w-auto flex-col sm:flex-row bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="px-5 py-3 sm:border-r border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px] uppercase font-bold tracking-wider mb-0.5">
                    Total Pegawai
                  </span>
                  <span className="font-bold text-slate-800 dark:text-white text-base">
                    {employeeCount} <span className="font-normal text-slate-500 text-sm">Pegawai</span>
                  </span>
                </div>
                
                <div className="px-5 py-3 flex flex-col justify-center w-full sm:w-auto sm:min-w-[240px]">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px] uppercase font-bold tracking-wider mb-0.5">
                    Pilih Paket
                  </span>
                  <select
                    className="font-bold text-slate-800 dark:text-white bg-transparent border-none outline-none cursor-pointer w-full text-base focus:ring-0 p-0"
                    value={selectedPlanForPayment}
                    onChange={(e) =>
                      setSelectedPlanForPayment(
                        e.target.value as "Standart" | "Premium",
                      )
                    }
                  >
                    <option value="Standart" className="text-slate-800">
                      Standart (Rp 5.000/org)
                    </option>
                    <option value="Premium" className="text-slate-800">
                      Premium (Rp 10.000/org)
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-[320px] flex-shrink-0 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center lg:items-end gap-5">
              <div className="w-full text-center lg:text-right">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider block mb-1.5">
                  Total Pembayaran (Termasuk PPN 12%)
                </span>
                <div className="flex items-baseline justify-center lg:justify-end gap-1 text-rose-600 dark:text-rose-400">
                  <span className="text-sm font-bold">Rp</span>
                  <span className="font-black text-3xl tracking-tight">
                    {new Intl.NumberFormat("id-ID").format(
                      (employeeCount * (selectedPlanForPayment === "Premium" ? 10000 : 5000)) +
                      Math.ceil((employeeCount * (selectedPlanForPayment === "Premium" ? 10000 : 5000)) * 0.12)
                    )}
                  </span>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 block mt-1.5 font-medium">
                  {formatCurrency(employeeCount * (selectedPlanForPayment === "Premium" ? 10000 : 5000))} + PPN
                </span>
              </div>
              
              <div className="w-full flex flex-col gap-3 mt-1">
                <button
                  onClick={handlePayment}
                  disabled={isProcessingPayment}
                  className="w-full inline-flex items-center justify-center bg-blue-600 text-white font-bold px-6 py-3.5 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessingPayment ? "Memproses..." : "Bayar Sekarang"}
                </button>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                  Dengan membayar, Anda menyetujui{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 transition">
                    Syarat & Ketentuan
                  </a>
                  {" "}serta{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 transition">
                    Kebijakan Privasi
                  </a>
                  . Jika ada kendala, hubungi <a href="mailto:support@absensikita.com" className="text-blue-500 hover:text-blue-600">support@absensikita.com</a>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History Pembelian */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 sm:p-10 shadow-sm">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6">
          <FileText className="w-6 h-6 text-blue-500" />
          Histori Pembelian
        </h3>
        {history.length === 0 ? (
          <div className="text-center py-10 text-slate-500 dark:text-slate-400">
            Belum ada histori transaksi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-4 px-4 font-semibold text-slate-600 dark:text-slate-300">Tanggal</th>
                  <th className="py-4 px-4 font-semibold text-slate-600 dark:text-slate-300">Nominal</th>
                  <th className="py-4 px-4 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                  <th className="py-4 px-4 font-semibold text-slate-600 dark:text-slate-300 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {history.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="py-4 px-4 text-slate-700 dark:text-slate-300">
                      {new Date(tx.created_at).toLocaleDateString("id-ID", {
                        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </td>
                    <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {formatCurrency(tx.total_amount)}
                    </td>
                    <td className="py-4 px-4">
                      {tx.payment_status === "SETTLED" ? (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full text-xs font-bold tracking-wide">
                          BERHASIL
                        </span>
                      ) : tx.payment_status === "PENDING" ? (
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-xs font-bold tracking-wide">
                          MENUNGGU
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs font-bold tracking-wide">
                          {tx.payment_status === "EXPIRED" ? "KEDALUWARSA" : tx.payment_status}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      {tx.payment_status === "SETTLED" && (
                        <button
                          onClick={() => setShowInvoice(tx)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition"
                        >
                          <Download className="w-4 h-4" />
                          Invoice
                        </button>
                      )}
                      {tx.payment_status === "PENDING" && (
                        <button
                          onClick={() => handleRepay(tx)}
                          disabled={isProcessingPayment}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Wallet className="w-4 h-4" />
                          Lanjutkan Pembayaran
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl overflow-hidden print:w-full print:max-w-none print:shadow-none print:bg-white"
            >
              <div id="invoice-content" className="p-8 sm:p-12 text-slate-800 print:text-black">
                <div className="flex justify-between items-start mb-12">
                  <div>
                    <h2 className="text-3xl font-black text-blue-600 print:text-blue-600">INVOICE</h2>
                    <p className="text-sm text-slate-500 mt-1">Order #{showInvoice.id.substring(0,8).toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xl">AbsensiKita Cloud</p>
                    <p className="text-sm text-slate-500">PT Maju Bersama<br/>Jakarta, Indonesia</p>
                  </div>
                </div>

                <div className="flex justify-between mb-12 py-6 border-y border-slate-100 print:border-slate-200">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ditagihkan Kepada</p>
                    <p className="font-bold text-lg">{companyInfo?.nama_perusahaan}</p>
                    <p className="text-sm text-slate-500">{companyInfo?.email}</p>
                    <p className="text-sm text-slate-500">{companyInfo?.whatsapp}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tanggal Terbit</p>
                    <p className="font-medium">
                      {new Date(showInvoice.created_at).toLocaleDateString("id-ID", {
                        day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
                      })}
                    </p>
                  </div>
                </div>

                <div className="mb-8">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-100 print:border-slate-200">
                        <th className="py-3 text-sm font-bold text-slate-600 uppercase tracking-wider">Deskripsi</th>
                        <th className="py-3 text-sm font-bold text-slate-600 uppercase tracking-wider text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-50 print:border-slate-100">
                        <td className="py-4">
                          <p className="font-bold">Langganan Fitur AbsensiKita {showInvoice.total_amount > 200000 ? "Premium" : "Standart"}</p>
                        </td>
                        <td className="py-4 text-right font-medium">
                          {formatCurrency(showInvoice.total_amount)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-100 print:border-slate-200">
                        <td className="py-4 font-black text-right pr-8">TOTAL</td>
                        <td className="py-4 font-black text-xl text-right text-blue-600 print:text-blue-600">
                          {formatCurrency(showInvoice.total_amount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="text-center mt-16 text-sm text-slate-400">
                  <p className="font-medium text-emerald-500 mb-2">✓ LUNAS</p>
                  <p>Terima kasih telah berlangganan AbsensiKita Cloud.</p>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 print:hidden">
                <button
                  onClick={() => setShowInvoice(null)}
                  className="px-5 py-2 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition rounded-lg"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    const content = document.getElementById("invoice-content")?.innerHTML;
                    if (content) {
                       const printWindow = window.open('', '', 'height=800,width=800');
                       if (printWindow) {
                         printWindow.document.write(`
                           <html>
                             <head>
                               <title>Invoice - ${showInvoice.id.substring(0,8)}</title>
                               <script src="https://cdn.tailwindcss.com"></script>
                             </head>
                             <body class="p-8">
                               ${content}
                               <script>
                                 setTimeout(() => {
                                   window.print();
                                   window.close();
                                 }, 500);
                               </script>
                             </body>
                           </html>
                         `);
                         printWindow.document.close();
                       }
                    } else {
                       window.print();
                    }
                  }}
                  className="px-5 py-2 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium transition rounded-lg"
                >
                  <Download className="w-4 h-4" />
                  Cetak / PDF
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

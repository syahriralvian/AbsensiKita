import { useState, useRef, useMemo, useEffect } from "react";
import { confirmDialog } from "../../lib/confirmDialog";
import { User, Department, UserRole } from "../../types";
import { QRCodeSVG } from "qrcode.react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Mail,
  Phone,
  Hash,
  Building2,
  UserCircle,
  Loader2,
  X,
  Save,
  ScanFace,
  Download,
  Upload,
  Eye,
  Camera,
  UserX,
  QrCode,
  Printer,
  Bot,
  Link,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { motion, AnimatePresence } from "motion/react";
import FaceRegistrationModal from "./FaceRegistrationModal";
import { toast } from "sonner";
import { createAuditLog } from "../../lib/audit";

interface KaryawanTabProps {
  user: User;
  employees: User[];
  departments: Department[];
  loading: boolean;
  onRefresh: () => void;
  companyId: string;
}

const AVAILABLE_PERMISSIONS = [
  { id: "dashboard", label: "Monitor Dashboard" },
  { id: "log", label: "Log Presensi" },
  { id: "karyawan", label: "Data Karyawan" },
  { id: "izin", label: "Izin & Koreksi" },
  { id: "jam_kerja", label: "Master Jam Kerja" },
  { id: "siklus", label: "Master Siklus" },
  { id: "departemen", label: "Master Departemen" },
  { id: "maintenance", label: "Maintenance Mesin" },
  { id: "pengaturan", label: "Pengaturan" },
  { id: "kartu", label: "Laporan Kartu Absensi" },
  { id: "rekap", label: "Laporan Rekap Absensi" },
  { id: "total", label: "Laporan Total Absensi" },
  { id: "payroll", label: "Laporan Payroll" },
];

export default function KaryawanTab({
  user,
  employees,
  departments,
  loading,
  onRefresh,
  companyId,
}: KaryawanTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedForFace, setSelectedForFace] = useState<{
    nip: string;
    nama: string;
  } | null>(null);
  const [selectedForQr, setSelectedForQr] = useState<{
    nip: string;
    nama: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingEmp, setEditingEmp] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [isBulkMoveModalOpen, setIsBulkMoveModalOpen] = useState(false);
  const [bulkMoveDeptId, setBulkMoveDeptId] = useState<string>("");

  const [telegramLinkData, setTelegramLinkData] = useState<{
    show: boolean;
    nip: string;
    nama: string;
    code: string | null;
  }>({ show: false, nip: "", nama: "", code: null });

  const [formData, setFormData] = useState({
    nip: "",
    nama: "",
    no_hp_notif: "",
    departemen_id: "",
    role: "USER" as UserRole,
    nfc_uid: "",
    gaji_pokok: 0,
    uang_makan: 0,
    tunjangan: 0,
    potongan: 0,
    denda_telat: 0,
    bonus_lembur: 0,
    admin_permissions: "",
  });

  const filteredEmployees = useMemo(() => employees.filter((emp) => {
    // Hide MASTER_ADMIN and OWNER from non owners/master admins
    if ((emp.role === "MASTER_ADMIN" || emp.role === "OWNER") && 
        (user.role !== "MASTER_ADMIN" && user.role !== "OWNER")) {
      return false;
    }

    // Hide other SUPER ADMINs from a SUPER ADMIN
    if (emp.role === "SUPER ADMIN" && user.role === "SUPER ADMIN" && emp.nip !== user.nip) {
       return false;
    }

    const matchesSearch =
      emp.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.nip.toLowerCase().includes(searchTerm.toLowerCase());
    
    // For General, it might be null or undefined. Convert those to "null" for matching
    const empDeptStr = emp.departemen_id ? String(emp.departemen_id) : "null";
    const matchesDept =
      selectedDept === "all" || empDeptStr === selectedDept;
    
    return matchesSearch && matchesDept;
  }), [employees, user.role, searchTerm, selectedDept]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDept]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEmployees, currentPage]);

  const handleOpenModal = (emp?: User) => {
    if (emp) {
      setEditingEmp(emp);
      setFormData({
        nip: emp.nip,
        nama: emp.nama,
        no_hp_notif: emp.no_hp_notif || "",
        departemen_id: emp.departemen_id ? String(emp.departemen_id) : "null",
        role: emp.role || ("USER" as UserRole),
        nfc_uid: emp.nfc_uid || "",
        gaji_pokok: emp.gaji_pokok || 0,
        uang_makan: emp.uang_makan || 0,
        tunjangan: emp.tunjangan || 0,
        potongan: emp.potongan || 0,
        denda_telat: emp.denda_telat || 0,
        bonus_lembur: emp.bonus_lembur || 0,
        admin_permissions: emp.admin_permissions || "",
      });
    } else {
      setEditingEmp(null);
      setFormData({
        nip: "",
        nama: "",
        no_hp_notif: "",
        departemen_id: "",
        role: "USER" as UserRole,
        nfc_uid: "",
        gaji_pokok: 0,
        uang_makan: 0,
        tunjangan: 0,
        potongan: 0,
        denda_telat: 0,
        bonus_lembur: 0,
        admin_permissions: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenFaceModal = (nip: string, nama: string) => {
    setSelectedForFace({ nip, nama });
    setIsFaceModalOpen(true);
  };

  const handleOpenQrModal = (nip: string, nama: string) => {
    setSelectedForQr({ nip, nama });
    setIsQrModalOpen(true);
  };

  const toggleSelectEmployee = (nip: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(nip) ? prev.filter((id) => id !== nip) : [...prev, nip]
    );
  };

  const toggleSelectAll = () => {
    const currentPageIds = paginatedEmployees.map(emp => emp.nip);
    const allSelectedOnPage = currentPageIds.every(id => selectedEmployeeIds.includes(id));
    if (allSelectedOnPage) {
      setSelectedEmployeeIds(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      setSelectedEmployeeIds(prev => {
        const next = new Set(prev);
        currentPageIds.forEach(id => next.add(id));
        return Array.from(next);
      });
    }
  };

  const handleBulkMove = async () => {
    if (bulkMoveDeptId === "") {
      toast.error("Pilih departemen tujuan terlebih dahulu.");
      return;
    }
    setSaving(true);
    try {
      const deptId = parseInt(bulkMoveDeptId) || null;
      const { error } = await supabase
        .from("karyawan")
        .update({ departemen_id: deptId, last_updated: Date.now() })
        .in("nip", selectedEmployeeIds)
        .eq("company_id", companyId);

      if (error) throw error;

      toast.success(`${selectedEmployeeIds.length} karyawan berhasil dipindahkan.`);
      setSelectedEmployeeIds([]);
      setIsBulkMoveModalOpen(false);
      onRefresh();
    } catch (e: any) {
      toast.error("Gagal memindahkan departemen", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nip || !formData.nama)
      return toast.error("NIP dan Nama wajib diisi!");

    setSaving(true);
    try {
      if (formData.no_hp_notif) {
        const { data: existingHps } = await supabase
          .from("karyawan")
          .select("nip, company_id")
          .eq("no_hp_notif", formData.no_hp_notif);

        const isUsedByOther = existingHps?.some(
          (hp) =>
            !(
              editingEmp &&
              hp.nip === editingEmp.nip &&
              hp.company_id === companyId
            ),
        );

        if (isUsedByOther) {
          toast.error("Nomor WhatsApp ini sudah digunakan oleh karyawan lain.");
          setSaving(false);
          return;
        }
      }

      const payload: any = {
        nip: formData.nip,
        nama: formData.nama,
        no_hp_notif: formData.no_hp_notif,
        departemen_id: parseInt(formData.departemen_id) || null,
        role: formData.role,
        company_id: companyId,
        nfc_uid: formData.nfc_uid,
        gaji_pokok: formData.gaji_pokok,
        uang_makan: formData.uang_makan,
        tunjangan: formData.tunjangan,
        potongan: formData.potongan,
        denda_telat: formData.denda_telat,
        bonus_lembur: formData.bonus_lembur,
        admin_permissions: formData.admin_permissions,
        last_updated: Date.now(),
      };

      if (editingEmp) {
        // Get old data for audit log
        const { data: oldEmp } = await supabase
          .from("karyawan")
          .select("*")
          .eq("nip", editingEmp.nip)
          .eq("company_id", companyId)
          .single();

        const { error } = await supabase
          .from("karyawan")
          .update(payload)
          .eq("nip", editingEmp.nip)
          .eq("company_id", companyId);
        if (error) throw error;

        await createAuditLog(
          user,
          "UPDATE",
          "karyawan",
          editingEmp.nip,
          oldEmp,
          payload,
        );
      } else {
        const { error } = await supabase.from("karyawan").insert([payload]);
        if (error) throw error;

        await createAuditLog(
          user,
          "INSERT",
          "karyawan",
          formData.nip,
          null,
          payload,
        );
      }

      // Fetch all machines for this company to broadcast the command
      const { data: machines } = await supabase
        .from("adms_connections")
        .select("sn_mesin")
        .eq("company_id", companyId);

      // Add to machine command queue
      const priv =
        payload.role === "SUPER ADMIN" || payload.role === "MASTER_ADMIN"
          ? 14
          : 0;
      const cmdStrBase = `DATA UPDATE userinfo PIN=${payload.nip}\tName=${payload.nama}\tPri=${priv}${payload.nfc_uid ? `\tCard=${payload.nfc_uid}` : ""}`;

      if (machines && machines.length > 0) {
        // filter out duplicate SNs
        const uniqueSNs = Array.from(new Set(machines.map((m) => m.sn_mesin)));
        const commandsToInsert = uniqueSNs.map((sn) => ({
          company_id: companyId,
          command: `${sn}|${cmdStrBase}`,
          status: "PENDING",
        }));
        await supabase.from("machine_commands").insert(commandsToInsert);
      }

      setIsModalOpen(false);
      toast.success(
        editingEmp
          ? "Data berhasil diperbarui dan disinkron ke mesin"
          : "Staff berhasil didaftarkan dan disinkron ke mesin",
      );
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (nip: string, name: string) => {
    setConfirmDelete({
      show: true,
      title: "Hapus Staf",
      message: `Apakah Anda yakin ingin menghapus data staf "${name}"? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        // Get old data
        const { data: oldEmp } = await supabase
          .from("karyawan")
          .select("*")
          .eq("nip", nip)
          .eq("company_id", companyId)
          .single();

        const { error } = await supabase
          .from("karyawan")
          .delete()
          .eq("nip", nip)
          .eq("company_id", companyId);

        if (error) {
          toast.error(error.message);
        } else {
          await createAuditLog(user, "DELETE", "karyawan", nip, oldEmp, null);

          // Fetch machines to broadcast delete
          const { data: machines } = await supabase
            .from("adms_connections")
            .select("sn_mesin")
            .eq("company_id", companyId);

          // Add to machine command queue to delete user from device
          const cmdStrBase = `DATA DELETE userinfo PIN=${nip}`;

          if (machines && machines.length > 0) {
            const uniqueDeleteSNs = Array.from(
              new Set(machines.map((m) => m.sn_mesin)),
            );
            const deleteCommands = uniqueDeleteSNs.map((sn) => ({
              company_id: companyId,
              command: `${sn}|${cmdStrBase}`,
              status: "PENDING",
            }));
            await supabase.from("machine_commands").insert(deleteCommands);
          }

          toast.success("Data berhasil dihapus dari cloud dan antrian mesin");
        }
        setConfirmDelete((prev) => ({ ...prev, show: false }));
        onRefresh();
      },
    });
  };

  const handleGenerateTelegramLink = async (nip: string, nama: string) => {
    try {
      setSaving(true);
      const code = "LINK-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error } = await supabase.from('karyawan').update({ telegram_link_code: code }).eq('nip', nip).eq('company_id', companyId);
      
      if (error) {
        toast.error("Gagal membuat tautan: " + error.message);
      } else {
        setTelegramLinkData({ show: true, nip, nama, code });
      }
    } catch(e: any) {
      toast.error("Terjadi kesalahan: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEmployeeIds.length === 0) return;
    
    setConfirmDelete({
      show: true,
      title: "Hapus Staf",
      message: `Apakah Anda yakin ingin menghapus ${selectedEmployeeIds.length} staf? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        // Fetch old data for audit log
        const { data: oldEmps } = await supabase
          .from("karyawan")
          .select("*")
          .in("nip", selectedEmployeeIds)
          .eq("company_id", companyId);

        // Delete associated records like absensi first
        await supabase
          .from("absensi")
          .delete()
          .in("nip", selectedEmployeeIds)
          .eq("company_id", companyId);

        const { error } = await supabase
          .from("karyawan")
          .delete()
          .in("nip", selectedEmployeeIds)
          .eq("company_id", companyId);

        if (error) {
          toast.error(error.message);
        } else {
          // Add audit logs
          if (oldEmps) {
            const auditPromises = oldEmps.map(emp => createAuditLog(user, "DELETE", "karyawan", emp.nip, emp, null));
            await Promise.all(auditPromises);
          }

          // Fetch machines to broadcast delete
          const { data: machines } = await supabase
            .from("adms_connections")
            .select("sn_mesin")
            .eq("company_id", companyId);

          if (machines && machines.length > 0) {
            const uniqueDeleteSNs = Array.from(
              new Set(machines.map((m) => m.sn_mesin)),
            );
            
            const deleteCommands: any[] = [];
            selectedEmployeeIds.forEach((nip) => {
              const cmdStrBase = `DATA DELETE userinfo PIN=${nip}`;
              uniqueDeleteSNs.forEach((sn) => {
                deleteCommands.push({
                  company_id: companyId,
                  command: `${sn}|${cmdStrBase}`,
                  status: "PENDING",
                });
              });
            });
            
            if (deleteCommands.length > 0) {
               await supabase.from("machine_commands").insert(deleteCommands);
            }
          }
          
          setSelectedEmployeeIds([]);
          toast.success(`${selectedEmployeeIds.length} data berhasil dihapus dari cloud dan antrian mesin`);
        }
        setConfirmDelete((prev) => ({ ...prev, show: false }));
        onRefresh();
      },
    });
  };

  const handleDeleteFace = async (nip: string, name: string) => {
    setConfirmDelete({
      show: true,
      title: "Hapus Data Wajah",
      message: `Apakah Anda yakin ingin menghapus data wajah untuk "${name}"?`,
      onConfirm: async () => {
        const { data: oldEmp } = await supabase
          .from("karyawan")
          .select("*")
          .eq("nip", nip)
          .eq("company_id", companyId)
          .single();

        const payload = {
          foto_wajah_base64: null,
          face_embedding: null,
          is_biometric_enabled: false,
          last_updated: Date.now(),
        };

        const { error } = await supabase
          .from("karyawan")
          .update(payload)
          .eq("nip", nip)
          .eq("company_id", companyId);

        if (error) {
          toast.error(error.message);
        } else {
          await createAuditLog(
            user,
            "UPDATE",
            "karyawan_face",
            nip,
            oldEmp,
            payload,
          );

          // Face deletion on machine means clearing pic or re-updating user info?
          await supabase.from("machine_commands").insert({
            company_id: companyId,
            command: `DATA DELETE biophoto PIN=${nip}`,
            status: "PENDING",
          });

          toast.success(`Data wajah "${name}" berhasil dihapus.`);
        }
        setConfirmDelete((prev) => ({ ...prev, show: false }));
        onRefresh();
      },
    });
  };

  const exportCSV = () => {
    if (employees.length === 0) return toast.error("Belum ada data staf.");
    let csvContent = "NIP,Nama,No_HP,Role\n";
    employees.forEach((e) => {
      const nama = e.nama.includes(",") ? `"${e.nama}"` : e.nama;
      csvContent += `${e.nip},${nama},${e.no_hp_notif || ""},${e.role || "USER"}\n`;
    });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Data_Karyawan_${companyId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const view = new DataView(buffer);
        const uint8Array = new Uint8Array(buffer);
        
        // Detect if binary (e.g. ZKTeco user.dat contains many null bytes)
        let nullCount = 0;
        for (let i = 0; i < Math.min(uint8Array.length, 1000); i++) {
          if (uint8Array[i] === 0) nullCount++;
        }
        const isBinary = nullCount > 20;

        const newEmployees = [];
        const isDat = file.name.toLowerCase().endsWith('.dat');

        if (isDat && isBinary) {
           // Parse 72-byte fixed-length records (ZK TFT user.dat)
           // Defaulting to 72 bytes, some older models use 28, but 72 is most common.
           const recordSize = uint8Array.length % 72 === 0 ? 72 : (uint8Array.length % 28 === 0 ? 28 : 72);
           
           for (let offset = 0; offset < uint8Array.length; offset += recordSize) {
             const chunk = uint8Array.slice(offset, offset + recordSize);
             if (chunk.length < recordSize) break;
             
             const decodeString = (arr: Uint8Array) => {
               let str = '';
               for (let i = 0; i < arr.length; i++) {
                 if (arr[i] === 0) break;
                 str += String.fromCharCode(arr[i]);
               }
               return str.trim();
             };

             const uid = view.getUint16(offset, true); // internal ID
             let nama = decodeString(chunk.slice(11, 35)); // name usually starts at 11 or 12
             if (!nama) nama = decodeString(chunk.slice(12, 36)); // slight offset variation
             let nip = decodeString(chunk.slice(48, 72)); // PIN / User ID
             if (!nip) nip = uid.toString();
             
             if (!nama) nama = nip;

             if (nip && nip !== '0' && nama) {
               newEmployees.push({
                 company_id: companyId,
                 nip,
                 nama,
                 no_hp_notif: "",
                 role: "USER"
               });
             }
           }
        } 
        else {
           // Parse as Text (CSV or tab-separated user.dat)
           const decoder = new TextDecoder("utf-8");
           let text = decoder.decode(uint8Array);
           text = text.replace(/\0/g, ''); // Fix Postgres JSON NUL byte issue
           
           const rows = text.split(/\r?\n/).filter((row) => row.trim() !== "");
           const hasHeader = rows[0].toLowerCase().includes("nama") || rows[0].toLowerCase().includes("nip");
           const startIndex = hasHeader && !isDat ? 1 : 0;

           for (let i = startIndex; i < rows.length; i++) {
             let nip = "";
             let nama = "";
             let hp = "";
             let role = "USER";

             if (isDat || rows[i].includes('\t')) {
               const cols = rows[i].split(/\t+/);
               if (cols.length >= 2) {
                 nip = cols[0].trim();
                 nama = cols[3] ? cols[3].trim() : nip; 
                 if (nama === "") nama = nip;
               }
             } else {
               const cols = rows[i].split(",");
               if (cols.length >= 2) {
                 nip = cols[0].trim();
                 nama = cols[1].trim();
                 if (nama.startsWith('"') && nama.endsWith('"'))
                   nama = nama.substring(1, nama.length - 1);
                 hp = cols[2] ? cols[2].trim() : "";
                 role = cols[3] ? cols[3].trim().toUpperCase() : "USER";
               }
             }
             
             if (nip && nama) {
               newEmployees.push({
                 company_id: companyId,
                 nip,
                 nama,
                 no_hp_notif: hp,
                 role: ["USER", "SUPER ADMIN"].includes(role) ? role : "USER",
               });
             }
           }
        }

        if (newEmployees.length === 0)
          throw new Error("Format file tidak valid atau kosong.");
        const phoneNumbers = newEmployees
          .map((e) => e.no_hp_notif)
          .filter((hp) => hp !== "");
        if (phoneNumbers.length > 0) {
          const { data: existingHps } = await supabase
            .from("karyawan")
            .select("no_hp_notif")
            .in("no_hp_notif", phoneNumbers);

          if (existingHps && existingHps.length > 0) {
            const duplicates = existingHps.map((e) => e.no_hp_notif).join(", ");
            throw new Error(
              `Nomor WhatsApp berikut sudah digunakan: ${duplicates}`,
            );
          }
        }

        const { error } = await supabase.from("karyawan").insert(newEmployees);
        if (error) {
          if (error.code === "23505")
            throw new Error("Terdapat NIP duplikat di dalam file.");
          throw error;
        }
        toast.success(`Berhasil import ${newEmployees.length} karyawan!`);
        onRefresh();
      } catch (error: any) {
        toast.error("Gagal Import Data", { description: error.message });
      } finally {
        setSaving(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1e293b] tracking-tight">
            Manajemen Staff
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            Kelola data, biometrik wajah, dan departemen karyawan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {selectedEmployeeIds.length > 0 && (
            <>
              <button
                onClick={() => setIsBulkMoveModalOpen(true)}
                className="flex-[1_1_auto] md:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-xs sm:text-sm hover:bg-indigo-100 transition-all border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20"
              >
                <Building2 className="w-4 h-4 shrink-0" />
                Pindah Dept ({selectedEmployeeIds.length})
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex-[1_1_auto] md:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-50 text-red-700 rounded-xl font-bold text-xs sm:text-sm hover:bg-red-100 transition-all border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                Hapus ({selectedEmployeeIds.length})
              </button>
            </>
          )}

          <button
            onClick={exportCSV}
            className="flex-[1_1_auto] md:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#f1f5f9] text-[#0f172a] rounded-xl font-bold text-xs sm:text-sm hover:bg-slate-200 dark:bg-slate-700 transition-all border border-slate-200 dark:border-slate-800/50"
          >
            <Download className="w-4 h-4 text-emerald-600 shrink-0" /> Export
          </button>

          <input
            type="file"
            accept=".csv,.dat"
            ref={fileInputRef}
            className="hidden"
            onChange={importCSV}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-[1_1_auto] md:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#fff7ed] dark:bg-orange-500/10 text-[#9a3412] dark:text-orange-400 rounded-xl font-bold text-xs sm:text-sm hover:bg-orange-100 transition-all border border-orange-200/50"
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin text-orange-600 shrink-0" />
            ) : (
              <Upload className="w-4 h-4 text-orange-600 shrink-0" />
            )}
            Import
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="flex-[1_1_auto] md:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#2563eb] text-white rounded-xl font-bold text-xs sm:text-sm hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all border border-blue-500/50"
          >
            <Plus className="w-4 h-4 shrink-0" /> Tambah Baru
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="md:col-span-3 relative bg-white dark:bg-slate-900 p-2 rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-sm transition-all focus-within:ring-4 focus-within:ring-blue-500/5">
          <Search className="w-6 h-6 absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama atau NIP karyawan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-8 py-4 bg-slate-50 dark:bg-slate-950 border-none rounded-[1.25rem] outline-none font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-500 dark:text-slate-400 focus:bg-white dark:focus:bg-slate-800 transition-all"
          />
        </div>
        <div className="relative bg-white dark:bg-slate-900 p-2 rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-sm transition-all">
          <Building2 className="w-6 h-6 absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full pl-16 pr-8 py-4 bg-slate-50 dark:bg-slate-950 border-none rounded-[1.25rem] outline-none font-bold text-slate-700 dark:text-slate-200 appearance-none cursor-pointer focus:bg-white dark:focus:bg-slate-800 transition-all text-sm"
          >
            <option value="all">Semua Departemen</option>
            <option value="null">General</option>
            {departments.filter(dept => dept.nama_departemen?.toLowerCase() !== "management").map((dept) => (
              <option key={dept.id} value={String(dept.id)}>
                {dept.nama_departemen}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] border-b border-slate-50">
                <th className="px-5 py-5 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={
                      paginatedEmployees.length > 0 &&
                      paginatedEmployees.every((emp) =>
                        selectedEmployeeIds.includes(emp.nip)
                      )
                    }
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-5">Nama Karyawan</th>
                <th className="px-5 py-5">NIP / WA</th>
                <th className="px-5 py-5">Departemen</th>
                <th className="px-5 py-5">Role</th>
                <th className="px-6 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <UserCircle className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                        Tidak ada data karyawan.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp) => (
                  <tr
                    key={emp.nip}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-950/50 transition-colors group"
                  >
                    <td className="px-5 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(emp.nip)}
                        onChange={() => toggleSelectEmployee(emp.nip)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg shadow-sm border border-blue-100/50 overflow-hidden shrink-0">
                          {emp.foto_wajah_base64 ? (
                            <img
                              src={
                                emp.foto_wajah_base64.startsWith("data:image")
                                  ? emp.foto_wajah_base64
                                  : `data:image/jpeg;base64,${emp.foto_wajah_base64}`
                              }
                              alt={emp.nama}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            emp.nama.charAt(0)
                          )}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-800 dark:text-slate-100 text-sm tracking-tight">
                            {emp.nama}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {(() => {
                              let hasFaceAdms = false;
                              let hasFp = false;
                              if (typeof emp.face_embedding === "string") {
                                hasFaceAdms = emp.face_embedding.includes('"face":') && !emp.face_embedding.includes('"face":[]') && !emp.face_embedding.includes('"face": []');
                                hasFp = emp.face_embedding.includes('"fp":') && !emp.face_embedding.includes('"fp":[]') && !emp.face_embedding.includes('"fp": []');
                              } else if (emp.face_embedding) {
                                hasFaceAdms = emp.face_embedding.face && emp.face_embedding.face.length > 0;
                                hasFp = emp.face_embedding.fp && emp.face_embedding.fp.length > 0;
                              }
                              
                              const hasFaceLocal = !!emp.foto_wajah_base64;
                              const hasNfc = !!emp.nfc_uid;

                              return (
                                <>
                                  {(hasFaceAdms || hasFaceLocal) && (
                                    <div className="inline-flex items-center gap-1 text-[8px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400">
                                      <span className="w-1 h-1 rounded-full bg-emerald-500"></span>{" "}
                                      FC
                                    </div>
                                  )}
                                  {hasFp && (
                                    <div className="inline-flex items-center gap-1 text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider border border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400">
                                      <span className="w-1 h-1 rounded-full bg-blue-500"></span>{" "}
                                      FP
                                    </div>
                                  )}
                                  {hasNfc && (
                                    <div className="inline-flex items-center gap-1 text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider border border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400">
                                      <span className="w-1 h-1 rounded-full bg-indigo-500"></span>{" "}
                                      CD
                                    </div>
                                  )}
                                  {!(
                                    hasFaceAdms ||
                                    hasFaceLocal ||
                                    hasFp ||
                                    hasNfc
                                  ) && (
                                    <div className="inline-flex items-center gap-1 text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                                      No Data
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 tracking-tight">
                        {emp.nip}
                      </p>
                      <p className="text-[10px] font-bold text-blue-500 mt-1">
                        {emp.no_hp_notif || "Tanpa Nomor"}
                      </p>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <p className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 tracking-widest uppercase">
                        {departments.find((d) => d.id === emp.departemen_id)
                          ?.nama_departemen || "General"}
                      </p>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          emp.role === "SUPER ADMIN"
                            ? "bg-[#f5f3ff] text-[#7c3aed]"
                            : "bg-[#eff6ff] text-[#2563eb]"
                        } border ${emp.role === "SUPER ADMIN" ? "border-purple-100" : "border-blue-100"}`}
                      >
                        {emp.role === "SUPER ADMIN" ? "SUPER ADMIN" : "USER"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1.5 transition-opacity">
                        <button
                          onClick={() => handleOpenQrModal(emp.nip, emp.nama)}
                          title="Tampilkan QR Code"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-lg transition-all"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span className="hidden lg:inline">QR Code</span>
                        </button>
                        <button
                          onClick={() => handleOpenFaceModal(emp.nip, emp.nama)}
                          title="Daftarkan Wajah"
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${emp.face_embedding ? "text-emerald-700 bg-emerald-100 border border-emerald-200 hover:bg-emerald-200" : "text-amber-700 bg-amber-100 border border-amber-200 hover:bg-amber-200"}`}
                        >
                          <ScanFace className="w-3.5 h-3.5" />
                          <span className="hidden lg:inline">
                            {emp.face_embedding
                              ? "Biometrik OK"
                              : "Set Biometrik"}
                          </span>
                        </button>
                        <button
                          onClick={() => handleGenerateTelegramLink(emp.nip, emp.nama)}
                          title="Tautkan Telegram"
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-700 bg-sky-100 border border-sky-200 hover:bg-sky-200 rounded-lg transition-all"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">Telegram API</span>
                        </button>
                        <button
                          onClick={() => handleOpenModal(emp)}
                          title="Edit"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200 hover:bg-blue-200 rounded-lg transition-all"
                        >
                          <Edit className="w-3 h-3" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(emp.nip, emp.nama)}
                          title="Hapus"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 hover:bg-rose-200 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3 h-3" /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {filteredEmployees.length === 0 ? (
            <div className="py-24 text-center">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <UserCircle className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  Tidak ada data karyawan.
                </p>
              </div>
            </div>
          ) : (
            paginatedEmployees.map((emp) => (
              <div key={`mobile-${emp.nip}`} className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEmployeeIds.includes(emp.nip)}
                      onChange={() => toggleSelectEmployee(emp.nip)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    Pilih
                  </label>
                  <div className="text-right">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest ${
                        emp.role === "SUPER ADMIN"
                          ? "bg-purple-50 text-purple-600 border-purple-100"
                          : "bg-blue-50 text-blue-600 border-blue-100"
                      } border`}
                    >
                      {emp.role}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg shadow-sm border border-blue-100/50 overflow-hidden shrink-0">
                    {emp.foto_wajah_base64 ? (
                      <img
                        src={
                          emp.foto_wajah_base64.startsWith("data:image")
                            ? emp.foto_wajah_base64
                            : `data:image/jpeg;base64,${emp.foto_wajah_base64}`
                        }
                        alt={emp.nama}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      emp.nama.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-slate-800 dark:text-slate-100 text-sm tracking-tight truncate">
                      {emp.nama}
                    </p>
                    <p className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                      NIP: {emp.nip}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Departemen
                    </p>
                    <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                      {departments.find((d) => d.id === emp.departemen_id)
                        ?.nama_departemen || "General"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {(() => {
                      let hasFaceAdms = false;
                      let hasFp = false;
                      if (typeof emp.face_embedding === "string") {
                        hasFaceAdms = emp.face_embedding.includes('"face":') && !emp.face_embedding.includes('"face":[]') && !emp.face_embedding.includes('"face": []');
                        hasFp = emp.face_embedding.includes('"fp":') && !emp.face_embedding.includes('"fp":[]') && !emp.face_embedding.includes('"fp": []');
                      } else if (emp.face_embedding) {
                         hasFaceAdms = emp.face_embedding.face && emp.face_embedding.face.length > 0;
                         hasFp = emp.face_embedding.fp && emp.face_embedding.fp.length > 0;
                      }

                      const hasFaceLocal = !!emp.foto_wajah_base64;
                      const hasNfc = !!emp.nfc_uid;

                      return (
                        <>
                          {(hasFaceAdms || hasFaceLocal) && (
                            <div className="inline-flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold tracking-wider border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400">
                              FC
                            </div>
                          )}
                          {hasFp && (
                            <div className="inline-flex items-center gap-1 text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold tracking-wider border border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400">
                              FP
                            </div>
                          )}
                          {hasNfc && (
                            <div className="inline-flex items-center gap-1 text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-bold tracking-wider border border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400">
                              CD
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleOpenFaceModal(emp.nip, emp.nama)}
                    className="flex-1 min-w-[30%] flex items-center justify-center gap-2 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50"
                  >
                    <ScanFace className="w-3.5 h-3.5" /> Biometrik
                  </button>
                  <button
                    onClick={() => handleOpenQrModal(emp.nip, emp.nama)}
                    className="flex-1 min-w-[30%] flex items-center justify-center gap-2 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50"
                  >
                    <QrCode className="w-3.5 h-3.5" /> QR Code
                  </button>
                  <div className="flex w-full gap-2">
                    <button
                      onClick={() => handleGenerateTelegramLink(emp.nip, emp.nama)}
                      disabled={saving}
                      className="flex-1 flex justify-center items-center gap-1.5 px-3 py-2 text-[10px] font-bold text-sky-700 bg-sky-100 border border-sky-200 hover:bg-sky-200 rounded-lg transition-all"
                    >
                      <Bot className="w-3 h-3" /> Telegram
                    </button>
                    <button
                      onClick={() => handleOpenModal(emp)}
                      className="flex-1 flex justify-center items-center gap-1.5 px-3 py-2 text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200 hover:bg-blue-200 rounded-lg transition-all"
                    >
                      <Edit className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(emp.nip, emp.nama)}
                      className="flex-1 flex justify-center items-center gap-1.5 px-3 py-2 text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 hover:bg-rose-200 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3 h-3" /> Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Sebelumnya
            </button>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Selanjutnya
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl relative z-10 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center p-5 md:p-8 shrink-0 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                    {editingEmp ? (
                      <Edit className="w-7 h-7" />
                    ) : (
                      <Plus className="w-7 h-7" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                      {editingEmp ? "Edit Data Staff" : "Tambah Staff Baru"}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                      Informasi biodata dan otorisasi akses sistem.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-950 rounded-2xl transition-colors border border-transparent hover:border-slate-100 dark:border-slate-800"
                >
                  <X className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                </button>
              </div>

              <div className="p-5 md:p-8 overflow-y-auto custom-scrollbar space-y-8">
                <div className="grid md:grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                      ID Pegawai (NIP)
                    </label>
                    <div className="relative">
                      <Hash className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300" />
                      <input
                        disabled={!!editingEmp}
                        value={formData.nip}
                        onChange={(e) =>
                          setFormData({ ...formData, nip: e.target.value })
                        }
                        type="text"
                        className="w-full pl-14 pr-6 py-4.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-bold disabled:opacity-50 text-sm"
                        placeholder="Contoh: 2024001"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                      Nama Lengkap
                    </label>
                    <div className="relative">
                      <UserCircle className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300" />
                      <input
                        value={formData.nama}
                        onChange={(e) =>
                          setFormData({ ...formData, nama: e.target.value })
                        }
                        type="text"
                        className="w-full pl-14 pr-6 py-4.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-bold text-sm"
                        placeholder="Masukkan nama staff"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                      No. WhatsApp / Notif
                    </label>
                    <div className="relative">
                      <Phone className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300" />
                      <input
                        value={formData.no_hp_notif}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            no_hp_notif: e.target.value,
                          })
                        }
                        type="tel"
                        className="w-full pl-14 pr-6 py-4.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-bold text-sm"
                        placeholder="08123456789"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                      ID Kartu NFC (Opsional)
                    </label>
                    <div className="relative">
                      <Hash className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300" />
                      <input
                        value={formData.nfc_uid}
                        onChange={(e) =>
                          setFormData({ ...formData, nfc_uid: e.target.value })
                        }
                        type="text"
                        className="w-full pl-14 pr-6 py-4.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-bold text-sm"
                        placeholder="Scan Kartu..."
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">
                    Pengaturan Gaji & Denda
                  </h4>
                  <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                        Gaji Pokok
                      </p>
                      <input
                        type="number"
                        value={formData.gaji_pokok}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            gaji_pokok: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                        Uang Makan / Hari
                      </p>
                      <input
                        type="number"
                        value={formData.uang_makan}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            uang_makan: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                        Tunjangan
                      </p>
                      <input
                        type="number"
                        value={formData.tunjangan}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            tunjangan: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                        Denda Telat / Menit
                      </p>
                      <input
                        type="number"
                        value={formData.denda_telat}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            denda_telat: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                        Bonus Lembur / Jam
                      </p>
                      <input
                        type="number"
                        value={formData.bonus_lembur}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bonus_lembur: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                        Potongan Lain
                      </p>
                      <input
                        type="number"
                        value={formData.potongan}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            potongan: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid md:grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                      Departemen
                    </label>
                    <div className="relative">
                      <Building2 className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 pointer-events-none" />
                      <select
                        value={formData.departemen_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            departemen_id: e.target.value,
                          })
                        }
                        className="w-full pl-14 pr-6 py-4.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-bold appearance-none cursor-pointer text-sm"
                      >
                        <option value="">Pilih Departemen</option>
                        <option value="null">General</option>
                        {departments.filter(dept => dept.nama_departemen?.toLowerCase() !== "management").map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.nama_departemen}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                      Role / Akses
                    </label>
                    <div className="relative">
                      <UserCircle className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 pointer-events-none" />
                      <select
                        value={formData.role}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            role: e.target.value as UserRole,
                            // Reset permissions if changed to USER or something else
                            admin_permissions:
                              e.target.value === "SUPER ADMIN"
                                ? formData.admin_permissions
                                : e.target.value === "OWNER" ||
                                    e.target.value === "MASTER_ADMIN"
                                  ? AVAILABLE_PERMISSIONS.map((p) => p.id).join(
                                      ",",
                                    )
                                  : "",
                          })
                        }
                        className="w-full pl-14 pr-6 py-4.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-bold appearance-none cursor-pointer text-sm"
                      >
                        <option value="USER">User (Staff)</option>
                        <option value="SUPER ADMIN">Super Admin</option>
                        {(user.role === "MASTER_ADMIN" || user.role === "OWNER") && (
                          <option value="OWNER">Owner</option>
                        )}
                        {user.role === "MASTER_ADMIN" && (
                          <option value="MASTER_ADMIN">Master Admin</option>
                        )}
                      </select>
                    </div>
                  </div>
                  {formData.role === "SUPER ADMIN" && (
                    <div className="space-y-4 pt-2">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                        Batasan Akses (Centang yang diperbolehkan)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                        {AVAILABLE_PERMISSIONS.map((perm) => {
                          const isChecked = formData.admin_permissions
                            .split(",")
                            .map((p) => p.trim().toLowerCase())
                            .includes(perm.id.toLowerCase());
                          return (
                            <label
                              key={perm.id}
                              className="flex items-center gap-3 cursor-pointer group"
                            >
                              <div className="relative flex items-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const currentPerms =
                                      formData.admin_permissions
                                        .split(",")
                                        .filter((p) => p.trim() !== "")
                                        .map((p) => p.trim().toLowerCase());
                                    let newPerms;
                                    if (e.target.checked) {
                                      newPerms = [
                                        ...new Set([
                                          ...currentPerms,
                                          perm.id.toLowerCase(),
                                        ]),
                                      ];
                                    } else {
                                      newPerms = currentPerms.filter(
                                        (p) => p !== perm.id.toLowerCase(),
                                      );
                                    }
                                    setFormData({
                                      ...formData,
                                      admin_permissions: newPerms.join(","),
                                    });
                                  }}
                                  className="peer h-5 w-5 cursor-pointer appearance-none rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 checked:bg-blue-500 checked:border-blue-500 transition-all"
                                />
                                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3.5 w-3.5"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                              </div>
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 group-hover:text-blue-500 transition-colors">
                                {perm.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-5 md:p-8 shrink-0 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 md:px-8 md:py-4.5 rounded-2xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:bg-slate-700 transition-all"
                >
                  {" "}
                  Batal{" "}
                </button>
                <button
                  disabled={saving}
                  onClick={handleSave}
                  className="flex-[2] bg-blue-600 text-white py-4.5 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2 border-b-4 border-blue-800"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  {editingEmp ? "Simpan Perubahan" : "Daftarkan Staff"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isQrModalOpen && selectedForQr && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsQrModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-sm relative z-10 overflow-hidden"
            >
              <div className="p-6 md:p-8 text-center space-y-6 flex flex-col items-center">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                  QR Code Absensi
                </h3>
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 inline-block relative group">
                  <QRCodeSVG
                    value={selectedForQr.nip}
                    size={250}
                    level={"H"}
                    includeMargin={true}
                  />
                </div>
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-200">
                    {selectedForQr.nama}
                  </p>
                  <p className="text-sm font-mono text-slate-500">
                    {selectedForQr.nip}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Dapat dicetak di ID Card
                  </p>
                </div>

                <div className="pt-4 flex w-full gap-3">
                  <button
                    onClick={() => {
                      const svg = document.querySelector(
                        ".bg-white.rounded-2xl svg",
                      ) as any;
                      if (!svg) return;
                      const canvas = document.createElement("canvas");
                      const ctx = canvas.getContext("2d");
                      const data = new XMLSerializer().serializeToString(svg);
                      const img = new Image();
                      const svgBlob = new Blob([data], {
                        type: "image/svg+xml;charset=utf-8",
                      });
                      const url = URL.createObjectURL(svgBlob);
                      img.onload = function () {
                        canvas.width = 200;
                        canvas.height = 200;
                        ctx?.drawImage(img, 0, 0);
                        URL.revokeObjectURL(url);
                        const imgURI = canvas
                          .toDataURL("image/png")
                          .replace("image/png", "image/octet-stream");
                        const link = document.createElement("a");
                        link.download = `QR_Static_${selectedForQr.nama.replace(/\s+/g, "_")}_${selectedForQr.nip}.png`;
                        link.href = imgURI;
                        link.click();
                      };
                      img.src = url;
                    }}
                    className="flex-1 flex justify-center items-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs hover:bg-blue-100 transition-all"
                  >
                    <Download className="w-4 h-4" /> Unduh QR Statis
                  </button>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/portal/${selectedForQr.nip}`;
                      navigator.clipboard.writeText(url);
                      toast.success("Link Portal QR Dinamis disalin!");
                    }}
                    className="flex-1 flex justify-center items-center gap-2 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-all"
                    title="Salin Link Portal QR Dinamis"
                  >
                    Salin Link Dinamis
                  </button>
                </div>
                <button
                  onClick={() => setIsQrModalOpen(false)}
                  className="w-full flex justify-center items-center gap-2 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {selectedForFace && (
        <FaceRegistrationModal
          isOpen={isFaceModalOpen}
          onClose={() => setIsFaceModalOpen(false)}
          employeeId={selectedForFace.nip}
          companyId={user?.company_id || ""}
          employeeName={selectedForFace.nama}
          onSuccess={onRefresh}
        />
      )}

      <AnimatePresence>
        {confirmDelete.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() =>
                setConfirmDelete({ ...confirmDelete, show: false })
              }
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-sm relative z-10 overflow-hidden border border-rose-100 dark:border-rose-900/30"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <UserX className="w-10 h-10 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                    {confirmDelete.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2 leading-relaxed">
                    {confirmDelete.message}
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() =>
                      setConfirmDelete({ ...confirmDelete, show: false })
                    }
                    className="flex-1 px-6 py-4 rounded-2xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all border border-transparent"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmDelete.onConfirm}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-xl shadow-rose-500/20 transition-all border-b-4 border-rose-800"
                  >
                    Ya, Hapus
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBulkMoveModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsBulkMoveModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-sm relative z-10 flex flex-col overflow-hidden"
            >
              <div className="p-8 pb-6 text-center">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <Building2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">
                  Pindah Departemen
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 tracking-tight leading-relaxed px-4">
                  Pilih departemen baru untuk {selectedEmployeeIds.length} karyawan yang dipilih.
                </p>
                
                <div className="mt-6 text-left relative">
                  <Building2 className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 pointer-events-none" />
                  <select
                    value={bulkMoveDeptId}
                    onChange={(e) => setBulkMoveDeptId(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold appearance-none cursor-pointer text-sm"
                  >
                    <option value="">(Pilih Departemen)</option>
                    <option value="null">General</option>
                    {departments.filter(dept => dept.nama_departemen?.toLowerCase() !== "management").map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.nama_departemen}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="p-6 pt-2 bg-slate-50 border-t border-slate-100 dark:bg-slate-900/50 dark:border-slate-800">
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsBulkMoveModalOpen(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all border border-transparent"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleBulkMove}
                    disabled={saving}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition-all border-b-4 border-indigo-800 flex items-center justify-center disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Simpan"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {telegramLinkData.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full mx-auto flex items-center justify-center text-blue-600">
                <Bot className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">Buka Telegram</h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
                  Bagikan tautan ini ke staf bernama <strong>{telegramLinkData.nama}</strong> untuk menautkan akun AI AbsensiKita.
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 relative">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Salin Tautan</p>
                <div className="font-mono font-black text-blue-600 text-sm tracking-wider select-all break-all text-left">
                  https://t.me/AbsensiKitaIndo_Bot?start={telegramLinkData.code}
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  onClick={() => setTelegramLinkData({ show: false, nip: "", nama: "", code: null })}
                  className="w-full px-6 py-4 rounded-xl font-black text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

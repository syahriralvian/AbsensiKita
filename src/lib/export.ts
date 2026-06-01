import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToExcel = (data: any[], columns: { header: string; key: string }[], filename: string) => {
  const wsData = data.map((item) => {
    const row: any = {};
    columns.forEach((col) => {
      row[col.header] = typeof item[col.key] !== 'undefined' ? item[col.key] : '';
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const exportToPDF = (
  title: string,
  headers: string[],
  rows: any[][],
  filename: string,
  subtitle?: string
) => {
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for reports
  let yPos = 15;

  doc.setFontSize(16);
  doc.text(title, 14, yPos);
  
  if (subtitle) {
    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(subtitle, 14, yPos);
    doc.setTextColor(0);
  }

  yPos += 10;

  autoTable(doc, {
    startY: yPos,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] as any, textColor: 255 },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  doc.save(`${filename}.pdf`);
};

export const exportPayslipPDF = (
  data: any,
  companyName: string,
  period: string,
  filename: string
) => {
  const doc = new jsPDF('p', 'mm', 'a5'); // Portrait, A5 size for payslip
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(companyName || "Perusahaan", pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text("SLIP GAJI KARYAWAN", pageWidth / 2, 22, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Periode: ${period}`, pageWidth / 2, 28, { align: 'center' });
  
  doc.setLineWidth(0.5);
  doc.line(10, 32, pageWidth - 10, 32);

  // Employee Info
  doc.setFont("helvetica", "bold");
  doc.text("Informasi Karyawan", 10, 40);
  doc.setFont("helvetica", "normal");
  doc.text(`NIP`, 10, 46); doc.text(`: ${data.nip}`, 40, 46);
  doc.text(`Nama`, 10, 52); doc.text(`: ${data.nama}`, 40, 52);
  
  doc.line(10, 56, pageWidth - 10, 56);

  // Earnings
  doc.setFont("helvetica", "bold");
  doc.text("PENERIMAAN", 10, 64);
  doc.setFont("helvetica", "normal");
  
  const formatIDR = (val: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);
  };

  let yPos = 70;
  doc.text("Gaji Pokok", 10, yPos); doc.text(formatIDR(data.gaji_pokok), pageWidth - 10, yPos, { align: 'right' }); yPos += 6;
  doc.text("Tunjangan", 10, yPos); doc.text(formatIDR(data.tunjangan), pageWidth - 10, yPos, { align: 'right' }); yPos += 6;
  doc.text(`Uang Makan (${data.hadir} Hari)`, 10, yPos); doc.text(formatIDR(data.totalUangMakan), pageWidth - 10, yPos, { align: 'right' }); yPos += 6;
  doc.text(`Bonus Lembur (${data.totalOT.toFixed(2)} Jam)`, 10, yPos); doc.text(formatIDR(data.totalBonus), pageWidth - 10, yPos, { align: 'right' }); yPos += 6;
  
  yPos += 2;
  doc.setFont("helvetica", "bold");
  doc.text("Total Penerimaan", 10, yPos); 
  const totalPenerimaan = data.gaji_pokok + data.tunjangan + data.totalUangMakan + data.totalBonus;
  doc.text(formatIDR(totalPenerimaan), pageWidth - 10, yPos, { align: 'right' });
  doc.setFont("helvetica", "normal");
  
  yPos += 8;
  doc.line(10, yPos, pageWidth - 10, yPos);
  yPos += 8;

  // Deductions
  doc.setFont("helvetica", "bold");
  doc.text("POTONGAN", 10, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 6;
  
  doc.text(`Denda Telat (${data.telat} Kali)`, 10, yPos); doc.text(formatIDR(data.totalDenda), pageWidth - 10, yPos, { align: 'right' }); yPos += 6;
  doc.text(`Alpha / 1/2 Hari / Izin Potong`, 10, yPos); doc.text(formatIDR(data.totalPotongan), pageWidth - 10, yPos, { align: 'right' }); yPos += 6;
  
  yPos += 2;
  doc.setFont("helvetica", "bold");
  doc.text("Total Potongan", 10, yPos); 
  const totalPotongan = data.totalDenda + data.totalPotongan;
  doc.text(formatIDR(totalPotongan), pageWidth - 10, yPos, { align: 'right' });
  doc.setFont("helvetica", "normal");

  yPos += 8;
  doc.line(10, yPos, pageWidth - 10, yPos);
  yPos += 8;

  // Net Pay
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("GAJI BERSIH", 10, yPos);
  doc.text(formatIDR(data.gajiBersih), pageWidth - 10, yPos, { align: 'right' });
  
  yPos += 15;
  
  // Signature
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Penerima,", 20, yPos);
  doc.text("Mengetahui,", pageWidth - 40, yPos);
  
  yPos += 25;
  doc.text("(...........................)", 20, yPos);
  doc.text("(...........................)", pageWidth - 40, yPos);

  doc.save(`${filename}.pdf`);
};

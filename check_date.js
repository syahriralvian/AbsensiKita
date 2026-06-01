const formatDateTime = (dateStr, timezone = 'Asia/Jakarta') => {
  if (!dateStr || dateStr === "-") return "-";
  const targetTz = timezone || 'Asia/Jakarta';
  try {
    const timestamp = new Date(dateStr).getTime();
    const date = new Date(timestamp);
    
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: targetTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  } catch (e) {
    return dateStr;
  }
};

console.log("created_at:", formatDateTime('2026-05-09T06:50:14.637044+00:00'));
console.log("realtime:", formatDateTime('2026-05-09T13:50:05+00:00'));


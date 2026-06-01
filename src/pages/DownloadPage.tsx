import React, { useState, useEffect } from "react";
import { DownloadCloud, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function DownloadPage() {
  const [downloads, setDownloads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDownloads();
  }, []);

  const fetchDownloads = async () => {
    try {
      // Trying to fetch, if table doesn't exist it might fail, gracefully handle
      const { data, error } = await supabase.from('app_downloads').select('*').order('created_at', { ascending: false });
      if (error && error.code !== '42P01') throw error;
      setDownloads(data || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <span className="font-bold text-lg text-slate-900 dark:text-white">Kembali ke Beranda</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xl leading-none">A</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white hidden sm:block">
              AbsensiKita
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-16 px-6 md:px-12 flex items-stretch justify-center">
        <div className="max-w-7xl w-full mx-auto space-y-12">
          {/* Header Title */}
          <div className="text-center space-y-6 max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <DownloadCloud className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
              Pusat Unduhan
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg md:text-xl leading-relaxed">
              Unduh aplikasi, driver, dan software terkait mesin absensi Biofinger yang telah disediakan.
            </p>
          </div>

          {/* Download Cards */}
          {loading ? (
             <div className="text-center py-12 text-slate-500">Memuat...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 place-items-stretch">
              {downloads.map((item) => (
                <div key={item.id} className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none flex flex-col items-center text-center space-y-6 hover:border-blue-500/30 transition-colors group">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-700 dark:text-slate-200 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 transition-colors">
                    <DownloadCloud className="w-8 h-8" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{item.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
                  </div>
                  <a 
                    href={item.file_url} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold py-3 px-6 rounded-xl hover:bg-blue-100 hover:dark:bg-blue-900/50 transition flex items-center gap-2 w-full justify-center border border-blue-100 dark:border-blue-800"
                  >
                    <DownloadCloud className="w-4 h-4" /> Download
                  </a>
                </div>
              ))}
              
            </div>
          )}
        </div>
      </main>
      
      {/* Footer minimal */}
      <footer className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 mt-auto">
        &copy; {new Date().getFullYear()} AbsensiKita. Hak Cipta Dilindungi.
      </footer>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Download, Plus, Trash2, Edit2, Save, X, ExternalLink, Link as LinkIcon, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

export default function DownloadsTab() {
  const [downloads, setDownloads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLink, setNewLink] = useState('');

  const [uploadMode, setUploadMode] = useState<'link' | 'file'>('link');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchDownloads();
  }, []);

  const initTable = async () => {
    try {
      await supabase.rpc('execute_sql', { query: `
        CREATE TABLE IF NOT EXISTS public.app_downloads (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          file_url TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `});
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDownloads = async () => {
    try {
      await initTable();
      const { data, error } = await supabase.from('app_downloads').select('*').order('created_at', { ascending: false });
      if (error && error.code !== '42P01') throw error;
      setDownloads(data || []);
    } catch (error: any) {
      console.error('Error fetching downloads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadMode === 'file' && !selectedFile) {
      toast.error('Pilih file terlebih dahulu');
      return;
    }

    setUploading(true);
    try {
      let finalUrl = newLink;

      if (uploadMode === 'file' && selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('downloads')
          .upload(filePath, selectedFile);

        if (uploadError) {
          if (uploadError.message.toLowerCase().includes('bucket not found') || uploadError.message.includes('row-level security')) {
            throw new Error(`Bucket 'downloads' tidak ditemukan atau belum disetting public. Buat bucket bernama "downloads" di dashboard Supabase Anda terlebih dahulu.`);
          }
          throw new Error('Gagal upload file: ' + uploadError.message);
        }

        const { data: { publicUrl } } = supabase.storage.from('downloads').getPublicUrl(filePath);
        finalUrl = publicUrl;
      }

      const { error } = await supabase.from('app_downloads').insert({
        title: newTitle,
        description: newDescription,
        file_url: finalUrl
      });
      if (error) throw error;

      toast.success('File berhasil ditambahkan');
      setIsAdding(false);
      setNewTitle('');
      setNewDescription('');
      setNewLink('');
      setSelectedFile(null);
      fetchDownloads();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus item ini?')) return;
    try {
      const { error } = await supabase.from('app_downloads').delete().eq('id', id);
      if (error) throw error;
      toast.success('Item berhasil dihapus');
      fetchDownloads();
    } catch (error: any) {
      toast.error('Gagal menghapus: ' + error.message);
    }
  };

  if (loading) return <div>Memuat...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Download className="w-6 h-6 text-blue-600" />
            Kelola Unduhan
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            Kelola link download software dan driver yang akan ditampilkan di halaman depan.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors"
        >
          <Plus className="w-5 h-5" /> Tambah File
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tambah File Baru</h3>
            <button type="button" onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama / Judul</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Contoh: Driver USB AT-100"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Deskripsi Singkat</label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Contoh: Driver USB untuk koneksi mesin absensi ke komputer."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Metode Download</label>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  checked={uploadMode === 'link'} 
                  onChange={() => setUploadMode('link')} 
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Gunakan Link Eksternal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  checked={uploadMode === 'file'} 
                  onChange={() => setUploadMode('file')} 
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Upload File Langsung</span>
              </label>
            </div>

            {uploadMode === 'link' ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">URL (Link Download)</label>
                <p className="text-xs text-slate-500 mb-2">Anda dapat menggunakan link Google Drive atau Dropbox.</p>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="url"
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                    required={uploadMode === 'link'}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pilih File</label>
                <p className="text-xs text-slate-500 mb-2">Pilih file dari komputer Anda (Pastikan bucket 'downloads' diaktifkan di setelan Supabase, Storage).</p>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
                  required={uploadMode === 'file'}
                />
              </div>
            )}
          </div>
          
          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setIsAdding(false)} disabled={uploading} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50">
              Batal
            </button>
            <button type="submit" disabled={uploading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50">
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Mengunggah...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Simpan
                </>
              )}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {downloads.map((item) => (
          <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col hover:border-blue-500/30 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0">
                <Download className="w-6 h-6" />
              </div>
              <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 line-clamp-1">{item.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 flex-1 line-clamp-2">{item.description}</p>
            
            <a 
              href={item.file_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-auto bg-slate-50 border border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 hover:dark:border-slate-600 text-slate-700 dark:text-slate-200 py-2 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm w-full"
            >
              <ExternalLink className="w-4 h-4" /> Buka Link
            </a>
          </div>
        ))}
        {downloads.length === 0 && !isAdding && (
          <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            Belum ada file unduhan.
          </div>
        )}
      </div>
    </div>
  );
}

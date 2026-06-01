import { readFileSync, writeFileSync } from 'fs';
let code = readFileSync('src/components/dashboard/DepartmentsTab.tsx', 'utf8');
const searchString = `                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Geofencing Departemen (Optional)</label>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-2">Kosongkan jika ingin mengikuti pengaturan lokasi perusahaan.</p>
                  
                  <MapPicker`;

const replaceString = `                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Mode Geofencing Departemen</label>
                  <select
                     value={
                       formData.radius === -1 ? "-1" : 
                       (formData.radius === null || formData.radius === undefined ? "null" : "1")
                     }
                     onChange={e => {
                       const val = e.target.value;
                       if (val === "-1") setFormData({...formData, radius: -1, lat: null, lng: null});
                       else if (val === "null") setFormData({...formData, radius: null, lat: null, lng: null});
                       else setFormData({...formData, radius: 100, lat: formData.lat || 0, lng: formData.lng || 0}); 
                     }}
                     className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none font-bold text-sm"
                  >
                     <option value="null">Ikuti Pengaturan LOKASI Perusahaan</option>
                     <option value="1">Aktifkan Konfigurasi KHUSUS Departemen</option>
                     <option value="-1">Nonaktifkan Geofencing (Abaikan Jarak/Lokasi)</option>
                  </select>
                  
                  {formData.radius !== null && formData.radius !== undefined && formData.radius !== -1 && (
                    <>
                      <MapPicker`;

code = code.replace(searchString, replaceString);

const buttonEnd = `                      Gunakan Lokasi Saat Ini
                    </button>
                  </div>`;

const buttonEndReplace = `                      Gunakan Lokasi Saat Ini
                    </button>
                  </div>
                  </>
                  )}`;

code = code.replace(buttonEnd, buttonEndReplace);
writeFileSync('src/components/dashboard/DepartmentsTab.tsx', code);

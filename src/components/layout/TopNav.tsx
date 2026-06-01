import { Menu, Search, Sun, Moon, LogOut, CreditCard, User as UserIcon } from "lucide-react";
import { User } from "../../types";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";

interface TopNavProps {
  user: User;
  companyName: string;
  onMenuClick: () => void;
  onLogoutClick: () => void;
}

export default function TopNav({ user, companyName, onMenuClick, onLogoutClick }: TopNavProps) {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains("dark");
  });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-20 glass px-6 md:px-10 flex items-center justify-between shrink-0 z-30 sticky top-0">
      <div className="flex items-center gap-4 sm:gap-6 flex-1">
        <button onClick={onMenuClick} className="md:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-xl transition">
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="flex flex-col md:hidden overflow-hidden max-w-[140px] xs:max-w-[180px]">
          <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight truncate">{companyName}</span>
          <span className="text-[8px] text-blue-600 font-bold uppercase tracking-widest leading-none">Dashboard</span>
        </div>
      </div>

      <div className="flex items-center gap-4 md:gap-4 sm:gap-6">
        <button 
          onClick={() => setIsDark(!isDark)}
          className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-xl transition-all"
          title="Toggle Dark Mode"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-2xl">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Sistem Online</span>
        </div>

        <div className="text-right hidden sm:block">
          <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight leading-none">{user.nama}</p>
          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-[0.2em] mt-1.5 opacity-80">{companyName}</p>
        </div>
        
        <div className="relative group" ref={profileRef}>
          <div 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[2px] cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-full h-full rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-800">
              <img 
                src={`https://ui-avatars.com/api/?background=2563eb&color=fff&bold=true&name=${user.nama}`} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full translate-x-1/4 -translate-y-1/4" />
          
          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden"
              >
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 sm:hidden">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.nama}</p>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{user.email}</p>
                </div>
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate('/dashboard/settings');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-800 transition-colors text-sm font-semibold"
                  >
                    <UserIcon className="w-4 h-4" />
                    Profil Saya
                  </button>
                  {(user.role === 'OWNER' || user.role === 'SUPER ADMIN') && (
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate('/dashboard/tagihan');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30 transition-colors text-sm font-semibold"
                    >
                      <CreditCard className="w-4 h-4" />
                      Perpanjang Masa Aktif
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      onLogoutClick();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-sm font-semibold"
                  >
                    <LogOut className="w-4 h-4" />
                    Keluar Sistem
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

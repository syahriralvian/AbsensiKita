/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { User } from "./types";
import { supabase } from "./lib/supabase";
import { Toaster } from "sonner";
import { syncTime } from "./lib/utils";

import { lazyRetry } from "./lib/lazyRetry";

import { AnimatePresence } from "motion/react";
import { confirmDialog } from './lib/confirmDialog';
const LandingPage = lazyRetry(() => import("./pages/LandingPage"));
const DownloadPage = lazyRetry(() => import("./pages/DownloadPage"));
const LoginPage = lazyRetry(() => import("./pages/LoginPage"));
const RegisterPage = lazyRetry(() => import("./pages/RegisterPage"));
const Dashboard = lazyRetry(() => import("./pages/Dashboard"));
const MaintenancePage = lazyRetry(() => import("./pages/MaintenancePage"));
const EmployeePortal = lazyRetry(() => import("./pages/EmployeePortal").then(m => ({ default: m.EmployeePortal })));
const TermsAndConditions = lazyRetry(() => import("./pages/TermsAndConditions"));
const PrivacyPolicy = lazyRetry(() => import("./pages/PrivacyPolicy"));
const GuidePage = lazyRetry(() => import("./pages/GuidePage"));
const AIChat = lazyRetry(() => import("./components/AIChat"));

function AnimatedRoutes({ user, handleLogin, handleLogout }: any) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location}>
        <Route 
          path="/" 
          element={user ? <Navigate to="/dashboard" /> : <LandingPage />} 
        />
        <Route 
          path="/download" 
          element={<DownloadPage />} 
        />
        <Route 
          path="/login" 
          element={user ? <Navigate to="/dashboard" /> : <LoginPage onLogin={handleLogin} />} 
        />
        <Route 
          path="/portal/:nip" 
          element={<EmployeePortal />} 
        />
        <Route 
          path="/terms" 
          element={<TermsAndConditions />} 
        />
        <Route 
          path="/privacy" 
          element={<PrivacyPolicy />} 
        />
        <Route 
          path="/guide" 
          element={<GuidePage />} 
        />
        <Route 
          path="/register" 
          element={user ? <Navigate to="/dashboard" /> : <RegisterPage />} 
        />
        <Route 
          path="/dashboard/*" 
          element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);

  useEffect(() => {
    syncTime(); // Initialize time synchronization
    
    async function initApp() {
      // Check maintenance mode
      try {
        const { data } = await supabase.from('companies').select('is_active').eq('company_id', 'MASTER_GLOBAL').single();
        if (data && data.is_active === false) {
          setIsMaintenanceMode(true);
        }
      } catch (e) {
        console.error("Failed to check maintenance mode", e);
      }
      
      const savedSession = sessionStorage.getItem("admin_session");
      if (savedSession) {
        try {
          setUser(JSON.parse(savedSession));
        } catch (e) {
          console.error("Failed to parse session", e);
          sessionStorage.removeItem("admin_session");
        }
      } else {
        // Migration: If they have an old session in localStorage, clear it
        localStorage.removeItem("admin_session");
      }
      setLoading(false);
    }
    
    initApp();
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    sessionStorage.setItem("admin_session", JSON.stringify(userData));
    localStorage.removeItem("admin_session"); // Clean up old storage if any
  };

  const handleLogout = async () => {
    setUser(null);
    sessionStorage.removeItem("admin_session");
    localStorage.removeItem("admin_session"); // Clean up old storage if any
    localStorage.removeItem("last_tab");
    localStorage.removeItem("active_tab");
    localStorage.removeItem("last_dashboard_tab");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Intercept if in maintenance mode AND user is not a MASTER_ADMIN
  // We still let MASTER_ADMIN log in (since user is parsed from localstorage) 
  // Wait, if no user is logged in, they hit Landing Page or Login Page. 
  // We should block even Login/Landing page unless user state ALREADY says they are MASTER_ADMIN.
  // Wait, if user is logged out, they can't login! 
  // Let's modify: if it's maintenance, show Maintenance Page. 
  // But wait, how does Master Admin login to turn it off?
  // They can go to /login? 
  // Let's allow access to /login ALWAYS, but block others.
  
  return (
    <Router>
      <Toaster position="top-center" richColors theme="system" />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
        {isMaintenanceMode && user?.role !== "MASTER_ADMIN" ? (
          <Routes>
            <Route path="/login" element={<LoginPage onLogin={(userData: any) => {
              handleLogin(userData);
              if (userData.role === "MASTER_ADMIN") {
                 window.location.href = "/dashboard";
              }
            }} />} />
            <Route path="*" element={<MaintenancePage />} />
          </Routes>
        ) : (
          <AnimatedRoutes user={user} handleLogin={handleLogin} handleLogout={handleLogout} />
        )}
        <AIChat />
      </Suspense>
    </Router>
  );
}

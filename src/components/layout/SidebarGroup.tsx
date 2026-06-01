import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";

interface SidebarGroupProps {
  icon: React.ReactNode;
  label: string;
  basePath?: string;
  children: React.ReactNode;
  activePaths?: string[]; // to auto expand
}

export default function SidebarGroup({ icon, label, children, activePaths = [] }: SidebarGroupProps) {
  const location = useLocation();
  const isActiveGroup = activePaths.some(path => location.pathname.includes(path));
  
  const [isOpen, setIsOpen] = useState(isActiveGroup);

  // When location changes, if one of the children is active, ensure we are open
  useEffect(() => {
    if (isActiveGroup) {
      setIsOpen(true);
    }
  }, [isActiveGroup, location.pathname]);

  return (
    <div className="mb-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 font-semibold text-sm ${isActiveGroup ? 'text-blue-600 bg-blue-50/50 dark:bg-blue-900/10 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
      >
        <div className="flex items-center gap-3">
          <span className={`transition-transform duration-300`}>
            {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
          </span>
          <span className="tracking-tight">{label}</span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="mt-1 pl-4 pr-2 space-y-1 relative border-l-2 border-slate-100 dark:border-slate-800 ml-6">
          <div className="-ml-6">
             {children}
          </div>
        </div>
      )}
    </div>
  );
}

import React from "react";
import { NavLink } from "react-router-dom";

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  to: string;
  onClick?: () => void;
}

export default function SidebarItem({ icon, label, to, onClick }: SidebarItemProps) {
  return (
    <NavLink 
      to={to}
      onClick={onClick}
      className={({ isActive }) => `
        w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 font-semibold text-sm
        ${isActive 
          ? 'sidebar-active translate-x-1 outline-none ring-4 ring-blue-500/10' 
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-950 hover:text-slate-900 dark:text-white'}
      `}
    >
      {({ isActive }) => (
        <>
          <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
            {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
          </span>
          <span className="tracking-tight">{label}</span>
        </>
      )}
    </NavLink>
  );
}

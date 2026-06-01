import React, { useState } from 'react';

export const confirmDialog = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    // Check if we are in browser environment
    if (typeof document === 'undefined') {
      resolve(true); // Fallback for SSR if any
      return;
    }

    const el = document.createElement('div');
    document.body.appendChild(el);

    import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(el);

      const Dialog = () => {
        const [isOpen, setIsOpen] = useState(true);

        const handleClose = (result: boolean) => {
          setIsOpen(false);
          setTimeout(() => {
            root.unmount();
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
            resolve(result);
          }, 200); // Wait for transition
        };

        if (!isOpen) return null;

        return (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
              onClick={() => handleClose(false)}
            ></div>
            
            {/* Dialog Box */}
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in duration-200 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 8v4"></path>
                    <path d="M12 16h.01"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Konfirmasi</h3>
              </div>
              
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-8 pl-1 leading-relaxed">
                {message}
              </p>
              
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-4">
                <button
                  onClick={() => handleClose(false)}
                  className="w-full sm:w-auto px-5 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleClose(true)}
                  className="w-full sm:w-auto px-6 py-2.5 font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-md hover:shadow-lg rounded-xl transition-all"
                >
                  Ya, Lanjutkan
                </button>
              </div>
            </div>
          </div>
        );
      };

      root.render(<Dialog />);
    });
  });
};

const getEnvVar = (viteKey: string, processKey: string, defaultValue: string) => {
  if (typeof process !== 'undefined' && process?.env && process.env[processKey]) {
    return process.env[processKey] as string;
  }
  if (typeof process !== 'undefined' && process?.env && process.env[viteKey]) {
    return process.env[viteKey] as string;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[viteKey]) {
    return import.meta.env[viteKey] as string;
  }
  return defaultValue;
};

export const WAHA_URL = getEnvVar("VITE_WAHA_URL", "WAHA_URL", "https://waha-j3kivpfbozbu.bagus.sumopod.my.id");
export const WAHA_API_KEY = getEnvVar("VITE_WAHA_API_KEY", "WAHA_API_KEY", "7gc1xoO9YTzddFLB29emlk9zRx4STxEp");
export const N8N_OTP_URL = getEnvVar("VITE_N8N_WA_OTP_URL", "N8N_WA_OTP_URL", "https://n8n.absensikita.id/webhook/waha-otp-login");
export const N8N_NOTIFY_URL = getEnvVar("VITE_N8N_NOTIFY_URL", "N8N_NOTIFY_URL", "https://n8n.absensikita.id/webhook/waha-notify-expiration");

export const wahaApi = {
  startSession: async (session: string) => {
    let response = await fetch(`/api/waha/session/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session })
    });
    
    if (!response.ok) {
      if (response.status === 422) {
        // It already exists or is started. It might be stuck in FAILED or STOPPED state.
        // Let's forcibly STOP it first.
        await fetch(`/api/waha/session/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session })
        });
        
        // Then try to start again
        response = await fetch(`/api/waha/session/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session })
        });
      }
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errText}`);
      }
    }
    return response.json();
  },

  getStatus: async (session: string) => {
    const response = await fetch(`/api/waha/session/status?session=${encodeURIComponent(session)}`, {
      method: "GET"
    });
    if (!response.ok) {
        if (response.status === 404) {
            return { status: "STOPPED" };
        }
        const errText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errText}`);
    }
    return response.json();
  },

  getQrBase64: async (session: string) => {
    const response = await fetch(`/api/waha/session/qr?session=${encodeURIComponent(session)}`, {
      method: "GET"
    });
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data || data;
  },

  logoutSession: async (session: string) => {
    const response = await fetch(`/api/waha/session/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session })
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  },

  sendText: async (session: string, chatId: string, text: string) => {
    const response = await fetch(`/api/waha/sendText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session, chatId, text })
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`WAHA Http Error ${response.status}: ${errText}`);
    }
    return response.json();
  }
};

export const n8nApi = {
  sendOtp: async (data: any) => {
    const response = await fetch(N8N_OTP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error("Gagal mengirim OTP via n8n");
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (e) {
      return {};
    }
  },

  notifyExpiration: async (data: any) => {
    const response = await fetch(N8N_NOTIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error("Gagal mengirim notif via n8n");
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (e) {
      return {};
    }
  }
}

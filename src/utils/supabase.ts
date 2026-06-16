

// supabase helper extracted
export const reqSupabase = async (endpoint: string, method = 'GET', data: any = null) => {
    const tempUrl = process.env.VITE_SUPABASE_URL || '';
    const url = tempUrl.includes('absensikita.id') ? 'https://urvzweahwbbwvtkyrscd.supabase.co' : tempUrl;
    const key = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tcnnhMaqcBk06ycOngVXBQ_X_QWEffM';
    if (!url || !key) {
      console.warn("Supabase credentials missing in env");
      return null;
    }
    
    const headers: any = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept-Profile': 'absensikita',
      'Content-Profile': 'absensikita'
    };
    
    if (method === 'POST' || method === 'PATCH') {
      headers['Prefer'] = 'return=minimal';
    }

    const opts: RequestInit = { method, headers };
    if (data) opts.body = JSON.stringify(data);

    try {
      const resp = await fetch(`${url}${endpoint}`, opts);
      if (!resp.ok) {
        console.warn(`Supabase Error (${method} ${endpoint}):`, await resp.text());
        return null;
      }
      // Read response based on method
      const textResponse = await resp.text();
      try {
        return textResponse ? JSON.parse(textResponse) : true;
      } catch (e) {
        return textResponse;
      }
    } catch (err: any) {
      console.warn(`Net error (${method} ${endpoint}):`, err.message);
      return null;
    }
  };

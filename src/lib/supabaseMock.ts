export const createClient = () => {
  const getMockChannel = () => {
    const mockChannel = {
      on: (event: string, filterOrSelector: any, callback?: any) => {
        return mockChannel;
      },
      subscribe: () => {
        return mockChannel;
      },
      unsubscribe: () => {}
    };
    return mockChannel;
  };

  return {
    from: (table: string) => {
      return new SupabaseQueryBuilder(table);
    },
    rpc: (fn: string, args?: any) => {
      return new SupabaseQueryBuilder(fn);
    },
    channel: (name?: string) => {
      return getMockChannel();
    },
    removeChannel: (channel: any) => {},
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, file: any, opts?: any): Promise<{ data: { path: string } | null; error: any }> => {
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => {
          return { data: { publicUrl: path } };
        }
      })
    },
    auth: {
      storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
      getSession: async () => {
        return { data: { session: null }, error: null };
      }
    }
  };
};

class SupabaseQueryBuilder {
  private _table: string;
  private _method: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private _payload: any = null;
  private _filters: any[] = [];
  private _modifiers: any = {};

  constructor(table: string) {
    this._table = table;
  }

  select(query: string = "*", opts?: { count?: string; head?: boolean }) {
    if (this._method !== 'insert' && this._method !== 'update' && this._method !== 'delete') {
      this._method = 'select';
    }
    this._modifiers.select = query;
    return this;
  }

  insert(payload: any) {
    this._method = 'insert';
    this._payload = payload;
    return this;
  }

  update(payload: any) {
    this._method = 'update';
    this._payload = payload;
    return this;
  }

  delete() {
    this._method = 'delete';
    return this;
  }

  eq(col: string, val: any) {
    this._filters.push({ type: 'eq', col, val });
    return this;
  }

  neq(col: string, val: any) {
    this._filters.push({ type: 'neq', col, val });
    return this;
  }

  in(col: string, val: any[]) {
    this._filters.push({ type: 'in', col, val });
    return this;
  }

  gt(col: string, val: any) {
    this._filters.push({ type: 'gt', col, val });
    return this;
  }

  gte(col: string, val: any) {
    this._filters.push({ type: 'gte', col, val });
    return this;
  }

  lt(col: string, val: any) {
    this._filters.push({ type: 'lt', col, val });
    return this;
  }

  lte(col: string, val: any) {
    this._filters.push({ type: 'lte', col, val });
    return this;
  }

  or(query: string) {
    this._filters.push({ type: 'or', val: query });
    return this;
  }

  order(col: string, opts: { ascending?: boolean } = {}) {
    if (!this._modifiers.order) this._modifiers.order = [];
    this._modifiers.order.push({ col, asc: opts.ascending !== false });
    return this;
  }

  limit(count: number) {
    this._modifiers.limit = count;
    return this;
  }

  single() {
    this._modifiers.single = true;
    return this;
  }

  maybeSingle() {
    this._modifiers.maybeSingle = true;
    return this;
  }

  range(from: number, to: number) {
    this._modifiers.range = { from, to };
    return this;
  }

  like(col: string, val: string) {
    this._filters.push({ type: 'like', col, val });
    return this;
  }

  then(onFulfilled?: (value: any) => any, onRejected?: (reason: any) => any) {
    return this.execute().then(onFulfilled, onRejected);
  }

  async execute() {
    if (typeof window === 'undefined') {
      try {
        const { executeDbQuery } = await import('../routes/mariadb');
        const result = await executeDbQuery({
          table: this._table,
          method: this._method,
          payload: this._payload,
          filters: this._filters,
          modifiers: this._modifiers
        });
        return result;
      } catch (err: any) {
        console.error("Local Server DB Query error:", err);
        return { data: null, error: err };
      }
    }

    let url = '/api/db-query';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: this._table,
          method: this._method,
          payload: this._payload,
          filters: this._filters,
          modifiers: this._modifiers
        })
      });
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        return json;
      } catch (parseErr) {
        console.warn("DB Proxy returned non-JSON response:", text);
        return { data: null, error: { message: text || `HTTP ${res.status}` } };
      }
    } catch (error: any) {
      console.error("DB Proxy error:", error);
      return { data: null, error: { message: error.message || String(error) } };
    }
  }
}
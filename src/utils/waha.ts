

export const getWahaConfig = () => {
    return {
      url: process.env.WAHA_URL || "https://waha-j3kivpfbozbu.bagus.sumopod.my.id",
      apiKey: process.env.WAHA_API_KEY || process.env.VITE_WAHA_API_KEY || "7gc1xoO9YTzddFLB29emlk9zRx4STxEp"
    };
  };

  export const callWahaApi = async (endpoint: string, method: string, data?: any) => {
    const config = getWahaConfig();
    const opts: RequestInit = {
      method,
      headers: {
        "X-Api-Key": config.apiKey,
        "Authorization": `Bearer ${config.apiKey}`,
        "accept": "application/json"
      }
    };
    if (data) {
       (opts.headers as any)["Content-Type"] = "application/json";
       opts.body = JSON.stringify(data);
    }
    const response = await fetch(`${config.url}${endpoint}`, opts);
    return response;
  };

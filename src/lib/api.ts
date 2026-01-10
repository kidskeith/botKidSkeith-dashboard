import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    return data;
  },
  register: async (email: string, password: string, name?: string) => {
    const { data } = await api.post('/api/auth/register', { email, password, name });
    return data;
  },
  logout: async () => {
    const { data } = await api.post('/api/auth/logout');
    return data;
  },
  me: async () => {
    const { data } = await api.get('/api/auth/me');
    return data;
  },
};

// Market API
export const marketAPI = {
  getSummaries: async () => {
    const { data } = await api.get('/api/market/summaries');
    return data;
  },
  getTicker: async (pair: string) => {
    const { data } = await api.get(`/api/market/ticker/${pair}`);
    return data;
  },
  getOHLC: async (pair: string, timeframe = '15') => {
    const now = Math.floor(Date.now() / 1000);
    const dayAgo = now - 24 * 60 * 60;
    const { data } = await api.get(`/api/market/ohlc/${pair}`, {
      params: { timeframe, from: dayAgo, to: now },
    });
    return data;
  },
};

// Settings API
export const settingsAPI = {
  get: async () => {
    const { data } = await api.get('/api/settings');
    return data;
  },
  update: async (settings: any) => {
    const { data } = await api.patch('/api/settings', settings);
    return data;
  },
  saveApiKeys: async (apiKey: string, secretKey: string) => {
    const { data } = await api.post('/api/settings/api-keys', {
      indodaxApiKey: apiKey,
      indodaxSecretKey: secretKey,
    });
    return data;
  },
  saveGeminiKey: async (geminiApiKey: string) => {
    const { data } = await api.post('/api/settings/gemini-key', { geminiApiKey });
    return data;
  },
  getApiKeysStatus: async () => {
    const { data } = await api.get('/api/settings/api-keys/status');
    return data;
  },
  getBotStatus: async () => {
    const { data } = await api.get('/api/settings/bot/status');
    return data;
  },
  startBot: async () => {
    const { data } = await api.post('/api/settings/bot/start');
    return data;
  },
  stopBot: async () => {
    const { data } = await api.post('/api/settings/bot/stop');
    return data;
  },
};

// Signals API
export const signalsAPI = {
  generate: async (pair: string) => {
    const { data } = await api.post('/api/signals/generate', { pair });
    return data;
  },
  analyze: async (pair: string) => {
    const { data } = await api.post('/api/signals/analyze', { pair });
    return data;
  },
  getAll: async (limit = 50) => {
    const { data } = await api.get('/api/signals', { params: { limit } });
    return data;
  },
  getPending: async () => {
    const { data } = await api.get('/api/signals/pending');
    return data;
  },
  approve: async (id: string) => {
    const { data } = await api.patch(`/api/signals/${id}`, { status: 'APPROVED' });
    return data;
  },
  reject: async (id: string) => {
    const { data } = await api.patch(`/api/signals/${id}`, { status: 'REJECTED' });
    return data;
  },
  getStats: async () => {
    const { data } = await api.get('/api/signals/stats/summary');
    return data;
  },
};

// Trades API
export const tradesAPI = {
  getAll: async (limit = 50) => {
    const { data } = await api.get('/api/trades', { params: { limit } });
    return data;
  },
  getOpen: async () => {
    const { data } = await api.get('/api/trades/open');
    return data;
  },
  getBalance: async () => {
    const { data } = await api.get('/api/account/balance');
    return data;
  },
  getPositions: async () => {
    const { data } = await api.get('/api/account/positions');
    return data;
  },
  place: async (order: {
    pair: string;
    type: 'buy' | 'sell';
    price: number;
    idr?: number;
    amount?: number;
  }) => {
    const { data } = await api.post('/api/trades', order);
    return data;
  },
  cancel: async (id: string) => {
    const { data } = await api.delete(`/api/trades/${id}`);
    return data;
  },
};

// Jobs API
export const jobsAPI = {
  getStatus: async () => {
    const { data } = await api.get('/api/jobs/status');
    return data;
  },
  triggerAnalysis: async (pair?: string) => {
    const { data } = await api.post('/api/jobs/analyze', { pair });
    return data;
  },
};

export default api;

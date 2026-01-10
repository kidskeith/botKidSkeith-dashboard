'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useBotStore } from '@/lib/store';
import { settingsAPI } from '@/lib/api';
import { ArrowLeft, Key, Shield, Bell, Save, Loader2, BrainCircuit, Clock, Coins, Zap, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const { tradingMode, setStatus } = useBotStore();

  const [settings, setSettings] = useState({
    tradingMode: 'MANUAL',
    riskProfile: 'BALANCED',
    maxPositionPercent: 10,
    stopLossPercent: 5,
    takeProfitPercent: 10,
    notifyOnSignal: true,
    notifyOnTrade: true,
    allowedPairs: ['btc_idr', 'eth_idr'],
    analysisIntervalMins: 15,
    // Scalping Mode
    scalpingModeEnabled: false,
    scalpingTakeProfitPct: 1.5,
    scalpingStopLossPct: 0.5,
    scalpingMaxHoldMins: 30,
  });
  const [apiKeys, setApiKeys] = useState({ apiKey: '', secretKey: '' });
  const [geminiKey, setGeminiKey] = useState('');
  const [apiKeysStatus, setApiKeysStatus] = useState({ indodaxConfigured: false, geminiConfigured: false });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Wait for hydration before checking auth
    if (!_hasHydrated) return;
    
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadSettings();
  }, [_hasHydrated, isAuthenticated]);

  const loadSettings = async () => {
    try {
      const [settingsData, statusData] = await Promise.all([
        settingsAPI.get(),
        settingsAPI.getApiKeysStatus(),
      ]);
      setSettings(settingsData.settings || settings);
      setApiKeysStatus(statusData);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await settingsAPI.update(settings);
      setMessage('Settings saved successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiKeys = async () => {
    if (!apiKeys.apiKey || !apiKeys.secretKey) {
      setMessage('Please enter both API Key and Secret Key');
      return;
    }
    setSaving(true);
    try {
      await settingsAPI.saveApiKeys(apiKeys.apiKey, apiKeys.secretKey);
      setMessage('API Keys saved successfully');
      setApiKeys({ apiKey: '', secretKey: '' });
      loadSettings();
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Failed to save API keys');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGeminiKey = async () => {
    if (!geminiKey) {
      setMessage('Please enter your Gemini API Key');
      return;
    }
    setSaving(true);
    try {
      await settingsAPI.saveGeminiKey(geminiKey);
      setMessage('Gemini API Key saved successfully');
      setGeminiKey('');
      loadSettings();
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Failed to save Gemini key');
    } finally {
      setSaving(false);
    }
  };

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-slate-700 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {message && (
          <div className={`p-4 rounded-lg ${message.includes('success') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message}
          </div>
        )}

        {/* Trading Mode */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold">Trading Configuration</h2>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Trading Mode</label>
              <select
                value={settings.tradingMode}
                onChange={(e) => setSettings({ ...settings, tradingMode: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
              >
                <option value="MANUAL">Manual - AI only analyzes</option>
                <option value="COPILOT">Copilot - AI suggests, you approve</option>
                <option value="AUTONOMOUS">Autonomous - AI executes trades</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Risk Profile</label>
              <select
                value={settings.riskProfile}
                onChange={(e) => setSettings({ ...settings, riskProfile: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
              >
                <option value="CONSERVATIVE">Conservative (Low Risk)</option>
                <option value="BALANCED">Balanced (Medium Risk)</option>
                <option value="AGGRESSIVE">Aggressive (High Risk)</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Max Position %</label>
                <input
                  type="number"
                  value={settings.maxPositionPercent}
                  onChange={(e) => setSettings({ ...settings, maxPositionPercent: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
                  min={1}
                  max={50}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Stop Loss %</label>
                <input
                  type="number"
                  value={settings.stopLossPercent}
                  onChange={(e) => setSettings({ ...settings, stopLossPercent: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
                  min={1}
                  max={20}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Take Profit %</label>
                <input
                  type="number"
                  value={settings.takeProfitPercent}
                  onChange={(e) => setSettings({ ...settings, takeProfitPercent: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
                  min={1}
                  max={50}
                />
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              Save Settings
            </button>
          </div>
        </div>

        {/* Scalping Mode */}
        <div className={`bg-slate-800/50 backdrop-blur rounded-xl p-6 border ${settings.scalpingModeEnabled ? 'border-orange-500/50 shadow-lg shadow-orange-500/10' : 'border-slate-700/50'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className={`h-5 w-5 ${settings.scalpingModeEnabled ? 'text-orange-400' : 'text-slate-400'}`} />
              <h2 className="text-lg font-semibold">Scalping Mode</h2>
              {settings.scalpingModeEnabled && (
                <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full animate-pulse">ACTIVE</span>
              )}
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.scalpingModeEnabled}
                onChange={(e) => setSettings({ ...settings, scalpingModeEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          <p className="text-sm text-slate-400 mb-4">
            Trading otomatis jangka pendek dengan target profit kecil tapi cepat. AI akan menggunakan strategi scalping dengan SL ketat.
          </p>

          {settings.scalpingModeEnabled && (
            <>
              {/* Warning Banner */}
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-orange-300 font-medium">⚠️ High-Frequency Trading Mode</p>
                  <p className="text-orange-200/70 mt-1">
                    Scalping melibatkan banyak trade dengan margin kecil. Pastikan Anda memahami risikonya dan memiliki likuiditas yang cukup.
                  </p>
                </div>
              </div>

              {/* Scalping Parameters */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Take Profit %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.scalpingTakeProfitPct}
                    onChange={(e) => setSettings({ ...settings, scalpingTakeProfitPct: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-orange-500/30 rounded-lg text-white"
                    min={0.5}
                    max={5}
                  />
                  <p className="text-xs text-slate-500 mt-1">Target: 0.5-5%</p>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Stop Loss %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.scalpingStopLossPct}
                    onChange={(e) => setSettings({ ...settings, scalpingStopLossPct: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-orange-500/30 rounded-lg text-white"
                    min={0.1}
                    max={2}
                  />
                  <p className="text-xs text-slate-500 mt-1">Max: 0.1-2%</p>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Max Hold (menit)</label>
                  <input
                    type="number"
                    value={settings.scalpingMaxHoldMins}
                    onChange={(e) => setSettings({ ...settings, scalpingMaxHoldMins: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-orange-500/30 rounded-lg text-white"
                    min={5}
                    max={60}
                  />
                  <p className="text-xs text-slate-500 mt-1">5-60 menit</p>
                </div>
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Zap className="h-5 w-5" />
                Save Scalping Settings
              </button>
            </>
          )}
        </div>

        {/* Bot Analysis Configuration */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-4">
            <Coins className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-semibold">Bot Analysis Configuration</h2>
          </div>

          <div className="grid gap-4">
            {/* Analysis Interval */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                <Clock className="h-4 w-4 inline mr-1" />
                Analysis Interval
              </label>
              <select
                value={settings.analysisIntervalMins}
                onChange={(e) => setSettings({ ...settings, analysisIntervalMins: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
              >
                <option value={5}>Every 5 minutes</option>
                <option value={10}>Every 10 minutes</option>
                <option value={15}>Every 15 minutes (Recommended)</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every 1 hour</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">How often the AI analyzes selected pairs for trading signals</p>
            </div>

            {/* Pair Selection */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Pairs to Analyze
              </label>
              <p className="text-xs text-slate-500 mb-3">Select which trading pairs the bot should analyze. Fewer pairs = faster & cheaper analysis.</p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { id: 'btc_idr', name: 'BTC/IDR', popular: true },
                  { id: 'eth_idr', name: 'ETH/IDR', popular: true },
                  { id: 'sol_idr', name: 'SOL/IDR', popular: true },
                  { id: 'xrp_idr', name: 'XRP/IDR', popular: true },
                  { id: 'doge_idr', name: 'DOGE/IDR', popular: true },
                  { id: 'shib_idr', name: 'SHIB/IDR', hot: true },
                  { id: 'pepe_idr', name: 'PEPE/IDR', hot: true },
                  { id: 'floki_idr', name: 'FLOKI/IDR', hot: true },
                  { id: 'bonk_idr', name: 'BONK/IDR', hot: true },
                  { id: 'wif_idr', name: 'WIF/IDR', hot: true },
                  { id: 'trump_idr', name: 'TRUMP/IDR', hot: true },
                  { id: 'pippin_idr', name: 'PIPPIN/IDR', hot: true },
                  { id: 'ada_idr', name: 'ADA/IDR' },
                  { id: 'bnb_idr', name: 'BNB/IDR' },
                  { id: 'avax_idr', name: 'AVAX/IDR' },
                  { id: 'dot_idr', name: 'DOT/IDR' },
                  { id: 'matic_idr', name: 'MATIC/IDR' },
                  { id: 'link_idr', name: 'LINK/IDR' },
                  { id: 'ltc_idr', name: 'LTC/IDR' },
                ].map((pair) => (
                  <label
                    key={pair.id}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      settings.allowedPairs?.includes(pair.id)
                        ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
                        : 'bg-slate-700/30 border-slate-600/50 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={settings.allowedPairs?.includes(pair.id) || false}
                      onChange={(e) => {
                        const current = settings.allowedPairs || [];
                        if (e.target.checked) {
                          setSettings({ ...settings, allowedPairs: [...current, pair.id] });
                        } else {
                          setSettings({ ...settings, allowedPairs: current.filter(p => p !== pair.id) });
                        }
                      }}
                      className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                    />
                    <span className="text-sm font-medium">{pair.name}</span>
                    {pair.popular && <span className="text-xs text-yellow-400">★</span>}
                    {pair.hot && <span className="text-xs">🔥</span>}
                  </label>
                ))}
              </div>
              
              <p className="text-xs text-slate-500 mt-2">
                Selected: {settings.allowedPairs?.length || 0} pair(s)
              </p>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              Save Analysis Settings
            </button>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-4">
            <Key className="h-5 w-5 text-yellow-400" />
            <h2 className="text-lg font-semibold">Indodax API Keys</h2>
            {apiKeysStatus.indodaxConfigured && (
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Configured</span>
            )}
          </div>

          <div className="grid gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">API Key</label>
              <input
                type="password"
                value={apiKeys.apiKey}
                onChange={(e) => setApiKeys({ ...apiKeys, apiKey: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
                placeholder="Enter your Indodax API Key"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Secret Key</label>
              <input
                type="password"
                value={apiKeys.secretKey}
                onChange={(e) => setApiKeys({ ...apiKeys, secretKey: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
                placeholder="Enter your Indodax Secret Key"
              />
            </div>
            <button
              onClick={handleSaveApiKeys}
              disabled={saving}
              className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Key className="h-5 w-5" />
              Save API Keys
            </button>
          </div>
        </div>

        {/* Gemini API Key */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold">Gemini AI API Key</h2>
            {apiKeysStatus.geminiConfigured && (
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Configured</span>
            )}
          </div>

          <div className="grid gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Gemini API Key</label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
                placeholder="Enter your Gemini API Key (AIza...)"
              />
              <p className="text-xs text-slate-500 mt-1">Get your API key from <a href="https://aistudio.google.com/apikey" target="_blank" className="text-purple-400 hover:underline">Google AI Studio</a></p>
            </div>
            <button
              onClick={handleSaveGeminiKey}
              disabled={saving}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <BrainCircuit className="h-5 w-5" />
              Save Gemini Key
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifyOnSignal}
                onChange={(e) => setSettings({ ...settings, notifyOnSignal: e.target.checked })}
                className="w-5 h-5 rounded bg-slate-700 border-slate-600"
              />
              <span>Notify on new signals</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifyOnTrade}
                onChange={(e) => setSettings({ ...settings, notifyOnTrade: e.target.checked })}
                className="w-5 h-5 rounded bg-slate-700 border-slate-600"
              />
              <span>Notify on trade execution</span>
            </label>
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useBotStore } from '@/lib/store';
import { marketAPI, settingsAPI, signalsAPI, tradesAPI } from '@/lib/api';
import { useSocket, useMarketSummary, useSignalNotifications, MarketSummary } from '@/lib/socket';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Wallet, 
  Bot,
  BrainCircuit,
  Power,
  Settings,
  Loader2,
  Wifi,
  WifiOff,
  X,
  AlertTriangle
} from 'lucide-react';

interface MarketTicker {
  pair: string;
  last: number;
  change24h: number;
  volume24h: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user, logout, _hasHydrated } = useAuthStore();
  const { active: botActive, tradingMode, setStatus } = useBotStore();
  const { connected } = useSocket();
  
  const [markets, setMarkets] = useState<MarketTicker[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [signals, setSignals] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState('');
  const [selectedPair, setSelectedPair] = useState('btc_idr');
  const [trackedPairs, setTrackedPairs] = useState<string[]>(['btc_idr', 'eth_idr']);
  
  // Approval modal state
  const [confirmModal, setConfirmModal] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<any>(null);
  const [approving, setApproving] = useState(false);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [useMode, setUseMode] = useState<'ai' | 'user'>('ai'); // Which mode to use for SL/TP
  
  // Detail analysis modal state
  const [detailModal, setDetailModal] = useState(false);
  const [selectedDetailSignal, setSelectedDetailSignal] = useState<any>(null);
  
  // Use ref to store market data for realtime updates
  const marketMapRef = useRef<Map<string, MarketTicker>>(new Map());
  
  // State for all market prices (for real-time position updates)
  const [allPrices, setAllPrices] = useState<Map<string, number>>(new Map());
  
  // Callback for realtime market updates
  const handleMarketUpdate = useCallback((summaries: MarketSummary[]) => {
    const newPrices = new Map<string, number>();
    
    summaries.forEach(s => {
      if (s.pair.endsWith('idr')) {
        marketMapRef.current.set(s.pair, {
          pair: s.pair,
          last: s.last,
          change24h: s.change24h,
          volume24h: s.volume24h,
        });
        newPrices.set(s.pair, s.last);
      }
    });
    
    // Update allPrices state to trigger re-render for positions
    setAllPrices(newPrices);
    
    // Sort and take top 10 by volume
    const sorted = Array.from(marketMapRef.current.values())
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 10);
    
    setMarkets(sorted);
  }, []);
  
  // Subscribe to realtime market updates
  useMarketSummary(handleMarketUpdate);
  
  // Subscribe to signal notifications - auto-refresh when new signal arrives
  const handleNewSignal = useCallback(() => {
    // Reload signals when WebSocket notifies of new signal
    signalsAPI.getPending().then(data => {
      setSignals(data.signals || []);
    }).catch(console.error);
  }, []);
  
  useSignalNotifications(handleNewSignal);

  useEffect(() => {
    // Wait for hydration before checking auth
    if (!_hasHydrated) return;
    
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    loadData();
  }, [_hasHydrated, isAuthenticated]);

  const loadData = async () => {
    try {
      const [marketData, botStatus, signalData, statsData] = await Promise.all([
        marketAPI.getSummaries(),
        settingsAPI.getBotStatus(),
        signalsAPI.getPending(),
        signalsAPI.getStats(),
      ]);

      // Parse market data
      const tickers = Object.entries(marketData.tickers || {})
        .filter(([key]) => key.endsWith('idr'))
        .map(([pair, data]: [string, any]) => ({
          pair,
          last: parseFloat(data.last),
          change24h: parseFloat(data.price_change_24h || '0'),
          volume24h: parseFloat(data.vol_idr || '0'),
        }))
        .sort((a, b) => b.volume24h - a.volume24h)
        .slice(0, 10);

      setMarkets(tickers);
      setStatus(botStatus.active, botStatus.tradingMode);
      setSignals(signalData.signals || []);
      setStats(statsData);
      
      // Load user settings for tracked pairs
      try {
        const settingsData = await settingsAPI.get();
        const allowedPairs = settingsData.settings?.allowedPairs || ['btc_idr', 'eth_idr'];
        setTrackedPairs(allowedPairs);
        // Set selected pair to first tracked pair if current selection is not in list
        if (!allowedPairs.includes(selectedPair)) {
          setSelectedPair(allowedPairs[0] || 'btc_idr');
        }
      } catch {}

      // Try to get balance and positions (may fail if API keys not configured)
      try {
        const [balanceData, positionsData] = await Promise.all([
          tradesAPI.getBalance(),
          tradesAPI.getPositions(),
        ]);
        setBalance(balanceData);
        setPositions(positionsData.positions || []);
      } catch {}
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBot = async () => {
    try {
      if (botActive) {
        await settingsAPI.stopBot();
        setStatus(false);
      } else {
        await settingsAPI.startBot();
        setStatus(true);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to toggle bot');
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisError('');
    setAnalysisResult(null);
    
    try {
      const result = await signalsAPI.generate(selectedPair);
      setAnalysisResult(result);
      // Refresh signals list
      const signalData = await signalsAPI.getPending();
      setSignals(signalData.signals || []);
    } catch (error: any) {
      setAnalysisError(error.response?.data?.error || 'Failed to analyze. Make sure Gemini API key is configured.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle approval with confirmation
  const handleApproveClick = async (signal: any) => {
    setSelectedSignal(signal);
    setConfirmModal(true);
    setUseMode('ai'); // Default to AI recommendation
    
    // Fetch user settings for accurate calculation
    try {
      const settings = await settingsAPI.get();
      setUserSettings(settings.settings);
    } catch (error) {
      console.error('Failed to fetch user settings:', error);
    }
  };

  const handleConfirmApprove = async () => {
    if (!selectedSignal) return;
    
    setApproving(true);
    try {
      await signalsAPI.approve(selectedSignal.id);
      setConfirmModal(false);
      setSelectedSignal(null);
      await loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || error.response?.data?.error || 'Failed to approve signal');
    } finally {
      setApproving(false);
    }
  };

  // Calculate trade amounts for modal
  const calculateTradeAmounts = (signal: any) => {
    const entryPrice = parseFloat(signal.entryPrice) || 0;
    const aiRecommendedPercent = signal.amountPercent || 10;
    const userMaxPercent = userSettings?.maxPositionPercent || 10;
    const actualPercent = Math.min(aiRecommendedPercent, userMaxPercent);
    const idrBalance = parseFloat(balance?.balance?.idr || '0');
    const cost = (idrBalance * actualPercent) / 100;
    const coinAmount = entryPrice > 0 ? cost / entryPrice : 0;
    
    return { 
      cost, 
      coinAmount, 
      entryPrice, 
      aiRecommendedPercent, 
      userMaxPercent, 
      actualPercent,
      idrBalance,
    };
  };

  // Smart price formatter that preserves precision for small prices (like PEPE)
  const formatPrice = (price: number) => {
    if (price === 0) return 'Rp 0';
    
    // For very small prices (< 10), show more decimal places
    if (price < 10) {
      // Determine how many decimals needed
      const decimals = price < 0.01 ? 6 : price < 1 ? 4 : 2;
      return `Rp ${price.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    }
    
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(price);
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
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrainCircuit className="h-8 w-8 text-purple-500" />
            <h1 className="text-xl font-bold">AI Trading Bot</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
              {connected ? 'Connected' : 'Disconnected'}
            </div>
            <a href="/settings" className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <Settings className="h-5 w-5" />
            </a>
            <button onClick={logout} className="text-slate-400 hover:text-white text-sm">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Bot Status & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Bot Control */}
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-5 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-400" />
                <span className="text-sm text-slate-400">Trading Bot</span>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${botActive ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'}`}>
                {tradingMode}
              </span>
            </div>
            <button
              onClick={handleToggleBot}
              className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                botActive 
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              }`}
            >
              <Power className="h-5 w-5" />
              {botActive ? 'Stop Bot' : 'Start Bot'}
            </button>
          </div>

          {/* Balance */}
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-5 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-5 w-5 text-yellow-400" />
              <span className="text-sm text-slate-400">Balance</span>
            </div>
            {balance ? (
              <p className="text-2xl font-bold">{formatPrice(parseFloat(balance.balance?.idr || '0'))}</p>
            ) : (
              <p className="text-slate-500">Configure API Keys</p>
            )}
          </div>

          {/* Signals */}
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-5 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-5 w-5 text-blue-400" />
              <span className="text-sm text-slate-400">Pending Signals</span>
            </div>
            <p className="text-2xl font-bold">{signals.length}</p>
          </div>

          {/* Win Rate */}
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-5 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <span className="text-sm text-slate-400">Win Rate</span>
            </div>
            <p className="text-2xl font-bold">{stats?.trades?.winRate || 'N/A'}</p>
          </div>
        </div>

        {/* AI Analysis */}
        <div className="bg-gradient-to-br from-purple-900/30 to-cyan-900/30 backdrop-blur rounded-xl p-6 border border-purple-500/30">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold">AI Analysis</h2>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <select
              value={selectedPair}
              onChange={(e) => setSelectedPair(e.target.value)}
              className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
            >
              {trackedPairs.map((pair) => (
                <option key={pair} value={pair}>
                  {pair.replace('_idr', '/IDR').toUpperCase()}
                </option>
              ))}
            </select>
            
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <BrainCircuit className="h-5 w-5" />
                  Analyze Now
                </>
              )}
            </button>
          </div>
          
          {analysisError && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 mb-4">
              {analysisError}
            </div>
          )}
          
          {analysisResult && (
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-lg text-lg font-bold ${
                  analysisResult.signal?.action === 'BUY' ? 'bg-green-500/20 text-green-400' :
                  analysisResult.signal?.action === 'SELL' ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {analysisResult.signal?.action || 'HOLD'}
                </span>
                <span className="text-slate-400">
                  Confidence: <span className="text-white font-bold">{((analysisResult.signal?.confidence || 0) * 100).toFixed(0)}%</span>
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-slate-700/30 p-2 rounded">
                  <span className="text-slate-400">Entry</span>
                  <p className="text-white">{formatPrice(analysisResult.signal?.entryPrice || 0)}</p>
                </div>
                <div className="bg-slate-700/30 p-2 rounded">
                  <span className="text-slate-400">Target</span>
                  <p className="text-green-400">{formatPrice(analysisResult.signal?.targetPrice || 0)}</p>
                </div>
                <div className="bg-slate-700/30 p-2 rounded">
                  <span className="text-slate-400">Stop Loss</span>
                  <p className="text-red-400">{formatPrice(analysisResult.signal?.stopLoss || 0)}</p>
                </div>
              </div>
              
              <div className="border-t border-slate-700 pt-3">
                <p className="text-sm text-slate-400">AI Reasoning:</p>
                <p className="text-white text-sm mt-1">{analysisResult.signal?.reasoning}</p>
              </div>
              
              {/* View Detail Analysis Button */}
              <button
                onClick={() => setDetailModal(true)}
                className="w-full mt-3 py-2 px-4 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 text-sm font-medium flex items-center justify-center gap-2"
              >
                📊 View Detail Analysis
              </button>
              
              {analysisResult.skipped && (
                <div className="p-3 bg-yellow-500/20 border border-yellow-500/50 rounded text-yellow-300 text-sm">
                  ⚠️ {analysisResult.message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pending Signals - Moved ABOVE Markets */}
        {signals.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="p-4 border-b border-slate-700/50">
              <h2 className="text-lg font-semibold">📊 Pending Signals</h2>
            </div>
            <div className="p-4 space-y-3">
              {signals.map((signal) => (
                <div key={signal.id} className="bg-slate-700/30 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        signal.action === 'BUY' ? 'bg-green-500/20 text-green-400' : 
                        signal.action === 'SELL' ? 'bg-red-500/20 text-red-400' : 
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {signal.action}
                      </span>
                      <span className="font-medium">{signal.pair.toUpperCase()}</span>
                      <span className="text-slate-400 text-sm">
                        {(signal.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">{signal.reasoning}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button 
                      onClick={() => { setSelectedDetailSignal(signal); setDetailModal(true); }}
                      className="px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 text-sm"
                    >
                      📊 Detail
                    </button>
                    <button 
                      onClick={() => handleApproveClick(signal)}
                      className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => signalsAPI.reject(signal.id).then(loadData)}
                      className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open Positions - NEW SECTION */}
        {positions.length > 0 && (
          <div className="bg-gradient-to-br from-green-900/20 to-slate-800/50 backdrop-blur rounded-xl border border-green-500/30 overflow-hidden">
            <div className="p-4 border-b border-green-500/30">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Open Positions ({positions.length})
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {positions.map((pos) => {
                const entryPrice = parseFloat(pos.entryPrice);
                // Normalize pair: DB uses "pepe_idr" but WS uses "pepeidr"
                const normalizedPair = pos.pair.replace('_', '');
                // Get current price from allPrices state (real-time WS updates)
                const currentMarketPrice = allPrices.get(normalizedPair) || markets.find(m => m.pair === normalizedPair)?.last || entryPrice;
                const pnlPercent = ((currentMarketPrice - entryPrice) / entryPrice) * 100;
                const pnlAmount = parseFloat(pos.amount) * (currentMarketPrice - entryPrice);
                const isProfit = pnlPercent >= 0;
                
                return (
                  <div key={pos.id} className="bg-slate-700/30 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm font-bold">
                          LONG
                        </span>
                        <span className="font-bold text-lg">{pos.pair.toUpperCase()}</span>
                      </div>
                      <div className={`text-right ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                        <p className="text-xl font-bold">{isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%</p>
                        <p className="text-sm">{isProfit ? '+' : ''}{formatPrice(pnlAmount)}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 text-sm mb-3">
                      <div className="bg-slate-600/30 p-2 rounded text-center">
                        <span className="text-slate-400 text-xs">Entry</span>
                        <p className="font-mono">{formatPrice(entryPrice)}</p>
                      </div>
                      <div className="bg-slate-600/30 p-2 rounded text-center">
                        <span className="text-slate-400 text-xs">Current</span>
                        <p className="font-mono">{formatPrice(currentMarketPrice)}</p>
                      </div>
                      <div className="bg-red-500/10 p-2 rounded text-center">
                        <span className="text-red-300 text-xs">SL</span>
                        <p className="font-mono text-red-400">{formatPrice(parseFloat(pos.stopLoss || '0'))}</p>
                      </div>
                      <div className="bg-green-500/10 p-2 rounded text-center">
                        <span className="text-green-300 text-xs">TP</span>
                        <p className="font-mono text-green-400">{formatPrice(parseFloat(pos.takeProfit || '0'))}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-slate-400">
                      <span>Amount: {parseFloat(pos.amount).toFixed(4)} {pos.pair.split('_')[0].toUpperCase()}</span>
                      <span>Cost: {formatPrice(parseFloat(pos.cost))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Markets - Moved to BOTTOM */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-4 border-b border-slate-700/50">
            <h2 className="text-lg font-semibold">🔥 Top Markets (IDR)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="text-left p-4 text-sm text-slate-400">Pair</th>
                  <th className="text-right p-4 text-sm text-slate-400">Price</th>
                  <th className="text-right p-4 text-sm text-slate-400">24h Change</th>
                  <th className="text-right p-4 text-sm text-slate-400">Volume</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market) => (
                  <tr key={market.pair} className="border-t border-slate-700/30 hover:bg-slate-700/20">
                    <td className="p-4 font-medium">{market.pair.toUpperCase()}</td>
                    <td className="p-4 text-right">{formatPrice(market.last)}</td>
                    <td className={`p-4 text-right ${market.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      <span className="flex items-center justify-end gap-1">
                        {market.change24h >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        {market.change24h.toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-4 text-right text-slate-400">
                      {formatPrice(market.volume24h)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Approval Confirmation Modal */}
      {confirmModal && selectedSignal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                Konfirmasi Order
              </h3>
              <button
                onClick={() => { setConfirmModal(false); setSelectedSignal(null); }}
                className="p-1 hover:bg-slate-700 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Signal Info */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Pair</span>
                <span className="font-bold text-lg">{selectedSignal.pair.toUpperCase()}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Action</span>
                <span className={`px-3 py-1 rounded-lg font-bold ${
                  selectedSignal.action === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {selectedSignal.action}
                </span>
              </div>
              
              {/* Trade Details */}
              {(() => {
                const { cost, coinAmount, entryPrice, aiRecommendedPercent, userMaxPercent, actualPercent, idrBalance } = calculateTradeAmounts(selectedSignal);
                return (
                  <>
                    <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Entry Price</span>
                        <span className="font-mono">{formatPrice(entryPrice)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Balance</span>
                        <span className="font-mono text-slate-300">{formatPrice(idrBalance)}</span>
                      </div>
                      
                      {/* AI vs User Settings */}
                      <div className="border-t border-slate-600 pt-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-purple-400">🤖 AI Recommendation</span>
                          <span className="font-mono text-purple-300">{aiRecommendedPercent}%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-cyan-400">⚙️ User Max Setting</span>
                          <span className="font-mono text-cyan-300">{userMaxPercent}%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm font-bold">
                          <span className="text-yellow-400">→ Actual Used</span>
                          <span className="font-mono text-yellow-300">{actualPercent}% ({formatPrice(cost)})</span>
                        </div>
                      </div>
                      
                      {/* Trade Amounts */}
                      <div className="border-t border-slate-600 pt-3">
                        <div className="flex items-center justify-between text-lg">
                          <span className="text-slate-300">Jumlah Coin</span>
                          <span className="font-bold text-purple-400">
                            {coinAmount.toFixed(8)} {selectedSignal.pair.split('_')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-lg mt-2">
                          <span className="text-slate-300">Total Cost</span>
                          <span className="font-bold text-yellow-400">{formatPrice(cost)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Choose Mode: AI vs User */}
                    <div className="space-y-2">
                      <p className="text-sm text-slate-400 font-medium">Pilih SL/TP/Amount:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setUseMode('ai')}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            useMode === 'ai' 
                              ? 'border-purple-500 bg-purple-500/20' 
                              : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">🤖</span>
                            <span className="font-medium text-purple-400">AI Recommendation</span>
                          </div>
                          <div className="text-xs text-slate-400 space-y-0.5">
                            <p>SL: {formatPrice(parseFloat(selectedSignal.stopLoss) || 0)}</p>
                            <p>TP: {formatPrice(parseFloat(selectedSignal.targetPrice) || 0)}</p>
                            <p>Amount: {aiRecommendedPercent}%</p>
                          </div>
                        </button>
                        <button
                          onClick={() => setUseMode('user')}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            useMode === 'user' 
                              ? 'border-cyan-500 bg-cyan-500/20' 
                              : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">⚙️</span>
                            <span className="font-medium text-cyan-400">User Settings</span>
                          </div>
                          <div className="text-xs text-slate-400 space-y-0.5">
                            <p>SL: {formatPrice(entryPrice * (1 - (userSettings?.stopLossPercent || 5) / 100))}</p>
                            <p>TP: {formatPrice(entryPrice * (1 + (userSettings?.takeProfitPercent || 10) / 100))}</p>
                            <p>Amount: {userMaxPercent}%</p>
                          </div>
                        </button>
                      </div>
                    </div>
                    
                    {/* Selected Values Display */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`rounded-lg p-3 text-center ${useMode === 'ai' ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-red-500/10 border border-red-500/30'}`}>
                        <span className="text-xs text-red-300">Stop Loss</span>
                        <p className="font-bold text-red-400">
                          {formatPrice(
                            useMode === 'ai' 
                              ? parseFloat(selectedSignal.stopLoss) || 0
                              : entryPrice * (1 - (userSettings?.stopLossPercent || 5) / 100)
                          )}
                        </p>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${useMode === 'ai' ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-green-500/10 border border-green-500/30'}`}>
                        <span className="text-xs text-green-300">Take Profit</span>
                        <p className="font-bold text-green-400">
                          {formatPrice(
                            useMode === 'ai' 
                              ? parseFloat(selectedSignal.targetPrice) || 0
                              : entryPrice * (1 + (userSettings?.takeProfitPercent || 10) / 100)
                          )}
                        </p>
                      </div>
                    </div>
                    
                    {cost < 50000 && (
                      <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 text-yellow-300 text-sm">
                        ⚠️ Trade amount ({formatPrice(cost)}) di bawah minimum. Perlu minimal Rp 50.000.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            
            {/* Modal Footer */}
            <div className="flex gap-3 p-4 border-t border-slate-700">
              <button
                onClick={() => { setConfirmModal(false); setSelectedSignal(null); }}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold"
                disabled={approving}
              >
                Batal
              </button>
              <button
                onClick={handleConfirmApprove}
                disabled={approving}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {approving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Konfirmasi Order'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Analysis Modal */}
      {detailModal && (selectedDetailSignal || analysisResult?.signal) && (() => {
        // Use signal from Pending Signals or fresh analysis result
        const activeSignal = selectedDetailSignal || analysisResult?.signal;
        const hasDetailedAnalysis = !!activeSignal?.analysis;
        
        return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                📊 Detail Analisa - {activeSignal.pair?.toUpperCase() || selectedPair.toUpperCase()}
              </h2>
              <button onClick={() => { setDetailModal(false); setSelectedDetailSignal(null); }} className="text-slate-400 hover:text-white text-2xl">×</button>
            </div>
            
            {/* Signal Summary */}
            <div className="p-4 border-b border-slate-700/50 bg-slate-700/30">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-3 py-1 rounded-lg font-bold ${
                  activeSignal.action === 'BUY' ? 'bg-green-500/20 text-green-400' : 
                  activeSignal.action === 'SELL' ? 'bg-red-500/20 text-red-400' : 
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {activeSignal.action}
                </span>
                <span className="text-lg font-semibold">{(activeSignal.confidence * 100).toFixed(0)}% Confidence</span>
              </div>
              <p className="text-slate-300">{activeSignal.reasoning}</p>
              
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-slate-600/30 p-2 rounded text-center">
                  <span className="text-slate-400 text-xs">Entry Price</span>
                  <p className="font-mono text-white">{formatPrice(activeSignal.entryPrice || 0)}</p>
                </div>
                <div className="bg-green-500/10 p-2 rounded text-center">
                  <span className="text-green-300 text-xs">Take Profit</span>
                  <p className="font-mono text-green-400">{formatPrice(activeSignal.targetPrice || 0)}</p>
                </div>
                <div className="bg-red-500/10 p-2 rounded text-center">
                  <span className="text-red-300 text-xs">Stop Loss</span>
                  <p className="font-mono text-red-400">{formatPrice(activeSignal.stopLoss || 0)}</p>
                </div>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {hasDetailedAnalysis && activeSignal.analysis ? (
                <>
                  {/* Trend Summary */}
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3 text-purple-400">📈 Trend Analysis</h3>
                    <div className="flex items-center gap-4 mb-2">
                      <span className={`px-4 py-2 rounded-lg text-lg font-bold ${
                        activeSignal.analysis.trend.direction === 'BULLISH' ? 'bg-green-500/20 text-green-400' :
                        activeSignal.analysis.trend.direction === 'BEARISH' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {activeSignal.analysis.trend.direction}
                      </span>
                      <span className={`px-3 py-1 rounded text-sm ${
                        activeSignal.analysis.trend.strength === 'STRONG' ? 'bg-purple-500/20 text-purple-400' :
                        activeSignal.analysis.trend.strength === 'MODERATE' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {activeSignal.analysis.trend.strength}
                      </span>
                    </div>
                    <p className="text-slate-300 text-sm">{activeSignal.analysis.trend.description}</p>
                  </div>
                  
                  {/* Indicators Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* RSI */}
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-blue-400">RSI (14)</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          activeSignal.analysis.indicators.rsi.signal === 'OVERSOLD' ? 'bg-green-500/20 text-green-400' :
                          activeSignal.analysis.indicators.rsi.signal === 'OVERBOUGHT' ? 'bg-red-500/20 text-red-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {activeSignal.analysis.indicators.rsi.signal}
                        </span>
                      </div>
                      <p className="text-2xl font-bold">{activeSignal.analysis.indicators.rsi.value.toFixed(1)}</p>
                      <p className="text-xs text-slate-400 mt-1">{activeSignal.analysis.indicators.rsi.description}</p>
                    </div>
                    
                    {/* MACD */}
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-orange-400">MACD</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          activeSignal.analysis.indicators.macd.signal === 'BULLISH' ? 'bg-green-500/20 text-green-400' :
                          activeSignal.analysis.indicators.macd.signal === 'BEARISH' ? 'bg-red-500/20 text-red-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {activeSignal.analysis.indicators.macd.signal}
                        </span>
                      </div>
                      <p className="text-lg font-bold">Histogram: {activeSignal.analysis.indicators.macd.histogram > 0 ? '+' : ''}{activeSignal.analysis.indicators.macd.histogram.toFixed(6)}</p>
                      <p className="text-xs text-slate-400 mt-1">{activeSignal.analysis.indicators.macd.description}</p>
                    </div>
                    
                    {/* Bollinger Bands */}
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-cyan-400">Bollinger Bands</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          activeSignal.analysis.indicators.bollingerBands.position.includes('LOWER') ? 'bg-green-500/20 text-green-400' :
                          activeSignal.analysis.indicators.bollingerBands.position.includes('UPPER') ? 'bg-red-500/20 text-red-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {activeSignal.analysis.indicators.bollingerBands.position}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{activeSignal.analysis.indicators.bollingerBands.description}</p>
                    </div>
                    
                    {/* Volume */}
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-green-400">Volume</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          activeSignal.analysis.indicators.volume.trend === 'INCREASING' ? 'bg-green-500/20 text-green-400' :
                          activeSignal.analysis.indicators.volume.trend === 'DECREASING' ? 'bg-red-500/20 text-red-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {activeSignal.analysis.indicators.volume.trend}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{activeSignal.analysis.indicators.volume.description}</p>
                    </div>
                    
                    {/* EMA */}
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-pink-400">EMA Crossover</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          activeSignal.analysis.indicators.ema.crossover === 'GOLDEN' ? 'bg-green-500/20 text-green-400' :
                          activeSignal.analysis.indicators.ema.crossover === 'DEATH' ? 'bg-red-500/20 text-red-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {activeSignal.analysis.indicators.ema.crossover}
                        </span>
                      </div>
                      <div className="text-xs space-y-1">
                        <p>EMA9: {formatPrice(activeSignal.analysis.indicators.ema.ema9)}</p>
                        <p>EMA21: {formatPrice(activeSignal.analysis.indicators.ema.ema21)}</p>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{activeSignal.analysis.indicators.ema.description}</p>
                    </div>
                    
                    {/* Risk Reward */}
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-yellow-400">Risk/Reward</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          activeSignal.analysis.riskReward.assessment === 'FAVORABLE' ? 'bg-green-500/20 text-green-400' :
                          activeSignal.analysis.riskReward.assessment === 'UNFAVORABLE' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {activeSignal.analysis.riskReward.assessment}
                        </span>
                      </div>
                      <p className="text-2xl font-bold">1:{activeSignal.analysis.riskReward.ratio.toFixed(2)}</p>
                    </div>
                  </div>
                  
                  {/* Support & Resistance */}
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3 text-amber-400">📍 Support & Resistance</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-500/10 p-3 rounded-lg text-center">
                        <span className="text-xs text-green-300">Support</span>
                        <p className="text-lg font-bold text-green-400">{formatPrice(activeSignal.analysis.supportResistance.nearestSupport)}</p>
                      </div>
                      <div className="bg-red-500/10 p-3 rounded-lg text-center">
                        <span className="text-xs text-red-300">Resistance</span>
                        <p className="text-lg font-bold text-red-400">{formatPrice(activeSignal.analysis.supportResistance.nearestResistance)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{activeSignal.analysis.supportResistance.description}</p>
                  </div>
                  
                  {/* Price Action */}
                  {activeSignal.analysis.priceAction && (
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-2 text-indigo-400">🕯️ Price Action Pattern</h3>
                      <p className="text-lg font-bold">{activeSignal.analysis.priceAction.pattern || 'No clear pattern'}</p>
                      <p className="text-xs text-slate-400 mt-1">{activeSignal.analysis.priceAction.description}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <p>Detail analisa tidak tersedia untuk signal ini.</p>
                  <p className="text-sm mt-2">Generate signal baru untuk melihat analisa lengkap.</p>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-slate-800 p-4 border-t border-slate-700">
              <button
                onClick={() => setDetailModal(false)}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

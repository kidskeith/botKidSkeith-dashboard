'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3002';

let socket: Socket | null = null;

export interface MarketSummary {
  pair: string;
  last: number;
  change24h: number;
  volume24h: number;
}

export interface SignalNotification {
  id: string;
  pair: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  status: string;
  reasoning: string;
  createdAt: string;
}

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) return;

    // Only create new connection if not exists
    if (!socket) {
      socket = io(WS_URL, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 3000,
      });
    }

    socket.on('connect', () => {
      setConnected(true);
      console.log('[WS] Connected to backend');
      
      // Auto-subscribe to signals and trades
      socket?.emit('subscribe:signals');
      socket?.emit('subscribe:trades');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      console.log('[WS] Disconnected from backend');
    });

    socket.on('connect_error', (err) => {
      console.log('[WS] Connection error:', err.message);
    });

    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, [token]);

  return { socket, connected };
}

/**
 * Hook to subscribe to market summary updates
 */
export function useMarketSummary(onUpdate: (summaries: MarketSummary[]) => void) {
  const { socket, connected } = useSocket();

  useEffect(() => {
    if (!socket || !connected) return;

    const handleMarketSummary = (summaries: MarketSummary[]) => {
      onUpdate(summaries);
    };

    socket.on('market:summary', handleMarketSummary);

    return () => {
      socket.off('market:summary', handleMarketSummary);
    };
  }, [socket, connected, onUpdate]);

  return { connected };
}

/**
 * Hook to subscribe to signal notifications (new signals, updates)
 */
export function useSignalNotifications(onNewSignal: (signal: SignalNotification) => void) {
  const { socket, connected } = useSocket();

  useEffect(() => {
    if (!socket || !connected) return;

    const handleNewSignal = (signal: SignalNotification) => {
      console.log('[WS] New signal received:', signal);
      onNewSignal(signal);
    };

    const handleSignalUpdate = (signal: SignalNotification) => {
      console.log('[WS] Signal updated:', signal);
      onNewSignal(signal);
    };

    socket.on('signal:new', handleNewSignal);
    socket.on('signal:update', handleSignalUpdate);

    return () => {
      socket.off('signal:new', handleNewSignal);
      socket.off('signal:update', handleSignalUpdate);
    };
  }, [socket, connected, onNewSignal]);

  return { connected };
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

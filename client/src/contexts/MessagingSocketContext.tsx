import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import io, { type Socket } from 'socket.io-client';

type SocketStatus = 'connected' | 'reconnecting' | 'disconnected';

interface MessagingSocketContextValue {
  socket: Socket | null;
  status: SocketStatus;
}

const MessagingSocketContext = createContext<MessagingSocketContextValue>({
  socket: null,
  status: 'disconnected',
});

export function MessagingSocketProvider({ children }: { children: ReactNode }) {
  // Create socket eagerly so consumers always get a non-null instance after mount
  const [socket] = useState<Socket>(() => io());
  const [status, setStatus] = useState<SocketStatus>('disconnected');

  useEffect(() => {
    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));

    // Manager-level reconnection events
    socket.io.on('reconnect_attempt', () => setStatus('reconnecting'));
    socket.io.on('reconnect', () => setStatus('connected'));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.io.off('reconnect_attempt');
      socket.io.off('reconnect');
      socket.disconnect();
    };
  }, [socket]);

  return (
    <MessagingSocketContext.Provider value={{ socket, status }}>
      {children}
    </MessagingSocketContext.Provider>
  );
}

export function useMessagingSocket(): MessagingSocketContextValue {
  return useContext(MessagingSocketContext);
}

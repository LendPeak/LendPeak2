import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../store/auth-context';
import { toast } from 'react-toastify';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  severity?: 'info' | 'warning' | 'error' | 'success';
  timestamp: Date;
  read: boolean;
}

interface WebSocketContextType {
  socket: Socket | null;
  connected: boolean;
  notifications: Notification[];
  unreadCount: number;
  markNotificationAsRead: (notificationId: string) => void;
  clearNotifications: () => void;
  subscribeToAnalytics: (metrics: string[]) => void;
  unsubscribeFromAnalytics: () => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  connected: false,
  notifications: [],
  unreadCount: 0,
  markNotificationAsRead: () => {},
  clearNotifications: () => {},
  subscribeToAnalytics: () => {},
  unsubscribeFromAnalytics: () => {},
});

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!token || !user) {
      // Disconnect if no token
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Initialize socket connection
    const socketUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection events
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      toast.success('Real-time updates connected', { autoClose: 2000 });
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnected(false);
    });

    // Authentication
    newSocket.on('authenticated', (data) => {
      console.log('WebSocket authenticated:', data);
    });

    // Notification events
    newSocket.on('notification', (notification: Notification) => {
      console.log('Received notification:', notification);
      
      // Add to notifications list
      setNotifications(prev => [notification, ...prev]);
      
      // Show toast based on severity
      const toastOptions = { autoClose: 5000 };
      switch (notification.severity) {
        case 'success':
          toast.success(notification.message, toastOptions);
          break;
        case 'error':
          toast.error(notification.message, toastOptions);
          break;
        case 'warning':
          toast.warn(notification.message, toastOptions);
          break;
        default:
          toast.info(notification.message, toastOptions);
      }

      // Play notification sound if available
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/logo.png',
          tag: notification.id,
        });
      }
    });

    // Loan update events
    newSocket.on('loan:statusUpdate', (update) => {
      console.log('Loan status update:', update);
      // You can dispatch an action to update the loan in your state management
      toast.info(`Loan ${update.loanId} status changed to ${update.status}`, {
        autoClose: 4000,
      });
    });

    newSocket.on('loan:paymentReminder', (reminder) => {
      console.log('Payment reminder:', reminder);
      toast.error(
        `Payment of $${reminder.amount} due in ${reminder.daysUntilDue} days for loan ${reminder.loanId}`,
        { autoClose: 6000 }
      );
    });

    // Analytics events
    newSocket.on('analytics:subscribed', (data) => {
      console.log('Subscribed to analytics:', data);
    });

    newSocket.on('analytics:update', (data) => {
      console.log('Analytics update:', data);
      // Dispatch to your analytics state management
    });

    // System broadcasts
    newSocket.on('system:broadcast', (message) => {
      console.log('System broadcast:', message);
      toast(message.message, {
        duration: 10000,
        icon: message.severity === 'warning' ? '⚠️' : 'ℹ️',
      });
    });

    // Notification read confirmation
    newSocket.on('notification:read', (data) => {
      setNotifications(prev =>
        prev.map(n =>
          n.id === data.notificationId
            ? { ...n, read: true }
            : n
        )
      );
    });

    // Error handling
    newSocket.on('error', (error) => {
      console.error('WebSocket error:', error);
      toast.error(error.message || 'WebSocket error occurred');
    });

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      console.log('Cleaning up WebSocket connection');
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [token, user]);

  const markNotificationAsRead = useCallback((notificationId: string) => {
    if (!socket?.connected) return;

    socket.emit('notification:markRead', { notificationId });
    
    // Optimistically update UI
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  }, [socket]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const subscribeToAnalytics = useCallback((metrics: string[]) => {
    if (!socket?.connected) return;
    socket.emit('analytics:subscribe', { metrics });
  }, [socket]);

  const unsubscribeFromAnalytics = useCallback(() => {
    if (!socket?.connected) return;
    socket.emit('analytics:unsubscribe');
  }, [socket]);

  const value: WebSocketContextType = {
    socket,
    connected,
    notifications,
    unreadCount,
    markNotificationAsRead,
    clearNotifications,
    subscribeToAnalytics,
    unsubscribeFromAnalytics,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
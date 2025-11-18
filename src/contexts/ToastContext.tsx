import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Toast, { ToastMessage, ToastType } from '../components/Toast';

interface ToastContextType {
  showToast: (title: string, message?: string, type?: ToastType, duration?: number) => void;
  showSuccess: (title: string, message?: string, duration?: number) => void;
  showError: (title: string, message?: string, duration?: number) => void;
  showInfo: (title: string, message?: string, duration?: number) => void;
  showWarning: (title: string, message?: string, duration?: number) => void;
  alert: (title: string, message?: string, buttons?: Array<{ text: string; onPress?: () => void }>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (title: string, message?: string, type: ToastType = 'info', duration?: number) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: ToastMessage = {
        id,
        title,
        message,
        type,
        duration,
      };
      setToasts((prev) => [...prev, newToast]);
    },
    []
  );

  const showSuccess = useCallback(
    (title: string, message?: string, duration?: number) => {
      showToast(title, message, 'success', duration);
    },
    [showToast]
  );

  const showError = useCallback(
    (title: string, message?: string, duration?: number) => {
      showToast(title, message, 'error', duration);
    },
    [showToast]
  );

  const showInfo = useCallback(
    (title: string, message?: string, duration?: number) => {
      showToast(title, message, 'info', duration);
    },
    [showToast]
  );

  const showWarning = useCallback(
    (title: string, message?: string, duration?: number) => {
      showToast(title, message, 'warning', duration);
    },
    [showToast]
  );

  // Alert-like function that shows a toast (for compatibility with Alert.alert)
  const alert = useCallback(
    (title: string, message?: string, buttons?: Array<{ text: string; onPress?: () => void }>) => {
      // Show as error toast by default, or info if no message suggests error
      const type: ToastType = title.toLowerCase().includes('error') || 
                             title.toLowerCase().includes('failed') ||
                             title.toLowerCase().includes('wrong') ||
                             title.toLowerCase().includes('invalid')
        ? 'error'
        : 'info';
      
      showToast(title, message, type, 5000);
      
      // If there's a button with onPress, we can't handle it with toast
      // But we'll show the toast anyway
      if (buttons && buttons.length > 0) {
        const primaryButton = buttons.find(b => b.text.toLowerCase() !== 'cancel');
        if (primaryButton?.onPress) {
          // For now, we'll just show the toast
          // In a more advanced implementation, we could show a modal
        }
      }
    },
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showInfo,
        showWarning,
        alert,
      }}
    >
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    pointerEvents: 'box-none',
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
    }),
  },
});


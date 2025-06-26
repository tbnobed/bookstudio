import { createContext, useContext, useState, ReactNode } from "react";
import { NotificationModal, NotificationType } from "@/components/ui/notification-modal";

interface NotificationData {
  type: NotificationType;
  title: string;
  message: string;
  details?: string;
}

interface NotificationContextType {
  showNotification: (data: NotificationData) => void;
  showSuccess: (title: string, message: string, details?: string) => void;
  showError: (title: string, message: string, details?: string) => void;
  showWarning: (title: string, message: string, details?: string) => void;
  showInfo: (title: string, message: string, details?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const showNotification = (data: NotificationData) => {
    setNotification(data);
    setIsOpen(true);
  };

  const showSuccess = (title: string, message: string, details?: string) => {
    showNotification({ type: 'success', title, message, details });
  };

  const showError = (title: string, message: string, details?: string) => {
    showNotification({ type: 'error', title, message, details });
  };

  const showWarning = (title: string, message: string, details?: string) => {
    showNotification({ type: 'warning', title, message, details });
  };

  const showInfo = (title: string, message: string, details?: string) => {
    showNotification({ type: 'info', title, message, details });
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => setNotification(null), 300); // Allow modal to close animation
  };

  return (
    <NotificationContext.Provider value={{
      showNotification,
      showSuccess,
      showError,
      showWarning,
      showInfo
    }}>
      {children}
      {notification && (
        <NotificationModal
          isOpen={isOpen}
          onClose={handleClose}
          type={notification.type}
          title={notification.title}
          message={notification.message}
          details={notification.details}
        />
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
}
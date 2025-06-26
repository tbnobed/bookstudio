import { AlertCircle, CheckCircle, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: NotificationType;
  title: string;
  message: string;
  details?: string;
}

const notificationConfig = {
  success: {
    icon: CheckCircle,
    iconColor: "text-green-500",
    borderColor: "border-green-200",
    bgColor: "bg-green-50",
    titleColor: "text-green-800",
    messageColor: "text-green-700"
  },
  error: {
    icon: XCircle,
    iconColor: "text-red-500",
    borderColor: "border-red-200",
    bgColor: "bg-red-50",
    titleColor: "text-red-800",
    messageColor: "text-red-700"
  },
  warning: {
    icon: AlertCircle,
    iconColor: "text-yellow-500",
    borderColor: "border-yellow-200",
    bgColor: "bg-yellow-50",
    titleColor: "text-yellow-800",
    messageColor: "text-yellow-700"
  },
  info: {
    icon: AlertCircle,
    iconColor: "text-blue-500",
    borderColor: "border-blue-200",
    bgColor: "bg-blue-50",
    titleColor: "text-blue-800",
    messageColor: "text-blue-700"
  }
};

export function NotificationModal({ 
  isOpen, 
  onClose, 
  type, 
  title, 
  message, 
  details 
}: NotificationModalProps) {
  const config = notificationConfig[type];
  const IconComponent = config.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`sm:max-w-md ${config.borderColor} ${config.bgColor} border-2`}>
        <DialogHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <IconComponent className={`h-6 w-6 ${config.iconColor}`} />
              <DialogTitle className={`text-lg font-semibold ${config.titleColor}`}>
                {title}
              </DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0 hover:bg-transparent"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-3">
          <p className={`text-sm leading-relaxed ${config.messageColor}`}>
            {message}
          </p>
          
          {details && (
            <div className={`p-3 rounded-md bg-white/60 border ${config.borderColor}`}>
              <p className={`text-xs font-mono ${config.messageColor} opacity-90`}>
                {details}
              </p>
            </div>
          )}
          
          <div className="flex justify-end pt-2">
            <Button
              onClick={onClose}
              variant="default"
              size="sm"
              className="min-w-20"
            >
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
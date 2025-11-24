import { toast as sonnerToast } from 'sonner-native';

type ToastOptions = NonNullable<Parameters<typeof sonnerToast>[1]>;

// Standard configuration for consistency
const DEFAULT_DURATION = 3000;

type ToastType = 'success' | 'error' | 'info' | 'default';

const showToast = (message: string, type: ToastType = 'default', options?: ToastOptions) => {
  const baseOptions: ToastOptions = {
    duration: DEFAULT_DURATION,
    ...options,
  };

  switch (type) {
    case 'success':
      sonnerToast.success(message, baseOptions);
      break;
    case 'error':
      sonnerToast.error(message, baseOptions);
      break;
    case 'info':
      sonnerToast.info(message, baseOptions);
      break;
    default:
      sonnerToast(message, baseOptions);
      break;
  }
};

export const Toast = {
  success: (message: string, options?: ToastOptions) => showToast(message, 'success', options),
  error: (message: string, options?: ToastOptions) => showToast(message, 'error', options),
  info: (message: string, options?: ToastOptions) => showToast(message, 'info', options),
  show: (message: string, options?: ToastOptions) => showToast(message, 'default', options),
};


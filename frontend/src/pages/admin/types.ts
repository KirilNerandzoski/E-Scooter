export interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  action: () => void | Promise<void>;
}

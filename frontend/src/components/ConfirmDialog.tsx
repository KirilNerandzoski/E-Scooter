import { AlertTriangle, X } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal labelledBy="confirm-dialog-title" maxWidthClass="max-w-md" onClose={onCancel}>
      <div className="flex items-start justify-between rounded-t-lg border-b border-[#DDE2E8] bg-white px-6 py-4">
        <div className="flex items-center gap-2.5">
          {destructive && <AlertTriangle className="h-4 w-4 text-[#822020]" />}
          <h2 id="confirm-dialog-title" className="font-display text-xl font-medium text-[#0A1A33]">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close confirmation dialog"
          className="rounded border border-[#DDE2E8] p-1 text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-5 p-6">
        <p className="text-sm leading-relaxed text-[#515F73]">{description}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-[#DDE2E8] bg-white px-4 py-2 text-xs font-medium tracking-[0.12em] text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33]"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded px-4 py-2 text-xs font-medium tracking-[0.12em] text-white transition-colors ${
              destructive
                ? 'bg-[#822020] hover:bg-[#6B1A1A]'
                : 'bg-[#0A1A33] hover:bg-[#1E2D4A]'
            }`}
          >
            {confirmLabel.toUpperCase()}
          </button>
        </div>
      </div>
    </Modal>
  );
}

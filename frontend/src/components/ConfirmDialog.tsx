import { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
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
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      role="alertdialog"
      labelledBy="confirm-dialog-title"
      describedBy="confirm-dialog-desc"
      maxWidthClass="max-w-md"
      onClose={() => {
        if (!submitting) onCancel();
      }}
    >
      <div className="flex items-start justify-between gap-3 rounded-t-lg border-b border-[#DDE2E8] bg-white px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          {destructive && <AlertTriangle className="h-4 w-4 shrink-0 text-[#822020]" />}
          <h2
            id="confirm-dialog-title"
            className="font-display text-lg font-medium text-[#0A1A33] sm:text-xl"
          >
            {title}
          </h2>
        </div>
        <button
          type="button"
          disabled={submitting}
          onClick={onCancel}
          aria-label="Close confirmation dialog"
          className="rounded border border-[#DDE2E8] p-1.5 text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33] disabled:opacity-45"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-5 p-4 sm:p-6">
        <p id="confirm-dialog-desc" className="text-sm leading-relaxed text-[#515F73]">
          {description}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="min-h-[42px] rounded border border-[#DDE2E8] bg-white px-4 py-2 text-xs font-medium tracking-[0.12em] text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33] disabled:opacity-45"
          >
            CANCEL
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleConfirm()}
            className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded px-4 py-2 text-xs font-medium tracking-[0.12em] text-white transition-colors disabled:opacity-50 ${
              destructive
                ? 'bg-[#822020] hover:bg-[#6B1A1A]'
                : 'bg-[#0A1A33] hover:bg-[#1E2D4A]'
            }`}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? 'WORKING...' : confirmLabel.toUpperCase()}
          </button>
        </div>
      </div>
    </Modal>
  );
}

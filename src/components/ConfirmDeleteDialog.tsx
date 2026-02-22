import { useState } from 'react';

interface Props {
  itemLabel: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDeleteDialog({ itemLabel, onConfirm, onCancel }: Props) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
        <h3>Delete {itemLabel}?</h3>
        <p style={{ margin: '12px 0', color: '#666', fontSize: 13 }}>
          This will permanently delete {itemLabel} and all related records. This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
          <button className="reject-btn" onClick={onCancel} disabled={deleting}>Cancel</button>
          <button className="delete-btn" onClick={handleConfirm} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { BookedTest } from '../App';
import ConfirmDeleteDialog from './ConfirmDeleteDialog';

interface Props {
  bookings: BookedTest[];
  onSelect: (b: BookedTest) => void;
  onDeleted: () => void;
}

export default function ApprovedBookings({ bookings, onSelect, onDeleted }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Sort by booking date (newest first)
  const sortedBookings = [...bookings].sort((a, b) => {
    const da = a.booking_details?.date || '';
    const db = b.booking_details?.date || '';
    return db.localeCompare(da);
  });

  if (sortedBookings.length === 0) {
    return <p className="center">No approved bookings found.</p>;
  }

  return (
    <div className="approved-section">
      <div className="grid">
        {sortedBookings.map(b => (
          <div key={b.id} className="card" onClick={() => onSelect(b)}>
            <button className="card-delete-btn" onClick={(e) => { e.stopPropagation(); setDeleteTarget(b.id); }}>Delete</button>
            <div className="card-header">
              <span className="name">User {b.user_id.slice(0, 6)}</span>
              <div className="card-badges">
                {b.has_postponed && <span className="badge blue">Rescheduled</span>}
                <span className={`badge ${b.hasResults ? 'green' : 'orange'}`}>
                  {b.hasResults ? 'Results Uploaded' : 'Awaiting Results'}
                </span>
              </div>
            </div>
            <div className="card-body">
              <p><strong>User ID:</strong> {b.user_id.slice(0, 8)}...</p>
              <p><strong>Sex:</strong> {b.profile?.biological_sex || '—'} | <strong>DOB:</strong> {b.profile?.date_of_birth || '—'}</p>
              <p><strong>Date:</strong> {b.booking_details?.date || '—'} | <strong>Time:</strong> {b.booking_details?.time || '—'}</p>
              {b.has_postponed && b.booking_details?.previous_date && (
                <p className="previous-booking"><strong>Previously:</strong> {b.booking_details.previous_date} at {b.booking_details.previous_time || '—'}</p>
              )}
              <p><strong>Package:</strong> {b.booking_details?.package?.includes("'s") ? 'Personalized Package' : (b.booking_details?.package || '—')}</p>
              {b.booking_details?.biomarkers && b.booking_details.biomarkers.length > 0 && (
                <p className="biomarkers"><strong>Biomarkers:</strong> {b.booking_details.biomarkers.join(', ')}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {deleteTarget && (
        <ConfirmDeleteDialog
          itemLabel="this booking"
          onConfirm={async () => {
            const res = await fetch('/api/delete-booking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ booking_id: deleteTarget }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            setDeleteTarget(null);
            onDeleted();
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

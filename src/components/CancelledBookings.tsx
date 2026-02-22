import { useState } from 'react';
import { CancelledBooking } from '../App';
import ConfirmDeleteDialog from './ConfirmDeleteDialog';

interface Props {
  bookings: CancelledBooking[];
  onDeleted: () => void;
}

export default function CancelledBookings({ bookings, onDeleted }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  if (bookings.length === 0) {
    return <p className="center">No cancelled bookings.</p>;
  }

  return (
    <div className="cancelled-section">
      <div className="grid">
        {bookings.map(b => (
          <div key={b.id} className="card cancelled-card">
            <button className="card-delete-btn" onClick={() => setDeleteTarget(b.id)}>Delete</button>
            <div className="card-header">
              <span className="name">User {b.user_id.slice(0, 6)}</span>
              <span className="badge red">Cancelled</span>
            </div>
            <div className="card-body">
              <p><strong>User ID:</strong> {b.user_id.slice(0, 8)}...</p>
              <p><strong>Package:</strong> {b.booking_details?.package?.includes("'s") ? 'Personalized Package' : (b.booking_details?.package || '—')}</p>
              <p><strong>Date:</strong> {b.booking_details?.date || '—'} | <strong>Time:</strong> {b.booking_details?.time || '—'}</p>
              <p><strong>Location:</strong> {b.booking_details?.location || '—'}</p>
              {b.booking_details?.cancelled_at && (
                <p className="cancelled-at"><strong>Cancelled:</strong> {new Date(b.booking_details.cancelled_at).toLocaleString()}</p>
              )}
              <p className="booking-time"><strong>Originally booked:</strong> {new Date(b.booking_time).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
      {deleteTarget && (
        <ConfirmDeleteDialog
          itemLabel="this cancelled booking"
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

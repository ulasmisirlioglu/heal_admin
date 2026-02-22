import { useState } from 'react';
import { getAuthHeaders } from '../supabaseClient';
import ConfirmDeleteDialog from './ConfirmDeleteDialog';

interface PendingBooking {
  id: string;
  user_id: string;
  booking_details: {
    package?: string;
    location?: string;
    date?: string;
    time?: string;
    previous_date?: string;
    previous_time?: string;
    postponed_at?: string;
  };
  has_postponed?: boolean;
  booking_time: string;
  profile: {
    name: string;
  } | null;
}

interface Props {
  bookings: PendingBooking[];
  onApproved: () => void;
  onRejected: () => void;
}

const B2C_API_URL = import.meta.env.VITE_B2C_API_URL;

export default function PendingBookings({ bookings, onApproved, onRejected }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleApprove = async (bookingId: string) => {
    setLoading(bookingId);
    setMessage('');
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${B2C_API_URL}/api/approve-booking`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ booking_id: bookingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');
      setMessage('Booking approved and email sent!');
      onApproved();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    setLoading(bookingId);
    setMessage('');
    try {
      const res = await fetch('/api/reject-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rejection failed');
      setMessage('Booking rejected.');
      onRejected();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  if (bookings.length === 0) {
    return <p className="center">No pending bookings.</p>;
  }

  return (
    <div className="pending-section">
      {message && <p className={message.startsWith('Error') ? 'error' : 'success'}>{message}</p>}
      <div className="pending-grid">
        {bookings.map(b => (
          <div key={b.id} className={`pending-card${b.has_postponed ? ' pending-card-rescheduled' : ''}`}>
            <div className="pending-info">
              <div className="pending-info-header">
                <p><strong>User:</strong> User {b.user_id.slice(0, 6)}</p>
                {b.has_postponed && <span className="badge blue">Rescheduled</span>}
              </div>
              <p><strong>Package:</strong> {b.booking_details?.package?.includes("'s") ? 'Personalized Package' : (b.booking_details?.package || '—')}</p>
              <p><strong>Date:</strong> {b.booking_details?.date || '—'} at {b.booking_details?.time || '—'}</p>
              {b.has_postponed && b.booking_details?.previous_date && (
                <p className="previous-booking"><strong>Previously:</strong> {b.booking_details.previous_date} at {b.booking_details.previous_time || '—'}</p>
              )}
              <p><strong>Location:</strong> {b.booking_details?.location || '—'}</p>
              {b.has_postponed && b.booking_details?.postponed_at && (
                <p className="booking-time"><strong>Rescheduled:</strong> {new Date(b.booking_details.postponed_at).toLocaleString()}</p>
              )}
              <p className="booking-time"><strong>Booked:</strong> {new Date(b.booking_time).toLocaleString()}</p>
            </div>
            <div className="pending-actions">
              <button
                className="approve-btn"
                onClick={() => handleApprove(b.id)}
                disabled={loading === b.id}
              >
                {loading === b.id ? 'Processing...' : 'Approve'}
              </button>
              <button
                className="reject-btn"
                onClick={() => handleReject(b.id)}
                disabled={loading === b.id}
              >
                Reject
              </button>
              <button
                className="delete-btn"
                onClick={() => setDeleteTarget(b.id)}
                disabled={loading === b.id}
              >
                Delete
              </button>
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
            onRejected();
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

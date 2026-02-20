import { CancelledBooking } from '../App';

interface Props {
  bookings: CancelledBooking[];
}

export default function CancelledBookings({ bookings }: Props) {
  if (bookings.length === 0) {
    return <p className="center">No cancelled bookings.</p>;
  }

  return (
    <div className="cancelled-section">
      <div className="grid">
        {bookings.map(b => (
          <div key={b.id} className="card cancelled-card">
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
    </div>
  );
}

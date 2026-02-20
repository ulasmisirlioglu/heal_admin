import { BookedTest } from '../App';

interface Props {
  bookings: BookedTest[];
  onSelect: (b: BookedTest) => void;
}

export default function BookedTestsList({ bookings, onSelect }: Props) {
  if (bookings.length === 0) return <p className="center">No bookings found.</p>;

  return (
    <div className="grid">
      {bookings.map(b => (
        <div key={b.id} className="card" onClick={() => onSelect(b)}>
          <div className="card-header">
            <span className="name">User {b.user_id.slice(0, 6)}</span>
            <span className={`badge ${b.hasResults ? 'green' : 'orange'}`}>
              {b.hasResults ? 'Results Uploaded' : 'Awaiting Results'}
            </span>
          </div>
          <div className="card-body">
            <p><strong>User ID:</strong> {b.user_id.slice(0, 8)}...</p>
            <p><strong>Sex:</strong> {b.profile?.biological_sex || '—'} | <strong>DOB:</strong> {b.profile?.date_of_birth || '—'}</p>
            <p><strong>Date:</strong> {b.booking_details?.date || '—'} | <strong>Time:</strong> {b.booking_details?.time || '—'}</p>
            <p><strong>Package:</strong> {b.booking_details?.package?.includes("'s") ? 'Personalized Package' : (b.booking_details?.package || '—')} | <strong>Step:</strong> {b.current_step}</p>
            {b.booking_details?.biomarkers && b.booking_details.biomarkers.length > 0 && (
              <p className="biomarkers"><strong>Biomarkers:</strong> {b.booking_details.biomarkers.join(', ')}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

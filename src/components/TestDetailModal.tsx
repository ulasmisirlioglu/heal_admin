import { useState, useRef } from 'react';
import { getAuthHeaders } from '../supabaseClient';
import { BookedTest } from '../App';

interface Props {
  booking: BookedTest;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TestDetailModal({ booking, onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const b = booking;

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setMessage('');

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/analyze-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: base64,
          fileName: file.name,
          mimeType: file.type,
          userId: b.user_id,
          testDate: b.booking_details?.date,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setMessage(`Success! ${data.biomarkersCount} biomarkers extracted. Generating content...`);

      // Call generate-content endpoint
      const authHeaders = await getAuthHeaders();
      const genRes = await fetch(`${import.meta.env.VITE_B2C_API_URL}/api/admin/generate-content`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          test_result_id: data.testResultId,
          user_id: b.user_id,
        }),
      });

      if (genRes.ok) {
        setMessage(`Success! ${data.biomarkersCount} biomarkers extracted. Content generated and pending approval.`);
      } else {
        const genData = await genRes.json();
        setMessage(`Biomarkers extracted but content generation failed: ${genData.error || 'Unknown error'}`);
      }

      setTimeout(onSuccess, 2000);
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>User {b.user_id.slice(0, 6)}</h2>

        <table className="detail-table">
          <tbody>
            <tr><td>User ID</td><td>{b.user_id}</td></tr>
            <tr><td>Sex</td><td>{b.profile?.biological_sex || '—'}</td></tr>
            <tr><td>Date of Birth</td><td>{b.profile?.date_of_birth || '—'}</td></tr>
            <tr><td>Package</td><td>{b.booking_details?.package?.includes("'s") ? 'Personalized Package' : (b.booking_details?.package || '—')}</td></tr>
            <tr><td>Test Date</td><td>{b.booking_details?.date || '—'}</td></tr>
            <tr><td>Time</td><td>{b.booking_details?.time || '—'}</td></tr>
            <tr><td>Location</td><td>{b.booking_details?.location || '—'}</td></tr>
            <tr><td>Method</td><td>{b.booking_details?.method || '—'}</td></tr>
            <tr><td>Price</td><td>{b.booking_details?.price ? `€${b.booking_details.price}` : '—'}</td></tr>
            <tr><td>Notes</td><td>{b.booking_details?.notes || '—'}</td></tr>
            <tr><td>Status</td><td><span className={`badge ${b.hasResults ? 'green' : 'orange'}`}>{b.hasResults ? 'Results Uploaded' : 'Awaiting Results'}</span></td></tr>
          </tbody>
        </table>

        {b.booking_details?.biomarkers && b.booking_details.biomarkers.length > 0 && (
          <div className="biomarker-list">
            <strong>Biomarkers:</strong>
            <ul>{b.booking_details.biomarkers.map((bm, i) => <li key={i}>{bm}</li>)}</ul>
          </div>
        )}

        <hr />
        <h3>Upload PDF Results</h3>
        <div className="upload-area">
          <input ref={inputRef} type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
          <button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? 'Analyzing...' : 'Upload & Analyze'}
          </button>
        </div>
        {message && <p className={message.startsWith('Error') ? 'error' : 'success'}>{message}</p>}
      </div>
    </div>
  );
}

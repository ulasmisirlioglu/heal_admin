import { useState, useEffect } from 'react';
import { getAuthHeaders } from '../supabaseClient';


interface PendingContent {
  test_result: {
    id: string;
    user_id: string;
    test_date: string;
    results: Record<string, any>;
    file_url: string;
    created_at: string;
  };
  user: {
    name: string;
    email: string;
  };
  action_plan: {
    id: string;
    plan_data: any;
  } | null;
  summary: {
    id: string;
    summary_text: string;
  } | null;
  daily_objectives: {
    id: string;
    objectives: any;
  } | null;
}

interface Props {
  onApproved: () => void;
}

export default function PendingApprovals({ onApproved }: Props) {
  const [pendingContent, setPendingContent] = useState<PendingContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedContent, setSelectedContent] = useState<PendingContent | null>(null);
  const [editedSummary, setEditedSummary] = useState('');
  const [editedActionPlan, setEditedActionPlan] = useState('');
  const [editedObjectives, setEditedObjectives] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchPendingContent = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/pending-content`);
      if (!res.ok) throw new Error('Failed to fetch pending content');
      const data = await res.json();
      setPendingContent(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Failed to fetch pending content:', e.message);
      setError(e.message);
      setPendingContent([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingContent();
  }, []);

  const openReview = (content: PendingContent) => {
    setSelectedContent(content);
    setEditedSummary(content.summary?.summary_text || '');
    setEditedActionPlan(content.action_plan?.plan_data ? JSON.stringify(content.action_plan.plan_data, null, 2) : '');
    setEditedObjectives(content.daily_objectives?.objectives ? JSON.stringify(content.daily_objectives.objectives, null, 2) : '');
    setMessage('');
  };

  const handleSaveEdits = async () => {
    if (!selectedContent) return;
    setSaving(true);
    setMessage('');

    try {
      let parsedActionPlan, parsedObjectives;
      try {
        parsedActionPlan = editedActionPlan ? JSON.parse(editedActionPlan) : undefined;
      } catch { throw new Error('Invalid JSON in Action Plan'); }
      try {
        parsedObjectives = editedObjectives ? JSON.parse(editedObjectives) : undefined;
      } catch { throw new Error('Invalid JSON in Daily Objectives'); }

      // Use B2C backend for content updates
      const updateHeaders = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_B2C_API_URL}/api/admin/update-content`, {
        method: 'PATCH',
        headers: updateHeaders,
        body: JSON.stringify({
          test_result_id: selectedContent.test_result.id,
          summary: editedSummary || undefined,
          action_plan: parsedActionPlan,
          daily_objectives: parsedObjectives,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setMessage('Edits saved successfully!');
      fetchPendingContent();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedContent) return;
    setSaving(true);
    setMessage('');

    try {
      // Use B2C backend for approval (sends email notification)
      const approveHeaders = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_B2C_API_URL}/api/admin/approve-content`, {
        method: 'POST',
        headers: approveHeaders,
        body: JSON.stringify({ test_result_id: selectedContent.test_result.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve');
      }

      setMessage('Content approved! User has been notified via email.');
      setSelectedContent(null);
      fetchPendingContent();
      onApproved();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="center">Loading pending results...</p>;
  if (error) return <p className="center error">{error}</p>;
  if (pendingContent.length === 0) return <p className="center">No pending results.</p>;

  const biomarkerCount = (results: Record<string, any>) => Object.keys(results || {}).length;

  return (
    <div className="approvals-section">
      <div className="approvals-grid">
        {pendingContent.map(pc => (
          <div key={pc.test_result.id} className="approval-card" onClick={() => openReview(pc)}>
            <p><strong>User:</strong> User {pc.test_result.user_id.slice(0, 6)}</p>
            <p><strong>Test Date:</strong> {pc.test_result.test_date}</p>
            <p><strong>Biomarkers:</strong> {biomarkerCount(pc.test_result.results)}</p>
            <p className="booking-time"><strong>Created:</strong> {new Date(pc.test_result.created_at).toLocaleString()}</p>
            <button className="review-btn">Review Content</button>
          </div>
        ))}
      </div>

      {selectedContent && (
        <div className="modal-overlay" onClick={() => setSelectedContent(null)}>
          <div className="modal review-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedContent(null)}>&times;</button>
            <h2>Review Content - User {selectedContent.test_result.user_id.slice(0, 6)}</h2>

            <div className="review-section">
              <h3>Test Info</h3>
              <p><strong>Test Date:</strong> {selectedContent.test_result.test_date}</p>
              <p><strong>Biomarkers:</strong> {biomarkerCount(selectedContent.test_result.results)}</p>
            </div>

            <div className="review-section">
              <h3>Extracted Biomarker Results</h3>
              <div className="biomarker-results-table">
                <table>
                  <thead>
                    <tr>
                      <th>Biomarker</th>
                      <th>Value</th>
                      <th>Range</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(selectedContent.test_result.results || {}).map(([name, data]: [string, any]) => (
                      <tr key={name} className={data.status === 'in-range' ? '' : 'flagged'}>
                        <td>{name}</td>
                        <td>{data.value} {data.unit || ''}</td>
                        <td>{data.reference_range || data.referenceRange || '—'}</td>
                        <td className={`status-${data.status === 'in-range' ? 'normal' : 'out-of-range'}`}>
                          {data.status === 'in-range' ? 'Normal' : data.status === 'out-of-range' ? 'Out of Range' : (data.status || '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="review-section">
              <h3>Summary</h3>
              <textarea
                value={editedSummary}
                onChange={e => setEditedSummary(e.target.value)}
                rows={6}
                placeholder="No summary generated"
              />
            </div>

            <div className="review-section">
              <h3>Action Plan (JSON)</h3>
              <textarea
                value={editedActionPlan}
                onChange={e => setEditedActionPlan(e.target.value)}
                rows={12}
                placeholder="No action plan generated"
              />
            </div>

            <div className="review-section">
              <h3>Daily Objectives (JSON)</h3>
              <textarea
                value={editedObjectives}
                onChange={e => setEditedObjectives(e.target.value)}
                rows={12}
                placeholder="No daily objectives generated"
              />
            </div>

            {message && <p className={message.startsWith('Error') ? 'error' : 'success'}>{message}</p>}

            <div className="review-actions">
              <button className="save-btn" onClick={handleSaveEdits} disabled={saving}>
                {saving ? 'Saving...' : 'Save Edits'}
              </button>
              <button className="approve-btn" onClick={handleApprove} disabled={saving}>
                {saving ? 'Processing...' : 'Approve Content'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

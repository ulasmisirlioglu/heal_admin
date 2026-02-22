import { useState, useEffect } from 'react';
import { getAuthHeaders } from '../supabaseClient';
import ConfirmDeleteDialog from './ConfirmDeleteDialog';


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
  const [editedBiomarkers, setEditedBiomarkers] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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
    setEditedBiomarkers(JSON.parse(JSON.stringify(content.test_result.results || {})));
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

      // Update biomarker results via local admin backend
      const bioRes = await fetch('/api/update-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_result_id: selectedContent.test_result.id,
          biomarker_results: editedBiomarkers,
        }),
      });

      if (!bioRes.ok) {
        const bioData = await bioRes.json();
        throw new Error(bioData.error || 'Failed to save biomarker edits');
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
            <button className="card-delete-btn" onClick={(e) => { e.stopPropagation(); setDeleteTarget(pc.test_result.id); }}>Delete</button>
            <p><strong>User:</strong> User {pc.test_result.user_id.slice(0, 6)}</p>
            <p><strong>Test Date:</strong> {pc.test_result.test_date}</p>
            <p><strong>Biomarkers:</strong> {biomarkerCount(pc.test_result.results)}</p>
            <p className="booking-time"><strong>Created:</strong> {new Date(pc.test_result.created_at).toLocaleString()}</p>
            <button className="review-btn">Review Content</button>
          </div>
        ))}
      </div>

      {deleteTarget && (
        <ConfirmDeleteDialog
          itemLabel="this test result"
          onConfirm={async () => {
            const res = await fetch('/api/delete-test-result', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ test_result_id: deleteTarget }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            setDeleteTarget(null);
            fetchPendingContent();
            onApproved();
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {selectedContent && (
        <div className="modal-overlay" onClick={() => setSelectedContent(null)}>
          <div className="modal review-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedContent(null)}>&times;</button>
            <h2>Review Content - User {selectedContent.test_result.user_id.slice(0, 6)}</h2>

            <div className="review-section">
              <h3>Test Info</h3>
              <p><strong>Test Date:</strong> {selectedContent.test_result.test_date}</p>
              <p><strong>Biomarkers:</strong> {Object.keys(editedBiomarkers).length}</p>
            </div>

            <div className="review-section">
              <h3>Extracted Biomarker Results</h3>
              <div className="biomarker-results-table">
                <table>
                  <thead>
                    <tr>
                      <th>Biomarker</th>
                      <th>Value</th>
                      <th>Unit</th>
                      <th>Range</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(editedBiomarkers).map(([name, data]: [string, any]) => (
                      <tr key={name} className={data.status === 'in-range' ? '' : 'flagged'}>
                        <td>{name}</td>
                        <td>
                          <input
                            type="number"
                            className="bio-input bio-input-value"
                            value={data.value ?? ''}
                            onChange={e => setEditedBiomarkers(prev => ({
                              ...prev,
                              [name]: { ...prev[name], value: e.target.value === '' ? '' : Number(e.target.value) }
                            }))}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="bio-input bio-input-unit"
                            value={data.unit || ''}
                            onChange={e => setEditedBiomarkers(prev => ({
                              ...prev,
                              [name]: { ...prev[name], unit: e.target.value }
                            }))}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="bio-input bio-input-range"
                            value={data.reference_range || data.referenceRange || ''}
                            onChange={e => setEditedBiomarkers(prev => ({
                              ...prev,
                              [name]: { ...prev[name], reference_range: e.target.value }
                            }))}
                          />
                        </td>
                        <td>
                          <select
                            className="bio-input bio-input-status"
                            value={data.status || ''}
                            onChange={e => setEditedBiomarkers(prev => ({
                              ...prev,
                              [name]: { ...prev[name], status: e.target.value }
                            }))}
                          >
                            <option value="in-range">Normal</option>
                            <option value="out-of-range">Out of Range</option>
                            <option value="borderline">Borderline</option>
                          </select>
                        </td>
                        <td>
                          <button
                            className="bio-delete-btn"
                            title="Remove biomarker"
                            onClick={() => setEditedBiomarkers(prev => {
                              const next = { ...prev };
                              delete next[name];
                              return next;
                            })}
                          >&times;</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="bio-add-btn"
                onClick={() => {
                  const newName = prompt('Biomarker name:');
                  if (newName && newName.trim() && !editedBiomarkers[newName.trim()]) {
                    setEditedBiomarkers(prev => ({
                      ...prev,
                      [newName.trim()]: { value: 0, unit: '', reference_range: '', status: 'in-range', system: '', explanation: '' }
                    }));
                  }
                }}
              >+ Add Biomarker</button>
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

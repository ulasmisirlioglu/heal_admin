import { useState, useEffect } from 'react';

interface ApprovedContent {
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

export default function ApprovedResults() {
  const [approvedContent, setApprovedContent] = useState<ApprovedContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedContent, setSelectedContent] = useState<ApprovedContent | null>(null);

  const fetchApprovedContent = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/approved-content`);
      if (!res.ok) throw new Error('Failed to fetch approved content');
      const data = await res.json();
      setApprovedContent(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Failed to fetch approved content:', e.message);
      setError(e.message);
      setApprovedContent([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedContent();
  }, []);

  const biomarkerCount = (results: Record<string, any>) => Object.keys(results || {}).length;

  if (loading) return <p className="center">Loading approved results...</p>;
  if (error) return <p className="center error">{error}</p>;
  if (approvedContent.length === 0) return <p className="center">No approved results found.</p>;

  return (
    <div className="approved-results-section">
      <div className="approvals-grid">
        {approvedContent.map(pc => (
          <div key={pc.test_result.id} className="approval-card approved" onClick={() => setSelectedContent(pc)}>
            <p><strong>User:</strong> User {pc.test_result.user_id.slice(0, 6)}</p>
            <p><strong>Test Date:</strong> {pc.test_result.test_date}</p>
            <p><strong>Biomarkers:</strong> {biomarkerCount(pc.test_result.results)}</p>
            <p className="booking-time"><strong>Created:</strong> {new Date(pc.test_result.created_at).toLocaleString()}</p>
            <span className="badge green">Approved</span>
          </div>
        ))}
      </div>

      {selectedContent && (
        <div className="modal-overlay" onClick={() => setSelectedContent(null)}>
          <div className="modal review-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedContent(null)}>&times;</button>
            <h2>Approved Result - User {selectedContent.test_result.user_id.slice(0, 6)}</h2>

            <div className="review-section">
              <h3>Test Info</h3>
              <p><strong>Test Date:</strong> {selectedContent.test_result.test_date}</p>
              <p><strong>Biomarkers:</strong> {biomarkerCount(selectedContent.test_result.results)}</p>
            </div>

            <div className="review-section">
              <h3>Biomarker Results</h3>
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

            {selectedContent.summary && (
              <div className="review-section">
                <h3>Summary</h3>
                <div className="content-preview">{selectedContent.summary.summary_text}</div>
              </div>
            )}

            {selectedContent.action_plan && (
              <div className="review-section">
                <h3>Action Plan</h3>
                <pre className="content-preview">{JSON.stringify(selectedContent.action_plan.plan_data, null, 2)}</pre>
              </div>
            )}

            {selectedContent.daily_objectives && (
              <div className="review-section">
                <h3>Daily Objectives</h3>
                <pre className="content-preview">{JSON.stringify(selectedContent.daily_objectives.objectives, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
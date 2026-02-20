import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';
import Login from './components/Login';
import TestDetailModal from './components/TestDetailModal';
import PendingBookings from './components/PendingBookings';
import PendingApprovals from './components/PendingApprovals';
import ApprovedBookings from './components/ApprovedBookings';
import ApprovedResults from './components/ApprovedResults';
import CancelledBookings from './components/CancelledBookings';

export interface BookedTest {
  id: string;
  user_id: string;
  booking_details: {
    package?: string;
    location?: string;
    date?: string;
    time?: string;
    method?: string;
    price?: number;
    biomarkers?: string[];
    notes?: string;
    previous_date?: string;
    previous_time?: string;
    postponed_at?: string;
    cancelled_at?: string;
  };
  booking_time: string;
  current_step: number;
  created_at: string;
  updated_at: string;
  has_postponed?: boolean;
  profile: {
    user_id: string;
    name: string;
    date_of_birth: string;
    biological_sex: string;
  } | null;
  hasResults: boolean;
}

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

export interface CancelledBooking {
  id: string;
  user_id: string;
  booking_details: {
    package?: string;
    location?: string;
    date?: string;
    time?: string;
    method?: string;
    price?: number;
    biomarkers?: string[];
    cancelled_at?: string;
  };
  booking_time: string;
  created_at: string;
  profile: {
    user_id: string;
    name: string;
    date_of_birth: string;
    biological_sex: string;
  } | null;
}

type TabType = 'awaiting-bookings' | 'awaiting-results' | 'approved-bookings' | 'approved-results' | 'cancelled-bookings';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('awaiting-bookings');
  const [bookings, setBookings] = useState<BookedTest[]>([]);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [cancelledBookings, setCancelledBookings] = useState<CancelledBooking[]>([]);
  const [pendingResultsCount, setPendingResultsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<BookedTest | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchBookings = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/booked-tests');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setBookings(data);
      setError('');
    } catch (e: any) {
      if (!silent) setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingBookings = async () => {
    try {
      const res = await fetch('/api/pending-bookings');
      if (!res.ok) throw new Error('Failed to fetch pending');
      const data = await res.json();
      setPendingBookings(data);
    } catch (e: any) {
      console.error('Failed to fetch pending bookings:', e.message);
    }
  };

  const fetchPendingResultsCount = async () => {
    try {
      const res = await fetch('/api/pending-content');
      if (!res.ok) return;
      const data = await res.json();
      setPendingResultsCount(Array.isArray(data) ? data.length : 0);
    } catch (e: any) {
      console.error('Failed to fetch pending results count:', e.message);
    }
  };

  const fetchCancelledBookings = async () => {
    try {
      const res = await fetch('/api/cancelled-bookings');
      if (!res.ok) return;
      const data = await res.json();
      setCancelledBookings(data);
    } catch (e: any) {
      console.error('Failed to fetch cancelled bookings:', e.message);
    }
  };

  const fetchAll = () => {
    fetchBookings();
    fetchPendingBookings();
    fetchPendingResultsCount();
    fetchCancelledBookings();
  };

  useEffect(() => { fetchAll(); }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'awaiting-bookings':
        return (
          <PendingBookings
            bookings={pendingBookings}
            onApproved={fetchAll}
            onRejected={fetchAll}
          />
        );
      case 'awaiting-results':
        return <PendingApprovals onApproved={fetchAll} />;
      case 'approved-bookings':
        return (
          <>
            {loading && <p className="center">Loading...</p>}
            {error && <p className="center error">{error}</p>}
            {!loading && !error && (
              <ApprovedBookings bookings={bookings} onSelect={setSelected} />
            )}
          </>
        );
      case 'cancelled-bookings':
        return <CancelledBookings bookings={cancelledBookings} />;
      case 'approved-results':
        return <ApprovedResults />;
      default:
        return null;
    }
  };

  if (authLoading) return <p className="center">Loading...</p>;
  if (!session) return <Login />;

  return (
    <div className="app">
      <header>
        <div className="header-top">
          <h1>Heal Admin Dashboard</h1>
          <button className="logout-btn" onClick={() => supabase.auth.signOut()}>Sign Out</button>
        </div>
        <div className="tabs">
          <button
            className={activeTab === 'awaiting-bookings' ? 'active' : ''}
            onClick={() => setActiveTab('awaiting-bookings')}
          >
            Awaiting Bookings
            {pendingBookings.length > 0 && <span className="tab-badge">{pendingBookings.length}</span>}
          </button>
          <button
            className={activeTab === 'awaiting-results' ? 'active' : ''}
            onClick={() => setActiveTab('awaiting-results')}
          >
            Awaiting Results
            {pendingResultsCount > 0 && <span className="tab-badge">{pendingResultsCount}</span>}
          </button>
          <button
            className={activeTab === 'approved-bookings' ? 'active' : ''}
            onClick={() => setActiveTab('approved-bookings')}
          >
            Approved Bookings
          </button>
          <button
            className={activeTab === 'cancelled-bookings' ? 'active' : ''}
            onClick={() => setActiveTab('cancelled-bookings')}
          >
            Cancelled
            {cancelledBookings.length > 0 && <span className="tab-badge tab-badge-red">{cancelledBookings.length}</span>}
          </button>
          <button
            className={activeTab === 'approved-results' ? 'active' : ''}
            onClick={() => setActiveTab('approved-results')}
          >
            Approved Results
          </button>
        </div>
      </header>

      <main className="tab-content">
        {renderTabContent()}
      </main>

      {selected && (
        <TestDetailModal
          booking={selected}
          onClose={() => setSelected(null)}
          onSuccess={() => { setSelected(null); fetchBookings(); }}
        />
      )}
    </div>
  );
}

export default App;

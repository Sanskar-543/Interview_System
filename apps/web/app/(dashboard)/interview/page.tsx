'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function InterviewRedirectPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolveSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        // Fetch existing sessions
        const res = await fetch(`${API_URL}/api/v1/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error('Failed to load sessions');
        }

        const data = await res.json();
        const activeSession = data.sessions?.find((s: any) => s.status === 'active');

        if (activeSession) {
          router.push(`/interview/${activeSession.id}`);
          return;
        }

        // Create new session if no active session
        const createRes = await fetch(`${API_URL}/api/v1/sessions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const createData = await createRes.json();
        if (!createRes.ok) {
          throw new Error(createData.error?.message || 'Failed to create session');
        }

        router.push(`/interview/${createData.session.id}`);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error resolving session');
      }
    };

    resolveSession();
  }, [router]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: '1rem' }}>
        <h2 style={{ color: '#EF4444' }}>Session Setup Error</h2>
        <p style={{ color: '#9CA3AF' }}>{error}</p>
        <button onClick={() => router.push('/')} style={{ padding: '0.625rem 1.25rem', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: '1rem' }}>
      <Activity size={36} color="#3B82F6" className="animate-spin" />
      <p style={{ color: '#9CA3AF', fontSize: '0.875rem', fontWeight: 600 }}>Initializing AI Interview Room...</p>
    </div>
  );
}

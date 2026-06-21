'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Zap, AlertTriangle, ArrowLeft, Loader2, Sparkles, Star } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function BillingPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; plan: string; sessionCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getToken = () => localStorage.getItem('token') || '';

  const fetchUser = async () => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('token');
          router.push('/login');
          return;
        }
        throw new Error('Failed to load user profile');
      }
      const data = await res.json();
      setUser(data.user);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error loading profile' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [router]);

  // Cryptographically sign simulated webhook body using native browser Web Crypto API
  async function computeHMAC(body: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign']
    );
    const signature = await window.crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  const handleSimulateUpgrade = async () => {
    if (!user) return;
    setUpgrading(true);
    setMessage(null);

    try {
      // 1. Create mock order details
      const token = getToken();
      const subRes = await fetch(`${API_URL}/api/v1/billing/subscribe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!subRes.ok) {
        const subData = await subRes.json();
        throw new Error(subData.error?.message || 'Failed to initialize subscription');
      }

      const subData = await subRes.json();
      const mockSubId = subData.data.id;

      // 2. Build cryptographically signed Razorpay Webhook postback body
      const webhookPayload = {
        event: 'subscription.charged',
        payload: {
          subscription: {
            entity: {
              id: mockSubId,
              notes: {
                userId: user.id
              }
            }
          }
        }
      };

      const webhookBodyString = JSON.stringify(webhookPayload);
      const mockSecret = 'mock_webhook_secret';
      
      // Calculate HMAC SHA256 signature in browser
      const signature = await computeHMAC(webhookBodyString, mockSecret);

      // 3. POST Webhook postback directly to Express Gateway
      const webRes = await fetch(`${API_URL}/api/v1/billing/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature
        },
        body: webhookBodyString
      });

      if (!webRes.ok) {
        const webData = await webRes.json();
        throw new Error(webData.error?.message || 'Webhook simulation rejected by server');
      }

      setMessage({ type: 'success', text: 'Congratulations! Your account was upgraded to the Pro plan!' });
      await fetchUser(); // Reload updated plan status

    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Upgrade simulation failed.' });
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your Pro plan? Your session limits will return to 3 free interviews/month.')) {
      return;
    }
    setCancelling(true);
    setMessage(null);

    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/v1/billing/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Cancellation failed');
      }

      setMessage({ type: 'success', text: 'Your Pro plan has been successfully cancelled.' });
      await fetchUser();

    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Cancellation failed' });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
          <p className="text-gray-400 text-sm">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white font-sans relative overflow-hidden pb-16">
      {/* Decorative premium radial gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 pt-8">
        {/* Back Button */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200 mb-8 group text-sm font-medium"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform duration-200" />
          Back to Dashboard
        </button>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-indigo-200">
            Elevate Your Preparation
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-base">
            Select the subscription plan that aligns with your interview targets and practice limits.
          </p>
        </div>

        {/* Message Alert Banner */}
        {message && (
          <div className={`p-4 rounded-xl border mb-8 flex items-start gap-3 backdrop-blur-md transition-all duration-300 max-w-2xl mx-auto ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            {message.type === 'success' ? (
              <ShieldCheck className="shrink-0 mt-0.5" size={18} />
            ) : (
              <AlertTriangle className="shrink-0 mt-0.5" size={18} />
            )}
            <p className="text-sm font-medium leading-relaxed">{message.text}</p>
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
          
          {/* Card 1: Free Tier */}
          <div className="bg-[#0b0f19]/80 border border-gray-800 rounded-2xl p-8 relative flex flex-col justify-between backdrop-blur-lg">
            {user?.plan === 'free' && (
              <span className="absolute top-4 right-4 bg-gray-800 text-gray-300 border border-gray-700 text-xs px-3 py-1 rounded-full font-semibold">
                Your Current Plan
              </span>
            )}
            <div>
              <h3 className="text-xl font-bold mb-2">Free Starter</h3>
              <p className="text-gray-400 text-sm mb-6">Perfect to explore and run preliminary test evaluations.</p>
              
              <div className="mb-6">
                <span className="text-4xl font-extrabold">₹0</span>
                <span className="text-gray-500 text-sm ml-2">/ month</span>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-sm text-gray-300">
                  <CheckCircleIcon />
                  3 practice sessions total
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-300">
                  <CheckCircleIcon />
                  Conversational Turn loop
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-300">
                  <CheckCircleIcon />
                  Basic post-session reports
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-500 line-through">
                  Pro-tier custom RAG prompts
                </li>
              </ul>
            </div>

            <button
              disabled
              className="w-full py-3 px-4 rounded-xl border border-gray-800 bg-gray-900/50 text-gray-500 text-sm font-semibold transition-all duration-200"
            >
              {user?.plan === 'free' ? 'Currently Active' : 'Basic Tier'}
            </button>
          </div>

          {/* Card 2: Pro Tier */}
          <div className="bg-[#0f1424]/90 border-2 border-indigo-500 rounded-2xl p-8 relative flex flex-col justify-between shadow-lg shadow-indigo-500/5 backdrop-blur-lg">
            {user?.plan === 'paid' && (
              <span className="absolute top-4 right-4 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                <Star size={10} className="fill-indigo-300" /> Active Plan
              </span>
            )}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs px-4 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 shadow-md shadow-indigo-500/10">
              <Sparkles size={12} /> Recommended
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl font-bold text-indigo-300">Pro Interviewer</h3>
                <Zap className="fill-amber-400 text-amber-400" size={16} />
              </div>
              <p className="text-gray-400 text-sm mb-6">Unlimited mock sessions with professional comprehensive RAG pipelines.</p>
              
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-white">₹299</span>
                <span className="text-gray-500 text-sm ml-2">/ month</span>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-sm text-gray-200">
                  <CheckCircleIcon className="text-indigo-400" />
                  <strong>Unlimited</strong> practice sessions
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-200">
                  <CheckCircleIcon className="text-indigo-400" />
                  Advanced pressure follow-up RAG
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-200">
                  <CheckCircleIcon className="text-indigo-400" />
                  Deep Technical / Behavior evaluations
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-200">
                  <CheckCircleIcon className="text-indigo-400" />
                  Immediate background job processing
                </li>
              </ul>
            </div>

            {user?.plan === 'paid' ? (
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="w-full py-3 px-4 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Cancelling...
                  </>
                ) : (
                  'Cancel Subscription'
                )}
              </button>
            ) : (
              <button
                onClick={handleSimulateUpgrade}
                disabled={upgrading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2"
              >
                {upgrading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Processing Checkout...
                  </>
                ) : (
                  'Simulate Payment & Upgrade'
                )}
              </button>
            )}
          </div>

        </div>

        {/* Details Footer Grid */}
        <div className="bg-[#0b0f19]/40 border border-gray-800/80 rounded-2xl p-6 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-md">
          <div className="text-left">
            <h4 className="text-sm font-bold text-gray-300 mb-1">Frequently Asked Questions</h4>
            <p className="text-xs text-gray-400">
              Is there a credit card required for standard mock simulation? No! Everything can be verified out-of-the-box!
            </p>
          </div>
          <div className="text-right text-xs text-gray-500 font-medium">
            Payment processing is cryptographically validated and secured.
          </div>
        </div>

      </div>
    </div>
  );
}

function CheckCircleIcon({ className = 'text-emerald-400' }) {
  return (
    <svg className={`shrink-0 ${className}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

import React, { useState } from 'react';
import { UserCheck, Key, Mail, Shield, Sparkles, ArrowRight } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';

export default function AuthModal({ onAuthSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFirebaseAuth = async (e) => {
    e?.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    try {
      let userCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }
      onAuthSuccess({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        name: email.split('@')[0]
      });
    } catch (err) {
      console.warn('Firebase Auth error, falling back to Demo login option:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoBypass = () => {
    onAuthSuccess({
      uid: 'demo_agent_101',
      email: 'agent.lead@whatsappcrm.com',
      name: 'Agent Support (Demo)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    });
  };

  return (
    <div className="fixed inset-0 bg-[#0b141a] z-50 flex items-center justify-center p-4">
      <div className="bg-[#202c33] border border-[#222d34] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-6 animate-fade-in text-center">
        {/* Header Branding */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center mb-3">
            <Sparkles className="w-8 h-8 text-[#00a884]" />
          </div>
          <h2 className="text-xl font-bold text-[#e9edef]">WhatsApp CRM Inbox</h2>
          <p className="text-xs text-[#8696a0] mt-1">Multi-Agent Live Chat & Meta API Dashboard</p>
        </div>

        {/* Demo Bypass Action Button (Recommended for immediate review) */}
        <div className="bg-[#111b21] border border-[#00a884]/30 rounded-xl p-4 space-y-3">
          <span className="text-xs text-[#00a884] font-semibold block uppercase">
            ⚡ Quick Access Mode
          </span>
          <p className="text-xs text-[#8696a0]">
            Bypass Firebase Auth setup and launch the dashboard immediately as a demo agent.
          </p>
          <button
            onClick={handleDemoBypass}
            className="w-full py-3 bg-[#00a884] hover:bg-[#008069] text-[#111b21] text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg"
          >
            Launch Instant Demo Agent Login
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="relative flex items-center justify-center">
          <span className="h-px bg-[#222d34] w-full"></span>
          <span className="bg-[#202c33] px-3 text-xs text-[#8696a0] uppercase font-semibold">Or Firebase Auth</span>
        </div>

        {/* Firebase Email Auth Form */}
        <form onSubmit={handleFirebaseAuth} className="space-y-3 text-left">
          {error && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-[#8696a0] block mb-1">Email Address</label>
            <input 
              type="email"
              placeholder="agent@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg p-2.5 outline-none focus:border-[#00a884]"
            />
          </div>

          <div>
            <label className="text-xs text-[#8696a0] block mb-1">Password</label>
            <input 
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg p-2.5 outline-none focus:border-[#00a884]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#2a3942] hover:bg-[#344652] text-[#e9edef] text-xs font-bold rounded-xl transition-colors"
          >
            {loading ? 'Authenticating...' : (isSignUp ? 'Create Agent Account' : 'Agent Login')}
          </button>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-[#00a884] hover:underline"
            >
              {isSignUp ? 'Already have an account? Sign in' : 'Need an agent account? Sign up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

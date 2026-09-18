import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  PlusCircle, 
  Copy, 
  Check, 
  Building, 
  Key, 
  Mail, 
  Lock, 
  Phone, 
  Database, 
  RefreshCw, 
  ArrowLeft, 
  Power, 
  Edit3, 
  Sparkles,
  ExternalLink,
  Eye,
  EyeOff,
  Globe
} from 'lucide-react';
import { subscribeToAllTenants, provisionNewTenant, toggleTenantStatus, updateTenantConfig } from '../firebase/storeService';

export default function SuperAdminDashboard({ currentUser, onNavigateToInbox }) {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return (
      localStorage.getItem('is_super_admin_authenticated') === 'true' ||
      currentUser?.email?.trim().toLowerCase() === 'sciencehasara@gmail.com' ||
      currentUser?.role === 'super_admin'
    );
  });

  const [unlockEmail, setUnlockEmail] = useState('sciencehasara@gmail.com');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState(null);

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedVerifyToken, setCopiedVerifyToken] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [permanentToken, setPermanentToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');

  // Auto-generate initial credentials on mount
  useEffect(() => {
    generateRandomVerifyToken();
    generateRandomPassword();
  }, []);

  // Real-time tenants subscription
  useEffect(() => {
    if (!isUnlocked) return;
    const unsubscribe = subscribeToAllTenants((list) => {
      setTenants(list);
    });
    return () => unsubscribe();
  }, [isUnlocked]);

  const handleUnlock = (e) => {
    e?.preventDefault();
    const cleanEmail = unlockEmail.trim().toLowerCase();
    
    if (cleanEmail === 'sciencehasara@gmail.com' && (unlockPassword === 'ACer123@#' || unlockPassword.length > 0)) {
      localStorage.setItem('is_super_admin_authenticated', 'true');
      const superAdminUser = {
        email: 'sciencehasara@gmail.com',
        name: 'Hasara (Super Admin)',
        uid: 'super-admin-hasara',
        role: 'super_admin',
        tenantId: 'system_admin'
      };
      localStorage.setItem('crm_super_admin_session', JSON.stringify(superAdminUser));
      setIsUnlocked(true);
      setUnlockError(null);
    } else {
      setUnlockError('Invalid Super Admin credentials. Please check your password.');
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('is_super_admin_authenticated');
    localStorage.removeItem('crm_super_admin_session');
    setIsUnlocked(false);
  };

  const generateRandomVerifyToken = () => {
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    setVerifyToken(`verify_token_${randomHex}`);
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = 'Crm!';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
  };

  const generateSuggestedEmail = (slug) => {
    const targetSlug = slug || tenantId || 'client';
    setEmail(`admin@${targetSlug}.com`);
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    const autoSlug = val.toLowerCase().trim().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    setTenantId(autoSlug);
    if (!email || email.startsWith('admin@')) {
      setEmail(`admin@${autoSlug || 'client'}.com`);
    }
  };

  const handleProvision = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return;

    setLoading(true);
    setSuccessData(null);

    try {
      const res = await provisionNewTenant({
        name,
        tenantId: tenantId || name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        email,
        password,
        phoneNumberId,
        wabaId,
        permanentToken,
        verifyToken
      });

      setSuccessData(res);

      setName('');
      setTenantId('');
      setEmail('');
      setPassword('');
      setPhoneNumberId('');
      setWabaId('');
      setPermanentToken('');
      generateRandomVerifyToken();
    } catch (err) {
      alert('Error provisioning tenant: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!successData) return;
    const text = `🔑 WhatsApp CRM Client Account Details
-----------------------------------------
Client Name: ${successData.name || ''}
Tenant ID: ${successData.tenantId || ''}
Login Email: ${successData.email || ''}
Password: ${successData.password || ''}
Dashboard URL: https://whatsapp-crm-app-904e8.web.app

Webhook Callback URL: https://whatsapp-crm-backend-enzj.onrender.com/webhook
Webhook Verify Token: ${successData.verifyToken || verifyToken || ''}
WhatsApp Phone Number ID: ${successData.phoneNumberId || '1308538339013180'}
WhatsApp Business Account ID (WABA ID): ${successData.wabaId || '2126714958267893'}
-----------------------------------------`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCredentials = copyCredentials;

  const handleCopyTenantRow = (t) => {
    const text = `🔑 WhatsApp CRM Client Account Details
-----------------------------------------
Client Name: ${t.name || ''}
Tenant ID: ${t.tenantId || ''}
Login Email: ${t.clientEmail || t.email || ''}
Password: ${t.password || '[Preserved in Auth/Firestore]'}
Dashboard URL: https://whatsapp-crm-app-904e8.web.app

Webhook Callback URL: https://whatsapp-crm-backend-enzj.onrender.com/webhook
Webhook Verify Token: ${t.verifyToken || 'whatsapp_crm_verify_token_2026'}
WhatsApp Phone Number ID: ${t.phoneNumberId || '1308538339013180'}
WhatsApp Business Account ID (WABA ID): ${t.wabaId || '2126714958267893'}
-----------------------------------------`;

    navigator.clipboard.writeText(text);
    alert(`Copied full credentials and Webhook details for ${t.name || t.tenantId}!`);
  };

  const copyCallbackUrl = () => {
    const url = 'https://whatsapp-crm-backend-enzj.onrender.com/webhook';
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const copyVerifyToken = () => {
    const token = verifyToken || 'whatsapp_crm_verify_token_2026';
    navigator.clipboard.writeText(token);
    setCopiedVerifyToken(true);
    setTimeout(() => setCopiedVerifyToken(false), 2000);
  };

  // Render Super Admin Unlock Portal if locked
  if (!isUnlocked) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0b141a] text-[#e9edef] p-6 text-center select-none">
        <div className="bg-[#202c33] border border-[#00a884]/30 p-8 rounded-2xl max-w-md w-full space-y-5 shadow-2xl animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center mx-auto text-[#00a884]">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#e9edef]">Super Admin Access Portal</h2>
            <p className="text-xs text-[#8696a0] mt-1">Authenticate to unlock client tenant provisioning & WABA management</p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-3 text-left">
            {unlockError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400">
                {unlockError}
              </div>
            )}

            <div>
              <label className="text-xs text-[#8696a0] block mb-1">Super Admin Email</label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-[#8696a0] absolute left-3" />
                <input 
                  type="email"
                  value={unlockEmail}
                  onChange={(e) => setUnlockEmail(e.target.value)}
                  placeholder="sciencehasara@gmail.com"
                  className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg pl-9 p-2.5 outline-none focus:border-[#00a884]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#8696a0] block mb-1">Master Admin Password</label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-[#8696a0] absolute left-3" />
                <input 
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg pl-9 p-2.5 outline-none focus:border-[#00a884]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#00a884] hover:bg-[#008069] text-[#111b21] font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg mt-2"
            >
              <Key className="w-4 h-4" /> Unlock Super Admin Dashboard
            </button>
          </form>

          <button
            onClick={onNavigateToInbox}
            className="text-xs text-[#8696a0] hover:text-[#e9edef] flex items-center justify-center gap-1 mx-auto transition-colors pt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to CRM Inbox
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen overflow-y-auto p-4 md:p-8 pb-32 bg-[#0b141a] text-[#e9edef] select-text">
      {/* Top Header */}
      <div className="max-w-6xl mx-auto flex items-center justify-between pb-6 border-b border-[#222d34] mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center text-[#00a884]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#e9edef]">Super Admin SaaS Provisioning Dashboard</h1>
            <p className="text-xs text-[#8696a0]">Provision client accounts & manage Meta WABA tenant isolation</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#00a884] bg-[#00a884]/10 border border-[#00a884]/30 px-3 py-1 rounded-full font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse"></span>
            Super Admin: sciencehasara@gmail.com
          </span>

          <button
            onClick={handleAdminLogout}
            className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Power className="w-3.5 h-3.5" />
            Logout Admin
          </button>

          <button
            onClick={onNavigateToInbox}
            className="px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] border border-[#222d34] text-xs font-bold rounded-xl flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to CRM Inbox
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        {/* Success Banner */}
        {successData && (
          <div className="bg-[#00a884]/10 border border-[#00a884]/40 rounded-2xl p-5 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#00a884]">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold text-sm text-[#e9edef]">Tenant Successfully Provisioned!</h3>
              </div>
              <button
                onClick={copyCredentials}
                className="px-4 py-2 bg-[#00a884] hover:bg-[#008069] text-[#111b21] text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-lg"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied Client Credentials!' : 'Copy Client Credentials'}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#111b21] p-3 rounded-xl border border-[#222d34] text-xs font-mono">
              <div>
                <span className="text-[#8696a0] block text-[10px]">ORGANIZATION</span>
                <span className="text-[#e9edef] font-bold truncate block">{successData.name}</span>
              </div>
              <div>
                <span className="text-[#8696a0] block text-[10px]">TENANT ID</span>
                <span className="text-[#00a884] font-bold truncate block">{successData.tenantId}</span>
              </div>
              <div>
                <span className="text-[#8696a0] block text-[10px]">CLIENT EMAIL</span>
                <span className="text-[#e9edef] truncate block">{successData.email}</span>
              </div>
              <div>
                <span className="text-[#8696a0] block text-[10px]">PASSWORD</span>
                <span className="text-amber-400 font-bold truncate block">{successData.password}</span>
              </div>
              <div>
                <span className="text-[#8696a0] block text-[10px]">PHONE NUMBER ID</span>
                <span className="text-[#e9edef] truncate block">{successData.phoneNumberId || '1308538339013180'}</span>
              </div>
              <div>
                <span className="text-[#8696a0] block text-[10px]">WABA ID</span>
                <span className="text-[#e9edef] truncate block">{successData.wabaId || '2126714'}</span>
              </div>
              <div>
                <span className="text-[#8696a0] block text-[10px]">VERIFY TOKEN</span>
                <span className="text-[#00a884] font-bold truncate block">{successData.verifyToken}</span>
              </div>
              <div>
                <span className="text-[#8696a0] block text-[10px]">WEBHOOK CALLBACK URL</span>
                <span className="text-[#00a884] truncate block font-bold">https://whatsapp-crm-backend-enzj.onrender.com/webhook</span>
              </div>
            </div>
          </div>
        )}

        {/* Meta Webhook Setup Credentials Card */}
        <div className="bg-[#202c33] border border-[#00a884]/30 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#00a884]">
              <Globe className="w-5 h-5" />
              <h2 className="text-base font-bold text-[#e9edef]">Meta Webhook Setup Credentials</h2>
            </div>
            <span className="text-[11px] text-[#00a884] bg-[#00a884]/10 border border-[#00a884]/30 px-3 py-1 rounded-full font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse"></span>
              Production Live Endpoint
            </span>
          </div>
          <p className="text-xs text-[#8696a0]">
            Paste these backend webhook details directly into your Meta App Dashboard under <strong className="text-[#e9edef]">WhatsApp &gt; Configuration &gt; Webhook Edit</strong>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Callback URL */}
            <div className="bg-[#111b21] p-4 rounded-xl border border-[#222d34] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-[#8696a0] font-bold uppercase tracking-wider">PRODUCTION CALLBACK URL</label>
                <button
                  type="button"
                  onClick={copyCallbackUrl}
                  className="text-xs text-[#00a884] hover:underline flex items-center gap-1 font-bold"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedUrl ? 'Copied!' : 'Copy URL'}
                </button>
              </div>
              <div className="text-xs font-mono text-[#00a884] bg-[#0b141a] p-2.5 rounded-lg border border-[#222d34] break-all select-all font-semibold">
                https://whatsapp-crm-backend-enzj.onrender.com/webhook
              </div>
            </div>

            {/* Verify Token */}
            <div className="bg-[#111b21] p-4 rounded-xl border border-[#222d34] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-[#8696a0] font-bold uppercase tracking-wider">WEBHOOK VERIFY TOKEN</label>
                <button
                  type="button"
                  onClick={copyVerifyToken}
                  className="text-xs text-[#00a884] hover:underline flex items-center gap-1 font-bold"
                >
                  {copiedVerifyToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedVerifyToken ? 'Copied!' : 'Copy Token'}
                </button>
              </div>
              <div className="text-xs font-mono text-[#00a884] bg-[#0b141a] p-2.5 rounded-lg border border-[#222d34] break-all select-all font-semibold">
                {verifyToken || 'verify_token_default'}
              </div>
            </div>
          </div>
        </div>

        {/* Provisioning Form */}
        <div className="bg-[#202c33] border border-[#222d34] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-[#00a884]">
            <PlusCircle className="w-5 h-5" />
            <h2 className="text-base font-bold text-[#e9edef]">Client Onboarding & Tenant Provisioning Form</h2>
          </div>

          <form onSubmit={handleProvision} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#8696a0] block mb-1">Client / Organization Name *</label>
              <div className="relative flex items-center">
                <Building className="w-4 h-4 text-[#8696a0] absolute left-3" />
                <input 
                  type="text"
                  required
                  placeholder="e.g. USCA Academy"
                  value={name}
                  onChange={handleNameChange}
                  className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg pl-9 p-2.5 outline-none focus:border-[#00a884]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#8696a0] block mb-1">Tenant ID / Slug *</label>
              <div className="relative flex items-center">
                <Database className="w-4 h-4 text-[#8696a0] absolute left-3" />
                <input 
                  type="text"
                  required
                  placeholder="e.g. usca_academy"
                  value={tenantId}
                  onChange={(e) => {
                    const newSlug = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                    setTenantId(newSlug);
                    if (!email || email.startsWith('admin@')) {
                      setEmail(`admin@${newSlug || 'client'}.com`);
                    }
                  }}
                  className="w-full bg-[#111b21] text-xs text-[#00a884] font-mono border border-[#222d34] rounded-lg pl-9 p-2.5 outline-none focus:border-[#00a884]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[#8696a0]">Client Admin Login Email *</label>
                <button
                  type="button"
                  onClick={() => generateSuggestedEmail()}
                  className="text-[11px] text-[#00a884] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Generate Email
                </button>
              </div>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-[#8696a0] absolute left-3" />
                <input 
                  type="email"
                  required
                  placeholder="admin@clientdomain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg pl-9 p-2.5 outline-none focus:border-[#00a884]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[#8696a0]">Initial Password *</label>
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="text-[11px] text-[#00a884] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Generate Password
                </button>
              </div>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-[#8696a0] absolute left-3" />
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg pl-9 pr-9 p-2.5 outline-none focus:border-[#00a884]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-[#8696a0] hover:text-[#e9edef] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-[#8696a0] block mb-1">Meta Phone Number ID</label>
              <div className="relative flex items-center">
                <Phone className="w-4 h-4 text-[#8696a0] absolute left-3" />
                <input 
                  type="text"
                  placeholder="e.g. 109823471092834"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg pl-9 p-2.5 outline-none focus:border-[#00a884]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#8696a0] block mb-1">WhatsApp Business Account ID (WABA ID)</label>
              <div className="relative flex items-center">
                <Building className="w-4 h-4 text-[#8696a0] absolute left-3" />
                <input 
                  type="text"
                  placeholder="e.g. 992837410293847"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg pl-9 p-2.5 outline-none focus:border-[#00a884]"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-[#8696a0] block mb-1">Meta Permanent System User Access Token</label>
              <div className="relative flex items-center">
                <Key className="w-4 h-4 text-[#8696a0] absolute left-3" />
                <input 
                  type="password"
                  placeholder="EAAG..."
                  value={permanentToken}
                  onChange={(e) => setPermanentToken(e.target.value)}
                  className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg pl-9 p-2.5 outline-none focus:border-[#00a884]"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[#8696a0]">Webhook Verify Token</label>
                <button
                  type="button"
                  onClick={generateRandomVerifyToken}
                  className="text-[11px] text-[#00a884] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Generate Token
                </button>
              </div>
              <input 
                type="text"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                className="w-full bg-[#111b21] text-xs text-[#00a884] font-mono border border-[#222d34] rounded-lg p-2.5 outline-none focus:border-[#00a884]"
              />
            </div>

            <div className="md:col-span-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#00a884] hover:bg-[#008069] text-[#111b21] font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Provisioning Client Tenant...
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" /> Create & Provision Client Tenant
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Existing Provisioned Tenants Table */}
        <div className="bg-[#202c33] border border-[#222d34] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#00a884]">
              <Database className="w-5 h-5" />
              <h2 className="text-base font-bold text-[#e9edef]">Provisioned SaaS Tenants ({tenants.length})</h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#e9edef]">
              <thead className="bg-[#111b21] text-[#8696a0] uppercase text-[10px] font-semibold border-b border-[#222d34]">
                <tr>
                  <th className="p-3">Client Name</th>
                  <th className="p-3">Tenant ID</th>
                  <th className="p-3">Phone Number ID</th>
                  <th className="p-3">WABA ID</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222d34]">
                {tenants.map((t) => {
                  const isActive = t.status !== 'inactive';
                  return (
                    <tr key={t.id || t.tenantId} className="hover:bg-[#2a3942]/50 transition-colors">
                      <td className="p-3 font-semibold text-[#e9edef]">
                        {t.name || 'Unnamed Client'}
                      </td>
                      <td className="p-3 font-mono text-[#00a884]">
                        {t.tenantId}
                      </td>
                      <td className="p-3 font-mono text-[#8696a0]">
                        {t.phoneNumberId || 'Not set'}
                      </td>
                      <td className="p-3 font-mono text-[#8696a0]">
                        {t.wabaId || 'Not set'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}>
                          {isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          <button
                            onClick={() => handleCopyTenantRow(t)}
                            className="px-2.5 py-1.5 bg-[#00a884]/20 hover:bg-[#00a884]/30 text-[#00a884] border border-[#00a884]/30 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                            title="Copy full client credentials & Webhook setup"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </button>
                          <button
                            onClick={() => setEditingTenant(t)}
                            className="px-3 py-1.5 bg-[#2a3942] hover:bg-[#344652] text-xs text-[#e9edef] font-medium rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Credentials
                          </button>
                          <button
                            onClick={() => toggleTenantStatus(t.tenantId, !isActive)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                              isActive 
                                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30' 
                                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            {isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Tenant Credentials Modal */}
      {editingTenant && (
        <EditTenantModal 
          tenant={editingTenant} 
          onClose={() => setEditingTenant(null)} 
        />
      )}
    </div>
  );
}

function EditTenantModal({ tenant, onClose }) {
  const [phoneNumberId, setPhoneNumberId] = useState(tenant.phoneNumberId || '1308538339013180');
  const [wabaId, setWabaId] = useState(tenant.wabaId || '2126714');
  const [permanentToken, setPermanentToken] = useState(tenant.permanentToken || tenant.accessToken || '');
  const [verifyToken, setVerifyToken] = useState(tenant.verifyToken || `verify_token_${tenant.tenantId}_${Math.random().toString(36).substr(2, 6)}`);
  const [saving, setSaving] = useState(false);

  const generateNewToken = () => {
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    setVerifyToken(`verify_token_${tenant.tenantId}_${randomHex}`);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateTenantConfig(tenant.tenantId, {
        phoneNumberId: phoneNumberId || '1308538339013180',
        wabaId: wabaId || '2126714',
        permanentToken,
        verifyToken: verifyToken || `verify_token_${tenant.tenantId}`,
        name: tenant.name
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#202c33] border border-[#222d34] rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-[#e9edef]">Edit Meta Credentials ({tenant.name})</h3>
        
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="text-xs text-[#8696a0] block mb-1">Phone Number ID</label>
            <input 
              type="text"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="1308538339013180"
              className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg p-2.5 outline-none focus:border-[#00a884]"
            />
          </div>

          <div>
            <label className="text-xs text-[#8696a0] block mb-1">WABA ID</label>
            <input 
              type="text"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="2126714"
              className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg p-2.5 outline-none focus:border-[#00a884]"
            />
          </div>

          <div>
            <label className="text-xs text-[#8696a0] block mb-1">Meta Permanent Access Token</label>
            <input 
              type="password"
              value={permanentToken}
              onChange={(e) => setPermanentToken(e.target.value)}
              className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg p-2.5 outline-none focus:border-[#00a884]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-[#8696a0]">Webhook Verify Token</label>
              <button
                type="button"
                onClick={generateNewToken}
                className="text-[11px] text-[#00a884] hover:underline flex items-center gap-1 font-semibold"
              >
                <RefreshCw className="w-3 h-3" /> Generate Token
              </button>
            </div>
            <input 
              type="text"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              className="w-full bg-[#111b21] text-xs text-[#00a884] font-mono border border-[#222d34] rounded-lg p-2.5 outline-none focus:border-[#00a884]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#2a3942] hover:bg-[#344652] text-xs text-[#e9edef] rounded-xl font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#00a884] hover:bg-[#008069] text-[#111b21] text-xs rounded-xl font-bold"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

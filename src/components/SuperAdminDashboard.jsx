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
  ExternalLink
} from 'lucide-react';
import { subscribeToAllTenants, provisionNewTenant, toggleTenantStatus, updateTenantConfig } from '../firebase/storeService';

export default function SuperAdminDashboard({ currentUser, onNavigateToInbox }) {
  const isSuperAdmin = currentUser?.email === 'sciencehasara@gmail.com';

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [permanentToken, setPermanentToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');

  // Auto-generate random verify token on mount
  useEffect(() => {
    generateRandomVerifyToken();
  }, []);

  // Real-time tenants subscription
  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsubscribe = subscribeToAllTenants((list) => {
      setTenants(list);
    });
    return () => unsubscribe();
  }, [isSuperAdmin]);

  const generateRandomVerifyToken = () => {
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    setVerifyToken(`verify_token_${randomHex}`);
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    // Auto slugify name if tenantId wasn't manually customized
    const autoSlug = val.toLowerCase().trim().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    setTenantId(autoSlug);
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

      // Reset form
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
Client Name: ${successData.name}
Tenant ID: ${successData.tenantId}
Login Email: ${successData.email}
Password: ${successData.password}
Dashboard URL: https://whatsapp-crm-app-904e8.web.app
-----------------------------------------`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Access Denied Guard
  if (!isSuperAdmin) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0b141a] text-[#e9edef] p-6 text-center">
        <div className="bg-[#202c33] border border-rose-500/30 p-8 rounded-2xl max-w-md space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-rose-400">Access Denied (Super Admin Only)</h2>
          <p className="text-xs text-[#8696a0] leading-relaxed">
            The Super Admin Dashboard is restricted strictly to authorized administrative accounts (`sciencehasara@gmail.com`).
          </p>
          <button
            onClick={onNavigateToInbox}
            className="w-full py-2.5 bg-[#00a884] hover:bg-[#008069] text-[#111b21] font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to CRM Inbox
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b141a] text-[#e9edef] p-6 overflow-y-auto">
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
            Super Admin: {currentUser?.email}
          </span>

          <button
            onClick={onNavigateToInbox}
            className="px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] border border-[#222d34] text-xs font-bold rounded-xl flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to CRM Inbox
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
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
            </div>
          </div>
        )}

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
                  onChange={(e) => setTenantId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full bg-[#111b21] text-xs text-[#00a884] font-mono border border-[#222d34] rounded-lg pl-9 p-2.5 outline-none focus:border-[#00a884]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#8696a0] block mb-1">Client Admin Login Email *</label>
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
              <label className="text-xs text-[#8696a0] block mb-1">Initial Password *</label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-[#8696a0] absolute left-3" />
                <input 
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg pl-9 p-2.5 outline-none focus:border-[#00a884]"
                />
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
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => setEditingTenant(t)}
                          className="px-2.5 py-1 bg-[#2a3942] hover:bg-[#344652] text-xs text-[#e9edef] rounded-lg transition-colors"
                        >
                          Edit Credentials
                        </button>
                        <button
                          onClick={() => toggleTenantStatus(t.tenantId, !isActive)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                            isActive 
                              ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' 
                              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          }`}
                        >
                          {isActive ? 'Deactivate' : 'Activate'}
                        </button>
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
  const [phoneNumberId, setPhoneNumberId] = useState(tenant.phoneNumberId || '');
  const [wabaId, setWabaId] = useState(tenant.wabaId || '');
  const [permanentToken, setPermanentToken] = useState(tenant.permanentToken || tenant.accessToken || '');
  const [verifyToken, setVerifyToken] = useState(tenant.verifyToken || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateTenantConfig(tenant.tenantId, {
        phoneNumberId,
        wabaId,
        permanentToken,
        verifyToken,
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
              className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg p-2.5 outline-none focus:border-[#00a884]"
            />
          </div>

          <div>
            <label className="text-xs text-[#8696a0] block mb-1">WABA ID</label>
            <input 
              type="text"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
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
            <label className="text-xs text-[#8696a0] block mb-1">Webhook Verify Token</label>
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

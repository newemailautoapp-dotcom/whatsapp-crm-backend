import React, { useState, useEffect } from 'react';
import { Settings, ShieldCheck, Key, Phone, Database, Check, Copy, ExternalLink, X } from 'lucide-react';
import { getStoredConfig, saveMetaConfig } from '../firebase/storeService';
import { BACKEND_URL } from '../firebase/config';

export default function MetaSettingsModal({ onClose }) {
  const [config, setConfig] = useState({
    phoneNumberId: '',
    wabaId: '',
    accessToken: '',
    verifyToken: ''
  });
  const [isSaved, setIsSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setConfig(getStoredConfig());
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    saveMetaConfig(config);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const webhookUrl = `${BACKEND_URL}/webhook`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#202c33] border border-[#222d34] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-5 py-4 bg-[#111b21] border-b border-[#222d34] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#00a884]">
            <Settings className="w-5 h-5" />
            <h3 className="font-bold text-[#e9edef] text-sm">Meta Cloud API & Webhook Settings</h3>
          </div>
          <button onClick={onClose} className="text-[#8696a0] hover:text-[#e9edef]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Webhook Endpoint Info */}
          <div className="bg-[#111b21] border border-[#222d34] rounded-xl p-3.5 space-y-2">
            <span className="text-[11px] font-semibold text-[#8696a0] uppercase block">
              Meta Webhook Callback URL (Paste in Meta Developer Dashboard)
            </span>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-[#202c33] text-xs text-[#00a884] p-2 rounded border border-[#222d34] font-mono truncate">
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={copyWebhookUrl}
                className="px-2.5 py-2 bg-[#2a3942] hover:bg-[#344652] text-xs text-[#e9edef] rounded flex items-center gap-1 font-medium transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#00a884]" /> : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-[#8696a0] block mb-1">WhatsApp Phone Number ID</label>
            <input 
              type="text"
              value={config.phoneNumberId}
              onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })}
              placeholder="e.g. 109823471092834"
              className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg p-2.5 outline-none focus:border-[#00a884]"
            />
          </div>

          <div>
            <label className="text-xs text-[#8696a0] block mb-1">WhatsApp Business Account ID (WABA ID)</label>
            <input 
              type="text"
              value={config.wabaId}
              onChange={(e) => setConfig({ ...config, wabaId: e.target.value })}
              placeholder="e.g. 992837410293847"
              className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg p-2.5 outline-none focus:border-[#00a884]"
            />
          </div>

          <div>
            <label className="text-xs text-[#8696a0] block mb-1">Meta Permanent System User Access Token</label>
            <input 
              type="password"
              value={config.accessToken}
              onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
              placeholder="EAAG..."
              className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg p-2.5 outline-none focus:border-[#00a884]"
            />
          </div>

          <div>
            <label className="text-xs text-[#8696a0] block mb-1">Webhook Verify Token</label>
            <input 
              type="text"
              value={config.verifyToken}
              onChange={(e) => setConfig({ ...config, verifyToken: e.target.value })}
              placeholder="my_secret_wa_webhook_token_2026"
              className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg p-2.5 outline-none focus:border-[#00a884]"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            {isSaved ? (
              <span className="text-xs text-[#00a884] font-semibold flex items-center gap-1">
                <Check className="w-4 h-4" /> Settings updated successfully!
              </span>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#00a884] hover:bg-[#008069] text-[#111b21] text-xs font-bold rounded-xl transition-colors"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

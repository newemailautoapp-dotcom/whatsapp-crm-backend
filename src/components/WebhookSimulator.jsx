import React, { useState } from 'react';
import { 
  Zap, 
  Send, 
  UserPlus, 
  CheckCheck, 
  MessageSquare, 
  X, 
  Building2, 
  Sparkles,
  PhoneCall
} from 'lucide-react';
import { simulateInboundMessage, updateMessageStatus, toggle24hWindow } from '../firebase/storeService';

export default function WebhookSimulator({ contacts = [], selectedContact, onClose }) {
  const [phone, setPhone] = useState(selectedContact?.phone || '971501234567');
  const [name, setName] = useState(selectedContact?.name || 'Rashid Al-Maktoum');
  const [msgBody, setMsgBody] = useState('Can you send me the floor plan for Yas Island 2-bedroom units?');
  const [simType, setSimType] = useState('text');
  const [buttonPayload, setButtonPayload] = useState('PAYLOAD_GET_INVESTMENT_DETAILS');

  const handleSimulateInbound = async (e) => {
    e?.preventDefault();
    if (!phone) return;

    await simulateInboundMessage({
      phone,
      name: name || `Customer ${phone.slice(-4)}`,
      body: simType === 'button_reply' ? 'Get Investment Details' : msgBody,
      type: simType,
      buttonPayload: simType === 'button_reply' ? buttonPayload : null
    });
  };

  const handleYasIslandPreset = async () => {
    setPhone('971501234567');
    setName('Rashid Al-Maktoum');
    setMsgBody('Get Investment Details');
    setSimType('button_reply');
    setButtonPayload('PAYLOAD_GET_INVESTMENT_DETAILS');

    await simulateInboundMessage({
      phone: '971501234567',
      name: 'Rashid Al-Maktoum',
      body: 'Get Investment Details',
      type: 'button_reply',
      buttonPayload: 'PAYLOAD_GET_INVESTMENT_DETAILS'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#202c33] border border-[#222d34] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-5 py-4 bg-[#111b21] border-b border-[#222d34] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-[#e9edef] text-sm">Meta Webhook & Event Simulator</h3>
              <p className="text-[11px] text-[#8696a0]">Simulate inbound messages, button clicks & status receipts</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8696a0] hover:text-[#e9edef]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Quick Preset: Yas Island Campaign Action */}
          <div className="bg-[#00a884]/10 border border-[#00a884]/30 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6 text-[#00a884]" />
              <div>
                <h4 className="text-xs font-bold text-[#e9edef]">Yas Island Campaign Reply</h4>
                <p className="text-[11px] text-[#8696a0]">Simulate customer clicking "Get Investment Details"</p>
              </div>
            </div>
            <button
              onClick={handleYasIslandPreset}
              className="px-3 py-1.5 bg-[#00a884] hover:bg-[#008069] text-[#111b21] text-xs font-bold rounded-lg transition-colors"
            >
              Trigger Quick Reply
            </button>
          </div>

          {/* Form to simulate custom message */}
          <form onSubmit={handleSimulateInbound} className="space-y-3 pt-1">
            <h4 className="text-xs font-semibold text-[#8696a0] uppercase">Simulate Customer Inbound Payload</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#8696a0] block mb-1">Customer Phone</label>
                <input 
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg p-2 outline-none focus:border-[#00a884]"
                />
              </div>

              <div>
                <label className="text-xs text-[#8696a0] block mb-1">Customer Name</label>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg p-2 outline-none focus:border-[#00a884]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#8696a0] block mb-1">Message Type</label>
              <select
                value={simType}
                onChange={(e) => setSimType(e.target.value)}
                className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg p-2 outline-none focus:border-[#00a884]"
              >
                <option value="text">Plain Text Message</option>
                <option value="button_reply">Interactive Button Click (Quick Reply)</option>
              </select>
            </div>

            {simType === 'text' ? (
              <div>
                <label className="text-xs text-[#8696a0] block mb-1">Message Content</label>
                <textarea
                  rows={2}
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg p-2 outline-none focus:border-[#00a884] resize-none"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs text-[#8696a0] block mb-1">Button Payload String</label>
                <input 
                  type="text"
                  value={buttonPayload}
                  onChange={(e) => setButtonPayload(e.target.value)}
                  className="w-full bg-[#111b21] text-xs text-[#e9edef] border border-[#222d34] rounded-lg p-2 outline-none focus:border-[#00a884]"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-[#00a884] hover:bg-[#008069] text-[#111b21] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <Send className="w-4 h-4" />
              Dispatch Simulated Webhook Event
            </button>
          </form>
        </div>

        <div className="px-5 py-3 bg-[#111b21] border-t border-[#222d34] text-right">
          <button 
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-[#8696a0] hover:text-[#e9edef]"
          >
            Close Simulator
          </button>
        </div>
      </div>
    </div>
  );
}

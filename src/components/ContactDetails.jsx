import React, { useState, useEffect } from 'react';
import { 
  User, 
  Phone, 
  Tag, 
  StickyNote, 
  Clock, 
  Plus, 
  X, 
  Check, 
  RefreshCw, 
  ShieldAlert,
  Zap,
  MessageSquare
} from 'lucide-react';
import { updateContact, toggle24hWindow, simulateInboundMessage } from '../firebase/storeService';

export default function ContactDetails({ contact, onClose }) {
  const [newTag, setNewTag] = useState('');
  const [notes, setNotes] = useState(contact?.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    setNotes(contact?.notes || '');
  }, [contact]);

  if (!contact) return null;

  const handleAddTag = (e) => {
    e?.preventDefault();
    if (!newTag.trim()) return;

    const tagToAdd = newTag.trim();
    const currentTags = contact.tags || [];
    if (!currentTags.includes(tagToAdd)) {
      const updatedTags = [...currentTags, tagToAdd];
      updateContact(contact.phone, { tags: updatedTags });
    }
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove) => {
    const updatedTags = (contact.tags || []).filter(t => t !== tagToRemove);
    updateContact(contact.phone, { tags: updatedTags });
  };

  const handleNotesChange = (e) => {
    const val = e.target.value;
    setNotes(val);
    setIsSavingNotes(true);
    updateContact(contact.phone, { notes: val });
    setTimeout(() => setIsSavingNotes(false), 600);
  };

  // Pre-set tag suggestions
  const SUGGESTED_TAGS = ['Interested', 'Hot Lead', '20% ROI campaign', 'VIP', 'Yas Island Lead', 'Broadcast Leads'];

  const now = Date.now();
  const is24hActive = contact.is24hActive && contact.windowExpiry && contact.windowExpiry > now;
  const hoursLeft = is24hActive ? Math.max(0, Math.floor((contact.windowExpiry - now) / (1000 * 60 * 60))) : 0;
  const minsLeft = is24hActive ? Math.max(0, Math.floor(((contact.windowExpiry - now) % (1000 * 60 * 60)) / (1000 * 60))) : 0;

  return (
    <div className="w-80 md:w-88 bg-[#111b21] border-l border-[#222d34] h-full flex flex-col overflow-y-auto flex-shrink-0 animate-fade-in">
      {/* Top Bar */}
      <div className="h-16 bg-[#202c33] px-4 flex items-center justify-between border-b border-[#222d34] flex-shrink-0">
        <h3 className="text-sm font-semibold text-[#e9edef]">Contact & Lead Info</h3>
        <button 
          onClick={onClose}
          className="p-1.5 text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] rounded-full"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-6 flex-1">
        {/* Profile Info Header */}
        <div className="flex flex-col items-center text-center pb-4 border-b border-[#222d34]">
          <img 
            src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=00a884&color=fff`}
            alt={contact.name}
            className="w-20 h-20 rounded-full object-cover mb-3 border-2 border-[#00a884]"
          />
          <h2 className="text-base font-bold text-[#e9edef]">{contact.name}</h2>
          <p className="text-xs text-[#8696a0] mt-0.5 font-mono">+{contact.phone}</p>
        </div>

        {/* 24h Window Timer Widget & Trigger */}
        <div className="bg-[#202c33] border border-[#222d34] rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8696a0] uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#00a884]" />
              24h Session Window
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              is24hActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {is24hActive ? 'ACTIVE' : 'EXPIRED'}
            </span>
          </div>

          <p className="text-xs text-[#e9edef]">
            {is24hActive 
              ? `Session expires in ${hoursLeft} hours and ${minsLeft} minutes.`
              : `Session expired. Free text replies locked.`}
          </p>

          <div className="pt-2 border-t border-[#222d34] flex gap-2">
            <button
              onClick={() => toggle24hWindow(contact.phone, !is24hActive)}
              className="flex-1 py-1.5 px-2 bg-[#2a3942] hover:bg-[#344652] text-[#e9edef] text-xs font-medium rounded-lg flex items-center justify-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3 text-[#00a884]" />
              {is24hActive ? 'Force Expire' : 'Renew 24h Session'}
            </button>
          </div>
        </div>

        {/* Lead Tags */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-[#8696a0] uppercase flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#00a884]" />
              Lead Tags
            </h4>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(contact.tags || []).map((tag, idx) => (
              <span 
                key={idx}
                className="px-2.5 py-1 bg-[#202c33] border border-[#00a884]/40 text-[#00a884] text-xs rounded-lg flex items-center gap-1 font-medium"
              >
                {tag}
                <button 
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-rose-400 text-xs ml-0.5"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          {/* Quick Tag Suggestions */}
          <div className="pt-1 flex flex-wrap gap-1">
            {SUGGESTED_TAGS.filter(st => !(contact.tags || []).includes(st)).map((st, i) => (
              <button
                key={i}
                onClick={() => {
                  const updated = [...(contact.tags || []), st];
                  updateContact(contact.phone, { tags: updated });
                }}
                className="text-[10px] bg-[#111b21] hover:bg-[#202c33] text-[#8696a0] hover:text-[#e9edef] border border-[#222d34] px-2 py-0.5 rounded transition-colors"
              >
                + {st}
              </button>
            ))}
          </div>

          {/* Add custom tag input */}
          <form onSubmit={handleAddTag} className="flex gap-1.5 pt-1">
            <input 
              type="text"
              placeholder="Add custom tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="flex-1 bg-[#202c33] text-xs text-[#e9edef] placeholder-[#8696a0] border border-[#222d34] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#00a884]"
            />
            <button 
              type="submit"
              className="px-3 bg-[#00a884] hover:bg-[#008069] text-[#111b21] rounded-lg text-xs font-bold"
            >
              Add
            </button>
          </form>
        </div>

        {/* Agent Custom Notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-[#8696a0] uppercase flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5 text-[#00a884]" />
              Agent Notes
            </h4>
            {isSavingNotes && (
              <span className="text-[10px] text-[#00a884]">Saving...</span>
            )}
          </div>

          <textarea
            rows={4}
            placeholder="Add internal CRM notes about this lead (e.g. Budget, preferred location, follow-up date)..."
            value={notes}
            onChange={handleNotesChange}
            className="w-full bg-[#202c33] text-xs text-[#e9edef] placeholder-[#8696a0] border border-[#222d34] rounded-xl p-3 outline-none focus:border-[#00a884] leading-relaxed resize-none"
          />
        </div>

        {/* Test Trigger: Inbound Simulation */}
        <div className="pt-4 border-t border-[#222d34]">
          <button
            onClick={() => simulateInboundMessage({
              phone: contact.phone,
              name: contact.name,
              body: 'I want to speak with an investment agent right now.',
              type: 'text'
            })}
            className="w-full py-2 bg-[#202c33] hover:bg-[#2a3942] border border-[#222d34] text-[#e9edef] text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <MessageSquare className="w-4 h-4 text-[#00a884]" />
            Simulate Inbound Customer Reply
          </button>
        </div>
      </div>
    </div>
  );
}

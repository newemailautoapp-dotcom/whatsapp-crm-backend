import React, { useState } from 'react';
import { 
  Search, 
  MessageSquarePlus, 
  MoreVertical, 
  SlidersHorizontal, 
  CheckCheck, 
  Clock, 
  AlertCircle,
  UserCheck,
  Zap,
  Settings
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

export default function Sidebar({ 
  contacts = [], 
  selectedContact, 
  onSelectContact, 
  activeTab, 
  setActiveTab,
  searchQuery,
  setSearchQuery,
  onOpenSettings,
  onOpenSimulator,
  currentUser
}) {
  const formatTime = (ts) => {
    if (!ts) return '';
    try {
      let date;
      if (typeof ts?.toDate === 'function') {
        date = ts.toDate();
      } else if (typeof ts === 'number') {
        date = new Date(ts);
      } else if (typeof ts === 'object' && typeof ts.seconds === 'number') {
        date = new Date(ts.seconds * 1000);
      } else {
        date = new Date(ts);
      }

      if (isNaN(date.getTime())) return '';

      if (isToday(date)) {
        return format(date, 'HH:mm');
      }
      if (isYesterday(date)) {
        return 'Yesterday';
      }
      return format(date, 'dd/MM/yy');
    } catch (e) {
      return '';
    }
  };

  // Filter contacts based on active tab and search query
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone?.includes(searchQuery);

    if (!matchesSearch) return false;

    if (activeTab === 'unread') return (contact.unreadCount || 0) > 0;
    if (activeTab === 'broadcast') return contact.tags?.includes('Broadcast Leads');
    if (activeTab === 'optout') return contact.optedOut || contact.tags?.includes('Opt-Out');
    
    return true; // 'all'
  });

  return (
    <div className="w-80 md:w-96 flex flex-col bg-[#111b21] border-r border-[#222d34] h-full flex-shrink-0">
      {/* Top Header */}
      <div className="h-16 bg-[#202c33] px-4 flex items-center justify-between border-b border-[#222d34]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src={currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"} 
              alt="Agent Avatar" 
              className="w-10 h-10 rounded-full object-cover border border-[#00a884]"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] rounded-full border-2 border-[#202c33]"></span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#e9edef] leading-tight">
              {currentUser?.name || "Agent Support"}
            </h2>
            <span className="text-xs text-[#00a884] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse"></span>
              Live Inbox Active
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <button 
            onClick={onOpenSimulator}
            title="Open Webhook & Event Simulator"
            className="p-2 text-[#8696a0] hover:text-[#00a884] hover:bg-[#2a3942] rounded-full transition-colors relative"
          >
            <Zap className="w-5 h-5 text-amber-400" />
          </button>
          <button 
            onClick={onOpenSettings}
            title="Meta WABA Settings"
            className="p-2 text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] rounded-full transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="p-2.5 bg-[#111b21]">
        <div className="relative flex items-center bg-[#202c33] rounded-lg px-3 py-1.5 focus-within:ring-1 focus-within:ring-[#00a884]">
          <Search className="w-4 h-4 text-[#8696a0] mr-2 flex-shrink-0" />
          <input 
            type="text"
            placeholder="Search contacts or phone number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-[#e9edef] placeholder-[#8696a0] outline-none"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center px-2 pb-2 gap-1 border-b border-[#222d34] overflow-x-auto no-scrollbar">
        {[
          { id: 'all', label: 'All' },
          { id: 'unread', label: 'Unread' },
          { id: 'broadcast', label: 'Broadcast Leads' },
          { id: 'optout', label: 'Stopped / Opt-Out' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1 text-xs rounded-full font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id 
                ? 'bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40' 
                : 'bg-[#202c33] text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="p-8 text-center text-[#8696a0]">
            <p className="text-sm">No contacts found</p>
            <p className="text-xs mt-1 text-[#8696a0]/70">Try updating search or filter tab</p>
          </div>
        ) : (
          filteredContacts.map(contact => {
            const isSelected = selectedContact?.phone === contact.phone;
            const hasUnread = (contact.unreadCount || 0) > 0;

            return (
              <div
                key={contact.phone}
                onClick={() => onSelectContact(contact)}
                className={`flex items-center px-3 py-3 gap-3 cursor-pointer border-b border-[#222d34]/40 transition-colors ${
                  isSelected ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
                }`}
              >
                {/* Contact Avatar & 24h status indicator dot */}
                <div className="relative flex-shrink-0">
                  <img 
                    src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=00a884&color=fff`}
                    alt={contact.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  {/* 24h Window dot: Green active, Red expired */}
                  <span 
                    title={contact.is24hActive ? '24h Customer Session Active' : '24h Customer Session Expired (Template Required)'}
                    className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#111b21] ${
                      contact.is24hActive ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                </div>

                {/* Info & Last Message */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className={`text-sm font-semibold truncate ${hasUnread ? 'text-[#e9edef]' : 'text-[#e9edef]/90'}`}>
                      {contact.name || contact.phone}
                    </h3>
                    <span className={`text-xs ${hasUnread ? 'text-[#00a884] font-semibold' : 'text-[#8696a0]'}`}>
                      {formatTime(contact.lastMessageTimestamp)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-xs truncate ${hasUnread ? 'text-[#e9edef] font-medium' : 'text-[#8696a0]'}`}>
                      {contact.lastMessage || 'No messages yet'}
                    </p>

                    {hasUnread && (
                      <span className="ml-2 bg-[#00a884] text-[#111b21] text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {contact.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Tags badge row */}
                  {contact.tags && contact.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {contact.tags.slice(0, 2).map((tag, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.2 rounded bg-[#202c33] text-[#8696a0] border border-[#222d34]">
                          {tag}
                        </span>
                      ))}
                      {contact.tags.length > 2 && (
                        <span className="text-[10px] text-[#8696a0]">+{contact.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

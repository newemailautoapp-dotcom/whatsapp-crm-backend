import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Paperclip, 
  Smile, 
  Check, 
  CheckCheck, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Sparkles,
  Info,
  ChevronDown,
  ShieldCheck,
  Zap,
  PhoneCall
} from 'lucide-react';
import { format } from 'date-fns';
import { META_TEMPLATES } from '../data/templates';
import { sendOutboundMessage, toggle24hWindow } from '../firebase/storeService';

export default function ChatWindow({ 
  contact, 
  messages = [], 
  onToggleRightSidebar, 
  showRightSidebar 
}) {
  const [inputText, setInputText] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(META_TEMPLATES[0]);
  const [templateParams, setTemplateParams] = useState({});
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update default template parameters when selected template or contact changes
  useEffect(() => {
    if (selectedTemplate && contact) {
      const initialParams = {};
      selectedTemplate.placeholders.forEach((ph, i) => {
        if (i === 0) initialParams[0] = contact.name || 'Valued Client';
        else if (ph.toLowerCase().includes('date')) initialParams[i] = 'Tomorrow 3:00 PM';
        else if (ph.toLowerCase().includes('code')) initialParams[i] = 'YAS2026';
        else initialParams[i] = `Value ${i + 1}`;
      });
      setTemplateParams(initialParams);
    }
  }, [selectedTemplate, contact]);

  if (!contact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#111b21] chat-pattern p-6 text-center border-r border-[#222d34]">
        <div className="w-20 h-20 rounded-full bg-[#202c33] flex items-center justify-center mb-4 text-[#00a884]">
          <FileText className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-[#e9edef] mb-2">WhatsApp Live Inbox & CRM</h2>
        <p className="text-sm text-[#8696a0] max-w-md">
          Select a customer contact from the left sidebar to start real-time messaging, review lead tags, or dispatch Meta pre-approved templates.
        </p>
      </div>
    );
  }

  const handleSendText = async (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText('');

    await sendOutboundMessage({
      phone: contact.phone,
      body: textToSend,
      type: 'text'
    });
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate) return;

    let bodyText = selectedTemplate.body;
    selectedTemplate.placeholders.forEach((ph, i) => {
      const val = templateParams[i] || `[${ph}]`;
      bodyText = bodyText.replace(`{{${i + 1}}}`, val);
    });

    await sendOutboundMessage({
      phone: contact.phone,
      body: bodyText,
      type: 'template',
      templateName: selectedTemplate.name
    });

    setShowTemplateModal(false);
  };

  // Safe message time formatter preventing Date parsing crashes
  const formatMsgTime = (ts) => {
    if (!ts) return format(new Date(), 'HH:mm');
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

      if (isNaN(date.getTime())) return format(new Date(), 'HH:mm');
      return format(date, 'HH:mm');
    } catch (e) {
      return format(new Date(), 'HH:mm');
    }
  };

  // 24h Window Expiry check
  const now = Date.now();
  const is24hActive = contact.is24hActive && contact.windowExpiry && contact.windowExpiry > now;
  const hoursLeft = is24hActive ? Math.max(0, Math.floor((contact.windowExpiry - now) / (1000 * 60 * 60))) : 0;
  const minsLeft = is24hActive ? Math.max(0, Math.floor(((contact.windowExpiry - now) % (1000 * 60 * 60)) / (1000 * 60))) : 0;

  return (
    <div className="flex-1 flex flex-col bg-[#0b141a] chat-pattern h-full min-w-0 border-r border-[#222d34] relative">
      {/* Header */}
      <div className="h-16 bg-[#202c33] px-4 flex items-center justify-between border-b border-[#222d34] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <img 
            src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=00a884&color=fff`}
            alt={contact.name}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#e9edef] truncate">{contact.name}</h2>
            <p className="text-xs text-[#8696a0] truncate">+{contact.phone}</p>
          </div>
        </div>

        {/* 24-Hour Session Indicator Badge */}
        <div className="flex items-center gap-2">
          {is24hActive ? (
            <div 
              title="Within 24h customer window. Free text replies allowed."
              className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/30 flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              24h Session Active ({hoursLeft}h {minsLeft}m)
            </div>
          ) : (
            <div 
              title="24h Customer window expired. WhatsApp policy requires pre-approved Meta Template."
              className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-medium border border-rose-500/30 flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              24h Window Expired (Template Required)
            </div>
          )}

          <button 
            onClick={() => setShowTemplateModal(true)}
            className="px-3 py-1.5 bg-[#00a884] hover:bg-[#008069] text-[#111b21] text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Meta Templates
          </button>

          <button 
            onClick={onToggleRightSidebar}
            title="Toggle Lead Profile & Notes"
            className={`p-2 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors ${
              showRightSidebar ? 'bg-[#2a3942] text-[#00a884]' : ''
            }`}
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 24-Hour Session Expiration Alert Banner */}
      {!is24hActive && (
        <div className="bg-amber-900/30 border-b border-amber-600/30 px-4 py-2 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Customer Session Expired:</strong> Standard text messages might not reach the user. Send a Meta Template Message to restart conversation.
            </span>
          </div>
          <button 
            onClick={() => setShowTemplateModal(true)}
            className="text-amber-400 underline font-semibold hover:text-amber-300 ml-2"
          >
            Send Template
          </button>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center my-12 text-[#8696a0]">
            <p className="text-xs">No previous message history.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOutbound = msg.direction === 'outbound';

            return (
              <div 
                key={msg.id}
                className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'} animate-fade-in`}
              >
                <div 
                  className={`max-w-[85%] md:max-w-[70%] rounded-lg px-3 py-2 text-sm relative shadow-md ${
                    isOutbound 
                      ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none' 
                      : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                  }`}
                >
                  {/* Template Header Badge if message is template */}
                  {msg.type === 'template' && (
                    <div className="mb-1.5 pb-1 border-b border-white/10 flex items-center justify-between text-[11px] font-semibold text-[#00a884]">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Template: {msg.templateName}
                      </span>
                      <span className="bg-[#00a884]/20 px-1.5 py-0.5 rounded text-[10px]">META APPROVED</span>
                    </div>
                  )}

                  {/* Button Reply indicator */}
                  {msg.type === 'button_reply' && (
                    <div className="mb-1 text-[11px] text-[#00a884] font-medium flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Quick Reply Action Clicked
                    </div>
                  )}

                  {/* Message Body */}
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>

                  {/* Footer Timestamp & Delivery Status Ticks */}
                  <div className="flex items-center justify-end gap-1 text-[10px] text-[#8696a0] mt-1 float-right ml-4">
                    <span>{formatMsgTime(msg.timestamp)}</span>

                    {isOutbound && (
                      <span className="ml-1">
                        {msg.status === 'sent' && (
                          <Check className="w-3.5 h-3.5 text-gray-400 inline" title="Sent" />
                        )}
                        {msg.status === 'delivered' && (
                          <CheckCheck className="w-3.5 h-3.5 text-gray-400 inline" title="Delivered" />
                        )}
                        {msg.status === 'read' && (
                          <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] inline" title="Read" />
                        )}
                        {msg.status === 'failed' && (
                          <span className="text-red-400 font-bold" title="Delivery Failed">!</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSendText} className="p-3 bg-[#202c33] border-t border-[#222d34] flex items-center gap-2">
        <button 
          type="button"
          onClick={() => setShowTemplateModal(true)}
          title="Insert Meta Approved Template"
          className="p-2 text-[#8696a0] hover:text-[#00a884] hover:bg-[#2a3942] rounded-full transition-colors"
        >
          <Sparkles className="w-5 h-5 text-[#00a884]" />
        </button>

        <input 
          type="text"
          placeholder={
            is24hActive 
              ? "Type a WhatsApp message..." 
              : "24h Session expired. Recommended to use Meta Template..."
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 bg-[#2a3942] text-sm text-[#e9edef] placeholder-[#8696a0] px-4 py-2.5 rounded-lg outline-none focus:ring-1 focus:ring-[#00a884]"
        />

        <button 
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 bg-[#00a884] hover:bg-[#008069] disabled:opacity-40 text-[#111b21] rounded-full transition-colors"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>

      {/* Meta Template Selector Modal */}
      {showTemplateModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#202c33] border border-[#222d34] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-[#222d34] flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#00a884]">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold text-[#e9edef]">Select Meta Approved Template</h3>
              </div>
              <button 
                onClick={() => setShowTemplateModal(false)}
                className="text-[#8696a0] hover:text-[#e9edef]"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-xs text-[#8696a0] font-medium block mb-1.5">Choose Template</label>
                <select
                  value={selectedTemplate?.id}
                  onChange={(e) => {
                    const tmpl = META_TEMPLATES.find(t => t.id === e.target.value);
                    if (tmpl) setSelectedTemplate(tmpl);
                  }}
                  className="w-full bg-[#111b21] text-sm text-[#e9edef] border border-[#222d34] rounded-lg p-2.5 outline-none focus:border-[#00a884]"
                >
                  {META_TEMPLATES.map(tmpl => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.title} ({tmpl.name}) - {tmpl.category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Preview Card */}
              {selectedTemplate && (
                <div className="bg-[#111b21] border border-[#222d34] rounded-lg p-4 text-xs">
                  <div className="flex items-center justify-between text-[#8696a0] mb-2">
                    <span>Category: {selectedTemplate.category}</span>
                    <span>Lang: {selectedTemplate.language}</span>
                  </div>
                  <p className="text-[#e9edef] text-sm leading-relaxed mb-3">{selectedTemplate.body}</p>

                  {selectedTemplate.buttons?.length > 0 && (
                    <div className="pt-2 border-t border-[#222d34] space-y-1">
                      <span className="text-[10px] text-[#8696a0]">Interactive Quick Reply Buttons:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedTemplate.buttons.map((btn, i) => (
                          <span key={i} className="px-2.5 py-1 bg-[#202c33] text-[#00a884] rounded font-semibold text-xs border border-[#00a884]/30">
                            {btn.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Parameter Placeholders */}
              {selectedTemplate?.placeholders?.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider">Template Variables</h4>
                  {selectedTemplate.placeholders.map((ph, idx) => (
                    <div key={idx}>
                      <label className="text-xs text-[#e9edef] block mb-1">
                        Variable &#123;&#123;{idx + 1}&#125;&#125; ({ph}):
                      </label>
                      <input 
                        type="text"
                        value={templateParams[idx] || ''}
                        onChange={(e) => setTemplateParams({ ...templateParams, [idx]: e.target.value })}
                        className="w-full bg-[#111b21] text-sm text-[#e9edef] border border-[#222d34] rounded-lg px-3 py-2 outline-none focus:border-[#00a884]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-[#111b21] border-t border-[#222d34] flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#8696a0] hover:text-[#e9edef]"
              >
                Cancel
              </button>
              <button 
                onClick={handleSendTemplate}
                className="px-4 py-2 bg-[#00a884] hover:bg-[#008069] text-[#111b21] text-xs font-bold rounded-lg flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Dispatch Template Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

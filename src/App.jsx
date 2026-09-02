import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import ContactDetails from './components/ContactDetails';
import WebhookSimulator from './components/WebhookSimulator';
import MetaSettingsModal from './components/MetaSettingsModal';
import AuthModal from './components/AuthModal';
import { subscribeToContacts, subscribeToMessages, markContactAsRead } from './firebase/storeService';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('UI Exception caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#111b21] text-[#e9edef] p-6 text-center">
          <div className="bg-[#202c33] border border-[#222d34] p-8 rounded-2xl max-w-md space-y-4">
            <h2 className="text-lg font-bold text-amber-400">Dashboard Temporary Display Alert</h2>
            <p className="text-xs text-[#8696a0] leading-relaxed">
              A data formatting issue occurred while rendering message details. Click below to refresh your live session.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-5 py-2.5 bg-[#00a884] hover:bg-[#008069] text-[#111b21] font-bold text-xs rounded-xl"
            >
              Reload Live CRM Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  
  // UI states
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);

  // Subscribe to real-time contacts
  useEffect(() => {
    const unsubscribe = subscribeToContacts((updatedContacts) => {
      setContacts(updatedContacts);
      
      // Auto-select first contact if none selected
      if (updatedContacts.length > 0 && !selectedContact) {
        setSelectedContact(updatedContacts[0]);
      } else if (selectedContact) {
        // Keep selected contact reference fresh
        const fresh = updatedContacts.find(c => c.phone === selectedContact.phone);
        if (fresh) setSelectedContact(fresh);
      }
    });

    return () => unsubscribe();
  }, [selectedContact?.phone]);

  // Subscribe to real-time messages for currently selected contact
  useEffect(() => {
    if (!selectedContact?.phone) {
      setMessages([]);
      return;
    }

    // Mark as read when selected
    markContactAsRead(selectedContact.phone);

    const unsubscribe = subscribeToMessages(selectedContact.phone, (newMessages) => {
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [selectedContact?.phone]);

  // Show Auth Modal if not authenticated
  if (!currentUser) {
    return <AuthModal onAuthSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="flex h-screen w-screen bg-[#111b21] overflow-hidden select-none">
      {/* Left Sidebar - Contacts & Search */}
      <Sidebar 
        contacts={contacts}
        selectedContact={selectedContact}
        onSelectContact={(c) => {
          setSelectedContact(c);
          markContactAsRead(c.phone);
        }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenSimulator={() => setShowSimulatorModal(true)}
        currentUser={currentUser}
      />

      {/* Main Chat Feed */}
      <ChatWindow 
        contact={selectedContact}
        messages={messages}
        onToggleRightSidebar={() => setShowRightSidebar(!showRightSidebar)}
        showRightSidebar={showRightSidebar}
      />

      {/* Right Sidebar - Contact Info, Tags & Agent Notes */}
      {showRightSidebar && selectedContact && (
        <ContactDetails 
          contact={selectedContact}
          onClose={() => setShowRightSidebar(false)}
        />
      )}

      {/* Meta Settings Configuration Modal */}
      {showSettingsModal && (
        <MetaSettingsModal onClose={() => setShowSettingsModal(false)} />
      )}

      {/* Meta Webhook & Event Simulator Modal */}
      {showSimulatorModal && (
        <WebhookSimulator 
          contacts={contacts}
          selectedContact={selectedContact}
          onClose={() => setShowSimulatorModal(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

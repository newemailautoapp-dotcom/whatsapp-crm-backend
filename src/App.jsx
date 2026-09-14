import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import ContactDetails from './components/ContactDetails';
import WebhookSimulator from './components/WebhookSimulator';
import MetaSettingsModal from './components/MetaSettingsModal';
import AuthModal from './components/AuthModal';
import SuperAdminDashboard from './components/SuperAdminDashboard';
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
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_super_admin_session');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  
  // Routing state
  const [currentRoute, setCurrentRoute] = useState(
    window.location.pathname === '/super-admin' ? 'super-admin' : 'inbox'
  );

  // UI states
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);

  const tenantId = currentUser?.tenantId || 'usca_academy';

  // Handle browser URL navigation sync
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/super-admin') {
        setCurrentRoute('super-admin');
      } else {
        setCurrentRoute('inbox');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (routePath) => {
    const url = routePath === 'super-admin' ? '/super-admin' : '/';
    window.history.pushState({}, '', url);
    setCurrentRoute(routePath);
  };

  // Subscribe to real-time contacts scoped to tenantId
  useEffect(() => {
    if (!currentUser || currentRoute !== 'inbox') return;
    const unsubscribe = subscribeToContacts(tenantId, (updatedContacts) => {
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
  }, [currentUser, currentRoute, tenantId, selectedContact?.phone]);

  // Subscribe to real-time messages for currently selected contact scoped to tenantId
  useEffect(() => {
    if (!currentUser || currentRoute !== 'inbox' || !selectedContact?.phone) {
      setMessages([]);
      return;
    }

    // Mark as read when selected
    markContactAsRead(tenantId, selectedContact.phone);

    const unsubscribe = subscribeToMessages(tenantId, selectedContact.phone, (newMessages) => {
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [currentUser, currentRoute, tenantId, selectedContact?.phone]);

  // Show Auth Modal if not authenticated
  if (!currentUser) {
    return <AuthModal onAuthSuccess={(user) => setCurrentUser(user)} />;
  }

  // Render Super Admin Dashboard view if route is 'super-admin'
  if (currentRoute === 'super-admin') {
    return (
      <div className="w-full h-screen overflow-y-auto bg-[#0b141a]">
        <SuperAdminDashboard 
          currentUser={currentUser} 
          onNavigateToInbox={() => navigateTo('inbox')} 
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#111b21] overflow-hidden select-none">
      {/* Left Sidebar - Contacts & Search */}
      <Sidebar 
        contacts={contacts}
        selectedContact={selectedContact}
        onSelectContact={(c) => {
          setSelectedContact(c);
          markContactAsRead(tenantId, c.phone);
        }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenSimulator={() => setShowSimulatorModal(true)}
        onNavigateToSuperAdmin={() => navigateTo('super-admin')}
        currentUser={currentUser}
        tenantId={tenantId}
      />

      {/* Main Chat Feed */}
      <ChatWindow 
        contact={selectedContact}
        messages={messages}
        onToggleRightSidebar={() => setShowRightSidebar(!showRightSidebar)}
        showRightSidebar={showRightSidebar}
        tenantId={tenantId}
      />

      {/* Right Sidebar - Contact Info, Tags & Agent Notes */}
      {showRightSidebar && selectedContact && (
        <ContactDetails 
          contact={selectedContact}
          tenantId={tenantId}
          onClose={() => setShowRightSidebar(false)}
        />
      )}

      {/* Meta Settings Configuration Modal */}
      {showSettingsModal && (
        <MetaSettingsModal tenantId={tenantId} onClose={() => setShowSettingsModal(false)} />
      )}

      {/* Meta Webhook & Event Simulator Modal */}
      {showSimulatorModal && (
        <WebhookSimulator 
          contacts={contacts}
          selectedContact={selectedContact}
          tenantId={tenantId}
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

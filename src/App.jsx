import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import ContactDetails from './components/ContactDetails';
import WebhookSimulator from './components/WebhookSimulator';
import MetaSettingsModal from './components/MetaSettingsModal';
import AuthModal from './components/AuthModal';
import { subscribeToContacts, subscribeToMessages, markContactAsRead } from './firebase/storeService';

export default function App() {
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

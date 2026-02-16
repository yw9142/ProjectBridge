import React, { useState } from 'react';
import { ViewState } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './views/Dashboard';
import { Posts } from './views/Posts';
import { Requests } from './views/Requests';
import { Decisions } from './views/Decisions';
import { Files } from './views/Files';
import { Meetings } from './views/Meetings';
import { Contracts } from './views/Contracts';
import { Billing } from './views/Billing';
import { Vault } from './views/Vault';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');

  const renderView = () => {
    switch (currentView) {
      case 'DASHBOARD': return <Dashboard />;
      case 'POSTS': return <Posts />;
      case 'REQUESTS': return <Requests />;
      case 'DECISIONS': return <Decisions />;
      case 'FILES': return <Files />;
      case 'MEETINGS': return <Meetings />;
      case 'CONTRACTS': return <Contracts />;
      case 'BILLING': return <Billing />;
      case 'VAULT': return <Vault />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      
      <div className="flex-1 ml-64 flex flex-col">
        <Header />
        <main className="flex-1 p-8 overflow-y-auto h-[calc(100vh-64px)]">
          <div className="max-w-7xl mx-auto">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
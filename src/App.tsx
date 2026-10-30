import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar, TabId } from './components/Sidebar';
import { Spinner } from './components/ui';
import { DashboardPage } from './pages/DashboardPage';
import { SentimentAnalysisPage } from './pages/SentimentAnalysisPage';
import { ReviewsManagementPage } from './pages/ReviewsManagementPage';
import { ReportsPage } from './pages/ReportsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

const TITLES: Record<TabId, string> = {
  dashboard: 'Dashboard',
  analysis: 'Sentiment Analysis',
  reviews: 'Customer Reviews',
  reports: 'Reports',
};

function MainApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return authView === 'login' ? (
      <LoginPage onSwitchToRegister={() => setAuthView('register')} onSuccess={() => setActiveTab('dashboard')} />
    ) : (
      <RegisterPage onSwitchToLogin={() => setAuthView('login')} onSuccess={() => setActiveTab('dashboard')} />
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar activeTab={activeTab} onSelect={setActiveTab} isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="lg:pl-60 min-h-screen flex flex-col">
        <header className="lg:hidden h-14 bg-navy-900 text-white flex items-center gap-3 px-4 sticky top-0 z-30">
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="p-1">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-medium">{TITLES[activeTab]}</span>
        </header>

        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {activeTab === 'dashboard' && <DashboardPage onViewReviews={() => setActiveTab('reviews')} />}
          {activeTab === 'analysis' && <SentimentAnalysisPage />}
          {activeTab === 'reviews' && <ReviewsManagementPage />}
          {activeTab === 'reports' && <ReportsPage />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

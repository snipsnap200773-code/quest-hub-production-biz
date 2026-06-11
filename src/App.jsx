import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';

// --- 🛍️ 一般・利用者向けページ ---
import Home from './pages/Home';
import ShopList from './pages/ShopList';
import ShopDetail from './pages/ShopDetail';
import InitialSetup from './pages/InitialSetup';
import TrialRegistration from './pages/TrialRegistration';
import ResetPassword from './pages/ResetPassword';

// 🆕 ゲーム関連ページをインポート
import GameDashboard from './pages/Game/GameDashboard';
import AdventurePage from './pages/Game/Adventure/AdventurePage';

// --- 📅 予約システム ---
import ReservationForm from './pages/ReservationForm';
import TimeSelectionCalendar from './pages/TimeSelectionCalendar'; 
import ConfirmReservation from './pages/ConfirmReservation';
import CancelReservation from './pages/CancelReservation';
import ReservedSuccess from './pages/ReservedSuccess';

// --- 🛠️ 共通コンポーネント ---
import ShopSearch from './components/ShopSearch';
import InquiryForm from './components/InquiryForm';
import ScrollToTop from './components/ScrollToTop';
import FacilitySearch from './components/FacilitySearch';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <Router>
      <ScrollToTop />

      <div className="mobile-container" style={{ 
        margin: '0 auto', 
        maxWidth: '480px', 
        minHeight: '100vh', 
        position: 'relative',
        backgroundColor: '#f4f7f9',
        boxShadow: '0 0 20px rgba(0,0,0,0.05)',
        overflowX: 'hidden'
      }}>

        {!isOnline && (
          <div style={{ position: 'sticky', top: 0, left: 0, right: 0, zIndex: 9999, background: '#ef4444', color: 'white', textAlign: 'center', padding: '8px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <WifiOff size={16} /> ネットワークが不安定です。
          </div>
        )}

        <Routes>
          {/* --- 🏠 メイン・ポータル --- */}
          <Route path="/" element={<Home />} />
          <Route path="/category/:categoryId" element={<ShopList />} />
          <Route path="/shop/:shopId/detail" element={<ShopDetail />} />
          <Route path="/search" element={<ShopSearch />} />
          <Route path="/inquiry" element={<InquiryForm />} />

          {/* --- 🎮 ゲーミフィケーションエリア --- */}
          <Route path="/game" element={<GameDashboard />} />
          <Route path="/game/adventure" element={<AdventurePage />} />

          {/* --- 📅 予約フロー --- */}
          <Route path="/shop/:shopId/reserve" element={<ReservationForm />} />
          <Route path="/shop/:shopId/reserve/time" element={<TimeSelectionCalendar />} />
          <Route path="/shop/:shopId/confirm" element={<ConfirmReservation />} />
          <Route path="/cancel" element={<CancelReservation />} />
          <Route path="/reserved-success" element={<ReservedSuccess />} />

          {/* --- 🚀 新規登録・初期設定 --- */}
          <Route path="/trial-registration" element={<TrialRegistration />} />
          <Route path="/setup" element={<InitialSetup />} />
          <Route path="/facility-search" element={<FacilitySearch />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* 迷子防止（ホームへ強制送還） */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
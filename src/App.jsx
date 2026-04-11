import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';

// --- 🛍️ 一般・利用者向けページ ---
import Home from './pages/Home';
import ShopList from './pages/ShopList';
import ShopDetail from './pages/ShopDetail';
import InitialSetup from './pages/InitialSetup';
import TrialRegistration from './pages/TrialRegistration';

// 🆕 パスワード再設定ページをインポート
import ResetPassword from './pages/ResetPassword';

// --- 📅 予約システム ---
import ReservationForm from './pages/ReservationForm';
import TimeSelectionCalendar from './pages/TimeSelectionCalendar'; 
import ConfirmReservation from './pages/ConfirmReservation';
import CancelReservation from './pages/CancelReservation';

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
          {/* 稼働中のAppに合わせて調整 */}
          <Route path="/inquiry" element={<InquiryForm />} />

          {/* --- 📅 予約フロー：ここが今回の「迷子」の犯人でした！ --- */}
          <Route path="/shop/:shopId/reserve" element={<ReservationForm />} />
          {/* 修正：/calendar をやめて、稼働中と同じ /reserve/time に戻しました */}
          <Route path="/shop/:shopId/reserve/time" element={<TimeSelectionCalendar />} />
          <Route path="/shop/:shopId/confirm" element={<ConfirmReservation />} />
          {/* 修正：/cancel-reservation を /cancel に戻しました */}
          <Route path="/cancel" element={<CancelReservation />} />

          {/* --- 🚀 新規登録・初期設定：ここも稼働中に合わせました --- */}
          <Route path="/trial-registration" element={<TrialRegistration />} />
          {/* 修正：/initial-setup を /setup に戻しました */}
          <Route path="/setup" element={<InitialSetup />} />

          <Route path="/facility-search" element={<FacilitySearch />} />

          {/* 🆕 パスワード再設定用の道（ルート）を追加 */}
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* 迷子防止（ホームへ強制送還） */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
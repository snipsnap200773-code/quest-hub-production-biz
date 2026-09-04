import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { WifiOff } from 'lucide-react';

// --- 🛍️ 一般・利用者向けページ ---
import Home from './pages/Home';
import ShopList from './pages/ShopList';
import ShopDetail from './pages/ShopDetail';
import InitialSetup from './pages/InitialSetup';
import TrialRegistration from './pages/TrialRegistration';
import ResetPassword from './pages/ResetPassword';

// 🆕 事業者向けオフィシャルサイト（LP）
import LandingPage from './pages/LandingPage';

// 🆕 デモ用コンポーネントをインポート
import DemoAdminReservations from './components/demos/DemoAdminReservations';

// 🎮 ゲーム関連ページ
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

// --- 📄 法務・お問い合わせページ ---
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import Legal from './pages/legal/Legal';
import Contact from './pages/legal/Contact';

// 💡 PCフル画面で表示するパス（事業者向けページ）
const FULL_SCREEN_PATHS = ['/biz', '/terms', '/privacy', '/legal', '/contact'];

// 🆕 ルーティングの中身を別コンポーネント化（URL判定のため）
function AppContent({ isOnline }) {
  const location = useLocation();
  // 💡 事業者向けページと /demo /trial の時は横幅100%（PCフル画面）を許可する
  const isFullScreenRoute =
    FULL_SCREEN_PATHS.includes(location.pathname) ||
    location.pathname.startsWith('/demo') ||
    location.pathname.startsWith('/trial');

  return (
    <div 
      className={isFullScreenRoute ? "lp-container" : "mobile-container"} 
      style={{ 
        margin: '0 auto', 
        // 💡 ここがポイント：フルスクリーン許可ルートなら100%、それ以外はスマホ幅(480px)
        maxWidth: isFullScreenRoute ? '100%' : '480px', 
        minHeight: '100vh', 
        position: 'relative',
        backgroundColor: isFullScreenRoute ? '#fff' : '#f4f7f9',
        boxShadow: isFullScreenRoute ? 'none' : '0 0 20px rgba(0,0,0,0.05)',
        overflowX: 'hidden'
      }}
    >
      {!isOnline && (
        <div style={{ position: 'sticky', top: 0, left: 0, right: 0, zIndex: 9999, background: '#ef4444', color: 'white', textAlign: 'center', padding: '8px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <WifiOff size={16} /> ネットワークが不安定です。
        </div>
      )}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/category/:categoryId" element={<ShopList />} />
        <Route path="/shop/:shopId/detail" element={<ShopDetail />} />
        <Route path="/search" element={<ShopSearch />} />
        <Route path="/inquiry" element={<InquiryForm />} />

        <Route path="/game" element={<GameDashboard />} />
        <Route path="/game/adventure" element={<AdventurePage />} />

        <Route path="/shop/:shopId/reserve" element={<ReservationForm />} />
        <Route path="/shop/:shopId/reserve/time" element={<TimeSelectionCalendar />} />
        <Route path="/shop/:shopId/confirm" element={<ConfirmReservation />} />
        <Route path="/cancel" element={<CancelReservation />} />
        <Route path="/reserved-success" element={<ReservedSuccess />} />

        {/* LPと登録 */}
        <Route path="/biz" element={<LandingPage />} />
        
        {/* 🆕 デモ用の専用ルートを追加 */}
        <Route path="/demo/calendar" element={<DemoAdminReservations />} />
        
        <Route path="/trial-registration" element={<TrialRegistration />} />
        <Route path="/trial" element={<Navigate to="/trial-registration" replace />} />
        
        <Route path="/setup" element={<InitialSetup />} />
        <Route path="/facility-search" element={<FacilitySearch />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* 📄 法務・お問い合わせ */}
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/legal" element={<Legal />} />
        <Route path="/contact" element={<Contact />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

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
      <AppContent isOnline={isOnline} />
    </Router>
  );
}

export default App;

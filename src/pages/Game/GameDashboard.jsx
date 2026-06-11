import React from 'react';
import { useNavigate } from 'react-router-dom';

function GameDashboard() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>ゲームメニュー</h2>
      <button onClick={() => navigate('/game/adventure')} style={{ margin: '10px', padding: '10px 20px' }}>
        ダンジョン探索（TRPG）へ
      </button>
      <button disabled style={{ margin: '10px', padding: '10px 20px', opacity: 0.5 }}>
        マイホーム（準備中）
      </button>
    </div>
  );
}
export default GameDashboard;
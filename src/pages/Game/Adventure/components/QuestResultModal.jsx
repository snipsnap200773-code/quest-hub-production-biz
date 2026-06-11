import React, { useState } from 'react';
import { ShieldAlert, Sparkles, Coins, Package } from 'lucide-react';

const QuestResultModal = ({ isOpen, droppedItems, onClose }) => {
  if (!isOpen) return null;

  // 各アイテムの売却チェック状態を管理（デフォルトはすべてチェックなし＝持ち帰る）
  const [sellChecked, setSellChecked] = useState({});

  const handleCheckChange = (itemId) => {
    setSellChecked(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // 全て持ち帰る処理
  const handleTakeAll = () => {
    alert("すべてのアイテムをインベントリに持ち帰りました！");
    onClose();
  };

  // 選択売却して持ち帰る処理
  const handleSellSelected = () => {
    const sellCount = Object.values(sellChecked).filter(Boolean).length;
    const keepCount = droppedItems.length - sellCount;
    alert(`${sellCount}個のアイテムを売却し、${keepCount}個のアイテムを持ち帰りました！`);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#111', width: '100%', maxWidth: '400px', borderRadius: '24px',
        border: '2px solid #f59e0b', padding: '25px', color: '#fff', textAlign: 'center'
      }}>
        <div style={{ color: '#f59e0b', marginBottom: '10px' }}><Sparkles size={32} style={{margin: '0 auto'}} /></div>
        <h2 style={{ fontSize: '1.3rem', color: '#f59e0b', margin: '0 0 20px 0', letterSpacing: '2px' }}>探索完了・報酬獲得</h2>

        {/* ドロップリスト */}
        <div style={{ 
          background: '#050505', border: '1px solid #222', borderRadius: '12px', 
          padding: '10px', maxHeight: '200px', overflowY: 'auto', marginBottom: '25px', textAlign: 'left'
        }}>
          <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>獲得したアイテム</span>
            <span>売却チェック</span>
          </div>
          
          {droppedItems.map(item => (
            <div key={item.id} style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
              padding: '8px 0', borderBottom: '1px solid #111' 
            }}>
              <span style={{ fontSize: '0.85rem', color: item.rarity === 'rare' ? '#3b82f6' : '#fff' }}>
                {item.name}
              </span>
              <input 
                type="checkbox" 
                checked={!!sellChecked[item.id]} 
                onChange={() => handleCheckChange(item.id)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#ef4444' }}
              />
            </div>
          ))}
        </div>

        {/* ボタンエリア */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            onClick={handleTakeAll}
            style={{ 
              width: '100%', padding: '12px', borderRadius: '12px', 
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
              color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <Package size={16} /> 全て持ち帰る
          </button>
          
          <button 
            onClick={handleSellSelected}
            style={{ 
              width: '100%', padding: '12px', borderRadius: '12px', 
              background: '#222', color: '#ef4444', border: '1px solid #333', 
              fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <Coins size={16} /> チェックしたアイテムを売って他を持ち帰る
          </button>
        </div>

      </div>
    </div>
  );
};

export default QuestResultModal;
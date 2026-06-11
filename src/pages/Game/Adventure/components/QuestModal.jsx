import React from 'react';
import { X, Users, Swords } from 'lucide-react';

const QuestModal = ({ quest, onClose, onStart }) => {
  if (!quest) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#111', width: '100%', maxWidth: '400px', borderRadius: '24px',
        border: '2px solid #f59e0b', padding: '30px', position: 'relative'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={24} color="#666" />
        </button>

        <h2 style={{ fontSize: '1.4rem', color: '#f59e0b', textAlign: 'center', marginBottom: '20px' }}>{quest.name}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
            <span style={{ color: '#666', fontSize: '0.8rem' }}>推奨レベル</span>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>Lv. {quest.level}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
            <span style={{ color: '#666', fontSize: '0.8rem' }}>階層</span>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>地下 {quest.floors} 階</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ color: '#666', fontSize: '0.8rem' }}><Users size={14} /> 出撃パーティ選択</span>
            <select style={{ width: '100%', background: '#222', border: '1px solid #444', color: '#fff', padding: '10px', borderRadius: '8px' }}>
              <option>第一のパーティ (平均Lv.5)</option>
              <option disabled>第二のパーティ (未編成)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={onClose}
            style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#333', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
          >
            キャンセル
          </button>
          <button 
            onClick={onStart}
            style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Swords size={16} /> 探索開始
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestModal;
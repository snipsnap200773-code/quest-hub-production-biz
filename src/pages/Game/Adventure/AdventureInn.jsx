import React, { useState } from 'react';
import { Users, Backpack, ChevronRight } from 'lucide-react';
import AdventureCharacterList from './AdventureCharacterList'; 
import AdventureCharacterDetail from './AdventureCharacterDetail'; 
import AdventureInventory from './AdventureInventory'; // ⭕ コメントアウトを外して結合！

const AdventureInn = () => {
  const [subView, setSubView] = useState('top');
  const [selectedCharId, setSelectedCharId] = useState(null); 

  // 1. 👥 仲間一覧ページへの切り替え部分
  if (subView === 'characters') {
    return (
      <AdventureCharacterList 
        onBack={() => setSubView('top')} 
        onSelectCharacter={(id) => {
          setSelectedCharId(id);
          setSubView('detail'); 
        }}
      />
    );
  }

  // 2. 📝 仲間詳細・個別育成部屋
  if (subView === 'detail') {
    return (
      <AdventureCharacterDetail 
        characterId={selectedCharId} 
        onBack={() => setSubView('characters')} 
      />
    );
  }

  // 3. 🎒 修正点：仮置きを廃止し、本物の持ち物一覧（倉庫）コンポーネントを呼び出す！
  if (subView === 'inventory') {
    return (
      <AdventureInventory 
        onBack={() => setSubView('top')} // 戻るボタンで酒場トップ（カード選択）へ引き返す
      />
    );
  }

  // 4. 👑 酒場トップ（スッキリした2枚のカードUI）
  return (
    <div style={{ padding: '24px 20px 0 20px', color: '#fff' }}>
      
      {/* ギルドの看板ヘッダー */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#f59e0b', margin: '0 0 6px 0', letterSpacing: '2px' }}>
          🍺 ギルドの酒場
        </h2>
        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
          冒険者の管理と、共有倉庫の確認が行えます
        </p>
      </div>

      {/* カードを縦に2枚並べるコンテナ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* 💳 カード①：ギルド所属 of 仲間 */}
        <div 
          onClick={() => setSubView('characters')}
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            transition: 'transform 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#f59e0b';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#334155';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '12px', color: '#f59e0b' }}>
              <Users size={24} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>
                ギルド所属の仲間
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                ステータス割り振り・装備・名前変更
              </p>
            </div>
          </div>
          <ChevronRight size={20} color="#475569" />
        </div>

        {/* 💳 カード②：持っている道具一覧 */}
        <div 
          onClick={() => setSubView('inventory')}
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            transition: 'transform 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#f59e0b';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#334155';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '12px', borderRadius: '12px', color: '#34d399' }}>
              <Backpack size={24} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>
                持っている道具一覧
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                獲得した戦利品・アイテム倉庫の確認
              </p>
            </div>
          </div>
          <ChevronRight size={20} color="#475569" />
        </div>

      </div>

    </div>
  );
};

export default AdventureInn;
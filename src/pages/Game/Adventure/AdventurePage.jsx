import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { ChevronLeft, Sparkles, Swords } from 'lucide-react';
import AdventureActive from './AdventureActive'; 
import AdventureMainNav from './components/AdventureMainNav'; 
import QuestList from './QuestList'; // 🆕 インポート
import QuestModal from './components/QuestModal'; // 🆕 インポート

const AdventurePage = () => {
  const navigate = useNavigate();
  
  const [currentView, setCurrentView] = useState('tavern'); 
  const [isExploring, setIsExploring] = useState(false); // 冒険中（ログ画面）かどうか
  const [isQuestListOpen, setIsQuestListOpen] = useState(false); // クエスト一覧を表示しているか
  const [selectedQuest, setSelectedQuest] = useState(null); // ポップアップに出すクエスト

  return (
    <div style={{
      backgroundColor: '#000', minHeight: '100vh', color: '#fff',
      fontFamily: '"Hiragino Mincho ProN", serif', display: 'flex', flexDirection: 'column',
      maxWidth: '480px', margin: '0 auto', padding: '20px 0 130px 0', // 探索ボタン分、余白を増やす
      position: 'relative', boxSizing: 'border-box'
    }}>
      
      <div style={{ padding: '0 20px', marginBottom: '15px' }}>
        <button onClick={() => navigate('/game')} style={{ background: 'none', border: 'none', color: '#999', display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
          <ChevronLeft size={16} /> ゲームロビーへ
        </button>
      </div>

      {/* --- メインコンテンツ切り替え --- */}
      
      {currentView === 'tavern' && (
        <div style={{ flex: 1, padding: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{ fontSize: '1.8rem', letterSpacing: '4px', color: '#f59e0b', margin: '0' }}>冒険者の酒場</h1>
          </div>
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '15px' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}><Sparkles size={14} /> 待機中の冒険者一覧</h3>
            <p style={{ color: '#aaa', fontSize: '0.8rem' }}>仲間の管理はここで行います。</p>
          </div>
        </div>
      )}

      {currentView === 'formation' && (
        <div style={{ flex: 1, padding: '0 20px' }}><h2 style={{ fontSize: '1.5rem', color: '#f59e0b', textAlign: 'center' }}>パーティ編成・装備</h2></div>
      )}

      {/* --- 探索（explore）タブの挙動 --- */}
      {currentView === 'explore' && (
        <>
          {isExploring ? (
            /* 🆕 onReturnイベントを追加して、街（酒場）へ戻れるように接続 */
            <AdventureActive onReturn={() => {
              setIsExploring(false);
              setCurrentView('tavern'); // クエスト終了後は自動で酒場に戻る
            }} />
          ) : isQuestListOpen ? (
            <QuestList onSelectQuest={setSelectedQuest} />
          ) : (
            <div style={{ padding: '0 20px', textAlign: 'center' }}>
              <h1 style={{ fontSize: '2rem', letterSpacing: '4px', color: '#f59e0b', marginBottom: '40px' }}>QUEST HUB TRPG</h1>
              <div style={{ background: '#111', border: '1px solid #222', borderRadius: '8px', padding: '15px' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#f59e0b', margin: '0 0 10px 0' }}>出撃準備完了</h3>
                <p style={{ fontSize: '0.85rem', color: '#ccc' }}>パーティ：第一のパーティ</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ...事典と設定は省略（枠維持）... */}

      {/* 🛠️ 🆕 探索アイコンの上に「探索する」ボタンを表示（探索タブで、まだログ画面じゃない時のみ） */}
      {currentView === 'explore' && !isExploring && (
        <div style={{
          position: 'fixed', bottom: '70px', left: 0, right: 0, margin: '0 auto',
          width: '100%', maxWidth: '440px', padding: '0 20px', zIndex: 90
        }}>
          <button 
            onClick={() => setIsQuestListOpen(!isQuestListOpen)}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#fff', border: 'none', fontWeight: '900', fontSize: '1.1rem',
              cursor: 'pointer', boxShadow: '0 6px 20px rgba(217,119,6,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
            }}
          >
            <Swords size={20} /> {isQuestListOpen ? '準備画面に戻る' : '探索する'}
          </button>
        </div>
      )}

      <AdventureMainNav currentView={currentView} onViewChange={(view) => {
        setCurrentView(view);
        if (view !== 'explore') setIsQuestListOpen(false); // 他のタブに変えたらクエスト一覧は閉じる
      }} />

      {/* 🆕 クエスト詳細ポップアップ */}
      <QuestModal 
        quest={selectedQuest} 
        onClose={() => setSelectedQuest(null)} 
        onStart={() => {
          setSelectedQuest(null);
          setIsQuestListOpen(false);
          setIsExploring(true); // いざ冒険（ログ画面）へ！
        }}
      />

    </div>
  );
};

export default AdventurePage;
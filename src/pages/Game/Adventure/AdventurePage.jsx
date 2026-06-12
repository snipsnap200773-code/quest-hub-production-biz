import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { Swords, LogOut, Settings } from 'lucide-react';
import AdventureActive from './AdventureActive'; 
import AdventureMainNav from './components/AdventureMainNav'; 
import AdventureFormation from './AdventureFormation'; // 🆕 切り出した編成コンポーネントを呼ぶ
import QuestList from './QuestList'; 
import QuestModal from './components/QuestModal'; 
import AdventureInn from './AdventureInn'; 
import { gameServices } from '../../../gameServices';

const TEST_USER_ID = "d1669717-95f4-4f80-932f-d412576d55a7";

const AdventurePage = () => {
  const navigate = useNavigate();
  
  const [currentView, setCurrentView] = useState('tavern'); 
  const [isExploring, setIsExploring] = useState(false); 
  const [isQuestListOpen, setIsQuestListOpen] = useState(false); 
  const [selectedQuest, setSelectedQuest] = useState(null); 

  // 👥 状態データだけは、探索画面（Active）に引き渡すためにPage側で保持
  const [allCharacters, setAllCharacters] = useState([]); 
  // ⭕ 初期値はまずブラウザの記憶（localStorage）から読み込む。無ければ全員空っぽ
  const [currentPartyIds, setCurrentPartyIds] = useState(() => {
    const saved = localStorage.getItem('qh_trpg_party_ids');
    return saved ? JSON.parse(saved) : [null, null, null, null, null];
  });

  // 1. メンバー一覧をSupabaseからロードする処理（編成は上書きしない！）
  useEffect(() => {
    const loadGuildMembers = async () => {
      const charList = await gameServices.getPlayerCharacters(TEST_USER_ID);
      if (charList && charList.length > 0) {
        setAllCharacters(charList);
        
        // ⭕ 初めてプレイする時（記憶が全部空っぽの時）だけ、初期配置として太郎をセット
        const saved = localStorage.getItem('qh_trpg_party_ids');
        if (!saved) {
          const defaultParty = [charList[0].id, null, null, null, null];
          setCurrentPartyIds(defaultParty);
          localStorage.setItem('qh_trpg_party_ids', JSON.stringify(defaultParty));
        }
      }
    };
    loadGuildMembers();
  }, []);

  // 2. ⭕ パーティ編成が変更されたら、即座にブラウザの記憶（localStorage）に保存する関数
  const handlePartyChange = (newParty) => {
    setCurrentPartyIds(newParty);
    localStorage.setItem('qh_trpg_party_ids', JSON.stringify(newParty));
  };

  return (
    <div style={{
      backgroundColor: '#0f172a', minHeight: '100vh', color: '#fff',
      fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column',
      maxWidth: '480px', margin: '0 auto', padding: '0 0 130px 0', position: 'relative', boxSizing: 'border-box'
    }}>

      {/* --- 1. 酒場タブ --- */}
      {currentView === 'tavern' && (
        <div style={{ flex: 1, paddingTop: '0px' }}> {/* ⭕ 上部の余白をゼロにして編成・設定と高さを完全同期！ */}
          <AdventureInn />
        </div>
      )}

      {/* --- 2. 🛡️ 編成タブ（引っ越し完了でめちゃくちゃシンプルに！） --- */}
      {currentView === 'formation' && (
        <div style={{ flex: 1, padding: '20px 20px 0' }}>
          <AdventureFormation 
            allCharacters={allCharacters}
            currentPartyIds={currentPartyIds}
            onPartyChange={handlePartyChange} // ⭕ 記憶保存付きの関数へ変更！
          />
        </div>
      )}

      {/* --- 3. 探索タブ --- */}
      {currentView === 'explore' && (
        <>
          {isExploring ? (
            <AdventureActive 
              partyCharacterIds={currentPartyIds.filter(id => id !== null)} 
              onReturn={() => { setIsExploring(false); setCurrentView('tavern'); }} 
            />
          ) : isQuestListOpen ? (
            <div style={{ padding: '20px 20px 0', flex: 1 }}><QuestList onSelectQuest={setSelectedQuest} /></div>
          ) : (
            <div style={{ padding: '40px 20px 0', textAlign: 'center', flex: 1 }}>
              <h1 style={{ fontSize: '2rem', letterSpacing: '4px', color: '#f59e0b', marginBottom: '4px' }}>QUEST HUB TRPG</h1>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '40px' }}>ラグナロク・放置型自動探索フェーズ</p>
              <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#f59e0b', margin: '0 0 10px 0' }}>出撃準備完了</h3>
                <p style={{ fontSize: '0.85rem', color: '#ccc', margin: 0 }}>
                  現在の編成メンバー: {currentPartyIds.filter(id => id !== null).length} 名が待機中
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* --- 4. 事典タブ --- */}
      {currentView === 'encyclopedia' && (
        <div style={{ flex: 1, padding: '20px 20px 0' }}><AdventureInn /></div>
      )}

      {/* --- 5. 設定タブ --- */}
      {currentView === 'settings' && (
        <div style={{ flex: 1, padding: '20px 20px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{ fontSize: '1.4rem', color: '#f59e0b', margin: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Settings size={20}/>システム環境設定</h1>
          </div>
          <button 
            onClick={() => { if(isExploring && !window.confirm("ロビーに戻りますか？")) return; navigate('/game'); }}
            style={{ width: '100%', padding: '14px', borderRadius: '10px', background: '#1e293b', color: '#f43f5e', border: '1px solid #f43f5e', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <LogOut size={16} /> ゲームマスターロビーへ戻る
          </button>
        </div>
      )}

      {/* 探索ボタンのトリガー */}
      {currentView === 'explore' && !isExploring && (
        <div style={{ position: 'fixed', bottom: '70px', left: 0, right: 0, margin: '0 auto', width: '100%', maxWidth: '440px', padding: '0 20px', zIndex: 90 }}>
          <button 
            onClick={() => {
              if (currentPartyIds.filter(id => id !== null).length === 0) {
                alert("🚨 パーティに誰も配置されていません！「編成」タブから冒険者を配置してください。");
                return;
              }
              setIsQuestListOpen(!isQuestListOpen);
            }}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#fff', border: 'none', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 6px 20px rgba(217,119,6,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
            }}
          >
            <Swords size={20} /> {isQuestListOpen ? '準備画面に戻る' : '探索する'}
          </button>
        </div>
      )}

      <AdventureMainNav currentView={currentView} onViewChange={(view) => {
        setCurrentView(view);
        if (view !== 'explore') setIsQuestListOpen(false); 
      }} />

      <QuestModal 
        quest={selectedQuest} onClose={() => setSelectedQuest(null)} 
        onStart={() => { setSelectedQuest(null); setIsQuestListOpen(false); setIsExploring(true); }}
      />

    </div>
  );
};

export default AdventurePage;
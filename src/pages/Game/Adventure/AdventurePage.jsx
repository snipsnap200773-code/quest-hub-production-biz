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
import { supabase } from '../../../supabaseClient';

const TEST_USER_ID = "d1669717-95f4-4f80-932f-d412576d55a7";

const AdventurePage = () => {
  const navigate = useNavigate();
  
  const [currentView, setCurrentView] = useState('tavern'); 
  const [isExploring, setIsExploring] = useState(false); 
  const [isQuestListOpen, setIsQuestListOpen] = useState(false); 
  const [selectedQuest, setSelectedQuest] = useState(null); 

  // 👥 状態データだけは、探索画面（Active）に引き渡すためにPage側で保持
  const [allCharacters, setAllCharacters] = useState([]); 
  // ⭕ 初期値のデフォルトの器をセット
  const [currentPartyIds, setCurrentPartyIds] = useState([null, null, null, null, null]);

  // 1. メンバー一覧をSupabaseからロードする処理
  useEffect(() => {
    const loadGuildMembers = async () => {
      const charList = await gameServices.getPlayerCharacters(TEST_USER_ID);
      if (charList && charList.length > 0) {
        setAllCharacters(charList);
        
        // 現在DBに存在する本物のキャラクターIDだけのリストを作る
        const validIds = charList.map(ch => ch.id);
        
        const dbParty = [null, null, null, null, null];
        let hasDbParty = false;

        charList.forEach(ch => {
          if (ch.party_index !== null && ch.party_index !== undefined && ch.party_index >= 0 && ch.party_index < 5) {
            dbParty[ch.party_index] = ch.id;
            hasDbParty = true;
          }
        });

        if (hasDbParty) {
          setCurrentPartyIds(dbParty);
          localStorage.setItem('qh_trpg_party_ids', JSON.stringify(dbParty));
        } else {
          const saved = localStorage.getItem('qh_trpg_party_ids');
          if (saved) {
            const rawParty = JSON.parse(saved);
            
            // 🎯 ここです！保存されていたIDが、現在DBにいる4人のIDのどれとも一致しない場合は容赦なく null に書き換えます！
            const cleaned = rawParty.map(id => {
              if (id && validIds.includes(id)) {
                return id; // 本物の4人のいずれかなら残す
              }
                return null; // 過去の古いIDやゴミは強制的に消去！
            });
            
            setCurrentPartyIds(cleaned);
            localStorage.setItem('qh_trpg_party_ids', JSON.stringify(cleaned));
          } else {
            const defaultParty = [charList[0].id, null, null, null, null];
            setCurrentPartyIds(defaultParty);
            localStorage.setItem('qh_trpg_party_ids', JSON.stringify(defaultParty));
          }
        }
      }
    };
    loadGuildMembers();
  }, []);

  // 2. ⭕ パーティ編成が変更されたら、即座にブラウザの記憶に保存する関数
  const handlePartyChange = async (newParty) => {
    const cleanedParty = newParty.map(id => {
      if (!id || id === 'EMPTY' || id === 'null' || id === 'undefined' || String(id).trim() === '') {
        return null;
      }
      return id;
    });

    setCurrentPartyIds(cleanedParty);
    localStorage.setItem('qh_trpg_party_ids', JSON.stringify(cleanedParty));

    try {
      await Promise.all(
        allCharacters.map(async (ch) => {
          const slotIndex = cleanedParty.findIndex(id => id === ch.id);
          const finalIndex = slotIndex !== -1 ? slotIndex : null;

          // 🎯 修正箇所：gameServices.supabase から「supabase」直博に変更！
          await supabase
            .from('game_characters')
            .update({ party_index: finalIndex })
            .eq('id', ch.id);
        })
      );
    } catch (err) {
      console.error("Supabaseへの編成保存に失敗しました:", err);
    }
  };

  return (
    <div style={{
      backgroundColor: '#0f172a', minHeight: '100vh', color: '#fff',
      fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column',
      maxWidth: '480px', margin: '0 auto', padding: '0 0 130px 0', position: 'relative', boxSizing: 'border-box'
    }}>

      {/* --- 1. 酒場タブ --- */}
      {currentView === 'tavern' && (
        <div style={{ flex: 1, paddingTop: '0px' }}>
          <AdventureInn />
        </div>
      )}

      {/* --- 2. 🛡️ 編成タブ --- */}
      {currentView === 'formation' && (
        <div style={{ flex: 1, padding: '20px 20px 0' }}>
          {/* 🔮 三土手創世神専用・編成リスト強制貫通マウント：
              allCharacters が万が一フィルター等でバグっていても、
              確実に存在するデータだけを配列として AdventureFormation へ100%の純度で引き渡します！ */}
          <AdventureFormation 
            allCharacters={Array.isArray(allCharacters) ? allCharacters : []}
            currentPartyIds={currentPartyIds}
            onPartyChange={handlePartyChange}
          />
        </div>
      )}

      {/* --- 3. 探索タブ --- */}
      {currentView === 'explore' && (
        <>
          {isExploring ? (
            /* 🔮 三土手創世神特注配線：選ばれた本物のクエストデータを戦闘画面へ完全同期マウント！ */
            <AdventureActive 
              partyCharacterIds={currentPartyIds.filter(id => id && id !== 'null' && id !== 'undefined' && String(id).trim() !== '')} 
              quest={selectedQuest} 
              activeQuest={selectedQuest} 
              selectedQuest={selectedQuest} 
              onReturn={() => { setSelectedQuest(null); setIsExploring(false); setCurrentView('tavern'); }} 
            />
          ) : isQuestListOpen ? (
            <div style={{ padding: '20px 20px 0', flex: 1 }}><QuestList onSelectQuest={setSelectedQuest} /></div>
          ) : (
            <div style={{ padding: '40px 20px 0', textAlign: 'center', flex: 1 }}>
              <h1 style={{ fontSize: '2rem', letterSpacing: '4px', color: '#f59e0b', marginBottom: '4px' }}>QUEST HUB TRPG</h1>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '40px' }}>ラグナロク・放置型自動探索フェーズ</p>
              
              {/* ➔ 🧽 ここからが差し込み対象のボックスです！ */}
              <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#f59e0b', margin: '0 0 10px 0' }}>出撃準備完了</h3>
                
                {/* 🔮 三土手創世神専用・裏データ全暴露デバッグログ */}
                {console.log("🔥 現在のパーティ配列のナマ中身:", currentPartyIds)}

                <p style={{ fontSize: '0.85rem', color: '#ccc', margin: 0 }}>
                  現在の編成メンバー: {
                    currentPartyIds.filter(id => {
                      // 💡 本当に「キャラクターのID（36文字のUUIDなど）」っぽいものだけを本物と認める超硬質フィルター
                      if (!id) return false;
                      const str = String(id).trim();
                      if (str === '' || str === 'null' || str === 'undefined' || str === 'EMPTY' || str.length < 10) {
                        return false; // ゴミや空文字、短すぎる文字列はすべて即座に除外！
                      }
                      return true;
                    }).length
                  } 名が待機中
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
              if (currentPartyIds.filter(id => id && id !== 'null' && id !== 'undefined' && String(id).trim() !== '').length === 0) {
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

      {/* フッターナビゲーションメニュー */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, margin: '0 auto', maxWidth: '480px', zIndex: 3000 }}>
        <AdventureMainNav currentView={currentView} onViewChange={(view) => {
          setCurrentView(view);
          if (view !== 'explore') setIsQuestListOpen(false); 
        }} />
      </div>

      <QuestModal 
        quest={selectedQuest} 
        onClose={() => setSelectedQuest(null)} 
        onStart={(questData) => { 
          setSelectedQuest(questData); 
          setIsQuestListOpen(false); 
          setIsExploring(true); 
        }}
      />

    </div>
  );
};

export default AdventurePage;
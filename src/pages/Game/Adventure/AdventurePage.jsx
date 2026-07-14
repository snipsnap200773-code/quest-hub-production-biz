import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { Swords, LogOut, Settings } from 'lucide-react';
import AdventureActive from './AdventureActive'; 
import AdventureMainNav from './components/AdventureMainNav'; 
import AdventureFormation from './AdventureFormation'; // 🆕 切り出した編成コンポーネントを呼ぶ
import QuestList from './QuestList'; 
import QuestModal from './components/QuestModal'; 
import AdventureInn from './AdventureInn'; 

// 🆕 消えてしまっていた gameServices と supabase のインポート電線をここに再結合します！
import { gameServices } from '../../../gameServices';
import { supabase } from '../../../supabaseClient';

const AdventurePage = () => { // 🆕 親（App.jsx）から Props を貰う必要がないよう、引数欄を元のシンプルな形に差し戻します！
  const navigate = useNavigate();

  // 🆕 【最新Supabase対応・動的マルチユーザーIDもぎ取りコア】
  // 古い .session() や .user() 判定を完全撤去し、現在のログインセッションから生のユーザーIDを安全に自動取得します！
  // これにより、別のプレイヤーがログインしてもコードを1文字も変えずに自動でそれぞれのIDで遊べます。
  const [userId, setUserId] = useState(null);
  
  const [currentView, setCurrentView] = useState('tavern'); 
  const [isExploring, setIsExploring] = useState(false); 
  const [isQuestListOpen, setIsQuestListOpen] = useState(false); 
  const [selectedQuest, setSelectedQuest] = useState(null); 

  // 👥 状態データだけは、探索画面（Active）に引き渡すためにPage側で保持
  const [allCharacters, setAllCharacters] = useState([]); 
  // ⭕ 初期値のデフォルトの器をセット
  const [currentPartyIds, setCurrentPartyIds] = useState([null, null, null, null, null]);

  // 🔔 🆕 【三土手物流特注：街のデータ強制同期フラグ】
  // 冒険から街に生還した際、この数値を+1して各子画面の再ロード処理を自動着火させます
  const [logisticsTrigger, setLogisticsTrigger] = useState(0); 

  // 1. メンバー一覧をSupabaseからロードする処理
  // 💡 安全にIDを受け取れるように引数（targetUserId）を拡張します
  const loadGuildMembers = async (targetUserId) => {
    const activeUserId = targetUserId || userId;
    if (!activeUserId) return; // IDがまだ存在しない場合は通信を水際でガードする

    const charList = await gameServices.getPlayerCharacters(activeUserId);
    if (charList && charList.length > 0) {
      setAllCharacters(charList);
      
      const validIds = charList.map(ch => ch.id);
      const dbParty = [null, null, null, null, null];
      let hasDbParty = false;

      charList.forEach(ch => {
        if (ch.party_index !== null && ch.party_index !== undefined && ch.party_index >= 0 && ch.party_index < 5) {
          dbParty[ch.party_index] = { id: ch.id, position: 'front' }; 
          hasDbParty = true;
        }
      });

      if (hasDbParty) {
        setCurrentPartyIds(dbParty);
      } else {
        const savedTactics = localStorage.getItem('mitsudote_tactics_save');
        const savedLegacy = localStorage.getItem('qh_trpg_party_ids');

        if (savedTactics) {
          const rawParty = JSON.parse(savedTactics);
          const cleaned = rawParty.map(slotData => {
            if (!slotData) return null;
            const charId = typeof slotData === 'object' ? slotData.id : slotData;
            if (charId && validIds.includes(charId)) {
              return typeof slotData === 'object' ? slotData : { id: charId, position: 'front' };
            }
            return null;
          });
          setCurrentPartyIds(cleaned);
        } else if (savedLegacy) {
          const rawParty = JSON.parse(savedLegacy);
          const cleaned = rawParty.map(id => {
            if (id && validIds.includes(id)) {
              return { id: id, position: 'front' };
            }
            return null;
          });
          setCurrentPartyIds(cleaned);
        } else {
          const defaultParty = [{ id: charList[0].id, position: 'front' }, null, null, null, null];
          setCurrentPartyIds(defaultParty);
        }
      }
    }
  };

  // 🔌 【最重要】現在ログインしている本物のユーザーIDをSupabaseの公式APIから自動取得する処理
  useEffect(() => {
    const fetchSession = async () => {
      try {
        // Supabaseのクライアントから現在のログインセッションを非同期で安全に取得します
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        // セッション情報の中から本物の user_id を抽出
        const currentUserId = session?.user?.id || null;
        if (currentUserId) {
          setUserId(currentUserId); // 1. StateにユーザーIDをセットして全体に電線を繋ぎます
          loadGuildMembers(currentUserId); // 2. もぎ取ったIDでそのまま即座にキャラクターデータをロードします
        } else {
          console.warn("⚠️ ログインセッションが見つかりません。ログアウトしている可能性があります。");
        }
      } catch (err) {
        console.error("セッション自動もぎ取りエラー:", err);
      }
    };

    fetchSession();
  }, []); // 初回マウント時に1回だけ確実に実行します

  // 2. ⭕ パーティ編成が変更されたら、即座にブラウザの記憶に保存する関数
  const handlePartyChange = async (newParty) => {
    const cleanedParty = newParty.map(slotData => {
      if (!slotData) return null;
      const charId = typeof slotData === 'object' ? slotData.id : slotData;
      if (!charId || charId === 'EMPTY' || charId === 'null' || charId === 'undefined' || String(charId).trim() === '') {
        return null;
      }
      return slotData; 
    });

    setCurrentPartyIds(cleanedParty);

    // 🚨 【超重要】酒場など他の画面がクラッシュしないよう、IDだけの純粋な配列を作って古いキーに保存！
    const pureIdsForCompatibility = cleanedParty.map(slot => slot ? (typeof slot === 'object' ? slot.id : slot) : null);
    localStorage.setItem('qh_trpg_party_ids', JSON.stringify(pureIdsForCompatibility));

    // 🆕 前衛・後衛の陣形データは「三土手専用キー」で安全に別保存！
    localStorage.setItem('mitsudote_tactics_save', JSON.stringify(cleanedParty));

    try {
      await Promise.all(
        allCharacters.map(async (ch) => {
          const slotIndex = cleanedParty.findIndex(slot => slot && (typeof slot === 'object' ? slot.id === ch.id : slot === ch.id));
          const finalIndex = slotIndex !== -1 ? slotIndex : null;

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
          {/* 🆕 自動取得した userId と 物流同期トリガーを酒場（Inn）へ引き渡します！ */}
          <AdventureInn userId={userId} logisticsTrigger={logisticsTrigger} />
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
              userId={userId} // 🆕 これ！ここで子画面へ userId を引き渡すことで、Active 側の参照エラーを完全粉砕します！
              partyCharacterIds={currentPartyIds.filter(id => id && id !== 'null' && id !== 'undefined' && String(id).trim() !== '')} 
              quest={selectedQuest} 
              activeQuest={selectedQuest} 
              selectedQuest={selectedQuest} 
              onReturn={() => { 
                setSelectedQuest(null); 
                setIsExploring(false); 
                setCurrentView('tavern'); 
                loadGuildMembers(); // 👈 爆速で再読込の電線を直撃結合！

                // 🔔 🆕 帰還時にカウントアップ！これにより倉庫や詳細が自動で最新のデータを読み込みます
                setLogisticsTrigger(prev => prev + 1); 
              }} 
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
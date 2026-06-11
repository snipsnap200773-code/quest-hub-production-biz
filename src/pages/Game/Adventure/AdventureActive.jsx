import React, { useState, useEffect, useRef } from 'react';
import { Timer, Trophy, ShieldAlert } from 'lucide-react';
import QuestResultModal from './components/QuestResultModal';

const AdventureActive = ({ onReturn }) => {
  const scrollRef = useRef(null);

  // 🧪 テストしやすいように10秒のクエストに設定しています
  const [timeLeft, setTimeLeft] = useState(10);
  const [isTimeUp, setIsTimeUp] = useState(false);       // タイマーが0になったか
  const [showResult, setShowResult] = useState(false);   // リザルトポップアップを出すか

  // ログデータ
  const [displayedLogs, setDisplayedLogs] = useState([
    { id: 1, text: "探索を開始しました...", type: "system" }
  ]);

  // 仮のドロップアイテムデータ
  const [droppedItems] = useState([
    { id: 1, name: "レザーナックル", rarity: "common" },
    { id: 2, name: "ロングソード", rarity: "common" },
    { id: 3, name: "グレイヴ", rarity: "rare" },
  ]);

  const poolLogs = [
    { text: "第一のパーティは慎重に周囲を警戒している。", type: "info" },
    { text: "敵が現れた！ ゴブリンウォーリアー × 1", type: "battle" },
    { text: "ディオンの攻撃！ ゴブリンに 14 のダメージ！", type: "battle" },
    { text: "アゼルの魔法！ ゴブリンに 28 のダメージ！", type: "battle" },
    { text: "ゴブリンを撃破した！", type: "success" },
    { text: "宝箱を発見！ 開錠に成功した。", type: "success" },
  ];

  // リアルタイムタイマー（0秒になったらログを止めて完了ボタンを待つ）
  useEffect(() => {
    if (timeLeft <= 0) {
      setIsTimeUp(true);
      // クエスト走破ログを最後に追加
      setDisplayedLogs(prev => [
        ...prev,
        { id: 'end', text: "ーー 洞窟の踏破に成功した！ ーー", type: "system" }
      ]);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);

      if (timeLeft % 2 === 0) {
        const randomLog = poolLogs[Math.floor(Math.random() * poolLogs.length)];
        setDisplayedLogs(prev => [
          ...prev, 
          { id: Date.now(), text: randomLog.text, type: randomLog.type }
        ]);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // ログ自動スクロール（タイマー進行中のみ）
  useEffect(() => {
    if (scrollRef.current && !isTimeUp) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedLogs, isTimeUp]);

  // リタイヤ処理
  const handleRetire = () => {
    if (window.confirm("危険です！アイテムを諦めて街へ緊急帰還しますか？")) {
      onReturn();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', backgroundColor: '#000' }}>
      
      {/* 1. ダンジョンヘッダー */}
      <div style={{ padding: '12px 15px', borderBottom: '1px solid #333', background: '#111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
          <div style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '0.85rem' }}>始まりの洞窟 B1F</div>
          
          {/* タイマー表示の切り替え */}
          <div style={{ 
            fontSize: '0.8rem', 
            color: isTimeUp ? '#10b981' : '#ef4444', 
            display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' 
          }}>
            <Timer size={14} /> 
            {isTimeUp ? '探索完了！' : `残り時間: ${timeLeft}秒`}
          </div>
        </div>
      </div>

      {/* 2. リアルタイムログウィンドウ（時間切れ後もスクロールで見返せます） */}
      <div 
        ref={scrollRef}
        style={{
          flex: 1, padding: '15px', overflowY: 'auto', fontSize: '0.85rem', lineHeight: '1.6',
          minHeight: '280px', background: 'linear-gradient(to bottom, #000, #0a0a0a)', borderBottom: '2px solid #222'
        }}
      >
        {displayedLogs.map(log => (
          <div key={log.id} style={{ 
            marginBottom: '4px', 
            color: log.type === 'battle' ? '#ef4444' : 
                   log.type === 'success' ? '#10b981' : 
                   log.type === 'system' ? '#f59e0b' : '#ccc' 
          }}>
            {log.text}
          </div>
        ))}
      </div>

      {/* 3. 🛠️ ボタンエリア（時間切れ前と後でドラマチックに切り替えます） */}
      <div style={{ padding: '15px 20px', background: '#050505', borderBottom: '1px solid #222', textAlign: 'center' }}>
        {isTimeUp ? (
          /* 🆕 時間切れ後：じっくりログを読んだ後に押せる完了ボタン */
          <button 
            onClick={() => setShowResult(true)}
            style={{
              width: '100%', padding: '12px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#fff', border: 'none', fontSize: '0.95rem', fontWeight: '900',
              cursor: 'pointer', boxShadow: '0 4px 15px rgba(217,119,6,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              animation: 'pulse 2s infinite' // 輝くような演出用
            }}
          >
            <Trophy size={16} /> 戦利品を回収してクエスト完了
          </button>
        ) : (
          /* 進行中：リタイヤボタン */
          <button 
            onClick={handleRetire}
            style={{
              width: '100%', padding: '10px', borderRadius: '8px',
              background: '#1a0505', color: '#ef4444', border: '1px solid #451a1a',
              fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            <ShieldAlert size={14} /> パーティの危機！街へ途中帰還（リタイヤ）
          </button>
        )}
      </div>

      {/* 4. パーティステータス */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', padding: '10px 5px', background: '#000' }}>
        {["ディオン", "アゼル", "スタン", "カタリナ", "マリウス"].map((name, idx) => (
          <div key={idx} style={{ textAlign: 'center', background: '#111', borderRadius: '4px', padding: '8px 2px', border: '1px solid #222' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#fff' }}>{name}</div>
            <div style={{ height: '3px', background: '#333', borderRadius: '2px', margin: '4px 4px 0' }}>
              <div style={{ height: '100%', width: '100%', background: '#10b981' }}></div>
            </div>
          </div>
        ))}
      </div>

      {/* ドロップ確認ポップアップ（完了ボタンを押すまで開かない） */}
      <QuestResultModal 
        isOpen={showResult} 
        droppedItems={droppedItems} 
        onClose={onReturn} 
      />

    </div>
  );
};

export default AdventureActive;
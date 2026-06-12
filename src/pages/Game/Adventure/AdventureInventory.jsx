import React, { useState } from 'react';
import { Shield, Sword, Sparkles, Archive, Coins, X, Key, ChevronUp, ChevronDown } from 'lucide-react';

const AdventureInventory = ({ onBack }) => {
  // 💰 ギルドの所持金（Zeny）状態
  const [zeny, setZeny] = useState(1500);

  // 🎒 道具の在庫状態
  const [items, setItems] = useState([
    { id: 101, name: 'マインゴーシュ [4]', type: 'weapon', rarity: 'rare', count: 1, value: 500, desc: '4つのスロットを持つ短剣。シーフなどに最適。' },
    { id: 102, name: 'バフォメットJrカード', type: 'card', rarity: 'legendary', count: 1, value: 5000, desc: '激レアカード。装備に挿入するとクリティカル率などが大幅にアップする。' },
    { id: 103, name: 'ポーション', type: 'consumable', rarity: 'common', count: 15, value: 10, desc: 'HPを少し回復する初心者用の赤い薬。' },
    { id: 104, name: '丸い爪', type: 'etc', rarity: 'common', count: 5, value: 35, desc: 'バフォメットJrからむしり取った爪。店でゼニーに換えられる。' },
    { id: 105, name: '始まりの洞窟の古びた鍵', type: 'quest', rarity: 'rare', count: 1, value: 0, desc: '【重要アイテム】始まりの洞窟最深部の隠し扉を開けるための重厚な鍵。売却不可。' },
    { id: 106, name: 'バフォメットの角片', type: 'quest', rarity: 'legendary', count: 1, value: 0, desc: '【重要アイテム】狂乱の階層主が遺した禍々しい角の破片。ギルドのランクアップ昇格試験に必要。売却不可。' }
  ]);

  // 🧭 フィルター
  const [filter, setFilter] = useState('all');
  
  // 🔍 1段階目：詳細ポップアップアイテム
  const [selectedItem, setSelectedItem] = useState(null);

  // 🔢 2段階目：数量選択ポップアップアイテム ＆ 個数
  const [sellTargetItem, setSellTargetItem] = useState(null);
  const [sellCount, setSellCount] = useState(1);

  const filteredItems = items.filter(item => (filter === 'all' || item.type === filter) && item.count > 0);

  const getRarityColor = (rarity) => {
    if (rarity === 'legendary') return '#f59e0b';
    if (rarity === 'rare') return '#a78bfa';
    return '#94a3b8';
  };

  // 🔢 個数選択の▲▼処理
  const adjustSellCount = (amount) => {
    if (!sellTargetItem) return;
    setSellCount(prev => {
      const next = prev + amount;
      if (next < 1) return 1;
      if (next > sellTargetItem.count) return sellTargetItem.count;
      return next;
    });
  };

  // 💳 最終チェック付き売却コミット処理
  const handleFinalSell = () => {
    if (!sellTargetItem) return;

    const confirmMessage = `💰 【最終確認】\n\n${sellTargetItem.name} を [ ${sellCount} 個 ] 売却します。\n獲得資金: ${sellTargetItem.value * sellCount} Zeny\n\n本当によろしいですか？`;
    
    if (!window.confirm(confirmMessage)) {
      return; 
    }

    const totalEarned = sellTargetItem.value * sellCount;
    setZeny(prev => prev + totalEarned);

    const updatedItems = items.map(item => {
      if (item.id === sellTargetItem.id) {
        return { ...item, count: item.count - sellCount };
      }
      return item;
    });
    setItems(updatedItems);

    setSellTargetItem(null);
    setSelectedItem(null);

    alert(`💸 商談成立！\n${sellTargetItem.name} を ${sellCount} 個売却し、${totalEarned} Zeny を獲得しました！`);
  };

  return (
    <div style={{ padding: '24px 20px 0 20px', color: '#fff', boxSizing: 'border-box', position: 'relative', minHeight: '80vh' }}>
      
      {/* 上部ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px', position: 'relative', minHeight: '32px' }}>
        <button onClick={onBack} style={{ position: 'absolute', left: 0, padding: '6px 12px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
          ← 戻る
        </button>
        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#34d399', fontWeight: 'bold', letterSpacing: '1px' }}>
          🎒 道具一覧
        </h2>
      </div>

      {/* 統計情報 ＆ 所持金カウンター */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '12px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Archive size={14} /> 倉庫格納アイテム
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#34d399', fontFamily: 'monospace' }}>
            {items.filter(i => i.count > 0).length} / 100 種類
          </span>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #111827 100%)', border: '1px solid #4338ca', borderRadius: '12px', padding: '12px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
            <Coins size={14} color="#f59e0b" /> ギルド所持金
          </span>
          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#f59e0b', fontFamily: 'monospace' }}>
            {zeny.toLocaleString()} <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'normal' }}>Zeny</span>
          </span>
        </div>
      </div>

      {/* 🧭 アイテム種別フィルタータブ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginBottom: '20px', background: '#0f172a', padding: '4px', borderRadius: '8px' }}>
        {['all', 'weapon', 'card', 'consumable', 'quest'].map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            style={{
              padding: '8px 0', border: 'none', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer',
              background: filter === type ? '#1e293b' : 'none',
              color: filter === type ? '#34d399' : '#64748b'
            }}
          >
            {type === 'all' ? '全て' : type === 'weapon' ? '装備' : type === 'card' ? 'カード' : type === 'consumable' ? '消耗品' : 'クエスト'}
          </button>
        ))}
      </div>

      {/* 🎒 アイテムリストコンテナ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '40px' }}>
        {filteredItems.map(item => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)} 
            style={{
              background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '12px 15px', 
              display: 'grid', gridTemplateColumns: '40px 1fr 45px', alignItems: 'center', cursor: 'pointer',
              transition: 'border-color 0.15s, transform 0.15s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#34d399'; e.currentTarget.style.transform = 'scale(1.01)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.transform = 'none'; }}
          >
            {/* 1列目：アイコン */}
            <div style={{ color: getRarityColor(item.rarity), display: 'flex', alignItems: 'center' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '8px', border: `1px solid ${getRarityColor(item.rarity)}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.type === 'weapon' ? <Sword size={16} /> : item.type === 'card' ? <Sparkles size={16} /> : item.type === 'quest' ? <Key size={16} /> : <Shield size={16} />}
              </div>
            </div>
            
            {/* 2列目：名前と説明テキスト */}
            <div style={{ overflow: 'hidden', paddingRight: '8px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: getRarityColor(item.rarity) }}>
                {item.name}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {item.desc}
              </div>
            </div>

            {/* 3列目：所持個数バッジ */}
            <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: '900', color: '#94a3b8', background: '#1e293b', padding: '4px 0', borderRadius: '6px', width: '100%', textAlign: 'center' }}>
              x{item.count}
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div style={{ textalign: 'center', color: '#64748b', fontSize: '0.8rem', padding: '20px' }}>
            倉庫に該当する道具はありません。
          </div>
        )}
      </div>

      {/* 🗺️ 1段階目ポップアップ：アイテム詳細ウィンドウ */}
      {selectedItem && (
        <div 
          // ⭕ 修正点：外側の黒い背景をクリックしたら閉じる（setSelectedItem(null)）
          onClick={() => setSelectedItem(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px', backdropFilter: 'blur(4px)', cursor: 'pointer' }}
        >
          <div 
            // ⭕ 内側のウィンドウをタップした時は閉じないようにクリックをせき止める！
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0f172a', width: '100%', maxWidth: '360px', borderRadius: '20px', border: `2px solid ${getRarityColor(selectedItem.rarity)}`, padding: '24px', position: 'relative', cursor: 'default' }}
          >
            <button onClick={() => setSelectedItem(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ color: getRarityColor(selectedItem.rarity), background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: `1px solid ${getRarityColor(selectedItem.rarity)}44` }}>
                {selectedItem.type === 'weapon' ? <Sword size={32} /> : selectedItem.type === 'card' ? <Sparkles size={32} /> : selectedItem.type === 'quest' ? <Key size={32} /> : <Shield size={32} />}
              </div>
            </div>

            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: getRarityColor(selectedItem.rarity), textAlign: 'center', fontWeight: 'bold' }}>{selectedItem.name}</h3>
            
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '0.6rem', color: selectedItem.type === 'quest' ? '#f43f5e' : '#94a3b8', background: selectedItem.type === 'quest' ? '#270510' : '#1e293b', padding: '2px 8px', borderRadius: '4px', border: selectedItem.type === 'quest' ? '1px solid #e11d48' : 'none', fontWeight: 'bold' }}>
                {selectedItem.type === 'weapon' ? '武器・装備' : selectedItem.type === 'card' ? 'カード型秘宝' : selectedItem.type === 'quest' ? '⚠️ 貴重なクエストアイテム' : '消耗品アイテム'}
              </span>
            </div>

            <p style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.6', background: '#0b0f19', padding: '12px', borderRadius: '10px', border: '1px solid #1e293b', margin: '0 0 24px 0' }}>{selectedItem.desc}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px', fontSize: '0.75rem', color: '#64748b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '6px' }}>
                <span>現在倉庫にある数量</span>
                <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{selectedItem.count} 個</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '6px' }}>
                <span>ギルド売却鑑定額</span>
                <strong style={{ color: selectedItem.type === 'quest' ? '#ef4444' : '#f59e0b', fontFamily: 'monospace' }}>
                  {selectedItem.type === 'quest' ? '売却不可' : `${selectedItem.value} Zeny / 1個`}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setSelectedItem(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>
                閉じる
              </button>
              
              {selectedItem.type !== 'quest' ? (
                <button 
                  onClick={() => { setSellTargetItem(selectedItem); setSellCount(1); }}
                  style={{ flex: 2, padding: '10px', borderRadius: '8px', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: '#fff', border: 'none', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.2)' }}
                >
                  売却
                </button>
              ) : (
                <button disabled style={{ flex: 2, padding: '10px', borderRadius: '8px', background: '#1e1b4b', color: '#475569', border: '1px dashed #e11d48', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'not-allowed' }}>
                  処分禁止アイテム
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🗺️ 2段階目ポップアップ：数量指定・売却承認ウィンドウ */}
      {sellTargetItem && (
        <div 
          // ⭕ 修正点：数量選択画面でも、外側の暗幕タップで閉じられるように配線！
          onClick={() => setSellTargetItem(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, padding: '20px', backdropFilter: 'blur(6px)', cursor: 'pointer' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0b0f19', width: '100%', maxWidth: '340px', borderRadius: '16px', border: '1px solid #ef4444', padding: '20px', boxShadow: '0 0 20px rgba(239,68,68,0.2)', cursor: 'default' }}
          >
            
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.7rem', color: '#ef4444', background: '#311010', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold' }}>
                ⚖️ ギルド買取カウンター
              </span>
              <h4 style={{ margin: '12px 0 4px 0', fontSize: '0.95rem', color: '#fff' }}>{sellTargetItem.name}</h4>
              <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748b' }}>売却する数量を選んでください（最大: {sellTargetItem.count}個）</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', background: '#0f172a', padding: '15px', borderRadius: '12px', border: '1px solid #1e293b', marginBottom: '20px' }}>
              <button onClick={() => adjustSellCount(-1)} disabled={sellCount <= 1} style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#1e293b', color: '#fff', border: '1px solid #334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronDown size={18} />
              </button>

              <div style={{ minWidth: '60px', textAlign: 'center', fontFamily: 'monospace' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#34d399' }}>{sellCount}</div>
                <div style={{ fontSize: '0.55rem', color: '#64748b', marginTop: '2px' }}>売却数</div>
              </div>

              <button onClick={() => adjustSellCount(1)} disabled={sellCount >= sellTargetItem.count} style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#1e293b', color: '#fff', border: '1px solid #334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronUp size={18} />
              </button>

              <button onClick={() => setSellCount(sellTargetItem.count)} style={{ padding: '6px 10px', borderRadius: '6px', background: '#1e1b4b', color: '#a78bfa', border: '1px solid #4338ca', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' }}>
                MAX
              </button>
            </div>

            <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span>合計買取査定額:</span>
              <strong style={{ color: '#f59e0b', fontSize: '1rem', fontFamily: 'monospace' }}>
                {(sellTargetItem.value * sellCount).toLocaleString()} Zeny
              </strong>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setSellTargetItem(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>
                とりやめる
              </button>
              <button onClick={handleFinalSell} style={{ flex: 2, padding: '10px', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#0f172a', border: 'none', fontSize: '0.75rem', fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
                売る（確認へ）
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default AdventureInventory;
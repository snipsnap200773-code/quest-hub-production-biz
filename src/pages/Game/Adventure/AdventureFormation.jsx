import React, { useState } from 'react';
import { Plus, X, Shield, ShieldAlert, Swords } from 'lucide-react';

const AdventureFormation = ({ allCharacters, currentPartyIds, onPartyChange }) => {
  const [activeSlot, setActiveSlot] = useState(null); // 現在キャラ選択中のスロット番号

  // 🔮 🆕 三土手神特注：キャラクター自体の魂（meta）の中に position を一時保存、または配列からスロット属性を読み解く配線。
  // ここではテーブルにカラムを増やさないため、キャラクターが現在装備している隊列状態を親やDBに安全に送るために、
  // 親から渡ってくる currentPartyIds（長さ4の配列）を、[ { id, position }, ... ] というインテリジェントな構造で管理するように進化させます！
  // ※ もし currentPartyIds がまだ「IDだけの配列」だった場合でもエラーが出ないよう、フォールバック（安全回路）を敷いてあります。

  // スロットへのキャラ配置処理（デフォルトは前衛として配置）
  const selectCharacterForSlot = (charId, slotIndex) => {
    const newParty = [...currentPartyIds];
    
    // 二重登録防止の安全走査
    const existingIndex = newParty.findIndex(p => p && (typeof p === 'object' ? p.id === charId : p === charId));
    if (existingIndex !== -1) newParty[existingIndex] = null;

    // オブジェクト形式で「キャラクターID」と「初期ポジション」をガチッとバインド！
    newParty[slotIndex] = { id: charId, position: 'front' };
    
    onPartyChange(newParty);
    setActiveSlot(null);
  };

  // 隊列（前衛・後衛）をパチパチとワンタップでトグル切り替えする神スイッチ
  const togglePosition = (slotIndex) => {
    const newParty = [...currentPartyIds];
    const currentSlot = newParty[slotIndex];
    if (!currentSlot || typeof currentSlot !== 'object') return;

    // front ⇄ back を瞬時に反転上書き！
    newParty[slotIndex] = {
      ...currentSlot,
      position: currentSlot.position === 'front' ? 'back' : 'front'
    };
    onPartyChange(newParty);
  };

  // スロットのキャラを外す処理
  const removeCharacterFromSlot = (slotIndex) => {
    const newParty = [...currentPartyIds];
    newParty[slotIndex] = null;
    onPartyChange(newParty);
  };

  // 🐾 🆕 【三土手神特注：テイマー連動型・動的パーティサイズ拡張エンジン】
  // パーティー内にテイマー（jobがテイマー、またはマスターIDがテイマー）がいるかをリアルタイム走査
  const hasTamer = currentPartyIds.some(slot => {
    if (!slot) return false;
    const charId = typeof slot === 'object' ? slot.id : slot;
    const char = allCharacters.find(c => c.id === charId);
    return char && (char.job === 'テイマー' || char.master_id === 'unit_1783729889058' || char.meta?.job === 'テイマー');
  });

  // テイマーがいれば最大4枠、いなければ最大3枠に可変フィット！
  const maxSlotsCount = hasTamer ? 4 : 3;
  const fixedSlots = Array.from({ length: maxSlotsCount }, (_, i) => i);

  // 🚨 4人目にキャラがいる状態でテイマーが外された場合、過剰データを安全に消去して親へ即時同期
  React.useEffect(() => {
    if (currentPartyIds.length > maxSlotsCount) {
      const cleanedParty = currentPartyIds.slice(0, maxSlotsCount);
      onPartyChange(cleanedParty);
    }
  }, [maxSlotsCount, currentPartyIds, onPartyChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ textAlign: 'center' }}>
        {/* 🐾 🆕 テイマーがいる時は「最大4人」、いない時は「最大3人」にタイトルを動的切り替え */}
        <h2 style={{ fontSize: '1.3rem', color: hasTamer ? '#c084fc' : '#f59e0b', margin: '0 0 4px 0', transition: 'color 0.3s' }}>
          {hasTamer ? '🐾 遠征部隊・テイマー魔物使役陣形 (最大4人)' : '🛡️ 遠征部隊・タクティカル編成 (最大3人)'}
        </h2>
        <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>
          {hasTamer ? 'テイマーの特権が発動中！捕獲した魔物を4人目として前線へ投入可能' : '通常時は最大3人編成。テイマーを組み込むことで4人出撃へと限界突破！'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {fixedSlots.map((idx) => {
          const slotData = currentPartyIds[idx];
          // 互換性セーフティ：もし古い形式のただの文字列IDならオブジェクトへ自動パース
          const charId = slotData && typeof slotData === 'object' ? slotData.id : slotData;
          const currentPos = slotData && typeof slotData === 'object' ? slotData.position : 'front';

          const char = allCharacters.find(c => c.id === charId);

          return (
            <div key={idx} style={{ position: 'relative' }}>
              <div 
                style={{
                  padding: '10px 16px', 
                  background: char ? (currentPos === 'front' ? '#2d1414' : '#111c30') : '#0f172a',
                  borderRadius: '8px', 
                  border: activeSlot === idx 
                    ? '2px solid #f59e0b' 
                    : char 
                      ? (currentPos === 'front' ? '1px solid #991b1b' : '1px solid #2563eb') 
                      : '1px dashed #334155',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  transition: '0.2s'
                }}
              >
                {/* 左側：タップするとキャラクター選択画面が開く */}
                <div onClick={() => setActiveSlot(idx)} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  <span style={{ fontSize: '0.7rem', color: '#ffd700', fontWeight: 'bold', fontFamily: 'monospace', minWidth: '40px' }}>
                    Slot {idx + 1}
                  </span>
                  
                  {char ? (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: '0.85rem', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                        {char.custom_name.replace('テスト', '')}
                      </strong>
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8', background: '#0f172a', padding: '1px 6px', borderRadius: '4px', border: '1px solid #1e293b' }}>
                        {char.meta?.job || 'ノービス'}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#475569', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Plus size={12} /> タップして冒険者を選択
                    </span>
                  )}
                </div>

                {/* 右側：キャラクターがいる場合のみ「前衛 ⇄ 後衛」トグルスイッチを爆誕させる配線 */}
                {char && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '28px' }}>
                    <button
                      onClick={() => togglePosition(idx)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.65rem',
                        fontWeight: '900',
                        border: 'none',
                        cursor: 'pointer',
                        background: currentPos === 'front' ? '#7f1d1d' : '#1e3a8a',
                        color: currentPos === 'front' ? '#fca5a5' : '#93c5fd',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        transition: 'background 0.2s'
                      }}
                      title="クリックして隊列をスイッチ！"
                    >
                      {currentPos === 'front' ? <ShieldAlert size={11}/> : <Shield size={11}/>}
                      {currentPos === 'front' ? '前衛' : '後衛'}
                    </button>
                  </div>
                )}
              </div>

              {/* ❌ キャラクターを編成から外すボタン */}
              {char && (
                <button 
                  onClick={() => removeCharacterFromSlot(idx)}
                  style={{ 
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: '#2d0a0a', border: '1px solid #5a1414', borderRadius: '50%', 
                    width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    cursor: 'pointer', color: '#f43f5e', padding: 0
                  }}
                  title="外す"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* キャラクター選択ウィンドウ */}
      {activeSlot !== null && (
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 'bold' }}>配置先: スロット {activeSlot + 1}</span>
            <button onClick={() => setActiveSlot(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer' }}>閉じる</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
            {allCharacters.map(char => {
              // 🐾 🆕 【三土手神特注：ファーム預け要素完全撤廃 ➔ 直撃モンスター専用枠ゲート】
              // 現在タップしたのが「Slot 4（インデックス3）」の時
              if (activeSlot === 3) {
                // 人間キャラクター（_base持ち、またはテイマー本人）は4枠目から完全シャットアウト！
                const isHuman = char.master_id && (char.master_id.includes('_base') || char.master_id === 'unit_1783729889058' || char.job === 'テイマー');
                if (isHuman) return null;
                
                // ➔ ここを通過した「牧場にいる魔物たち（半魚人やポリンJrなど）」がすべて無条件でズラーッと選択肢に出現します！
              } else {
                // 逆に通常の「Slot 1〜3」には、魔物たちが絶対に混ざらないように鉄壁ガード！
                const isMonster = char.master_id && !char.master_id.includes('_base') && char.master_id !== 'unit_1783729889058' && char.job !== 'テイマー';
                if (isMonster) return null;
              }

              // 互換チェック込みの選択中判定
              const isSelected = currentPartyIds.some(p => p && (typeof p === 'object' ? p.id === char.id : p === char.id));
              return (
                <div 
                  key={char.id}
                  onClick={() => selectCharacterForSlot(char.id, activeSlot)}
                  style={{
                    padding: '10px', background: '#1e293b', borderRadius: '8px', border: isSelected ? '1px solid #f59e0b' : '1px solid #334155',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>👤 {char.custom_name}</span>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginLeft: '8px' }}>[{char.meta?.job || 'ノービス'}]</span>
                  </div>
                  {isSelected && <span style={{ fontSize: '0.6rem', color: '#f59e0b', background: '#451a03', padding: '2px 6px', borderRadius: '4px' }}>配置中</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '12px', fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.5' }}>
        💡 <strong>三土手創世神のタクティカル・アドバイス：</strong><br />
        本作は硬派な「3人パーティー」が基本陣形となります。しかし、部隊にテイマーが加わることで隠された4つ目のスロットが全自動で開通！ファームでバインドした魔物をその手で前線に引き連れ、圧倒的な手数でダンジョンを制圧してください！
      </div>
    </div>
  );
};

export default AdventureFormation;
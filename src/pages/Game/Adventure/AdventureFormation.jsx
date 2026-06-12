import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

const AdventureFormation = ({ allCharacters, currentPartyIds, onPartyChange }) => {
  const [activeSlot, setActiveSlot] = useState(null); // 現在キャラ選択中のスロット番号

  // スロットへのキャラ配置処理
  const selectCharacterForSlot = (charId, slotIndex) => {
    const newParty = [...currentPartyIds];
    // 他のスロットで既に選ばれている場合は、二重登録を防ぐためにそこを空っぽにする
    const existingIndex = newParty.indexOf(charId);
    if (existingIndex !== -1) newParty[existingIndex] = null;

    newParty[slotIndex] = charId;
    onPartyChange(newParty);
    setActiveSlot(null); // 選択ウィンドウを閉じる
  };

  // スロットのキャラを外す処理
  const removeCharacterFromSlot = (slotIndex) => {
    const newParty = [...currentPartyIds];
    newParty[slotIndex] = null;
    onPartyChange(newParty);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#f59e0b', margin: '0 0 4px 0' }}>🛡️ 第一遠征部隊・パーティ編成</h2>
        <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>1名〜最大5名まで自由にポジションを配置可能</p>
      </div>

      {/* 現在のパーティスロット（5マス並び） */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
        {currentPartyIds.map((charId, idx) => {
          const char = allCharacters.find(c => c.id === charId);
          return (
            <div key={idx} style={{ position: 'relative' }}>
              <div 
                onClick={() => setActiveSlot(idx)}
                style={{
                  aspectRatio: '1/1', background: char ? '#1e293b' : '#0f172a',
                  borderRadius: '8px', border: activeSlot === idx ? '2px solid #f59e0b' : char ? '1px solid #334155' : '1px dashed #334155',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: '0.2s', padding: '4px', textAlign: 'center'
                }}
              >
                {char ? (
                  <>
                    <span style={{ fontSize: '0.6rem', color: '#f59e0b', fontWeight: 'bold' }}>Slot {idx + 1}</span>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', marginTop: '4px' }}>
                      {char.custom_name.replace('テスト', '')}
                    </div>
                    <span style={{ fontSize: '0.55rem', color: '#64748b', marginTop: '2px' }}>{char.meta?.job || 'Lv.1'}</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} color="#475569" />
                    <span style={{ fontSize: '0.55rem', color: '#475569', marginTop: '2px' }}>配置</span>
                  </>
                )}
              </div>
              {char && (
                <button 
                  onClick={(e) => { e.stopPropagation(); removeCharacterFromSlot(idx); }}
                  style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', border: 'none', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
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
            <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 'bold' }}>選択中: スロット {activeSlot + 1}</span>
            <button onClick={() => setActiveSlot(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer' }}>閉じる</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
            {allCharacters.map(char => {
              const isSelected = currentPartyIds.includes(char.id);
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
        💡 <strong>三土手GMのアドバイス：</strong><br />
        1人にして「探索」に行けばソロでの死闘に、複数人選べば総力戦になります。自由な組み合わせで実戦シミュレーションへ向かいましょう！
      </div>
    </div>
  );
};

export default AdventureFormation;
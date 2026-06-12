import React, { useState, useEffect } from 'react';
import { Shield, Briefcase, Type, Save, RotateCcw, Plus, Swords, Sun, Moon, Layers, Footprints, Gem } from 'lucide-react';
import { gameServices } from '../../../gameServices';

// 日本語のステータス説明マッピング
const STAT_LABELS = {
  str: { name: 'STR（腕力）', desc: '物理攻撃力 ＆ アイテム所持限界量に影響' },
  agi: { name: 'AGI（敏捷）', desc: '攻撃速度 ＆ 物理回避率に影響' },
  vit: { name: 'VIT（体力）', desc: '最大HP増幅 ＆ 物理防御力に影響' },
  int: { name: 'INT（知力）', desc: '魔法攻撃力 ＆ 最大SP増幅に影響' },
  dex: { name: 'DEX / 技量', desc: '物理命中率 ＆ 魔法詠唱時間の短縮に影響' },
  luk: { name: 'LUK（幸運）', desc: 'クリティカル率 ＆ 完全回避率に影響' }
};

// タブの並び順定義（スワイプ制御用）
const TABS = ['status', 'equipment', 'inventory', 'rename'];

// 🛡️ RO式・7部位装備スロットの定義
const EQUIP_SLOTS = [
  { key: 'helm_top', name: '兜 (上段)', icon: <Sun size={14} /> },
  { key: 'helm_mid', name: '兜 (中段)', icon: <Layers size={14} /> },
  { key: 'helm_bot', name: '兜 (下段)', icon: <Moon size={14} /> },
  { key: 'armor', name: '鎧 (アーマー)', icon: <Shield size={14} /> },
  { key: 'weapon', name: '武器 (ウェポン)', icon: <Swords size={14} /> },
  { key: 'shield', name: '盾 (シールド)', icon: <Shield size={14} color="#64748b" /> },
  { key: 'garment', name: '外套 (肩コープ)', icon: <Layers size={14} color="#a78bfa" /> },
  { key: 'shoes', name: '靴 (シューズ)', icon: <Footprints size={14} /> },
  { key: 'accessory', name: 'アクセサリ', icon: <Gem size={14} /> }
];

const AdventureCharacterDetail = ({ characterId, onBack }) => {
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 🧭 操作タブ管理
  const [activeTab, setActiveTab] = useState('status');

  // ステ振り用のローカル状態
  const [localPoints, setLocalPoints] = useState(0);
  const [localBonuses, setLocalBonuses] = useState({ str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 });
  const [isCommitting, setIsCommitting] = useState(false);

  // 名前変更用のローカル状態
  const [newName, setNewName] = useState('');

  // 👆 横スワイプ（タッチ＆ドラッグ）判定用の位置状態
  const [touchStartPos, setTouchStartPos] = useState(null);

  // 🛡️ 装備変更タブ用のローカル記憶（テスト用モック状態）
  const [equippedItems, setEquippedItems] = useState({
    helm_top: null, helm_mid: null, helm_bot: null,
    armor: null, weapon: null, shield: null,
    garment: null, shoes: null, accessory: null
  });

  // 🎒 装備変更時に選べる一時的なキャラクター用バッグ（ギルド倉庫から持ってきた設定）
  const [availableEquips, setAvailableEquips] = useState([
    { id: 201, name: 'マインゴーシュ [4]', type: 'weapon', atk: 45, text: 'STR+2 / 4つのスロットを持つ短剣' },
    { id: 202, name: 'バフォメットJrカード挿頭巾', type: 'helm_top', atk: 5, text: 'LUK+5 / クリティカル率大幅上昇' },
    { id: 203, name: '高級シルクローブ', type: 'armor', def: 18, text: 'INT+3 / 魔法防御に優れた上質な絹の鎧' },
    { id: 204, name: 'ヴィダルのブーツ', type: 'shoes', def: 12, text: 'MHP+10% / 敏捷性も微増する重厚なブーツ' }
  ]);

  // 現在どのスロットを選択して装備を変更しようとしているか
  const [selectedSlotKey, setSelectedSlotKey] = useState(null);

  // 1. Supabaseから詳細データをロード
  useEffect(() => {
    const loadCharData = async () => {
      setLoading(true);
      const charList = await gameServices.getPlayerCharacters("d1669717-95f4-4f80-932f-d412576d55a7");
      const data = charList?.find(c => c.id === characterId);
      
      if (data) {
        setCharacter(data);
        setLocalPoints(data.status_points || 0);
        setLocalBonuses({
          str: data.bonus?.str || 0,
          agi: data.bonus?.agi || 0,
          vit: data.bonus?.vit || 0,
          int: data.bonus?.int || 0,
          dex: data.bonus?.dex || 0,
          luk: data.bonus?.luk || 0,
        });
        setNewName(data.custom_name || '');
      }
      setLoading(false);
    };
    loadCharData();
  }, [characterId]);

  // 📲 横スワイプ判定ロジック
  const handleSwipeStart = (clientX) => {
    setTouchStartPos(clientX);
  };

  const handleSwipeEnd = (clientX) => {
    if (touchStartPos === null) return;
    const diffX = touchStartPos - clientX;
    const minSwipeDistance = 60;
    const currentIdx = TABS.indexOf(activeTab);

    if (diffX > minSwipeDistance) {
      if (currentIdx < TABS.length - 1) setActiveTab(TABS[currentIdx + 1]);
    } else if (diffX < -minSwipeDistance) {
      if (currentIdx > 0) setActiveTab(TABS[currentIdx - 1]);
    }
    setTouchStartPos(null);
  };

  // ステータス加算処理
  const handleAddStat = (stat) => {
    if (localPoints <= 0) return;
    setLocalPoints(prev => prev - 1);
    setLocalBonuses(prev => ({ ...prev, [stat]: prev[stat] + 1 }));
  };

  // ステ振りリセット
  const handleReset = () => {
    if (!character) return;
    setLocalPoints(character.status_points || 0);
    setLocalBonuses({
      str: character.bonus?.str || 0,
      agi: character.bonus?.agi || 0,
      vit: character.bonus?.vit || 0,
      int: character.bonus?.int || 0,
      dex: character.bonus?.dex || 0,
      luk: character.bonus?.luk || 0,
    });
  };

  // ⚔️ ステ振りコミット
  const handleCommitStatus = async () => {
    if (!character || isCommitting) return;
    setIsCommitting(true);
    try {
      const res = await gameServices.saveStatusAllocation(character.id, localBonuses, localPoints);
      if (res && res.success) {
        alert(`🎉 ${character.custom_name} のステータスを極振りにコミットしました！`);
        setCharacter(prev => ({
          ...prev,
          status_points: localPoints,
          bonus: { ...localBonuses }
        }));
      } else {
        alert('ステ振り保存エラー: ' + (res?.error || '不明なエラー'));
      }
    } catch (err) {
      console.error("❌ コミット中に例外エラーが発生:", err);
      alert(`ステータス確定に失敗しました。\nエラー内容: ${err.message || err}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // 🛡️ 装備の装着ロジック
  const equipItem = (slotKey, item) => {
    // 現在そのスロットに何かあればバッグに戻す
    const currentEquipped = equippedItems[slotKey];
    let newBag = [...availableEquips];
    if (currentEquipped) {
      newBag.push(currentEquipped);
    }
    // 新しい装備をスロットにセットし、バッグから消去
    setEquippedItems(prev => ({ ...prev, [slotKey]: item }));
    setAvailableEquips(newBag.filter(i => i.id !== item.id));
    setSelectedSlotKey(null);
  };

  // 🛡️ 装備の外しロジック
  const unequipItem = (slotKey) => {
    const item = equippedItems[slotKey];
    if (!item) return;
    setAvailableEquips(prev => [...prev, item]);
    setEquippedItems(prev => ({ ...prev, [slotKey]: null }));
  };

  // 📊 装備による戦闘力ステータス変動の計算モック
  const calculateDerivedStats = () => {
    let extraAtk = equippedItems.weapon?.atk || 0;
    extraAtk += equippedItems.helm_top?.atk || 0;
    let extraDef = (equippedItems.armor?.def || 0) + (equippedItems.shoes?.def || 0);
    return { atk: 10 + extraAtk, def: 5 + extraDef };
  };

  const derivedStats = calculateDerivedStats();

  if (loading) return <div style={{ color: '#f59e0b', textAlign: 'center', padding: '50px' }}>キャラクターのステータスを同期中...</div>;
  if (!character) return <div style={{ color: '#ef4444', padding: '20px' }}>冒険者のデータが見つかりません。</div>;

  return (
    <div 
      style={{ padding: '0 20px', color: '#fff', minHeight: '60vh', userSelect: 'none' }}
      onTouchStart={(e) => handleSwipeStart(e.touches[0].clientX)}
      onTouchEnd={(e) => handleSwipeEnd(e.changedTouches[0].clientX)}
      onMouseDown={(e) => handleSwipeStart(e.clientX)}
      onMouseUp={(e) => handleSwipeEnd(e.clientX)}
    >
      
      {/* 戻るボタンと名前ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
        <button onClick={onBack} style={{ position: 'absolute', left: 0, padding: '6px 12px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
          ← 戻る
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 2px 0', fontSize: '1.2rem', color: '#fff', fontWeight: 'bold' }}>{character.custom_name}</h2>
          <span style={{ fontSize: '0.65rem', color: '#f59e0b', background: '#451a03', padding: '2px 8px', borderRadius: '4px' }}>
            Lv.{character.level} {character.meta?.job || 'ノービス'}
          </span>
        </div>
      </div>

      {/* 🧭 「4大機能」を切り替えるメニュータブ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '20px', background: '#0f172a', padding: '4px', borderRadius: '8px' }}>
        <button onClick={() => setActiveTab('status')} style={{ padding: '8px 4px', background: activeTab === 'status' ? '#1e293b' : 'none', border: 'none', borderRadius: '6px', color: activeTab === 'status' ? '#f59e0b' : '#64748b', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <Plus size={14} /> ステ振り
        </button>
        <button onClick={() => setActiveTab('equipment')} style={{ padding: '8px 4px', background: activeTab === 'equipment' ? '#1e293b' : 'none', border: 'none', borderRadius: '6px', color: activeTab === 'equipment' ? '#f59e0b' : '#64748b', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <Shield size={14} /> 装備変更
        </button>
        <button onClick={() => setActiveTab('inventory')} style={{ padding: '8px 4px', background: activeTab === 'inventory' ? '#1e293b' : 'none', border: 'none', borderRadius: '6px', color: activeTab === 'inventory' ? '#f59e0b' : '#64748b', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <Briefcase size={14} /> 荷物管理
        </button>
        <button onClick={() => setActiveTab('rename')} style={{ padding: '8px 4px', background: activeTab === 'rename' ? '#1e293b' : 'none', border: 'none', borderRadius: '6px', color: activeTab === 'rename' ? '#f59e0b' : '#64748b', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <Type size={14} /> 名前変更
        </button>
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.65rem', color: '#475569', marginBottom: '12px' }}>
        ← 左右にスワイプしてタブ切り替え可能 →
      </div>

      {/* --- タブ①：ステ振り部屋 --- */}
      {activeTab === 'status' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', padding: '12px 15px', borderRadius: '12px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>残りステータスポイント (STATUS POINTS)</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#c084fc', fontFamily: 'monospace' }}>{localPoints}</span>
          </div>

          {Object.keys(STAT_LABELS).map(statKey => {
            const baseValue = character.meta?.[`stat_${statKey}`] || 0;
            const currentBonus = localBonuses[statKey];
            return (
              <div key={statKey} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '12px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#fff' }}>{STAT_LABELS[statKey].name}</div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>{STAT_LABELS[statKey].desc}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 'bold' }}>
                    {baseValue + (currentBonus - (character.bonus?.[statKey] || 0))} 
                    <span style={{ color: '#10b981', fontSize: '0.75rem', marginLeft: '4px' }}>+{currentBonus}</span>
                  </div>
                  <button onClick={() => handleAddStat(statKey)} disabled={localPoints <= 0} style={{ width: '32px', height: '32px', borderRadius: '8px', background: localPoints > 0 ? '#1e293b' : '#0f172a', color: localPoints > 0 ? '#fff' : '#4b5563', border: '1px solid #334155', fontSize: '1.2rem', cursor: localPoints > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>
            );
          })}

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', marginBottom: '30px' }}>
            <button onClick={handleReset} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <RotateCcw size={14} /> 振り直し
            </button>
            <button onClick={handleCommitStatus} disabled={isCommitting} style={{ flex: 2, padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', border: 'none', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(217,119,6,0.3)' }}>
              <Save size={14} /> ステータスを確定する
            </button>
          </div>
        </div>
      )}

      {/* --- 🆕 タブ②：装備変更（RO式・7部位展開スロット） --- */}
      {activeTab === 'equipment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '30px' }}>
          
          {/* ⚔️ 装備連動型・戦闘ステータスボード */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)', padding: '15px', borderRadius: '14px', border: '1px solid #4338ca' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.65rem', color: '#818cf8', display: 'block' }}>⚔️ 現在の物理ATK</span>
              <strong style={{ fontSize: '1.4rem', color: '#fff', fontFamily: 'monospace' }}>{derivedStats.atk}</strong>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.65rem', color: '#818cf8', display: 'block' }}>🛡️ 現在の装備DEF</span>
              <strong style={{ fontSize: '1.4rem', color: '#34d399', fontFamily: 'monospace' }}>+{derivedStats.def}</strong>
            </div>
          </div>

          {/* 🛡️ 7部位＋上下段スロットグリッド展開 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {EQUIP_SLOTS.map(slot => {
              const equippedItem = equippedItems[slot.key];
              return (
                <div key={slot.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{
                    background: '#111827', border: selectedSlotKey === slot.key ? '1px solid #f59e0b' : '1px solid #1e293b',
                    borderRadius: '12px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* 部位アイコン */}
                      <div style={{ background: '#1e293b', padding: '8px', borderRadius: '8px', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                        {slot.icon}
                      </div>
                      <div>
                        <span style={{ fontSize: '0.6rem', color: '#64748b', display: 'block' }}>{slot.name}</span>
                        <strong style={{ fontSize: '0.8rem', color: equippedItem ? '#a78bfa' : '#475569' }}>
                          {equippedItem ? equippedItem.name : '未装備'}
                        </strong>
                      </div>
                    </div>

                    {/* 着脱アクションボタン */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {equippedItem && (
                        <button 
                          onClick={() => unequipItem(slot.key)}
                          style={{ padding: '4px 10px', background: '#311010', border: '1px solid #7f1d1d', borderRadius: '6px', color: '#f43f5e', fontSize: '0.65rem', cursor: 'pointer' }}
                        >
                          外す
                        </button>
                      )}
                      <button 
                        onClick={() => setSelectedSlotKey(selectedSlotKey === slot.key ? null : slot.key)}
                        style={{
                          padding: '4px 12px', borderRadius: '6px', fontSize: '0.65rem', cursor: 'pointer',
                          background: selectedSlotKey === slot.key ? '#451a03' : '#1e293b',
                          color: selectedSlotKey === slot.key ? '#f59e0b' : '#94a3b8',
                          border: selectedSlotKey === slot.key ? '1px solid #f59e0b' : '1px solid #334155'
                        }}
                      >
                        {selectedSlotKey === slot.key ? '閉じる' : '変更'}
                      </button>
                    </div>
                  </div>

                  {/* 🎒 変更を押したときにヌルッと開く「その部位専用のバッグアイテムリスト」 */}
                  {selectedSlotKey === slot.key && (
                    <div style={{ background: '#0b0f19', border: '1px dashed #334155', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: '10px' }}>
                      <span style={{ fontSize: '0.6rem', color: '#64748b' }}>装備可能なアイテム:</span>
                      {availableEquips.filter(i => i.type === slot.key || (slot.key.startsWith('helm') && i.type === 'helm_top')).map(item => (
                        <div 
                          key={item.id}
                          onClick={() => equipItem(slot.key, item)}
                          style={{ background: '#1e293b', padding: '8px 12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: '1px solid #334155' }}
                        >
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#fff' }}>{item.name}</div>
                            <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '2px' }}>{item.text}</div>
                          </div>
                          <span style={{ fontSize: '0.65rem', color: '#34d399', fontWeight: 'bold' }}>装着 ➔</span>
                        </div>
                      ))}
                      {availableEquips.filter(i => i.type === slot.key || (slot.key.startsWith('helm') && i.type === 'helm_top')).length === 0 && (
                        <div style={{ fontSize: '0.65rem', color: '#4b5563', textAlign: 'center', padding: '6px' }}>対応する装備品を所持していません。</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- タブ③：荷物管理 --- */}
      {activeTab === 'inventory' && (
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
          <p style={{ margin: '0 0 10px 0', color: '#fff', fontWeight: 'bold' }}>🎒 個人バッグ ⇔ ギルド共有倉庫</p>
          <p style={{ margin: 0, lineHeight: '1.6' }}>
            冒険者が個人で持ち歩く荷物と、ギルド共有の倉庫アイテムを「出し入れ・受け渡し」するシステムがここにドッキングされます。
          </p>
        </div>
      )}

      {/* --- タブ④：名前変更 --- */}
      {activeTab === 'rename' && (
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>新しいキャラクター名</label>
          <input 
            type="text" 
            value={newName} 
            onChange={(e) => setNewName(e.target.value)} 
            style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '0.85rem', boxSizing: 'border-box' }} 
          />
          <button 
            onClick={() => alert(`📝 「${newName}」への名前変更をSupabaseにコミットする処理を今後接続します！`)} 
            style={{ padding: '10px', borderRadius: '8px', background: '#1e293b', color: '#fff', border: '1px solid #334155', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
          >
            名前を保存する
          </button>
        </div>
      )}

    </div>
  );
};

export default AdventureCharacterDetail;
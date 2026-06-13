import React, { useState, useEffect } from 'react';
import { Shield, Briefcase, Type, Save, RotateCcw, Plus, Swords, Sun, Moon, Layers, Footprints, Gem, Crosshair, Zap, Award } from 'lucide-react';
import { gameServices, calculateRoStatus } from '../../../gameServices';
import { supabase } from '../../../supabaseClient';

// 日本語のステータス説明マッピング
const STAT_LABELS = {
  str: { name: 'STR（腕力）', desc: '物理攻撃力 ＆ アイテム所限限界量に影響' },
  agi: { name: 'AGI（敏捷）', desc: '攻撃速度 ＆ 物理回避率に影響' },
  vit: { name: 'VIT（体力）', desc: '最大HP増幅 ＆ 物理防御力に影響' },
  int: { name: 'INT（知力）', desc: '魔法攻撃力 ＆ 最大SP増幅に影響' },
  dex: { name: 'DEX / 技量', desc: '物理命中率 ＆ 魔法詠唱時間の短縮に影響' },
  luk: { name: 'LUK（幸運）', desc: 'クリティカル率 ＆ 完全回避率に影響' }
};

const TABS = ['status', 'equipment', 'inventory', 'rename'];

// 👑 三土手神仕様：最強の9大装備スロット配列定義
const EQUIP_SLOTS = [
  { key: 'right_hand', name: '①右手 (メイン武器)', icon: <Swords size={13} /> },
  { key: 'left_hand', name: '②左手 (盾・副武器)', icon: <Shield size={13} color="#856434" /> },
  { key: 'head', name: '③兜', icon: <Sun size={13} /> },
  { key: 'face', name: '④フェイス', icon: <Layers size={13} /> },
  { key: 'body', name: '⑤鎧', icon: <Shield size={13} /> },
  { key: 'glove', name: '⑥小手', icon: <Plus size={13} color="#856434" /> },
  { key: 'garment', name: '⑦肩', icon: <Layers size={13} color="#856434" /> },
  { key: 'shoes', name: '⑧靴', icon: <Footprints size={13} /> },
  { key: 'accessory', name: '⑨装飾 (アクセサリー)', icon: <Gem size={13} /> }
];

const AdventureCharacterDetail = ({ characterId, onBack }) => {
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('status');

  const [localPoints, setLocalPoints] = useState(0);
  const [localBonuses, setLocalBonuses] = useState({ str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 });
  const [isCommitting, setIsCommitting] = useState(false);
  const [newName, setNewName] = useState('');

  const [touchStartPos, setTouchStartPos] = useState(null);
  const [guildInventory, setGuildInventory] = useState([]);
  const [selectedSlotKey, setSelectedSlotKey] = useState(null);
  const [isEquipping, setIsEquipping] = useState(false);

  const loadCharAndInventoryData = async () => {
    setLoading(true);
    const testUserId = "d1669717-95f4-4f80-932f-d412576d55a7";
    const charList = await gameServices.getPlayerCharacters(testUserId);
    const data = charList?.find(c => c.id === characterId);
    const invData = await gameServices.getPlayerInventory(testUserId);
    if (invData) setGuildInventory(invData);

    if (data) {
      const { data: allItems } = await supabase.from('game_master_items').select('*');
      
      // 倉庫が空っぽでもデバッグボタンが出るようマスター一覧を退避
      data.allMasterItemsList = allItems || [];
      
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

  useEffect(() => { loadCharAndInventoryData(); }, [characterId]);

  const handleSwipeStart = (clientX) => { setTouchStartPos(clientX); };
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

  const handleAddStat = (stat) => {
    if (localPoints <= 0) return;
    setLocalPoints(prev => prev - 1);
    setLocalBonuses(prev => ({ ...prev, [stat]: prev[stat] + 1 }));
  };

  const handleReset = () => {
    if (!character) return;
    setLocalPoints(character.status_points || 0);
    setLocalBonuses({ str: character.bonus?.str || 0, agi: character.bonus?.agi || 0, vit: character.bonus?.vit || 0, int: character.bonus?.int || 0, dex: character.bonus?.dex || 0, luk: character.bonus?.luk || 0 });
  };

  const handleCommitStatus = async () => {
    if (!character || isCommitting) return;
    setIsCommitting(true);
    try {
      const res = await gameServices.saveStatusAllocation(character.id, localBonuses, localPoints);
      if (res && res.success) {
        alert(`🎉 ステータスを確定しました！`);
        await loadCharAndInventoryData();
      }
    } catch (err) { alert(err.message); }
    finally { setIsCommitting(false); }
  };

  // 🛡️ ギルド倉庫ストック増減型の新しい超快適着脱ロジック
  const handleEquipItem = async (slotKey, itemMasterId) => {
    if (isEquipping) return;
    setIsEquipping(true);
    const testUserId = "d1669717-95f4-4f80-932f-d412576d55a7";
    try {
      const res = await gameServices.saveEquipmentChange(testUserId, character.id, slotKey, itemMasterId);
      if (res && res.success) {
        setSelectedSlotKey(null);
        await loadCharAndInventoryData();
      } else {
        alert(res.error);
      }
    } catch (err) { console.error(err); }
    finally { setIsEquipping(false); }
  };

  const handleUnequipItem = async (slotKey) => {
    if (isEquipping) return;
    setIsEquipping(true);
    const testUserId = "d1669717-95f4-4f80-932f-d412576d55a7";
    try {
      const res = await gameServices.saveEquipmentChange(testUserId, character.id, slotKey, null);
      if (res && res.success) {
        await loadCharAndInventoryData();
      } else {
        alert(res.error);
      }
    } catch (err) { console.error(err); }
    finally { setIsEquipping(false); }
  };

  // 🛡️ 【神仕様リフォーム】カバンは完全に無視して、直接ギルド共有倉庫（guildInventory）からサジェスト！
  const getEligibleItemsForSlot = (slotKey) => {
    if (!guildInventory || guildInventory.length === 0) return [];
    return guildInventory.filter(inv => {
      // 在庫が1個以上ある現物のみにロック
      if (!inv.count || inv.count <= 0) return false;
      
      const master = inv.game_master_items;
      if (!master) return false;
      
      // 9部位スロットの分類ルールに直接マッピング
      if (slotKey === 'right_hand') return master.item_type === 'weapon';
      if (slotKey === 'left_hand') return master.item_subtype === '盾' || master.item_type === 'weapon';
      if (slotKey === 'head') return master.item_subtype === '兜';
      if (slotKey === 'face') return master.item_subtype === 'フェイス';
      if (slotKey === 'body') return master.item_subtype === '鎧';
      if (slotKey === 'glove') return master.item_subtype === '小手';
      if (slotKey === 'garment') return master.item_subtype === '肩';
      if (slotKey === 'shoes') return master.item_subtype === '靴';
      if (slotKey === 'accessory') return master.item_subtype === 'アクセサリ';
      return false;
    });
  };

  if (loading) return <div style={{ color: '#ffd700', textAlign: 'center', padding: '50px', fontFamily: 'serif' }}>古代スクロール同期中...</div>;
  if (!character) return <div style={{ color: '#ef4444', padding: '20px' }}>冒険者が不在です。</div>;

  const currentTempCharForCalc = { ...character, bonus: { ...localBonuses } };
  const ro = calculateRoStatus(currentTempCharForCalc, character.equips || {});

  const liveMaxHp = (character.meta?.base_hp || 100) + (currentTempCharForCalc.bonus.vit * 10);
  const liveMaxSp = (character.meta?.base_sp || 10) + (currentTempCharForCalc.bonus.int * 2);

  const SectionHeader = ({ title }) => (
    <div style={{ background: 'linear-gradient(90deg, #161109 0%, #0d0905 100%)', padding: '6px 12px', borderTop: '1px solid #3a2d1a', borderBottom: '1px solid #3a2d1a', display: 'flex', justifyContent: 'space-between', alignItem: 'center', marginTop: '14px', marginBottom: '8px' }}>
      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ffd700', letterSpacing: '1px', fontFamily: 'serif' }}>{title}</span>
      <span style={{ fontSize: '0.65rem', color: '#856434', fontFamily: 'serif', fontStyle: 'italic' }}>⚜️⚜️</span>
    </div>
  );

  return (
    <div 
      style={{ padding: '0 16px 40px 16px', color: '#f1f5f9', background: '#0a0704', minHeight: '100vh', userSelect: 'none', boxSizing: 'border-box' }}
      onTouchStart={(e) => handleSwipeStart(e.touches[0].clientX)}
      onTouchEnd={(e) => handleSwipeEnd(e.changedTouches[0].clientX)}
      onMouseDown={(e) => handleSwipeStart(e.clientX)}
      onMouseUp={(e) => handleSwipeEnd(e.clientX)}
    >
      {/* 上部ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', paddingTop: '16px', marginBottom: '16px', position: 'relative', borderBottom: '1px solid #2d1f10', paddingBottom: '12px' }}>
        <button onClick={onBack} style={{ position: 'absolute', left: 0, padding: '5px 12px', background: '#1c140a', color: '#c4a473', border: '1px solid #4a341b', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>← 戻る</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', color: '#f5f5f5', fontWeight: 'bold', letterSpacing: '1px', fontFamily: 'serif' }}>{character.custom_name}</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', color: '#ffb834', background: '#2d1500', padding: '2px 8px', borderRadius: '4px', border: '1px solid #7c4400', fontWeight: 'bold' }}>Lv.{character.level} {character.meta?.job || 'ノービス'}</span>
            <span style={{ fontSize: '0.6rem', color: '#ba9a6f' }}>🏰 {ro.guild_name}</span>
          </div>
        </div>
      </div>

      {/* メニュータブ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', marginBottom: '10px', background: '#302213', padding: '1px', borderRadius: '6px' }}>
        {['status', 'equipment', 'inventory', 'rename'].map((tabKey) => (
          <button key={tabKey} onClick={() => setActiveTab(tabKey)} style={{ padding: '8px 0', background: activeTab === tabKey ? 'linear-gradient(180deg, #2a1f11 0%, #161109 100%)' : '#0d0905', border: 'none', color: activeTab === tabKey ? '#ffd700' : '#887055', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            {tabKey === 'status' ? <Plus size={12} /> : tabKey === 'equipment' ? <Shield size={12} /> : tabKey === 'inventory' ? <Briefcase size={12} /> : <Type size={12} />}
            {tabKey === 'status' ? '能力値' : tabKey === 'equipment' ? '装備変更' : tabKey === 'inventory' ? '荷物管理' : '名前変更'}
          </button>
        ))}
      </div>

      {/* キャラクター基本スペック */}
      <div style={{ background: '#0e0b07', border: '1px solid #23190e', padding: '12px', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.72rem' }}>
          <div style={{ display: 'flex' }}><span style={{ color: '#887355', width: '70px' }}>ジョブ</span><span style={{ color: '#eee', fontWeight: 'bold' }}>{character.meta?.job || 'ノービス'}</span></div>
          <div style={{ display: 'flex' }}><span style={{ color: '#887355', width: '70px' }}>種族属性</span><span style={{ color: '#eee' }}>{character.meta?.race || '人間'}</span></div>
          <div style={{ display: 'flex' }}><span style={{ color: '#887355', width: '70px' }}>現在のHP</span><span style={{ color: '#34d399', fontFamily: 'monospace', fontWeight: 'bold' }}>{character.current_hp} / {liveMaxHp}</span></div>
          <div style={{ display: 'flex' }}><span style={{ color: '#887355', width: '70px' }}>現在のSP</span><span style={{ color: '#38bdf8', fontFamily: 'monospace', fontWeight: 'bold' }}>{character.current_sp} / {liveMaxSp}</span></div>
        </div>
        <div style={{ height: '90px', background: 'linear-gradient(180deg, #1a130b 0%, #0d0905 100%)', border: '1px dashed #42321c', borderRadius: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#5a4531' }}>
          <Award size={28} color="#42321c" />
          <span style={{ fontSize: '0.55rem', color: '#887055', marginTop: '4px', fontFamily: 'serif' }}>AVATAR FRAME</span>
        </div>
      </div>

      {/* タブ①：能力値・ステ振り */}
      {activeTab === 'status' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <SectionHeader title="ステータスポイント" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#120d08', padding: '10px 14px', borderRadius: '8px', border: '1px solid #23190e' }}>
            <span style={{ fontSize: '0.75rem', color: '#ba9a6f' }}>保有フリーポイント</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#ffd700', fontFamily: 'monospace' }}>{localPoints}</span>
          </div>

          <SectionHeader title="能力値 (Base Status)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {Object.keys(STAT_LABELS).map(statKey => {
              const baseValue = character.meta?.[`stat_${statKey}`] || 0;
              const currentBonus = localBonuses[statKey];
              const totalValue = baseValue + currentBonus;
              return (
                <div key={statKey} style={{ background: '#0d0905', border: '1px solid #1c140a', borderRadius: '8px', padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr 100px 32px', alignItems: 'center' }}>
                  <div style={{ paddingRight: '8px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#fff', display: 'block' }}>{STAT_LABELS[statKey].name}</span>
                    <span style={{ fontSize: '0.58rem', color: '#705c45', display: 'block', marginTop: '1px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{STAT_LABELS[statKey].desc}</span>
                  </div>
                  <div style={{ textalign: 'right', paddingRight: '12px', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ffd700' }}>{totalValue}</div>
                    <div style={{ color: '#34d399', fontSize: '0.62rem', fontWeight: 'bold', marginTop: '1px' }}>(+{currentBonus})</div>
                  </div>
                  <button onClick={() => handleAddStat(statKey)} disabled={localPoints <= 0} style={{ width: '32px', height: '32px', borderRadius: '6px', background: localPoints > 0 ? 'linear-gradient(180deg, #4a341b 0%, #21150b 100%)' : '#140e08', color: localPoints > 0 ? '#ffd700' : '#4a341b', border: '1px solid #4a341b', fontSize: '1.1rem', fontWeight: 'bold', cursor: localPoints > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              );
            })}
          </div>

          <SectionHeader title="戦闘能力値 (Derived Status)" />
          <div style={{ background: '#0a0704', border: '1px solid #23190e', borderRadius: '8px', padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a130b', paddingBottom: '3px' }}><span style={{ color: '#887355' }}>攻撃力 (Atk)</span><strong style={{ color: '#eee', fontFamily: 'monospace' }}>{ro.atk}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a130b', paddingBottom: '3px' }}><span style={{ color: '#887355' }}>防御力 (Def)</span><strong style={{ color: '#34d399', fontFamily: 'monospace' }}>+{ro.def}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a130b', paddingBottom: '3px' }}><span style={{ color: '#887355' }}>命中 (Hit)</span><strong style={{ color: '#eee', fontFamily: 'monospace' }}>{ro.hit}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a130b', paddingBottom: '3px' }}><span style={{ color: '#887355' }}>回避 (Flee)</span><strong style={{ color: '#eee', fontFamily: 'monospace' }}>{ro.flee}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a130b', paddingBottom: '3px' }}><span style={{ color: '#887355' }}>行動速度 (Aspd)</span><strong style={{ color: '#ffd700', fontFamily: 'monospace' }}>{ro.aspd.toFixed(1)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a130b', paddingBottom: '3px' }}><span style={{ color: '#887355' }}>致命打率 (Critical)</span><strong style={{ color: '#fbbf24', fontFamily: 'monospace' }}>{ro.critical}%</strong></div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button onClick={handleReset} style={{ flex: 1, padding: '10px', borderRadius: '6px', background: '#161109', color: '#ba9a6f', border: '1px solid #3a2d1a', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><RotateCcw size={12} /> 振り直し</button>
            <button onClick={handleCommitStatus} disabled={isCommitting} style={{ flex: 2, padding: '10px', borderRadius: '6px', background: 'linear-gradient(180deg, #856434 0%, #4a341b 100%)', color: '#fff', border: '1px solid #ffd70033', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><Save size={12} /> 能力値を確定する</button>
          </div>
        </div>
      )}

      {/* --- 🛡️ タブ②：装備変更（共有倉庫ストック直接連動アコーディオン） --- */}
      {activeTab === 'equipment' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <SectionHeader title="現在の戦闘力" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'linear-gradient(180deg, #1c140a 0%, #0d0905 100%)', padding: '12px', borderRadius: '10px', border: '1px solid #4a341b' }}>
            <div style={{ textAlign: 'center' }}><span style={{ fontSize: '0.62rem', color: '#ba9a6f', display: 'block' }}>⚔️ 物理ATK</span><strong style={{ fontSize: '1.25rem', color: '#fff', fontFamily: 'monospace' }}>{ro.atk}</strong></div>
            <div style={{ textAlign: 'center' }}><span style={{ fontSize: '0.62rem', color: '#ba9a6f', display: 'block' }}>🛡️ 装備DEF</span><strong style={{ fontSize: '1.25rem', color: '#34d399', fontFamily: 'monospace' }}>+{ro.def}</strong></div>
          </div>

          <SectionHeader title="9部位装備スロット" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {EQUIP_SLOTS.map(slot => {
              const equippedItem = character.equips?.[slot.key];
              return (
                <div key={slot.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ background: '#0d0905', border: selectedSlotKey === slot.key ? '1px solid #ffd700' : '1px solid #1c140a', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: '#1c140a', padding: '6px', borderRadius: '6px', color: '#c4a473', border: '1px solid #3a2d1a', display: 'flex', alignItems: 'center' }}>{slot.icon}</div>
                      <div>
                        <span style={{ fontSize: '0.58rem', color: '#887055', display: 'block' }}>{slot.name}</span>
                        <strong style={{ fontSize: '0.78rem', color: equippedItem ? '#ffd700' : '#4b3f2f' }}>{equippedItem ? `${equippedItem.name} [${equippedItem.slot_count}]` : '未装備'}</strong>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {equippedItem && <button onClick={() => handleUnequipItem(slot.key)} disabled={isEquipping} style={{ padding: '3px 8px', background: '#2d0a0a', border: '1px solid #5a1414', borderRadius: '4px', color: '#f43f5e', fontSize: '0.6rem', cursor: 'pointer' }}>外す</button>}
                      <button 
  onClick={() => setSelectedSlotKey(selectedSlotKey === slot.key ? null : slot.key)} 
  style={{ 
    padding: '3px 10px', 
    borderRadius: '4px', 
    fontSize: '0.6rem', 
    cursor: 'pointer', 
    background: selectedSlotKey === slot.key ? '#5a4531' : '#1c140a', 
    color: selectedSlotKey === slot.key ? '#fff' : '#c4a473', // ⭕ selectedSlotKey に修正完了！
    border: '1px solid #3a2d1a' 
  }}
>
  {selectedSlotKey === slot.key ? '閉じる' : '変更'}
</button>
                    </div>
                  </div>

                  {selectedSlotKey === slot.key && (
                    <div style={{ background: '#070503', border: '1px dashed #4a341b', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px', marginLeft: '8px' }}>
                      <span style={{ fontSize: '0.55rem', color: '#887055' }}>🛡️ 倉庫ストックから選んで直接装備:</span>
                      {getEligibleItemsForSlot(slot.key).map(inv => {
                        const masterItem = inv.game_master_items;
                        if (!masterItem) return null;

                        // 武具のマスターIDを確実に固定抽出
                        const targetMasterItemId = masterItem.id || inv.item_id;

                        return (
                          <div 
                            key={inv.id} 
                            onClick={() => {
                              if (!targetMasterItemId) {
                                console.error("🚨 武具のマスターIDが取得できませんでした", inv);
                                return;
                              }
                              console.log("⚡ [装着ボタン着火]", { slotKey: slot.key, itemMasterId: targetMasterItemId });
                              handleEquipItem(slot.key, targetMasterItemId);
                            }} 
                            style={{ background: '#130e09', padding: '6px 10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: '1px solid #23190e' }}
                          >
                            <div>
                              <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#eee' }}>{masterItem.name} [{masterItem.slot_count || 0}]</div>
                              <div style={{ fontSize: '0.58rem', color: '#887355', marginTop: '1px' }}>
                                {masterItem.description} {masterItem.atk ? `(ATK:${masterItem.atk})` : ''} {masterItem.def ? `(DEF:${masterItem.def})` : ''} 
                                <span style={{ color: '#ffd700', marginLeft: '6px' }}>(共有残: {inv.count}個)</span>
                              </div>
                            </div>
                            <span style={{ fontSize: '0.6rem', color: '#34d399', fontWeight: 'bold' }}>装着 ➔</span>
                          </div>
                        );
                      })}
                      {getEligibleItemsForSlot(slot.key).length === 0 && <div style={{ fontSize: '0.58rem', color: '#4a3f2f', textAlign: 'center', padding: '4px' }}>共有倉庫に対象の武具在庫がありません。</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- 🛡️ タブ③：荷物管理（カバン要素全廃・倉庫ストック一覧UI） --- */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          {/* 👑 神のGMデバッグ特権：全武具支給コマンドパネル */}
          <SectionHeader title="世界創生神のアイテム支給所（開発検証用）" />
          <div style={{ background: '#1c140a', border: '1px dashed #ffd700', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.6rem', color: '#ffd700' }}>※ マスターに存在する武具をギルド倉庫に10個強制ポップさせます</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
              {(character.allMasterItemsList || []).map(item => {
                return (
                  <button 
                    key={item.id}
                    onClick={async () => {
                      await gameServices.debugGiveItemToWarehouse("d1669717-95f4-4f80-932f-d412576d55a7", item.id, 10);
                      await loadCharAndInventoryData();
                    }}
                    style={{ padding: '6px', background: '#0d0905', border: '1px solid #4a341b', color: '#ffd700', fontSize: '0.62rem', borderRadius: '4px', cursor: 'pointer', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    ➕ {item.name} ✕10支給
                  </button>
                );
              })}
            </div>
          </div>

          {/* 🏛️ ギルド共有倉庫ストック一覧 */}
          <SectionHeader title="ギルド共有倉庫ストック一覧" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '350px', overflowY: 'auto', background: '#0d0905', padding: '6px', borderRadius: '8px' }}>
            {guildInventory.map(inv => {
              const item = inv.game_master_items;
              if (!item || inv.count <= 0) return null;
              return (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#130e09', padding: '6px 10px', borderRadius: '6px', fontSize: '0.7rem' }}>
                  <span>{item.name} [{item.slot_count}] <span style={{ color: '#887355' }}>({item.item_subtype})</span></span>
                  <span style={{ color: '#34d399', fontWeight: 'bold', fontFamily: 'monospace' }}>✕ {inv.count}個</span>
                </div>
              );
            })}
            {guildInventory.filter(inv => inv.game_master_items && inv.count > 0).length === 0 && (
              <div style={{ fontSize: '0.65rem', color: '#4b3f2f', textAlign: 'center', padding: '15px' }}>倉庫にストックがありません。上の支給所からポップさせてください。</div>
            )}
          </div>

        </div>
      )}

      {/* タブ④：名前変更 */}
      {activeTab === 'rename' && (
        <div>
          <SectionHeader title="二つ名・身分改名" />
          <div style={{ background: '#0d0905', border: '1px solid #1c140a', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '0.7rem', color: '#ba9a6f', fontWeight: 'bold' }}>新しい登録名称</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: '100%', background: '#130e09', border: '1px solid #4a341b', borderRadius: '6px', padding: '8px 10px', color: '#fff', fontSize: '0.8rem', boxSizing: 'border-box', outline: 'none' }} />
            <button onClick={() => alert(`📝 名称変更処理を接続します！`)} style={{ padding: '9px', borderRadius: '6px', background: 'linear-gradient(180deg, #4a341b 0%, #1c140a 100%)', color: '#ffd700', border: '1px solid #4a341b', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer' }}>改名をギルドに届ける</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdventureCharacterDetail;
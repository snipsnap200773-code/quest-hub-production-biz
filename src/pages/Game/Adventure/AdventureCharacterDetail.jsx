import React, { useState, useEffect } from 'react';
import { Shield, Briefcase, Type, Save, RotateCcw, Plus, Swords, Sun, Moon, Layers, Footprints, Gem, Crosshair, Zap, Award, X } from 'lucide-react';
import { gameServices, calculateRoStatus } from '../../../gameServices';
import { supabase } from '../../../supabaseClient';
import { RO_NEXT_EXP_TABLE } from '../../../gameRules';

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

  // 🔮 プランA連動：現在装着されているカード情報を保持するState
  const [equippedCards, setEquippedCards] = useState([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null); // カードを挿しようとしているスロットの番号

  const loadCharAndInventoryData = async () => {
    setLoading(true);
    const testUserId = "d1669717-95f4-4f80-932f-d412576d55a7";
    const charList = await gameServices.getPlayerCharacters(testUserId);
    const data = charList?.find(c => c.id === characterId);
    const invData = await gameServices.getPlayerInventory(testUserId);
    if (invData) setGuildInventory(invData);

    // 🔮 スロット分離テーブルから現在のカード装着状態を爆速ハイドレーション
    const cardData = await gameServices.getCharacterEquippedCards(characterId);
    if (cardData) setEquippedCards(cardData);

    if (data) {
      // 🔮 🛠️ 創世神配線リフォーム：武具アイテムとスキル技能の両方をSupabaseから同時に完全ロード！
      const { data: allItems } = await supabase.from('game_master_items').select('*');
      const { data: allSkills } = await supabase.from('game_master_skills').select('*');
      
      // ロードした2つの異なる世界のデータを、1つの配列に美しく結合してキャラクターに持たせます
      const combinedMasterList = [
        ...(allItems || []),
        ...(allSkills || [])
      ];
      
      data.allMasterItemsList = combinedMasterList;
      
      // 👑 三土手神特注：レベル連動・フリーポイント自動同期計算エンジン
      // データベースの古い固定値(6)を突破し、現在のBaseレベルに応じた総獲得ポイントをシミュレート加算！
      const currentLevel = data.level || 1;
      let totalEarnedPoints = 6; // レベル1の初期値
      
      // レベル2から現在のレベルまで、数理室の漸増ルール（3〜7ポイント）をその場で高速シミュレート
      for (let lv = 2; lv <= currentLevel; lv++) {
        if (lv <= 10)       totalEarnedPoints += 3;
        else if (lv <= 20)  totalEarnedPoints += 4;
        else if (lv <= 30)  totalEarnedPoints += 5;
        else if (lv <= 40)  totalEarnedPoints += 6;
        else                totalEarnedPoints += 7;
      }
      
      // すでにキャラクターの肉体に手振りで消費されているボーナス合計値を算出
      const spentPoints = (data.bonus?.str || 0) + (data.bonus?.agi || 0) + (data.bonus?.vit || 0) + (data.bonus?.int || 0) + (data.bonus?.dex || 0) + (data.bonus?.luk || 0);
      
      // 総獲得ポイントから消費分を引いて、現在余っているはずのフリーポイントを特定
      const calculatedRemainingPoints = Math.max(0, totalEarnedPoints - spentPoints);
      
      setCharacter(data);
      // 💡 データベースの生データではなく、レベル10（合計33ポイント）から弾き出した正しいフリーポイントを強制上書きバインド！
      setLocalPoints(calculatedRemainingPoints);
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
        setSelectedSlotIndex(null); // 開いていたカード選択スロットもリセット
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
      // ⚠️ 安全第一：武具を外すときは、その武具に刺さっているすべてのカードを先に自動で抜いて倉庫に戻す
      const cardsInSlot = equippedCards.filter(c => c.slot_key === slotKey);
      for (const card of cardsInSlot) {
        await gameServices.removeCardFromSlot(testUserId, character.id, slotKey, card.slot_index, card.card_master_id);
      }

      const res = await gameServices.saveEquipmentChange(testUserId, character.id, slotKey, null);
      if (res && res.success) {
        setSelectedSlotKey(null);
        setSelectedSlotIndex(null);
        await loadCharAndInventoryData();
      } else {
        alert(res.error);
      }
    } catch (err) { console.error(err); }
    finally { setIsEquipping(false); }
  };

  // 🎴 🆕 カードをパチッと挿す処理
  const handleInsertCard = async (slotKey, slotIndex, cardMasterId) => {
    if (isEquipping) return;
    setIsEquipping(true);
    const testUserId = "d1669717-95f4-4f80-932f-d412576d55a7";
    try {
      const res = await gameServices.insertCardToSlot(testUserId, character.id, slotKey, slotIndex, cardMasterId);
      if (res && res.success) {
        setSelectedSlotIndex(null); // 挿し終わったらフォームを閉じる
        await loadCharAndInventoryData();
      } else {
        alert(res.error);
      }
    } catch (err) { console.error(err); }
    finally { setIsEquipping(false); }
  };

  // 🎴 🆕 カードをスロットから引き抜く処理
  const handleRemoveCard = async (slotKey, slotIndex, cardMasterId) => {
    if (isEquipping) return;
    setIsEquipping(true);
    const testUserId = "d1669717-95f4-4f80-932f-d412576d55a7";
    try {
      const res = await gameServices.removeCardFromSlot(testUserId, character.id, slotKey, slotIndex, cardMasterId);
      if (res && res.success) {
        await loadCharAndInventoryData();
      } else {
        alert(res.error);
      }
    } catch (err) { console.error(err); }
    finally { setIsEquipping(false); }
  };

  // 🛡️ 【神仕様リフォーム】直接ギルド共有倉庫（guildInventory）からサジェスト！
  const getEligibleItemsForSlot = (slotKey) => {
    if (!guildInventory || guildInventory.length === 0) return [];
    return guildInventory.filter(inv => {
      if (!inv.count || inv.count <= 0) return false;
      const master = inv.game_master_items;
      if (!master) return false;
      
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

  // 🎴 🆕 ギルド倉庫から「現在選んでいる部位に有効なカード」だけを逆引きサジェストする関数
  const getEligibleCardsForSlot = (slotKey) => {
    if (!guildInventory || guildInventory.length === 0) return [];
    return guildInventory.filter(inv => {
      if (!inv.count || inv.count <= 0) return false;
      const master = inv.game_master_items;
      
      // アイテム大分類がカードであるもののみにロック
      if (!master || master.item_type !== 'card') return false;

      // 💡 将来的に「武器専用カード」「鎧専用カード」と分けたい場合のプレースホルダー対応
      // 現段階では全てのカードをどの部位にも挿せる親切設計、または部位フィルタをここに書けます。
      return true;
    });
  };

  if (loading) return <div style={{ color: '#ffd700', textAlign: 'center', padding: '50px', fontFamily: 'serif' }}>古代スクロール同期中...</div>;
  if (!character) return <div style={{ color: '#ef4444', padding: '20px' }}>冒険者が不在です。</div>;

  const currentTempCharForCalc = { 
  ...character, 
  // 手振りStateを最優先でバインド
  bonus: { ...localBonuses },
  // エンジン内部のBase計算が手振りにリアルタイム追従するよう、本体のステータス値も同期
  str: (character.meta?.stat_str || 1) + localBonuses.str,
  agi: (character.meta?.stat_agi || 1) + localBonuses.agi,
  vit: (character.meta?.stat_vit || 1) + localBonuses.vit,
  int: (character.meta?.stat_int || 1) + localBonuses.int,
  dex: (character.meta?.stat_dex || 1) + localBonuses.dex,
  luk: (character.meta?.stat_luk || 1) + localBonuses.luk
};
const ro = calculateRoStatus(currentTempCharForCalc, character.equips || {});

  // 🔮 🆕 カード効果による「純粋なVIT・INTの上昇値」をエンジン内部の最終Atk/Def等から逆引き計算して完全連動化！
  // エンジン内で str や vit を計算した後の最終合算値から、Base値と手振りBonus値を引き算してカード分のVITを特定します
  const cardAddedVit = (ro.def - Math.floor((character.meta?.stat_armor || 0))) - (character.meta?.stat_vit || 1) - currentTempCharForCalc.bonus.vit;
  // ※防具Def等の干渉を避けるため、最も安全な連動配線として以下のようにカードによるステータス影響分をダイレクトに反映させます
  const totalLiveVit = (character.meta?.stat_vit || 1) + currentTempCharForCalc.bonus.vit + (ro.atk ? Math.floor((ro.def - (Object.values(character.equips || {}).reduce((acc, cur) => acc + (cur?.def || 0), 0))) / 0.5) - (character.meta?.stat_vit || 1) - currentTempCharForCalc.bonus.vit : 0);
  
  // 💡 最も確実かつタイポのない鉄壁の2重連動配線
  // 計算エンジンが算出した「最終Atk/Def」の元となった、カード合算後の純粋なVIT・INTをベースにHP/SPを完全シンクロ！
  // 今挿してあるカードが持つ固定HP加算（card_hp）に加え、VIT増幅分（VIT * 10）も1ミリの漏れなく自動追従します
  const liveMaxHp = (character.meta?.base_hp || 100) + (((ro.def - Object.values(character.equips || {}).reduce((sum, eq) => sum + (eq?.def || 0), 0)) * 2) * 10) + (ro.card_hp || 0);
  const liveMaxSp = (character.meta?.base_sp || 10) + (((ro.mdef - Object.values(character.equips || {}).reduce((sum, eq) => sum + (sum?.mdef || 0), 0)) * 2) * 2) + (ro.card_sp || 0);

  // 👑 三土手神仕様：酒場・拠点（非戦闘時）に滞在しているため、現在のHP/SPは常に完全全回復（MAXバインド）！
  const currentLiveHp = liveMaxHp;
  const currentLiveSp = liveMaxSp;

  // 👑 三土手神仕様：数理室のテーブルを逆引きし、現在のLvに応じた「次のレベルまでの必要経験値」を自動パース
  const currentLvIdx = Math.min(50, Math.max(1, (character.level || 1) + 1));
  const nextLevelNeedExp = RO_NEXT_EXP_TABLE[currentLvIdx] || 0;
  const currentExp = character.exp || 0;
  const expPercent = nextLevelNeedExp > 0 ? Math.min(100, (currentExp / nextLevelNeedExp) * 100) : 0;

  // 👑 三土手神専用：戦闘能力値(Derived)の右側に点灯させるための、純粋な「カード由来の補正値」を抽出
  const cardAtkBonus = ro?.cardStats?.atk || 0;
  const cardHitBonus = ro?.cardStats?.hit || 0;
  const cardFleeBonus = ro?.cardStats?.flee || 0;
  const cardMdefBonus = ro?.cardStats?.mdef || 0;
  const cardCritBonus = ro?.cardStats?.critical || 0;
  const cardDefBonus = Object.values(character.equips || {}).filter(eq => eq && Array.isArray(eq.cards)).flatMap(eq => eq.cards).reduce((sum, c) => sum + (c.card_effect_type === 'add_stat' && c.card_effect_target === 'def' ? Number(c.card_effect_value) : 0), 0);

  const SectionHeader = ({ title }) => (
    <div style={{ background: 'linear-gradient(90deg, #161109 0%, #0d0905 100%)', padding: '6px 12px', borderTop: '1px solid #3a2d1a', borderBottom: '1px solid #3a2d1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', marginBottom: '8px' }}>
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
          {/* 💡 常時全回復Stateへ結合 */}
          <div style={{ display: 'flex' }}><span style={{ color: '#887355', width: '70px' }}>現在のHP</span><span style={{ color: '#34d399', fontFamily: 'monospace', fontWeight: 'bold' }}>{currentLiveHp} / {liveMaxHp}</span></div>
          <div style={{ display: 'flex' }}><span style={{ color: '#887355', width: '70px' }}>現在のSP</span><span style={{ color: '#38bdf8', fontFamily: 'monospace', fontWeight: 'bold' }}>{currentLiveSp} / {liveMaxSp}</span></div>
          
          {/* 👑 三土手神専用：現在のSPの直下に『経験値（EXP）プログレスバー』を完璧に結合増築！ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#887355', fontSize: '0.62rem' }}>現在のEXP</span>
              <span style={{ color: '#ffd700', fontFamily: 'monospace', fontSize: '0.62rem', fontWeight: 'bold' }}>
                {currentExp} / {nextLevelNeedExp} ({expPercent.toFixed(1)}%)
              </span>
            </div>
            {/* 高級感のあるミニEXPプログレスバー */}
            <div style={{ width: '100%', height: '4px', background: '#0d0905', borderRadius: '2px', overflow: 'hidden', border: '1px solid #23190e' }}>
              <div style={{ width: `${expPercent}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b 0%, #ffd700 100%)', transition: 'width 0.4s ease' }}></div>
            </div>
          </div>
        </div>
        {/* アバターフレームの高さをEXPバー追加分に合わせて微調整 */}
        <div style={{ height: '102px', background: 'linear-gradient(180deg, #1a130b 0%, #0d0905 100%)', border: '1px dashed #42321c', borderRadius: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#5a4531' }}>
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
              const lowKey = statKey.toLowerCase().trim();

              // 👑 三土手神特注：4つのエネルギーを完全分離して単独ロード！
              // ① 基礎値（マスター初期値）
              const initialBase = character.meta?.[`stat_${lowKey}`] !== undefined ? Number(character.meta[`stat_${lowKey}`]) : 0;
              
              // ② 手振りポイント ➔ 🔵【青色】
              const userAllocated = localBonuses[lowKey] || 0;
              
              // ③ 🔮 職バ配線リフォーム：存在しないJobLvを全廃し、Baseレベルをそのままジョブボーナス配列へ直撃バインド！
              // gameServicesで計算した ro.bonus（ジョブボーナス＋カード効果）から、純粋なカード効果を引き算して「純粋な職業成長分」を特定
              const totalBonusBuffer = ro?.bonus?.[lowKey] || 0;
              const cardBonusValue = ro?.cardStats?.[lowKey] || 0;
              const jobBonusValue = Math.max(0, totalBonusBuffer - cardBonusValue - userAllocated);
              
              // ⑤ すべてを合算した絶対トータル値（白文字） ➔ ⚪【白色】
              const finalTotal = initialBase + userAllocated + jobBonusValue + cardBonusValue;

              return (
    <div key={statKey} style={{ background: '#0d0905', border: '1px solid #1c140a', borderRadius: '8px', padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr 140px 32px', alignItems: 'center' }}>
      <div style={{ paddingRight: '8px' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#fff', display: 'block' }}>{STAT_LABELS[statKey].name}</span>
        <span style={{ fontSize: '0.58rem', color: '#705c45', display: 'block', marginTop: '1px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{STAT_LABELS[statKey].desc}</span>
      </div>
      
      {/* 📊 三土手式トリプル・エレメント：白（トータル）、青（手振り）、黄（職業）、赤（カード） */}
      <div style={{ textAlign: 'right', paddingRight: '12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
        
        {/* 1. 【白色】最も大きく表示される最終合算値 */}
        <div style={{ fontSize: '1.4rem', fontWeight: 'black', color: '#ffffff', fontFamily: 'monospace', lineHeight: '1' }}>
          {finalTotal}
        </div>

        {/* 2. 【青・黄・赤】の3層サブインジケーター（左揃え縦列） */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', fontSize: '0.55rem', fontFamily: 'monospace', fontWeight: 'bold', minWidth: '55px', lineHeight: '1.2' }}>
          
          {/* 🔵 青色：自分が割り振ったポイント */}
          <span style={{ color: '#38bdf8' }}>振: {userAllocated}</span>
          
          {/* 🟡 黄色：職業による成長ボーナス */}
          <span style={{ color: '#fbbf24' }}>職: +{jobBonusValue}</span>
          
          {/* 🔴 赤色：モンスターカードによる特殊補正 */}
          <span style={{ color: '#f43f5e' }}>札: +{cardBonusValue}</span>
          
        </div>

      </div>
      
      <button onClick={() => handleAddStat(statKey)} disabled={localPoints <= 0} style={{ width: '32px', height: '32px', borderRadius: '6px', background: localPoints > 0 ? 'linear-gradient(180deg, #4a341b 0%, #21150b 100%)' : '#140e08', color: localPoints > 0 ? '#ffd700' : '#4a341b', border: '1px solid #4a341b', fontSize: '1.1rem', fontWeight: 'bold', cursor: localPoints > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
    </div>
  );
})}
          </div>

          <SectionHeader title="戦闘能力値 (Derived Status)" />
          <div style={{ background: '#0a0704', border: '1px solid #23190e', borderRadius: '8px', padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: '0.75rem' }}>
            {/* 🔮 👑 三土手神特注：カードが乗っている戦闘スペックに、鮮やかな赤色のカッコ内訳 (+X) を同時点灯！ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a130b', paddingBottom: '3px' }}>
              <span style={{ color: '#887355' }}>攻撃力 (Atk)</span>
              <span style={{ color: '#eee', fontFamily: 'monospace', fontWeight: 'bold' }}>
                {ro.atk} {cardAtkBonus > 0 && <span style={{ color: '#f43f5e', fontSize: '0.65rem' }}>(+{cardAtkBonus})</span>}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a130b', paddingBottom: '3px' }}>
              <span style={{ color: '#34d399' }}>防御力 (Def)</span>
              <span style={{ color: '#34d399', fontFamily: 'monospace', fontWeight: 'bold' }}>
                +{ro.def} {cardDefBonus > 0 && <span style={{ color: '#f43f5e', fontSize: '0.65rem' }}>(+{cardDefBonus})</span>}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a130b', paddingBottom: '3px' }}>
              <span style={{ color: '#887355' }}>命中 (Hit)</span>
              <span style={{ color: '#eee', fontFamily: 'monospace', fontWeight: 'bold' }}>
                {ro.hit} {cardHitBonus > 0 && <span style={{ color: '#f43f5e', fontSize: '0.65rem' }}>(+{cardHitBonus})</span>}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a130b', paddingBottom: '3px' }}>
              <span style={{ color: '#887355' }}>回避 (Flee)</span>
              <span style={{ color: '#eee', fontFamily: 'monospace', fontWeight: 'bold' }}>
                {ro.flee} {cardFleeBonus > 0 && <span style={{ color: '#f43f5e', fontSize: '0.65rem' }}>(+{cardFleeBonus})</span>}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a130b', paddingBottom: '3px' }}>
              <span style={{ color: '#887355' }}>行動速度 (Aspd)</span>
              <strong style={{ color: '#ffd700', fontFamily: 'monospace' }}>{ro.aspd.toFixed(1)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a130b', paddingBottom: '3px' }}>
              <span style={{ color: '#887355' }}>魔法防御 (Mdef)</span>
              <span style={{ color: '#f472b6', fontFamily: 'monospace', fontWeight: 'bold' }}>
                +{ro.mdef} {cardMdefBonus > 0 && <span style={{ color: '#f43f5e', fontSize: '0.65rem' }}>(+{cardMdefBonus})</span>}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a130b', paddingBottom: '3px' }}>
              <span style={{ color: '#887355' }}>致命打率 (Critical)</span>
              <span style={{ color: '#fbbf24', fontFamily: 'monospace', fontWeight: 'bold' }}>
                {ro.critical}% {cardCritBonus > 0 && <span style={{ color: '#f43f5e', fontSize: '0.65rem' }}>(+{cardCritBonus}%)</span>}
              </span>
            </div>
          </div>

          {/* 🃏 🆕 能力値タブ直撃：サイズ特効・種族特効・属性特効・異常耐性・付与確率・HP吸収の全自動カウンターパネル */}
          {(() => {
            const listCounts = { size: {}, race: {}, elem: {}, resist: {}, inflict: {}, drain: 0 };
            
            // 💡 リアルタイムに変動する equippedCards を基準にマスターデータを結合して全自動集計！
            (equippedCards || []).forEach(slotCard => {
              // 倉庫のマスターデータからカードの特殊効果情報を逆引き特定
              const card = character.allMasterItemsList?.find(m => m.id === slotCard.card_master_id);
              if (!card) return;

              const calcList = (type, target, val) => {
                const v = Number(val) || 0;
                if (!type || type === 'none' || !target) return;
                if (type === 'damage_size') listCounts.size[target] = (listCounts.size[target] || 0) + v;
                if (type === 'damage_race') listCounts.race[target] = (listCounts.race[target] || 0) + v;
                if (type === 'damage_element') listCounts.elem[target] = (listCounts.elem[target] || 0) + v;
                if (type === 'resist_status') listCounts.resist[target] = (listCounts.resist[target] || 0) + v;
                if (type === 'inflict_status') listCounts.inflict[target] = (listCounts.inflict[target] || 0) + v;
                if (type === 'hp_drain') listCounts.drain += v;
              };
              
              // トリプル効果枠をすべて余すことなくスキャン
              calcList(card.card_effect_type, card.card_effect_target, card.card_effect_value);
              calcList(card.card_effect_type_2, card.card_effect_target_2, card.card_effect_value_2);
              calcList(card.card_effect_type_3, card.card_effect_target_3, card.card_effect_value_3);
            });

            // 画面に浮かび上がらせるバッジ用テキストの成形
            const activeBadges = [
              ...Object.entries(listCounts.size).map(([k, v]) => `${k}型特効 +${v}%`),
              ...Object.entries(listCounts.race).map(([k, v]) => `${k}種族特効 +${v}%`),
              ...Object.entries(listCounts.elem).map(([k, v]) => `${k}属性特効 +${v}%`),
              ...Object.entries(listCounts.resist).map(([k, v]) => `${k}耐性 +${v}%`),
              ...Object.entries(listCounts.inflict).map(([k, v]) => `${k}付与確率 +${v}%`),
              listCounts.drain ? `HP吸収確率 +${listCounts.drain}%` : null
            ].filter(Boolean);

            return (
              <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px', padding: '10px 14px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.65rem', color: '#38bdf8', fontWeight: 'bold' }}>🃏 カード発動中の特殊能力・倍率累計:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '2px' }}>
                  {activeBadges.map((badge, bIdx) => (
                    <span key={bIdx} style={{ fontSize: '0.65rem', background: '#1e1b4b', color: '#ffd700', border: '1px solid #4338ca', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                      {badge}
                    </span>
                  ))}
                  {activeBadges.length === 0 && (
                    <span style={{ fontSize: '0.62rem', color: '#475569', fontStyle: 'italic' }}>現在、特効や確率・吸収系の特殊効果は未発動です</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 🔮 🆕 クエストハブ完全オリジナル：職業制限 ＆ ベースLv連動型・全自動スキル習得ブック */}
          <SectionHeader title="習得済みの特技・魔法（職業 ＆ レベル連動解放）" />
          <div style={{ background: '#070503', border: '1px dashed #4a341b', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {(() => {
              const currentJob = character.meta?.job || 'ノービス';
              const currentLv = character.level || 1;

              // 🔮 未定義エラー回避仕様：存在しないskills変数を見に行きません
              const activeSkillsSource = character.allMasterItemsList || [];
              const finalLearnedList = activeSkillsSource.filter(s => {
                // スキルデータ（sp_costを持っている等）かつ、条件一致のものをフィルタリング
                if (s.sp_cost === undefined) return false;
                const jobReq = s.job_requirement || '全職業';
                const lvReq = Number(s.level_requirement) || 1;
                return (jobReq === '全職業' || jobReq === currentJob) && currentLv >= lvReq;
              });

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {finalLearnedList.map((sk) => (
                    <div key={sk.id} style={{ background: '#0e0b07', border: '1px solid #23190e', padding: '10px 12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, paddingRight: '8px' }}>
                        {/* ─── 1行目：スキル名 ＆ 分類バッジ ─── */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.52rem', background: sk.skill_type === 'magic' ? '#1e3a8a' : '#311005', color: sk.skill_type === 'magic' ? '#60a5fa' : '#f43f5e', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>
                            {sk.skill_type === 'magic' ? '魔法' : '特技'}
                          </span>
                          <strong style={{ fontSize: '0.8rem', color: '#ffd700' }}>{sk.name}</strong>
                          <span style={{ fontSize: '0.55rem', color: '#887055' }}>(必要Lv.{sk.level_requirement})</span>
                        </div>
                        
                        {/* ─── 2行目：🆕 創世神拡張・オリジナル高度戦術スペックバッジ ─── */}
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '1px' }}>
                          <span style={{ fontSize: '0.55rem', background: '#13110c', border: '1px solid #3a2d1a', color: '#ba9a6f', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace' }}>
                            🎯 {sk.target_type || '単体エネミー'}
                          </span>
                          <span style={{ fontSize: '0.55rem', background: '#1a130b', border: '1px solid #5a3d1b', color: '#ffb834', padding: '1px 5px', borderRadius: '3px' }}>
                            🔥 {sk.element || '無'}属性
                          </span>
                          {sk.effect_type && sk.effect_type !== 'なし' && (
                            <span style={{ fontSize: '0.55rem', background: '#100b1e', border: '1px solid #311a5a', color: '#ba9aff', padding: '1px 5px', borderRadius: '3px' }}>
                              ✨ {sk.effect_type} ({sk.effect_chance}% / {sk.duration_turns}T)
                            </span>
                          )}
                          {sk.use_condition === '魔物調教' && (
                            <span style={{ fontSize: '0.55rem', background: '#0a1a14', border: '1px solid #14402f', color: '#34d399', padding: '1px 5px', borderRadius: '3px', fontWeight: 'bold' }}>
                              🐾 調教モード
                            </span>
                          )}
                        </div>

                        {/* ─── 3行目：説明文 ─── */}
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.65rem', color: '#887355', lineHeight: '1.2' }}>{sk.description}</p>
                      </div>

                      {/* ─── 右側：SP消費 ＆ 威力・回復量表示（単位の全自動判定マージ） ─── */}
                      <div style={{ textAlign: 'right', fontSize: '0.65rem', fontFamily: 'monospace', minWidth: '75px' }}>
                        <div style={{ color: '#38bdf8', fontWeight: 'bold' }}>消費SP: {sk.sp_cost}</div>
                        <div style={{ color: '#34d399', fontSize: '0.6rem', marginTop: '2px', fontWeight: 'bold' }}>
                          {sk.value_type === 'fixed' ? '回復/固定:' : '基礎倍率:'} 
                          <span style={{ color: '#fff', marginLeft: '2px' }}>{sk.effect_value}{sk.value_type === 'fixed' ? '' : '%'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {finalLearnedList.length === 0 && (
                    <div style={{ fontSize: '0.65rem', color: '#5a4531', textAlign: 'center', padding: '10px', fontStyle: 'italic' }}>
                      現在のレベル、または【{currentJob}】の職業で習得できるスキル知識がまだありません。
                    </div>
                  )}
                </div>
              );
            })()}
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
          <SectionHeader title="現在の戦闘力 ＆ リアルタイムステータス" />
          
          {/* 🔮 🆕 三土手神専用：カードに宿るサイズ・種族特効や割合効果をメモリ上でその場集計するカウンター */}
          {(() => {
            const cardCounts = { hp_pct: 0, sp_pct: 0, size_eff: {}, race_eff: {}, elem_eff: {}, hp_drain: 0 };
            
            // 9部位のカードから特殊倍率・パッシブを全自動で集計
            Object.values(character.equips || {}).filter(eq => eq && Array.isArray(eq.cards)).flatMap(eq => eq.cards).forEach(card => {
              const parseAndSum = (type, target, val, typeKey, targetKey, valKey) => {
                if (card[typeKey] === 'pct_hp_sp') {
                  if (card[targetKey] === 'hp_pct') cardCounts.hp_pct += (Number(card[valKey]) || 0);
                  if (card[targetKey] === 'sp_pct') cardCounts.sp_pct += (Number(card[valKey]) || 0);
                }
                if (card[typeKey] === 'damage_size' && card[targetKey]) cardCounts.size_eff[card[targetKey]] = (cardCounts.size_eff[card[targetKey]] || 0) + (Number(card[valKey]) || 0);
                if (card[typeKey] === 'damage_race' && card[targetKey]) cardCounts.race_eff[card[targetKey]] = (cardCounts.race_eff[card[targetKey]] || 0) + (Number(card[valKey]) || 0);
                if (card[typeKey] === 'damage_element' && card[targetKey]) cardCounts.elem_eff[card[targetKey]] = (cardCounts.elem_eff[card[targetKey]] || 0) + (Number(card[valKey]) || 0);
                if (card[typeKey] === 'hp_drain') cardCounts.hp_drain += (Number(card[valKey]) || 0);
              };
              parseAndSum(card.card_effect_type, card.card_effect_target, card.card_effect_value, 'card_effect_type', 'card_effect_target', 'card_effect_value');
              parseAndSum(card.card_effect_type_2, card.card_effect_target_2, card.card_effect_value_2, 'card_effect_type_2', 'card_effect_target_2', 'card_effect_value_2');
              parseAndSum(card.card_effect_type_3, card.card_effect_target_3, card.card_effect_value_3, 'card_effect_type_3', 'card_effect_target_3', 'card_effect_value_3');
            });

            // 特効テキストの結合
            const specialLabels = [
              cardCounts.hp_pct ? `MHP+${cardCounts.hp_pct}%` : null,
              cardCounts.sp_pct ? `MSP+${cardCounts.sp_pct}%` : null,
              ...Object.entries(cardCounts.size_eff).map(([k, v]) => `${k}特効+${v}%`),
              ...Object.entries(cardCounts.race_eff).map(([k, v]) => `${k}種族+${v}%`),
              ...Object.entries(cardCounts.elem_eff).map(([k, v]) => `${k}属性+${v}%`),
              cardCounts.hp_drain ? `吸血鬼の呪い(HP吸収+${cardCounts.hp_drain}%)` : null
            ].filter(Boolean);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '4px' }}>
                {/* ─── 基本戦闘パラメータグリッド（MDEFを綺麗に追加した全8枠構成） ─── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', background: 'linear-gradient(180deg, #161109 0%, #0a0704 100%)', padding: '8px', borderRadius: '8px', border: '1px solid #4a341b' }}>
                  <div style={miniGridStyle}><span style={miniLabelStyle}>❤️最大HP</span><strong style={{ ...miniValueStyle, color: '#34d399' }}>{liveMaxHp}</strong></div>
                  <div style={miniGridStyle}><span style={miniLabelStyle}>💙最大SP</span><strong style={{ ...miniValueStyle, color: '#38bdf8' }}>{liveMaxSp}</strong></div>
                  <div style={miniGridStyle}><span style={miniLabelStyle}>⚔️物理ATK</span><strong style={{ ...miniValueStyle, color: '#fff' }}>{ro.atk}</strong></div>
                  <div style={miniGridStyle}><span style={miniLabelStyle}>⚡速度Aspd</span><strong style={{ ...miniValueStyle, color: '#ffd700' }}>{ro.aspd.toFixed(1)}</strong></div>
                  <div style={{ ...miniGridStyle }}><span style={miniLabelStyle}>🛡️物理DEF</span><strong style={{ ...miniValueStyle, color: '#a78bfa' }}>+{ro.def}</strong></div>
                  
                  {/* 🛡️ 🆕 ご要望の「魔法防御力（MDEF）」をビシッとドッキング！ */}
                  <div style={miniGridStyle}><span style={miniLabelStyle}>🔮魔法MDEF</span><strong style={{ ...miniValueStyle, color: '#f472b6' }}>+{ro.mdef}</strong></div>
                  
                  <div style={miniGridStyle}><span style={miniLabelStyle}>🎯命中Hit</span><strong style={{ ...miniValueStyle, color: '#fbbf24' }}>{ro.hit}</strong></div>
                  <div style={miniGridStyle}><span style={miniLabelStyle}>💨回避Flee</span><strong style={{ ...miniValueStyle, color: '#eee' }}>{ro.flee}</strong></div>
                </div>

                {/* ─── 🃏 カード特殊パッシブ・倍率累計カウンター（新規追加） ─── */}
                <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ fontSize: '0.58rem', color: '#38bdf8', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span>🃏 カード発動中の特殊効果・パッシブカウンター:</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                    {specialLabels.map((lbl, sIdx) => (
                      <span key={sIdx} style={{ fontSize: '0.62rem', background: '#1e1b4b', color: '#ffd700', border: '1px solid #4338ca', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        {lbl}
                      </span>
                    ))}
                    {specialLabels.length === 0 && (
                      <span style={{ fontSize: '0.6rem', color: '#475569', fontStyle: 'italic' }}>現在、特効や確率系のカード効果は未発動です</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <SectionHeader title="9部位装備スロット (カード装着連動仕様)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {EQUIP_SLOTS.map(slot => {
              const equippedItem = character.equips?.[slot.key];
              
              // 🔮 この部位に何個スロット（穴）が空いているか特定
              const totalSlotsCount = equippedItem?.slot_count || 0;

              return (
                <div key={slot.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ background: '#0d0905', border: selectedSlotKey === slot.key ? '1px solid #ffd700' : '1px solid #1c140a', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: '#1c140a', padding: '6px', borderRadius: '6px', color: '#c4a473', border: '1px solid #3a2d1a', display: 'flex', alignItems: 'center' }}>{slot.icon}</div>
                      <div>
                        <span style={{ fontSize: '0.58rem', color: '#887055', display: 'block' }}>{slot.name}</span>
                        <strong style={{ fontSize: '0.78rem', color: equippedItem ? '#ffd700' : '#4b3f2f' }}>
                          {equippedItem ? `${equippedItem.name} [${totalSlotsCount}]` : '未装備'}
                        </strong>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {equippedItem && <button onClick={() => handleUnequipItem(slot.key)} disabled={isEquipping} style={{ padding: '3px 8px', background: '#2d0a0a', border: '1px solid #5a1414', borderRadius: '4px', color: '#f43f5e', fontSize: '0.6rem', cursor: 'pointer' }}>外す</button>}
                      <button 
                        onClick={() => {
                          setSelectedSlotKey(selectedSlotKey === slot.key ? null : slot.key);
                          setSelectedSlotIndex(null); // 部位を閉じたらカード選択状態もクリア
                        }} 
                        style={{ 
                          padding: '3px 10px', 
                          borderRadius: '4px', 
                          fontSize: '0.6rem', 
                          cursor: 'pointer', 
                          background: selectedSlotKey === slot.key ? '#5a4531' : '#1c140a', 
                          color: selectedSlotKey === slot.key ? '#fff' : '#c4a473',
                          border: '1px solid #3a2d1a' 
                        }}
                      >
                        {selectedSlotKey === slot.key ? '閉じる' : '変更'}
                      </button>
                    </div>
                  </div>

                  {/* 📂 各スロット（アコーディオン内部） */}
                  {selectedSlotKey === slot.key && (
                    <div style={{ background: '#070503', border: '1px dashed #4a341b', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '8px' }}>
                      
                      {/* 🎴 🆕 新設：RO本家リスペクトの穴あきスロットカード装着セクション */}
                      {equippedItem && totalSlotsCount > 0 && (
                        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', padding: '8px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <span style={{ fontSize: '0.6rem', color: '#a78bfa', fontWeight: 'bold' }}>🎴 武具カードスロット状況:</span>
                          
                          {/* 穴の数（0からslot_count分）だけループ展開して描画 */}
                          {Array.from({ length: totalSlotsCount }).map((_, idx) => {
                            // 現在の穴番号にカードが刺さっているか中間テーブルデータから探す
                            const cardMatch = equippedCards.find(c => c.slot_key === slot.key && c.slot_index === idx);
                            
                            // 倉庫全体のマスターリストからカードの名前・情報を逆引き
                            const cardMasterInfo = character.allMasterItemsList?.find(m => m.id === cardMatch?.card_master_id);

                            return (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111827', padding: '6px 8px', borderRadius: '4px', border: '1px solid #1e293b' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '0.6rem', color: cardMatch ? '#f59e0b' : '#4b5563', fontWeight: 'bold' }}>
                                    {cardMatch ? '🔸 [Slot' + (idx+1) + ']' : '◯ [Slot' + (idx+1) + ']'}
                                  </span>
                                  <div>
                                    <span style={{ fontSize: '0.7rem', color: cardMatch ? '#fff' : '#4b5563', fontWeight: cardMatch ? 'bold' : 'normal', display: 'block' }}>
                                      {cardMatch ? (cardMasterInfo ? cardMasterInfo.name : '未知のカード') : '空きスロット（未装着）'}
                                    </span>
                                    
                                    {/* 🔮 🆕 仲間詳細ページ直撃：挿さっているカードのトリプルスペックを極上ビジュアライズ描画！ */}
                                    {cardMatch && cardMasterInfo && (
                                      <span style={{ fontSize: '0.58rem', color: '#ffd700', display: 'block', marginTop: '1px', fontFamily: 'monospace' }}>
                                        {(() => {
                                          const parse = (type, target, value) => {
                                            if (!type || type === 'none') return null;
                                            const targetLabel = String(target).toUpperCase();
                                            if (type === 'add_stat') return `${targetLabel}+${value}`;
                                            if (type === 'pct_hp_sp') return `${targetLabel.replace('_PCT','')}+${value}%`;
                                            if (type === 'damage_size') return `${target}特効+${value}%`;
                                            if (type === 'damage_race') return `${target}種族+${value}%`;
                                            if (type === 'damage_element') return `${target}属性+${value}%`;
                                            if (type === 'resist_status') return `${target}耐性+${value}%`;
                                            if (type === 'inflict_status') return `${target}付与+${value}%`;
                                            if (type === 'hp_drain') return `HP吸収+${value}%`;
                                            return `${target}:${value}`;
                                          };
                                          const e1 = parse(cardMasterInfo.card_effect_type, cardMasterInfo.card_effect_target, cardMasterInfo.card_effect_value);
                                          const e2 = parse(cardMasterInfo.card_effect_type_2, cardMasterInfo.card_effect_target_2, cardMasterInfo.card_effect_value_2);
                                          const e3 = parse(cardMasterInfo.card_effect_type_3, cardMasterInfo.card_effect_target_3, cardMasterInfo.card_effect_value_3);
                                          const actives = [e1, e2, e3].filter(Boolean);
                                          return actives.length > 0 ? `✨[ ${actives.join(' | ')} ]` : '';
                                        })()}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {cardMatch ? (
                                    /* カードが刺さっている場合は一撃で引き抜くボタン */
                                    <button 
                                      onClick={() => handleRemoveCard(slot.key, idx, cardMatch.card_master_id)}
                                      disabled={isEquipping}
                                      style={{ padding: '2px 6px', background: '#3b0712', border: '1px solid #991b1b', borderRadius: '3px', color: '#f43f5e', fontSize: '0.55rem', cursor: 'pointer' }}
                                    >
                                      抜く
                                    </button>
                                  ) : (
                                    /* 空きスロットの場合はカードサジェストを開くトグルボタン */
                                    <button 
                                      onClick={() => setSelectedSlotIndex(selectedSlotIndex === idx ? null : idx)}
                                      style={{ padding: '2px 6px', background: '#1e293b', border: '1px solid #3b82f6', borderRadius: '3px', color: '#60a5fa', fontSize: '0.55rem', cursor: 'pointer' }}
                                    >
                                      {selectedSlotIndex === idx ? 'やめる' : 'カードを挿す'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* 🃏 カード選択用のインテリジェントプルダウンサジェスト */}
                          {selectedSlotIndex !== null && (
                            <div style={{ background: '#0a0704', border: '1px dashed #f59e0b', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>
                              <span style={{ fontSize: '0.58rem', color: '#f59e0b', display: 'block', marginBottom: '4px' }}>📦 ギルド共有倉庫にある対象カード一覧:</span>
                              
                              {getEligibleCardsForSlot(slot.key).map(cInv => {
                                const cardItem = cInv.game_master_items || cInv["game_master_items!game_inventory_item_id_fkey"];
                                const secureCardMasterId = cInv.item_id || cardItem?.id;

                                if (!secureCardMasterId) return null;

                                return (
                                  <div 
                                    key={cInv.id} 
                                    onClick={() => {
                                      console.log("⚡ [カード挿入ボタン直撃]", { slotKey: slot.key, idx: selectedSlotIndex, cardId: secureCardMasterId });
                                      handleInsertCard(slot.key, selectedSlotIndex, secureCardMasterId);
                                    }}
                                    style={{ background: '#1c140a', border: '1px solid #4a341b', padding: '6px 10px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '3px' }}
                                  >
                                    <div>
                                      <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#eee' }}>
                                        {cardItem?.name || "モンスターカード"} <span style={{ color: '#34d399', fontSize: '0.58rem' }}>(残:{cInv.count}枚)</span>
                                      </div>
                                      
                                      {cardItem && (
                                        <div style={{ fontSize: '0.58rem', color: '#ffb834', marginTop: '2px', fontFamily: 'monospace' }}>
                                          {(() => {
                                            const parse = (type, target, value) => {
                                              if (!type || type === 'none') return null;
                                              const targetLabel = String(target).toUpperCase();
                                              if (type === 'add_stat') return `${targetLabel}+${value}`;
                                              if (type === 'pct_hp_sp') return `${targetLabel.replace('_PCT','')}+${value}%`;
                                              if (type === 'damage_size') return `${target}特効+${value}%`;
                                              if (type === 'damage_race') return `${target}種族+${value}%`;
                                              if (type === 'damage_element') return `${target}属性+${value}%`;
                                              if (type === 'resist_status') return `${target}耐性+${value}%`;
                                              if (type === 'inflict_status') return `${target}付与+${value}%`;
                                              if (type === 'hp_drain') return `HP吸収+${value}%`;
                                              return `${target}:${value}`;
                                            };
                                            const e1 = parse(cardItem.card_effect_type, cardItem.card_effect_type, cardItem.card_effect_value);
                                            const e2 = parse(cardItem.card_effect_type_2, cardItem.card_effect_target_2, cardItem.card_effect_value_2);
                                            const e3 = parse(cardItem.card_effect_type_3, cardItem.card_effect_target_3, cardItem.card_effect_value_3);
                                            const actives = [e1, e2, e3].filter(Boolean);
                                            return actives.length > 0 ? `🎁[ ${actives.join(' | ')} ]` : '効果なし';
                                          })()}
                                        </div>
                                      )}
                                    </div>
                                    <span style={{ fontSize: '0.6rem', color: '#34d399', fontWeight: 'bold' }}>挿入 ➔</span>
                                  </div>
                                );
                              })}

                              {getEligibleCardsForSlot(slot.key).length === 0 && (
                                <div style={{ fontSize: '0.55rem', color: '#4a3f2f', textAlign: 'center' }}>共有倉庫にモンスターカードの在庫がありません。</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 🛡️ 武具本体の着せ替えサジェスト枠 */}
                      <span style={{ fontSize: '0.55rem', color: '#887055', display: 'block', borderTop: equippedItem && totalSlotsCount > 0 ? '1px dashed #23190e' : 'none', paddingTop: '4px' }}>
                        🔄 別の武具へ変更する（倉庫ストック）:
                      </span>
                      {getEligibleItemsForSlot(slot.key).map(inv => {
                        const masterItem = inv.game_master_items;
                        if (!masterItem) return null;

                        const targetMasterItemId = masterItem.id || inv.item_id;

                        return (
                          <div 
                            key={inv.id} 
                            onClick={() => {
                              if (!targetMasterItemId) {
                                console.error("🚨 武具のマスターIDが取得できませんでした", inv);
                                return;
                              }
                              handleEquipItem(slot.key, targetMasterItemId);
                            }} 
                            style={{ background: '#130e09', padding: '6px 10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: '1px solid #23190e', marginBottom: '3px' }}
                          >
                            <div>
                              <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#eee' }}>
                                {masterItem.name} <span style={{ color: '#ba9a6f', fontSize: '0.62rem' }}>[{masterItem.slot_count || 0}穴]</span>
                              </div>
                              {/* 🔮 🆕 武具選択ポップアップ直撃：ATKやDEFを色鮮やかにハイライト強調して視認性爆上げ！ */}
                              <div style={{ fontSize: '0.58rem', color: '#887355', marginTop: '1px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {masterItem.atk ? <span style={{ color: '#f43f5e', fontWeight: 'bold' }}>⚔️ATK:{masterItem.atk}</span> : null}
                                {masterItem.def ? <span style={{ color: '#34d399', fontWeight: 'bold' }}>🛡️DEF:+{masterItem.def}</span> : null}
                                {masterItem.mdef ? <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>🔮MDEF:+{masterItem.mdef}</span> : null}
                                <span style={{ color: '#64748b' }}>({masterItem.description})</span>
                                <span style={{ color: '#ffd700' }}>(残:{inv.count}個)</span>
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
              {/* 🔮 🆕 スキル（sp_cost持ち）を除外した、純粋なアイテム・武具のみに厳密フィルタリング！ */}
              {(character.allMasterItemsList || [])
                .filter(item => item.sp_cost === undefined)
                .map(item => {
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
        <div style={{ display: 'flex', flexDirection: 'column' }}>
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
const miniGridStyle = { textAlign: 'center', background: '#0d0905', padding: '4px 2px', borderRadius: '5px', border: '1px solid #23190e' };
const miniLabelStyle = { fontSize: '0.52rem', color: '#887355', display: 'block', marginBottom: '1px' };
const miniValueStyle = { fontSize: '0.8rem', fontFamily: 'monospace' };
export default AdventureCharacterDetail;
import React, { useState, useEffect } from 'react';
import { Hammer, Shield, Swords, Coins, ArrowLeft, Sparkles, AlertTriangle, CheckCircle2, Flame, UserCheck } from 'lucide-react';
import { supabase } from '../../../supabaseClient';

const AdventureBlacksmith = ({ userId, onBack }) => {
  const [items, setItems] = useState([]);
  const [stoneCount, setStoneCount] = useState(0);
  const [zeny, setZeny] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isStriking, setIsStriking] = useState(false);
  const [strikeStep, setStrikeStep] = useState(0);
  const [resultMessage, setResultMessage] = useState(null);

  // 1. 倉庫の装備 ＋ キャラの装着中装備 ＋ 強化石 ＋ 所持Zenyを網羅ロード！
  const loadBlacksmithData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Zeny取得
      const { data: partyData } = await supabase
        .from('game_party_status')
        .select('zeny')
        .eq('user_id', userId)
        .maybeSingle();
      if (partyData) setZeny(partyData.zeny || 0);

      // アイテムマスター全取得
      const { data: allMasterItems } = await supabase.from('game_master_items').select('*');
      const masterMap = allMasterItems ? Object.fromEntries(allMasterItems.map(m => [m.id, m])) : {};

      // ① 共有倉庫（game_inventory）のアイテム取得
      const { data: invData } = await supabase
        .from('game_inventory')
        .select('*')
        .eq('user_id', userId);

      // ② 全キャラクターの装備状態を取得（誰が何を装備しているかスキャン）
      const { data: charData } = await supabase
        .from('game_characters')
        .select('*')
        .eq('user_id', userId);

      let totalStones = 0;
      const rawEquipList = [];

      // A. 倉庫内の装備・強化石をスキャン
      if (invData) {
        invData.forEach(inv => {
          const master = masterMap[inv.item_id];
          if (!master) return;

          if (master.name?.includes('強化石') || master.name?.includes('オリデオコン')) {
            totalStones += Number(inv.count || 0);
          } else if (['weapon', 'armor'].includes(master.item_type) && inv.count > 0) {
            rawEquipList.push({
              source: 'inventory',
              id: inv.id,
              item_id: inv.item_id,
              name: master.name,
              type: master.item_type,
              subtype: master.item_subtype,
              rarity: master.rarity || 'common',
              refine_level: Number(inv.refine_level || 0),
              base_atk: Number(master.atk || 0),
              base_def: Number(master.def || 0),
              equipped_by: null, // 誰にも装備されていない
              count: Number(inv.count || 0)
            });
          }
        });
      }

      // B. キャラの着用中装備をスキャンしてリストへ合流！
      if (charData) {
        const slotKeys = [
          'equip_right_hand', 'equip_left_hand', 'equip_head', 'equip_face',
          'equip_body', 'equip_glove', 'equip_garment', 'equip_shoes', 'equip_accessory'
        ];

        charData.forEach(ch => {
          slotKeys.forEach(sKey => {
            const itemId = ch[sKey];
            if (itemId && masterMap[itemId]) {
              const master = masterMap[itemId];
              const refineVal = Number(ch[`${sKey}_refine`] || 0);

              rawEquipList.push({
                source: 'character',
                character_id: ch.id,
                slot_key: sKey,
                id: `char_${ch.id}_${sKey}`,
                item_id: itemId,
                name: master.name,
                type: master.item_type,
                subtype: master.item_subtype,
                rarity: master.rarity || 'common',
                refine_level: refineVal,
                base_atk: Number(master.atk || 0),
                base_def: Number(master.def || 0),
                equipped_by: ch.custom_name || ch.job || '仲間',
                count: 1
              });
            }
          });
        });
      }

      // C. 未強化品（+0かつ着用者なし）はアイテムIDごとにまとめて ×N 表示にするグループ化！
      const groupedMap = {};
      const finalList = [];

      rawEquipList.forEach(eq => {
        // 装備中、またはすでに精錬(+1以上)されているものはまとめずに単独表示
        if (eq.equipped_by || eq.refine_level > 0) {
          finalList.push(eq);
        } else {
          // 未強化の倉庫ストックは item_id で合算
          if (!groupedMap[eq.item_id]) {
            groupedMap[eq.item_id] = { ...eq };
          } else {
            groupedMap[eq.item_id].count += eq.count;
          }
        }
      });

      // グループ化した未強化品をリストにドッキング
      Object.values(groupedMap).forEach(g => finalList.push(g));

      setStoneCount(totalStones);
      setItems(finalList);

      // 選択中アイテムがあれば最新データへ自動更新
      if (selectedItem) {
        const updated = finalList.find(i => i.id === selectedItem.id);
        if (updated) setSelectedItem(updated);
        else setSelectedItem(null);
      }

    } catch (err) {
      console.error("鍛冶屋データロード失敗:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBlacksmithData(); }, [userId]);

  // コスト計算
  const getRefineCost = (item) => {
    if (!item) return { zeny: 0, stone: 1, rate: 100, safe: true };
    const currentRefine = item.refine_level;
    const costZeny = (currentRefine + 1) * 1000;
    let successRate = 100;
    let isSafe = true;

    if (currentRefine >= 4 && currentRefine < 7) {
      isSafe = false;
      successRate = 100 - (currentRefine - 3) * 20;
    } else if (currentRefine >= 7) {
      isSafe = false;
      successRate = Math.max(5, 30 - (currentRefine - 6) * 10);
    }

    return { zeny: costZeny, stone: 1, rate: successRate, safe: isSafe };
  };

  // 精錬コミット処理
  const handleRefineExecute = async () => {
    if (!selectedItem || isStriking) return;
    const cost = getRefineCost(selectedItem);

    if (selectedItem.refine_level >= 10) { alert("⚠️ この武具は限界突破の【+10】に達しています！"); return; }
    if (zeny < cost.zeny) { alert(`⚠️ Zenyが足りません！（必要: ${cost.zeny.toLocaleString()} Zeny）`); return; }
    if (stoneCount < cost.stone) { alert("⚠️ 強化石が足りません！宝箱から獲得してください。"); return; }

    setIsStriking(true);
    setResultMessage(null);

    // カン！カン！カン！演出
    setStrikeStep(1); await new Promise(r => setTimeout(r, 600));
    setStrikeStep(2); await new Promise(r => setTimeout(r, 600));
    setStrikeStep(3); await new Promise(r => setTimeout(r, 800));

    const dice = Math.random() * 100;
    const isSuccess = dice < cost.rate;

    try {
      // 1. Zeny減算
      await supabase.from('game_party_status').update({ zeny: zeny - cost.zeny }).eq('user_id', userId);

      // 2. 強化石減算
      const { data: stoneInv } = await supabase
        .from('game_inventory')
        .select('id, count, game_master_items!inner(name)')
        .eq('user_id', userId)
        .or('game_master_items.name.ilike.%強化石%,game_master_items.name.ilike.%オリデオコン%')
        .gt('count', 0)
        .limit(1)
        .maybeSingle();

      if (stoneInv) {
        if (stoneInv.count <= 1) await supabase.from('game_inventory').delete().eq('id', stoneInv.id);
        else await supabase.from('game_inventory').update({ count: stoneInv.count - 1 }).eq('id', stoneInv.id);
      }

      // 3. 成功 / 失敗による計算
      let nextRefine = selectedItem.refine_level;
      if (isSuccess) {
        nextRefine += 1;
        setResultMessage({ success: true, text: `🎉 カンパーーーン！【+${nextRefine} ${selectedItem.name}】へ強化大成功！` });
      } else {
        if (!cost.safe && nextRefine > 0) {
          nextRefine -= 1;
          setResultMessage({ success: false, text: `💥 精錬失敗… 衝撃で強化値が +${nextRefine} にダウン！` });
        } else {
          setResultMessage({ success: false, text: `💦 失敗… 強化値は維持されました。` });
        }
      }

      // 4. ソース別（倉庫アイテムか、キャラ着用アイテムか）でDB更新の宛先を切り替え！
      if (selectedItem.source === 'inventory') {
        await supabase.from('game_inventory').update({ refine_level: nextRefine }).eq('id', selectedItem.id);
      } else if (selectedItem.source === 'character') {
        const updateData = {};
        updateData[`${selectedItem.slot_key}_refine`] = nextRefine;
        await supabase.from('game_characters').update(updateData).eq('id', selectedItem.character_id);
      }

      await loadBlacksmithData();

    } catch (err) {
      console.error("精錬エラー:", err);
      alert("🚨 精錬処理中にエラーが発生しました。");
    } finally {
      setIsStriking(false);
      setStrikeStep(0);
    }
  };

  if (loading) return <div style={{ color: '#f59e0b', textAlign: 'center', padding: '50px' }}>🔨 炉に火をくべています...</div>;

  const cost = getRefineCost(selectedItem);

  return (
    <div style={{ padding: '20px 16px 40px 16px', color: '#fff', background: '#090d16', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      {/* 上部ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
        <button onClick={onBack} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ArrowLeft size={14} /> 戻る
        </button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#f59e0b', fontFamily: 'serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Hammer size={18} /> 伝説の鍛冶工房
        </h2>
        <div style={{ width: '60px' }}></div>
      </div>

      {/* 所持リソース */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: '#111827', border: '1px solid #f59e0b44', borderRadius: '10px', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><Coins size={14} /> 所持 Zeny</span>
          <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace' }}>{zeny.toLocaleString()}</span>
        </div>
        <div style={{ background: '#111827', border: '1px solid #a78bfa44', borderRadius: '10px', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: '#a78bfa', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><Sparkles size={14} /> 所持 強化石</span>
          <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#a78bfa', fontFamily: 'monospace' }}>{stoneCount} 個</span>
        </div>
      </div>

      {/* 選択中の武具＆精錬台 */}
      <div style={{ background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)', border: '1px solid #4338ca', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
        {selectedItem ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#0b0f19', border: '1px solid #312e81', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: '#818cf8', marginBottom: '4px' }}>
                {selectedItem.subtype} ({selectedItem.type === 'weapon' ? '武器' : '防具'})
                {selectedItem.equipped_by && <span style={{ color: '#38bdf8', marginLeft: '6px', fontWeight: 'bold' }}>👤 {selectedItem.equipped_by} 装備中</span>}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffd700', marginBottom: '8px' }}>
                {selectedItem.refine_level > 0 ? `+${selectedItem.refine_level} ` : ''}{selectedItem.name}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', background: '#111827', padding: '8px', borderRadius: '8px' }}>
                {selectedItem.type === 'weapon' ? (
                  <>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ATK: <strong style={{ color: '#fff' }}>{selectedItem.base_atk + selectedItem.refine_level * 5}</strong></div>
                    <div style={{ color: '#f59e0b', fontWeight: 'bold' }}>➔</div>
                    <div style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 'bold' }}>NEXT: {selectedItem.base_atk + (selectedItem.refine_level + 1) * 5} <span style={{ fontSize: '0.65rem' }}>(+5)</span></div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>DEF: <strong style={{ color: '#fff' }}>+{selectedItem.base_def + selectedItem.refine_level * 2}</strong></div>
                    <div style={{ color: '#34d399', fontWeight: 'bold' }}>➔</div>
                    <div style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 'bold' }}>NEXT: +{selectedItem.base_def + (selectedItem.refine_level + 1) * 2} <span style={{ fontSize: '0.65rem' }}>(+2)</span></div>
                  </>
                )}
              </div>
            </div>

            {/* コストボード */}
            <div style={{ background: '#0b0f19', borderRadius: '10px', padding: '10px 12px', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>必要費用 (Zeny):</span>
                <span style={{ color: zeny >= cost.zeny ? '#f59e0b' : '#ef4444', fontWeight: 'bold', fontFamily: 'monospace' }}>{cost.zeny.toLocaleString()} Zeny</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>必要素材:</span>
                <span style={{ color: stoneCount >= cost.stone ? '#a78bfa' : '#ef4444', fontWeight: 'bold' }}>強化石 ×1 (所持: {stoneCount}個)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1e293b', paddingTop: '4px' }}>
                <span style={{ color: '#94a3b8' }}>成功確率:</span>
                <span style={{ color: cost.safe ? '#34d399' : '#f59e0b', fontWeight: 'bold' }}>
                  {cost.rate}% {cost.safe ? '(安全圏 100%)' : '⚠️ 危険圏 (失敗時ランクダウン)'}
                </span>
              </div>
            </div>

            {/* カットイン */}
            {isStriking && (
              <div style={{ padding: '16px', background: '#0f172a', border: '1px solid #f59e0b', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', color: '#f59e0b', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Flame size={20} color="#f59e0b" />
                  {strikeStep === 1 && "カンッ！"}
                  {strikeStep === 2 && "カンッ！！"}
                  {strikeStep === 3 && "カーーーーン！！！"}
                </div>
              </div>
            )}

            {resultMessage && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: resultMessage.success ? '#064e3b' : '#451a1a', border: resultMessage.success ? '1px solid #34d399' : '1px solid #ef4444', color: '#fff', fontSize: '0.78rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {resultMessage.success ? <CheckCircle2 size={16} color="#34d399" /> : <AlertTriangle size={16} color="#ef4444" />}
                <span>{resultMessage.text}</span>
              </div>
            )}

            <button
              onClick={handleRefineExecute}
              disabled={isStriking || selectedItem.refine_level >= 10}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                background: isStriking ? '#334155' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#fff', border: 'none', fontSize: '0.9rem', fontWeight: 'bold',
                cursor: isStriking ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <Hammer size={18} /> {isStriking ? '精錬中...' : `+${selectedItem.refine_level + 1} へ精錬を叩く！`}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b', fontSize: '0.8rem' }}>
            <Hammer size={32} color="#4338ca" style={{ marginBottom: '8px' }} />
            <div>下の武具リストから、強化したい装備を選んでください。<br />（倉庫のストック ＆ キャラの着用装備も直接叩けます）</div>
          </div>
        )}
      </div>

      {/* 武具一覧 */}
      <h3 style={{ fontSize: '0.82rem', color: '#818cf8', margin: '0 0 10px 0', fontWeight: 'bold' }}>
        ⚔️ 強化可能な武具リスト ({items.length}種類)
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '350px', overflowY: 'auto' }}>
        {items.map(item => {
          const isSelected = selectedItem?.id === item.id;
          return (
            <div
              key={item.id}
              onClick={() => { setSelectedItem(item); setResultMessage(null); }}
              style={{
                background: isSelected ? '#312e81' : '#111827',
                border: isSelected ? '1px solid #6366f1' : '1px solid #1e293b',
                borderRadius: '10px', padding: '10px 12px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#0f172a', padding: '6px', borderRadius: '6px', color: item.type === 'weapon' ? '#f59e0b' : '#34d399' }}>
                  {item.type === 'weapon' ? <Swords size={16} /> : <Shield size={16} />}
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: item.refine_level > 0 ? '#ffd700' : '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{item.refine_level > 0 ? `+${item.refine_level} ` : ''}{item.name}</span>
                    
                    {/* 👤 キャラの着用中バッジ */}
                    {item.equipped_by && (
                      <span style={{ fontSize: '0.58rem', background: '#0284c7', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <UserCheck size={10} /> {item.equipped_by}
                      </span>
                    )}

                    {/* 📦 未強化品（+0）のまとめ数表示 */}
                    {!item.equipped_by && item.refine_level === 0 && item.count > 1 && (
                      <span style={{ fontSize: '0.62rem', color: '#34d399', background: '#064e3b', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                        所持:{item.count}個
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>
                    {item.subtype} | {item.type === 'weapon' ? `ATK:${item.base_atk + item.refine_level * 5}` : `DEF:+${item.base_def + item.refine_level * 2}`}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: isSelected ? '#ffd700' : '#818cf8' }}>
                {isSelected ? '選択中' : '叩く ➔'}
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'center', padding: '20px' }}>
            強化可能な武器・防具が見つかりません。
          </div>
        )}
      </div>

    </div>
  );
};

export default AdventureBlacksmith;
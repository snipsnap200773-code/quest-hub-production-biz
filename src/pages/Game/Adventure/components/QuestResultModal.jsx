import React, { useState } from 'react';
import { Sparkles, Coins, Package } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';
// 🟢 🆕 独立数理室からテーブルとポイント計算インフラを最上部で安全にドッキング！
import { RO_NEXT_EXP_TABLE, calculateTotalStatusPoints } from '../../../../gameRules';

const QuestResultModal = ({ isOpen, userId, droppedItems = [], accumulatedRewards = { exp: 0, gold: 0 }, onClose }) => {
  if (!isOpen) return null;

  // 各アイテムの売却チェック状態を管理
  const [sellChecked, setSellChecked] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const handleCheckChange = (itemId) => {
    setSellChecked(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // 📦 🆕 【三土手創世神特注：ハクスラ財貨物流一括コミットコア】
  const processLogistics = async (mode) => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // 1. 今回獲得したアイテムを「持ち帰り用」と「即時売却用」に仕分けする数理
      const itemsToKeep = [];
      let totalZenyEarned = 0;

      droppedItems.forEach(item => {
        if (mode === 'sell_selected' && sellChecked[item.id]) {
          totalZenyEarned += Number(item.sell_price || item.value || 100);
        } else {
          itemsToKeep.push(item);
        }
      });

      // 2. 【共有倉庫（DB）への一括インジェクション処理】
      if (itemsToKeep.length > 0) {
        await Promise.all(
          itemsToKeep.map(async (item) => {
            const { data: existingStock } = await supabase
              .from('game_inventory')
              .select('id, count')
              .eq('user_id', userId)
              .eq('item_id', item.id)
              .maybeSingle();

            if (existingStock) {
              await supabase
                .from('game_inventory')
                .update({ count: Number(existingStock.count || 0) + 1 })
                .eq('id', existingStock.id);
            } else {
              await supabase
                .from('game_inventory')
                .insert([{
                  user_id: userId, // 💡 TEST_USER_ID を排除し、Props の userId に完全に結合！
                  item_id: item.id,
                  count: 1
                }]);
            }
          })
        );
      }

      // 3. 【ギルド所持金（DB）への換金コミット処理】
      const finalZenyAddition = totalZenyEarned + Number(accumulatedRewards.gold || 0);

      if (finalZenyAddition > 0) {
        // 🔑 【修正】game_guilds ではなく、新設された game_party_status の zeny カラムに直接合流！
        const { data: partyStatus } = await supabase
          .from('game_party_status')
          .select('user_id, zeny')
          .eq('user_id', userId)
          .maybeSingle();

        if (partyStatus) {
          await supabase
            .from('game_party_status')
            .update({ zeny: Number(partyStatus.zeny || 0) + finalZenyAddition })
            .eq('user_id', userId);
        }
      }

      // 4. 【獲得したEXP（経験値）を戦闘メンバー全員に付与コミット】
      if (Number(accumulatedRewards.exp || 0) > 0) {

        // 陣形キーから現在のアクティブパーティIDをLocalStorageから取得
        const savedTactics = localStorage.getItem('mitsudote_tactics_save');
        if (savedTactics) {
          const rawParty = JSON.parse(savedTactics);
          // null以外の有効なキャラクターID（UUID）を抽出
          const activeCharIds = rawParty
            .map(slot => slot && typeof slot === 'object' ? slot.id : slot)
            .filter(id => id && String(id).trim() !== '' && String(id) !== 'null');

          if (activeCharIds.length > 0) {
            await Promise.all(
              activeCharIds.map(async (charId) => {
                // キャラクターの現在の経験値をダウンロード
                const { data: charData } = await supabase
                  .from('game_characters')
                  .select('id, exp, level, status_points, bonus_str, bonus_agi, bonus_vit, bonus_int, bonus_dex, bonus_luk')
                  .eq('id', charId)
                  .maybeSingle();

                if (charData) {
                  let nextExp = Number(charData.exp || 0) + Number(accumulatedRewards.exp);
                  let nextLevel = Number(charData.level || 1);
                  let originalLevel = nextLevel; // 元のレベルを記憶

                  // 📊 【三土手神特注：本家RO成長曲線連動型・限界突破レベルアップ判定ループ】
                  // RO_NEXT_EXP_TABLE を参照し、上限を突破している限り何度でも連続レベルアップ！
                  let requiredExp = RO_NEXT_EXP_TABLE[nextLevel] || 999999;
                  while (nextExp >= requiredExp && nextLevel < 50) { // 最大Lv50制限
                    nextExp -= requiredExp;
                    nextLevel += 1;
                    requiredExp = RO_NEXT_EXP_TABLE[nextLevel] || 999999;
                  }

                  // 🪙 【フリーポイント自動差分計算インフラ】
                  // レベルアップが発生した場合、新しいレベルで持っているべき「総獲得ポイント」を算出し、
                  // そこから「既に手振りに使ったポイント（bonus分）」を正確に引き算して残りフリーポイントを上書き！
                  let finalStatusPoints = charData.status_points;

                  if (nextLevel > originalLevel) {
                    // 新しいレベルにおける生涯総フリーポイント
                    const totalPointsAtNextLv = calculateTotalStatusPoints(nextLevel);
                    
                    // 既に自分で割り振って消費済みのポイントを合計
                    const spentPoints = Number(charData.bonus_str || 0) + 
                                        Number(charData.bonus_agi || 0) + 
                                        Number(charData.bonus_vit || 0) + 
                                        Number(charData.bonus_int || 0) + 
                                        Number(charData.bonus_dex || 0) + 
                                        Number(charData.bonus_luk || 0);

                    // 総ポイントから消費分を引いて、残るべきフリーポイントを美しく算出
                    finalStatusPoints = Math.max(0, totalPointsAtNextLv - spentPoints);
                    
                    console.log(`🎉 LEVEL UP!! [${charId}] : Lv.${originalLevel} ➔ Lv.${nextLevel} (残りステP: ${finalStatusPoints})`);
                  }

                  // 獲得した経験値、新しいレベル、そして再計算されたフリーポイントをSupabaseへ一括永続コミット！
                  await supabase
                    .from('game_characters')
                    .update({ 
                      exp: nextExp, 
                      level: nextLevel,
                      status_points: finalStatusPoints
                    })
                    .eq('id', charId);
                }
              })
            );
          }
        }
      }

      // 5. 物流結果のお知らせ
      if (mode === 'all') {
        alert(`🎒 遠征部隊の物流が完了しました！\n獲得した戦利品 [ ${itemsToKeep.length} 個 ] をすべてギルド共有倉庫へ格納し、モンスター撃破報酬 [ +${accumulatedRewards.gold} Zeny ] をギルド金庫へ追加しました！`);
      } else {
        alert(`💸 商談成立！\n選択した戦利品の売却とモンスター撃破報酬を合わせ、総額 [ +${finalZenyAddition} Zeny ] を獲得しました！\n残りのアイテム [ ${itemsToKeep.length} 個 ] は共有倉庫へ格納されました！`);
      }

      // 6. すべての物流処理が正常クリーンに終了したら、モーダルを閉じて冒険画面側へバトンを返す
      onClose();

    } catch (err) {
      console.error("ハクスラ物流コミット中に致命的エラー発生:", err);
      alert("🚨 物流インフラの通信に失敗しました。マスターデータベースの設定を確認してください。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#111', width: '100%', maxWidth: '400px', borderRadius: '24px',
        border: '2px solid #f59e0b', padding: '25px', color: '#fff', textAlign: 'center'
      }}>
        <div style={{ color: '#f59e0b', marginBottom: '10px' }}>
          <Sparkles size={32} style={{ margin: '0 auto' }} />
        </div>
        <h2 style={{ fontSize: '1.3rem', color: '#f59e0b', margin: '0 0 15px 0', letterSpacing: '2px', fontFamily: 'serif' }}>
          🏆 探索完了・戦利品清算
        </h2>

        {/* 獲得EXPとZenyリザルト表示 */}
        <div style={{ 
          background: '#1a1c23', border: '1px solid #334155', borderRadius: '12px', 
          padding: '10px', marginBottom: '15px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' 
        }}>
          <div style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 'bold' }}>
            📈 獲得 EXP: <span style={{ color: '#fff', fontFamily: 'monospace' }}>+{accumulatedRewards.exp}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#ffd700', fontWeight: 'bold' }}>
            💰 獲得 Zeny: <span style={{ color: '#fff', fontFamily: 'monospace' }}>+{accumulatedRewards.gold}</span>
          </div>
        </div>

        {/* ドロップリストコンテナ */}
        <div style={{ 
          background: '#050505', border: '1px solid #222', borderRadius: '12px', 
          padding: '10px', maxHeight: '200px', overflowY: 'auto', marginBottom: '25px', textAlign: 'left'
        }}>
          <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>獲得した戦利品アイテム</span>
            <span>即売却査定</span>
          </div>
          
          {droppedItems.map((item, index) => {
            const uniqueKey = item.id ? `${item.id}_${index}` : `drop_idx_${index}`;
            return (
              <div key={uniqueKey} style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                padding: '8px 0', borderBottom: '1px solid #111' 
              }}>
                <span style={{ fontSize: '0.85rem', color: item.rarity === 'legendary' ? '#f59e0b' : item.rarity === 'epic' ? '#a78bfa' : '#fff' }}>
                  {item.name}
                </span>
                <input 
                  type="checkbox" 
                  checked={!!sellChecked[item.id]} 
                  onChange={() => handleCheckChange(item.id)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#ef4444' }}
                />
              </div>
            );
          })}

          {droppedItems.length === 0 && (
            <div style={{ fontSize: '0.75rem', color: '#444', textAlign: 'center', padding: '15px', fontStyle: 'italic' }}>
              今回の探索での戦利品ドロップはありませんでした。
            </div>
          )}
        </div>

        {/* 物流コミットボタンエリア */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            onClick={() => processLogistics('all')}
            disabled={isSaving} // 💡 アイテムが0個でも、ZenyとEXPを持って帰れるようにロックを解除！
            style={{ 
              width: '100%', padding: '12px', borderRadius: '12px', 
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
              color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <Package size={16} /> {isSaving ? '倉庫へ輸送中...' : '全て倉庫へ持ち帰る'}
          </button>
          
          <button 
            onClick={() => processLogistics('sell_selected')}
            disabled={isSaving || droppedItems.length === 0 || Object.values(sellChecked).filter(Boolean).length === 0} // こちらは選択売却用なのでアイテム0ならdisabledでOKです
            style={{ 
              width: '100%', padding: '12px', borderRadius: '12px', 
              background: '#222', color: (isSaving || droppedItems.length === 0 || Object.values(sellChecked).filter(Boolean).length === 0) ? '#444' : '#ef4444', 
              border: '1px solid #333', fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <Coins size={16} /> チェックした武具を換金して帰還
          </button>
        </div>

      </div>
    </div>
  );
};

export default QuestResultModal;
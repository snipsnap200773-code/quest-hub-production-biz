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

      // 4. 👑 【二重計上防止：スキップ】
      // 経験値(EXP)のリアルタイム加算とレベルアップ処理は、すでに戦闘中（AdventureActive）で完了し
      // DBへ保存済みのため、ここでは二重に計算させず完全にスキップ（削除）します。

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
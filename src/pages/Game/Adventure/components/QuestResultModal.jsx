import React, { useState } from 'react';
import { Sparkles, Coins, Package } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';

const TEST_USER_ID = "d1669717-95f4-4f80-932f-d412576d55a7";

const QuestResultModal = ({ isOpen, droppedItems = [], onClose }) => {
  if (!isOpen) return null;

  // 各アイテムの売却チェック状態を管理（デフォルトはすべてチェックなし＝持ち帰る）
  const [sellChecked, setSellChecked] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const handleCheckChange = (itemId) => {
    setSellChecked(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // 📦 🆕 【三土手創世神特注：ハクスラ財貨物流一括コミットコア】
  // 「全て持ち帰る」または「選択売却」の物流ルートを一元的につかさどる神関数です！
  const processLogistics = async (mode) => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // 1. 今回獲得したアイテムを「持ち帰り用」と「即時売却用」に仕分けする数理
      const itemsToKeep = [];
      let totalZenyEarned = 0;

      droppedItems.forEach(item => {
        // モードが 'sell_selected' かつ チェックが入っている場合は即時売却ルートへ
        if (mode === 'sell_selected' && sellChecked[item.id]) {
          // アイテムマスターデータから設定された sell_price（換金価格）を逆引き計算
          totalZenyEarned += Number(item.sell_price || item.value || 100);
        } else {
          // それ以外はすべて大切に共有倉庫へ持ち帰るルートへスタック
          itemsToKeep.push(item);
        }
      });

      // 2. 【共有倉庫（DB）への一括インジェクション処理】
      // 持ち帰る武具やカードが1件でも存在する場合、game_inventory テーブルへ直撃 Upsert！
      if (itemsToKeep.length > 0) {
        await Promise.all(
          itemsToKeep.map(async (item) => {
            // 既存の倉庫の中に同じアイテムIDがすでに格納されているかスキャン
            const { data: existingStock } = await supabase
              .from('game_inventory')
              .select('id, count')
              .eq('user_id', TEST_USER_ID)
              .eq('item_id', item.id)
              .maybeSingle();

            if (existingStock) {
              // すでに在庫がある場合は、既存の数量に +1 加算してアップデート！
              await supabase
                .from('game_inventory')
                .update({ count: Number(existingStock.count || 0) + 1 })
                .eq('id', existingStock.id);
            } else {
              // 倉庫に初めて入る初物アイテムの場合は、新規に数量1個でインサート！
              await supabase
                .from('game_inventory')
                .insert([{
                  user_id: TEST_USER_ID,
                  item_id: item.id,
                  count: 1
                }]);
            }
          })
        );
      }

      // 3. 【ギルド所持金（DB）への換金コミット処理】
      // 即時売却によるZeny獲得が発生している場合は、ギルドマスター財貨テーブルへ直撃加算！
      if (totalZenyEarned > 0) {
        // ギルドの現在の財布（Zeny）の生データをサルベージ
        const { data: guildWallet } = await supabase
          .from('game_guilds')
          .select('id, zeny')
          .eq('user_id', TEST_USER_ID)
          .maybeSingle();

        if (guildWallet) {
          await supabase
            .from('game_guilds')
            .update({ zeny: Number(guildWallet.zeny || 0) + totalZenyEarned })
            .eq('id', guildWallet.id);
        }
      }

      // 4. 物流結果をバトルログ画面風のダイアログでお知らせ
      if (mode === 'all') {
        alert(`🎒 遠征部隊の物流が完了しました！\n獲得した戦利品 [ ${itemsToKeep.length} 個 ] をすべてギルド共有倉庫へ格納しました！`);
      } else {
        alert(`💸 商談成立！\n選択した戦利品を査定・売却し [ +${totalZenyEarned} Zeny ] を獲得しました！\n残りのアイテム [ ${itemsToKeep.length} 個 ] は共有倉庫へ無風格納されました！`);
      }

      // すべての物流処理が正常クリーンに終了したら、モーダルを閉じて冒険画面側へバトンを返す
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
        <h2 style={{ fontSize: '1.3rem', color: '#f59e0b', margin: '0 0 20px 0', letterSpacing: '2px', fontFamily: 'serif' }}>
          🏆 探索完了・戦利品清算
        </h2>

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
            // リストのキー重複エラーを防ぐ一意の識別キーを生成
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
            disabled={isSaving || droppedItems.length === 0}
            style={{ 
              width: '100%', padding: '12px', borderRadius: '12px', 
              background: droppedItems.length === 0 ? '#1f1f1f' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
              color: droppedItems.length === 0 ? '#444' : '#fff', border: 'none', fontWeight: 'bold', cursor: droppedItems.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <Package size={16} /> {isSaving ? '倉庫へ輸送中...' : '全て倉庫へ持ち帰る'}
          </button>
          
          <button 
            onClick={() => processLogistics('sell_selected')}
            disabled={isSaving || droppedItems.length === 0 || Object.values(sellChecked).filter(Boolean).length === 0}
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
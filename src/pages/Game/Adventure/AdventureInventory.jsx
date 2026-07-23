import React, { useState, useEffect } from 'react';
import { Shield, Sword, Sparkles, Archive, Coins, X, Key, ChevronUp, ChevronDown, UserCheck } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { gameServices } from '../../../gameServices';

const AdventureInventory = ({ userId, onBack }) => {
  // 💰 ギルドのリアルタイム所持金（Zeny）状態
  const [zeny, setZeny] = useState(0);
  // 🎒 共有倉庫からロードした本物の在庫アイテム配列状態
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🧭 フィルター
  const [filter, setFilter] = useState('all');
  
  // 🔍 1段階目：詳細ポップアップアイテム
  const [selectedItem, setSelectedItem] = useState(null);

  // 🔢 2段階目：数量選択ポップアップアイテム ＆ 個数
  const [sellTargetItem, setSellTargetItem] = useState(null);
  const [sellCount, setSellCount] = useState(1);

  // 🏛️ 倉庫＆財貨インフラ直撃サルベージ回路
  const loadWarehouseLogistics = async () => {
    if (!userId) return; // 💡 ログインIDが渡されるまで処理をスキップ
    setLoading(true);
    try {
      // 1. game_party_status テーブルから zeny を安全に一本釣り！
      const { data: partyData } = await supabase
        .from('game_party_status')
        .select('zeny')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (partyData) {
        setZeny(partyData.zeny || 0);
      }

      // 2. アイテムマスター取得
      const { data: allMasterItems } = await supabase.from('game_master_items').select('*');
      const masterMap = allMasterItems ? Object.fromEntries(allMasterItems.map(m => [m.id, m])) : {};

      // 3. Supabaseからインベントリ（倉庫）データを取得！
      const { data: warehouseStocks, error: invError } = await supabase
        .from('game_inventory')
        .select('*')
        .eq('user_id', userId);

      if (invError) throw invError;

      // 4. キャラクター装着中アイテムの取得（誰が何を装備しているかスキャン）
      const { data: charData } = await supabase
        .from('game_characters')
        .select('*')
        .eq('user_id', userId);

      const rawItems = [];

      // A. 倉庫ストックの抽出
      if (warehouseStocks) {
        warehouseStocks.forEach(stock => {
          if (!stock.item_id || Number(stock.count || 0) <= 0) return;

          const master = masterMap[stock.item_id];
          const basePrice = Number(master?.sell_price || 0);
          const finalSellValue = basePrice > 0 ? basePrice : 10;
          const refineVal = Number(stock.refine_level || 0);

          rawItems.push({
            id: stock.id,
            ids: [stock.id],
            item_id: stock.item_id,
            refine_level: refineVal,
            name: master?.name || '未知のアイテム',
            type: master?.item_type || 'etc',
            rarity: master?.rarity || 'common',
            count: Number(stock.count || 0),
            value: finalSellValue,
            desc: master?.description || '詳細情報なし',
            is_favorite: stock.is_favorite || false,
            equipped_by: null // 倉庫ストック
          });
        });
      }

      // B. キャラの着用中武具の精査＆合流！
      if (charData) {
        const slotKeys = [
          'equip_right_hand', 'equip_left_hand', 'equip_head', 'equip_face',
          'equip_body', 'equip_glove', 'equip_garment', 'equip_shoes', 'equip_accessory'
        ];

        charData.forEach(ch => {
          slotKeys.forEach(sKey => {
            const equipVal = ch[sKey];
            if (!equipVal) return;

            const invRecord = warehouseStocks?.find(i => i.id === equipVal);
            const master = invRecord ? masterMap[invRecord.item_id] : masterMap[equipVal];

            if (master) {
              rawItems.push({
                id: `char_${ch.id}_${sKey}`,
                ids: [`char_${ch.id}_${sKey}`],
                item_id: master.id,
                refine_level: invRecord ? Number(invRecord.refine_level || 0) : 0,
                name: master.name,
                type: master.item_type,
                rarity: master.rarity || 'common',
                count: 1,
                value: Number(master.sell_price || 10),
                desc: master.description || '詳細情報なし',
                is_favorite: true,
                equipped_by: ch.custom_name || ch.job || '仲間'
              });
            }
          });
        });
      }

      // C. 👑 精錬値・着用状況を識別して賢くグループ化！
      const groupedMap = {};

      rawItems.forEach(item => {
        // グループ化キー：「アイテムID_精錬値_装備者」
        // これにより「+2ロングソード [ファイター装備中]」と「未強化ロングソード」が絶対に混ざりません！
        const groupKey = `${item.item_id}_refine:${item.refine_level}_eq:${item.equipped_by || 'none'}`;

        if (!groupedMap[groupKey]) {
          groupedMap[groupKey] = { ...item };
        } else {
          groupedMap[groupKey].count += item.count;
          groupedMap[groupKey].ids.push(...item.ids);
          if (item.is_favorite) groupedMap[groupKey].is_favorite = true;
        }
      });

      // Stateへ格納！
      setItems(Object.values(groupedMap));

    } catch (err) {
      console.error("倉庫データロードエラー:", err);
    } finally {
      setLoading(false);
    }
  };

  // 画面マウント時、または userId 確定時にインフラ起動
  useEffect(() => {
    if (!userId) return;
    loadWarehouseLogistics();
  }, [userId]);

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

  // 💳 売却コミット物流エンジン
  const handleFinalSell = async () => {
    if (!sellTargetItem || !userId) return;
    if (sellTargetItem.equipped_by) {
      alert("⚠️ キャラクターが装備中の武具は売却できません。装備を外してからお売りください。");
      return;
    }

    const confirmMessage = `💰 【ギルド買取最終確認】\n\n${sellTargetItem.refine_level > 0 ? `+${sellTargetItem.refine_level} ` : ''}${sellTargetItem.name} を [ ${sellCount} 個 ] 売却します。\n獲得資金: ${(sellTargetItem.value * sellCount).toLocaleString()} Zeny\n\n本当によろしいですか？`;
    
    if (!window.confirm(confirmMessage)) return;

    try {
      const totalEarned = sellTargetItem.value * sellCount;

      // 1. 所持金の加算
      const { data: currentWallet } = await supabase
        .from('game_party_status')
        .select('user_id, zeny')
        .eq('user_id', userId)
        .maybeSingle();

      const currentZeny = Number(currentWallet?.zeny || 0);
      const nextZeny = currentZeny + totalEarned;

      const { error: walletError } = await supabase
        .from('game_party_status')
        .upsert({ 
          user_id: userId, 
          zeny: nextZeny 
        }, { onConflict: 'user_id' });

      if (walletError) throw walletError;

      // 2. 在庫数の減算
      const nextCount = sellTargetItem.count - sellCount;
      if (nextCount <= 0) {
        await supabase
          .from('game_inventory')
          .delete()
          .eq('id', sellTargetItem.id);
      } else {
        await supabase
          .from('game_inventory')
          .update({ count: nextCount })
          .eq('id', sellTargetItem.id);
      }

      alert(`💸 商談成立！\n${sellTargetItem.name} を ${sellCount} 個売却し、+${totalEarned.toLocaleString()} Zeny を獲得しました！`);

      setSellTargetItem(null);
      setSelectedItem(null);
      await loadWarehouseLogistics();

    } catch (err) {
      console.error("売却物流コミット失敗:", err);
      alert("🚨 買い取り通信に失敗しました。ギルド窓口の接続を確認してください。");
    }
  };

  // お気に入りのトグル切り替えコミット
  const handleToggleFavorite = async (item) => {
    if (!item || !userId) return;
    if (item.equipped_by) return; // 装備中は常に常時ロック扱い

    const nextStatus = !item.is_favorite;

    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_favorite: nextStatus } : i));
    if (selectedItem && selectedItem.id === item.id) {
      setSelectedItem(prev => ({ ...prev, is_favorite: nextStatus }));
    }

    try {
      const { error } = await supabase
        .from('game_inventory')
        .update({ is_favorite: nextStatus })
        .eq('id', item.id);

      if (error) throw error;
    } catch (err) {
      console.error("お気に入り更新失敗:", err);
      await loadWarehouseLogistics();
    }
  };

  // お気に入り以外を一括全売却する物流エンジン
  const handleBulkSell = async () => {
    // 対象：お気に入り未設定 且つ クエスト品以外のアイテム（装備中のものも自動保護）
    const targetItems = items.filter(i => !i.is_favorite && !i.equipped_by && i.type !== 'quest' && i.count > 0);

    if (targetItems.length === 0) {
      alert("⚠️ 売却可能な「お気に入り未設定アイテム」はありません。");
      return;
    }

    const totalCount = targetItems.reduce((sum, i) => sum + i.count, 0);
    const totalEarned = targetItems.reduce((sum, i) => sum + (i.value * i.count), 0);

    const confirmMsg = `🧹 【一括売却の確認】\n\nお気に入り【未設定】のアイテム ${targetItems.length}バリエーション（計 ${totalCount} 個）を一括売却します。\n\n💰 獲得予定資金: +${totalEarned.toLocaleString()} Zeny\n\n本当に実行しますか？`;

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const targetIds = targetItems.flatMap(i => i.ids || [i.id]);

      const { error: delError } = await supabase
        .from('game_inventory')
        .delete()
        .in('id', targetIds);

      if (delError) throw delError;

      const { data: currentWallet } = await supabase
        .from('game_party_status')
        .select('user_id, zeny')
        .eq('user_id', userId)
        .maybeSingle();

      const currentZeny = Number(currentWallet?.zeny || 0);
      const nextZeny = currentZeny + totalEarned;

      await supabase
        .from('game_party_status')
        .upsert({ user_id: userId, zeny: nextZeny }, { onConflict: 'user_id' });

      alert(`💸 一括売却完了！\nアイテムを整理し、+${totalEarned.toLocaleString()} Zeny を金庫に格納しました！`);
      await loadWarehouseLogistics();

    } catch (err) {
      console.error("一括売却エラー:", err);
      alert("🚨 一括売却処理中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ color: '#34d399', textAlign: 'center', padding: '50px', fontFamily: 'monospace', fontSize: '0.85rem' }}>🎒 ギルド共有倉庫の在庫原帳を照合中...</div>;

  return (
    <div style={{ padding: '24px 20px 0 20px', color: '#fff', boxSizing: 'border-box', position: 'relative', minHeight: '80vh' }}>
      
      {/* 上部ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px', position: 'relative', minHeight: '32px' }}>
        <button onClick={onBack} style={{ position: 'absolute', left: 0, padding: '6px 12px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
          ← 戻る
        </button>
        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#34d399', fontWeight: 'bold', letterSpacing: '1px' }}>
          🎒 ギルド共有倉庫道具一覧
        </h2>
      </div>

      {/* 統計情報 ＆ 所持金カウンター */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '12px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Archive size={14} /> 倉庫格納中のアイテムバリエーション
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#34d399', fontFamily: 'monospace' }}>
            {items.filter(i => i.count > 0).length} 種類
          </span>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #111827 100%)', border: '1px solid #4338ca', borderRadius: '12px', padding: '12px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
            <Coins size={14} color="#f59e0b" /> ギルド金庫総資金
          </span>
          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#f59e0b', fontFamily: 'monospace' }}>
            {zeny.toLocaleString()} <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'normal' }}>Zeny</span>
          </span>
        </div>

        {/* 一括売却実行ボタン */}
        <button 
          onClick={handleBulkSell}
          style={{
            width: '100%', padding: '10px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
            color: '#f59e0b', border: '1px solid #f59e0b44',
            fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          🧹 お気に入り以外を一括売却
        </button>
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
              display: 'grid', gridTemplateColumns: '40px 1fr auto', alignItems: 'center', cursor: 'pointer',
              transition: 'border-color 0.15s, transform 0.15s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#34d399'; e.currentTarget.style.transform = 'scale(1.01)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.transform = 'none'; }}
          >
            {/* Icon */}
            <div style={{ color: getRarityColor(item.rarity), display: 'flex', alignItems: 'center' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '8px', border: `1px solid ${getRarityColor(item.rarity)}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.type === 'weapon' ? <Sword size={16} /> : item.type === 'card' ? <Sparkles size={16} /> : item.type === 'quest' ? <Key size={16} /> : <Shield size={16} />}
              </div>
            </div>
            
            {/* Name & Desc */}
            <div style={{ overflow: 'hidden', paddingRight: '8px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: item.refine_level > 0 ? '#ffd700' : getRarityColor(item.rarity), display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {item.is_favorite && <span style={{ color: '#ffd700', fontSize: '0.85rem' }}>★</span>}
                <span>{item.refine_level > 0 ? `+${item.refine_level} ` : ''}{item.name}</span>

                {/* 👤 装備中の仲間バッジ表示！ */}
                {item.equipped_by && (
                  <span style={{ fontSize: '0.58rem', background: '#0284c7', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <UserCheck size={10} /> {item.equipped_by} 装備中
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {item.desc}
              </div>
            </div>

            {/* Count */}
            <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: '900', color: '#94a3b8', background: '#1e293b', padding: '4px 8px', borderRadius: '6px', textAlign: 'center' }}>
              x{item.count}
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div style={{ textStyle: 'italic', textAlign: 'center', color: '#64748b', fontSize: '0.8rem', padding: '20px' }}>
            現在、倉庫に該当するハクスラ道具の備蓄はありません。
          </div>
        )}
      </div>

      {/* Detailed view popup */}
      {selectedItem && (
        <div 
          onClick={() => setSelectedItem(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px', backdropFilter: 'blur(4px)', cursor: 'pointer' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0f172a', width: '100%', maxWidth: '360px', borderRadius: '20px', border: `2px solid ${selectedItem.refine_level > 0 ? '#ffd700' : getRarityColor(selectedItem.rarity)}`, padding: '24px', position: 'relative', cursor: 'default' }}
          >
            <button onClick={() => setSelectedItem(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ color: getRarityColor(selectedItem.rarity), background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: `1px solid ${getRarityColor(selectedItem.rarity)}44` }}>
                {selectedItem.type === 'weapon' ? <Sword size={32} /> : selectedItem.type === 'card' ? <Sparkles size={32} /> : selectedItem.type === 'quest' ? <Key size={32} /> : <Shield size={32} />}
              </div>
            </div>

            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: selectedItem.refine_level > 0 ? '#ffd700' : getRarityColor(selectedItem.rarity), textAlign: 'center', fontWeight: 'bold' }}>
              {selectedItem.refine_level > 0 ? `+${selectedItem.refine_level} ` : ''}{selectedItem.name}
            </h3>
            
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '0.6rem', color: selectedItem.equipped_by ? '#38bdf8' : (selectedItem.type === 'quest' ? '#f43f5e' : '#94a3b8'), background: selectedItem.equipped_by ? '#0369a1' : (selectedItem.type === 'quest' ? '#270510' : '#1e293b'), padding: '2px 8px', borderRadius: '4px', border: selectedItem.type === 'quest' ? '1px solid #e11d48' : 'none', fontWeight: 'bold' }}>
                {selectedItem.equipped_by ? `👤 ${selectedItem.equipped_by} 装備中` : (selectedItem.type === 'weapon' ? '武器・装備' : selectedItem.type === 'card' ? 'カード型秘宝' : selectedItem.type === 'quest' ? '⚠️ 貴重なクエストアイテム' : '消耗品アイテム')}
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

            {/* お気に入り（ロック）スイッチボタン */}
            {!selectedItem.equipped_by && (
              <div style={{ marginBottom: '16px' }}>
                <button 
                  onClick={() => handleToggleFavorite(selectedItem)}
                  style={{
                    width: '100%', padding: '8px', borderRadius: '8px',
                    background: selectedItem.is_favorite ? '#312e81' : '#0f172a',
                    color: selectedItem.is_favorite ? '#ffd700' : '#94a3b8',
                    border: selectedItem.is_favorite ? '1px solid #6366f1' : '1px solid #334155',
                    fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                >
                  {selectedItem.is_favorite ? '★ お気に入り解除 (ロック中)' : '☆ お気に入りに登録 (ロック)'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setSelectedItem(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>
                閉じる
              </button>
              
              {selectedItem.equipped_by ? (
                <button disabled style={{ flex: 2, padding: '10px', borderRadius: '8px', background: '#0284c722', color: '#38bdf8', border: '1px solid #0284c7', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'not-allowed' }}>
                  👤 装備中 (売却不可)
                </button>
              ) : selectedItem.is_favorite ? (
                <button disabled style={{ flex: 2, padding: '10px', borderRadius: '8px', background: '#1e293b', color: '#ffd700', border: '1px solid #ffd70044', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'not-allowed' }}>
                  🔒 ロック中 (売却不可)
                </button>
              ) : selectedItem.type !== 'quest' ? (
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

      {/* Quantity select / confirmation popup */}
      {sellTargetItem && (
        <div 
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
              <h4 style={{ margin: '12px 0 4px 0', fontSize: '0.95rem', color: '#fff' }}>
                {sellTargetItem.refine_level > 0 ? `+${sellTargetItem.refine_level} ` : ''}{sellTargetItem.name}
              </h4>
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
                売る（確定へ）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdventureInventory;
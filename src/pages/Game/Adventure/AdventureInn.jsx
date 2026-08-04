import React, { useState } from 'react';
// 🔨 鍛冶屋用に Hammer アイコンと AdventureBlacksmith コンポーネントを追加！
import { Users, Backpack, ChevronRight, Dog, Hammer, BookOpen } from 'lucide-react'; // 👈 BookOpen を追加！
import AdventureCharacterList from './AdventureCharacterList'; 
import AdventureCharacterDetail from './AdventureCharacterDetail'; 
import AdventureInventory from './AdventureInventory'; 
import AdventureBlacksmith from './AdventureBlacksmith'; 
import AdventureRecall from './AdventureRecall'; // 👈 これも追加！
import { supabase } from '../../../supabaseClient';

// 🆕 固定の TEST_USER_ID の定義を物理的に完全消去！

const AdventureInn = ({ userId }) => { // 🆕 親画面（AdventurePage）から流れてくる userId を直接マウント！
  const [subView, setSubView] = useState('top');
  const [selectedCharId, setSelectedCharId] = useState(null); 

  // 🚀 🆕 予約トリガー合流同期用の再読み込みキーを新設！
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 🚀 🆕 酒場トップに戻る、または仲間一覧に切り替えるたびにリロードを自動誘発させる監視電線！
  React.useEffect(() => {
    if (subView === 'top' || subView === 'characters') {
      setRefreshTrigger(prev => prev + 1);
    }
  }, [subView]);

  // 🐾 🆕 【三土手神特注：ファーム内の魔物＆テイマー物流State群】
  const [farmMonsters, setFarmMonsters] = useState([]);
  const [tamerCharacters, setTamerCharacters] = useState([]);
  const [farmLoading, setFarmLoading] = useState(false);

  // 🐾 🆕 ファーム突入時にSupabaseからデータを一斉ロードするエンジン
  const loadFarmData = async () => {
    setFarmLoading(true);
    try {
      // 1. 全キャラクターをダウンロード
      const { data: allChars, error } = await supabase
        .from('game_characters')
        .select('*')
        .eq('user_id', userId); // 🆕 引数で受け取った最新の userId に通信電線を結合！

      if (error) throw error;

      // 2. 【汎用化・確実版】master_id の名前に「tamer」または「テイマーのマスターIDの規則」を持つ人間を同行主として抽出
      const tamers = allChars.filter(ch => 
        ch.master_id === 'unit_1783729889058' || 
        ch.job === 'テイマー' || 
        ch.meta?.job === 'テイマー'
      );
      setTamerCharacters(tamers);

      // 3. 【鉄壁の魔物判別防壁】
      // master_id に「_base」が含まれる初期人間クラスは絶対に除外！
      // さらに、同行主として抽出されたテイマー本人のレコード（id）も絶対に除外！
      // これにより、純粋に「新しく捕獲されてInsertされた魔物（モンスター）」だけが100%確実に残ります。
      const tamerIds = tamers.map(t => t.id);
      
      const monsters = allChars.filter(ch => 
        ch.master_id && 
        !tamerIds.includes(ch.id) &&
        ch.race !== '人間' // 🚀 🆕 種族属性が「人間」のキャラは、どんなIDであれ牧場から完全シャットアウト！
      );
      setFarmMonsters(monsters);

    } catch (err) {
      console.error("ファームデータ物流エラー:", err);
    } finally {
      setFarmLoading(false);
    }
  };

  // subViewが'farm'に切り替わった瞬間に自動スキャンを発動
  React.useEffect(() => {
    if (subView === 'farm') {
      loadFarmData();
    }
  }, [subView]);

  // 🐾 🆕 魔物を特定のテイマーへ直撃バインド（同行）させるコミット関数
  const handleBindMonster = async (monsterId, tamerId, currentTamer) => {
    try {
      // 既にその魔物がこのテイマーの sub_tame_id にバインドされているかチェック
      const isAlreadyBound = currentTamer?.sub_tame_id === monsterId;
      
      // トグルスイッチ仕様：既にバインド中なら解除(null)、未バインドなら魔物のIDを格納
      const nextBoundMonsterId = isAlreadyBound ? null : monsterId;

      // 🚚 存在しないmetaカラムではなく、増築した本物の sub_tame_id カラムを直接更新！
      const { error } = await supabase
        .from('game_characters')
        .update({ sub_tame_id: nextBoundMonsterId })
        .eq('id', tamerId);

      if (error) throw error;

      alert(nextBoundMonsterId ? "🐾 魔物をテイマーの背中にバインドしました！" : "✨ 魔物のバインドを解除しました。");
      loadFarmData();

    } catch (err) {
      console.error("バインドコミット失敗:", err);
      alert("🚨 サーバーへのバインド同期に失敗しました。");
    }
  };

  // 1. 👥 仲間一覧ページへの切り替え部分
  if (subView === 'characters') {
    return (
      <AdventureCharacterList 
        userId={userId} // 🆕 仲間一覧コンポーネントへバトンをパス！
        key={`char-list-${refreshTrigger}`} // 🚀 🆕 トリガー変化時にコンポーネントを最新状態で丸ごと同期再マウント！
        onBack={() => setSubView('top')} 
        onSelectCharacter={(id) => {
          setSelectedCharId(id);
          setSubView('detail'); 
        }}
      />
    );
  }

  // 2. 📝 仲間詳細・個別育成部屋
  if (subView === 'detail') {
    return (
      <AdventureCharacterDetail 
        userId={userId} // 🆕 仲間詳細コンポーネントへも userId のバトンをパス！
        characterId={selectedCharId} 
        onBack={() => setSubView('characters')} 
      />
    );
  }

  // 3. 🎒 本物の持ち物一覧（倉庫）コンポーネントを呼び出す！
  if (subView === 'inventory') {
    return (
      <AdventureInventory 
        userId={userId} // 🆕 先ほど直した倉庫コンポーネントへ userId を手渡して配線開通！[cite: 5]
        onBack={() => setSubView('top')} 
      />
    );
  }

  // 🐾 🆕 4. 【三土手神特注】モンスターファーム（魔物牧場）超美麗・同行選抜ボード
  if (subView === 'farm') {
    return (
      <div style={{ padding: '24px 20px', color: '#fff', height: '100%', overflowY: 'auto' }}>
        
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', color: '#c084fc', margin: '0 0 4px 0', fontWeight: 'bold' }}>🐾 モンスターファーム</h2>
            <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>魔物をタップすると、ステータス割り振り・個別育成画面へ進みます</p>
          </div>
          <button 
            onClick={() => setSubView('top')}
            style={{ padding: '6px 14px', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
          >
            戻る
          </button>
        </div>

        {farmLoading ? (
          <div style={{ color: '#c084fc', textAlign: 'center', fontSize: '0.8rem', padding: '40px' }}>牧場データ同期中...</div>
        ) : farmMonsters.length === 0 ? (
          <div style={{ textStyle: 'italic', color: '#475569', textAlign: 'center', padding: '40px', fontSize: '0.8rem' }}>
            牧場に魔物が一匹もいません。テイマーを連れて冒険で魔物を調教してきましょう！
          </div>
        ) : (
          /* 魔物カードグリッド */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {farmMonsters.map(monster => {
              return (
                <div 
                  key={monster.id}
                  onClick={() => {
                    setSelectedCharId(monster.id); // ➔ タップした魔物のIDをロックオン！
                    setSubView('detail');          // ➔ 詳細・ステ振り部屋へ直接ワープ！[cite: 2]
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #111827 0%, #070a13 100%)',
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    cursor: 'pointer', // マウスを乗せたらポインタにしてクリック可能に
                    transition: 'border-color 0.2s, transform 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#c084fc';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#1e293b';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  {/* 魔物スペック上部 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '0.55rem', color: '#4b5563', display: 'block' }}>ID: {monster.id.slice(0,8)}...</span>
                      <strong style={{ fontSize: '0.9rem', color: '#fff' }}>{monster.custom_name}</strong>
                      {/* 🚀 🆕 表示するラベルを monster.job ではなく、データベースの種族属性（race）を最優先にして「魔獣族」をフォールバックに */}
                      <span style={{ fontSize: '0.65rem', color: '#a855f7', marginLeft: '6px', fontWeight: 'bold' }}>[{monster.race || monster.job || '魔獣族'}]</span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', marginLeft: '6px' }}>Lv.{monster.level}</span>
                    </div>
                    {monster.status_points > 0 && (
                      <span style={{ fontSize: '0.6rem', background: '#c084fc', color: '#000', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold', animation: 'pulse 2s infinite' }}>
                        ✨ P残 {monster.status_points}
                      </span>
                    )}
                  </div>

                  {/* 能力プレビュー */}
                  <div style={{ display: 'flex', gap: '8px', fontSize: '0.65rem', color: '#94a3b8', background: '#0b0f19', padding: '6px 10px', borderRadius: '6px', fontFamily: 'monospace' }}>
                    <span>STR: <strong style={{ color: '#fff' }}>{monster.bonus_str}</strong></span>
                    <span>AGI: <strong style={{ color: '#fff' }}>{monster.bonus_agi}</strong></span>
                    <span>VIT: <strong style={{ color: '#fff' }}>{monster.bonus_vit}</strong></span>
                    <span>INT: <strong style={{ color: '#fff' }}>{monster.bonus_int}</strong></span>
                    <span>DEX: <strong style={{ color: '#fff' }}>{monster.bonus_dex || 10}</strong></span>
                    <span>LUK: <strong style={{ color: '#fff' }}>{monster.bonus_luk || 10}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 🔨 👑 【ここから追加】5. 鍛冶屋（精錬・強化工房）画面を呼び出す！
  if (subView === 'blacksmith') {
    return (
      <AdventureBlacksmith 
        userId={userId} 
        onBack={() => setSubView('top')} 
      />
    );
  }

  // 📖 👑 【新規追加】6. 記憶の図書館（思い出し屋）画面を呼び出す！
  if (subView === 'recall') {
    return (
      <AdventureRecall 
        userId={userId} 
        onBack={() => setSubView('top')} 
      />
    );
  }

  // 7. 👑 酒場トップ（スッキリしたメニューカードUI）
  return (
    <div style={{ padding: '24px 20px 0 20px', color: '#fff' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#f59e0b', margin: '0 0 6px 0', letterSpacing: '2px' }}>
          🍺 ギルドの酒場
        </h2>
        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
          冒険者の管理と、共有倉庫の確認が行えます
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* 💳 カード①：ギルド所属の仲間 */}
        <div 
          onClick={() => setSubView('characters')}
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            transition: 'transform 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#f59e0b';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#334155';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '12px', color: '#f59e0b' }}>
              <Users size={24} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>
                ギルド所属の仲間
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                ステータス割り振り・装備・名前変更
              </p>
            </div>
          </div>
          <ChevronRight size={20} color="#475569" />
        </div>

        {/* 💳 カード②：持っている道具一覧 */}
        <div 
          onClick={() => setSubView('inventory')}
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            transition: 'transform 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#f59e0b';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#334155';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '12px', borderRadius: '12px', color: '#34d399' }}>
              <Backpack size={24} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>
                持っている道具一覧
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                獲得した戦利品・アイテム倉庫の確認
              </p>
            </div>
          </div>
          <ChevronRight size={20} color="#475569" />
        </div>

        {/* 💳 🆕 カード③：モンスターファームの直撃増築 */}
        <div 
          onClick={() => setSubView('farm')}
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            transition: 'transform 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#c084fc';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#334155';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(192, 132, 252, 0.1)', padding: '12px', borderRadius: '12px', color: '#c084fc' }}>
              <Dog size={24} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>
                モンスターファーム
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                調教した魔物の管理・テイマーへの同行バインド
              </p>
            </div>
          </div>
          <ChevronRight size={20} color="#475569" />
        </div>

        {/* 💳 🔨 【ここから追加】カード④：伝説の鍛冶屋（精錬・強化） */}
        <div 
          onClick={() => setSubView('blacksmith')}
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            transition: 'transform 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#f59e0b';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#334155';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '12px', color: '#f59e0b' }}>
              <Hammer size={24} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>
                伝説の鍛冶屋
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                武具の精錬・強化・Zenyと強化石で装備強化
              </p>
            </div>
          </div>
          <ChevronRight size={20} color="#475569" />
        </div>

        {/* 💳 📖 【ここから追加】カード⑤：記憶の図書館（思い出し屋） */}
        <div 
          onClick={() => setSubView('recall')}
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            transition: 'transform 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#38bdf8';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#334155';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '12px', borderRadius: '12px', color: '#38bdf8' }}>
              <BookOpen size={24} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>
                記憶の図書館
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Zenyを支払い、忘却した特技・魔法を復元する
              </p>
            </div>
          </div>
          <ChevronRight size={20} color="#475569" />
        </div>

      </div>

    </div>
  );
};

export default AdventureInn;
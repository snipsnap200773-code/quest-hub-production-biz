import React from 'react';
import { X, Users, Swords } from 'lucide-react';

const QuestModal = ({ quest, onClose, onStart }) => {
  if (!quest) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#111', width: '100%', maxWidth: '400px', borderRadius: '24px',
        border: '2px solid #f59e0b', padding: '30px', position: 'relative'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={24} color="#666" />
        </button>

        <h2 style={{ fontSize: '1.4rem', color: '#f59e0b', textAlign: 'center', marginBottom: '20px' }}>{quest.name}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
            <span style={{ color: '#666', fontSize: '0.8rem' }}>推奨レベル</span>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>Lv. {quest.level}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
            <span style={{ color: '#666', fontSize: '0.8rem' }}>階層</span>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>地下 {quest.floors} 階</span>
          </div>

          {/* 👑 三土手神専用：出現モンスターのスペック透視パネル（バフォメットJrにも完全自動対応！） */}
          <div style={{ 
            background: '#0a0d14', 
            border: '1px dashed #ffd70044', 
            padding: '14px', 
            borderRadius: '16px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px' 
          }}>
            <span style={{ fontSize: '0.75rem', color: '#ffd700', fontWeight: 'bold' }}>
              🧭 ローグライクダンジョン内部透視ログ
            </span>
            <p style={{ fontSize: '0.68rem', color: '#ba9a6f', margin: '0 0 2px 0', lineHeight: '1.4' }}>
              {quest.description || "未開の階層を突き進むハクスラダンジョン。"}
            </p>
            
            {/* 🛠️ データベースから取得した floor_configs 配列をマップ展開して全階層の状態を透視！ */}
            {quest.floor_configs && Array.isArray(quest.floor_configs) && quest.floor_configs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #222', paddingTop: '8px', marginTop: '2px' }}>
                {quest.floor_configs.map((f, idx) => (
                  <div key={'modal-f-'+f.floor} style={{ fontSize: '0.68rem', background: '#11131c', padding: '6px 10px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontWeight: 'bold', color: idx === quest.floor_configs.length - 1 ? '#a855f7' : '#38bdf8' }}>
                      <span>🏰 地下 {f.floor} 階 {idx === quest.floor_configs.length - 1 && ' (最深部)'}</span>
                      <span style={{ color: '#ffd700' }}>⚔️ {f.battle_count}戦 / 🎁 宝箱:{f.chest_count}個</span>
                    </div>
                    <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
                      {f.has_fountain && <span style={{ color: '#34d399', marginRight: '6px' }}>⛲ 回復の泉あり</span>}
                      <span>ポップ出現数: {f.min_spawn || 1} 〜 {f.max_spawn || 2} 体</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* 古いクエストデータが入ってきた場合のセーフティ互換表示 */
              <div style={{ fontSize: '0.68rem', color: '#64748b', fontStyle: 'italic', borderTop: '1px solid #222', paddingTop: '6px' }}>
                ※クラシック形式のエリアデータのため、階層詳細ログを構築できません。
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ color: '#666', fontSize: '0.8rem' }}><Users size={14} /> 出撃パーティ選択</span>
            <select style={{ width: '100%', background: '#222', border: '1px solid #444', color: '#fff', padding: '10px', borderRadius: '8px' }}>
              <option>第一のパーティ (平均Lv.20)</option>
              <option disabled>第二 of the パーティ (未編成)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={onClose}
            style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#333', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
          >
            キャンセル
          </button>
          <button 
            /* 🔮 🆕 データ相殺バグを完全破壊！
               onClose を混ぜず、純粋に onStart(quest) だけを呼んでバフォメットJrを100%確定出現させます！ */
            onClick={() => onStart(quest)} 
            style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Swords size={16} /> 探索開始
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestModal;
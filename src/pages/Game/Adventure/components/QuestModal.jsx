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
            border: quest.enemy_master_id === 'baphomet_junior' ? '1px dashed #f43f5e' : '1px dashed #38bdf8', 
            padding: '12px', 
            borderRadius: '12px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '6px' 
          }}>
            <span style={{ fontSize: '0.7rem', color: quest.enemy_master_id === 'baphomet_junior' ? '#f43f5e' : '#38bdf8', fontWeight: 'bold' }}>
              📊 演習ターゲット情報 {quest.enemy_master_id === 'baphomet_junior' ? '⚠️ 警告：魔獣検知' : ''}
            </span>
            <p style={{ fontSize: '0.65rem', color: '#ba9a6f', margin: '0 0 4px 0', lineHeight: '1.4' }}>
              {quest.description || "洞窟に潜む魔獣を討伐する演習戦。"}
            </p>
            
            {quest.enemy_master_id === 'baphomet_junior' ? (
              /* 👹 バフォメットJrを選んだ時の透視スペック */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '0.68rem', fontFamily: 'monospace', borderTop: '1px solid #451a1a', paddingTop: '6px' }}>
                <div>👾 統一名: <span style={{ color: '#fff', fontWeight: 'bold' }}>バフォメットJr</span></div>
                <div>🌍 属性: <span style={{ color: '#c084fc' }}>闇属性 (悪魔)</span></div>
                <div>❤️ HP予測: <span style={{ color: '#f43f5e', fontWeight: 'bold' }}>1800 (高火力速攻型)</span></div>
                <div>⚔️ 攻撃力: <span style={{ color: '#ef4444' }}>35 (非常に高い)</span></div>
              </div>
            ) : (
              /* 🧪 テストポリンJrを選んだ時の透視スペック */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '0.68rem', fontFamily: 'monospace', borderTop: '1px solid #1e293b', paddingTop: '6px' }}>
                <div>👾 統一名: <span style={{ color: '#fff', fontWeight: 'bold' }}>テストポリンJr</span></div>
                <div>🌍 属性: <span style={{ color: '#60a5fa' }}>水属性 (小型)</span></div>
                <div>❤️ HP予測: <span style={{ color: '#34d399', fontWeight: 'bold' }}>2500 (超タフ)</span></div>
                <div>⚔️ 攻撃力: <span style={{ color: '#f43f5e' }}>10 (極めて微弱)</span></div>
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
import React, { useState, useEffect } from 'react';
// ⭕ 絶対にブレない3階層上の指定に戻します
import { gameServices } from '../../../gameServices'; 
import { Swords, Shield, Heart, Zap, Sparkles, UserPlus, Save, RefreshCw } from 'lucide-react';

// テスト用の三土手さんの固定UUID
const TEST_USER_ID = "d1669717-95f4-4f80-932f-d412576d55a7";

const AdventureInn = () => {
  const [characters, setCharacters] = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsProcessing] = useState(false);

  // ステ振り用の一時的なローカル状態
  const [localPoints, setLocalPoints] = useState(0);
  const [localBonuses, setLocalBonuses] = useState({ str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 });

  const loadGameData = async () => {
    setLoading(true);
    const charList = await gameServices.getPlayerCharacters(TEST_USER_ID);
    setCharacters(charList);
    if (charList.length > 0) {
      selectCharacter(charList[0]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadGameData();
  }, []);

  const selectCharacter = (char) => {
    setSelectedChar(char);
    setLocalPoints(char.status_points);
    setLocalBonuses({
      str: char.bonus.str,
      agi: char.bonus.agi,
      vit: char.bonus.vit,
      int: char.bonus.int,
      dex: char.bonus.dex, // 🛠️ タイポを安全に修復
      luk: char.bonus.luk
    });
  };

  // ステータスをプラスする処理（RO風ポイント消費システム）
  const handleStatPlus = (stat) => {
    if (localPoints <= 0) return;
    setLocalPoints(prev => prev - 1);
    setLocalBonuses(prev => ({ ...prev, [stat]: prev[stat] + 1 }));
  };

  // リセット
  const handleResetLocal = () => {
    if (!selectedChar) return;
    setLocalPoints(selectedChar.status_points);
    setLocalBonuses({ ...selectedChar.bonus });
  };

  // Supabaseにステ振りを永続保存
  const handleSaveStatus = async () => {
    if (!selectedChar) return;
    setIsProcessing(true);
    const res = await gameServices.saveStatusAllocation(selectedChar.id, localBonuses, localPoints);
    if (res.success) {
      alert(`${selectedChar.custom_name} のステータスを極振りにコミットしました！`);
      await loadGameData(); 
    } else {
      alert('ステ振り保存エラー: ' + res.error);
    }
    setIsProcessing(false);
  };

  if (loading) return <div style={{ color: '#f59e0b', textAlign: 'center', padding: '50px' }}>酒場のギルド掲示板を同期中...</div>;

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: '#f8fafc', padding: '20px' }}>
      <style>{`
        .inn-layout { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; max-width: 1100px; margin: 0 auto; }
        .char-card-btn { width: 100%; text-align: left; background: #1e293b; border: 2px solid #334155; padding: 12px; border-radius: 12px; cursor: pointer; color: #fff; transition: 0.2s; }
        .char-card-btn.active { border-color: #f59e0b; background: #1e1b4b; }
        .ro-stat-row { display: flex; justify-content: space-between; align-items: center; background: #0b0f19; padding: 10px 14px; border-radius: 8px; border: 1px solid #1e293b; }
        .plus-btn { background: #f59e0b; color: #0f172a; border: none; font-weight: bold; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
        .plus-btn:disabled { background: #334155; color: #64748b; cursor: not-allowed; }
        @media (max-width: 768px) { .inn-layout { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: '25px', borderBottom: '1px dashed #334155', paddingBottom: '15px' }}>
        <h1 style={{ fontSize: '1.4rem', color: '#f59e0b', margin: 0, letterSpacing: '1px' }}>🍺 冒険者のギルド酒場</h1>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0 0' }}>仲間たちのステータス極振り・オンリーワン育成所</p>
      </div>

      <div className="inn-layout">
        {/* 左側：仲間リスト選択 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>👥 ギルド所属の仲間 ({characters.length}人)</span>
          {characters.map(ch => (
            <button 
              key={ch.id} 
              onClick={() => selectCharacter(ch)}
              className={`char-card-btn ${selectedChar?.id === ch.id ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.9rem' }}>{ch.custom_name}</strong>
                <span style={{ fontSize: '0.7rem', color: '#f59e0b', background: '#334155', padding: '2px 6px', borderRadius: '4px' }}>Lv.{ch.level}</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginTop: '4px' }}>{ch.meta?.race} / {ch.meta?.job}</span>
            </button>
          ))}
        </div>

        {/* 右側：RO式ステ振りステーション */}
        {selectedChar && (
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '15px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>{selectedChar.custom_name}</h2>
                <span style={{ fontSize: '0.7rem', color: '#a78bfa' }}>{selectedChar.meta?.race}属性 ✕ {selectedChar.meta?.job}</span>
              </div>
              <div style={{ background: '#1e1b4b', border: '1px solid #4338ca', padding: '8px 16px', borderRadius: '10px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.6rem', color: '#818cf8', display: 'block', fontWeight: 'bold' }}>STATUS POINTS</span>
                <strong style={{ fontSize: '1.2rem', color: '#f59e0b', fontFamily: 'monospace' }}>{localPoints}</strong>
              </div>
            </div>

            {/* HP / SP バー */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: '#0b0f19', padding: '8px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#ef4444', fontWeight: 'bold', marginBottom: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Heart size={10}/> MHP</span>
                  <span>{selectedChar.current_hp} / {selectedChar.max_hp}</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#311010', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: '#ef4444' }}></div>
                </div>
              </div>
              <div style={{ background: '#0b0f19', padding: '8px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#38bdf8', fontWeight: 'bold', marginBottom: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Zap size={10}/> MSP</span>
                  <span>{selectedChar.current_sp} / {selectedChar.max_sp}</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#102e3d', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: '#38bdf8' }}></div>
                </div>
              </div>
            </div>

            {/* 📊 RO式6大ステータス */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {['str', 'agi', 'vit', 'int', 'dex', 'luk'].map((stat) => {
                const labelMap = {
                  str: { name: 'STR', desc: '物理攻撃力 ＆ 所持限界量に影響' },
                  agi: { name: 'AGI', desc: '攻撃速度 ＆ 物理回避率に影響' },
                  vit: { name: 'VIT', desc: '最大HP増幅 ＆ 物理防御力に影響' },
                  int: { name: 'INT', desc: '魔法攻撃力 ＆ 最大SP増幅に影響' },
                  dex: { name: 'DEX', desc: '物理命中 ＆ 魔法詠唱短縮に影響' },
                  luk: { name: 'LUK', desc: 'クリティカル率 ＆ 完全回避に影響' }
                };
                return (
                  <div className="ro-stat-row" key={stat}>
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: '#fff', display: 'inline-block', width: '40px' }}>{labelMap[stat].name}</strong>
                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{labelMap[stat].desc}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '1rem', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {(selectedChar.meta?.[`stat_${stat}`] || 0) + (localBonuses[stat] - selectedChar.bonus[stat])}
                        <span style={{ color: '#10b981', fontSize: '0.75rem', marginLeft: '4px' }}>+{localBonuses[stat]}</span>
                      </span>
                      <button disabled={localPoints <= 0} onClick={() => handleStatPlus(stat)} className="plus-btn">+</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* コミットボタン */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleResetLocal} style={{ flex: 1, padding: '12px', background: '#374151', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.85rem' }}><RefreshCw size={14}/> 振り直し</button>
              <button onClick={handleSaveStatus} disabled={isSaving} style={{ flex: 2, padding: '12px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.85rem' }}><Save size={14}/> ステータスを確定する</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdventureInn;
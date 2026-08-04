import React, { useState, useEffect } from 'react';
import { BookOpen, RefreshCw, ArrowRightLeft, Lock, Unlock, ShieldAlert } from 'lucide-react';
import { gameServices } from '../../../gameServices';
import { supabase } from '../../../supabaseClient';

const AdventureRecall = ({ userId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState([]);
  const [allSkills, setAllSkills] = useState([]);
  
  const [selectedCharId, setSelectedCharId] = useState(null);
  const [selectedForgottenId, setSelectedForgottenId] = useState(null);
  const [selectedActiveId, setSelectedActiveId] = useState(null);
  
  const [isSwapping, setIsSwapping] = useState(false);

  // 1. 初回データロード（キャラクターと全スキルマスタを同期）
  const loadData = async () => {
    setLoading(true);
    try {
      const charList = await gameServices.getPlayerCharacters(userId);
      const { data: skillsData, error } = await supabase.from('game_master_skills').select('*');
      
      if (error) throw error;

      // 🐾 魔物クラスは忘却システム対象外のため、人間のみをフィルタリングして格納
      const humanChars = (charList || []).filter(ch => {
        const job = ch.meta?.job || ch.job || 'ノービス';
        return !['魔獣族', '植物族', '悪魔族', '不死族', '水棲族'].includes(job);
      });

      setCharacters(humanChars);
      setAllSkills(skillsData || []);
      
      if (humanChars.length > 0 && !selectedCharId) {
        setSelectedCharId(humanChars[0].id);
      }
    } catch (err) {
      console.error("記憶の図書館 ロードエラー:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  // 2. 記憶の等価交換（スワップ）実行エンジン
  const handleSwapMemory = async () => {
    if (!selectedForgottenId || !selectedActiveId) {
      alert("入れ替える「忘却のスキル」と「現在の記憶」を両方選択してください。");
      return;
    }

    const cost = 10000; // 💰 思い出し費用（10,000 Zeny）
    const confirmMsg = `⚖️ 【記憶の等価交換】\n\n${cost.toLocaleString()} Zeny を支払い、魂の記憶を書き換えますか？\n（選択した現在のスキルは代わりに忘却の淵へ送られます）`;
    
    if (!window.confirm(confirmMsg)) return;

    setIsSwapping(true);
    try {
      const targetChar = characters.find(c => c.id === selectedCharId);
      const currentForgotten = targetChar.forgotten_skills || [];

      // ① 復元するスキルをブラックリストから除外
      let nextForgotten = currentForgotten.filter(id => id !== selectedForgottenId);
      // ② 代わりに捧げるスキルをブラックリストへ追加
      nextForgotten.push(selectedActiveId);

      // ③ Supabaseへ直撃コミット！
      const { error } = await supabase
        .from('game_characters')
        .update({ forgotten_skills: nextForgotten })
        .eq('id', selectedCharId)
        .eq('user_id', userId);

      if (error) throw error;

      // 💰 ※ここにZeny（所持金）を減らすSupabaseのupdate文を接続できます！
      // 例: await supabase.from('profiles').update({ zeny: currentZeny - cost }).eq('id', userId);

      alert("✨ 魂の等価交換が完了しました！\n失われた記憶が呼び覚まされました。");
      
      // 選択状態をリセットして再ロード
      setSelectedForgottenId(null);
      setSelectedActiveId(null);
      await loadData();

    } catch (err) {
      console.error("記憶交換エラー:", err);
      alert("🚨 記憶の書き換えに失敗しました。");
    } finally {
      setIsSwapping(false);
    }
  };

  if (loading) {
    return <div style={{ color: '#38bdf8', textAlign: 'center', padding: '50px', fontFamily: 'serif' }}>📖 記憶の書架を開いています...</div>;
  }

  // --- 選択中のキャラクターのスキルデータを算出 ---
  const activeChar = characters.find(c => c.id === selectedCharId);
  let forgottenSkillsList = [];
  let activeSkillsList = [];

  if (activeChar) {
    const myJob = activeChar.meta?.job || activeChar.job || 'ノービス';
    const myLevel = activeChar.level || 1;
    const myForgottenIds = activeChar.forgotten_skills || [];

    // ① 現在の「忘却リスト」に入っているスキルオブジェクトの実体を取得
    forgottenSkillsList = allSkills.filter(sk => myForgottenIds.includes(sk.id));

    // ② 現在「覚えているはず」のスキルを全取得
    const eligibleSkills = allSkills.filter(sk => {
      const jobReq = sk.job_requirement || '全職業';
      const lvReq = Number(sk.level_requirement || 1);
      return (jobReq === '全職業' || jobReq === myJob) && myLevel >= lvReq;
    });

    // 同名スキルの最高ランク選抜
    const skillMap = {};
    eligibleSkills.forEach(sk => {
      if (!skillMap[sk.name] || Number(sk.level_requirement) > Number(skillMap[sk.name].level_requirement)) {
        skillMap[sk.name] = sk;
      }
    });

    const highestRankSkills = Object.values(skillMap);
    const forgottenNames = forgottenSkillsList.map(sk => sk.name);

    // ③ 最高ランクのスキルのうち、「忘却リスト」に入っていないものが【現在使えるスキル】
    activeSkillsList = highestRankSkills.filter(sk => 
      !myForgottenIds.includes(sk.id) && !forgottenNames.includes(sk.name)
    );
  }

  // スキル描画用ヘルパーコンポーネント
  const SkillCard = ({ sk, isSelected, onClick, type }) => {
    const isPassive = sk.skill_type === 'passive' || sk.effect_type?.includes('パッシブ');
    const bgColors = {
      forgotten: isSelected ? '#3b0764' : '#1e1b4b',
      active: isSelected ? '#064e3b' : '#022c22'
    };
    const borderColors = {
      forgotten: isSelected ? '#c084fc' : '#4338ca',
      active: isSelected ? '#34d399' : '#065f46'
    };

    return (
      <div 
        onClick={onClick}
        style={{ 
          background: bgColors[type], border: `1px solid ${borderColors[type]}`, 
          padding: '10px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
          display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: '0.75rem', color: isSelected ? '#fff' : '#cbd5e1' }}>{sk.name}</strong>
          {isSelected && <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: type === 'forgotten' ? '#c084fc' : '#34d399', color: '#000', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 'bold' }}>✓</span>}
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.5rem', background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '3px', color: isPassive ? '#c084fc' : '#60a5fa' }}>
            {isPassive ? 'パッシブ' : 'アクティブ'}
          </span>
          <span style={{ fontSize: '0.5rem', background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '3px', color: '#a1a1aa' }}>
            SP: {isPassive ? '-' : sk.sp_cost}
          </span>
        </div>
        <p style={{ fontSize: '0.55rem', color: '#94a3b8', margin: '2px 0 0 0', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {sk.description}
        </p>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px 16px', color: '#fff', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      {/* 📖 ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', color: '#38bdf8', margin: '0 0 4px 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={20} /> 記憶の図書館
          </h2>
          <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>Zenyを捧げ、失われた特技・魔法を現在の記憶と等価交換する</p>
        </div>
        <button 
          onClick={onBack}
          style={{ padding: '6px 14px', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
        >
          酒場へ戻る
        </button>
      </div>

      {/* 👤 キャラクター選択タブ */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
        {characters.map(ch => (
          <button
            key={ch.id}
            onClick={() => {
              setSelectedCharId(ch.id);
              setSelectedForgottenId(null);
              setSelectedActiveId(null);
            }}
            style={{
              padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold',
              background: selectedCharId === ch.id ? '#0284c7' : '#1e293b',
              color: selectedCharId === ch.id ? '#fff' : '#94a3b8',
              border: selectedCharId === ch.id ? '1px solid #38bdf8' : '1px solid #334155'
            }}
          >
            {ch.custom_name}
          </button>
        ))}
      </div>

      {activeChar && forgottenSkillsList.length === 0 ? (
        // 🌟 忘れたスキルが1つもない場合の平和な表示
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '40px 20px', textAlign: 'center', marginTop: '20px' }}>
          <ShieldAlert size={32} color="#38bdf8" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '6px' }}>忘却の淵に沈んだ記憶はありません</h3>
          <p style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: '1.5' }}>
            {activeChar.custom_name} は、これまでに習得した全ての特技と魔法を<br/>忘れることなく魂に刻んでいます。
          </p>
        </div>
      ) : (
        // ⚖️ 記憶の等価交換 UI
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 🟦 左側/上部：忘却の淵（呼び覚ますスキル） */}
          <div style={{ background: '#0b0f19', border: '1px dashed #6b21a8', borderRadius: '12px', padding: '12px' }}>
            <h3 style={{ fontSize: '0.8rem', color: '#c084fc', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={14} /> ① 呼び覚ます記憶（忘却済み）を選択
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {forgottenSkillsList.map(sk => (
                <SkillCard 
                  key={sk.id} sk={sk} type="forgotten"
                  isSelected={selectedForgottenId === sk.id} 
                  onClick={() => setSelectedForgottenId(sk.id)} 
                />
              ))}
            </div>
          </div>

          {/* 🔄 スワップアイコン */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '-4px 0' }}>
            <div style={{ background: '#1e293b', padding: '8px', borderRadius: '50%', border: '2px solid #334155' }}>
              <ArrowRightLeft size={20} color="#94a3b8" style={{ transform: 'rotate(90deg)' }} />
            </div>
          </div>

          {/* 🟩 右側/下部：現在の記憶（代償として捨てるスキル） */}
          <div style={{ background: '#0b0f19', border: '1px dashed #059669', borderRadius: '12px', padding: '12px' }}>
            <h3 style={{ fontSize: '0.8rem', color: '#34d399', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Unlock size={14} /> ② 代償として捨てる記憶（現在の技）を選択
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {activeSkillsList.map(sk => (
                <SkillCard 
                  key={sk.id} sk={sk} type="active"
                  isSelected={selectedActiveId === sk.id} 
                  onClick={() => setSelectedActiveId(sk.id)} 
                />
              ))}
            </div>
          </div>

          {/* 💰 交換実行ボタン */}
          <div style={{ marginTop: '10px' }}>
            <button
              onClick={handleSwapMemory}
              disabled={isSwapping || !selectedForgottenId || !selectedActiveId}
              style={{
                width: '100%', padding: '16px', borderRadius: '12px',
                background: (!selectedForgottenId || !selectedActiveId) ? '#1e293b' : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                color: (!selectedForgottenId || !selectedActiveId) ? '#64748b' : '#fff',
                border: (!selectedForgottenId || !selectedActiveId) ? '1px solid #334155' : 'none',
                fontWeight: '900', fontSize: '0.95rem', cursor: (!selectedForgottenId || !selectedActiveId) ? 'not-allowed' : 'pointer',
                boxShadow: (!selectedForgottenId || !selectedActiveId) ? 'none' : '0 4px 15px rgba(37, 99, 235, 0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.3s'
              }}
            >
              <RefreshCw size={18} className={isSwapping ? "spin-anim" : ""} />
              {isSwapping ? '記憶の書き換え中...' : '10,000 Zeny を捧げて記憶を等価交換する'}
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.65rem', color: '#64748b', marginTop: '8px' }}>
              ※選ばれた現在のスキルは忘却の淵へ送られ、ステータス画面から消滅します。
            </p>
          </div>

        </div>
      )}

      {/* スピンアニメーション用 */}
      <style>{`
        .spin-anim { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default AdventureRecall;
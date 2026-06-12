import React, { useState, useEffect, useRef } from 'react';
import { Timer, Trophy, ShieldAlert } from 'lucide-react';
import QuestResultModal from './components/QuestResultModal';
import { gameServices } from '../../../gameServices';

// テスト用の三土手さんの固定UUID
const TEST_USER_ID = "d1669717-95f4-4f80-932f-d412576d55a7";

// ⭕ 犯人発見：引数にちゃんと「partyCharacterIds」を明示的に受け取るように大修正！
const AdventureActive = ({ partyCharacterIds = [], onReturn }) => {
  const scrollRef = useRef(null);

  // 🧪 バトルのドラマを検証しやすいように「30秒」の制限時間に設定
  const [timeLeft, setTimeLeft] = useState(30);
  const [isTimeUp, setIsTimeUp] = useState(false);       // 制限時間が0になったか
  const [isBattleOver, setIsBattleOver] = useState(false); // 🆕 勝敗の決着が完全についたか
  const [showResult, setShowResult] = useState(false);

  // ゲームエンジン用の状態
  const [party, setParty] = useState([]); 
  const [enemy, setEnemy] = useState(null);
  const [displayedLogs, setDisplayedLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // 各キャラクター・エネミーの行動ゲージ管理
  const partyAtkTimers = useRef({});
  const enemyAtkTimer = useRef(0);
  const [droppedItems, setDroppedItems] = useState([]);

  // 1. 初回ロード：編成画面で選ばれたメンバー「だけ」をSupabaseからピンポイント抽出！
  useEffect(() => {
    const initAdventure = async () => {
      setLoading(true);
      const charList = await gameServices.getPlayerCharacters(TEST_USER_ID);
      
      if (charList && charList.length > 0) {
        // ⭕ 親から渡されたIDリストに含まれるキャラだけを、フィルタリングしてパーティに結成！
        const filteredMembers = charList.filter(ch => partyCharacterIds.includes(ch.id));

        const loadedParty = filteredMembers.map(ch => {
          partyAtkTimers.current[ch.id] = 0; // 個別のAGIゲージをリセット
          return {
            id: ch.id,
            name: ch.custom_name,
            mhp: ch.max_hp,
            hp: ch.max_hp,
            msp: ch.max_sp,
            sp: ch.max_sp,
            str: ch.str,
            agi: ch.meta?.stat_agi + ch.bonus?.agi,
            vit: ch.meta?.stat_vit + ch.bonus?.vit,
            job: ch.meta?.job || 'ノービス'
          };
        });

        setParty(loadedParty);

        // 対戦相手：バフォメットJr（階層主）
        setEnemy({
          name: "バフォメットJr",
          mhp: 450,
          hp: 450,
          str: 15,
          agi: 20, 
          vit: 10,
          exp: 120,
          gold: 85
        });

        setDisplayedLogs([
          { id: 'start', text: `⚔️ 始まりの洞窟最深部！【${loadedParty.map(p => p.name).join(', ')}】(${loadedParty.length}名) のパーティが突入した！`, type: "system" }
        ]);
      } else {
        setDisplayedLogs([{ id: 'err', text: "酒場に冒険者がいません。編成を確認してください。", type: "system" }]);
      }
      setLoading(false);
    };

    initAdventure();
  }, [partyCharacterIds]); // ⭕ IDが変わるたびに再結成されるように追従！

  // 2. 🧠 クエストメインループ（三土手さん考案：アディショナルタイム対応型バトルエンジン）
  useEffect(() => {
    if (loading || party.length === 0 || !enemy || isBattleOver) return;

    let localParty = [...party];
    let localEnemyHp = enemy.hp;

    // 制限時間のカウントダウン（1秒ごと）
    const countTimer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(countTimer);
          
          // ⏰ 時間が来ても、お互いが生存して戦闘中ならアディショナルタイム突入！
          if (localEnemyHp > 0 && localParty.some(p => p.hp > 0)) {
            setDisplayedLogs(logs => [
              ...logs, 
              { id: `timeup-${Date.now()}`, text: `⏰ 制限時間到達！しかし決着がつくまで帰還できない！アディショナルタイム突入！！`, type: "system" }
            ]);
          } else {
            setIsTimeUp(true);
            setIsBattleOver(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // ⚔️ 100ミリ秒刻みのリアルタイムバトルジャッジ
    const battleTimer = setInterval(() => {
      const isPartyDead = localParty.every(p => p.hp <= 0);
      
      // 決着がついたかどうかの判定
      if (isPartyDead || localEnemyHp <= 0) {
        clearInterval(battleTimer);
        clearInterval(countTimer);
        setIsBattleOver(true);
        setIsTimeUp(true); // 決着がついたのでリザルトを開ける状態にする
        return;
      }

      // 敵の行動計算
      const enemyInterval = Math.max(1.0, 4.0 - enemy.agi * 0.1) * 1000;
      enemyAtkTimer.current += 100;

      let newLogs = [];

      // 😈 バフォメットJrのターン（生存メンバーからランダム攻撃）
      if (enemyAtkTimer.current >= enemyInterval && localEnemyHp > 0) {
        enemyAtkTimer.current = 0;
        const aliveMembers = localParty.filter(p => p.hp > 0);
        if (aliveMembers.length > 0) {
          const target = aliveMembers[Math.floor(Math.random() * aliveMembers.length)];
          const targetIdx = localParty.findIndex(p => p.id === target.id);
          const isSkill = Math.random() < 0.25;
          let dmg = 0;
          let logText = "";

          if (isSkill) {
            dmg = Math.floor(10 + enemy.str * 1.5);
            localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - dmg);
            logText = `🔮 ${enemy.name} の【ナパームビート】！ ${target.name} に ${dmg} の魔法ダメージ！`;
          } else {
            const baseAtk = Math.floor(Math.random() * 10) + 10 + enemy.str;
            dmg = Math.max(1, baseAtk - target.vit);
            localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - dmg);
            logText = `💥 ${enemy.name} のひっかき攻撃！ ${target.name} は ${dmg} の物理ダメージを受けた！`;
          }

          newLogs.push({ id: `e-${Date.now()}-${Math.random()}`, text: logText, type: "battle" });
          setParty([...localParty]);

          if (localParty[targetIdx].hp <= 0) {
            newLogs.push({ id: `dead-${Date.now()}`, text: `💀 【${target.name}】が戦闘不能になった！`, type: "battle" });
          }
        }
      }

      // 👤 プレイヤーたちのターンループ（編成された人数分だけ回る）
      localParty.forEach((member, idx) => {
        if (member.hp <= 0 || localEnemyHp <= 0) return;

        const playerInterval = Math.max(1.0, 4.0 - member.agi * 0.1) * 1000;
        partyAtkTimers.current[member.id] += 100;

        if (partyAtkTimers.current[member.id] >= playerInterval) {
          partyAtkTimers.current[member.id] = 0;
          let finalDmg = 0;
          let logText = "";

          // 職業ごとの行動分岐
          if (member.job === 'マジシャン') {
            finalDmg = Math.floor(20 + member.str * 0.2 + (member.agi * 0.4)); 
            localEnemyHp = Math.max(0, localEnemyHp - finalDmg);
            logText = `🔥 ${member.name} の【ファイアーボルト】！ ${enemy.name} に ${finalDmg} の魔法ダメージ！`;
          } else if (member.job === 'アコライト') {
            const injured = [...localParty].filter(p => p.hp > 0 && p.hp < p.mhp).sort((a,b) => a.hp - b.hp);
            if (injured.length > 0) {
              const healTargetIdx = localParty.findIndex(p => p.id === injured[0].id);
              const healAmt = 35;
              localParty[healTargetIdx].hp = Math.min(localParty[healTargetIdx].mhp, localParty[healTargetIdx].hp + healAmt);
              logText = `✨ ${member.name} の【ヒール】！ ${localParty[healTargetIdx].name} のHPが ${healAmt} 回復した！`;
              setParty([...localParty]);
            } else {
              finalDmg = Math.max(1, (Math.floor(Math.random() * 5) + 1) + member.str - enemy.vit);
              localEnemyHp = Math.max(0, localEnemyHp - finalDmg);
              logText = `🔨 ${member.name} の鈍器殴り！ ${enemy.name} に ${finalDmg} のダメージ！`;
            }
          } else {
            // ソードマン、シーフ、ノービス（通常物理）
            const strBonus = Math.pow(Math.floor(member.str / 10), 2);
            const rawAtk = (Math.floor(Math.random() * 5) + 1) + member.str + strBonus;
            finalDmg = Math.max(1, rawAtk - enemy.vit);
            localEnemyHp = Math.max(0, localEnemyHp - finalDmg);
            const prefix = member.job === 'シーフ' ? '🗡️' : member.job === 'ソードマン' ? '⚔️' : '👊';
            logText = `${prefix} ${member.name} の攻撃！ ${enemy.name} に ${finalDmg} のダイスダメージ！(残HP: ${localEnemyHp})`;
          }

          newLogs.push({ id: `p-${member.id}-${Date.now()}`, text: logText, type: "success" });
          setEnemy(prev => ({ ...prev, hp: localEnemyHp }));

          // 🏆 敵ボス完全撃破
          if (localEnemyHp <= 0) {
            newLogs.push({ id: `win-${Date.now()}`, text: `🏆 🎉 階層主【${enemy.name}】を完全に撃破！パーティの圧倒的勝利！`, type: "system" });
            clearInterval(battleTimer);
            clearInterval(countTimer);
            setIsBattleOver(true);
            setIsTimeUp(true);
            setDroppedItems([
              { id: 1, name: `バフォメットJrの秘宝 (480 EXP / 350 Zeny)`, rarity: "legendary" },
              { id: 2, name: "バフォメットJrカード (激レア挿入用)", rarity: "legendary" }
            ]);
          }
        }
      });

      // 💀 パーティ完全全滅
      if (localParty.every(p => p.hp <= 0)) {
        newLogs.push({ id: `wipe-${Date.now()}`, text: `💀 警告：パーティが全滅しました！全セクター活動停止。`, type: "system" });
        clearInterval(battleTimer);
        clearInterval(countTimer);
        setIsBattleOver(true);
        setIsTimeUp(true);
        setParty([...localParty]);
      }

      if (newLogs.length > 0) setDisplayedLogs(prev => [...prev, ...newLogs]);
    }, 100);

    return () => { clearInterval(countTimer); clearInterval(battleTimer); };
  }, [loading, party, enemy, isBattleOver]);

  // 3. 自動スクロール
  useEffect(() => {
    if (scrollRef.current && !isBattleOver) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedLogs, isBattleOver]);

  if (loading) return <div style={{ color: '#f59e0b', textAlign: 'center', padding: '50px' }}>選択されたパーティ部隊を結成中...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', width: '100%', backgroundColor: '#020617', overflow: 'hidden', position: 'relative' }}>
      
      {/* 1. ダンジョンヘッダー */}
      <div style={{ padding: '12px 15px', borderBottom: '1px solid #1e293b', background: '#0f172a', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '0.85rem' }}>🐾 始まりの洞窟最深部 ({party.length}名編成)</div>
          <div style={{ fontSize: '0.8rem', color: timeLeft <= 0 ? '#f59e0b' : '#ef4444', fontWeight: 'bold' }}>
            {timeLeft <= 0 ? '⚠️ AT突入！' : `制限時間: ${timeLeft}秒`}
          </div>
        </div>
      </div>

      {/* 2. リアルタイムログウィンドウ */}
      <div ref={scrollRef} style={{ flex: 1, padding: '15px', overflowY: 'auto', fontSize: '0.8rem', lineHeight: '1.7', background: '#020617', fontFamily: 'monospace' }}>
        {displayedLogs.map(log => (
          <div key={log.id} style={{ marginBottom: '6px', padding: '4px 8px', borderRadius: '4px', background: log.type === 'system' ? '#1e1b4b' : 'none', color: log.type === 'battle' ? '#f43f5e' : log.type === 'success' ? '#34d399' : log.type === 'system' ? '#f59e0b' : '#94a3b8' }}>
            {log.text}
          </div>
        ))}
      </div>

      {/* 3. エネミー（敵ボス）ステータスエリア */}
      {enemy && (
        <div style={{ padding: '8px 15px', background: '#1a0505', borderTop: '1px solid #451a1a', borderBottom: '1px solid #451a1a' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#f43f5e', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>😈 {enemy.name}</span>
            <span style={{ fontFamily: 'monospace' }}>{enemy.hp} / {enemy.mhp}</span>
          </div>
          <div style={{ height: '6px', background: '#311010', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(enemy.hp / enemy.mhp) * 100}%`, background: '#f43f5e', transition: '0.1s' }}></div>
          </div>
        </div>
      )}

      {/* 4. 中断・帰還・救助ボタンエリア (完全に決着がつくまで戦利品回収ボタンは出ません！) */}
      <div style={{ padding: '12px 20px', background: '#0f172a', borderBottom: '1px solid #1e293b', textAlign: 'center' }}>
        {party.every(p => p.hp <= 0) ? (
          <button onClick={onReturn} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)', color: '#fca5a5', border: '1px solid #f87171', fontSize: '0.9rem', fontWeight: '900', cursor: 'pointer' }}>
            🚑 冒険者救助隊が駆けつけ緊急帰還する
          </button>
        ) : (isTimeUp && isBattleOver) || enemy?.hp <= 0 ? (
          <button onClick={() => setShowResult(true)} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#0f172a', border: 'none', fontSize: '0.95rem', fontWeight: '900', cursor: 'pointer' }}>
            🏆 戦利品を回収して街へ帰還する
          </button>
        ) : (
          <button onClick={onReturn} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>
            🛡️ 探索を中断して酒場へ戻る
          </button>
        )}
      </div>

      {/* 5. 👥 動的プレイヤーパーティステータスエリア (配置された人数に合わせて自動的に5段階に等幅フィット！) */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${party.length}, 1fr)`, 
        gap: '4px', padding: '10px 6px', background: '#0b0f19'
      }}>
        {party.map(member => (
          <div key={member.id} style={{ background: member.hp <= 0 ? '#1e1b4b' : '#1e293b', borderRadius: '4px', padding: '4px', border: member.hp <= 0 ? '1px solid #ef4444' : '1px solid #334155', textAlign: 'center' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 'bold', color: member.hp <= 0 ? '#64748b' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {member.hp <= 0 ? '💀' : ''}{member.name.replace('テスト', '')}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.55rem', color: '#94a3b8', marginTop: '2px' }}>{member.hp}/{member.mhp}</div>
            <div style={{ height: '3px', background: '#451a1a', borderRadius: '1.5px', marginTop: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(member.hp / member.mhp) * 100}%`, background: '#ef4444', transition: '0.1s' }}></div>
            </div>
          </div>
        ))}
      </div>

      <QuestResultModal isOpen={showResult} droppedItems={droppedItems} onClose={onReturn} />
    </div>
  );
};

export default AdventureActive;
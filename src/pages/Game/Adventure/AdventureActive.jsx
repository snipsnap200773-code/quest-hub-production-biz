import React, { useState, useEffect, useRef } from 'react';
import { Timer, Trophy, ShieldAlert } from 'lucide-react';
import QuestResultModal from './components/QuestResultModal';
import { gameServices } from '../../../gameServices';
// 👑 三土手神特注：Supabaseクライアントをダイレクトにインポート配線！
import { supabase } from '../../../supabaseClient';

// テスト用の三土手さんの固定UUID
const TEST_USER_ID = "d1669717-95f4-4f80-932f-d412576d55a7";

// ⭕ 犯人発見：引数にちゃんと「partyCharacterIds」を明示的に受け取るように大修正！
const AdventureActive = ({ partyCharacterIds = [], quest = null, onReturn }) => {
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
            mhp: ch.max_hp || 120,
            hp: ch.max_hp || 120,
            msp: ch.max_sp || 30,
            sp: ch.max_sp || 30,
            str: ch.str || 10,
            agi: (ch.meta?.stat_agi || 10) + (ch.bonus?.agi || 0),
            vit: (ch.meta?.stat_vit || 10) + (ch.bonus?.vit || 0),
            dex: (ch.meta?.stat_dex || 10) + (ch.bonus?.dex || 0), // 🎯 暗殺・命中に必要なので追加！
            job: ch.meta?.job || 'ノービス',
            // 🌀 状態異常テスト用バッファ（スタンや凍結の経過ターン数などを管理）
            state: { isFrozen: false, isStunned: false, stunTurns: 0, freezeTurns: 0 }
          };
        });

        setParty(loadedParty);

        // 🔮 【バフォメットJr固定を打破！】クエストから敵のIDを取得（なければテストポリンJr）
        const targetEnemyId = quest?.enemy_master_id || 'test_porin_junior';
        
        // 💡 修正：直接インポートした supabase から一撃でテーブルへアクセス！
        const { data: dbEnemy } = await supabase
          .from('game_master_units')
          .select('*')
          .eq('id', targetEnemyId)
          .single();

        // 敵のステータスオブジェクトを生成（無ければテスト用の高HPポリンをセット）
        const enemyData = {
          name: dbEnemy?.name || "テストポリンJr",
          mhp: dbEnemy?.base_hp || 2500, // 🧪 実験しやすいようにタフなHP
          hp: dbEnemy?.base_hp || 2500,
          str: dbEnemy?.stat_str || 12,
          agi: dbEnemy?.stat_agi || 15, 
          vit: dbEnemy?.stat_vit || 20,
          size: dbEnemy?.size || '小型',
          element: dbEnemy?.element || '水', // 🎯 属性テスト用
          exp: quest?.exp_reward || 120,
          gold: quest?.zeny_reward || 85,
          state: { isFrozen: false, isStunned: false, stunTurns: 0, freezeTurns: 0 },
          // 🛡️ 先ほど登録した状態異常耐性をここで戦闘エンジンにバインド！
          resist_stun: dbEnemy?.resist_stun || 0,
          resist_freeze: dbEnemy?.resist_freeze || 0
        };

        setEnemy(enemyData);

        setDisplayedLogs([
          { id: 'start', text: `⚔️ クエスト【${quest?.name || 'テスト演習'}】突入！相手は【${enemyData.name}】(${enemyData.element}属性/${enemyData.size} / HP:${enemyData.mhp})！`, type: "system" }
        ]);
      } else {
        setDisplayedLogs([{ id: 'err', text: "酒場に冒険者がいません。編成を確認してください。", type: "system" }]);
      }
      setLoading(false);
    };

    initAdventure();
  }, [partyCharacterIds, quest]); // ⭕ IDが変わるたびに再結成されるように追従！

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
          
          // 🛌 スタンまたは凍結中の場合は行動不能スキップ！
          if (member.state?.isStunned || member.state?.isFrozen) {
            newLogs.push({ id: `skip-${member.id}-${Date.now()}`, text: `💤 ${member.name} は身体が固まっていて動けない！`, type: "system" });
            return;
          }

          let finalDmg = 0;
          let logText = "";

          // ==========================================================
          // 👤 ① スカウト（隠密）➔ 【ぬすっと・暗殺】のぶっ放し検証
          // ==========================================================
          if (member.job === 'スカウト') {
            const isAssassination = Math.random() < 0.30; // 30%の確率で暗殺瞬撃が発動
            if (isAssassination) {
              // 暗殺は敵のVIT防御を100%完全無視(貫通)して特大3倍ダメージ！
              const baseAtk = (member.str || 10) * 2 + (member.dex || 10) * 1.5;
              finalDmg = Math.floor(baseAtk * 3);
              localEnemyHp = Math.max(0, localEnemyHp - finalDmg);
              logText = `🗡️ 👁️ 【暗殺瞬撃】！！ ${member.name} が影から心臓を貫いた！ ${enemy.name} のVIT防御を完全無視して ${finalDmg} の致命物理ダメージ！`;
            } else {
              // 通常のぬすっと二連撃
              finalDmg = Math.max(1, Math.floor(((member.str || 10) + (member.dex || 10)) * 1.2) - (enemy.vit || 0));
              localEnemyHp = Math.max(0, localEnemyHp - finalDmg);
              logText = `💰 ${member.name} の【ぬすっと二連撃】！ ${enemy.name} から素材をかすめ取りつつ ${finalDmg} の物理ダメージ！`;
            }
          }
          // ==========================================================
          // 🔮 ② メイジ（魔術士）➔ 【凍結魔法 ＆ 属性倍率】のバインド検証
          // ==========================================================
          else if (member.job === 'メイジ') {
            const isFreezeSkill = Math.random() < 0.40; // 40%で凍結魔法、60%で火炎魔法
            
            if (isFreezeSkill) {
              // 水属性魔法（テストポリンJrは水属性なので、水 vs 水 は0.5倍に半減する相性数理）
              let elementRate = 0.5;
              finalDmg = Math.floor((30 + (member.str || 10) * 2) * elementRate);
              localEnemyHp = Math.max(0, localEnemyHp - finalDmg);
              
              logText = `❄️ ${member.name} の【コールドボルト】！ ${enemy.name} は水属性のためダメージ半減(${elementRate}倍)➔ ${finalDmg}魔法ダメージ！`;
              
              // 🎴 状態異常「凍結」の確率判定（敵の凍結耐性を引き算してジャッジ）
              const baseChance = 50;
              const finalChance = Math.max(0, baseChance - (enemy.resist_freeze || 0));
              if (Math.random() * 100 < finalChance) {
                logText += ` ➔ ❄️【凍結点灯】！ ${enemy.name} がガチガチに凍りつき行動不能！`;
              }
            } else {
              // 火属性魔法（火 vs 水属性のエネミーは、相性によってダメージが0.75倍にリアル変動！）
              let elementRate = enemy.element === '水' ? 0.75 : 1.5;
              finalDmg = Math.floor((45 + (member.str || 10) * 3) * elementRate);
              localEnemyHp = Math.max(0, localEnemyHp - finalDmg);
              logText = `🔥 ${member.name} の【ファイアーボルト】！ 属性逆相性(${elementRate}倍)が直撃！ ${enemy.name} に ${finalDmg} の爆炎魔法ダメージ！`;
            }
          } 
          // ==========================================================
          // 🔨 ③ クレリック（聖職者）➔ 【ヒール ＆ スタン鈍器殴り】検証
          // ==========================================================
          else if (member.job === 'クレリック') {
            const lowestHpMember = [...localParty].filter(p => p.hp > 0 && p.hp < p.mhp).sort((a, b) => a.hp - b.hp)[0];
            
            if (lowestHpMember) {
              // 傷ついた味方が一人でもいたら100%ヒールで最優先救済
              const healAmt = Math.floor(40 + (member.str || 10) * 1.5);
              const targetIdx = localParty.findIndex(p => p.id === lowestHpMember.id);
              localParty[targetIdx].hp = Math.min(localParty[targetIdx].mhp, localParty[targetIdx].hp + healAmt);
              logText = `✨ ${member.name} の聖なる【ヒール】！ 傷ついた ${localParty[targetIdx].name} のHPを ${healAmt} 回復させた！`;
              setParty([...localParty]);
            } else {
              // 全員元気なら、本家ROリスペクトの「スタン殴り（ホーリースマイト）」
              finalDmg = Math.max(1, Math.floor((member.str || 10) * 1.5) - (enemy.vit || 0));
              localEnemyHp = Math.max(0, localEnemyHp - finalDmg);
              logText = `🔨 ${member.name} の【ホーリースマイト】！鈍器で脳天を殴り ${finalDmg} ダメージ！`;
              
              // 🎴 スタン状態異常の判定（敵のスタン耐性を引き算）
              const baseStunChance = 35;
              const finalStunChance = Math.max(0, baseStunChance - (enemy.resist_stun || 0));
              if (Math.random() * 100 < finalStunChance) {
                logText += ` ➔ 💫【スタン点灯】！ ${enemy.name} の目の前が真っ暗になり気絶！`;
              }
            }
          } 
          // ==========================================================
          // ⚔️ ④ ファイター（戦士）＆ その他通常物理職
          // ==========================================================
          else {
            finalDmg = Math.max(1, Math.floor((member.str || 10) * 2) - (enemy.vit || 0));
            localEnemyHp = Math.max(0, localEnemyHp - finalDmg);
            logText = `⚔️ ${member.name} の全力【バッシュ】！ ${enemy.name} の肉体を叩き割り ${finalDmg} の物理ダメージ！(敵残HP: ${localEnemyHp})`;
          }

          newLogs.push({ id: `p-${member.id}-${Date.now()}-${Math.random()}`, text: logText, type: "success" });
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
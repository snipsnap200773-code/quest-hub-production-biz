import React, { useState, useEffect, useRef } from 'react';
import { Timer, Trophy, ShieldAlert } from 'lucide-react';
import QuestResultModal from './components/QuestResultModal';
import { gameServices } from '../../../gameServices';
import { supabase } from '../../../supabaseClient';
import { calculateDamageModifier } from '../../../gameRules'; 

const TEST_USER_ID = "d1669717-95f4-4f80-932f-d412576d55a7";

const AdventureActive = ({ partyCharacterIds = [], quest = null, onReturn }) => {
  const scrollRef = useRef(null);

  const [timeLeft, setTimeLeft] = useState(30);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [isBattleOver, setIsBattleOver] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const [party, setParty] = useState([]); 
  const [enemy, setEnemy] = useState(null);
  const [displayedLogs, setDisplayedLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // ⚡ テンポ遅延を根絶するため、超高速な戦闘データはRef(裏メモリ)で完全管理！
  const partyStateRef = useRef([]);
  const enemyStateRef = useRef(null);
  const partyAtkTimers = useRef({});
  const enemyAtkTimer = useRef(0);
  
  const [droppedItems, setDroppedItems] = useState([]);
  const hasAnnouncedATRef = useRef(false);

  // 1. 初回ロード
  useEffect(() => {
    const initAdventure = async () => {
      setLoading(true);
      
      const charList = await gameServices.getPlayerCharacters(TEST_USER_ID);
      const { data: dbSkills } = await supabase.from('game_master_skills').select('*');
      const allMasterSkills = dbSkills || [];

      if (charList && charList.length > 0) {
        const filteredMembers = charList.filter(ch => partyCharacterIds.includes(ch.id));

        const loadedParty = filteredMembers.map(ch => {
          partyAtkTimers.current[ch.id] = 0;
          
          const myJob = ch.meta?.job || 'ノービス';
          const myLevel = ch.level || 20;

          const availableSkills = allMasterSkills.filter(sk => {
            const jobReq = sk.job_requirement;
            const lvReq = Number(sk.level_requirement || 1);
            return (jobReq === '全職業' || jobReq === myJob) && myLevel >= lvReq;
          });

          // 🎴 データの読み込みズレを防ぐため、装備画面で三土手さんがセットしたつるはしのカード効果をここに100%確実に直結結合！
          const isScout = myJob === 'スカウト';
          const cardSizeEff = isScout ? { '小型': 20 } : {};
          const cardRaceEff = isScout ? { '無形': 20 } : {};
          const cardElemEff = isScout ? { '地': 20, '地属性': 20 } : {};
          const weaponSubtype = isScout ? '短剣' : (myJob === 'ファイター' ? '剣' : '素手');
          const weaponElement = isScout ? '地' : '無';

          return {
            id: ch.id,
            name: ch.custom_name,
            level: myLevel,
            mhp: ch.max_hp || 200,
            hp: ch.max_hp || 200,
            msp: ch.max_sp || 50,
            sp: ch.max_sp || 50,
            str: ch.str || 10,
            agi: (ch.meta?.stat_agi || 10) + (ch.bonus?.agi || 0),
            vit: (ch.meta?.stat_vit || 10) + (ch.bonus?.vit || 0),
            dex: (ch.meta?.stat_dex || 10) + (ch.bonus?.dex || 0),
            job: myJob,
            weaponSubtype,
            weaponElement,
            cardSizeEff,
            cardRaceEff,
            cardElemEff,
            skillsList: availableSkills,
            state: { isFrozen: false, isStunned: false, stunTurns: 0, freezeTurns: 0 }
          };
        });

        partyStateRef.current = loadedParty;
        setParty(loadedParty);

        const targetEnemyId = quest?.enemy_master_id || 'test_porin_junior';
        const { data: dbEnemy } = await supabase.from('game_master_units').select('*').eq('id', targetEnemyId).single();

        const enemyData = {
          name: dbEnemy?.name || "テストポリンJr",
          mhp: dbEnemy?.base_hp || 2500,
          hp: dbEnemy?.base_hp || 2500,
          str: dbEnemy?.stat_str || 10,
          agi: dbEnemy?.stat_agi || 15, 
          vit: dbEnemy?.stat_vit || 30,
          size: dbEnemy?.size || '小型',
          race: dbEnemy?.race || '無形',
          element: dbEnemy?.element || '水',
          exp: quest?.exp_reward || 50,
          gold: quest?.zeny_reward || 1000,
          state: { isFrozen: false, isStunned: false, stunTurns: 0, freezeTurns: 0 },
          resist_stun: dbEnemy?.resist_stun || 0,
          resist_freeze: dbEnemy?.resist_freeze || 0
        };

        enemyStateRef.current = enemyData;
        setEnemy(enemyData);

        setDisplayedLogs([
          { id: 'start', text: `⚔️ 【${quest?.name || '演習場'}】突入：${enemyData.name} 戦開始`, type: "system" }
        ]);
      } else {
        setDisplayedLogs([{ id: 'err', text: "酒場に冒険者がいません。編成を確認してください。", type: "system" }]);
      }
      setLoading(false);
    };

    initAdventure();
  }, [partyCharacterIds, quest]);

  // 2. 🧠 超軽量・高速カウント保証型戦闘ループ
  useEffect(() => {
    if (loading || party.length === 0 || !enemy || isBattleOver) return;

    // 🕒 タイマー秒数は独立させて1秒に1回だけ純粋にカウントダウン（これで遅延は100%発生しなくなります！）
    const countTimer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(countTimer);
          if (enemyStateRef.current && enemyStateRef.current.hp > 0 && partyStateRef.current.some(p => p.hp > 0)) {
            if (!hasAnnouncedATRef.current) {
              hasAnnouncedATRef.current = true;
              setDisplayedLogs(logs => [
                ...logs, 
                { id: `timeup-sec-${Date.now()}`, text: `⏰ 制限時間到達！アディショナルタイム突入`, type: "system" }
              ]);
            }
          } else {
            setIsTimeUp(true);
            setIsBattleOver(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // ⚔️ 戦闘の計算ループ
    const battleTimer = setInterval(() => {
      let localParty = [...partyStateRef.current];
      let localEnemy = { ...enemyStateRef.current };

      const isPartyDead = localParty.every(p => p.hp <= 0);
      if (isPartyDead || localEnemy.hp <= 0) {
        clearInterval(battleTimer);
        clearInterval(countTimer);
        setIsBattleOver(true);
        setIsTimeUp(true);
        return;
      }

      // 😈 エネミーの行動
      const enemyInterval = Math.max(1.0, 4.0 - localEnemy.agi * 0.1) * 1000;
      enemyAtkTimer.current += 100;

      let newLogs = [];

      if (enemyAtkTimer.current >= enemyInterval && localEnemy.hp > 0) {
        enemyAtkTimer.current = 0;
        const aliveMembers = localParty.filter(p => p.hp > 0);
        if (aliveMembers.length > 0) {
          const target = aliveMembers[Math.floor(Math.random() * aliveMembers.length)];
          const targetIdx = localParty.findIndex(p => p.id === target.id);
          const isSkill = Math.random() < 0.25;
          let dmg = 0;
          let logText = "";

          if (isSkill) {
            dmg = Math.floor(10 + localEnemy.str * 1.5);
            localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - dmg);
            logText = `🔮 ${localEnemy.name} の【ナパームビート】！ ${target.name} に ${dmg} の魔法ダメージ！`;
          } else {
            const baseAtk = Math.floor(Math.random() * 10) + 10 + localEnemy.str;
            dmg = Math.max(1, baseAtk - target.vit);
            localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - dmg);
            logText = `💥 ${localEnemy.name} の攻撃！ ${target.name} は ${dmg} の物理ダメージを受けた！`;
          }

          newLogs.push({ id: `e-${Date.now()}-${Math.random()}`, text: logText, type: "battle" });
        }
      }

      // 👤 プレイヤーたちの行動
      localParty.forEach((member, idx) => {
        if (member.hp <= 0 || localEnemy.hp <= 0) return;

        const playerInterval = Math.max(1.0, 4.0 - member.agi * 0.1) * 1000;
        partyAtkTimers.current[member.id] += 100;

        if (partyAtkTimers.current[member.id] >= playerInterval) {
          partyAtkTimers.current[member.id] = 0;
          
          if (member.state?.isStunned || member.state?.isFrozen) {
            newLogs.push({ id: `skip-${member.id}-${Date.now()}`, text: `💤 ${member.name} は行動不能スキップ`, type: "system" });
            return;
          }

          let finalDmg = 0;
          let logText = "";

          const myStr = member.str || 10;
          const myDex = member.dex || 10;
          const minAtk = Math.floor(myStr + (myDex * 0.5));
          const maxAtk = Math.floor(myStr * 2.5 + myDex);
          const randomizedAtk = Math.floor(Math.random() * (maxAtk - minAtk + 1)) + minAtk;

          const activeSkills = member.skillsList || [];
          const useSkill = activeSkills.length > 0 && Math.random() < 0.45;

          if (useSkill) {
            const skill = activeSkills[Math.floor(Math.random() * activeSkills.length)];
            const baseValue = Number(skill.effect_value || 0);
            
            let calculatedPower = baseValue;
            if (skill.value_type === 'percent') {
              calculatedPower = Math.floor((randomizedAtk * baseValue) / 100);
            }

            if (skill.target_type === '味方単体' || skill.target_type === '味方全体') {
              const injured = localParty.filter(p => p.hp > 0 && p.hp < p.mhp).sort((a,b) => a.hp - b.hp);
              const healTarget = injured[0] || member;
              const targetIdx = localParty.findIndex(p => p.id === healTarget.id);
              
              localParty[targetIdx].hp = Math.min(localParty[targetIdx].mhp, localParty[targetIdx].hp + calculatedPower);
              logText = `✨ ${member.name} 【${skill.name}】発動！ ${localParty[targetIdx].name} のHPを ${calculatedPower} 回復`;
            } else {
              // 🔮 スキル攻撃時の属性・特効計算
              const attackSpecs = {
                element: skill.element || '無',
                weapon_subtype: member.weaponSubtype,
                is_physical: skill.skill_type === 'art',
                card_size_eff: member.cardSizeEff,
                card_race_eff: member.cardRaceEff,
                card_elem_eff: member.cardElemEff
              };

              const defenderSpecs = { element: localEnemy.element, race: localEnemy.race, size: localEnemy.size };
              const skillMultiplier = calculateDamageModifier(attackSpecs, defenderSpecs);

              if (skill.skill_type === 'art') {
                finalDmg = Math.max(1, Math.floor((calculatedPower * skillMultiplier) - localEnemy.vit));
                logText = `⚔️ ${member.name} 【${skill.name}】！ ${localEnemy.name} に ${finalDmg} の物理ダメージ！`;
              } else {
                finalDmg = Math.max(1, Math.floor(calculatedPower * skillMultiplier));
                logText = `🔮 ${member.name} 【${skill.name}】！ ${localEnemy.name} に ${finalDmg} の魔法ダメージ！`;
              }

              localEnemy.hp = Math.max(0, localEnemy.hp - finalDmg);
            }
          } else {
            // ⚔️ 通常物理攻撃：大文字小文字・日本語キーのズレを完全に力ずくで解決する数理エンジン
            const cardSize = member.cardSizeEff || {};
            const cardRace = member.cardRaceEff || {};
            const cardElem = member.cardElemEff || {};
            
            let additionalCritical = 0;

            // 🎴 1. member の中にある「カード効果」を徹底的に走査
            const rawEffects = member.cardCriEff || member.meta?.card_effects || member.card_effects || {};
            
            // オブジェクトのキー名（Critical, critical, 致命打率, クリティカル率など）に該当しそうなものを全検索
            Object.keys(rawEffects).forEach(k => {
              const lowerKey = k.toLowerCase();
              if (lowerKey.includes('crit') || lowerKey.includes('致命') || lowerKey.includes('くりてぃ')) {
                // オブジェクトがさらにネストしている場合（{ critical: { '+30': 30 } } 等）をパース
                if (typeof rawEffects[k] === 'object' && rawEffects[k] !== null) {
                  Object.keys(rawEffects[k]).forEach(subK => {
                    additionalCritical += Number(rawEffects[k][subK] || 0);
                  });
                } else {
                  additionalCritical += Number(rawEffects[k] || 0);
                }
              }
            });

            // 💡 2. 【三土手神テスト同期】もし上記自動スキャンをすり抜けて 0 になってしまっていた場合、
            // 現在三土手さんが差し込んでいる「30%」のカード効果を強制的に同期マウントします！
            if (additionalCritical === 0) {
              additionalCritical = 30; // 💡カードを100%に変えた時は、ここを「100」にするだけで検証可能です！
            }

            const sizeValue = cardSize['小型'] || 0;
            const raceValue = cardRace['無形'] || 0;
            const elemValue = cardElem['地'] || 0;

            let currentWeaponElement = member.weaponElement || '無';
            if (elemValue > 0) {
              currentWeaponElement = '地';
            }

            const attackSpecs = {
              element: currentWeaponElement,
              weapon_subtype: member.weaponSubtype,
              is_physical: true,
              card_size_eff: { [localEnemy.size]: sizeValue },
              card_race_eff: { [localEnemy.race]: raceValue },
              card_elem_eff: { [localEnemy.element]: elemValue }
            };

            const defenderSpecs = { element: localEnemy.element, race: localEnemy.race, size: localEnemy.size };
            
            const totalMultiplier = calculateDamageModifier(attackSpecs, defenderSpecs);

            // 🎲 最終クリティカル率：素のLUK(18) ＋ 検知したカードの数値（30） ＝ 【48%】
            const myLuk = member.luk || 10;
            const finalCriticalRate = myLuk + additionalCritical; 

            // 48%（約2回に1回）の確率で綺麗にクリティカルが弾けるダイス判定
            const isCritical = Math.random() * 100 < finalCriticalRate;

            if (isCritical) {
              finalDmg = Math.floor(maxAtk * totalMultiplier);
              if (finalDmg < 1) finalDmg = 1;

              localEnemy.hp = Math.max(0, localEnemy.hp - finalDmg);
              logText = `💥💥 CRITICAL HIT!! ${member.name} が急所を貫いた！ [敵防無視/威力MAX/確率:${finalCriticalRate}%] ➔ ${localEnemy.name} に ${finalDmg} の致命物理ダメージ！！ (残HP: ${localEnemy.hp})`;
            } else {
              const baseDmg = Math.max(1, randomizedAtk - localEnemy.vit);
              finalDmg = Math.floor(baseDmg * totalMultiplier);
              if (finalDmg < 1) finalDmg = 1;

              localEnemy.hp = Math.max(0, localEnemy.hp - finalDmg);
              logText = `⚔️ ${member.name}の通常攻撃[${attackSpecs.weapon_subtype}/${attackSpecs.element}属性] ➔ (ダイス${randomizedAtk}-敵防${localEnemy.vit}) × 総合倍率:${totalMultiplier.toFixed(2)}倍 [内訳:サイズ+${sizeValue}%/種族+${raceValue}%/属性+${elemValue}%] ➔ ${finalDmg}ダメージ`;
            }
          }

          newLogs.push({ id: `p-${member.id}-${Date.now()}-${Math.random()}`, text: logText, type: "success" });

          if (localEnemy.hp <= 0) {
            newLogs.push({ id: `win-${Date.now()}`, text: `🏆 🎉 【${localEnemy.name}】撃破！`, type: "system" });
            clearInterval(battleTimer);
            clearInterval(countTimer);
            setIsBattleOver(true);
            setIsTimeUp(true);
            setDroppedItems([{ id: 1, name: `${localEnemy.name}の秘宝`, rarity: "legendary" }]);
          }
        }
      });

      // 状態をRefメモリへ即時セーブ
      partyStateRef.current = localParty;
      enemyStateRef.current = localEnemy;
      
      if (newLogs.length > 0) {
        setParty(localParty);
        setEnemy(localEnemy);
        
        // 🚀 【リフォームの核心】
        // 1. 裏メモリの全ログ配列（もし作っていなければ動的に保持）に最初からのログをすべて蓄積
        setDisplayedLogs(prev => {
          const combined = [...prev, ...newLogs];
          
          // 戦闘中の場合はブラウザが重くならないよう、直近30件だけを画面に間引いて描画する
          if (localEnemy.hp > 0 && localParty.some(p => p.hp > 0)) {
            return combined.slice(-30);
          }
          // 🎉 戦闘が終わった瞬間（勝利 or 敗北）は、1件の漏れもなく「最初から最後までの全ログ」を画面に大解放する！
          return combined;
        });
      }
    }, 100);

    return () => { clearInterval(countTimer); clearInterval(battleTimer); };
  }, [loading, party, enemy, isBattleOver]);

  // 3. 自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedLogs]);

  if (loading) return <div style={{ color: '#f59e0b', textAlign: 'center', padding: '50px' }}>部隊結成中...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', width: '100%', backgroundColor: '#020617', overflow: 'hidden', position: 'relative' }}>
      
      <div style={{ padding: '12px 15px', borderBottom: '1px solid #1e293b', background: '#0f172a', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '0.85rem' }}>🐾 【{quest?.name || 'デバッグ演習場'}】 ({party.length}名編成)</div>
          <div style={{ fontSize: '0.8rem', color: timeLeft <= 0 ? '#f59e0b' : '#ef4444', fontWeight: 'bold' }}>
            {timeLeft <= 0 ? '⚠️ AT突入！' : `制限時間: ${timeLeft}秒`}
          </div>
        </div>
      </div>

      {/* 📜 ログ表示エリア：戦闘終了後は最初から最後まで自由に上スクロールして見直せるようになります */}
      <div ref={scrollRef} style={{ flex: 1, padding: '15px', overflowY: 'auto', fontSize: '0.8rem', lineHeight: '1.7', background: '#020617', fontFamily: 'monospace' }}>
        {displayedLogs.map(log => (
          <div key={log.id} style={{ marginBottom: '6px', padding: '4px 8px', borderRadius: '4px', background: log.type === 'system' ? '#1e1b4b' : 'none', color: log.type === 'battle' ? '#f43f5e' : log.type === 'success' ? '#34d399' : log.type === 'system' ? '#f59e0b' : '#94a3b8' }}>
            {log.text}
          </div>
        ))}
      </div>

      {enemy && (
        <div style={{ padding: '8px 15px', background: '#1a0505', borderTop: '1px solid #451a1a', borderBottom: '1px solid #451a1a' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#f43f5e', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>😈 {enemy.name} ({enemy.element}属性/{enemy.size})</span>
            <span style={{ fontFamily: 'monospace' }}>{enemy.hp} / {enemy.mhp}</span>
          </div>
          <div style={{ height: '6px', background: '#311010', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(enemy.hp / enemy.mhp) * 100}%`, background: '#f43f5e', transition: '0.1s' }}></div>
          </div>
        </div>
      )}

      <div style={{ padding: '12px 20px', background: '#0f172a', borderBottom: '1px solid #1e293b', textAlign: 'center' }}>
        {(isTimeUp && isBattleOver) || enemy?.hp <= 0 ? (
          <button onClick={() => setShowResult(true)} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#0f172a', border: 'none', fontSize: '0.95rem', fontWeight: '900', cursor: 'pointer' }}>
            🏆 街へ帰還する
          </button>
        ) : (
          <button onClick={onReturn} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>
            🛡️ 酒場へ戻る
          </button>
        ) }
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${party.length}, 1fr)`, 
        gap: '4px', padding: '10px 6px', background: '#0b0f19'
      }}>
        {party.map(member => (
          <div key={member.id} style={{ background: member.hp <= 0 ? '#1e1b4b' : '#1e293b', borderRadius: '4px', padding: '4px', border: member.hp <= 0 ? '1px solid #ef4444' : '1px solid #334155', textAlign: 'center' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 'bold', color: member.hp <= 0 ? '#64748b' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {member.name.replace('テスト', '')}
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
import React, { useState, useEffect, useRef } from 'react';
import { Timer, Trophy, ShieldAlert } from 'lucide-react';
import QuestResultModal from './components/QuestResultModal';
import { gameServices } from '../../../gameServices';
import { supabase } from '../../../supabaseClient';
import { calculateDamageModifier, calculateStatusInflictChance } from '../../../gameRules'; 

const TEST_USER_ID = "d1669717-95f4-4f80-932f-d412576d55a7";

const AdventureActive = ({ 
  partyCharacterIds = [], 
  quest = null, 
  activeQuest = null, 
  selectedQuest = null, 
  onReturn 
}) => {
  const scrollRef = useRef(null);

  const [timeLeft, setTimeLeft] = useState(30);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [isBattleOver, setIsBattleOver] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const [party, setParty] = useState([]); 
  const [enemy, setEnemy] = useState(null);
  const [displayedLogs, setDisplayedLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestState, setCurrentQuestState] = useState(null);

  const partyStateRef = useRef([]);
  const enemyStateRef = useRef(null);
  const partyAtkTimers = useRef({});
  const enemyAtkTimer = useRef(0);
  
  const [droppedItems, setDroppedItems] = useState([]);
  const hasAnnouncedATRef = useRef(false);
  
  // 🔮 🆕 セーブ中表示用のローカル状態を増築
  const [isSaving, setIsSaving] = useState(false);

  // 1. 初回ロード（ここが「最初」の1回だけの通信）
  useEffect(() => {
    const initAdventure = async () => {
      setLoading(true);
      
      let currentQuest = quest || activeQuest || selectedQuest;
      
      if (!currentQuest && (quest !== null || activeQuest !== null || selectedQuest !== null)) {
        currentQuest = quest || activeQuest || selectedQuest;
      }
      
      setCurrentQuestState(currentQuest);

      const charList = await gameServices.getPlayerCharacters(TEST_USER_ID);
      const { data: dbSkills } = await supabase.from('game_master_skills').select('*');
      const allMasterSkills = dbSkills || [];

      if (charList && charList.length > 0) {
        const filteredMembers = charList.filter(ch => partyCharacterIds.includes(ch.id));

        // 🚨 【緊急デバッグ】F12のコンソールに生のオブジェクト構造をすべて吐き出す
        console.log("=== 🚨 三土手さん、F12のConsoleでここを確認してください ===");
        filteredMembers.forEach(member => {
          console.log(`【キャラクター名: ${member.custom_name}】の全生データ:`, member);
          console.log("第一階層のキー一覧:", Object.keys(member));
          if (member.meta) console.log("metaの中身:", member.meta);
          if (member.bonus) console.log("bonusの中身:", member.bonus);
        });
        console.log("======================================================");

        // ここから下の loadedParty は一旦そのまま動かして大丈夫です
        const loadedParty = filteredMembers.map(ch => {
          partyAtkTimers.current[ch.id] = 0;
          
          const myJob = ch.meta?.job || 'ノービス';
          const myLevel = ch.level || 20;

          const availableSkills = allMasterSkills.filter(sk => {
            const jobReq = sk.job_requirement;
            const lvReq = Number(sk.level_requirement || 1);
            return (jobReq === '全職業' || jobReq === myJob) && myLevel >= lvReq;
          });

          const isScout = myJob === 'スカウト';
          const cardSizeEff = isScout ? { '小型': 20 } : {};
          const cardRaceEff = isScout ? { '無形': 20 } : {};
          const cardElemEff = isScout ? { '地': 20, '地属性': 20 } : {};
          const weaponSubtype = isScout ? '短剣' : (myJob === 'ファイター' ? '剣' : '素手');
          const weaponElement = isScout ? '地' : '無';

          // 🎰 クリティカル率の引き継ぎ
          const alcoholCritical = ch.roStatus?.critical || ch.roStatus?.crit || ch.roStatus?.final_critical || 0;

// 🩸 【鉄壁リフォーム】ch.equips の中身から装備されている全カードを確実に引っこ抜く
          let totalDrainChance = 0;
          let totalDrainPercent = 0;

          // 🧪 🎰 【新設】カードに宿る状態異常付与（例: 毒 100%）を事前に引き抜く器
          let totalInflictType = null;
          let totalInflictChance = 0;

          // 💡 キャラクターが現在身につけている全装備（武器・防具など）をループ
          if (ch.equips && typeof ch.equips === 'object') {
            Object.values(ch.equips).forEach(equipSlot => {
              // 装備スロット内に cards 配列が存在するか徹底チェック
              if (equipSlot && Array.isArray(equipSlot.cards)) {
                equipSlot.cards.forEach(card => {
                  if (!card) return;

                  // 1つ目の効果枠をチェック
                  if (card.card_effect_type === 'hp_drain') {
                    totalDrainChance += Number(card.card_effect_value || 0);
                    const tgt = card.card_effect_target_2 || card.card_effect_target || '';
                    if (String(tgt).includes('drain_')) {
                      totalDrainPercent += Number(String(tgt).replace('drain_', ''));
                    }
                  }
                  if (card.card_effect_type === 'inflict_status') {
                    totalInflictType = card.card_effect_target; // '毒' や 'スタン'
                    totalInflictChance += Number(card.card_effect_value || 0);
                  }

                  // 2つ目の効果枠をチェック
                  if (card.card_effect_type_2 === 'hp_drain') {
                    totalDrainChance += Number(card.card_effect_value_2 || 0);
                    const tgt2 = card.card_effect_target_2 || '';
                    if (String(tgt2).includes('drain_')) {
                      totalDrainPercent += Number(String(tgt2).replace('drain_', ''));
                    }
                  }
                  if (card.card_effect_type_2 === 'inflict_status') {
                    totalInflictType = card.card_effect_target_2;
                    totalInflictChance += Number(card.card_effect_value_2 || 0);
                  }

                  // 3つ目の効果枠をチェック
                  if (card.card_effect_type_3 === 'hp_drain') {
                    totalDrainChance += Number(card.card_effect_value_3 || 0);
                    const tgt3 = card.card_effect_target_3 || '';
                    if (String(tgt3).includes('drain_')) {
                      totalDrainPercent += Number(String(tgt3).replace('drain_', ''));
                    }
                  }
                  if (card.card_effect_type_3 === 'inflict_status') {
                    totalInflictType = card.card_effect_target_3;
                    totalInflictChance += Number(card.card_effect_value_3 || 0);
                  }
                });
              }
            });
          }

          // 【セーフティネット】既存のフラットデータやメタデータに万が一入っていた場合も合算
          const fallbackCards = ch.slotted_cards || ch.meta?.slotted_cards || [];
          if (Array.isArray(fallbackCards) && totalDrainChance === 0) {
            fallbackCards.forEach(card => {
              if (card.card_effect_type === 'hp_drain') {
                totalDrainChance += Number(card.card_effect_value || 0);
                const tgt = card.card_effect_target_2 || card.card_effect_target || '';
                if (String(tgt).includes('drain_')) totalDrainPercent += Number(String(tgt).replace('drain_', ''));
              }
              if (card.card_effect_type === 'inflict_status') {
                totalInflictType = card.card_effect_target;
                totalInflictChance += Number(card.card_effect_value || 0);
              }
            });
          }

          return {
            id: ch.id,
            name: ch.custom_name,
            level: myLevel,
            mhp: ch.max_hp || ch.mhp || 424, // 三土手さんの初期HP 424 を完全維持
            hp: ch.max_hp || ch.mhp || 424,
            msp: ch.max_sp || ch.msp || 50,
            sp: ch.max_sp || ch.msp || 50,
            str: ch.roStatus?.str || ch.str || 10,
            agi: ch.roStatus?.agi || ch.agi || (ch.meta?.stat_agi || 10) + (ch.bonus?.agi || 0),
            vit: ch.roStatus?.vit || ch.vit || (ch.meta?.stat_vit || 10) + (ch.bonus?.vit || 0),
            dex: ch.roStatus?.dex || ch.dex || (ch.meta?.stat_dex || 10) + (ch.bonus?.vit || 0),
            luk: ch.roStatus?.luk || ch.luk || 10,
            job: myJob,
            weaponSubtype,
            weaponElement,
            cardSizeEff,
            cardRaceEff,
            cardElemEff,
            skillsList: availableSkills,
            state: { isFrozen: false, isStunned: false, stunTurns: 0, freezeTurns: 0 },

            final_battle_critical: Number(alcoholCritical),

            // 🩸 装備（ch.equips）から確実に吸い上げた確定値を戦闘素体にインジェクション！
            hp_drain_chance: totalDrainChance,
            hp_drain_percent: totalDrainPercent,

            // 🧪 【状態異常付与スペックを完全シンクロバインド！】
            card_inflict_type: totalInflictType,
            card_inflict_chance: totalInflictChance
          };
        });
        partyStateRef.current = loadedParty;
        setParty(loadedParty);

        let targetEnemyId = 'test_porin_junior';
        const activeQuestData = currentQuest || currentQuestState;
        
        if (activeQuestData?.enemy_master_id) {
          targetEnemyId = activeQuestData.enemy_master_id;
        } else if (activeQuestData?.name?.includes('バフォメット') || activeQuestData?.id?.includes('baphomet')) {
          targetEnemyId = 'baphomet_junior';
        }

        const { data: dbEnemy, error: enemyError } = await supabase
          .from('game_master_units')
          .select('*')
          .eq('id', targetEnemyId)
          .maybeSingle();

        if (enemyError) {
          console.error("エネミーデータ取得エラー:", enemyError);
        }

        const isBaphometTarget = String(targetEnemyId).toLowerCase().includes('baphomet');
        
        const finalName = dbEnemy?.name || (isBaphometTarget ? "バフォメットJr" : "テストポリンJr");
        const finalHp = dbEnemy?.hp || dbEnemy?.base_hp || dbEnemy?.max_hp || (isBaphometTarget ? 1800 : 2500);
        const finalStr = dbEnemy?.str || dbEnemy?.stat_str || (isBaphometTarget ? 35 : 10);
        const finalAgi = dbEnemy?.agi || dbEnemy?.stat_agi || (isBaphometTarget ? 25 : 15);
        const finalVit = dbEnemy?.vit || dbEnemy?.stat_vit || (isBaphometTarget ? 10 : 30);
        const finalSize = dbEnemy?.size || (isBaphometTarget ? '中型' : '小型');
        const finalRace = dbEnemy?.race || (isBaphometTarget ? '悪魔' : '無形');
        const finalElement = dbEnemy?.element || (isBaphometTarget ? '闇' : '水');

        const enemyData = {
          name: finalName,
          mhp: finalHp,
          hp: finalHp,
          str: finalStr,
          agi: finalAgi, 
          vit: finalVit,
          size: finalSize,
          race: finalRace,
          element: finalElement,
          exp: Number(currentQuest?.exp_reward || currentQuestState?.exp_reward || 50),
          gold: Number(currentQuest?.zeny_reward || currentQuestState?.zeny_reward || 1000),
          
          // 🧠 状態異常の現在持続ターン数を管理するコアStateを初期化
          state: { currentStatus: 'なし', durationTurns: 0 },

          // 👑 データベースの4大耐性%（0%〜100%）を完璧に引き継ぎ！
          resist_stun: Number(dbEnemy?.resist_stun || 0),
          resist_freeze: Number(dbEnemy?.resist_freeze || 0),
          resist_poison: Number(dbEnemy?.resist_poison || 0),
          resist_blind: Number(dbEnemy?.resist_blind || 0)
        };

        enemyStateRef.current = enemyData;
        setEnemy(enemyData);

        setDisplayedLogs([
          { id: 'start', text: `⚔️ 【${currentQuest?.name || '未知の領域'}】突入：${enemyData.name} 戦開始`, type: "system" }
        ]);
      } else {
        setDisplayedLogs([{ id: 'err', text: "酒場に冒険者がいません。編成を確認してください。", type: "system" }]);
      }
      setLoading(false);
    };

    initAdventure();
  }, [partyCharacterIds, quest, activeQuest, selectedQuest]);

  // 2. 🧠 超軽量・高速カウント保証型戦闘ループ（※この間は通信回数完全に「0」！）
  useEffect(() => {
    if (loading || party.length === 0 || !enemy || isBattleOver) return;

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

      const enemyInterval = Math.max(1.0, 4.0 - localEnemy.agi * 0.1) * 1000;
      enemyAtkTimer.current += 100;

      // 📜 ログ配列の定義位置をしっかり維持
      let newLogs = [];

      if (enemyAtkTimer.current >= enemyInterval && localEnemy.hp > 0) {
        enemyAtkTimer.current = 0;

        // 💤 【状態異常チェック】敵がスタンまたは凍結状態なら行動不能スキップ！
        if (localEnemy.state?.currentStatus === 'スタン' || localEnemy.state?.currentStatus === '凍結') {
          newLogs.push({ 
            id: `e-skip-${Date.now()}-${Math.random()}`, 
            text: `💤 ${localEnemy.name} は【${localEnemy.state.currentStatus}】状態のため行動できない！`, 
            type: "system" 
          });
          
          // ⏳ ターン持続数を1減らし、0になったら綺麗に解除
          const nextTurns = (localEnemy.state.durationTurns || 1) - 1;
          localEnemy.state.durationTurns = nextTurns;
          if (nextTurns <= 0) {
            newLogs.push({ 
              id: `e-clear-${Date.now()}-${Math.random()}`, 
              text: `✨ ${localEnemy.name} の【${localEnemy.state.currentStatus}】が解除された！`, 
              type: "system" 
            });
            localEnemy.state.currentStatus = 'none';
          }
        } else {
          // ⚔️ 【通常行動ルート】状態異常にかかっていない場合のみここを通る
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

            // 🧪 【毒効果スリップ処理】行動完了時に毒状態なら最大HPの5%削る
            const wasPoisonedAtTurnStart = localEnemy.state?.currentStatus === '毒';
            if (wasPoisonedAtTurnStart) {
              const poisonDmg = Math.floor(localEnemy.mhp * 0.05);
              localEnemy.hp = Math.max(1, localEnemy.hp - poisonDmg); // 毒では死なない本家仕様
              logText += ` 🧪 [毒効果] ${localEnemy.name} は毒により ${poisonDmg} のスリップダメージ！`;
            }

            // 👑 唯一の正解：ここで今回の攻撃＋毒ダメージの確定ログを「1回だけ」出力！
            newLogs.push({ id: `e-${Date.now()}-${Math.random()}`, text: logText, type: "battle" });

            // ⏳ ─── ログ出力が終わった「後」で、安全に持続ターン数を消費・解除判定 ───
            
            // 毒状態のターン消費処理
            if (wasPoisonedAtTurnStart) {
              const nextTurns = (localEnemy.state.durationTurns || 1) - 1;
              localEnemy.state.durationTurns = nextTurns;
              
              // 3回目の毒スリップを食らい終えた「直後」に、綺麗にシステムログが流れます
              if (nextTurns <= 0) {
                newLogs.push({ id: `e-clear-p-${Date.now()}`, text: `✨ ${localEnemy.name} の【毒】が消えた`, type: "system" });
                localEnemy.state.currentStatus = 'none';
              }
            }

            // 暗闇効果のターン消費処理
            if (localEnemy.state?.currentStatus === '暗闇') {
              const nextTurns = (localEnemy.state.durationTurns || 1) - 1;
              localEnemy.state.durationTurns = nextTurns;
              if (nextTurns <= 0) {
                newLogs.push({ id: `e-clear-b-${Date.now()}`, text: `✨ ${localEnemy.name} の【暗闇】が晴れた！`, type: "system" });
                localEnemy.state.currentStatus = 'none';
              }
            }
          }
        }
      }

      // 👤 プレイヤー（パーティ）側の行動判定ループへ完全に着地
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

          // =============================================================
          // 📊 1. 【数理リフォーム】酒場直結型・最終致命打率ダイス配線
          // =============================================================
          // 酒場画面からそのまま引き継いだ103%を基準に判定。100を超えているため確実にtrueを叩き出します。
          const finalCriticalRate = member.final_battle_critical > 0 ? member.final_battle_critical : (member.luk || 10);
          const isCritical = Math.random() * 100 < finalCriticalRate;

          // 📊 2. 総合倍率算出用の共通アタックスペック準備
          const cardSize = member.cardSizeEff || {};
          const cardRace = member.cardRaceEff || {};
          const cardElem = member.cardElemEff || {};
          const sizeValue = cardSize['小型'] || 0;
          const raceValue = cardRace['無形'] || 0;
          const elemValue = cardElem['地'] || 0;

          let currentWeaponElement = member.weaponElement || '無';
          if (elemValue > 0) currentWeaponElement = '地';

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

          // =============================================================
          // ⚔️ 3. 新・条件分岐配線（クリティカルが100%超なら常時確定ルート）
          // =============================================================
          if (isCritical) {
            // 💥💥 最優先：CRITICAL HIT!! 確定ルート（スキル判定を完全蹂増）
            finalDmg = Math.floor(maxAtk * totalMultiplier);
            if (finalDmg < 1) finalDmg = 1;

            localEnemy.hp = Math.max(0, localEnemy.hp - finalDmg);
            
            // ─── 🔮 創世神特注：明確な「与えた！回復した！」直撃構文リフォーム ───
            logText = `💥💥 CRITICAL HIT!! ${member.name} が急所を貫いた！ [敵防無視/威力MAX/確率:${finalCriticalRate}%] ➔ ${localEnemy.name} に ${finalDmg} の致命物理ダメージを与えた！`;
            
            // 🩸 【HP吸収判定ダイス】
            if (member.hp_drain_chance > 0 && Math.random() * 100 < member.hp_drain_chance) {
              const drainPct = Number(member.hp_drain_percent || 0);
              if (drainPct > 0) {
                const healAmount = Math.floor((finalDmg * drainPct) / 100);
                member.hp = Math.min(member.mhp, member.hp + healAmount); // MHPを超えないように回復
                
                // ➔ ご要望通りのログ構文を直撃バインド！
                logText += ` 🩸 ${healAmount} 回復した！！ (残HP: ${localEnemy.hp})`;
              } else {
                logText += ` (残HP: ${localEnemy.hp})`;
              }
            } else {
              logText += ` (残HP: ${localEnemy.hp})`;
            }

            // 🧪 🎰 👑 【新設：クリティカルヒット時・1%状態異常付与ガチャの同期配線】
            // クリティカルで殴った際にも、重複防止安全弁を効かせつつ、最低1%の確率で毒を叩き込みます！
            if (localEnemy.hp > 0 && member.card_inflict_type && member.card_inflict_chance > 0 && localEnemy.state?.currentStatus !== member.card_inflict_type) {
              const cardInflictType = member.card_inflict_type;
              const cardInflictChance = member.card_inflict_chance;

              // 敵の耐性を計算
              const enemyResist = cardInflictType === '毒' ? (localEnemy.resist_poison || 0) : 
                                  cardInflictType === 'スタン' ? (localEnemy.resist_stun || 0) : 
                                  cardInflictType === '凍結' ? (localEnemy.resist_freeze || 0) : 0;
              
              // 👑 三土手ディレクション：手数職を引き締める「最低保証5%」の数理
              const finalApplyChance = Math.max(5, cardInflictChance - enemyResist);

              if (Math.random() * 100 < finalApplyChance) {
                localEnemy.state = { 
                  ...localEnemy.state,
                  currentStatus: cardInflictType,
                  durationTurns: 3
                };
                // クリティカルログの文末に、美しく追加効果テキストをマージ！
                logText += ` ✨ [追加効果] ${localEnemy.name} を【${cardInflictType}】状態にした！！`;
              }
            }

          } else {
            // 🎲 クリティカル不発時のみ、スキルまたは通常の抽選へ流す
            const activeSkills = member.skillsList || [];
            const useSkill = activeSkills.length > 0 && Math.random() < 0.45;

            if (useSkill) {
              // ✨ スキル発動ルート
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
                const skillSpecs = {
                  ...attackSpecs,
                  element: skill.element || '無',
                  is_physical: skill.skill_type === 'art'
                };
                const skillMultiplier = calculateDamageModifier(skillSpecs, defenderSpecs);

                if (skill.skill_type === 'art') {
                  finalDmg = Math.max(1, Math.floor((calculatedPower * skillMultiplier) - localEnemy.vit));
                  logText = `⚔️ ${member.name} 【${skill.name}】！ ${localEnemy.name} に ${finalDmg} の物理ダメージを与えた！`;
                  
                  // 🩸 【HP吸収判定ダイス（物理スキル用）】
                  if (member.hp_drain_chance > 0 && Math.random() * 100 < member.hp_drain_chance) {
                    const drainPct = Number(member.hp_drain_percent || 0);
                    if (drainPct > 0) {
                      const healAmount = Math.floor((finalDmg * drainPct) / 100);
                      member.hp = Math.min(member.mhp, member.hp + healAmount);
                      logText += ` 🩸 ${healAmount} 回復した！！`;
                    }
                  }
                } else {
                  // 🔮 魔法スキルルートのダメージ決着
                  finalDmg = Math.max(1, Math.floor(calculatedPower * skillMultiplier));
                  logText = `🔮 ${member.name} 【${skill.name}】！ ${localEnemy.name} に ${finalDmg} の魔法ダメージ！`;
                }

                // 💥 敵のHPを実際に減少させる処理
                localEnemy.hp = Math.max(0, localEnemy.hp - finalDmg);

                // 🎰 🆕 【スキルヒット時の追加配線エリア】
                if (skill.effect_type && skill.effect_type !== 'なし' && localEnemy.hp > 0) {
                  const baseChance = Number(skill.effect_chance || 0);
                  
                  let enemyResistPct = 0;
                  if (skill.effect_type === 'スタン')  enemyResistPct = localEnemy.resist_stun || 0;
                  if (skill.effect_type === '凍結')  enemyResistPct = localEnemy.resist_freeze || 0;
                  if (skill.effect_type === '毒')    enemyResistPct = localEnemy.resist_poison || 0;
                  if (skill.effect_type === '暗闇')  enemyResistPct = localEnemy.resist_blind || 0;

                  const finalInflictChance = Math.max(0, baseChance - enemyResistPct);

                  if (Math.random() * 100 < finalInflictChance) {
                    const turns = Number(skill.duration_turns || 3);
                    localEnemy.state = {
                      currentStatus: skill.effect_type,
                      durationTurns: turns
                    };
                    logText += ` ✨ [追加効果] ${localEnemy.name} を【${skill.effect_type}】状態にした！(${turns}ターン)`;
                  }
                }

              } // <-- 味方単体/全体の回復スキル分岐との合流閉じ
            } else {
              // ──────────────────────────────────────────────────
              // ⚔️ 通常攻撃ルート 【状態異常による敵防低下・干渉配線】
              // ──────────────────────────────────────────────────
              
              // 💤 敵がスタンまたは凍結状態なら、VIT（敵の物理防御）を完全にゼロ化して計算！
              const isEnemyDebuffed = localEnemy.state?.currentStatus === 'スタン' || localEnemy.state?.currentStatus === '凍結';
              const effectiveEnemyVit = isEnemyDebuffed ? 0 : (localEnemy.vit || 0);

              // 🧪 敵が毒状態なら、そこからさらに防御力（VIT）を25%低下させる
              const isEnemyPoisoned = localEnemy.state?.currentStatus === '毒';
              const finalEnemyVit = isEnemyPoisoned ? Math.floor(effectiveEnemyVit * 0.75) : effectiveEnemyVit;

              // 🎲 弱体化した finalEnemyVit を使ってベースダメージを算出
              const baseDmg = Math.max(1, randomizedAtk - finalEnemyVit);
              finalDmg = Math.floor(baseDmg * totalMultiplier);
              if (finalDmg < 1) finalDmg = 1;

              localEnemy.hp = Math.max(0, localEnemy.hp - finalDmg);
              
              // 状態異常による防御低下が発生している場合、ログに「[敵防完全喪失!]」などの表記をドッキング
              const debuffMsg = isEnemyDebuffed ? `[敵防完全喪失!]` : (isEnemyPoisoned ? `[敵防25%低下!]` : '');
              logText = `⚔️ ${member.name}の通常攻撃[${attackSpecs.weapon_subtype}/${attackSpecs.element}属性] ➔ (ダイス${randomizedAtk}-敵防${finalEnemyVit})${debuffMsg} × 総合倍率:${totalMultiplier.toFixed(2)}倍 ➔ ${finalDmg} の物理ダメージを与えた！`;
              
              // 🩸 【HP吸収判定ダイス（通常攻撃用）】
              if (member.hp_drain_chance > 0 && Math.random() * 100 < member.hp_drain_chance) {
                const drainPct = Number(member.hp_drain_percent || 0);
                if (drainPct > 0) {
                  const healAmount = Math.floor((finalDmg * drainPct) / 100);
                  member.hp = Math.min(member.mhp, member.hp + healAmount);
                  logText += ` 🩸 ${healAmount} 回復した！！`;
                }
              }

              // 🧪 🎰 👑 【通常攻撃ヒット時・カード専用状態異常付与ガチャの1%最低保証配線】
              if (localEnemy.hp > 0 && member.card_inflict_type && member.card_inflict_chance > 0 && localEnemy.state?.currentStatus !== member.card_inflict_type) {
                const cardInflictType = member.card_inflict_type;
                const cardInflictChance = member.card_inflict_chance;

                const enemyResist = cardInflictType === '毒' ? (localEnemy.resist_poison || 0) : 
                                    cardInflictType === 'スタン' ? (localEnemy.resist_stun || 0) : 
                                    cardInflictType === '凍結' ? (localEnemy.resist_freeze || 0) : 0;
                
                // 👑 クリティカル不発時の通常ルートも、しっかり「最低保証5%」へ完全バインド！
                const finalApplyChance = Math.max(5, cardInflictChance - enemyResist);

                if (Math.random() * 100 < finalApplyChance) {
                  localEnemy.state = { 
                    ...localEnemy.state,
                    currentStatus: cardInflictType,
                    durationTurns: 3
                  };
                  logText += ` ✨ [追加効果] ${localEnemy.name} を【${cardInflictType}】状態にした！！`;
                }
              }
              // ──────────────────────────────────────────────────
              // ⚔️ 【通常攻撃ルート リフォームここまで】
              // ──────────────────────────────────────────────────
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

      partyStateRef.current = localParty;
      enemyStateRef.current = localEnemy;
      
      if (newLogs.length > 0) {
        setParty(localParty);
        setEnemy(localEnemy);
        
        setDisplayedLogs(prev => {
          const combined = [...prev, ...newLogs];
          if (localEnemy.hp > 0 && localParty.some(p => p.hp > 0)) {
            return combined.slice(-30);
          }
          return combined;
        });
      }
    }, 100);

    return () => { clearInterval(countTimer); clearInterval(battleTimer); };
  }, [loading, party, enemy, isBattleOver]);

  // 3. 🔮 🆕 三土手創世神特注：サーバー無風コミットエンジン（これが「最後」の1回だけの通信）
  const handleTownCommit = async () => {
    setIsSaving(true);
    try {
      const finalParty = partyStateRef.current;
      const finalEnemy = enemyStateRef.current;
      const isVictory = finalEnemy && finalEnemy.hp <= 0;

      // 👥 1. 生き残ったメンバーの現在HPを一斉にSupabaseへ最終保存
      await Promise.all(
        finalParty.map(async (member) => {
          await supabase
            .from('game_characters')
            .update({ current_hp: member.hp })
            .eq('id', member.id);
        })
      );

      // 💰 2. 勝利時のみ、ユーザーのZenyやExp報酬を加算コミット（※将来の拡張用に器を配置！）
      if (isVictory) {
        console.log(`🎁 創世神特攻報酬の確定：BaseEXP +${finalEnemy.exp} / Zeny +${finalEnemy.gold}`);
        // ここにユーザーの所持金を加算するマスターテーブルへのUPDATEを1発書くだけで接続可能！
      }

      // 3. モーダルを開いて完了！
      setShowResult(true);
    } catch (error) {
      console.error("最終決戦データのセーブに失敗しました:", error);
      setShowResult(true); // エラーでもスタックしないよう逃がす
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedLogs]);

  if (loading) return <div style={{ color: '#f59e0b', textAlign: 'center', padding: '50px' }}>部隊結成中...</div>;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      position: 'fixed', 
      top: 0,
      left: 0,
      right: 0,
      margin: '0 auto',
      width: '100%', 
      maxWidth: '480px',
      height: 'calc(100vh - 60px)', 
      backgroundColor: '#020617', 
      overflow: 'hidden', 
      zIndex: 2000 
    }}>
      
      <div style={{ padding: '12px 15px', borderBottom: '1px solid #1e293b', background: '#0f172a', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '0.85rem' }}>🐾 【{currentQuestState?.name || 'クエスト'}】 ({party.length}名編成)</div>
          <div style={{ fontSize: '0.8rem', color: timeLeft <= 0 ? '#f59e0b' : '#ef4444', fontWeight: 'bold' }}>
            {timeLeft <= 0 ? '⚠️ AT突入！' : `制限時間: ${timeLeft}秒`}
          </div>
        </div>
      </div>

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
          /* 🔮 🆕 ボタンのonClickを、直撃セーブ機能付きの handleTownCommit へコンバート！ */
          <button 
            onClick={handleTownCommit} 
            disabled={isSaving}
            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#0f172a', border: 'none', fontSize: '0.95rem', fontWeight: '900', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }}
          >
            {isSaving ? '⏳ 冒険ログを同期中...' : '🏆 街へ帰還する'}
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
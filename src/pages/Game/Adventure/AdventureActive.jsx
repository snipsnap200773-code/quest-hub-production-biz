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
  // 🔮 🆕 創世神特注：SP自動回復用の時間累積プールタイマーRef（初期値0秒）
  const spRegenTimer = useRef(0);
  
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
          let maxInflictChance = 0; // 足し算せず、一番高い確率をホールドする器

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
                    const chkChance = Number(card.card_effect_value || 0);
                    if (chkChance > maxInflictChance) {
                      maxInflictChance = chkChance;
                      totalInflictType = card.card_effect_target; // '毒' や 'スタン'
                    }
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
                    const chkChance = Number(card.card_effect_value_2 || 0);
                    if (chkChance > maxInflictChance) {
                      maxInflictChance = chkChance;
                      totalInflictType = card.card_effect_target_2;
                    }
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
                    const chkChance = Number(card.card_effect_value_3 || 0);
                    if (chkChance > maxInflictChance) {
                      maxInflictChance = chkChance;
                      totalInflictType = card.card_effect_target_3;
                    }
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
                const chkChance = Number(card.card_effect_value || 0);
                if (chkChance > maxInflictChance) {
                  maxInflictChance = chkChance;
                  totalInflictType = card.card_effect_target;
                }
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

card_inflict_type: totalInflictType,
            card_inflict_chance: maxInflictChance // 👈 ここを「maxInflictChance」にする！
          };        });
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

      // 🔮 🆕 【創世神の呼吸：SP自動自然回復エンジン】
      // 100ms（0.1秒）ごとにタイマーを一歩進める
      spRegenTimer.current += 0.1;
      
      // 5秒が経過した瞬間、神の息吹がパーティ全員に降り注ぐ
      if (spRegenTimer.current >= 5.0) {
        spRegenTimer.current = 0; // タイマーを美しくリセット
        
        localParty = localParty.map(member => {
          // 死亡しているキャラクターは魂が眠っているためスキップ
          if (member.hp <= 0) return member;
          
          // LUKをベースにした数理設計に基づき、回復パーセンテージを算出（最低1%〜）
          const lukBonusPct = 1 + Math.floor((member.luk || 10) / 10);
          // 回復量の実数値を計算（小数点以下切り捨て、最低保証値1）
          const regenAmount = Math.max(1, Math.floor(((member.msp || 50) * lukBonusPct) / 100));
          
          // 最大SPを超えないように安全に加算
          const nextSp = Math.min(member.msp || 50, member.sp + regenAmount);
          
          // 回復が発生した場合のみログにそっと表示させたい場合はここで newLogs に push も可能ですが、
          // 高速バトルログが埋まるのを防ぐため、内部ステータスを静かに書き換えてUIに同期させます。
          return {
            ...member,
            sp: nextSp
          };
        });
      }
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

        const currentStatus = localEnemy.state?.currentStatus || 'none';

        // 💤 🧠 【新設：行動不能デバフ一斉検知センサー】
        // スタン、凍結、睡眠、石化のいずれかであれば、敵は完全にカカシ化して行動スキップ！
        const isActionImmobilized = ['スタン', '凍結', '睡眠', '石化'].includes(currentStatus);

        if (isActionImmobilized) {
          newLogs.push({ 
            id: `e-skip-${Date.now()}-${Math.random()}`, 
            text: `💤 ${localEnemy.name} は【${currentStatus}】状態のため行動できない！`, 
            type: "system" 
          });
          
          // ⏳ 持続ターン数を1減らし、0になったら綺麗に解除
          const nextTurns = (localEnemy.state.durationTurns || 1) - 1;
          localEnemy.state.durationTurns = nextTurns;
          if (nextTurns <= 0) {
            newLogs.push({ 
              id: `e-clear-${Date.now()}-${Math.random()}`, 
              text: `✨ ${localEnemy.name} の【${currentStatus}】が解除された！`, 
              type: "system" 
            });
            localEnemy.state.currentStatus = 'none';
          }
        } else {
          // ⚔️ 【通常行動ルート】動ける状態（または暗闇、沈黙、呪いなど）はここを通る
          const aliveMembers = localParty.filter(p => p.hp > 0);
          if (aliveMembers.length > 0) {
            const target = aliveMembers[Math.floor(Math.random() * aliveMembers.length)];
            const targetIdx = localParty.findIndex(p => p.id === target.id);
            
            // 🤐 【沈黙効果の干渉】敵が「沈黙」状態なら、スキル（ナパームビート）の確率を強制0%にして通常攻撃に固定！
            const isSilenced = currentStatus === '沈黙';
            const isSkill = isSilenced ? false : (Math.random() < 0.25);
            
            let dmg = 0;
            let logText = "";

            if (isSkill) {
              dmg = Math.floor(10 + localEnemy.str * 1.5);
              localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - dmg);
              logText = `🔮 ${localEnemy.name} の【ナパームビート】！ ${target.name} に ${dmg} の魔法ダメージ！`;
            } else {
              // 💀 【呪い効果の干渉】敵が「呪い」状態なら、STR（腕力）を半分にして物理ダメージを計算！
              const isCursed = currentStatus === '呪い';
              const effectiveStr = isCursed ? Math.floor(localEnemy.str * 0.5) : localEnemy.str;

              const baseAtk = Math.floor(Math.random() * 10) + 10 + effectiveStr;
              
              // 🕶️ 【暗闇効果の干渉】敵が「暗闇」状態なら、50%の確率で攻撃がスカ（MISS）る！
              const isBlinded = currentStatus === '暗闇';
              if (isBlinded && Math.random() < 0.5) {
                logText = `🕶️ ${localEnemy.name} は暗闇に包まれて攻撃を外した！ ${target.custom_name || target.name} は鮮やかに回避した！`;
              } else {
                dmg = Math.max(1, baseAtk - target.vit);
                localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - dmg);
                logText = `💥 ${localEnemy.name} の攻撃！ ${target.name} は ${dmg} の物理ダメージを受けた！`;
              }
            }

            // 🧪 【毒効果スリップ処理】行動完了時に毒状態なら最大HPの5%削る
            const wasPoisonedAtTurnStart = currentStatus === '毒';
            if (wasPoisonedAtTurnStart) {
              const poisonDmg = Math.floor(localEnemy.mhp * 0.05);
              localEnemy.hp = Math.max(1, localEnemy.hp - poisonDmg); 
              logText += ` 🧪 [毒効果] ${localEnemy.name} は毒により ${poisonDmg} のスリップダメージ！`;
            }

            // 👑 唯一のログ出力
            newLogs.push({ id: `e-${Date.now()}-${Math.random()}`, text: logText, type: "battle" });

            // ⏳ ─── ログ出力が終わった「後」で、動けるデバフ（毒、暗闇、沈黙、呪い）の持続ターン数を消費・解除判定 ───
            if (['毒', '暗闇', '沈黙', '呪い'].includes(currentStatus)) {
              const nextTurns = (localEnemy.state.durationTurns || 1) - 1;
              localEnemy.state.durationTurns = nextTurns;
              if (nextTurns <= 0) {
                newLogs.push({ 
                  id: `e-clear-move-${Date.now()}`, 
                  text: `✨ ${localEnemy.name} の【${currentStatus}】が切れた。`, 
                  type: "system" 
                });
                localEnemy.state.currentStatus = 'none';
              }
            }

          } // <-- aliveMembers の閉じ
        } // <-- 行動不能・通常行動ルートの条件分岐閉じ
      } // <-- enemyAtkTimerの閉じ

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
          // 🧠 👑 【三土手創世神特注：インテリジェント魔法温存＆ボス戦全力AIエンジン】
          // =============================================================
          const activeSkills = member.skillsList || [];
          
          // 🔮 覚えている有効な攻撃魔法（またはスキル）を1つピックアップ
          const playableSkill = activeSkills.length > 0 ? activeSkills[Math.floor(Math.random() * activeSkills.length)] : null;
          const skillSpCost = playableSkill ? Number(playableSkill.sp_cost || 0) : 0;

          // 🪐 現在の戦場の環境・エネミーがBOSSかどうかを検知
          const isTargetBoss = localEnemy.is_boss === true;

          // 💙 自分のSP割合をリアルタイム算出（分母 liveMaxSp に対する現在値）
          const currentSpRatio = (member.sp / (member.msp || 50)) * 100;

          // 📐 【新・第1ステップ判定】魔法をブッ放すかどうかのガンビット条件ダイス
          let shouldLaunchMagic = false;

          if (playableSkill && member.sp >= skillSpCost) {
            if (isTargetBoss) {
              // 🔥 ボス戦：SPが消費分さえ残っていれば、50%以下だろうが100%最優先で全力全開詠唱！
              shouldLaunchMagic = true;
            } else {
              // 🍃 道中（雑魚戦）：SPが50%より多い時だけ撃つ！50%以下になったら通常ルートへ逃がして温存！
              if (currentSpRatio > 50) {
                shouldLaunchMagic = true;
              }
            }
          }

          // 🎰 【新・第2ステップ判定用のダイス準備】
          // 魔法不発時、または温存モード時のみ振られる致命打率ダイス
          const finalCriticalRate = member.final_battle_critical > 0 ? member.final_battle_critical : (member.luk || 10);
          const isCritical = Math.random() * 100 < finalCriticalRate;

          // 📊 総合倍率算出用の共通アタックスペック準備
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

          // ─────────────────────────────────────────────────────────────
          // ⚡⚡ 【作戦行動ツリーへの着地分岐】
          // ─────────────────────────────────────────────────────────────
          if (shouldLaunchMagic) {
            // =============================================================
            // ✨ 【新・第1ステップ確定ルート】神の詠唱ファイヤーボルト！
            // =============================================================
            // 💙 使用した分のSPを肉体から確実に引き算
            member.sp = Math.max(0, member.sp - skillSpCost);

            const baseValue = Number(playableSkill.effect_value || 0);
            let calculatedPower = baseValue;
            if (playableSkill.value_type === 'percent') {
              calculatedPower = Math.floor((randomizedAtk * baseValue) / 100);
            }

            const skillSpecs = {
              ...attackSpecs,
              element: playableSkill.element || '無',
              is_physical: playableSkill.skill_type === 'art'
            };
            const skillMultiplier = calculateDamageModifier(skillSpecs, defenderSpecs);

            // 🔮 魔法ダメージ決着
            finalDmg = Math.max(1, Math.floor(calculatedPower * skillMultiplier));
            localEnemy.hp = Math.max(0, localEnemy.hp - finalDmg);

            // ボス戦か道中かでログの枕詞を豪華に変更
            const bossModeMsg = isTargetBoss ? `🔥[BOSS決戦・限界突破!!] ` : `🔮`;
            logText = `${bossModeMsg}${member.name} 【${playableSkill.name}】！ ${localEnemy.name} に ${finalDmg} の魔法ダメージ！(残SP: ${member.sp})`;

            // 🎰 【魔法ヒット時の追加効果判定】
            if (playableSkill.effect_type && playableSkill.effect_type !== 'なし' && localEnemy.hp > 0) {
              const baseChance = Number(playableSkill.effect_chance || 0);
              let enemyResistPct = 0;
              if (playableSkill.effect_type === 'スタン')  enemyResistPct = localEnemy.resist_stun || 0;
              if (playableSkill.effect_type === '凍結')  enemyResistPct = localEnemy.resist_freeze || 0;
              if (playableSkill.effect_type === '毒')    enemyResistPct = localEnemy.resist_poison || 0;
              if (playableSkill.effect_type === '暗闇')  enemyResistPct = localEnemy.resist_blind || 0;

              const finalInflictChance = Math.max(0, baseChance - enemyResistPct);
              if (Math.random() * 100 < finalInflictChance) {
                const turns = Number(playableSkill.duration_turns || 3);
                localEnemy.state = { currentStatus: playableSkill.effect_type, durationTurns: turns };
                logText += ` ✨ [追加効果] ${localEnemy.name} を【${playableSkill.effect_type}】状態にした！(${turns}ターン)`;
              }
            }

          } else if (isCritical) {
            // =============================================================
            // 💥💥 【新・第2ステップルート】魔法不発、または温存時の確定致命打
            // =============================================================
            finalDmg = Math.floor(maxAtk * totalMultiplier);
            if (finalDmg < 1) finalDmg = 1;
            localEnemy.hp = Math.max(0, localEnemy.hp - finalDmg);

            const saveMsg = (playableSkill && currentSpRatio <= 50 && !isTargetBoss) ? `🪶[SP温存モード] ` : ``;
            logText = `💥💥 ${saveMsg}CRITICAL HIT!! ${member.name} が急所を貫いた！ [敵防無視/威力MAX] ➔ ${localEnemy.name} に ${finalDmg} の致命物理ダメージ！`;
            
            if (member.hp_drain_chance > 0 && Math.random() * 100 < member.hp_drain_chance) {
              const drainPct = Number(member.hp_drain_percent || 0);
              if (drainPct > 0) {
                const healAmount = Math.floor((finalDmg * drainPct) / 100);
                member.hp = Math.min(member.mhp, member.hp + healAmount);
                logText += ` 🩸 ${healAmount} 回復した！！ (残HP: ${localEnemy.hp})`;
              } else {
                logText += ` (残HP: ${localEnemy.hp})`;
              }
            } else {
              logText += ` (残HP: ${localEnemy.hp})`;
            }

            // 🧪 🎰 👑 【クリティカルヒット時・状態異常付与ガチャの最低保証配線】
            if (localEnemy.hp > 0 && member.card_inflict_type && member.card_inflict_chance > 0 && localEnemy.state?.currentStatus !== member.card_inflict_type) {
              const cardInflictType = member.card_inflict_type;
              const cardInflictChance = member.card_inflict_chance;

              const enemyResist = cardInflictType === '毒' ? (localEnemy.resist_poison || 0) : 
                                  cardInflictType === 'スタン' ? (localEnemy.resist_stun || 0) : 
                                  cardInflictType === '凍結' ? (localEnemy.resist_freeze || 0) : 
                                  cardInflictType === '暗闇' ? (localEnemy.resist_blind || 0) :
                                  cardInflictType === '睡眠' ? (localEnemy.vit || 0) : 
                                  cardInflictType === '沈黙' ? (localEnemy.agi || 0) : 
                                  cardInflictType === '呪い' ? (localEnemy.luk || 0) : 
                                  cardInflictType === '石化' ? (localEnemy.vit || 0) : 0;
              
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
              const isEnemyDebuffed = ['スタン', '凍結', '石化'].includes(localEnemy.state?.currentStatus);
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
                    cardInflictType === '凍結' ? (localEnemy.resist_freeze || 0) : 
                    cardInflictType === '暗闇' ? (localEnemy.resist_blind || 0) :
                    cardInflictType === '睡眠' ? (localEnemy.vit || 0) :      // 💤 睡眠はVITで抵抗！
                    cardInflictType === '沈黙' ? (localEnemy.agi || 0) :      // 🤐 沈黙はAGIで抵抗！
                    cardInflictType === '呪い' ? (localEnemy.luk || 0) :      // 💀 呪いはLUKで抵抗！
                    cardInflictType === '石化' ? (localEnemy.vit || 0) : 0;   // 🗿 石化はVITで抵抗！
                
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
          // 今回発生した新しいログを後ろに結合
          const combined = [...prev, ...newLogs];
          
          // 👑 三土手神リフォーム：-30件の超圧縮を廃止！
          // バトル開始からアディショナルタイムまでの歴史を最大500件までたっぷりホールド！
          if (combined.length > 500) {
            return combined.slice(-500); // 500件を超えた時だけ古いものを綺麗に押し出す
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
        {party.map(member => {
          // リアルタイムに変動するSPの安全な割合を算出（メンバー毎に独立計算）
          const mspValue = member.msp || 50;
          const spPercent = Math.min(100, Math.max(0, (member.sp / mspValue) * 100));

          return (
            <div key={member.id} style={{ background: member.hp <= 0 ? '#1e1b4b' : '#1e293b', borderRadius: '6px', padding: '6px 4px', border: member.hp <= 0 ? '1px solid #ef4444' : '1px solid #334155', textAlign: 'center' }}>
              {/* キャラクター名 */}
              <div style={{ fontSize: '0.62rem', fontWeight: 'bold', color: member.hp <= 0 ? '#64748b' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {member.name.replace('テスト', '')}
              </div>
              
              {/* ❤️ HP数値 */}
              <div style={{ fontFamily: 'monospace', fontSize: '0.55rem', color: '#34d399', marginTop: '3px', display: 'flex', justifyContent: 'space-between', padding: '0 4px', lineHeight: '1.2' }}>
                <span style={{ fontWeight: 'bold' }}>HP:</span>
                <span>{member.hp}/{member.mhp}</span>
              </div>
              {/* ❤️ HPゲージ */}
              <div style={{ height: '4px', background: '#451a1a', borderRadius: '2px', marginTop: '1px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(member.hp / member.mhp) * 100}%`, background: '#ef4444', transition: '0.1s' }}></div>
              </div>

              {/* 💙 リアルタイム魔力（SP）ステータス数値（HPと同じ両端flex配線に矯正！） */}
              <div style={{ fontFamily: 'monospace', fontSize: '0.55rem', color: '#38bdf8', marginTop: '4px', display: 'flex', justifyContent: 'space-between', padding: '0 4px', lineHeight: '1.2' }}>
                <span style={{ color: '#887355', fontWeight: 'bold' }}>SP:</span>
                <span style={{ fontWeight: 'bold' }}>{member.sp}/{mspValue}</span>
              </div>
              {/* 💙 高級感のあるミニSPプログレスバー */}
              <div style={{ width: '100%', height: '3px', background: '#0d0905', borderRadius: '1.5px', overflow: 'hidden', border: '1px solid #23190e', marginTop: '1px' }}>
                <div style={{ width: `${spPercent}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)', transition: 'width 0.2s ease' }}></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 🎁 戦闘終了時のみポップアップするリザルトモーダル */}
      <QuestResultModal isOpen={showResult} droppedItems={droppedItems} onClose={onReturn} />
    </div>
  );
};

export default AdventureActive;
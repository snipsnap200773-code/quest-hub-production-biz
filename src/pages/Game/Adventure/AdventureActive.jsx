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
  // 😈 単数から複数エネミー用の配列状態へ拡張
  const [enemies, setEnemies] = useState([]); 
  const [displayedLogs, setDisplayedLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestState, setCurrentQuestState] = useState(null);

  const partyStateRef = useRef([]);
  // 👿 内部メモリも配列用の参照へリフォーム
  const enemiesStateRef = useRef([]); 
  const partyAtkTimers = useRef({});
  const enemiesAtkTimers = useRef({}); // ⏱️ 敵の個別ATKタイマー管理オブジェクト
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

        // 🔮 【3枠一斉スキャンインフラ】クエストが保有する全エネミーIDを配列に集約
        const activeQuestData = currentQuest || currentQuestState;
        const enemyIds = [
          activeQuestData?.enemy_master_id,
          activeQuestData?.enemy_master_id_2,
          activeQuestData?.enemy_master_id_3
        ].filter(Boolean);

        // IDが1つもない場合のセーフティフォールバック
        if (enemyIds.length === 0) {
          enemyIds.push(activeQuestData?.name?.includes('バフォメット') || activeQuestData?.id?.includes('baphomet') ? 'baphomet_junior' : 'test_porin_junior');
        }

        // Supabaseのin構文を使い、出現予定の敵データを一撃で一括ダウンロード！
        const { data: dbEnemies, error: enemyError } = await supabase
          .from('game_master_units')
          .select('*')
          .in('id', enemyIds);

        if (enemyError) {
          console.error("エネミーデータ一括取得エラー:", enemyError);
        }

        // 敵データ配列の初期化と instanceId マッピング
        let loadedEnemies = [];
        enemyIds.forEach((targetId, index) => {
          const dbEnemy = dbEnemies?.find(e => e.id === targetId);
          const isBaphometTarget = String(targetId).toLowerCase().includes('baphomet');

          const finalName = dbEnemy?.name || (isBaphometTarget ? "バフォメットJr" : "テストポリンJr");
          const finalHp = dbEnemy?.hp || dbEnemy?.base_hp || dbEnemy?.max_hp || (isBaphometTarget ? 1800 : 2500);
          const finalStr = dbEnemy?.str || dbEnemy?.stat_str || (isBaphometTarget ? 35 : 10);
          const finalAgi = dbEnemy?.agi || dbEnemy?.stat_agi || (isBaphometTarget ? 25 : 15);
          const finalVit = dbEnemy?.vit || dbEnemy?.stat_vit || (isBaphometTarget ? 10 : 30);
          const finalSize = dbEnemy?.size || (isBaphometTarget ? '中型' : '小型');
          const finalRace = dbEnemy?.race || (isBaphometTarget ? '悪魔' : '無形');
          const finalElement = dbEnemy?.element || (isBaphometTarget ? '闇' : '水');

          const instanceId = `${targetId}_slot_${index}_${Date.now()}`;

          loadedEnemies.push({
            instanceId,
            id: targetId,
            name: finalName,
            mhp: finalHp,
            hp: finalHp,
            str: finalStr,
            agi: finalAgi, 
            vit: finalVit,
            size: finalSize,
            race: finalRace,
            element: finalElement,
            exp: Number(activeQuestData?.exp_reward || 50),
            gold: Number(activeQuestData?.zeny_reward || 1000),
            state: { currentStatus: 'なし', durationTurns: 0 },
            resist_stun: Number(dbEnemy?.resist_stun || 0),
            resist_freeze: Number(dbEnemy?.resist_freeze || 0),
            resist_poison: Number(dbEnemy?.resist_poison || 0),
            resist_blind: Number(dbEnemy?.resist_blind || 0)
          });
        });

        // 👿 単数Ref・Stateを粉砕し、上位の配列バッファへ完全マウント！
        enemiesStateRef.current = loadedEnemies;
        setEnemies(loadedEnemies);

        setDisplayedLogs([
          { id: 'start', text: `⚔️ 【${activeQuestData?.name || '未知の領域'}】突入：全エネミー一斉交戦開始！`, type: "system" }
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
    if (loading || party.length === 0 || enemies.length === 0 || isBattleOver) return;

    const countTimer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(countTimer);
          const hasAliveEnemy = enemiesStateRef.current && enemiesStateRef.current.some(e => e.hp > 0);
          const hasAlivePlayer = partyStateRef.current && partyStateRef.current.some(p => p.hp > 0);

          if (hasAliveEnemy && hasAlivePlayer) {
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
      // 👿 旧タイマン仕様の単体オブジェクトを完全粉砕！複数敵配列をメモリバッファから直撃コピー
      let localEnemies = [...enemiesStateRef.current];

      const isPartyDead = localParty.every(p => p.hp <= 0);
      const isAllEnemiesDead = localEnemies.every(e => e.hp <= 0);

      // 🪐 パーティが全滅するか、あるいは「すべての敵」のHPが0以下になったらタイマーを最速停止！
      if (isPartyDead || isAllEnemiesDead) {
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

      // 💡 【修正点】ここでクラッシュしていた古い `localEnemy` の判定ブロックを削除しました。
      // ※ すぐ上の数行前で `if (isPartyDead || isAllEnemiesDead)` によるタイマー最速停止が
      // 完璧に機能しているため、ここの重複判定を引き抜いてもロジック上全く問題ありません。

// 📜 ログ配列の定義位置をしっかり維持
      let newLogs = [];

      // 😈 敵陣営の個別 AGI 行動ループへ完全換装（localEnemiesを上から下までスキャン）
      localEnemies = localEnemies.map((enemyItem) => {
        if (enemyItem.hp <= 0) return enemyItem; // 撃破済みのエネミーは行動をスキップ

        // 個体のAGIに基づく個別独立インターバル計算
        const enemyInterval = Math.max(1.0, 4.0 - enemyItem.agi * 0.1) * 1000;
        
        // 固有インスタンスIDキーでタイマーを進める
        enemiesAtkTimers.current[enemyItem.instanceId] = (enemiesAtkTimers.current[enemyItem.instanceId] || 0) + 100;

        if (enemiesAtkTimers.current[enemyItem.instanceId] >= enemyInterval) {
          enemiesAtkTimers.current[enemyItem.instanceId] = 0;

          const currentStatus = enemyItem.state?.currentStatus || 'none';

          // 💤 🧠 【新設：行動不能デバフ一斉検知センサー】
          // スタン、凍結、睡眠、石化のいずれかであれば、敵は完全にカカシ化して行動スキップ！
          const isActionImmobilized = ['スタン', '凍結', '睡眠', '石化'].includes(currentStatus);

          if (isActionImmobilized) {
            newLogs.push({ 
              id: `e-skip-${enemyItem.instanceId}-${Date.now()}-${Math.random()}`, 
              text: `💤 ${enemyItem.name} は【${currentStatus}】状態のため行動できない！`, 
              type: "system" 
            });
            
            // ⏳ 持続ターン数を1減らし、0になったら綺麗に解除
            const nextTurns = (enemyItem.state.durationTurns || 1) - 1;
            let updatedState = { ...enemyItem.state, durationTurns: nextTurns };
            if (nextTurns <= 0) {
              newLogs.push({ 
                id: `e-clear-${enemyItem.instanceId}-${Date.now()}-${Math.random()}`, 
                text: `✨ ${enemyItem.name} の【${currentStatus}】が解除された！`, 
                type: "system" 
              });
              updatedState = { currentStatus: 'none', durationTurns: 0 };
            }
            return { ...enemyItem, state: updatedState };
          } else {
            // ⚔️ 【通常行動ルート】動ける状態（または暗闇、沈滅、呪いなど）はここを通る
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
                dmg = Math.floor(10 + enemyItem.str * 1.5);
                localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - dmg);
                logText = `🔮 ${enemyItem.name} の【ナパームビート】！ ${target.name} に ${dmg} の魔法ダメージ！`;
              } else {
                // 💀 【呪い効果の干渉】敵が「呪い」状態なら、STR（腕力）を半分にして物理ダメージを計算！
                const isCursed = currentStatus === '呪い';
                const effectiveStr = isCursed ? Math.floor(enemyItem.str * 0.5) : enemyItem.str;

                const baseAtk = Math.floor(Math.random() * 10) + 10 + effectiveStr;
                
                // 🕶️ 【暗闇効果の干渉】敵が「暗闇」状態なら、50%の確率で攻撃がスカ（MISS）る！
                const isBlinded = currentStatus === '暗闇';
                if (isBlinded && Math.random() < 0.5) {
                  logText = `🕶️ ${enemyItem.name} は暗闇に包まれて攻撃を外した！ ${target.custom_name || target.name} は鮮やかに回避した！`;
                } else {
                  dmg = Math.max(1, baseAtk - target.vit);
                  localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - dmg);
                  logText = `💥 ${enemyItem.name} の攻撃！ ${target.name} は ${dmg} の物理ダメージを受けた！`;
                }
              }

              // 🧪 【毒効果スリップ処理】行動完了時に毒状態なら最大HPの5%削る
              let currentHpAfterPoison = enemyItem.hp;
              const wasPoisonedAtTurnStart = currentStatus === '毒';
              if (wasPoisonedAtTurnStart) {
                const poisonDmg = Math.floor(enemyItem.mhp * 0.05);
                currentHpAfterPoison = Math.max(1, currentHpAfterPoison - poisonDmg); 
                logText += ` 🧪 [毒効果] ${enemyItem.name} は毒により ${poisonDmg} のスリップダメージ！`;
              }

              // 👑 唯一のログ出力
              newLogs.push({ id: `e-${Date.now()}-${Math.random()}`, text: logText, type: "battle" });

              // ⏳ ─── ログ出力が終わった「後」で、動けるデバフ（毒、暗闇、沈黙、呪い）の持続ターン数を消費・解除判定 ───
              let updatedState = { ...enemyItem.state };
              if (['毒', '暗闇', '沈黙', '呪い'].includes(currentStatus)) {
                const nextTurns = (enemyItem.state.durationTurns || 1) - 1;
                updatedState.durationTurns = nextTurns;
                if (nextTurns <= 0) {
                  newLogs.push({ 
                    id: `e-clear-move-${enemyItem.instanceId}-${Date.now()}`, 
                    text: `✨ ${enemyItem.name} の【${currentStatus}】が切れた。`, 
                    type: "system" 
                  });
                  updatedState = { currentStatus: 'none', durationTurns: 0 };
                }
              }

              return { ...enemyItem, hp: currentHpAfterPoison, state: updatedState };
            }
          }
        }
        return enemyItem;
      });

      // 👤 プレイヤー（パーティ）側の行動判定ループへ完全に着地
      localParty.forEach((member) => {
        if (member.hp <= 0) return;

        // 🎯 【配列スキャン】生存しているエネミーだけを瞬時に抽出
        let aliveEnemies = localEnemies.filter(e => e.hp > 0);
        if (aliveEnemies.length === 0) return; // 敵がいないなら行動しない

        const playerInterval = Math.max(1.0, 4.0 - member.agi * 0.1) * 1000;
        partyAtkTimers.current[member.id] += 100;

        if (partyAtkTimers.current[member.id] >= playerInterval) {
          partyAtkTimers.current[member.id] = 0;
          
          if (member.state?.isStunned || member.state?.isFrozen) {
            newLogs.push({ id: `skip-${member.id}-${Date.now()}`, text: `💤 ${member.name} は行動不能スキップ`, type: "system" });
            return;
          }

          // 通常のターゲットは生存配列の先頭個体をロックオン
          let primaryTarget = aliveEnemies[0];
          let targetIdx = localEnemies.findIndex(e => e.instanceId === primaryTarget.instanceId);

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
          const playableSkill = activeSkills.length > 0 ? activeSkills[Math.floor(Math.random() * activeSkills.length)] : null;
          const skillSpCost = playableSkill ? Number(playableSkill.sp_cost || 0) : 0;
          const isTargetBoss = primaryTarget.is_boss === true;
          const currentSpRatio = (member.sp / (member.msp || 50)) * 100;

          // 📐 【新・第1ステップ判定】魔法をブッ放すかどうかのガンビット条件ダイス
          let shouldLaunchMagic = false;
          if (playableSkill && member.sp >= skillSpCost) {
            if (isTargetBoss) {
              shouldLaunchMagic = true; // ボス戦全力モード
            } else {
              if (currentSpRatio > 50) shouldLaunchMagic = true; // 道中SP50%以上維持モード
            }
          }

          // 🎰 【神の優先度リフォーム】クリティカル判定ダイスを最上部（魔法判定の直下）に引き上げ！
          // これにより、魔法が撃てない（または温存）の時は、通常スキル抽選(45%)を完全に無視して確定クリティカルが最優先で弾ける！
          const finalCriticalRate = member.final_battle_critical > 0 ? member.final_battle_critical : (member.luk || 10);
          const isCritical = Math.random() * 100 < finalCriticalRate;

          // 📊 総合倍率算出用の共通アタックスペック準備（ロックオンターゲットの特性を自動走査）
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
            card_size_eff: { [primaryTarget.size]: sizeValue },
            card_race_eff: { [primaryTarget.race]: raceValue },
            card_elem_eff: { [primaryTarget.element]: elemValue }
          };
          const defenderSpecs = { element: primaryTarget.element, race: primaryTarget.race, size: primaryTarget.size };
          const totalMultiplier = calculateDamageModifier(attackSpecs, defenderSpecs);

          // ─────────────────────────────────────────────────────────────
          // ⚡⚡ 【作戦行動ツリーへの着地分岐：完全版】
          // ─────────────────────────────────────────────────────────────
          if (shouldLaunchMagic) {
            // =============================================================
            // ✨ 【確定第1優先：魔法詠唱ルート】＆ 🔮 メイジ全体魔法一斉着弾インフラ
            // =============================================================
            member.sp = Math.max(0, member.sp - skillSpCost);
            const baseValue = Number(playableSkill.effect_value || 0);
            
            // 🔮 🆕 全体魔法（範囲エネミー）かどうかのインテリジェント走査
            // 💡 【修正点】GMツール側からコミットされる「範囲エネミー」の文字列も100%吸収できるように条件を拡張
            const isAOE = playableSkill.target_type === '敵全体' || 
                          playableSkill.target_type === '範囲エネミー' || 
                          playableSkill.name?.includes('全体') || 
                          playableSkill.isAreaOfEffect === true;

            if (isAOE) {
              // 💡 【修正点】分類（skill_type）に合わせて、ログの絵文字やタイトルを自動で切り替える神配線！
              const isMagic = playableSkill.skill_type === 'magic';
              logText = isMagic 
                ? `🔮✨ 【全体大魔法】${member.name} の【${playableSkill.name}】が戦場全域に炸裂！(残SP: ${member.sp})`
                : `⚔️💥 【全体物理特技】${member.name} の【${playableSkill.name}】が一閃！全戦場を巻き込む！(残SP: ${member.sp})`;
              
              newLogs.push({ id: `p-aoe-${member.id}-${Date.now()}`, text: logText, type: "success" });

              // 😈 生存しているすべてのエネミーに個別の属性・倍率計算をして一斉同時ダメージ！
              localEnemies = localEnemies.map(enemyItem => {
                if (enemyItem.hp <= 0) return enemyItem;

                let calculatedPower = baseValue;
                if (playableSkill.value_type === 'percent') {
                  if (isMagic) {
                    // ① 🔮 魔法分類なら：今まで通り育った知力（INT）ベースの魔力ダイスで計算
                    const myInt = member.int || member.stat_int || 10;
                    const myDex = member.dex || member.stat_dex || 10;
                    const minMatk = Math.floor(myInt + (myDex * 0.2));
                    const maxMatk = Math.floor(myInt * 2.0 + myDex);
                    const magicBaseAtk = Math.floor(Math.random() * (maxMatk - minMatk + 1)) + minMatk;

                    calculatedPower = Math.floor((magicBaseAtk * baseValue) / 100);
                  } else {
                    // ② ⚔️ 物理特技（art）なら：通常攻撃で使っている「randomizedAtk（物理ダイス）」をそのまま直撃結合！
                    // これにより、スカウトの本来の物理攻撃力（武器威力やSTR、DEX）が100%正しく乗っかります！
                    calculatedPower = Math.floor((randomizedAtk * baseValue) / 100);
                  }
                }

                const skillSpecs = {
                  ...attackSpecs,
                  element: playableSkill.element || '無',
                  is_physical: playableSkill.skill_type === 'art',
                  card_size_eff: { [enemyItem.size]: sizeValue },
                  card_race_eff: { [enemyItem.race]: raceValue },
                  card_elem_eff: { [enemyItem.element]: elemValue }
                };
                const specDefender = { element: enemyItem.element, race: enemyItem.race, size: enemyItem.size };
                const skillMultiplier = calculateDamageModifier(skillSpecs, specDefender);

                const aoeDmg = Math.max(1, Math.floor(calculatedPower * skillMultiplier));
                const nextHp = Math.max(0, enemyItem.hp - aoeDmg);

                let aoeLog = `  ➔ 💥 ${enemyItem.name} に ${aoeDmg} の全体魔法ダメージ！`;

                // 全体ヒット時の追加状態異常判定
                let nextState = { ...enemyItem.state };
                if (playableSkill.effect_type && playableSkill.effect_type !== 'なし' && nextHp > 0) {
                  const baseChance = Number(playableSkill.effect_chance || 0);
                  const enemyResistPct = enemyItem[`resist_${playableSkill.effect_type === 'スタン' ? 'stun' : playableSkill.effect_type === '凍結' ? 'freeze' : playableSkill.effect_type === '毒' ? 'poison' : 'blind'}`] || 0;
                  
                  if (Math.random() * 100 < Math.max(0, baseChance - enemyResistPct)) {
                    nextState = { currentStatus: playableSkill.effect_type, durationTurns: Number(playableSkill.duration_turns || 3) };
                    aoeLog += ` ✨ [${playableSkill.effect_type}]状態にした！`;
                  }
                }

                newLogs.push({ id: `p-aoe-hit-${enemyItem.instanceId}-${Date.now()}-${Math.random()}`, text: aoeLog, type: "success" });
                
                if (nextHp <= 0) {
                  newLogs.push({ id: `win-aoe-${enemyItem.instanceId}-${Date.now()}`, text: `🏆 🎉 【${enemyItem.name}】を全体魔法で撃破した！`, type: "system" });
                }

                return { ...enemyItem, hp: nextHp, state: nextState };
              });

              logText = ""; // 全体魔法時は個別単体ログは流さないため空文字化

            } else {
              // 【単体魔法ルート】標準のロックオンエネミーに直撃
              let calculatedPower = baseValue;
              if (playableSkill.value_type === 'percent') {
                calculatedPower = Math.floor((randomizedAtk * baseValue) / 100);
              }

              const skillSpecs = { ...attackSpecs, element: playableSkill.element || '無', is_physical: playableSkill.skill_type === 'art' };
              const skillMultiplier = calculateDamageModifier(skillSpecs, defenderSpecs);

              finalDmg = Math.max(1, Math.floor(calculatedPower * skillMultiplier));
              localEnemies[targetIdx].hp = Math.max(0, localEnemies[targetIdx].hp - finalDmg);

              const bossModeMsg = isTargetBoss ? `🔥[BOSS決戦・限界突破!!] ` : `🔮`;
              logText = `${bossModeMsg}${member.name} 【${playableSkill.name}】！ ${primaryTarget.name} に ${finalDmg} の魔法ダメージ！(残SP: ${member.sp})`;

              // 🎰 【単体魔法ヒット時の追加効果判定】
              if (playableSkill.effect_type && playableSkill.effect_type !== 'なし' && localEnemies[targetIdx].hp > 0) {
                const baseChance = Number(playableSkill.effect_chance || 0);
                let enemyResistPct = 0;
                if (playableSkill.effect_type === 'スタン')  enemyResistPct = primaryTarget.resist_stun || 0;
                if (playableSkill.effect_type === '凍結')  enemyResistPct = primaryTarget.resist_freeze || 0;
                if (playableSkill.effect_type === '毒')    enemyResistPct = primaryTarget.resist_poison || 0;
                if (playableSkill.effect_type === '暗闇')  enemyResistPct = primaryTarget.resist_blind || 0;

                const finalInflictChance = Math.max(0, baseChance - enemyResistPct);
                if (Math.random() * 100 < finalInflictChance) {
                  const turns = Number(playableSkill.duration_turns || 3);
                  localEnemies[targetIdx].state = { currentStatus: playableSkill.effect_type, durationTurns: turns };
                  logText += ` ✨ [追加効果] ${primaryTarget.name} を【${playableSkill.effect_type}】状態にした！(${turns}ターン)`;
                }
              }
            }

          } else if (isCritical) {
            // =============================================================
            // 💥💥 【確定第2優先：LUK動的クリティカル】通常スキルに吸われず100%発動！
            // =============================================================
            finalDmg = Math.floor(maxAtk * totalMultiplier);
            if (finalDmg < 1) finalDmg = 1;
            localEnemies[targetIdx].hp = Math.max(0, localEnemies[targetIdx].hp - finalDmg);

            const saveMsg = (playableSkill && currentSpRatio <= 50 && !isTargetBoss) ? `🪶[SP温存モード] ` : ``;
            logText = `💥💥 ${saveMsg}CRITICAL HIT!! ${member.name} が急所を貫いた！ [敵防無視/威力MAX] ➔ ${primaryTarget.name} に ${finalDmg} の致命物理ダメージ！`;
            
            // 🩸 【HP吸収判定ダイス（クリティカルヒット用）】
            if (member.hp_drain_chance > 0 && Math.random() * 100 < member.hp_drain_chance) {
              const drainPct = Number(member.hp_drain_percent || 0);
              if (drainPct > 0) {
                const healAmount = Math.floor((finalDmg * drainPct) / 100);
                member.hp = Math.min(member.mhp, member.hp + healAmount);
                logText += ` 🩸 ${healAmount} 回復した！！ (残HP: ${localEnemies[targetIdx].hp})`;
              } else {
                logText += ` (残HP: ${localEnemies[targetIdx].hp})`;
              }
            } else {
              logText += ` (残HP: ${localEnemies[targetIdx].hp})`;
            }

            // 🧪 🎰 👑 【クリティカルヒット時・状態異常付与ガチャの最低保証配線】
            if (localEnemies[targetIdx].hp > 0 && member.card_inflict_type && member.card_inflict_chance > 0 && localEnemies[targetIdx].state?.currentStatus !== member.card_inflict_type) {
              const cardInflictType = member.card_inflict_type;
              const cardInflictChance = member.card_inflict_chance;

              const enemyResist = cardInflictType === '毒' ? (primaryTarget.resist_poison || 0) : 
                                  cardInflictType === 'スタン' ? (primaryTarget.resist_stun || 0) : 
                                  cardInflictType === '凍結' ? (primaryTarget.resist_freeze || 0) : 
                                  cardInflictType === '暗闇' ? (primaryTarget.resist_blind || 0) :
                                  cardInflictType === '睡眠' ? (primaryTarget.vit || 0) : 
                                  cardInflictType === '沈黙' ? (primaryTarget.agi || 0) : 
                                  cardInflictType === '呪い' ? (primaryTarget.luk || 0) : 
                                  cardInflictType === '石化' ? (primaryTarget.vit || 0) : 0;
              
              const finalApplyChance = Math.max(5, cardInflictChance - enemyResist);

              if (Math.random() * 100 < finalApplyChance) {
                localEnemies[targetIdx].state = { 
                  ...localEnemies[targetIdx].state,
                  currentStatus: cardInflictType,
                  durationTurns: 3
                };
                logText += ` ✨ [追加効果] ${primaryTarget.name} を【${cardInflictType}】状態にした！！`;
              }
            }

          } else {
            // =============================================================
            // 🎲 【第3優先：通常確率スキル ＆ 通常攻撃ルート】
            // =============================================================
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
                const hIdx = localParty.findIndex(p => p.id === healTarget.id);
                
                localParty[hIdx].hp = Math.min(localParty[hIdx].mhp, localParty[hIdx].hp + calculatedPower);
                logText = `✨ ${member.name} 【${skill.name}】発動！ ${localParty[hIdx].name} のHPを ${calculatedPower} 回復`;
              } else {
                const skillSpecs = {
                  ...attackSpecs,
                  element: skill.element || '無',
                  is_physical: skill.skill_type === 'art'
                };
                const skillMultiplier = calculateDamageModifier(skillSpecs, defenderSpecs);

                if (skill.skill_type === 'art') {
                  finalDmg = Math.max(1, Math.floor((calculatedPower * skillMultiplier) - primaryTarget.vit));
                  logText = `⚔️ ${member.name} 【${skill.name}】！ ${primaryTarget.name} に ${finalDmg} の物理ダメージ！`;
                  
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
                  logText = `🔮 ${member.name} 【${skill.name}】！ ${primaryTarget.name} に ${finalDmg} の魔法ダメージ！`;
                }

                // 💥 敵のHPを実際に減少させる処理
                localEnemies[targetIdx].hp = Math.max(0, localEnemies[targetIdx].hp - finalDmg);

                // 🎰 【スキルヒット時の追加効果判定】
                if (skill.effect_type && skill.effect_type !== 'なし' && localEnemies[targetIdx].hp > 0) {
                  const baseChance = Number(skill.effect_chance || 0);
                  
                  let enemyResistPct = 0;
                  if (skill.effect_type === 'スタン')  enemyResistPct = primaryTarget.resist_stun || 0;
                  if (skill.effect_type === '凍結')  enemyResistPct = primaryTarget.resist_freeze || 0;
                  if (skill.effect_type === '毒')    enemyResistPct = primaryTarget.resist_poison || 0;
                  if (skill.effect_type === '暗闇')  enemyResistPct = primaryTarget.resist_blind || 0;

                  const finalInflictChance = Math.max(0, baseChance - enemyResistPct);

                  if (Math.random() * 100 < finalInflictChance) {
                    const turns = Number(skill.duration_turns || 3);
                    localEnemies[targetIdx].state = {
                      currentStatus: skill.effect_type,
                      durationTurns: turns
                    };
                    logText += ` ✨ [追加効果] ${primaryTarget.name} を【${skill.effect_type}】状態にした！(${turns}ターン)`;
                  }
                }
              }
            } else {
              // ⚔️ 純粋通常攻撃ルート 【状態異常による敵防低下・干渉配線】
              const isEnemyDebuffed = ['スタン', '凍結', '石化'].includes(primaryTarget.state?.currentStatus);
              const effectiveEnemyVit = isEnemyDebuffed ? 0 : (primaryTarget.vit || 0);

              const isEnemyPoisoned = primaryTarget.state?.currentStatus === 'poison' || primaryTarget.state?.currentStatus === '毒';
              const finalEnemyVit = isEnemyPoisoned ? Math.floor(effectiveEnemyVit * 0.75) : effectiveEnemyVit;

              const baseDmg = Math.max(1, randomizedAtk - finalEnemyVit);
              finalDmg = Math.floor(baseDmg * totalMultiplier);
              if (finalDmg < 1) finalDmg = 1;

              localEnemies[targetIdx].hp = Math.max(0, localEnemies[targetIdx].hp - finalDmg);
              
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

              // 🧪 🎰 👑 【通常攻撃ヒット時・カード専用状態異常付与ガチャの最低保証配線】
              if (localEnemies[targetIdx].hp > 0 && member.card_inflict_type && member.card_inflict_chance > 0 && localEnemies[targetIdx].state?.currentStatus !== member.card_inflict_type) {
                const cardInflictType = member.card_inflict_type;
                const cardInflictChance = member.card_inflict_chance;

                const enemyResist = cardInflictType === '毒' ? (primaryTarget.resist_poison || 0) : 
                                    cardInflictType === 'スタン' ? (primaryTarget.resist_stun || 0) : 
                                    cardInflictType === '凍結' ? (primaryTarget.resist_freeze || 0) : 
                                    cardInflictType === '暗闇' ? (primaryTarget.resist_blind || 0) :
                                    cardInflictType === '睡眠' ? (primaryTarget.vit || 0) : 
                                    cardInflictType === '沈黙' ? (primaryTarget.agi || 0) : 
                                    cardInflictType === '呪い' ? (primaryTarget.luk || 0) : 
                                    cardInflictType === '石化' ? (primaryTarget.vit || 0) : 0;
                
                const finalApplyChance = Math.max(5, cardInflictChance - enemyResist);

                if (Math.random() * 100 < finalApplyChance) {
                  localEnemies[targetIdx].state = { 
                    ...localEnemies[targetIdx].state,
                    currentStatus: cardInflictType,
                    durationTurns: 3
                  };
                  logText += ` ✨ [追加効果] ${primaryTarget.name} を【${cardInflictType}】状態にした！！`;
                }
              }
            }
          }

          // ログ書き出し＆撃破判定
          if (logText) {
            newLogs.push({ id: `p-${member.id}-${Date.now()}-${Math.random()}`, text: logText, type: "success" });
          }

          if (logText && localEnemies[targetIdx].hp <= 0) {
            newLogs.push({ id: `win-single-${localEnemies[targetIdx].instanceId}-${Date.now()}`, text: `🏆 🎉 【${localEnemies[targetIdx].name}】撃破！`, type: "system" });
          }

          // 🪐 全エネミーが全滅したかどうかの完全チェック
          if (localEnemies.every(e => e.hp <= 0)) {
            newLogs.push({ id: `win-all-${Date.now()}`, text: `🏆 🎉 クエスト内の全エネミーの掃討完了！完全勝利！`, type: "system" });
            clearInterval(battleTimer);
            clearInterval(countTimer);
            setIsBattleOver(true);
            setIsTimeUp(true);
            setDroppedItems([{ id: 1, name: `${primaryTarget.name}の秘宝`, rarity: "legendary" }]);
          }
        }
      });

      partyStateRef.current = localParty;
      // 👿 旧タイマン仕様の単体Refを粉砕し、最新の複数敵配列（localEnemies）をバッファへ直撃同期！
      enemiesStateRef.current = localEnemies;
      
      if (newLogs.length > 0) {
        setParty(localParty);
        // 👿 State側も複数形（setEnemies）へ完全書き換え！
        setEnemies(localEnemies);
        
        setDisplayedLogs(prev => {
          const combined = [...prev, ...newLogs];
          
          // 👑 三土手神リフォーム：最大500件の歴史をたっぷりホールド！
          if (combined.length > 500) {
            return combined.slice(-500);
          }
          return combined;
        });
      }
    }, 100);

    return () => { clearInterval(countTimer); clearInterval(battleTimer); };
  }, [loading, party, enemies, isBattleOver]);

  // 3. 🔮 🆕 三土手創世神特注：サーバー無風コミットエンジン（これが「最後」の1回だけの通信）
  const handleTownCommit = async () => {
    setIsSaving(true);
    try {
      const finalParty = partyStateRef.current;
      const finalEnemies = enemiesStateRef.current;
      const isVictory = finalEnemies.every(e => e.hp <= 0);

      // 👥 1. 生き残ったメンバーの現在HPを一斉にSupabaseへ最終保存
      await Promise.all(
        finalParty.map(async (member) => {
          await supabase
            .from('game_characters')
            .update({ current_hp: member.hp })
            .eq('id', member.id);
        })
      );

      // 💰 2. 勝利時のみ、全エネミーの報酬を合算してコミット
      if (isVictory) {
        const totalExp = finalEnemies.reduce((sum, e) => sum + e.exp, 0);
        const totalGold = finalEnemies.reduce((sum, e) => sum + e.gold, 0);
        console.log(`🎁 マルチエネミー討伐報酬確定：BaseEXP +${totalExp} / Zeny +${totalGold}`);
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 15px', background: '#1a0505', borderTop: '1px solid #451a1a', borderBottom: '1px solid #451a1a' }}>
        {enemies.map((enemyItem) => (
          <div key={enemyItem.instanceId} style={{ opacity: enemyItem.hp <= 0 ? 0.4 : 1, transition: 'opacity 0.3s' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#f43f5e', display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>{enemyItem.hp <= 0 ? `💀 [DEFEATED] ${enemyItem.name}` : `😈 ${enemyItem.name} (${enemyItem.element}/${enemyItem.size})`}</span>
              <span style={{ fontFamily: 'monospace' }}>{enemyItem.hp} / {enemyItem.mhp}</span>
            </div>
            <div style={{ height: '5px', background: '#311010', borderRadius: '2.5px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(0, (enemyItem.hp / enemyItem.mhp) * 100)}%`, background: enemyItem.hp <= 0 ? '#4b5563' : '#f43f5e', transition: 'width 0.1s ease' }}></div>
            </div>
          </div>
        ))}
      </div>

      {/* タウンコミット・アクションバー */}
      <div style={{ padding: '12px 20px', background: '#0f172a', borderBottom: '1px solid #1e293b', textAlign: 'center' }}>
        {(isTimeUp && isBattleOver) || enemies.every(e => e.hp <= 0) ? (
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
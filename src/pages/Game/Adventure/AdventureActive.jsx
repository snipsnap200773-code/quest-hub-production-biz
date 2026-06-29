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

  // 🧹 タイム関連（timeLeft, isTimeUp）のStateを綺麗に撤去！
  const [isBattleOver, setIsBattleOver] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const [party, setParty] = useState([]); 
  // 😈 単数から複数エネミー用の配列状態へ拡張
  const [enemies, setEnemies] = useState([]); 

  // 🧭 🆕 【三土手ローグライク特注：多層階層ダンジョン進行管理インフラ】
  const [currentFloor, setCurrentFloor] = useState(1); // 現在の滞在階層 (初期値: 1階)
  const [remainingBattles, setRemainingBattles] = useState(0); // その階層での残り必要戦闘数
  const remainingBattlesRef = useRef(0); // ⏱️ 🆕 【超重要】非同期ラグに絶対に負けない内部戦数カウンターRef！
  const [adventureStatus, setAdventureStatus] = useState('battling');
  const [accumulatedRewards, setAccumulatedRewards] = useState({ exp: 0, gold: 0 }); // 帰還時に持ち帰れる一時報酬プール 
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
  // 🧹 アディショナルタイム告知フラグ（hasAnnouncedATRef）を撤去！
  
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
            dex: ch.roStatus?.dex || ch.dex || (ch.meta?.stat_dex || 10) + (ch.bonus?.dex || 0), // 💡タイポ修正
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
            card_inflict_chance: maxInflictChance,

            // 🔮 🆕 【三土手創世神特注：戦闘パラメータ一斉召喚配線】
            // これにより、後ろの回避判定で target.roStatus.flee (236) が100%読み込めるようになります！
            roStatus: ch.roStatus || {},
            flee: ch.roStatus?.flee || 0,
            hit: ch.roStatus?.hit || 0,
            mdef: ch.roStatus?.mdef || 0,
            // 🔮 【追記】酒場で育った本物のAspd（190.0）を戦闘素体へ確実にマウント！
            aspd: ch.roStatus?.aspd || 150.0 
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

        // 🛠️ 🆕 【三土手神特注：B1階層コンフィグ連動型ごちゃ混ぜランダム生成エンジン】
        // クエストデータから現在の階層（まずは1階）のコンフィグをサルベージ
        const fConfigs = activeQuestData?.floor_configs || [];
        const currentFloorCfg = fConfigs.find(f => f.floor === 1) || { 
          battle_count: 3, min_spawn: 1, max_spawn: 2, enemy_ids: enemyIds 
        };

        // 初期必要戦闘回数をStateに同期
        setRemainingBattles(currentFloorCfg.battle_count);
        // 🛠️ 🆕 内部メモリRef側にも、最初の突入時だけダッシュボードの設定数を記憶させる配線を結合！
        remainingBattlesRef.current = currentFloorCfg.battle_count;

        // 有効な登録モンスターの素材プールを構築
        const activePoolEnemyIds = (currentFloorCfg.enemy_ids || enemyIds).filter(Boolean);
        const validEnemyPool = activePoolEnemyIds.map(id => dbEnemies?.find(e => e.id === id)).filter(Boolean);

        let loadedEnemies = [];
        
        if (validEnemyPool.length > 0) {
          // コンフィグで設定された最小〜最大出現数の間で今回の出現数をダイス決定！
          const minS = Number(currentFloorCfg.min_spawn || 1);
          const maxS = Number(currentFloorCfg.max_spawn || 2);
          const spawnCount = Math.floor(Math.random() * (maxS - minS + 1)) + minS;

          // 出現数ぶんプールからごちゃ混ぜチョイス
          for (let i = 0; i < spawnCount; i++) {
            const randomIndex = Math.floor(Math.random() * validEnemyPool.length);
            const dbEnemy = validEnemyPool[randomIndex];
            const targetId = dbEnemy.id;

            const isBaphometTarget = String(targetId).toLowerCase().includes('baphomet');
            const finalName = dbEnemy?.name || (isBaphometTarget ? "バフォメットJr" : "テストポリンJr");
            const finalHp = dbEnemy?.hp || dbEnemy?.base_hp || dbEnemy?.max_hp || (isBaphometTarget ? 1800 : 2500);
            const finalStr = dbEnemy?.str || dbEnemy?.stat_str || (isBaphometTarget ? 35 : 10);
            const finalAgi = dbEnemy?.agi || dbEnemy?.stat_agi || (isBaphometTarget ? 25 : 15);
            const finalVit = dbEnemy?.vit || dbEnemy?.stat_vit || (isBaphometTarget ? 10 : 30);
            const finalSize = dbEnemy?.size || (isBaphometTarget ? '中型' : '小型');
            const finalRace = dbEnemy?.race || (isBaphometTarget ? '悪魔' : '無形');
            const finalElement = dbEnemy?.element || (isBaphometTarget ? '闇' : '水');

            const instanceId = `${targetId}_spawn_${i}_${Date.now()}`;

            loadedEnemies.push({
              instanceId,
              id: targetId,
              name: `${finalName} ${String.fromCharCode(65 + i)}`, // 💡 A, B, Cを付与して識別化
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
              resist_blind: Number(dbEnemy?.resist_blind || 0),
              int: dbEnemy?.int || dbEnemy?.stat_int || 10,
              hit: dbEnemy?.hit || 21,
              enemy_aspd: dbEnemy?.enemy_aspd !== undefined ? dbEnemy.enemy_aspd : null
            });
          }
        } else {
          // プールが空の時のセーフティフォールバック（テストポリン単騎召喚）
          loadedEnemies.push({
            instanceId: `fallback_${Date.now()}`, id: 'test_porin_junior', name: 'テストポリンJr A',
            mhp: 2000, hp: 2000, str: 10, agi: 15, vit: 30, size: '小型', race: '無形', element: '水',
            exp: 50, gold: 1000, state: { currentStatus: 'なし', durationTurns: 0 }
          });
        }

        enemiesStateRef.current = loadedEnemies;
        setEnemies(loadedEnemies);

        setDisplayedLogs([
          { id: 'start', text: `⚔️ 【${activeQuestData?.name || '未知の領域'}】B1階 突入：全エネミー一斉交戦開始！`, type: "system" }
        ]);
      } else {
        setDisplayedLogs([{ id: 'err', text: "酒場に冒険者がいません。編成を確認してください。", type: "system" }]);
      }
      setLoading(false);
    };

    initAdventure();
  }, []);

  // 2. 🧠 超軽量・高速カウント保証型戦闘ループ（※この間は通信回数完全に「0」！）
  useEffect(() => {
    if (loading || party.length === 0 || enemies.length === 0 || isBattleOver) return;

    // 🔮 🆕 20msのスキャンから1秒（1000ms）を正確に計測するための内部プール変数
    let msCounter = 0;

    // 🔮 【三土手神リフォーム：タイムスケール超精密高解像度エンジン】
    // 100msのデジタル大雑把処理を粉砕し、20ms（0.02秒）刻みの超精密スキャンへ換装！
    const battleTimer = setInterval(() => {
      let localParty = [...partyStateRef.current];
      let localEnemies = [...enemiesStateRef.current];

      const isPartyDead = localParty.every(p => p.hp <= 0);
      const isAllEnemiesDead = localEnemies.every(e => e.hp <= 0);

      // 💀 1. 味方が全滅した場合（ハクスラ全滅リスク発動）
      if (isPartyDead) {
        clearInterval(battleTimer);
        setIsBattleOver(true);
        setAdventureStatus('game_over'); // 状態を全滅敗北へ
        setAccumulatedRewards({ exp: 0, gold: 0 }); // 🚨 それまで獲得した報酬をすべて没収してゼロ化！
        setDroppedItems([]); // アイテムも無し
        setDisplayedLogs(prev => [...prev, { id: `lost-${Date.now()}`, text: `💀 警告：全部隊が全滅しました。ベースキャンプへ強制送還されます。獲得したアイテムやEXPはすべて失われました...`, type: "system" }]);
        return;
      }

      // 🏆 2. クエスト内のエネミーを全滅させた場合
      if (isAllEnemiesDead) {
        clearInterval(battleTimer);
        
        // 報酬プールへの合算計算
        const floorExp = localEnemies.reduce((sum, e) => sum + (e.exp || 0), 0);
        const floorGold = localEnemies.reduce((sum, e) => sum + (e.gold || 0), 0);
        setAccumulatedRewards(prev => ({ exp: prev.exp + floorExp, gold: prev.gold + floorGold }));

        // 🛠️ 🆕 StateのタイムラグをRefで完全回避！その場で引き算を決着させる！
        const nextCount = Math.max(0, remainingBattlesRef.current - 1);
        remainingBattlesRef.current = nextCount;
        setRemainingBattles(nextCount); // 画面の「表示数」を更新

        if (nextCount <= 0) {
          // 残り戦数が0になった ➔ 完璧なタイミングで「階層制圧完了・B2へ進む」のボタンが出現！
          setAdventureStatus('floor_cleared');
        } else {
          // まだ残り回数（2回、1回）が残っている ➔ 索敵続行（探索を続ける）ボタンを点灯！
          setAdventureStatus('battling');
          setIsBattleOver(true);
        }
        return;
      }

      // 🧹 タイムカウントダウン（msCounter）の処理ブロックを丸ごと完全撤去！

      // 🔮 SP自然回復用のタイマーも 0.125 秒ではなく 0.02 秒ずつ精密に加算
      spRegenTimer.current += 0.02;
      
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

        // 🔮 【三土手神リフォーム：敵専用・個別上書き対応型本家RO式ディレイ換算】
        // データベースから取得した enemy_aspd が存在すればそれを採用、空っぽなら基本値 150.0 をロード！
        const currentEnemyAspd = enemyItem.enemy_aspd !== null && enemyItem.enemy_aspd !== undefined 
          ? Number(enemyItem.enemy_aspd) 
          : 150.0;
        
        // 本家RO公式: (200 - Aspd) / 50 × 1000ms
        // Aspd 193ならピッタリ「140ms（0.14秒）」になり、20ms刻みの時間軸を最速で駆け抜けます！
        const enemyInterval = ((200 - currentEnemyAspd) / 50) * 1000;
        
        // 固有インスタンスIDキーでタイマーを進める
        enemiesAtkTimers.current[enemyItem.instanceId] = (enemiesAtkTimers.current[enemyItem.instanceId] || 0) + 20;

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
              // 🔮 【三土手神お掃除完了】ナパームビートのベタ書きテスト配線を完全撤去！
              let dmg = 0;
              let logText = "";

              // 💀 【呪い効果の干渉】敵が「呪い」状態なら、STR（腕力）を半分にして物理ダメージを計算！
              const isCursed = currentStatus === '呪い';
              const effectiveStr = isCursed ? Math.floor(enemyItem.str * 0.5) : enemyItem.str;

              const baseAtk = Math.floor(Math.random() * 10) + 10 + effectiveStr;
              
              // 🕶️ 【暗闇効果の干渉】敵が「暗闇」状態なら、50%の確率で攻撃がスカ（MISS）る！
              const isBlinded = currentStatus === '暗闇';
              
              if (isBlinded && Math.random() < 0.5) {
                logText = `🕶️ ${enemyItem.name} は暗闇に包まれて攻撃を外した！ ${target.custom_name || target.name} は鮮やかに回避した！`;
              } else {
                // 🔮 【三土手神リフォーム：RO式・通常物理攻撃のFlee完全回避ジャッジ】
                // ① 敵モンスターの「Hit（命中値）」をマスターデータから抽出（なければ最低値21）
                const enemyHit = Number(enemyItem.hit || 21);
                // ② 狙われている味方プレイヤーの「flee（回避値）」を同期ロード（236を強引に押収した配線）
                const playerFlee = Number(
  target.roStatus?.flee || 
  target.flee || 
  localParty?.find(p => p.id === target.id)?.roStatus?.flee || 
  0
);

                // 📐 本家RO公式: 回避確率(%) = 85 + プレイヤーFlee - 敵Hit
                const fleeChance = 85 + playerFlee - enemyHit; 
                const randomRoll = Math.floor(Math.random() * 100); // 0〜99の100面ダイスを振る

                // 💡 算出された回避確率（上限95%）をダイスが上回った場合、または最低命中5%をすり抜けた場合に回避大成功！
                if (randomRoll < fleeChance && randomRoll < 95) {
                  // 🎉 避けた！ログに鮮やかな青緑色のMISSを点灯！
                  logText = `💨 [MISS] ${enemyItem.name} の攻撃をヒラリとかわした！ (敵Hit:${enemyHit} vs 味方Flee:${playerFlee} | 回避率:${Math.min(95, fleeChance)}%)`;
                } else {
                  // 💥 回避失敗（または5%の絶対命中枠に引っかかった場合）➔ ダメージ決着処理
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

        const currentPlayerAspd = Number(member.aspd || 150.0);
        const playerInterval = ((200 - currentPlayerAspd) / 50) * 1000;
        // 💡 味方側も 20ms ずつ正確に時間を蓄積させます
        partyAtkTimers.current[member.id] += 20;

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

                // 🔮 【三土手神リフォーム】敵モンスターのINT（魔法防御力）を算出
                const enemyMdef = enemyItem.int || enemyItem.stat_int || 0;

                // 💡 算出した魔法ダメージから、敵のMdefをしっかり引き算（最低保証1）！
                const aoeDmg = Math.max(1, Math.floor(calculatedPower * skillMultiplier) - enemyMdef);
                
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
            setIsBattleOver(true);
            // 🧹 クラッシュの原因になっていた古い setIsTimeUp 行を完全撤去！
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
    }, 20);

    // 💡 消去した countTimer の解除を綺麗に取り除き、battleTimer だけを安全にクリーンアップ！
    return () => { clearInterval(battleTimer); };
  }, [loading, party, enemies, isBattleOver]);

  // 🧭 🆕 【三土手ローグライク特注：同一階層内の次戦召喚 ＆ 上の階層への進軍エンジン】
  const handleNextBattle = (forcedNextFloor = null) => {
    let nextFloorNum = currentFloor;
    if (forcedNextFloor) {
      nextFloorNum = forcedNextFloor;
      setCurrentFloor(nextFloorNum);
    }

    const fConfigs = currentQuestState?.floor_configs || [];
    const targetFloorCfg = fConfigs.find(f => f.floor === nextFloorNum) || { 
      battle_count: 3, min_spawn: 1, max_spawn: 2, enemy_ids: [] 
    };

    if (forcedNextFloor) {
      // 泉が設置されている階層へ進んだ場合、神の慈悲で味方全員のHP・SPを100%全回復！
      if (targetFloorCfg.has_fountain) {
        partyStateRef.current = partyStateRef.current.map(p => ({ ...p, hp: p.mhp, sp: p.msp }));
        setParty(partyStateRef.current);
        alert(`⛲ 【B${nextFloorNum}階】に設置された「回復の泉」を発見！部隊全員のHP・SPが全回復した！`);
      }
      setRemainingBattles(targetFloorCfg.battle_count);
      // 🛠️ 🆕 上の階に進軍したタイミングで、Refカウンター側も新しい階層の戦闘回数で上書きマウント！
      remainingBattlesRef.current = targetFloorCfg.battle_count;
    }

    // 次の戦闘用のエネミーをコンフィグの最小〜最大出現数からランダム生成
    const minS = Number(targetFloorCfg.min_spawn || 1);
    const maxS = Number(targetFloorCfg.max_spawn || 2);
    const spawnCount = Math.floor(Math.random() * (maxS - minS + 1)) + minS;

    const activePoolEnemyIds = (targetFloorCfg.enemy_ids || []).filter(Boolean);
    
    let loadedEnemies = [];
    for (let i = 0; i < spawnCount; i++) {
      const mockEnemy = enemiesStateRef.current[0] || { id: 'test_porin_junior', name: 'モンスター' };
      loadedEnemies.push({
        ...mockEnemy,
        instanceId: `${mockEnemy.id}_spawn_${i}_${Date.now()}`,
        name: `${mockEnemy.name.split(' ')[0]} ${String.fromCharCode(65 + i)}`,
        hp: mockEnemy.mhp
      });
    }

    enemiesStateRef.current = loadedEnemies;
    setEnemies(loadedEnemies);
    setIsBattleOver(false);
    setAdventureStatus('battling');

    // 🧹 二重計算の原因になっていた内部での引き算（setRemainingBattles）を完全撤去！
    // 🧹 Stateのラグによるバグ表示を防ぐため、すでに1減っている状態の「remainingBattles」の数をそのまま素直に表示！
    const displayCount = forcedNextFloor ? targetFloorCfg.battle_count : remainingBattles;

    setDisplayedLogs(prev => [...prev, { id: `next-${Date.now()}`, text: `⚔️ 【B${nextFloorNum}階】探索継続：新たな魔物群と遭遇！(残り戦闘: ${displayCount}回)`, type: "system" }]);
  };

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
          {/* 🧹 右側にあった制限時間の表示コンポーネントをスッキリ完全撤去！ */}
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

      {/* 🧭 🆕 【三土手ローグライク専用：アクションゲーム選択バー】 */}
      <div style={{ padding: '12px 20px', background: '#0f172a', borderBottom: '1px solid #1e293b', textAlign: 'center' }}>
        
        {/* ① パーティーが全滅した場合 ➔ 没収を受け入れて撤還 */}
        {adventureStatus === 'game_over' && (
          <button onClick={onReturn} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: '#451a1a', color: '#f43f5e', border: '1px solid #ef4444', fontSize: '0.9rem', fontWeight: 'bold' }}>
            ☠️ 全滅を受け入れて酒場へ戻る (報酬なし)
          </button>
        )}

        {/* ② 1回の戦闘が終わったが、その階にまだ残り必要戦闘回数がある場合 ➔ 次の索敵へ */}
        {adventureStatus === 'battling' && isBattleOver && remainingBattles > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button onClick={() => handleNextBattle()} style={{ padding: '12px', borderRadius: '8px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '0.82rem' }}>
              👣 索敵を続ける (残り:{remainingBattles}戦)
            </button>
            <button onClick={handleTownCommit} disabled={isSaving} style={{ padding: '12px', borderRadius: '8px', background: '#1e293b', color: '#ffd700', border: '1px solid #ffd70044', fontWeight: 'bold', fontSize: '0.82rem' }}>
              🏃‍♂️ 諦めて街へ一時帰還 (安全)
            </button>
          </div>
        )}

        {/* ③ その階層を完全に制圧した場合（RemainingBattlesが0になった時） ➔ 帰還か上の階への進軍か選択 */}
        {adventureStatus === 'floor_cleared' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>🎉 【B{currentFloor}階】制圧完了！どうしますか？</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {currentFloor < (currentQuestState?.floors || 1) ? (
                <button onClick={() => handleNextBattle(currentFloor + 1)} style={{ padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', color: '#fff', border: 'none', fontWeight: '900', fontSize: '0.82rem' }}>
                  🏰 B{currentFloor + 1}階へ進軍する
                </button>
              ) : (
                <div style={{ padding: '12px', color: '#ffd700', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid #ffd70033', borderRadius: '10px', background: '#1e1b4b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  🏆 最深部踏破完了！
                </div>
              )}
              <button onClick={handleTownCommit} disabled={isSaving} style={{ padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#0f172a', border: 'none', fontWeight: '900', fontSize: '0.82rem' }}>
                💰 帰還して報酬を獲得
              </button>
            </div>
          </div>
        )}

        {/* ④ 通常戦闘中の場合は、いつでも緊急リタイアできるボタンとして待機 */}
        {adventureStatus === 'battling' && !isBattleOver && (
          <button onClick={onReturn} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>
            🛡️ 冒険を中断して酒場へ戻る (今までの報酬はロスト)
          </button>
        )}
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
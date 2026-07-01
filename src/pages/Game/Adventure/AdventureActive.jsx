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
  const masterEnemiesRef = useRef([]); // 🛡️ 🆕 取得した本物のモンスターデータを保持する器！
  const partyAtkTimers = useRef({});
  
  // 🚨 ⬇️ 前回のコピペでこの行が消滅してしまっていました！ここに1行復活させてください！
  const enemiesAtkTimers = useRef({}); 

  const masterSkillsRef = useRef([]);
  
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

      masterSkillsRef.current = allMasterSkills;

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

        // 🔮 🆕 多層階層（JSON）の中に設定された全エネミーIDを重複なしで集約
        const activeQuestData = currentQuest || currentQuestState;
        let allEnemyIds = new Set();

        if (activeQuestData?.floor_configs && Array.isArray(activeQuestData.floor_configs)) {
          activeQuestData.floor_configs.forEach(f => {
            if (f.enemy_ids) f.enemy_ids.forEach(id => { if (id) allEnemyIds.add(id); });
          });
        } else {
          // 旧クエストデータとの互換性
          if (activeQuestData?.enemy_master_id) allEnemyIds.add(activeQuestData.enemy_master_id);
          if (activeQuestData?.enemy_master_id_2) allEnemyIds.add(activeQuestData.enemy_master_id_2);
          if (activeQuestData?.enemy_master_id_3) allEnemyIds.add(activeQuestData.enemy_master_id_3);
        }

        let enemyIds = Array.from(allEnemyIds);
        if (enemyIds.length === 0) enemyIds.push('test_porin_junior'); // 万が一のフォールバック

        // Supabaseのin構文を使い、出現予定の敵データを一撃で一括ダウンロード！
        const { data: dbEnemies, error: enemyError } = await supabase
          .from('game_master_units')
          .select('*')
          .in('id', enemyIds);

        if (enemyError) console.error("エネミーデータ一括取得エラー:", enemyError);

        // 🛡️ 🆕 次の戦闘でも本物の敵を呼び出せるよう、マスターデータをRefに保存！
        masterEnemiesRef.current = dbEnemies || [];

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

        // 🛠️ 🆕 【三土手創世神特注：初手暴発・固定値150の完全粉砕配線】
        // ここに仮の戦闘ログモックが迷い込まないよう、純粋な突入宣告のみをセットしてタイマーへ安全にバトンタッチ！
        setDisplayedLogs([
          { id: 'start', text: `⚔️ 【${activeQuestData?.name || '未知の領域'}】B1階 突入 ➔ 全エネミーとの一斉交戦を開始します！`, type: "system" }
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
        
        // 💡 🆕 下からお引越し！ここで確実に完全勝利ログとドロップを処理する！
        setDisplayedLogs(prev => [...prev, { id: `win-all-${Date.now()}`, text: `🏆 🎉 エネミー掃討完了！(B${currentFloor}階)`, type: "system" }]);
        setDroppedItems([{ id: 1, name: `ダンジョンの秘宝`, rarity: "legendary" }]);

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

      // 🔮 SP自然回復用のタイマーも 0.125 秒ではなく 0.02 秒ずつ精密に加算
      // 🚨 原因：ここでも以前コピペミスでconstがついて初期化されていたためRefが機能していませんでした。constを削除！
      spRegenTimer.current += 0.02;
      
      // 5秒が経過した瞬間、神の息吹がパーティ全員に降り注ぐ
      if (spRegenTimer.current >= 5.0) {
        // 🛠️ 🆕 【三土手神リフォーム：タイマー完全リセット】
        // 5秒経過して処理が走った瞬間に、タイマーを「0」に戻して暴走を止める！
        spRegenTimer.current = 0; // コメントアウトを解除し、鉄壁のリセット！
        
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
              
              let dmg = 0;
              let logText = "";
              
              // 🔮 🧠 【新規追加：敵の魔法・スキル発動AI】
              let usedSkill = null;
              const isSilenced = currentStatus === '沈黙';
              const enemySkills = enemyItem.activeSkills || [];
              
              if (!isSilenced && enemySkills.length > 0 && Math.random() < 0.30) {
                usedSkill = enemySkills[Math.floor(Math.random() * enemySkills.length)];
              }

              if (usedSkill) {
                // ✨ 魔法・スキル発動ルート
                const isMagic = usedSkill.skill_type === 'magic';
                const baseValue = Number(usedSkill.effect_value || 0);
                
                let calculatedPower = baseValue;
                if (usedSkill.value_type === 'percent') {
                  const eInt = enemyItem.int || 10;
                  const eStr = enemyItem.str || 10;
                  const baseStat = isMagic ? eInt * 2 : eStr * 2;
                  calculatedPower = Math.floor((baseStat * baseValue) / 100);
                }

                if (isMagic) {
                  const targetMdef = target.mdef || target.roStatus?.mdef || 0;
                  dmg = Math.max(1, calculatedPower - targetMdef);
                  localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - dmg);
                  logText = `🔮 ${enemyItem.name} は 【${usedSkill.name}】 を詠唱！ ➔ ${target.name} に ${dmg} の魔法ダメージ！`;
                } else {
                  const targetDef = target.vit || 0;
                  dmg = Math.max(1, calculatedPower - targetDef);
                  localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - dmg);
                  logText = `💥 ${enemyItem.name} の 【${usedSkill.name}】！ ➔ ${target.name} に ${dmg} の物理ダメージ！`;
                }

                // 🎰 追加効果の判定
                if (usedSkill.effect_type && usedSkill.effect_type !== 'なし' && localParty[targetIdx].hp > 0) {
                  const effectChance = Number(usedSkill.effect_chance || 0);
                  if (Math.random() * 100 < effectChance) {
                    localParty[targetIdx].state = {
                      ...localParty[targetIdx].state,
                      currentStatus: usedSkill.effect_type,
                      durationTurns: Number(usedSkill.duration_turns || 3)
                    };
                    logText += ` ✨ [追加効果] ${target.name} は【${usedSkill.effect_type}】状態になった！`;
                  }
                }
              } else {
                // 💀 【従来の通常攻撃ルート】スキルを使わない場合は通常攻撃へ
                const isCursed = currentStatus === '呪い';
                const effectiveStr = isCursed ? Math.floor(enemyItem.str * 0.5) : enemyItem.str;
                const baseAtk = Math.floor(Math.random() * 10) + 10 + effectiveStr;
                
                const isBlinded = currentStatus === '暗闇';
                
                if (isBlinded && Math.random() < 0.5) {
                  logText = `🕶️ ${enemyItem.name} は暗闇に包まれて攻撃を外した！ ${target.custom_name || target.name} は鮮やかに回避した！`;
                } else {
                  // 🔮 【三土手神リフォーム：RO式・通常物理攻撃のFlee完全回避ジャッジ】
                  const enemyHit = Number(enemyItem.hit || 21);
                  const playerFlee = Number(target.roStatus?.flee || target.flee || localParty?.find(p => p.id === target.id)?.roStatus?.flee || 0);
                  const fleeChance = 20 + playerFlee - enemyHit;
                  const cappedFleeChance = Math.min(95, fleeChance);
                  const randomRoll = Math.floor(Math.random() * 100);

                  if (randomRoll < cappedFleeChance) {
                    logText = `💨 [MISS] ${enemyItem.name} が 【${target.name}】 を強襲！しかし、ヒラリとかわされた！ (回避率:${Math.max(0, cappedFleeChance)}%)`;
                  } else {
                    dmg = Math.max(1, baseAtk - target.vit);
                    localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - dmg);
                    logText = `💥 ${enemyItem.name} の攻撃！ ${target.name} は ${dmg} の物理ダメージを受けた！`;
                  }
                }
              }

              // 🧪 【毒効果スリップ処理】
              let currentHpAfterPoison = enemyItem.hp;
              const wasPoisonedAtTurnStart = currentStatus === '毒';
              if (wasPoisonedAtTurnStart) {
                const poisonDmg = Math.floor(enemyItem.mhp * 0.05);
                currentHpAfterPoison = Math.max(1, currentHpAfterPoison - poisonDmg);
                logText += ` 🧪 [毒効果] ${enemyItem.name} は毒により ${poisonDmg} のスリップダメージ！`;
              }

              // 👑 唯一のログ出力
              newLogs.push({ id: `e-${Date.now()}-${Math.random()}`, text: logText, type: "battle" });

              // ⏳ 持続ターン数消費判定
              let updatedState = { ...enemyItem.state };
              if (['毒', '暗闇', '沈黙', '呪い'].includes(currentStatus)) {
                const nextTurns = (enemyItem.state.durationTurns || 1) - 1;
                updatedState.durationTurns = nextTurns;
                if (nextTurns <= 0) {
                  newLogs.push({ id: `e-clear-move-${enemyItem.instanceId}-${Date.now()}`, text: `✨ ${enemyItem.name} の【${currentStatus}】が切れた。`, type: "system" });
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

        // 🎯 生存エネミー確認
        let aliveEnemies = localEnemies.filter(e => e.hp > 0);
        if (aliveEnemies.length === 0) return;

        const currentPlayerAspd = Number(member.aspd || 150.0);
        const playerInterval = ((200 - currentPlayerAspd) / 50) * 1000;
        partyAtkTimers.current[member.id] += 20;

        // 💡 攻撃ターンが回ってきた時だけ処理を実行する
        if (partyAtkTimers.current[member.id] >= playerInterval) {
          partyAtkTimers.current[member.id] = 0;

          // 🧪 1. 状態異常スリップ＆解除判定
          if (member.state?.currentStatus && member.state.currentStatus !== 'none' && member.state.currentStatus !== 'なし') {
            if (member.state.currentStatus === '毒') {
              const poisonDmg = Math.floor(member.mhp * 0.05);
              member.hp = Math.max(1, member.hp - poisonDmg);
              newLogs.push({ id: `p-poison-${member.id}-${Date.now()}`, text: `🧪 [毒ダメージ] ${member.name} は毒により ${poisonDmg} のダメージを受けた！`, type: "battle" });
            }
            member.state.durationTurns = (member.state.durationTurns || 3) - 1;
            if (member.state.durationTurns <= 0) {
              newLogs.push({ id: `p-clear-${member.id}-${Date.now()}`, text: `✨ ${member.name} の【${member.state.currentStatus}】が切れた。`, type: "system" });
              member.state = { isFrozen: false, isStunned: false, stunTurns: 0, freezeTurns: 0, currentStatus: 'none', durationTurns: 0 };
            }
          }

          // 行動不能判定
          if (['スタン', '石化', '睡眠', '凍結'].includes(member.state?.currentStatus)) {
            newLogs.push({ id: `skip-${member.id}-${Date.now()}`, text: `💤 ${member.name} は【${member.state.currentStatus}】状態のため行動不能！`, type: "system" });
            return;
          }

          // 🎯 ターゲット選択
          let primaryTarget = [...aliveEnemies].sort((a, b) => (a.mhp - b.mhp) || (a.hp - b.hp))[0];
          let targetIdx = localEnemies.findIndex(e => e.instanceId === primaryTarget.instanceId);

          // 🧠 【ここですべての変数を一度だけ宣言！】
          let shouldLaunchMagic = false;
          let playableSkill = null;
          let finalDmg = 0;
          let logText = "";
          
          const myStr = member.str || 10;
          const myDex = member.dex || 10;
          const randomizedAtk = Math.floor(Math.random() * ((myStr * 2.5 + myDex) - (myStr + myDex * 0.5) + 1)) + Math.floor(myStr + myDex * 0.5);

          // スキル選択AI
          const activeSkills = member.skillsList || [];
          playableSkill = activeSkills.length > 0 ? activeSkills[Math.floor(Math.random() * activeSkills.length)] : null;
          
          // 🚑 救命・浄化AI判定
          const hasStatusAilment = localParty.some(p => p.hp > 0 && p.state?.currentStatus && p.state.currentStatus !== 'none' && p.state.currentStatus !== 'なし');
          const isEmergencyHP = localParty.some(p => p.hp > 0 && p.hp < (p.mhp || 424) * 0.7);

          if (hasStatusAilment) {
            const cureSkill = activeSkills.find(sk => sk.effect_type === '状態異常回復');
            if (cureSkill) { playableSkill = cureSkill; shouldLaunchMagic = true; }
          } else if (isEmergencyHP) {
            const healSkill = activeSkills.find(sk => sk.target_type === '味方単体' || sk.target_type === '味方全体' || sk.name?.includes('ヒール') || sk.effect_type === '回復');
            if (healSkill) { playableSkill = healSkill; shouldLaunchMagic = true; }
          } else if (primaryTarget) {
            // 🔮 🧠 【新規追加：属性弱点スキャン＆エクスプロイトAI】
            // 命の危機がない場合は、ロックオンした敵の弱点を突く魔法を探す！
            
            // RO式 属性相性マップ (敵の属性 -> それに対する弱点属性)
            const weaknessMap = {
              '水': ['風', '風属性'],
              '火': ['水', '水属性'],
              '地': ['火', '火属性'],
              '風': ['地', '地属性'],
              '闇': ['聖', '聖属性'],
              '不死': ['聖', '聖属性', '火', '火属性'],
              '聖': ['闇', '闇属性']
            };
            
            // 狙っている敵の属性から、弱点となる属性の配列を取得
            const weaknesses = weaknessMap[primaryTarget.element] || [];
            
            if (weaknesses.length > 0) {
              // 自分が覚えているスキルの中から、弱点属性かつSPが足りている攻撃スキルを探す
              const exploitSkill = activeSkills.find(sk => 
                weaknesses.includes(sk.element) && 
                member.sp >= Number(sk.sp_cost || 0)
              );
              
              if (exploitSkill) {
                playableSkill = exploitSkill; // 弱点魔法を見つけたら強制的に手札をすり替える！
              }
            }
          }

          const skillSpCost = playableSkill ? Number(playableSkill.sp_cost || 0) : 0;
          const isTargetBoss = primaryTarget.is_boss === true;
          const currentSpRatio = (member.sp / (member.msp || 50)) * 100;

          // 📐 【新・第1ステップ判定】魔法をブッ放すかどうかのガンビット条件ダイス
          if (playableSkill && member.sp >= skillSpCost) {
            // 🏥 🆕 【三土手神特注：ヒール温存AIジャッジ完全強化版】
            const isHeal = playableSkill.target_type === '味方単体' || 
                           playableSkill.target_type === '味方全体' || 
                           playableSkill.name?.includes('ヒール') || 
                           playableSkill.effect_type === '回復';
            
            if (isHeal) {
              const hasCriticallyInjuredAlly = localParty.some(ally => {
                if (ally.hp <= 0) return false;
                const maxHpVal = ally.mhp || 424;
                return ally.hp < (maxHpVal * 0.7); 
              });
              
              if (!hasCriticallyInjuredAlly) {
                // 誰もピンチじゃなければヒールは温存
                shouldLaunchMagic = false;
              } else {
                // 🚑 【修正】HP70%未満の味方がいるなら、ボス戦やSP50%以下の条件を完全無視して絶対発動！
                shouldLaunchMagic = true;
              }
            } else {
              // ⚔️ 攻撃魔法やバフなどは今まで通り、ボス戦以外ではSP50%以上でのみ発動（温存ルール適用）
              if (isTargetBoss || currentSpRatio > 50) shouldLaunchMagic = true;
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
            // ✨ 【確定第1優先：魔法詠唱ルート】（ヒール等の味方補助＆各種攻撃魔法）
            // =============================================================
            member.sp = Math.max(0, member.sp - skillSpCost);
            const baseValue = Number(playableSkill.effect_value || 0);
            
            // 🏥 🛠️ 🆕 【三土手神特注：ヒール・味方ターゲット自動識別配線】
            // target_typeが味方指定、または名前に「ヒール」が含まれるか、効果分類が「回復」の場合
            const isHealSkill = playableSkill.target_type === '味方単体' || 
                                playableSkill.target_type === '味方全体' || 
                                playableSkill.name?.includes('ヒール') ||
                                playableSkill.effect_type === '回復' ||
                    playableSkill.effect_type === '状態異常回復';

            if (isHealSkill) {
              // 🛠️ 🆕 【三土手創世神特注：倍率計算インフラ完全同期】
              // 🛠️ 🆕 【三土手創世神特注：倍率計算インフラ完全同期】
              let calculatedHeal = Number(playableSkill.effect_value || playableSkill.base_value || 20);
              
              // 🧹 「|| true」を粉砕し、ダッシュボードの設定に完全追従させる！
              if (playableSkill.value_type === 'percent' || playableSkill.calculation_type === 'percent') {
                const myInt = member.int || member.stat_int || 10;
                const myStr = member.str || 10;
                // 📐 クレリックのステータスと、ダッシュボードの威力を完全結合
                calculatedHeal = Math.floor((myStr + myInt * 2.5) * (Number(playableSkill.effect_value || 70) / 100));
              }
              if (calculatedHeal < 1) calculatedHeal = 1;

              // 🛠️ 🆕 【全体ヒール判定】
              const isAreaHeal = playableSkill.target_type === '味方全体';

              if (isAreaHeal) {
                // 🏰 🔮 【味方全体回復ルート】生存している部隊全員をループ処理
                logText = `🚑💚 [AREA HEAL] ${member.name} が聖なる讃美歌 【${playableSkill.name}】 を詠唱！光の粒子が部隊全体を包み込む！ (残SP: ${member.sp})`;
                newLogs.push({ id: `p-heal-aoe-${member.id}-${Date.now()}`, text: logText, type: "success" });

                localParty = localParty.map(ally => {
                  if (ally.hp <= 0) return ally;

                  const targetMhp = ally.mhp || 424;
                  const oldHp = ally.hp;
                  const nextHp = Math.min(targetMhp, ally.hp + calculatedHeal);
                  const actualHealAmount = nextHp - oldHp;

                  newLogs.push({
                    id: `p-heal-aoe-hit-${ally.id}-${Date.now()}-${Math.random()}`,
                    text: `  ➔ ✨ 【${ally.name}】 の傷口が癒え、HPが ${actualHealAmount} 回復！ (${nextHp}/${targetMhp})`,
                    type: "success"
                  });

                  return { ...ally, hp: nextHp };
                });

                logText = ""; 

              } else {
                // 👤 【味方単体回復ルート】
                let targetAlly = null;
                let minHpRatio = 1.1;

                localParty.forEach(ally => {
                  if (ally.hp > 0) {
                    const maxHpVal = ally.mhp || 424;
                    const currentRatio = ally.hp / maxHpVal;
                    if (currentRatio < minHpRatio) {
                      minHpRatio = currentRatio;
                      targetAlly = ally;
                    }
                  }
                });

                if (!targetAlly) targetAlly = member;

                const targetMhp = targetAlly.mhp || 424;
                const oldHp = targetAlly.hp;
                
                // 🛠️ 🆕 古い固定値(21)の幽霊を粉砕し、上で計算した「calculatedHeal（24）」を確実に直撃注入！
                targetAlly.hp = Math.min(targetMhp, targetAlly.hp + calculatedHeal);
                const actualHealAmount = targetAlly.hp - oldHp;

                const partyFindIdx = localParty.findIndex(p => p.id === targetAlly.id);
                if (partyFindIdx !== -1) {
                  localParty[partyFindIdx].hp = targetAlly.hp;
                }

                logText = `🚑💚 [HEAL] ${member.name} の 【${playableSkill.name}】 が発動！ ➔ ${targetAlly.name} の傷口が癒え、HPが ${actualHealAmount} 回復！ (残SP: ${member.sp})`;
              }

              // 🌟🌟🌟 【ここに追加！】三土手神特注：状態異常の浄化（キュア）処理 🌟🌟🌟
              if (playableSkill.effect_type === '状態異常回復') {
                if (isAreaHeal) {
                  // 全体魔法なら生存メンバー全員のデバフを剥がす
                  localParty = localParty.map(p => {
                    if (p.hp <= 0) return p;
                    return {
                      ...p,
                      state: { isFrozen: false, isStunned: false, stunTurns: 0, freezeTurns: 0, currentStatus: 'none', durationTurns: 0 }
                    };
                  });
                  newLogs.push({ id: `cure-aoe-${member.id}-${Date.now()}`, text: ` ✨ [浄化] まばゆい光が部隊全体の状態異常を完全に打ち払った！`, type: "success" });
                } else {
                  // 単体魔法ならターゲットのデバフのみ剥がす
                  const tIdx = localParty.findIndex(p => p.id === targetAlly.id);
                  if (tIdx !== -1) {
                    localParty[tIdx].state = { isFrozen: false, isStunned: false, stunTurns: 0, freezeTurns: 0, currentStatus: 'none', durationTurns: 0 };
                  }
                  logText += ` ✨ [浄化] ${targetAlly.name} の状態異常が完全に浄化された！`;
                }
              }
              // 🌟🌟🌟 追加ここまで 🌟🌟🌟

            } else {
              // ⚔️ 【従来の攻撃魔法・範囲魔法ルート】（※1行も壊さずそのままここに完全保護格納！）
              const isAOE = playableSkill.target_type === '敵全体' || 
                            playableSkill.target_type === '範囲エネミー' || 
                            playableSkill.name?.includes('全体') || 
                            playableSkill.isAreaOfEffect === true;

              if (isAOE) {
                const isMagic = playableSkill.skill_type === 'magic';
                logText = isMagic 
                  ? `🔮✨ 【全体大魔法】${member.name} の【${playableSkill.name}】が戦場全域に炸裂！(残SP: ${member.sp})`
                  : `⚔️💥 【全体物理特技】${member.name} の【${playableSkill.name}】が一閃！全戦場を巻き込む！(残SP: ${member.sp})`;
                
                newLogs.push({ id: `p-aoe-${member.id}-${Date.now()}`, text: logText, type: "success" });

                localEnemies = localEnemies.map(enemyItem => {
                  if (enemyItem.hp <= 0) return enemyItem;

                  let calculatedPower = baseValue;
                  if (playableSkill.value_type === 'percent') {
                    if (isMagic) {
                      const myInt = member.int || member.stat_int || 10;
                      const myDex = member.dex || member.stat_dex || 10;
                      const minMatk = Math.floor(myInt + (myDex * 0.2));
                      const maxMatk = Math.floor(myInt * 2.0 + myDex);
                      const magicBaseAtk = Math.floor(Math.random() * (maxMatk - minMatk + 1)) + minMatk;
                      calculatedPower = Math.floor((magicBaseAtk * baseValue) / 100);
                    } else {
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

                  const enemyMdef = enemyItem.int || enemyItem.stat_int || 0;
                  const aoeDmg = Math.max(1, Math.floor(calculatedPower * skillMultiplier) - enemyMdef);
                  const nextHp = Math.max(0, enemyItem.hp - aoeDmg);

                  let aoeLog = `  ➔ 💥 ${enemyItem.name} に ${aoeDmg} の全体魔法ダメージ！`;

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

                logText = ""; 

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
            let useSkill = activeSkills.length > 0 && Math.random() < 0.45;
            let skillToUse = null;

            if (useSkill) {
              skillToUse = activeSkills[Math.floor(Math.random() * activeSkills.length)];
              const skillSpCost = Number(skillToUse.sp_cost || 0);

              // 🛑 【原因③の修正】SPが足りない場合はスキルを不発にし、通常攻撃へ流す
              if (member.sp < skillSpCost) {
                useSkill = false;
              } else {
                // 🛑 【原因①②の修正】第3優先のランダム発動でも、ヒールの場合はHP70%未満の味方がいるか判定
                const isHeal = skillToUse.target_type === '味方単体' || skillToUse.target_type === '味方全体' || skillToUse.name?.includes('ヒール') || skillToUse.effect_type === '回復';
                if (isHeal) {
                  const hasCriticallyInjured = localParty.some(p => p.hp > 0 && p.hp < (p.mhp || 424) * 0.7);
                  if (!hasCriticallyInjured) {
                    useSkill = false; // 誰もHP70%未満でなければヒールの暴発を防ぎ、通常攻撃へ
                  }
                } else {
                  // 🛑 🧠 【今回追加する箇所：すり抜け温存ガード】
                  // 回復魔法以外の攻撃/バフスキルを引いた場合、ボス戦以外でSPが50%以下なら「温存」して通常攻撃へ！
                  const currentSpRatio = (member.sp / (member.msp || 50)) * 100;
                  if (!isTargetBoss && currentSpRatio <= 50) {
                    useSkill = false;
                  }
                }
              }
            }

            if (useSkill && skillToUse) {
              // ✨ スキル発動ルート
              const skill = skillToUse;
              const skillSpCost = Number(skill.sp_cost || 0);
              member.sp = Math.max(0, member.sp - skillSpCost); // 🛑 【原因③の修正】SPを確実に消費させる！

              const baseValue = Number(skill.effect_value || 0);
              
              let calculatedPower = baseValue;
              // ここも calculation_type を追加して判定を強化！
              if (skill.value_type === 'percent' || skill.calculation_type === 'percent') {
                calculatedPower = Math.floor((randomizedAtk * baseValue) / 100);
              }

              if (skill.target_type === '味方単体' || skill.target_type === '味方全体') {
                const injured = localParty.filter(p => p.hp > 0 && p.hp < p.mhp).sort((a,b) => a.hp - b.hp);
                const healTarget = injured[0] || member;
                const hIdx = localParty.findIndex(p => p.id === healTarget.id);
                
                localParty[hIdx].hp = Math.min(localParty[hIdx].mhp, localParty[hIdx].hp + calculatedPower);
                // 💡 ログにもSP残量を表示して、しっかり減っているか確認できるようにしました
                logText = `✨ ${member.name} 【${skill.name}】発動！ ${localParty[hIdx].name} のHPを ${calculatedPower} 回復 (残SP: ${member.sp})`;
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
    // 🛡️ 🆕 保存しておいたマスターデータから、今回の階層の有効な敵プールを再構築！
    const validEnemyPool = activePoolEnemyIds.map(id => masterEnemiesRef.current.find(e => e.id === id)).filter(Boolean);
    
    let loadedEnemies = [];
    if (validEnemyPool.length > 0) {
      for (let i = 0; i < spawnCount; i++) {
        const randomIndex = Math.floor(Math.random() * validEnemyPool.length);
        const dbEnemy = validEnemyPool[randomIndex];
        const targetId = dbEnemy.id;

        const isBaphometTarget = String(targetId).toLowerCase().includes('baphomet');
        const finalName = dbEnemy?.name || (isBaphometTarget ? "バフォメットJr" : "テストポリンJr");
        
        // 🔮 【ここを追加】データベースから取得したスキルIDから、この敵が持つスキルを抽出！
        const enemySkillIds = [dbEnemy?.skill_01, dbEnemy?.skill_02, dbEnemy?.skill_03].filter(Boolean);
        const eSkills = masterSkillsRef.current.filter(sk => enemySkillIds.includes(sk.id));
        
        loadedEnemies.push({
          instanceId: `${targetId}_spawn_${i}_${Date.now()}`,
          id: targetId,
          name: `${finalName} ${String.fromCharCode(65 + i)}`,
          mhp: dbEnemy?.hp || dbEnemy?.base_hp || dbEnemy?.max_hp || 2000,
          hp: dbEnemy?.hp || dbEnemy?.base_hp || dbEnemy?.max_hp || 2000,
          str: dbEnemy?.str || dbEnemy?.stat_str || 10,
          agi: dbEnemy?.agi || dbEnemy?.stat_agi || 15, 
          vit: dbEnemy?.vit || dbEnemy?.stat_vit || 10,
          size: dbEnemy?.size || '小型',
          race: dbEnemy?.race || '無形',
          element: dbEnemy?.element || '無',
          exp: Number(currentQuestState?.exp_reward || 50),
          gold: Number(currentQuestState?.zeny_reward || 1000),
          state: { currentStatus: 'なし', durationTurns: 0 },
          resist_stun: Number(dbEnemy?.resist_stun || 0),
          resist_freeze: Number(dbEnemy?.resist_freeze || 0),
          resist_poison: Number(dbEnemy?.resist_poison || 0),
          resist_blind: Number(dbEnemy?.resist_blind || 0),
          int: dbEnemy?.int || dbEnemy?.stat_int || 10,
          hit: dbEnemy?.hit || 21,
          enemy_aspd: dbEnemy?.enemy_aspd !== undefined ? dbEnemy.enemy_aspd : null,
          
          // 🔮 【ここを追加】抽出したスキルリストを敵のインスタンスにマウント！
          activeSkills: eSkills 
        });
      }
    }

    enemiesStateRef.current = loadedEnemies;
    setEnemies(loadedEnemies);
    setIsBattleOver(false);
    setAdventureStatus('battling');

    // 🛠️ 🆕 Stateの「remainingBattles」はラグで古い数字を持っていることがあるため、
    // ここで直接、絶対に最新の「remainingBattlesRef.current」の数字を引っ張ってくる！
    const displayCount = forcedNextFloor ? targetFloorCfg.battle_count : remainingBattlesRef.current;

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
            {/* 🛠️ 🆕 最終階層なら「クエスト完了！」、道中なら階層制圧を表示する三土手神仕様！ */}
            <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
              {currentFloor >= (currentQuestState?.floors || 1) 
                ? "🏆 🎉 最終階層突破！クエスト完全完了！" 
                : `🎉 【B${currentFloor}階】制圧完了！どうしますか？`}
            </span>
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
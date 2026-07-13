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
  
  // 🛡️ 🆕 追加：敵の武器データを逆引きするためにアイテムマスターを保持する器
  const masterItemsRef = useRef([]); 

  // 🐾 🆕 【三土手神特注】酒場の待機メンバーも含めた、自分が所持する全キャラクターリストを記憶する器！
  const allPlayerCharactersRef = useRef([]);
  
  // 🔮 🆕 創世神特注：SP自動回復用の時間累積プールタイマーRef（初期値0秒）
  const spRegenTimer = useRef(0);
  
  const [droppedItems, setDroppedItems] = useState([]);
  // 🧹 アディショナルタイム告知フラグ（hasAnnouncedATRef）を撤去！
  
  // 🔮 🆕 セーブ中表示用のローカル状態を増築
  const [isSaving, setIsSaving] = useState(false);

  // 🐾 🆕 【テイマー専用：魔物起き上がりイベント用State】
  const [tameCandidate, setTameCandidate] = useState(null); // 起き上がった魔物のデータ
  const [isTamingSaving, setIsTamingSaving] = useState(false); // 捕獲通信中のフラグ

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
      const { data: dbItems } = await supabase.from('game_master_items').select('*'); 

      const allMasterSkills = dbSkills || [];
      const allMasterItems = dbItems || [];
      
      // 🚨 ⬇️ デバッグ用トラップ1：全アイテムデータを覗き見！
      console.log("📦 【デバッグ1】取得した全アイテムマスター:", allMasterItems);

      masterSkillsRef.current = allMasterSkills;
      // 🛡️ 🆕 追加：ここでアイテム一覧を保存！
      masterItemsRef.current = allMasterItems; 

      // 🐾 🆕 【結線！】TEST_USER_ID から一本釣りした全キャラデータをRefにガチッと記憶！
      allPlayerCharactersRef.current = charList || [];

      if (charList && charList.length > 0) {
        // 🔮 🆕 三土手神特注：混在ゴーストデータを無力化するIDクレンジング配線！
        // partyCharacterIds の中身が文字列でもオブジェクトでも、確実に「ID文字列だけ」の配列へ変換します
        const actualPartyIds = partyCharacterIds.map(p => p && typeof p === 'object' ? p.id : p).filter(Boolean);

        // 綺麗になった実際のID配列（actualPartyIds）を使って、生存メンバーを鉄壁フィルタリング！
        const filteredMembers = charList.filter(ch => actualPartyIds.includes(ch.id));

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

          // 🐾 【三土手神特注：人間と魔物のスキル習得二重ルート隔離ゲート】
          let availableSkills = [];

          const isMonsterClass = ['魔獣族', '植物族', '悪魔族', '不死族', '水棲族', '悪魔', '不死', '不死属性'].includes(myJob);

          if (isMonsterClass) {
            // 😈 ① 魔物キャラクターの場合
            // レベルアップ自動解放を完全カット！敵時代（マスター）から引き継いで所持している
            // 「最大3枠の固有スキルID」だけをピンポイントで全自動ロード！
            const tamerSkillIds = [ch.skill_01, ch.skill_02, ch.skill_03].filter(Boolean);
            availableSkills = allMasterSkills.filter(sk => tamerSkillIds.includes(sk.id));
          } else {
            // 👤 ② 人間の仲間の場合は、今まで通り職業とレベル連動で自動習得
            availableSkills = allMasterSkills.filter(sk => {
              const jobReq = sk.job_requirement;
              const lvReq = Number(sk.level_requirement || 1);
              return (jobReq === '全職業' || jobReq === myJob) && myLevel >= lvReq;
            });
          }

          const isScout = myJob === 'スカウト';
          const cardSizeEff = isScout ? { '小型': 20 } : {};
          const cardRaceEff = isScout ? { '無形': 20 } : {};
          const cardElemEff = isScout ? { '地': 20, '地属性': 20 } : {};

          // 🔮 🆕 三土手神特注：ループの内部でキャラクター毎に個別の装備データを確実に透視！（ここで宣言）
          const weaponId = ch.equip_right_hand || (ch.equips && ch.equips.equip_right_hand) || null;
          
          // 🚨 ⬇️ デバッグ用トラップ2：各キャラの装備IDと照合結果を丸裸にする！
          console.log(`=== 🕵️ 【デバッグ2】${ch.custom_name} の武器判定 ===`);
          console.log("・抽出した生の weaponId:", weaponId);
          console.log("・抽出元の ch データ全体:", ch);

          // 🛡️ 🆕 アイテムマスターから本物の武器データを照合して完全合流（JOIN）！
          const masterWeapon = allMasterItems.find(item => item.id === weaponId);
          
          // 🚨 ⬇️ デバッグ用トラップ2の続き：マッチした結果
          console.log("・マスターデータとの照合結果 (masterWeapon):", masterWeapon);
          console.log("=====================================");

          // マスター側に名前があればそれを採用、なければ「素手」
          const weaponName = masterWeapon?.name || '素手';
          // 武器小分類（item_subtype：剣・槍など）をマスターデータから抽出
          const weaponSubtype = masterWeapon?.item_subtype || (myJob === 'ファイター' ? '剣' : '素手');
          // 武器の固有属性をマスターデータから抽出
          const weaponElement = masterWeapon?.element || '無';

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

          // 🛡️ 👑 【三土手神特注インフラ】配列の中から自分のキャラクターIDを持つスロットデータをピンポイント抽出
          const slotData = partyCharacterIds.find(p => p && (typeof p === 'object' ? p.id === ch.id : p === ch.id));
          
          // 編成画面のトグルスイッチでパチパチ切り替えられた最新の position ('front' または 'back') を全自動上書きマウント！
          const position = slotData && typeof slotData === 'object' ? slotData.position : 'front';

// 🔮 👑 【三土手創世神特注：バトル突入時・パッシブスキル全自動検知マウントエンジン】
          let passiveFleeBonus = 0;
          let passiveCritBonus = 0;
          let passiveAtkBonus = 0; 
          let passiveMatkBonus = 0; 
          let passiveDefBonus = 0;   
          let passiveMdefBonus = 0;  
          let passiveTwinChance = 0; 
          let passiveHpRegen = 0;
          let passiveSpRegen = 0;
          let passiveDexBonus = 0;       // 🏹 🆕 【三土手神特注】常時DEX上昇値を溜める器
          let passiveRangedHitBonus = 0; // 🏹 🆕 【三土手神特注】遠隔Hit底上げ値を溜める器
          let passiveHpMultiplier = 1.0; 
          let passiveSpMultiplier = 1.0; 

          if (availableSkills && availableSkills.length > 0) {
            availableSkills.forEach(sk => {
              if (sk.skill_type === 'passive') {
                if (sk.effect_type === '回避Flee増幅')  passiveFleeBonus += Number(sk.effect_value || 0);
                if (sk.effect_type === '致命打率増幅') passiveCritBonus += Number(sk.effect_value || 0);
                if (sk.effect_type === 'パッシブATK増幅') passiveAtkBonus += Number(sk.effect_value || 0);
                if (sk.effect_type === 'パッシブMATK増幅') passiveMatkBonus += Number(sk.effect_value || 0);
                if (sk.effect_type === 'パッシブDEF増幅')  passiveDefBonus += Number(sk.effect_value || 0);
                if (sk.effect_type === 'パッシブMDEF増幅') passiveMdefBonus += Number(sk.effect_value || 0);
                if (sk.effect_type === 'ツインブレード型連撃') passiveTwinChance = Math.max(passiveTwinChance, Number(sk.effect_value || 0));
                
                // 🧼 ディバインアイ（神識眼）：常時DEXを固定値プラスする判定
                if (sk.effect_type === 'パッシブDEX増幅' || sk.name?.includes('ディバインアイ') || sk.name?.includes('神識眼')) {
                  passiveDexBonus += Number(sk.effect_value || 0);
                }
                
                // 🧼 ホークアイ（遠見の心眼）：Lレンジ武器装備時にHitを底上げする判定
                if (sk.effect_type === '遠隔命中増幅' || sk.name?.includes('ホークアイ') || sk.name?.includes('遠見の心眼')) {
                  passiveRangedHitBonus += Number(sk.effect_value || 0);
                }

                // 🎯 👑 【三土手創世神特注：効果タイプ ＆ スキル名 二重包囲網センサー】
                if (sk.effect_type === 'パッシブHP自動回復' || sk.name?.includes('HP自動回復')) {
                  passiveHpRegen += Number(sk.effect_value || 0);
                }
                // 🎯 🆕 【効果タイプ ＆ スキル名 二重包囲網センサー：SP版】
                if (sk.effect_type === 'パッシブSP自動回復' || sk.name?.includes('マインドリフレッシュ') || sk.name?.includes('精神統一')) {
                  passiveSpRegen += Number(sk.effect_value || 0);
                }
                if (sk.effect_type === '最大HP増幅')   passiveHpMultiplier += Number(sk.effect_value || 0) / 100;
                if (sk.effect_type === '最大SP増幅')   passiveSpMultiplier += Number(sk.effect_value || 0) / 100;
              }
            });
          }

          return {
            id: ch.id,
            name: ch.custom_name,
            level: myLevel,
            weaponName,
            weaponRange: ch.equips?.right_hand?.range || 'S',
            position,
            mhp: Math.floor((ch.max_hp || ch.mhp || 0) * passiveHpMultiplier), 
            hp: Math.floor((ch.max_hp || ch.mhp || 0) * passiveHpMultiplier),
            msp: Math.floor((ch.max_sp || ch.msp || 0) * passiveSpMultiplier),
            sp: Math.floor((ch.max_sp || ch.msp || 0) * passiveSpMultiplier),
            str: ch.roStatus?.str || ch.str || 0,
            agi: ch.roStatus?.agi || ch.agi || (ch.meta?.stat_agi || 0) + (ch.bonus?.agi || 0),
            vit: ch.roStatus?.vit || ch.vit || (ch.meta?.stat_vit || 0) + (ch.bonus?.vit || 0),
            int: ch.roStatus?.int || ch.int || (ch.meta?.stat_int || 0) + (ch.bonus?.int || 0),
            border_dex: (ch.roStatus?.dex || ch.dex || 0) + passiveDexBonus, 
            dex: (ch.roStatus?.dex || ch.dex || 0) + passiveDexBonus, 
            luk: ch.roStatus?.luk || ch.luk || 0,
            job: myJob,
            weaponSubtype,
            weaponElement,
            cardSizeEff,
            cardRaceEff,
            cardElemEff,
            skillsList: availableSkills,
            state: { isFrozen: false, isStunned: false, stunTurns: 0, freezeTurns: 0, currentStatus: 'none', durationTurns: 0 },
            
            // 🔮 バフ・デバフ用のアクティブ配列プール
            activeBuffs: [],

            final_battle_critical: Number(alcoholCritical) + passiveCritBonus,

            // 🩸 装備から吸い上げた吸血値をインジェクション
            hp_drain_chance: totalDrainChance,
            hp_drain_percent: totalDrainPercent,

            card_inflict_type: totalInflictType,
            card_inflict_chance: maxInflictChance,

roStatus: ch.roStatus || {},
            
            // 物理攻撃力パッシブ合流
            atk: Number(ch.roStatus?.atk || 0) + passiveAtkBonus,
            // 魔法魔力パッシブ合流
            passive_matk_bonus: passiveMatkBonus,
            // 回避率パッシブ合流
            flee: Number(ch.roStatus?.flee || 0) + passiveFleeBonus,
            
            // 🎯 👑 【Def / Mdef 電線完全同期】素の計算値にパッシブ数値をその場でドッキング！
            def: Number(ch.roStatus?.def || 0) + passiveDefBonus,
            mdef: Number(ch.roStatus?.mdef || 0) + passiveMdefBonus,
            
            // 🎯 👑 【連撃確率メモリ直結】バトルでいつでも確率ダイスを振れるように記憶！
            twin_strike_chance: passiveTwinChance,
            
            // 🎯 👑 【自己治癒力メモリ直結】5秒周期タイマーが参照するための固定回復量を完全バインド！
            passive_hp_regen: passiveHpRegen,
            // 🎯 🆕 【精神統一メモリ直結】5秒周期タイマーが参照するための固定SP回復量をバインド！
            passive_sp_regen: passiveSpRegen,
            
            // 🎰 クリティカル率パッシブも戦闘初期スペックへ確実に焼き付ける
            critical: Number(alcoholCritical || ch.roStatus?.critical || 0) + passiveCritBonus,
            
            // 🧼 変数未定義エラーを完全粉砕！ch.equip_right_hand やマスター武器データの射程をその場で正確に透視して判定！
            hit: Number(ch.roStatus?.hit || 0) + (
              (masterWeapon?.weapon_range === 'L' || ch.equips?.right_hand?.range === 'L') 
                ? passiveRangedHitBonus 
                : 0
            ),
            aspd: ch.roStatus?.aspd || 150.0 
          };
        });
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

            // 🔮 🆕 【三土手神特注】1戦目のエネミーにも、初回ロード済みの allMasterSkills からスキルを完全合流させる！
            const enemySkillIds = [dbEnemy?.skill_01, dbEnemy?.skill_02, dbEnemy?.skill_03].filter(Boolean);
            const eSkills = allMasterSkills.filter(sk => enemySkillIds.includes(sk.id));

            const isBaphometTarget = String(targetId).toLowerCase().includes('baphomet');
            const finalName = dbEnemy?.name || (isBaphometTarget ? "バフォメットJr" : "エネミー");
            const finalHp = dbEnemy?.hp || dbEnemy?.base_hp || dbEnemy?.max_hp || 0;
            const finalStr = dbEnemy?.str || dbEnemy?.stat_str || 0;
            const finalAgi = dbEnemy?.agi || dbEnemy?.stat_agi || 0;
            const finalVit = dbEnemy?.vit || dbEnemy?.stat_vit || 0;
            const finalSize = dbEnemy?.size || '小型';
            const finalRace = dbEnemy?.race || '無形';
            const finalElement = dbEnemy?.element || '無';

            const instanceId = `${targetId}_spawn_${i}_${Date.now()}`;

            // 🔮 🆕 【三土手神特注】敵の右手装備IDから本物の武器データを逆引き！
            const enemyWeaponId = dbEnemy?.equip_right_hand;
            const enemyWeapon = masterItemsRef.current.find(item => item.id === enemyWeaponId);
            const eWeaponRange = enemyWeapon?.weapon_range || 'S'; // 指定がなければ近接(S)
            const isRanged = eWeaponRange === 'L';

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
              exp: Number(activeQuestData?.exp_reward || 0),
              gold: Number(activeQuestData?.zeny_reward || 0),
              state: { currentStatus: 'なし', durationTurns: 0 },
              resist_stun: Number(dbEnemy?.resist_stun || 0),
              resist_freeze: Number(dbEnemy?.resist_freeze || 0),
              resist_poison: Number(dbEnemy?.resist_poison || 0),
              resist_blind: Number(dbEnemy?.resist_blind || 0),
              int: dbEnemy?.int || dbEnemy?.stat_int || 0,
              
              // 🎯 【三土手神特注】ダッシュボードのプレビュー数理法則と100%完全同期！
              hit: Math.floor(Number(dbEnemy?.base_level || 1) + Number(dbEnemy?.stat_dex || dbEnemy?.dex || 0) + Number(dbEnemy?.stat_luk || dbEnemy?.luk || 0) * 0.2 + 20),
              flee: Math.floor(Number(dbEnemy?.base_level || 1) + Number(dbEnemy?.stat_agi || dbEnemy?.agi || 0) + Number(dbEnemy?.stat_luk || dbEnemy?.luk || 0) * 0.2 + 10),
              
              // 💨 上書き設定があれば採用、なければ基本値150.0をマウント！
              enemy_aspd: dbEnemy?.enemy_aspd !== null && dbEnemy?.enemy_aspd !== undefined ? Number(dbEnemy.enemy_aspd) : 150.0,
              
              // 🏹 🆕 逆引きした本物の武器射程を完全にマウント！
              is_range_atk: isRanged,
              is_range_weapon: isRanged,
              weaponRange: eWeaponRange,

              activeSkills: eSkills,

              is_tamable: dbEnemy?.is_tamable || false,
              tame_success_chance: Number(dbEnemy?.tame_success_chance || 0),
              tame_level_req: Number(dbEnemy?.tame_level_req || 1),

              // 🐾 🆕 【三土手神特注：1戦目エネミーへの3連ドロップパラメータ電線結合】
              // ダッシュボードで拡張した3つのスロットの武具・カードIDとそれぞれの確率を正確に初期マウントします！
              extra_drop_item: dbEnemy?.extra_drop_item || null,
              extra_drop_chance: Number(dbEnemy?.extra_drop_chance || 0),
              extra_drop_item_2: dbEnemy?.extra_drop_item_2 || null,
              extra_drop_chance_2: Number(dbEnemy?.extra_drop_chance_2 || 0),
              extra_drop_item_3: dbEnemy?.extra_drop_item_3 || null,
              extra_drop_chance_3: Number(dbEnemy?.extra_drop_chance_3 || 0)
            });
          }
} else {
          // 🧼 突貫仮名残のゾンビポリンを完全駆逐！データが空ならログに牙をむかせる！
          console.error("🚨 【致命的バグ】Supabaseから有効なエネミーデータが1件も取得できませんでした。マスターデータまたは階層コンフィグを確認してください。");
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
        
        // 🐾 🆕 【三土手創世神特注：順番エラー粉砕配線】
        // 下に置いてあったログ配列の初期化宣言を最上部へマウントし、未定義エラーを完全遮断します！
        let newLogs = [];
        let matchDrops = [];
        let dropLogs = [];

        setDisplayedLogs(prev => [...prev, { id: `win-all-${Date.now()}`, text: `🏆 🎉 エネミー掃討完了！(B${currentFloor}階)`, type: "system" }]);

        localEnemies.forEach(enemyItem => {
          const checkSlot = (itemId, chance) => {
            if (!itemId || chance <= 0) return;
            const dice = Math.random() * 100;
            if (dice < chance) {
              // アイテムマスターデータから本物の武具スペックを引き抜いて結合
              const masterItem = masterItemsRef.current.find(i => i.id === itemId);
              if (masterItem) {
                matchDrops.push({
                  id: masterItem.id,
                  name: masterItem.name,
                  rarity: masterItem.rarity || 'common'
                });
                
                // レア度に応じた豪華なビジュアル用絵文字を全自動算出
                const rareEmoji = masterItem.rarity === 'legendary' ? '👑' : masterItem.rarity === 'epic' ? '🔮' : '🎁';
                dropLogs.push({
                  id: `drop-${itemId}-${Date.now()}-${Math.random()}`,
                  text: `${rareEmoji} 【${enemyItem.name.replace(/ [A-Z]$/, '')}】が [${masterItem.name}] をドロップした！ (${masterItem.rarity.toUpperCase()})`,
                  type: "system" // ゴールド、またはシステムメッセージカラーに連動
                });
              }
            }
          };

          // 3大独立スロットへ個別にダイスを投下！
          checkSlot(enemyItem.extra_drop_item, enemyItem.extra_drop_chance);
          checkSlot(enemyItem.extra_drop_item_2, enemyItem.extra_drop_chance_2);
          checkSlot(enemyItem.extra_drop_item_3, enemyItem.extra_drop_chance_3);
        });

        // 獲得した武具があれば、戦闘画面の一時リザルト報酬プールへその場でスタック！
        if (matchDrops.length > 0) {
          setDroppedItems(prev => [...prev, ...matchDrops]);
          if (dropLogs.length > 0) {
            newLogs = [...newLogs, ...dropLogs];
          }
        } else {
          newLogs.push({ id: `no-drop-${Date.now()}`, text: `✨ この戦闘ではアイテムのドロップはなかった。`, type: "system" });
        }

        // 報酬プールへの合算計算
        const floorExp = localEnemies.reduce((sum, e) => sum + (e.exp || 0), 0);
        const floorGold = localEnemies.reduce((sum, e) => sum + (e.gold || 0), 0);
        setAccumulatedRewards(prev => ({ exp: prev.exp + floorExp, gold: prev.gold + floorGold }));

        // 🐾 【三土手神特注：ドラクエ5型・魔物起き上がり判定エンジン】
        const aliveTamer = localParty.find(p => p.hp > 0 && (p.job === 'テイマー' || p.name.includes('テイマー')));
        let tamedEnemyInfo = null;

        if (aliveTamer) {
          // 🐾 🆕 【三土手創世神特注：個人空間絶対隔離型・重複テイム防止ゲート・改】
          // 人間の固有ID巻き込みを完全隔離！そして戦闘に出ていない酒場の待機枠（全所持リスト）まで包囲網を拡張！
          // 自分自身が現在持っている全キャラクターの中から、純粋に「モンスターの素体ID（master_id）」だけを抽出します。
          const ownedMonsterMasterIds = allPlayerCharactersRef.current
            .map(c => c.master_id)
            .filter(Boolean); // null や undefined （人間の仲間など）を完全に排除

          // 1. まず今回倒した敵全員の中から、「調教可能」かつ「テイマーのLv制限を満たしている」、さらに「まだ自分が1匹も所持していない」魔物をすべてリストアップ
          const tamablePool = localEnemies.filter(e => 
            e.is_tamable && 
            aliveTamer.level >= e.tame_level_req &&
            !ownedMonsterMasterIds.includes(e.id) // 👈 すでに自分が持っているモンスターID（e.id）でなければ合格！
          );
          
          console.log("=== 🐾 2段階テイム抽選システム起動 🐾 ===");
          console.log(`・生存中のテイマー: ${aliveTamer.name} (Lv.${aliveTamer.level}, DEX:${aliveTamer.dex}, LUK:${aliveTamer.luk})`);
          console.log(`・調教可能プール（全 ${tamablePool.length} 匹）:`, tamablePool.map(e => e.name));

          if (tamablePool.length > 0) {
            // 🔥 【第1段階：全滅させた全エネミーから等確率で1匹を完全ランダム抽選！】
            const randomPickIdx = Math.floor(Math.random() * tamablePool.length);
            const targetE = tamablePool[randomPickIdx]; 
            
            console.log(`🎲 【第1段階・対象抽選】: 候補 ${tamablePool.length} 匹の中から [${targetE.name}] が選出されました！`);

            // 🔥 【第2段階：選ばれたその魔物の固有確率 ＆ 先ほどの超硬派シビア数理で最終判定！】
            const baseChance = Number(targetE.tame_success_chance || 0);
            
            let finalChance = 0;
            if (baseChance > 0) {
              const tamerDex = aliveTamer.dex || 0;
              const tamerLuk = aliveTamer.luk || 0;
              // 三土手さん指定 of 硬派な極小ステータス補正レート！
              finalChance = Math.min(95, baseChance + (tamerDex * 0.01) + (tamerLuk * 0.005));
            }
            
            console.log(`📊 【第2段階・確率計算】: 基礎確率: ${baseChance}% ➔ ステータス補正後最終確率: ${finalChance.toFixed(3)}%`);

            // 🎲 運命の最終ダイスロール！
            if (finalChance > 0) {
              const diceRoll = Math.random() * 100;
              console.log(`🎲 【運命のダイス】: 出目 [${diceRoll.toFixed(3)}] ⇄ 合格ライン [${finalChance.toFixed(3)}未満]`);
              
              if (diceRoll < finalChance) {
                console.log(`✨ 【テイム成功】: ${targetE.name} が起き上がりました！`);
                tamedEnemyInfo = { enemy: targetE, tamer: aliveTamer };
              } else {
                console.log(`💨 【テイム失敗】: 残念、懐きませんでした。`);
              }
            } else {
              console.log(`🚨 【テイム不可】: 最終確率が0%のため、自動的にスキップされました（バフォメット等の仕様です）。`);
            }
          } else {
            console.log("🔍 プールが空です：今回の戦闘には調教条件（Lv制限等）を満たす魔物がいませんでした。");
          }
          console.log("=========================================");
        }

        // 🛠️ 🆕 StateのタイムラグをRefで完全回避！その場で引き算を決着させる！
        const nextCount = Math.max(0, remainingBattlesRef.current - 1);
        remainingBattlesRef.current = nextCount;
        setRemainingBattles(nextCount); // 画面の「表示数」を更新

        // 新しく作成した newLogs を既存のログ表示へ安全に結合マウント！
        if (newLogs.length > 0) {
          setDisplayedLogs(prev => [...prev, ...newLogs]);
        }

        // 🐾 起き上がりイベントが発生した場合は、進行ステータスを専用の 'tame_event' へ分岐！
        if (tamedEnemyInfo) {
          setTameCandidate(tamedEnemyInfo);
          setAdventureStatus('tame_event');
        } else if (nextCount <= 0) {
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
        spRegenTimer.current = 0; // 鉄壁のリセット！
        
        localParty = localParty.map(member => {
          if (member.hp <= 0) return member; // 死亡しているキャラクターは魂が眠っているためスキップ
          
          // 🩸 【自己治癒力（インスティンクト）の数理完全同期配線】
          // VITによる最低保証回復（VITの数値そのもの）に、ダッシュボードの基礎効果数値をダイレクト加算！
          const baseVitBonus = Number(member.vit || 0);
          const passiveHpRegenAmount = Number(member.passive_hp_regen || 0);
          const totalHpRegen = baseVitBonus + passiveHpRegenAmount;
          
          // 🛡️ 最低保証の424を完全に廃止し、本物の最大HP上限でロック！
          const targetMaxHp = Number(member.mhp || member.max_hp || 0);
          const nextHp = Math.min(targetMaxHp, member.hp + totalHpRegen);
          
          // 🎰 LUKをベースにした数理設計に基づき、回復パーセンテージを算出（最低1%〜）
          const lukBonusPct = 1 + Math.floor((member.luk || 0) / 10);
          // 回復量の実数値を計算（最低保証値1）
          const baseSpRegen = Math.max(1, Math.floor(((member.msp || 0) * lukBonusPct) / 100));
          
          // 🧪 🆕 【マインドリフレッシュ数理完全同期配線】
          // 全員共通の基本SP回復に、特定のキャラが持つパッシブ固定値をその場で上乗せ加算！
          const passiveSpRegenAmount = Number(member.passive_sp_regen || 0);
          const totalSpRegen = baseSpRegen + passiveSpRegenAmount;
          
          // 最大SPを超えないように安全に加算
          const nextSp = Math.min(member.msp || 0, member.sp + totalSpRegen);
          
          // 高速バトルログが埋まるのを防ぐため、内部ステータスを静かに書き換えてUIに同期させます。
          return {
            ...member,
            hp: nextHp,
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

        // 🚨 ⬇️ 【三土手神特注デバッグ】敵が動くたびに射程と遠隔フラグをF12へ出力！
        console.log(`😈 敵【${enemyItem.name}】の射程データ ➔ is_range_atk: ${enemyItem.is_range_atk}, is_range_weapon: ${enemyItem.is_range_weapon}, weaponRange: ${enemyItem.weaponRange}`);

        // 🔮 【三土手神リフォーム：敵専用・個別上書き対応型本家RO式ディレイ換算】
        // 🧼 150.0 の仮保険を完全撤去！設定がなければ0になり、超スロー（または動かない抜け殻）になってバグを即座に知らせます！
        const currentEnemyAspd = enemyItem.enemy_aspd !== null && enemyItem.enemy_aspd !== undefined 
          ? Number(enemyItem.enemy_aspd) 
          : 0;
        
        // 本家RO公式: (200 - Aspd) / 50 × 1000ms
        // Aspd 193ならピッタリ「140ms（0.14秒）」になり、20ms刻みの時間軸を最速で駆け抜けます！
        const enemyInterval = ((200 - currentEnemyAspd) / 50) * 1000;
        
        // 固有インスタンスIDキーでタイマーを進める
        enemiesAtkTimers.current[enemyItem.instanceId] = (enemiesAtkTimers.current[enemyItem.instanceId] || 0) + 20;

        if (enemiesAtkTimers.current[enemyItem.instanceId] >= enemyInterval) {
          enemiesAtkTimers.current[enemyItem.instanceId] = 0;

          // 🧼 'none' という英語のフォールバックを廃止！システム全体の共通言語である日本語の 'なし' へ完全同期！
          const currentStatus = enemyItem.state?.currentStatus || 'なし';

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
              
              // 🔮 🆕 三土手神特注：【前衛・後衛 ＆ 敵遠距離フラグ連動型】ターゲット選定エンジン！
              let target = null;
              
              // 味方の中で、現在「前衛」かつ「生存」している肉体の壁メンバーを抽出
              const frontLineMembers = aliveMembers.filter(p => p.position === 'front');

              // 🏹 🆕 【三土手神特注】モンスター素体フラグ、または「装備した武器の射程」を検知して全域解放
              const isEnemyLongRange = enemyItem.is_range_atk === true || enemyItem.weaponRange === 'L' || enemyItem.is_range_weapon === true;

              if (isEnemyLongRange || frontLineMembers.length === 0) {
                // 弓などのLレンジ武器、または元から遠隔タイプなら後衛含む全員からランダム
                target = aliveMembers[Math.floor(Math.random() * aliveMembers.length)];
              } else {
                // ⚔️ 近接武器の場合は前衛の壁キャラを確実にロック
                target = frontLineMembers[Math.floor(Math.random() * frontLineMembers.length)];
              }

              // 🔮 🧠 【新規追加：敵の魔法・スキル発動AI】
              let usedSkill = null;
              const isSilenced = currentStatus === '沈黙';
              const enemySkills = enemyItem.activeSkills || [];
              
              if (!isSilenced && enemySkills.length > 0 && Math.random() < 0.30) {
                usedSkill = enemySkills[Math.floor(Math.random() * enemySkills.length)];
              }

              // 🏹 🆕 【三土手神特注】敵スキルのレンジ別ターゲット完全制御インフラ
if (usedSkill) {
                if (usedSkill.skill_range === 'S' && frontLineMembers.length > 0) {
                  // ① Sレンジスキルなら、敵のタイプに関わらず「前衛」に強制ロック！
                  target = frontLineMembers[Math.floor(Math.random() * frontLineMembers.length)];
                } else if (usedSkill.skill_range === 'L') {
                  // ② Lレンジスキル（大魔法など）なら、通常攻撃のヘイトを無視して「前衛・後衛の全員」からランダム再スキャン！
                  target = aliveMembers[Math.floor(Math.random() * aliveMembers.length)];
                }
              }

              // 🌟 【鉄壁の着着】ターゲットが完全に確定したあとで、安全に1度だけインデックスを取り出す！
              const targetIdx = localParty.findIndex(p => p.id === target.id);
              
              let dmg = 0;
              let logText = "";

              if (usedSkill) {
                // ✨ 魔法・スキル発動ルート
                const isMagic = usedSkill.skill_type === 'magic';
                const baseValue = Number(usedSkill.effect_value || 0);

                if (isMagic) {
                  // 🌍 🆕 【三土手神特注】敵の全体・範囲魔法判別インフラ
                  const isAOE = usedSkill.target_type === '敵全体' || usedSkill.target_type === '範囲エネミー' || usedSkill.name?.includes('全体') || usedSkill.isAreaOfEffect === true;

                  if (isAOE) {
                    // 🎆 【全体魔法ルート】味方全部隊を巻き込む一斉爆撃！
                    logText = `🔮✨ 【敵全体大魔法】${enemyItem.name} の【${usedSkill.name}】が炸裂！我が部隊を強襲！`;
                    newLogs.push({ id: `e-aoe-${enemyItem.instanceId}-${Date.now()}`, text: logText, type: "battle" });

                    localParty = localParty.map(member => {
                      if (member.hp <= 0) return member; // 死亡者はスキップ

                      let calculatedPower = baseValue;
                      if (usedSkill.value_type === 'percent') {
                        const eInt = enemyItem.int || 10;
                        calculatedPower = Math.floor((eInt * 2) * baseValue / 100);
                      }

                      const targetMdef = member.mdef || member.roStatus?.mdef || 0;
                      const aoeDmg = Math.max(1, calculatedPower - targetMdef);
                      const nextHp = Math.max(0, member.hp - aoeDmg);

                      let aoeLog = ` ➔ 💥 ${member.name} に ${aoeDmg} の全体魔法ダメージ！`;
                      let nextState = { ...member.state };

                      // 全体魔法の追加異常判定
                      if (usedSkill.effect_type && usedSkill.effect_type !== 'なし' && nextHp > 0) {
                        const baseChance = Number(usedSkill.effect_chance || 0);
                        if (Math.random() * 100 < baseChance) {
                          nextState = { ...member.state, currentStatus: usedSkill.effect_type, durationTurns: Number(usedSkill.duration_turns || 3) };
                          aoeLog += ` ✨ [${usedSkill.effect_type}]状態になった！`;
                        }
                      }

                      newLogs.push({ id: `e-aoe-hit-${member.id}-${Date.now()}-${Math.random()}`, text: aoeLog, type: "battle" });
                      return { ...member, hp: nextHp, state: nextState };
                    });

                    logText = ""; // 固有ログを newLogs に切り分けたので、メインの末尾結合用ログは空にする
                  } else {
                    // 🎯 【単体魔法ルート】従来の単体着弾ロジック
                    let calculatedPower = baseValue;
                    if (usedSkill.value_type === 'percent') {
                      const eInt = enemyItem.int || 10;
                      calculatedPower = Math.floor((eInt * 2) * baseValue / 100);
                    }
                    const targetMdef = target.mdef || target.roStatus?.mdef || 0;
                    dmg = Math.max(1, calculatedPower - targetMdef);
                    localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - dmg);
                    logText = `🔮 ${enemyItem.name} は 【${usedSkill.name}】 を詠唱！ ➔ ${target.name} に ${dmg} の魔法ダメージ！`;

                    if (usedSkill.effect_type && usedSkill.effect_type !== 'なし' && localParty[targetIdx].hp > 0) {
                      const baseChance = Number(usedSkill.effect_chance || 0);
                      if (Math.random() * 100 < baseChance) {
                        const turns = Number(usedSkill.duration_turns || 3);
                        localParty[targetIdx].state = { ...localParty[targetIdx].state, currentStatus: usedSkill.effect_type, durationTurns: turns };
                        logText += ` ✨ [追加効果] ${target.name} は【${usedSkill.effect_type}】状態になった！`;
                      }
                    }
                  }
                } else {
                  // 💥 物理特技スキルルート
                  // ⚔️ 敵の物理スキル用ベースATK計算
                  const isCursed = currentStatus === '呪い';
                  const effectiveStr = isCursed ? Math.floor(enemyItem.str * 0.5) : enemyItem.str;
                  const enemyBaseAtk = Math.floor(Math.random() * 10) + 10 + effectiveStr;
                  
                  let calculatedPower = baseValue;
                  // 敵のスキルは「usedSkill」、敵の基礎攻撃力は「enemyBaseAtk」を参照する
                  if (usedSkill.value_type === 'percent') calculatedPower = Math.floor((enemyBaseAtk * baseValue) / 100);

                  // 🔮 🆕 【三土手神特注】敵の物理スキルにも全体攻撃（AOE）判定を追加！
                  const isAOE = usedSkill.target_type === '敵全体' || usedSkill.target_type === '範囲エネミー' || usedSkill.name?.includes('全体') || usedSkill.isAreaOfEffect === true;

                  if (isAOE) {
                    // 🌪️ 敵の全体物理攻撃ループ
                    logText = `🔥💥 【全体物理】${enemyItem.name} の【${usedSkill.name}】が炸裂！全部隊を薙ぎ払う！`;
                    newLogs.push({ id: `e-aoe-art-${enemyItem.instanceId}-${Date.now()}`, text: logText, type: "battle" });

                    localParty = localParty.map(member => {
                      if (member.hp <= 0) return member;
                      
                      let bonusDef = 0;
                      const activeBuffs = member.activeBuffs || [];
                      activeBuffs.forEach(b => {
                        if (b.effect_type === '物理DEF増幅') {
                          if (b.buff_value_type === 'fixed') bonusDef += b.buff_value;
                          else if (b.buff_value_type === 'percent') bonusDef += Math.floor((member.vit || 0) * b.buff_value / 100);
                        }
                      });

                      const memberDef = member.vit || 0;
                      // 物理ダメージ計算（最低1ダメージ）
                      const aoeDmg = Math.max(1, calculatedPower - (memberDef + bonusDef));
                      const nextHp = Math.max(0, member.hp - aoeDmg);

                      let aoeLog = ` ➔ 💥 ${member.name} に ${aoeDmg} の物理ダメージ！`;
                      let nextState = { ...member.state };

                      // 追加効果（状態異常）の判定
                      if (usedSkill.effect_type && usedSkill.effect_type !== 'なし' && nextHp > 0) {
                        const baseChance = Number(usedSkill.effect_chance || 0);
                        if (Math.random() * 100 < baseChance) {
                          nextState = { ...member.state, currentStatus: usedSkill.effect_type, durationTurns: Number(usedSkill.duration_turns || 3) };
                          aoeLog += ` ✨ [${usedSkill.effect_type}]状態になった！`;
                        }
                      }
                      
                      newLogs.push({ id: `e-aoe-art-hit-${member.id}-${Date.now()}-${Math.random()}`, text: aoeLog, type: "battle" });
                      return { ...member, hp: nextHp, state: nextState };
                    });
                    logText = ""; // 固有ログを出したのでメインログは空にする
                  } else {
                    // 🛡️ 既存の単体物理ルート
                    let bonusDef = 0;
                    const activeBuffs = target.activeBuffs || [];
                    activeBuffs.forEach(b => {
                      if (b.effect_type === '物理DEF増幅') {
                        if (b.buff_value_type === 'fixed') bonusDef += b.buff_value;
                        else if (b.buff_value_type === 'percent') bonusDef += Math.floor((target.vit || 0) * b.buff_value / 100);
                      }
                    });

                    const targetDef = target.vit || 0;
                    dmg = Math.max(1, calculatedPower - (targetDef + bonusDef));

                    // 🛡️ 👑 【三土手神特注：物理スキル被弾時のバフ値連動型ディボーションセンサー】
                    const devotionBuff = activeBuffs.find(b => b.is_range_damage_cut && b.duration_turns > 0);
                    const casterMember = devotionBuff ? localParty.find(m => m.id === devotionBuff.casterId && m.hp > 0) : null;

                    if (devotionBuff && casterMember) {
                      const cutPct = Number(devotionBuff.range_damage_cut_pct !== undefined ? devotionBuff.range_damage_cut_pct : 100);
                      const transferredDmg = Math.floor(dmg * (cutPct / 100)); 
                      const originalRemainingDmg = Math.max(0, dmg - transferredDmg); 
                      
                      localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - originalRemainingDmg);
                      
                      const casterIdx = localParty.findIndex(m => m.id === casterMember.id);
                      localParty[casterIdx].hp = Math.max(0, localParty[casterIdx].hp - transferredDmg);
                      
                      if (cutPct >= 100) {
                        logText = `💥 ${enemyItem.name} の 【${usedSkill.name}】！ ➔ 🛡️[ディボーション発動!] ${casterMember.name} が ${target.name} を完全に庇って代わりに ${transferredDmg} のダメージを請け負った！(残HP:${localParty[casterIdx].hp})`;
                      } else {
                        logText = `💥 ${enemyItem.name} の 【${usedSkill.name}】！ ➔ 🛡️[絆の分散発動!] ${casterMember.name} がダメージの ${cutPct}% (${transferredDmg}) を肩代わり！ ${target.name} は残りの ${originalRemainingDmg} ダメージに抑えた！`;
                      }
                    } else {
                      localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - dmg);
                      logText = `💥 ${enemyItem.name} の 【${usedSkill.name}】！ ➔ ${target.name} に ${dmg} の物理ダメージ！`;
                    }

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
                  }
                }
              } else {
                // 💀 【通常攻撃ルート】スキルを使わない通常攻撃は、上で決まった肉体の壁（前衛）を確実に殴る！
                const isCursed = currentStatus === '呪い';
                const effectiveStr = isCursed ? Math.floor(enemyItem.str * 0.5) : enemyItem.str;
                const baseAtk = Math.floor(Math.random() * 10) + 10 + effectiveStr;
                
                const isBlinded = currentStatus === '暗闇';
                
                if (isBlinded && Math.random() < 0.5) {
                  logText = `🕶️ ${enemyItem.name} は暗闇に包まれて攻撃を外した！ ${target.name} は鮮やかに回避した！`;
                } else {
                  // 🔮 【Flee完全回避ジャッジ】
                  const enemyHit = Number(enemyItem.hit || 21);
                  const playerFlee = Number(target.roStatus?.flee || target.flee || 0);
                  const fleeChance = 20 + playerFlee - enemyHit;
                  const cappedFleeChance = Math.min(95, fleeChance);
                  const randomRoll = Math.floor(Math.random() * 100);

                  if (randomRoll < cappedFleeChance) {
                    logText = `💨 [MISS] ${enemyItem.name} が 【${target.name}】 を強襲！しかし、ヒラリとかわされた！ (回避率:${Math.max(0, cappedFleeChance)}%)`;
                  } else {
                    // 🛡️ 🆕 通常攻撃時のバフ効果（物理DEF増幅）の集計
                    let bonusDef = 0;
                    const activeBuffs = target.activeBuffs || [];
                    activeBuffs.forEach(b => {
                      if (b.effect_type === '物理DEF増幅') {
                        if (b.buff_value_type === 'fixed') bonusDef += b.buff_value;
                        else if (b.buff_value_type === 'percent') bonusDef += Math.floor((target.vit || 0) * b.buff_value / 100);
                      }
                    });

                    dmg = Math.max(1, baseAtk - (target.vit + bonusDef));

                    // 🛡️ 🆕 【三土手神特注：通常攻撃被弾時のディボーション割り込みセンサー】
                    const devotionBuff = activeBuffs.find(b => b.is_range_damage_cut && b.duration_turns > 0);
                    const casterMember = devotionBuff ? localParty.find(m => m.id === devotionBuff.casterId && m.hp > 0) : null;

                    if (devotionBuff && casterMember) {
                      // 🛡️ 👑 【三土手神特注：通常攻撃被弾時のバフ値連動型ディボーションセンサー】
                      // 通常攻撃被弾側も同様に range_damage_cut_pct から「50%」を取り出す設計に変更！
                      const cutPct = Number(devotionBuff.range_damage_cut_pct !== undefined ? devotionBuff.range_damage_cut_pct : 100);
                      
                      // 通常攻撃ダメージを割合で分配計算
                      const transferredDmg = Math.floor(dmg * (cutPct / 100)); // ファイター側
                      const originalRemainingDmg = Math.max(0, dmg - transferredDmg); // クレリック側
                      
                      // 各キャラクターのHPを引き算
                      localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - originalRemainingDmg);
                      
                      const casterIdx = localParty.findIndex(m => m.id === casterMember.id);
                      localParty[casterIdx].hp = Math.max(0, localParty[casterIdx].hp - transferredDmg);
                      
                      if (cutPct >= 100) {
                        logText = `💥 ${enemyItem.name} の攻撃！ ➔ 🛡️[ディボーション発動!] ${casterMember.name} が身を挺して ${target.name} を庇い、代わりに ${transferredDmg} の物理ダメージを請け負った！(残HP:${localParty[casterIdx].hp})`;
                      } else {
                        logText = `💥 ${enemyItem.name} の攻撃！ ➔ 🛡️[絆の分散発動!] ${casterMember.name} がダメージの ${cutPct}% (${transferredDmg}) を身代わり！ ${target.name} は残りの ${originalRemainingDmg} の物理ダメージを受けた！`;
                      }
                    } else {
                      // 通常の通常攻撃着弾処理
                      localParty[targetIdx].hp = Math.max(0, localParty[targetIdx].hp - dmg);
                      logText = `💥 ${enemyItem.name} の攻撃！ ${target.name} は ${dmg} の物理ダメージを受けた！`;
                    }
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
  console.log(`🛡️ ${member.name} の射程: ${member.weaponRange}, 位置: ${member.position}`);
  if (member.hp <= 0) return;

  let aliveEnemies = localEnemies.filter(e => e.hp > 0);
        if (aliveEnemies.length === 0) return member;

        // 💨 👑 【三土手神特注：ASPDバフのリアルタイム加算エンジン】
        let bonusAspd = 0;
        if (member.activeBuffs && member.activeBuffs.length > 0) {
          member.activeBuffs.forEach(b => {
            if (b.effect_type === '行動速度Aspd増幅') {
              if (b.buff_value_type === 'fixed') bonusAspd += b.buff_value;
              else if (b.buff_value_type === 'percent') bonusAspd += Math.floor((member.aspd || 150) * b.buff_value / 100);
            }
          });
        }

        // 素のASPDにバフを加算（本家の最大ASPD193でキャップをかける安全設計！）
        const currentTotalAspd = Math.min(193.0, Number(member.aspd || 0) + bonusAspd);
        const playerInterval = ((200 - currentTotalAspd) / 50) * 1000;
        
        partyAtkTimers.current[member.id] += 20;

  if (partyAtkTimers.current[member.id] >= playerInterval) {
    partyAtkTimers.current[member.id] = 0;

    // 🆕 【三土手神特注：後衛行動制御ゲート】
    const isBackRow = member.position === 'back';
const isShortRange = member.weaponRange === 'S';

if (isBackRow && isShortRange) {
  // 1. そもそもスキルを持っていないなら待機
  const hasAnySkill = member.skillsList && member.skillsList.length > 0;
  
  // 2. 「今、実行可能なスキルが1つもない」かチェック
  // 回復が必要ないのに回復スキルしかない場合なども「実行可能」とは言えません
  const canPerformAnySkill = member.skillsList.some(sk => {
              if (member.sp < Number(sk.sp_cost || 0)) return false;
              if (sk.effect_type === '状態異常回復') {
                return localParty.some(p => p.hp > 0 && p.state?.currentStatus && ['スタン', '凍結', '毒', '暗闇', '睡眠', '沈滅', '沈黙', '呪い', '石化'].includes(p.state.currentStatus));
              }
              if (sk.effect_type === '回復' || sk.name?.includes('ヒール')) {
                // 🧼 最低保証の424を完全粉砕！本来のキャラクターの最大HP（mhp または max_hp）と比較させます
                return localParty.some(p => p.hp > 0 && p.hp < (p.mhp || p.max_hp || 0));
              }
              return true;
            });

  // 魔法が全く無い、またはSP不足、または今の局面で使える魔法がないなら待機
  if (!hasAnySkill || !canPerformAnySkill) {
    // すでに待機ログが出ていたら重複して出さない
    const alreadyWaiting = displayedLogs.some(l => l.text.includes(member.name + " は後衛から"));
    if (!alreadyWaiting) {
      newLogs.push({ id: `wait-${member.id}-${Date.now()}`, text: `🛡️ ${member.name} は後衛から好機を伺い、静かに待機している。`, type: "system" });
    }
    return; // 確実に待機させる
  }
}
    // 後衛でSP切れの場合も待機
    if (isBackRow && member.sp <= 0) {
            newLogs.push({ id: `wait-sp-${member.id}-${Date.now()}`, text: `💤 ${member.name} は魔力が枯渇し、身を守るのに専念している。`, type: "system" });
            return; 
          }

          // 🛡️ 👑 【三土手神特注：術者行動ベースのバフ消費エンジン】
          // 自分が行動したタイミングで、パーティ全員にかかっている「自分がかけたバフ」のターンを1減らす！
          localParty.forEach(ally => {
  if (ally.activeBuffs && ally.activeBuffs.length > 0) {
    ally.activeBuffs = ally.activeBuffs.map(buff => {
      if (buff.casterId === member.id) {
        // かけたばかりのターンは引き算をスキップして保護する
        if (buff.isNew) {
          return { ...buff, isNew: false };
        }
        const nextTurns = buff.duration_turns - 1;
        if (nextTurns <= 0) {
          newLogs.push({ id: `buff-clear-${ally.id}-${buff.id}-${Date.now()}-${Math.random()}`, text: `✨ ${ally.name} の【${buff.name}】の効果が静かに切れた。`, type: "system" });
        }
        return { ...buff, duration_turns: nextTurns };
      }
      return buff;
    }).filter(buff => buff.duration_turns > 0);
  }
});

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

          // 🧠 全ての変数を一度だけ宣言
          let shouldLaunchMagic = false;
          let playableSkill = null;
          let targetAlly = null;
          let finalDmg = 0;
          let logText = "";
          
          // --- ✂️ ここから追加・修正ブロック ---
          // 🛡️ 【三土手神特注】後衛キャラ行動制限エンジン
          if (member.position === 'back' && member.weaponRange === 'S') {
            // 現在使えるスキルを再計算（攻撃対象や回復対象がいなくても使えるか判定）
            const canUseSkill = member.skillsList.some(sk => member.sp >= Number(sk.sp_cost || 0));
            
            // 魔法・スキルが全くない、またはSP不足なら、どんな状況でも通常攻撃は「絶対に」させない
            if (!playableSkill && !canUseSkill) {
               newLogs.push({ id: `wait-back-${member.id}-${Date.now()}`, text: `🛡️ ${member.name} は後衛のため、近接攻撃を封印し待機した。`, type: "system" });
               return; // 攻撃の計算ロジックに到達させない
            }
          }
          // --- ✂️ ここまで追加・修正ブロック ---

          const myStr = member.str || 0;
          const myDex = member.dex || 0;
          const minAtk = Math.floor(myStr + (myDex * 0.5));
          const maxAtk = Math.floor(myStr * 2.5 + myDex);
          const randomizedAtk = Math.floor(Math.random() * (maxAtk - minAtk + 1)) + minAtk;

          // 🏹 🆕 【三土手神特注】後衛時におけるSレンジスキルの暴発封印ゲート（ここで1度だけ宣言）
          const rawSkillsList = member.skillsList || [];
          const rangeFilteredSkills = rawSkillsList.filter(sk => {
            // 🔮 👑 常時発動型のパッシブスキルは、アクティブ技のプールから物理的に100%永久除外！
            if (sk.skill_type === 'passive') return false;

            // 🚑 👑 【三土手神特注パッチ】回復やバフなど「味方にかける支援魔法」は射程制限から免除！
            const isSupportMagic = ['状態異常回復', '回復', '物理ATK増幅', '物理DEF増幅', '行動速度Aspd増幅', '魔力Matk増幅', '魔法防御Mdef増幅', '魔法防御MDEF増幅'].includes(sk.effect_type) || sk.name?.includes('ヒール');

            // 支援魔法ではなく、キャラが後衛かつSレンジなら除外
            if (!isSupportMagic && member.position === 'back' && sk.skill_range === 'S') {
              return false; 
            }
            return true;
          });

          // 🚑 救命・浄化AI環境スキャン（厳密な8大状態異常検知センサー）
          const VALID_STATUS_AILMENTS = ['スタン', '凍結', '毒', '暗闇', '睡眠', '沈滅', '沈黙', '呪い', '石化'];
          
          const hasStatusAilment = localParty.some(p => 
            p.hp > 0 && 
            p.state?.currentStatus && 
            VALID_STATUS_AILMENTS.includes(p.state.currentStatus)
          );
          
          // 🧼 最低保証の424を完全粉砕！本来のキャラクターの最大HP（mhp または max_hp）の90%未満を正確にスキャン
          const isEmergencyHP = localParty.some(p => p.hp > 0 && p.hp < (p.mhp || p.max_hp || 0) * 0.9);

          // 🧠 三土手神特注：スキルプールから「今撃てる有効なスキル」を事前選別
          // 💡 射程フィルターを通過した「rangeFilteredSkills」を対象にして、2回目の重複宣言を粉砕！
          const allowedSkills = rangeFilteredSkills.filter(sk => {
            // 異常者が誰もいないなら、キュア系は選考対象外
            if (sk.effect_type === '状態異常回復' && !hasStatusAilment) return false;
            // 瀕死の味方が誰もいないなら、ヒール系も選考対象外
            if ((sk.effect_type === '回復' || sk.name?.includes('ヒール')) && !isEmergencyHP) return false;
            return true;
          });

          // 🛡️ 🆕 【三土手神特注】バフ・支援特技の自動ガンビットスキャン回路
          // 🚑 1. 【最優先】状態異常回復（キュア）AI
          if (hasStatusAilment) {
            const cureSkill = allowedSkills.find(sk => sk.effect_type === '状態異常回復' && member.sp >= Number(sk.sp_cost || 0));
            if (cureSkill) { 
                playableSkill = cureSkill; 
                shouldLaunchMagic = true; 
                targetAlly = localParty.find(p => p.hp > 0 && p.state?.currentStatus && VALID_STATUS_AILMENTS.includes(p.state.currentStatus));
            }
          } 
          
          // 💉 2. 【次点】緊急HP回復（ヒール）AI：HP70%未満で即座にロックオン
          if (!targetAlly && isEmergencyHP) {
            const healSkill = allowedSkills.find(sk => sk.name?.includes('ヒール' ) || sk.effect_type === '回復');
            if (healSkill && member.sp >= Number(healSkill.sp_cost || 0)) { 
                playableSkill = healSkill; 
                shouldLaunchMagic = true; 
                // 最もHPの低い味方を優先してターゲット
                targetAlly = localParty.filter(p => p.hp > 0 && p.hp < (p.mhp || p.max_hp || 0)).sort((a,b) => a.hp - b.hp)[0] || member;
            }
          } 

          // 🛡️ 3. 【さらに次点】バフ・支援特技（速度増加など）AI：誰も死にかけていない時だけかける
          if (!targetAlly) {
            const buffEffectTypes = ['物理ATK増幅', '物理DEF増幅', '行動速度Aspd増幅', '魔力Matk増幅', '魔法防御Mdef増幅', '魔法防御MDEF増幅'];
            const availableBuffSkills = allowedSkills.filter(sk => buffEffectTypes.includes(sk.effect_type) && member.sp >= Number(sk.sp_cost || 0));
            
            if (availableBuffSkills.length > 0) {
              let selectedBuffSkill = null;
              let selectedTarget = null;

              // 🎯 ステップA：優先ターゲット（例：ムキムキ➔ファイター、魔力あがれ➔メイジ）を厳格に探す
              for (let bSkill of availableBuffSkills) {
                let priorityJobs = bSkill.target_priority_jobs;
                if (typeof priorityJobs === 'string') {
                  if (priorityJobs.trim() === '') priorityJobs = [];
                  else {
                    try { priorityJobs = JSON.parse(priorityJobs); }
                    catch (e) { priorityJobs = priorityJobs.replace(/[\[\]"']/g, '').split(',').map(s => s.trim()).filter(Boolean); }
                  }
                }
                priorityJobs = priorityJobs || [];

                if (priorityJobs.length > 0) {
                  let pFiltered = localParty.filter(p => p.hp > 0 && !(p.activeBuffs || []).some(b => b.id === bSkill.id));
                  if (bSkill.is_range_damage_cut === true) pFiltered = pFiltered.filter(p => p.id !== member.id);

                  for (let jobReq of priorityJobs) {
                    const cleanReq = jobReq.replace(/[\[\]"']/g, '').trim();
                    const foundMatch = pFiltered.find(p => p.name.includes(cleanReq) || p.job === cleanReq);
                    if (foundMatch) {
                      selectedBuffSkill = bSkill;
                      selectedTarget = foundMatch;
                      break;
                    }
                  }
                }
                if (selectedBuffSkill) break; 
              }

              // 🎯 ステップB：優先指定の無い「汎用バフ」だけを処理する
              if (!selectedBuffSkill) {
                for (let bSkill of availableBuffSkills) {
                  // 🚨 【大本命の修正箇所】優先職（メイジ等）が設定されているバフは、専用魔法なので誰彼構わずかけない（スキップ）！
                  let priorityJobs = bSkill.target_priority_jobs;
                  if (typeof priorityJobs === 'string') {
                    if (priorityJobs.trim() === '') priorityJobs = [];
                    else {
                      try { priorityJobs = JSON.parse(priorityJobs); }
                      catch (e) { priorityJobs = priorityJobs.replace(/[\[\]"']/g, '').split(',').map(s => s.trim()).filter(Boolean); }
                    }
                  }
                  priorityJobs = priorityJobs || [];

                  // 優先指定が存在するなら、それは汎用バフではないのでステップBでは無視する
                  if (priorityJobs.length > 0) {
                    continue; 
                  }

                  const isAreaBuff = bSkill.target_type === '味方全体';
                  let pFiltered = localParty.filter(p => p.hp > 0 && !(p.activeBuffs || []).some(b => b.id === bSkill.id));
                  if (bSkill.is_range_damage_cut === true) pFiltered = pFiltered.filter(p => p.id !== member.id);

                  const totalTargetsCount = bSkill.is_range_damage_cut === true 
                    ? localParty.filter(p => p.hp > 0 && p.id !== member.id).length
                    : localParty.filter(p => p.hp > 0).length;

                  const alreadyBuffedCount = totalTargetsCount - pFiltered.length;

                  if (alreadyBuffedCount >= totalTargetsCount || (isAreaBuff && alreadyBuffedCount > 0)) {
                    continue;
                  }

                  if (pFiltered.length > 0) {
                    selectedBuffSkill = bSkill;
                    selectedTarget = pFiltered[0]; // 先頭の味方に付与
                    break;
                  }
                }
              }

              if (selectedBuffSkill && selectedTarget) {
                playableSkill = selectedBuffSkill;
                shouldLaunchMagic = true;
                targetAlly = selectedTarget;
              } else {
                playableSkill = null;
                shouldLaunchMagic = false;
                targetAlly = null;
              }
            }
          }
          
          if (!targetAlly && primaryTarget) {
            // 🔮 弱点属性攻撃スキャン
            const weaknessMap = {
              '水': ['風', '風属性'], '火': ['水', '水属性'], '地': ['火', '火属性'],
              '風': ['地', '地属性'], '闇': ['聖', '聖属性'], '不死': ['聖', '聖属性', '火', '火属性'], '聖': ['闇', '闇属性']
            };
            const weaknesses = weaknessMap[primaryTarget.element] || [];
            
            // ① まずは今まで通り、2倍ダメージを狙える完全な弱点魔法があるかスキャン
            let exploitSkill = allowedSkills.find(sk => weaknesses.includes(sk.element) && member.sp >= Number(sk.sp_cost || 0));
            
            // ② 🚨 【三土手神特注】弱点魔法がない、または無属性魔法や聖属性パッシブ特効を活かしたい場合の救済ゲート
            if (!exploitSkill) {
              exploitSkill = allowedSkills.find(sk => 
                (sk.element === '無' || sk.element === '聖' || sk.name === 'ホーリーライト') && 
                member.sp >= Number(sk.sp_cost || 0) &&
                !['物理ATK増幅', '物理DEF増幅', '行動速度Aspd増幅', '魔力Matk増幅', '魔法防御Mdef増幅', '魔法防御MDEF増幅'].includes(sk.effect_type) // ✨バフ魔法が攻撃として誤判定されるのを完全封鎖！
              );
            }

            if (exploitSkill) {
              // 弱点、無属性、聖属性に該当するスキルがあれば従来通り100%確定発動！
              playableSkill = exploitSkill;
              shouldLaunchMagic = true;
            } else {
              // 🎲【三土手神特注：弱点外スキルのごちゃ混ぜ抽選インフラ】
              // 弱点ではない属性スキル（火属性ブレスなど）しか残っていない場合、
              // 45%の確率でスキルを撃ち、55%の確率で通常攻撃とするための天秤ジャッジ！
              const currentSpRatio = (member.sp / (member.msp || 1)) * 100;
              const isTargetBoss = primaryTarget ? primaryTarget.is_boss === true : false;

              // 純粋な攻撃用アクティブスキル（支援バフや回復、パッシブを除外）をスキャン
              const attackSkillsPool = allowedSkills.filter(sk => 
                sk.skill_type !== 'passive' && 
                !['物理ATK増幅', '物理DEF増幅', '行動速度Aspd増幅', '魔力Matk増幅', '魔法防御Mdef増幅', '魔法防御MDEF増幅', '回復', '状態異常回復'].includes(sk.effect_type)
              );

              // 45%の確率ダイスに当選し、かつSP制限をクリアしていれば、プールからスキル（ブレス等）をランダム決定して強制起動！
              if (attackSkillsPool.length > 0 && Math.random() < 0.45 && (isTargetBoss || currentSpRatio > 50)) {
                const rolledSkill = attackSkillsPool[Math.floor(Math.random() * attackSkillsPool.length)];
                if (member.sp >= Number(rolledSkill.sp_cost || 0)) {
                  playableSkill = rolledSkill;
                  shouldLaunchMagic = true;
                }
              }
            }
          }

          // ─── ここから魔法を撃たなかった場合の通常攻撃／確率特技判定 ───
          const skillSpCost = playableSkill ? Number(playableSkill.sp_cost || 0) : 0;
          const isTargetBoss = primaryTarget ? primaryTarget.is_boss === true : false;
          // 🧼 仮置き「50」を完全撤去！0除算によるフリーズを防ぐために最低保証は「1」へ直撃結合！
          const currentSpRatio = (member.sp / (member.msp || 1)) * 100;

          // 💡 変数名をactiveSkillsへ安全マウントして変数未定義クラッシュを完全に粉砕！
          const activeSkills = allowedSkills;

          // 🎲 💡 【重要】すでに上で弱点攻撃やブレスのスキル発動（shouldLaunchMagic）が確定していない場合のみ、
          // 支援バフや回復魔法などのランダム選出処理を実行する仕様へリフォーム！
          if (!shouldLaunchMagic && activeSkills.length > 0) {
            playableSkill = activeSkills[Math.floor(Math.random() * activeSkills.length)];
            
            // ランダムに選ばれた支援スキル等を撃つかどうかの最終チェック
            if (playableSkill && member.sp >= Number(playableSkill.sp_cost || 0)) {
              // 🔮 👑 【三土手神特注：ランダム暴発ルート完全封印センサー】
              const isBuffType = ['物理ATK増幅', '物理DEF増幅', '行動速度Aspd増幅', '魔力Matk増幅'].includes(playableSkill.effect_type);

              if (isBuffType) {
                const rPriorityJobs = playableSkill.target_priority_jobs || [];
                let rFilteredAllies = localParty.filter(p => p.hp > 0 && !(p.activeBuffs || []).some(b => b.id === playableSkill.id));
                
                // 🛡️ 👑 【三土手神特注パッチ】かばう（献身）系スキルの場合は、術者本人をターゲット候補から完全除外！
                if (playableSkill.is_range_damage_cut === true) {
                  rFilteredAllies = rFilteredAllies.filter(p => p.id !== member.id);
                }

                let foundValidTarget = false;

                if (rPriorityJobs.length > 0) {
                  // 優先職の中に生きている該当者がいるかチェック
                  for (let jobReq of rPriorityJobs) {
                    const matchedAlly = rFilteredAllies.find(p => p.name.includes(jobReq) || p.job === jobReq);
                    if (matchedAlly) {
                      foundValidTarget = true;
                      targetAlly = matchedAlly; // ✨ 対象を確定ロックオン
                      break;
                    }
                  }
                } else {
                  // 優先職指定がないバフなら生存している先頭の味方へ
                  if (rFilteredAllies.length > 0) {
                    foundValidTarget = true;
                    targetAlly = rFilteredAllies[0];
                  }
                }

                // 🎯 三土手神指摘の超重要修正：対象の職がいない場合は、スキル発動をキャンセルして通常行動へスルー！
                if (!foundValidTarget) {
                  playableSkill = null;
                  shouldLaunchMagic = false;
                  targetAlly = null;
                }
              }

              // バフの対象チェックを無事通過、または攻撃スキルの場合は通常通り発動ジャッジへ
              if (playableSkill && !shouldLaunchMagic && (isTargetBoss || currentSpRatio > 50)) {
                shouldLaunchMagic = true;
              }
            }
          }

          // 🛡️ 【三土手神特注：バフ・かばう（ディボーション）重複発動封印パッチ】
          // 決定されたスキルがバフ・支援系（物理DEF増幅など）の場合の重複チェック
          if (shouldLaunchMagic && playableSkill && targetAlly && ['物理DEF増幅', '物理ATK増幅', '行動速度Aspd増幅', '魔力Matk増幅'].includes(playableSkill.effect_type)) {
  
  // 🎯 今回魔法をかける予定の「targetAlly」だけを狙い撃ちして、同じバフIDを持っているかチェック！
  const isAlreadyBuffed = (targetAlly.activeBuffs || []).some(b => b.id === playableSkill.id);
  
  if (isAlreadyBuffed) {
    // この仲間はすでにそのバフがかかっているので、今ターンのスキル発動を安全にキャンセル
    shouldLaunchMagic = false;
    playableSkill = null;
  }
}

          const finalCriticalRate = member.final_battle_critical > 0 ? member.final_battle_critical : (member.luk || 0);
          const isCritical = Math.random() * 100 < finalCriticalRate;

          // ✨安全確保：先にすべてのカードエフェクトバッファの器をシャローコピーで完全に展開してメモリにマウント！
          const cardSize = { ...(member.cardSizeEff || {}) };
          let cardRace = { ...(member.cardRaceEff || {}) };
          let cardElem = { ...(member.cardElemEff || {}) }; // ✨修正：cardElem をここで安全に宣言し、クラッシュの芽を完全粉砕！

          // 🛡️ 👑 【三土手神特注】ホーリープラクティス専用・種族＆属性ハイブリッド特効判定線
          const hasHolyPractice = (member.skillsList || []).find(sk => 
  sk.name === 'ホーリープラクティス' || 
  sk.name === 'ホーリーガーディアン' // 👈 ここにダッシュボードで付けた名前を完全一致で入れます
);
          if (hasHolyPractice && primaryTarget) {
            const bonusPct = Number(hasHolyPractice.effect_value || 20); // 登録した20%を取得
            
            // 敵の種族が「悪魔」「不死」、または敵の属性（element）が「不死」の場合に発動ゲートを全開にする
            const isTargetDemonicOrUndead = primaryTarget.race === '悪魔' || primaryTarget.race === '不死' || primaryTarget.element === '不死';
            
            if (isTargetDemonicOrUndead) {
              // 独立数理室（gameRules.js）のどのオブジェクト判定線に引っかかってもいいように、すべてに20%を安全インジェクション！
              cardRace['悪魔'] = (cardRace['悪魔'] || 0) + bonusPct;
              cardRace['不死'] = (cardRace['不死'] || 0) + bonusPct;
              cardElem['不死'] = (cardElem['不死'] || 0) + bonusPct; 
            }
          }

          const sizeValue = cardSize['小型'] || 0;
          const raceValue = cardRace['無形'] || 0;
          const elemValue = cardElem['地'] || 0;
          const undeadElemValue = cardElem['不死'] || 0; // ✨新設：不死属性特効の変動値を安全にロードする配線
          
          // 🔮 🆕 三土手神特注：初回ロード時に小文字で安全マウントした武器属性（weaponElement）を正確に引き継ぐ
          let currentWeaponElement = member.weaponElement || '無';
          if (elemValue > 0) currentWeaponElement = '地';

          const attackSpecs = {
            element: currentWeaponElement, 
            // 🔮 🆕 ここを修正！初回ロードで魂に刻んだ本物の武器種別（weaponSubtype）をガチッと数理計算室へ投下！
            weapon_subtype: member.weaponSubtype, 
            is_physical: true,
            card_size_eff: primaryTarget ? { [primaryTarget.size]: sizeValue } : {}, 
            card_race_eff: primaryTarget ? cardRace : {}, 
            card_elem_eff: primaryTarget ? cardElem : {} // ✨ここを修正：固定オブジェクトではなく、ホーリープラクティスが蓄積された「cardElem」を丸ごと投下！
          };
          const defenderSpecs = primaryTarget ? { element: primaryTarget.element, race: primaryTarget.race, size: primaryTarget.size } : { element: '無', race: '無形', size: '中型' };
          const totalMultiplier = calculateDamageModifier(attackSpecs, defenderSpecs);

          // ⚡ 実行ルート
          if (shouldLaunchMagic && playableSkill) {
            member.sp = Math.max(0, member.sp - Number(playableSkill.sp_cost || 0));
            const baseValue = Number(playableSkill.effect_value || 0);
            
            // 🛡️ 👑 【三土手神特注】古いガバガバ判定をここで完全粉砕！バフと回復を100%厳密に仕分ける定義
            const isCureSkill = playableSkill.effect_type === '状態異常回復';
            const isHealSkill = playableSkill.effect_type === '回復' || playableSkill.name?.includes('ヒール');
            const isBuffSkill = ['物理ATK増幅', '物理DEF増幅', '行動速度Aspd増幅', '魔力Matk増幅'].includes(playableSkill.effect_type);

            if (isCureSkill || isHealSkill) {
              // 🧪 ① 純粋な回復・キュア魔法専用ルート
              let calculatedHeal = 0;
              if (baseValue > 0) {
                calculatedHeal = baseValue;
                if (playableSkill.value_type === 'percent' || playableSkill.calculation_type === 'percent') {
                  const myInt = member.int || member.stat_int || 10;
                  calculatedHeal = Math.floor((myStr + myInt * 2.5) * (baseValue / 100));
                }
                if (calculatedHeal < 1) calculatedHeal = 1;
              }

              const isAreaHeal = playableSkill.target_type === '味方全体';

              if (isAreaHeal) {
                logText = `🚑✨ [全体発動] ${member.name} が 【${playableSkill.name}】 を詠唱！ (残SP: ${member.sp})`;
                newLogs.push({ id: `p-heal-aoe-${member.id}-${Date.now()}`, text: logText, type: "success" });
                
                localParty = localParty.map(ally => {
                  if (ally.hp <= 0) return ally;
                  let updatedAlly = { ...ally };
                  if (calculatedHeal > 0) {
                    // 🧼 最低保証の424を完全粉砕！それぞれの味方の本物の最大HP（mhp または max_hp）を確実に逆引き！
                    const targetMhp = Number(ally.mhp || ally.max_hp || 0);
                    const oldHp = ally.hp;
                    const nextHp = Math.min(targetMhp, ally.hp + calculatedHeal);
                    newLogs.push({ id: `p-heal-aoe-hit-${ally.id}-${Date.now()}`, text: `    ➔ ✨ 【${ally.name}】 のHPが ${nextHp - oldHp} 回復！ (${nextHp}/${targetMhp})`, type: "success" });
                    updatedAlly.hp = nextHp;
                  }
                  if (isCureSkill) {
                    updatedAlly.state = { isFrozen: false, isStunned: false, stunTurns: 0, freezeTurns: 0, currentStatus: 'none', durationTurns: 0 };
                  }
                  return updatedAlly;
                });
                logText = ""; 
              } else {
                if (!targetAlly) targetAlly = member;
                // 🧼 最底保証の424を完全粉砕！ターゲットになった仲間の本来の最大HP（mhp または max_hp）の上限まで確実に直撃全回復！
                const targetMhp = Number(targetAlly.mhp || targetAlly.max_hp || 0);
                const oldHp = targetAlly.hp;
                
                if (calculatedHeal > 0) {
                  targetAlly.hp = Math.min(targetMhp, targetAlly.hp + calculatedHeal);
                  logText = `🚑💚 [スキル発動] ${member.name} の 【${playableSkill.name}】！ ➔ ${targetAlly.name} のHPが ${targetAlly.hp - oldHp} 回復！ (残SP: ${member.sp})`;
                } else {
                  logText = `✨ [スキル発動] ${member.name} は 【${playableSkill.name}】 を唱え、神聖な魔力で 【${targetAlly.name}】 を包み込んだ！ (残SP: ${member.sp})`;
                }

                if (isCureSkill) {
                  targetAlly.state = { isFrozen: false, isStunned: false, stunTurns: 0, freezeTurns: 0, currentStatus: 'none', durationTurns: 0 };
                  logText += ` ➔ 🌟 状態異常が完全に浄化された！`;
                }

                const partyFindIdx = localParty.findIndex(p => p.id === targetAlly.id);
                if (partyFindIdx !== -1) {
                  localParty[partyFindIdx].hp = targetAlly.hp;
                  localParty[partyFindIdx].state = targetAlly.state;
                }
              }
            } else if (isBuffSkill) {
              // 🛡️ ② 特注：戦術支援・物理特技「かばう（ディボーション）」専用ルート
              const successRoll = Math.random() * 100;
              const effChance = Number(playableSkill.effect_chance !== undefined ? playableSkill.effect_chance : 100);

              // 🛡️ 【三土手神特注】かばう（ダメージ肩代わり）スキルの場合のみ、自分への使用を禁止して他の仲間へ
              const isRangeCut = playableSkill.is_range_damage_cut === true;
              if (isRangeCut && (!targetAlly || targetAlly.id === member.id)) {
                targetAlly = localParty.find(p => p.hp > 0 && p.id !== member.id) || member;
              } else if (!targetAlly) {
                targetAlly = member; // 優先ターゲットもかばう指定もない場合の安全措置
              }

              if (successRoll > effChance) {
                logText = `⚠️ [スキル失敗] ${member.name} は 【${playableSkill.name}】 を発動しようとしたが、失敗した！`;
              } else {
                const bValue = Number(playableSkill.buff_value || 0); // 物理DEF増幅の数値 (20)
                const bValueType = playableSkill.buff_value_type || 'percent';
                const isRangeCut = playableSkill.is_range_damage_cut === true;
                
                // 🌍 🆕 データベースの「range_damage_cut_pct」カラムから本来の請負い％（50）をロード！
                const rangeCutPct = Number(playableSkill.range_damage_cut_pct !== undefined ? playableSkill.range_damage_cut_pct : 100);
                const turns = Number(playableSkill.duration_turns || 3);

                const newBuff = {
                  id: playableSkill.id,
                  name: playableSkill.name,
                  effect_type: playableSkill.effect_type,
                  buff_value: bValue, // DEFバフ用に 20 をそのまま記憶
                  buff_value_type: bValueType,
                  is_range_damage_cut: isRangeCut,
                  range_damage_cut_pct: rangeCutPct, // 🛡️ 肩代わり率専用キーに本来の 50 を格納！
                  duration_turns: turns,
                  casterId: member.id,
                  // 🎯 【三土手神特注】確定発動時も true に設定し、発動ターン直後の重複すり減りから鉄壁ガード！
                  isNew: true 
                    };

                // スキルの効果タイプを判別して、ログの文字列を切り替える！
                let buffMsg = "ステータスが上昇した！";
if (playableSkill.effect_type === '物理DEF増幅') buffMsg = "物理防御が上昇した！";
else if (playableSkill.effect_type === '物理ATK増幅') buffMsg = "物理攻撃力が上昇した！";
else if (playableSkill.effect_type === '行動速度Aspd増幅') buffMsg = "行動速度が上昇した！";
else if (playableSkill.effect_type === '魔法防御Mdef増幅' || playableSkill.effect_type === '魔法防御MDEF増幅') buffMsg = "魔法防御が上昇した！";

                const isAreaBuff = playableSkill.target_type === '味方全体';

                if (isAreaBuff) {
                  logText = `🙌✨ [スキル発動] ${member.name} は 【${playableSkill.name}】 を発動した！`;
                  newLogs.push({ id: `p-buff-aoe-${member.id}-${Date.now()}`, text: logText, type: "success" });

                  localParty = localParty.map(ally => {
                    if (ally.hp <= 0) return ally;
                    
                    // 🛡️ 【三土手神特注：セルフかばう無限ループ封印センサー】
                    if (isRangeCut && ally.id === member.id) {
                      return ally; // 自分自身はスキップしてバフを付与しない
                    }

                    const currentBuffs = ally.activeBuffs || [];
                    const filteredBuffs = currentBuffs.filter(b => b.id === playableSkill.id);
                    // 🌟 ここ！ "強化効果【...】が宿った！" の代わりに、作った buffMsg を使う
                    newLogs.push({ id: `p-buff-aoe-hit-${ally.id}-${Date.now()}`, text: `    ➔ 🌟 【${ally.name}】 の${buffMsg} (${turns}T)`, type: "success" });
                    return { ...ally, activeBuffs: [...filteredBuffs, newBuff] };
                  });
                  logText = "";
                } else {
                  // 単体バフ・ディボーション（献身）の確実なバインド（activeBuffsに統一）
                  const targetFindIdx = localParty.findIndex(p => p.id === targetAlly.id);
                  if (targetFindIdx !== -1) {
                    const currentBuffs = localParty[targetFindIdx].activeBuffs || [];
                    const filteredBuffs = currentBuffs.filter(b => b.id !== playableSkill.id);
                    localParty[targetFindIdx].activeBuffs = [...filteredBuffs, newBuff];
                    
                    if (isRangeCut) {
                      logText = `🛡️✨ [スキル発動] ${member.name} は 【${playableSkill.name}】 を発動した！ ➔ 【${targetAlly.name}】 と命の絆を結んだ！ (${turns}T / 残SP: ${member.sp})`;
                    } else {
                      // 🌟 ここ！ "物理防御が上昇した！" 固定ではなく、作った buffMsg を使う
                      logText = `✨ [スキル発動] ${member.name} は 【${playableSkill.name}】 を発動した！ ➔ 【${targetAlly.name}】 の${buffMsg} (${turns}T / 残SP: ${member.sp})`;
                    }
                  }
                }
              }
            } else {
              // 🔮 攻撃魔法・範囲魔法ルート
              const isAOE = playableSkill.target_type === '敵全体' || playableSkill.target_type === '範囲エネミー' || playableSkill.name?.includes('全体') || playableSkill.isAreaOfEffect === true;
              if (isAOE) {
                const isMagic = playableSkill.skill_type === 'magic';
                
                // 🔮 🆕 全体大魔法・全体特技用のホーリープラクティス文字センサーをインジェクション！
                let magicPassNotice = "";
                if (hasHolyPractice && primaryTarget && (primaryTarget.race === '悪魔' || primaryTarget.race === '不死' || primaryTarget.element === '不死')) {
                  magicPassNotice = `✨[聖者調伏+${hasHolyPractice.effect_value || 20}%!] `;
                }

                logText = isMagic ? `${magicPassNotice}🔮✨ 【全体大魔法】${member.name} の【${playableSkill.name}】が炸裂！(残SP: ${member.sp})` : `${magicPassNotice}⚔️💥 【全体特技】${member.name} の【${playableSkill.name}】が一閃！(残SP: ${member.sp})`;
                newLogs.push({ id: `p-aoe-${member.id}-${Date.now()}`, text: logText, type: "success" });

                // 🔮 👑 【三土手神特注：全体魔法・特技用 バフ完全同期ベースパワー算出ゲート】
                let finalCalculatedPower = baseValue;

                if (playableSkill.value_type === 'percent') {
                  if (isMagic) {
                    // 🧼 仮置き「10」を完全撤去！知力がなければ魔法攻撃力は0へ！
                    const myInt = member.int || 0; 
                    let minMatk = Math.floor(myInt + (myDex * 0.2)); 
                    let maxMatk = Math.floor(myInt * 2.0 + myDex);

                    // リアルタイムに魔力バフ（1000%など）をこのダイス幅に完全乗算！
                    if (member.activeBuffs && member.activeBuffs.length > 0) {
                      member.activeBuffs.forEach(b => {
                        if (b.effect_type === '魔力Matk増幅') {
                          if (b.buff_value_type === 'fixed') {
                            minMatk += b.buff_value;
                            maxMatk += b.buff_value;
                          } else if (b.buff_value_type === 'percent') {
                            minMatk += Math.floor(minMatk * b.buff_value / 100);
                            maxMatk += Math.floor(maxMatk * b.buff_value / 100);
                          }
                        }
                      });
                    }
                    // バフが上乗せされた最強の魔力幅から、今回のダイス威力を決定！
                    finalCalculatedPower = Math.floor((Math.floor(Math.random() * (maxMatk - minMatk + 1)) + minMatk) * baseValue / 100);
                  } else {
                    // 物理特技スキルの場合は、通常攻撃ダイスを参照
                    finalCalculatedPower = Math.floor((randomizedAtk * baseValue) / 100);
                  }
                }

                // 確定した最強の威力を引っ提げて、敵全員のHPを消し飛ばすループへ突入！
                localEnemies = localEnemies.map(enemyItem => {
                  if (enemyItem.hp <= 0) return enemyItem;
                  
                  const skillSpecs = { 
                    ...attackSpecs, 
                    element: playableSkill.element || '無', 
                    is_physical: !isMagic, 
                    card_size_eff: { [enemyItem.size]: sizeValue }, 
                    card_race_eff: { [enemyItem.race]: raceValue }, 
                    card_elem_eff: { [enemyItem.element]: elemValue } 
                  };
                  
                  const skillMultiplier = calculateDamageModifier(skillSpecs, { element: enemyItem.element, race: enemyItem.race, size: enemyItem.size });
                  const enemyMdef = enemyItem.int || 0;
                  
                  // 上で計算した finalCalculatedPower をそのまま使用してダメージ算出！
                  const aoeDmg = Math.max(1, Math.floor(finalCalculatedPower * skillMultiplier) - enemyMdef);
                  const nextHp = Math.max(0, enemyItem.hp - aoeDmg);
                  
                  let aoeLog = `   ➔ 💥 ${enemyItem.name} に ${aoeDmg} の全体ダメージ！`;
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
                  if (nextHp <= 0) newLogs.push({ id: `win-aoe-${enemyItem.instanceId}-${Date.now()}`, text: `🏆 🎉 【${enemyItem.name}】を全体攻撃で撃破した！`, type: "system" });
                  
                  return { ...enemyItem, hp: nextHp, state: nextState };
                });
                logText = ""; 
              } else {
                let calculatedPower = baseValue;
                const isMagic = playableSkill.skill_type === 'magic';

                if (playableSkill.value_type === 'percent') {
                  if (isMagic) {
                    // 🔮 👑 【三土手神特注：単体魔法専用・魔力バフ動的乗算インジェクション】
                    const myInt = member.int || 10; 
                    let minMatk = Math.floor(myInt + (myDex * 0.2)); 
                    let maxMatk = Math.floor(myInt * 2.0 + myDex);

                    // メイジの魂に宿る「魔力Matk増幅」をスキャンしてダイス幅を引き上げる！
                    if (member.activeBuffs && member.activeBuffs.length > 0) {
                      member.activeBuffs.forEach(b => {
                        if (b.effect_type === '魔力Matk増幅') {
                          if (b.buff_value_type === 'fixed') {
                            minMatk += b.buff_value;
                            maxMatk += b.buff_value;
                          } else if (b.buff_value_type === 'percent') {
                            minMatk += Math.floor(minMatk * b.buff_value / 100);
                            maxMatk += Math.floor(maxMatk * b.buff_value / 100);
                          }
                        }
                      });
                    }
                    // バフが乗った最強の魔力から、今回の威力をダイス決定！
                    calculatedPower = Math.floor((Math.floor(Math.random() * (maxMatk - minMatk + 1)) + minMatk) * baseValue / 100);
                  } else {
                    // 物理スキルの場合は通常通り攻撃力ダイスを参照
                    calculatedPower = Math.floor((randomizedAtk * baseValue) / 100);
                  }
                }

                const skillSpecs = { ...attackSpecs, element: playableSkill.element || '無', is_physical: playableSkill.skill_type === 'art' };
                const skillMultiplier = calculateDamageModifier(skillSpecs, defenderSpecs);
                
                // 物理スキルの場合は敵のVIT防御を引き算する
                if (playableSkill.skill_type === 'art') {
                  finalDmg = Math.max(1, Math.floor(calculatedPower * skillMultiplier) - (primaryTarget.vit || 0));
                } else {
                  finalDmg = Math.max(1, Math.floor(calculatedPower * skillMultiplier));
                }

                localEnemies[targetIdx].hp = Math.max(0, localEnemies[targetIdx].hp - finalDmg);
                
                // 🔮 🆕 単体魔法・単体特技用のホーリープラクティス文字センサーをインジェクション！
                let magicPassNotice = "";
                if (hasHolyPractice && primaryTarget && (primaryTarget.race === '悪魔' || primaryTarget.race === '不死' || primaryTarget.element === '不死')) {
                  magicPassNotice = `✨[聖者調伏+${hasHolyPractice.effect_value || 20}%!] `;
                }

                logText = `${magicPassNotice}${isTargetBoss ? '🔥' : '🔮'} ${member.name} 【${playableSkill.name}】！ ${primaryTarget.name} に ${finalDmg} のダメージ！(残SP: ${member.sp})`;
                // 🔮 👑 ここもパッシブなら敵にデバフを流さない！
                if (playableSkill.effect_type && playableSkill.effect_type !== 'なし' && playableSkill.skill_type !== 'passive' && localEnemies[targetIdx].hp > 0) {
                  const baseChance = Number(playableSkill.effect_chance || 0);
                  const enemyResistPct = playableSkill.effect_type === 'スタン' ? primaryTarget.resist_stun || 0 : playableSkill.effect_type === '凍結' ? primaryTarget.resist_freeze || 0 : playableSkill.effect_type === '毒' ? primaryTarget.resist_poison || 0 : playableSkill.effect_type === '暗闇' ? primaryTarget.resist_blind || 0 : 0;
                  if (Math.random() * 100 < Math.max(0, baseChance - enemyResistPct)) {
                    const turns = Number(playableSkill.duration_turns || 3);
                    localEnemies[targetIdx].state = { currentStatus: playableSkill.effect_type, durationTurns: turns };
                    logText += ` ✨ [追加効果] ${primaryTarget.name} を【${playableSkill.effect_type}】状態にした！`;
                  }
                }
              }
            }
          } else if (isCritical) {
            // 🛡️ 【重要：クリティカル封印パッチ】
            // 後衛かつSレンジ武器なら、クリティカル攻撃も「絶対に」させない
            if (member.position === 'back' && member.weaponRange === 'S') {
               return;
            }

            // 🎯 👑 【三土手創世神特注：クリティカル用・物理ATKバフ動的加算配線】
            let bonusAtk = 0;
            if (member.activeBuffs && member.activeBuffs.length > 0) {
              member.activeBuffs.forEach(b => {
                if (b.effect_type === '物理ATK増幅') {
                  if (b.buff_value_type === 'fixed') {
                    bonusAtk += b.buff_value;
                  } else if (b.buff_value_type === 'percent') {
                    // クリティカルなので、最大攻撃力（maxAtk）を基準に％バフを上乗せ！
                    bonusAtk += Math.floor(maxAtk * b.buff_value / 100);
                  }
                }
              });
            }

            // 素の最大攻撃力にバフの上昇分をガッチャンコ！
            const totalCriticalBaseAtk = maxAtk + bonusAtk;

            // 👑 強化された総攻撃力をベースに「1.5倍」の特大クリティカルダメージを算出！
            const baseCriDmg = Math.floor(totalCriticalBaseAtk * 1.5);
            finalDmg = Math.floor(baseCriDmg * totalMultiplier);
            if (finalDmg < 1) finalDmg = 1;

            // ツインブレード（連撃）の確率ジャッジ
            const isTwinStrikeActive = (member.twin_strike_chance || 0) > 0 && 
                                       member.weaponRange !== 'L' && 
                                       (Math.random() * 100 < member.twin_strike_chance);

            if (isTwinStrikeActive) {
              const totalTwinDmg = finalDmg * 2;

              // 敵のHPから特大バフ2連撃分を引き算
              localEnemies[targetIdx].hp = Math.max(0, localEnemies[targetIdx].hp - totalTwinDmg);

              logText = `⚡🔥 限界突破連撃!! ${member.name} の二刀流が致命の一閃を2連続で刻む！\n` +
                        `💥 CRITICAL 1打目 ➔ 【${member.weaponName}】で ${primaryTarget.name} に ${finalDmg} の致命ダメージ！\n` +
                        `💥 CRITICAL 2打目 ➔ 【${member.weaponName}】で ${primaryTarget.name} に ${finalDmg} の追撃致命ダメージ！ (計 ${totalTwinDmg} Dmg!!)`;
            } else {
              // 単発クリティカル
              localEnemies[targetIdx].hp = Math.max(0, localEnemies[targetIdx].hp - finalDmg);
              logText = `💥💥 CRITICAL HIT!! ${member.name} ➔ ${primaryTarget.name} に ${finalDmg} の致命物理ダメージ！`;
            }

            // 吸血処理（連撃時は合計ダメージを基準に計算）
            const actualDealtDmg = isTwinStrikeActive ? (finalDmg * 2) : finalDmg;
            if (member.hp_drain_chance > 0 && Math.random() * 100 < member.hp_drain_chance && Number(member.hp_drain_percent || 0) > 0) {
              const healAmount = Math.floor((actualDealtDmg * Number(member.hp_drain_percent)) / 100);
              member.hp = Math.min(member.mhp, member.hp + healAmount);
              logText += ` 🩸 ${healAmount} 回復した！！`;
            }

            // 状態異常付与
            if (localEnemies[targetIdx].hp > 0 && member.card_inflict_type && member.card_inflict_chance > 0 && localEnemies[targetIdx].state?.currentStatus !== member.card_inflict_type) {
              const res = member.card_inflict_type === '毒' ? primaryTarget.resist_poison || 0 : member.card_inflict_type === 'スタン' ? primaryTarget.resist_stun || 0 : 0;
              if (Math.random() * 100 < Math.max(5, member.card_inflict_chance - res)) {
                localEnemies[targetIdx].state = { ...localEnemies[targetIdx].state, currentStatus: member.card_inflict_type, durationTurns: 3 };
                logText += ` ✨ [追加効果] ${primaryTarget.name} を【${member.card_inflict_type}】状態にした！！`;
              }
            }
          } else {
            let useSkill = activeSkills.length > 0 && Math.random() < 0.45;
            let skillToUse = null;
            if (useSkill) {
              skillToUse = activeSkills[Math.floor(Math.random() * activeSkills.length)];
              if (member.sp < Number(skillToUse.sp_cost || 0)) useSkill = false;
              else {
                // 🧹 上のブロックの const isHeal = ... をスッキリ撤去し、チェックはそのまま直書きにリフォーム！
                if ((skillToUse.name?.includes('ヒール') || skillToUse.effect_type === '回復') && !localParty.some(p => p.hp > 0 && p.hp < (p.mhp || p.max_hp || 0) * 0.7)) useSkill = false;
                else if (!isTargetBoss && currentSpRatio <= 50) useSkill = false;
              }
            }
            if (useSkill && skillToUse) {
              member.sp = Math.max(0, member.sp - Number(skillToUse.sp_cost || 0));
              const baseValue = Number(skillToUse.effect_value || 0);
              let calculatedPower = baseValue;
              if (skillToUse.value_type === 'percent' || skillToUse.calculation_type === 'percent') calculatedPower = Math.floor((randomizedAtk * baseValue) / 100);
              
              // 🔮 👑 【スコープ完全開通】ここで新しく const 宣言することで、下の if (isHeal) に100%バトンが繋がります！
              const isHeal = skillToUse.name?.includes('ヒール') || skillToUse.effect_type === '回復';

              // 🚑 1. 純粋な回復・クレンジング魔法ゲート[cite: 2]
              if (isHeal) {
                if (skillToUse.target_type === '味方全体') {
                  // 🚑 全体回復の処理
                  localParty.forEach(p => {
                    if (p.hp > 0) {
                      // 🧼 最低保証の424を完全粉砕！それぞれの味方の本来の最大HP（mhp または max_hp）の上限まで確実に直撃全回復！
                      const targetMaxHp = Number(p.mhp || p.max_hp || 0);
                      p.hp = Math.min(targetMaxHp, p.hp + calculatedPower);
                    }
                  });
                  logText = `Transcript 🚑✨ [全体発動] ${member.name} 【${skillToUse.name}】！ 味方全員を ${calculatedPower} 回復！`;
                } else {
                  // 🚑 単体回復の処理
                  const injured = localParty.filter(p => p.hp > 0 && p.hp < p.mhp).sort((a,b) => a.hp - b.hp);
                  const hIdx = localParty.findIndex(p => p.id === (injured[0] || member).id);
                  localParty[hIdx].hp = Math.min(localParty[hIdx].mhp, localParty[hIdx].hp + calculatedPower);
                  logText = `✨ ${member.name} 【${skillToUse.name}】！ ${localParty[hIdx].name} を ${calculatedPower} 回復`;
                }
              } 
              // 🛡️ 2. 👑 【三土手創世神特注】戦術支援バフ・支援特技の超最優先ゲート！攻撃魔法ルートへのすり抜けを完全遮断！
              else if (['物理ATK増幅', '物理DEF増幅', '行動速度Aspd増幅', '魔力Matk増幅', '魔法防御Mdef増幅', '魔法防御MDEF増幅'].includes(skillToUse.effect_type)) {
                
                // 🎯 確率発動ルートでも「優先職業」を確実にスキャンして、かつ【まだバフがかかっていない仲間】を厳選！
                const rPriorityJobs = skillToUse.target_priority_jobs || [];
                let rFilteredAllies = localParty.filter(p => p.hp > 0 && !(p.activeBuffs || []).some(b => b.id === skillToUse.id));
                let validTargetFound = false;

                // 🚨 かばう（献身）スキルの場合は自分以外、通常のバフなら自分も含めて選考
                const isRangeCut = skillToUse.is_range_damage_cut === true;
                if (isRangeCut) {
                  rFilteredAllies = rFilteredAllies.filter(p => p.id !== member.id);
                }

                if (rPriorityJobs.length > 0) {
                  for (let jobReq of rPriorityJobs) {
                    const matchedAlly = rFilteredAllies.find(p => p.name.includes(jobReq) || p.job === jobReq);
                    if (matchedAlly) {
                      targetAlly = matchedAlly;
                      validTargetFound = true;
                      break;
                    }
                  }
                } else {
                  if (rFilteredAllies.length > 0) {
                    targetAlly = rFilteredAllies[0];
                    validTargetFound = true;
                  }
                }

                // 🎯 もし対象の職が全員すでにバフ状態、または誰もいないなら発動を安全にキャンセル（通常攻撃ルートへスルー！）
                if (!validTargetFound) {
                  useSkill = false;
                  skillToUse = null;
                  playableSkill = null;
                  shouldLaunchMagic = false;
                  targetAlly = null;
                } else {
                  const successRoll = Math.random() * 100;
                  const effChance = Number(skillToUse.effect_chance !== undefined ? skillToUse.effect_chance : 100);

                  if (successRoll > effChance) {
                    logText = `⚠️ [スキル失敗] ${member.name} は 【${skillToUse.name}】 を発動しようとしたが、失敗した！`;
                  } else {
                    const bValue = Number(skillToUse.buff_value || 0);
                    const bValueType = skillToUse.buff_value_type || 'percent';
                    const rangeCutPct = Number(skillToUse.range_damage_cut_pct !== undefined ? skillToUse.range_damage_cut_pct : 100);
                    const turns = Number(skillToUse.duration_turns || 3);

                    const newBuff = {
                      id: skillToUse.id,
                      name: skillToUse.name,
                      effect_type: skillToUse.effect_type,
                      buff_value: bValue,
                      buff_value_type: bValueType,
                      is_range_damage_cut: isRangeCut,
                      range_damage_cut_pct: rangeCutPct,
                      duration_turns: turns,
                      casterId: member.id,
                      isNew: true
                    };

                    let buffMsg = "ステータスが上昇した！";
                    if (skillToUse.effect_type === '物理DEF増幅') buffMsg = "物理防御が上昇した！";
                    else if (skillToUse.effect_type === '物理ATK増幅') buffMsg = "物理攻撃力が上昇した！";
                    else if (skillToUse.effect_type === '行動速度Aspd増幅') buffMsg = "行動速度が上昇した！";
                    else if (skillToUse.effect_type === '魔力Matk増幅') buffMsg = "魔力が大幅に上昇した！";

                    const isAreaBuff = skillToUse.target_type === '味方全体';

                    if (isAreaBuff) {
                      logText = `🙌✨ [全体支援] ${member.name} が 【${skillToUse.name}】 を発動！`;
                      newLogs.push({ id: `p-buff-aoe-${member.id}-${Date.now()}`, text: logText, type: "success" });

                      localParty = localParty.map(ally => {
                        if (ally.hp <= 0) return ally;
                        if (isRangeCut && ally.id === member.id) return ally; // セルフかばう防止

                        const currentBuffs = ally.activeBuffs || [];
                        const filteredBuffs = currentBuffs.filter(b => b.id !== skillToUse.id);
                        newLogs.push({ id: `p-buff-aoe-hit-${ally.id}-${Date.now()}`, text: `    ➔ 🌟 【${ally.name}】 の${buffMsg} (${turns}T)`, type: "success" });
                        return { ...ally, activeBuffs: [...filteredBuffs, newBuff] };
                      });
                      logText = "";
                    } else {
                      // 単体支援バフの確実なバインド処理
                      const targetFindIdx = localParty.findIndex(p => p.id === targetAlly.id);
                      if (targetFindIdx !== -1) {
                        const currentBuffs = localParty[targetFindIdx].activeBuffs || [];
                        const filteredBuffs = currentBuffs.filter(b => b.id !== skillToUse.id);
                        localParty[targetFindIdx].activeBuffs = [...filteredBuffs, newBuff];
                        
                        if (isRangeCut) {
                          logText = `🛡️✨ [支援発動] ${member.name} の 【${skillToUse.name}】！ ➔ 【${targetAlly.name}】 と命の絆を結んだ！ (${turns}T / 残SP: ${member.sp})`;
                        } else {
                          logText = `✨ [支援発動] ${member.name} の 【${skillToUse.name}】！ ➔ 【${targetAlly.name}】 の${buffMsg} (${turns}T / 残SP: ${member.sp})`;
                        }
                      }
                    }
                  }
                }
              }
              // 🔮 3. 上のどれでもない（回復でもバフ支援でもない）場合のみ、初めてここの「攻撃魔法ルート」が着地します！
              else {
                const skillSpecs = { ...attackSpecs, element: skillToUse.element || '無', is_physical: skillToUse.skill_type === 'art' };
                const skillMultiplier = calculateDamageModifier(skillSpecs, defenderSpecs);
                
                // 🔮 🆕 45%確率枠の魔法・特技用ホーリープラクティス文字センサーをインジェクション！
                let magicPassNotice = "";
                if (hasHolyPractice && primaryTarget && (primaryTarget.race === '悪魔' || primaryTarget.race === '不死' || primaryTarget.element === '不死')) {
                  magicPassNotice = `✨[聖者調伏+${hasHolyPractice.effect_value || 20}%!] `;
                }

                if (skillToUse.skill_type === 'art') {
                  finalDmg = Math.max(1, Math.floor((calculatedPower * skillMultiplier) - primaryTarget.vit));
                  logText = `${magicPassNotice}⚔️ ${member.name} 【${skillToUse.name}】！ ${primaryTarget.name} に ${finalDmg} の物理ダメージ！`;
                  if (member.hp_drain_chance > 0 && Math.random() * 100 < member.hp_drain_chance && Number(member.hp_drain_percent || 0) > 0) {
                    const healAmount = Math.floor((finalDmg * Number(member.hp_drain_percent)) / 100);
                    member.hp = Math.min(member.mhp, member.hp + healAmount);
                    logText += ` 🩸 ${healAmount} 回復！`;
                  }
                } else {
                  finalDmg = Math.max(1, Math.floor(calculatedPower * skillMultiplier));
                  logText = `${magicPassNotice}🔮 ${member.name} 【${skillToUse.name}】！ ${primaryTarget.name} に ${finalDmg} の魔法ダメージ！`;
                }
                
                // 💥 1657行目：ターゲットの敵のHPを引き算する鉄壁の定型文
                localEnemies[targetIdx].hp = Math.max(0, localEnemies[targetIdx].hp - finalDmg);
                
                // 🔮 👑 パッシブスキルの効果を敵に付与するのを鉄壁ガード！
                if (skillToUse.effect_type && skillToUse.effect_type !== 'なし' && skillToUse.skill_type !== 'passive' && localEnemies[targetIdx].hp > 0) {
                  const res = skillToUse.effect_type === 'スタン' ? primaryTarget.resist_stun || 0 : skillToUse.effect_type === '毒' ? primaryTarget.resist_poison || 0 : 0;
                  if (Math.random() * 100 < Math.max(0, Number(skillToUse.effect_chance || 0) - res)) {
                    localEnemies[targetIdx].state = { currentStatus: skillToUse.effect_type, durationTurns: Number(skillToUse.duration_turns || 3) };
                    logText += ` ✨ [追加効果] ${primaryTarget.name} を【${skillToUse.effect_type}】状態にした！`;
                  }
                }
              }
            } else {
              // 🛡️ 【三土手神特注：通常攻撃の物理封印】
              // 後衛かつSレンジ武器なら、通常攻撃は「絶対に」実行させない
              if (member.position === 'back' && member.weaponRange === 'S') {
                 // 攻撃せずログだけ出して終了
                 return; 
              }
              const isEnemyDebuffed = ['スタン', '凍結', '石化'].includes(primaryTarget.state?.currentStatus);
              const effectiveEnemyVit = isEnemyDebuffed ? 0 : (primaryTarget.vit || 0);
              const isEnemyPoisoned = primaryTarget.state?.currentStatus === 'poison' || primaryTarget.state?.currentStatus === '毒';
              const finalEnemyVit = isEnemyPoisoned ? Math.floor(effectiveEnemyVit * 0.75) : effectiveEnemyVit;

              // 🔬 👑 【三土手神特注：プレイヤー物理攻撃時の敵Flee完全対応センサー】
              // 敵が行動不能デバフ状態でなければ、敵の本物のFlee（回避力）をしっかりロード！
              const effectiveEnemyFlee = isEnemyDebuffed ? 0 : Number(primaryTarget.flee || 0);
              const playerHit = Number(member.hit || 0);
              const enemyFleeChance = 20 + effectiveEnemyFlee - playerHit;
              const cappedEnemyFleeChance = Math.min(95, enemyFleeChance);
              const randomEnemyRoll = Math.floor(Math.random() * 100);

              // 🚨 ⬇️ 【三土手神特注デバッグ】ここから追加！F12で回避計算の内部数値を丸裸にします！
              console.log(`=== 🎯 【回避/命中判定テスト】 ${member.name} ➔ ${primaryTarget.name} ===`);
              console.log(`・敵の生データ(primaryTarget):`, primaryTarget);
              console.log(`・抽出された敵のFlee: ${effectiveEnemyFlee} (生プロパティ: ${primaryTarget.flee})`);
              console.log(`・プレイヤーのHit: ${playerHit}`);
              console.log(`・計算された回避率(キャップ前): ${enemyFleeChance}%`);
              console.log(`・最終適用回避率(MAX95): ${cappedEnemyFleeChance}%`);
              console.log(`・運命のダイス出目(0-99): ${randomEnemyRoll} (※出目が回避率未満ならMISS)`);
              console.log(`========================================================`);
              // 🚨 ⬆️ ここまで追加！

              if (randomEnemyRoll < cappedEnemyFleeChance) {
                // 💨 敵が高確率でヒラリとかわすMISSルートへ直撃結合！
                logText = `💨 [MISS] ${member.name} が 【${primaryTarget.name}】 を狙撃！しかし、残像のように回避された！ (敵回避率:${Math.max(0, cappedEnemyFleeChance)}%)`;
              } else {
                // ⚔️ 👑 回避されなかった場合のみ、通常のダメージ計算室へ突入！
                let bonusAtk = 0;
                if (member.activeBuffs && member.activeBuffs.length > 0) {
                  member.activeBuffs.forEach(b => {
                    if (b.effect_type === '物理ATK増幅') {
                      if (b.buff_value_type === 'fixed') bonusAtk += b.buff_value;
                      else if (b.buff_value_type === 'percent') bonusAtk += Math.floor(randomizedAtk * b.buff_value / 100);
                    }
                  });
                }

                // ダイス値にATKバフを合算して最終ベースダメージを算出
                const finalTotalAtk = randomizedAtk + bonusAtk;
                const baseDmg = Math.max(1, finalTotalAtk - finalEnemyVit);
                finalDmg = Math.floor(baseDmg * totalMultiplier);
                if (finalDmg < 1) finalDmg = 1;
                
                const debuffMsg = isEnemyDebuffed ? `[敵防完全喪失!]` : (isEnemyPoisoned ? `[敵防25%低下!]` : '');

                // 🔮 👑 【三土手創世神特注：ツインブレード二刀連撃・ダメージ2分割＆2行ログ出力エンジン】
                // 🏹 🆕 【武器制限ゲート】武器がLレンジ（弓など）の時は、二刀連撃が誤射されないように鉄壁ガード！
                const isTwinStrikeActive = (member.twin_strike_chance || 0) > 0 && 
                                           member.weaponRange !== 'L' && 
                                           (Math.random() * 100 < member.twin_strike_chance);

                if (isTwinStrikeActive) {
                  // トータル想定ダメージ（finalDmg）を綺麗な2連撃に分割出力！
                  const firstDmg = Math.floor(finalDmg / 2) + 1;
                  const secondDmg = Math.max(1, finalDmg - firstDmg);
                  const totalTwinDmg = firstDmg + secondDmg;

                  // 敵のHPから2連続でダメージを減算！
                  localEnemies[targetIdx].hp = Math.max(0, localEnemies[targetIdx].hp - totalTwinDmg);

                  // 2行連続ヒットを視覚的に豪華にビジュアライズ！
                  logText = `⚡ 連撃発動！ ${member.name} の二刀流が電光石火の軌跡を描く！\n` +
                            `⏩ 1打目 ➔ 【${member.weaponName}】で ${primaryTarget.name} に ${firstDmg} の斬撃ダメージ！\n` +
                            `⏩ 2打目 ➔ 【${member.weaponName}】で ${primaryTarget.name} に ${secondDmg} の追撃ダメージ！ (計 ${totalTwinDmg} Dmg!!)`;
                } else {
                  // 通常通りの単発通常攻撃ヒット処理
                  let holyPracticeNotice = "";
                // ✨ここを修正：属性（element）が「不死」の場合もログに文字を出すように包囲網を完全同期！
                if (hasHolyPractice && (primaryTarget.race === '悪魔' || primaryTarget.race === '不死' || primaryTarget.element === '不死')) {
                  holyPracticeNotice = `✨[聖者調伏+${hasHolyPractice.effect_value || 20}%!] `;
                }

                if (isTwinStrikeActive) {
                  // トータル想定ダメージ（finalDmg）を綺麗な2連撃に分割出力！
                  const firstDmg = Math.floor(finalDmg / 2) + 1;
                  const secondDmg = Math.max(1, finalDmg - firstDmg);
                  const totalTwinDmg = firstDmg + secondDmg;

                  // 敵のHPから2連続でダメージを減算！
                  localEnemies[targetIdx].hp = Math.max(0, localEnemies[targetIdx].hp - totalTwinDmg);

                  // 2行連続ヒットを視覚的に豪華にビジュアライズ！
                  logText = `⚡ 連撃発動！ ${holyPracticeNotice}${member.name} の二刀流が電光石火の軌跡を描く！\n` +
                            `⏩ 1打目 ➔ 【${member.weaponName}】で ${primaryTarget.name} に ${firstDmg} の斬撃ダメージ！\n` +
                            `⏩ 2打目 ➔ 【${member.weaponName}】で ${primaryTarget.name} に ${secondDmg} の追撃ダメージ！ (計 ${totalTwinDmg} Dmg!!)`;
                } else {
                  // 通常通りの単発通常攻撃ヒット処理
                  localEnemies[targetIdx].hp = Math.max(0, localEnemies[targetIdx].hp - finalDmg);
                  logText = `⚔️ ${holyPracticeNotice}${member.name} が 【${member.weaponName}】 で通常攻撃！[${attackSpecs.weapon_subtype}/${attackSpecs.element}属性] ➔ (ダイス${randomizedAtk}-敵防${finalEnemyVit})${debuffMsg} × 総合倍率:${totalMultiplier.toFixed(2)}倍 ➔ ${finalDmg} の物理ダメージを与えた！`;
                }
                }
                
                if (member.hp_drain_chance > 0 && Math.random() * 100 < member.hp_drain_chance && Number(member.hp_drain_percent || 0) > 0) {
                  const healAmount = Math.floor((finalDmg * Number(member.hp_drain_percent)) / 100);
                  member.hp = Math.min(member.mhp, member.hp + healAmount);
                  logText += ` 🩸 ${healAmount} 回復！`;
                }
                if (localEnemies[targetIdx].hp > 0 && member.card_inflict_type && member.card_inflict_chance > 0 && localEnemies[targetIdx].state?.currentStatus !== member.card_inflict_type) {
                  const res = member.card_inflict_type === '毒' ? primaryTarget.resist_poison || 0 : member.card_inflict_type === 'スタン' ? primaryTarget.resist_stun || 0 : 0;
                  if (Math.random() * 100 < Math.max(5, member.card_inflict_chance - res)) {
                    localEnemies[targetIdx].state = { ...localEnemies[targetIdx].state, currentStatus: member.card_inflict_type, durationTurns: 3 };
                    logText += ` ✨ [追加効果] ${primaryTarget.name} を【${member.card_inflict_type}】状態にした！`;
                  }
                }
              } // 🧼 回避ルート分岐の閉じカッコ
            }
          }

          if (logText) newLogs.push({ id: `p-${member.id}-${Date.now()}-${Math.random()}`, text: logText, type: "success" });
          if (logText && localEnemies[targetIdx] && localEnemies[targetIdx].hp <= 0) {
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
        
        // 🔮 🆕 【三土手神特注】敵の右手装備IDから本物の武器データを逆引き！
        const enemyWeaponId = dbEnemy?.equip_right_hand;
        const enemyWeapon = masterItemsRef.current.find(item => item.id === enemyWeaponId);
        const eWeaponRange = enemyWeapon?.weapon_range || 'S'; // 指定がなければ近接(S)
        const isRanged = eWeaponRange === 'L';

        loadedEnemies.push({
          instanceId: `${targetId}_spawn_${i}_${Date.now()}`,
          id: targetId,
          name: `${finalName} ${String.fromCharCode(65 + i)}`,
          mhp: dbEnemy?.hp || dbEnemy?.base_hp || dbEnemy?.max_hp || 0,
          hp: dbEnemy?.hp || dbEnemy?.base_hp || dbEnemy?.max_hp || 0,
          str: dbEnemy?.str || dbEnemy?.stat_str || 0,
          agi: dbEnemy?.agi || dbEnemy?.stat_agi || 0, 
          vit: dbEnemy?.vit || dbEnemy?.stat_vit || 0,
          size: dbEnemy?.size || '小型',
          race: dbEnemy?.race || '無形',
          element: dbEnemy?.element || '無',
          exp: Number(currentQuestState?.exp_reward || 0),
          gold: Number(currentQuestState?.zeny_reward || 0),
          state: { currentStatus: 'なし', durationTurns: 0 },
          resist_stun: Number(dbEnemy?.resist_stun || 0),
          resist_freeze: Number(dbEnemy?.resist_freeze || 0),
          resist_poison: Number(dbEnemy?.resist_poison || 0),
          resist_blind: Number(dbEnemy?.resist_blind || 0),
          int: dbEnemy?.int || dbEnemy?.stat_int || 0,
          
          // 🎯 【三土手神特注】ダッシュボードのプレビュー数理法則と100%完全同期！
          hit: Math.floor(Number(dbEnemy?.base_level || 1) + Number(dbEnemy?.stat_dex || dbEnemy?.dex || 0) + Number(dbEnemy?.stat_luk || dbEnemy?.luk || 0) * 0.2 + 20),
          flee: Math.floor(Number(dbEnemy?.base_level || 1) + Number(dbEnemy?.stat_agi || dbEnemy?.agi || 0) + Number(dbEnemy?.stat_luk || dbEnemy?.luk || 0) * 0.2 + 10),
          
          // 💨 上書き設定があれば採用、なければ基本値150.0をマウント！
          enemy_aspd: dbEnemy?.enemy_aspd !== null && dbEnemy?.enemy_aspd !== undefined ? Number(dbEnemy.enemy_aspd) : 150.0,
          
          // 🏹 🆕 逆引きした本物の武器射程を完全にマウント！
          is_range_atk: isRanged,
          is_range_weapon: isRanged,
          weaponRange: eWeaponRange,
          
          // 🔮 【ここを追加】抽出したスキルリストを敵のインスタンスにマウント！
          activeSkills: eSkills,

          // 🐾 🆕 【半魚人バグ完全粉砕！】1戦目と同じく、ダッシュボードの調教設定を2戦目以降の敵インスタンスにも確実に書き写す！
          is_tamable: dbEnemy?.is_tamable || false,
          tame_success_chance: Number(dbEnemy?.tame_success_chance || 0),
          tame_level_req: Number(dbEnemy?.tame_level_req || 1),

          // 🐾 🆕 【三土手神特注：2戦目以降の敵にも3連ドロップパラメータを完全同期マウント】
          extra_drop_item: dbEnemy?.extra_drop_item || null,
          extra_drop_chance: Number(dbEnemy?.extra_drop_chance || 0),
          extra_drop_item_2: dbEnemy?.extra_drop_item_2 || null,
          extra_drop_chance_2: Number(dbEnemy?.extra_drop_chance_2 || 0),
          extra_drop_item_3: dbEnemy?.extra_drop_item_3 || null,
          extra_drop_chance_3: Number(dbEnemy?.extra_drop_chance_3 || 0)
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

  // 🐾 🆕 【三土手神特注：魔物起き上がり・物流インジェクション関数】
  const handleTameAccept = async () => {
    setIsTamingSaving(true);
    try {
      const { enemy } = tameCandidate;
      // 「ポリンJr A」などの末尾の識別アルファベット（A, B, C）を綺麗に除去
      const cleanName = enemy.name.replace(/ [A-Z]$/, '');
      
      // 🐾 🆕 マスターデータからスキルと職業（種族）を引き継ぐための逆引き
      const masterData = masterEnemiesRef.current.find(m => m.id === enemy.id);
      
      // 🚚 「調教済みの」を完全撤去！モンスターの種族名をそのまま誇り高く custom_name に刻みます！
      const { error } = await supabase
        .from('game_characters')
        .insert([{
          user_id: TEST_USER_ID,
          master_id: enemy.id,
          custom_name: cleanName, // ➔ これで酒場でも「ポリンJr」としてそのまま並びます！
          level: 1, 
          exp: 0,
          status_points: 6, // 創世神の初期ポイント6を付与！
          current_hp: enemy.mhp, 
          max_hp: enemy.mhp,
          current_sp: 50,
          max_sp: 50,
          bonus_str: enemy.str || 0, // エネミー時代の強さを初期ステータスとして引き継ぐ
          bonus_agi: enemy.agi || 0,
          bonus_vit: enemy.vit || 0,
          bonus_int: enemy.int || 0,
          bonus_dex: 10,
          bonus_luk: 10,
          party_index: null, // 酒場へ送る
          // 🐾 🆕 マスターデータからスキルIDを継承！
          skill_01: masterData?.skill_01 || null,
          skill_02: masterData?.skill_02 || null,
          skill_03: masterData?.skill_03 || null,
          // 🐾 🆕 職業（魔物クラス）と基本ステータスを meta に格納
          meta: {
            job: masterData?.job || '魔獣族',
            race: masterData?.race || enemy.race || '無形',
            stat_str: enemy.str || 0,
            stat_agi: enemy.agi || 0,
            stat_vit: enemy.vit || 0,
            stat_int: enemy.int || 0,
            stat_dex: 10,
            stat_luk: 10
          }
        }]);

      if (error) throw error;
      setDisplayedLogs(prev => [...prev, { id: `tame-ok-${Date.now()}`, text: `🐾✨ 大成功！ ${cleanName} がギルドの酒場（待機枠）に送られた！`, type: "success" }]);
      
      // 🐾 🆕 【三土手創世神特注：道中テイム即時メモリ同期配線】
      // 街に戻るまでのタイムラグを完全粉砕！今捕まえた魔物のマスターIDを、その場で所持Refへ直撃合流コミット！
      allPlayerCharactersRef.current = [
        ...allPlayerCharactersRef.current,
        { master_id: enemy.id } // 判定に必要な master_id だけをスマートにエミュレート追加
      ];

    } catch (err) {
      console.error("魔物捕獲エラー:", err);
      setDisplayedLogs(prev => [...prev, { id: `tame-err-${Date.now()}`, text: `🚨 捕獲データの送信に失敗しました...`, type: "system" }]);
    } finally {
      setIsTamingSaving(false);
      resumeAfterTame();
    }
  };

  const handleTameDecline = () => {
    const cleanName = tameCandidate.enemy.name.replace(/ [A-Z]$/, '');
    setDisplayedLogs(prev => [...prev, { id: `tame-no-${Date.now()}`, text: `🐾 ${cleanName} は寂しそうに森へ帰っていった...`, type: "system" }]);
    resumeAfterTame();
  };

  const resumeAfterTame = () => {
    setTameCandidate(null);
    // 元の進行フローへ美しく復帰
    if (remainingBattlesRef.current <= 0) {
      setAdventureStatus('floor_cleared');
    } else {
      setAdventureStatus('battling');
      setIsBattleOver(true);
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
        
        {/* 🐾 ドラクエ5型・起き上がりイベント専用UI */}
        {adventureStatus === 'tame_event' && tameCandidate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#3b0764', borderRadius: '10px', border: '1px solid #a855f7', boxShadow: '0 0 10px #a855f755' }}>
            <span style={{ fontSize: '0.85rem', color: '#e9d5ff', fontWeight: 'bold' }}>
              🐾 {tameCandidate.enemy.name.replace(/ [A-Z]$/, '')} が起き上がり、仲間なりたそうにこちらを見ている！
            </span>
            <span style={{ fontSize: '0.75rem', color: '#c084fc' }}>仲間にしますか？</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
              <button onClick={handleTameAccept} disabled={isTamingSaving} style={{ padding: '12px', borderRadius: '8px', background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
                {isTamingSaving ? '捕獲中...' : 'はい！'}
              </button>
              <button onClick={handleTameDecline} disabled={isTamingSaving} style={{ padding: '12px', borderRadius: '8px', background: '#1e293b', color: '#94a3b8', border: '1px solid #475569', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
                いいえ
              </button>
            </div>
          </div>
        )}
        
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

      {/* 🐾 🆕 【三土手神特注：コックピットUI・3枠/4枠動的フィット配線】 */}
      {(() => {
        // 現在戦闘に参加している部隊にテイマーが組み込まれているか走査
        const hasTamerInBattle = party.some(m => m.job === 'テイマー' || m.id === 'unit_1783729889058');
        // テイマーがいれば4分割、通常3人パーティーなら3分割にジャストフィットさせる数理[cite: 5]
        const gridColsCount = hasTamerInBattle ? 4 : 3;

        return (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${gridColsCount}, 1fr)`, 
            gap: '4px', padding: '10px 6px', background: '#0b0f19'
          }}>
            {party.map(member => {
              // リアルタイムに変動するSPの安全な割合を算出（メンバー毎に独立計算）[cite: 5]
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

                  {/* 💙 リアルタイム魔力（SP）ステータス数値 */}
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
        );
      })()}

      {/* 🎁 戦闘終了時のみポップアップするリザルトモーダル */}
      <QuestResultModal isOpen={showResult} droppedItems={droppedItems} onClose={onReturn} />
    </div>
  );
};

export default AdventureActive;
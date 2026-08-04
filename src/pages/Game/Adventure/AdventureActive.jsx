import React, { useState, useEffect, useRef } from 'react';
import { Timer, Trophy, ShieldAlert } from 'lucide-react';
import QuestResultModal from './components/QuestResultModal';
import { gameServices, calculateRoStatus } from '../../../gameServices';
import { supabase } from '../../../supabaseClient';
import { calculateDamageModifier, calculateStatusInflictChance, RO_NEXT_EXP_TABLE, calculateTotalStatusPoints } from '../../../gameRules';

// 🆕 固定の TEST_USER_ID 定義を完全撤去！

const AdventureActive = ({ 
  userId, // 🆕 親画面からログイン中のユーザーIDをバトンとして受け取る
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
  // 💎 🆕 三土手神特注：宝箱から出現させる「強化石」のマスターIDを記憶するRef
  const enhancementStoneIdRef = useRef(null); 

  // 🐾 🆕 【三土手神特注】酒場の待機メンバーも含めた、自分が所持する全キャラクターリストを記憶する器！
  const allPlayerCharactersRef = useRef([]);
  
  // 🔮 🆕 創世神特注：SP自動回復用の時間累積プールタイマーRef（初期値0秒）
  const spRegenTimer = useRef(0);
  
  const [droppedItems, setDroppedItems] = useState([]);
  // 🧹 アディショナルタイム告知フラグ（hasAnnouncedATRef）を撤去！
  
  // 🔮 🆕 セーブ中表示用のローカル状態を増築
  const [isSaving, setIsSaving] = useState(false);

  // 👑 【三土手神特注：カジュアル目隠しインフラ】
  // 最初は戦闘ログをエレガントに隠し、「戦闘中…」とだけ表示するためのState（初期値は折りたたみON）
  const [isLogCollapsed, setIsLogCollapsed] = useState(true);

  // 👑 【三土手神特注：TRPGテキストタイピング演出インフラ】
  // 'typing_1' (1行目入力中) ➔ 'interval_1' (間) ➔ 'typing_2' (2行目) ➔ 'interval_2' (間) ➔ 'surprise' (！) ➔ 'ready' (戦闘開始)
  const [prologueStep, setPrologueStep] = useState('typing_1');
  const [typingText1, setTypingText1] = useState('');
  const [typingChestText, setTypingChestText] = useState('');
  const [chestSchedule, setChestSchedule] = useState([]); // 👈 🎁 【ここに追加！】その階層での宝箱出現戦数リスト（例: [1, 2]）
  const [typingText2, setTypingText2] = useState('');
  const [typingText3, setTypingText3] = useState('');
  
  // 🆕 追加：現在の戦闘シチュエーションを記憶するState
  const [encounterType, setEncounterType] = useState('first'); // 'first' | 'floor_start' | 'normal' | 'boss'

  // 👑 🆕 三土手神特注：最深部ボス撃破時のみ大爆発する全画面クエストクリア演出フラグ
  const [showQuestClearTheater, setShowQuestClearTheater] = useState(false);

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

      // 🆕 TEST_USER_ID を物理的に削除し、Props から受け取った userId へ動的配線を結合！
      const charList = await gameServices.getPlayerCharacters(userId);
      const { data: dbSkills } = await supabase.from('game_master_skills').select('*');
      const { data: dbItems } = await supabase.from('game_master_items').select('*'); 

      const allMasterSkills = dbSkills || [];
      const allMasterItems = dbItems || [];
      
      // 🚨 ⬇️ デバッグ用トラップ1：全アイテムデータを覗き見！
      console.log("📦 【デバッグ1】取得した全アイテムマスター:", allMasterItems);

      masterSkillsRef.current = allMasterSkills;
      masterItemsRef.current = allMasterItems; 

      // 💎 🆕 「強化石」または「オリデオコン」という名前のアイテムマスターIDを全自動検出！
      const stoneItem = allMasterItems.find(i => i.name?.includes('強化石') || i.name?.includes('オリデオコン'));
      if (stoneItem) {
        enhancementStoneIdRef.current = stoneItem.id;
      } 

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
            // 敵時代（マスター）から引き継いで所持している「最大3枠の固有スキルID」だけをピンポイントロード！
            const tamerSkillIds = [ch.skill_01, ch.skill_02, ch.skill_03].filter(Boolean);
            availableSkills = allMasterSkills.filter(sk => tamerSkillIds.includes(sk.id));
          } else {
            // 👤 ② 人間の仲間の場合は、職業とレベル連動で自動取得（※忘却リスト除外付き）

            // 🧠 🆕 【忘却スキル完全除外インフラ】
            const myForgottenSkills = ch.forgotten_skills || [];
            // 忘れたスキルの「名前」をリスト化（Lv.2を忘れたのにLv.1がゾンビ復活するのを永久に遮断！）
            const forgottenSkillNames = allMasterSkills
              .filter(sk => myForgottenSkills.includes(sk.id))
              .map(sk => sk.name);

            const eligibleSkills = allMasterSkills.filter(sk => {
              // 🧠 忘れたスキルIDそのもの、または「同名のスキル（過去ランク含む）」なら戦闘に持ち込まない！
              if (myForgottenSkills.includes(sk.id) || forgottenSkillNames.includes(sk.name)) return false;

              const jobReq = sk.job_requirement;
              const lvReq = Number(sk.level_requirement || 1);
              return (jobReq === '全職業' || jobReq === myJob) && myLevel >= lvReq;
            });

            // 👑 🆕 同名スキルの中で最も必要レベルが高い（最高ランク）のものだけを選抜！
            const skillMap = {};
            eligibleSkills.forEach(sk => {
              const sName = sk.name;
              if (!skillMap[sName] || Number(sk.level_requirement) > Number(skillMap[sName].level_requirement)) {
                skillMap[sName] = sk;
              }
            });
            availableSkills = Object.values(skillMap);
          }

          const isScout = myJob === 'スカウト';
          const cardSizeEff = isScout ? { '小型': 20 } : {};
          const cardRaceEff = isScout ? { '無形': 20 } : {};
          const cardElemEff = isScout ? { '地': 20, '地属性': 20 } : {};

          // 🔮 🆕 三土手神特注：ループの内部でキャラクター毎に個別の装備データを確実に透視！（ここで宣言）
          // 精錬システム対応：詳細画面用にJOINされたオブジェクト（ch.equips）の master_id(item_id) を最優先で透視！
          const rightHandObj = ch.equips?.right_hand;
          let weaponId = null;
          
          if (rightHandObj && rightHandObj.item_id) {
            weaponId = rightHandObj.item_id; // インベントリのマスター参照ID
          } else if (rightHandObj && rightHandObj.id) {
            weaponId = rightHandObj.id;
          } else if (typeof ch.equip_right_hand === 'object' && ch.equip_right_hand !== null) {
            weaponId = ch.equip_right_hand.item_id || ch.equip_right_hand.id;
          } else {
            weaponId = ch.equip_right_hand; // 最後のフォールバック
          }
          
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

          // 🐾 🆕 【三土手神特注：ビーストシンパシー＆獣王の咆哮（魔物への波及パッシブ）センサー】
          let sympathyHpMultiplier = 0;
          let sympathyDefBonus = 0;
          let roarAtkPct = 0;
          let roarMatkPct = 0;

          if (isMonsterClass) {
            // パーティー内に該当パッシブを習得している仲間がいるかスキャン
            const activeTamers = filteredMembers.filter(m => m.id !== ch.id && m.hp > 0);
            
            activeTamers.forEach(m => {
              const mJob = m.meta?.job || m.job || 'ノービス';
              const mLv = m.level || 1;
              const mSkills = allMasterSkills.filter(sk => 
                (sk.job_requirement === '全職業' || sk.job_requirement === mJob) && mLv >= Number(sk.level_requirement || 1)
              );
              if (mSkills.some(sk => sk.name?.includes('ビーストシンパシー') || sk.effect_type === 'ビーストシンパシー')) {
                sympathyHpMultiplier = 0.20; 
                sympathyDefBonus = 30;       
              }
              if (mSkills.some(sk => sk.name?.includes('獣王の咆哮') || sk.effect_type === '獣王の咆哮')) {
                roarAtkPct = 0.15;
                roarMatkPct = 0.15;
              }
            });
          }

// 🔮 👑 【三土手創世神特注：バトル突入時・パッシブスキル全自動検知マウントエンジン】
          let passiveFleeBonus = 0;
          let passiveCritBonus = 0;
          let passiveAtkBonus = 0; 
          let passiveMatkBonus = 0; 
          let passiveDefBonus = sympathyDefBonus;   // 👈 🐾 合流
          let passiveMdefBonus = 0;  
          let passiveTwinChance = 0; 
          let passiveHpRegen = 0;
          let passiveSpRegen = 0;
          let passiveDexBonus = 0;       // 🏹 🆕 【三土手神特注】常時DEX上昇値を溜める器
          let passiveRangedHitBonus = 0; // 🏹 🆕 【三土手神特注】遠隔Hit底上げ値を溜める器
          let passiveHpMultiplier = 1.0 + sympathyHpMultiplier; // 👈 🐾 合流
          let passiveSpMultiplier = 1.0;
          let passiveSpCostReduction = 0; 
          let passiveDamageBonusPct = 0;

          if (availableSkills && availableSkills.length > 0) {
            availableSkills.forEach(sk => {
              if (sk.skill_type === 'passive') {
                if (sk.effect_type === '回避Flee増幅' || sk.effect_type === 'シャドウセンス' || sk.name?.includes('シャドウセンス')) {
                  passiveFleeBonus += Number(sk.effect_value || sk.buff_value || 20);
                }
                if (sk.effect_type === '致命打率増幅') passiveCritBonus += Number(sk.effect_value || 0);

                // 🐾 🆕 【追加】自身へのパッシブ効果（獣王の咆哮・ヴァルキリースタンス）
                if (sk.effect_type === '獣王の咆哮' || sk.name?.includes('獣王の咆哮')) {
                  passiveFleeBonus += 20;
                }
                if (sk.effect_type === 'ヴァルキリースタンス' || sk.name?.includes('ヴァルキリースタンス')) {
                  passiveCritBonus += 15;
                  passiveAtkBonus += Number(sk.effect_value || sk.buff_value || 30);
                }
                
                // ⬇️ 🆕 ここにデバッグ用ログを追加！
                if (sk.effect_type === 'パッシブATK増幅' || sk.name?.includes('剣術の極意')) {
  const pVal = Number(sk.effect_value || sk.buff_value || 0);
  passiveAtkBonus += pVal;
  console.log(`⚔️ 【パッシブ検知】${ch.custom_name} の「${sk.name}」により ATK +${pVal} 増加！`);
}

                if (sk.effect_type === 'パッシブMATK増幅') passiveMatkBonus += Number(sk.effect_value || 0);
                if (sk.effect_type === 'パッシブDEF増幅')  passiveDefBonus += Number(sk.effect_value || 0);
                if (sk.effect_type === 'セイントブレス' || sk.name === 'セイントブレス') passiveDefBonus += Number(sk.effect_value || sk.buff_value || 0);
                if (sk.effect_type === 'パッシブMDEF増幅') passiveMdefBonus += Number(sk.effect_value || 0);
                if (sk.effect_type === 'ツインブレード型連撃' || sk.effect_type === 'デュアルファング' || sk.name?.includes('デュアルファング')) {
                  // Sレンジ武器（短剣・剣など）を装備している時のみ30%連撃を有効化
                  const isSRange = masterWeapon?.weapon_range === 'S' || rightHandObj?.weapon_range === 'S' || rightHandObj?.range === 'S';
                  if (isSRange) {
                    passiveTwinChance = Math.max(passiveTwinChance, Number(sk.effect_value || sk.buff_value || 30));
                  }
                }
                
                // 🧼 ディバインアイ（神識眼）：常時DEXを固定値プラスする判定
                if (sk.effect_type === 'パッシブDEX増幅' || sk.effect_type === 'プレダトリーセンス' || sk.name?.includes('プレダトリーセンス') || sk.name?.includes('ディバインアイ') || sk.name?.includes('神識眼')) {
                  passiveDexBonus += Number(sk.effect_value || sk.buff_value || 10);
                }
                
                // 🏹 ホークアイ：Lレンジ武器装備時にHit（数値連動）＆ Cri+10%を底上げする判定
                if (sk.effect_type === '遠隔命中増幅' || sk.effect_type === 'ホークアイ' || sk.name?.includes('ホークアイ') || sk.name?.includes('遠見の心眼')) {
                  const isLRange = masterWeapon?.weapon_range === 'L' || rightHandObj?.weapon_range === 'L' || rightHandObj?.range === 'L';
                  if (isLRange) {
                    passiveRangedHitBonus += Number(sk.effect_value || sk.buff_value || 20);
                    passiveCritBonus += 10; // 🏹 致命打率Cri+10%を加算！
                  }
                }

                // 🎯 👑 【三土手創世神特注：効果タイプ ＆ スキル名 二重包囲網センサー】
                if (sk.effect_type === 'パッシブHP自動回復' || sk.name?.includes('HP自動回復')) {
                  passiveHpRegen += Number(sk.effect_value || 0);
                }
                // 🎯 🆕 【効果タイプ ＆ スキル名 二重包囲網センサー：SP版】
                if (sk.effect_type === 'パッシブSP自動回復' || sk.name?.includes('マインドリフレッシュ') || sk.name?.includes('精神統一')) {
                  passiveSpRegen += Number(sk.effect_value || 0);
                }
                // 🌟 🆕 【プレシャスリソース検知線】
                if (sk.effect_type === '消費SP軽減' || sk.name?.includes('プレシャスリソース')) {
                  passiveSpCostReduction += 20; // 20%軽減を記憶
                  passiveSpRegen += Number(sk.effect_value || 5); // 基礎効果数値を5秒毎のSP回復量として合算！
                }

                // 🌟 🆕 【エーテルリフレッシュ検知線】
                if (sk.effect_type === 'エーテルリフレッシュ' || sk.name?.includes('エーテルリフレッシュ')) {
                  passiveSpRegen += Number(sk.effect_value || 0); // 固定SP回復量（GM画面の基礎数値を適用）
                  passiveSpMultiplier += 0.15; // 最大SP15%増幅
                }

                // 🌟 🆕 【可能性の覚醒検知線】
                if (sk.effect_type === '可能性の覚醒' || sk.name?.includes('可能性の覚醒')) {
                  passiveCritBonus += 10;
                  passiveFleeBonus += 15;
                  passiveDamageBonusPct += 10; // 全与ダメージ+10%
                }

                if (sk.effect_type === '最大HP増幅')   passiveHpMultiplier += Number(sk.effect_value || 0) / 100;
                if (sk.effect_type === '最大SP増幅')   passiveSpMultiplier += Number(sk.effect_value || 0) / 100;
              }
            });
          }

          // 👑 🆕 【三土手神特注】仲間詳細画面（AdventureCharacterDetail.jsx）と完全同一の計算式で
          // その場で素Defを再計算！古い ch.roStatus のキャッシュ値（Defズレの元凶）は使わない！
          const charBonus = ch.bonus || {};
          const tempCharForRoCalc = {
            ...ch,
            bonus: { ...charBonus },
            str: (ch.meta?.stat_str || 1) + (charBonus.str || 0),
            agi: (ch.meta?.stat_agi || 1) + (charBonus.agi || 0),
            vit: (ch.meta?.stat_vit || 1) + (charBonus.vit || 0),
            int: (ch.meta?.stat_int || 1) + (charBonus.int || 0),
            dex: (ch.meta?.stat_dex || 1) + (charBonus.dex || 0),
            luk: (ch.meta?.stat_luk || 1) + (charBonus.luk || 0),
          };
          const ro = calculateRoStatus(tempCharForRoCalc, ch.equips || {});

          // 🐾 🆕 【三土手神特注：獣王の咆哮 ATK/MATK波及加算】戦闘時合流
          if (isMonsterClass && (roarAtkPct > 0 || roarMatkPct > 0)) {
            passiveAtkBonus += Math.floor(Number(ro.atk || 0) * roarAtkPct);
            passiveMatkBonus += Math.floor((Number(ro.int || 0) * 2) * roarMatkPct);
          }

          // 🐾 🆕 【三土手神特注：野生の絆（従魔生存時DEF/MDEF増幅）戦闘センサー】
          availableSkills.forEach(sk => {
            if (sk.effect_type === '野生の絆' || sk.name?.includes('野生の絆')) {
              // パーティー内に「生存している(hp > 0)」魔物がいるかスキャン
              const hasMonster = filteredMembers.some(m => m.id !== ch.id && m.hp > 0 && ['魔獣族', '植物族', '悪魔族', '不死族', '水棲族', '悪魔', '不死'].includes(m.meta?.job || m.job));
              if (hasMonster) {
                const pct = Number(sk.effect_value || sk.buff_value || 10) / 100;
                passiveDefBonus += Math.max(1, Math.floor(Number(ro.def || 0) * pct));
                passiveMdefBonus += Math.max(1, Math.floor(Number(ro.mdef || 0) * pct));
              }
            }
          });

          // 🔮 🆕 【三土手神特注：プレシャスリソース（消費SP軽減）の全スキル適用マウント】
          // 戦闘ループに入る前に、そのキャラが持つ全アクティブスキルの消費SPをあらかじめ割引価格にして記憶させる！
          const activeSkillsWithDiscount = availableSkills.map(sk => {
            if (sk.skill_type === 'passive') return sk;
            const discountRatio = 1 - (passiveSpCostReduction / 100);
            return {
              ...sk,
              sp_cost: Math.max(0, Math.floor(Number(sk.sp_cost || 0) * discountRatio))
            };
          });

          return {
            id: ch.id,
            name: ch.custom_name,
            level: myLevel,
            exp: ch.exp || 0,
            weaponName,
            weaponRange: masterWeapon?.weapon_range || rightHandObj?.weapon_range || rightHandObj?.range || 'S',
            weaponAtk: Number(masterWeapon?.atk || masterWeapon?.attack || 0) + (Number(rightHandObj?.refine_level || rightHandObj?.refine || 0) * 5),
            position,

            // ❤️ 💙 HP / SP：ステータスやカード効果が乗った最新上限値(ro.maxHp/maxSp)にパッシブ倍率を乗算
            mhp: Math.floor((ro.maxHp || ch.max_hp || ch.mhp || 100) * passiveHpMultiplier), 
            hp: Math.floor((ro.maxHp || ch.max_hp || ch.mhp || 100) * passiveHpMultiplier),
            msp: Math.floor((ro.maxSp || ch.max_sp || ch.msp || 10) * passiveSpMultiplier),
            sp: Math.floor((ro.maxSp || ch.max_sp || ch.msp || 10) * passiveSpMultiplier),

            // 💎 【6大ステータス全網羅】 DB値 + 手振り + ジョブ補正 + カード(札)の完全合算値(ro.xxx)から直撃取得！
            str: Number(ro.str !== undefined ? ro.str : ch.str || 0),   // 💪 物理基本攻撃力
            agi: Number(ro.agi !== undefined ? ro.agi : ch.agi || 0),   // 💨 攻撃速度＆回避率
            vit: Number(ro.vit !== undefined ? ro.vit : ch.vit || 0),   // 🛡️ 最大HP＆物理防御力
            int: Number(ro.int !== undefined ? ro.int : ch.int || 0),   // 🔮 魔法威力＆最大SP
            dex: Number(ro.dex !== undefined ? ro.dex : ch.dex || 0) + passiveDexBonus, // 🎯 命中力＆詠唱短縮
            border_dex: Number(ro.dex !== undefined ? ro.dex : ch.dex || 0) + passiveDexBonus, 
            luk: Number(ro.luk !== undefined ? ro.luk : ch.luk || 0),   // 🍀 クリティカル率

            job: myJob,
            weaponSubtype,
            weaponElement,
            cardSizeEff,
            cardRaceEff,
            cardElemEff,
            skillsList: activeSkillsWithDiscount, // 👈 🌟 availableSkills から置き換えます！
            state: { isFrozen: false, isStunned: false, stunTurns: 0, freezeTurns: 0, currentStatus: 'none', durationTurns: 0 },
            
            activeBuffs: [],

            final_battle_critical: Number(ro.critical || alcoholCritical) + passiveCritBonus,

            hp_drain_chance: totalDrainChance,
            hp_drain_percent: totalDrainPercent,

            card_inflict_type: totalInflictType,
            card_inflict_chance: maxInflictChance,

            roStatus: ro,
            
            // 📊 【全戦闘派生能力値（Derived Status）の完全マウント】
            atk: Number(ro.atk || 0) + passiveAtkBonus,                     // ⚔️ 物理攻撃力
            passive_matk_bonus: passiveMatkBonus,                           // 🔮 魔法攻撃力バフ
            flee: Number(ro.flee || 0) + passiveFleeBonus,                  // 💨 物理回避率
            def: Number(ro.def || 0) + passiveDefBonus,                     // 🛡️ 物理防御力
            mdef: Number(ro.mdef || 0) + passiveMdefBonus,                  // ✨ 魔法防御力
            critical: Number(ro.critical || 0) + passiveCritBonus,          // 💥 致命打率（ホークアイ発動時Cri+10%含む）
            hit: Number(ro.hit || 0) + ((masterWeapon?.weapon_range === 'L' || ch.equips?.right_hand?.range === 'L' || ch.equips?.right_hand?.weapon_range === 'L') ? passiveRangedHitBonus : 0), // 🎯 物理命中率
            aspd: Number(ro.aspd || 150.0),                                 // ⚡ 攻撃速度

            twin_strike_chance: passiveTwinChance,
            passive_hp_regen: passiveHpRegen,
            passive_sp_regen: passiveSpRegen,
            passive_damage_bonus_pct: passiveDamageBonusPct // 💥 🆕 ダメージ倍率記憶
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
            // 👑 🆕 ボスIDも事前ダウンロードプールに確実に含める！
            if (f.boss_id) allEnemyIds.add(f.boss_id); 
          });
        } else {
          if (activeQuestData?.enemy_master_id) allEnemyIds.add(activeQuestData.enemy_master_id);
          if (activeQuestData?.enemy_master_id_2) allEnemyIds.add(activeQuestData.enemy_master_id_2);
          if (activeQuestData?.enemy_master_id_3) allEnemyIds.add(activeQuestData.enemy_master_id_3);
        }

        let enemyIds = Array.from(allEnemyIds);
        if (enemyIds.length === 0) enemyIds.push('test_porin_junior'); 

        const { data: dbEnemies, error: enemyError } = await supabase
          .from('game_master_units')
          .select('*')
          .in('id', enemyIds);

        if (enemyError) console.error("エネミーデータ一括取得エラー:", enemyError);

        let finalDbEnemies = dbEnemies || [];
        if (!finalDbEnemies || finalDbEnemies.length === 0) {
          console.warn("⚠️ 警告: マスターデータが見つかりません。");
          const { data: fallbackUnits } = await supabase.from('game_master_units').select('*').limit(1);
          if (fallbackUnits && fallbackUnits.length > 0) finalDbEnemies = fallbackUnits;
        }

        masterEnemiesRef.current = finalDbEnemies;

        const fConfigs = activeQuestData?.floor_configs || [];
        const currentFloorCfg = fConfigs.find(f => f.floor === 1) || { 
          battle_count: 3, min_spawn: 1, max_spawn: 2, enemy_ids: enemyIds, boss_id: '', chest_count: 1 
        };

        setRemainingBattles(currentFloorCfg.battle_count);
        remainingBattlesRef.current = currentFloorCfg.battle_count;

        // 🎁 👑 【ここを追加！】B1階突入時に宝箱の出現戦数スケジュールを即座に確定！
        const totalBattleB1 = Number(currentFloorCfg.battle_count || 3);
        const targetChestCountB1 = Math.min(totalBattleB1, Number(currentFloorCfg.chest_count || 0));
        const possibleBattlesB1 = Array.from({ length: totalBattleB1 }, (_, i) => i + 1);
        const shuffledB1 = possibleBattlesB1.sort(() => 0.5 - Math.random());
        setChestSchedule(shuffledB1.slice(0, targetChestCountB1));

        // 👑 🆕 【1戦目のボス判定＆出現数ロジック】
        const isInitialBoss = currentFloorCfg.battle_count === 1 && currentFloorCfg.boss_id;
        setEncounterType(isInitialBoss ? 'boss' : 'first');

        let validEnemyPool = [];
        let spawnCount = 1;
        let isBossSpawn = false;

        if (isInitialBoss) {
          // ボス確定ポップ
          validEnemyPool = [finalDbEnemies.find(e => e.id === currentFloorCfg.boss_id)].filter(Boolean);
          spawnCount = 1;
          isBossSpawn = true;
        } else {
          // 通常雑魚ポップ
          const activePoolEnemyIds = (currentFloorCfg.enemy_ids || enemyIds).filter(Boolean);
          validEnemyPool = activePoolEnemyIds.map(id => finalDbEnemies.find(e => e.id === id)).filter(Boolean);
          if (validEnemyPool.length === 0 && finalDbEnemies.length > 0) validEnemyPool = [...finalDbEnemies];
          
          const minS = Number(currentFloorCfg.min_spawn || 1);
          const maxS = Number(currentFloorCfg.max_spawn || 2);
          spawnCount = Math.floor(Math.random() * (maxS - minS + 1)) + minS;
        }

        let loadedEnemies = [];
        
        if (validEnemyPool.length > 0) {
          for (let i = 0; i < spawnCount; i++) {
            // ボスなら先頭のデータを、雑魚ならランダム
            const randomIndex = isBossSpawn ? 0 : Math.floor(Math.random() * validEnemyPool.length);
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
              reward_gold_battle: Number(dbEnemy?.reward_gold_battle || 0),
              reward_exp_battle: Number(dbEnemy?.reward_exp_battle || 0),
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
              // 🛡️ 👑 【三土手神特注】ダッシュボードの「防御力(Def)予測」計算式と100%完全同期！VIT直読みの誤差を撲滅！
              def: Math.floor(finalVit * 0.5 + Number(dbEnemy?.base_level || 1) * 0.1),
              
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

        // 👑 【三土手神特注：初期ログを空にして、タイピング側で歴史を紡ぐようにマウント】
        setDisplayedLogs([
          { id: 'story-init', text: `🚩 討伐作戦展開中...`, type: "system" }
        ]);
      } else {
        setDisplayedLogs([{ id: 'err', text: "酒場に冒険者がいません。編成を確認してください。", type: "system" }]);
      }
      setLoading(false);
    };

    initAdventure();
  }, []); // 👈 1つ目の初回ロードuseEffectの終わり

  const [chestTextAnimated, setChestTextAnimated] = useState(''); // 1文字ずつ表示用の内部State

  useEffect(() => {
    if (loading || !currentQuestState || party.length === 0) return;

    const welcomeStr = encounterType === 'boss' 
      ? `🚪 最奥部へと到達した。重苦しい空気が立ち込めている。` 
      : encounterType === 'floor_start' 
        ? `🏰 一行は【${currentQuestState.name || '始まりの森'}】のB${currentFloor}階へと足を踏み入れた。` 
        : encounterType === 'normal' 
          ? `👣 一行は警戒しながら、さらに奥へと進んでいく・・・` 
          : `🏰 一行は【${currentQuestState.name || '始まりの森'}】の討伐へ向かった。`;

    const situationStr = encounterType === 'boss' 
      ? `📝 ── 鼓膜を震わせる咆哮！強大な魔物の殺気が目前に迫る！ ──` 
      : encounterType === 'normal' 
        ? `📝 薄暗い道中、新たな敵の気配を察知した！` 
        : `📝 辺りには静寂が広がり、どこからか魔物の殺気が漂っている…`;

    const surpriseStr = encounterType === 'boss' 
      ? `🚨 ── 激震！奥地から巨大なボスが立ちはだかった！ ──` 
      : `🚨 ── 前方の物陰から急襲！魔物の群れが牙を剥いた！ ──`;

    // ── 【ステップA：1行目（進軍）タイピング】 ──
    if (prologueStep === 'typing_1') {
      if (typingText1.length < welcomeStr.length) {
        setChestTextAnimated('');
        const timer = setTimeout(() => {
          setTypingText1(welcomeStr.slice(0, typingText1.length + 1));
        }, 25);
        return () => clearTimeout(timer);
      } else {
        // 1行目のタイピング完了時に、スケジュールと照合して宝箱を出現させる！
        const activeQuestData = currentQuestState;
        const fConfigs = activeQuestData?.floor_configs || [];
        const currentFloorCfg = fConfigs.find(f => f.floor === currentFloor) || { battle_count: 3, chest_count: 1 };
        
        // 現在の「何戦目か」を逆算（総戦数 - 残り戦数 + 1）
        const totalBattles = Number(currentFloorCfg.battle_count || 3);
        const currentBattleIndex = totalBattles - remainingBattlesRef.current + 1;

        let foundChestStr = '';

        // 今の戦数が宝箱スケジュールに含まれていれば、確実に宝箱出現！
        if (chestSchedule.includes(currentBattleIndex)) {
          const dice = Math.random() * 100;
          const stoneMasterId = enhancementStoneIdRef.current;
          const stoneMasterItem = masterItemsRef.current.find(i => i.id === stoneMasterId);

          if (dice < 5 && stoneMasterItem) {
            setDroppedItems(prev => [...prev, { id: stoneMasterItem.id, name: stoneMasterItem.name, rarity: stoneMasterItem.rarity || 'legendary' }]);
            foundChestStr = `🎁✨ 奇跡！進軍途中で【${stoneMasterItem.name}】の入った宝箱を発見した！`;
          } else if (dice < 65) {
            const chestZeny = Math.floor(Math.random() * 300) + 100;
            setAccumulatedRewards(prev => ({ ...prev, gold: prev.gold + chestZeny }));
            foundChestStr = `🎁 進軍途中で古びた小箱を発見！小袋から +${chestZeny} Zeny を獲得！`;
          } else {
            foundChestStr = `🎁 進軍途中で木箱を発見！…しかし中は埃を被ったガラクタだった。`;
          }
        }

        setTypingChestText(foundChestStr);
        setChestTextAnimated('');
        setPrologueStep(foundChestStr ? 'typing_chest' : 'interval_1');
      }
    }

    // ── 【ステップA-2：宝箱メッセージも1文字ずつタイピング！】 ──
    if (prologueStep === 'typing_chest') {
      if (chestTextAnimated.length < typingChestText.length) {
        const timer = setTimeout(() => {
          setChestTextAnimated(typingChestText.slice(0, chestTextAnimated.length + 1));
        }, 25); // 他と同じ速度でカタカタ表示
        return () => clearTimeout(timer);
      } else {
        setPrologueStep('interval_1');
      }
    }

    // ── 【ステップB：ウエイト】 ──
    if (prologueStep === 'interval_1') {
      const timer = setTimeout(() => {
        setPrologueStep('typing_2');
      }, 600);
      return () => clearTimeout(timer);
    }

    // ── 【ステップC：3行目（気配）タイピング】 ──
    if (prologueStep === 'typing_2') {
      if (typingText2.length < situationStr.length) {
        const timer = setTimeout(() => {
          setTypingText2(situationStr.slice(0, typingText2.length + 1));
        }, 25);
        return () => clearTimeout(timer);
      } else {
        setPrologueStep('interval_2');
      }
    }

    // ── 【ステップD：ウエイト】 ──
    if (prologueStep === 'interval_2') {
      const timer = setTimeout(() => {
        setPrologueStep('surprise');
      }, 600);
      return () => clearTimeout(timer);
    }

    // ── 【ステップE：4行目（急襲）タイピング ＆ 戦闘開始へ】 ──
    if (prologueStep === 'surprise') {
      if (typingText3.trim().length < surpriseStr.trim().length) {
        const timer = setTimeout(() => {
          setTypingText3(surpriseStr.slice(0, typingText3.length + 1));
        }, 20);
        return () => clearTimeout(timer);
      } else {
        const logs = [
          { id: 'story-start', text: welcomeStr, type: 'system' }
        ];
        if (typingChestText) {
          logs.push({ id: `story-chest-${Date.now()}`, text: typingChestText, type: 'system' });
        }
        logs.push({ id: 'story-prologue', text: situationStr, type: 'system' });
        logs.push({ id: 'story-encounter', text: surpriseStr, type: 'system' });

        setDisplayedLogs(logs);

        const timer = setTimeout(() => {
          setPrologueStep('ready');
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, prologueStep, typingText1, typingChestText, chestTextAnimated, typingText2, typingText3, currentQuestState, party]);
  // 2. 🧠 超軽量・高速カウント保証型戦闘ループ（※この間は通信回数完全に「0」！）
  useEffect(() => {
    // 👑 【三土手神特注：プロローグ演出バリケード】
    // 1戦目のプロローグ演出中（ready以外）は、裏側の戦闘タイマーを絶対に起動させない！
    if (loading || party.length === 0 || enemies.length === 0 || isBattleOver || prologueStep !== 'ready') return;

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
        const battleExp = localEnemies.reduce((sum, e) => sum + (e.reward_exp_battle || 0), 0);
        const battleGold = localEnemies.reduce((sum, e) => sum + (e.reward_gold_battle || 0), 0);

        // 🆕 戦闘ごとの獲得報酬をハクスラ感溢れるシステムログとしてリアルタイム出力！
        newLogs.push({
          id: `battle-reward-${Date.now()}`,
          text: `💰 戦闘勝利報酬を獲得！ ➔ 📈 +${battleExp} EXP / 🟡 +${battleGold} Zeny`,
          type: "system"
        });

        // 🆕 帰還時に持ち帰る累積一時報酬プール（accumulatedRewards）へ直撃スタック加算！
        setAccumulatedRewards(prev => ({ 
          exp: prev.exp + battleExp, 
          gold: prev.gold + battleGold 
        }));

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
          // 残り戦数が0になった ➔ 階層制圧完了！
          setAdventureStatus('floor_cleared');

          // 👑 🆕 【最深部ボス討伐検知センサー】
          const isMaxFloorCleared = currentFloor >= (currentQuestState?.floors || 1);
          if (isMaxFloorCleared) {
            setShowQuestClearTheater(true);
          }
        } else {
          // まだ残り回数（2回、1回）が残っている ➔ 索敵続行（探索を続ける）ボタンを点灯！
          setAdventureStatus('battling');
          setIsBattleOver(true);
        }

        // 👑 【三土手神特注】戦闘が終わったら、リザルトやテイムを確認するために目隠しを自動解放！
        setIsLogCollapsed(false);
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
                      
                      // 🛡️ 👑 【修正】仲間詳細画面と完全同期した本物の素Def（19）を基準に使う！
                      const memberDef = Number(
                        member.def !== undefined ? member.def : (member.roStatus?.def ?? 19)
                      );

                      let bonusDef = 0;
                      const activeBuffs = member.activeBuffs || [];
                      activeBuffs.forEach(b => {
                        if (b.effect_type === '物理DEF増幅' || b.effect_type === '全防御増幅') {
                          if (b.buff_value_type === 'fixed') {
                            bonusDef += b.buff_value;
                          } else {
                            // 🛡️ 👑 【修正】基準をVITから「素Def(19)」へ変更！
                            bonusDef += Math.round((memberDef * b.buff_value) / 100);
                          }
                        }
                      });

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
                    // 🛡️ 👑 【修正】仲間詳細画面と完全同期した本物の素Def（19）を基準に使う！
                    const targetDef = Number(
                      target.def !== undefined ? target.def : (target.roStatus?.def ?? 19)
                    );

                    let bonusDef = 0;
                    const activeBuffs = target.activeBuffs || [];
                    activeBuffs.forEach(b => {
                      if (b.effect_type === '物理DEF増幅' || b.effect_type === '全防御増幅') {
                        if (b.buff_value_type === 'fixed') {
                          bonusDef += b.buff_value;
                        } else {
                          // 🛡️ 👑 【修正】基準をVITから「素Def(19)」へ変更！
                          bonusDef += Math.round((targetDef * b.buff_value) / 100);
                        }
                      }
                    });

                    dmg = Math.max(1, calculatedPower - (targetDef + bonusDef));

                    // 🛡️ 🆕 【デバッグ用】F12 コンソールにDEF増幅の計算内訳を出力！
                    if (bonusDef > 0) {
                      console.log(`🛡️ 【DEFバフ計算デバッグ(スキル)】 対象: ${target.name} | 素Def: ${targetDef} | バフ追加Def: +${bonusDef} | 最終総Def: ${targetDef + bonusDef} | 被ダメージ: ${dmg}`);
                    }

                    // 🛡️ 👑 【三土手神特注：物理スキル被弾時のバフ値連動型ディボーションセンサー】
                    const devotionBuff = activeBuffs.find(b => b.is_range_damage_cut && b.duration_turns > 0);
                    const casterMember = devotionBuff ? localParty.find(m => m.id === devotionBuff.casterId && m.hp > 0) : null;

                    if (devotionBuff && casterMember) {
                      // 🛡️ 👑 【三土手神特注：通常攻撃被弾時のバフ値連動型ディボーションセンサー】
                      // 通常攻撃被弾側も同様に range_damage_cut_pct から「50%」を取り出す設計に変更！
                      const cutPct = Number(devotionBuff.range_damage_cut_pct !== undefined ? devotionBuff.range_damage_cut_pct : 100);
                      
                      // 通常攻撃ダメージを割合で分配計算（まずスライム側のDefのみで計算した生dmgを分配）
                      let transferredDmg = Math.floor(dmg * (cutPct / 100)); // ファイター側（まだ軽減前）
                      const originalRemainingDmg = Math.max(0, dmg - transferredDmg); // スライム側

                      // 🛡️ 👑 🆕 【肩代わり分にも術者自身のDEFバフを反映！】
                      // ファイターが実際に「自分の身体で受け止める」ダメージとして、
                      // 自身のactiveBuffs（selfBuff）にある物理DEF増幅を、肩代わり分に対して追加軽減する！
                      let casterBonusDef = 0;
                      const casterActiveBuffs = casterMember.activeBuffs || [];
                      casterActiveBuffs.forEach(b => {
                        if (b.effect_type === '物理DEF増幅' || b.effect_type === '全防御増幅') {
                          if (b.buff_value_type === 'fixed') {
                            casterBonusDef += b.buff_value;
                          } else {
                            const casterBaseDef = Number(casterMember.def !== undefined ? casterMember.def : (casterMember.roStatus?.def ?? 19));
                            casterBonusDef += Math.round((casterBaseDef * b.buff_value) / 100);
                          }
                        }
                      });
                      // 軽減後の肩代わりダメージ（最低1）
                      transferredDmg = Math.max(1, transferredDmg - casterBonusDef);
                      
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
                  let playerFlee = Number(target.roStatus?.flee || target.flee || 0);
                  
                  // 🌪️ ウインドマーチ等の Flee％バフをリアルタイム反映
                  if (target.activeBuffs && target.activeBuffs.length > 0) {
                    target.activeBuffs.forEach(b => {
                      if (b.effect_type === '回避Flee増幅') {
                        if (b.buff_value_type === 'percent') {
                          playerFlee += Math.floor(playerFlee * (b.buff_value / 100));
                        } else {
                          playerFlee += Number(b.buff_value || 0);
                        }
                      }
                    });
                  }

                  const fleeChance = 20 + playerFlee - enemyHit;
                  const cappedFleeChance = Math.min(95, fleeChance);
                  const randomRoll = Math.floor(Math.random() * 100);

                  if (randomRoll < cappedFleeChance) {
                    logText = `💨 [MISS] ${enemyItem.name} が 【${target.name}】 を強襲！しかし、ヒラリとかわされた！ (回避率:${Math.max(0, cappedFleeChance)}%)`;
                  } else {
                    // 🛡️ 仲間詳細画面と完全同期した本物の素Def（19）を先に確定させる！
                    // 👑 🆕 %バフの基準値としても使うため、bonusDef計算より先に取得する！
                    const baseDefValue = Number(
                      target.def !== undefined ? target.def : (target.roStatus?.def ?? 19)
                    );

                    // 🛡️ 🆕 通常攻撃時のバフ効果（物理DEF増幅）の集計
                    let bonusDef = 0;
                    const activeBuffs = target.activeBuffs || [];

                    activeBuffs.forEach(b => {
                      if (b.effect_type === '物理DEF増幅' || b.effect_type === '全防御増幅') {
                        const val = Number(b.buff_value || 0);
                        const type = String(b.buff_value_type || '').toLowerCase();

                        // 固定値指定（fixed / 固定値プラス）の場合
                        if (type === 'fixed' || type.includes('固定')) {
                          bonusDef += val;
                        } 
                        // %上昇（percent / %上昇 / 未定義時はデフォルト%）の場合
                        else {
                          // 🛡️ 👑 【修正】基準をVITから「素Def(19)」へ変更！19の10%→2、19の100%→19！
                          bonusDef += Math.round((baseDefValue * val) / 100);
                        }
                      }
                    });

                    const totalDefWithBuff = baseDefValue + bonusDef;

                    // 物理被ダメージ算出（敵ダイスATK - 総Def）
                    dmg = Math.max(1, baseAtk - totalDefWithBuff);

                    // 🛡️ 🆕 【デバッグ用】F12 コンソールにDEF増幅の計算内訳を出力！（検証完了につき条件付きに戻す）
                    if (bonusDef > 0) {
                      console.log(`🛡️ 【DEFバフ計算デバッグ(通常攻撃)】 対象: ${target.name} | 敵基礎ATK: ${baseAtk} | 素Def: ${baseDefValue} | バフ追加Def: +${bonusDef} | 最終総Def: ${totalDefWithBuff} | 被ダメージ: ${dmg}`);
                    }

                    // 🛡️ 🆕 【三土手神特注：通常攻撃被弾時のディボーション割り込みセンサー】
                    const devotionBuff = activeBuffs.find(b => b.is_range_damage_cut && b.duration_turns > 0);
                    const casterMember = devotionBuff ? localParty.find(m => m.id === devotionBuff.casterId && m.hp > 0) : null;

                    if (devotionBuff && casterMember) {
                      // 🛡️ 👑 【修正】DEF二重減算バグを解消！
                      // 敵の「生ダメージ(baseAtk)」の状態でまず肩代わり分・被弾者分へ分配し、
                      // それぞれが「自分自身の素Def＋バフ」を1回だけ引く方式に変更した。
                      const cutPct = Number(devotionBuff.range_damage_cut_pct !== undefined ? devotionBuff.range_damage_cut_pct : 100);

                      // 敵の生ダメージ（誰のDefもまだ引いていない状態）を割合で分配
                      const rawTransferred = Math.floor(baseAtk * (cutPct / 100));   // ファイター側の生ダメージ取り分
                      const rawRemaining = Math.max(0, baseAtk - rawTransferred);     // フリーランス側の生ダメージ取り分

// 1. 🛡️ 【肩代わりする側（ファイター）の素Def＋バフを1回だけ適用】※以前は素Defが抜け落ちていたので追加
let casterBonusDef = 0;
const casterActiveBuffs = casterMember.activeBuffs || [];
casterActiveBuffs.forEach(b => {
  if (b.effect_type === '物理DEF増幅' || b.effect_type === '全防御増幅') {
    if (b.buff_value_type === 'fixed') {
      casterBonusDef += b.buff_value;
    } else {
      const casterBaseDef = Number(casterMember.def !== undefined ? casterMember.def : (casterMember.roStatus?.def ?? 19));
      casterBonusDef += Math.round((casterBaseDef * b.buff_value) / 100);
    }
  }
});
const casterBaseDefForCalc = Number(casterMember.def !== undefined ? casterMember.def : (casterMember.roStatus?.def ?? 19));
const transferredDmg = Math.max(1, rawTransferred - (casterBaseDefForCalc + casterBonusDef));

// 2. 🛡️ 👑 【被弾者本人（フリーランス）自身のDEF＆バフ（アストラルバリア等）を1回だけ適用】
// ※ totalDefWithBuff は関数冒頭で算出済みの値（素Def+バフ）をそのまま使い、二重計算しない！
const originalRemainingDmg = Math.max(1, rawRemaining - totalDefWithBuff);

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
                      
                      // 🎲 🛡️ 正しい数値とバフ増幅の内訳をログに印字！
                      const defDetailText = bonusDef > 0 
                        ? `(素Def:${baseDefValue}+バフ:${bonusDef})` 
                        : `(Def:${baseDefValue})`;

                      logText = `💥 ${enemyItem.name} の攻撃！ ➔ (ダイス${baseAtk}-敵防${totalDefWithBuff}${defDetailText}) ➔ ${target.name} は ${dmg} の物理ダメージを受けた！`;
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

      // 🛡️ 👑 【三土手神特注：バフ「同一枠」重複判定ヘルパー】
      // スキルIDが違っても、効果種別（例：全防御増幅）が同じなら「すでにその枠のバフがかかっている」扱いにする！
      // これが無いと「アイアンアイギス」「アストラルバリア」のように別名で同じ効果のスキルを
      // 取っ替え引っ替え掛け直し続けてしまう。
      const BUFF_CATEGORY_TYPES = ['物理ATK増幅', '物理DEF増幅', '全防御増幅', '行動速度Aspd増幅', '魔力Matk増幅', '魔法防御Mdef増幅', '魔法防御MDEF増幅'];
      const hasSameCategoryBuff = (ally, skill) => {
        const buffs = ally.activeBuffs || [];
        return buffs.some(b => {
          // ① 従来通り「同一スキル（同じID）」または「術者専用(_self)」ならすでにかかっている扱い
          if (b.id === skill.id || b.id === `${skill.id}_aspd` || b.id === `${skill.id}_flee` || b.id === `${skill.id}_self`) return true;
          // ② 🆕 スキル名・IDが違っても「効果種別」が同じならすでにかかっている扱いにする
          if (BUFF_CATEGORY_TYPES.includes(skill.effect_type) && b.effect_type === skill.effect_type) return true;
          return false;
        });
      };

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
              // 🛡️ 🆕 バフ系の除外（全員に掛かっているなら実行不可とする）
              const buffEffectTypes = ['物理ATK増幅', '物理DEF増幅', '全防御増幅', '行動速度Aspd増幅', 'ウインドマーチ', '魔力Matk増幅', '魔法防御Mdef増幅', '魔法防御MDEF増幅'];
              if (buffEffectTypes.includes(sk.effect_type)) {
                let unbuffedAllies = localParty.filter(p => p.hp > 0 && !hasSameCategoryBuff(p, sk));
                if (sk.is_range_damage_cut === true) unbuffedAllies = unbuffedAllies.filter(p => p.id !== member.id);
                return unbuffedAllies.length > 0;
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
          if (member.activeBuffs && member.activeBuffs.length > 0) {
    // 💡 期限切れログの重複出力を防ぐための判定用Set（1人の味方につきスキル名1回だけ）
    const clearedSkillNames = new Set();

    member.activeBuffs = member.activeBuffs.map(buff => {
        // かけたばかりのターンは引き算をスキップして保護する
        if (buff.isNew) {
          return { ...buff, isNew: false };
        }
        const nextTurns = buff.duration_turns - 1;
        if (nextTurns <= 0) {
          // 🎵 ウインドマーチ等、1つのスキルで複数の内部バフを持つ場合もメッセージを1回にまとめる
          if (!clearedSkillNames.has(buff.name)) {
            clearedSkillNames.add(buff.name);
            newLogs.push({ 
              id: `buff-clear-${member.id}-${buff.name}-${Date.now()}-${Math.random()}`, 
              text: `✨ ${member.name} の【${buff.name}】の効果が静かに切れた。`, 
              type: "system" 
            });
          }
        }
        return { ...buff, duration_turns: nextTurns };
    }).filter(buff => buff.duration_turns > 0);
  }

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
          if (member.position === 'back' && member.weaponRange === 'S') {
            // 現在使えるスキルを再計算（攻撃対象や回復対象がいなくても使えるか判定）
            const canUseSkill = member.skillsList.some(sk => {
              if (member.sp < Number(sk.sp_cost || 0)) return false;
              if (sk.effect_type === '状態異常回復') return localParty.some(p => p.hp > 0 && p.state?.currentStatus && VALID_STATUS_AILMENTS.includes(p.state.currentStatus));
              if (sk.effect_type === '回復' || sk.name?.includes('ヒール')) return localParty.some(p => p.hp > 0 && p.hp < (p.mhp || p.max_hp || 0));
              const buffEffectTypes = ['物理ATK増幅', '物理DEF増幅', '全防御増幅', '行動速度Aspd増幅', 'ウインドマーチ', '魔力Matk増幅', '魔法防御Mdef増幅', '魔法防御MDEF増幅'];
              if (buffEffectTypes.includes(sk.effect_type)) {
                let unbuffedAllies = localParty.filter(p => p.hp > 0 && !hasSameCategoryBuff(p, sk));
                if (sk.is_range_damage_cut === true) unbuffedAllies = unbuffedAllies.filter(p => p.id !== member.id);
                return unbuffedAllies.length > 0;
              }
              return true;
            });
            
            // 魔法・スキルが全くない、またはSP不足なら、どんな状況でも通常攻撃は「絶対に」させない
            if (!playableSkill && !canUseSkill) {
               newLogs.push({ id: `wait-back-${member.id}-${Date.now()}`, text: `🛡️ ${member.name} は後衛のため、近接攻撃を封印し待機した。`, type: "system" });
               return; // 攻撃の計算ロジックに到達させない
            }
          }
          // --- ✂️ ここまで追加・修正ブロック ---

          const myStr = member.str || 0;
          const myDex = member.dex || 0;
          const wAtk = member.weaponAtk || 0; // ⚔️ 🆕 装備している武器の攻撃力を取得
          
          // ⚔️ 🆕 基礎ステータスによる攻撃力に、武器の攻撃力を直接加算！
          const minAtk = Math.floor(myStr + (myDex * 0.5)) + wAtk;
          const maxAtk = Math.floor(myStr * 2.5 + myDex) + wAtk;
          const randomizedAtk = Math.floor(Math.random() * (maxAtk - minAtk + 1)) + minAtk;

          // 🏹 🆕 【三土手神特注】後衛時におけるSレンジスキルの暴発封印ゲート（ここで1度だけ宣言）
          const rawSkillsList = member.skillsList || [];
          const rangeFilteredSkills = rawSkillsList.filter(sk => {
            // 🔮 👑 常時発動型のパッシブスキルは、アクティブ技のプールから物理的に100%永久除外！
            if (sk.skill_type === 'passive') return false;

            // 🚑 👑 【三土手神特注パッチ】回復やバフなど「味方にかける支援魔法」は射程制限から免除！
            const isSupportMagic = ['状態異常回復', '回復', '物理ATK増幅', '物理DEF増幅', '行動速度Aspd増幅', 'ウインドマーチ', '魔力Matk増幅', '魔法防御Mdef増幅', '魔法防御MDEF増幅'].includes(sk.effect_type) || sk.name?.includes('ヒール');

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
          const isEmergencyHP = localParty.some(p => p.hp > 0 && p.hp < (p.mhp || p.max_hp || 0) * 0.7);

          // 🧠 三土手神特注：スキルプールから「今撃てる有効なスキル」を事前選別
          // 💡 射程フィルターを通過した「rangeFilteredSkills」を対象にして、2回目の重複宣言を粉砕！
          const allowedSkills = rangeFilteredSkills.filter(sk => {
            // 異常者が誰もいないなら、キュア系は選考対象外
            if (sk.effect_type === '状態異常回復' && !hasStatusAilment) return false;
            // 瀕死の味方が誰もいないなら、ヒール系も選考対象外
            if ((sk.effect_type === '回復' || sk.name?.includes('ヒール')) && !isEmergencyHP) return false;
            
            // 🛡️ 🆕 バフ系の重複完全除外（掛かっているなら最初から候補に入れない）
            const buffEffectTypes = ['物理ATK増幅', '物理DEF増幅', '全防御増幅', '行動速度Aspd増幅', 'ウインドマーチ', '魔力Matk増幅', '魔法防御Mdef増幅', '魔法防御MDEF増幅'];
            if (buffEffectTypes.includes(sk.effect_type)) {
              let unbuffedAllies = localParty.filter(p => p.hp > 0 && !hasSameCategoryBuff(p, sk));
              if (sk.is_range_damage_cut === true) unbuffedAllies = unbuffedAllies.filter(p => p.id !== member.id);
              if (unbuffedAllies.length === 0) return false;
            }
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
                
                // 🐾 🆕 【三土手神特注】回復スキルに「優先職業」が設定されている場合は、まず優先職の傷病者をロックオン！
                let rPriorityJobs = healSkill.target_priority_jobs;
                if (typeof rPriorityJobs === 'string') {
                    try { rPriorityJobs = JSON.parse(rPriorityJobs); }
                    catch (e) { rPriorityJobs = rPriorityJobs.replace(/[\[\]"']/g, '').split(',').map(s => s.trim()).filter(Boolean); }
                }
                if (Array.isArray(rPriorityJobs)) {
                    rPriorityJobs = rPriorityJobs.map(j => String(j).replace(/[\[\]"']/g, '').trim()).filter(Boolean);
                } else {
                    rPriorityJobs = [];
                }
                
                let injuredAllies = localParty.filter(p => p.hp > 0 && p.hp < (p.mhp || p.max_hp || 0)).sort((a,b) => a.hp - b.hp);
                let healTarget = null;
                
                if (rPriorityJobs.length > 0) {
                  for (let jobReq of rPriorityJobs) {
                    const matchedAlly = injuredAllies.find(p => p.name.includes(jobReq) || p.job === jobReq || p.meta?.job === jobReq);
                    if (matchedAlly) {
                      healTarget = matchedAlly;
                      break;
                    }
                  }
                }
                
                // 最もHPの低い味方、または優先職をターゲット
                targetAlly = healTarget || injuredAllies[0] || member;
            }
          } 

          // 🛡️ 3. 【さらに次点】バフ・支援特技（速度増加など）AI：誰も死にかけていない時だけかける
          if (!targetAlly) {
            const buffEffectTypes = ['物理ATK増幅', '物理DEF増幅', '全防御増幅', '行動速度Aspd増幅', 'ウインドマーチ', '魔力Matk増幅', '魔法防御Mdef増幅', '魔法防御MDEF増幅'];
            
            // 🎯 【三土手神特注】すでにそのバフがかかっている仲間をフィルターで除外！
            const availableBuffSkills = allowedSkills.filter(sk => {
              if (!buffEffectTypes.includes(sk.effect_type)) return false;
              if (member.sp < Number(sk.sp_cost || 0)) return false;
              
              // パーティ全員がすでにこのバフ（アストラルバリア等）を持っている場合はスキル候補から除外
              const unbuffedAllies = localParty.filter(p => p.hp > 0 && !hasSameCategoryBuff(p, sk));
              return unbuffedAllies.length > 0;
            });
            
            if (availableBuffSkills.length > 0) {
              let selectedBuffSkill = null;
              let selectedTarget = null;

              // 🎯 【三土手神特注：優先職判定＆汎用バフの厳格化統合エンジン】
              for (let bSkill of availableBuffSkills) {
                let priorityJobs = bSkill.target_priority_jobs;
                
                // 🧹 Supabaseの text[] 配列・文字列・JSONの表記ゆれを100%直撃クレンジング！
                if (typeof priorityJobs === 'string') {
                  try { priorityJobs = JSON.parse(priorityJobs); }
                  catch (e) { priorityJobs = priorityJobs.replace(/[\[\]"']/g, '').split(',').map(s => s.trim()).filter(Boolean); }
                }
                if (Array.isArray(priorityJobs)) {
                  priorityJobs = priorityJobs.map(j => String(j).replace(/[\[\]"']/g, '').trim()).filter(Boolean);
                } else {
                  priorityJobs = [];
                }

                let pFiltered = localParty.filter(p => p.hp > 0 && !hasSameCategoryBuff(p, bSkill));
                if (bSkill.is_range_damage_cut === true) pFiltered = pFiltered.filter(p => p.id !== member.id);

                if (pFiltered.length === 0) continue; // かけられる対象が誰もいないなら次のバフ候補へ

                // 🛡️ 優先職が設定されているスキルの厳格判定
                if (priorityJobs.length > 0) {
                  let foundMatch = null;
                  for (let cleanReq of priorityJobs) {
                    foundMatch = pFiltered.find(p => p.name.includes(cleanReq) || p.job === cleanReq);
                    if (foundMatch) break;
                  }
                  
                  if (foundMatch) {
                    selectedBuffSkill = bSkill;
                    selectedTarget = foundMatch;
                    break; // 🎯 有効な対象が見つかったのでバフ確定！
                  } else {
                    // 🚨 【大本命の修正】優先職対象者がいない場合、このバフは不発とする！
                    console.log(`🛑 【バフAI】${member.name} の「${bSkill.name}」：優先職に対象者がいないため発動をキャンセル。`);
                    continue; // 次のバフスキル候補があればそっちを判定する
                  }
                } else {
                  // 🎯 優先職指定の全く無い「100%汎用バフ」の厳格処理
                  const isAreaBuff = bSkill.target_type === '味方全体';
                  const totalTargetsCount = bSkill.is_range_damage_cut === true 
                    ? localParty.filter(p => p.hp > 0 && p.id !== member.id).length
                    : localParty.filter(p => p.hp > 0).length;
                  const alreadyBuffedCount = totalTargetsCount - pFiltered.length;

                  if (alreadyBuffedCount >= totalTargetsCount || (isAreaBuff && alreadyBuffedCount > 0)) {
                    continue;
                  }

                  if (bSkill.target_type === '自分自身') {
                    selectedBuffSkill = bSkill;
                    selectedTarget = member;
                    break;
                  }

                  // 🚨 【大本命の修正】汎用バフの無駄撃ち防止
                  // 術者が後衛の場合、自分自身に物理バフなどを連打しないよう「前衛」を優先してロック！
                  let frontLine = pFiltered.filter(p => p.position === 'front');
                  if (frontLine.length > 0) {
                    selectedBuffSkill = bSkill;
                    selectedTarget = frontLine[Math.floor(Math.random() * frontLine.length)];
                    break;
                  } else if (pFiltered.length > 0) {
                    selectedBuffSkill = bSkill;
                    selectedTarget = pFiltered[0];
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
            const currentSpRatio = (member.sp / (member.msp || 1)) * 100;
            const isTargetBoss = primaryTarget ? primaryTarget.is_boss === true : false;
            const enemyCount = aliveEnemies.length; // 👿 生存している敵の数

            // 🔮 10大属性完全網羅版・弱点属性マッピング（毒・念を完全追加！）
            const weaknessMap = {
              '水': ['風', '風属性'], 
              '火': ['水', '水属性'], 
              '地': ['火', '火属性'],
              '風': ['地', '地属性'], 
              '闇': ['聖', '聖属性'], 
              '聖': ['闇', '闇属性'],
              '不死': ['聖', '聖属性', '火', '火属性'], 
              '毒': ['聖', '聖属性', '風', '風属性', '火', '火属性'], // 🧪 毒の弱点
              '念': ['念', '念属性', '闇', '闇属性'],                 // 👻 念の弱点
              '無': []
            };
            const weaknesses = weaknessMap[primaryTarget.element] || [];

            // 🛡️ 👑 純粋な攻撃用アクティブスキルのみを抽出（支援バフ・回復・全防御増幅・パッシブ等を厳格除外）
            const attackSkillsPool = allowedSkills.filter(sk => 
              sk.skill_type !== 'passive' && 
              !['物理ATK増幅', '物理DEF増幅', '全防御増幅', '行動速度Aspd増幅', 'ウインドマーチ', '魔力Matk増幅', '魔法防御Mdef増幅', '魔法防御MDEF増幅', '回復', '状態異常回復'].includes(sk.effect_type) &&
              member.sp >= Number(sk.sp_cost || 0)
            );

            if (attackSkillsPool.length > 0) {
              // 🎯 1. 弱点を突けるスキル（全体・単体）を分類
              const weakAOESkills = attackSkillsPool.filter(sk => weaknesses.includes(sk.element) && (sk.target_type === '範囲エネミー' || sk.target_type === '敵全体' || sk.name?.includes('全体')));
              const weakSingleSkills = attackSkillsPool.filter(sk => weaknesses.includes(sk.element) && !(sk.target_type === '範囲エネミー' || sk.target_type === '敵全体' || sk.name?.includes('全体')));

              // ⚔️ 2. 等倍（弱点以外・無属性等）のスキルを分類
              const neutralAOESkills = attackSkillsPool.filter(sk => !weaknesses.includes(sk.element) && (sk.target_type === '範囲エネミー' || sk.target_type === '敵全体' || sk.name?.includes('全体')));
              const neutralSingleSkills = attackSkillsPool.filter(sk => !weaknesses.includes(sk.element) && !(sk.target_type === '範囲エネミー' || sk.target_type === '敵全体' || sk.name?.includes('全体')));

              let chosenSkill = null;

              // 🧠 三土手式・黄金思考アルゴリズムの適用
              if (enemyCount > 1) {
                // ─── 【敵が複数の場合】 ───
                // 順位: 弱点全体 ➔ 弱点単体 ➔ 等倍全体 (トリックスター/テンペストストーム等) ➔ 等倍単体
                if (weakAOESkills.length > 0) chosenSkill = weakAOESkills[0];
                else if (weakSingleSkills.length > 0) chosenSkill = weakSingleSkills[0];
                else if (neutralAOESkills.length > 0) chosenSkill = neutralAOESkills[0];
                else if (neutralSingleSkills.length > 0) chosenSkill = neutralSingleSkills[0];
              } else {
                // ─── 【敵が1体の場合】 ───
                // 順位: 弱点単体 ➔ 弱点全体 ➔ 等倍単体 (ファイアバースト等) ➔ 等倍全体
                if (weakSingleSkills.length > 0) chosenSkill = weakSingleSkills[0];
                else if (weakAOESkills.length > 0) chosenSkill = weakAOESkills[0];
                else if (neutralSingleSkills.length > 0) chosenSkill = neutralSingleSkills[0];
                else if (neutralAOESkills.length > 0) chosenSkill = neutralAOESkills[0];
              }

              // 🎯 選ばれたスキルを発動決定（SPが一定以上あるか、ボス戦時）
              if (chosenSkill && (isTargetBoss || currentSpRatio > 30)) {
                playableSkill = chosenSkill;
                shouldLaunchMagic = true;
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
              const isBuffType = ['物理ATK増幅', '物理DEF増幅', '全防御増幅', '行動速度Aspd増幅', 'ウインドマーチ', '魔力Matk増幅', '魔法防御Mdef増幅', '魔法防御MDEF増幅'].includes(playableSkill.effect_type);

              if (isBuffType) {
                let rPriorityJobs = playableSkill.target_priority_jobs;
                if (typeof rPriorityJobs === 'string') {
                    try { rPriorityJobs = JSON.parse(rPriorityJobs); }
                    catch (e) { rPriorityJobs = rPriorityJobs.replace(/[\[\]"']/g, '').split(',').map(s => s.trim()).filter(Boolean); }
                }
                if (Array.isArray(rPriorityJobs)) {
                    rPriorityJobs = rPriorityJobs.map(j => String(j).replace(/[\[\]"']/g, '').trim()).filter(Boolean);
                } else {
                    rPriorityJobs = [];
                }

                // 🎯 👑 同一カテゴリーのバフ重複を防ぐ神ヘルパーを完全適用
                let rFilteredAllies = localParty.filter(p => p.hp > 0 && !hasSameCategoryBuff(p, playableSkill));
                
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
                  // 🚨 【汎用バフ厳格化】優先職指定がないバフの場合
                  if (playableSkill.target_type === '自分自身') {
                    foundValidTarget = true;
                    targetAlly = member;
                  } else {
                    // 自分自身以外（単体・全体）なら、後衛の魔法職などが自分に物理バフをかけないよう前衛を優先ロック！
                    let frontLine = rFilteredAllies.filter(p => p.position === 'front');
                    if (frontLine.length > 0) {
                      foundValidTarget = true;
                      targetAlly = frontLine[Math.floor(Math.random() * frontLine.length)];
                    } else if (rFilteredAllies.length > 0) {
                      foundValidTarget = true;
                      targetAlly = rFilteredAllies[0];
                    }
                  }
                }

                // 🎯 優先職がいない、またはバフ対象が不在の場合は、スキル発動をキャンセルして通常行動へスルー！
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
          if (shouldLaunchMagic && playableSkill && targetAlly && ['物理DEF増幅', '物理ATK増幅', '全防御増幅', '行動速度Aspd増幅', 'ウインドマーチ', '魔力Matk増幅', '魔法防御Mdef増幅', '魔法防御MDEF増幅'].includes(playableSkill.effect_type)) {
  
  // 🎯 今回魔法をかける予定の「targetAlly」が、同じ効果枠のバフを（別名スキルでも）すでに持っていないかチェック！
  const isAlreadyBuffed = hasSameCategoryBuff(targetAlly, playableSkill);
  
  if (isAlreadyBuffed) {
    // この仲間はすでにそのバフがかかっているので、今ターンのスキル発動を安全にキャンセル
    shouldLaunchMagic = false;
    playableSkill = null;
    targetAlly = null; // 🚨 これを空にしないと通常・弱点攻撃のターゲット選定が走らずカカシ化します！
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
  sk.name === 'ホーリーガーディアン' ||
  sk.name === 'セイントブレス' ||
  sk.effect_type === 'セイントブレス'
);
          if (hasHolyPractice && primaryTarget) {
            // ダッシュボードで設定した「基礎効果数値」の値をそのまま特効%（20や25や30など）として動的適用！
            const bonusPct = Number(hasHolyPractice.effect_value || 0);
            
            // 敵の種族が「悪魔」「不死」、または敵の属性（element）が「不死」の場合に発動ゲートを全開にする
            const isTargetDemonicOrUndead = primaryTarget.race === '悪魔' || primaryTarget.race === '不死' || primaryTarget.element === '不死';
            
            if (isTargetDemonicOrUndead && bonusPct > 0) {
              cardRace['悪魔'] = (cardRace['悪魔'] || 0) + bonusPct;
              cardRace['不死'] = (cardRace['不死'] || 0) + bonusPct;
              cardElem['不死'] = (cardElem['不死'] || 0) + bonusPct; 
            }
          }

          // 🏹 👑 【三土手神特注】プレダトリーセンス専用・動物＆植物種族特効判定線
          const hasPredatorySense = (member.skillsList || []).find(sk => 
            sk.name === 'プレダトリーセンス' || 
            sk.effect_type === 'プレダトリーセンス'
          );
          if (hasPredatorySense && primaryTarget) {
            const bonusPct = 20; // 特効+20%
            if (primaryTarget.race === '動物' || primaryTarget.race === '植物') {
              cardRace['動物'] = (cardRace['動物'] || 0) + bonusPct;
              cardRace['植物'] = (cardRace['植物'] || 0) + bonusPct;
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
          const totalMultiplier = calculateDamageModifier(attackSpecs, defenderSpecs) * (1.0 + ((member.passive_damage_bonus_pct || 0) / 100));

          // ⚡ 実行ルート
          if (shouldLaunchMagic && playableSkill) {
            member.sp = Math.max(0, member.sp - Number(playableSkill.sp_cost || 0));
            const baseValue = Number(playableSkill.effect_value || 0);
            
            // 🛡️ 👑 【三土手神特注】古いガバガバ判定をここで完全粉砕！バフと回復を100%厳密に仕分ける定義
            const isCureSkill = playableSkill.effect_type === '状態異常回復';
            const isHealSkill = playableSkill.effect_type === '回復' || playableSkill.name?.includes('ヒール');
            const isBuffSkill = ['物理ATK増幅', '物理DEF増幅', '全防御増幅', '行動速度Aspd増幅', 'ウインドマーチ', '魔力Matk増幅'].includes(playableSkill.effect_type);

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

                // 🐾 🆕 【三土手神特注：カロリーチャージ専用・回復時ATKバフ同時付与エンジン】
                if (playableSkill.name?.includes('カロリーチャージ')) {
                  const turns = Number(playableSkill.duration_turns || 3);
                  const buffPct = Number(playableSkill.buff_value || 30);
                  const newBuff = {
                    id: playableSkill.id,
                    name: playableSkill.name,
                    effect_type: '物理ATK増幅',
                    buff_value: buffPct,
                    buff_value_type: 'percent',
                    duration_turns: turns,
                    casterId: member.id,
                    isNew: true
                  };
                  const currentBuffs = targetAlly.activeBuffs || [];
                  const filteredBuffs = currentBuffs.filter(b => b.id !== playableSkill.id);
                  targetAlly.activeBuffs = [...filteredBuffs, newBuff];
                  logText += ` ➔ 🍖 栄養満点！物理ATKが${buffPct}%上昇した！ (${turns}T)`;
                }

                const partyFindIdx = localParty.findIndex(p => p.id === targetAlly.id);
                if (partyFindIdx !== -1) {
                  localParty[partyFindIdx].hp = targetAlly.hp;
                  localParty[partyFindIdx].state = targetAlly.state;
                  // 🐾 🆕 追加されたバフ配列も確実に画面へ同期させる！
                  localParty[partyFindIdx].activeBuffs = targetAlly.activeBuffs;
                }
              }
            } else if (isBuffSkill) {
  // 🛡️ ② 特注：戦術支援・物理特技「かばう（ディボーション）」専用ルート
  const successRoll = Math.random() * 100;
  const effChance = Number(playableSkill.effect_chance !== undefined ? playableSkill.effect_chance : 100);

  // 🎯 【三土手神特注】ターゲットが「自分自身」なら絶対に自分自身に固定！
  if (playableSkill.target_type === '自分自身') {
    targetAlly = member;
  } else {
    // 🛡️ かばう（ダメージ肩代わり）スキルの場合のみ、自分への使用を禁止して他の仲間へ
    const isRangeCut = playableSkill.is_range_damage_cut === true;
    if (isRangeCut && (!targetAlly || targetAlly.id === member.id)) {
      targetAlly = localParty.find(p => p.hp > 0 && p.id !== member.id) || member;
    } else if (!targetAlly) {
      targetAlly = member; // 優先ターゲットもかばう指定もない場合の安全措置
    }
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

                // 🛡️ 👑 【三土手神特注：かばう対象専用バフ】
                // is_range_damage_cutがtrueの時、この newBuff は「かばう情報」専用にする！
                // effect_type は絶対に物理DEF増幅を持たせない（＝かばわれた対象＝スライムが誤ってDEF上昇しないように隔離）
                const newBuff = {
                  id: playableSkill.id,
                  name: playableSkill.name,
                  effect_type: isRangeCut ? 'かばう発動中' : playableSkill.effect_type,
                  buff_value: isRangeCut ? 0 : bValue,
                  buff_value_type: bValueType,
                  is_range_damage_cut: isRangeCut,
                  range_damage_cut_pct: rangeCutPct, // 🛡️ 肩代わり率専用キーに本来の 50 を格納！
                  duration_turns: turns,
                  casterId: member.id,
                  // 🎯 【三土手神特注】確定発動時も true に設定し、発動ターン直後の重複すり減りから鉄壁ガード！
                  isNew: true 
                    };

                // 🛡️ 👑 🆕 【三土手神特注：術者自身への物理DEF増幅バフ】
                // 「かばう」発動時は、術者（ファイター自身）にも同時に物理DEF増幅バフを別枠で付与する！
                const selfBuff = {
                  id: `${playableSkill.id}_self`,
                  name: playableSkill.name,
                  effect_type: playableSkill.effect_type,   // 物理DEF増幅 / 全防御増幅 など
                  buff_value: bValue,
                  buff_value_type: bValueType,
                  is_range_damage_cut: false,
                  duration_turns: turns,
                  casterId: member.id,
                  isNew: true
                };

                // スキルの効果タイプを判別して、ログの文字列を切り替える！
                const valText = bValue ? `${bValue}%` : '';
                let buffMsg = "ステータスが上昇した！";
                    if (playableSkill.effect_type === 'ウインドマーチ') {
                      // 💡 bValue (ダッシュボードで設定した10等の数値) を動的にログへ反映！
                      const marchVal = bValue || 10;
                      buffMsg = `行動速度(Aspd)と回避率(Flee)が${marchVal}%大幅上昇した！`;
                    } else if (playableSkill.effect_type === '物理ATK増幅') {
                      buffMsg = `物理ATKが${valText}大幅上昇した！`;
                    } else if (playableSkill.effect_type === '物理DEF増幅') {
                      buffMsg = `物理防御(DEF)が${valText}上昇した！`;
                    } else if (playableSkill.effect_type === '全防御増幅') {
                      buffMsg = `物理・魔法防御が${valText}大幅上昇した！`;
                    } else if (playableSkill.effect_type === '行動速度Aspd増幅') {
                      buffMsg = `行動速度(Aspd)が${valText}上昇した！`;
                    } else if (playableSkill.effect_type === '魔力Matk増幅') {
                      buffMsg = `魔力(Matk)が${valText}大幅上昇した！`;
                    }

                    const isAreaBuff = playableSkill.target_type === '味方全体';
                    const isMusic = playableSkill.name?.includes('マーチ') || playableSkill.name?.includes('アンセム') || playableSkill.name?.includes('演奏');

                    let castLogText = "";
                    if (isMusic || playableSkill.effect_type === 'ウインドマーチ') {
                      castLogText = `🎵✨ [戦術曲演奏] ${member.name} が 【${playableSkill.name}】 を奏でた！`;
                    } else if (playableSkill.skill_type === 'magic') {
                      castLogText = `🔮✨ [魔法詠唱] ${member.name} は 【${playableSkill.name}】 を唱えた！`;
                    } else {
                      castLogText = `🛡️✨ [鉄壁展開] ${member.name} は 【${playableSkill.name}】 を構えた！`;
                    }

                    if (isAreaBuff) {
                      logText = castLogText;
                      newLogs.push({ id: `p-buff-aoe-${member.id}-${Date.now()}`, text: logText, type: "success" });

                      // ウインドマーチ専用：Aspd増幅 と Flee増幅 の2つの効果オブジェクトを作成
                      const isWindMarch = playableSkill.effect_type === 'ウインドマーチ';
                      const marchAspdBuff = {
                        id: `${playableSkill.id}_aspd`,
                        name: playableSkill.name,
                        effect_type: '行動速度Aspd増幅',
                        buff_value: bValue || 30,
                        buff_value_type: bValueType,
                        duration_turns: turns,
                        casterId: member.id,
                        isNew: true
                      };
                      const marchFleeBuff = {
                        id: `${playableSkill.id}_flee`,
                        name: playableSkill.name,
                        effect_type: '回避Flee増幅',
                        buff_value: Math.floor((bValue || 30)), // Fleeの増幅%
                        buff_value_type: 'percent',
                        duration_turns: turns,
                        casterId: member.id,
                        isNew: true
                      };

                      localParty = localParty.map(ally => {
                        if (ally.hp <= 0) return ally;
                        
                        if (isRangeCut && ally.id === member.id) return ally;

                        const currentBuffs = ally.activeBuffs || [];
                        
                        let nextBuffs = [];
                        if (isWindMarch) {
                          // 古いウインドマーチバフを排除して入れ替え
                          const filtered = currentBuffs.filter(b => !b.id.startsWith(playableSkill.id));
                          nextBuffs = [...filtered, marchAspdBuff, marchFleeBuff];
                        } else {
                          const filtered = currentBuffs.filter(b => b.id !== playableSkill.id);
                          nextBuffs = [...filtered, newBuff];
                        }

                        // 🛡️ 👑 🆕 かばう(範囲)発動中は、仲間自身のDEFではなく「肩代わり加護」の文言をログに出す！
                        const allyLogMsg = isRangeCut
                          ? `被ダメージの${rangeCutPct}%を${member.name}が肩代わりする加護`
                          : buffMsg;
                        newLogs.push({ id: `p-buff-aoe-hit-${ally.id}-${Date.now()}`, text: `    ➔ 🌪️ 【${ally.name}】 に${allyLogMsg}が発動！ (${turns}T)`, type: "success" });
                        return { ...ally, activeBuffs: nextBuffs };
                      });

                      // 🛡️ 👑 🆕 【三土手神特注：範囲かばう発動時、術者自身にも物理DEF増幅バフを同時付与！】
                      // 単体版のディボーションと同様、術者（ファイター自身）のDEFを底上げしてこそ「盾役」として成立する
                      if (isRangeCut) {
                        const casterFindIdx = localParty.findIndex(p => p.id === member.id);
                        if (casterFindIdx !== -1) {
                          const casterCurrentBuffs = localParty[casterFindIdx].activeBuffs || [];
                          const casterFilteredBuffs = casterCurrentBuffs.filter(b => b.id !== selfBuff.id);
                          localParty[casterFindIdx].activeBuffs = [...casterFilteredBuffs, selfBuff];
                          newLogs.push({ id: `p-buff-aoe-self-${member.id}-${Date.now()}`, text: `    ➔ 🛡️ 【${member.name}】 自身の${buffMsg} (${turns}T)`, type: "success" });
                        }
                      }

                      logText = "";
                    } else {
                  // 単体バフ・ディボーション（献身）の確実なバインド（activeBuffsに統一）
                  const targetFindIdx = localParty.findIndex(p => p.id === targetAlly.id);
                  if (targetFindIdx !== -1) {
                    const currentBuffs = localParty[targetFindIdx].activeBuffs || [];
                    const filteredBuffs = currentBuffs.filter(b => b.id !== playableSkill.id);
                    localParty[targetFindIdx].activeBuffs = [...filteredBuffs, newBuff];

                    // 🛡️ 👑 🆕 かばう発動時は、術者（ファイター）自身にも物理DEF増幅バフを同時付与！
                    if (isRangeCut) {
                      const casterFindIdx = localParty.findIndex(p => p.id === member.id);
                      if (casterFindIdx !== -1) {
                        const casterCurrentBuffs = localParty[casterFindIdx].activeBuffs || [];
                        const casterFilteredBuffs = casterCurrentBuffs.filter(b => b.id !== selfBuff.id);
                        localParty[casterFindIdx].activeBuffs = [...casterFilteredBuffs, selfBuff];
                      }
                    }
                    
                    let actionPrefix = `✨ [スキル発動]`;
                    if (isMusic || playableSkill.effect_type === 'ウインドマーチ') {
                      actionPrefix = `🎵✨ [戦術曲演奏]`;
                    } else if (playableSkill.skill_type === 'magic') {
                      actionPrefix = `🔮✨ [魔法詠唱]`;
                    } else if (playableSkill.skill_type === 'art') {
                      actionPrefix = `🛡️✨ [鉄壁展開]`;
                    }

                    if (isRangeCut) {
                      logText = `${actionPrefix} ${member.name} は 【${playableSkill.name}】 を${playableSkill.skill_type === 'magic' ? '唱えた' : '構えた'}！ ➔ 【${targetAlly.name}】 と命の絆を結び(${rangeCutPct}%肩代わり)、自身のDEFも上昇した！ (${turns}T / 残SP: ${member.sp})`;
                    } else {
                      logText = `${actionPrefix} ${member.name} は 【${playableSkill.name}】 を${playableSkill.skill_type === 'magic' ? '唱えた' : (isMusic ? '奏でた' : '構えた')}！ ➔ 【${targetAlly.name}】 の${buffMsg} (${turns}T / 残SP: ${member.sp})`;
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

                let holyNotice = "";
                if (hasHolyPractice && primaryTarget && (primaryTarget.race === '悪魔' || primaryTarget.race === '不死' || primaryTarget.element === '不死')) {
                  const bPct = Number(hasHolyPractice.effect_value || 0);
                  holyNotice = `✨[聖者調伏/対悪魔不死+${bPct}%!] `;
                }

                logText = isMagic ? `${holyNotice}🔮✨ 【全体大魔法】${member.name} の【${playableSkill.name}】が炸裂！(残SP: ${member.sp})` : `${holyNotice}⚔️💥 【全体特技】${member.name} の【${playableSkill.name}】が一閃！(残SP: ${member.sp})`;
                newLogs.push({ id: `p-aoe-${member.id}-${Date.now()}`, text: logText, type: "success" });

                // 🔮 👑 【三土手神特注：全体魔法・特技用 バフ完全同期ベースパワー算出ゲート】
                // 🎲 まずは魔法のダイス幅（minMatk, maxMatk）を外側で準備しておく
                const myInt = member.int || 0; 
                let minMatk = Math.floor(myInt + (myDex * 0.2)); 
                let maxMatk = Math.floor(myInt * 2.0 + myDex);

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

                // ⚔️ 物理用のATKバフ上昇分も外側で準備しておく
                let bonusAtkFixed = 0;
                let bonusAtkPercent = 0;
                if (member.activeBuffs && member.activeBuffs.length > 0) {
                  member.activeBuffs.forEach(b => {
                    if (b.effect_type === '物理ATK増幅') {
                      if (b.buff_value_type === 'fixed') bonusAtkFixed += b.buff_value;
                      else if (b.buff_value_type === 'percent') bonusAtkPercent += b.buff_value;
                    }
                  });
                }

                // 確定したバッファを引っ提げて、敵全員のHPを消し飛ばすループへ突入！
                localEnemies = localEnemies.map(enemyItem => {
                  if (enemyItem.hp <= 0) return enemyItem;

                  // 🎲 ターゲットの敵「1体ずつ」に対して毎回乱数（ダイス）を振る！
                  let finalCalculatedPower = baseValue;
                  let rolledDiceValue = baseValue; // 🎲 ログ出力用バッファ
                  
                  if (playableSkill.value_type === 'percent') {
                    if (isMagic) {
                      // 魔法ダイスを振る
                      const rolledMatk = Math.floor(Math.random() * (maxMatk - minMatk + 1)) + minMatk;
                      rolledDiceValue = rolledMatk;
                      finalCalculatedPower = Math.floor(rolledMatk * baseValue / 100);
                    } else {
                      // 物理ダイスを振る（minAtk, maxAtk はループ外で計算済みの基本ステータス）
                      const rolledAtk = Math.floor(Math.random() * (maxAtk - minAtk + 1)) + minAtk;
                      rolledDiceValue = rolledAtk;
                      const buffedTotalAtk = rolledAtk + bonusAtkFixed + Math.floor(rolledAtk * bonusAtkPercent / 100);
                      finalCalculatedPower = Math.floor(buffedTotalAtk * baseValue / 100);
                    }
                  }
                  
                  const skillSpecs = { 
                    ...attackSpecs, 
                    element: playableSkill.element || '無', 
                    is_physical: !isMagic, 
                    card_size_eff: { [enemyItem.size]: sizeValue }, 
                    card_race_eff: { [enemyItem.race]: raceValue }, 
                    card_elem_eff: { [enemyItem.element]: elemValue } 
                  };
                  
                  let skillMultiplier = calculateDamageModifier(skillSpecs, { element: enemyItem.element, race: enemyItem.race, size: enemyItem.size });
                  skillMultiplier *= (1.0 + ((member.passive_damage_bonus_pct || 0) / 100));
                  
                  // 🚨 魔法なら敵のMDEF(INT)を、物理ならDEF(VIT)を減算する！
                  const enemyDefValue = isMagic ? (enemyItem.int || 0) : (enemyItem.vit || 0);
                  
                  const aoeDmg = Math.max(1, Math.floor(finalCalculatedPower * skillMultiplier) - enemyDefValue);
                  const nextHp = Math.max(0, enemyItem.hp - aoeDmg);
                  
                  // 🎲 ログにダイス値と敵防を追加！
                  const defTypeStr = isMagic ? '魔防' : '防';
                  let aoeLog = `   ➔ (ダイス${rolledDiceValue}-敵${defTypeStr}${enemyDefValue}) 💥 ${enemyItem.name} に ${aoeDmg} の全体ダメージ！`;
                  
                  let nextState = { ...enemyItem.state };
                  
                  if (playableSkill.effect_type && playableSkill.effect_type !== 'なし' && nextHp > 0) {
                    const baseChance = Number(playableSkill.effect_chance || 0);
                    
                    // 🃏 🆕 【トリックスター専用：ランダム状態異常（毒・暗闇・スタン）選定エンジン】
                    let targetEffectType = playableSkill.effect_type;
                    if (playableSkill.name === 'トリックスター' || playableSkill.effect_type === 'ランダム状態異常') {
                      const trickPool = ['毒', '暗闇', 'スタン'];
                      targetEffectType = trickPool[Math.floor(Math.random() * trickPool.length)];
                    }

                    const resistKey = targetEffectType === 'スタン' ? 'stun' : targetEffectType === '凍結' ? 'freeze' : targetEffectType === '毒' ? 'poison' : 'blind';
                    const enemyResistPct = enemyItem[`resist_${resistKey}`] || 0;

                    if (Math.random() * 100 < Math.max(0, baseChance - enemyResistPct)) {
                      nextState = { currentStatus: targetEffectType, durationTurns: Number(playableSkill.duration_turns || 2) };
                      aoeLog += ` ✨ [${targetEffectType}]状態にした！`;
                    }
                  }
                  
                  newLogs.push({ id: `p-aoe-hit-${enemyItem.instanceId}-${Date.now()}-${Math.random()}`, text: aoeLog, type: "success" });
                  if (nextHp <= 0) newLogs.push({ id: `win-aoe-${enemyItem.instanceId}-${Date.now()}`, text: `🏆 🎉 【${enemyItem.name}】を全体攻撃で撃破した！`, type: "system" });
                  
                  return { ...enemyItem, hp: nextHp, state: nextState };
                });
                logText = ""; 
              } else {
                let calculatedPower = baseValue;
                let rolledDiceValue = baseValue; // 🎲 ログ出力用バッファ
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
                    const rolledMatk = Math.floor(Math.random() * (maxMatk - minMatk + 1)) + minMatk;
                    rolledDiceValue = rolledMatk;
                    calculatedPower = Math.floor(rolledMatk * baseValue / 100);
                  } else {
                    // ⚔️ 🟢 【単体物理特技】バトルアンセム等の「物理ATK増幅」バフを威力へ合算！
                    let bonusAtk = 0;
                    if (member.activeBuffs && member.activeBuffs.length > 0) {
                      member.activeBuffs.forEach(b => {
                        if (b.effect_type === '物理ATK増幅') {
                          if (b.buff_value_type === 'fixed') {
                            bonusAtk += b.buff_value;
                          } else {
                            // 例: バトルアンセム(200%) ➔ 基礎ダイスATKの+200%（合計3倍火力）を乗算！
                            bonusAtk += Math.floor(randomizedAtk * (b.buff_value / 100));
                          }
                        }
                      });
                    }
                    // 物理攻撃はターン開始時の基礎ダイス(randomizedAtk)をそのまま流用
                    rolledDiceValue = randomizedAtk;
                    const buffedTotalAtk = randomizedAtk + bonusAtk;
                    // バフで強化された総ATKをもとにスキル倍率（シャドウステップ220%等）を乗算！
                    calculatedPower = Math.floor(buffedTotalAtk * baseValue / 100);
                  }
                }

                // 🏹 🟢 【単体スキル用】プレダトリーセンス（動物＆植物種族特効+20%）合流配線
                let skillCardRace = { ...cardRace };
                const hasPredatorySense = (member.skillsList || []).find(sk => 
                  sk.name === 'プレダトリーセンス' || sk.effect_type === 'プレダトリーセンス'
                );
                if (hasPredatorySense && primaryTarget) {
                  if (primaryTarget.race === '動物' || primaryTarget.race === '植物') {
                    skillCardRace['動物'] = (skillCardRace['動物'] || 0) + 20;
                    skillCardRace['植物'] = (skillCardRace['植物'] || 0) + 20;
                  }
                }

                const skillSpecs = { 
                  ...attackSpecs, 
                  element: playableSkill.element || '無', 
                  is_physical: playableSkill.skill_type === 'art',
                  card_race_eff: skillCardRace // 👈 特効バッファを反映！
                };
                let skillMultiplier = calculateDamageModifier(skillSpecs, defenderSpecs);
                skillMultiplier *= (1.0 + ((member.passive_damage_bonus_pct || 0) / 100));
                
                // 🚨 敵の防御力減算処理（物理ならVIT、魔法ならINT）
                const enemyDefValue = isMagic ? (primaryTarget.int || 0) : (primaryTarget.vit || 0);
                const defTypeStr = isMagic ? '魔防' : '防';
                
                // 物理・魔法ともに敵の防御力を引き算する
                finalDmg = Math.max(1, Math.floor(calculatedPower * skillMultiplier) - enemyDefValue);
                localEnemies[targetIdx].hp = Math.max(0, localEnemies[targetIdx].hp - finalDmg);
                
                // 🔮 🆕 単体魔法・単体特技用のホーリープラクティス文字センサーをインジェクション！
                let magicPassNotice = "";
                if (hasHolyPractice && primaryTarget && (primaryTarget.race === '悪魔' || primaryTarget.race === '不死' || primaryTarget.element === '不死')) {
                  magicPassNotice = `✨[聖者調伏+${hasHolyPractice.effect_value || 20}%!] `;
                }

                // 🎲 ログにダイス値と敵防を追加して出力！
                if (playableSkill.skill_type === 'art') {
                  logText = `${magicPassNotice}⚔️ ${member.name} 【${playableSkill.name}】！ (ダイス${rolledDiceValue}-敵${defTypeStr}${enemyDefValue}) ➔ ${primaryTarget.name} に ${finalDmg} の物理ダメージ！(残SP: ${member.sp})`;
                } else {
                  logText = `${magicPassNotice}🔮 ${member.name} 【${playableSkill.name}】！ (ダイス${rolledDiceValue}-敵${defTypeStr}${enemyDefValue}) ➔ ${primaryTarget.name} に ${finalDmg} の魔法ダメージ！(残SP: ${member.sp})`;
                }

                // 🔮 👑 ここもパッシブなら敵にデバフを流さない！
                if (playableSkill.effect_type === 'シャドウステップ') {
                  const turns = Number(playableSkill.duration_turns || 2);
                  const fleeVal = Number(playableSkill.buff_value || 30);
                  const selfFleeBuff = {
                    id: `${playableSkill.id}_flee_self`,
                    name: playableSkill.name,
                    effect_type: '回避Flee増幅',
                    buff_value: fleeVal,
                    buff_value_type: 'percent',
                    duration_turns: turns,
                    casterId: member.id,
                    isNew: true
                  };
                  const currentBuffs = member.activeBuffs || [];
                  const filteredBuffs = currentBuffs.filter(b => b.id !== selfFleeBuff.id);
                  member.activeBuffs = [...filteredBuffs, selfFleeBuff];
                  logText += ` ➔ 💨 自身の回避率(Flee)が${fleeVal}%上昇！(${turns}T)`;
                }
                else if (playableSkill.effect_type && playableSkill.effect_type !== 'なし' && playableSkill.skill_type !== 'passive' && localEnemies[targetIdx].hp > 0) {
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
              else if (['物理ATK増幅', '物理DEF増幅', '全防御増幅', '行動速度Aspd増幅', 'ウインドマーチ', '魔力Matk増幅', '魔法防御Mdef増幅', '魔法防御MDEF増幅'].includes(skillToUse.effect_type)) {
                
                // 🎯 確率発動ルートでも「優先職業」を確実にスキャンして、かつ【まだバフがかかっていない仲間】を厳選！
                let rPriorityJobs = skillToUse.target_priority_jobs;
                if (typeof rPriorityJobs === 'string') {
                    try { rPriorityJobs = JSON.parse(rPriorityJobs); }
                    catch (e) { rPriorityJobs = rPriorityJobs.replace(/[\[\]"']/g, '').split(',').map(s => s.trim()).filter(Boolean); }
                }
                if (Array.isArray(rPriorityJobs)) {
                    rPriorityJobs = rPriorityJobs.map(j => String(j).replace(/[\[\]"']/g, '').trim()).filter(Boolean);
                } else {
                    rPriorityJobs = [];
                }

                let rFilteredAllies = localParty.filter(p => p.hp > 0 && !hasSameCategoryBuff(p, skillToUse));
                let validTargetFound = false;

                // 🎯 ターゲットが「自分自身」の場合の強制ロック判定
                if (skillToUse.target_type === '自分自身') {
                  const isAlreadyBuffed = hasSameCategoryBuff(member, skillToUse);
                  if (!isAlreadyBuffed) {
                    targetAlly = member;
                    validTargetFound = true;
                  }
                } else {
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
                    // 🚨 【汎用バフ厳格化】優先職指定がない場合、無駄撃ちを防ぐため前衛を優先ロック！
                    let frontLine = rFilteredAllies.filter(p => p.position === 'front');
                    if (frontLine.length > 0) {
                      targetAlly = frontLine[Math.floor(Math.random() * frontLine.length)];
                      validTargetFound = true;
                    } else if (rFilteredAllies.length > 0) {
                      targetAlly = rFilteredAllies[0];
                      validTargetFound = true;
                    }
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
                      effect_type: isRangeCut ? 'かばう発動中' : skillToUse.effect_type,
                      buff_value: isRangeCut ? 0 : bValue,
                      buff_value_type: bValueType,
                      is_range_damage_cut: isRangeCut,
                      range_damage_cut_pct: rangeCutPct,
                      duration_turns: turns,
                      casterId: member.id,
                      isNew: true
                    };

                    // 🛡️ 👑 🆕 【三土手神特注：術者自身への物理DEF増幅バフ】
                    // 「かばう」発動時は、術者（ファイター自身）にも同時に物理DEF増幅バフを別枠で付与する！
                    const selfBuff = {
                      id: `${skillToUse.id}_self`,
                      name: skillToUse.name,
                      effect_type: skillToUse.effect_type,
                      buff_value: bValue,
                      buff_value_type: bValueType,
                      is_range_damage_cut: false,
                      duration_turns: turns,
                      casterId: member.id,
                      isNew: true
                    };

                    const valText = bValue ? `${bValue}%` : '';
                    let buffMsg = "ステータスが上昇した！";
                    
                    if (skillToUse.effect_type === '物理ATK増幅') buffMsg = `物理ATKが${valText}大幅上昇した！`;
                    else if (skillToUse.effect_type === '物理DEF増幅') buffMsg = `物理防御(DEF)が${valText}上昇した！`;
                    else if (skillToUse.effect_type === '全防御増幅') buffMsg = `物理・魔法防御が${valText}大幅上昇した！`;
                    else if (skillToUse.effect_type === '行動速度Aspd増幅') buffMsg = `行動速度(Aspd)が${valText}上昇した！`;
                    else if (skillToUse.effect_type === '魔力Matk増幅') buffMsg = `魔力(Matk)が${valText}大幅上昇した！`;

                    const isAreaBuff = skillToUse.target_type === '味方全体';
                    const isMusic = skillToUse.name?.includes('マーチ') || skillToUse.name?.includes('アンセム') || skillToUse.name?.includes('演奏');

                    let castLogText = "";
                    if (isMusic || skillToUse.effect_type === 'ウインドマーチ') {
                      castLogText = `🎵✨ [戦術曲演奏] ${member.name} が 【${skillToUse.name}】 を奏でた！`;
                    } else if (skillToUse.skill_type === 'magic') {
                      castLogText = `🔮✨ [魔法詠唱] ${member.name} は 【${skillToUse.name}】 を唱えた！`;
                    } else {
                      castLogText = `🛡️✨ [鉄壁展開] ${member.name} は 【${skillToUse.name}】 を構えた！`;
                    }

                    if (isAreaBuff) {
                      logText = castLogText;
                      newLogs.push({ id: `p-buff-aoe-${member.id}-${Date.now()}`, text: logText, type: "success" });

                      localParty = localParty.map(ally => {
                        if (ally.hp <= 0) return ally;
                        if (isRangeCut && ally.id === member.id) return ally; // セルフかばう防止

                        const currentBuffs = ally.activeBuffs || [];
                        const filteredBuffs = currentBuffs.filter(b => b.id !== skillToUse.id);
                        // 🛡️ 👑 🆕 かばう(範囲)発動中は、仲間自身のDEFではなく「肩代わり加護」の文言をログに出す！
                        const allyLogMsg = isRangeCut
                          ? `被ダメージの${rangeCutPct}%を${member.name}が肩代わりする加護`
                          : buffMsg;
                        newLogs.push({ id: `p-buff-aoe-hit-${ally.id}-${Date.now()}`, text: `    ➔ 💥 【${ally.name}】 に${allyLogMsg}が発動！ (${turns}T)`, type: "success" });
                        return { ...ally, activeBuffs: [...filteredBuffs, newBuff] };
                      });

                      // 🛡️ 👑 🆕 【三土手神特注：範囲かばう発動時、術者自身にも物理DEF増幅バフを同時付与！】
                      if (isRangeCut) {
                        const casterFindIdx = localParty.findIndex(p => p.id === member.id);
                        if (casterFindIdx !== -1) {
                          const casterCurrentBuffs = localParty[casterFindIdx].activeBuffs || [];
                          const casterFilteredBuffs = casterCurrentBuffs.filter(b => b.id !== selfBuff.id);
                          localParty[casterFindIdx].activeBuffs = [...casterFilteredBuffs, selfBuff];
                          newLogs.push({ id: `p-buff-aoe-self-${member.id}-${Date.now()}`, text: `    ➔ 🛡️ 【${member.name}】 自身の${buffMsg} (${turns}T)`, type: "success" });
                        }
                      }

                      logText = "";
                    } else {
                      // 単体支援バフの確実なバインド処理
                      const targetFindIdx = localParty.findIndex(p => p.id === targetAlly.id);
                      if (targetFindIdx !== -1) {
                        const currentBuffs = localParty[targetFindIdx].activeBuffs || [];
                        const filteredBuffs = currentBuffs.filter(b => b.id !== skillToUse.id);
                        localParty[targetFindIdx].activeBuffs = [...filteredBuffs, newBuff];

                        // 🛡️ 👑 🆕 かばう発動時は、術者（ファイター）自身にも物理DEF増幅バフを同時付与！
                        if (isRangeCut) {
                          const casterFindIdx = localParty.findIndex(p => p.id === member.id);
                          if (casterFindIdx !== -1) {
                            const casterCurrentBuffs = localParty[casterFindIdx].activeBuffs || [];
                            const casterFilteredBuffs = casterCurrentBuffs.filter(b => b.id !== selfBuff.id);
                            localParty[casterFindIdx].activeBuffs = [...casterFilteredBuffs, selfBuff];
                          }
                        }
                        
                        let actionPrefix = `✨ [支援発動]`;
                        if (isMusic || skillToUse.effect_type === 'ウインドマーチ') {
                          actionPrefix = `🎵✨ [戦術曲演奏]`;
                        } else if (skillToUse.skill_type === 'magic') {
                          actionPrefix = `🔮✨ [魔法詠唱]`;
                        } else if (skillToUse.skill_type === 'art') {
                          actionPrefix = `🛡️✨ [鉄壁展開]`;
                        }

                        if (isRangeCut) {
                          logText = `${actionPrefix} ${member.name} は 【${skillToUse.name}】 を${skillToUse.skill_type === 'magic' ? '唱えた' : '構えた'}！ ➔ 【${targetAlly.name}】 と命の絆を結び(${rangeCutPct}%肩代わり)、自身のDEFも上昇した！ (${turns}T / 残SP: ${member.sp})`;
                        } else {
                          logText = `${actionPrefix} ${member.name} は 【${skillToUse.name}】 を${skillToUse.skill_type === 'magic' ? '唱えた' : (isMusic ? '奏でた' : '構えた')}！ ➔ 【${targetAlly.name}】 の${buffMsg} (${turns}T / 残SP: ${member.sp})`;
                        }
                      }
                    }
                  }
                }
              }
              // 🔮 3. 上のどれでもない（回復でもバフ支援でもない）場合のみ、初めてここの「攻撃魔法ルート」が着地します！
              else {
                const skillSpecs = { ...attackSpecs, element: skillToUse.element || '無', is_physical: skillToUse.skill_type === 'art' };
                
                // 💥 ここを const から let に変えて、可能性の覚醒のダメージバフを乗算します！
                let skillMultiplier = calculateDamageModifier(skillSpecs, defenderSpecs);
                skillMultiplier *= (1.0 + ((member.passive_damage_bonus_pct || 0) / 100));
                
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
              // 🛡️ 👑 【三土手神特注】VIT直読みをやめ、ダッシュボードと完全同期した本物の敵Def（primaryTarget.def）を参照！
              const effectiveEnemyVit = isEnemyDebuffed ? 0 : (primaryTarget.def !== undefined ? primaryTarget.def : (primaryTarget.vit || 0));
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

                // 🧪 ✝️ 【セイントブレス検証用F12コンソールログ】
                console.log(`=== ✝️ 【ダメージ計算検証ログ】 ${member.name} ➔ ${primaryTarget.name} ===`);
                console.log(`・攻撃者: ${member.name} (基礎ATKダイス: ${randomizedAtk} / バフ込: ${finalTotalAtk})`);
                console.log(`・対象種族/属性: ${primaryTarget.race} / ${primaryTarget.element} (敵Def: ${finalEnemyVit})`);
                console.log(`・セイントブレス検知: ${hasHolyPractice ? `有効 (+${hasHolyPractice.effect_value}%)` : '無効'}`);
                console.log(`・総合ダメージ倍率: ${totalMultiplier.toFixed(2)}倍`);
                console.log(`・最終算出ダメージ: ${finalDmg}`);
                console.log(`===================================================`);

                // 🔮 👑 【三土手創世神特注：ツインブレード二刀連撃・ダメージ2分割＆2行ログ出力エンジン】
                // 🏹 🆕 【武器制限ゲート】武器がLレンジ（弓など）の時は、二刀連撃が誤射されないように鉄壁ガード！
                const isTwinStrikeActive = (member.twin_strike_chance || 0) > 0 && 
                                           member.weaponRange !== 'L' && 
                                           (Math.random() * 100 < member.twin_strike_chance);

                if (isTwinStrikeActive) {
                  // 本家RO仕様：通常攻撃（finalDmg）と同等の打撃を2回叩き込む（合計200%）！
                  const firstDmg = finalDmg;
                  const secondDmg = Math.max(1, Math.floor(finalDmg * (0.9 + Math.random() * 0.2))); // 2打目に若干のダイス揺らぎ
                  const totalTwinDmg = firstDmg + secondDmg;

                  // 敵のHPから2連撃分の合計ダメージを減算！
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
                  const bPct = Number(hasHolyPractice.effect_value || 0);
                  holyPracticeNotice = `✨[聖者調伏+${bPct}%!] `;
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
        setEnemies(localEnemies);
        
        setDisplayedLogs(prev => {
          const combined = [...prev, ...newLogs];
          if (combined.length > 500) return combined.slice(-500);
          return combined;
        });
      }
    }, 20);

    return () => { clearInterval(battleTimer); };
  }, [loading, party, enemies, isBattleOver, prologueStep]);

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

    // 🎁 👑 【階層切り替え時に宝箱の出現スケジュールを厳密計算！】
    if (forcedNextFloor) {
      const totalBattle = Number(targetFloorCfg.battle_count || 3);
      const targetChestCount = Math.min(totalBattle, Number(targetFloorCfg.chest_count || 0));
      
      const possibleBattles = Array.from({ length: totalBattle }, (_, i) => i + 1);
      const shuffled = possibleBattles.sort(() => 0.5 - Math.random());
      setChestSchedule(shuffled.slice(0, targetChestCount));
    }

    if (forcedNextFloor) {
      if (targetFloorCfg.has_fountain) {
        partyStateRef.current = partyStateRef.current.map(p => ({ ...p, hp: p.mhp, sp: p.msp }));
        setParty(partyStateRef.current);
        alert(`⛲ 【B${nextFloorNum}階】に設置された「回復の泉」を発見！部隊全員のHP・SPが全回復した！`);
      }
      setRemainingBattles(targetFloorCfg.battle_count);
      remainingBattlesRef.current = targetFloorCfg.battle_count;
    }

    // 🎁 👑 【三土手神特注：奥進移動中・リアル宝箱発見＆開封イベント】
    let chestLogs = [];
    const totalChestCount = Number(targetFloorCfg.chest_count || 0);

    // 階層に宝箱が設定されていれば、移動時に 70% の確率で発見！
    if (totalChestCount > 0 && Math.random() < 0.70) {
      const dice = Math.random() * 100;
      const stoneMasterId = enhancementStoneIdRef.current;
      const stoneMasterItem = masterItemsRef.current.find(i => i.id === stoneMasterId);

      if (dice < 5 && stoneMasterItem) {
        // 💎 5% : 超激レア 強化石
        setDroppedItems(prev => [...prev, {
          id: stoneMasterItem.id,
          name: stoneMasterItem.name,
          rarity: stoneMasterItem.rarity || 'legendary'
        }]);
        chestLogs.push({
          id: `chest-stone-${Date.now()}`,
          text: `🎁✨ 奇跡！奥へ進む道中の壁際で【${stoneMasterItem.name}】の入った宝箱を発見した！`,
          type: "system"
        });
      } else if (dice < 65) {
        // 💰 60% : ボーナスZeny
        const chestZeny = Math.floor(Math.random() * 300) + 100;
        setAccumulatedRewards(prev => ({ ...prev, gold: prev.gold + chestZeny }));
        chestLogs.push({
          id: `chest-zeny-${Date.now()}`,
          text: `🎁 一行は移動中に古びた小箱を発見！小袋から +${chestZeny} Zeny を獲得！`,
          type: "system"
        });
      } else {
        // 📦 35% : 空っぽ
        chestLogs.push({
          id: `chest-empty-${Date.now()}`,
          text: `🎁 一行は移動中に木箱を発見！…しかし中は埃を被ったガラクタだった。`,
          type: "system"
        });
      }
    }

    // 宝箱発見ログがあれば、画面のログ一覧へ即座に追加！
    if (chestLogs.length > 0) {
      setDisplayedLogs(prev => [...prev, ...chestLogs]);
    }

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

    // 👑 🆕 【ボス判定 ＆ シチュエーション判定】
    const isBossBattle = (forcedNextFloor ? targetFloorCfg.battle_count : remainingBattlesRef.current) === 1 && targetFloorCfg.boss_id;
    
    if (isBossBattle) setEncounterType('boss');
    else if (forcedNextFloor) setEncounterType('floor_start');
    else setEncounterType('normal');

    let validEnemyPool = [];
    let spawnCount = 1;
    let isBossSpawn = false;

    if (isBossBattle) {
      // 👑 最後の1戦 ＆ ボス設定あり ➔ ボス確定召喚！
      validEnemyPool = [masterEnemiesRef.current.find(e => e.id === targetFloorCfg.boss_id)].filter(Boolean);
      spawnCount = 1;
      isBossSpawn = true;
    } else {
      // 🐾 道中の雑魚ランダム召喚
      const minS = Number(targetFloorCfg.min_spawn || 1);
      const maxS = Number(targetFloorCfg.max_spawn || 2);
      spawnCount = Math.floor(Math.random() * (maxS - minS + 1)) + minS;
      const activePoolEnemyIds = (targetFloorCfg.enemy_ids || []).filter(Boolean);
      validEnemyPool = activePoolEnemyIds.map(id => masterEnemiesRef.current.find(e => e.id === id)).filter(Boolean);
    }
    
    let loadedEnemies = [];
    if (validEnemyPool.length > 0) {
      for (let i = 0; i < spawnCount; i++) {
        // ボスなら先頭固定、雑魚ならランダム
        const randomIndex = isBossSpawn ? 0 : Math.floor(Math.random() * validEnemyPool.length);
        const dbEnemy = validEnemyPool[randomIndex];
        const targetId = dbEnemy.id;

        const isBaphometTarget = String(targetId).toLowerCase().includes('baphomet');
        const finalName = dbEnemy?.name || (isBaphometTarget ? "バフォメットJr" : "テストポリンJr");
        
        const enemySkillIds = [dbEnemy?.skill_01, dbEnemy?.skill_02, dbEnemy?.skill_03].filter(Boolean);
        const eSkills = masterSkillsRef.current.filter(sk => enemySkillIds.includes(sk.id));
        
        const enemyWeaponId = dbEnemy?.equip_right_hand;
        const enemyWeapon = masterItemsRef.current.find(item => item.id === enemyWeaponId);
        const eWeaponRange = enemyWeapon?.weapon_range || 'S';
        const isRanged = eWeaponRange === 'L';

        loadedEnemies.push({
          instanceId: `${targetId}_spawn_${i}_${Date.now()}`,
          id: targetId,
          name: isBossSpawn ? `🔥 ${finalName}` : `${finalName} ${String.fromCharCode(65 + i)}`,
          mhp: dbEnemy?.hp || dbEnemy?.base_hp || dbEnemy?.max_hp || 0,
          hp: dbEnemy?.hp || dbEnemy?.base_hp || dbEnemy?.max_hp || 0,
          str: dbEnemy?.str || dbEnemy?.stat_str || 0,
          agi: dbEnemy?.agi || dbEnemy?.stat_agi || 0, 
          vit: dbEnemy?.vit || dbEnemy?.stat_vit || 0,
          size: dbEnemy?.size || '小型',
          race: dbEnemy?.race || '無形',
          element: dbEnemy?.element || '無',
          reward_gold_battle: Number(dbEnemy?.reward_gold_battle || 0),
          reward_exp_battle: Number(dbEnemy?.reward_exp_battle || 0),
          exp: Number(currentQuestState?.exp_reward || 0),
          gold: Number(currentQuestState?.zeny_reward || 0),
          state: { currentStatus: 'なし', durationTurns: 0 },
          resist_stun: Number(dbEnemy?.resist_stun || 0),
          resist_freeze: Number(dbEnemy?.resist_freeze || 0),
          resist_poison: Number(dbEnemy?.resist_poison || 0),
          resist_blind: Number(dbEnemy?.resist_blind || 0),
          int: dbEnemy?.int || dbEnemy?.stat_int || 0,
          hit: Math.floor(Number(dbEnemy?.base_level || 1) + Number(dbEnemy?.stat_dex || dbEnemy?.dex || 0) + Number(dbEnemy?.stat_luk || dbEnemy?.luk || 0) * 0.2 + 20),
          flee: Math.floor(Number(dbEnemy?.base_level || 1) + Number(dbEnemy?.stat_agi || dbEnemy?.agi || 0) + Number(dbEnemy?.stat_luk || dbEnemy?.luk || 0) * 0.2 + 10),
          // 🛡️ 👑 【三土手神特注】ダッシュボードの「防御力(Def)予測」計算式と100%完全同期！VIT直読みの誤差を撲滅！
          def: Math.floor((Number(dbEnemy?.vit || dbEnemy?.stat_vit || 0)) * 0.5 + Number(dbEnemy?.base_level || 1) * 0.1),
          enemy_aspd: dbEnemy?.enemy_aspd !== null && dbEnemy?.enemy_aspd !== undefined ? Number(dbEnemy.enemy_aspd) : 150.0,
          is_range_atk: isRanged,
          is_range_weapon: isRanged,
          weaponRange: eWeaponRange,
          activeSkills: eSkills,
          is_tamable: dbEnemy?.is_tamable || false,
          tame_success_chance: Number(dbEnemy?.tame_success_chance || 0),
          tame_level_req: Number(dbEnemy?.tame_level_req || 1),
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
    setIsLogCollapsed(true); // 自動で目隠しON

    // 👑 🆕 【タイピング演出へのバトンパス】
    // 即座にログを出さず、バリケードを再構築してプロローグ演出をやり直す！
    setTypingText1('');
    setTypingChestText('');
    setChestTextAnimated('');
    setTypingText2('');
    setTypingText3('');
    setPrologueStep('typing_1'); 
  };

  // 3. 🔮 🆕 三土手創世神特注：サーバー無風コミットエンジン（これが「最後」の1回だけの通信）
  const handleTownCommit = async () => {
    setIsSaving(true);
    try {
      const finalParty = partyStateRef.current;
      const finalEnemies = enemiesStateRef.current;
      const isVictory = finalEnemies.every(e => e.hp <= 0);

      // 👥 1. 割り算を完全廃止！獲得した経験値（accumulatedRewards.exp）は全員が100%丸ごと獲得！
      const earnedExpPerChar = accumulatedRewards.exp || 0; 

      await Promise.all(
        finalParty.map(async (member) => {
          // 🧠 原帳（allPlayerCharactersRef）から直撃逆引き同期
          const originChar = allPlayerCharactersRef.current.find(c => c.id === member.id) || {};
          
          let lv = Number(originChar.level) || 1;
          let totalExp = (Number(originChar.exp) || 0) + earnedExpPerChar;

          // 📊 連続レベルアップ判定ループ（MAX50レベル）
          while (lv < 50) {
            const nextLvIdx = lv + 1;
            const requiredExp = RO_NEXT_EXP_TABLE[nextLvIdx] || 999999;

            if (totalExp >= requiredExp) {
              totalExp -= requiredExp; // 必要経費を引き算
              lv += 1;                // レベルアップ！
              console.log(`🎉 【LEVEL UP！】 ${member.name} が Lv.${lv} に限界突破！`);
            } else {
              break;
            }
          }

          // 🎯 👑 【三土手創世神拡張エンジン完全同期：引き算UIインフラ】
          // 1. gameRules.js の計算式を呼び出し、新しいレベルにおける「生涯獲得総ポイント数」を算出
          const totalEarnedPoints = calculateTotalStatusPoints(lv);

          // 2. 👑 解決：手振りの消費ポイント数を、本物のカラム構造（originChar.bonus?.str）から正確に集計！
          // これにより、手振り確定した消費数が0と誤認されるのを完璧にガードします。
          const spentPoints = 
            Number(originChar.bonus?.str || originChar.bonus_str || 0) + 
            Number(originChar.bonus?.agi || originChar.bonus_agi || 0) + 
            Number(originChar.bonus?.vit || originChar.bonus_vit || 0) + 
            Number(originChar.bonus?.int || originChar.bonus_int || 0) + 
            Number(originChar.bonus?.dex || originChar.bonus_dex || 0) + 
            Number(originChar.bonus?.luk || originChar.bonus_luk || 0);

          // 3. 👑 【三土手神特注：帰還時のポイント計算ズレ完全粉砕！】
          // 【生涯総獲得ポイント ＋ 初期支給の6ポイント】 － 【使用済みポイント】 ＝ 画面に出すべき完璧な残りフリーポイント！
          const finalFreePoints = Math.max(0, totalEarnedPoints - spentPoints);

          // ⚡ 👑 解決：部分更新（update）を安全に実行！
          // jobやrace、guild_nameなどのカラムを上書き項目から完全に除外することで、
          // 既存の大切なデータが巻き込まれてNULLに破壊されるのを永久にシャットアウトします！
          await supabase
            .from('game_characters')
            .update({ 
              current_hp: member.hp,          // 残りHP
              level: lv,                      // 最新確定レベル
              exp: totalExp,                  // 繰り越し経験値
              status_points: finalFreePoints  // 1ミリの狂いもない最新の残りポイント！
            })
            .eq('id', member.id);
        })
      );

      // 💰 2. 📋（ログ用デバッグ配線）
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
          // 🆕 ここも動的にログインプレイヤーの userId に結線！
          user_id: userId,
          master_id: enemy.id,
          custom_name: cleanName,
          level: 1, 
          exp: 0,
          status_points: 6, // 創世神の初期ポイント6を付与！
          current_hp: enemy.mhp, 
          max_hp: enemy.mhp,
          current_sp: 50,
          max_sp: 50,
          
          // 👑 解決：手振りボーナスは完全に「0」でまっさらな状態からスタート！
          // これにより「手振りポイントを既に振った」と勘違いされるのを永久に防ぎます。
          bonus_str: 0,
          bonus_agi: 0,
          bonus_vit: 0,
          bonus_int: 0,
          bonus_dex: 0,
          bonus_luk: 0,
          
          party_index: null, // 酒場へ送る
          
          // 👑 解決：テーブル直下の job, race, guild_name が NULL になるバグを直撃粉砕！
          // 生成時にここへ直接初期文字列を書き込んでインサートします。
          job: masterData?.job || '魔獣族',
          race: masterData?.race || enemy.race || '無形',
          guild_name: '無所属',
          
          // 🐾 🆕 マスターデータからスキルIDを継承！
          skill_01: masterData?.skill_01 || null,
          skill_02: masterData?.skill_02 || null,
          skill_03: masterData?.skill_03 || null,
          // 🐾 🆕 職業（魔物クラス）と、エネミー個別に振られて尖らせたステータス（10や20など）を meta に格納
          meta: {
            job: masterData?.job || '魔獣族',
            race: masterData?.race || enemy.race || '無形',
            
            // 👑 解決：敵個別で振った「尖った初期ステータス」は手振りではなく、
            // すべてマスター初期値（stat_xxx）としてここで完全にマウントして差別化します！
            stat_str: enemy.str || masterData?.stat_str || 1,
            stat_agi: enemy.agi || masterData?.stat_agi || 1,
            stat_vit: enemy.vit || masterData?.stat_vit || 1,
            stat_int: enemy.int || masterData?.stat_int || 1,
            stat_dex: enemy.dex || masterData?.stat_dex || 1,
            stat_luk: enemy.luk || masterData?.stat_luk || 1
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
          <div style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '0.85rem' }}>⚔️ 【{currentQuestState?.name || '討伐任務'}】</div>
          {/* 👑 プレイヤーがいつでも手動でログを開け閉めできるトグルボタンを設置！ */}
          {!isBattleOver && (
            <button 
              onClick={() => setIsLogCollapsed(!isLogCollapsed)} 
              style={{ padding: '2px 8px', background: '#1e293b', color: '#38bdf8', border: '1px solid #334155', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {isLogCollapsed ? '👁️ 戦況ログを解放' : '🙈 ログを隠す'}
            </button>
          )}
        </div>
      </div>

      {/* 👑 【三土手神特注：カジュアル目隠しシアターインフラ】 */}
      {prologueStep !== 'ready' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '30px', background: '#020617', fontFamily: 'monospace', gap: '16px', lineHeight: '1.8' }}>
          
          {/* 1行目：進軍 */}
          {typingText1 && (
            <div style={{ color: '#ffd700', fontSize: '0.85rem', fontWeight: 'bold', background: '#1e1b4b', padding: '10px 14px', borderRadius: '6px', border: '1px solid #4338ca33' }}>
              {typingText1}
            </div>
          )}

          {/* 2行目：宝箱発見（前後と完全に同じ自然なデザイン＆1文字ずつ流れる仕様！） */}
          {chestTextAnimated && (
            <div style={{ color: '#ffd700', fontSize: '0.8rem', background: '#0f172a', padding: '10px 14px', borderRadius: '6px', border: '1px solid #1e293b' }}>
              {chestTextAnimated}
            </div>
          )}

          {/* 3行目：気配 */}
          {typingText2 && (
            <div style={{ color: '#ffd700', fontSize: '0.8rem', background: '#0f172a', padding: '10px 14px', borderRadius: '6px', border: '1px solid #1e293b' }}>
              {typingText2}
            </div>
          )}

          {/* 4行目：急襲 */}
          {typingText3 && (
            <div style={{ color: '#f43f5e', fontSize: '0.8rem', fontWeight: 'bold', border: '1px dashed #ef4444', padding: '10px 14px', borderRadius: '6px', background: '#1a0505', textAlign: 'center', animation: 'shake 0.3s ease-in-out' }}>
              {typingText3}
              <style>{`
                @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-4px); } 40%, 80% { transform: translateX(4px); } }
              `}</style>
            </div>
          )}

        </div>
      ) : (!isBattleOver && isLogCollapsed) ? (
        /* ⚔️ 【目隠しON ＆ 演出終了後（通常戦闘中）】中央にエレガントな激闘インジケーターを点灯！ */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', background: '#020617' }}>
          <div style={{ color: '#f43f5e', fontSize: '1.2rem', fontWeight: 'black', letterSpacing: '2px', animation: 'pulse 1.5s infinite' }}>
            ⚔️ ── 討 伐 激 闘 中 ── ⚔️
          </div>
          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>パーティが裏側で20msの超高速戦闘を展開しています...</span>
          <style>{`
            @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
          `}</style>
        </div>
      ) : (
        /* 📜 【目隠しOFF・または戦闘終了時】すべての詳細な戦闘ダメージ履歴を美しくスクロール描画！ */
        <div ref={scrollRef} style={{ flex: 1, padding: '15px', overflowY: 'auto', fontSize: '0.8rem', lineHeight: '1.7', background: '#020617', fontFamily: 'monospace' }}>
          {displayedLogs.map(log => (
            <div key={log.id} style={{ marginBottom: '6px', padding: '4px 8px', borderRadius: '4px', background: log.type === 'system' ? '#1e1b4b' : 'none', color: log.type === 'battle' ? '#f43f5e' : log.type === 'success' ? '#34d399' : log.type === 'system' ? '#f59e0b' : '#94a3b8', whiteSpace: 'pre-wrap' }}>
              {log.text}
            </div>
          ))}
        </div>
      )}

      {/* 👑 【三土手神特注：敵HPバーのフライング出演完全封鎖ゲート】 */}
      {/* 演出ステップが完了（ready）するまでは、下の真っ赤なエネミー情報ブロックを丸ごと非表示にします！ */}
      {prologueStep === 'ready' && (
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
      )}

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
            {/* 🛠️ 🆕 最終階層なら「クエスト完了！」、道中なら「階段を発見」を表示するTRPG仕様！ */}
            <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
              {currentFloor >= (currentQuestState?.floors || 1) 
                ? "🏆 🎉 最終階層のボスを撃破！クエスト完全踏破！" 
                : `🕳️ 地下へと続く階段を見つけた・・・ 【B${currentFloor + 1}階】へ進みますか？`}
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
                💰 一旦帰還して報酬を獲得
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
        // テイマーがいれば4分割、通常3人パーティーなら3分割にジャストフィットさせる数理[cite: 6]
        const gridColsCount = hasTamerInBattle ? 4 : 3;

        return (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${gridColsCount}, 1fr)`, 
            gap: '4px', padding: '10px 6px', backgroundColor: '#0b0f19'
          }}>
            {party.map(member => {
              // リアルタイムに変動するSPの安全な割合を算出
              const mspValue = member.msp || 50;
              const spPercent = Math.min(100, Math.max(0, (member.sp / mspValue) * 100));

              // 📈 【三土手成長数理結合】本物テーブルからこのレベルの最大必要EXPを逆引き
              const liveEarnedExp = accumulatedRewards.exp || 0;
              
              // 👑 初期ロード時のベースexpに道中の獲得expを合算し、一時的な「現在の総経験値」と「レベル」を算出
              let displayLevel = member.level || 1;
              let displayExp = (member.exp || 0) + liveEarnedExp;

              // 📈 【三土手成長数理結合】戦闘中リアルタイムレベルアップループ！
              while (displayLevel < 50) {
                const nextLvIdx = displayLevel + 1;
                const requiredExp = RO_NEXT_EXP_TABLE[nextLvIdx] || 999999;
                
                // 経験値が必要値を満たしていれば、その場でレベルアップ！
                if (displayExp >= requiredExp) {
                  displayExp -= requiredExp;
                  displayLevel += 1;
                } else {
                  break; // 満たしていなければループ終了
                }
              }

              // 最終的に計算されたレベルに応じた「次のレベルへの必要経験値」を逆引き
              const displayNextMaxExp = RO_NEXT_EXP_TABLE[Math.min(50, displayLevel + 1)] || 999999;
              const expPercent = Math.min(100, Math.max(0, (displayExp / displayNextMaxExp) * 100));

              return (
                <div key={member.id} style={{ background: member.hp <= 0 ? '#1e1b4b' : '#1e293b', borderRadius: '6px', padding: '6px 4px', border: member.hp <= 0 ? '1px solid #ef4444' : '1px solid #334155', textAlign: 'center', boxSizing: 'border-box' }}>
                  
                  {/* 📈 上部：レベル ＆ 名前を横並びで綺麗にセパレート */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.55rem', fontFamily: 'monospace', color: '#f59e0b', fontWeight: 'bold', background: 'rgba(0,0,0,0.5)', padding: '1px 4px', borderRadius: '3px', shrink: 0 }}>
                      Lv.{displayLevel}
                    </span>
                    <span style={{ fontSize: '0.62rem', fontWeight: '900', color: member.hp <= 0 ? '#64748b' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.name.replace('テスト', '')}
                    </span>
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

                  {/* 💙 SP数値 */}
                  <div style={{ fontFamily: 'monospace', fontSize: '0.55rem', color: '#38bdf8', marginTop: '3px', display: 'flex', justifyContent: 'space-between', padding: '0 4px', lineHeight: '1.2' }}>
                    <span style={{ color: '#887355', fontWeight: 'bold' }}>SP:</span>
                    <span>{member.sp}/{mspValue}</span>
                  </div>
                  {/* 💙 SPバー */}
                  <div style={{ width: '100%', height: '3px', background: '#0d0905', borderRadius: '1.5px', overflow: 'hidden', border: '1px solid #23190e', marginTop: '1px' }}>
                    <div style={{ width: `${spPercent}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)', transition: 'width 0.2s ease' }}></div>
                  </div>

                  {/* 📈 💜 EXP数値（ただの棒にならないよう、テキストを追加！） */}
                  <div style={{ fontFamily: 'monospace', fontSize: '0.5rem', color: '#c084fc', marginTop: '3px', display: 'flex', justifyContent: 'space-between', padding: '0 4px', lineHeight: '1.2' }}>
                    <span style={{ fontWeight: 'bold' }}>EXP:</span>
                    <span>{displayExp}/{displayNextMaxExp}</span>
                  </div>
                  {/* 📈 💜 EXPプログレスバー（戦闘中にリアルタイムで右へ伸びる仕様） */}
                  <div style={{ width: '100%', height: '3px', background: '#111', borderRadius: '1.5px', overflow: 'hidden', border: '1px solid #2d1b4e', marginTop: '1px' }}>
                    <div style={{ width: `${expPercent}%`, height: '100%', background: 'linear-gradient(90deg, #a855f7 0%, #e9d5ff 100%)', transition: 'width 0.3s ease' }}></div>
                  </div>

                </div>
              );
            })}
          </div>
        );
      })()}

      {/* 👑 🆕 【三土手神特注：全画面クエストクリア・大勲章シアター】 */}
      {showQuestClearTheater && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(2, 6, 23, 0.95)', zIndex: 3000,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeInTheater 0.5s ease-out forwards', fontFamily: 'monospace'
        }}>
          {/* 金色の光背サークルリング */}
          <div style={{
            position: 'absolute', width: '280px', height: '280px',
            background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, rgba(0,0,0,0) 70%)',
            animation: 'pulseGlow 2s infinite ease-in-out'
          }}></div>

          <div style={{
            fontSize: '1.8rem', fontWeight: '900', color: '#f59e0b',
            letterSpacing: '4px', textShadow: '0 0 20px rgba(245,158,11,0.6), 0 0 40px rgba(245,158,11,0.3)',
            animation: 'scaleUpBanner 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px'
          }}>
            <span>👑 QUEST CLEAR 👑</span>
            <div style={{ width: '140px', height: '2px', background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)', marginTop: '8px' }}></div>
          </div>

          <span style={{ 
            fontSize: '0.78rem', color: '#94a3b8', marginTop: '15px', letterSpacing: '1px',
            animation: 'fadeInText 1s ease-out 0.4s both'
          }}>
            ✨ 【{currentQuestState?.name}】 完全踏破達成 ✨
          </span>

          <button 
            onClick={() => setShowQuestClearTheater(false)} // 幕を閉じて元のリザルト操作画面へ復帰
            style={{
              marginTop: '40px', padding: '10px 24px', borderRadius: '20px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#020617', border: 'none', fontWeight: '900', fontSize: '0.8rem',
              cursor: 'pointer', boxShadow: '0 4px 15px rgba(217,119,6,0.4)',
              animation: 'fadeInText 1s ease-out 0.8s both', transition: 'transform 0.1s'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            戦果を確認する 📜
          </button>

          {/* シネマ用インラインKeyframes */}
          <style>{`
            @keyframes fadeInTheater { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleUpBanner { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            @keyframes fadeInText { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes pulseGlow { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 1; } }
          `}</style>
        </div>
      )}

      {/* 🎁 戦闘終了時のみポップアップするリザルトモーダルへ総獲得Zeny・EXPのバトンを託す！ */}
      <QuestResultModal 
        isOpen={showResult} 
        userId={userId} // 👈 💡 これ！ログイン中のユーザーIDをモーダルに渡し、DBの1本釣り更新電線を結線します
        droppedItems={droppedItems} 
        accumulatedRewards={accumulatedRewards} 
        onClose={onReturn} 
      />
    </div>
  );
};

export default AdventureActive;
import React from 'react';
import { ChevronRight, ShieldCheck, Timer } from 'lucide-react';

const QuestList = ({ onSelectQuest }) => {
  // 🧪 将来的にはDB(Supabase)から取得するクエストデータ
  // 👑 三土手神特注：実戦数理シミュレーション用の「デバッグクエスト」を先頭に直撃マージ！
  const quests = [
    { 
      id: 'quest_debug_battle_test', 
      name: "🔮 創世神専用・実戦数理マスタリー検証", 
      level: 20, 
      floors: 1, 
      difficulty: "DEV",
      description: "HPが非常に高く攻撃の弱い「テストポリンJr」を相手に、魔法や特技の相性倍率、スタン・凍結などの状態異常が仕様通りに機能するかを安全に検証する戦闘実験場。",
      enemy_master_id: 'test_porin_junior'
    },
    { id: 1, name: "始まりの洞窟", level: 1, floors: 5, difficulty: "E" },
    { id: 2, name: "薄暗い森", level: 5, floors: 10, difficulty: "D" },
    { id: 3, name: "見捨てられた砦", level: 12, floors: 15, difficulty: "C" },
    { id: 4, name: "灼熱の火山", level: 25, floors: 20, difficulty: "B" },
  ];

  return (
    <div style={{ flex: 1, padding: '10px 20px', backgroundColor: '#000' }}>
      <h3 style={{ color: '#f59e0b', fontSize: '0.9rem', marginBottom: '15px', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
        挑戦するクエストを選択
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {quests.map(quest => (
          <div 
            key={quest.id}
            onClick={() => onSelectQuest(quest)}
            style={{ 
              // 💡 デバッグクエストの時だけ枠線を妖しく金色にライトアップさせる遊び心を追加
              background: '#111', 
              border: quest.id === 'quest_debug_battle_test' ? '1px dashed #f59e0b' : '1px solid #333', 
              borderRadius: '12px', 
              padding: '15px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <div>
              {/* クエスト名（デバッグ用は金色点灯） */}
              <div style={{ 
                fontSize: '1rem', 
                fontWeight: 'bold', 
                color: quest.id === 'quest_debug_battle_test' ? '#ffd700' : '#fff', 
                marginBottom: '4px' 
              }}>
                {quest.name}
              </div>
              <div style={{ display: 'flex', gap: '10px', fontSize: '0.7rem', color: '#666' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: quest.id === 'quest_debug_battle_test' ? '#ba9a6f' : '#666' }}>
                  <ShieldCheck size={12}/> 推奨Lv.{quest.level}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Timer size={12}/> {quest.floors}階層
                </span>
                {quest.id === 'quest_debug_battle_test' && (
                  <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>● 異常・倍率テスト用</span>
                )}
              </div>
            </div>
            <ChevronRight size={18} color={quest.id === 'quest_debug_battle_test' ? '#f59e0b' : '#444'} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuestList;
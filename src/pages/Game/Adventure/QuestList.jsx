import React from 'react';
import { ChevronRight, ShieldCheck, Timer } from 'lucide-react';

const QuestList = ({ onSelectQuest }) => {
  // 🧪 将来的にはDB(Supabase)から取得するクエストデータ
  const quests = [
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
              background: '#111', 
              border: '1px solid #333', 
              borderRadius: '12px', 
              padding: '15px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>{quest.name}</div>
              <div style={{ display: 'flex', gap: '10px', fontSize: '0.7rem', color: '#666' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><ShieldCheck size={12}/> 推奨Lv.{quest.level}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Timer size={12}/> {quest.floors}階層</span>
              </div>
            </div>
            <ChevronRight size={18} color="#444" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuestList;
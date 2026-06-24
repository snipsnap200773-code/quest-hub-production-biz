import React, { useState, useEffect } from 'react'; // 💡 useStateとuseEffectを追加
import { ChevronRight, ShieldCheck, Timer } from 'lucide-react';
import { supabase } from '../../../supabaseClient'; // 💡 三土手世界のSupabaseクライアントをインポート

const QuestList = ({ onSelectQuest }) => {
  // 🔮 🆕 三土手創世神専用：動的クエストState ＆ ローディング管理を配備！
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadQuestsFromDB = async () => {
      setLoading(true);
      try {
        // 📈 作成した game_master_quests から本物のデータを一撃で全件引き抜く！
        const { data: dbQuests, error } = await supabase
          .from('game_master_quests')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) throw error;

        // 💡 セーフティフォールバック：もしDBがまだ空っぽだった時のために、
        // 開発検証用のバフォメットJr初期クエストを動的にマージしておく神配線！
        const fallbackQuests = dbQuests && dbQuests.length > 0 ? dbQuests : [
          { 
            id: 'quest_cave_baphomet_fallback', 
            name: "🦇 始まりの洞窟：迷い出たバフォメットJr", 
            level: 12, 
            floors: 5, 
            difficulty: "E",
            description: "洞窟の最奥に潜む魔獣バフォメットJrを討伐するクエスト。悪魔種族、闇属性の猛攻に耐えきれるか？",
            enemy_master_id: 'baphomet_junior' 
          }
        ];

        setQuests(fallbackQuests);
      } catch (err) {
        console.error("クエストロード失敗:", err);
      } finally {
        setLoading(false);
      }
    };

    loadQuestsFromDB();
  }, []);

  // 🔮 🆕 データロード中の水際ガードを配備
  if (loading) {
    return <div style={{ color: '#f59e0b', textAlign: 'center', padding: '50px', backgroundColor: '#000', height: '100vh' }}>🗺️ クエストボード同期中...</div>;
  }

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
              border: quest.id === 'quest_cave_baphomet' ? '1px dashed #f43f5e' : '1px solid #333', 
              borderRadius: '12px', 
              padding: '15px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <div>
              <div style={{ 
                fontSize: '1rem', 
                fontWeight: 'bold', 
                color: quest.id === 'quest_cave_baphomet' ? '#ffccd5' : '#fff', 
                marginBottom: '4px' 
              }}>
                {quest.name}
              </div>
              <div style={{ display: 'flex', gap: '10px', fontSize: '0.7rem', color: '#666' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#666' }}>
                  <ShieldCheck size={12}/> 推奨Lv.{quest.level}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Timer size={12}/> {quest.floors}階層
                </span>
                {quest.id === 'quest_cave_baphomet' && (
                  <span style={{ color: '#f43f5e', fontWeight: 'bold' }}>● 悪魔/魔獣エンカウント</span>
                )}
              </div>
            </div>
            <ChevronRight size={18} color={quest.id === 'quest_cave_baphomet' ? '#f43f5e' : '#444'} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuestList;
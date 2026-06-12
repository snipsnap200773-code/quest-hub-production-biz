import React, { useState, useEffect } from 'react';
import { gameServices } from '../../../gameServices';

// テスト用の三土手さんの固定UUID
const TEST_USER_ID = "d1669717-95f4-4f80-932f-d412576d55a7";

const AdventureCharacterList = ({ onBack, onSelectCharacter }) => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);

  // Supabaseからギルドに所属する全メンバー（5人）をロード
  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      const charList = await gameServices.getPlayerCharacters(TEST_USER_ID);
      if (charList) {
        // ⭕ どんな更新があっても「IDの文字列順」で常に完全に固定整列させる！
        const sortedList = [...charList].sort((a, b) => a.id.localeCompare(b.id));
        setCharacters(sortedList);
      }
      setLoading(false);
    };
    fetchMembers();
  }, []);

  if (loading) {
    return <div style={{ color: '#f59e0b', textAlign: 'center', padding: '40px', fontSize: '0.9rem' }}>ギルドの仲間名簿を紐解いています...</div>;
  }

  return (
    <div style={{ padding: '0 20px', color: '#fff' }}>
      
      {/* 上部ヘッダー・戻るボタン */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', position: 'relative' }}>
        <button 
          onClick={onBack}
          style={{
            position: 'absolute', left: 0, padding: '6px 12px', background: '#1e293b', 
            color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', 
            cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold'
          }}
        >
          ← 戻る
        </button>
        <h2 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '1.1rem', color: '#f59e0b', fontWeight: 'bold' }}>
          👥 ギルド所属の仲間 ({characters.length}名)
        </h2>
      </div>

      {/* 🖼️ キャラクターデザイン配置枠（後ほどはめ込みするための大型ダミーエリア） */}
      <div style={{
        background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)',
        border: '1px dashed #4338ca', borderRadius: '16px', padding: '30px 20px',
        textAlign: 'center', marginBottom: '24px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🧙‍♀️🥷🛡️</div>
        <div style={{ fontSize: '0.85rem', color: '#c084fc', fontWeight: 'bold', marginBottom: '4px' }}>
          【キャラクターグラフィック表示枠】
        </div>
        <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', lineHeight: '1.4' }}>
          ※ ここに選択中のドット絵やイラストグラフィックを後ほどはめ込みます。<br />
          下のリストでタップしたキャラのデザインがここに連動する予定です。
        </p>
      </div>

      {/* 👥 三土手さん指定：横3名 × 縦未定のキャラ一覧グリッド */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)', // ⭕ 鉄壁の横3マス固定指定！
        gap: '10px',
        marginBottom: '40px'
      }}>
        {characters.map(char => (
          <div
            key={char.id}
            onClick={() => onSelectCharacter(char.id)} // 🆕 詳細ページへ進むためのフック
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '12px 8px',
              textAlign: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              transition: 'transform 0.15s, border-color 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#f59e0b';
              e.currentTarget.style.transform = 'scale(1.03)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#334155';
              e.currentTarget.style.transform = 'none';
            }}
          >
            {/* 職業ごとの簡易アイコン絵文字 */}
            <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>
              {char.meta?.job === 'シーフ' ? '🗡️' : 
               char.meta?.job === 'ソードマン' ? '🛡️' : 
               char.meta?.job === 'マジシャン' ? '🔥' : 
               char.meta?.job === 'アコライト' ? '✨' : '👊'}
            </div>

            {/* キャラクター名（「テスト」を削ってすっきり表記） */}
            <div style={{
              fontSize: '0.75rem', fontWeight: 'bold', color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px'
            }}>
              {char.custom_name.replace('テスト', '')}
            </div>

            {/* ジョブ or レベル表記 */}
            <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
              {char.meta?.job || 'ノービス'}
            </div>
            <div style={{ fontSize: '0.55rem', color: '#f59e0b', marginTop: '2px', fontFamily: 'monospace' }}>
              Lv.{char.level || 1}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default AdventureCharacterList;
import React, { useState, useEffect } from 'react';
import { Settings, Calendar, Clipboard, BarChart3, Search } from 'lucide-react';

export default function DemoAdminReservations() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 1024;

  const demoDays = Array.from({ length: 7 }).map((_, i) => new Date(2026, 6, 13 + i)); 
  
  const timeSlots = [];
  for(let h=8; h<=21; h++) {
    const hs = String(h).padStart(2, '0');
    timeSlots.push(`${hs}:00`);
    if(h !== 21) timeSlots.push(`${hs}:30`);
  }

  const initialReservations = [
    { date: '2026-07-14', start: '10:00', end: '11:00', name: '杉本', color: { bg: '#fdf2f8', line: '#f43f5e', text: '#9f1239' } },
    { date: '2026-07-14', start: '11:00', end: '12:30', name: '森', color: { bg: '#fffbeb', line: '#f59e0b', text: '#92400e' } },
    { date: '2026-07-14', start: '13:30', end: '15:00', name: '立川', color: { bg: '#faf5ff', line: '#d946ef', text: '#86198f' } },
    { date: '2026-07-15', start: '10:00', end: '11:00', name: '渡邉', color: { bg: '#fffbeb', line: '#f59e0b', text: '#92400e' } },
    { date: '2026-07-15', start: '12:00', end: '13:00', name: '大塚', color: { bg: '#fefce8', line: '#eab308', text: '#854d0e' } },
    { date: '2026-07-15', start: '14:00', end: '15:30', name: '前田', color: { bg: '#faf5ff', line: '#d946ef', text: '#86198f' } },
    { date: '2026-07-15', start: '15:00', end: '16:30', name: '幕田', color: { bg: '#faf5ff', line: '#d946ef', text: '#86198f' } },
    { date: '2026-07-16', start: '09:00', end: '10:00', name: '兵藤', color: { bg: '#ecfdf5', line: '#10b981', text: '#065f46' } },
    { date: '2026-07-16', start: '11:00', end: '12:00', name: '新倉', color: { bg: '#eff6ff', line: '#3b82f6', text: '#1d4ed8' } }, // 🟦 青に変更
    { date: '2026-07-16', start: '12:00', end: '13:00', name: '小塚', color: { bg: '#ecfeff', line: '#06b6d4', text: '#155e75' } }, // 🩵 シアンに変更
    { date: '2026-07-16', start: '15:00', end: '16:00', name: '中谷', color: { bg: '#f7fee7', line: '#84cc16', text: '#3f6212' } }, // 🍏 ライムに変更
    { date: '2026-07-16', start: '16:00', end: '17:00', name: '石橋', color: { bg: '#fef2f2', line: '#ef4444', text: '#991b1b' } },
    { date: '2026-07-16', start: '17:00', end: '18:30', name: '高橋', color: { bg: '#fefce8', line: '#eab308', text: '#854d0e' } },
    { date: '2026-07-17', start: '10:00', end: '11:00', name: '沼澤', color: { bg: '#f5f3ff', line: '#8b5cf6', text: '#4c1d95' } },
    { date: '2026-07-17', start: '11:00', end: '12:00', name: '須藤', color: { bg: '#fdf4ff', line: '#d946ef', text: '#86198f' } }, // 🌸 ピンクに変更
    { date: '2026-07-17', start: '13:00', end: '14:00', name: '柳川', color: { bg: '#f0fdf4', line: '#22c55e', text: '#14532d' } },
    { date: '2026-07-17', start: '15:30', end: '17:00', name: '佐藤', color: { bg: '#fefce8', line: '#eab308', text: '#854d0e' } },
    { date: '2026-07-18', start: '10:30', end: '11:30', name: '菊池', color: { bg: '#fffbeb', line: '#f59e0b', text: '#92400e' } },
    { date: '2026-07-18', start: '11:30', end: '12:30', name: '山本', color: { bg: '#f5f3ff', line: '#8b5cf6', text: '#4c1d95' } },
    { date: '2026-07-18', start: '15:00', end: '16:30', name: '玉ノ井', color: { bg: '#f5f3ff', line: '#8b5cf6', text: '#4c1d95' } },
    { date: '2026-07-19', start: '09:00', end: '10:00', name: '渡部', color: { bg: '#ecfeff', line: '#06b6d4', text: '#155e75' } },
    { date: '2026-07-19', start: '12:00', end: '13:00', name: '宗', color: { bg: '#fef2f2', line: '#ef4444', text: '#991b1b' } },
    { date: '2026-07-19', start: '16:00', end: '17:30', name: '沼澤', color: { bg: '#f5f3ff', line: '#8b5cf6', text: '#4c1d95' } } // 🟣 パープルに変更
  ];

  const [mockReservations, setMockReservations] = useState(initialReservations);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [targetTime, setTargetTime] = useState('');

  const getJapanDateStr = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const handleFakeBlock = () => {
    setMockReservations([...mockReservations, { 
      date: selectedDate, start: targetTime, end: '23:59',
      name: '✕', color: { bg: '#f1f5f9', line: '#cbd5e1', text: '#94a3b8' }, type: 'blocked'
    }]);
    setShowModal(false);
  };

  const getBgColor = (dStr, time) => {
    const day = new Date(dStr).getDay();
    if (day === 1) return '#f1f5f9';
    if (time === '08:00' || time === '08:30' || time >= '19:00') return '#fefce8';
    return '#fff';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#fff', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      
      {/* 🚀 ヘッダー */}
      {isPC ? (
        <div style={{ padding: '15px 25px', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button style={{ padding: '8px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}><Settings size={18} color="#64748b" /></button>
            <h1 style={{ fontSize: '1.1rem', fontWeight: '900', margin: '0 15px 0 0', color: '#1e293b' }}>Hair Salon QUEST</h1>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={{ padding: '8px 15px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff' }}>◀</button>
              <button style={{ padding: '8px 15px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 'bold' }}>今日</button>
              <button style={{ padding: '8px 15px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff' }}>▶</button>
            </div>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', marginLeft: '10px' }}>
              <button style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#fff', fontWeight: 'bold', fontSize: '0.8rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>カレンダー</button>
              <button style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#64748b', fontWeight: 'bold', fontSize: '0.8rem' }}>タイムライン</button>
            </div>
            <button style={{ padding: '8px 20px', borderRadius: '10px', border: 'none', background: '#10b981', color: '#fff', fontWeight: 'bold', marginLeft: '10px' }}>タスク</button>
            <button style={{ padding: '8px 20px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 'bold', marginLeft: '10px' }}>売上管理</button>
            <button style={{ padding: '8px 15px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#10b981', marginLeft: '10px' }}><Search size={18} /></button>
            <button style={{ padding: '8px 15px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#10b981', marginLeft: '10px' }}><Calendar size={18} /></button>
          </div>
          <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: '900', color: '#1e293b' }}>2026年 7月</h2>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
          <button style={{ padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#10b981' }}><Calendar size={20} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '1.2rem' }}>◀</span>
            <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '900', color: '#1e293b' }}>2026年 7月</h2>
            <span style={{ fontSize: '1.2rem' }}>▶</span>
          </div>
          <button style={{ padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#10b981' }}><Search size={20} /></button>
        </div>
      )}

      {/* 🚀 カレンダーグリッド本体 */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', paddingBottom: isPC ? '0' : '80px', zIndex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: isPC ? '900px' : '400px' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff' }}>
            <tr>
              <th style={{ width: isPC ? '80px' : '55px', borderBottom: '1px solid #cbd5e1' }}></th>
              {demoDays.map((date) => (
                <th key={date.getTime()} style={{ padding: '8px 0', borderBottom: '1px solid #cbd5e1' }}>
                  <div style={{ fontSize: isPC ? '110%' : '80%', color: '#64748b', fontWeight: 'bold' }}>{['日','月','火','水','木','金','土'][date.getDay()]}</div>
                  <div style={{ fontSize: isPC ? '140%' : '110%', fontWeight: '900', color: '#1e293b', marginTop: '2px' }}>{date.getDate()}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((time) => (
              <tr key={time} style={{ height: '55px' }}>
                <td style={{ borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #f1f5f9', textAlign: 'center', background: '#f8fafc' }}>
                  <span style={{ fontSize: isPC ? '120%' : '90%', color: '#64748b', fontWeight: '900' }}>{time}</span>
                </td>
                {demoDays.map((date, i) => {
                  const dStr = getJapanDateStr(date);
                  const isMonday = date.getDay() === 1;
                  
                  const activeRes = mockReservations.find(r => time >= r.start && time < r.end && r.date === dStr);
                  const isStart = activeRes && activeRes.start === time;

                  return (
                    <td 
                      key={dStr} 
                      onClick={() => {
                        if (!activeRes && !isMonday) {
                          setSelectedDate(dStr); setTargetTime(time); setShowModal(true);
                        } else if (activeRes) {
                          alert(`✨【デモ画面】実際のアプリでは「${activeRes.name} 様」の詳細カルテが開きます！`);
                        }
                      }}
                      style={{ 
                        borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', 
                        background: getBgColor(dStr, time), position: 'relative', cursor: isMonday ? 'default' : 'pointer',
                        textAlign: 'center', verticalAlign: 'middle'
                      }}
                    >
                      {/* 💡 背景テキストの表示（定休日） */}
                      {!activeRes && isMonday && time === '13:00' && (
                         <span style={{ fontSize: isPC ? '1.5rem' : '1.1rem', color: '#cbd5e1', fontWeight: '900', writingMode: isPC ? 'horizontal-tb' : 'vertical-rl' }}>定休日</span>
                      )}

                      {/* 💡 横断スタンプの表示（朝と夜のプライベート枠） */}
                      {/* 月曜日の列（i===0）を起点として、右方向に1000%（7日分）の幅を持たせた絶対配置の透明レイヤーを敷く */}
                      {i === 0 && time === '08:00' && (
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '700%', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 4 }}>
                          <span style={{ fontSize: isPC ? '1.8rem' : '1.3rem', color: '#d97706', opacity: 0.15, fontWeight: '900', letterSpacing: '0.8em', paddingLeft: '0.8em' }}>プライベート枠</span>
                        </div>
                      )}
                      {i === 0 && time === '19:00' && (
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '700%', height: '275px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 4 }}>
                          <span style={{ fontSize: isPC ? '1.8rem' : '1.3rem', color: '#d97706', opacity: 0.15, fontWeight: '900', letterSpacing: '0.8em', paddingLeft: '0.8em' }}>プライベート枠</span>
                        </div>
                      )}

                      {/* 予約ブロックの表示 */}
                      {activeRes && (
                        <div style={{ 
                          position: 'absolute', inset: 0, background: activeRes.color.bg, zIndex: 5,
                          borderLeft: `3px solid ${activeRes.color.line}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                        }}>
                          {isStart && (
                            <div style={{ 
                              color: activeRes.color.text, 
                              fontWeight: '600',
                              // 🚀 fontSize を本物と同じくらい大きくしました（PC: 1.15rem, スマホ: 1.05rem）
                              fontSize: isPC ? '1.15rem' : '1.05rem',
                              writingMode: isPC ? 'horizontal-tb' : 'vertical-rl',
                              letterSpacing: isPC ? '0.05em' : '0'
                            }}>
                              {activeRes.type === 'blocked' ? activeRes.name : `${activeRes.name}${isPC ? ' 様' : ''}`}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🚀 スマホ用ボトムナビゲーション */}
      {!isPC && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '75px', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 9999 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8', gap: '4px' }}>
            <Settings size={22} /><span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>設定</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8', gap: '4px' }}>
            <Clipboard size={22} /><span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>タスク</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#10b981', borderRadius: '20px', padding: '8px 20px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '900' }}>今日</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8', gap: '4px' }}>
            <BarChart3 size={22} /><span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>管理</span>
          </div>
        </div>
      )}

      {/* 🚀 画像に忠実な操作メニューポップアップ */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', padding: '30px', borderRadius: '24px', width: '85%', maxWidth: '340px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold', marginBottom: '5px' }}>
              {selectedDate.replace(/-/g, '/')}
            </div>
            <div style={{ fontWeight: '900', color: '#0f766e', fontSize: '2.5rem', marginBottom: '25px', lineHeight: '1' }}>
              {targetTime}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* メインの緑ボタン */}
              <button onClick={() => { alert('✨【デモ】ここから予約入力フォームが開きます！'); setShowModal(false); }} style={{ padding: '16px', background: '#115e59', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 'bold', fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(17,94,89,0.3)' }}>
                予約を入れる
              </button>
              
              {/* プライベート予定（白ボタン） */}
              <button onClick={() => { alert('✨【デモ】プライベート予定を追加します'); setShowModal(false); }} style={{ padding: '14px', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '14px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                ☕ プライベート予定
              </button>
              
              {/* 2分割ボタン */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button onClick={handleFakeBlock} style={{ padding: '14px', background: '#fff', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '14px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}>
                  ✕ (枠を閉じる)
                </button>
                <button onClick={() => { alert('✨【デモ】今日を休みにします'); setShowModal(false); }} style={{ padding: '14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(239,68,68,0.3)' }}>
                  今日を休みにする
                </button>
              </div>

              {/* キャンセル */}
              <button onClick={() => setShowModal(false)} style={{ padding: '10px', background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
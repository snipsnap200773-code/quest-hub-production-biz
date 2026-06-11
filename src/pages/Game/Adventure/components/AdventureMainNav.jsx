import React from 'react';
import { Home, Users, Swords, BookOpen, Settings } from 'lucide-react';

const AdventureMainNav = ({ currentView, onViewChange }) => {
  const navItems = [
    { id: 'tavern', label: '酒場', icon: <Home size={20} /> },
    { id: 'formation', label: '編成', icon: <Users size={20} /> },
    { id: 'explore', label: '探索', icon: <Swords size={20} /> },
    { id: 'encyclopedia', label: '事典', icon: <BookOpen size={20} /> },
    { id: 'settings', label: '設定', icon: <Settings size={20} /> },
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,       /* 🆕 左端基準を設定 */
      right: 0,      /* 🆕 右端基準を設定 */
      margin: '0 auto', /* 🆕 スマホサイズ(480px)の中央に完全に合わせる */
      width: '100%',
      maxWidth: '480px',
      height: '65px',
      background: '#111',
      borderTop: '2px solid #f59e0b',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      zIndex: 100
    }}>
      {navItems.map(item => {
        const isActive = currentView === item.id;
        return (
          <div 
            key={item.id}
            onClick={() => onViewChange(item.id)}
            style={{ 
              textAlign: 'center', 
              color: isActive ? '#f59e0b' : '#777', 
              cursor: 'pointer',
              flex: 1,
              padding: '8px 0',
              transition: 'color 0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2px' }}>
              {item.icon}
            </div>
            <div style={{ fontSize: '0.6rem', fontWeight: 'bold' }}>{item.label}</div>
          </div>
        );
      })}
    </div>
  );
};

export default AdventureMainNav;
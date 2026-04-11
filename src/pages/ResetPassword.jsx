import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // 🆕 パスワード表示/非表示の管理
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    
    // バリデーション
    if (newPassword.length < 8) {
      alert("セキュリティのため、パスワードは8文字以上で入力してください。");
      return;
    }
    
    setLoading(true);
    try {
      // 🚀 Supabaseのポイント：
      // メールのリンクからこのページに来た時点で、ブラウザには一時的な「書き換え許可」が与えられています。
      const { error } = await supabase.auth.updateUser({ 
        password: newPassword 
      });

      if (error) throw error;

      alert("パスワードの更新が完了しました！新しいパスワードでログインしてください。");
      navigate('/'); // ログイン画面（Home）へ戻す
    } catch (err) {
      alert("エラーが発生しました: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      padding: '60px 20px', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f4f7f9'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '400px',
        background: '#fff', 
        padding: '40px 30px', 
        borderRadius: '32px', 
        boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
        position: 'relative'
      }}>
        {/* 戻るボタン */}
        <button 
          onClick={() => navigate('/')}
          style={{ position: 'absolute', top: '24px', left: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
        >
          <ArrowLeft size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '64px', height: '64px', background: '#e0f2fe', color: '#07aadb', 
            borderRadius: '20px', display: 'flex', alignItems: 'center', 
            justifyContent: 'center', margin: '0 auto 20px' 
          }}>
            <KeyRound size={32} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#1e293b', margin: '0 0 10px' }}>
            パスワード再設定
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.6' }}>
            新しいパスワードを入力して、<br />アカウントの復旧を完了しましょう。
          </p>
        </div>

        <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', marginLeft: '4px' }}>
              新しいパスワード
            </label>
            {/* 🆕 入力欄をrelativeのdivで囲む */}
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} // 🚀 ステートで切り替え
                placeholder="8文字以上の英数字" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                style={{ 
                  width: '100%', padding: '16px 50px 16px 16px', // 🚀 右側に余白
                  borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '1rem', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#07aadb'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                required 
                autoFocus
              />
              {/* 🆕 目のマークボタン */}
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                style={{ position: 'absolute', top: '50%', right: '15px', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
              </button>
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', padding: '18px', borderRadius: '18px', 
              background: loading ? '#94a3b8' : '#0f172a', color: '#fff', 
              border: 'none', fontWeight: 'bold', fontSize: '1.05rem', 
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              transition: 'all 0.2s',
              boxShadow: '0 10px 15px -3px rgba(15,23,42,0.2)'
            }}
          >
            <ShieldCheck size={22} />
            {loading ? '更新しています...' : 'パスワードを確定する'}
          </button>
        </form>
      </div>

      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '1px' }}>
          QUEST HUB SECURE GATEWAY
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
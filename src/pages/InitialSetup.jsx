import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { User, AtSign, CheckCircle, AlertCircle } from 'lucide-react';

function InitialSetup() {
  const navigate = useNavigate(); // バグ2解決済み
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [displayName, setDisplayName] = useState('');
  const [displayId, setDisplayId] = useState('');
  const [idError, setIdError] = useState('');

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          navigate('/');
          return;
        }

        // Google等から取得できる初期名をセット
        const metadata = session.user.user_metadata;
        setDisplayName(metadata?.full_name || '');
        
        // すでに設定済みかチェック（ここでカラムがないとエラーになる可能性あり）
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('display_id')
          .eq('id', session.user.id)
          .maybeSingle(); // single()よりmaybeSingle()の方が、データがない場合にエラーを吐かないので安全

        if (profile?.display_id) {
          navigate('/'); // 設定済みならトップへ
          return;
        }
      } catch (err) {
        console.error("初期チェック中に予期せぬエラー:", err);
        // ドミノ倒し防止：エラーが起きてもローディングを解除し、ユーザーが操作できるようにする
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, [navigate]);

  // IDの形式・重複チェック
  const validateId = async (id) => {
    if (!id) return false;
    if (!/^[a-zA-Z0-9_]{3,15}$/.test(id)) {
      setIdError('3〜15文字の半角英数字とアンダースコアのみ使用可能です');
      return false;
    }
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_id')
        .eq('display_id', id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setIdError('このIDは既に使用されています');
        return false;
      }

      setIdError('');
      return true;
    } catch (err) {
      console.error("ID重複チェックエラー:", err);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const isValid = await validateId(displayId);
      if (!isValid) {
        setSaving(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        display_name: displayName,
        display_id: displayId,
        updated_at: new Date().toISOString() // ISO形式がより確実
      });

      if (error) throw error;

      alert('SOLOへようこそ！設定が完了しました。');
      navigate('/');
    } catch (error) {
      alert('保存に失敗しました: ' + (error.message || '接続エラー'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '100px' }}>読み込み中...</div>;

  return (
    <div style={{ maxWidth: '450px', margin: '60px auto', padding: '30px', background: '#fff', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
      {/* フォーム内容は三土手さんの元のコードを継承 */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#1e293b' }}>ようこそ SOLO へ！</h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>あなた専用のIDとプロフィールを設定しましょう</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <User size={16} /> 表示名
          </label>
          <input 
            type="text" 
            value={displayName} 
            onChange={(e) => setDisplayName(e.target.value)} 
            placeholder="例：三土手 大造"
            style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem', boxSizing: 'border-box' }}
            required
          />
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <AtSign size={16} /> ユーザーID（設定後変更不可）
          </label>
          <input 
            type="text" 
            value={displayId} 
            onChange={(e) => setDisplayId(e.target.value.toLowerCase())} 
            onBlur={(e) => validateId(e.target.value)}
            placeholder="例：mitote_01"
            style={{ width: '100%', padding: '12px', borderRadius: '12px', border: idError ? '1px solid #ef4444' : '1px solid #e2e8f0', fontSize: '1rem', boxSizing: 'border-box' }}
            required
          />
          {idError && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12} /> {idError}</p>}
          {!idError && displayId && <p style={{ color: '#10b981', fontSize: '0.75rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> このIDは使用可能です</p>}
        </div>

        <button 
          type="submit" 
          disabled={saving || !!idError || !displayId}
          style={{ background: '#07aadb', color: '#fff', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem', cursor: (saving || !!idError || !displayId) ? 'not-allowed' : 'pointer', marginTop: '10px', opacity: (saving || !!idError || !displayId) ? 0.6 : 1 }}
        >
          {saving ? '保存中...' : '設定を完了して始める'}
        </button>
      </form>
    </div>
  );
}

export default InitialSetup;
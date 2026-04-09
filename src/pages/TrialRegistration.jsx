import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
// ✅ 成功している予約画面に合わせて supabaseAnon を追加
import { supabase, supabaseAnon } from '../supabaseClient';

function TrialRegistration() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🆕 ページ表示時に最上部へスクロールさせる処理を追加
  useEffect(() => {
    const scrollTimer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 100);
    return () => clearTimeout(scrollTimer);
  }, []);

  const [formData, setFormData] = useState({
    ownerName: '',
    ownerNameKana: '',
    shopName: '',
    shopNameKana: '',
    businessType: '',
    email: '',
    phone: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password.length < 8) {
      return alert('パスワードは8文字以上で設定してください');
    }

    setIsSubmitting(true);

    try {
      // 1. profilesテーブルに新規店舗を登録
      const { data, error } = await supabase
        .from('profiles')
        .insert([{
          owner_name: formData.ownerName,
          owner_name_kana: formData.ownerNameKana,
          business_name: formData.shopName,
          business_name_kana: formData.shopNameKana,
          business_type: formData.businessType,
          email_contact: formData.email,
          phone: formData.phone,
          admin_password: formData.password,
          is_suspended: false,
          notify_line_enabled: true,
          slot_interval_min: 15
        }])
        .select()
        .single();

      if (error) throw error;

      // 💡 2. 司令塔（index.ts）を呼び出して歓迎メールを送信
      const baseUrl = window.location.origin;
      // ✅ 成功実績のある supabaseAnon.functions.invoke に変更
      await supabaseAnon.functions.invoke('send-reservation-email', {
        body: {
          type: 'welcome',
          shopName: formData.shopName,
          owner_email: formData.email,
          // 🆕 以下の3つを足すことで、index.ts側が「三土手さんへの通知メール」を正しく作成できるようになります
          ownerName: formData.ownerName,
          phone: formData.phone,
          businessType: formData.businessType,
          // --------------------------------------------------
          dashboard_url: `${baseUrl}/admin/${data.id}`,
          reservations_url: `${baseUrl}/admin/${data.id}/reservations`,
          reserve_url: `${baseUrl}/shop/${data.id}/reserve`,
          password: formData.password
        }
      });

      alert(`おめでとうございます！「${formData.shopName}」の登録が完了し、メールを送信しました。`);

      // 管理画面へ直接案内
      navigate(`/admin/${data.id}`);

    } catch (err) {
      console.error(err);
      alert('登録に失敗しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f4f7f9', minHeight: '100vh', padding: '40px 20px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', background: '#fff', padding: '30px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: '#2563eb', fontSize: '1.8rem', fontWeight: '900', margin: '0 0 10px 0' }}>SOLO</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 'bold' }}>🚀 ベータ版申し込み</p>
        </div>

        <div style={{ background: '#f0fdf4', padding: '15px', borderRadius: '12px', border: '1px solid #bbf7d0', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <span style={{ fontSize: '1.2rem' }}>💬</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#166534' }}>公式LINEとの連携について</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#15803d', lineHeight: '1.5' }}>
            新着予約をLINEで受け取るための連携設定は、<b>登録後の「店舗設定画面」にていつでも簡単に行えます。</b>まずは店舗情報の登録を完了させましょう！
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <section>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', display: 'block', marginBottom: '8px' }}>👤 代表者様情報</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input name="ownerName" placeholder="氏名" onChange={handleChange} required style={inputStyle} />
              <input name="ownerNameKana" placeholder="ふりがな" onChange={handleChange} required style={inputStyle} />
            </div>
          </section>

          <section>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', display: 'block', marginBottom: '8px' }}>🏪 店舗情報</label>
            <input name="shopName" placeholder="店舗名" onChange={handleChange} required style={{ ...inputStyle, marginBottom: '10px' }} />
            <input name="shopNameKana" placeholder="店舗名のふりがな" onChange={handleChange} required style={{ ...inputStyle, marginBottom: '10px' }} />
            <select name="businessType" onChange={handleChange} required style={{ ...inputStyle, appearance: 'none' }}>
              <option value="">-- 業種を選択してください --</option>
              <option value="美容室・理容室">美容室・理容室</option>
              <option value="ネイル・アイラッシュ">ネイル・アイラッシュ</option>
              <option value="エステ・リラク">エステ・リラク</option>
              <option value="整体・接骨院・針灸">整体・接骨院・針灸</option>
              <option value="飲食店・カフェ">飲食店・カフェ</option>
              <option value="その他・ライフ">その他・ライフ</option>
            </select>
          </section>

          <section>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', display: 'block', marginBottom: '8px' }}>📞 連絡先・ログイン設定</label>
            <input type="email" name="email" placeholder="メールアドレス" onChange={handleChange} required style={{ ...inputStyle, marginBottom: '10px' }} />
            <input type="tel" name="phone" placeholder="電話番号" onChange={handleChange} required style={{ ...inputStyle, marginBottom: '10px' }} />
            <div style={{ background: '#fef3c7', padding: '15px', borderRadius: '12px', border: '1px solid #fcd34d' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#92400e' }}>🔑 管理画面パスワード設定</label>
              <input 
                type="password" 
                name="password" 
                placeholder="8文字以上で設定" 
                onChange={handleChange} 
                required 
                minLength="8" 
                style={{ ...inputStyle, marginTop: '5px', border: '1px solid #f59e0b' }} 
              />
              <p style={{ fontSize: '0.65rem', color: '#b45309', marginTop: '5px', margin: 0 }}>※管理画面へのログイン時に使用します。忘れないよう控えてください。</p>
            </div>
          </section>

          <button type="submit" disabled={isSubmitting} style={{ ...buttonStyle, background: isSubmitting ? '#94a3b8' : '#2563eb' }}>
            {isSubmitting ? '登録処理中...' : '無料で利用を開始する 🚀'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link to="/" style={{ fontSize: '0.8rem', color: '#64748b', textDecoration: 'none' }}>ポータルサイトへ戻る</Link>
        </div>
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' };
const buttonStyle = { marginTop: '10px', padding: '18px', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' };

export default TrialRegistration;
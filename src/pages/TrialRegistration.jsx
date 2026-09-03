import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, supabaseAnon } from '../supabaseClient';

/**
 * QUEST HUB ベータ版 登録フォーム
 *
 * ▼ 主な変更点（旧 TrialRegistration.jsx からの差分）
 *  - 見出しを「SOLO」→「QUEST HUB」に修正
 *  - 利用規約・プライバシーポリシーへの同意チェックを追加
 *  - alert() をやめて画面内にエラー／完了を表示
 *  - メールアドレス重複時のメッセージを個別に表示
 *  - 送信直前に一度だけ動くよう二重送信をガード
 *  - LINEサポート窓口への導線を追加
 *
 * ▼ TODO
 *  - LINE友だち追加URL（LINE_SUPPORT_URL）を差し替え
 *  - admin_password の平文保存をハッシュ化 or Supabase Auth へ移行
 *  - profiles.email_contact に UNIQUE 制約を付けると重複検知が確実になります
 */

// TODO: 発行済みのLINE友だち追加URLに差し替えてください
const LINE_SUPPORT_URL = 'https://lin.ee/XXXXXXX';

const BUSINESS_TYPES = [
  '美容室・理容室',
  'ネイル・アイラッシュ',
  'エステ・リラク',
  '整体・接骨院・鍼灸',
  '訪問美容・出張サービス',
  '飲食店・カフェ',
  'スクール・教室',
  'その他・ライフ',
];

function TrialRegistration() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const [formData, setFormData] = useState({
    ownerName: '',
    ownerNameKana: '',
    shopName: '',
    shopNameKana: '',
    businessType: '',
    email: '',
    phone: '',
    password: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errorMsg) setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (formData.password.length < 8) {
      setErrorMsg('パスワードは8文字以上で設定してください。');
      return;
    }
    if (!agreed) {
      setErrorMsg('利用規約とプライバシーポリシーへの同意が必要です。');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([{
          owner_name: formData.ownerName.trim(),
          owner_name_kana: formData.ownerNameKana.trim(),
          business_name: formData.shopName.trim(),
          business_name_kana: formData.shopNameKana.trim(),
          business_type: formData.businessType,
          email_contact: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          admin_password: formData.password,
          is_suspended: false,
          notify_line_enabled: true,
          slot_interval_min: 15,
        }])
        .select()
        .single();

      if (error) {
        // 23505 = unique_violation（email_contact に UNIQUE 制約がある場合）
        if (error.code === '23505') {
          setErrorMsg('このメールアドレスはすでに登録されています。ログイン画面からお進みください。');
          setIsSubmitting(false);
          return;
        }
        throw error;
      }

      const baseUrl = window.location.origin;

      // メール送信が失敗しても、アカウント自体は発行済みなので登録は成功扱いにする
      try {
        await supabaseAnon.functions.invoke('send-reservation-email', {
          body: {
            type: 'welcome',
            shopName: formData.shopName,
            owner_email: formData.email,
            ownerName: formData.ownerName,
            phone: formData.phone,
            businessType: formData.businessType,
            dashboard_url: `${baseUrl}/admin/${data.id}`,
            reservations_url: `${baseUrl}/admin/${data.id}/reservations`,
            reserve_url: `${baseUrl}/shop/${data.id}/reserve`,
            password: formData.password,
          },
        });
      } catch (mailErr) {
        console.error('ウェルカムメールの送信に失敗しました', mailErr);
      }

      navigate(`/admin/${data.id}`);
    } catch (err) {
      console.error(err);
      setErrorMsg('登録に失敗しました。時間をおいて再度お試しください。解決しない場合はLINEサポートまでご連絡ください。');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>

        <div style={{ textAlign: 'center', marginBottom: '26px' }}>
          <div style={badgeStyle}>ベータ版テスター募集中</div>
          <h1 style={{ color: '#1e3a8a', fontSize: '1.7rem', fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.03em' }}>
            QUEST HUB
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0 }}>
            登録すると、その場で管理画面が使えるようになります。
          </p>
        </div>

        <div style={noticeStyle}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#166534', fontSize: '0.88rem' }}>
            ベータ期間中は全機能が無料です
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#15803d', lineHeight: 1.7 }}>
            まずは店舗情報の登録だけ済ませてください。営業時間・メニュー・LINE連携などの設定は、
            登録後の管理画面からいつでも行えます。
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

          <section>
            <label style={labelStyle}>代表者さまのお名前</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input name="ownerName" placeholder="氏名" value={formData.ownerName} onChange={handleChange} required autoComplete="name" style={inputStyle} />
              <input name="ownerNameKana" placeholder="ふりがな" value={formData.ownerNameKana} onChange={handleChange} required style={inputStyle} />
            </div>
          </section>

          <section>
            <label style={labelStyle}>店舗情報</label>
            <input name="shopName" placeholder="店舗名" value={formData.shopName} onChange={handleChange} required style={{ ...inputStyle, marginBottom: '10px' }} />
            <input name="shopNameKana" placeholder="店舗名のふりがな" value={formData.shopNameKana} onChange={handleChange} required style={{ ...inputStyle, marginBottom: '10px' }} />
            <select name="businessType" value={formData.businessType} onChange={handleChange} required style={{ ...inputStyle, appearance: 'none', background: '#fff' }}>
              <option value="">業種を選択してください</option>
              {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </section>

          <section>
            <label style={labelStyle}>連絡先とログイン設定</label>
            <input type="email" name="email" placeholder="メールアドレス" value={formData.email} onChange={handleChange} required autoComplete="email" style={{ ...inputStyle, marginBottom: '10px' }} />
            <input type="tel" name="phone" placeholder="電話番号" value={formData.phone} onChange={handleChange} required autoComplete="tel" style={{ ...inputStyle, marginBottom: '14px' }} />

            <div style={passwordBoxStyle}>
              <label htmlFor="qh-password" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e', display: 'block', marginBottom: '6px' }}>
                管理画面のパスワード
              </label>
              <input
                id="qh-password"
                type="password"
                name="password"
                placeholder="8文字以上"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={8}
                autoComplete="new-password"
                style={{ ...inputStyle, border: '1px solid #f59e0b' }}
              />
              <p style={{ fontSize: '0.72rem', color: '#b45309', margin: '7px 0 0', lineHeight: 1.6 }}>
                管理画面へのログインに使います。控えを残しておいてください。
              </p>
            </div>
          </section>

          <label style={agreeStyle}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => { setAgreed(e.target.checked); if (errorMsg) setErrorMsg(''); }}
              style={{ width: '18px', height: '18px', marginTop: '2px', flexShrink: 0, cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.7 }}>
              <Link to="/terms" target="_blank" style={linkStyle}>利用規約</Link>
              {' と '}
              <Link to="/privacy" target="_blank" style={linkStyle}>プライバシーポリシー</Link>
              {' に同意します'}
            </span>
          </label>

          {errorMsg && (
            <div role="alert" style={errorStyle}>{errorMsg}</div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              ...buttonStyle,
              background: isSubmitting ? '#94a3b8' : '#2563eb',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmitting ? '登録しています…' : '無料ではじめる'}
          </button>
        </form>

        <div style={{ marginTop: '26px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 12px', lineHeight: 1.7 }}>
            登録で迷ったら、LINEからお気軽にご相談ください。
          </p>
          <a href={LINE_SUPPORT_URL} target="_blank" rel="noopener noreferrer" style={lineButtonStyle}>
            LINEでサポートに相談する
          </a>
          <div style={{ marginTop: '18px' }}>
            <Link to="/" style={{ fontSize: '0.8rem', color: '#94a3b8', textDecoration: 'none' }}>
              トップページに戻る
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

// --- Styles ---
const pageStyle = {
  backgroundColor: '#f1f5f9',
  minHeight: '100vh',
  padding: '40px 20px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif',
};
const cardStyle = {
  maxWidth: '520px', margin: '0 auto', background: '#fff',
  padding: '32px 28px', borderRadius: '18px',
  boxShadow: '0 10px 30px rgba(15,23,42,0.07)',
};
const badgeStyle = {
  display: 'inline-block', background: '#eff6ff', color: '#2563eb',
  fontSize: '0.76rem', fontWeight: 700, padding: '5px 14px',
  borderRadius: '999px', marginBottom: '14px',
};
const noticeStyle = {
  background: '#f0fdf4', padding: '16px 18px', borderRadius: '12px',
  border: '1px solid #bbf7d0', marginBottom: '26px',
};
const labelStyle = {
  fontSize: '0.86rem', fontWeight: 700, color: '#1e293b',
  display: 'block', marginBottom: '9px',
};
const inputStyle = {
  width: '100%', padding: '13px', borderRadius: '10px',
  border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box',
  fontFamily: 'inherit', color: '#0f172a',
};
const passwordBoxStyle = {
  background: '#fffbeb', padding: '16px', borderRadius: '12px', border: '1px solid #fcd34d',
};
const agreeStyle = {
  display: 'flex', gap: '11px', alignItems: 'flex-start',
  background: '#f8fafc', padding: '15px 16px', borderRadius: '10px',
  border: '1px solid #e2e8f0', cursor: 'pointer',
};
const linkStyle = { color: '#2563eb', fontWeight: 600 };
const errorStyle = {
  background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
  padding: '13px 16px', borderRadius: '10px', fontSize: '0.86rem', lineHeight: 1.7,
};
const buttonStyle = {
  padding: '17px', color: '#fff', border: 'none', borderRadius: '12px',
  fontWeight: 700, fontSize: '1.05rem',
  boxShadow: '0 6px 16px rgba(37, 99, 235, 0.28)',
  fontFamily: 'inherit',
};
const lineButtonStyle = {
  display: 'inline-block', background: '#06C755', color: '#fff',
  padding: '12px 26px', borderRadius: '10px', fontSize: '0.9rem',
  fontWeight: 700, textDecoration: 'none',
};

export default TrialRegistration;

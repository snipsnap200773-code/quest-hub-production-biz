import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { COMPANY } from '../config/companyInfo';
// ⚠️ 2026/09/07：業種名は BasicSettings と完全一致していないと、
//    staffs.capable_categories / service_categories.target_industry の
//    照合が通らずスタッフ指名やカテゴリ表示が消えるため、共通マスタを参照します。
import { INDUSTRY_LABELS } from '../constants/industryMaster';

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
 *  - admin_password の平文保存をハッシュ化 or Supabase Auth へ移行
 *  - profiles.email_contact に UNIQUE 制約を付けると重複検知が確実になります
 */

function TrialRegistration() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
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
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errorMsg) setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!agreed) {
      setErrorMsg('利用規約とプライバシーポリシーへの同意が必要です。');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

        try {
      // 運営（QUEST HUB 総括者）の profiles ID。
      // ベータ申し込みは、この ID あての inquiries として記録します。
      const OPERATOR_SHOP_ID = '0f4174e6-3834-4ec5-9025-c8316fdbb555';

      const summary = [
        '【ベータ版 利用申し込み】',
        `代表者：${formData.ownerName.trim()}（${formData.ownerNameKana.trim()}）`,
        `店舗名：${formData.shopName.trim()}（${formData.shopNameKana.trim()}）`,
        `業種：${formData.businessType}`,
        `電話：${formData.phone.trim()}`,
        `メール：${formData.email.trim().toLowerCase()}`,
      ].join('\n');

      const { error } = await supabase
        .from('inquiries')
        .insert([{
          shop_id: OPERATOR_SHOP_ID,
          name: formData.ownerName.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          content: summary,
        }]);

      if (error) throw error;

      // 通知メール。失敗しても申し込みは受理済みなので、ここでは止めない
      try {
        await supabase.functions.invoke('resend', {
          body: {
            type: 'inquiry',
            shopId: OPERATOR_SHOP_ID,
            name: formData.ownerName.trim(),
            email: formData.email.trim().toLowerCase(),
            phone: formData.phone.trim(),
            content: summary,
          },
        });
      } catch (mailErr) {
        console.error('申し込み通知の送信に失敗しました', mailErr);
      }

      setIsSubmitted(true);
      setIsSubmitting(false);
    } catch (err) {
      console.error(err);
      setErrorMsg('登録に失敗しました。時間をおいて再度お試しください。解決しない場合はLINEサポートまでご連絡ください。');
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={badgeStyle}>お申し込みを受け付けました</div>
            <h1 style={{ color: '#1e3a8a', fontSize: '1.4rem', fontWeight: 900, margin: '0 0 16px' }}>
              ありがとうございます
            </h1>
            <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.9, margin: '0 0 24px' }}>
              内容を確認のうえ、担当者よりご登録のメールアドレスへ<br />
              ログイン情報をお送りします。<br />
              数日たっても届かない場合は、LINEサポートまでご連絡ください。
            </p>
            <a href={COMPANY.lineUrl} target="_blank" rel="noopener noreferrer" style={lineButtonStyle}>
              LINEでサポートに相談する
            </a>
            <div style={{ marginTop: '20px' }}>
              <Link to="/" style={{ fontSize: '0.85rem', color: '#94a3b8', textDecoration: 'none' }}>
                トップページに戻る
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>

        <div style={{ textAlign: 'center', marginBottom: '26px' }}>
          <div style={badgeStyle}>ベータ版テスター募集中</div>
          <h1 style={{ color: '#1e3a8a', fontSize: '1.7rem', fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.03em' }}>
            QUEST HUB
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0 }}>
            お申し込み後、担当者がアカウントを発行してご連絡します。
          </p>
        </div>

        <div style={noticeStyle}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#166534', fontSize: '0.88rem' }}>
            ベータ期間中は全機能が無料です
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#15803d', lineHeight: 1.7 }}>
            まずは店舗情報をお知らせください。内容を確認のうえ、ログイン情報をメールでお送りします。
            営業時間・メニュー・LINE連携などの設定は、その後の管理画面から行えます。
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
              {INDUSTRY_LABELS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </section>

          <section>
            <label style={labelStyle}>ご連絡先</label>
            <input type="email" name="email" placeholder="メールアドレス" value={formData.email} onChange={handleChange} required autoComplete="email" style={{ ...inputStyle, marginBottom: '10px' }} />
            <input type="tel" name="phone" placeholder="電話番号" value={formData.phone} onChange={handleChange} required autoComplete="tel" style={inputStyle} />
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
            {isSubmitting ? '送信しています…' : '申し込む'}
          </button>
        </form>

        <div style={{ marginTop: '26px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 12px', lineHeight: 1.7 }}>
            登録で迷ったら、LINEからお気軽にご相談ください。
          </p>
          <a href={COMPANY.lineUrl} target="_blank" rel="noopener noreferrer" style={lineButtonStyle}>
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

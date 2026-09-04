import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { COMPANY } from '../../config/companyInfo';

/**
 * お問い合わせ　src/pages/legal/Contact.jsx
 *
 * ★ 連絡先の変更は src/config/companyInfo.js を編集してください。
 */
function Contact() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>

        <Link to="/biz" style={{ fontSize: '.85rem', color: '#64748b', textDecoration: 'none' }}>
          ← QUEST HUB トップへ
        </Link>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '18px 0 10px', letterSpacing: '-0.02em' }}>
          お問い合わせ
        </h1>
        <p style={{ color: '#64748b', fontSize: '.95rem', lineHeight: 1.9, margin: '0 0 34px' }}>
          使い方のご質問、不具合のご報告、機能のご要望など、どんな内容でもお気軽にご連絡ください。
        </p>

        {/* --- LINE --- */}
        <div style={{ ...boxStyle, borderColor: '#06C755', background: '#f0fdf4' }}>
          <h2 style={boxTitleStyle}>LINEで相談する</h2>
          <p style={boxTextStyle}>
            いちばん早くお返事できる窓口です。友だち追加後、そのままトーク画面にメッセージを送ってください。
            画面のスクリーンショットを添えていただけると、状況が早く把握できます。
          </p>
          <a href={COMPANY.lineUrl} target="_blank" rel="noopener noreferrer" style={lineButtonStyle}>
            LINEで友だち追加する
          </a>
          <p style={noteStyle}>
            受付時間：{COMPANY.supportHours}（時間外のご連絡も、翌営業日にご返信します）
          </p>
        </div>

        {/* --- メール --- */}
        <div style={boxStyle}>
          <h2 style={boxTitleStyle}>メールで問い合わせる</h2>
          <p style={boxTextStyle}>
            LINEをお使いでない場合は、こちらへご連絡ください。
            店舗名とご登録のメールアドレスを添えていただけると、確認がスムーズです。
          </p>
          <a href={`mailto:${COMPANY.email}`} style={mailButtonStyle}>
            {COMPANY.email}
          </a>
          <p style={noteStyle}>2営業日以内にご返信します。</p>
        </div>

        {/* --- 緊急時 --- */}
        <div style={{ ...boxStyle, background: '#fffbeb', borderColor: '#fcd34d' }}>
          <h2 style={{ ...boxTitleStyle, color: '#92400e' }}>予約が受け付けられない等の緊急時</h2>
          <p style={{ ...boxTextStyle, color: '#b45309', marginBottom: 0 }}>
            営業に支障が出ている場合は、LINEのメッセージ冒頭に「至急」とご記入ください。
            優先して対応します。
          </p>
        </div>

        <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '10px 22px', fontSize: '.85rem' }}>
          <Link to="/terms" style={{ color: '#64748b', textDecoration: 'none' }}>利用規約</Link>
          <Link to="/privacy" style={{ color: '#64748b', textDecoration: 'none' }}>プライバシーポリシー</Link>
          <Link to="/legal" style={{ color: '#64748b', textDecoration: 'none' }}>特定商取引法に基づく表記</Link>
        </div>

      </div>
    </div>
  );
}

const pageStyle = {
  backgroundColor: '#f1f5f9',
  minHeight: '100vh',
  padding: '40px 20px 80px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif',
};
const cardStyle = {
  maxWidth: '640px', margin: '0 auto', background: '#fff',
  padding: '36px 30px', borderRadius: '16px',
  boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
};
const boxStyle = {
  border: '2px solid #e2e8f0', borderRadius: '14px',
  padding: '24px 22px', marginBottom: '18px', background: '#fff',
};
const boxTitleStyle = {
  fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px',
};
const boxTextStyle = {
  fontSize: '.92rem', color: '#475569', lineHeight: 1.9, margin: '0 0 18px',
};
const lineButtonStyle = {
  display: 'inline-block', background: '#06C755', color: '#fff',
  padding: '14px 30px', borderRadius: '10px', fontSize: '.98rem',
  fontWeight: 700, textDecoration: 'none',
};
const mailButtonStyle = {
  display: 'inline-block', background: '#2563eb', color: '#fff',
  padding: '14px 30px', borderRadius: '10px', fontSize: '.98rem',
  fontWeight: 700, textDecoration: 'none', wordBreak: 'break-all',
};
const noteStyle = {
  fontSize: '.83rem', color: '#64748b', margin: '14px 0 0',
};

export default Contact;

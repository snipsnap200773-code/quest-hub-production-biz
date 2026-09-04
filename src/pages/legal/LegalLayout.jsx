import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * 利用規約・プライバシーポリシー・特商法表記の共通レイアウト
 * src/pages/legal/LegalLayout.jsx
 */
function LegalLayout({ title, updatedAt, children }) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  return (
    <div style={pageStyle}>
      <style>{`
        .qh-legal h2 {
          font-size: 1.08rem; font-weight: 800; color: #0f172a;
          margin: 40px 0 14px; padding-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
        }
        .qh-legal h2:first-of-type { margin-top: 0; }
        .qh-legal h3 {
          font-size: .97rem; font-weight: 700; color: #1e293b; margin: 24px 0 10px;
        }
        .qh-legal p { margin: 0 0 14px; }
        .qh-legal ol, .qh-legal ul { margin: 0 0 14px; padding-left: 1.5em; }
        .qh-legal li { margin-bottom: 8px; }
        .qh-legal table {
          width: 100%; border-collapse: collapse; margin: 0 0 20px; font-size: .93rem;
        }
        .qh-legal th, .qh-legal td {
          border: 1px solid #e2e8f0; padding: 13px 15px; text-align: left; vertical-align: top;
        }
        .qh-legal th {
          background: #f8fafc; font-weight: 700; color: #1e293b;
          width: 34%; white-space: nowrap;
        }
        .qh-legal a { color: #2563eb; }
        @media (max-width: 560px) {
          .qh-legal th, .qh-legal td { display: block; width: 100%; border-bottom: none; }
          .qh-legal td { border-bottom: 1px solid #e2e8f0; }
        }
      `}</style>

      <div style={cardStyle}>
        <div style={{ marginBottom: '32px' }}>
          <Link to="/biz" style={{ fontSize: '.85rem', color: '#64748b', textDecoration: 'none' }}>
            ← QUEST HUB トップへ
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '16px 0 8px', letterSpacing: '-0.02em' }}>
            {title}
          </h1>
          {updatedAt && (
            <p style={{ fontSize: '.83rem', color: '#94a3b8', margin: 0 }}>最終更新日：{updatedAt}</p>
          )}
        </div>

        <div className="qh-legal" style={{ fontSize: '.95rem', color: '#475569', lineHeight: 2 }}>
          {children}
        </div>

        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '10px 22px', fontSize: '.85rem' }}>
          <Link to="/terms" style={{ color: '#64748b', textDecoration: 'none' }}>利用規約</Link>
          <Link to="/privacy" style={{ color: '#64748b', textDecoration: 'none' }}>プライバシーポリシー</Link>
          <Link to="/legal" style={{ color: '#64748b', textDecoration: 'none' }}>特定商取引法に基づく表記</Link>
          <Link to="/contact" style={{ color: '#64748b', textDecoration: 'none' }}>お問い合わせ</Link>
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
  maxWidth: '760px', margin: '0 auto', background: '#fff',
  padding: '40px 32px', borderRadius: '16px',
  boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
};

export default LegalLayout;

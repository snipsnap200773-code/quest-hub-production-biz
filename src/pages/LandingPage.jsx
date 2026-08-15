import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import DemoAdminReservations from '../components/demos/DemoAdminReservations';

function LandingPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="lp-wrapper">
      {/* 💅 CSSを直接埋め込み（レスポンシブ対応） */}
      <style>{`
        .lp-wrapper { font-family: 'sans-serif'; color: '#334155'; line-height: 1.6; background: #fff; }
        .lp-container { max-width: 1000px; margin: 0 auto; padding: 60px 20px; }
        .section-title { font-size: 2rem; font-weight: 900; color: #0f172a; text-align: center; margin-bottom: 50px; }
        .text-center { text-align: center; }
        
        /* Flexbox for PC/Mobile */
        .flex-row { display: flex; flex-direction: column; gap: 40px; align-items: center; }
        .flex-row.reverse { flex-direction: column-reverse; }
        
        /* Mockup Frames */
        .mockup-pc { width: 100%; max-width: 600px; height: 350px; background: #e2e8f0; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #64748b; font-weight: bold; border: 4px solid #cbd5e1; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
        .mockup-sp { width: 220px; height: 450px; background: #f8fafc; border-radius: 30px; display: flex; align-items: center; justify-content: center; color: #64748b; font-weight: bold; border: 8px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); position: relative; }
        .mockup-sp-group { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }
        
        /* Desktop styling */
        @media (min-width: 768px) {
          .flex-row { flex-direction: row; justify-content: space-between; }
          .flex-row.reverse { flex-direction: row; }
          .text-content { flex: 1; padding: 20px; }
          .image-content { flex: 1; display: flex; justify-content: center; position: relative; }
          .hero-title { font-size: 3rem !important; }
          
          /* PC画面の上にスマホ画面を重ねる演出 */
          .overlap-sp { position: absolute; bottom: -20px; right: 0; transform: scale(0.8); transform-origin: bottom right; }
        }
      `}</style>

      {/* 1. ファーストビュー */}
      <section style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', padding: '80px 20px' }}>
        <div className="lp-container flex-row" style={{ paddingTop: '40px' }}>
          <div className="text-content">
            <h1 className="hero-title" style={{ color: '#1e3a8a', fontSize: '2.2rem', fontWeight: '900', marginBottom: '20px', letterSpacing: '-0.05em' }}>
              今の業務スタイルを変えずに、<br />新しい予約の入り口を増やす。
            </h1>
            <p style={{ fontSize: '1.1rem', color: '#475569', marginBottom: '40px' }}>
              LINE連携・高度なレジ・訪問先との名簿共有まで。<br />
              スマホ1台で完結する直感的なシステム「QUEST HUB」。
            </p>
            <Link to="/trial" style={ctaButtonStyle}>無料で14日間試してみる 🚀</Link>
          </div>
          <div className="image-content">
            {/* PC版イメージとスマホ版イメージを重ねて表示 */}
            <div className="mockup-pc">AdminDashboard.jsx<br/>(店舗管理・売上分析)</div>
            <div className="mockup-sp overlap-sp">AdminTimeline.jsx<br/>(スマホカレンダー)</div>
          </div>
        </div>
      </section>

      {/* 2. 管理画面（店舗側）の特徴 */}
      <section className="lp-container">
        <h2 className="section-title">直感的に操作できる「店舗管理機能」</h2>
        <div className="flex-row">
          <div className="image-content" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            
            {/* 🆕 デモ画面へのリンクボタンに変更 */}
            <div style={{ background: '#f8fafc', padding: '30px', borderRadius: '20px', border: '2px dashed #cbd5e1', textAlign: 'center', width: '100%' }}>
              <p style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1e293b', marginBottom: '10px' }}>
                百聞は一見にしかず。
              </p>
              <p style={{ color: '#64748b', marginBottom: '25px', fontSize: '0.9rem' }}>
                実際のカレンダー画面（予約台帳）を操作できます。<br/>空き枠をタップして「ねじ込み予約」を体験してください。
              </p>
              <Link 
                to="/demo/calendar" 
                target="_blank" 
                style={{ ...ctaButtonStyle, display: 'inline-flex', alignItems: 'center', gap: '10px' }}
              >
                📱 デモ画面を操作してみる
              </Link>
            </div>

          </div>
          <div className="text-content" style={{ flex: 1 }}>
            <h3 style={featureTitleStyle}>📱 紙の台帳のような「タイムライン」</h3>
            <p style={featureDescStyle}>
              急な電話予約や飛び込みのお客様が来ても、カレンダーの空き枠をタップして「ねじ込み予約」が瞬時に完了。急な予定もワンタップで枠をブロックできます。
            </p>
            <h3 style={featureTitleStyle}>💳 高度なレジと売上管理 (AdminManagement)</h3>
            <p style={featureDescStyle}>
              複数メニューの組み合わせや店販商品のお会計も自動計算。別のレジを使っている店舗様向けの「自動売上確定モード」も備えています。
            </p>
          </div>
        </div>
      </section>

      {/* 3. 予約フロー（お客様側）の特徴 */}
      <section style={{ backgroundColor: '#f8fafc' }}>
        <div className="lp-container">
          <h2 className="section-title text-center">お客様を逃さない「スムーズな予約体験」</h2>
          <p className="text-center" style={{ marginBottom: '40px', color: '#64748b' }}>LINEからシームレスに繋がり、数タップで予約が完了します。</p>
          
          <div className="mockup-sp-group">
            <div className="mockup-sp">ReservationForm.jsx<br/>(メニュー・指名選択)</div>
            <div className="mockup-sp">TimeSelectionCalendar.jsx<br/>(空き時間検索)</div>
            <div className="mockup-sp">ConfirmReservation.jsx<br/>(確認・完了画面)</div>
          </div>
        </div>
      </section>

      {/* 4. ポータル画面（Home, ShopList） */}
      <section className="lp-container">
        <div className="flex-row reverse">
          <div className="text-content">
            <h3 style={featureTitleStyle}>🏪 お店の魅力を伝える「ポータル連携」</h3>
            <p style={featureDescStyle}>
              専用の店舗ページ（ShopDetail）を自動生成。メニュー表、ギャラリー、代表者メッセージを表示し、総合ポータル（Home）やカテゴリ検索（ShopList）から新しいお客様を呼び込みます。
            </p>
            <h3 style={featureTitleStyle}>🎮 リピートを促す「ゲーミフィケーション」</h3>
            <p style={featureDescStyle}>
              予約完了後（ReservedSuccess）にキャラクターが成長するゲーム連携など、他にはない遊び心でお客様のファン化を促進します。
            </p>
          </div>
          <div className="image-content">
            <div className="mockup-pc">ShopDetail.jsx / ShopList.jsx<br/>(PC・スマホ両対応ポータル)</div>
          </div>
        </div>
      </section>

      {/* 5. CTA */}
      <section style={{ backgroundColor: '#2563eb', padding: '80px 20px', textAlign: 'center', color: '#fff' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '20px', color: '#fff' }}>さあ、新しい予約体験を始めましょう。</h2>
        <Link to="/trial" style={{ ...ctaButtonStyle, backgroundColor: '#fff', color: '#2563eb' }}>
          無料アカウントを作成する
        </Link>
      </section>
    </div>
  );
}

// --- Styles ---
const featureTitleStyle = { fontSize: '1.3rem', color: '#1e293b', marginTop: '20px', marginBottom: '10px' };
const featureDescStyle = { color: '#64748b', fontSize: '1rem', lineHeight: '1.7', marginBottom: '30px' };
const ctaButtonStyle = { display: 'inline-block', backgroundColor: '#2563eb', color: '#fff', padding: '18px 40px', borderRadius: '50px', fontSize: '1.2rem', fontWeight: 'bold', textDecoration: 'none', boxShadow: '0 10px 20px rgba(37, 99, 235, 0.2)', transition: 'transform 0.2s' };

export default LandingPage;
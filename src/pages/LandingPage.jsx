import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

function LandingPage() {
  // ページ遷移時に一番上から表示させる
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', color: '#334155', lineHeight: '1.6' }}>
      
      {/* 1. ファーストビュー（ヒーローセクション） */}
      <section style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ color: '#1e3a8a', fontSize: '2.5rem', fontWeight: '900', marginBottom: '20px', letterSpacing: '-0.05em' }}>
            今の業務スタイルを変えずに、<br />新しい予約の入り口を増やす。
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#475569', marginBottom: '40px' }}>
            LINE連携・高度なレジ・訪問先との名簿共有まで。<br />
            お店のスタイルに合わせて自由にカスタマイズできる直感的な予約システム「QUEST HUB」。
          </p>
          <Link to="/trial" style={ctaButtonStyle}>
            無料で14日間試してみる 🚀
          </Link>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '15px' }}>※クレジットカードの登録は不要です</p>
        </div>
      </section>

      {/* 2. 一般店舗向けセクション */}
      <section style={{ padding: '60px 20px', backgroundColor: '#fff' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={sectionTitleStyle}>お店もお客様も使いやすい「新しい入り口」</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <FeatureCard 
              icon="📱"
              title="LINE公式アカウントと完全連動"
              description="お客様はいつものLINEから簡単に予約が可能。予約完了や前日のリマインド通知も自動で送信され、キャンセル忘れを防ぎます。"
            />
            <FeatureCard 
              icon="🗓️"
              title="直感的なタイムライン管理"
              description="電話や飛び込みのお客様が来ても、カレンダーをタップして「ねじ込み予約」が完了。急な予定もワンタップで枠をブロックできます。"
            />
            <FeatureCard 
              icon="⚙️"
              title="「予約だけ」のシンプルな使い方も大歓迎"
              description="売上管理は既存のレジで行う場合、お会計機能をスキップする「自動売上確定モード」を搭載。今の業務フローを邪魔しません。"
            />
          </div>
        </div>
      </section>

      {/* 3. 訪問サービス・施設向けセクション（別枠デザイン） */}
      <section style={{ padding: '60px 20px', backgroundColor: '#f8fafc' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '40px', borderRadius: '20px', color: '#fff' }}>
            <span style={{ backgroundColor: '#3b82f6', padding: '5px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>訪問サービス業者様向け</span>
            <h2 style={{ fontSize: '1.8rem', margin: '20px 0', color: '#fff' }}>面倒な施設とのやり取りを、すべてデジタル化。</h2>
            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <li><strong>施設専用ポータル:</strong> 施設側が直接スマホで名簿を作成し、システム経由で予約依頼が可能。</li>
              <li><strong>現場用ワークシート:</strong> 「あつまれ綺麗にしたい人（掲示用名簿）」などの現場用帳票を簡単印刷。</li>
              <li><strong>利用明細・領収書:</strong> 施設ごとの利用明細や8分割領収書のPDF出力機能を完備。</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. 料金プラン */}
      <section style={{ padding: '60px 20px', backgroundColor: '#fff', textAlign: 'center' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={sectionTitleStyle}>シンプルで明朗な料金体系</h2>
          <div style={{ border: '2px solid #e2e8f0', borderRadius: '20px', padding: '40px', maxWidth: '400px', margin: '0 auto' }}>
            <h3 style={{ fontSize: '1.5rem', color: '#0f172a', margin: '0 0 10px 0' }}>スタンダードプラン</h3>
            <p style={{ fontSize: '2.5rem', fontWeight: '900', color: '#2563eb', margin: '20px 0' }}>
              ¥0 <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 'normal' }}>/ 初期費用</span>
            </p>
            <p style={{ color: '#475569', marginBottom: '30px' }}>システム利用料のみで、全ての機能が制限なくご利用いただけます。</p>
            <Link to="/trial" style={{ ...ctaButtonStyle, display: 'block', padding: '15px' }}>まずは無料トライアル</Link>
          </div>
        </div>
      </section>

      {/* 5. フッターCTA */}
      <section style={{ backgroundColor: '#2563eb', padding: '60px 20px', textAlign: 'center', color: '#fff' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '20px', color: '#fff' }}>さあ、新しい予約体験を始めましょう。</h2>
        <p style={{ marginBottom: '30px', color: '#bfdbfe' }}>設定は最短5分で完了します。充実したサポートでお店をバックアップします。</p>
        <Link to="/trial" style={{ ...ctaButtonStyle, backgroundColor: '#fff', color: '#2563eb' }}>
          無料アカウントを作成する
        </Link>
      </section>

    </div>
  );
}

// --- コンポーネント用のスタイルとサブ要素 ---

const sectionTitleStyle = {
  fontSize: '2rem',
  fontWeight: 'bold',
  color: '#0f172a',
  textAlign: 'center',
  marginBottom: '50px'
};

const ctaButtonStyle = {
  display: 'inline-block',
  backgroundColor: '#2563eb',
  color: '#fff',
  padding: '18px 40px',
  borderRadius: '50px',
  fontSize: '1.2rem',
  fontWeight: 'bold',
  textDecoration: 'none',
  boxShadow: '0 10px 20px rgba(37, 99, 235, 0.2)',
  transition: 'transform 0.2s'
};

function FeatureCard({ icon, title, description }) {
  return (
    <div style={{ display: 'flex', gap: '20px', padding: '20px', border: '1px solid #f1f5f9', borderRadius: '15px', backgroundColor: '#f8fafc' }}>
      <div style={{ fontSize: '2.5rem' }}>{icon}</div>
      <div>
        <h3 style={{ fontSize: '1.2rem', margin: '0 0 10px 0', color: '#1e293b' }}>{title}</h3>
        <p style={{ margin: '0', color: '#64748b', fontSize: '0.95rem' }}>{description}</p>
      </div>
    </div>
  );
}

export default LandingPage;
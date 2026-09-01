import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function CancelReservation() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const token = params.get("token");

  const [view, setView] = useState('loading'); // loading, confirm, success, error
  const [reservation, setReservation] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (!token) {
      showError("URLが正しくありません。");
      return;
    }
    fetchReservation();
  }, [token]);

  const fetchReservation = async () => {
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, profiles(phone)")
        .eq("cancel_token", token)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        showError("予約が見つからないか、既にキャンセル済みです。");
        return;
      }

      // 🚨 【追加】すでに施術・会計処理が完了している場合はキャンセル画面を出さずに弾く
      if (data.status === 'completed') {
        showError("このご予約はすでに施術・会計処理が完了しているため、キャンセル手続きは行えません。");
        return;
      }

      setReservation(data);
      setView('confirm');
    } catch (err) {
      console.error(err);
      showError("通信エラーが発生しました。");
    }
  };

  // 🆕 【強化版】キャンセル実行 ＆ 名簿自動クリーニング
  const execCancel = async () => {
    if (!reservation || !window.confirm("本当にキャンセルしますか？")) return;
    setView('loading');
    
    try {
      const { id, customer_id, customer_name, shop_id } = reservation;

      // 1. 予約をキャンセル状態に更新（物理削除すると来店履歴や売上集計から記録が消えてしまうため）
      const { error: deleteError } = await supabase
        .from('reservations')
        .update({ status: 'canceled' })
        .eq('id', id);

      if (deleteError) throw deleteError;

      // 🚀 🆕 【追加】キャンセル通知の送信処理
      // 削除後でも変数 reservation にデータが残っているのでそれを利用します
      try {
        // 👇 🌟 修正：これ1つ呼ぶだけで、裏側（index.ts）が勝手にLINEかメールかを判断して送ってくれます！
        await supabase.functions.invoke('resend', {
          body: {
            type: 'cancel',
            reservation: reservation
          }
        });
      } catch (notifyErr) {
        // 通知の失敗で画面が止まらないようエラーログのみ出力
        console.error("キャンセル通知送信失敗:", notifyErr);
      }

      // 2. 名簿の来店回数を調整する
      // 🛡️ 修正：以前は「他に有効な予約が1件も無い場合、名簿ごと削除」していたが、
      // それでは無断キャンセル対策の記録（cancel_countや、別途実装した「キャンセル状況・履歴」
      // アラート）まで一緒に消えてしまい、証拠を残すという目的と矛盾するため、
      // 名簿の削除は行わず、来店回数（total_visits）の調整だけを行う。
      if (customer_id) {
        const { data: cust } = await supabase
          .from('customers')
          .select('id, total_visits')
          .eq('id', customer_id)
          .maybeSingle();

        if (cust) {
          await supabase.from('customers')
            .update({ total_visits: Math.max(0, (cust.total_visits || 1) - 1) })
            .eq('id', cust.id);
        }
      }

      setView('success');
    } catch (err) {
      console.error(err);
      showError("処理に失敗しました。店舗へお電話ください。");
    }
  };

  // 🚀 🆕 当日かどうかを判定する関数
  const isToday = (dateInput) => {
    if (!dateInput) return false;
    // 🆕 修正：ブラウザのタイムゾーンに依存せず、日本時間基準で「当日」を判定する
    const target = new Date(dateInput).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
    return target === today;
  };

  const showError = (msg) => {
    setErrMsg(msg);
    setView('error');
  };

  // スタイル設定（既存を1ミリも変えずに維持）
  const containerStyle = { maxWidth: '500px', margin: '40px auto', background: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'center', fontFamily: 'sans-serif' };
  const btnStyle = { display: 'block', width: '100%', padding: '14px', marginTop: '12px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', border: 'none', cursor: 'pointer', textDecoration: 'none', boxSizing: 'border-box' };
  const detailsStyle = { textAlign: 'left', background: '#f8fafc', padding: '15px', borderRadius: '8px', margin: '20px 0', fontSize: '14px', border: '1px solid #e2e8f0', lineHeight: '1.8' };

  if (view === 'loading') {
    return (
      <div style={containerStyle}>
        <p>予約情報を確認しています...</p>
        <div style={{ margin: '20px auto', width: '30px', height: '30px', border: '4px solid #f3f3f3', borderTop: '4px solid #ff7b7b', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (view === 'confirm' && reservation) {
    // 🆕 保存名（start_time）に合わせて修正。念のため古い形式（start_at）も予備でチェック
    const rawDate = reservation.start_time || reservation.start_at;
    const d = new Date(rawDate);
    
    const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;    return (
      <div style={containerStyle}>
        <h1 style={{ color: '#ff7b7b', fontSize: '20px' }}>予約キャンセル</h1>
        <p>以下のご予約をキャンセルしますか？</p>
        <div style={detailsStyle}>
          <strong>日時:</strong> {dateStr}<br />
          <strong>お名前:</strong> {reservation.customer_name} 様<br />
          <strong>メニュー:</strong> {
            /* 🆕 複数名データ（people）と 従来データ（services）の両方に対応 */
            reservation.options?.people 
              ? reservation.options.people.map(p => (p.services || []).map(s => s.name).join(', ')).join(' / ')
              : reservation.options?.services?.map(s => s.name).join(', ') || 'なし'
          }
        </div>
        
        {/* 🚀 🆕 当日判定によるボタンの切り替え */}
        {isToday(reservation.start_time || reservation.start_at) ? (
          <div style={{ 
            marginTop: '20px', 
            padding: '20px', 
            background: '#fff1f2', 
            borderRadius: '12px', 
            border: '2px solid #ff7b7b' 
          }}>
            <p style={{ color: '#e74c3c', fontWeight: 'bold', margin: '0 0 10px 0' }}>
              ⚠️ 当日のキャンセルはWEBから行えません
            </p>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', marginBottom: '15px' }}>
              お手数ですが、店舗へ直接お電話にて<br />ご連絡をお願いいたします。
            </p>

            {/* 🚀 🆕 電話発信ボタンの追加 */}
            {reservation.profiles?.phone && (
  <a 
    href={`tel:${reservation.profiles.phone}`} 
    style={{ 
      ...btnStyle, 
      background: '#1e293b', 
      color: '#fff', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: '8px',
      marginTop: '10px'
    }}
  >
    <span>📞</span>
    <span>{reservation.profiles.phone} に電話する</span>
  </a>
)}
          </div>
        ) : (
          <>
            <p style={{ fontSize: '12px', color: '#666' }}>※変更の場合は一度キャンセルして再度ご予約ください。</p>
            <button style={{ ...btnStyle, background: '#e74c3c', color: '#fff' }} onClick={execCancel}>予約をキャンセルする</button>
          </>
        )}

        <Link to="/" style={{ ...btnStyle, background: '#eee', color: '#333' }}>戻る</Link>
      </div>
    );
  }

  if (view === 'success') {
    return (
      <div style={containerStyle}>
        <h1 style={{ color: '#333', fontSize: '20px' }}>キャンセル完了</h1>
        <p>キャンセルを受け付けました。</p>
        
        {/* 🚀 🆕 修正：店舗のトップページ（または予約フォーム）へ戻るように変更 */}
        <Link 
          to={`/shop/${reservation?.shop_id}`} 
          style={{ ...btnStyle, background: '#ff7b7b', color: '#fff' }}
        >
          新しい予約を入れる
        </Link>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h1 style={{ color: '#333', fontSize: '20px' }}>エラー</h1>
      <p>{errMsg}</p>
      {/* 💡 エラー時は店舗IDが取れない場合があるので、ここはトップ（/）に戻すのが安全です */}
      <Link to="/" style={{ ...btnStyle, background: '#eee', color: '#333' }}>トップへ戻る</Link>
    </div>
  );
}

export default CancelReservation;
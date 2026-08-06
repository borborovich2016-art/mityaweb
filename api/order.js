// Принимает заявку с сайта и отправляет её ботом в чат.
// Токен и id чата берутся из переменных окружения Vercel — в коде их нет.

const MAX = 500;

function clean(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, MAX);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  const TOKEN = process.env.BOT_TOKEN;
  const CHAT_ID = process.env.CHAT_ID;
  if (!TOKEN || !CHAT_ID) {
    return res.status(500).json({ ok: false, error: 'Не заданы BOT_TOKEN или CHAT_ID' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const name = clean(body.name);
  const phone = clean(body.phone);
  const telegram = clean(body.telegram);
  const city = clean(body.city);
  const comment = clean(body.comment);

  const items = Array.isArray(body.cart) ? body.cart.slice(0, 30) : [];

  if (!name || !phone) return res.status(400).json({ ok: false, error: 'Не заполнены имя или телефон' });
  if (!items.length) return res.status(400).json({ ok: false, error: 'Пустая корзина' });

  const lines = items.map((i) => {
    const qty = Math.max(1, Math.min(99, parseInt(i && i.qty, 10) || 1));
    return `${clean(i && i.name)} - ${clean(i && i.color).toLowerCase()} - ${qty} шт`;
  });

  const text = [
    'НОВЫЙ ЗАКАЗ',
    `Имя: ${name}`,
    `Номер телефона: ${phone}`,
    `Telegram: ${telegram}`,
    `Город: ${city}`,
    `Комментарий: ${comment}`,
    '',
    'ЗАКАЗАЛ(А):',
    ...lines,
    '',
    'ЗАКАЗ ЗАКРЫТ?'
  ].join('\n');

  try {
    const tg = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [[
            { text: 'Да ✅', callback_data: 'close_yes' },
            { text: 'Нет ❌', callback_data: 'close_no' }
          ]]
        }
      })
    });

    const data = await tg.json();
    if (!data.ok) {
      console.error('Telegram error:', data);
      return res.status(502).json({ ok: false, error: 'Telegram отклонил сообщение' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, error: 'Не удалось связаться с Telegram' });
  }
}

// Вебхук Telegram: ловит нажатие кнопок «Да ✅» / «Нет ❌» под заказом,
// дописывает статус в конец сообщения и убирает кнопки.

const BOLD = ['НОВЫЙ ЗАКАЗ', 'ЗАКАЗАЛ(А):'];

// Telegram отдаёт текст сообщения без форматирования,
// поэтому перед правкой собираем HTML заново
function toHtml(plain) {
  return String(plain)
    .split('\n')
    .map((line) => {
      const safe = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return BOLD.includes(line.trim()) ? `<b>${safe}</b>` : safe;
    })
    .join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const TOKEN = process.env.BOT_TOKEN;
  const SECRET = process.env.WEBHOOK_SECRET;
  if (!TOKEN) return res.status(500).end();

  // Telegram присылает секрет заголовком — чужие запросы отсекаем
  if (SECRET && req.headers['x-telegram-bot-api-secret-token'] !== SECRET) {
    return res.status(401).end();
  }

  let update = req.body;
  if (typeof update === 'string') {
    try { update = JSON.parse(update); } catch { update = {}; }
  }
  const cq = update && update.callback_query;

  // всё, что не нажатие кнопки, просто подтверждаем
  if (!cq || !cq.message) return res.status(200).json({ ok: true });

  const yes = cq.data === 'close_yes';
  const status = yes ? 'Закрыт ✅' : 'Закрыт ❌';

  const api = (method, payload) =>
    fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

  try {
    const base = String(cq.message.text || '').replace(/\n?Закрыт (✅|❌)\s*$/u, '');

    await api('editMessageText', {
      chat_id: cq.message.chat.id,
      message_id: cq.message.message_id,
      text: `${toHtml(base)}\n${status}`,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [] }   // убираем кнопки
    });

    await api('answerCallbackQuery', {
      callback_query_id: cq.id,
      text: status
    });
  } catch (e) {
    console.error(e);
  }

  return res.status(200).json({ ok: true });
}

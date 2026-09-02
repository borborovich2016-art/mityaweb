// Отправляет заявку с сайта в amoCRM: создаёт сделку в воронке «Входящие клиенты»
// + контакт с телефоном, и добавляет к сделке примечание с составом заказа.
// Токен и параметры берутся из переменных окружения Vercel — в коде их нет.

export async function sendToAmo({ name, phone, telegram, city, comment, lines, total }) {
  const DOMAIN = process.env.AMOCRM_DOMAIN;       // например: dvesoroki.amocrm.ru
  const TOKEN = process.env.AMOCRM_TOKEN;         // долгосрочный токен
  const PIPELINE_ID = Number(process.env.AMOCRM_PIPELINE_ID); // 1171792
  const STATUS_ID = Number(process.env.AMOCRM_STATUS_ID);     // 20148760

  if (!DOMAIN || !TOKEN || !PIPELINE_ID || !STATUS_ID) {
    throw new Error('Не заданы переменные окружения AMOCRM_DOMAIN / AMOCRM_TOKEN / AMOCRM_PIPELINE_ID / AMOCRM_STATUS_ID');
  }

  const base = `https://${DOMAIN}/api/v4`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`
  };

  // 1) создаём сделку + контакт одним запросом
  const leadPayload = [{
    name: `Заявка с сайта — ${name}`,
    pipeline_id: PIPELINE_ID,
    status_id: STATUS_ID,
    ...(total ? { price: total } : {}),
    _embedded: {
      contacts: [{
        name,
        custom_fields_values: [{
          field_code: 'PHONE',
          values: [{ value: phone, enum_code: 'WORK' }]
        }]
      }]
    }
  }];

  const leadRes = await fetch(`${base}/leads/complex`, {
    method: 'POST',
    headers,
    body: JSON.stringify(leadPayload)
  });

  if (!leadRes.ok) {
    const errText = await leadRes.text().catch(() => '');
    throw new Error(`amoCRM leads/complex ${leadRes.status}: ${errText}`);
  }

  const leadData = await leadRes.json();
  const leadId = Array.isArray(leadData) && leadData[0] && leadData[0].id;

  // 2) добавляем примечание с деталями заказа (необязательный шаг — не роняем всё, если не вышло)
  if (leadId) {
    const noteText = [
      `Telegram: ${telegram || '—'}`,
      `Город: ${city || '—'}`,
      `Комментарий: ${comment || '—'}`,
      '',
      'Заказал(а):',
      ...(lines && lines.length ? lines : ['—'])
    ].join('\n');

    try {
      const noteRes = await fetch(`${base}/leads/notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify([{
          entity_id: leadId,
          note_type: 'common',
          params: { text: noteText }
        }])
      });
      if (!noteRes.ok) {
        const errText = await noteRes.text().catch(() => '');
        console.error(`amoCRM note ${noteRes.status}: ${errText}`);
      }
    } catch (e) {
      console.error('amoCRM note error:', e);
    }
  }

  return leadId;
}

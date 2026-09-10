/* ЭИБ · демо-база данных
   Все сущности связаны идентификаторами:
   пользователь → проект → подпись → транзакция → заявка подрядчика → этап работ →
   замечание → фото → отчёт → решение администрации → завершение проекта.

   Хранится в localStorage (ключ eib-db-v5). Сиды строятся из assets/js/data.js
   при первом запуске: статичные проекты разворачиваются в записи БД —
   транзакции, подписи, события хроники, заявки на торги, отчёты и замечания. */

const DB_KEY = 'eib-db-v5';

/* ---------------- Статусы жизненного цикла ---------------- */
const STATUS = {
  draft:       { n: 'Черновик',             chip: 'chip-grey',   phase: 'idea' },
  submitted:   { n: 'Заявка подана',        chip: 'chip-blue',   phase: 'idea' },
  review:      { n: 'На проверке',          chip: 'chip-amber',  phase: 'idea' },
  rework:      { n: 'Требует доработки',    chip: 'chip-red',    phase: 'idea' },
  approved:    { n: 'Одобрена',             chip: 'chip-green',  phase: 'idea' },
  signing:     { n: 'Сбор подписей',        chip: 'chip-violet', phase: 'signing' },
  collecting:  { n: 'Сбор средств',         chip: 'chip-blue',   phase: 'collecting' },
  goal:        { n: 'Цель достигнута',      chip: 'chip-green',  phase: 'collecting' },
  documents:   { n: 'Отправка документов',  chip: 'chip-cyan',   phase: 'documents' },
  procurement: { n: 'Торги и выбор подрядчика', chip: 'chip-violet', phase: 'procurement' },
  works:       { n: 'Реализация',           chip: 'chip-amber',  phase: 'works' },
  reporting:   { n: 'Отчётность',           chip: 'chip-amber',  phase: 'works' },
  done:        { n: 'Завершён',             chip: 'chip-green',  phase: 'done' },
  rejected:    { n: 'Отклонён',             chip: 'chip-red',    phase: 'idea' },
  refunded:    { n: 'Не реализован, средства возвращены', chip: 'chip-red', phase: 'done' }
};

/* Порядок «нормального» пути проекта */
const FLOW = ['draft', 'submitted', 'review', 'approved', 'signing', 'collecting',
  'goal', 'documents', 'procurement', 'works', 'reporting', 'done'];

/* Крупные фазы для трекера на странице проекта */
const PHASES = [
  { key: 'idea',        n: 1, name: 'Заявка и проверка' },
  { key: 'signing',     n: 2, name: 'Сбор подписей' },
  { key: 'collecting',  n: 3, name: 'Сбор средств' },
  { key: 'documents',   n: 4, name: 'Документы' },
  { key: 'procurement', n: 5, name: 'Торги и подрядчик' },
  { key: 'works',       n: 6, name: 'Реализация и отчёты' },
  { key: 'done',        n: 7, name: 'Завершён' }
];

const TX_STATUS = {
  confirmed: ['chip-green', 'подтверждён'],
  pending:   ['chip-amber', 'в обработке'],
  failed:    ['chip-red',   'не прошёл'],
  refunded:  ['chip-grey',  'возвращён']
};

const ISSUE_STATUS = {
  new:        ['chip-blue',  'новое'],
  moderation: ['chip-amber', 'на модерации'],
  published:  ['chip-green', 'опубликовано'],
  rejected:   ['chip-red',   'отклонено']
};

/* ---------------- Утилиты ---------------- */
const nowISO = () => new Date().toISOString();
const dateRU = iso => new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeRU = iso => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
let _seq = 0;
const uid = pre => pre + '-' + Date.now().toString(36) + '-' + (_seq++).toString(36);

/* Дата «N дней назад» в ISO — для правдоподобной истории */
const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString();

/* ---------------- Хранилище ---------------- */
const DB = {
  data: null,

  load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        this.data = JSON.parse(raw);
        /* страховка от старых снимков: недостающие коллекции */
        ['users','projects','signatures','transactions','events','issues','bids','reports','views','notifications']
          .forEach(c => { if (!Array.isArray(this.data[c])) this.data[c] = []; });
        if (!this.data.session) this.data.session = { role: 'guest' };
        return this.data;
      }
    } catch (e) { /* приватный режим */ }
    this.data = this.seed();
    this.save();
    return this.data;
  },

  save() {
    try { localStorage.setItem(DB_KEY, JSON.stringify(this.data)); } catch (e) {}
  },

  reset() {
    this.data = this.seed();
    this.save();
    return this.data;
  },

  /* ---------------- Сиды ---------------- */
  seed() {
    const db = {
      users: [], projects: [], signatures: [], transactions: [], events: [],
      issues: [], bids: [], reports: [], views: [], notifications: [],
      session: { role: 'guest' }
    };

    /* Пользователи */
    db.users = [
      { id: 'u-citizen', role: 'citizen', name: 'Мария К.', full: 'Мария Константиновна К.',
        org: 'житель г. Обнинска', init: 'МК', badge: '', esia: 'ЕСИА · подтверждённая учётная запись' },
      { id: 'u-admin', role: 'admin', name: 'А. В. Смирнова', full: 'Смирнова Анна Викторовна',
        org: 'Администрация г. Обнинска', init: 'АС', badge: 'a', esia: 'Отдел благоустройства · роль «Куратор ИБ»' },
      { id: 'u-contractor', role: 'contractor', name: 'ООО «СпортСтройМонтаж»', full: 'ООО «СпортСтройМонтаж»',
        org: 'подрядчик, ИНН 4025 099 771', init: 'СМ', badge: 'c', esia: 'ЕСИА организации · КЭП руководителя',
        inn: '4025 099 771', done: 21, fail: 0, rating: 4.8 },
      { id: 'u-c2', role: 'contractor', name: 'ООО «Обнинскстройсервис»', org: 'подрядчик, ИНН 4025 118 345',
        init: 'ОС', badge: 'c', inn: '4025 118 345', done: 14, fail: 0, rating: 4.6 },
      { id: 'u-c3', role: 'contractor', name: 'ООО «Калугадорстрой»', org: 'подрядчик, ИНН 4028 077 210',
        init: 'КД', badge: 'c', inn: '4028 077 210', done: 9, fail: 1, rating: 4.1 }
    ];

    /* Жители-статисты для подписей и взносов */
    const NAMES = ['Анна Т.', 'Игорь М.', 'Светлана П.', 'Дмитрий К.', 'Ольга В.', 'Николай С.',
      'Екатерина Л.', 'Павел Ж.', 'Марина Б.', 'Артём Р.', 'Юлия Н.', 'Сергей Д.',
      'Ирина Ф.', 'Алексей З.', 'Татьяна Ш.', 'Виктор А.'];
    NAMES.forEach((n, i) => db.users.push({
      id: 'u-r' + i, role: 'citizen', name: n, org: 'житель г. Обнинска',
      init: n.charAt(0) + n.split(' ')[1].charAt(0), badge: ''
    }));

    /* Соответствие старых этапов новым статусам */
    const STAGE_TO_STATUS = {
      idea: 'signing', collecting: 'collecting', documents: 'documents',
      contractor: 'procurement', works: 'works', done: 'done'
    };

    /* ---------------------------------------------------------------
       Даты «уже случившегося» (документы, реестры, пакет в СЭД) в демо-данных
       заданы вручную и часть из них оказалась впереди сегодняшнего дня.
       Сдвигаем такие даты в прошлое одним шагом — порядок между ними сохраняется.
       Сроки, которые и должны быть в будущем (приём заявок, дата аукциона),
       не трогаем.
    --------------------------------------------------------------- */
    const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const RX_DOT = /(\d{2})\.(\d{2})\.(\d{4})/g;
    const RX_TXT = new RegExp('(\\d{1,2})\\s+(' + MON.join('|') + ')\\s+(\\d{4})', 'g');
    const pad = n => String(n).padStart(2, '0');

    /* Самая поздняя «прошедшая» дата в исходных данных */
    let maxPast = 0;
    const scan = s => {
      if (typeof s !== 'string') return;
      let m;
      RX_DOT.lastIndex = 0;
      while ((m = RX_DOT.exec(s))) {
        const t = +new Date(+m[3], +m[2] - 1, +m[1]);
        if (t > maxPast) maxPast = t;
      }
    };
    PROJECTS.forEach(p => {
      if (p.docsPack) Object.values(p.docsPack).forEach(scan);
      (p.docs || []).forEach(d => scan(d.date));
      if (p.signatures) scan(p.signatures.date);
      if (p.tender) scan(p.tender.published);
    });
    const shiftMs = Math.max(0, maxPast - (Date.now() - 2 * 86400000));
    const shiftStr = s => {
      if (typeof s !== 'string' || !shiftMs) return s;
      return s
        .replace(RX_DOT, (_, d, mo, y) => {
          const x = new Date(+new Date(+y, +mo - 1, +d) - shiftMs);
          return pad(x.getDate()) + '.' + pad(x.getMonth() + 1) + '.' + x.getFullYear();
        })
        .replace(RX_TXT, (_, d, mo, y) => {
          const x = new Date(+new Date(+y, MON.indexOf(mo), +d) - shiftMs);
          return x.getDate() + ' ' + MON[x.getMonth()] + ' ' + x.getFullYear();
        });
    };
    const shiftAny = v => Array.isArray(v) ? v.map(shiftAny)
      : (v && typeof v === 'object' ? shiftObj(v) : (typeof v === 'string' ? shiftStr(v) : v));
    const shiftObj = o => {
      if (!o) return o;
      const out = {};
      Object.keys(o).forEach(k => { out[k] = shiftAny(o[k]); });
      return out;
    };

    /* Проекты + связанные записи */
    PROJECTS.forEach((p, pi) => {
      const status = STAGE_TO_STATUS[p.stage] || 'collecting';
      const ownerId = p.id === 'skver-uchenyh' ? 'u-citizen' : 'u-r' + (pi % NAMES.length);

      db.projects.push({
        id: p.id, title: p.title, cat: p.cat, cover: p.cover, addr: p.addr, district: p.district,
        summary: p.summary, problem: p.problem, result: p.result,
        ownerId: ownerId, ownerName: p.id === 'skver-uchenyh' ? 'Мария К.' : p.initiator.name,
        groupNote: p.initiator.about,
        cost: p.cost, sharePct: p.sharePct, goal: p.goal,
        signNeed: p.signatures.need, deadline: p.deadline, daysLeft: p.daysLeft,
        smeta: p.smeta.map(i => ({ id: uid('sm'), t: i.t, q: i.q, u: i.u, unit: i.unit, by: 'admin' })),
        smetaApproved: p.stage !== 'idea',
        idea: '', plan: '',
        status: status,
        docs: (p.docs || []).map(d => shiftObj(d)),
        docsPack: shiftObj(p.docsPack),
        tender: p.tender ? { number: p.tender.number, law: p.tender.law, platform: p.tender.platform,
          nmck: p.tender.nmck, published: shiftStr(p.tender.published), bidsUntil: p.tender.bidsUntil,
          auctionAt: p.tender.auctionAt, term: p.tender.term, open: p.stage === 'contractor' } : null,
        contract: p.works ? { number: p.works.contract, contractorId: 'u-contractor',
          sum: p.works.sum, paid: p.works.paid, start: p.works.start, finish: p.works.finish,
          curator: p.works.curator, publicCheck: p.works.publicCheck } : null,
        plan_items: p.works ? p.works.plan.map(x => ({ id: uid('pl'), ...x })) : [],
        report: shiftObj(p.report),
        createdByRole: 'citizen',
        createdAt: daysAgo(120 - pi * 8)
      });

      /* Подписи */
      const need = p.signatures.need, have = p.signatures.count;
      for (let i = 0; i < have; i++) {
        const isOwnerFirst = i === 0;
        db.signatures.push({
          id: uid('sg'), projectId: p.id,
          userId: isOwnerFirst ? ownerId : 'u-r' + ((i + pi) % NAMES.length),
          userName: isOwnerFirst ? (p.id === 'skver-uchenyh' ? 'Мария К.' : p.initiator.name) : NAMES[(i + pi) % NAMES.length],
          date: daysAgo(110 - pi * 8 - i * 0.2)
        });
      }
      /* Мария подписала ещё несколько проектов — для раздела «Ваш вклад» */
      if (['ploschadka-aksenova', 'trotuar-kurchatova', 'shkola7-sport'].includes(p.id)) {
        db.signatures.push({ id: uid('sg'), projectId: p.id, userId: 'u-citizen',
          userName: 'Мария К.', date: daysAgo(100 - pi * 8) });
      }

      /* Транзакции — разворачиваем raised/donors в отдельные платежи */
      const donors = p.donors || 0;
      if (donors > 0) {
        const target = p.raised;
        const sums = [];
        let acc = 0;
        const base = [300, 500, 1000, 1500, 2000, 3000, 5000];
        for (let i = 0; i < Math.min(donors, 14); i++) {
          const v = base[(i * 3 + pi) % base.length];
          sums.push(v); acc += v;
        }
        /* остаток одним «пакетным» поступлением, чтобы сумма совпала с демо-данными */
        const rest = target - acc;
        const list = sums.slice();
        if (rest > 0) list.push(rest);

        list.forEach((amount, i) => {
          const bulk = i === list.length - 1 && rest > 0;
          db.transactions.push({
            id: uid('tx'), no: 'TX-' + (2026000 + pi * 100 + i),
            projectId: p.id,
            userId: bulk ? null : (i === 0 && p.id !== 'lestnica-belkino' ? 'u-citizen' : 'u-r' + ((i + pi) % NAMES.length)),
            userName: bulk ? (donors - list.length + 1) + ' плательщиков (сводное поступление)'
              : (i === 0 && p.id !== 'lestnica-belkino' ? 'Мария К.' : NAMES[(i + pi) % NAMES.length]),
            amount: amount,
            date: daysAgo(40 - pi * 3 - i * 0.7),
            method: i % 3 === 0 ? 'СБП' : 'карта',
            status: 'confirmed'
          });
        });

        /* по одному неуспешному и одному «в обработке» — чтобы показать фильтрацию */
        if (p.stage === 'collecting') {
          db.transactions.push({ id: uid('tx'), no: 'TX-' + (2026000 + pi * 100 + 90), projectId: p.id,
            userId: 'u-r3', userName: NAMES[3], amount: 1000, date: daysAgo(4),
            method: 'карта', status: 'failed' });
          db.transactions.push({ id: uid('tx'), no: 'TX-' + (2026000 + pi * 100 + 91), projectId: p.id,
            userId: 'u-r7', userName: NAMES[7], amount: 500, date: daysAgo(0.3),
            method: 'СБП', status: 'pending' });
        }
      }

      /* Хроника из журнала проекта */
      (p.log || []).forEach((l, i) => {
        const [d, m, y] = l.d.split('.');
        db.events.push({
          id: uid('ev'), projectId: p.id,
          date: new Date(+y, +m - 1, +d, 10 + i).toISOString(),
          title: l.t.length > 60 ? l.t.slice(0, 57) + '…' : l.t,
          text: l.t, actor: l.a, kind: l.a
        });
      });

      /* Заявки подрядчиков */
      if (p.tender) {
        const byName = {};
        db.users.filter(u => u.role === 'contractor').forEach(u => byName[u.name] = u.id);
        p.tender.bids.forEach(b => db.bids.push({
          id: uid('bd'), projectId: p.id,
          contractorId: byName[b.name] || 'u-c2', contractorName: b.name, inn: b.inn,
          price: b.price, discount: b.dis, term: b.term, exp: b.exp, done: b.done, fail: b.fail,
          status: b.st === 'winner' ? 'winner' : (b.st === 'rejected' ? 'rejected' : 'submitted'),
          why: b.why || '', date: daysAgo(60 - pi * 5)
        }));
      }

      /* Отчёты подрядчика из фотоотчёта */
      if (p.works) {
        p.works.photos.forEach((ph, i) => {
          const [d, m, y] = ph.d.split('.');
          db.reports.push({
            id: uid('rp'), projectId: p.id, contractorId: 'u-contractor',
            stage: p.works.plan[Math.min(i, p.works.plan.length - 1)].t,
            workDate: new Date(+y, +m - 1, +d).toISOString(),
            sentAt: new Date(+y, +m - 1, +d, 18, 20).toISOString(),
            text: ph.t,
            photos: [{ id: uid('ph'), caption: ph.t, css: ph.c, kind: i === 0 ? 'before' : (i === p.works.photos.length - 1 ? 'after' : 'progress') }],
            docs: i % 2 === 1 ? [{ id: uid('dc'), name: 'Акт КС-2 № ' + Math.ceil(i / 2) + '.pdf', size: '240 КБ' }] : [],
            status: 'accepted'
          });
        });

        /* Замечания жителей */
        p.works.issues.forEach(is => {
          const [d, m, y] = is.d.split('.');
          db.issues.push({
            id: uid('is'), projectId: p.id,
            userId: is.who === 'житель' ? 'u-r5' : 'u-r2',
            userName: is.who === 'житель' ? NAMES[5] : NAMES[2],
            role: is.who,
            text: is.t,
            photos: [{ id: uid('ph'), caption: is.t, css: 'linear-gradient(135deg,#8792a8,#4a566b)' }],
            date: new Date(+y, +m - 1, +d, 12).toISOString(),
            status: 'published',
            adminComment: is.st
          });
        });
      }
    });


    /* ---------------------------------------------------------------
       Чистые демо-проекты — чтобы можно было проверить каждую механику
       с нуля: подписать, вложить деньги, подать заявку на торги,
       оставить замечание по работам, рассмотреть заявку в администрации.
    --------------------------------------------------------------- */
    const blank = (o) => Object.assign({
      cover: 'cv-1', signNeed: 10, sharePct: 10, smetaApproved: true,
      idea: '', plan: '', docs: [], docsPack: null, tender: null, contract: null,
      plan_items: [], report: null, deadline: 'по решению комиссии', daysLeft: null,
      createdAt: daysAgo(12), createdByRole: 'citizen'
    }, o);

    db.projects.push(blank({
      id: 'demo-signing',
      title: 'Сквер у Дома культуры «Юбилейный»',
      cat: 'Благоустройство', cover: 'cv-2',
      addr: 'ул. Гурьянова, 13 — сквер у Дома культуры',
      district: 'Мкрн 51',
      summary: 'Дорожки, освещение и скамейки в сквере у Дома культуры — сейчас идёт сбор подписей жителей.',
      problem: 'Сквер зарос, дорожки разбиты, вечером нет освещения. Через сквер ходят к Дому культуры и школе.',
      result: 'Прогулочная зона 0,4 га: 220 м дорожек, 14 фонарей, 10 скамеек.',
      ownerId: 'u-r2', ownerName: 'Светлана П.', groupNote: 'инициативная группа жителей мкрн 51',
      cost: 1180000, goal: 118000,
      status: 'signing',
      smeta: [
        { id: uid('sm'), t: 'Устройство дорожек', q: 220, u: 2900, unit: 'м²', by: 'admin' },
        { id: uid('sm'), t: 'Опоры освещения', q: 14, u: 19500, unit: 'шт.', by: 'admin' },
        { id: uid('sm'), t: 'Скамьи с урнами', q: 10, u: 14400, unit: 'компл.', by: 'admin' },
        { id: uid('sm'), t: 'Газон и посадки', q: 1, u: 128000, unit: 'компл.', by: 'admin' }
      ]
    }));

    db.projects.push(blank({
      id: 'demo-collecting',
      title: 'Тёплая остановка на ул. Победы',
      cat: 'Благоустройство', cover: 'cv-5',
      addr: 'ул. Победы, остановка «Поликлиника»',
      district: 'Центр',
      summary: 'Закрытый павильон с подогревом и освещением на остановке у поликлиники — открыт сбор средств.',
      problem: 'На остановке нет укрытия, зимой люди ждут автобус на ветру. Рядом поликлиника и два дома престарелых.',
      result: 'Тёплый павильон на 12 мест, освещение, электронное табло, урны.',
      ownerId: 'u-r6', ownerName: 'Екатерина Л.', groupNote: 'совет дома ул. Победы, 8',
      cost: 940000, goal: 94000,
      status: 'collecting', deadline: 'через 40 рабочих дней', daysLeft: 34,
      smeta: [
        { id: uid('sm'), t: 'Павильон закрытого типа', q: 1, u: 620000, unit: 'шт.', by: 'admin' },
        { id: uid('sm'), t: 'Подогрев и электрика', q: 1, u: 184000, unit: 'компл.', by: 'admin' },
        { id: uid('sm'), t: 'Основание и монтаж', q: 1, u: 136000, unit: 'компл.', by: 'admin' }
      ]
    }));

    db.projects.push(blank({
      id: 'demo-tender',
      title: 'Лестница к парку «Белкино»',
      cat: 'Благоустройство', cover: 'cv-4',
      addr: 'спуск от ул. Борисоглебской к парку «Белкино»',
      district: 'Мкрн 51',
      summary: 'Новая лестница из 64 ступеней с перилами и освещением. Средства собраны, объявлены торги — заявок пока нет.',
      problem: 'Ступени просели и обрушились на трёх участках, перил нет. Зимой спуск опасен.',
      result: 'Лестница 64 ступени, двусторонние перила, 8 светильников, площадка отдыха.',
      ownerId: 'u-r10', ownerName: 'Юлия Н.', groupNote: 'инициативная группа жителей мкрн 51',
      cost: 980000, goal: 98000,
      status: 'procurement', deadline: 'сбор закрыт',
      smeta: [
        { id: uid('sm'), t: 'Демонтаж лестницы', q: 1, u: 84000, unit: 'компл.', by: 'admin' },
        { id: uid('sm'), t: 'Лестничный марш, 64 ступени', q: 64, u: 8600, unit: 'ступень', by: 'admin' },
        { id: uid('sm'), t: 'Перила двусторонние', q: 48, u: 4200, unit: 'м', by: 'admin' },
        { id: uid('sm'), t: 'Освещение', q: 8, u: 16400, unit: 'шт.', by: 'admin' },
        { id: uid('sm'), t: 'Площадка отдыха', q: 1, u: 62800, unit: 'компл.', by: 'admin' }
      ],
      docsPack: {
        sentAt: dateTimeRU(daysAgo(9)), channel: 'ЕСИА → СЭД администрации г. Обнинска',
        incoming: 'вх. № 4390-ИБ', deadline: 'принято', status: 'Принято администрацией'
      },
      tender: {
        number: '0137300012826000501', law: '44-ФЗ, электронный аукцион',
        platform: 'ЕИС / РТС-тендер', nmck: 980000,
        published: dateRU(daysAgo(6)), bidsUntil: 'через 8 дней', auctionAt: 'через 11 дней',
        term: '45 календарных дней с даты контракта', open: true
      }
    }));

    db.projects.push(blank({
      id: 'demo-works',
      title: 'Тротуар у поликлиники на ул. Аксёнова',
      cat: 'Дороги и тротуары', cover: 'cv-3',
      addr: 'ул. Аксёнова, участок от д. 4 до поликлиники',
      district: 'Мкрн 38',
      summary: 'Ремонт 260 м тротуара с пандусами. Работы идут — можно посмотреть отчёты и оставить замечание.',
      problem: 'Покрытие разрушено, к поликлинике не проехать с коляской и на кресле-коляске.',
      result: '260 м тротуара шириной 2 м, 4 занижения бордюра, 2 пандуса, тактильная плитка.',
      ownerId: 'u-r13', ownerName: 'Алексей З.', groupNote: 'совет дома ул. Аксёнова, 4',
      cost: 1240000, goal: 124000,
      status: 'works', deadline: 'сбор закрыт',
      smeta: [
        { id: uid('sm'), t: 'Демонтаж покрытия', q: 260, u: 780, unit: 'м', by: 'admin' },
        { id: uid('sm'), t: 'Основание', q: 520, u: 640, unit: 'м²', by: 'admin' },
        { id: uid('sm'), t: 'Асфальтобетонное покрытие', q: 520, u: 1180, unit: 'м²', by: 'admin' },
        { id: uid('sm'), t: 'Пандусы и тактильная плитка', q: 1, u: 118000, unit: 'компл.', by: 'admin' }
      ],
      tender: {
        number: '0137300012826000488', law: '44-ФЗ, электронный аукцион',
        platform: 'ЕИС / РТС-тендер', nmck: 1240000,
        published: dateRU(daysAgo(40)), bidsUntil: 'приём закрыт', auctionAt: dateRU(daysAgo(28)),
        term: '40 календарных дней с даты контракта', open: false
      },
      contract: {
        number: '№ 52-МК/2026', contractorId: 'u-c2', sum: 1128000, paid: 282000,
        start: dateRU(daysAgo(20)), finish: 'через 3 недели',
        curator: 'Отдел благоустройства администрации г. Обнинска',
        publicCheck: '2 общественных инспектора от инициативной группы'
      },
      plan_items: [
        { id: uid('pl'), t: 'Демонтаж старого покрытия', p: 100, st: 'done', d: 'этап 1' },
        { id: uid('pl'), t: 'Устройство основания', p: 60, st: 'now', d: 'этап 2' },
        { id: uid('pl'), t: 'Укладка покрытия', p: 0, st: 'wait', d: 'этап 3' },
        { id: uid('pl'), t: 'Пандусы и сдача объекта', p: 0, st: 'wait', d: 'этап 4' }
      ]
    }));

    db.projects.push(blank({
      id: 'demo-inbox',
      title: 'Освещение дорожки к детскому саду № 21',
      cat: 'Освещение', cover: 'cv-1',
      addr: 'ул. Курчатова, проход между домами 45 и 47',
      district: 'Центр',
      summary: 'Заявка жителя ждёт рассмотрения администрации — можно посмотреть, как работает проверка и смета.',
      problem: 'Дорожку к детскому саду не освещают, утром и вечером родители с детьми идут в темноте.',
      result: '8 светильников на опорах, 180 м освещённой дорожки.',
      idea: 'Поставить фонари на дорожке к детскому саду № 21 — утром и вечером там совсем темно',
      ownerId: 'u-citizen', ownerName: 'Мария К.', groupNote: 'инициативная группа жителей',
      cost: 314400, goal: 31440, smetaApproved: false,
      status: 'submitted', createdAt: daysAgo(2),
      smeta: [
        { id: uid('sm'), t: 'Светильник на опоре', q: 8, u: 22000, unit: 'шт.', by: 'citizen' },
        { id: uid('sm'), t: 'Монтаж и подключение', q: 8, u: 4300, unit: 'шт.', by: 'citizen' },
        { id: uid('sm'), t: 'Прокладка кабеля', q: 108, u: 950, unit: 'м', by: 'citizen' }
      ]
    }));

    /* Хроника и связанные записи для чистых проектов */
    db.events.push(
      { id: uid('ev'), projectId: 'demo-signing', date: daysAgo(11), actor: 'администрация',
        title: 'Проект опубликован', text: 'Заявка одобрена комиссией, открыт сбор подписей жителей.' },
      { id: uid('ev'), projectId: 'demo-collecting', date: daysAgo(9), actor: 'администрация',
        title: 'Открыт сбор средств', text: 'Набрано 10 подписей, договор подписан, срок сбора — 40 рабочих дней.' },
      { id: uid('ev'), projectId: 'demo-tender', date: daysAgo(6), actor: 'администрация',
        title: 'Объявлены торги по 44-ФЗ', text: 'Средства жителей зачислены в бюджет, опубликовано извещение № 0137300012826000501.' },
      { id: uid('ev'), projectId: 'demo-works', date: daysAgo(20), actor: 'подрядчик',
        title: 'Работы начаты', text: 'ООО «Обнинскстройсервис» приступило к демонтажу старого покрытия.' },
      { id: uid('ev'), projectId: 'demo-inbox', date: daysAgo(2), actor: 'житель',
        title: 'Заявка отправлена в администрацию', text: 'Житель Мария К. отправила заявку на рассмотрение.' }
    );

    /* Подписи и деньги для чистых проектов */
    for (let i = 0; i < 4; i++) db.signatures.push({
      id: uid('sg'), projectId: 'demo-signing', userId: 'u-r' + i, userName: NAMES[i], date: daysAgo(10 - i)
    });
    for (let i = 0; i < 10; i++) db.signatures.push({
      id: uid('sg'), projectId: 'demo-collecting', userId: 'u-r' + i, userName: NAMES[i], date: daysAgo(14 - i * 0.3)
    });
    ['demo-tender', 'demo-works'].forEach(pid => {
      for (let i = 0; i < 12; i++) db.signatures.push({
        id: uid('sg'), projectId: pid, userId: 'u-r' + i, userName: NAMES[i], date: daysAgo(50 - i)
      });
    });
    [['demo-collecting', [3000, 2000, 5000, 1000, 1500]],
     ['demo-tender', [20000, 30000, 25000, 23000]],
     ['demo-works', [30000, 40000, 34000, 20000]]].forEach(([pid, sums]) => {
      sums.forEach((amount, i) => db.transactions.push({
        id: uid('tx'), no: 'TX-' + (2026500 + Math.floor(Math.random() * 400)),
        projectId: pid, userId: 'u-r' + (i + 2), userName: NAMES[i + 2],
        amount, date: daysAgo(20 - i), method: i % 2 ? 'СБП' : 'карта', status: 'confirmed'
      }));
    });

    /* Отчёт подрядчика по проекту в работе */
    db.reports.push({
      id: uid('rp'), projectId: 'demo-works', contractorId: 'u-c2',
      stage: 'Демонтаж старого покрытия',
      workDate: daysAgo(14), sentAt: daysAgo(13),
      text: 'Снято 260 м старого покрытия, вывезено 18 т строительного мусора.',
      photos: [
        { id: uid('ph'), caption: 'Тротуар до начала работ', css: 'linear-gradient(135deg,#7a8ba6,#3d4e6b)', kind: 'before' },
        { id: uid('ph'), caption: 'Покрытие снято, площадка расчищена', css: 'linear-gradient(135deg,#a08b6a,#5d4a2e)', kind: 'progress' }
      ],
      docs: [{ id: uid('dc'), name: 'Акт КС-2 № 1.pdf', size: '210 КБ' }],
      status: 'accepted'
    });

    /* Одно замечание, ожидающее модерации — чтобы админ мог его обработать */
    db.issues.push({
      id: uid('is'), projectId: 'vorkaut-zaovrazhye', userId: 'u-r9', userName: NAMES[9],
      role: 'житель', text: 'После дождя на новом покрытии стоит вода у северного края площадки.',
      photos: [{ id: uid('ph'), caption: 'Лужа у края покрытия', css: 'linear-gradient(135deg,#5b6b86,#2b3a55)' }],
      date: daysAgo(1), status: 'moderation', adminComment: ''
    });

    /* История просмотров жителя */
    ['skver-uchenyh', 'vorkaut-zaovrazhye', 'shkola7-sport'].forEach((pid, i) =>
      db.views.push({ userId: 'u-citizen', projectId: pid, lastSeen: daysAgo(i + 1) }));

    /* ---------------------------------------------------------------
       Даты в демо-данных заданы вручную и часть из них попадает в будущее.
       Сдвигаем такие записи в прошлое, сохраняя их порядок: иначе новые
       действия пользователя оказываются внизу хроники.
    --------------------------------------------------------------- */
    const FIELDS = { events: ['date'], reports: ['sentAt', 'workDate'], issues: ['date'],
      transactions: ['date'], signatures: ['date'], bids: ['date'] };
    const edge = Date.now() - 2 * 86400000;
    let maxFuture = 0;
    Object.keys(FIELDS).forEach(coll => db[coll].forEach(r => FIELDS[coll].forEach(f => {
      const t = +new Date(r[f]);
      if (t > edge && t > maxFuture) maxFuture = t;
    })));
    if (maxFuture) {
      const delta = maxFuture - edge;
      Object.keys(FIELDS).forEach(coll => db[coll].forEach(r => FIELDS[coll].forEach(f => {
        const t = +new Date(r[f]);
        if (t > edge) r[f] = new Date(t - delta).toISOString();
      })));
    }

    /* Стартовые уведомления: то, что уже ждёт каждую роль */
    db.notifications.push(
      { id: uid('nt'), to: 'admin', kind: 'application', date: daysAgo(2),
        title: 'Новая заявка от жителя',
        text: 'Мария К. отправила заявку «Освещение дорожки к детскому саду № 21» — нужна проверка и смета.',
        link: 'project.html?id=demo-inbox', read: false },
      { id: uid('nt'), to: 'admin', kind: 'issue', date: daysAgo(1),
        title: 'Замечание жителя на модерации',
        text: 'Воркаут-площадка в Заовражье: «после дождя на новом покрытии стоит вода».',
        link: 'cabinet.html#notify', read: false },
      { id: uid('nt'), to: 'u-citizen', kind: 'status', date: daysAgo(2),
        title: 'Заявка принята в обработку',
        text: 'Ваша заявка «Освещение дорожки к детскому саду № 21» зарегистрирована и ждёт решения администрации.',
        link: 'project.html?id=demo-inbox', read: false },
      { id: uid('nt'), to: 'contractor', kind: 'tender', date: daysAgo(6),
        title: 'Открыты торги по 44-ФЗ',
        text: 'Лестница к парку «Белкино», НМЦК 980 000 ₽. Приём заявок открыт.',
        link: 'tender.html?id=demo-tender', read: false }
    );

    return db;
  },

  /* ---------------- Доступ ---------------- */
  all(coll) { return this.data[coll] || []; },
  user(id) { return this.data.users.find(u => u.id === id) || null; },
  usersByRole(role) { return this.data.users.filter(u => u.role === role); },

  /* ---------------- Уведомления ----------------
     Адрес получателя: роль ('admin', 'contractor', 'citizen') или конкретный
     идентификатор пользователя ('u-citizen'). Одно действие одной роли
     превращается в задачу для другой — это и есть «маршрут» процесса. */
  notify(to, n) {
    if (!to) return null;
    const rec = {
      id: uid('nt'), to, kind: n.kind || 'info', date: nowISO(),
      title: n.title, text: n.text || '', link: n.link || '', read: false
    };
    this.data.notifications.push(rec);
    this.save();
    return rec;
  },
  /* Уведомить всех подрядчиков, кроме указанного */
  notifyContractors(n, exceptId) {
    this.usersByRole('contractor').forEach(u => {
      if (u.id !== exceptId) this.notify(u.id, n);
    });
  },
  notifications(user) {
    if (!user) return [];
    return this.data.notifications
      .filter(n => n.to === user.id || n.to === user.role)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },
  unreadCount(user) { return this.notifications(user).filter(n => !n.read).length; },
  markRead(user, id) {
    this.notifications(user).forEach(n => { if (!id || n.id === id) n.read = true; });
    this.save();
  },
  /* Владелец проекта — адресат «ответов» по его инициативе */
  ownerOf(projectId) {
    const p = this.project(projectId);
    return p ? p.ownerId : null;
  },
  contractorOf(projectId) {
    const p = this.project(projectId);
    return p && p.contract ? p.contract.contractorId : null;
  },

  projects(filter) {
    let list = this.data.projects.slice();
    if (filter && filter.status) list = list.filter(p => p.status === filter.status);
    if (filter && filter.phase) list = list.filter(p => STATUS[p.status].phase === filter.phase);
    if (filter && filter.public) list = list.filter(p => !['draft', 'submitted', 'review', 'rework', 'rejected'].includes(p.status));
    if (filter && filter.owner) list = list.filter(p => p.ownerId === filter.owner);
    return list;
  },
  project(id) { return this.data.projects.find(p => p.id === id) || null; },

  /* ---------------- Деньги ---------------- */
  tx(projectId) {
    return this.data.transactions.filter(t => t.projectId === projectId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },
  txByUser(userId) {
    return this.data.transactions.filter(t => t.userId === userId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },
  /* Собрано = только подтверждённые поступления */
  raised(projectId) {
    return this.data.transactions
      .filter(t => t.projectId === projectId && t.status === 'confirmed')
      .reduce((s, t) => s + t.amount, 0);
  },
  donors(projectId) {
    const list = this.data.transactions.filter(t => t.projectId === projectId && t.status === 'confirmed');
    const named = new Set(list.filter(t => t.userId).map(t => t.userId));
    const bulk = list.filter(t => !t.userId).length ? this.project(projectId) : null;
    /* сводное поступление считаем как «остальные плательщики» */
    const bulkCount = list.filter(t => !t.userId)
      .reduce((s, t) => s + (parseInt(String(t.userName), 10) || 0), 0);
    return named.size + bulkCount;
  },
  progress(projectId) {
    const p = this.project(projectId);
    if (!p || !p.goal) return 0;
    return Math.min(100, Math.round(this.raised(projectId) / p.goal * 100));
  },
  leftToRaise(projectId) {
    const p = this.project(projectId);
    return Math.max(0, p.goal - this.raised(projectId));
  },

  pay(projectId, userId, amount, status, opt) {
    const u = this.user(userId);
    const p = this.project(projectId);
    const business = !!(opt && opt.business) || (u && u.role === 'contractor');
    const t = {
      id: uid('tx'), no: 'TX-' + Math.floor(2027000 + Math.random() * 9000),
      projectId, userId, userName: u ? u.name : 'Гость',
      payer: business ? 'business' : 'citizen',
      amount: Math.round(amount), date: nowISO(), method: business ? 'счёт юрлица' : 'карта',
      status: status || 'confirmed'
    };
    this.data.transactions.push(t);
    this.addEvent(projectId, {
      title: (business ? 'Софинансирование от бизнеса ' : 'Поступление ') + amount.toLocaleString('ru-RU') + ' ₽',
      text: business
        ? t.userName + ' внесла инициативный платёж как юридическое лицо — ' + t.no +
          '. Средства идут в бюджет города наравне со взносами жителей (ст. 70 ФЗ-33).'
        : 'Взнос от ' + t.userName + ' — ' + t.no + ', договор пожертвования и чек сформированы.',
      actor: business ? 'бизнес' : 'платформа'
    });
    if (business) {
      this.notify('admin', { kind: 'money',
        title: 'Софинансирование от организации',
        text: t.userName + ' внесла ' + t.amount.toLocaleString('ru-RU') + ' ₽ в проект «' +
          (p ? p.title : '') + '». Платёж зачислен в бюджет города.',
        link: 'project.html?id=' + projectId });
    }
    if (p && p.ownerId && p.ownerId !== userId) {
      this.notify(p.ownerId, { kind: 'money',
        title: 'Новый взнос в ваш проект',
        text: t.userName + ' поддержал(а) «' + p.title + '» на ' + t.amount.toLocaleString('ru-RU') + ' ₽.',
        link: 'project.html?id=' + projectId });
    }
    this.save();
    this.checkGoal(projectId);
    return t;
  },

  refund(projectId, reason) {
    let sum = 0;
    this.data.transactions.forEach(t => {
      if (t.projectId === projectId && t.status === 'confirmed') { t.status = 'refunded'; sum += t.amount; }
    });
    const p = this.project(projectId);
    p.status = 'refunded';
    this.addEvent(projectId, {
      title: 'Возврат взносов жителям',
      text: 'Проект не реализован: ' + (reason || 'решение администрации') +
        '. Возвращено ' + sum.toLocaleString('ru-RU') + ' ₽ плательщикам на карты, с которых поступила оплата (ст. 70 ФЗ-33).',
      actor: 'платформа'
    });
    const payers = [...new Set(this.tx(projectId).map(t => t.userId).filter(Boolean))];
    payers.forEach(uid2 => this.notify(uid2, { kind: 'money',
      title: 'Возврат взноса',
      text: 'Проект «' + p.title + '» не реализован — ваш взнос возвращён на карту, с которой поступила оплата (ст. 70 ФЗ-33).',
      link: 'project.html?id=' + projectId }));
    this.save();
    return sum;
  },

  /* Автопереход при достижении цели сбора */
  checkGoal(projectId) {
    const p = this.project(projectId);
    if (!p || p.status !== 'collecting') return false;
    if (this.raised(projectId) < p.goal) return false;
    p.status = 'goal';
    this.addEvent(projectId, {
      title: 'Цель сбора достигнута',
      text: 'Собрано ' + this.raised(projectId).toLocaleString('ru-RU') + ' ₽ из ' +
        p.goal.toLocaleString('ru-RU') + ' ₽. Сбор закрыт, платформа формирует пакет документов для администрации.',
      actor: 'платформа'
    });
    this.notify('admin', { kind: 'money',
      title: 'Цель сбора достигнута',
      text: '«' + p.title + '»: жители собрали свою долю полностью. Нужно принять пакет документов.',
      link: 'project.html?id=' + projectId });
    if (p.ownerId) this.notify(p.ownerId, { kind: 'money',
      title: 'Ваш проект собрал нужную сумму',
      text: '«' + p.title + '» — доля жителей собрана. Пакет документов ушёл в администрацию.',
      link: 'project.html?id=' + projectId });
    this.save();
    return true;
  },

  /* ---------------- Подписи ---------------- */
  signatures(projectId) {
    return this.data.signatures.filter(s => s.projectId === projectId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },
  signaturesByUser(userId) { return this.data.signatures.filter(s => s.userId === userId); },
  hasSigned(projectId, userId) {
    return this.data.signatures.some(s => s.projectId === projectId && s.userId === userId);
  },
  sign(projectId, userId) {
    if (this.hasSigned(projectId, userId)) return { added: false };
    const u = this.user(userId);
    this.data.signatures.push({
      id: uid('sg'), projectId, userId, userName: u ? u.name : 'Житель', date: nowISO()
    });
    const p = this.project(projectId);
    const count = this.signatures(projectId).length;
    this.addEvent(projectId, {
      title: 'Электронная подпись жителя',
      text: (u ? u.name : 'Житель') + ' подписал(а) заявку через Госуслуги. Подписей: ' + count + ' из ' + p.signNeed + '.',
      actor: 'житель'
    });
    let moved = false;
    if (p.status === 'signing' && count >= p.signNeed) {
      p.status = 'collecting';
      p.daysLeft = 40;
      p.deadline = 'через 40 рабочих дней';
      this.addEvent(projectId, {
        title: 'Набрано необходимое число подписей',
        text: 'Собрано ' + count + ' подписей при норме ' + p.signNeed +
          ' (ст. 49 ФЗ-33). Протокол собрания сформирован, открыт сбор софинансирования.',
        actor: 'платформа'
      });
      this.notify('admin', { kind: 'status',
        title: 'Собраны подписи, открыт сбор средств',
        text: '«' + p.title + '»: ' + count + ' подписей при норме ' + p.signNeed +
          '. Срок сбора — 40 рабочих дней (п. 8.2).',
        link: 'project.html?id=' + projectId });
      if (p.ownerId) this.notify(p.ownerId, { kind: 'status',
        title: 'Подписи собраны',
        text: 'По проекту «' + p.title + '» набрано нужное число подписей — открыт сбор средств.',
        link: 'project.html?id=' + projectId });
      moved = true;
    }
    this.save();
    return { added: true, count, moved };
  },

  /* ---------------- Хроника ---------------- */
  events(projectId) {
    return this.data.events.filter(e => e.projectId === projectId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },
  addEvent(projectId, ev) {
    this.data.events.push({
      id: uid('ev'), projectId, date: ev.date || nowISO(),
      title: ev.title, text: ev.text || '', actor: ev.actor || 'платформа',
      att: ev.att || null
    });
    this.save();
  },

  /* ---------------- Замечания жителей ---------------- */
  issues(projectId, opt) {
    let list = this.data.issues.filter(i => i.projectId === projectId);
    if (opt && opt.published) list = list.filter(i => i.status === 'published');
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  },
  issuesByStatus(status) { return this.data.issues.filter(i => i.status === status); },
  addIssue(projectId, userId, text, photos) {
    const u = this.user(userId);
    const is = {
      id: uid('is'), projectId, userId, userName: u ? u.name : 'Житель', role: 'житель',
      text, photos: photos || [], date: nowISO(), status: 'moderation', adminComment: ''
    };
    this.data.issues.push(is);
    this.addEvent(projectId, {
      title: 'Замечание жителя отправлено на модерацию',
      text: text.slice(0, 140), actor: 'житель'
    });
    const p = this.project(projectId);
    this.notify('admin', { kind: 'issue',
      title: 'Новое замечание жителя — нужна модерация',
      text: (p ? '«' + p.title + '»: ' : '') + text.slice(0, 120),
      link: 'cabinet.html#notify' });
    this.save();
    return is;
  },
  moderateIssue(issueId, decision, comment) {
    const is = this.data.issues.find(i => i.id === issueId);
    if (!is) return null;
    is.status = decision;
    is.adminComment = comment || '';
    this.addEvent(is.projectId, {
      title: decision === 'published' ? 'Замечание опубликовано' : 'Замечание отклонено модератором',
      text: (decision === 'published'
        ? 'Замечание жителя видно в карточке проекта и передано подрядчику. '
        : 'Замечание не опубликовано. ') + (comment || ''),
      actor: 'администрация'
    });
    const p = this.project(is.projectId);
    this.notify(is.userId, { kind: 'issue',
      title: decision === 'published' ? 'Ваше замечание опубликовано' : 'Ваше замечание отклонено',
      text: (p ? '«' + p.title + '». ' : '') + (comment || ''),
      link: 'project.html?id=' + is.projectId });
    const cid = this.contractorOf(is.projectId);
    if (decision === 'published' && cid) this.notify(cid, { kind: 'issue',
      title: 'Замечание жителя по вашему объекту',
      text: (p ? '«' + p.title + '»: ' : '') + is.text.slice(0, 120),
      link: 'project.html?id=' + is.projectId });
    this.save();
    return is;
  },

  /* ---------------- Торги ---------------- */
  bids(projectId) { return this.data.bids.filter(b => b.projectId === projectId); },
  bidsByContractor(cid) { return this.data.bids.filter(b => b.contractorId === cid); },
  hasBid(projectId, cid) { return this.data.bids.some(b => b.projectId === projectId && b.contractorId === cid); },
  addBid(projectId, contractorId, price, term) {
    if (this.hasBid(projectId, contractorId)) return { added: false };
    const u = this.user(contractorId);
    this.data.bids.push({
      id: uid('bd'), projectId, contractorId, contractorName: u.name, inn: u.inn || '',
      price: Math.round(price), discount: 0, term: term || '45 дней',
      exp: (u.done || 0) + ' исполненных контрактов', done: u.done || 0, fail: u.fail || 0,
      status: 'submitted', why: '', date: nowISO()
    });
    const p = this.project(projectId);
    const nmck = p.tender ? p.tender.nmck : p.cost;
    const total = this.bids(projectId).length;
    this.addEvent(projectId, {
      title: 'Подана заявка на участие в торгах',
      text: u.name + ' подал(а) заявку с ценой ' + Math.round(price).toLocaleString('ru-RU') + ' ₽.',
      actor: 'подрядчик'
    });
    this.notify('admin', { kind: 'bid',
      title: 'Новая заявка подрядчика на торгах',
      text: u.name + ' подал(а) заявку по объекту «' + p.title + '»: ' +
        Math.round(price).toLocaleString('ru-RU') + ' ₽ при НМЦК ' + nmck.toLocaleString('ru-RU') +
        ' ₽. Всего заявок: ' + total + '.',
      link: 'tender.html?id=' + projectId });
    if (p.ownerId) this.notify(p.ownerId, { kind: 'bid',
      title: 'На ваш проект подана заявка подрядчика',
      text: '«' + p.title + '»: заявок на торгах — ' + total + '. Победителя определяет администрация.',
      link: 'tender.html?id=' + projectId });
    this.notify(contractorId, { kind: 'bid',
      title: 'Заявка принята платформой',
      text: 'Ваша заявка по объекту «' + p.title + '» зарегистрирована и передана администрации. ' +
        'Статус отбора появится здесь же.',
      link: 'tender.html?id=' + projectId });
    this.save();
    return { added: true };
  },
  chooseWinner(projectId, bidId) {
    const p = this.project(projectId);
    let win = null;
    this.bids(projectId).forEach(b => {
      if (b.id === bidId) { b.status = 'winner'; win = b; }
      else if (b.status === 'winner') b.status = 'submitted';
    });
    if (!win) return null;
    p.contract = {
      number: '№ ' + (60 + this.data.projects.indexOf(p)) + '-МК/2026',
      contractorId: win.contractorId, sum: win.price, paid: 0,
      start: dateRU(nowISO()), finish: 'по графику подрядчика',
      curator: 'Отдел благоустройства администрации г. Обнинска',
      publicCheck: '3 общественных инспектора от инициативной группы'
    };
    if (!p.plan_items.length) {
      p.plan_items = [
        { id: uid('pl'), t: 'Подготовка территории', p: 0, st: 'now', d: 'этап 1' },
        { id: uid('pl'), t: 'Основные работы', p: 0, st: 'wait', d: 'этап 2' },
        { id: uid('pl'), t: 'Монтаж оборудования', p: 0, st: 'wait', d: 'этап 3' },
        { id: uid('pl'), t: 'Благоустройство и сдача', p: 0, st: 'wait', d: 'этап 4' }
      ];
    }
    p.status = 'works';
    if (p.tender) p.tender.open = false;
    this.addEvent(projectId, {
      title: 'Определён победитель торгов',
      text: win.contractorName + ' — цена контракта ' + win.price.toLocaleString('ru-RU') + ' ₽' +
        (p.tender ? ', экономия ' + (p.tender.nmck - win.price).toLocaleString('ru-RU') + ' ₽ от НМЦК' : '') +
        '. Контракт ' + p.contract.number + ' заключён.',
      actor: 'администрация'
    });
    this.notify(win.contractorId, { kind: 'win',
      title: 'Вы победили в отборе',
      text: 'Объект «' + p.title + '», контракт ' + p.contract.number + ' на ' +
        win.price.toLocaleString('ru-RU') + ' ₽. Заполните график работ и отправляйте отчёты по этапам.',
      link: 'project.html?id=' + projectId });
    this.bids(projectId).forEach(b => {
      if (b.id !== bidId) this.notify(b.contractorId, { kind: 'bid',
        title: 'Отбор завершён — победил другой участник',
        text: 'Объект «' + p.title + '»: победитель ' + win.contractorName + ', цена ' +
          win.price.toLocaleString('ru-RU') + ' ₽.',
        link: 'tender.html?id=' + projectId });
    });
    if (p.ownerId) this.notify(p.ownerId, { kind: 'win',
      title: 'По вашему проекту выбран подрядчик',
      text: '«' + p.title + '»: ' + win.contractorName + ', контракт ' + p.contract.number + '. Начинаются работы.',
      link: 'project.html?id=' + projectId });
    this.save();
    return win;
  },

  /* ---------------- Отчёты подрядчика ---------------- */
  reports(projectId) {
    return this.data.reports.filter(r => r.projectId === projectId)
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
  },
  reportsByContractor(cid) { return this.data.reports.filter(r => r.contractorId === cid); },
  addReport(projectId, contractorId, data) {
    const r = {
      id: uid('rp'), projectId, contractorId,
      stage: data.stage, workDate: data.workDate, sentAt: nowISO(),
      text: data.text, photos: data.photos || [], docs: data.docs || [],
      status: 'sent'
    };
    this.data.reports.push(r);
    const p = this.project(projectId);
    const item = p.plan_items.find(i => i.t === data.stage);
    if (item && data.percent != null) {
      item.p = data.percent;
      item.st = data.percent >= 100 ? 'done' : 'now';
      const idx = p.plan_items.indexOf(item);
      if (data.percent >= 100 && p.plan_items[idx + 1] && p.plan_items[idx + 1].st === 'wait') {
        p.plan_items[idx + 1].st = 'now';
      }
    }
    this.addEvent(projectId, {
      title: 'Отчёт подрядчика по этапу «' + data.stage + '»',
      text: data.text + ' · фотографий: ' + (data.photos || []).length +
        ', документов: ' + (data.docs || []).length +
        '. Дата работ: ' + dateRU(data.workDate) + ', отправлен ' + dateTimeRU(r.sentAt) + '.',
      actor: 'подрядчик'
    });
    const u = this.user(contractorId);
    this.notify('admin', { kind: 'report',
      title: 'Отчёт подрядчика на приёмку',
      text: (u ? u.name : 'Подрядчик') + ' · «' + p.title + '», этап «' + data.stage +
        '». Нужно принять этап или вернуть на доработку.',
      link: 'project.html?id=' + projectId + '&tab=works' });
    if (p.ownerId) this.notify(p.ownerId, { kind: 'report',
      title: 'Новый отчёт по вашему проекту',
      text: '«' + p.title + '»: этап «' + data.stage + '», фотографий — ' + (data.photos || []).length + '.',
      link: 'project.html?id=' + projectId + '&tab=works' });
    this.save();
    return r;
  },
  acceptReport(reportId, accepted, comment) {
    const r = this.data.reports.find(x => x.id === reportId);
    if (!r) return null;
    r.status = accepted ? 'accepted' : 'returned';
    r.adminComment = comment || '';
    const p = this.project(r.projectId);
    if (accepted && p.contract) {
      const step = Math.round(p.contract.sum / Math.max(1, p.plan_items.length));
      p.contract.paid = Math.min(p.contract.sum, p.contract.paid + step);
    }
    this.addEvent(r.projectId, {
      title: accepted ? 'Отчёт принят администрацией' : 'Отчёт возвращён подрядчику',
      text: (accepted ? 'Этап «' + r.stage + '» принят, оплата по акту КС-2 отправлена в казначейство. '
        : 'Этап «' + r.stage + '» возвращён на доработку. ') + (comment || ''),
      actor: 'администрация'
    });
    this.notify(r.contractorId, { kind: 'report',
      title: accepted ? 'Отчёт принят администрацией' : 'Отчёт возвращён на доработку',
      text: '«' + p.title + '», этап «' + r.stage + '». ' +
        (accepted ? 'Оплата этапа по акту КС-2 передана в казначейство.' : (comment || 'См. комментарий администрации.')),
      link: 'project.html?id=' + r.projectId + '&tab=works' });
    if (p.ownerId) this.notify(p.ownerId, { kind: 'report',
      title: accepted ? 'Этап работ принят' : 'Этап работ возвращён подрядчику',
      text: '«' + p.title + '»: этап «' + r.stage + '» — ' + (accepted ? 'принят администрацией.' : 'отправлен на доработку.'),
      link: 'project.html?id=' + r.projectId + '&tab=works' });
    this.save();
    return r;
  },
  worksProgress(projectId) {
    const p = this.project(projectId);
    if (!p || !p.plan_items.length) return 0;
    return Math.round(p.plan_items.reduce((s, i) => s + (i.p || 0), 0) / p.plan_items.length);
  },

  /* ---------------- История просмотров ---------------- */
  trackView(userId, projectId) {
    if (!userId) return;
    const v = this.data.views.find(x => x.userId === userId && x.projectId === projectId);
    if (v) v.lastSeen = nowISO();
    else this.data.views.push({ userId, projectId, lastSeen: nowISO() });
    this.save();
  },
  viewsByUser(userId) {
    return this.data.views.filter(v => v.userId === userId)
      .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
  },

  /* ---------------- Заявки и статусы ---------------- */
  setStatus(projectId, status, opt) {
    const p = this.project(projectId);
    if (!p) return null;
    const from = p.status;
    p.status = status;
    if (opt && opt.comment !== undefined) p.adminComment = opt.comment;
    this.addEvent(projectId, {
      title: (opt && opt.title) || ('Статус: ' + STATUS[status].n),
      text: (opt && opt.text) || ('Проект переведён из «' + STATUS[from].n + '» в «' + STATUS[status].n + '».'),
      actor: (opt && opt.actor) || 'администрация'
    });

    /* Кому и что «прилетает» при смене статуса */
    const link = 'project.html?id=' + projectId;
    const toOwner = t => { if (p.ownerId) this.notify(p.ownerId, Object.assign({ kind: 'status', link }, t)); };
    if (status === 'submitted') {
      this.notify('admin', { kind: 'application', link,
        title: 'Новая заявка на рассмотрение',
        text: p.ownerName + ' отправил(а) заявку «' + p.title + '». Оценка стоимости — ' +
          (p.cost || 0).toLocaleString('ru-RU') + ' ₽.' });
      toOwner({ title: 'Заявка отправлена в администрацию',
        text: '«' + p.title + '» зарегистрирована. Ответ придёт сюда же.' });
    }
    if (status === 'review') toOwner({ title: 'Заявка взята в работу',
      text: '«' + p.title + '»: куратор проверяет данные и смету.' });
    if (status === 'rework') toOwner({ title: 'Заявка возвращена на доработку',
      text: '«' + p.title + '». ' + ((opt && opt.comment) || 'См. комментарий администрации.'),
      link: 'create.html?id=' + projectId });
    if (status === 'rejected') toOwner({ title: 'Заявка отклонена',
      text: '«' + p.title + '». ' + ((opt && opt.comment) || 'См. обоснование администрации.') });
    if (status === 'approved') toOwner({ title: 'Заявка одобрена',
      text: '«' + p.title + '»: комиссия одобрила проект, смета зафиксирована.' });
    if (status === 'signing') toOwner({ title: 'Проект опубликован',
      text: '«' + p.title + '» появился в реестре — идёт сбор подписей жителей.' });
    if (status === 'documents') this.notify('admin', { kind: 'docs', link,
      title: 'Пакет документов поступил',
      text: '«' + p.title + '»: реестр взносов и договоры подписаны, нужен приём пакета.' });
    if (status === 'procurement') {
      this.notifyContractors({ kind: 'tender',
        title: 'Открыты торги по 44-ФЗ',
        text: '«' + p.title + '», НМЦК ' + ((p.tender && p.tender.nmck) || p.cost || 0).toLocaleString('ru-RU') +
          ' ₽. Приём заявок открыт.',
        link: 'tender.html?id=' + projectId });
      toOwner({ title: 'По вашему проекту объявлены торги',
        text: '«' + p.title + '»: извещение опубликовано, идёт отбор подрядчика.' });
    }
    if (status === 'done') toOwner({ title: 'Проект завершён',
      text: '«' + p.title + '»: объект принят, опубликован итоговый отчёт.' });
    this.save();
    return p;
  },

  createProject(userId, data) {
    const u = this.user(userId);
    const p = {
      id: 'p-' + Date.now().toString(36),
      title: data.title || 'Без названия',
      cat: data.cat || 'Благоустройство',
      cover: 'cv-' + (1 + Math.floor(Math.random() * 6)),
      addr: data.addr || '', district: data.district || 'Центр',
      summary: data.summary || '', problem: data.problem || '', result: data.result || '',
      idea: data.idea || '', plan: data.plan || '',
      ownerId: userId, ownerName: u ? u.name : 'Житель',
      groupNote: 'инициативная группа жителей',
      cost: data.cost || 0, sharePct: data.sharePct || 10, goal: Math.round((data.cost || 0) * (data.sharePct || 10) / 100),
      signNeed: 10, deadline: 'после одобрения', daysLeft: null,
      smeta: data.smeta || [], smetaApproved: false,
      status: 'draft', createdByRole: (u ? u.role : 'citizen'),
      docs: [], docsPack: null, tender: null, contract: null,
      plan_items: [], report: null, createdAt: nowISO()
    };
    this.data.projects.push(p);
    this.addEvent(p.id, { title: 'Черновик проекта создан', text: 'Житель начал заполнять заявку.', actor: 'житель' });
    this.save();
    return p;
  },

  updateProject(projectId, data) {
    const p = this.project(projectId);
    if (!p) return null;
    Object.assign(p, data);
    if (p.cost) p.goal = Math.round(p.cost * (p.sharePct || 10) / 100);
    this.save();
    return p;
  },

  deleteProject(projectId) {
    this.data.projects = this.data.projects.filter(p => p.id !== projectId);
    ['signatures', 'transactions', 'events', 'issues', 'bids', 'reports', 'views']
      .forEach(c => this.data[c] = this.data[c].filter(x => x.projectId !== projectId));
    this.save();
  },

  /* Смета: администрация правит статьи */
  smetaTotal(projectId) {
    const p = this.project(projectId);
    return (p.smeta || []).reduce((s, i) => s + i.q * i.u, 0);
  },
  setSmeta(projectId, items) {
    const p = this.project(projectId);
    p.smeta = items;
    p.cost = this.smetaTotal(projectId);
    p.goal = Math.round(p.cost * (p.sharePct || 10) / 100);
    this.save();
  },
  approveSmeta(projectId) {
    const p = this.project(projectId);
    p.smetaApproved = true;
    p.cost = this.smetaTotal(projectId);
    p.goal = Math.round(p.cost * (p.sharePct || 10) / 100);
    this.addEvent(projectId, {
      title: 'Смета утверждена администрацией',
      text: 'Итог сметы ' + p.cost.toLocaleString('ru-RU') + ' ₽, доля жителей ' + p.sharePct +
        '% — ' + p.goal.toLocaleString('ru-RU') + ' ₽.',
      actor: 'администрация'
    });
    this.save();
  }
};

DB.load();

/* ЭИБ · демо-база данных
   Все сущности связаны идентификаторами:
   пользователь → проект → подпись → транзакция → заявка подрядчика → этап работ →
   замечание → фото → отчёт → решение администрации → завершение проекта.

   Хранится в localStorage (ключ eib-db-v3). Сиды строятся из assets/js/data.js
   при первом запуске: статичные проекты разворачиваются в записи БД —
   транзакции, подписи, события хроники, заявки на торги, отчёты и замечания. */

const DB_KEY = 'eib-db-v3';

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
      if (raw) { this.data = JSON.parse(raw); return this.data; }
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
      issues: [], bids: [], reports: [], views: [], session: { role: 'guest' }
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
        docs: (p.docs || []).map(d => ({ ...d })),
        docsPack: p.docsPack || null,
        tender: p.tender ? { number: p.tender.number, law: p.tender.law, platform: p.tender.platform,
          nmck: p.tender.nmck, published: p.tender.published, bidsUntil: p.tender.bidsUntil,
          auctionAt: p.tender.auctionAt, term: p.tender.term, open: p.stage === 'contractor' } : null,
        contract: p.works ? { number: p.works.contract, contractorId: 'u-contractor',
          sum: p.works.sum, paid: p.works.paid, start: p.works.start, finish: p.works.finish,
          curator: p.works.curator, publicCheck: p.works.publicCheck } : null,
        plan_items: p.works ? p.works.plan.map(x => ({ id: uid('pl'), ...x })) : [],
        report: p.report || null,
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

    return db;
  },

  /* ---------------- Доступ ---------------- */
  all(coll) { return this.data[coll] || []; },
  user(id) { return this.data.users.find(u => u.id === id) || null; },
  usersByRole(role) { return this.data.users.filter(u => u.role === role); },

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

  pay(projectId, userId, amount, status) {
    const u = this.user(userId);
    const t = {
      id: uid('tx'), no: 'TX-' + Math.floor(2027000 + Math.random() * 9000),
      projectId, userId, userName: u ? u.name : 'Гость',
      amount: Math.round(amount), date: nowISO(), method: 'карта', status: status || 'confirmed'
    };
    this.data.transactions.push(t);
    this.addEvent(projectId, {
      title: 'Поступление ' + amount.toLocaleString('ru-RU') + ' ₽',
      text: 'Взнос от ' + t.userName + ' — ' + t.no + ', договор пожертвования и чек сформированы.',
      actor: 'платформа'
    });
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
    this.addEvent(projectId, {
      title: 'Подана заявка на участие в торгах',
      text: u.name + ' подал(а) заявку с ценой ' + Math.round(price).toLocaleString('ru-RU') + ' ₽.',
      actor: 'подрядчик'
    });
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
      status: 'draft', docs: [], docsPack: null, tender: null, contract: null,
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

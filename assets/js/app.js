/* ЭИБ · общий скрипт: сессия, шапка/подвал, логотип, обложки, карточки проектов.
   Данные берутся из демо-БД (assets/js/db.js), все сущности связаны идентификаторами. */

/* ---------- Сессия ---------- */
const Session = {
  get role() { return (DB.data.session && DB.data.session.role) || 'guest'; },
  get userId() { return DB.data.session && DB.data.session.userId; },
  get user() { return this.userId ? DB.user(this.userId) : null; },
  login(role) {
    const u = DB.data.users.find(x => x.role === role);
    DB.data.session = { role, userId: u ? u.id : null };
    DB.save();
  },
  logout() { DB.data.session = { role: 'guest' }; DB.save(); },
  is(role) { return this.role === role; }
};

/* Куда вернуть пользователя после входа и что он собирался сделать */
const Intent = {
  set(url, action, payload) {
    try { sessionStorage.setItem('eib-intent', JSON.stringify({ url, action, payload })); } catch (e) {}
  },
  take() {
    try {
      const raw = sessionStorage.getItem('eib-intent');
      sessionStorage.removeItem('eib-intent');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },
  peek() {
    try { const raw = sessionStorage.getItem('eib-intent'); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
};

/* Требуется вход: запоминаем страницу и намерение, уводим на форму входа */
function requireAuth(role, action, payload) {
  if (Session.role === role) return true;
  Intent.set(location.pathname + location.search, action, payload || null);
  toast('Для этого действия нужен вход через Госуслуги');
  setTimeout(() => location.href = 'login.html?role=' + role +
    '&next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search), 900);
  return false;
}

/* ---------- Формат ---------- */
const NBSP = '\u00A0';
/* Числа не разрываются переносом строки, знак рубля прилипает к сумме */
const fmt = n => (n === null || n === undefined || isNaN(n)) ? '—'
  : Number(n).toLocaleString('ru-RU').replace(/\s/g, NBSP);
const rub = n => (n === null || n === undefined || isNaN(n)) ? '—' : fmt(n) + NBSP + '₽';
/* Компактно для крупных плиток: 1,25 млн ₽ вместо 1 250 000 ₽ */
const rubShort = n => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (Math.abs(n) >= 1000000) {
    const v = n / 1000000;
    return (v >= 10 ? Math.round(v) : v.toFixed(2)).toString().replace('.', ',') + NBSP + 'млн' + NBSP + '₽';
  }
  if (Math.abs(n) >= 100000) return Math.round(n / 1000) + NBSP + 'тыс.' + NBSP + '₽';
  return rub(n);
};
/* Разбор суммы, введённой человеком: учитываем только цифры */
function parseMoney(raw) {
  const digits = String(raw == null ? '' : raw).replace(/[^0-9]/g, '');
  if (!digits) return null;
  const v = parseInt(digits, 10);
  return isNaN(v) || v <= 0 ? null : v;
}
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
const days = n => n + ' ' + plural(n, 'день', 'дня', 'дней');
const statusOf = p => STATUS[p.status] || STATUS.draft;
const phaseOf = p => statusOf(p).phase;
const phaseIndex = key => PHASES.findIndex(f => f.key === key);
const ROLE_LABEL = { citizen: 'Житель', admin: 'Администрация', contractor: 'Подрядчик', guest: 'Гость' };

/* Что видно в общем реестре: все проекты, включая заявки на рассмотрении.
   Скрыт только чужой черновик — его ещё не отправили. */
function visibleProjects() {
  return DB.projects().filter(p => p.status !== 'draft' || p.ownerId === Session.userId);
}

/* Сколько заявок ждёт решения администрации */
function adminInbox() {
  return DB.projects().filter(p => ['submitted', 'review'].includes(p.status));
}

/* ---------- Логотип ----------
   Знак: гексагон, урна для голосования и бюллетень с галочкой — голос жителя,
   который превращается в решение. Подпись: «ЭИБ | Электронное инициативное бюджетирование». */
function logoMark() {
  return `<svg viewBox="0 0 48 48" aria-hidden="true">
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path class="lm-hex" d="M24 3 43 13.5v21L24 45 5 34.5v-21z"/>
      <g class="lm-urn">
        <path d="M14 27.5V36a2.6 2.6 0 0 0 2.6 2.6h14.8A2.6 2.6 0 0 0 34 36v-8.5"/>
        <path d="M14 27.5h4.4M29.6 27.5H34"/>
      </g>
      <g transform="rotate(-16 24 18.6)">
        <rect class="lm-paper" x="19.4" y="9.2" width="9.2" height="19.4" rx="1.4"/>
        <path class="lm-check" d="m21.4 18.8 2.3 2.4 4.3-5.9"/>
      </g>
    </g>
  </svg>`;
}

function logo(cls) {
  return `<a class="logo ${cls || ''}" href="index.html" aria-label="ЭИБ — электронное инициативное бюджетирование">
    <span class="logo-mark">${logoMark()}</span>
    <span class="logo-t">
      <b>ЭИБ</b>
      <i class="logo-div"></i>
      <span>Электронное инициативное<br>бюджетирование</span>
    </span>
  </a>`;
}

/* ---------- Обложки проектов ---------- */
const COVER_ART = {
  'Благоустройство': `
    <path d="M0 168h400v40H0z" fill="rgba(255,255,255,.10)"/>
    <path d="M120 168c0-14 12-22 24-22s24 8 24 22" fill="rgba(255,255,255,.14)"/>
    <circle cx="86" cy="112" r="34" fill="rgba(255,255,255,.22)"/>
    <circle cx="112" cy="132" r="24" fill="rgba(255,255,255,.16)"/>
    <rect x="82" y="130" width="8" height="42" rx="4" fill="rgba(255,255,255,.34)"/>
    <circle cx="300" cy="96" r="44" fill="rgba(255,255,255,.18)"/>
    <circle cx="266" cy="122" r="28" fill="rgba(255,255,255,.13)"/>
    <rect x="295" y="120" width="10" height="52" rx="5" fill="rgba(255,255,255,.34)"/>
    <rect x="170" y="140" width="76" height="8" rx="4" fill="#FFD37A"/>
    <rect x="176" y="148" width="7" height="22" rx="3" fill="rgba(255,255,255,.5)"/>
    <rect x="233" y="148" width="7" height="22" rx="3" fill="rgba(255,255,255,.5)"/>
    <rect x="170" y="124" width="76" height="7" rx="3.5" fill="rgba(255,255,255,.45)"/>`,

  'Детская площадка': `
    <path d="M0 170h400v38H0z" fill="rgba(255,255,255,.10)"/>
    <path d="M108 170V96l58 74z" fill="rgba(255,255,255,.20)"/>
    <path d="M108 96h58l-6 12h-52z" fill="#FFD37A"/>
    <rect x="102" y="94" width="10" height="78" rx="5" fill="rgba(255,255,255,.4)"/>
    <rect x="228" y="86" width="112" height="9" rx="4.5" fill="rgba(255,255,255,.42)"/>
    <rect x="230" y="90" width="8" height="82" rx="4" fill="rgba(255,255,255,.3)"/>
    <rect x="332" y="90" width="8" height="82" rx="4" fill="rgba(255,255,255,.3)"/>
    <rect x="258" y="92" width="4" height="46" fill="rgba(255,255,255,.5)"/>
    <rect x="300" y="92" width="4" height="46" fill="rgba(255,255,255,.5)"/>
    <rect x="248" y="136" width="66" height="9" rx="4.5" fill="#FFD37A"/>
    <circle cx="190" cy="156" r="14" fill="rgba(255,255,255,.28)"/>`,

  'Спорт': `
    <path d="M0 170h400v38H0z" fill="rgba(255,255,255,.10)"/>
    <rect x="96" y="58" width="86" height="60" rx="8" fill="rgba(255,255,255,.20)"/>
    <rect x="120" y="82" width="38" height="30" rx="4" fill="rgba(255,255,255,.42)"/>
    <path d="M126 118h26v18a13 13 0 0 1-26 0z" fill="#FFD37A"/>
    <rect x="134" y="118" width="10" height="54" rx="5" fill="rgba(255,255,255,.3)"/>
    <rect x="238" y="72" width="9" height="100" rx="4.5" fill="rgba(255,255,255,.34)"/>
    <rect x="330" y="72" width="9" height="100" rx="4.5" fill="rgba(255,255,255,.34)"/>
    <rect x="238" y="72" width="101" height="9" rx="4.5" fill="rgba(255,255,255,.5)"/>
    <rect x="238" y="112" width="101" height="7" rx="3.5" fill="rgba(255,255,255,.28)"/>
    <circle cx="290" cy="150" r="17" fill="rgba(255,255,255,.24)"/>`,

  'Освещение': `
    <path d="M0 172h400v36H0z" fill="rgba(255,255,255,.10)"/>
    <path d="M118 78 74 172h88z" fill="rgba(255,211,122,.28)"/>
    <path d="M286 78 242 172h88z" fill="rgba(255,211,122,.20)"/>
    <rect x="113" y="72" width="11" height="100" rx="5" fill="rgba(255,255,255,.42)"/>
    <rect x="281" y="72" width="11" height="100" rx="5" fill="rgba(255,255,255,.34)"/>
    <rect x="100" y="58" width="38" height="16" rx="8" fill="#FFD37A"/>
    <rect x="268" y="58" width="38" height="16" rx="8" fill="rgba(255,211,122,.7)"/>
    <circle cx="196" cy="152" r="9" fill="rgba(255,255,255,.22)"/>
    <circle cx="356" cy="152" r="9" fill="rgba(255,255,255,.16)"/>`,

  'Дороги и тротуары': `
    <path d="M150 208 190 60h34l38 148z" fill="rgba(255,255,255,.16)"/>
    <rect x="196" y="72" width="12" height="20" rx="4" fill="rgba(255,255,255,.55)"/>
    <rect x="193" y="104" width="18" height="24" rx="5" fill="rgba(255,255,255,.5)"/>
    <rect x="188" y="142" width="28" height="30" rx="6" fill="rgba(255,255,255,.45)"/>
    <rect x="180" y="186" width="44" height="22" rx="7" fill="#FFD37A"/>
    <path d="M0 172h150v36H0z" fill="rgba(255,255,255,.10)"/>
    <path d="M262 172h138v36H262z" fill="rgba(255,255,255,.10)"/>
    <rect x="66" y="128" width="9" height="46" rx="4" fill="rgba(255,255,255,.3)"/>
    <circle cx="70" cy="120" r="13" fill="rgba(255,255,255,.24)"/>`,

  'Культура и досуг': `
    <path d="M0 172h400v36H0z" fill="rgba(255,255,255,.10)"/>
    <path d="M96 172V92a104 104 0 0 1 208 0v80z" fill="rgba(255,255,255,.14)"/>
    <path d="M124 172V96a76 76 0 0 1 152 0v76z" fill="rgba(255,255,255,.12)"/>
    <rect x="150" y="132" width="100" height="40" rx="6" fill="rgba(255,255,255,.30)"/>
    <circle cx="176" cy="118" r="11" fill="#FFD37A"/>
    <rect x="184" y="82" width="6" height="38" rx="3" fill="#FFD37A"/>
    <circle cx="222" cy="106" r="11" fill="rgba(255,255,255,.5)"/>
    <rect x="230" y="70" width="6" height="38" rx="3" fill="rgba(255,255,255,.5)"/>
    <rect x="184" y="70" width="52" height="6" rx="3" fill="rgba(255,255,255,.5)"/>`
};

function coverArt(p) {
  if (p.photo) return `<img class="cover-photo" src="assets/covers/${p.photo}" alt="${p.title}">`;
  const art = COVER_ART[p.cat] || COVER_ART['Благоустройство'];
  return `<svg class="cover-art" viewBox="0 0 400 208" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${art}</svg>`;
}

/* ---------- Партнёры ---------- */
function logoFallback(img) {
  const s = document.createElement('span');
  s.className = 'plog-mono';
  s.style.color = img.dataset.tint || '';
  s.style.background = (img.dataset.tint || '#12275C') + '18';
  s.textContent = img.dataset.mono || '';
  img.replaceWith(s);
}

function partnerTile(p, compact) {
  const s = PARTNER_STATUS[p.status] || PARTNER_STATUS.planned;
  const tint = p.tint || '#12275C';
  const mono = `<span class="plog-mono" style="color:${tint};background:${tint}18">${p.short}</span>`;
  const mark = p.logo
    ? `<img src="assets/logos/${p.logo}" alt="${p.name}" data-mono="${p.short}" data-tint="${tint}" onerror="logoFallback(this)">`
    : mono;
  if (compact) return `<span class="plog-min" title="${p.full} — ${s[1]}">${mark}<span>${p.name}</span></span>`;
  return `<div class="plog">
    <div class="plog-mark">${mark}</div>
    <div class="plog-tx"><b>${p.name}</b><small>${p.note}</small><span class="chip ${s[0]}">${s[1]}</span></div>
  </div>`;
}
function partners(compact) { return PARTNERS.map(p => partnerTile(p, compact)).join(''); }

/* ---------- Шапка и подвал ---------- */
function header(active) {
  const acc = Session.user;
  const inbox = (acc && acc.role === 'admin') ? adminInbox().length : 0;
  const nav = [
    ['index.html', 'Главная', 'home'],
    ['projects.html', 'Проекты', 'projects'],
    ['how.html', 'Как это работает', 'how'],
    ['about.html', 'О проекте', 'about'],
    ['cabinet.html', 'Кабинет', 'cabinet']
  ];
  const right = acc
    ? `<a class="who-badge" href="cabinet.html" title="Личный кабинет">
         <span class="av ${acc.badge}">${acc.init}</span>
         <span><b>${acc.name}</b><small>${ROLE_LABEL[acc.role]}</small></span>
       </a>
       <button class="btn btn-o btn-s btn-hide-sm" id="logout">Выйти</button>`
    : `<a class="btn btn-o btn-s btn-hide" href="login.html">Войти</a>
       <a class="btn btn-p btn-s btn-hide-sm" href="create.html">Предложить проект</a>`;

  return `<header class="hdr"><div class="wrap hdr-in">
    ${logo()}
    <nav class="mainnav" id="mainnav">
      ${nav.map(([h, t, k]) => `<a href="${h}" class="${k === active ? 'on' : ''}">${t}${k === 'cabinet' && inbox ? ' <span class="nav-badge">' + inbox + '</span>' : ''}</a>`).join('')}
      ${acc ? `<a href="#" class="mob-only" id="logoutM">Выйти · ${ROLE_LABEL[acc.role]}</a>`
            : `<a href="login.html" class="mob-only">Войти через Госуслуги</a>`}
      <a href="create.html" class="mob-only">Предложить проект</a>
    </nav>
    <div class="hdr-act">${right}<button class="burger" id="burger" aria-label="Меню">☰</button></div>
  </div></header>`;
}

function footer() {
  return `<footer class="ftr"><div class="wrap">
    <div class="ftr-in">
      <div>
        ${logo('logo-light')}
        <p style="margin-top:16px;max-width:330px">Цифровая платформа полного цикла инициативного
        бюджетирования: от идеи жителя до итогового отчёта. Пилот — город Обнинск, Калужская область.</p>
      </div>
      <div>
        <h4>Разделы</h4>
        <ul>
          <li><a href="projects.html">Проекты города</a></li>
          <li><a href="how.html">Как это работает</a></li>
          <li><a href="about.html">О проекте и партнёры</a></li>
          <li><a href="create.html">Предложить проект</a></li>
          <li><a href="login.html">Вход для участников</a></li>
        </ul>
      </div>
      <div>
        <h4>Правовая база</h4>
        <ul>
          <li><a href="how.html#pravo">Ст. 49 ФЗ-33 — инициативные проекты</a></li>
          <li><a href="how.html#pravo">Ст. 70 ФЗ-33 — инициативные платежи</a></li>
          <li><a href="how.html#pravo">Положение Обнинска № 05-22</a></li>
          <li><a href="how.html#pravo">44-ФЗ — закупки</a></li>
        </ul>
      </div>
      <div>
        <h4>Контакты пилота</h4>
        <ul>
          <li>г. Обнинск, Калужская область</li>
          <li><a href="tel:+79005802751">+7 (900) 580-27-51</a></li>
          <li><a href="mailto:tsembrovskijsa@tksu.ru">tsembrovskijsa@tksu.ru</a></li>
        </ul>
      </div>
    </div>
    <div class="ftr-partners">
      <h4>Партнёры и участники пилота</h4>
      <div class="plog-row">${partners(true)}</div>
      <p class="plog-note">Логотипы обозначают организации, с которыми ведётся работа по пилоту,
        и не означают их поддержки. Статус взаимодействия по каждой — в разделе
        <a href="about.html#partners">«О проекте»</a>.</p>
    </div>
    <div class="ftr-bot">
      <span>© ${CITY.year} ЭИБ — демонстрационный прототип платформы. Проекты и суммы приведены для показа механики.</span>
      <span>Данные хранятся в РФ · 152-ФЗ · вход через ЕСИА</span>
    </div>
  </div></footer>`;
}

/* ---------- Карточка проекта ---------- */
function projectCard(p) {
  const st = statusOf(p);
  const ph = st.phase;
  let bottom = '';

  if (ph === 'collecting') {
    const raised = DB.raised(p.id), percent = DB.progress(p.id), left = DB.leftToRaise(p.id);
    bottom = `
      <div class="money"><b>${rub(raised)}</b><span>из ${rub(p.goal)}</span></div>
      <div class="bar ${percent >= 100 ? 'ok' : ''}"><i style="width:${percent}%"></i></div>
      <div class="left-sum ${percent >= 100 ? 'done' : ''}">
        <span>${percent >= 100 ? 'Цель достигнута' : 'Осталось собрать'}</span><b>${rub(left)}</b></div>
      <div class="pmeta"><span class="left">${percent}% · ${DB.donors(p.id)} ${plural(DB.donors(p.id), 'плательщик', 'плательщика', 'плательщиков')}</span>
        <span class="right">${p.daysLeft ? days(p.daysLeft) + ' до конца' : ''}</span></div>`;
  } else if (ph === 'signing' || ph === 'idea') {
    const have = DB.signatures(p.id).length;
    const sp = Math.min(100, Math.round(have / (p.signNeed || 10) * 100));
    bottom = `
      <div class="money"><b>${have} из ${p.signNeed}</b><span>подписей</span></div>
      <div class="bar warn"><i style="width:${sp}%"></i></div>
      <div class="pmeta"><span class="left">Смета ${rub(p.cost)}</span>
        <span class="right">${p.ownerName}</span></div>`;
  } else if (ph === 'done') {
    bottom = `
      <div class="money"><b>${p.status === 'refunded' ? 'Средства возвращены' : 'Реализован'}</b>
        <span>${p.report ? p.report.openedAt : ''}</span></div>
      <div class="bar ok"><i style="width:100%"></i></div>
      <div class="left-sum done"><span>Жители вложили</span><b>${rub(DB.raised(p.id))}</b></div>
      <div class="pmeta"><span class="left">${p.report ? 'Оценка ' + String(p.report.rating).replace('.', ',') + ' из 5' : ''}</span>
        <span class="right">${p.report ? p.report.votes + ' оценок' : ''}</span></div>`;
  } else {
    const map = {
      documents: ['Пакет документов у администрации', p.docsPack ? p.docsPack.incoming : ''],
      procurement: ['Идут торги по 44-ФЗ', DB.bids(p.id).length + ' ' + plural(DB.bids(p.id).length, 'заявка', 'заявки', 'заявок')],
      works: ['Работы выполнены на ' + DB.worksProgress(p.id) + '%', p.contract ? (DB.user(p.contract.contractorId) || {}).name || '' : '']
    };
    const m = map[ph] || [st.n, ''];
    const w = ph === 'works' ? DB.worksProgress(p.id) : 100;
    bottom = `
      <div class="money"><b style="font-size:17px">${m[0]}</b></div>
      <div class="bar ${ph === 'works' ? '' : 'ok'}"><i style="width:${w}%"></i></div>
      <div class="pmeta"><span class="left">${rub(p.cost)}</span><span class="right">${m[1]}</span></div>`;
  }

  return `<a class="pcard" href="project.html?id=${p.id}">
    <div class="pcover ${p.cover}">
      ${coverArt(p)}
      <span class="chip"><span class="dt"></span>${st.n}</span>
      <span class="cat-pill">${p.cat}</span>
    </div>
    <div class="pbody">
      <h3>${p.title}</h3>
      <div class="ploc">📍 ${p.district}${p.addr ? ' · ' + p.addr.split('—')[0].trim() : ''}</div>
      ${bottom}
    </div>
  </a>`;
}

/* ---------- Мелкие утилиты интерфейса ---------- */
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add('on'));
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('on'), 3600);
}

function openModal(id) { const m = document.getElementById(id); if (m) m.classList.add('on'); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('on'); }
function param(n) { return new URLSearchParams(location.search).get(n); }
const esc = s => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

/* Фотографии в демо: файл не сохраняется, сохраняется его «карточка» */
const PHOTO_TINTS = [
  'linear-gradient(135deg,#2B5BF5,#12275C)', 'linear-gradient(135deg,#12A05C,#0B6B54)',
  'linear-gradient(135deg,#F0A020,#D9542B)', 'linear-gradient(135deg,#7a8ba6,#3d4e6b)',
  'linear-gradient(135deg,#0F9BC4,#125C8C)', 'linear-gradient(135deg,#a08b6a,#5d4a2e)'
];
function fakePhoto(caption, kind) {
  return { id: uid('ph'), caption: caption || 'Фотография', kind: kind || 'progress',
    css: PHOTO_TINTS[Math.floor(Math.random() * PHOTO_TINTS.length)] };
}
function photoGrid(photos) {
  if (!photos || !photos.length) return '<p class="muted">Фотографий нет.</p>';
  const label = { before: 'ДО', after: 'ПОСЛЕ', progress: '' };
  return `<div class="shots">${photos.map(f => `<div class="shot" style="background:${f.css}">
    ${label[f.kind] ? '<span class="shot-tag">' + label[f.kind] + '</span>' : ''}${esc(f.caption)}</div>`).join('')}</div>`;
}

/* ---------- Демо-переключатель ролей ---------- */
function demoBar() {
  try { if (sessionStorage.getItem('eib-demo-bar') === 'off') return; } catch (e) {}
  const roles = [['guest', 'Гость'], ['citizen', 'Житель'], ['admin', 'Администрация'], ['contractor', 'Подрядчик']];
  const el = document.createElement('div');
  el.className = 'demo-bar';
  el.innerHTML = `<b>Демо · смотреть как</b>` +
    roles.map(([k, n]) => `<button data-r="${k}" class="${Session.role === k ? 'on' : ''}">${n}</button>`).join('') +
    `<button class="x" title="Скрыть панель">×</button>`;
  document.body.appendChild(el);

  el.querySelectorAll('button[data-r]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.r === 'guest') Session.logout(); else Session.login(b.dataset.r);
    toast(b.dataset.r === 'guest' ? 'Режим гостя: видно только публичную часть'
      : 'Вы смотрите как ' + Session.user.name);
    setTimeout(() => location.reload(), 550);
  }));
  el.querySelector('.x').addEventListener('click', () => {
    try { sessionStorage.setItem('eib-demo-bar', 'off'); } catch (e) {}
    el.remove();
  });
}

/* ---------- Инициализация страницы ---------- */
function mount(active) {
  const h = document.getElementById('hdr');
  if (h) h.outerHTML = header(active);
  const f = document.getElementById('ftr');
  if (f) f.outerHTML = footer();

  const b = document.getElementById('burger');
  if (b) b.addEventListener('click', () => document.getElementById('mainnav').classList.toggle('open'));

  const bye = () => {
    Session.logout();
    toast('Вы вышли из системы');
    setTimeout(() => location.href = 'index.html', 600);
  };
  ['logout', 'logoutM'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => { e.preventDefault(); bye(); });
  });

  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => {
    if (e.target === m || e.target.classList.contains('modal-x')) m.classList.remove('on');
  }));

  demoBar();
}

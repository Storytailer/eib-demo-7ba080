/* ЭИБ · общий скрипт: роли, состояние, шапка/подвал, карточки проектов */

/* ---------- Состояние (демо: localStorage) ---------- */
const KEY = 'eib-demo-state-v1';

const State = {
  data: { role: 'guest', over: {}, my: [] },
  load() {
    try { this.data = Object.assign(this.data, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { /* приватный режим — работаем без сохранения */ }
    return this.data;
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {}
  },
  role() { return this.data.role || 'guest'; },
  setRole(r) { this.data.role = r; this.save(); },
  account() { return ACCOUNTS[this.role()] || null; },
  over(id) { return this.data.over[id] || (this.data.over[id] = {}); },
  patch(id, obj) { Object.assign(this.over(id), obj); this.save(); },
  reset() { this.data = { role: 'guest', over: {}, my: [] }; this.save(); }
};
State.load();

/* ---------- Данные с учётом действий пользователя ---------- */
function projects() {
  return PROJECTS.map(p => Object.assign({}, p, State.data.over[p.id] || {}));
}
function project(id) { return projects().find(p => p.id === id) || null; }
function stage(key) { return STAGES.find(s => s.key === key) || STAGES[0]; }
function stageIndex(key) { return STAGES.findIndex(s => s.key === key); }

/* ---------- Формат ---------- */
const fmt = n => (n === null || n === undefined) ? '—' : Number(n).toLocaleString('ru-RU');
const rub = n => fmt(n) + ' ₽';
const pct = p => p.goal ? Math.min(100, Math.round(p.raised / p.goal * 100)) : 0;
const left = p => Math.max(0, p.goal - p.raised);
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
const days = n => n + ' ' + plural(n, 'день', 'дня', 'дней');

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

/* ---------- Обложки проектов ----------
   Векторные сцены по категориям: одинаковый стиль, читаются на любом фоне.
   Если у проекта задано поле `photo` (файл в assets/covers/), показывается фотография. */
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
/* Файл логотипа не найден → возвращаемся к монограмме, без «битой картинки». */
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
  /* Пока файла логотипа нет в assets/logos/ — показываем монограмму в цветах организации. */
  const tint = p.tint || '#12275C';
  const mono = `<span class="plog-mono" style="color:${tint};background:${tint}18">${p.short}</span>`;
  const mark = p.logo
    ? `<img src="assets/logos/${p.logo}" alt="${p.name}" data-mono="${p.short}" data-tint="${tint}" onerror="logoFallback(this)">`
    : mono;
  if (compact) {
    return `<span class="plog-min" title="${p.full} — ${s[1]}">${mark}<span>${p.name}</span></span>`;
  }
  return `<div class="plog">
    <div class="plog-mark">${mark}</div>
    <div class="plog-tx">
      <b>${p.name}</b>
      <small>${p.note}</small>
      <span class="chip ${s[0]}">${s[1]}</span>
    </div>
  </div>`;
}

function partners(compact) {
  return PARTNERS.map(p => partnerTile(p, compact)).join('');
}

/* ---------- Шапка и подвал ---------- */
function header(active) {
  const acc = State.account();
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
       <a class="btn btn-p btn-s btn-hide-sm" href="submit.html">Подать инициативу</a>`;

  return `<header class="hdr"><div class="wrap hdr-in">
    ${logo()}
    <nav class="mainnav" id="mainnav">
      ${nav.map(([h, t, k]) => `<a href="${h}" class="${k === active ? 'on' : ''}">${t}</a>`).join('')}
      ${acc
        ? `<a href="#" class="mob-only" id="logoutM">Выйти · ${ROLE_LABEL[acc.role]}</a>`
        : `<a href="login.html" class="mob-only">Войти через Госуслуги</a>`}
      <a href="submit.html" class="mob-only">Подать инициативу</a>
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
          <li><a href="submit.html">Подать инициативу</a></li>
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
  const s = stage(p.stage);
  const percent = pct(p);
  let bottom = '';

  if (p.stage === 'collecting') {
    bottom = `
      <div class="money"><b>${rub(p.raised)}</b><span>из ${rub(p.goal)}</span></div>
      <div class="bar ${percent >= 100 ? 'ok' : ''}"><i style="width:${percent}%"></i></div>
      <div class="left-sum"><span>Осталось собрать</span><b>${rub(left(p))}</b></div>
      <div class="pmeta"><span class="left">${percent}% · ${p.donors} ${plural(p.donors, 'житель', 'жителя', 'жителей')}</span>
        <span class="right">${p.daysLeft ? days(p.daysLeft) + ' до конца' : ''}</span></div>`;
  } else if (p.stage === 'idea') {
    const sp = Math.min(100, Math.round(p.signatures.count / p.signatures.need * 100));
    bottom = `
      <div class="money"><b>${p.signatures.count} из ${p.signatures.need}</b><span>подписей</span></div>
      <div class="bar warn"><i style="width:${sp}%"></i></div>
      <div class="pmeta"><span class="left">Смета ${rub(p.cost)}</span><span class="right">${p.votes} ${plural(p.votes, "голос", "голоса", "голосов")}</span></div>`;
  } else if (p.stage === 'done') {
    bottom = `
      <div class="money"><b>Реализован</b><span>${p.report.openedAt}</span></div>
      <div class="bar ok"><i style="width:100%"></i></div>
      <div class="left-sum done"><span>Жители вложили</span><b>${rub(p.raised)}</b></div>
      <div class="pmeta"><span class="left">Оценка ${String(p.report.rating).replace('.', ',')} из 5</span>
        <span class="right">${p.report.votes} ${plural(p.report.votes, "оценка", "оценки", "оценок")}</span></div>`;
  } else {
    const map = {
      documents: ['Пакет документов отправлен', p.docsPack ? p.docsPack.incoming : ''],
      contractor: ['Закупка по 44-ФЗ', p.tender ? '№ ' + p.tender.number : ''],
      works: ['Работы выполнены на ' + (p.works ? p.works.progress : 0) + '%', p.works ? p.works.contractor : '']
    };
    const m = map[p.stage] || ['', ''];
    const w = p.stage === 'works' ? p.works.progress : 100;
    bottom = `
      <div class="money"><b>${m[0]}</b></div>
      <div class="bar ${p.stage === 'works' ? '' : 'ok'}"><i style="width:${w}%"></i></div>
      <div class="pmeta"><span class="left">${rub(p.cost)}</span><span class="right">${m[1]}</span></div>`;
  }

  return `<a class="pcard" href="project.html?id=${p.id}">
    <div class="pcover ${p.cover}">
      ${coverArt(p)}
      <span class="chip"><span class="dt"></span>${s.name}</span>
      <span class="cat-pill">${p.cat}</span>
    </div>
    <div class="pbody">
      <h3>${p.title}</h3>
      <div class="ploc">📍 ${p.district} · ${p.addr.split('—')[0].trim()}</div>
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
  t._t = setTimeout(() => t.classList.remove('on'), 3400);
}

function openModal(id) { const m = document.getElementById(id); if (m) m.classList.add('on'); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('on'); }

function tabs(root) {
  const box = document.querySelector(root);
  if (!box) return;
  box.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
    box.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll(b.dataset.scope + ' .tab-pane').forEach(p =>
      p.classList.toggle('on', p.dataset.pane === b.dataset.tab));
  }));
}

function param(n) { return new URLSearchParams(location.search).get(n); }

/* ---------- Демо-переключатель ролей ----------
   Показывает один и тот же экран глазами жителя, администрации и подрядчика
   без выхода и повторного входа. В боевой версии этой панели нет. */
function demoBar() {
  try { if (sessionStorage.getItem('eib-demo-bar') === 'off') return; } catch (e) {}
  const roles = [['guest', 'Гость'], ['citizen', 'Житель'], ['admin', 'Администрация'], ['contractor', 'Подрядчик']];
  const el = document.createElement('div');
  el.className = 'demo-bar';
  el.innerHTML = `<b>Демо · смотреть как</b>` +
    roles.map(([k, n]) => `<button data-r="${k}" class="${State.role() === k ? 'on' : ''}">${n}</button>`).join('') +
    `<button class="x" title="Скрыть панель">×</button>`;
  document.body.appendChild(el);

  el.querySelectorAll('button[data-r]').forEach(b => b.addEventListener('click', () => {
    State.setRole(b.dataset.r);
    toast(b.dataset.r === 'guest' ? 'Режим гостя: видно только публичную часть'
      : 'Вы смотрите как ' + ACCOUNTS[b.dataset.r].name);
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
    State.setRole('guest');
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

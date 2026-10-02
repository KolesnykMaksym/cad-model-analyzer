/*
 * Фізика вертикального падіння тіла в атмосфері Землі.
 *
 *   m·dv/dt = m·g(h) − ρ(h)·V·g(h) − ½·ρ(h)·Cd·A·v·|v| − 3π·μ(h)·d·v
 *   dh/dt   = −v            (v > 0 — рух униз, h — висота над рівнем моря)
 *
 * Модуль не залежить від DOM: працює і в браузері (глобальний FreeFall), і в Node (module.exports).
 */
(function (root) {
  'use strict';

  const G0 = 9.80665;          // стандартне прискорення вільного падіння, м/с²
  const R_EARTH = 6371000;     // середній радіус Землі, м
  const R_AIR = 287.05287;     // питома газова стала сухого повітря, Дж/(кг·К)
  const GAMMA = 1.4;           // показник адіабати повітря
  const MAX_ALTITUDE = 80000;  // межа застосовності моделі ISA тут, м

  // Шари ISA (US Standard Atmosphere 1976): геопотенціальна висота основи, м; T основи, К; градієнт, К/м
  const LAYERS = [
    [0, 288.15, -0.0065],
    [11000, 216.65, 0],
    [20000, 216.65, 0.001],
    [32000, 228.65, 0.0028],
    [47000, 270.65, 0],
    [51000, 270.65, -0.0028],
    [71000, 214.65, -0.002],
  ];

  function layerPressure(hb, Tb, L, pb, hg) {
    const dh = hg - hb;
    if (L === 0) return pb * Math.exp(-G0 * dh / (R_AIR * Tb));
    return pb * Math.pow((Tb + L * dh) / Tb, -G0 / (L * R_AIR));
  }

  // Тиск на основі кожного шару
  const BASE_P = [101325];
  for (let i = 1; i < LAYERS.length; i++) {
    const [hb, Tb, L] = LAYERS[i - 1];
    BASE_P.push(layerPressure(hb, Tb, L, BASE_P[i - 1], LAYERS[i][0]));
  }

  /** Стан атмосфери ISA на геометричній висоті h (м над рівнем моря). */
  function atmosphere(h) {
    const hg = R_EARTH * h / (R_EARTH + h); // геопотенціальна висота
    let i = LAYERS.length - 1;
    while (i > 0 && hg < LAYERS[i][0]) i--;
    const [hb, Tb, L] = LAYERS[i];
    const T = Tb + L * (hg - hb);
    const p = layerPressure(hb, Tb, L, BASE_P[i], hg);
    const rho = p / (R_AIR * T);
    const mu = 1.458e-6 * Math.pow(T, 1.5) / (T + 110.4); // формула Сазерленда
    const a = Math.sqrt(GAMMA * R_AIR * T);
    return { T, p, rho, mu, a };
  }

  function gravity(h) {
    const k = R_EARTH / (R_EARTH + h);
    return G0 * k * k;
  }

  /*
   * Форми тіл. dims — розміри в метрах; geom повертає площу міделя A (м²) і об'єм V (м³).
   * Cd — типові коефіцієнти опору для чисел Рейнольдса 10³…10⁵.
   */
  const SHAPES = {
    sphere: {
      name: 'Куля', Cd: 0.47,
      dims: [['d', 'Діаметр d']],
      geom: ({ d }) => ({ A: Math.PI * d * d / 4, V: Math.PI * d * d * d / 6 }),
    },
    cube: {
      name: 'Куб (гранню вниз)', Cd: 1.05,
      dims: [['a', 'Ребро a']],
      geom: ({ a }) => ({ A: a * a, V: a * a * a }),
    },
    cylV: {
      name: 'Циліндр, вісь вертикальна', Cd: 0.82,
      dims: [['d', 'Діаметр d'], ['l', 'Довжина l']],
      geom: ({ d, l }) => ({ A: Math.PI * d * d / 4, V: Math.PI * d * d * l / 4 }),
    },
    cylH: {
      name: 'Циліндр поперек потоку', Cd: 1.0,
      dims: [['d', 'Діаметр d'], ['l', 'Довжина l']],
      geom: ({ d, l }) => ({ A: d * l, V: Math.PI * d * d * l / 4 }),
    },
    plate: {
      name: 'Пластина, горизонтально', Cd: 1.17,
      dims: [['a', 'Сторона a'], ['b', 'Сторона b'], ['t', 'Товщина t']],
      geom: ({ a, b, t }) => ({ A: a * b, V: a * b * t }),
    },
    custom: {
      name: 'Власні параметри (Cd, A, V)', Cd: 1.0,
      dims: [],
      geom: null,
    },
  };

  /*
   * Готові тіла. Для людей і парашута добуток Cd·A підібрано під відомі граничні швидкості
   * (≈55 м/с на живіт, ≈85 м/с головою вниз, ≈5 м/с під куполом), а для стратонавта —
   * під рекорд 2012 року (≈377 м/с на 50-й секунді падіння з 39 км).
   */
  const PRESETS = [
    { id: 'steel', name: 'Сталева кулька ⌀2 см', shape: 'sphere', dims: { d: 0.02 }, m: 0.03288, Cd: 0.47 },
    { id: 'basket', name: 'Баскетбольний м’яч', shape: 'sphere', dims: { d: 0.24 }, m: 0.62, Cd: 0.47 },
    { id: 'tennis', name: 'Тенісний м’яч', shape: 'sphere', dims: { d: 0.067 }, m: 0.057, Cd: 0.5 },
    { id: 'pingpong', name: 'М’ячик для пінг-понгу', shape: 'sphere', dims: { d: 0.04 }, m: 0.0027, Cd: 0.47 },
    { id: 'rain', name: 'Дощова крапля ⌀2 мм', shape: 'sphere', dims: { d: 0.002 }, m: 4.189e-6, Cd: 0.47 },
    { id: 'drizzle', name: 'Мряка ⌀0.2 мм', shape: 'sphere', dims: { d: 0.0002 }, m: 4.189e-9, Cd: 0.47 },
    { id: 'a4', name: 'Аркуш A4, горизонтально', shape: 'plate', dims: { a: 0.21, b: 0.297, t: 0.0001 }, m: 0.005, Cd: 1.17 },
    { id: 'belly', name: 'Парашутист, на живіт', shape: 'custom', custom: { A: 0.6, V: 0.08 }, m: 80, Cd: 0.7 },
    { id: 'headdown', name: 'Парашутист, головою вниз', shape: 'custom', custom: { A: 0.25, V: 0.08 }, m: 80, Cd: 0.7 },
    { id: 'canopy', name: 'Парашутист під куполом', shape: 'custom', custom: { A: 50, V: 0.1 }, m: 100, Cd: 1.3 },
    { id: 'stratos', name: 'Стратонавт у скафандрі', shape: 'custom', custom: { A: 0.6, V: 0.12 }, m: 118, Cd: 1.0 },
  ];

  /** Повертає {m, Cd, A, V, d} для опису тіла {shape, dims, custom, m, Cd}. */
  function bodyProps(desc) {
    let A, V;
    if (desc.shape === 'custom') {
      A = desc.custom.A; V = desc.custom.V;
    } else {
      ({ A, V } = SHAPES[desc.shape].geom(desc.dims));
    }
    return { m: desc.m, Cd: desc.Cd, A, V, d: Math.sqrt(4 * A / Math.PI) };
  }

  const DEFAULT_OPTIONS = { isa: true, gravity: true, buoyancy: true, viscous: true };

  /** Фабрика функцій моделі для конкретного тіла, умов і набору ефектів. */
  function makeModel(body, ground, opts) {
    const o = Object.assign({}, DEFAULT_OPTIONS, opts);
    const groundAtm = atmosphere(ground);
    const kv = 3 * Math.PI * body.d; // множник при μ у стоксовому опорі

    function env(h) {
      const atm = o.isa ? atmosphere(h) : groundAtm;
      return { atm, g: o.gravity ? gravity(h) : G0 };
    }

    function forces(h, v) {
      const { atm, g } = env(h);
      const W = body.m * g;
      const B = o.buoyancy ? atm.rho * body.V * g : 0;
      const Fq = 0.5 * atm.rho * body.Cd * body.A * v * Math.abs(v);
      const Fv = o.viscous ? kv * atm.mu * v : 0;
      return { W, B, Fq, Fv, acc: (W - B - Fq - Fv) / body.m, atm };
    }

    /*
     * Локальна гранична швидкість: корінь ½ρCdA·v² + 3πμd·v − (W − B) = 0.
     * tau — часова стала релаксації швидкості до v_t (m / dF/dv).
     */
    function terminal(h) {
      const { atm, g } = env(h);
      const qa = 0.5 * atm.rho * body.Cd * body.A;
      const qb = o.viscous ? kv * atm.mu : 0;
      const qc = body.m * g - (o.buoyancy ? atm.rho * body.V * g : 0);
      if (qc <= 0) return { vt: 0, tau: Infinity, net: qc };
      const vt = 2 * qc / (qb + Math.sqrt(qb * qb + 4 * qa * qc));
      return { vt, tau: body.m / (2 * qa * vt + qb), net: qc };
    }

    return { env, forces, terminal };
  }

  /**
   * Моделює падіння.
   * @param desc   опис тіла {shape, dims, custom, m, Cd}
   * @param cond   {H — висота над землею, м; ground — висота землі над рівнем моря, м; v0 — м/с}
   * @param opts   {isa, gravity, buoyancy, viscous}
   * @param maxPoints  скільки точок залишити для графіків
   */
  function simulate(desc, cond, opts, maxPoints = 1200) {
    const body = bodyProps(desc);
    const ground = cond.ground || 0;
    const H = cond.H;
    const h0 = ground + H;
    const model = makeModel(body, ground, opts);
    const tg = model.terminal(ground);
    const t0 = model.terminal(h0);
    const density = body.m / body.V;

    const base = { body, density, vtGround: tg.vt, vtStart: t0.vt, atmGround: atmosphere(ground) };
    if (tg.net <= 0 || t0.net <= 0) return Object.assign(base, { floats: true });

    const v0 = cond.v0 || 0;
    const gG = model.env(ground).g;
    const vtMin = Math.min(tg.vt, t0.vt);
    // Очікувана тривалість: падіння у вакуумі плюс рівномірний рух на найменшій v_t
    const tEst = Math.sqrt(2 * H / gG) + H / vtMin;
    const dtRes = tEst / 4000;

    const full = [];
    let t = 0, h = h0, v = v0, quasi = false, steps = 0;

    function record(t, h, v) {
      const f = model.forces(h, v);
      const vt = model.terminal(h).vt;
      full.push({
        t, h: h - ground, v, vt, a: f.acc,
        W: f.W, B: f.B, Fq: f.Fq, Fv: f.Fv,
        mach: v / f.atm.a, sound: f.atm.a, rho: f.atm.rho,
      });
    }

    record(t, h, v);
    const deriv = (h, v) => [-v, model.forces(h, v).acc];

    while (h > ground && steps < 2e6) {
      steps++;
      const term = model.terminal(h);
      let hn, vn, dt;
      if (quasi) {
        // Квазірівновага: v відстежує v_t(h), похибка ~ τ·dv_t/dt, тут нехтовно мала
        dt = dtRes;
        const vtMid = model.terminal(h - 0.5 * term.vt * dt).vt;
        hn = h - vtMid * dt;
        vn = model.terminal(Math.max(hn, ground)).vt;
      } else {
        dt = Math.min(0.25 * term.tau, dtRes, 0.5);
        const [k1h, k1v] = deriv(h, v);
        const [k2h, k2v] = deriv(h + 0.5 * dt * k1h, v + 0.5 * dt * k1v);
        const [k3h, k3v] = deriv(h + 0.5 * dt * k2h, v + 0.5 * dt * k2v);
        const [k4h, k4v] = deriv(h + dt * k3h, v + dt * k3v);
        hn = h + dt / 6 * (k1h + 2 * k2h + 2 * k3h + k4h);
        vn = v + dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
        const vtn = model.terminal(Math.max(hn, ground)).vt;
        if (0.25 * term.tau < dtRes && Math.abs(vn - vtn) < 1e-6 * vtn) quasi = true;
      }
      if (hn <= ground) {
        const frac = (h - ground) / (h - hn);
        record(t + frac * dt, ground, v + frac * (vn - v));
        break;
      }
      t += dt; h = hn; v = vn;
      record(t, h, v);
    }

    // Показники з повної роздільності
    const reach = (k) => full.find((p) => p.v >= k * p.vt) || null;
    const p95 = reach(0.95), p99 = reach(0.99);
    let pMax = full[0], machMax = 0;
    for (const p of full) {
      if (p.v > pMax.v) pMax = p;
      if (p.mach > machMax) machMax = p.mach;
    }
    const last = full[full.length - 1];
    const vacuumT = (-v0 + Math.sqrt(v0 * v0 + 2 * gG * H)) / gG;
    const tq = last.vt;
    const fVisc = tg.vt > 0 && opts.viscous !== false
      ? (3 * Math.PI * body.d * base.atmGround.mu * tg.vt) / tg.net : 0;

    // Проріджування для графіків
    const step = Math.max(1, Math.ceil(full.length / maxPoints));
    const series = full.filter((_, i) => i % step === 0);
    if (series[series.length - 1] !== last) series.push(last);

    return Object.assign(base, {
      floats: false,
      series,
      steps,
      tImpact: last.t,
      vImpact: last.v,
      vtImpact: tq,
      p95: p95 && { t: p95.t, fallen: H - p95.h, h: p95.h },
      p99: p99 && { t: p99.t, fallen: H - p99.h, h: p99.h },
      vMax: { v: pMax.v, t: pMax.t, h: pMax.h, vt: pMax.vt },
      machMax,
      energy: 0.5 * body.m * last.v * last.v,
      vacuum: { t: vacuumT, v: v0 + gG * vacuumT, g: gG },
      reynolds: base.atmGround.rho * tg.vt * body.d / base.atmGround.mu,
      viscousShare: fVisc,
    });
  }

  const api = {
    G0, R_EARTH, MAX_ALTITUDE, SHAPES, PRESETS, DEFAULT_OPTIONS,
    atmosphere, gravity, bodyProps, makeModel, simulate,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FreeFall = api;
})(typeof window !== 'undefined' ? window : this);

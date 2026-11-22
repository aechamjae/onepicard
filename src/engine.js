// 게임 규칙 엔진. 화면과 분리되어 있어 node에서도 그대로 돌릴 수 있다.
import { CARDS, FACTIONS } from './cards.js';

export const RULES = {
  startHull: 20,
  treasureToWin: 12,
  maxWind: 10,
  boardLimit: 5,
  handLimit: 8,
  startHand: 4,
  burnDamage: 2,
  growLimit: 2,
  discountLimit: 2,
  ripenLimit: 2,
  sporeLimit: 3, // 한 갑판에 심을 수 있는 포자 수
  sporeLife: 2, // 포자가 머무는 주인 턴 수. 마지막 턴 끝에 1 피해를 주고 시든다
};

let uidSeq = 1;

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildDeck(factionId, rng) {
  const deck = [];
  for (const [defId, n] of Object.entries(FACTIONS[factionId].deck)) {
    for (let i = 0; i < n; i++) deck.push({ uid: uidSeq++, defId });
  }
  return shuffle(deck, rng);
}

function makePlayer(name, factionId, isAI, rng, hull) {
  return {
    name, factionId, isAI,
    hull, maxHull: hull, treasure: 0,
    maxWind: 0, wind: 0, fatigue: 0, skillUsed: false, discount: 0, played: 0,
    deck: buildDeck(factionId, rng), hand: [], board: [],
  };
}

// handicap: 난이도에 따른 시작 조건. hull = [나, AI] 시작 선체, extraCards = [나, AI] 추가 시작 카드.
export function createGame({
  playerFaction, aiFaction, rng = Math.random, names = ['나', 'AI'],
  handicap = { hull: [RULES.startHull, RULES.startHull], extraCards: [0, 0] },
}) {
  const s = {
    rng, turn: 0, current: 0, winner: null, log: [],
    players: [
      makePlayer(names[0], playerFaction, false, rng, handicap.hull[0]),
      makePlayer(names[1], aiFaction, true, rng, handicap.hull[1]),
    ],
  };
  drawCards(s, 0, RULES.startHand - 1 + handicap.extraCards[0]); // 선공은 1장 적게
  drawCards(s, 1, RULES.startHand + handicap.extraCards[1]); // 후공은 1장 더 + 행운의 동전
  s.players[1].hand.push({ uid: uidSeq++, defId: 'coin' });
  startTurn(s);
  return s;
}

function log(s, msg) {
  s.log.push(msg);
  if (s.log.length > 60) s.log.shift();
}

function drawCards(s, pi, n) {
  const p = s.players[pi];
  for (let i = 0; i < n; i++) {
    if (p.deck.length === 0) {
      p.fatigue++;
      p.hull -= p.fatigue;
      log(s, `${p.name}의 덱이 비었다! 식량 부족으로 선체 ${p.fatigue} 피해.`);
      continue;
    }
    const card = p.deck.pop();
    if (p.hand.length >= RULES.handLimit) {
      log(s, `${p.name}의 손패가 가득 차 「${CARDS[card.defId].name}」이(가) 바다에 빠졌다.`);
      continue;
    }
    p.hand.push(card);
  }
}

function startTurn(s) {
  s.turn++;
  const p = s.players[s.current];
  p.maxWind = Math.min(RULES.maxWind, p.maxWind + 1);
  p.wind = p.maxWind;
  p.skillUsed = false;
  // 숙성: 손패의 숙성 카드가 익어 비용이 줄어든다(새로 뽑는 카드는 이번 턴에 익지 않는다).
  p.hand = p.hand.map((c) => ((CARDS[c.defId].keywords || []).includes('ripen') && (c.ripe || 0) < RULES.ripenLimit ? { ...c, ripe: (c.ripe || 0) + 1 } : c));
  p.discount = 0;
  p.played = 0; // 이번 턴에 낸 카드 수(연쇄)
  for (const c of p.board) {
    c.canAttack = !c.frozen && !CARDS[c.defId].noAttack;
    c.held = c.frozen; // 얼어서 이번 턴 공격을 못 하게 된 선원(칼 갈기로 풀 수 있다)
    c.frozen = false;
    c.submerged = false;
    c.attacked = false;
    c.doubled = false;
  }
  log(s, `── ${p.name}의 턴 (바람 ${p.wind}) ──`);
  for (const c of p.board.filter((c) => c.burning)) {
    hurt(c, RULES.burnDamage, false, true);
    log(s, `🔥 「${CARDS[c.defId].name}」이(가) 화상으로 ${RULES.burnDamage} 피해.`);
  }
  removeDead(s);
  drawCards(s, s.current, 1);
  checkWinner(s);
}

function checkWinner(s) {
  if (s.winner !== null) return;
  for (let i = 0; i < 2; i++) {
    const p = s.players[i];
    if (p.treasure >= RULES.treasureToWin) {
      s.winner = i;
      log(s, `💰 ${p.name}이(가) 보물 ${RULES.treasureToWin}개를 모아 승리했다!`);
      return;
    }
  }
  for (let i = 0; i < 2; i++) {
    if (s.players[i].hull <= 0) {
      s.winner = 1 - i;
      log(s, `🌊 ${s.players[i].name}의 배가 침몰했다! ${s.players[1 - i].name} 승리!`);
      return;
    }
  }
}

// 쓰러진 선원을 치운다. 망령은 한 번 되살아나고, 거인화 선원은 그 자리에서 거인이 되며, 유언(onDeath)은 치운 뒤에 발동한다.
function removeDead(s) {
  const titans = []; // [플레이어, 새로 일어난 거인]
  s.players.forEach((p, pi) => {
    const dead = [];
    for (const c of p.board.filter((c) => c.hp <= 0)) {
      if (hasKeyword(c, 'titan') && CARDS[c.defId].titan) {
        const t = makeCrew(uidSeq++, CARDS[c.defId].titan);
        p.board[p.board.indexOf(c)] = t;
        titans.push([pi, t]);
        log(s, `⚡ 「${CARDS[c.defId].name}」이(가) 「${CARDS[t.defId].name}」이(가) 되어 다시 일어났다!`);
      } else if (hasKeyword(c, 'ghost') && !c.revived) {
        c.revived = true;
        c.hp = 1; // 붙은 불은 꺼지지 않는다
        log(s, `👻 「${CARDS[c.defId].name}」이(가) 망령이 되어 다시 일어났다!`);
      } else {
        dead.push(c);
      }
    }
    if (!dead.length) return;
    p.board = p.board.filter((c) => !dead.includes(c));
    for (const c of dead) {
      log(s, `☠ ${p.name}의 「${CARDS[c.defId].name}」이(가) 쓰러졌다.`);
      const d = CARDS[c.defId];
      if (d.onDeath) d.onDeath(effectApi(s, pi));
      if (hasKeyword(c, 'spore')) plantSpores(s, 1 - pi, 1);
      if (hasKeyword(c, 'devotion')) {
        const heir = p.board.filter((a) => !CARDS[a.defId].noAttack).sort((a, b) => b.atk - a.atk)[0];
        if (heir) {
          heir.atk++;
          log(s, `✊ 헌신! 「${CARDS[heir.defId].name}」의 공격력 +1.`);
        }
      }
    }
    for (const c of [...p.board]) {
      const d = CARDS[c.defId];
      if (d.onAllyDeath && c.hp > 0) d.onAllyDeath(effectApi(s, pi), c);
    }
  });
  // 거인이 일어날 때 효과(초대형 거인의 폭발 등). 그 효과로 쓰러진 선원을 다시 치운다.
  for (const [pi, t] of titans) {
    const d = CARDS[t.defId];
    if (d.onRise) d.onRise(effectApi(s, pi), t);
  }
  if (titans.length && s.players.some((p) => p.board.some((c) => c.hp <= 0))) removeDead(s);
}

const isSpore = (c) => !!CARDS[c.defId].noAttack;

// 갑판에 선원을 올린다. 갑판이 가득 차 있으면 포자 하나를 밟아 없애고 자리를 만들며, 터진 포자에 1 피해를 받는다.
// 자리가 없으면(가득 찼는데 포자도 없으면) false.
function boardCrew(s, p, crew, verb) {
  const crushed = p.board.length >= RULES.boardLimit;
  if (crushed) {
    const spore = p.board.find(isSpore);
    if (!spore) return false;
    p.board = p.board.filter((c) => c !== spore);
    log(s, `🦶 ${p.name}이(가) 포자를 밟아 없앴다.`);
  }
  p.board.push(crew);
  log(s, `${p.name}: 「${CARDS[crew.defId].name}」 ${verb}.`);
  if (crushed) {
    hurt(crew, 1); // 밟은 포자가 터져 1 피해
    log(s, `🦠 터진 포자에 「${CARDS[crew.defId].name}」이(가) 1 피해.`);
    removeDead(s);
  }
  return true;
}

// 등가교환으로 버릴 카드: 재료 카드를 먼저, 없으면 가장 싼 카드. 행운의 동전과 exceptUid(지금 내는 카드)는 빼고 고른다.
export function exchangePick(p, exceptUid = null) {
  const pool = p.hand.filter((c) => c.defId !== 'coin' && c.uid !== exceptUid);
  if (!pool.length) return null;
  const mats = pool.filter((c) => (CARDS[c.defId].keywords || []).includes('material'));
  return [...(mats.length ? mats : pool)].sort((a, b) => costOf(p, a) - costOf(p, b))[0];
}

// 선원을 둘 자리가 있는지(가득 찼어도 밟을 포자가 있으면 된다).
export const hasRoom = (p) => p.board.length < RULES.boardLimit || p.board.some(isSpore);

// 포자: 상대 갑판 빈자리에 공격할 수 없는 포자를 심는다.
function plantSpores(s, pi, n) {
  const p = s.players[pi];
  let planted = 0;
  const room = () => p.board.length < RULES.boardLimit && p.board.filter(isSpore).length < RULES.sporeLimit;
  for (; planted < n && room(); planted++) p.board.push({ ...makeCrew(uidSeq++, 'spore'), life: RULES.sporeLife });
  if (planted) log(s, `🦠 ${p.name}의 갑판에 포자 ${planted}개가 피어났다.`);
}

function makeCrew(uid, defId) {
  const d = CARDS[defId];
  return {
    uid, defId,
    atk: d.atk, hp: d.hp, maxHp: d.hp,
    canAttack: (d.keywords || []).includes('charge'), frozen: false,
    attacked: false, tension: 0, burning: false, revived: false, grown: 0,
    shield: (d.keywords || []).includes('shield'), stealth: (d.keywords || []).includes('stealth'), doubled: false,
    submerged: (d.keywords || []).includes('submerge'),
    gained: [], // 카드 효과로 얻은 키워드
  };
}

export function findCrew(s, uid) {
  for (let pi = 0; pi < 2; pi++) {
    const c = s.players[pi].board.find((c) => c.uid === uid);
    if (c) return { crew: c, owner: pi };
  }
  return null;
}

export function hasKeyword(crew, kw) {
  return (CARDS[crew.defId].keywords || []).includes(kw) || !!crew.gained?.includes(kw);
}

// 순풍으로 깎인 실제 비용.
// card는 손패 카드 객체(숙성 반영) 또는 defId.
export function costOf(p, card) {
  const defId = typeof card === 'string' ? card : card.defId;
  const ripe = typeof card === 'string' ? 0 : card.ripe || 0;
  return Math.max(0, CARDS[defId].cost - (p.discount || 0) - ripe);
}

// 선원에게 피해를 준다. 탄성이 있으면 1 줄어든다. 실제로 들어간 피해를 돌려준다.
// blow: 선원끼리 싸울 때의 타격. 공격력 0이라도 보호막은 깨뜨린다(돌벽 반격 등).
// melt: 탄성을 무시하는 피해(불에 타는 피해, 되살아난 망령의 타격).
function hurt(crew, n, blow = false, melt = false) {
  if (n <= 0 && !(blow && crew.shield)) return 0;
  if (crew.shield) {
    crew.shield = false; // 보호막이 대신 맞고 깨진다
    return 0;
  }
  const dealt = hasKeyword(crew, 'elastic') && !melt ? Math.max(0, n - 1) : n;
  crew.hp -= dealt;
  return dealt;
}

function heal(s, p, n) {
  if (n <= 0) return;
  const before = p.hull;
  p.hull = Math.min(p.maxHull, p.hull + n);
  if (p.hull > before) log(s, `🦇 ${p.name}의 선체 ${p.hull - before} 회복.`);
}

// 카드 효과가 쓰는 도구 모음. pi는 카드를 낸 플레이어.
function effectApi(s, pi) {
  const me = s.players[pi];
  const foe = s.players[1 - pi];
  const api = {
    me, foe,
    get turn() { return s.turn; },
    // 등가교환: 손패에서 재료 카드를 먼저, 없으면 가장 싼 카드 1장을 버린다(행운의 동전은 버리지 않는다).
    // 버렸으면 true. 버린 카드가 재료면 그 효과(onDiscard)가 터진다.
    exchange: () => {
      const pick = exchangePick(me);
      if (!pick) {
        log(s, '⚗ 바칠 카드가 없어 등가교환 효과는 없었다.');
        return false;
      }
      me.hand = me.hand.filter((c) => c !== pick);
      const d = CARDS[pick.defId];
      log(s, `⚗ 등가교환: 「${d.name}」을(를) 재료로 바쳤다.`);
      if (d.onDiscard) d.onDiscard(api);
      return true;
    },
    // 이 선원을 뺀 바다 위 모든 선원(아군 포함)에게 피해.
    damageOthers: (selfUid, n) => {
      for (const c of [...me.board, ...foe.board]) if (c.uid !== selfUid) hurt(c, n);
      log(s, `바다 위 다른 모든 선원에게 ${n} 피해.`);
      removeDead(s);
    },
    draw: (n) => drawCards(s, pi, n),
    gainWind: (n) => { me.wind += n; },
    healShip: (n) => {
      const before = me.hull;
      me.hull = Math.min(me.maxHull, me.hull + n);
      log(s, `🔧 ${me.name}의 선체 ${me.hull - before} 회복.`);
    },
    damageFoeShip: (n) => {
      foe.hull -= n;
      log(s, `💥 ${foe.name}의 배에 ${n} 피해.`);
    },
    // 이번 턴에 이 카드보다 먼저 낸 카드 수
    get played() { return me.played; },
    // 거래: 보물이 있으면 1개를 써서 true. 없으면 false.
    trade: () => {
      if (me.treasure < 1) {
        log(s, '💰 보물이 없어 거래 효과는 없었다.');
        return false;
      }
      me.treasure--;
      log(s, `💰 ${me.name}이(가) 보물 1개를 내고 거래했다. (${me.treasure}/${RULES.treasureToWin})`);
      return true;
    },
    grant: (uid, kw) => {
      const f = findCrew(s, uid);
      if (!f) return;
      if (!hasKeyword(f.crew, kw)) f.crew.gained.push(kw);
      if (kw === 'charge') f.crew.canAttack = true;
    },
    // 적 선원을 내 편으로 데려온다. 내 갑판이 가득 차면 실패.
    steal: (uid) => {
      const f = findCrew(s, uid);
      if (!f || f.owner === pi || me.board.length >= RULES.boardLimit) return false;
      foe.board = foe.board.filter((c) => c !== f.crew);
      f.crew.canAttack = false;
      f.crew.tension = 0;
      me.board.push(f.crew);
      log(s, `🤝 「${CARDS[f.crew.defId].name}」이(가) 금화에 넘어와 ${me.name} 편이 되었다!`);
      return true;
    },
    // 공격력과 체력을 뒤바꾼다. 체력이 0이 되면 쓰러진다.
    swapStats: (uid) => {
      const f = findCrew(s, uid);
      if (!f) return;
      const c = f.crew;
      [c.atk, c.hp] = [c.hp, c.atk];
      c.maxHp = c.hp;
      log(s, `🩺 「${CARDS[c.defId].name}」의 공격력과 체력이 뒤바뀌었다. (${c.atk}/${c.hp})`);
      removeDead(s);
    },
    addToHand: (defId, n = 1) => {
      for (let i = 0; i < n; i++) {
        if (me.hand.length >= RULES.handLimit) break;
        me.hand.push({ uid: uidSeq++, defId });
      }
    },
    slay: (uid) => {
      const f = findCrew(s, uid);
      if (!f) return;
      f.crew.hp = 0;
      log(s, `⚔ 「${CARDS[f.crew.defId].name}」이(가) 단칼에 베였다.`);
      removeDead(s);
    },
    gainTreasure: (n) => {
      me.treasure += n;
      log(s, `💰 ${me.name}이(가) 보물 ${n}개를 얻었다. (${me.treasure}/${RULES.treasureToWin})`);
    },
    damageCrew: (uid, n) => {
      const f = findCrew(s, uid);
      if (!f) return;
      const dealt = hurt(f.crew, n);
      log(s, `「${CARDS[f.crew.defId].name}」에게 ${dealt} 피해.`);
      removeDead(s);
    },
    damageMyShip: (n) => {
      me.hull -= n;
      log(s, `💥 ${me.name}의 배에 ${n} 피해.`);
    },
    damageAllFoes: (n) => {
      for (const c of [...foe.board]) hurt(c, n);
      log(s, `모든 적 선원에게 ${n} 피해.`);
      removeDead(s);
    },
    damageAll: (n) => {
      for (const c of [...me.board, ...foe.board]) hurt(c, n);
      log(s, `바다 위 모든 선원에게 ${n} 피해.`);
      removeDead(s);
    },
    isAlive: (uid) => !!findCrew(s, uid),
    // 포자가 시들어 사라진다(유언·망령 없이).
    wither: (uid) => {
      const f = findCrew(s, uid);
      if (!f) return;
      s.players[f.owner].board = s.players[f.owner].board.filter((c) => c !== f.crew);
      log(s, `🍂 포자가 시들어 사라졌다.`);
    },
    plantSpores: (n) => plantSpores(s, 1 - pi, n),
    // 숙성: 손패의 숙성 카드를 익힌다. all이 아니면 가장 비싼 카드 하나만.
    ripenHand: (all = true) => {
      const list = me.hand.filter((c) => (CARDS[c.defId].keywords || []).includes('ripen') && (c.ripe || 0) < RULES.ripenLimit)
        .sort((a, b) => CARDS[b.defId].cost - CARDS[a.defId].cost);
      const picked = all ? list : list.slice(0, 1);
      me.hand = me.hand.map((c) => (picked.includes(c) ? { ...c, ripe: (c.ripe || 0) + 1 } : c));
      if (picked.length) log(s, `🍎 손패의 숙성 카드 ${picked.length}장이 익었다.`);
      return picked.length;
    },
    // 포식: 다른 아군 선원 중 가장 약한 하나를 잡아먹고 그 공격력·체력을 얻는다.
    devour: (selfUid) => {
      const self = me.board.find((c) => c.uid === selfUid);
      const prey = me.board.filter((c) => c.uid !== selfUid).sort((a, b) => a.atk + a.hp - (b.atk + b.hp))[0];
      if (!self || !prey) return;
      me.board = me.board.filter((c) => c !== prey);
      self.atk += prey.atk;
      self.hp += prey.hp;
      self.maxHp += prey.hp;
      log(s, `🍖 「${CARDS[self.defId].name}」이(가) 「${CARDS[prey.defId].name}」을(를) 잡아먹고 ${self.atk}/${self.hp}이 되었다.`);
    },
    buff: (uid, atk, hp) => {
      const f = findCrew(s, uid);
      if (!f) return;
      f.crew.atk = Math.max(0, f.crew.atk + atk);
      f.crew.hp += hp;
      f.crew.maxHp += hp;
    },
    buffAll: (atk, hp) => {
      for (const c of me.board) {
        c.atk += atk;
        c.hp += hp;
        c.maxHp += hp;
      }
    },
    tensionAll: (n) => {
      for (const c of me.board) c.tension = Math.min(3, (c.tension || 0) + n);
    },
    burn: (uid) => {
      const f = findCrew(s, uid);
      if (!f) return;
      f.crew.burning = true;
      log(s, `🔥 「${CARDS[f.crew.defId].name}」에 불이 붙었다.`);
    },
    burnAllFoes: () => {
      for (const c of foe.board) c.burning = true;
      if (foe.board.length) log(s, '🔥 적 선원 모두에게 불이 붙었다.');
    },
    summon: (defId, n = 1) => {
      for (let i = 0; i < n; i++) if (!boardCrew(s, me, makeCrew(uidSeq++, defId), '합류')) break;
    },
    randomAllyCrew: (exceptUid) => {
      const list = me.board.filter((c) => c.uid !== exceptUid);
      return list.length ? list[Math.floor(s.rng() * list.length)] : null;
    },
    setTension: (uid, n) => {
      const f = findCrew(s, uid);
      if (f) f.crew.tension = n;
    },
    ready: (uid) => {
      const f = findCrew(s, uid);
      if (f && !CARDS[f.crew.defId].noAttack) f.crew.canAttack = true;
    },
    bounce: (uid) => {
      const f = findCrew(s, uid);
      if (!f) return;
      const owner = s.players[f.owner];
      owner.board = owner.board.filter((c) => c !== f.crew);
      const name = CARDS[f.crew.defId].name;
      if (owner.hand.length >= RULES.handLimit) {
        log(s, `🌀 「${name}」이(가) 바다 멀리 던져졌다.`);
      } else {
        owner.hand.push({ uid: f.crew.uid, defId: f.crew.defId });
        log(s, `🌀 「${name}」이(가) ${owner.name}의 손패로 되돌아갔다.`);
      }
    },
    shield: (uid) => {
      const f = findCrew(s, uid);
      if (f) f.crew.shield = true;
    },
    // 상태이상 제거: 불을 끄고, 얼어붙은 것을 녹인다(얼어서 이번 턴 공격을 못 하던 선원은 다시 공격할 수 있다).
    cleanse: (uid) => {
      const f = findCrew(s, uid);
      if (!f) return;
      const c = f.crew;
      const had = c.burning || c.frozen || c.held;
      c.burning = false;
      c.frozen = false;
      if (c.held && !c.attacked && !CARDS[c.defId].noAttack) c.canAttack = true;
      c.held = false;
      if (had) log(s, `✨ 「${CARDS[c.defId].name}」의 상태이상이 모두 풀렸다.`);
    },
    extinguish: (uid) => {
      const f = findCrew(s, uid);
      if (!f || !f.crew.burning) return;
      f.crew.burning = false;
      log(s, `💧 「${CARDS[f.crew.defId].name}」의 불이 꺼졌다.`);
    },
    freeze: (uid) => {
      const f = findCrew(s, uid);
      if (!f) return;
      f.crew.frozen = true;
      log(s, `❄ 「${CARDS[f.crew.defId].name}」이(가) 얼어붙었다.`);
    },
    freezeAllFoes: () => {
      for (const c of foe.board) c.frozen = true;
      if (foe.board.length) log(s, '❄ 적 선원 모두가 얼어붙었다.');
    },
    randomFoeCrew: () => (foe.board.length ? foe.board[Math.floor(s.rng() * foe.board.length)] : null),
  };
  return api;
}

// 안개 속에 숨었거나 잠항 중인 선원은 공격이나 대상 지정 카드로 고를 수 없다.
export const targetable = (board) => board.filter((c) => !c.stealth && !c.submerged);

export function legalAttackTargets(s, pi, attacker) {
  const visible = targetable(s.players[1 - pi].board);
  const guards = visible.filter((c) => hasKeyword(c, 'guard'));
  if (guards.length) {
    const ids = guards.map((c) => c.uid);
    return attacker && hasKeyword(attacker, 'sneak') ? ['ship', ...ids] : ids;
  }
  return ['ship', ...visible.map((c) => c.uid)];
}

// 대상 지정이 필요한 카드·스킬이 지금 쓸 수 있는 대상이 있는지 확인한다.
function targetError(s, pi, kind) {
  if (kind === 'foeCrew' && !targetable(s.players[1 - pi].board).length) return '대상이 될 적 선원이 없다.';
  if (kind === 'allyCrew' && !s.players[pi].board.length) return '대상이 될 아군 선원이 없다.';
  return null;
}

function validTarget(s, pi, kind, uid) {
  if (kind === 'foeCrew') return targetable(s.players[1 - pi].board).some((c) => c.uid === uid);
  return s.players[pi].board.some((c) => c.uid === uid);
}

export function canUseSkill(s, pi) {
  const p = s.players[pi];
  const sk = FACTIONS[p.factionId].skill;
  if (p.skillUsed) return '리더 스킬은 한 턴에 한 번만 쓸 수 있다.';
  if (sk.cost > p.wind) return '바람이 부족하다.';
  if (sk.treasureCost && p.treasure < sk.treasureCost) return '보물이 부족하다.';
  if (sk.summons && !hasRoom(p)) return '선원을 둘 자리가 없다.';
  if (sk.discards && !p.hand.some((c) => c.defId !== 'coin')) return '재료로 바칠 카드가 없다.';
  return sk.target ? targetError(s, pi, sk.target) : null;
}

export function canPlay(s, pi, handIndex) {
  const p = s.players[pi];
  const card = p.hand[handIndex];
  if (!card) return '그 카드가 없다.';
  const d = CARDS[card.defId];
  if (costOf(p, card) > p.wind) return '바람이 부족하다.';
  if (d.type === 'crew' && !hasRoom(p)) return `선원은 ${RULES.boardLimit}명까지만 둘 수 있다.`;
  return d.target ? targetError(s, pi, d.target) : null;
}

// action: {type:'play', handIndex, target?} | {type:'attack', attacker, target:'ship'|uid} | {type:'end'}
// 성공하면 null, 실패하면 이유 문자열을 돌려준다.
export function applyAction(s, action) {
  if (s.winner !== null) return '게임이 끝났다.';
  const pi = s.current;
  const me = s.players[pi];
  const foe = s.players[1 - pi];

  if (action.type === 'play') {
    const err = canPlay(s, pi, action.handIndex);
    if (err) return err;
    const card = me.hand[action.handIndex];
    const d = CARDS[card.defId];
    if (d.target && !validTarget(s, pi, d.target, action.target)) return '대상을 골라야 한다.';
    me.wind -= costOf(me, card);
    // 순풍 카드는 쌓인 순풍을 그대로 이어받고, 다른 카드는 다 써 버린다.
    const tailwind = (d.keywords || []).includes('tailwind');
    if (!tailwind) me.discount = 0;
    me.hand.splice(action.handIndex, 1);
    const g = effectApi(s, pi);
    if (d.type === 'crew') {
      const crew = makeCrew(card.uid, card.defId);
      boardCrew(s, me, crew, '승선');
      if (d.onPlay) d.onPlay(g, crew);
    } else {
      log(s, `${me.name}: 「${d.name}」 사용.`);
      d.effect(g, action.target);
    }
    if (tailwind) {
      me.discount = Math.min(RULES.discountLimit, me.discount + 1);
      log(s, `🍃 순풍이 분다! 다음 카드 비용 -${me.discount}.`);
    }
    me.played++;
    checkWinner(s);
    return null;
  }

  if (action.type === 'skill') {
    const err = canUseSkill(s, pi);
    if (err) return err;
    const sk = FACTIONS[me.factionId].skill;
    if (sk.target && !validTarget(s, pi, sk.target, action.target)) return '대상을 골라야 한다.';
    me.wind -= sk.cost;
    if (sk.treasureCost) me.treasure -= sk.treasureCost;
    me.skillUsed = true;
    log(s, `✨ ${me.name}: 리더 스킬 「${sk.name}」!`);
    sk.effect(effectApi(s, pi), action.target);
    checkWinner(s);
    return null;
  }

  if (action.type === 'attack') {
    const attacker = me.board.find((c) => c.uid === action.attacker);
    if (!attacker) return '공격할 선원이 없다.';
    if (!attacker.canAttack || CARDS[attacker.defId].noAttack) return '이 선원은 지금 공격할 수 없다.';
    if (!legalAttackTargets(s, pi, attacker).includes(action.target)) {
      return foe.board.some((c) => hasKeyword(c, 'guard')) ? '수호 선원부터 공격해야 한다.' : '공격할 수 없는 대상이다.';
    }
    attacker.canAttack = false;
    attacker.attacked = true;
    if (attacker.stealth) {
      attacker.stealth = false;
      log(s, `🌫 「${CARDS[attacker.defId].name}」이(가) 안개 속에서 튀어나왔다!`);
    }
    let power = attacker.atk + (attacker.tension || 0);
    if (attacker.tension) log(s, `🌀 당겨 둔 고무팔이 튕겨 나간다! (공격력 +${attacker.tension})`);
    attacker.tension = 0;
    const aName = CARDS[attacker.defId].name;
    if (action.target === 'ship') {
      const loot = 1 + (hasKeyword(attacker, 'plunder') ? 1 : 0);
      foe.hull -= power;
      me.treasure += loot;
      if (hasKeyword(attacker, 'lifesteal')) heal(s, me, power);
      log(s, `⚔ 「${aName}」이(가) ${foe.name}의 배를 습격! 선체 ${power} 피해, 보물 ${loot}개 획득. (${me.treasure}/${RULES.treasureToWin})`);
    } else {
      const defender = foe.board.find((c) => c.uid === action.target);
      const idx = foe.board.indexOf(defender);
      if (hasKeyword(attacker, 'odm') && defender.hp >= attacker.atk) {
        power += 2;
        log(s, `🪢 입체기동! 큰 적의 목덜미를 노린다. (공격력 +2)`);
      }
      const dealt = hurt(defender, power, true, !!attacker.revived); // 망령으로 되살아난 선원은 고무를 뚫고 지나간다
      const slash = hasKeyword(attacker, 'slash');
      const thorns = hasKeyword(defender, 'thorns') && !slash ? 1 : 0;
      const hadShield = attacker.shield;
      const back = slash ? 0 : hurt(attacker, defender.atk + thorns, true, !!defender.revived);
      if (hadShield && !attacker.shield && defender.atk + thorns <= 0) log(s, `🛡 「${CARDS[defender.defId].name}」의 반격에 「${aName}」의 보호막이 깨졌다.`);
      if (thorns) log(s, `🌵 가시에 찔렸다!`);
      if (slash) log(s, `⚔ 일섬! 반격을 받지 않았다.`);
      if (hasKeyword(attacker, 'lifesteal')) heal(s, me, dealt);
      if (hasKeyword(defender, 'lifesteal')) heal(s, foe, back);
      log(s, `⚔ 「${aName}」 vs 「${CARDS[defender.defId].name}」`);
      if (dealt && hasKeyword(attacker, 'scorch') && defender.hp > 0) {
        defender.burning = true;
        log(s, `🔥 「${CARDS[defender.defId].name}」에 불이 붙었다.`);
      }
      // 냉기: 서로 피해를 주고받은 뒤 살아남은 상대를 얼린다.
      if (dealt && hasKeyword(attacker, 'chill') && defender.hp > 0) {
        defender.frozen = true;
        log(s, `❄ 「${CARDS[defender.defId].name}」이(가) 얼어붙었다.`);
      }
      if (back && hasKeyword(defender, 'chill') && attacker.hp > 0) {
        attacker.frozen = true;
        log(s, `❄ 「${aName}」이(가) 얼어붙었다.`);
      }
      // 뻗기: 양옆에 있는 적 선원 중 무작위 하나에게 1 피해.
      if (hasKeyword(attacker, 'reach')) {
        const sides = [foe.board[idx - 1], foe.board[idx + 1]].filter(Boolean);
        const side = sides[Math.floor(s.rng() * sides.length)];
        if (side && hurt(side, 1)) log(s, `🤸 뻗은 팔이 「${CARDS[side.defId].name}」도 후려쳤다.`);
      }
      removeDead(s);
    }
    // 연타: 한 턴에 한 번 더 공격할 수 있다.
    if (hasKeyword(attacker, 'double') && !attacker.doubled && attacker.hp > 0) {
      attacker.doubled = true;
      attacker.canAttack = true;
    }
    checkWinner(s);
    return null;
  }

  if (action.type === 'end') {
    const g = effectApi(s, pi);
    for (const c of me.board) {
      if (hasKeyword(c, 'tension') && !c.attacked && c.tension < 3) c.tension++;
      if (hasKeyword(c, 'grow') && c.grown < RULES.growLimit) {
        c.grown++;
        c.atk++;
        c.hp++;
        c.maxHp++;
      }
    }
    for (const c of [...me.board]) {
      const d = CARDS[c.defId];
      if (d.onTurnEnd) d.onTurnEnd(g, c);
    }
    checkWinner(s);
    if (s.winner !== null) return null;
    s.current = 1 - pi;
    startTurn(s);
    return null;
  }

  return '알 수 없는 행동.';
}

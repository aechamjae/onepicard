// 상황에 따라 효과가 달라지는 카드·리더 스킬이 "지금 내면 어떻게 되는지" 미리 알려 준다.
// 돌려주는 값: { tone: 'ok' | 'no' | 'info', short: 카드 위 꼬리표, long: 안내 문장 } 또는 null(알릴 것 없음).
import { CARDS } from './cards.js';
import { exchangePick, targetable } from './engine.js';

const kws = (d) => d.keywords || [];
const foes = (foe) => targetable(foe.board).filter((c) => !CARDS[c.defId].noAttack);
const nm = (c) => CARDS[c.defId].name;

function exchangeHint(me, exceptUid, what) {
  const pick = exchangePick(me, exceptUid);
  if (!pick) return { tone: 'no', short: '⚗ 바칠 카드 없음', long: `손패에 바칠 카드가 없어 ${what} 효과는 빠져요. (행운의 동전은 바치지 않아요)` };
  const mat = kws(CARDS[pick.defId]).includes('material') ? ' 재료 효과도 함께 터져요.' : '';
  return { tone: 'ok', short: `⚗ ${nm(pick)} 바침`, long: `「${nm(pick)}」을(를) 재료로 바치고 ${what} 효과가 붙어요.${mat}` };
}

// 손패 카드 하나. me = 카드 주인, foe = 상대.
export function cardCondition(me, foe, card) {
  const d = CARDS[card.defId];
  if (kws(d).includes('trade')) {
    return me.treasure >= 1
      ? { tone: 'ok', short: '💰 거래 가능', long: '보물 1개를 자동으로 써서 거래 효과가 붙어요.' }
      : { tone: 'no', short: '💰 보물 없음', long: '보물이 없어 거래 효과는 빠지고 기본 효과만 나요.' };
  }
  if (kws(d).includes('exchange')) return exchangeHint(me, card.uid, '등가교환');
  const list = foes(foe);
  const count = (f, has, none, n = list.filter(f).length) => (n ? { tone: 'ok', short: has(n), long: '' } : { tone: 'no', short: none, long: '' });
  switch (card.defId) {
    case 'hawkeye': {
      const alch = me.board.some((c) => CARDS[c.defId].alchemist);
      return alch
        ? { tone: 'ok', short: '🎯 4 피해', long: '아군 연금술사가 있어 4 피해를 줘요.' }
        : { tone: 'info', short: '🎯 2 피해', long: '아군 연금술사가 없어 2 피해만 줘요. 에드·암스트롱·킴블리·머스탱을 먼저 내면 4 피해.' };
    }
    case 'winry': {
      const ed = me.board.some((c) => c.defId === 'edward');
      return ed
        ? { tone: 'ok', short: '🔧 에드 정비', long: '갑판에 에드가 있어 에드에게 공격력 +1, 체력 +2.' }
        : { tone: 'info', short: '🔧 가장 센 아군', long: '에드가 없어 공격력이 가장 높은 다른 아군을 정비해요.' };
    }
    case 'volcano':
    case 'skewer': {
      const r = count((c) => c.burning, (n) => `🔥 불붙은 적 ${n}`, '🔥 불붙은 적 없음');
      r.long = r.tone === 'ok' ? `불붙은 적 선원 ${r.short.split(' ').pop()}명에게 효과가 들어가요.` : '불붙은 적 선원이 없어 효과가 없어요.';
      return r;
    }
    case 'shatter': {
      const r = count((c) => c.frozen, (n) => `❄ 언 적 ${n}`, '❄ 언 적 없음');
      r.long = r.tone === 'ok' ? '얼어붙은 적 선원 모두에게 3 피해.' : '얼어붙은 적 선원이 없어 효과가 없어요.';
      return r;
    }
    case 'icicle': {
      const n = list.filter((c) => c.frozen).length;
      return n
        ? { tone: 'ok', short: `❄ 언 적 ${n}`, long: `얼어붙은 적 ${n}명 중 하나를 고르면 3 피해, 아니면 1 피해.` }
        : { tone: 'info', short: '❄ 언 적 없음', long: '얼어붙은 적이 없어 지금은 1 피해만 줘요.' };
    }
    case 'thunderspear': {
      const n = list.filter((c) => c.hp >= 5).length;
      return { tone: n ? 'ok' : 'info', short: n ? `🚀 6 피해 대상 ${n}` : '🚀 4 피해', long: n ? `체력 5 이상인 적 ${n}명 중 하나를 고르면 6 피해, 아니면 4 피해.` : '체력 5 이상인 적이 없어 4 피해를 줘요.' };
    }
    case 'plank': {
      const n = list.filter((c) => c.atk <= 3).length;
      return { tone: n ? 'ok' : 'info', short: n ? `🪵 빠뜨릴 적 ${n}` : '🪵 2 피해만', long: n ? `공격력 3 이하인 적 ${n}명 중 하나를 고르면 바로 쓰러뜨려요.` : '공격력 3 이하인 적이 없어 2 피해만 줘요.' };
    }
    default:
      return null;
  }
}

// 리더 스킬.
export function skillCondition(me, foe) {
  const id = me.factionId;
  const list = foes(foe);
  if (id === 'alchemy') return exchangeHint(me, null, '돌벽');
  if (id === 'frost') {
    const n = list.filter((c) => c.frozen).length;
    return { tone: n ? 'ok' : 'info', short: n ? `언 적 ${n}: 2 피해` : '얼리기만', long: n ? `이미 얼어붙은 적 ${n}명 중 하나를 고르면 2 피해, 아니면 얼려요.` : '얼어붙은 적이 없어 고른 적을 얼려요.' };
  }
  if (id === 'shark') {
    const n = list.filter((c) => c.hp < c.maxHp).length;
    return { tone: n ? 'ok' : 'info', short: n ? `다친 적 ${n}: 2 피해` : '1 피해', long: n ? `다친 적 ${n}명 중 하나를 고르면 2 피해, 아니면 1 피해.` : '다친 적이 없어 1 피해를 줘요.' };
  }
  if (id === 'fruit') {
    const n = me.hand.filter((c) => kws(CARDS[c.defId]).includes('ripen') && (c.ripe || 0) < 2).length;
    return { tone: n ? 'ok' : 'info', short: n ? `익힐 카드 ${n}` : '대신 1장 뽑기', long: n ? `손패의 숙성 카드 ${n}장을 한 번 더 익혀요.` : '익힐 숙성 카드가 없어 대신 카드 1장을 뽑아요.' };
  }
  return null;
}


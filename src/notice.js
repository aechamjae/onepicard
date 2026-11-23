// 📢 공지사항: 버전별로 바뀐 점. 새 버전을 아직 안 봤으면 버튼에 빨간 점을 띄운다.
// 새 버전을 낼 때 NOTES 맨 앞에 항목을 하나 추가한다.

export const NOTES = [
  {
    version: '2.0.1',
    items: [
      '📢 공지사항 버튼이 생겼어요. 시작 화면 오른쪽 위에서 업데이트 내용을 볼 수 있어요.',
      '시작 화면의 🎓 튜토리얼 · 📖 카드 도감 · 📊 승률·상성 버튼을 오른쪽 위로 옮겼어요.',
      '📊 승률·상성이 내 전적 · 평균 승률 · 표준편차 · 상성표 탭으로 나뉘어, 버튼만 눌러 표를 볼 수 있어요. 상성표는 화면 폭에 맞춰 줄어들어요.',
      '얼음·닻 등으로 턴을 쉰 선원은 그 턴이 끝나면 표시가 풀려요. 이제 「얼어붙음」이 보이는 동안에는 고드름 투척도 3 피해가 들어가요.',
      '공격할 대상을 고를 때 칠 수 있는 카드에는 빨간 테두리와 🎯, 칠 수 없는 카드는 흐리게 보여요.',
      '얼음·닻 같은 상태 꼬리표를 카드 위쪽 가장자리로 옮겨 이름과 그림을 가리지 않아요.',
      '튜토리얼은 항상 같은 손패로 시작해요.',
      '📊 승률·상성에 AI 상성 표준편차표를 더했어요. 해적단마다 상대를 얼마나 타는지 볼 수 있어요.',
    ],
  },
  {
    version: '2.0.0',
    items: [
      '해적단마다 고유 공격 연출이 생겼어요. 대포, 물대포, 유령 분신, 불칼, 바나나, 태엽 펀치, 참격파, 돌풍, 어뢰, 금화, 얼음 숨결, 과일 비, 돌진, 포자 구름, 와이어 기동, 연성진, 고무 펀치. 공용 카드는 가볍게 돌진해요.',
      '게임 화면의 ✨ 연출 버튼으로 연출을 끌 수 있어요.',
      '연타: 맞는 순간에 바로 다음 행동을 받고, 연출 중에도 다음 공격을 미리 골라 두면 이어서 쳐요.',
      '공격 못 하는 선원에 원인별 꼬리표가 붙어요: ❄ 얼어붙음 · ⚓ 닻에 묶임 · 🍌 미끄러짐 · 💤 마취됨 · 🪢 붙잡힘 · 💰 매수됨.',
      '등장 효과나 전술로 바뀐 점(공격력, 불, 보호막, 얻은 키워드…)이 카드 위에 떠올라요.',
      '고른 선원을 한 번 더 누르면 그 선원의 상태와 정보를 크게 볼 수 있어요.',
      '🎓 튜토리얼: 실제 한 판을 두면서 거의 모든 요소를 하나씩 배워요.',
      '탄력이 반격에도 들어가요. 냉기는 공격할 때만 얼리고 반격으로는 얼리지 않아요.',
      '밸런스 패치: 모든 해적단 평균 승률이 48~52% 안에 들어왔어요.',
      '유령선단의 덱켄이 브룩으로 이름을 바꿨어요.',
    ],
  },
];

const $ = (id) => document.getElementById(id);
const KEY = 'noticeSeen';

function seen() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function renderNoticeDot() {
  $('notice-btn').querySelector('.dot').hidden = seen() === NOTES[0].version;
}

export function openNotice() {
  $('notice-body').innerHTML = NOTES.map((n, i) => `
    <section class="notice-ver">
      <h3>v${n.version}${i === 0 ? ' <span class="new">최신</span>' : ''}</h3>
      <ul>${n.items.map((t) => `<li>${t}</li>`).join('')}</ul>
    </section>`).join('');
  $('notice').hidden = false;
  try { localStorage.setItem(KEY, NOTES[0].version); } catch {}
  renderNoticeDot();
}

export function setupNotice() {
  $('notice-btn').onclick = openNotice;
  $('notice-close').onclick = () => { $('notice').hidden = true; };
  $('notice').onclick = (e) => { if (e.target.id === 'notice') $('notice').hidden = true; };
  renderNoticeDot();
}

export interface NarrationEntry {
  lines: string[];
  speaker?: string;
}

export const NARRATION = {
  gameStart: {
    lines: [
      '어둠이 깔린 던전의 입구.',
      '끝없는 저주가 이곳을 지배한다.',
      '하지만 너는... 이미 돌아갈 곳이 없다.',
    ],
  } as NarrationEntry,

  regionEnter: {
    1: {
      lines: [
        '숲의 나무들이 어둠에 물들었다.',
        '슬라임과 고블린들이 길을 막는다.',
        '첫 번째 시험이 시작된다.',
      ],
    },
    2: {
      lines: [
        '죽은 자들이 일어나 걷는 곳.',
        '그들의 눈에는 증오만이 남아있다.',
        '살아있다는 것 자체가 죄가 되는 곳.',
      ],
    },
    3: {
      lines: [
        '열기가 폐를 태운다.',
        '이곳에 사는 것들은 불로 태어나 불로 죽는다.',
        '마왕의 기운이 짙게 느껴진다.',
      ],
    },
  } as Record<number, NarrationEntry>,

  miniBossEnter: {
    1: { lines: ['이 던전에 발을 들인 것을 후회하게 될 것이다!'], speaker: '???' },
    2: { lines: ['살아있는 자여... 네 뼈도 내 군단에 합류시켜 주마.'], speaker: '해골 장군' },
    3: { lines: ['이 불길 속에서 살아남을 수 있을 것 같으냐!'], speaker: '화염 수호자' },
  } as Record<number, NarrationEntry>,

  miniBossClear: {
    1: {
      lines: ['첫 관문을 넘었다.', '하지만 진짜 어둠은 더 깊은 곳에 있다.'],
    },
    2: {
      lines: ['해골들의 움직임이 멈추었다.', '하지만 더 깊은 곳에서 불길한 기운이 느껴진다.'],
    },
    3: {
      lines: ['화염이 잠시 잦아들었다.', '마왕의 방이 가까워지고 있다...'],
    },
  } as Record<number, NarrationEntry>,

  finalBossEnter: {
    1: {
      lines: ['감히 내 영역까지 침범하다니...', '네 목숨으로 그 대가를 치르게 해주지!'],
      speaker: '어둠의 군주',
    },
    2: {
      lines: ['수백 년을 기다렸다...', '네 영혼으로 마왕의 봉인을 깨뜨려 주마!'],
      speaker: '망자의 왕',
    },
    3: {
      lines: ['여기까지 오다니... 인정하지.', '하지만 이곳이 네 무덤이 될 것이다!'],
      speaker: '화산의 마왕',
    },
  } as Record<number, NarrationEntry>,

  regionClear: {
    1: {
      lines: [
        '어둠의 숲을 벗어났다.',
        '하지만 던전은 아직 끝나지 않았다.',
        '더 깊은 곳에서 무언가가 기다리고 있다...',
      ],
    },
    2: {
      lines: ['죽음의 영역을 통과했다.', '살아있음에 감사하라.', '마지막 시련이 앞에 놓여 있다.'],
    },
    3: {
      lines: [
        '마왕의 봉인이 다시 완성되었다.',
        '하지만 던전은 여전히 살아 숨쉬고 있다.',
        '다음 런은... 더 강해진 적들이 기다린다.',
      ],
    },
  } as Record<number, NarrationEntry>,

  runClear: {
    lines: [
      '모든 봉인이 복구되었다.',
      '저주받은 던전은 다시 잠들었지만...',
      '용사의 저주는 아직 풀리지 않았다.',
      '언젠가 다시, 던전이 깨어날 것이다.',
    ],
  } as NarrationEntry,

  gameOver: {
    lines: ['어둠이 너를 삼켰다.', '하지만... 저주받은 자는 진정으로 죽지 않는다.'],
  } as NarrationEntry,
};

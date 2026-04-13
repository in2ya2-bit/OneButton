# Monster Clicker — 개발 가이드 (CLAUDE.md)

> Phaser 3 + TypeScript + Vite + Electron | Steam 배포 목표

---

## 기술 스택
- Phaser 3 — 게임 엔진
- TypeScript (strict mode) — 타입 안전성
- Vite — 번들러
- Electron — 데스크톱 패키징
- ESLint + Prettier — 코드 품질 강제

---

## 폴더 구조
src/
├── config/      # 밸런스 상수, 레이아웃 상수 (매직 넘버 금지)
├── types/       # 공유 인터페이스 및 타입 정의
├── data/        # 게임 데이터 (monsters, skills, classes, relics...)
├── objects/     # Phaser GameObject 단위 컴포넌트
├── scenes/      # Phaser Scene (씬 하나 = 역할 하나)
├── systems/     # 게임 로직 시스템 (BattleSystem, StageManager 등)
└── ui/          # UI 생성·갱신 담당 (UIManager, OverlayManager 등)

---

## 코딩 규약

### 1. 타입 안전성
- any 타입 금지
- 인터페이스·타입은 src/types/ 또는 해당 data 파일에 명시적으로 선언
- ! (non-null assertion) 사용 시 주석으로 이유 명시

### 2. 매직 넘버 금지
- 모든 수치 상수는 src/config/constants.ts에 이름 있는 상수로 정의
- 예외: 0, 1, -1, 2, 100

### 3. 함수 길이 제한
- 50줄 초과 시 분리 (ESLint warning 발생)
- 연출(tween/fx), 로직(계산), 타이머는 별도 메서드로 분리

### 4. 단일 책임 원칙
- 클래스 하나에 하나의 역할
- Scene은 시스템들을 조합하는 얇은 코디네이터 역할만
- UI 생성과 게임 로직을 같은 메서드에 섞지 말 것

### 5. 씬 분리 원칙
- GameScene — 시스템 조합 + 게임 루프
- BattleSystem — 공격/피격/패링/OD/콤보 계산
- StageManager — 웨이브/문선택/보스패턴 진행
- UIManager — HP바/MP바/스킬슬롯 생성·갱신
- OverlayManager — 상점/유물창/카드선택/게임오버 오버레이

### 6. 이벤트 기반 통신
- 씬 간 직접 참조 대신 Phaser EventEmitter 사용

### 7. 게임 데이터 분리
- 몬스터·카드·스킬·유물 수치는 src/data/ 또는 src/config/ 파일로 관리

---

## 린트·포맷 명령어
npm run lint          # ESLint 검사
npm run lint:fix      # ESLint 자동 수정
npm run format        # Prettier 포맷 적용
npm run format:check  # Prettier 포맷 검사

커밋 전 npm run lint 통과 필수

---

## 작업 규칙
1. 모든 작업은 승인 후 반영
2. 이해 안 되는 내용은 재확인 요청
3. 기능 하나 완성 시 바로 커밋
4. main 브랜치는 항상 실행 가능한 상태 유지
5. 기획 변경·참고 시 Confluence 하위 페이지 참조

---

## 세이브 데이터
- 버전 필드 포함하여 버전 간 호환성 체크
- SaveManager.ts에서 중앙 관리

---

## 해상도 기준
- 기준 해상도: 1920×1080
- Phaser 캔버스: 800×600 (게임 내부 좌표)
- Electron 창 크기 변경 시 스케일링 고려

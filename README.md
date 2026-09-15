# Lotto_Predict

동행복권 **로또 6/45** 과거 당첨번호를 Windows 분석기와 **같은 기준·같은 로직**으로 분석하는 아이폰용 웹 앱입니다.

**당첨번호는 직접 넣지 않습니다.** 1회부터 최신 회차까지 공식 번호를 앱이 자동으로 불러와 반영합니다.

## GitHub에 올리기

이미 만들어 둔 저장소에 이 폴더 안의 파일을 그대로 올리면 됩니다.

올려야 할 것:

- `index.html`
- `js/`
- `data/draws.json`
- `icons/`
- `manifest.webmanifest`
- `sw.js`
- `.nojekyll`
- `.github/workflows/update-draws.yml`
- `scripts/update-draws.py`
- `README.md`

그다음 저장소 **Settings → Pages**에서 Source를 **Deploy from a branch**, branch는 `main`, folder는 `/ (root)`로 저장합니다.

주소 예: `https://<GitHub아이디>.github.io/Lotto_Predict/`

## 아이폰에서 쓰기

1. 위 Pages 주소를 **Safari**로 엽니다.
2. 공유 → **홈 화면에 추가**.

앱을 열면 과거 당첨번호가 이미 들어 있고, 새 회차가 나오면 열 때마다 이어서 붙입니다.

추천 탭에서 분석범위(최근 50회 / 100회 / 전체)와 방식(균형형·통계형·분산형·혼합형)을 고른 뒤 **추천번호 생성**만 누르면 됩니다.

## 로직

Windows `LottoAnalyzer`와 동일합니다.

- 번호 전체 빈도, 최근 빈도, 최근 출현
- 조합의 홀짝, 합계, 구간 분산, 연속수, 끝수 중복
- 과거 1등 조합 제외, 추천끼리 번호 겹침 제한

당첨을 보장하지 않습니다. 통계 분석 결과입니다.

# 🧾 나라장터 자동 견적서 생성기

나라장터 종합쇼핑몰 API를 활용하여 제품번호와 수량만 입력하면 자동으로 견적서를 생성하는 웹 애플리케이션입니다.

## 📋 주요 기능

- ✅ 나라장터 종합쇼핑몰 제품 정보 실시간 조회
- ✅ 여러 제품 동시 견적서 생성
- ✅ 엑셀 파일로 견적서 다운로드
- ✅ 반응형 웹 디자인
- ✅ API 연결 테스트 기능

## 🚀 시작하기

### 1. 사전 준비사항

- Node.js 14.x 이상
- 공공데이터 포털 API 키

### 2. API 키 발급

1. [공공데이터 포털](https://www.data.go.kr) 접속
2. 회원가입 및 로그인
3. "조달청_종합쇼핑몰 품목정보 서비스" 검색
4. 활용 신청
5. 마이페이지에서 API 키 확인

### 3. 설치 방법

```bash
# 1. 프로젝트 클론 또는 다운로드
cd narashop-estimate

# 2. 의존성 패키지 설치
npm install

# 3. API 키 설정
# api/products.js 파일을 열고 15번째 줄에 API 키 입력
const API_KEY = '여기에_발급받은_인증키를_넣으세요';
```

### 4. 실행 방법

```bash
# 개발 서버 실행
npm start

# 브라우저에서 접속
http://localhost:3000
```

## 📁 프로젝트 구조

```
narashop-estimate/
├── api/
│   └── products.js       # Express 서버 및 API 로직
├── public/
│   ├── index.html       # 메인 웹페이지
│   ├── style.css        # 스타일시트
│   └── script.js        # 클라이언트 JavaScript
├── package.json         # 프로젝트 설정
├── vercel.json         # Vercel 배포 설정
├── .gitignore          # Git 제외 파일
└── README.md           # 프로젝트 문서
```

## 🌐 Vercel 배포 방법

### 1. GitHub 저장소 생성

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/[사용자명]/[저장소명].git
git push -u origin main
```

### 2. Vercel 배포

1. [Vercel](https://vercel.com) 접속
2. GitHub 계정으로 로그인
3. "Import Project" 클릭
4. GitHub 저장소 선택
5. 환경 변수 설정 (선택사항)
   - Name: `API_KEY`
   - Value: `발급받은 API 키`
6. "Deploy" 클릭

## 🔧 환경 변수 설정 (선택사항)

보안을 위해 API 키를 환경 변수로 관리할 수 있습니다:

1. 프로젝트 루트에 `.env` 파일 생성
```
API_KEY=발급받은_API_키
```

2. `api/products.js` 수정
```javascript
const API_KEY = process.env.API_KEY || '기본값';
```

## 📝 사용 방법

1. **제품번호 입력**: 나라장터 종합쇼핑몰에서 확인한 제품번호 입력
2. **수량 설정**: 각 제품의 구매 수량 입력
3. **제품 추가**: 여러 제품 견적이 필요한 경우 "+ 제품 추가" 버튼 클릭
4. **견적서 생성**: "견적서 생성 및 다운로드" 버튼 클릭
5. **엑셀 다운로드**: 자동으로 엑셀 파일이 다운로드됨

## 🐛 문제 해결

### API 키 오류
- API 키가 올바르게 설정되었는지 확인
- 공공데이터 포털에서 API 활용 승인 상태 확인

### 제품 조회 실패
- 제품번호가 정확한지 확인
- 나라장터 종합쇼핑몰에서 해당 제품이 존재하는지 확인

### 서버 연결 실패
- Node.js가 설치되어 있는지 확인
- `npm install`로 모든 패키지가 설치되었는지 확인
- 3000번 포트가 사용 중이 아닌지 확인

## 📄 라이선스

MIT License

## 👨‍💻 개발자

- AI Tool을 활용한 개발

## 🙏 감사의 말

- 공공데이터 포털
- 조달청 나라장터

## 📞 문의사항

문제가 있거나 기능 요청이 있으시면 Issues를 통해 알려주세요.
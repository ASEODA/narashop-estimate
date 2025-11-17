# 📦 배포 및 설치 가이드

## 방법 1: Vercel 클라우드 배포 (추천)

인터넷만 있으면 어디서나 접속 가능한 웹사이트로 배포합니다.

### 필요한 것
- GitHub 계정
- Vercel 계정 (무료)

### 배포 단계

1. **GitHub에 코드 업로드**
   ```bash
   git remote add origin https://github.com/[사용자명]/narashop-estimate.git
   git push -u origin main
   ```

2. **Vercel에서 배포**
   - [vercel.com](https://vercel.com) 접속
   - GitHub 계정으로 로그인
   - "Import Project" 클릭
   - GitHub 저장소 선택
   - 환경 변수 설정:
     - Name: `API_KEY`
     - Value: `공공데이터 포털에서 받은 API 키`
   - "Deploy" 클릭

3. **완료!**
   - 제공된 URL로 어디서나 접속 가능
   - 예: `https://narashop-estimate.vercel.app`

## 방법 2: 로컬 설치 (다른 컴퓨터)

각 컴퓨터에서 직접 실행하는 방법입니다.

### 필요한 것
- Node.js 14 이상
- Git (선택사항)

### 설치 단계

1. **코드 다운로드**

   GitHub에서 다운로드:
   ```bash
   git clone https://github.com/[사용자명]/narashop-estimate.git
   cd narashop-estimate
   ```

   또는 ZIP 파일로 다운로드 후 압축 해제

2. **패키지 설치**
   ```bash
   npm install
   ```

3. **API 키 설정**

   `api/products.js` 파일을 열고 16번째 줄 수정:
   ```javascript
   const API_KEY = '여기에_발급받은_API키_입력';
   ```

4. **실행**
   ```bash
   npm start
   ```

5. **브라우저에서 접속**
   ```
   http://localhost:3000
   ```

## 방법 3: 실행 파일로 배포 (Windows)

Node.js 없이도 실행 가능한 .exe 파일로 만들기

### 빌드 단계

1. **pkg 설치**
   ```bash
   npm install -g pkg
   ```

2. **실행 파일 생성**
   ```bash
   pkg . --targets node18-win-x64 --output narashop-estimate.exe
   ```

3. **필요한 파일과 함께 배포**
   ```
   narashop-estimate.exe
   public/ (폴더 전체)
   ```

4. **실행**
   - narashop-estimate.exe 더블클릭
   - 브라우저에서 http://localhost:3000 접속

## 방법 4: USB로 배포

### USB에 포함할 파일들
```
narashop-estimate/
├── api/
│   └── products.js (API 키 설정 필요)
├── public/
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   └── seal.png
├── package.json
├── package-lock.json
├── README.md
└── 실행방법.txt
```

### 실행방법.txt 내용
```
나라장터 견적서 생성기 실행 방법

1. Node.js 설치 (nodejs.org)
2. 명령 프롬프트 실행
3. USB 내 폴더로 이동
   cd D:\narashop-estimate (예시)
4. npm install (처음 한 번만)
5. npm start
6. 브라우저에서 http://localhost:3000 접속
```

## 💡 팁

### API 키 보안
- API 키는 절대 GitHub에 올리지 마세요
- .env 파일 사용 권장
- Vercel 환경 변수 활용

### 회사 정보 변경
`api/products.js`에서 다음 부분 수정:
```javascript
companyName: '(주)문 수 시 스 템',
companyPhone: '052.276.4200',
companyAddress: '울산광역시 중구 운곡길 26',
// ... 필요한 정보 수정
```

### 문제 해결
- 3000번 포트 사용 중: `PORT=3001 npm start`
- API 키 오류: 공공데이터 포털에서 키 재확인
- 이미지 안 보임: seal.png 파일 확인

## 📞 지원
문제가 있으시면 GitHub Issues에 문의해주세요.
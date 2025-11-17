#!/bin/bash

echo "🚀 GitHub 업로드 스크립트"
echo "========================"
echo ""
echo "GitHub 저장소 URL을 입력하세요:"
echo "예: https://github.com/사용자명/narashop-estimate.git"
read REPO_URL

# Git 원격 저장소 추가
git remote add origin $REPO_URL

# 코드 푸시
echo ""
echo "📦 코드를 GitHub에 업로드 중..."
git push -u origin main

echo ""
echo "✅ 완료! GitHub에 코드가 업로드되었습니다."
echo ""
echo "다음 단계:"
echo "1. Vercel.com 접속"
echo "2. Import Git Repository 클릭"
echo "3. 방금 올린 저장소 선택"
echo "4. 환경변수 추가: API_KEY = 공공데이터 API키"
echo "5. Deploy 클릭!"
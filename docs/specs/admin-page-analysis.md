# TOPIK AI Admin 페이지 분석

본 문서는 `docs/architecture/admin-information-architecture.md`의 IA를 기준으로 각 모듈의 목적과 핵심 기능을 정리합니다.

## 1) Dashboard
- 목적: 운영 현황을 한 화면에서 파악
- 핵심 기능: KPI, Work Queue, 알림

## 2) Users
- 목적: 회원 운영과 관계형 운영(B2B/추천인)을 통합 관리
- 핵심 기능: 회원 목록, 회원 상세, B2B 그룹 관리, 추천인 관리

## 3) Community
- 목적: 게시글 품질 유지와 신고 대응
- 핵심 기능: 게시글 관리, 신고 관리

## 4) Message
- 목적: 메일과 푸시를 공용 대상 그룹 기준으로 운영
- 핵심 기능: 메일/푸시 자동·수동 발송, 대상 그룹, 발송 이력

## 5) Operation
- 목적: 운영성 콘텐츠와 설정 관리
- 핵심 기능: 공지사항, FAQ, 이벤트, 챗봇 설정

## 6) Commerce
- 목적: 결제와 판매 운영을 하나의 축으로 관리
- 핵심 기능: 결제 내역, 환불 관리, 쿠폰 관리, 포인트 관리, 이커머스 관리

## 7) Assessment
- 목적: 시험/문항 운영을 위한 별도 관리 축 확보
- 핵심 기능: 문제은행, EPS TOPIK, 레벨 테스트
- 현재 상태: placeholder 중심, 권한과 메뉴만 선반영

## 8) Content
- 목적: 콘텐츠/보상/단어장 운영을 위한 별도 관리 축 확보
- 핵심 기능: 콘텐츠 관리, 배지, 단어장, 소나기, 객관식 선택, 학습 미션
- 현재 상태: placeholder 중심, 권한과 메뉴만 선반영

## 9) Analytics
- 목적: 운영 의사결정을 위한 지표 추적
- 핵심 기능: 통계 개요

## 10) System
- 목적: 관리자 권한과 로그 거버넌스 확보
- 핵심 기능: 관리자 계정, 권한 관리, 감사 로그, 시스템 로그

## 모듈 간 연결 포인트

- Users <-> Commerce: 회원 상세 결제 탭에서 결제 내역으로 이동
- Message -> Analytics: 채널별 발송 효과 지표 연동
- Assessment/Content -> System: 콘텐츠형 모듈 변경도 감사 로그 대상
- Operation/Commerce/Users의 변경 액션은 모두 System의 감사 로그에 기록

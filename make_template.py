import json, os, random
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

HERE=os.path.dirname(__file__)
# Useful early samples: the first page covers common greetings and everyday phrases.
phrases=[
'안녕하세요 반갑습니다 오늘도 좋은 하루 보내세요 사랑하고 고맙습니다 행복하세요',
'나의 손글씨로 쓰는 마음 편지 우리 함께 오래오래 즐겁게 지내요',
'이 세상 모든 순간을 기억해요 언제나 따뜻한 사람이 되고 싶어요',
'날씨가 좋아서 기분도 좋은 하루입니다 작은 일에도 웃으며 살아가요',
'너에게 전하고 싶은 이야기가 있어 정말 많이 고마워 사랑해',
'오늘은 어제보다 더 멋진 날이 될 거예요',
'생일 축하합니다 새해 복 많이 받으세요',
'글씨를 쓰는 순간 당신의 이야기가 시작됩니다',
'우리의 아름다운 결혼식을 초대합니다 소중한 날',
'여름 가을 겨울 봄 하늘 별 달 바다 꽃 나무 햇살',
'친구 가족 엄마 아빠 형 동생 언니 누나 오빠',
'천천히 하나씩 나아가면 괜찮아요',
'커피 한 잔과 책 한 권 그리고 조용한 오후',
'새로운 시작 아름다운 기억 소중한 만남',
'고생했어 수고했어 잘했어 좋아해 보고싶어',
'기쁘고 슬프고 설레고 행복하고 아쉽고',
'하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 열',
'가나다라마바사아자차카타파하',
'거너더러머버서어저처커터퍼허',
'고노도로모보소오조초코토포호',
'구누두루무부수우주추쿠투푸후',
'기니디리미비시이지치키티피히',
'각 간 갈 감 갑 강 갇 갔 갚 갠 걱 걷 건 걸 검 겁 것 게 겠 겨 격 결 경 계',
'과 관 괜 광 교 구 국 군 굴 궁 권 귀 균 그 극 근 글 금 급 긋 긍 기 긴 길 김 깃 깊',
'깨 께 꼭 꽃 꿈 끝 끼 난 남 낫 낮 내 냄 냐 널 넓 넘 네 녀 년 녹 논 놈 높 누 눈',
'다 단 달 담 답 당 대 덕 던 덜 데 도 독 돈 돌 동 돼 된 두 둔 둘 드 든 들 등 디',
'때 떠 떡 또 뚜 라 랑 래 러 런 렇 레 려 력 련 렬 로 록 론 롤 료 루 류 르 린',
'마 막 만 말 맛 망 맞 매 맴 머 먼 멀 메 며 면 명 모 목 몫 몰 못 무 문 물 미 민 믿',
'바 박 반 발 밤 방 배 백 버 번 벌 벽 변 별 병 보 복 본 볼 봄 봉 봐 부 분 불 비 빛',
'사 산 살 상 새 색 생 서 선 설 섬 성 세 셔 소 속 손 솔 송 수 숙 순 술 숨 시 식 신 실 심 십',
'아 악 안 알 암 앉 앞 애 약 양 어 언 얼 엄 업 에 여 역 연 열 영 예 오 옥 온 올 옷 와 완 왕 왜 외 요 욕 용 우 운 울 원 월 위 유 육 율 으 은 을 음 의 이 익 인 일 임 입 있 잊',
'자 작 잔 잘 잠 장 재 저 적 전 절 점 정 제 조 족 존 종 좋 좌 죄 주 죽 준 줄 중 쥬 지 직 진 질 집 짓 짝 짧',
'차 참 창 채 책 처 천 철 첫 청 체 초 촉 총 최 추 축 춘 출 충 취 층 치 친 칠 침 칭',
'카 칼 커 컴 코 콕 콩 쿠 큰 클 키 타 탁 탄 탈 탐 태 터 턴 텍 토 통 퇴 투 특 틀 티',
'파 판 팔 팝 패 퍼 펜 편 평 포 폭 표 푸 풀 풍 프 피 필 핑 하 학 한 할 함 합 항 해 햇 행 향 허 헉 험 혀 현 형 혜 호 혹 혼 홀 화 확 환 활 황 회 획 효 후 훌 휴 흐 흥 희 힘',
'가구 나무 다리 마음 바람 사람 하루 꿈꾸는 아침 저녁 오후',
'기억이 남는 순간 사진으로 간직해 주세요 멋져요',
'가끔 조용히 창밖을 바라보며 생각해요',
'손으로 쓰면 조금 느리지만 더 오래 남아요',
]
chars=[]
for s in phrases:
    for ch in s:
        if ch.isspace():continue
        if ('가'<=ch<='힣') and ch not in chars:
            chars.append(ch)
extras=list('0123456789.,!?-:()/&+%')
# Leave space for common punctuation in the last 3 pages
N=243
core=chars[:N-len(extras)]
while len(core)<N-len(extras):
    for code in range(ord('가'),ord('힣')+1):
        c=chr(code)
        if c not in core:
            core.append(c)
            break
entries=core+extras
assert len(entries)==N and len(set(entries))==N
layout={'version':1, 'paperMm':[210,297], 'markersMm':[[12,13],[198,13],[198,284],[12,284]], 'grid':{'x':20, 'y':54, 'w':18.9,'h':19.55,'cols':9,'rows':9}, 'pages':[entries[i:i+81] for i in range(0,N,81)]}
with open(os.path.join(HERE,'glyph-layout.json'),'w',encoding='utf8') as f:json.dump(layout,f,ensure_ascii=False,indent=2)

font='/usr/share/fonts/truetype/nanum/NanumSquareR.ttf'
fontbold='/usr/share/fonts/truetype/nanum/NanumSquareB.ttf'
pdfmetrics.registerFont(TTFont('Nanum',font))
pdfmetrics.registerFont(TTFont('NanumBold',fontbold))
filename=os.path.join(HERE,'손글씨_가이드용지_3장.pdf')
c=canvas.Canvas(filename,pagesize=(210*72/25.4,297*72/25.4),pageCompression=1)
PT=72/25.4
H=297

def rect_top(x,y,w,h,fill,stroke=None,width=0.3,rounding=0):
    c.setLineWidth(width*PT)
    c.setFillColor(HexColor(fill))
    c.setStrokeColor(HexColor(stroke or fill))
    if rounding:c.roundRect(x*PT,(H-y-h)*PT,w*PT,h*PT,rounding*PT,stroke=bool(stroke),fill=True)
    else:c.rect(x*PT,(H-y-h)*PT,w*PT,h*PT,stroke=bool(stroke),fill=True)
def txt(x,y,s,size=10,color='#22211f',font='Nanum'):
    c.setFont(font,size)
    c.setFillColor(HexColor(color))
    c.drawString(x*PT,(H-y)*PT,s)

for page_i,page in enumerate(layout['pages']):
    rect_top(0,0,210,297,'#fffefb')
    txt(20,22,'MY HANDWRITING STUDIO',10,'#887469','NanumBold')
    txt(20,36,'나의 손글씨 수집 시트',19,'#24211f','NanumBold')
    txt(20,45,'각 칸의 작은 글자를 참고해 중앙에 검은 펜으로 크게 써주세요.',9,'#716a63')
    txt(164,36,f'{page_i+1} / 3',12,'#a76958','NanumBold')
    for mi,(mx,my) in enumerate(layout['markersMm']):
        rect_top(mx-2.2,my-2.2,4.4,4.4,'#22211f')
        rect_top(mx-0.5,my-0.5,1,1,'#fffefb')
    gx,gy,gw,gh=20,54,18.9,19.55
    for i,ch in enumerate(page):
        col,row=i%9,i//9
        x,y=gx+col*gw,gy+row*gh
        c.setLineWidth(0.26*PT)
        c.setStrokeColor(HexColor('#d5d0c9'))
        c.roundRect(x*PT,(H-y-gh)*PT,gw*PT,gh*PT,1.1*PT,stroke=1,fill=0)
        # faint crosshair / guideline: should not survive thresholding
        c.setLineWidth(0.18*PT)
        c.setStrokeColor(HexColor('#f1eeea'))
        c.line((x+2)*PT,(H-y-gh*0.69)*PT,(x+gw-2)*PT,(H-y-gh*0.69)*PT)
        txt(x+1.8,y+3.8,ch,8,'#b0aaa3')
    y=241.5
    txt(20,y,'자연스럽게 한 문장 써보기 (이 영역은 필체 비교용입니다)',8.7,'#87786d')
    for j in range(2):
        c.setStrokeColor(HexColor('#d8d3cb'))
        c.setLineWidth(.25*PT)
        c.line(21*PT,(H-(y+11+j*10))*PT,189*PT,(H-(y+11+j*10))*PT)
    txt(20,276,'TIP: 네 모서리의 검은 마커가 사진에 모두 나오게 촬영해 주세요.',8,'#9a8172')
    c.showPage()
c.save()
print('built',filename,'chars',len(entries),'first line',entries[:18])

# 이 번역 툴이 운영국의 '외부툴 사용에 따른 밴' 정책에 대해 안전하다고 보장해줄 수 없음. 

# gbfTransKor

다운로드 : https://github.com/ajh1000/gbfTransKor/archive/master.zip

내 프로그램 개발이 완료되면 원본 개발자님 프로그램에 합쳐짐.

## 사용법 (일반 사용자)

### 메인 스토리 번역하는 법
1. 확장 프로그램 - option page - Use Extraction mode 체크 - Use Local DB 버튼 클릭.
2. 게임으로 돌아와 새로고침 한번 눌러주기. 확장 프로그램 버튼 눌러서 우상단의 clear Cache 버튼들 3개를 전부 눌러주기.
3. 게임에서 메뉴 - 루리아노트(영어판은 journal) - 스토리 - 메인스토리 번역하고싶은거 클릭 - 챕터 번역하고싶은거 클릭 - 에피소드 번역하고싶은거 클릭
4. 스킵버튼 누르지말고 스토리 끝날때까지 광클릭
5. 스토리 다 끝나서 에피소드 선택 화면으로 돌아오면 확장프로그램 클릭
6. 좌상단 Get Text 버튼 누르기 - 결과물이 잘 출력된걸 확인하고 오른쪽에 Download csvFile 클릭
7. 다운받아진 csv 파일을 컴퓨터에 깔린 엑셀이나, 메모장 종류 프로그램 또는 구글 스프레드시트를 이용하여 열기
8. 3번째 칸에는 원문이 적혀있는데 이걸 4번째칸에 그대로 붙여넣기한다음 원문 써져있는 부분들을 번역하기

### 이벤트 스토리 번역하는 법

1. 확장 프로그램 - option page - Use Extraction mode 체크 - Use Local DB 버튼 클릭.
2. 게임으로 돌아와 새로고침 한번 눌러주기. 확장 프로그램 버튼 눌러서 우상단의 clear Cache 버튼들 3개를 전부 눌러주기.
3. 게임에서 메뉴 - 루리아노트(영어판은 journal) - 스토리 - 이벤트 탭 누르기 - 이벤트 번역하고싶은거 클릭 - 챕터 번역하고싶은거 클릭 - 에피소드 번역하고싶은거 클릭
4. 스킵버튼 누르지말고 스토리 끝날때까지 광클릭
5. 스토리 다 끝나서 에피소드 선택 화면으로 돌아오면 확장프로그램 클릭
6. 좌상단 Get Text 버튼 누르기 - 결과물이 잘 출력된걸 확인하고 오른쪽에 Download csvFile 클릭
7. 다운받아진 csv 파일을 컴퓨터에 깔린 엑셀이나, 메모장 종류 프로그램 또는 구글 스프레드시트를 이용하여 열기
8. 3번째 칸에는 원문이 적혀있는데 이걸 4번째칸에 그대로 붙여넣기한다음 원문 써져있는 부분들을 번역하기

### 이벤트 스토리 번역하는 법 - 주의사항

텍스트를 추출하면 

```
index,sceneCode,orig,kr
0,"scene_k93tyq4nic_cp0_q3,1,754901",Zzz...,쿨쿨...
1,"scene_k93tyq4nic_cp0_q3,1,754901","Nice work, everyone!",여러분! 수고하셨습니다!
```
이런식으로 sceneCode 부분(```"scene_k93tyq4nic_cp0_q3,1,754901"```)이 추출되는게 정상임. 그러나, 음성이 추가되있지 않은 이벤트들은 
```
index,sceneCode,orig,kr
0,"754901,1",Zzz...,쿨쿨...
1,"754901,1","Nice work, everyone!",여러분! 수고하셨습니다!
```
sceneCode(```"754901,1"```)에서 코드 한개가 빠져있음. 이렇게 빠진 sceneCode를 찾기 위해서 
1. 루리아노트(영어판은 journal)가 아니라 이벤트 페이지(우상단 메뉴 버튼누르면 보이는 이벤트 배너 이미지)에 들어가서 직접 해당 에피소드를 플레이. 

2. 첫번째 텍스트 보이자마자 확장 프로그램 클릭 - get Text 버튼 클릭 - 처음보는 sceneCode를 마우스 긁어서 복사하기. 

3. 복사한 sceneCode를 엑셀 파일에 돌아와서 ```0,"754901,1",Zzz...,쿨쿨...``` 를 ```0,"754901,1,scene_k93tyq4nic_cp0_q3",Zzz...,쿨쿨...``` 로 바꿔주기



군인이라 사지방에서 작성중.
사지방에서는 화면 녹화 프로그램을 설치하는게 안되서 사용법 영상을 못찍는점 양해부탁드립니다.


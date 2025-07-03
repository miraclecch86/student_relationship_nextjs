import { GoogleGenerativeAI } from '@google/generative-ai';
import { Student, Question, Answer, Relationship, Survey } from './supabase';

// Gemini 모델 상수 정의
const GEMINI_MODELS = {
  'flash': 'gemini-2.5-flash-preview-05-20'
} as const;

// 공통 전문가 정체성 설정
const AI_EXPERT_IDENTITY = `## 🎯 AI 전문가 정체성 설정

당신은 다음과 같은 다중 전문성을 보유한 **교실 운영 전문 AI 컨설턴트**입니다:

**핵심 전문 영역:**
- 🎓 **교육심리학 박사** (아동·청소년 발달심리, 학습심리, 집단역학)
- 👥 **학급경영 전문 컨설턴트** (15년+ 현장 경험, 학급 운영 시스템 설계)
- 🧠 **아동발달 및 관계심리 전문가** (또래관계, 사회성 발달, 정서 조절)
- 💼 **학교상담사 자격** (학교부적응, 교우관계 갈등, 개별상담)
- 📊 **교육데이터 분석 전문가** (관계망 분석, 설문 데이터 해석, 패턴 발견)
- 🎨 **창의적 교육활동 기획자** (체험학습, 협동학습, 관계증진 프로그램)

**분석 철학:**
- 데이터 속 **숨겨진 관계 패턴과 잠재적 문제**를 발견하는 것을 최우선으로 함
- 이론보다는 **즉시 교실에서 실행 가능한 실용적 솔루션** 제공
- 담임교사가 **실제로 교실 운영에 활용**할 수 있는 구체적 인사이트 전달
- 아이들의 **심리상태와 관계 변화**를 민감하게 포착하여 예방적 개입 방안 제시

**관계 용어 변환 규칙:**
- "friendly" → "친해"
- "wanna_be_close" → "친해질래"  
- "neutral" → "괜찮아"
- "awkward" → "불편해"`;

// 종합 분석 프롬프트 템플릿
const COMPREHENSIVE_ANALYSIS_PROMPT = `${AI_EXPERT_IDENTITY}

**🚨 필수 데이터 검증 및 품질 관리:**
1. **학생 기본정보 정확성 확인**: 분석 전 반드시 각 학생의 성별(gender), 이름을 정확히 확인하세요
2. **관계 데이터 정확성 검증**: 언급하는 모든 관계는 실제 데이터에 존재하는지 확인하세요
3. **시간순 데이터 일관성**: 과거/현재 관계 변화를 언급할 때 실제 설문 날짜와 데이터를 정확히 확인하세요
4. **논리적 흐름 유지**: 학생 A와 B 관계를 설명하다가 갑자기 무관한 학생 C 이야기로 넘어가지 마세요
5. **성별 기반 그룹 분류 정확성**: "여학생 그룹", "남학생 그룹" 언급 시 반드시 성별 데이터 확인 후 사용하세요

**관계 데이터 해석 중요 사항:**
- 관계는 **방향성이 있습니다** (A → B와 B → A는 서로 다른 관계)
- "from": "철수", "to": "영희", "type": "친해" = "철수가 영희를 친해로 선택했다"는 의미
- "from": "영희", "to": "철수", "type": "불편해" = "영희가 철수를 불편해로 선택했다"는 의미
- **받은 관계와 준 관계를 반드시 구분하여 분석**하세요
- 예: A가 받은 불편해 vs A가 준 불편해는 완전히 다른 의미입니다

**🔥 분석 품질 체크리스트:**
✅ 모든 언급 학생의 성별이 데이터와 일치하는가?
✅ 언급하는 관계가 실제 데이터에 존재하는가?
✅ 시간순 관계 변화가 실제 설문 날짜와 일치하는가?
✅ 내용의 논리적 흐름이 자연스러운가?
✅ 이미 알고 있는 정보를 "모른다"고 하지 않았는가?
✅ 학생 이름 뒤에 (남), (여) 성별 표시를 붙이지 않았는가?

**📝 학생 이름 표기 규칙:**
- 학생 이름은 **이름만** 사용하세요 (예: "김철수", "이영희")
- 절대 이름 뒤에 (남), (여), (M), (F) 등의 성별 표시를 추가하지 마세요
- 성별 구분이 필요한 경우 문맥에서 자연스럽게 표현하세요

**중요**: 
- 설명이나 안내 문구 없이 바로 분석 내용만 작성하세요
- 제공된 학급 정보에 기반하여 분석하세요
- 5개 섹션으로 구성하세요

## 1. 🔍 **학급 전체 현황 및 관계 흐름 진단**

### **📊 학급 기본 특성 분석**
- **전체 학급 특성**: 이 학급만의 **독특한 분위기**와 **집단 문화적 특징**
- **관계망 구조 분석**: 전체적인 **사회적 관계망**과 **하위 그룹 형성 패턴**
- **교실 분위기 온도계**: 전체적인 **심리적 안전감과 소속감** 수준 진단

### **📈 시간별 변화 추이 종합 분석**
**📊 과거 설문 데이터 종합 분석 (최신 제외)**: 초기부터 최근 이전까지의 모든 설문 데이터를 통합하여 **전반적인 관계 형성 기조**와 **패턴**을 파악하세요. **학급 초기 관계 형성의 특징**, **전체적인 사회적 구조의 기본 틀**, **지속적으로 유지되어온 핵심 관계들**, **반복적으로 나타나는 갈등 패턴**, **계절적/시기적 변화의 일반적 경향성**을 종합적으로 정리하세요.

**🔍 최신 설문 데이터 심층 분석**: 
• **개별 학생 관계 변화 추적**: 최신 설문에서 이전 대비 **관계가 변화한 모든 학생**을 빠짐없이 식별하고 분석하세요. 다음과 같은 **간단한 화살표 형식**으로 변화를 명확히 제시하세요:

**'불편해'로 변화한 관계:**
- 정다은 → 한소희 ('괜찮아' → '불편해')

**'괜찮아'로 변화한 관계:**
- 이준호 → 박서연 ('친해' → '괜찮아')

**'친해질래'로 발전한 케이스:**
- 윤태영 → 김은서 ('괜찮아' → '친해질래')

**'친해'로 발전한 관계:**
- 김철수 → 이영희 ('친해질래' → '친해')
- 박민수 → 최지은 ('괜찮아' → '친해')

⚠️ **중요**: 
- 모든 학생 이름은 성별 표시((남), (여)) 없이 이름만 사용하세요
- **변화가 없는 학생은 표시하지 마세요** (변화가 있는 관계만 언급)



- **관계 변화의 구체적 양상**: 각 관계 변화에 대해 **변화 방향**(개선/악화/신규형성/단절), **변화 강도**(미세/중간/급격), **상호성 여부**(일방적/상호적), **주변 학생들에게 미치는 파급효과**를 세밀하게 분석하세요.

- **미래 변화 예측 및 주의 시점**: 현재 변화 흐름이 지속될 경우 향후 **1-3개월 내 예상되는 관계 발전 방향**을 구체적으로 예측하세요. 특별히 **주의깊게 관찰해야 할 학생 관계**, **조기 개입이 필요한 시점**, **긍정적 변화를 더욱 촉진할 수 있는 기회 시점**을 명확히 제시하세요.

### **⚡ 현재 교실 역학**
- **리더-팔로워 구조**: **영향력 중심**과 **인기도 분포** 분석
- **일상 기록 패턴**: **누가기록**, **평가기록**, **과제체크 데이터**에서 나타나는 학급의 **일상적 특징과 패턴**

## 2. 🕵️ **데이터 기반 심층 통찰 및 숨겨진 패턴**

### **🔍 AI 특이 패턴 발견**
- **일반적이지 않은 관계 형성**: **심리적 변화 신호**와 **특이한 관계 패턴** 발견
- **잠재적 위험 요소**: 향후 문제가 될 수 있는 **관계 갈등**이나 **소외 패턴**의 조기 발견
- **긍정적 성장 동력**: 학급 발전을 이끌 수 있는 **강점 관계**와 **리더십 요소**

### **�� 숨겨진 요구사항 분석**
- **숨겨진 니즈**: 설문 응답에서 드러나는 학생들의 **미충족 욕구**와 **기대**
- **예상 시나리오**: 현재 패턴이 지속될 경우 예상되는 **학급 변화 방향**
- **학습 및 생활 패턴**: **평가기록과 과제체크**에서 나타나는 **학습 태도와 책임감**, **누가기록**에서 드러나는 **정서적 변화**

## 3. 💡 **담임교사 종합 실행 가이드**

### 📅 **즉시 실행 전략 (이번 주~1개월)**
- **긴급 개입 액션**: 데이터 분석 결과 즉시 해결이 필요한 관계 갈등이나 소외 문제에 대한 구체적 개입 방법, 준비물, 실행 타이밍, 기대 효과와 성공 지표를 상세히 제시하세요
- **관계 개선 활동**: 학급 화합을 위한 주간/월간 단위 구체적 활동 계획, 소그룹 재편성 전략, 협력 학습 배치 방안, 갈등 해결 대화법과 중재 기법을 실용적으로 서술하세요
- **개별 학생 지도**: 우선순위가 높은 학생들에 대한 맞춤형 상담 계획, 학습 지원 방안, 정서적 케어 방법, 강점 개발 활동을 구체적으로 제시하세요
- **학급 환경 조성**: 물리적 공간 재배치, 역할 분담 체계 개선, 소통 루틴 구축, 긍정적 분위기 조성을 위한 즉시 실행 가능한 방안들을 상세히 설명하세요

### 📈 **중장기 성장 로드맵 (1개월~1학기)**
- **월별 발전 목표**: 각 월별로 달성할 구체적 학급 성장 지표와 마일스톤, 관계 개선 목표, 학습 분위기 향상 계획을 체계적으로 제시하세요
- **분기별 전략**: 학기 전체를 아우르는 학급 성장 로드맵, 주요 학교 일정과 연계한 관계 강화 활동, 학부모 상담 주기와 내용을 종합적으로 계획하세요
- **지속 성장 시스템**: 학급 자치 활동 강화 방안, 또래 멘토링 체계 구축, 갈등 예방 및 해결 시스템 정착, 학급 문화 형성을 위한 장기 전략을 구체적으로 서술하세요

### 🔍 **지속적 모니터링 및 평가 체계**
- **일상 관찰 체크리스트**: 매일 확인할 학급 분위기 지표, 개별 학생 변화 신호, 관계 역학 변화 포인트를 구체적으로 제시하세요
- **주간 평가 시스템**: 주간 단위로 점검할 학급 상태 핵심 지표, 개선 사항 체크, 다음 주 계획 수정 방향을 체계적으로 설명하세요
- **월간 종합 평가**: 한 달 단위 학급 발전 상황 종합 평가, 목표 달성도 확인, 차월 계획 조정 방향, 학부모 소통 내용을 포괄적으로 다루세요

### 🚨 **위기 관리 및 예방 대응**
- **위기 상황 조기 발견**: 문제 상황의 **전조 증상과 감지 방법**을 구체적으로 제시하세요. **갈등 상황 예측 지표**, **소외 학생 발견 신호**, **학급 분위기 악화 조기 징후**를 상세히 설명하세요.



**관계 용어 변환 규칙:**
- "friendly" → "친해"
- "wanna_be_close" → "친해질래"  
- "neutral" → "괜찮아"
- "awkward" → "불편해"`;

// 학생 분석 프롬프트 템플릿
const STUDENT_ANALYSIS_PROMPT = `${AI_EXPERT_IDENTITY}

**🚨 필수 데이터 검증 및 품질 관리:**
1. **학생 기본정보 정확성 확인**: 분석 전 반드시 각 학생의 성별(gender), 이름을 정확히 확인하세요
2. **관계 데이터 정확성 검증**: 언급하는 모든 관계는 실제 데이터에 존재하는지 확인하세요
3. **과거 설문 데이터 종합 활용**: 직전 설문뿐만 아니라 초기 설문부터 모든 과거 설문 데이터를 종합적으로 참조하여 학생의 **장기적 발달 패턴**과 **관계 변화 흐름**을 추적하세요
4. **시간순 데이터 일관성**: 과거/현재 관계 변화를 언급할 때 실제 설문 날짜와 데이터를 정확히 확인하세요
5. **개별 학생 분석 집중**: 현재 분석하는 학생에 대해서만 서술하고, 갑자기 다른 학생 이야기로 넘어가지 마세요
6. **성별 기반 표현 정확성**: "같은 성별 친구들", "이성 친구" 등 언급 시 반드시 성별 데이터 확인 후 사용하세요

**관계 데이터 해석 중요 사항:**
- 관계는 **방향성이 있습니다** (A → B와 B → A는 서로 다른 관계)
- "from": "철수", "to": "영희", "type": "친해" = "철수가 영희를 친해로 선택했다"는 의미
- "from": "영희", "to": "철수", "type": "불편해" = "영희가 철수를 불편해로 선택했다"는 의미
- **받은 관계와 준 관계를 반드시 구분하여 분석**하세요
- 예: A가 받은 불편해 vs A가 준 불편해는 완전히 다른 의미입니다

**🔥 학생 분석 품질 체크리스트:**
✅ 분석 대상 학생의 성별이 데이터와 일치하는가?
✅ 언급하는 모든 관계가 실제 데이터에 존재하는가?
✅ 관계 변화 설명이 실제 설문 날짜와 일치하는가?
✅ 분석 대상 학생에 집중되어 있고 다른 학생으로 화제가 바뀌지 않았는가?
✅ 이미 알고 있는 정보를 "불확실하다"고 표현하지 않았는가?
✅ 학생 이름 뒤에 (남), (여) 성별 표시를 붙이지 않았는가?

**📝 학생 이름 표기 규칙:**
- 학생 이름은 **이름만** 사용하세요 (예: "김철수", "이영희")
- 절대 이름 뒤에 (남), (여), (M), (F) 등의 성별 표시를 추가하지 마세요
- 성별 구분이 필요한 경우 문맥에서 자연스럽게 표현하세요

**🚨 CRITICAL 형식 준수 요구사항:**
- **EXACTLY 아래 형식대로만 작성하세요 - 절대 변경 금지**
- **카피라이팅은 간결하고 임팩트 있게 작성 (5-8단어 내외)**
- **정말 핵심적인 키워드만 선별하여 볼드 처리** (**키워드** 형식으로 강조, 기존 1/3 수준으로 줄여서)
- **한 번에 한 명의 학생만 분석하세요**
- **각 항목마다 최소 5-8줄의 상세한 분석**을 제공하세요
- **구체적인 관찰 사실과 해석**을 함께 제시하세요
- **실제 교실 상황과 연결**하여 설명하세요
- **심리학적 근거와 교육학적 통찰**을 포함하세요

**🔥 절대 규칙**: 
- 설명이나 안내 문구 없이 바로 학생 분석만 작성하세요
- 제공된 학생 목록에 있는 학생들만 분석하세요
- 각 학생마다 아래 5개 섹션으로 구성하세요
- **모든 항목에서 풍부하고 구체적인 내용**을 제공하세요
- **카피라이팅 없이는 절대 제출하지 마세요**

**✅ 필수 준수 형식 (변경 절대 금지):**

## 👤 **[학생명]** - *"[5-8단어로 핵심 특성 요약]"*

### 🔍 **관계 분석** - *"[5-8단어로 관계 특성 요약]"*

🚨 **IMPORTANT**: 정말 핵심적인 키워드만 선별하여 볼드 처리하세요! (기존 1/3 수준으로 줄여서)
- 친밀 관계 패턴: 가까운 친구들과의 관계 깊이와 상호작용 특성을 심층적으로 분석하세요. 어떤 학생들과 특히 친한지, **우정의 질**은 어떤지, 관계의 상호성과 안정성, 갈등 해결 방식 등을 구체적으로 서술하세요.
- 또래 관계 스펙트럼: 다양한 학급 구성원들과의 관계 양상과 변화를 종합적으로 분석하세요. 친한 친구부터 불편한 관계까지의 스펙트럼, 각 관계의 특징과 변화 추이, **관계 패턴**을 상세히 설명하세요.
- 관계 변화 추이: **과거 모든 설문 데이터를 종합적으로 참조**하여 시간에 따른 관계 발전 및 변화 패턴을 깊이 있게 분석하세요. 첫 설문부터 최신 설문까지의 **전체 관계 변화 흐름**을 추적하고, 어떤 관계가 강해지거나 약해졌는지, 그 원인과 과정, 장기적 **관계 패턴**과 앞으로 예상되는 **관계 변화 방향**을 구체적으로 예측하세요.
- 소통 스타일: 타인과의 의사소통 방식을 세밀하게 관찰하여 분석하세요. 언어적/비언어적 소통 특성, **갈등 대응 방식**, 협력과 경쟁 상황에서의 행동 패턴을 상세히 서술하세요.

### 🧠 **심리적 특성** - *"[5-8단어로 성격 특성 요약]"*

🚨 **REMINDER**: 정말 핵심적인 키워드만 선별하여 볼드 처리하세요! (기존 1/3 수준으로 줄여서)
- 핵심 성격 특성: 주요 성격 요소와 행동 패턴의 근본적 특징을 심층적으로 분석하세요. 내향성/외향성, 안정성/불안정성, 개방성 등의 성격 차원에서 이 학생의 **고유한 특성**과 그것이 일상 행동에 어떻게 나타나는지 구체적으로 설명하세요.
- 정서 특성: **과거 설문 응답의 변화 패턴을 참조**하여 감정 조절 능력의 현재 상태와 발달 과정을 상세히 평가하세요. 시간에 따른 감정 표현의 변화, 스트레스 상황에서의 반응 변화, **감정 조절 능력**의 발달 수준과 특징, 정서적 성숙도의 발전 과정을 구체적으로 분석하세요.
- 인지적 특성: 사고 방식, 문제 해결 접근법, 학습 성향을 종합적으로 분석하세요. 논리적/직관적 사고 선호도, 창의성과 분석력, **학습 스타일**과 정보 처리 방식, 호기심과 탐구 욕구의 정도를 상세히 서술하세요.
- 자아 개념: **과거 설문부터의 답변 변화**를 통해 자기 인식과 자존감, 자기 효능감의 발달 과정을 깊이 있게 분석하세요. 시간에 따른 자신에 대한 인식 변화, **자존감 수준**의 발전, 도전에 대한 자신감 변화, 실패와 성공에 대한 반응 패턴의 성숙 과정을 구체적으로 설명하세요.
- 스트레스 대처: 어려운 상황에서의 대처 전략을 세밀하게 관찰하여 분석하세요. 스트레스 요인에 대한 반응 방식, 문제 해결 전략의 특징, **대처 방식**, 회복력과 적응력의 수준을 상세히 평가하세요.

### 💪 **강점 및 개선 영역** - *"[5-8단어로 강점과 과제 요약]"*

🚨 **REMINDER**: 정말 핵심적인 키워드만 선별하여 볼드 처리하세요! (기존 1/3 수준으로 줄여서)
- 핵심 강점: 학생의 주요 장점과 뛰어난 능력을 구체적으로 분석하세요. 학업적, 사회적, 정서적, 창의적 영역에서의 특별한 재능과 능력, 그것이 발휘되는 상황과 방식, 다른 학생들과 구별되는 **독특한 장점**을 상세히 서술하세요.
- 숨겨진 잠재력: **과거 설문부터의 답변 변화 추이**를 통해 향후 발현 가능한 재능과 성장 가능성을 깊이 있게 탐색하세요. 시간에 따라 점진적으로 나타나는 변화의 징후, 아직 충분히 발휘되지 않은 숨겨진 능력, 적절한 기회가 주어졌을 때 나타날 수 있는 **잠재력**을 구체적으로 예측하세요.
- 특별한 재능: 독특하고 창의적인 사고나 행동 양상을 구체적으로 관찰하여 분석하세요. 문제 해결에서의 창의성, 예술적/표현적 재능, 독창적인 아이디어 제시 능력, **창의적 사고** 특성을 상세히 서술하세요.
- 개선 필요 영역: 성장을 위해 발전이 필요한 부분을 세밀하게 분석하세요. 학업적, 사회적, 정서적 영역에서의 약점과 개선점, 그 원인과 배경, **개선 방향**을 상세히 제시하세요.
- 성장 도전 과제: 현재 직면한 어려움과 극복 과제를 깊이 있게 분석하세요. 개인적 어려움의 성격과 정도, 극복을 위한 내적/외적 자원, **필요한 지원**을 구체적으로 설명하세요.

### 🎯 **담임교사 맞춤형 지도 전략** - *"[5-8단어로 지도 방법 요약]"*

🚨 **REMINDER**: 정말 핵심적인 키워드만 선별하여 볼드 처리하세요! (기존 1/3 수준으로 줄여서)
- 핵심 관찰 포인트: **과거 설문 데이터에서 나타난 변화 패턴**을 기반으로 교실에서 지속 관찰할 구체적 행동과 변화 신호를 상세히 제시하세요. 이전 변화 흐름을 고려한 주의 깊게 봐야 할 언어적/비언어적 신호, 행동 변화의 조기 징후, 정서 상태 파악을 위한 **관찰 포인트**, 성장과 퇴행의 지표를 구체적으로 설명하세요.
- 맞춤형 지도 접근법: 이 학생에게 가장 효과적인 지도 방식과 접근법을 종합적으로 제시하세요. 학습 지도 방법, 동기부여 전략, 상담 접근법, **지도 방식**, 강점 개발 방안을 구체적이고 실용적으로 서술하세요.
- 관계 개선 전략: 또래 관계 개선을 위한 구체적 개입을 상세히 제시하세요. 사회성 향상을 위한 활동, 갈등 해결 지원 방법, **관계 개선 방법**, 집단 활동에서의 역할 부여 방안을 실용적으로 설명하세요.
- 학습 최적화 방안: 학업적 성장을 위한 맞춤형 지원을 구체적으로 제시하세요. 개별 학습 스타일에 맞는 교수법, 학습 동기 향상 방안, 성취 수준에 적합한 과제 제공, **학습 지원 방법**을 상세히 서술하세요.
- 성장 로드맵: 지속적 발전을 위한 단계별 계획을 상세히 제시하세요. 단기/중기/장기 목표 설정, 단계별 성취 지표, 발전 과정 모니터링, **성장 계획**을 실용적으로 서술하세요.

### 💬 **학부모·학생 소통 가이드** - *"[5-8단어로 소통 방법 요약]"*

🚨 **REMINDER**: 정말 핵심적인 키워드만 선별하여 볼드 처리하세요! (기존 1/3 수준으로 줄여서)
- 학부모 상담 핵심: 이 학생에 대해 학부모님께 전달할 핵심 메시지를 구체적으로 제시하세요. 강점과 성장 영역 전달 방법, 개선 필요 사항의 민감한 전달법, 가정에서의 협력 요청 사항, **상담 포인트**를 상세히 서술하세요.
- 가정 연계 방안: 가정에서 실천할 수 있는 구체적 지원 방법을 상세히 제시하세요. 학습 환경 조성 방법, 정서적 지원 방안, 사회성 개발을 위한 가정 활동, **가정 지원 방법**을 실용적으로 설명하세요.
- 효과적 대화법: 학생과 직접 나눌 수 있는 효과적인 대화 소재와 접근법을 구체적으로 제시하세요. 관심사를 바탕으로 한 대화 시작법, 깊이 있는 소통을 위한 질문 기법, **대화 방법**, 어려운 주제 접근 방법을 상세히 서술하세요.
- 맞춤형 격려법: 학생의 자존감 향상을 위한 구체적 칭찬 포인트를 상세히 제시하세요. 효과적인 칭찬의 타이밍과 방법, 노력 과정에 대한 인정, **칭찬 포인트**, 자신감 회복을 위한 지원 방법을 구체적으로 설명하세요.
- 동기부여 전략: 학생의 발전 의지를 높이기 위한 맞춤형 전략을 종합적으로 제시하세요. 개인적 관심사와 연결한 목표 설정, 성취 가능한 단계적 도전, **동기부여 방법**, 지속적 동기 유지 전략을 구체적이고 실용적으로 서술하세요.

---

**🔥 최종 품질 및 형식 체크리스트 (반드시 확인):**

**📊 데이터 정확성 검증:**
✅ 분석 대상 학생의 성별이 실제 데이터와 일치하는가?
✅ 언급하는 모든 관계가 실제 데이터에 존재하는가?
✅ **과거 모든 설문 데이터**를 종합적으로 참조하여 장기적 변화 패턴을 분석했는가?
✅ 시간순 관계 변화가 실제 설문 날짜와 일치하는가?
✅ 성별 기반 표현("여학생 그룹" 등)이 정확한가?
✅ 이미 알고 있는 정보를 "모른다"고 표현하지 않았는가?

**📝 형식 및 내용 검증:**
✅ 학생 이름 옆에 5-8단어 간결한 카피라이팅 포함했는가?
✅ 모든 5개 섹션에 5-8단어 카피라이팅 포함했는가?
✅ 정말 핵심적인 키워드만 선별하여 볼드 처리했는가? (1/3 수준으로 줄여서)
✅ 각 항목에 5-8줄의 상세한 분석을 제공했는가?
✅ 한 번에 한 명의 학생만 분석했는가?
✅ 논리적 흐름이 자연스럽고 갑자기 다른 학생 이야기로 넘어가지 않았는가?

**❌ 절대 금지사항:**
- 성별 데이터 오류 (예: 남학생을 여학생 그룹으로 분류)
- 학생 이름 뒤에 (남), (여) 성별 표시 추가
- 존재하지 않는 관계 언급
- 데이터 모순 (알고 있는 정보를 모른다고 함)
- 논리적 흐름 파괴 (A-B 관계 설명 중 갑자기 C 학생 언급)
- 카피라이팅 없는 섹션 제출
- 과도한 키워드 볼드 처리 (핵심만 선별해야 함)
- 여러 학생을 한 번에 분석
- 형식 변경
- 설명 문구 추가
- 카피라이팅이 8단어 초과`;


// Gemini API 호출을 위한 공통 함수
async function callGemini(systemPrompt: string, userContent: string, modelType: 'flash' = 'flash', temperature: number = 0.1): Promise<string> {
  try {
    // 환경 변수에서 API 키 가져오기
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('Gemini API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
      console.error('환경 변수 GEMINI_API_KEY를 .env.local 파일과 Vercel 프로젝트 설정에 추가해야 합니다.');
      throw new Error('Gemini API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
    }

    console.log('API 키 확인:', apiKey ? `설정됨 (${apiKey.substring(0, 10)}...)` : '설정되지 않음');

    // GoogleGenerativeAI 클라이언트 생성
    const genAI = new GoogleGenerativeAI(apiKey);
    const selectedModel = GEMINI_MODELS[modelType];
    
    console.log('사용할 모델:', selectedModel);
    
    const model = genAI.getGenerativeModel({ 
      model: selectedModel,
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: 65536, // Flash 최대 토큰 (65,536) 사용
        topK: 10, // 더 일관된 출력을 위해 선택지 축소
        topP: 0.6, // 더 일관된 출력을 위해 확률 축소
      },
    });

    // 시스템 프롬프트와 사용자 콘텐츠를 결합
    const prompt = `${systemPrompt}\n\n${userContent}`;
    
    console.log('Gemini API 요청 시작...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Gemini API 응답 성공');
    return text;
  } catch (error: any) {
    console.error('Gemini API 호출 상세 오류:', error);
    
    // 403 에러 특별 처리
    if (error.message && error.message.includes('403')) {
      console.error('403 Forbidden 에러: API 키 권한 또는 모델 접근 권한 문제');
      throw new Error('API 접근 권한이 없습니다. API 키나 모델 권한을 확인해주세요.');
    }
    
    // 기타 에러
    throw error;
  }
}

// 학생 관계 분석을 위한 Gemini API 호출 함수
export async function analyzeStudentRelationshipsWithGemini(
  students: Student[],
  relationships: Relationship[],
  answers?: Answer[],
  questions?: Question[],
  additionalData?: {
    classDetails?: any,
    surveys?: Survey[],
    surveyData?: Array<{
      survey: Survey,
      relationships: Relationship[],
      questions: Question[],
      answers: Answer[]
    }>,
    dailyRecords?: any[],
    subjects?: any[],
    homeworkMonths?: any[]
  },
  modelType: 'flash' = 'flash'
): Promise<string> {
  try {
    // 분석에 필요한 데이터 준비
    const analysisData = {
      // 학급 정보
      class: additionalData?.classDetails || { id: "unknown" },
      
      // 학생 정보
      students: students.map(s => ({
        id: s.id,
        name: s.name,
        gender: s.gender
      })),
      
      // 기본 관계 정보 (설문과 연결되지 않은)
      baseRelationships: relationships.map(r => ({
        선택한학생: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
        선택받은학생: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
        관계유형: r.relation_type,
        from: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
        to: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
        type: r.relation_type
      })),
      
      // 기본 질문&응답 정보
      questions: questions ? questions.map(q => ({
        id: q.id,
        text: q.question_text
      })) : [],
      
      answers: answers ? answers.map(a => {
        const question = questions?.find(q => q.id === a.question_id);
        const student = students.find(s => s.id === a.student_id);
        return {
          student: student?.name || a.student_id,
          question: question?.question_text || a.question_id,
          answer: a.answer_text
        };
      }) : [],
      
      // 설문 정보
      surveys: additionalData?.surveys?.map(survey => ({
        id: survey.id,
        name: survey.name,
        description: survey.description,
        created_at: survey.created_at
      })) || [],
      
      // 설문별 상세 정보
      surveyDetails: additionalData?.surveyData?.map(sd => {
        return {
          survey: {
            id: sd.survey.id,
            name: sd.survey.name,
            description: sd.survey.description,
            created_at: sd.survey.created_at
          },
          relationships: sd.relationships.map(r => ({
            선택한학생: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
            선택받은학생: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
            관계유형: r.relation_type,
            from: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
            to: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
            type: r.relation_type
          })),
          questions: sd.questions.map(q => ({
            id: q.id,
            text: q.question_text
          })),
          answers: sd.answers.map(a => {
            const question = sd.questions.find(q => q.id === a.question_id);
            const student = students.find(s => s.id === a.student_id);
            return {
              student: student?.name || a.student_id,
              question: question?.question_text || a.question_id,
              answer: a.answer_text
            };
          })
        };
      }) || [],

      // 일기기록 데이터
      dailyRecords: additionalData?.dailyRecords?.map(record => ({
        date: record.record_date,
        actualDate: record.actual_date,
        title: record.title,
        content: record.content,
        hashtags: record.hashtags || [],
        createdAt: record.created_at
      })) || [],

      // 평가기록 데이터
      assessmentData: additionalData?.subjects?.map(subject => ({
        subjectName: subject.name,
        assessmentItems: subject.assessment_items?.map((item: any) => ({
          itemName: item.name,
          assessmentDate: item.assessment_date,
          records: item.assessment_records?.map((record: any) => ({
            studentName: record.students?.name || '알 수 없음',
            score: record.score
          })) || []
        })) || []
      })) || [],

      // 과제체크 데이터
      homeworkData: additionalData?.homeworkMonths?.map(month => ({
        monthYear: month.month_year,
        name: month.name,
        homeworkItems: month.homework_items?.map((item: any) => ({
          itemName: item.name,
          dueDate: item.due_date,
          records: item.homework_records?.map((record: any) => ({
            studentName: record.students?.name || '알 수 없음',
            isSubmitted: record.is_submitted
          })) || []
        })) || []
      })) || []
    };

    const userContent = `다음 데이터를 기반으로 학급 관계 분석을 진행해주세요: 
    ${JSON.stringify(analysisData, null, 2)}`;

    return await callGemini(COMPREHENSIVE_ANALYSIS_PROMPT, userContent, modelType, 0.3);
  } catch (error: any) {
    console.error('Gemini 학생 관계 분석 API 호출 오류:', error);
    throw error;
  }
}

// 종합분석을 위한 Gemini 함수 (전체 학급에 대한 통찰과 주요 패턴)
export async function analyzeClassOverviewWithGemini(
  students: Student[],
  relationships: Relationship[],
  answers?: Answer[],
  questions?: Question[],
  additionalData?: {
    classDetails?: any,
    surveys?: Survey[],
    surveyData?: Array<{
      survey: Survey,
      relationships: Relationship[],
      questions: Question[],
      answers: Answer[]
    }>,
    dailyRecords?: any[],
    subjects?: any[],
    homeworkMonths?: any[]
  },
  modelType: 'flash' = 'flash'
): Promise<string> {
  try {
    // 분석에 필요한 데이터 준비 (기존 함수와 동일한 방식)
    const analysisData = {
      // 학급 정보
      class: additionalData?.classDetails || { id: "unknown" },
      
      // 학생 정보
      students: students.map(s => ({
        id: s.id,
        name: s.name,
        gender: s.gender
      })),
      
      // 기본 관계 정보 (설문과 연결되지 않은)
      baseRelationships: relationships.map(r => ({
        from: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
        to: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
        type: r.relation_type
      })),
      
      // 기본 질문&응답 정보
      questions: questions ? questions.map(q => ({
        id: q.id,
        text: q.question_text
      })) : [],
      
      answers: answers ? answers.map(a => {
        const question = questions?.find(q => q.id === a.question_id);
        const student = students.find(s => s.id === a.student_id);
        return {
          student: student?.name || a.student_id,
          question: question?.question_text || a.question_id,
          answer: a.answer_text
        };
      }) : [],
      
      // 설문 정보
      surveys: additionalData?.surveys?.map(survey => ({
        id: survey.id,
        name: survey.name,
        description: survey.description,
        created_at: survey.created_at
      })) || [],
      
      // 설문별 상세 정보
      surveyDetails: additionalData?.surveyData?.map(sd => {
        return {
          survey: {
            id: sd.survey.id,
            name: sd.survey.name,
            description: sd.survey.description,
            created_at: sd.survey.created_at
          },
          relationships: sd.relationships.map(r => ({
            from: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
            to: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
            type: r.relation_type
          })),
          questions: sd.questions.map(q => ({
            id: q.id,
            text: q.question_text
          })),
          answers: sd.answers.map(a => {
            const question = sd.questions.find(q => q.id === a.question_id);
            const student = students.find(s => s.id === a.student_id);
            return {
              student: student?.name || a.student_id,
              question: question?.question_text || a.question_id,
              answer: a.answer_text
            };
          })
        };
      }) || [],

      // 일기기록 데이터
      dailyRecords: additionalData?.dailyRecords?.map(record => ({
        date: record.record_date,
        actualDate: record.actual_date,
        title: record.title,
        content: record.content,
        hashtags: record.hashtags || [],
        createdAt: record.created_at
      })) || [],

      // 평가기록 데이터
      assessmentData: additionalData?.subjects?.map(subject => ({
        subjectName: subject.name,
        assessmentItems: subject.assessment_items?.map((item: any) => ({
          itemName: item.name,
          assessmentDate: item.assessment_date,
          records: item.assessment_records?.map((record: any) => ({
            studentName: record.students?.name || '알 수 없음',
            score: record.score
          })) || []
        })) || []
      })) || [],

      // 과제체크 데이터
      homeworkData: additionalData?.homeworkMonths?.map(month => ({
        monthYear: month.month_year,
        name: month.name,
        homeworkItems: month.homework_items?.map((item: any) => ({
          itemName: item.name,
          dueDate: item.due_date,
          records: item.homework_records?.map((record: any) => ({
            studentName: record.students?.name || '알 수 없음',
            isSubmitted: record.is_submitted
          })) || []
        })) || []
      })) || []
    };

    const userContent = `다음 데이터를 기반으로 학급 전체 종합 분석을 진행해주세요: 
    ${JSON.stringify(analysisData, null, 2)}`;

    return await callGemini(COMPREHENSIVE_ANALYSIS_PROMPT, userContent, modelType, 0.3);
  } catch (error: any) {
    console.error('Gemini 종합분석 API 호출 오류:', error);
    throw error;
  }
}

// 학생 그룹 분석을 위한 Gemini 함수
export async function analyzeStudentGroupWithGemini(
  students: Student[], // 이미 그룹화된 학생 목록
  relationships: Relationship[],
  groupIndex: number, // 1, 2, 3 등 그룹 인덱스
  answers?: Answer[],
  questions?: Question[],
  additionalData?: {
    classDetails?: any,
    surveys?: Survey[],
    surveyData?: Array<{
      survey: Survey,
      relationships: Relationship[],
      questions: Question[],
      answers: Answer[]
    }>,
    allStudents?: Student[], // 전체 학생 목록 (참조용)
    dailyRecords?: any[],
    subjects?: any[],
    homeworkMonths?: any[]
  },
  modelType: 'flash' = 'flash'
): Promise<string> {
  try {
    // 분석에 필요한 데이터 준비
    const analysisData = {
      // 학급 정보
      class: additionalData?.classDetails || { id: "unknown" },
      
      // 그룹 학생 정보
      groupStudents: students.map(s => ({
        id: s.id,
        name: s.name,
        gender: s.gender
      })),
      
      // 전체 학생 정보 (참조용)
      allStudents: additionalData?.allStudents?.map(s => ({
        id: s.id,
        name: s.name,
        gender: s.gender
      })) || [],
      
      // 그룹 내 관계 정보 (현재 그룹 학생들과 관련된 관계만 필터링)
      groupRelationships: relationships
        .filter(r => {
          // from_student_id 또는 to_student_id가 현재 그룹에 속하는 경우만 포함
          const fromInGroup = students.some(s => s.id === r.from_student_id);
          const toInGroup = students.some(s => s.id === r.to_student_id);
          return fromInGroup || toInGroup;
        })
        .map(r => ({
          선택한학생: students.find(s => s.id === r.from_student_id)?.name || 
                    additionalData?.allStudents?.find(s => s.id === r.from_student_id)?.name || 
                    r.from_student_id,
          선택받은학생: students.find(s => s.id === r.to_student_id)?.name || 
                     additionalData?.allStudents?.find(s => s.id === r.to_student_id)?.name || 
                     r.to_student_id,
          관계유형: r.relation_type,
          from: students.find(s => s.id === r.from_student_id)?.name || 
                additionalData?.allStudents?.find(s => s.id === r.from_student_id)?.name || 
                r.from_student_id,
          to: students.find(s => s.id === r.to_student_id)?.name || 
              additionalData?.allStudents?.find(s => s.id === r.to_student_id)?.name || 
              r.to_student_id,
          type: r.relation_type,
          // 현재 그룹 학생이 관련된 관계인지 표시
          isGroupInternal: students.some(s => s.id === r.from_student_id) && students.some(s => s.id === r.to_student_id),
          isGroupOutgoing: students.some(s => s.id === r.from_student_id) && !students.some(s => s.id === r.to_student_id),
          isGroupIncoming: !students.some(s => s.id === r.from_student_id) && students.some(s => s.id === r.to_student_id)
        })),
      
      // 기본 질문&응답 정보
      questions: questions ? questions.map(q => ({
        id: q.id,
        text: q.question_text
      })) : [],
      
      answers: answers ? answers
        .filter(a => students.some(s => s.id === a.student_id)) // 현재 그룹 학생의 답변만 필터링
        .map(a => {
          const question = questions?.find(q => q.id === a.question_id);
          const student = students.find(s => s.id === a.student_id);
          return {
            student: student?.name || a.student_id,
            question: question?.question_text || a.question_id,
            answer: a.answer_text
          };
        }) : [],
      
      // 설문 정보
      surveys: additionalData?.surveys?.map(survey => ({
        id: survey.id,
        name: survey.name,
        description: survey.description,
        created_at: survey.created_at
      })) || [],
      
      // 설문별 상세 정보
      surveyDetails: additionalData?.surveyData?.map(sd => {
        return {
          survey: {
            id: sd.survey.id,
            name: sd.survey.name,
            description: sd.survey.description,
            created_at: sd.survey.created_at
          },
          relationships: sd.relationships
            .filter(r => {
              // 현재 그룹 학생과 관련된 관계만 포함
              const fromInGroup = students.some(s => s.id === r.from_student_id);
              const toInGroup = students.some(s => s.id === r.to_student_id);
              return fromInGroup || toInGroup;
            })
            .map(r => ({
              선택한학생: students.find(s => s.id === r.from_student_id)?.name || 
                        additionalData?.allStudents?.find(s => s.id === r.from_student_id)?.name || 
                        r.from_student_id,
              선택받은학생: students.find(s => s.id === r.to_student_id)?.name || 
                         additionalData?.allStudents?.find(s => s.id === r.to_student_id)?.name || 
                         r.to_student_id,
              관계유형: r.relation_type,
              from: students.find(s => s.id === r.from_student_id)?.name || 
                    additionalData?.allStudents?.find(s => s.id === r.from_student_id)?.name || 
                    r.from_student_id,
              to: students.find(s => s.id === r.to_student_id)?.name || 
                  additionalData?.allStudents?.find(s => s.id === r.to_student_id)?.name || 
                  r.to_student_id,
              type: r.relation_type
            })),
          questions: sd.questions.map(q => ({
            id: q.id,
            text: q.question_text
          })),
          answers: sd.answers
            .filter(a => students.some(s => s.id === a.student_id)) // 현재 그룹 학생의 답변만 필터링
            .map(a => {
              const question = sd.questions.find(q => q.id === a.question_id);
              const student = students.find(s => s.id === a.student_id);
              return {
                student: student?.name || a.student_id,
                question: question?.question_text || a.question_id,
                answer: a.answer_text
              };
            })
        };
      }) || [],

      // 일기기록 데이터 (현재 그룹 학생과 관련된 것만 필터링)
      dailyRecords: additionalData?.dailyRecords?.map(record => ({
        date: record.record_date,
        actualDate: record.actual_date,
        title: record.title,
        content: record.content,
        hashtags: record.hashtags || [],
        createdAt: record.created_at
      })) || [],

      // 평가기록 데이터 (현재 그룹 학생과 관련된 것만 필터링)
      assessmentData: additionalData?.subjects?.map(subject => ({
        subjectName: subject.name,
        assessmentItems: subject.assessment_items?.map((item: any) => ({
          itemName: item.name,
          assessmentDate: item.assessment_date,
          records: item.assessment_records
            ?.filter((record: any) => students.some(s => s.name === record.students?.name))
            ?.map((record: any) => ({
              studentName: record.students?.name || '알 수 없음',
              score: record.score
            })) || []
        })) || []
      })) || [],

      // 과제체크 데이터 (현재 그룹 학생과 관련된 것만 필터링)
      homeworkData: additionalData?.homeworkMonths?.map(month => ({
        monthYear: month.month_year,
        name: month.name,
        homeworkItems: month.homework_items?.map((item: any) => ({
          itemName: item.name,
          dueDate: item.due_date,
          records: item.homework_records
            ?.filter((record: any) => students.some(s => s.name === record.students?.name))
            ?.map((record: any) => ({
              studentName: record.students?.name || '알 수 없음',
              isSubmitted: record.is_submitted
            })) || []
        })) || []
      })) || []
    };

    const userContent = `다음 데이터를 기반으로 각 학생별 심층 분석을 진행해주세요. 

**절대 준수 사항 - 구조 통일:**
1. 반드시 groupStudents 배열에 있는 학생들만 분석하세요 (${students.map(s => s.name).join(', ')})
2. 각 학생마다 정확히 아래 구조를 따르세요:
3. **중요**: 학생 이름 뒤에 (남), (여) 성별 표시를 절대 추가하지 마세요

## 👤 **[학생명]**

### 🔍 **관계 분석 및 사회적 위치**
학급 내에서의 위치와 영향력, 친밀한 관계들의 패턴과 깊이, 다양한 또래들과의 관계 스펙트럼, 시간에 따른 관계 변화와 발전 양상, 타인과의 소통 방식과 상호작용 특징, 학급 공동체에서 수행하는 역할과 그 영향력에 대해 종합적으로 분석하여 자연스러운 문단으로 서술하세요. (8-12줄 분량)

### 🧠 **심리적 특성 및 성장 패턴**  
주요 성격 요소와 행동 패턴의 근본적 특징, 감정 인식·표현·조절 능력의 발달 수준, 사고 방식과 문제 해결 접근법, 자기 인식과 자존감·자기 효능감의 발달 정도, 어려운 상황에서의 반응 패턴과 대처 전략, 관찰된 발달적 변화와 성장 궤적의 특성을 통합하여 연속적인 문단으로 서술하세요. (8-12줄 분량)

### 💪 **강점 및 개선 영역**
학생의 주요 장점과 뛰어난 능력 영역, 향후 발현 가능한 재능과 성장 가능성, 다른 학생들에게 미치는 긍정적 영향력, 독특하고 창의적인 사고나 행동 양상, 성장을 위해 발전이 필요한 구체적 부분, 현재 직면한 어려움과 극복 과제, 발전을 방해할 수 있는 요인과 주의점을 포괄하여 자연스러운 흐름으로 서술하세요. (8-12줄 분량)

### 🎯 **담임교사 맞춤형 지도 전략**
교실에서 지속 관찰할 구체적 행동과 변화 신호, 이 학생에게 가장 효과적인 지도 방식과 접근법, 또래 관계 개선을 위한 구체적 개입 전략, 학업적 성장을 위한 맞춤형 지원 방향, 심리적 안정감과 성장을 위한 지원 체계, 지속적 발전을 위한 단계별 계획, 특별히 주의할 상황과 예방적 대응 방안을 통합적으로 제시하여 연결된 문단으로 서술하세요. (8-12줄 분량)

### 💬 **학부모·학생 소통 가이드**
이 학생에 대해 학부모님께 전달할 핵심 메시지와 상담 내용, 가정에서 실천할 수 있는 구체적 지원 방법과 활동, 학생과 직접 나눌 수 있는 효과적인 대화 소재와 접근법, 학생의 자존감 향상을 위한 구체적 칭찬 포인트와 격려 방법, 학생의 발전 의지를 높이기 위한 맞춤형 동기부여 전략을 종합하여 자연스러운 문단으로 서술하세요. (8-12줄 분량)

---

3. **중요**: 각 대 카테고리 내에서 소분류(- **항목명**: 내용) 형태를 사용하지 마세요
4. 각 카테고리는 자연스럽게 연결된 문단 형태로 작성하세요
5. 모든 학생에 대해 동일한 5개 카테고리 구조를 유지하세요
6. 각 카테고리당 8-12줄 분량으로 충분히 상세하게 서술하세요
    
    데이터: 
    ${JSON.stringify(analysisData, null, 2)}`;

    return await callGemini(STUDENT_ANALYSIS_PROMPT, userContent, modelType, 0.1); // 더 일관된 출력을 위해 temperature 낮춤
  } catch (error: any) {
    console.error(`Gemini analyzeStudentGroup(${groupIndex}) API 호출 오류:`, error);
    throw error;
  }
}

// 학생 생활기록부 문구 생성 Gemini 함수
export async function generateSchoolRecordWithGemini(
  students: Student[],
  relationships: Relationship[],
  answers?: Answer[],
  questions?: Question[],
  additionalData?: {
    classDetails?: any,
    surveys?: Survey[],
    surveyData?: Array<{
      survey: Survey,
      relationships: Relationship[],
      questions: Question[],
      answers: Answer[]
    }>,
    dailyRecords?: any[],
    subjects?: any[],
    homeworkMonths?: any[]
  },
  modelType: 'flash' = 'flash'
): Promise<string> {
  try {
    // 분석에 필요한 데이터를 더 체계적으로 준비
    const analysisData = {
      // 학급 정보
      class: {
        id: additionalData?.classDetails?.id || "unknown",
        name: additionalData?.classDetails?.name || "알 수 없음",
        school: additionalData?.classDetails?.school || "알 수 없음",
        grade: additionalData?.classDetails?.grade || "알 수 없음",
        year: new Date().getFullYear()
      },
      
      // 학생 정보 (개별 특성 포함)
      students: students.map((student: any) => {
        // 해당 학생과 관련된 모든 관계 정보 수집
        const studentRelationships = {
          // 이 학생이 다른 학생들에게 표현한 관계
          outgoing: relationships.filter(r => r.from_student_id === student.id).map(r => ({
            target: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
            type: r.relation_type,
            surveyContext: additionalData?.surveyData?.find(sd => 
              sd.relationships.some(sr => sr.id === r.id)
            )?.survey?.name || "기본 관계"
          })),
          // 다른 학생들이 이 학생에게 표현한 관계
          incoming: relationships.filter(r => r.to_student_id === student.id).map(r => ({
            from: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
            type: r.relation_type,
            surveyContext: additionalData?.surveyData?.find(sd => 
              sd.relationships.some(sr => sr.id === r.id)
            )?.survey?.name || "기본 관계"
          }))
        };

        // 해당 학생의 모든 설문 답변 수집
        const studentAnswers = answers?.filter(a => a.student_id === student.id).map((answer: any) => {
          const question = questions?.find(q => q.id === answer.question_id);
          const surveyContext = additionalData?.surveyData?.find(sd => 
            sd.answers.some(sa => sa.id === answer.id)
          );
          
          return {
            question: question?.question_text || "알 수 없는 질문",
            answer: answer.answer_text,
            survey: surveyContext?.survey?.name || "기본 설문",
            date: surveyContext?.survey?.created_at || new Date().toISOString()
          };
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];

        return {
          id: student.id,
          name: student.name,
          gender: student.gender,
          relationships: studentRelationships,
          answers: studentAnswers,
          // 관계 패턴 분석
          relationshipSummary: {
            totalOutgoing: studentRelationships.outgoing.length,
            totalIncoming: studentRelationships.incoming.length,
            popularityScore: studentRelationships.incoming.filter(r => 
              ['친한', '친해질래'].includes(r.type)
            ).length,
            conflictIndicators: studentRelationships.incoming.filter(r => 
              r.type === '안친한'
            ).length,
            outgoingPositive: studentRelationships.outgoing.filter(r => 
              ['친한', '친해질래'].includes(r.type)
            ).length
          }
        };
      }),
      
      // 시간대별 설문 정보 (변화 추적용)
      timelineData: additionalData?.surveys?.map(survey => ({
        surveyName: survey.name,
        date: survey.created_at,
        description: survey.description,
        participantCount: additionalData.surveyData?.find(sd => sd.survey.id === survey.id)?.answers?.length || 0
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [],

      // 전체 학급 관계 맥락
      classContext: {
        totalStudents: students.length,
        totalRelationships: relationships.length,
        averageRelationshipsPerStudent: relationships.length / students.length,
        positiveRelationshipRatio: relationships.filter(r => 
          ['친한', '친해질래'].includes(r.relation_type)
        ).length / relationships.length,
        surveyCount: additionalData?.surveys?.length || 0
      },

      // 일기기록 데이터
      dailyRecords: additionalData?.dailyRecords?.map(record => ({
        date: record.record_date,
        actualDate: record.actual_date,
        title: record.title,
        content: record.content,
        hashtags: record.hashtags || [],
        createdAt: record.created_at
      })) || [],

      // 평가기록 데이터
      assessmentData: additionalData?.subjects?.map(subject => ({
        subjectName: subject.name,
        assessmentItems: subject.assessment_items?.map((item: any) => ({
          itemName: item.name,
          assessmentDate: item.assessment_date,
          records: item.assessment_records?.map((record: any) => ({
            studentName: record.students?.name || '알 수 없음',
            score: record.score
          })) || []
        })) || []
      })) || [],

      // 과제체크 데이터
      homeworkData: additionalData?.homeworkMonths?.map(month => ({
        monthYear: month.month_year,
        name: month.name,
        homeworkItems: month.homework_items?.map((item: any) => ({
          itemName: item.name,
          dueDate: item.due_date,
          records: item.homework_records?.map((record: any) => ({
            studentName: record.students?.name || '알 수 없음',
            isSubmitted: record.is_submitted
          })) || []
        })) || []
      })) || []
    };

    const userContent = `다음 데이터를 기반으로 각 학생별 생활기록부 문구를 작성해주세요. 

**중요 지시사항:**
1. 반드시 각 학생의 이름을 ### 헤더로 시작하세요
2. 모든 학생에 대해 동일한 구조를 유지하세요  
3. **핵심만 간결하게!** 각 섹션당 2-3줄, 활동 제안은 1-2줄로 제한
4. 토큰 한계 내에서 모든 학생 분석을 완료하세요
5. 학생 간 구분을 위해 "---" 사용하세요
6. **중요**: 학생 이름 뒤에 (남), (여) 성별 표시를 절대 추가하지 마세요
    
    데이터: 
    ${JSON.stringify(analysisData, null, 2)}`;

    return await callGemini(STUDENT_ANALYSIS_PROMPT, userContent, modelType, 0.3);
  } catch (error: any) {
    console.error('Gemini 생활기록부 생성 API 호출 오류:', error);
    throw error;
  }
}

export interface AnnouncementRequest {
  keywords: string;
  details: string;
  className: string;
  date: string;
}

export interface SafetyNoticeRequest {
  category: string;
  content: string;
}

// 안전 수칙 생성 함수
export async function generateSafetyNoticeWithGemini({
  category,
  content
}: SafetyNoticeRequest): Promise<string> {
  try {
    const systemPrompt = `당신은 초등학교 안전교육 전문가입니다. 주어진 카테고리와 상황에 맞는 한 문장의 간단한 안전 수칙을 생성해주세요.

**작성 가이드라인:**
1. 초등학생이 이해하기 쉬운 언어 사용
2. 구체적이고 실행 가능한 안전 수칙 제시
3. **반드시 한 문장으로만 작성**
4. 상황에 맞는 맞춤형 안전 수칙 제공

**형식:**
[이모지] [카테고리] 안전 수칙: [한 문장의 구체적인 안전 수칙]

**예시:**
🔔 교실안전 안전 수칙: 교실에서는 뛰어다니지 않고 천천히 걸어다닙니다.
🔔 교통안전 안전 수칙: 횡단보도를 건널 때는 좌우를 꼼꼼히 살펴봅니다.
🔔 운동장안전 안전 수칙: 운동 전에는 충분한 준비운동으로 몸을 풀어줍니다.

**중요**: 마크다운 형식을 사용하지 말고 일반 텍스트로만 작성해주세요.

위 형식을 정확히 따라 한 문장으로만 안전 수칙을 작성해주세요:`;

    const userContent = `**안전 카테고리:** ${category}

**오늘의 활동 상황:**
${content}

위 상황과 카테고리에 맞는 한 문장의 구체적이고 실용적인 안전 수칙을 생성해주세요.
중요: 일반 텍스트로만 작성하고 마크다운 형식은 사용하지 마세요.`;

    return await callGemini(systemPrompt, userContent, 'flash', 0.3);
  } catch (error) {
    console.error('Gemini 안전 수칙 생성 오류:', error);
    
    // 폴백 템플릿
    const fallbackMessages: { [key: string]: string[] } = {
      '교실안전': [
        '교실에서는 뛰어다니지 않고 천천히 걸어다닙니다.',
        '의자를 뒤로 젖히지 않고 바른 자세로 앉습니다.',
        '교실 바닥에 물이나 이물질이 있으면 즉시 선생님께 알립니다.'
      ],
      '교통안전': [
        '횡단보도를 건널 때는 좌우를 꼼꼼히 살펴봅니다.',
        '신호등을 반드시 지키고 초록불이어도 한 번 더 확인합니다.',
        '차도 근처에서는 절대 뛰어다니지 않습니다.'
      ],
      '운동장안전': [
        '운동 전에는 충분한 준비운동으로 몸을 풀어줍니다.',
        '운동기구 사용 시 선생님의 안전 수칙을 꼭 지킵니다.',
        '친구들과 안전한 거리를 유지하며 활동합니다.'
      ]
    };

    const messages = fallbackMessages[category] || ['안전에 주의하며 활동합니다.'];
    const selectedMessage = messages[Math.floor(Math.random() * messages.length)];
    
    return `🔔 ${category} 안전 수칙: ${selectedMessage}`;
  }
}

export async function generateAnnouncementWithGemini({
  keywords,
  details,
  className,
  date
}: AnnouncementRequest): Promise<string> {
  try {
    const systemPrompt = `당신은 경험이 풍부한 초등학교 담임교사입니다. 학부모님께 보낼 따뜻하고 친근한 알림장을 작성해주세요.

**작성 가이드라인:**
1. 바로 내일의 주요 활동과 일정으로 시작 (인사말 없이)
2. 내일의 주요 활동과 일정을 구체적으로 안내
3. 가정에서 준비해야 할 사항이나 협조 요청 사항 안내
4. 따뜻한 감사와 협력을 표현하는 마무리 인사

**구성 (총 150-250자 수준):**
- 내일 활동 소개 (1-2문장)
- 시간 및 일정 안내 (1-2문장)
- 준비사항 또는 가정 협조 요청 (1-2문장) 
- 따뜻한 마무리 인사 (1문장)

**톤앤매너:**
- 따뜻하고 친근한 어조 (중요!)
- 부드럽고 정감 있는 표현 사용
- 긍정적이고 기대감을 주는 메시지
- 학부모와의 소통과 협력 강조

**중요**: 
- "내일은..." 으로 자연스럽게 시작해주세요.
- **단락을 구분하여 작성해주세요** (빈 줄로 구분)
- 마크다운 형식(**굵은글씨**, *이탤릭* 등)을 사용하지 말고 일반 텍스트로만 작성해주세요.
- 별표(**), 언더스코어(_), 해시태그(#) 등의 특수문자는 사용하지 마세요.
- 날짜나 요일은 포함하지 마세요. (시스템에서 자동으로 추가됩니다)
- 안전 관련 키워드가 제공되더라도 본문에는 포함하지 마세요. (별도 안전 수칙으로 처리됩니다)

알림장을 작성해주세요:`;

    // 키워드가 있는 경우와 없는 경우를 구분하여 처리
    const hasKeywords = keywords && keywords.trim().length > 0;
    
    // 안전 카테고리인지 확인 (교실안전, 교통안전, 운동장안전)
    const safetyCategories = ['교실안전', '교통안전', '운동장안전'];
    const isSafetyKeyword = hasKeywords && safetyCategories.includes(keywords.trim());
    
    const userContent = `**학급 정보:**
- 학급명: ${className}

${hasKeywords && !isSafetyKeyword ? `**내일의 주요 활동:**
${keywords}

` : ''}**활동 상세 내용:**
${details}

${hasKeywords && !isSafetyKeyword ? 
  '위 활동과 상세 내용을 바탕으로 내일 일정을 안내하는 따뜻하고 친근한 알림장을 작성해주세요.' : 
  '상세 내용을 바탕으로 내일 일정을 안내하는 따뜻하고 친근한 알림장을 작성해주세요.'
}

중요: 일반 텍스트로만 작성하고 마크다운 형식은 사용하지 마세요. 날짜나 요일, 안전 관련 내용은 포함하지 마세요. 
**단락별로 빈 줄을 넣어 구분해주세요**: 1) 활동 소개 2) 시간 안내 3) 준비사항/협조 요청 4) 마무리 인사`;

    return await callGemini(systemPrompt, userContent, 'flash', 0.3);
  } catch (error) {
    console.error('Gemini AI 오류:', error);
    
    // 기타 오류의 경우 폴백 템플릿 반환
    return generateFallbackAnnouncement({ keywords, details, className, date });
  }
}

// 폴백 템플릿 (AI API 오류 시 사용)
function generateFallbackAnnouncement({
  keywords,
  details,
  className,
  date
}: AnnouncementRequest): string {
  const hasKeywords = keywords && keywords.trim().length > 0;
  
  return `내일 있을 활동에 대해 안내드립니다.

${hasKeywords ? `📅 내일의 주요 활동: ${keywords}

` : ''}📝 상세 안내:
${details}

내일 활동이 원활히 진행될 수 있도록 미리 준비해주시면 감사하겠습니다. 
궁금한 사항이 있으시면 언제든 연락주세요.

${className} 담임교사 드림`;
} 
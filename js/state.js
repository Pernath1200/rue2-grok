/**
 * Shared mutable application state.
 * Every module imports this single object and reads/writes its properties.
 * Avoids circular-dependency issues that arise with separate per-variable exports.
 */
const state = {
  topics: [],
  currentTopic: { id: 'present_perfect', title: 'English Grammar Check', curriculum: 'curriculum.json', questions_key: 'sets' },
  allQuestionsData: {},
  setsData: {},
  currentSetId: '',
  currentSetTitle: '',
  currentQuestions: [],
  currentIndex: 0,
  score: 0,
  wrongIndices: [],
  summary: '',
  isRetryRound: false,

  courseCurriculum: null,
  coursePhase: null,
  coursePart: null,
  introSectionIndex: 0,

  prepositionsListData: null,
  prepositionsListReturnTo: 'menu',
  phrasalVerbsDictionaryData: null,
  phrasalVerbsDictionaryReturnTo: 'menu',

  part2Order: ['gapfill', 'errorcorrection', 'makesentence', 'makequestion'],

  quizMode: 'normal',
  wrongTopics: new Set(),

  examMode: null,
  examOpenClozeData: null,
  currentExamClozeTests: [],
  currentExamClozeTestIndex: 0,
  currentExamClozeMode: '',
  currentExamClozeTest: null,
  currentExamType: 'open_cloze',
  currentExamSubMenu: 'open_cloze',
  examWordFormationData: null,
  examSentenceTransformData: null,
  currentExamTransformTests: [],
  currentExamTransformTestIndex: 0,
  currentExamTransformTest: null,
  currentExamTransformMode: '',
  examClozeMcSelections: [],

  returnToAfterTopicSelect: null,
  writingTipsIntroActive: false,
  writingTipsIntroSectionIndex: 0,

  selectedMc: null,

  referenceReturnTo: 'menu',
  referenceView: 'index',
  referenceInfinitiveIngData: null,
  referenceModalVerbsData: null,
  dependentPrepositionsData: null,
  countableUncountableData: null,
  referenceOpenClozeData: null,
  referenceWordFormationData: null,
  referenceConjunctionsLinkersData: null,
  referenceReportedSpeechData: null,
  referenceIrregularVerbsData: null,
  referenceFixedPhrasesData: null,
  phrasalVerbListView: 'sections',
  writingTipsData: null,
  deferredInstallPrompt: null,
};

export const COURSE_ORDER = ['check', 'gapfill', 'errorcorrection', 'makesentence', 'makequestion'];
export const PART2_ORDER = ['gapfill', 'errorcorrection', 'makesentence', 'makequestion'];
export const WEAK_SPOT_RIGHT_THRESHOLD = 3;

export default state;

/**
 * profile-data.js
 * All demo / seed data for the profile page.
 * In production: replace STUDENT from GET /api/auth/me
 * and stats from GET /api/user/stats
 */

/* ── Student account ──────────────────────────────────────────── */
const STUDENT = {
  name:           'Priya Kumar',
  email:          'priya@school.edu',
  classGrade:     'Class 10',
  school:         'Delhi Public School',
  memberSince:    'March 2025',
  streak:          7,
  papersCount:     12,
  topicsImproved:  5,
  totalXP:         1660,
  level:           4,
  levelTitle:     'Scholar',
  levelXPStart:    1500,
  levelXPEnd:      2000,
  nextTitle:      'Expert',
};

/* ── Badges — iconKey maps to Icons[iconKey] ──────────────────── */
const BADGES = [
  { id: 'first_analysis', iconKey: 'rocket',    name: 'First Analysis', pts: '+50 XP',  earned: true,  isNew: false, desc: 'Analysed your very first paper' },
  { id: 'bookworm',       iconKey: 'bookOpen',   name: 'Bookworm',       pts: '+100 XP', earned: true,  isNew: false, desc: 'Analysed 10 or more papers' },
  { id: 'streak_7',       iconKey: 'zap',        name: '7-Day Streak',   pts: '+150 XP', earned: true,  isNew: true,  desc: 'Kept a learning streak for 7 days' },
  { id: 'sharpshooter',   iconKey: 'target',     name: 'Sharpshooter',   pts: '+200 XP', earned: true,  isNew: false, desc: 'Improved 5 topics in one week' },
  { id: 'speed_reader',   iconKey: 'clock',      name: 'Speed Reader',   pts: '+100 XP', earned: false, isNew: false, desc: 'Analyse 3 papers in a single day' },
  { id: 'top_scholar',    iconKey: 'trophy',     name: 'Top Scholar',    pts: '+300 XP', earned: false, isNew: false, desc: 'Reach the Expert rank' },
  { id: 'perfect_score',  iconKey: 'star',       name: 'Perfect Score',  pts: '+250 XP', earned: false, isNew: false, desc: 'Score 95%+ on a topic after improving' },
  { id: 'breakthrough',   iconKey: 'lightbulb',  name: 'Breakthrough',   pts: '+200 XP', earned: false, isNew: false, desc: 'Improve any topic by 20+ points' },
];

/* ── XP breakdown ─────────────────────────────────────────────── */
const XP_ROWS = [
  { iconKey: 'fileText',    title: 'Papers Analysed',    desc: '12 papers × 50 XP each',                pts: '+600 XP' },
  { iconKey: 'trendingUp',  title: 'Topics Improved',    desc: '5 topics showed measurable improvement', pts: '+500 XP' },
  { iconKey: 'flame',       title: 'Streak Bonus',       desc: '7-day learning streak maintained',       pts: '+70 XP'  },
  { iconKey: 'award',       title: 'Achievement Badges', desc: '4 badges unlocked',                      pts: '+500 XP' },
  { iconKey: 'checkCircle', title: 'AI Tutor Sessions',  desc: '10 tutor sessions completed',            pts: '+200 XP' },
  { iconKey: 'leaf',        title: 'Welcome Bonus',      desc: 'First time signing in to Mentora',       pts: '+10 XP'  },
];

/* ── Topic performance — sorted weakest first ─────────────────── */
const TOPICS = [
  { name: 'Organic Chemistry',      subject: 'Chemistry',   score: 38, prev: 42 },
  { name: "Newton's Laws",           subject: 'Physics',     score: 54, prev: 54 },
  { name: 'Chemical Reactions',      subject: 'Chemistry',   score: 61, prev: 55 },
  { name: 'Triangle Similarity',     subject: 'Mathematics', score: 75, prev: 78 },
  { name: 'Arithmetic Progressions', subject: 'Mathematics', score: 82, prev: 68 },
  { name: 'Quadratic Equations',     subject: 'Mathematics', score: 87, prev: 72 },
];

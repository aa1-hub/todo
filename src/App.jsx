import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Check,
  Trash2,
  Repeat,
  Clipboard,
  Inbox,
  Flame,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// 자연어 날짜/시간 파싱
// ---------------------------------------------------------------------------
function startOfDay(d) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

const WEEKDAY_MAP = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

function parseKoreanDate(text, now = new Date()) {
  let date = null;

  const relativeMap = { 오늘: 0, 내일: 1, 모레: 2, 글피: 3 };
  for (const word of Object.keys(relativeMap)) {
    if (text.includes(word)) {
      const d = startOfDay(now);
      d.setDate(d.getDate() + relativeMap[word]);
      date = d;
      break;
    }
  }

  if (!date) {
    const m = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (m) {
      let d = new Date(now.getFullYear(), parseInt(m[1], 10) - 1, parseInt(m[2], 10));
      if (d < startOfDay(now)) d.setFullYear(d.getFullYear() + 1);
      date = d;
    }
  }

  if (!date) {
    const m = text.match(/(\d{1,2})\s*[\/.]\s*(\d{1,2})(?!\s*[\/.:]\s*\d)/);
    if (m) {
      let d = new Date(now.getFullYear(), parseInt(m[1], 10) - 1, parseInt(m[2], 10));
      if (d < startOfDay(now)) d.setFullYear(d.getFullYear() + 1);
      date = d;
    }
  }

  if (!date) {
    const m = text.match(/(다음\s*주|담\s*주|이번\s*주)?\s*([일월화수목금토])\s*요일/);
    if (m) {
      const targetDow = WEEKDAY_MAP[m[2]];
      let d = startOfDay(now);
      let diff = (targetDow - d.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      if (m[1] && m[1].replace(/\s/g, "").startsWith("다음")) diff += 7;
      if (m[1] && m[1].replace(/\s/g, "").startsWith("담")) diff += 7;
      d.setDate(d.getDate() + diff);
      date = d;
    }
  }

  if (!date) {
    const m = text.match(/(\d{1,2})\s*일(?!정)/);
    if (m) {
      const day = parseInt(m[1], 10);
      if (day >= 1 && day <= 31) {
        let d = new Date(now.getFullYear(), now.getMonth(), day);
        if (d < startOfDay(now)) d.setMonth(d.getMonth() + 1);
        date = d;
      }
    }
  }

  let hasTime = false;
  if (date) {
    const tm = text.match(/(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
    if (tm) {
      let hour = parseInt(tm[2], 10);
      const minute = tm[3] ? parseInt(tm[3], 10) : 0;
      if (tm[1] === "오후" && hour < 12) hour += 12;
      if (tm[1] === "오전" && hour === 12) hour = 0;
      date.setHours(hour, minute, 0, 0);
      hasTime = true;
    } else {
      date.setHours(9, 0, 0, 0);
    }
  }

  return { date, hasTime };
}

/**
 * 대한민국 공휴일 계산
 * - 신정·삼일절·어린이날·현충일·광복절·개천절·한글날·크리스마스는 매년 날짜가
 *   고정이라 아래에서 자동으로 계산합니다 (대체공휴일 규칙 포함, 몇 년이 지나도
 *   계속 정상 작동합니다).
 * - 설날·추석·부처님오신날은 음력 기준이라 자동 계산이 어려워, 확인된 해(2026~2028년)만
 *   날짜를 직접 넣어뒀습니다. 2029년 이후가 되면 그 해의 음력 명절 날짜를 검색해서
 *   아래 LUNAR_HOLIDAYS_KR에 추가해주세요. (임시공휴일은 반영하지 않았습니다)
 */
const LUNAR_HOLIDAYS_KR = {
  2026: [
    "2026-02-16", "2026-02-17", "2026-02-18", // 설날 연휴
    "2026-05-24", "2026-05-25", // 부처님오신날 (+대체공휴일)
    "2026-09-24", "2026-09-25", "2026-09-26", // 추석 연휴
  ],
  2027: [
    "2027-02-06", "2027-02-07", "2027-02-08", "2027-02-09", // 설날 연휴(일요일과 겹쳐 하루 더)
    "2027-05-13", // 부처님오신날
    "2027-09-14", "2027-09-15", "2027-09-16", // 추석 연휴
  ],
  2028: [
    "2028-01-25", "2028-01-26", "2028-01-27", // 설날 연휴
    "2028-05-05", // 부처님오신날 (어린이날과 겹침)
    "2028-10-02", "2028-10-03", "2028-10-04", // 추석 연휴
  ],
};

// 매년 날짜가 고정된 공휴일. substitute:true 인 것은 주말과 겹치면 대체공휴일이 생김.
const FIXED_HOLIDAYS_KR = [
  { month: 0, day: 1, substitute: false }, // 신정
  { month: 2, day: 1, substitute: true }, // 삼일절
  { month: 4, day: 5, substitute: true }, // 어린이날
  { month: 5, day: 6, substitute: false }, // 현충일
  { month: 7, day: 15, substitute: true }, // 광복절
  { month: 9, day: 3, substitute: true }, // 개천절
  { month: 9, day: 9, substitute: true }, // 한글날
  { month: 11, day: 25, substitute: false }, // 크리스마스
];

function holidayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildHolidaySetForYear(year) {
  const set = new Set(LUNAR_HOLIDAYS_KR[year] || []);
  FIXED_HOLIDAYS_KR.forEach(({ month, day }) => {
    set.add(holidayKey(new Date(year, month, day)));
  });
  // 대체공휴일: 주말과 겹치면 겹치지 않는 다음 평일로
  FIXED_HOLIDAYS_KR.forEach(({ month, day, substitute }) => {
    if (!substitute) return;
    const d = new Date(year, month, day);
    if (d.getDay() === 0 || d.getDay() === 6) {
      const sub = new Date(d);
      do {
        sub.setDate(sub.getDate() + 1);
      } while (sub.getDay() === 0 || sub.getDay() === 6 || set.has(holidayKey(sub)));
      set.add(holidayKey(sub));
    }
  });
  return set;
}

const holidaySetCache = {};
function isNonWorkingDay(date) {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return true;
  const year = date.getFullYear();
  if (!holidaySetCache[year]) holidaySetCache[year] = buildHolidaySetForYear(year);
  return holidaySetCache[year].has(holidayKey(date));
}

/** 주말·공휴일이면 가장 가까운 이전 평일로 당김 (연휴가 겹쳐도 평일까지 계속 당김) */
function adjustToWorkday(date) {
  const d = new Date(date);
  while (isNonWorkingDay(d)) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

function formatDue(date, hasTime) {
  if (!date) return null;
  const m = date.getMonth() + 1;
  const day = date.getDate();
  const w = WEEKDAY_LABEL[date.getDay()];
  if (!hasTime) return `${m}월 ${day}일(${w})`;
  const h = date.getHours();
  const min = date.getMinutes();
  const period = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const minStr = min ? ` ${min}분` : "";
  return `${m}월 ${day}일(${w}) ${period} ${h12}시${minStr}`;
}

function dayDiff(date) {
  const a = startOfDay(date).getTime();
  const b = startOfDay(new Date()).getTime();
  return Math.round((a - b) / 86400000);
}

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ---------------------------------------------------------------------------
// 저장소 — 서버(Vercel + Upstash Redis)에 저장, 아이디+비밀번호로 접근 구분
// ---------------------------------------------------------------------------
const PASSWORD_KEY = "todo-webapp:password";
const USERID_KEY = "todo-webapp:userid";

const SEED = [
  { text: "당직비 정산 자료 취합 19일", fixedRecurring: true, repeat: "monthly" },
  { text: "비기너 과정 상품권 발송 내일", fixedRecurring: false, repeat: "none" },
  { text: "CFS 실적 정리 다음주 금요일", fixedRecurring: false, repeat: "none", cfsTarget: true },
];

async function fetchTasks(userId, password) {
  const res = await fetch("/api/tasks", {
    headers: { "x-app-password": password, "x-app-userid": userId },
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("failed");
  const data = await res.json();
  return data.tasks || [];
}

async function saveTasks(userId, password, tasks) {
  await fetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-password": password,
      "x-app-userid": userId,
    },
    body: JSON.stringify({ tasks }),
  });
}

function makeTask(rawText, fixedRecurring, repeat = "none") {
  const { date, hasTime } = parseKoreanDate(rawText);
  const base = date || startOfDay(new Date());
  const hour = hasTime ? base.getHours() : 9;
  const minute = hasTime ? base.getMinutes() : 0;

  let anchorDay = null;
  let anchorWeekday = null;
  let anchorMonth = null;
  if (repeat === "monthly") anchorDay = base.getDate();
  if (repeat === "weekly") anchorWeekday = base.getDay();
  if (repeat === "yearly") {
    anchorMonth = base.getMonth();
    anchorDay = base.getDate();
  }

  const due = fixedRecurring ? adjustToWorkday(base) : base;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: rawText.trim(),
    due: due.toISOString(),
    hasTime,
    hour,
    minute,
    repeat,
    anchorDay,
    anchorWeekday,
    anchorMonth,
    fixedRecurring,
    cfsTarget: false,
    done: false,
    createdAt: new Date().toISOString(),
  };
}

/** 완료된 반복 업무의 다음 회차 날짜를 계산 */
function computeNextOccurrence(task) {
  const cur = new Date(task.due);
  let next;

  if (task.repeat === "monthly") {
    let y = cur.getFullYear();
    let m = cur.getMonth() + 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    const dim = new Date(y, m + 1, 0).getDate();
    const day = Math.min(task.anchorDay, dim);
    next = new Date(y, m, day, task.hour, task.minute);
  } else if (task.repeat === "weekly") {
    next = new Date(cur);
    next.setDate(next.getDate() + 7);
    next.setHours(task.hour, task.minute, 0, 0);
  } else if (task.repeat === "yearly") {
    const y = cur.getFullYear() + 1;
    const dim = new Date(y, task.anchorMonth + 1, 0).getDate();
    const day = Math.min(task.anchorDay, dim);
    next = new Date(y, task.anchorMonth, day, task.hour, task.minute);
  } else {
    return null;
  }

  if (task.fixedRecurring) next = adjustToWorkday(next);
  return next;
}

function repeatLabel(task) {
  if (task.repeat === "monthly") return `매월 ${task.anchorDay}일`;
  if (task.repeat === "weekly") return `매주 ${WEEKDAY_LABEL[task.anchorWeekday]}요일`;
  if (task.repeat === "yearly") return `매년 ${task.anchorMonth + 1}월 ${task.anchorDay}일`;
  return null;
}

function seedTasks() {
  return SEED.map((s) => {
    const t = makeTask(s.text, s.fixedRecurring, s.repeat || "none");
    if (s.cfsTarget) t.cfsTarget = true;
    return t;
  });
}

// ---------------------------------------------------------------------------
// 달력 그리드 생성
// ---------------------------------------------------------------------------
function buildCalendarCells(viewMonth) {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last);
    next.setDate(next.getDate() + 1);
    cells.push({ date: next, inMonth: false });
  }
  return cells;
}

export default function App() {
  const [userId, setUserId] = useState(() => localStorage.getItem(USERID_KEY) || "");
  const [password, setPassword] = useState(() => localStorage.getItem(PASSWORD_KEY) || "");
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [userIdInput, setUserIdInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState("");
  const [fixedRecurring, setFixedRecurring] = useState(false);
  const [repeat, setRepeat] = useState("none"); // none | weekly | monthly | yearly
  const [filter, setFilter] = useState("all"); // all | today | upcoming | done | cfs
  const [copyFlash, setCopyFlash] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(null); // "YYYY-MM-DD" 형태의 key
  const [calendarOpen, setCalendarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth > 800 : true
  );
  const inputRef = useRef(null);
  const skipNextSave = useRef(false);

  const tryUnlock = useCallback(async (uid, pw) => {
    setAuthError("");
    const trimmedId = uid.trim();
    if (!trimmedId) {
      setAuthError("아이디를 입력해주세요.");
      setChecking(false);
      return;
    }
    try {
      const serverTasks = await fetchTasks(trimmedId, pw);
      skipNextSave.current = true;
      setTasks(serverTasks.length ? serverTasks : seedTasks());
      setUserId(trimmedId);
      setPassword(pw);
      setUnlocked(true);
      localStorage.setItem(USERID_KEY, trimmedId);
      localStorage.setItem(PASSWORD_KEY, pw);
    } catch (e) {
      localStorage.removeItem(PASSWORD_KEY);
      setAuthError("아이디 또는 비밀번호가 틀렸습니다.");
      setUnlocked(false);
    } finally {
      setChecking(false);
    }
  }, []);

  // 처음 열었을 때 저장된 아이디/비밀번호로 자동 로그인 시도
  useEffect(() => {
    if (userId && password) {
      tryUnlock(userId, password);
    } else {
      setChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tasks가 바뀔 때마다 서버에 저장 (서버에서 막 불러온 직후는 건너뜀)
  useEffect(() => {
    if (!unlocked) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    saveTasks(userId, password, tasks).catch(() => {
      /* 저장 실패는 조용히 무시 — 다음 변경 때 다시 시도됨 */
    });
  }, [tasks, unlocked, userId, password]);

  // 다른 기기에서 바뀐 내용을 반영하기 위해, 창에 다시 포커스될 때 새로고침
  useEffect(() => {
    if (!unlocked) return;
    const onFocus = () => {
      fetchTasks(userId, password)
        .then((serverTasks) => {
          skipNextSave.current = true;
          setTasks(serverTasks);
        })
        .catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [unlocked, userId, password]);

  const manualRefresh = () => {
    fetchTasks(userId, password)
      .then((serverTasks) => {
        skipNextSave.current = true;
        setTasks(serverTasks);
      })
      .catch(() => {});
  };

  const addTask = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setTasks((prev) => [makeTask(trimmed, fixedRecurring, repeat), ...prev]);
    setInput("");
    setFixedRecurring(false);
    setRepeat("none");
    inputRef.current?.focus();
  }, [input, fixedRecurring, repeat]);

  const toggleDone = (id) =>
    setTasks((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target) return prev;
      const nowDone = !target.done;
      const updated = prev.map((t) => (t.id === id ? { ...t, done: nowDone } : t));
      // 반복 업무를 완료 처리하면 다음 회차를 자동으로 새로 만들어 추가
      if (nowDone && target.repeat !== "none") {
        const nextDue = computeNextOccurrence(target);
        if (nextDue) {
          const spawned = {
            ...target,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            due: nextDue.toISOString(),
            done: false,
            cfsTarget: false,
            createdAt: new Date().toISOString(),
          };
          return [spawned, ...updated];
        }
      }
      return updated;
    });
  const toggleCfs = (id) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, cfsTarget: !t.cfsTarget } : t)));
  const removeTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const stats = useMemo(() => {
    const open = tasks.filter((t) => !t.done);
    const todayCount = open.filter((t) => t.due && dayDiff(new Date(t.due)) === 0).length;
    const overdueCount = open.filter((t) => t.due && dayDiff(new Date(t.due)) < 0).length;
    const weekCount = open.filter(
      (t) => t.due && dayDiff(new Date(t.due)) >= 0 && dayDiff(new Date(t.due)) <= 7
    ).length;
    return { todayCount, overdueCount, weekCount };
  }, [tasks]);

  const tasksByDay = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (!t.due) return;
      const key = dayKey(new Date(t.due));
      (map[key] = map[key] || []).push(t);
    });
    return map;
  }, [tasks]);

  const calendarCells = useMemo(() => buildCalendarCells(viewMonth), [viewMonth]);
  const todayKey = dayKey(new Date());

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (selectedDate) {
      list = list.filter((t) => t.due && dayKey(new Date(t.due)) === selectedDate);
    } else if (filter === "today") {
      list = list.filter((t) => !t.done && t.due && dayDiff(new Date(t.due)) <= 0);
    } else if (filter === "upcoming") {
      list = list.filter((t) => !t.done && t.due && dayDiff(new Date(t.due)) > 0);
    } else if (filter === "done") {
      list = list.filter((t) => t.done);
    } else if (filter === "cfs") {
      list = list.filter((t) => t.cfsTarget);
    }
    list.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return new Date(a.due) - new Date(b.due);
    });
    return list;
  }, [tasks, filter, selectedDate]);

  const copyCfsList = async () => {
    const items = tasks.filter((t) => t.cfsTarget && t.done);
    const text = items
      .map((t, i) => `${i + 1}. ${t.text}${t.due ? ` (${formatDue(new Date(t.due), t.hasTime)})` : ""}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text || "완료된 CFS 대상 항목이 없습니다.");
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1600);
    } catch (e) {
      /* 클립보드 접근 불가 시 조용히 무시 */
    }
  };

  const goPrevMonth = () =>
    setViewMonth((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1));
  const goNextMonth = () =>
    setViewMonth((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1));
  const goToday = () => {
    const n = new Date();
    setViewMonth(new Date(n.getFullYear(), n.getMonth(), 1));
  };

  const selectDay = (cell) => {
    const key = dayKey(cell.date);
    setSelectedDate((prev) => (prev === key ? null : key));
  };

  const ink = "#242322";
  const paper = "#FAF7F2";
  const line = "#E4DDCF";
  const teal = "#146356";
  const tealSoft = "#E4EEEC";
  const amber = "#C1592E";
  const amberSoft = "#F7E5DA";

  const tabs = [
    { key: "all", label: "전체" },
    { key: "today", label: "오늘 마감" },
    { key: "upcoming", label: "예정" },
    { key: "cfs", label: "CFS 대상" },
    { key: "done", label: "완료" },
  ];

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return null;
    const cell = calendarCells.find((c) => dayKey(c.date) === selectedDate);
    if (!cell) return null;
    const d = cell.date;
    return `${d.getMonth() + 1}월 ${d.getDate()}일(${WEEKDAY_LABEL[d.getDay()]})`;
  }, [selectedDate, calendarCells]);

  if (checking) {
    return (
      <div className="app" style={{ background: paper, color: ink }}>
        <div className="lock-wrap">
          <h1 className="title mono" style={{ color: teal }}>
            TODO
          </h1>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="app" style={{ background: paper, color: ink }}>
        <div className="lock-wrap">
          <h1 className="title">TODO</h1>
          <div className="lock-card" style={{ border: `1px solid ${line}` }}>
            <div className="lock-label">아이디</div>
            <input
              type="text"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") tryUnlock(userIdInput, passwordInput);
              }}
              className="lock-input"
              autoFocus
            />
            <div className="lock-label">비밀번호</div>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") tryUnlock(userIdInput, passwordInput);
              }}
              className="lock-input"
            />
            <button
              onClick={() => tryUnlock(userIdInput, passwordInput)}
              className="add-btn lock-submit"
              style={{ background: teal }}
            >
              확인
            </button>
            {authError && <div className="lock-error" style={{ color: amber }}>{authError}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app" style={{ background: paper, color: ink }}>
      <div className="wrap">
        <div className="header-row">
          <div>
            <h1 className="title">TODO</h1>
          </div>
          <button onClick={manualRefresh} className="refresh-btn" style={{ color: teal, borderColor: teal }}>
            새로고침
          </button>
        </div>

        <div className="layout">
          {/* 왼쪽: 달력 */}
          <div className="calendar-panel">
            <div className="calendar-card" style={{ border: `1px solid ${line}` }}>
              <div className={`calendar-header ${calendarOpen ? "" : "calendar-header--collapsed"}`}>
                {calendarOpen && (
                  <button onClick={goPrevMonth} className="cal-nav-btn" style={{ color: "#7A7468" }}>
                    <ChevronLeft size={18} />
                  </button>
                )}
                <button
                  onClick={() => setCalendarOpen((o) => !o)}
                  className="calendar-month-toggle mono"
                  style={{ color: ink }}
                >
                  {viewMonth.getFullYear()}. {viewMonth.getMonth() + 1}
                  <ChevronDown
                    size={15}
                    style={{
                      transform: calendarOpen ? "rotate(180deg)" : "none",
                      transition: "transform .15s ease",
                    }}
                  />
                </button>
                {calendarOpen && (
                  <button onClick={goNextMonth} className="cal-nav-btn" style={{ color: "#7A7468" }}>
                    <ChevronRight size={18} />
                  </button>
                )}
              </div>

              {calendarOpen && (
                <>
                  <div className="calendar-weekrow">
                    {WEEKDAY_LABEL.map((w, i) => (
                      <div
                        key={w}
                        className="calendar-weekday"
                        style={{ color: i === 0 ? amber : i === 6 ? teal : "#9A9385" }}
                      >
                        {w}
                      </div>
                    ))}
                  </div>

                  <div className="calendar-grid">
                    {calendarCells.map((cell) => {
                      const key = dayKey(cell.date);
                      const dayTasks = (tasksByDay[key] || []).filter((t) => !t.done);
                      const isToday = key === todayKey;
                      const isSelected = key === selectedDate;
                      const isPast = cell.date < startOfDay(new Date());
                      const hasOverdue = isPast && dayTasks.length > 0;
                      const dow = cell.date.getDay();

                      return (
                        <button
                          key={key}
                          onClick={() => selectDay(cell)}
                          className="calendar-cell"
                          style={{
                            background: isSelected ? tealSoft : "transparent",
                            border: isToday ? `1px solid ${teal}` : "1px solid transparent",
                            opacity: cell.inMonth ? 1 : 0.35,
                          }}
                        >
                          <span
                            className="calendar-daynum mono"
                            style={{
                              color: hasOverdue ? amber : dow === 0 ? "#C98F72" : dow === 6 ? teal : ink,
                              fontWeight: isToday ? 700 : 500,
                            }}
                          >
                            {cell.date.getDate()}
                          </span>
                          {dayTasks.slice(0, 2).map((t) => (
                            <span
                              key={t.id}
                              className="calendar-chip"
                              style={{
                                background: hasOverdue ? amberSoft : tealSoft,
                                color: hasOverdue ? amber : teal,
                              }}
                            >
                              {t.text}
                            </span>
                          ))}
                          {dayTasks.length > 2 && (
                            <span className="calendar-more">+{dayTasks.length - 2}개</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button onClick={goToday} className="today-btn" style={{ color: teal, borderColor: teal }}>
                    오늘로 이동
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 오른쪽: 입력 + 목록 */}
          <div className="main-panel">
            <div className="stats">
              <div className="stat-card" style={{ border: `1px solid ${line}` }}>
                <div className="stat-value mono" style={{ color: amber }}>
                  {stats.overdueCount}
                </div>
                <div className="stat-label">지연</div>
              </div>
              <div className="stat-card" style={{ border: `1px solid ${line}` }}>
                <div className="stat-value mono" style={{ color: teal }}>
                  {stats.todayCount}
                </div>
                <div className="stat-label">오늘 마감</div>
              </div>
              <div className="stat-card" style={{ border: `1px solid ${line}` }}>
                <div className="stat-value mono" style={{ color: ink }}>
                  {stats.weekCount}
                </div>
                <div className="stat-label">이번주 예정</div>
              </div>
            </div>

            <div className="input-card" style={{ border: `1px solid ${line}` }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTask();
                }}
                placeholder="예) 19일 당직비 정산, 내일 오후 3시 회의, 다음주 금요일까지 보고서"
                style={{ color: ink }}
              />
              <div className="input-footer" style={{ borderTop: `1px solid ${line}` }}>
                <div className="input-footer-left">
                  <select
                    value={repeat}
                    onChange={(e) => setRepeat(e.target.value)}
                    className="repeat-select"
                    style={{ borderColor: line, color: "#7A7468" }}
                  >
                    <option value="none">반복 안함</option>
                    <option value="weekly">매주</option>
                    <option value="monthly">매월</option>
                    <option value="yearly">매년</option>
                  </select>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={fixedRecurring}
                      onChange={(e) => setFixedRecurring(e.target.checked)}
                    />
                    <Repeat size={13} />
                    주말·공휴일이면 앞당겨서 알림
                  </label>
                </div>
                <button onClick={addTask} className="add-btn" style={{ background: teal }}>
                  추가 (Enter)
                </button>
              </div>
            </div>

            {selectedDate ? (
              <div className="selected-day-bar" style={{ border: `1px solid ${line}` }}>
                <span className="mono" style={{ color: teal, fontWeight: 600 }}>
                  {selectedDateLabel} 일정
                </span>
                <button onClick={() => setSelectedDate(null)} className="clear-day-btn" style={{ color: "#7A7468" }}>
                  <X size={14} />
                  전체보기
                </button>
              </div>
            ) : (
              <div className="tabs">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setFilter(t.key)}
                    className="tab-btn"
                    style={
                      filter === t.key
                        ? { background: teal, color: "#fff" }
                        : { color: "#7A7468", border: `1px solid ${line}` }
                    }
                  >
                    {t.label}
                  </button>
                ))}
                {filter === "cfs" && (
                  <button onClick={copyCfsList} className="copy-btn" style={{ border: `1px solid ${teal}`, color: teal }}>
                    <Clipboard size={12} />
                    {copyFlash ? "복사됨" : "완료 목록 복사"}
                  </button>
                )}
              </div>
            )}

            <div className="list">
              {filtered.length === 0 && (
                <div className="empty" style={{ border: `1px dashed ${line}`, color: "#9A9385" }}>
                  <Inbox size={20} />
                  해당하는 항목이 없습니다.
                </div>
              )}
              {filtered.map((t) => {
                const due = t.due ? new Date(t.due) : null;
                const diff = due ? dayDiff(due) : null;
                const overdue = !t.done && diff !== null && diff < 0;
                const dueToday = !t.done && diff === 0;
                return (
                  <div
                    key={t.id}
                    className="task-card"
                    style={{ border: `1px solid ${overdue ? amber : line}`, opacity: t.done ? 0.55 : 1 }}
                  >
                    <button
                      onClick={() => toggleDone(t.id)}
                      className="check-btn"
                      style={{ borderColor: t.done ? teal : "#C9C2B3", background: t.done ? teal : "transparent" }}
                    >
                      {t.done && <Check size={12} color="#fff" strokeWidth={3} />}
                    </button>

                    <div className="task-body">
                      <div className="task-text" style={{ textDecoration: t.done ? "line-through" : "none" }}>
                        {t.text}
                      </div>
                      <div className="task-tags">
                        {due && (
                          <span
                            className="tag mono"
                            style={{
                              background: overdue ? amberSoft : dueToday ? tealSoft : "#F1EEE6",
                              color: overdue ? amber : dueToday ? teal : "#7A7468",
                            }}
                          >
                            {overdue && <Flame size={10} />}
                            {formatDue(due, t.hasTime)}
                            {overdue ? " · 지연" : dueToday ? " · 오늘" : ""}
                          </span>
                        )}
                        {t.repeat && t.repeat !== "none" && (
                          <span className="tag mono" style={{ background: "#F1EEE6", color: "#7A7468" }}>
                            <Repeat size={10} />
                            {repeatLabel(t)}
                          </span>
                        )}
                        <button
                          onClick={() => toggleCfs(t.id)}
                          className="tag tag-btn"
                          style={t.cfsTarget ? { background: tealSoft, color: teal } : { background: "#F1EEE6", color: "#B7B0A2" }}
                        >
                          CFS 대상
                        </button>
                      </div>
                    </div>

                    <button onClick={() => removeTask(t.id)} className="del-btn" style={{ color: "#C9C2B3" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="footnote">
              입력한 문장에서 날짜·요일·시간을 자동으로 인식해 마감일로 등록합니다. 왼쪽 달력에서 날짜를 누르면 그날 일정만 볼 수 있어요.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

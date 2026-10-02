import {
  clamp,
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade,
} from "ts-fsrs";

export const DAY = 24 * 60 * 60 * 1000;
export const scheduler = fsrs(generatorParameters({ enable_short_term: false }));

export interface FsrsWordFields {
  lastReviewedAt?: number;
  nextReviewAt: number;
  stability?: number;
  difficulty?: number;
  scheduledDays?: number;
  fsrsState?: number;
  easeFactor?: number;
  intervalDays?: number;
  repetitions?: number;
  lapses?: number;
}

// Convert DB word to ts-fsrs Card
export function toCard(w: FsrsWordFields): Card {
  if (w.lastReviewedAt === undefined) {
    const c = createEmptyCard();
    c.due = new Date(w.nextReviewAt);
    return c;
  }
  if (w.stability === undefined || w.difficulty === undefined) {
    // Legacy migration: approximate from legacy easeFactor and intervalDays
    const ease = w.easeFactor ?? 2.5;
    return {
      due: new Date(w.nextReviewAt),
      stability: Math.max(0.1, w.intervalDays ?? 1),
      difficulty: clamp(1 + ((3 - ease) / 1.7) * 9, 1, 10),
      elapsed_days: 0,
      scheduled_days: w.intervalDays ?? 0,
      learning_steps: 0,
      reps: w.repetitions ?? 0,
      lapses: w.lapses ?? 0,
      state: State.Review,
      last_review: new Date(w.lastReviewedAt),
    };
  }
  return {
    due: new Date(w.nextReviewAt),
    stability: w.stability,
    difficulty: w.difficulty,
    elapsed_days: w.scheduledDays ?? 0,
    scheduled_days: w.scheduledDays ?? 0,
    learning_steps: 0,
    reps: w.repetitions ?? 1,
    lapses: w.lapses ?? 0,
    state: (w.fsrsState ?? State.Review) as State,
    last_review: w.lastReviewedAt ? new Date(w.lastReviewedAt) : undefined,
  };
}

// Card -> DB patch fields
export function cardPatch(c: Card, now: number) {
  return {
    stability: c.stability,
    difficulty: c.difficulty,
    fsrsState: c.state,
    lapses: c.lapses,
    scheduledDays: c.scheduled_days,
    intervalDays: c.scheduled_days,
    repetitions: c.reps,
    lastReviewedAt: now,
    nextReviewAt: c.due.getTime(),
    updatedAt: now,
  };
}

// User answer -> FSRS Rating Grade
export function toRating(a: {
  correct: boolean;
  questionType: "choice" | "recall";
  responseMs: number;
}): Grade {
  if (!a.correct) return Rating.Again;
  if (a.questionType === "choice") {
    // Recognition is weaker evidence: Good if quick, Hard if slow
    return a.responseMs > 8000 ? Rating.Hard : Rating.Good;
  }
  // Production recall: Easy if fast, Good otherwise
  return a.responseMs > 8000 ? Rating.Good : Rating.Easy;
}

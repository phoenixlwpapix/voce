import { describe, expect, it } from "vitest";
import { Rating, State } from "ts-fsrs";
import { cardPatch, scheduler, toCard, toRating } from "./fsrs";

describe("convex/lib/fsrs", () => {
  it("converts new unreviewed words to empty FSRS card", () => {
    const card = toCard({ nextReviewAt: 1700000000000 });
    expect(card.state).toBe(State.New);
    expect(card.due.getTime()).toBe(1700000000000);
    expect(card.reps).toBe(0);
  });

  it("migrates legacy word with easeFactor and intervalDays", () => {
    const card = toCard({
      nextReviewAt: 1700000000000,
      lastReviewedAt: 1699000000000,
      easeFactor: 2.5,
      intervalDays: 3,
      repetitions: 2,
    });
    expect(card.state).toBe(State.Review);
    expect(card.scheduled_days).toBe(3);
    expect(card.stability).toBe(3);
    // difficulty clamp(1 + ((3 - 2.5) / 1.7) * 9, 1, 10) ~ 3.647
    expect(card.difficulty).toBeGreaterThan(3);
    expect(card.difficulty).toBeLessThan(4);
    expect(card.last_review?.getTime()).toBe(1699000000000);
  });

  it("maps ratings based on question type, correctness, and speed", () => {
    // Incorrect is always Again
    expect(toRating({ correct: false, questionType: "choice", responseMs: 2000 })).toBe(Rating.Again);
    expect(toRating({ correct: false, questionType: "recall", responseMs: 2000 })).toBe(Rating.Again);

    // Multiple choice
    expect(toRating({ correct: true, questionType: "choice", responseMs: 3000 })).toBe(Rating.Good);
    expect(toRating({ correct: true, questionType: "choice", responseMs: 9000 })).toBe(Rating.Hard);

    // Active recall / production
    expect(toRating({ correct: true, questionType: "recall", responseMs: 3000 })).toBe(Rating.Easy);
    expect(toRating({ correct: true, questionType: "recall", responseMs: 9000 })).toBe(Rating.Good);
  });

  it("schedules next review with FSRS scheduler", () => {
    const now = new Date(1700000000000);
    const initialCard = toCard({ nextReviewAt: now.getTime() });
    const { card } = scheduler.next(initialCard, now, Rating.Good);

    expect(card.due.getTime()).toBeGreaterThan(now.getTime());
    expect(card.reps).toBe(1);
    expect(card.state).toBe(State.Review);

    const patch = cardPatch(card, now.getTime());
    expect(patch.stability).toBe(card.stability);
    expect(patch.difficulty).toBe(card.difficulty);
    expect(patch.nextReviewAt).toBe(card.due.getTime());
    expect(patch.lastReviewedAt).toBe(now.getTime());
    expect(patch.intervalDays).toBe(card.scheduled_days);
  });
});

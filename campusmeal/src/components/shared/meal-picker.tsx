import Link from "next/link";
import { addDays, cn, fmtDate, fmtTime } from "@/lib/utils";
import type { DayMeal } from "@/features/meals/queries";
import { MealStatusPill } from "@/components/shared/status";

/** Date stepper + meal segmented control driven by ?date=&meal= params. */
export function MealPicker({
  basePath,
  date,
  today,
  meals,
  selectedId,
}: {
  basePath: string;
  date: string;
  today: string;
  meals: DayMeal[];
  selectedId?: string;
}) {
  const href = (d: string, m?: string) => `${basePath}?date=${d}${m ? `&meal=${m}` : ""}`;
  return (
    <div className="my-5 flex flex-wrap items-center gap-3">
      <div className="seg" role="group" aria-label="Date">
        <Link href={href(addDays(date, -1))} aria-label="Previous day">
          ‹
        </Link>
        <Link href={href(today)} className={cn(date === today && "on")}>
          {date === today ? "Today" : fmtDate(date)}
        </Link>
        <Link href={href(addDays(date, 1))} aria-label="Next day">
          ›
        </Link>
      </div>
      {meals.length > 0 ? (
        <div className="seg" role="group" aria-label="Meal">
          {meals.map((m) => (
            <Link key={m.id} href={href(date, m.id)} className={cn(m.id === selectedId && "on")}>
              {m.schedule.name} · {fmtTime(m.schedule.serve_time)}
              {m.status !== "scheduled" && (
                <>
                  {" "}
                  · <MealStatusPill status={m.status} compact />
                </>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <span className="text-[13px] text-dim">No meals scheduled on {fmtDate(date)}.</span>
      )}
    </div>
  );
}

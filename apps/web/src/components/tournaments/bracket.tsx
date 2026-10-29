import { getFormatter, getTranslations } from "next-intl/server";
import type { ViewMatch } from "@/lib/tournament-view";
import { MatchCard } from "./match-card";

// Stage names that are elimination rounds, shown as a bracket. Other stages are shown as match lists.
const BRACKET_STAGE = /(round of|quarter|semi|final|playoff)/i;
const NOT_BRACKET = /(group|swiss|play-in|qualif)/i;

const isBracketStage = (name: string | null) => !!name && BRACKET_STAGE.test(name) && !NOT_BRACKET.test(name);

function chunk<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Group stages as day lists, then playoffs as a left-to-right tree. */
export async function TournamentMatches({ matches }: { matches: ViewMatch[] }) {
  const [t, format] = await Promise.all([getTranslations("tournaments"), getFormatter()]);
  if (matches.length === 0) return <p className="card text-fg-muted">{t("noMatches")}</p>;

  const progress = (list: ViewMatch[]) =>
    t("stageProgress", { played: list.filter((m) => ["completed", "finished"].includes(m.status)).length, total: list.length });
  const stageOrder = [...new Set(matches.map((m) => m.stageName))];
  const listStages = stageOrder.filter((s) => !isBracketStage(s));
  const rounds = stageOrder.filter(isBracketStage).map((name) => ({ name: name!, matches: matches.filter((m) => m.stageName === name) }));
  const firstRoundSize = rounds[0]?.matches.length ?? 0;

  return (
    <div className="grid gap-10">
      {listStages.map((stage) => {
        const stageMatches = matches.filter((m) => m.stageName === stage);
        const days = [...new Set(stageMatches.map((m) => (m.startsAt ? m.startsAt.toISOString().slice(0, 10) : "")))];
        return (
          <section key={stage ?? "matches"} className="grid gap-4">
            <h3 className="flex flex-wrap items-baseline gap-x-3 font-display text-xl font-bold">
              {stage ?? t("matchesTitle")}
              <span className="font-sans text-sm font-normal text-fg-muted">{progress(stageMatches)}</span>
            </h3>
            {days.map((day) => (
              <div key={day} className="grid gap-2">
                {day ? (
                  <p className="label">{format.dateTime(new Date(`${day}T00:00:00Z`), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</p>
                ) : null}
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {stageMatches
                    .filter((m) => (m.startsAt ? m.startsAt.toISOString().slice(0, 10) : "") === day)
                    .map((m) => (
                      <li key={m.id}>
                        <MatchCard match={m} />
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </section>
        );
      })}

      {rounds.length > 0 ? (
        <section className="grid gap-4" aria-labelledby="playoffs-title">
          <h3 id="playoffs-title" className="font-display text-xl font-bold">
            {t("playoffsTitle")}
          </h3>
          <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            <div className="bracket" style={{ minHeight: Math.max(1, firstRoundSize) * 104 }}>
              {rounds.map((round) => (
                <div key={round.name} className="bracket-round">
                  <p className="label bracket-round-title">
                    {round.name}
                    <span className="block font-normal normal-case tracking-normal">{progress(round.matches)}</span>
                  </p>
                  <div className="bracket-body">
                    {chunk(round.matches, 2).map((pair) => (
                      <div key={pair.map((m) => m.id).join("-")} className="bracket-pair">
                        {pair.map((m) => (
                          <div key={m.id} className="bracket-slot">
                            <MatchCard match={m} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

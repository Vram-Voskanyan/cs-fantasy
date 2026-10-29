import type { Tournament } from "@/lib/tournaments";
import { TournamentCard } from "./tournament-card";

export function TournamentGrid({ tournaments, now }: { tournaments: Tournament[]; now: Date }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tournaments.map((tournament) => (
        <li key={tournament.id}>
          <TournamentCard tournament={tournament} now={now} />
        </li>
      ))}
    </ul>
  );
}

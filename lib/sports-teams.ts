// Sports teams available for tracking across all leagues
// Teams are identified by LEAGUE:CODE format (e.g., "MLB:ATL", "NFL:IND")

export interface SportTeam {
  code: string;
  name: string;
  fullName: string;
  league: string;
}

export const AVAILABLE_SPORTS_TEAMS = {
  MLB: [
    { code: "ATL", name: "Braves", fullName: "Atlanta Braves", league: "MLB" },
    { code: "NYY", name: "Yankees", fullName: "New York Yankees", league: "MLB" },
    { code: "LAD", name: "Dodgers", fullName: "Los Angeles Dodgers", league: "MLB" },
    { code: "BOS", name: "Red Sox", fullName: "Boston Red Sox", league: "MLB" },
    { code: "NYM", name: "Mets", fullName: "New York Mets", league: "MLB" },
  ] as const,
  NFL: [
    { code: "IND", name: "Colts", fullName: "Indianapolis Colts", league: "NFL" },
    { code: "TEN", name: "Titans", fullName: "Tennessee Titans", league: "NFL" },
    { code: "KC", name: "Chiefs", fullName: "Kansas City Chiefs", league: "NFL" },
    { code: "LAC", name: "Chargers", fullName: "Los Angeles Chargers", league: "NFL" },
    { code: "BAL", name: "Ravens", fullName: "Baltimore Ravens", league: "NFL" },
  ] as const,
  NBA: [
    { code: "IND", name: "Pacers", fullName: "Indiana Pacers", league: "NBA" },
    { code: "LAL", name: "Lakers", fullName: "Los Angeles Lakers", league: "NBA" },
    { code: "BOS", name: "Celtics", fullName: "Boston Celtics", league: "NBA" },
    { code: "MIA", name: "Heat", fullName: "Miami Heat", league: "NBA" },
    { code: "GSW", name: "Warriors", fullName: "Golden State Warriors", league: "NBA" },
  ] as const,
  WNBA: [
    { code: "IND", name: "Fever", fullName: "Indiana Fever", league: "WNBA" },
    { code: "LAS", name: "Aces", fullName: "Las Vegas Aces", league: "WNBA" },
    { code: "LA", name: "Sparks", fullName: "Los Angeles Sparks", league: "WNBA" },
    { code: "NY", name: "Liberty", fullName: "New York Liberty", league: "WNBA" },
    { code: "PHOS", name: "Mercury", fullName: "Phoenix Mercury", league: "WNBA" },
  ] as const,
  COLLEGE: [
    { code: "FAMU-FB", name: "FAMU Football", fullName: "Florida A&M Football", league: "COLLEGE" },
    { code: "FAMU-BB", name: "FAMU Baseball", fullName: "Florida A&M Baseball", league: "COLLEGE" },
    { code: "FAMU-BK", name: "FAMU Basketball", fullName: "Florida A&M Basketball", league: "COLLEGE" },
  ] as const,
};

export type LeagueKey = keyof typeof AVAILABLE_SPORTS_TEAMS;
export type SportsTeamId =
  | `MLB:${typeof AVAILABLE_SPORTS_TEAMS.MLB[number]["code"]}`
  | `NFL:${typeof AVAILABLE_SPORTS_TEAMS.NFL[number]["code"]}`
  | `NBA:${typeof AVAILABLE_SPORTS_TEAMS.NBA[number]["code"]}`
  | `WNBA:${typeof AVAILABLE_SPORTS_TEAMS.WNBA[number]["code"]}`
  | `COLLEGE:${typeof AVAILABLE_SPORTS_TEAMS.COLLEGE[number]["code"]}`;

/**
 * Get team info by ID (format: "LEAGUE:CODE")
 */
export function getTeamInfo(teamId: string): SportTeam | null {
  const [league, code] = teamId.split(":");
  if (!league || !code) return null;

  const leagueTeams = AVAILABLE_SPORTS_TEAMS[league as LeagueKey];
  if (!leagueTeams) return null;

  return (
    leagueTeams.find((t) => t.code === code) ?? null
  ) as SportTeam | null;
}

/**
 * Get display name for a team ID
 */
export function getTeamDisplayName(teamId: string): string {
  const team = getTeamInfo(teamId);
  return team ? `${team.fullName}` : teamId;
}

/**
 * Get league from team ID
 */
export function getLeagueFromTeamId(teamId: string): string {
  const [league] = teamId.split(":");
  return league || "Unknown";
}

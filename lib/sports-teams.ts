// Sports teams available for tracking across all leagues.
// Teams are identified by LEAGUE:CODE format (e.g., "MLB:ATL", "NFL:IND").
// Pro rosters are the full leagues (sourced from ESPN); COLLEGE is a curated set
// of major/HBCU programs (football + basketball) since there are hundreds of schools.

export interface SportTeam {
  code: string;
  name: string;
  fullName: string;
  league: string;
}

export const AVAILABLE_SPORTS_TEAMS = {
  MLB: [
    { code: "ARI", name: "Diamondbacks", fullName: "Arizona Diamondbacks", league: "MLB" },
    { code: "ATH", name: "Athletics", fullName: "Athletics", league: "MLB" },
    { code: "ATL", name: "Braves", fullName: "Atlanta Braves", league: "MLB" },
    { code: "BAL", name: "Orioles", fullName: "Baltimore Orioles", league: "MLB" },
    { code: "BOS", name: "Red Sox", fullName: "Boston Red Sox", league: "MLB" },
    { code: "CHC", name: "Cubs", fullName: "Chicago Cubs", league: "MLB" },
    { code: "CHW", name: "White Sox", fullName: "Chicago White Sox", league: "MLB" },
    { code: "CIN", name: "Reds", fullName: "Cincinnati Reds", league: "MLB" },
    { code: "CLE", name: "Guardians", fullName: "Cleveland Guardians", league: "MLB" },
    { code: "COL", name: "Rockies", fullName: "Colorado Rockies", league: "MLB" },
    { code: "DET", name: "Tigers", fullName: "Detroit Tigers", league: "MLB" },
    { code: "HOU", name: "Astros", fullName: "Houston Astros", league: "MLB" },
    { code: "KC", name: "Royals", fullName: "Kansas City Royals", league: "MLB" },
    { code: "LAA", name: "Angels", fullName: "Los Angeles Angels", league: "MLB" },
    { code: "LAD", name: "Dodgers", fullName: "Los Angeles Dodgers", league: "MLB" },
    { code: "MIA", name: "Marlins", fullName: "Miami Marlins", league: "MLB" },
    { code: "MIL", name: "Brewers", fullName: "Milwaukee Brewers", league: "MLB" },
    { code: "MIN", name: "Twins", fullName: "Minnesota Twins", league: "MLB" },
    { code: "NYM", name: "Mets", fullName: "New York Mets", league: "MLB" },
    { code: "NYY", name: "Yankees", fullName: "New York Yankees", league: "MLB" },
    { code: "PHI", name: "Phillies", fullName: "Philadelphia Phillies", league: "MLB" },
    { code: "PIT", name: "Pirates", fullName: "Pittsburgh Pirates", league: "MLB" },
    { code: "SD", name: "Padres", fullName: "San Diego Padres", league: "MLB" },
    { code: "SF", name: "Giants", fullName: "San Francisco Giants", league: "MLB" },
    { code: "SEA", name: "Mariners", fullName: "Seattle Mariners", league: "MLB" },
    { code: "STL", name: "Cardinals", fullName: "St. Louis Cardinals", league: "MLB" },
    { code: "TB", name: "Rays", fullName: "Tampa Bay Rays", league: "MLB" },
    { code: "TEX", name: "Rangers", fullName: "Texas Rangers", league: "MLB" },
    { code: "TOR", name: "Blue Jays", fullName: "Toronto Blue Jays", league: "MLB" },
    { code: "WSH", name: "Nationals", fullName: "Washington Nationals", league: "MLB" },
  ],
  NFL: [
    { code: "ARI", name: "Cardinals", fullName: "Arizona Cardinals", league: "NFL" },
    { code: "ATL", name: "Falcons", fullName: "Atlanta Falcons", league: "NFL" },
    { code: "BAL", name: "Ravens", fullName: "Baltimore Ravens", league: "NFL" },
    { code: "BUF", name: "Bills", fullName: "Buffalo Bills", league: "NFL" },
    { code: "CAR", name: "Panthers", fullName: "Carolina Panthers", league: "NFL" },
    { code: "CHI", name: "Bears", fullName: "Chicago Bears", league: "NFL" },
    { code: "CIN", name: "Bengals", fullName: "Cincinnati Bengals", league: "NFL" },
    { code: "CLE", name: "Browns", fullName: "Cleveland Browns", league: "NFL" },
    { code: "DAL", name: "Cowboys", fullName: "Dallas Cowboys", league: "NFL" },
    { code: "DEN", name: "Broncos", fullName: "Denver Broncos", league: "NFL" },
    { code: "DET", name: "Lions", fullName: "Detroit Lions", league: "NFL" },
    { code: "GB", name: "Packers", fullName: "Green Bay Packers", league: "NFL" },
    { code: "HOU", name: "Texans", fullName: "Houston Texans", league: "NFL" },
    { code: "IND", name: "Colts", fullName: "Indianapolis Colts", league: "NFL" },
    { code: "JAX", name: "Jaguars", fullName: "Jacksonville Jaguars", league: "NFL" },
    { code: "KC", name: "Chiefs", fullName: "Kansas City Chiefs", league: "NFL" },
    { code: "LV", name: "Raiders", fullName: "Las Vegas Raiders", league: "NFL" },
    { code: "LAC", name: "Chargers", fullName: "Los Angeles Chargers", league: "NFL" },
    { code: "LAR", name: "Rams", fullName: "Los Angeles Rams", league: "NFL" },
    { code: "MIA", name: "Dolphins", fullName: "Miami Dolphins", league: "NFL" },
    { code: "MIN", name: "Vikings", fullName: "Minnesota Vikings", league: "NFL" },
    { code: "NE", name: "Patriots", fullName: "New England Patriots", league: "NFL" },
    { code: "NO", name: "Saints", fullName: "New Orleans Saints", league: "NFL" },
    { code: "NYG", name: "Giants", fullName: "New York Giants", league: "NFL" },
    { code: "NYJ", name: "Jets", fullName: "New York Jets", league: "NFL" },
    { code: "PHI", name: "Eagles", fullName: "Philadelphia Eagles", league: "NFL" },
    { code: "PIT", name: "Steelers", fullName: "Pittsburgh Steelers", league: "NFL" },
    { code: "SF", name: "49ers", fullName: "San Francisco 49ers", league: "NFL" },
    { code: "SEA", name: "Seahawks", fullName: "Seattle Seahawks", league: "NFL" },
    { code: "TB", name: "Buccaneers", fullName: "Tampa Bay Buccaneers", league: "NFL" },
    { code: "TEN", name: "Titans", fullName: "Tennessee Titans", league: "NFL" },
    { code: "WSH", name: "Commanders", fullName: "Washington Commanders", league: "NFL" },
  ],
  NBA: [
    { code: "ATL", name: "Hawks", fullName: "Atlanta Hawks", league: "NBA" },
    { code: "BOS", name: "Celtics", fullName: "Boston Celtics", league: "NBA" },
    { code: "BKN", name: "Nets", fullName: "Brooklyn Nets", league: "NBA" },
    { code: "CHA", name: "Hornets", fullName: "Charlotte Hornets", league: "NBA" },
    { code: "CHI", name: "Bulls", fullName: "Chicago Bulls", league: "NBA" },
    { code: "CLE", name: "Cavaliers", fullName: "Cleveland Cavaliers", league: "NBA" },
    { code: "DAL", name: "Mavericks", fullName: "Dallas Mavericks", league: "NBA" },
    { code: "DEN", name: "Nuggets", fullName: "Denver Nuggets", league: "NBA" },
    { code: "DET", name: "Pistons", fullName: "Detroit Pistons", league: "NBA" },
    { code: "GS", name: "Warriors", fullName: "Golden State Warriors", league: "NBA" },
    { code: "HOU", name: "Rockets", fullName: "Houston Rockets", league: "NBA" },
    { code: "IND", name: "Pacers", fullName: "Indiana Pacers", league: "NBA" },
    { code: "LAC", name: "Clippers", fullName: "LA Clippers", league: "NBA" },
    { code: "LAL", name: "Lakers", fullName: "Los Angeles Lakers", league: "NBA" },
    { code: "MEM", name: "Grizzlies", fullName: "Memphis Grizzlies", league: "NBA" },
    { code: "MIA", name: "Heat", fullName: "Miami Heat", league: "NBA" },
    { code: "MIL", name: "Bucks", fullName: "Milwaukee Bucks", league: "NBA" },
    { code: "MIN", name: "Timberwolves", fullName: "Minnesota Timberwolves", league: "NBA" },
    { code: "NO", name: "Pelicans", fullName: "New Orleans Pelicans", league: "NBA" },
    { code: "NY", name: "Knicks", fullName: "New York Knicks", league: "NBA" },
    { code: "OKC", name: "Thunder", fullName: "Oklahoma City Thunder", league: "NBA" },
    { code: "ORL", name: "Magic", fullName: "Orlando Magic", league: "NBA" },
    { code: "PHI", name: "76ers", fullName: "Philadelphia 76ers", league: "NBA" },
    { code: "PHX", name: "Suns", fullName: "Phoenix Suns", league: "NBA" },
    { code: "POR", name: "Trail Blazers", fullName: "Portland Trail Blazers", league: "NBA" },
    { code: "SAC", name: "Kings", fullName: "Sacramento Kings", league: "NBA" },
    { code: "SA", name: "Spurs", fullName: "San Antonio Spurs", league: "NBA" },
    { code: "TOR", name: "Raptors", fullName: "Toronto Raptors", league: "NBA" },
    { code: "UTAH", name: "Jazz", fullName: "Utah Jazz", league: "NBA" },
    { code: "WSH", name: "Wizards", fullName: "Washington Wizards", league: "NBA" },
  ],
  WNBA: [
    { code: "ATL", name: "Dream", fullName: "Atlanta Dream", league: "WNBA" },
    { code: "CHI", name: "Sky", fullName: "Chicago Sky", league: "WNBA" },
    { code: "CON", name: "Sun", fullName: "Connecticut Sun", league: "WNBA" },
    { code: "DAL", name: "Wings", fullName: "Dallas Wings", league: "WNBA" },
    { code: "GS", name: "Valkyries", fullName: "Golden State Valkyries", league: "WNBA" },
    { code: "IND", name: "Fever", fullName: "Indiana Fever", league: "WNBA" },
    { code: "LV", name: "Aces", fullName: "Las Vegas Aces", league: "WNBA" },
    { code: "LA", name: "Sparks", fullName: "Los Angeles Sparks", league: "WNBA" },
    { code: "MIN", name: "Lynx", fullName: "Minnesota Lynx", league: "WNBA" },
    { code: "NY", name: "Liberty", fullName: "New York Liberty", league: "WNBA" },
    { code: "PHX", name: "Mercury", fullName: "Phoenix Mercury", league: "WNBA" },
    { code: "POR", name: "Fire", fullName: "Portland Fire", league: "WNBA" },
    { code: "SEA", name: "Storm", fullName: "Seattle Storm", league: "WNBA" },
    { code: "TOR", name: "Tempo", fullName: "Toronto Tempo", league: "WNBA" },
    { code: "WSH", name: "Mystics", fullName: "Washington Mystics", league: "WNBA" },
  ],
  NHL: [
    { code: "ANA", name: "Ducks", fullName: "Anaheim Ducks", league: "NHL" },
    { code: "BOS", name: "Bruins", fullName: "Boston Bruins", league: "NHL" },
    { code: "BUF", name: "Sabres", fullName: "Buffalo Sabres", league: "NHL" },
    { code: "CGY", name: "Flames", fullName: "Calgary Flames", league: "NHL" },
    { code: "CAR", name: "Hurricanes", fullName: "Carolina Hurricanes", league: "NHL" },
    { code: "CHI", name: "Blackhawks", fullName: "Chicago Blackhawks", league: "NHL" },
    { code: "COL", name: "Avalanche", fullName: "Colorado Avalanche", league: "NHL" },
    { code: "CBJ", name: "Blue Jackets", fullName: "Columbus Blue Jackets", league: "NHL" },
    { code: "DAL", name: "Stars", fullName: "Dallas Stars", league: "NHL" },
    { code: "DET", name: "Red Wings", fullName: "Detroit Red Wings", league: "NHL" },
    { code: "EDM", name: "Oilers", fullName: "Edmonton Oilers", league: "NHL" },
    { code: "FLA", name: "Panthers", fullName: "Florida Panthers", league: "NHL" },
    { code: "LA", name: "Kings", fullName: "Los Angeles Kings", league: "NHL" },
    { code: "MIN", name: "Wild", fullName: "Minnesota Wild", league: "NHL" },
    { code: "MTL", name: "Canadiens", fullName: "Montreal Canadiens", league: "NHL" },
    { code: "NSH", name: "Predators", fullName: "Nashville Predators", league: "NHL" },
    { code: "NJ", name: "Devils", fullName: "New Jersey Devils", league: "NHL" },
    { code: "NYI", name: "Islanders", fullName: "New York Islanders", league: "NHL" },
    { code: "NYR", name: "Rangers", fullName: "New York Rangers", league: "NHL" },
    { code: "OTT", name: "Senators", fullName: "Ottawa Senators", league: "NHL" },
    { code: "PHI", name: "Flyers", fullName: "Philadelphia Flyers", league: "NHL" },
    { code: "PIT", name: "Penguins", fullName: "Pittsburgh Penguins", league: "NHL" },
    { code: "SJ", name: "Sharks", fullName: "San Jose Sharks", league: "NHL" },
    { code: "SEA", name: "Kraken", fullName: "Seattle Kraken", league: "NHL" },
    { code: "STL", name: "Blues", fullName: "St. Louis Blues", league: "NHL" },
    { code: "TB", name: "Lightning", fullName: "Tampa Bay Lightning", league: "NHL" },
    { code: "TOR", name: "Maple Leafs", fullName: "Toronto Maple Leafs", league: "NHL" },
    { code: "UTAH", name: "Mammoth", fullName: "Utah Mammoth", league: "NHL" },
    { code: "VAN", name: "Canucks", fullName: "Vancouver Canucks", league: "NHL" },
    { code: "VGK", name: "Golden Knights", fullName: "Vegas Golden Knights", league: "NHL" },
    { code: "WSH", name: "Capitals", fullName: "Washington Capitals", league: "NHL" },
    { code: "WPG", name: "Jets", fullName: "Winnipeg Jets", league: "NHL" },
  ],
  COLLEGE: [
    // Major football/basketball programs + HBCUs. Codes are SCHOOL-SPORT.
    { code: "BAMA-FB", name: "Alabama FB", fullName: "Alabama Crimson Tide Football", league: "COLLEGE" },
    { code: "BAMA-BK", name: "Alabama BK", fullName: "Alabama Crimson Tide Basketball", league: "COLLEGE" },
    { code: "UGA-FB", name: "Georgia FB", fullName: "Georgia Bulldogs Football", league: "COLLEGE" },
    { code: "OSU-FB", name: "Ohio State FB", fullName: "Ohio State Buckeyes Football", league: "COLLEGE" },
    { code: "MICH-FB", name: "Michigan FB", fullName: "Michigan Wolverines Football", league: "COLLEGE" },
    { code: "TEX-FB", name: "Texas FB", fullName: "Texas Longhorns Football", league: "COLLEGE" },
    { code: "OU-FB", name: "Oklahoma FB", fullName: "Oklahoma Sooners Football", league: "COLLEGE" },
    { code: "ND-FB", name: "Notre Dame FB", fullName: "Notre Dame Fighting Irish Football", league: "COLLEGE" },
    { code: "USC-FB", name: "USC FB", fullName: "USC Trojans Football", league: "COLLEGE" },
    { code: "ORE-FB", name: "Oregon FB", fullName: "Oregon Ducks Football", league: "COLLEGE" },
    { code: "PSU-FB", name: "Penn State FB", fullName: "Penn State Nittany Lions Football", league: "COLLEGE" },
    { code: "LSU-FB", name: "LSU FB", fullName: "LSU Tigers Football", league: "COLLEGE" },
    { code: "UF-FB", name: "Florida FB", fullName: "Florida Gators Football", league: "COLLEGE" },
    { code: "FSU-FB", name: "Florida State FB", fullName: "Florida State Seminoles Football", league: "COLLEGE" },
    { code: "MIA-FB", name: "Miami FB", fullName: "Miami Hurricanes Football", league: "COLLEGE" },
    { code: "CLEM-FB", name: "Clemson FB", fullName: "Clemson Tigers Football", league: "COLLEGE" },
    { code: "TENN-FB", name: "Tennessee FB", fullName: "Tennessee Volunteers Football", league: "COLLEGE" },
    { code: "AUB-FB", name: "Auburn FB", fullName: "Auburn Tigers Football", league: "COLLEGE" },
    { code: "TAMU-FB", name: "Texas A&M FB", fullName: "Texas A&M Aggies Football", league: "COLLEGE" },
    { code: "DUKE-BK", name: "Duke BK", fullName: "Duke Blue Devils Basketball", league: "COLLEGE" },
    { code: "UNC-BK", name: "UNC BK", fullName: "North Carolina Tar Heels Basketball", league: "COLLEGE" },
    { code: "UK-BK", name: "Kentucky BK", fullName: "Kentucky Wildcats Basketball", league: "COLLEGE" },
    { code: "KU-BK", name: "Kansas BK", fullName: "Kansas Jayhawks Basketball", league: "COLLEGE" },
    { code: "UCLA-BK", name: "UCLA BK", fullName: "UCLA Bruins Basketball", league: "COLLEGE" },
    { code: "UCONN-BK", name: "UConn BK", fullName: "UConn Huskies Basketball", league: "COLLEGE" },
    { code: "GONZ-BK", name: "Gonzaga BK", fullName: "Gonzaga Bulldogs Basketball", league: "COLLEGE" },
    { code: "IU-BK", name: "Indiana BK", fullName: "Indiana Hoosiers Basketball", league: "COLLEGE" },
    { code: "MSU-BK", name: "Michigan State BK", fullName: "Michigan State Spartans Basketball", league: "COLLEGE" },
    { code: "PUR-BK", name: "Purdue BK", fullName: "Purdue Boilermakers Basketball", league: "COLLEGE" },
    // HBCUs
    { code: "FAMU-FB", name: "FAMU Football", fullName: "Florida A&M Rattlers Football", league: "COLLEGE" },
    { code: "FAMU-BB", name: "FAMU Baseball", fullName: "Florida A&M Rattlers Baseball", league: "COLLEGE" },
    { code: "FAMU-BK", name: "FAMU Basketball", fullName: "Florida A&M Rattlers Basketball", league: "COLLEGE" },
    { code: "JSU-FB", name: "Jackson State FB", fullName: "Jackson State Tigers Football", league: "COLLEGE" },
    { code: "HOW-FB", name: "Howard FB", fullName: "Howard Bison Football", league: "COLLEGE" },
    { code: "GRAM-FB", name: "Grambling FB", fullName: "Grambling State Tigers Football", league: "COLLEGE" },
    { code: "SOU-FB", name: "Southern FB", fullName: "Southern Jaguars Football", league: "COLLEGE" },
    { code: "NCAT-FB", name: "NC A&T FB", fullName: "North Carolina A&T Aggies Football", league: "COLLEGE" },
  ],
};

export type LeagueKey = keyof typeof AVAILABLE_SPORTS_TEAMS;
export type SportsTeamId = string; // "LEAGUE:CODE"

/**
 * Get team info by ID (format: "LEAGUE:CODE")
 */
export function getTeamInfo(teamId: string): SportTeam | null {
  const [league, code] = teamId.split(":");
  if (!league || !code) return null;

  const leagueTeams = AVAILABLE_SPORTS_TEAMS[league as LeagueKey];
  if (!leagueTeams) return null;

  return (leagueTeams.find((t) => t.code === code) ?? null) as SportTeam | null;
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

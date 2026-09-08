// Where to go when the practice on the plan is not enough.
//
// The exercises the model writes from a graded paper are ten minutes at the
// kitchen table. This is the other half: somewhere to send a child who needs
// more repetitions of the same skill, or who finished and wants more.
//
// Curated by hand and matched by keyword, deliberately. The obvious
// alternative was to ask the model for links alongside the exercises, and it
// was rejected: a hallucinated URL is a dead end for a six-year-old holding an
// iPad, and this list has to be trustworthy more than it has to be clever.
// Everything here is free to use without an account, works in a browser, and
// has been stable for years. Adding to it is the intended way to extend it.

export interface Resource {
  name: string;
  url: string;
  /** What a parent gets out of it, in one line. */
  note: string;
  /** Roughly what it is, for the badge. */
  kind: "practice" | "read" | "watch" | "print";
}

interface ResourceGroup {
  /** Lower-case keywords matched against skills, subjects, titles and patterns. */
  match: RegExp;
  /** Shown as the section's reason: "Because Jaxon is working on …". */
  label: string;
  items: Resource[];
}

/** Always offered, whatever this week happens to hold. */
export const STAPLES: Resource[] = [
  {
    name: "Khan Academy Kids",
    url: "https://learn.khanacademy.org/khan-academy-kids/",
    note: "Free, ad-free, and covers reading and math for this age in one app.",
    kind: "practice",
  },
  {
    name: "Starfall",
    url: "https://www.starfall.com/h/",
    note: "Phonics and early reading games. The first-grade sections are free.",
    kind: "practice",
  },
  {
    name: "Storyline Online",
    url: "https://storylineonline.net/",
    note: "Actors reading picture books aloud. Good for a read-aloud night off.",
    kind: "watch",
  },
];

const GROUPS: ResourceGroup[] = [
  {
    match: /spell|phonic|sight word|word list|vowel|blend|digraph|rhym|syllab/,
    label: "spelling and phonics",
    items: [
      {
        name: "Starfall — Learn to Read",
        url: "https://www.starfall.com/h/ltr-classic/",
        note: "Vowel patterns one at a time, in the order most first-grade lists follow.",
        kind: "practice",
      },
      {
        name: "FCRR Student Center Activities",
        url: "https://fcrr.org/student-center-activities",
        note: "Free printable phonics and word-work games from Florida State. Print the K–1 set once and reuse it all year.",
        kind: "print",
      },
      {
        name: "ABCya — First Grade",
        url: "https://www.abcya.com/grades/grade1",
        note: "Spelling and word games sorted by grade. Ten minutes is plenty.",
        kind: "practice",
      },
    ],
  },
  {
    match: /read|comprehen|fluen|story|book|literac/,
    label: "reading",
    items: [
      {
        name: "ReadWorks",
        url: "https://www.readworks.org/",
        note: "Short passages with questions, by reading level. Free with a parent account.",
        kind: "read",
      },
      {
        name: "Unite for Literacy",
        url: "https://www.uniteforliteracy.com/",
        note: "Simple picture books that read themselves aloud. Good for building confidence.",
        kind: "read",
      },
      {
        name: "PBS Kids — Reading games",
        url: "https://pbskids.org/games/reading/",
        note: "Reading games attached to shows a six-year-old already knows.",
        kind: "practice",
      },
    ],
  },
  {
    match: /math|number|add|subtract|count|place value|fact|money|time|measure|shape|geometr/,
    label: "math",
    items: [
      {
        name: "Khan Academy — 1st grade math",
        url: "https://www.khanacademy.org/math/cc-1st-grade-math",
        note: "The whole year, in order, with a short video before each set.",
        kind: "practice",
      },
      {
        name: "Math Learning Center apps",
        url: "https://www.mathlearningcenter.org/apps",
        note: "Free number racks, number lines and base-ten blocks in the browser. Use them while you explain.",
        kind: "practice",
      },
      {
        name: "Greg Tang Math",
        url: "https://gregtangmath.com/games",
        note: "Fact-fluency games that stay interesting past the third night.",
        kind: "practice",
      },
    ],
  },
  {
    match: /hand ?writ|penman|letter form|cursive|fine motor/,
    label: "handwriting",
    items: [
      {
        name: "Handwriting Worksheets",
        url: "https://www.handwritingworksheets.com/",
        note: "Type this week's words and print them as tracing practice.",
        kind: "print",
      },
    ],
  },
  {
    match: /scriptur|verse|bible|memor|recit|catechism/,
    label: "scripture and memory work",
    items: [
      {
        name: "Bible Gateway",
        url: "https://www.biblegateway.com/",
        note: "Look the verse up in the translation the school uses, and hear it read aloud.",
        kind: "read",
      },
      {
        name: "Bible reading in this app",
        url: "/bible",
        note: "The family's own reading plans, highlights and hands-free audio.",
        kind: "read",
      },
    ],
  },
  {
    match: /scien|nature|animal|plant|weather|space|season/,
    label: "science",
    items: [
      {
        name: "Mystery Science — Mini Lessons",
        url: "https://mysteryscience.com/mini-lessons",
        note: "Five-minute answers to the questions children actually ask.",
        kind: "watch",
      },
      {
        name: "PBS Kids — Science games",
        url: "https://pbskids.org/games/science/",
        note: "Science games at the right age, free and without accounts.",
        kind: "practice",
      },
    ],
  },
  {
    match: /histor|social studies|geograph|communit|citizen/,
    label: "history and social studies",
    items: [
      {
        name: "National Geographic Kids",
        url: "https://kids.nationalgeographic.com/",
        note: "Places and people, written to be read by a child rather than to a child.",
        kind: "read",
      },
    ],
  },
];

export interface ResourceSection {
  label: string;
  items: Resource[];
}

/**
 * The groups worth showing, given what the child is actually working on.
 *
 * `signals` is everything we know about this week in free text — exercise
 * skills and titles, subjects off the graded papers, the spelling pattern.
 * Order follows GROUPS rather than the signals, so the same week does not
 * reshuffle the list between visits.
 */
export function resourcesFor(signals: (string | null | undefined)[]): ResourceSection[] {
  const hay = signals.filter(Boolean).join(" ").toLowerCase();
  if (!hay.trim()) return [];
  return GROUPS.filter((g) => g.match.test(hay)).map((g) => ({ label: g.label, items: g.items }));
}

export const KIND_LABEL: Record<Resource["kind"], string> = {
  practice: "Practice",
  read: "Read",
  watch: "Watch",
  print: "Print",
};

export interface SetLog {
  reps: number;
  weight: number;
  rpe: number;
}

export interface LastSession {
  date: string;
  sets: SetLog[];
}

export interface Exercise {
  name: string;
  target: { sets: number; reps: number; weight: number };
  lastSession: LastSession;
  restSec: number;
  cues: string[];
  muscles: string[];
}

export interface ExerciseTemplate {
  name: string;
  muscles: string[];        // primary muscles
  secondary?: string[];     // secondary muscles
  equipment: string;        // barbell | dumbbell | cable | machine | bodyweight | kettlebell
  category: string;         // squat | hinge | push | pull | core | carry | isolation
  defaultSets: number;
  defaultReps: number;
  defaultWeightLbs: number;
  restSec: number;
  cues: string[];
}

export interface ProgressionSuggestion {
  reps: number;
  weight: number;
  hint: string | null;
}

// ── Comprehensive exercise database ──────────────────────────────────────────
// 120+ exercises covering all major movement patterns and muscle groups.

export const EXERCISE_TEMPLATES: ExerciseTemplate[] = [
  // ── SQUAT PATTERN ─────────────────────────────────────────────────────────
  { name: "Back Squat",             muscles: ["Quads","Glutes"],          secondary: ["Hamstrings","Core","Calves"],  equipment: "barbell",    category: "squat",    defaultSets: 4, defaultReps: 5,  defaultWeightLbs: 185, restSec: 180, cues: ["Brace core before unrack","Knees track over toes","Drive through heels","Chest up"] },
  { name: "Front Squat",            muscles: ["Quads"],                   secondary: ["Glutes","Core","Upper back"],  equipment: "barbell",    category: "squat",    defaultSets: 4, defaultReps: 5,  defaultWeightLbs: 135, restSec: 180, cues: ["Elbows high","Upright torso","Knees out"] },
  { name: "Goblet Squat",           muscles: ["Quads","Glutes"],          secondary: ["Core"],                        equipment: "kettlebell", category: "squat",    defaultSets: 3, defaultReps: 12, defaultWeightLbs: 50,  restSec: 90,  cues: ["Heels shoulder width","Keep chest up","Drop between heels"] },
  { name: "Bulgarian Split Squat",  muscles: ["Quads","Glutes"],          secondary: ["Hamstrings","Calves"],         equipment: "dumbbell",   category: "squat",    defaultSets: 3, defaultReps: 10, defaultWeightLbs: 35,  restSec: 90,  cues: ["Rear foot elevated","Front shin vertical","Drive through front heel"] },
  { name: "Walking Lunges",         muscles: ["Quads","Glutes"],          secondary: ["Hamstrings","Balance"],        equipment: "dumbbell",   category: "squat",    defaultSets: 3, defaultReps: 10, defaultWeightLbs: 35,  restSec: 120, cues: ["Step long","Knee 90°","Torso upright","Drive off front heel"] },
  { name: "Reverse Lunge",          muscles: ["Quads","Glutes"],          secondary: ["Hamstrings"],                  equipment: "dumbbell",   category: "squat",    defaultSets: 3, defaultReps: 10, defaultWeightLbs: 30,  restSec: 90,  cues: ["Step back controlled","Front knee tracks toe","Push through front heel"] },
  { name: "Leg Press",              muscles: ["Quads","Glutes"],          secondary: ["Hamstrings"],                  equipment: "machine",    category: "squat",    defaultSets: 4, defaultReps: 10, defaultWeightLbs: 220, restSec: 120, cues: ["Feet shoulder width","Don't lock knees fully","Push through heels"] },
  { name: "Hack Squat",             muscles: ["Quads"],                   secondary: ["Glutes"],                      equipment: "machine",    category: "squat",    defaultSets: 4, defaultReps: 8,  defaultWeightLbs: 180, restSec: 120, cues: ["Feet high on plate for glutes","Knees track toes"] },
  { name: "Sissy Squat",            muscles: ["Quads"],                   secondary: ["Hip flexors"],                 equipment: "bodyweight", category: "squat",    defaultSets: 3, defaultReps: 12, defaultWeightLbs: 0,   restSec: 90,  cues: ["Lean back as you descend","Knees forward","Stay on toes"] },

  // ── HINGE PATTERN ─────────────────────────────────────────────────────────
  { name: "Romanian Deadlift",      muscles: ["Hamstrings","Glutes"],     secondary: ["Lower back","Calves"],         equipment: "barbell",    category: "hinge",    defaultSets: 4, defaultReps: 8,  defaultWeightLbs: 165, restSec: 150, cues: ["Hinge at hips","Bar stays close","Feel hamstring stretch","Neutral spine"] },
  { name: "Conventional Deadlift",  muscles: ["Hamstrings","Glutes","Lower back"], secondary: ["Quads","Traps","Lats"], equipment: "barbell", category: "hinge",    defaultSets: 4, defaultReps: 5,  defaultWeightLbs: 225, restSec: 180, cues: ["Push floor away","Bar over mid-foot","Chest up","Drive hips through"] },
  { name: "Sumo Deadlift",          muscles: ["Glutes","Adductors","Hamstrings"], secondary: ["Quads","Lower back"], equipment: "barbell",    category: "hinge",    defaultSets: 4, defaultReps: 5,  defaultWeightLbs: 245, restSec: 180, cues: ["Wide stance","Toes flared","Hips to bar","Drive knees out"] },
  { name: "Trap Bar Deadlift",      muscles: ["Quads","Glutes","Hamstrings"], secondary: ["Lower back","Traps"],   equipment: "barbell",    category: "hinge",    defaultSets: 4, defaultReps: 6,  defaultWeightLbs: 245, restSec: 180, cues: ["Stand centered","Push through floor","Neutral spine","Squeeze glutes at top"] },
  { name: "Kettlebell Swing",       muscles: ["Glutes","Hamstrings"],     secondary: ["Core","Shoulders"],            equipment: "kettlebell", category: "hinge",    defaultSets: 4, defaultReps: 15, defaultWeightLbs: 53,  restSec: 90,  cues: ["Hip hinge not squat","Explode hips forward","Lat engagement","Float at top"] },
  { name: "Good Morning",           muscles: ["Hamstrings","Lower back"], secondary: ["Glutes","Core"],               equipment: "barbell",    category: "hinge",    defaultSets: 3, defaultReps: 10, defaultWeightLbs: 95,  restSec: 120, cues: ["Slight knee bend","Hinge until parallel","Neutral spine","Squeeze at top"] },
  { name: "Hip Thrust",             muscles: ["Glutes"],                  secondary: ["Hamstrings","Core"],           equipment: "barbell",    category: "hinge",    defaultSets: 4, defaultReps: 10, defaultWeightLbs: 185, restSec: 120, cues: ["Shoulders on bench","Drive hips up","Squeeze at top","Chin tucked"] },
  { name: "Glute Bridge",           muscles: ["Glutes"],                  secondary: ["Hamstrings","Core"],           equipment: "bodyweight", category: "hinge",    defaultSets: 3, defaultReps: 15, defaultWeightLbs: 0,   restSec: 60,  cues: ["Feet flat","Drive hips up","Squeeze at top","Hold 1 sec"] },
  { name: "Nordic Curl",            muscles: ["Hamstrings"],              secondary: ["Calves"],                      equipment: "bodyweight", category: "hinge",    defaultSets: 3, defaultReps: 5,  defaultWeightLbs: 0,   restSec: 120, cues: ["Slow eccentric","Arms catch fall","Pull back with hamstrings"] },

  // ── PUSH — HORIZONTAL ─────────────────────────────────────────────────────
  { name: "Bench Press",            muscles: ["Chest"],                   secondary: ["Triceps","Shoulders"],         equipment: "barbell",    category: "push",     defaultSets: 4, defaultReps: 6,  defaultWeightLbs: 185, restSec: 180, cues: ["Retract scapula","Slight arch","Bar over lower chest","Drive through elbows"] },
  { name: "Incline Bench Press",    muscles: ["Upper chest"],             secondary: ["Triceps","Front delts"],       equipment: "barbell",    category: "push",     defaultSets: 4, defaultReps: 8,  defaultWeightLbs: 155, restSec: 150, cues: ["30-45° incline","Control descent","Elbows slightly in"] },
  { name: "Dumbbell Bench Press",   muscles: ["Chest"],                   secondary: ["Triceps","Shoulders"],         equipment: "dumbbell",   category: "push",     defaultSets: 4, defaultReps: 10, defaultWeightLbs: 65,  restSec: 120, cues: ["Full range of motion","Control the negative","Palms facing feet"] },
  { name: "Push-Up",                muscles: ["Chest"],                   secondary: ["Triceps","Shoulders","Core"],  equipment: "bodyweight", category: "push",     defaultSets: 3, defaultReps: 15, defaultWeightLbs: 0,   restSec: 60,  cues: ["Straight line from head to heel","Elbows 45°","Full range"] },
  { name: "Chest Fly (Dumbbell)",   muscles: ["Chest"],                   secondary: ["Shoulders"],                   equipment: "dumbbell",   category: "push",     defaultSets: 3, defaultReps: 12, defaultWeightLbs: 30,  restSec: 90,  cues: ["Slight bend in elbows","Squeeze chest at top","Slow stretch down"] },
  { name: "Cable Fly",              muscles: ["Chest"],                   secondary: ["Shoulders"],                   equipment: "cable",      category: "push",     defaultSets: 3, defaultReps: 15, defaultWeightLbs: 25,  restSec: 60,  cues: ["Constant tension","Arms slightly bent","Hands meet at center"] },
  { name: "Dips (Chest)",           muscles: ["Chest","Triceps"],         secondary: ["Shoulders"],                   equipment: "bodyweight", category: "push",     defaultSets: 3, defaultReps: 10, defaultWeightLbs: 0,   restSec: 90,  cues: ["Lean forward","Wide grip","Lower until stretch","Full extension"] },

  // ── PUSH — VERTICAL ───────────────────────────────────────────────────────
  { name: "Overhead Press",         muscles: ["Shoulders"],               secondary: ["Triceps","Core","Traps"],      equipment: "barbell",    category: "push",     defaultSets: 4, defaultReps: 6,  defaultWeightLbs: 115, restSec: 180, cues: ["Bar from rack","Brace abs","Press overhead","Shrug at top"] },
  { name: "Dumbbell Shoulder Press",muscles: ["Shoulders"],               secondary: ["Triceps"],                     equipment: "dumbbell",   category: "push",     defaultSets: 4, defaultReps: 10, defaultWeightLbs: 45,  restSec: 120, cues: ["Neutral grip or pronated","Control descent","Press to lockout"] },
  { name: "Arnold Press",           muscles: ["Shoulders"],               secondary: ["Triceps"],                     equipment: "dumbbell",   category: "push",     defaultSets: 3, defaultReps: 12, defaultWeightLbs: 35,  restSec: 90,  cues: ["Rotate from palm-in to palm-out","Full rotation","Control descent"] },
  { name: "Lateral Raise",          muscles: ["Side delts"],              secondary: [],                              equipment: "dumbbell",   category: "isolation",defaultSets: 4, defaultReps: 15, defaultWeightLbs: 15,  restSec: 60,  cues: ["Slight forward lean","Lead with elbows","Stop at shoulder height","Control down"] },
  { name: "Front Raise",            muscles: ["Front delts"],             secondary: ["Chest"],                       equipment: "dumbbell",   category: "isolation",defaultSets: 3, defaultReps: 12, defaultWeightLbs: 15,  restSec: 60,  cues: ["Avoid momentum","Raise to eye level","Slow negative"] },
  { name: "Face Pull",              muscles: ["Rear delts","Rotator cuff"],secondary: ["Traps"],                     equipment: "cable",      category: "pull",     defaultSets: 4, defaultReps: 15, defaultWeightLbs: 40,  restSec: 60,  cues: ["Pull to face","External rotate at end","Elbows high"] },

  // ── PULL — HORIZONTAL ─────────────────────────────────────────────────────
  { name: "Barbell Row",            muscles: ["Lats","Rhomboids"],        secondary: ["Biceps","Rear delts","Traps"],  equipment: "barbell",   category: "pull",     defaultSets: 4, defaultReps: 8,  defaultWeightLbs: 155, restSec: 150, cues: ["45° torso","Pull to lower chest","Squeeze shoulder blades","Controlled descent"] },
  { name: "Dumbbell Row",           muscles: ["Lats"],                    secondary: ["Biceps","Rear delts"],          equipment: "dumbbell",  category: "pull",     defaultSets: 4, defaultReps: 10, defaultWeightLbs: 65,  restSec: 90,  cues: ["Row to hip","Elbow past torso","Squeeze at top"] },
  { name: "Seated Cable Row",       muscles: ["Lats","Rhomboids"],        secondary: ["Biceps","Rear delts"],          equipment: "cable",     category: "pull",     defaultSets: 4, defaultReps: 12, defaultWeightLbs: 120, restSec: 90,  cues: ["Upright torso","Row to belly button","Hold squeeze","Slow out"] },
  { name: "Machine Row",            muscles: ["Lats","Rhomboids"],        secondary: ["Biceps"],                       equipment: "machine",   category: "pull",     defaultSets: 3, defaultReps: 12, defaultWeightLbs: 120, restSec: 90,  cues: ["Chest pad contact","Row to body","Squeeze shoulder blades"] },
  { name: "T-Bar Row",              muscles: ["Lats","Rhomboids","Traps"],secondary: ["Biceps"],                       equipment: "barbell",   category: "pull",     defaultSets: 4, defaultReps: 8,  defaultWeightLbs: 135, restSec: 120, cues: ["Brace core","Pull chest to bar","Squeeze at top"] },
  { name: "Chest-Supported Row",    muscles: ["Lats","Rhomboids"],        secondary: ["Biceps","Rear delts"],          equipment: "dumbbell",  category: "pull",     defaultSets: 3, defaultReps: 12, defaultWeightLbs: 45,  restSec: 90,  cues: ["Chest on pad","No body english","Row to hips"] },

  // ── PULL — VERTICAL ───────────────────────────────────────────────────────
  { name: "Pull-Up",                muscles: ["Lats","Biceps"],           secondary: ["Rhomboids","Rear delts","Core"],equipment: "bodyweight",category: "pull",     defaultSets: 4, defaultReps: 8,  defaultWeightLbs: 0,   restSec: 120, cues: ["Dead hang start","Drive elbows down","Chest to bar","Full extension"] },
  { name: "Chin-Up",                muscles: ["Lats","Biceps"],           secondary: ["Rhomboids"],                    equipment: "bodyweight",category: "pull",     defaultSets: 4, defaultReps: 8,  defaultWeightLbs: 0,   restSec: 120, cues: ["Supinated grip","Drive elbows back","Chin clears bar"] },
  { name: "Lat Pulldown",           muscles: ["Lats"],                    secondary: ["Biceps","Rear delts"],          equipment: "cable",     category: "pull",     defaultSets: 4, defaultReps: 12, defaultWeightLbs: 130, restSec: 90,  cues: ["Slight lean back","Pull to upper chest","Squeeze lats","Slow return"] },
  { name: "Straight-Arm Pulldown",  muscles: ["Lats"],                    secondary: ["Core"],                         equipment: "cable",     category: "isolation",defaultSets: 3, defaultReps: 15, defaultWeightLbs: 40,  restSec: 60,  cues: ["Arms straight","Hinge at shoulder","Pull to hips"] },

  // ── BICEPS ────────────────────────────────────────────────────────────────
  { name: "Barbell Curl",           muscles: ["Biceps"],                  secondary: ["Forearms"],                    equipment: "barbell",    category: "isolation",defaultSets: 3, defaultReps: 10, defaultWeightLbs: 65,  restSec: 90,  cues: ["No swinging","Elbows at sides","Squeeze at top","Slow negative"] },
  { name: "Dumbbell Curl",          muscles: ["Biceps"],                  secondary: ["Forearms"],                    equipment: "dumbbell",   category: "isolation",defaultSets: 3, defaultReps: 12, defaultWeightLbs: 30,  restSec: 60,  cues: ["Alternate or together","Supinate at top","Full range"] },
  { name: "Hammer Curl",            muscles: ["Biceps","Brachialis"],     secondary: ["Forearms"],                    equipment: "dumbbell",   category: "isolation",defaultSets: 3, defaultReps: 12, defaultWeightLbs: 30,  restSec: 60,  cues: ["Neutral grip throughout","No swinging","Slow eccentric"] },
  { name: "Incline Curl",           muscles: ["Biceps"],                  secondary: [],                              equipment: "dumbbell",   category: "isolation",defaultSets: 3, defaultReps: 12, defaultWeightLbs: 25,  restSec: 60,  cues: ["Bench at 45°","Arms hang fully","No cheating"] },
  { name: "Cable Curl",             muscles: ["Biceps"],                  secondary: ["Forearms"],                    equipment: "cable",      category: "isolation",defaultSets: 3, defaultReps: 15, defaultWeightLbs: 50,  restSec: 60,  cues: ["Constant tension","Elbows stationary","Squeeze at top"] },
  { name: "Preacher Curl",          muscles: ["Biceps"],                  secondary: [],                              equipment: "barbell",    category: "isolation",defaultSets: 3, defaultReps: 10, defaultWeightLbs: 55,  restSec: 90,  cues: ["Pad supports upper arm","Full stretch at bottom","Slow negative"] },

  // ── TRICEPS ───────────────────────────────────────────────────────────────
  { name: "Tricep Pushdown",        muscles: ["Triceps"],                 secondary: [],                              equipment: "cable",      category: "isolation",defaultSets: 3, defaultReps: 15, defaultWeightLbs: 60,  restSec: 60,  cues: ["Elbows at sides","Full extension","Control return","Squeeze at bottom"] },
  { name: "Skull Crusher",          muscles: ["Triceps"],                 secondary: [],                              equipment: "barbell",    category: "isolation",defaultSets: 3, defaultReps: 10, defaultWeightLbs: 75,  restSec: 90,  cues: ["Elbows in","Lower to forehead","Extend fully at top"] },
  { name: "Overhead Tricep Extension",muscles: ["Triceps"],              secondary: [],                              equipment: "dumbbell",   category: "isolation",defaultSets: 3, defaultReps: 12, defaultWeightLbs: 50,  restSec: 90,  cues: ["Keep elbows close","Full stretch overhead","Extend to lockout"] },
  { name: "Close-Grip Bench Press", muscles: ["Triceps"],                 secondary: ["Chest","Shoulders"],           equipment: "barbell",    category: "push",     defaultSets: 3, defaultReps: 10, defaultWeightLbs: 145, restSec: 120, cues: ["Shoulder-width grip","Elbows tucked","Full range"] },
  { name: "Tricep Dips",            muscles: ["Triceps"],                 secondary: ["Chest","Shoulders"],           equipment: "bodyweight", category: "push",     defaultSets: 3, defaultReps: 12, defaultWeightLbs: 0,   restSec: 90,  cues: ["Upright torso","Elbows behind","Full dip"] },

  // ── BACK DETAIL ───────────────────────────────────────────────────────────
  { name: "Shrug",                  muscles: ["Traps"],                   secondary: [],                              equipment: "barbell",    category: "isolation",defaultSets: 3, defaultReps: 15, defaultWeightLbs: 175, restSec: 60,  cues: ["Straight arms","Shrug up not forward","Hold at top"] },
  { name: "Rack Pull",              muscles: ["Traps","Lower back"],      secondary: ["Glutes","Hamstrings"],         equipment: "barbell",    category: "hinge",    defaultSets: 4, defaultReps: 5,  defaultWeightLbs: 315, restSec: 180, cues: ["Bar above knees","Drive hips through","Squeeze traps at top"] },
  { name: "Reverse Fly (Dumbbell)", muscles: ["Rear delts","Rhomboids"], secondary: ["Traps"],                       equipment: "dumbbell",   category: "isolation",defaultSets: 3, defaultReps: 15, defaultWeightLbs: 20,  restSec: 60,  cues: ["Hinged torso","Lead with elbows","Squeeze at top"] },
  { name: "Band Pull-Apart",        muscles: ["Rear delts","Rhomboids"], secondary: ["External rotators"],           equipment: "bodyweight", category: "isolation",defaultSets: 3, defaultReps: 20, defaultWeightLbs: 0,   restSec: 60,  cues: ["Arms straight","Squeeze shoulder blades","Controlled"] },

  // ── LEGS — ISOLATION ──────────────────────────────────────────────────────
  { name: "Leg Extension",          muscles: ["Quads"],                   secondary: [],                              equipment: "machine",    category: "isolation",defaultSets: 3, defaultReps: 15, defaultWeightLbs: 110, restSec: 60,  cues: ["Full extension","Pause at top","Control descent"] },
  { name: "Leg Curl (Lying)",       muscles: ["Hamstrings"],              secondary: ["Calves"],                      equipment: "machine",    category: "isolation",defaultSets: 3, defaultReps: 12, defaultWeightLbs: 80,  restSec: 60,  cues: ["Curl all the way","Pause at top","Lower slowly"] },
  { name: "Leg Curl (Seated)",      muscles: ["Hamstrings"],              secondary: [],                              equipment: "machine",    category: "isolation",defaultSets: 3, defaultReps: 12, defaultWeightLbs: 90,  restSec: 60,  cues: ["Full curl","Slow eccentric","Constant tension"] },
  { name: "Calf Raise (Standing)",  muscles: ["Calves"],                  secondary: [],                              equipment: "machine",    category: "isolation",defaultSets: 4, defaultReps: 15, defaultWeightLbs: 90,  restSec: 60,  cues: ["Full range of motion","Pause at top","Slow eccentric"] },
  { name: "Calf Raise (Seated)",    muscles: ["Calves (Soleus)"],         secondary: [],                              equipment: "machine",    category: "isolation",defaultSets: 3, defaultReps: 15, defaultWeightLbs: 70,  restSec: 60,  cues: ["Knee at 90°","Full range","Slow and controlled"] },
  { name: "Hip Abduction",          muscles: ["Glutes (Abductors)"],      secondary: [],                              equipment: "machine",    category: "isolation",defaultSets: 3, defaultReps: 20, defaultWeightLbs: 90,  restSec: 60,  cues: ["Full range","Squeeze at top","No momentum"] },
  { name: "Hip Adduction",          muscles: ["Adductors"],               secondary: [],                              equipment: "machine",    category: "isolation",defaultSets: 3, defaultReps: 15, defaultWeightLbs: 90,  restSec: 60,  cues: ["Control both directions","Full range"] },

  // ── CORE ──────────────────────────────────────────────────────────────────
  { name: "Plank",                  muscles: ["Core"],                    secondary: ["Shoulders","Glutes"],          equipment: "bodyweight", category: "core",     defaultSets: 3, defaultReps: 1,  defaultWeightLbs: 0,   restSec: 60,  cues: ["Straight line","Squeeze glutes","Breathe steadily","30-60 sec"] },
  { name: "Dead Bug",               muscles: ["Core"],                    secondary: ["Hip flexors"],                 equipment: "bodyweight", category: "core",     defaultSets: 3, defaultReps: 10, defaultWeightLbs: 0,   restSec: 60,  cues: ["Lower back pressed to floor","Opposite arm/leg","Control breathing"] },
  { name: "Hollow Body Hold",       muscles: ["Core"],                    secondary: ["Hip flexors"],                 equipment: "bodyweight", category: "core",     defaultSets: 3, defaultReps: 1,  defaultWeightLbs: 0,   restSec: 60,  cues: ["Lower back contact with floor","Arms and legs low","30 sec hold"] },
  { name: "Ab Wheel Rollout",       muscles: ["Core"],                    secondary: ["Lats","Shoulders"],            equipment: "bodyweight", category: "core",     defaultSets: 3, defaultReps: 8,  defaultWeightLbs: 0,   restSec: 90,  cues: ["Neutral spine","Core braced throughout","Don't let hips drop"] },
  { name: "Hanging Leg Raise",      muscles: ["Abs","Hip flexors"],       secondary: ["Forearms"],                    equipment: "bodyweight", category: "core",     defaultSets: 3, defaultReps: 12, defaultWeightLbs: 0,   restSec: 90,  cues: ["No swinging","Control descent","Tuck chin"] },
  { name: "Cable Crunch",           muscles: ["Abs"],                     secondary: [],                              equipment: "cable",      category: "core",     defaultSets: 3, defaultReps: 15, defaultWeightLbs: 70,  restSec: 60,  cues: ["Elbows to thighs","Round lower back","Squeeze abs at bottom"] },
  { name: "Russian Twist",          muscles: ["Obliques"],                secondary: ["Core"],                        equipment: "dumbbell",   category: "core",     defaultSets: 3, defaultReps: 20, defaultWeightLbs: 25,  restSec: 60,  cues: ["Feet lifted","Rotate from core not arms","Keep chest up"] },
  { name: "Side Plank",             muscles: ["Obliques"],                secondary: ["Glutes","Core"],               equipment: "bodyweight", category: "core",     defaultSets: 3, defaultReps: 1,  defaultWeightLbs: 0,   restSec: 60,  cues: ["Stack feet or stagger","Hips up","30 sec each side"] },
  { name: "Pallof Press",           muscles: ["Core"],                    secondary: ["Obliques"],                    equipment: "cable",      category: "core",     defaultSets: 3, defaultReps: 12, defaultWeightLbs: 30,  restSec: 60,  cues: ["Resist rotation","Brace entire core","Slow extension"] },
  { name: "Landmine Rotation",      muscles: ["Obliques","Core"],         secondary: ["Shoulders"],                   equipment: "barbell",    category: "core",     defaultSets: 3, defaultReps: 10, defaultWeightLbs: 25,  restSec: 60,  cues: ["Arms straight","Rotate from hips","Control return"] },

  // ── FULL BODY / COMPOUND ──────────────────────────────────────────────────
  { name: "Power Clean",            muscles: ["Quads","Glutes","Traps"],  secondary: ["Hamstrings","Core","Shoulders"],equipment: "barbell",   category: "squat",    defaultSets: 5, defaultReps: 3,  defaultWeightLbs: 135, restSec: 180, cues: ["Bar over mid-foot","Extend hips explosively","High elbows","Rack position"] },
  { name: "Thruster",               muscles: ["Quads","Glutes","Shoulders"],secondary: ["Core","Triceps"],             equipment: "barbell",   category: "push",     defaultSets: 4, defaultReps: 8,  defaultWeightLbs: 95,  restSec: 120, cues: ["Front squat to push press","Drive through heels","Press overhead at top"] },
  { name: "Farmer's Carry",         muscles: ["Forearms","Traps","Core"], secondary: ["Quads","Calves"],              equipment: "dumbbell",   category: "carry",    defaultSets: 3, defaultReps: 1,  defaultWeightLbs: 65,  restSec: 90,  cues: ["Walk 40 yards","Tall posture","Shoulders back","Arms straight"] },
  { name: "Renegade Row",           muscles: ["Lats","Core"],             secondary: ["Biceps","Shoulders"],          equipment: "dumbbell",   category: "pull",     defaultSets: 3, defaultReps: 8,  defaultWeightLbs: 35,  restSec: 90,  cues: ["Plank position","Row one arm","No hip rotation","Switch sides"] },
  { name: "Turkish Get-Up",         muscles: ["Core","Shoulders","Glutes"],secondary: ["Triceps","Lats"],            equipment: "kettlebell", category: "core",     defaultSets: 3, defaultReps: 3,  defaultWeightLbs: 35,  restSec: 120, cues: ["Eye on bell","Slow deliberate movement","3 per side"] },
  { name: "Clean and Press",        muscles: ["Full body"],               secondary: [],                              equipment: "barbell",    category: "push",     defaultSets: 4, defaultReps: 5,  defaultWeightLbs: 115, restSec: 180, cues: ["Clean to rack","Pause","Press overhead","Control descent"] },
  { name: "Suitcase Carry",         muscles: ["Core","Obliques"],         secondary: ["Traps","Forearms"],            equipment: "dumbbell",   category: "carry",    defaultSets: 3, defaultReps: 1,  defaultWeightLbs: 65,  restSec: 60,  cues: ["Walk 30 yards","Resist lateral tilt","Tall posture"] },
];

// Build lookup by name for the live tracker
export function getTemplateByName(name: string): ExerciseTemplate | undefined {
  return EXERCISE_TEMPLATES.find((e) => e.name.toLowerCase() === name.toLowerCase());
}

// Build a WorkoutTracker-compatible Exercise from a template (no prior session data)
export function templateToExercise(t: ExerciseTemplate): Exercise {
  const defaultSets = Array.from({ length: t.defaultSets }, () => ({
    reps: t.defaultReps,
    weight: t.defaultWeightLbs,
    rpe: 7,
  }));
  return {
    name: t.name,
    target: { sets: t.defaultSets, reps: t.defaultReps, weight: t.defaultWeightLbs },
    lastSession: { date: "", sets: defaultSets },
    restSec: t.restSec,
    cues: t.cues,
    muscles: t.muscles,
  };
}

// Legacy 4-exercise library (kept for backward compat with existing encoded plans)
export const EXERCISE_LIBRARY: Exercise[] = [
  {
    name: "Back Squat",
    target: { sets: 4, reps: 6, weight: 185 },
    lastSession: { date: "Apr 18", sets: [{ reps: 6, weight: 175, rpe: 7 },{ reps: 6, weight: 175, rpe: 7 },{ reps: 6, weight: 180, rpe: 8 },{ reps: 5, weight: 180, rpe: 9 }] },
    restSec: 180,
    cues: ["Brace core before unrack","Knees track over toes","Drive through heels"],
    muscles: ["Quads","Glutes","Hamstrings","Core"],
  },
  {
    name: "Romanian Deadlift",
    target: { sets: 4, reps: 8, weight: 165 },
    lastSession: { date: "Apr 18", sets: [{ reps: 8, weight: 155, rpe: 7 },{ reps: 8, weight: 160, rpe: 8 },{ reps: 8, weight: 160, rpe: 8 },{ reps: 7, weight: 165, rpe: 9 }] },
    restSec: 150,
    cues: ["Hinge at hips","Bar stays close to legs","Feel hamstring stretch"],
    muscles: ["Hamstrings","Glutes","Lower back"],
  },
  {
    name: "Walking Lunges",
    target: { sets: 3, reps: 10, weight: 35 },
    lastSession: { date: "Apr 18", sets: [{ reps: 10, weight: 30, rpe: 7 },{ reps: 10, weight: 30, rpe: 7 },{ reps: 10, weight: 35, rpe: 8 }] },
    restSec: 120,
    cues: ["Step long, knee 90°","Torso upright","Drive off front heel"],
    muscles: ["Quads","Glutes"],
  },
  {
    name: "Calf Raises",
    target: { sets: 3, reps: 15, weight: 90 },
    lastSession: { date: "Apr 18", sets: [{ reps: 15, weight: 85, rpe: 7 },{ reps: 15, weight: 85, rpe: 8 },{ reps: 15, weight: 90, rpe: 8 }] },
    restSec: 90,
    cues: ["Full range of motion","Pause at top","Slow eccentric"],
    muscles: ["Calves"],
  },
];

export function suggestNext(
  lastSession: LastSession,
  target: { sets: number; reps: number; weight: number }
): ProgressionSuggestion {
  const last = lastSession.sets;
  const allHitTarget = last.every((s) => s.reps >= target.reps && s.rpe <= 8);
  if (allHitTarget) {
    return { reps: target.reps, weight: last[last.length - 1].weight + 5, hint: "↑ All sets crushed at RPE ≤8 — bump weight 5 lbs" };
  }
  const someHigh = last.some((s) => s.rpe >= 9);
  if (someHigh) {
    return { reps: target.reps, weight: last[last.length - 1].weight, hint: "→ Hold weight — last session hit RPE 9" };
  }
  return { reps: target.reps, weight: last[last.length - 1].weight + 2.5, hint: "↑ Small bump — moderate effort last time" };
}

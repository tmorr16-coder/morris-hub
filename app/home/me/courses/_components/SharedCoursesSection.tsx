"use client";

import { Group, Cell, IconBadge, Chip, Icons } from "@/components/ios";

interface SharedCourse {
  shareId: string;
  courseId: string;
  shareGrades: boolean;
  shareAssignments: boolean;
  course: {
    id: string;
    name: string;
    instructor: string | null;
    semester: string | null;
    color_tag: string;
  } | null;
  ownerName: string;
}

export default function SharedCoursesSection({
  sharedCourses,
}: {
  sharedCourses: SharedCourse[];
}) {
  const valid = sharedCourses.filter((s) => s.course !== null);
  if (valid.length === 0) return null;

  return (
    <section>
      <div style={{ padding: "0 4px 6px" }}>
        <h2 className="ios-title-3" style={{ margin: "0 0 2px" }}>Shared with Me</h2>
        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: 0 }}>
          Read-only access to courses shared by family members
        </p>
      </div>

      <Group style={{ margin: 0 }}>
        {valid.map((s) => {
          const c = s.course!;
          return (
            <Cell
              key={s.shareId}
              href={`/home/me/courses/shared/${c.id}`}
              lead={
                <IconBadge color={c.color_tag}>
                  <Icons.PeopleIcon style={{ color: "#fff" }} />
                </IconBadge>
              }
              title={c.name}
              subtitle={
                <>
                  Shared by {s.ownerName}
                  {c.instructor && ` · ${c.instructor}`}
                </>
              }
              trailing={
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {s.shareGrades && <Chip small>Grades</Chip>}
                  {s.shareAssignments && <Chip small>Assignments</Chip>}
                </span>
              }
            />
          );
        })}
      </Group>
    </section>
  );
}

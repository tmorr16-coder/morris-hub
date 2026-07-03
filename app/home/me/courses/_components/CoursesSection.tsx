"use client";

import { useState } from "react";
import { Group, Cell, IconBadge, Icons } from "@/components/ios";
import AddCourseModal from "./AddCourseModal";

interface Course {
  id: string;
  name: string;
  description: string | null;
  instructor: string | null;
  semester: string | null;
  color_tag: string;
}

export default function CoursesSection({ courses: initialCourses }: { courses: Course[] }) {
  const [courses, setCourses] = useState(initialCourses);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleCourseAdded = (newCourse: Course) => {
    setCourses([newCourse, ...courses]);
    setShowAddModal(false);
  };

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px 6px" }}>
        <h2 className="ios-title-3" style={{ margin: 0 }}>My Courses</h2>
        <button type="button" className="ios-btn--plain" onClick={() => setShowAddModal(true)} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Icons.PlusIcon style={{ width: 17, height: 17 }} />
          Add
        </button>
      </div>

      {courses.length === 0 ? (
        <div style={{
          background: "var(--ios-cell)",
          borderRadius: "var(--ios-radius-card)",
          padding: "40px 24px",
          textAlign: "center",
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "var(--ios-label-3)" }}>
            <Icons.BookIcon style={{ width: 34, height: 34 }} />
          </div>
          <div className="ios-headline" style={{ marginBottom: 4 }}>No courses yet</div>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 20 }}>
            Add a course to start tracking assignments and grades.
          </div>
          <button type="button" className="ios-btn ios-btn--primary" onClick={() => setShowAddModal(true)} style={{ width: "auto" }}>
            Add your first course
          </button>
        </div>
      ) : (
        <Group style={{ margin: 0 }}>
          {courses.map((course) => (
            <Cell
              key={course.id}
              href={`/home/me/courses/${course.id}`}
              lead={
                <IconBadge color={course.color_tag}>
                  <Icons.BookIcon style={{ color: "#fff" }} />
                </IconBadge>
              }
              title={course.name}
              subtitle={
                course.instructor || course.description ? (
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {course.instructor}
                    {course.instructor && course.description ? " · " : ""}
                    {course.description}
                  </span>
                ) : undefined
              }
              trailing={
                course.semester ? (
                  <span className="ios-caption" style={{ textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ios-label-3)" }}>
                    {course.semester}
                  </span>
                ) : undefined
              }
            />
          ))}
        </Group>
      )}

      {showAddModal && <AddCourseModal onClose={() => setShowAddModal(false)} onCourseAdded={handleCourseAdded} />}
    </section>
  );
}

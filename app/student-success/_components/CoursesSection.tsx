"use client";

import { useState } from "react";
import Link from "next/link";
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 400, margin: 0, letterSpacing: "-0.01em" }}>
          My Courses
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: "7px 16px", borderRadius: 8, border: "none",
            background: "var(--color-accent)", color: "#fff",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          + Add Course
        </button>
      </div>

      {courses.length === 0 ? (
        <div style={{
          background: "var(--color-bg-card)",
          border: "1px dashed var(--color-rule)",
          borderRadius: 14,
          padding: "40px 24px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
          <div style={{ fontWeight: 600, color: "var(--color-ink)", marginBottom: 4 }}>No courses yet</div>
          <div style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 20 }}>Add a course to start tracking assignments and grades.</div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: "var(--color-accent)", color: "#fff",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}
          >
            Add your first course
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {courses.map((course) => (
            <Link key={course.id} href={`/student-success/courses/${course.id}`} style={{ textDecoration: "none" }}>
              <div style={{
                background: "var(--color-bg-card)",
                border: "1px solid var(--color-rule)",
                borderRadius: 12,
                padding: "16px 20px",
                boxShadow: "var(--shadow-card)",
                display: "flex",
                alignItems: "center",
                gap: 16,
                transition: "box-shadow 150ms",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 14px rgba(0,0,0,0.09)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)"; }}
              >
                {/* Color tag dot */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: course.color_tag + "22",
                  border: `2px solid ${course.color_tag}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18,
                }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: course.color_tag }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-ink)" }}>
                      {course.name}
                    </span>
                    {course.semester && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.06em", color: "var(--color-ink-4)",
                      }}>
                        {course.semester}
                      </span>
                    )}
                  </div>
                  {course.instructor && (
                    <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
                      {course.instructor}
                    </div>
                  )}
                  {course.description && (
                    <div style={{
                      fontSize: 13, color: "var(--color-ink-2)", marginTop: 4,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {course.description}
                    </div>
                  )}
                </div>

                <span style={{ color: "var(--color-ink-4)", fontSize: 18, flexShrink: 0 }}>›</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showAddModal && <AddCourseModal onClose={() => setShowAddModal(false)} onCourseAdded={handleCourseAdded} />}
    </section>
  );
}

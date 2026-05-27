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
        <h2 className="serif" style={{ fontSize: 24 }}>
          Courses
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            background: "var(--color-accent-dark)",
            color: "white",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          + Add Course
        </button>
      </div>

      {courses.length === 0 ? (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 12,
            padding: "32px 24px",
            textAlign: "center",
            color: "var(--color-ink-3)",
          }}
        >
          <p>No courses yet. Add one to get started!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/home/student-support/courses/${course.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 12,
                  padding: "16px 20px",
                  boxShadow: "var(--shadow-card)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  borderLeft: `4px solid ${course.color_tag}`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-ink)", marginBottom: 4 }}>
                      {course.name}
                    </h3>
                    {course.instructor && (
                      <p style={{ fontSize: 12, color: "var(--color-ink-3)", marginBottom: 4 }}>
                        📚 {course.instructor}
                      </p>
                    )}
                    {course.description && (
                      <p style={{ fontSize: 13, color: "var(--color-ink-2)", marginBottom: 8 }}>
                        {course.description}
                      </p>
                    )}
                    {course.semester && (
                      <p style={{ fontSize: 11, color: "var(--color-ink-3)", textTransform: "uppercase" }}>
                        {course.semester}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showAddModal && <AddCourseModal onClose={() => setShowAddModal(false)} onCourseAdded={handleCourseAdded} />}
    </section>
  );
}

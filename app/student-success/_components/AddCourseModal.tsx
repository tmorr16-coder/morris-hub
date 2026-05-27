"use client";

import { useState } from "react";

interface Course {
  id: string;
  name: string;
  description: string | null;
  instructor: string | null;
  semester: string | null;
  color_tag: string;
}

interface AddCourseModalProps {
  onClose: () => void;
  onCourseAdded: (course: Course) => void;
}

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

export default function AddCourseModal({ onClose, onCourseAdded }: AddCourseModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructor, setInstructor] = useState("");
  const [semester, setSemester] = useState("");
  const [colorTag, setColorTag] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/student-support/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          instructor: instructor || null,
          semester: semester || null,
          color_tag: colorTag,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create course");
      }

      const course = await response.json();
      onCourseAdded(course);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 999,
          cursor: "pointer",
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "var(--color-bg)",
          borderRadius: 12,
          border: "1px solid var(--color-rule)",
          boxShadow: "0 20px 25px rgba(0, 0, 0, 0.15)",
          maxWidth: 500,
          width: "90vw",
          maxHeight: "90vh",
          overflow: "auto",
          zIndex: 1000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "24px" }}>
          <h2 style={{ fontSize: 20, marginBottom: 20, fontWeight: 600 }}>Add New Course</h2>

          <form onSubmit={handleSubmit}>
            {error && (
              <div
                style={{
                  backgroundColor: "#fee2e2",
                  color: "#991b1b",
                  padding: "12px",
                  borderRadius: 6,
                  marginBottom: 16,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                Course Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g., Introduction to Biology"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                Instructor
              </label>
              <input
                type="text"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                placeholder="e.g., Dr. Smith"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                Semester
              </label>
              <input
                type="text"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="e.g., Fall 2024"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Course overview or notes..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  minHeight: 80,
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                Course Color
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setColorTag(color)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      backgroundColor: color,
                      border: colorTag === color ? "3px solid var(--color-ink)" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 6,
                  border: "1px solid var(--color-rule)",
                  background: "transparent",
                  color: "var(--color-ink)",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !name}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: loading || !name ? "var(--color-paper-deep)" : "var(--color-accent-dark)",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: loading || !name ? "default" : "pointer",
                  opacity: loading || !name ? 0.6 : 1,
                }}
              >
                {loading ? "Creating..." : "Create Course"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

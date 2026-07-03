"use client";

import { useState } from "react";
import { IconBadge, Icons } from "@/components/ios";

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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "var(--ios-hair) solid var(--ios-separator)",
  background: "var(--ios-cell)",
  color: "var(--ios-label)",
  fontSize: 16,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  colorScheme: "light dark",
};

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
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Failed to create course (${response.status})`);
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
      <div className="ios-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="Add a course">
        <div className="ios-grabber" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <button type="button" className="ios-btn--plain" onClick={onClose}>Cancel</button>
          <span className="ios-headline">New Course</span>
          <span style={{ width: 52 }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0 18px" }}>
          <IconBadge color={colorTag}><Icons.BookIcon style={{ color: "#fff" }} /></IconBadge>
          <div>
            <div className="ios-headline">Add a course</div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>Track assignments, grades & study</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <p className="ios-footnote" style={{ padding: "0 0 12px", color: "var(--ios-red)" }}>{error}</p>
          )}

          <div className="ios-group-header" style={{ padding: "0 0 8px" }}>
            Course Name <span style={{ color: "var(--ios-red)" }}>*</span>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Introduction to Biology"
            style={inputStyle}
          />

          <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Instructor</div>
          <input
            type="text"
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
            placeholder="e.g. Dr. Smith"
            style={inputStyle}
          />

          <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Semester</div>
          <input
            type="text"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            placeholder="e.g. Fall 2024"
            style={inputStyle}
          />

          <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Description</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Course overview or notes…"
            rows={3}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />

          <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Course Color</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setColorTag(color)}
                aria-label={`Color ${color}`}
                aria-pressed={colorTag === color}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  backgroundColor: color,
                  border: colorTag === color ? "3px solid var(--ios-label)" : "2px solid transparent",
                  boxShadow: colorTag === color ? "0 0 0 1px var(--ios-separator)" : "none",
                }}
              />
            ))}
          </div>

          <button
            type="submit"
            className="ios-btn ios-btn--primary"
            style={{ marginTop: 22, opacity: loading || !name ? 0.5 : 1 }}
            disabled={loading || !name}
          >
            {loading ? "Creating…" : "Create Course"}
          </button>
        </form>
      </div>
    </>
  );
}

"use client";

import { useState } from "react";

interface Course {
  color_tag: string;
}

interface Content {
  id: string;
  type: string;
  title: string;
  description: string | null;
  content_url: string | null;
  file_path?: string | null;
  is_uploaded?: boolean;
  file_size_kb?: number | null;
}

interface ContentTabProps {
  courseId: string;
  course: Course;
  content: Content[];
  onContentAdded: (content: Content) => void;
  onContentDeleted: (id: string) => void;
}

const CONTENT_TYPES = [
  { id: "syllabus", label: "📋 Syllabus" },
  { id: "book", label: "📖 Book" },
  { id: "notes", label: "📝 Notes" },
  { id: "resource", label: "🔗 Resource" },
  { id: "other", label: "📎 Other" },
];

export default function ContentTab({
  courseId,
  course,
  content,
  onContentAdded,
  onContentDeleted,
}: ContentTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    type: "resource",
    title: "",
    description: "",
    content_url: "",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const handleAddContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let response;

      if (uploadFile) {
        // File upload path
        const formDataToSend = new FormData();
        formDataToSend.append("file", uploadFile);
        formDataToSend.append("courseId", courseId);
        formDataToSend.append("type", formData.type);
        formDataToSend.append("title", formData.title || uploadFile.name);
        formDataToSend.append("description", formData.description);

        response = await fetch("/api/student-support/content/upload", {
          method: "POST",
          body: formDataToSend,
        });
      } else if (formData.content_url) {
        // URL link path
        response = await fetch("/api/student-support/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId,
            ...formData,
          }),
        });
      } else {
        throw new Error("Please provide either a file or URL");
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add content");
      }

      const newContent = await response.json();
      onContentAdded(newContent);
      setFormData({ type: "resource", title: "", description: "", content_url: "" });
      setUploadFile(null);
      setShowAddForm(false);
    } catch (err) {
      console.error("Error adding content:", err);
      alert(err instanceof Error ? err.message : "Failed to add content");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    setDeleteLoading(contentId);

    try {
      const response = await fetch(`/api/student-support/content/${contentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onContentDeleted(contentId);
      }
    } catch (err) {
      console.error("Error deleting content:", err);
    } finally {
      setDeleteLoading(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Course Materials</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            background: course.color_tag,
            color: "white",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          + Add Content
        </button>
      </div>

      {showAddForm && (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 8,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <form onSubmit={handleAddContent}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                {CONTENT_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                Upload File
              </label>
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadFile(file);
                    // Auto-fill title if not set
                    if (!formData.title) {
                      setFormData({ ...formData, title: file.name });
                    }
                  }
                }}
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 6,
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
              {uploadFile && (
                <p style={{ fontSize: 11, color: "var(--color-ink-3)", margin: "6px 0 0 0" }}>
                  Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
              <p style={{ fontSize: 11, color: "var(--color-ink-4)", margin: "6px 0 0 0" }}>
                or
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                Title {uploadFile ? "" : "*"}
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required={!uploadFile}
                placeholder={uploadFile ? uploadFile.name : "e.g., Lecture Notes Week 1"}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 6,
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                URL or Link
              </label>
              <input
                type="url"
                value={formData.content_url}
                onChange={(e) => setFormData({ ...formData, content_url: e.target.value })}
                placeholder="https://..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 6,
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional notes..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 6,
                  fontSize: 13,
                  boxSizing: "border-box",
                  minHeight: 60,
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--color-rule)",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.title || (!uploadFile && !formData.content_url)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: loading || !formData.title || (!uploadFile && !formData.content_url) ? "var(--color-paper-deep)" : course.color_tag,
                  color: "white",
                  cursor: loading || !formData.title || (!uploadFile && !formData.content_url) ? "default" : "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  opacity: loading || !formData.title || (!uploadFile && !formData.content_url) ? 0.6 : 1,
                }}
              >
                {loading ? "Adding..." : "Add"}
              </button>
            </div>
          </form>
        </div>
      )}

      {content.length === 0 ? (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 8,
            padding: "32px 24px",
            textAlign: "center",
            color: "var(--color-ink-3)",
          }}
        >
          <p>No content added yet. Upload course materials to get started!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {content.map((item) => {
            const contentType = CONTENT_TYPES.find((t) => t.id === item.type);
            return (
              <div
                key={item.id}
                style={{
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 8,
                  padding: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{contentType?.label.charAt(0)}</span>
                    <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--color-ink)" }}>
                      {item.title}
                    </h3>
                  </div>
                  {item.description && (
                    <p style={{ fontSize: 12, color: "var(--color-ink-3)", margin: "6px 0 0 0" }}>
                      {item.description}
                    </p>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 11, color: "var(--color-ink-4)" }}>
                    {item.is_uploaded ? (
                      <>
                        <span>📄 Uploaded file</span>
                        {item.file_size_kb && <span>• {item.file_size_kb} KB</span>}
                      </>
                    ) : (
                      <span>🔗 External link</span>
                    )}
                  </div>
                  {item.content_url && (
                    <a
                      href={item.content_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12,
                        color: course.color_tag,
                        textDecoration: "none",
                        marginTop: 6,
                        display: "inline-block",
                      }}
                    >
                      Open link →
                    </a>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteContent(item.id)}
                  disabled={deleteLoading === item.id}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "1px solid #fecaca",
                    background: "#fee2e2",
                    color: "#991b1b",
                    fontSize: 11,
                    cursor: deleteLoading === item.id ? "default" : "pointer",
                    fontWeight: 500,
                    opacity: deleteLoading === item.id ? 0.6 : 1,
                  }}
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

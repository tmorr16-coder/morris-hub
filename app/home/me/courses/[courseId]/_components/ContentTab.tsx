"use client";

import { useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { Icons } from "@/components/ios";

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
  { id: "syllabus", label: "Syllabus" },
  { id: "book", label: "Book" },
  { id: "notes", label: "Notes" },
  { id: "resource", label: "Resource" },
  { id: "other", label: "Other" },
];

const TYPE_ICON: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  syllabus: Icons.ChecklistIcon,
  book: Icons.BookIcon,
  notes: Icons.ComposeIcon,
  resource: Icons.NewsIcon,
  other: Icons.NewsIcon,
};

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

  const submitDisabled = loading || !formData.title || (!uploadFile && !formData.content_url);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 className="ios-title-3" style={{ margin: 0 }}>Course Materials</h2>
        <button type="button" className="ios-btn--plain" onClick={() => setShowAddForm(true)} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Icons.PlusIcon style={{ width: 17, height: 17 }} />
          Add
        </button>
      </div>

      {content.length === 0 ? (
        <div style={{
          background: "var(--ios-cell)",
          borderRadius: "var(--ios-radius-card)",
          padding: "32px 24px",
          textAlign: "center",
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: "var(--ios-label-3)" }}>
            <Icons.BookIcon style={{ width: 30, height: 30 }} />
          </div>
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
            No content added yet. Upload course materials to get started.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {content.map((item) => {
            const TypeIcon = TYPE_ICON[item.type] ?? Icons.NewsIcon;
            return (
              <div
                key={item.id}
                style={{
                  background: "var(--ios-cell)",
                  borderRadius: "var(--ios-radius-card)",
                  padding: "14px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <TypeIcon style={{ width: 18, height: 18, color: course.color_tag }} />
                    <h3 className="ios-headline" style={{ margin: 0 }}>{item.title}</h3>
                  </div>
                  {item.description && (
                    <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: "4px 0 0" }}>
                      {item.description}
                    </p>
                  )}
                  <div className="ios-caption" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, color: "var(--ios-label-3)" }}>
                    {item.is_uploaded ? (
                      <>
                        <span>Uploaded file</span>
                        {item.file_size_kb && <span className="ios-num">• {item.file_size_kb} KB</span>}
                      </>
                    ) : (
                      <span>External link</span>
                    )}
                  </div>
                  {item.content_url && (
                    <a
                      href={item.content_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ios-footnote"
                      style={{ color: "var(--ios-tint)", marginTop: 6, display: "inline-block", fontWeight: 600 }}
                    >
                      Open link →
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteContent(item.id)}
                  disabled={deleteLoading === item.id}
                  className="ios-footnote"
                  style={{ color: "var(--ios-red)", fontWeight: 600, flexShrink: 0, opacity: deleteLoading === item.id ? 0.5 : 1 }}
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showAddForm && (
        <>
          <div className="ios-sheet-backdrop" onClick={() => setShowAddForm(false)} aria-hidden="true" />
          <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="Add content">
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button type="button" className="ios-btn--plain" onClick={() => setShowAddForm(false)}>Cancel</button>
              <span className="ios-headline">Add Content</span>
              <span style={{ width: 52 }} />
            </div>

            <form onSubmit={handleAddContent}>
              <div className="ios-group-header" style={{ padding: "0 0 8px" }}>Type</div>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                style={inputStyle}
              >
                {CONTENT_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Upload File</div>
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
                style={{ ...inputStyle, fontSize: 14 }}
              />
              {uploadFile && (
                <p className="ios-caption" style={{ color: "var(--ios-label-2)", margin: "6px 0 0" }}>
                  Selected: {uploadFile.name} (<span className="ios-num">{(uploadFile.size / 1024).toFixed(1)}</span> KB)
                </p>
              )}
              <p className="ios-caption" style={{ color: "var(--ios-label-3)", margin: "8px 0 0" }}>or</p>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>
                Title {uploadFile ? "" : <span style={{ color: "var(--ios-red)" }}>*</span>}
              </div>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required={!uploadFile}
                placeholder={uploadFile ? uploadFile.name : "e.g. Lecture Notes Week 1"}
                style={inputStyle}
              />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>URL or Link</div>
              <input
                type="url"
                value={formData.content_url}
                onChange={(e) => setFormData({ ...formData, content_url: e.target.value })}
                placeholder="https://…"
                style={inputStyle}
              />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Description</div>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional notes…"
                rows={2}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              />

              <button
                type="submit"
                disabled={submitDisabled}
                className="ios-btn ios-btn--primary"
                style={{ marginTop: 22, opacity: submitDisabled ? 0.5 : 1 }}
              >
                {loading ? "Adding…" : "Add"}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

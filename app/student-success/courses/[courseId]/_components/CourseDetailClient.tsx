"use client";

import { useState } from "react";
import ContentTab from "./ContentTab";
import RemindersTab from "./RemindersTab";
import FlashcardsTab from "./FlashcardsTab";
import ResearchChat from "./ResearchChat";

interface Course {
  id: string;
  name: string;
  description: string | null;
  instructor: string | null;
  semester: string | null;
  color_tag: string;
}

interface Content {
  id: string;
  type: string;
  title: string;
  description: string | null;
  content_url: string | null;
}

interface Reminder {
  id: string;
  type: string;
  title: string;
  description: string | null;
  due_date: string;
  is_completed: boolean;
}

interface FlashcardSet {
  id: string;
  name: string;
  description: string | null;
}

interface CourseDetailClientProps {
  courseId: string;
  course: Course;
  initialContent: Content[];
  initialReminders: Reminder[];
  initialFlashcardSets: FlashcardSet[];
  userId: string;
}

type TabType = "content" | "reminders" | "flashcards" | "research";

export default function CourseDetailClient({
  courseId,
  course,
  initialContent,
  initialReminders,
  initialFlashcardSets,
  userId,
}: CourseDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>("content");
  const [content, setContent] = useState(initialContent);
  const [reminders, setReminders] = useState(initialReminders);
  const [flashcardSets, setFlashcardSets] = useState(initialFlashcardSets);

  const tabs = [
    { id: "content", label: "📚 Course Content", icon: "📚" },
    { id: "reminders", label: "⏰ Reminders", icon: "⏰" },
    { id: "flashcards", label: "🎯 Flashcards", icon: "🎯" },
    { id: "research", label: "🔍 Research Chat", icon: "🔍" },
  ] as const;

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--color-rule)", marginBottom: 32 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 20px",
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? "var(--color-accent-dark)" : "var(--color-ink-2)",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab.id ? `2px solid ${course.color_tag}` : "none",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "content" && (
          <ContentTab
            courseId={courseId}
            course={course}
            content={content}
            onContentAdded={(newContent) => setContent([newContent, ...content])}
            onContentDeleted={(id) => setContent(content.filter((c) => c.id !== id))}
          />
        )}

        {activeTab === "reminders" && (
          <RemindersTab
            courseId={courseId}
            reminders={reminders}
            onReminderAdded={(newReminder) => setReminders([...reminders, newReminder])}
            onReminderDeleted={(id) => setReminders(reminders.filter((r) => r.id !== id))}
          />
        )}

        {activeTab === "flashcards" && (
          <FlashcardsTab
            courseId={courseId}
            flashcardSets={flashcardSets}
            onSetAdded={(newSet) => setFlashcardSets([...flashcardSets, newSet])}
            onSetDeleted={(id) => setFlashcardSets(flashcardSets.filter((s) => s.id !== id))}
          />
        )}

        {activeTab === "research" && <ResearchChat courseId={courseId} courseName={course.name} />}
      </div>
    </div>
  );
}

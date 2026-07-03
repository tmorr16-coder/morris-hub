"use client";

import { useState } from "react";
import { Segmented } from "@/components/ios";
import ContentTab from "./ContentTab";
import RemindersTab from "./RemindersTab";
import FlashcardsTab from "./FlashcardsTab";
import ResearchChat from "./ResearchChat";
import ScheduleTab from "./ScheduleTab";
import GradesTab from "./GradesTab";
import ShareTab from "./ShareTab";

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

type TabType = "content" | "grades" | "schedule" | "reminders" | "flashcards" | "chat" | "share";

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

  const tabs: { value: TabType; label: string }[] = [
    { value: "content",    label: "Content"    },
    { value: "grades",     label: "Grades"     },
    { value: "schedule",   label: "Schedule"   },
    { value: "reminders",  label: "Reminders"  },
    { value: "flashcards", label: "Cards"      },
    { value: "chat",       label: "Chat"       },
    { value: "share",      label: "Share"      },
  ];

  return (
    <div>
      {/* Tabs */}
      <div style={{ overflowX: "auto", scrollbarWidth: "none", margin: "0 0 24px" }}>
        <Segmented<TabType>
          options={tabs}
          value={activeTab}
          onChange={setActiveTab}
          ariaLabel="Course sections"
          style={{ minWidth: 560 }}
        />
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

        {activeTab === "grades" && (
          <GradesTab courseId={courseId} colorTag={course.color_tag} />
        )}

        {activeTab === "flashcards" && (
          <FlashcardsTab
            courseId={courseId}
            colorTag={course.color_tag}
            flashcardSets={flashcardSets}
            onSetAdded={(newSet) => setFlashcardSets([...flashcardSets, newSet])}
            onSetDeleted={(id) => setFlashcardSets(flashcardSets.filter((s) => s.id !== id))}
          />
        )}

        {activeTab === "schedule" && (
          <ScheduleTab courseId={courseId} courseName={course.name} colorTag={course.color_tag} />
        )}

        {activeTab === "chat" && <ResearchChat courseId={courseId} courseName={course.name} />}

        {activeTab === "share" && (
          <ShareTab courseId={courseId} courseName={course.name} colorTag={course.color_tag} />
        )}
      </div>
    </div>
  );
}

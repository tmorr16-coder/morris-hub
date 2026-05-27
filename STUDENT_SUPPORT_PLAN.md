# Student Support Module Implementation Plan

## Overview
Adding a comprehensive student support system at `/home/student-support` with the following features:
- Course management with syllabus/book resources
- Research chat (Claude API integration)
- Content import system
- Smart reminders (tests, assignments, extra credit, practice tests, quizzes)
- Flashcard study system with context
- Email reminders via Resend
- User settings/configuration

## Database Schema

### 1. Courses
- id, user_id, name, description, semester, instructor, created_at, updated_at

### 2. Course Content  
- id, course_id, type (syllabus|book|notes|other), title, description, file_url, imported_at

### 3. Reminders
- id, user_id, course_id, type (test|assignment|quiz|practice|extra_credit), title, description, due_date, due_time, sent_at, created_at

### 4. Flashcards
- id, user_id, course_id, question, answer, context, last_reviewed, created_at

## Frontend Components

### Pages
- `/app/home/student-support/page.tsx` - Main dashboard
- `/app/home/student-support/courses/page.tsx` - Course list & management
- `/app/home/student-support/[courseId]/page.tsx` - Course detail view

### Components
- CourseCard - Display course info
- ResearchChat - Claude-powered research interface
- CourseContentUploader - Upload/import course materials
- ReminderManager - Create and manage reminders
- FlashcardViewer - Study flashcards
- SettingsPanel - Configuration options

## API Routes

### New API Endpoints
- POST `/api/student-support/courses` - Create course
- GET `/api/student-support/courses` - List courses
- PUT `/api/student-support/courses/[id]` - Update course
- DELETE `/api/student-support/courses/[id]` - Delete course
- POST `/api/student-support/content` - Upload content
- POST `/api/student-support/reminders` - Create reminder
- POST `/api/student-support/send-reminders` - Scheduled job to send email reminders

## Implementation Steps

1. Create database migrations for new tables
2. Set up Row Level Security policies
3. Create API routes for CRUD operations
4. Build frontend components
5. Integrate Claude API for research chat
6. Set up Resend email integration
7. Add scheduled reminder checks

## Dependencies
- Already have: @anthropic-ai/sdk, @supabase/supabase-js, resend
- May need: date-fns for date handling

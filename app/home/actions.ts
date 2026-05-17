"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  notes: string | null;
  due_date: string | null;
  created_at: string;
}

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function addTodo(title: string): Promise<{ error?: string; todo?: Todo }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };
  if (!title.trim()) return { error: "Title required" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data, error } = await service
    .schema("hub")
    .from("todos")
    .insert({ user_id: userId, title: title.trim() })
    .select("id, title, completed, notes, due_date, created_at")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/home");
  return { todo: data as Todo };
}

export async function toggleTodo(id: string, completed: boolean): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("todos")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/home");
  return {};
}

export async function deleteTodo(id: string): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("todos")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/home");
  return {};
}

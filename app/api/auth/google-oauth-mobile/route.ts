import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * iOS/Mobile Google OAuth endpoint
 *
 * Accepts an ID token from iOS Google Sign-In SDK and exchanges it for a Supabase session.
 *
 * Usage (iOS with native Google Sign-In):
 * ```swift
 * import GoogleSignIn
 *
 * func signInWithGoogle() async {
 *   guard let idToken = GIDSignIn.sharedInstance.currentUser?.idToken?.tokenString else { return }
 *
 *   let url = URL(string: "https://morrisai.family/api/auth/google-oauth-mobile")!
 *   var request = URLRequest(url: url)
 *   request.httpMethod = "POST"
 *   request.setValue("application/json", forHTTPHeaderField: "Content-Type")
 *   request.httpBody = try JSONEncoder().encode(["idToken": idToken])
 *
 *   let (data, _) = try await URLSession.shared.data(for: request)
 *   let response = try JSONDecoder().decode(AuthResponse.self, from: data)
 *   // Store tokens in secure storage
 * }
 * ```
 */

interface GoogleIdTokenPayload {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
}

function parseJwt(token: string): GoogleIdTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const decoded = Buffer.from(parts[1], "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { idToken } = body as { idToken?: string };

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { error: "idToken (string) required in request body" },
        { status: 400 }
      );
    }

    // Parse JWT to extract basic info (verification happens server-side in Supabase)
    const payload = parseJwt(idToken);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid token format" },
        { status: 400 }
      );
    }

    // Check token expiration
    if (payload.exp * 1000 < Date.now()) {
      return NextResponse.json(
        { error: "Token expired" },
        { status: 401 }
      );
    }

    const admin = createServiceClient();
    const supabase = await createClient();

    // Use Supabase to authenticate with the ID token
    // Supabase will verify the token signature with Google's public keys
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.auth as any).signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) {
      console.error("Supabase ID token verification failed:", error);
      return NextResponse.json(
        { error: "Authentication failed: " + (error.message || "Invalid token") },
        { status: 401 }
      );
    }

    if (!data?.user) {
      return NextResponse.json(
        { error: "No user created from token" },
        { status: 401 }
      );
    }

    // Ensure user profile exists in hub.profiles
    try {
      await admin
        .schema("hub")
        .from("profiles")
        .upsert(
          {
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.user_metadata?.full_name || payload.name || payload.email,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
    } catch (profileError) {
      console.error("Profile upsert failed (non-fatal):", profileError);
    }

    // Return tokens and user info to iOS app
    return NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.full_name || payload.name,
      },
      session: {
        accessToken: data.session?.access_token,
        refreshToken: data.session?.refresh_token,
        expiresIn: data.session?.expires_in,
        expiresAt: data.session?.expires_at,
      },
    });
  } catch (error) {
    console.error("Google OAuth mobile endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

# iOS Google OAuth Setup Guide

This guide explains how to integrate Google OAuth login into your native iOS app using the `/api/auth/google-oauth-mobile` endpoint.

## Overview

The iOS OAuth flow differs from web OAuth:
- **Web**: Browser redirect flow (user leaves app)
- **iOS**: Native SDK → ID token → Backend verification (user stays in app)

## iOS App Setup

### 1. Install Google Sign-In SDK

Add to your `Podfile`:
```ruby
pod 'GoogleSignIn'
```

Then run:
```bash
pod install
```

### 2. Configure Google Sign-In

In your `Info.plist`, add your Google Client ID:
```xml
<key>GIDClientID</key>
<string>YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com</string>
```

Get this from [Google Cloud Console](https://console.cloud.google.com):
1. Create an OAuth 2.0 credential of type "iOS"
2. Add your iOS app's bundle identifier and signing certificate SHA-1

### 3. Implement Sign-In View

```swift
import GoogleSignIn
import UIKit

class LoginViewController: UIViewController {
    @IBAction func signInWithGoogle(_ sender: UIButton) {
        GIDSignIn.sharedInstance.signIn(withPresenting: self) { signInResult, error in
            guard error == nil else { return }
            guard let signInResult = signInResult else { return }
            
            let user = signInResult.user
            let idToken = user.idToken?.tokenString
            
            // Send token to backend
            self.authenticateWithBackend(idToken: idToken)
        }
    }
    
    private func authenticateWithBackend(idToken: String?) {
        guard let idToken = idToken else { return }
        
        let url = URL(string: "https://morrisai.family/api/auth/google-oauth-mobile")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["idToken": idToken]
        request.httpBody = try? JSONEncoder().encode(body)
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            guard let data = data, error == nil else {
                DispatchQueue.main.async {
                    // Handle network error
                }
                return
            }
            
            do {
                let response = try JSONDecoder().decode(AuthResponse.self, from: data)
                if response.ok {
                    // Save tokens securely
                    self.saveTokens(
                        accessToken: response.session.accessToken,
                        refreshToken: response.session.refreshToken
                    )
                    
                    // Navigate to home screen
                    DispatchQueue.main.async {
                        self.navigateToHome()
                    }
                } else {
                    // Handle auth error
                }
            } catch {
                // Handle JSON decode error
            }
        }.resume()
    }
    
    private func saveTokens(accessToken: String, refreshToken: String) {
        // Save securely using Keychain
        let keychain = Keychain()
        try? keychain.set(accessToken, key: "accessToken")
        try? keychain.set(refreshToken, key: "refreshToken")
    }
    
    private func navigateToHome() {
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        let homeVC = storyboard.instantiateViewController(withIdentifier: "HomeViewController")
        self.navigationController?.pushViewController(homeVC, animated: true)
    }
}

// MARK: - Models

struct AuthResponse: Codable {
    let ok: Bool
    let user: User
    let session: Session
    let error: String?
    
    struct User: Codable {
        let id: String
        let email: String?
        let name: String?
    }
    
    struct Session: Codable {
        let accessToken: String?
        let refreshToken: String?
        let expiresIn: Int?
        let expiresAt: Int?
        
        enum CodingKeys: String, CodingKey {
            case accessToken = "accessToken"
            case refreshToken = "refreshToken"
            case expiresIn = "expiresIn"
            case expiresAt = "expiresAt"
        }
    }
}
```

## Backend Configuration (Supabase)

### 1. Enable Google OAuth in Supabase

Go to **Supabase Dashboard → Authentication → Providers**:

1. Click **Google**
2. Enable it
3. Add your Google OAuth credentials:
   - **Client ID**: From Google Cloud Console
   - **Client Secret**: From Google Cloud Console

### 2. Add Redirect URLs

In Supabase **Auth → URL Configuration**, add:
```
https://morrisai.family/api/auth/google-oauth-mobile
```

(No redirect needed for mobile, but Supabase requires this for Google OAuth)

## Testing with Test Account

If you don't have Google OAuth configured yet, use the test login endpoint:

```bash
# Create/update test account
curl -X PUT https://morrisai.family/api/auth/test-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@morrisai.family",
    "password": "TestPassword123!",
    "name": "Test User"
  }'

# Sign in with test account
curl -X POST https://morrisai.family/api/auth/test-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@morrisai.family",
    "password": "TestPassword123!"
  }'
```

Enable test auth by setting in environment:
```
ENABLE_TEST_AUTH=true
```

## API Reference

### Endpoint: `/api/auth/google-oauth-mobile`

**Method**: `POST`

**Request**:
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2YzFlMWI4ZTA1YjJlZjJjMjAwN2I5MWI2NTQ2MzEwZTVjNDg0MGQiLCJ0eXAiOiJKV1QifQ..."
}
```

**Response (Success)**:
```json
{
  "ok": true,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@gmail.com",
    "name": "John Doe"
  },
  "session": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "sbv_...",
    "expiresIn": 3600,
    "expiresAt": 1234567890
  }
}
```

**Response (Error)**:
```json
{
  "ok": false,
  "error": "Authentication failed: Invalid token"
}
```

## Storing Tokens Securely

### Using Keychain (Recommended)

```swift
import KeychainAccess

let keychain = Keychain(service: "com.morrisai.family")

// Save
try? keychain.set(accessToken, key: "accessToken")
try? keychain.set(refreshToken, key: "refreshToken")

// Retrieve
if let accessToken = try? keychain.get("accessToken") {
    // Use token
}

// Delete
try? keychain.remove("accessToken")
```

Add to your `Podfile`:
```ruby
pod 'KeychainAccess'
```

## Using Tokens in API Calls

Include the access token in all subsequent API requests:

```swift
var request = URLRequest(url: url)
request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

// Make API call
URLSession.shared.dataTask(with: request) { data, response, error in
    // Handle response
}.resume()
```

## Token Refresh

When access token expires:

```swift
func refreshAccessToken(refreshToken: String) {
    // Call your backend refresh endpoint or use Supabase SDK
    // Store new tokens in Keychain
}
```

## Troubleshooting

### "idToken required" Error
- Ensure you're sending the Google ID token (not access token)
- Check that the token is still valid (not expired)

### "Invalid token format" Error
- Verify the token is a properly formatted JWT
- Check that Google Sign-In is properly initialized

### "Authentication failed" Error
- Supabase Google OAuth may not be configured
- Check that Client ID and Client Secret are correct in Supabase
- Verify token hasn't expired

### 404 on `/api/auth/google-oauth-mobile`
- Ensure backend is deployed and running
- Check that the domain is correct (should be `https://morrisai.family`)

## Next Steps

1. Set up Google OAuth in Supabase
2. Add Google Sign-In SDK to your iOS app
3. Implement the sign-in flow above
4. Test with a real Google account
5. Deploy to TestFlight/App Store

## Additional Resources

- [Google Sign-In for iOS Documentation](https://developers.google.com/identity/sign-in/ios)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Keychain Access Library](https://github.com/kishikawakatsumi/KeychainAccess)

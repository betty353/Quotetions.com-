type FirebaseAuthResponse = {
  localId: string
  email: string
  idToken?: string
  error?: {
    message?: string
  }
}

const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY

export function isFirebaseAuthConfigured() {
  return Boolean(firebaseApiKey)
}

async function firebaseAuthRequest(path: string, body: Record<string, unknown>) {
  if (!firebaseApiKey) {
    throw new Error("Firebase API key is not configured")
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${firebaseApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = (await response.json()) as FirebaseAuthResponse

  if (!response.ok) {
    throw new Error(json.error?.message || "Firebase Authentication request failed")
  }

  return json
}

export async function createFirebaseUser(email: string, password: string, displayName: string) {
  const user = await firebaseAuthRequest("accounts:signUp", {
    email,
    password,
    displayName,
    returnSecureToken: true,
  })

  return {
    uid: user.localId,
    email: user.email,
    idToken: user.idToken,
  }
}

export async function signInFirebaseUser(email: string, password: string) {
  const user = await firebaseAuthRequest("accounts:signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  })

  return {
    uid: user.localId,
    email: user.email,
    idToken: user.idToken,
  }
}

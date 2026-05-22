import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { auth } from "./firebase";
import { updateProfile } from "firebase/auth";

export interface User {
    id: string;
    email: string | null;
    fullName: string | null;
    role: string;
}

export const signUp = async (email: string, password: string, fullName: string) => {
    try {
        const res = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, fullName })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
    } catch (e) {
        // Fallback to Firebase
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: fullName });
        return { 
            user: { id: userCredential.user.uid, email, fullName, role: 'user' }, 
            token: await userCredential.user.getIdToken() 
        };
    }
}

export const signIn = async (email: string, password: string) => {
    try {
        const res = await fetch("/api/auth/signin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
    } catch (e) {
        // Fallback to Firebase
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { 
            user: { id: userCredential.user.uid, email, fullName: userCredential.user.displayName, role: 'user' }, 
            token: await userCredential.user.getIdToken() 
        };
    }
}

export const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    return { 
        user: { id: userCredential.user.uid, email: userCredential.user.email, fullName: userCredential.user.displayName, role: 'user' }, 
        token: await userCredential.user.getIdToken() 
    };
}

export const verifyToken = async (token: string) => {
    // With Firebase Client SDK, we don't strictly need to pass token to verify
    // But for API consistency, we check currentUser
    const user = auth.currentUser;
    if (!user) return { valid: false };
    return { 
        valid: true, 
        user: { id: user.uid, email: user.email, fullName: user.displayName, role: 'user' } 
    };
}

export const signOut = async () => {
    await firebaseSignOut(auth);
}

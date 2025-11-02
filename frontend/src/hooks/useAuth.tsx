// src/hooks/useAuth.tsx
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  getAuth,
  User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app"; 
import { doc, getDoc, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { db } from "../firebase";


interface ExtendedUser extends User {
  role?: string;
}

interface AuthContextType {
  user: ExtendedUser | null;
  authReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}


const AuthContext = createContext<AuthContextType>({
  user: null,
  authReady: false,
  login: async () => {},
  signup: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
});


export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = getAuth();
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const fetchUserData = async (firebaseUser: User) => {
    const userRef = doc(db, "users", firebaseUser.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const roleData = snap.data().role || "member";
      setUser({ ...firebaseUser, role: roleData });
    } else {
      const initialRole = "member";
      await setDoc(userRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        role: initialRole,
      });
      setUser({ ...firebaseUser, role: initialRole });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchUserData(firebaseUser);
      } else {
        setUser(null);
      }
      setAuthReady(true);
    });
    return unsubscribe;
  }, [auth]);


  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error("Login error:", err);
      throw err; 
    }
  };

  const signup = async (email: string, password: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        email,
        role: "member",
      });
    } catch (err) {
      console.error("Signup error:", err);
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider); 
    } catch (err) {
      if (err instanceof FirebaseError && err.code === "auth/popup-blocked") {
         console.error("Google login failed: Pop-up was blocked. Recommend switching to signInWithRedirect.");
         throw new Error("Google login failed: Your browser blocked the sign-in pop-up. Please allow pop-ups for this site or try again.");
      }
      console.error("Google login error:", err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
      throw err;
    }
  };


  return (
    <AuthContext.Provider
      value={{ user, authReady, login, signup, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => useContext(AuthContext);
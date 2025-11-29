// alcovia-app/components/SignOutButton.tsx
import React, { useState } from "react";
import { TouchableOpacity, Text, Alert } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

type Props = {
  backendLogoutUrl?: string;
};

export default function SignOutButton({ backendLogoutUrl }: Props) {
  const router = useRouter();
  // Call hook properly (not useAuth())
  const { signOut, isLoaded: authLoaded } = useAuth() as any;
  const { user } = useUser();
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    if (busy) return;
    setBusy(true);

    try {
      // 1) Clerk client-side sign out (if available)
      if (authLoaded && typeof signOut === "function") {
        try {
          await signOut();
        } catch (e) {
          console.warn("Clerk signOut failed:", e);
        }
      }

      // 2) Optional backend logout to clear server cookies/sessions
      if (backendLogoutUrl) {
        try {
          await fetch(backendLogoutUrl, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.warn("Backend logout failed:", e);
        }
      }

      // 3) Replace to login route so user cannot go back to protected screens
      router.replace("/login");

      // 4) quick no-op state change to ensure any component depending on local state re-renders
      // (Clerk should update hooks, but this guard helps for race conditions)
      setTimeout(() => setBusy(false), 300);
    } catch (err) {
      console.error("Sign out error:", err);
      Alert.alert("Sign out failed", String(err));
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={() =>
        Alert.alert(
          "Sign out",
          `Signed in as ${
            user?.primaryEmailAddress?.emailAddress || "user"
          }. Sign out?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: handleSignOut },
          ]
        )
      }
      style={{
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: "#F3F4F6",
      }}
      disabled={busy}
    >
      <Text style={{ color: "#111", fontWeight: "700" }}>
        {busy ? "Signing out..." : "Sign out"}
      </Text>
    </TouchableOpacity>
  );
}

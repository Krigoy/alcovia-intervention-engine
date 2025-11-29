import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter, useLocalSearchParams } from "expo-router";

WebBrowser.maybeCompleteAuthSession();

export default function AssignIntervention() {
  const { isLoaded: authLoaded, isSignedIn, signOut } = useAuth() as any;
  const { user, isLoaded: userLoaded } = useUser() as any;
  const router = useRouter();
  const params = useLocalSearchParams() as {
    student_id?: string;
    attempt_id?: string;
    mentor_email?: string;
  };

  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [hostedSignInUrl] = useState(
    process.env.EXPO_PUBLIC_CLERK_SIGNIN_URL || ""
  );
  const backendBase = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(
    /\/$/,
    ""
  );

  useEffect(() => {
    if (!authLoaded || !userLoaded) return;
  }, [authLoaded, userLoaded]);

  const openHostedSignIn = async () => {
    if (!hostedSignInUrl) {
      Alert.alert("Configuration", "Hosted sign-in URL not set in env.");
      return;
    }
    const redirectUrl = Linking.createURL("/callback");
    try {
      await WebBrowser.openAuthSessionAsync(hostedSignInUrl, redirectUrl);
    } catch (e) {
      Alert.alert("Error", "Failed to open sign-in.");
    }
  };

  const doSignOut = async () => {
    try {
      if (typeof signOut === "function") await signOut();
    } catch (e) {
      Alert.alert("Error", "Sign out failed.");
    }
  };

  const getUserEmail = () => {
    return (
      user?.primaryEmailAddress?.emailAddress ||
      (user?.emailAddresses && user.emailAddresses[0]?.emailAddress) ||
      null
    );
  };

  const validateBeforeAssign = () => {
    if (!params.student_id) {
      Alert.alert("Missing data", "student_id is required in the URL.");
      return false;
    }
    if (!isSignedIn) {
      Alert.alert(
        "Sign in required",
        "Please sign in as the mentor to assign a task."
      );
      return false;
    }
    const currentEmail = getUserEmail();
    if (
      params.mentor_email &&
      currentEmail &&
      params.mentor_email !== currentEmail
    ) {
      Alert.alert(
        "Wrong account",
        `You're signed in as ${currentEmail}. To assign as ${params.mentor_email} sign out and sign in with the correct mentor account.`
      );
      return false;
    }
    if (!task.trim()) {
      Alert.alert("Validation", "Please type a task to assign.");
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!validateBeforeAssign()) return;
    setBusy(true);
    try {
      const payload = {
        student_id: params.student_id,
        attempt_id: params.attempt_id || null,
        task: task.trim(),
        mentor_id: getUserEmail() || null,
      };
      const res = await fetch(`${backendBase}/assign-intervention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const txt = await res.text();
      if (!res.ok) {
        Alert.alert("Assign failed", txt || `status ${res.status}`);
        setBusy(false);
        return;
      }
      let json;
      try {
        json = JSON.parse(txt);
      } catch {
        json = { ok: true };
      }
      Alert.alert("Assigned", "Intervention assigned");
      router.push("/tasks");
    } catch (err) {
      Alert.alert("Error", "Unable to assign intervention");
    } finally {
      setBusy(false);
    }
  };

  const currentEmail = getUserEmail();

  if (!authLoaded || !userLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Preparing...</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Assign Intervention</Text>

      <View style={styles.infoCard}>
        <Text style={styles.label}>Student ID</Text>
        <Text selectable style={styles.value}>
          {params.student_id || "—"}
        </Text>

        <Text style={[styles.label, { marginTop: 10 }]}>Attempt ID</Text>
        <Text selectable style={styles.value}>
          {params.attempt_id || "—"}
        </Text>

        <Text style={[styles.label, { marginTop: 10 }]}>Signed in as</Text>
        <Text selectable style={styles.value}>
          {isSignedIn ? currentEmail || "Unknown email" : "Not signed in"}
        </Text>
      </View>

      {params.mentor_email ? (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.hint}>
            Expected mentor: {params.mentor_email}
          </Text>
        </View>
      ) : null}

      {!isSignedIn ? (
        <View style={{ marginTop: 18 }}>
          <Pressable style={styles.primaryBtn} onPress={openHostedSignIn}>
            <Text style={styles.primaryBtnText}>Sign in to assign</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ marginTop: 18 }}>
          <Text style={styles.label}>Task</Text>
          <TextInput
            style={styles.input}
            placeholder="Describe the task for the student"
            value={task}
            onChangeText={setTask}
            multiline
          />

          <View style={{ flexDirection: "row", marginTop: 12 }}>
            <Pressable
              style={[styles.primaryBtn, busy ? { opacity: 0.6 } : {}]}
              onPress={submit}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.primaryBtnText}>Assign Task</Text>
              )}
            </Pressable>

            <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
              <Text style={styles.ghostBtnText}>Cancel</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: 12 }}>
            <Pressable style={styles.signout} onPress={doSignOut}>
              <Text style={styles.signoutText}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, backgroundColor: "#fff" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 12 },
  infoCard: {
    backgroundColor: "#FBFCFF",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  label: { fontSize: 13, color: "#666", marginBottom: 4 },
  value: { fontSize: 14, color: "#111", fontWeight: "700" },
  hint: { color: "#666", fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: "#e6e6e6",
    padding: 10,
    borderRadius: 8,
    minHeight: 80,
    textAlignVertical: "top",
    marginTop: 6,
  },
  primaryBtn: {
    backgroundColor: "#0A84FF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  ghostBtn: {
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  ghostBtnText: { color: "#111", fontWeight: "700" },
  signout: { marginTop: 8, paddingVertical: 8 },
  signoutText: { color: "#EF4444", fontWeight: "700" },
});

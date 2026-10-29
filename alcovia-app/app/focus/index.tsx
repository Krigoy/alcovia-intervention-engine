import React from "react";
import { View, Text, StyleSheet } from "react-native";
import FocusMode from "../../components/FocusMode";
import { useAuth, useUser } from "@clerk/clerk-expo";

const BACKEND = (
  process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:3000"
).replace(/\/$/, "");
const SOCKET_URL = (process.env.EXPO_PUBLIC_SOCKET_URL || BACKEND).replace(
  /\/$/,
  ""
);

export default function FocusScreen() {
  const { isLoaded, user } = useUser();
  const { getToken } = useAuth();

  if (!isLoaded) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Focus Mode</Text>
        <Text style={styles.hint}>Please sign in to start a focus session.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FocusMode
        studentId={user.id}
        apiBase={BACKEND}
        socketUrl={SOCKET_URL}
        getToken={() => getToken()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  hint: { color: "#666", textAlign: "center" },
});

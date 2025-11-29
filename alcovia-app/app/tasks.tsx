import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { createClient } from "@supabase/supabase-js";
import io, { Socket } from "socket.io-client";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const BACKEND = (
  process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:3000"
).replace(/\/$/, "");

export default function Tasks() {
  const { isLoaded, isSignedIn } = useAuth() as any;
  const { user } = useUser() as any;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const mentorEmail =
    user?.primaryEmailAddress?.emailAddress ||
    (user?.emailAddresses && user.emailAddresses[0]?.emailAddress) ||
    null;

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) fetchTasks();
    else {
      setTasks([]);
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!mentorEmail) return;
    if (!process.env.EXPO_PUBLIC_BACKEND_URL) return;
    const socket = io(BACKEND, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_mentor", { mentor_email: mentorEmail });
    });

    socket.on("intervention_assigned", (iv: any) => {
      setTasks((prev) => {
        const exists = prev.find(
          (p) => p.id === iv.id || p.attempt_id === iv.attempt_id
        );
        if (exists)
          return prev.map((p) =>
            p.id === iv.id || p.attempt_id === iv.attempt_id ? iv : p
          );
        return [iv, ...prev];
      });
    });

    socket.on("intervention_updated", (iv: any) => {
      setTasks((prev) =>
        prev.map((p) =>
          p.id === iv.id || p.attempt_id === iv.attempt_id ? iv : p
        )
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [mentorEmail]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      if (supabase) {
        const email = mentorEmail;
        let query = supabase
          .from("interventions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        if (email) {
          query = (query as any).or(`mentor_id.eq.${email},mentor_id.is.null`);
        }
        const { data, error } = await query;
        if (error) {
          console.warn("supabase error", error);
          await fetchFromBackend();
        } else {
          setTasks(data || []);
        }
        return;
      }

      await fetchFromBackend();
    } catch (err) {
      console.warn(err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFromBackend = async () => {
    try {
      if (!BACKEND) {
        setTasks([]);
        return;
      }
      const url = mentorEmail
        ? `${BACKEND}/api/interventions?mentor_email=${encodeURIComponent(
            mentorEmail
          )}`
        : `${BACKEND}/api/interventions`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("backend fetch failed", res.status);
        setTasks([]);
        return;
      }
      const json = await res.json();
      if (Array.isArray(json)) setTasks(json);
      else setTasks(json.interventions || []);
    } catch (err) {
      console.warn("fetchFromBackend error", err);
      setTasks([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  };

  const markComplete = async (student_id: string) => {
    try {
      const res = await fetch(`${BACKEND}/complete-intervention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id }),
      });
      if (!res.ok) {
        const txt = await res.text();
        Alert.alert("Error", `Status ${res.status}: ${txt}`);
        return;
      }
      Alert.alert("Done", "Intervention marked complete");
      fetchTasks();
    } catch (err) {
      console.warn(err);
      Alert.alert("Error", "Unable to mark complete");
    }
  };

  if (!isLoaded || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading tasks...</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Tasks</Text>
        <Text style={styles.hint}>Please sign in to view assigned tasks.</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: any }) => {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.studentId}>{item.student_id}</Text>
          <Text
            style={[
              styles.status,
              item.status === "Pending"
                ? styles.statusPending
                : styles.statusNeutral,
            ]}
          >
            {item.status || "Pending"}
          </Text>
        </View>
        <Text style={styles.task}>{item.task || "No task text provided."}</Text>
        <View style={styles.rowBottom}>
          <Text style={styles.meta}>
            {item.mentor_id
              ? `Mentor: ${String(item.mentor_id)}`
              : "Auto / system"}
          </Text>
          <View style={styles.controls}>
            <Pressable
              onPress={() => {
                Alert.alert("Confirm", "Mark this intervention complete?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Yes", onPress: () => markComplete(item.student_id) },
                ]);
              }}
              style={({ pressed }) => [
                styles.btn,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.btnText}>Mark complete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      contentContainerStyle={
        tasks.length === 0 ? styles.emptyWrap : styles.listWrap
      }
      data={tasks}
      keyExtractor={(i) =>
        String(i.id ?? i.attempt_id ?? `${i.student_id}-${i.created_at}`)
      }
      renderItem={renderItem}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No tasks assigned</Text>
          <Text style={styles.emptyText}>
            When a student requires intervention, tasks assigned by mentors will
            appear here.
          </Text>
          <Pressable onPress={fetchTasks} style={styles.reload}>
            <Text style={styles.reloadText}>Reload</Text>
          </Pressable>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  hint: { color: "#666", textAlign: "center" },
  listWrap: { padding: 20, paddingBottom: 120, backgroundColor: "#fff" },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  card: {
    backgroundColor: "#FBFCFF",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  studentId: { fontWeight: "700", fontSize: 14 },
  status: {
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: "hidden",
  },
  statusPending: { backgroundColor: "#FEF3C7", color: "#92400E" },
  statusNeutral: { backgroundColor: "#EEF2FF", color: "#3730A3" },
  task: { color: "#111", marginBottom: 10 },
  rowBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: { color: "#666", fontSize: 12 },
  controls: { flexDirection: "row", alignItems: "center" },
  btn: {
    backgroundColor: "#0A84FF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnPressed: { opacity: 0.8 },
  btnText: { color: "#fff", fontWeight: "700" },
  empty: { alignItems: "center", maxWidth: 520 },
  emptyTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  emptyText: { color: "#666", textAlign: "center", marginBottom: 12 },
  reload: {
    backgroundColor: "#0A84FF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  reloadText: { color: "#fff", fontWeight: "700" },
});

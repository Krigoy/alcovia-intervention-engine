import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey)
  supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Dashboard() {
  const router = useRouter();
  const { isSignedIn } = useAuth?.() ?? { isSignedIn: false };
  const { user } = useUser?.() ?? { user: undefined };

  const [loading, setLoading] = useState<boolean>(true);
  const [students, setStudents] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [interventions, setInterventions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // New check-in form state
  const [formStudentId, setFormStudentId] = useState("");
  const [formQuiz, setFormQuiz] = useState("");
  const [formFocus, setFormFocus] = useState("");
  const [submittingCheckin, setSubmittingCheckin] = useState(false);

  useEffect(() => {
    if (!isSignedIn) {
      router.replace("/login");
      return;
    }
    fetchAll();
  }, [isSignedIn]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchStudents(),
      fetchRecentLogs(),
      fetchInterventions(),
    ]);
    setLoading(false);
  };

  const fetchStudents = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error(error);
      return;
    }
    setStudents(data || []);
  };

  const fetchRecentLogs = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("daily_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error(error);
      return;
    }
    setRecentLogs(data || []);
  };

  const fetchInterventions = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("interventions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error(error);
      return;
    }
    setInterventions(data || []);
  };

  const counts = useMemo(() => {
    const c = { onTrack: 0, needs: 0, remedial: 0 };
    for (const s of students) {
      const st = (s.status || "").toLowerCase();
      if (st.includes("remedial")) c.remedial++;
      else if (st.includes("need")) c.needs++;
      else c.onTrack++;
    }
    return c;
  }, [students]);

  const submitCheckin = async () => {
    if (!formStudentId.trim()) {
      Alert.alert("Validation", "Student ID is required");
      return;
    }
    const quizVal = Number(formQuiz);
    const focusVal = Number(formFocus);
    if (Number.isNaN(quizVal) || quizVal < 0) {
      Alert.alert("Validation", "Quiz score must be a non-negative number");
      return;
    }
    if (Number.isNaN(focusVal) || focusVal < 0) {
      Alert.alert("Validation", "Focus minutes must be a non-negative number");
      return;
    }

    const backendBase = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (!backendBase) {
      Alert.alert("Config error", "EXPO_PUBLIC_BACKEND_URL not set");
      return;
    }

    setSubmittingCheckin(true);
    try {
      const payload = {
        student_id: formStudentId.trim(),
        quiz_score: Math.round(quizVal),
        focus_minutes: Math.round(focusVal),
      };
      const res = await fetch(
        `${backendBase.replace(/\/$/, "")}/daily-checkin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        console.error("checkin failed", res.status, text);
        Alert.alert("Submit failed", `status ${res.status}: ${text}`);
      } else {
        const json = await res.json();
        Alert.alert("Submitted", `Status: ${json.status}`);
        setFormStudentId("");
        setFormQuiz("");
        setFormFocus("");
        await fetchRecentLogs();
        await fetchStudents();
      }
    } catch (err) {
      console.error("submit error", err);
      Alert.alert("Error", "Unable to submit check-in");
    } finally {
      setSubmittingCheckin(false);
    }
  };

  const assignRemedial = async (student_id: string, attempt_id?: string) => {
    const backendBase = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (!backendBase) {
      Alert.alert("Backend URL missing", "Set EXPO_PUBLIC_BACKEND_URL in env.");
      return;
    }
    Alert.alert("Confirm", `Assign remedial task to ${student_id}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Assign",
        onPress: async () => {
          setRefreshing(true);
          try {
            const payload = {
              student_id,
              attempt_id,
              task: "Remedial reading: review chapters 1-2",
              mentor_id:
                user?.primaryEmailAddress?.emailAddress ||
                user?.emailAddresses?.[0]?.emailAddress ||
                "mentor@local",
            };
            const res = await fetch(
              `${backendBase.replace(/\/$/, "")}/assign-intervention`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              }
            );
            if (!res.ok) {
              const txt = await res.text();
              Alert.alert("Assign failed", txt || `status ${res.status}`);
            } else {
              Alert.alert("Assigned", "Remedial task assigned");
              await fetchAll();
            }
          } catch (err) {
            console.error(err);
            Alert.alert("Error", "Failed to assign");
          } finally {
            setRefreshing(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            Mentor Dashboard — State of the Student
          </Text>
        </View>

        {/* NEW: Check-in Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Add New Daily Check-In</Text>

          <TextInput
            placeholder="Student ID"
            style={styles.input}
            value={formStudentId}
            onChangeText={setFormStudentId}
            autoCapitalize="none"
          />

          <TextInput
            placeholder="Quiz score (e.g., 0-10)"
            style={styles.input}
            value={formQuiz}
            onChangeText={setFormQuiz}
            keyboardType="numeric"
          />

          <TextInput
            placeholder="Focus minutes (e.g., 45)"
            style={styles.input}
            value={formFocus}
            onChangeText={setFormFocus}
            keyboardType="numeric"
          />

          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                submittingCheckin ? { opacity: 0.6 } : {},
              ]}
              onPress={submitCheckin}
              disabled={submittingCheckin}
            >
              <Text style={styles.primaryBtnText}>
                {submittingCheckin ? "Submitting..." : "Submit Check-In"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>On Track</Text>
            <Text style={styles.summaryValue}>{counts.onTrack}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Needs Intervention</Text>
            <Text style={styles.summaryValue}>{counts.needs}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Remedial</Text>
            <Text style={styles.summaryValue}>{counts.remedial}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent Check-ins</Text>

        <View style={styles.tableHeader}>
          <Text style={[styles.col, styles.colId]}>Student ID</Text>
          <Text style={[styles.col]}>Status</Text>
          <Text style={[styles.col]}>Quiz</Text>
          <Text style={[styles.col]}>Focus</Text>
          <Text style={[styles.col, styles.colAction]}>Action</Text>
        </View>

        {recentLogs.length === 0 ? (
          <Text style={{ padding: 12 }}>No recent logs.</Text>
        ) : (
          recentLogs.map((log) => (
            <View key={log.attempt_id} style={styles.tableRow}>
              <Text style={[styles.col, styles.colId]}>{log.student_id}</Text>
              <Text style={[styles.col]}>{log.status}</Text>
              <Text style={[styles.col]}>{String(log.quiz_score)}</Text>
              <Text style={[styles.col]}>{String(log.focus_minutes)}</Text>
              <View style={[styles.col, styles.colAction]}>
                <TouchableOpacity
                  style={styles.assignBtn}
                  onPress={() => assignRemedial(log.student_id, log.attempt_id)}
                >
                  <Text style={styles.assignBtnText}>Assign Remedial</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
          Active Interventions (recent)
        </Text>
        {interventions.length === 0 ? (
          <Text style={{ padding: 12 }}>No interventions recorded.</Text>
        ) : (
          interventions.map((iv) => (
            <View key={String(iv.id)} style={styles.interventionRow}>
              <Text style={{ fontWeight: "700" }}>{iv.student_id}</Text>
              <Text style={{ color: "#333" }}>{iv.task}</Text>
              <Text style={{ color: "#666", fontSize: 12 }}>
                {iv.created_at}
              </Text>
            </View>
          ))
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 80, backgroundColor: "#fff" },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 20, fontWeight: "800" },
  headerRight: { flexDirection: "row", alignItems: "center" },

  outlineBtn: {
    borderWidth: 1,
    borderColor: "#999",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 12,
  },
  outlineBtnText: { color: "#333", fontWeight: "600" },

  primaryBtn: {
    backgroundColor: "#0A84FF",
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },

  formCard: {
    backgroundColor: "#F7FBFF",
    padding: 12,
    borderRadius: 10,
    marginTop: 18,
    marginBottom: 8,
  },
  formTitle: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },

  summaryRow: { flexDirection: "row", marginTop: 16 },
  summaryCard: {
    flex: 1,
    padding: 12,
    backgroundColor: "#F8F9FB",
    marginRight: 12,
    borderRadius: 10,
  },
  summaryTitle: { fontSize: 13, color: "#666" },
  summaryValue: { fontSize: 22, fontWeight: "800", marginTop: 6 },

  sectionTitle: { marginTop: 18, fontSize: 16, fontWeight: "700" },

  tableHeader: {
    flexDirection: "row",
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#fafafa",
    alignItems: "center",
  },

  col: { flex: 1, fontSize: 13 },
  colId: { flex: 1.6 },
  colAction: { flex: 1.4, alignItems: "flex-end" },

  assignBtn: {
    backgroundColor: "#EF4444",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  assignBtnText: { color: "#fff", fontWeight: "700" },

  interventionRow: {
    padding: 12,
    backgroundColor: "#FBFBFB",
    marginTop: 8,
    borderRadius: 8,
  },

  footer: { marginTop: 20 },
});

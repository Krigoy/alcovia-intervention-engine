import React, { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, Button, AppState } from "react-native";
import io, { Socket } from "socket.io-client";

type Mode = "normal" | "locked" | "remedial";

interface Props {
  studentId: string;
  apiBase: string;
  socketUrl: string;
  getToken?: () => Promise<string | null>;
}

export default function FocusMode({
  studentId,
  apiBase,
  socketUrl,
  getToken,
}: Props) {
  const [mode, setMode] = useState<Mode>("normal");
  const [task, setTask] = useState<string | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const [interventionId, setInterventionId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);
  const cheatReportedRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" && timerRunning && !cheatReportedRef.current) {
        reportCheat();
      }
    });

    return () => subscription.remove();
  }, [timerRunning]);

  async function authHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    try {
      const token = getToken ? await getToken() : null;
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (e) {
      console.warn("getToken failed", e);
    }
    return headers;
  }

  async function reportCheat() {
    cheatReportedRef.current = true;
    setTimerRunning(false);

    const payload = {
      student_id: studentId,
      quiz_score: 0,
      focus_minutes: Math.floor(secondsRef.current / 60),
    };

    try {
      const res = await fetch(`${apiBase}/daily-checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        cheatReportedRef.current = false;
        setMessage(`Left the app during a session, but the report failed (status ${res.status}).`);
        return;
      }
      setMessage("Cheating detected — locked.");
      setMode("locked");
    } catch (e) {
      console.warn("reportCheat failed", e);
      cheatReportedRef.current = false;
      setMessage("Left the app during a session, but the server could not be reached.");
    }
  }

  useEffect(() => {
    const socket = io(socketUrl, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_student", { student_id: studentId });
    });

    socket.on("student_locked", () => setMode("locked"));
    socket.on("intervention_assigned", (payload: any) => {
      setMode("remedial");
      setTask(payload?.task ?? null);
      setInterventionId(payload?.id ?? null);
    });
    socket.on("intervention_completed", () => {
      setMode("normal");
      setTask(null);
      setInterventionId(null);
      setMessage("Back on track.");
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [socketUrl, studentId]);

  async function submitQuiz() {
    const score = Number(quizAnswer);
    if (quizAnswer.trim() === "" || !Number.isInteger(score) || score < 0 || score > 10) {
      setMessage("Enter a whole-number quiz score between 0 and 10.");
      return;
    }

    const payload = {
      student_id: studentId,
      quiz_score: score,
      focus_minutes: Math.floor(secondsRef.current / 60),
    };

    try {
      const res = await fetch(`${apiBase}/daily-checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        setMessage(`Check-in failed (status ${res.status}): ${txt}`);
        return;
      }

      const json = await res.json();

      if (json.student_status === "Remedial") {
        setMessage("Check-in saved. Finish your remedial task to get back on track.");
      } else if (json.status === "On Track") {
        setMessage("You're on track!");
      } else if (json.status === "Needs Intervention") {
        setMode("locked");
        setMessage("Pending Mentor Review — locked.");
      } else {
        setMessage("Unexpected response from server.");
      }
    } catch (e) {
      console.warn("submitQuiz failed", e);
      setMessage("Could not reach the server. Please try again.");
    }
  }

  async function markComplete() {
    try {
      const res = await fetch(`${apiBase}/complete-intervention`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          student_id: studentId,
          intervention_id: interventionId ?? undefined,
        }),
      });

      if (res.ok) {
        setMode("normal");
        setTask(null);
        setInterventionId(null);
        setMessage("Back on track.");
      } else {
        const txt = await res.text();
        setMessage(`Could not mark complete (status ${res.status}): ${txt}`);
      }
    } catch (e) {
      console.warn("markComplete failed", e);
      setMessage("Could not reach the server. Please try again.");
    }
  }

  if (mode === "locked") {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: "600" }}>
          Analysis in progress…
        </Text>
        <Text style={{ marginTop: 10 }}>{message}</Text>
        <Text style={{ marginTop: 20, fontSize: 16 }}>
          Timer: {format(seconds)}
        </Text>
      </View>
    );
  }

  if (mode === "remedial") {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: "600" }}>Remedial Task</Text>
        <Text style={{ marginTop: 10 }}>{task}</Text>
        <Button title="Mark Complete" onPress={markComplete} />
        {message && <Text style={{ marginTop: 20 }}>{message}</Text>}
      </View>
    );
  }

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>Focus Mode</Text>

      <Text style={{ marginTop: 20 }}>Timer: {format(seconds)}</Text>

      {!timerRunning ? (
        <Button
          title="Start Focus Timer"
          onPress={() => setTimerRunning(true)}
        />
      ) : (
        <Button
          title="Stop Timer"
          color="red"
          onPress={() => setTimerRunning(false)}
        />
      )}

      <Text style={{ marginTop: 30, fontSize: 18 }}>Daily Quiz</Text>

      <TextInput
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          padding: 10,
          marginTop: 10,
          marginBottom: 10,
        }}
        keyboardType="numeric"
        value={quizAnswer}
        onChangeText={setQuizAnswer}
        placeholder="Score (0-10)"
      />

      <Button title="Submit Daily Check-in" onPress={submitQuiz} />

      {message && <Text style={{ marginTop: 20 }}>{message}</Text>}
    </View>
  );
}

function format(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

import React, { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, Button, AppState } from "react-native";
import io, { Socket } from "socket.io-client";

type Mode = "normal" | "locked" | "remedial";

interface Props {
  studentId: string;
  apiBase: string;
  socketUrl: string;
}

export default function FocusMode({ studentId, apiBase, socketUrl }: Props) {
  const [mode, setMode] = useState<Mode>("normal");
  const [task, setTask] = useState<string | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cheatReportedRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);

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

  async function reportCheat() {
    cheatReportedRef.current = true;
    setTimerRunning(false);
    setMessage("Cheating detected — locked.");

    const payload = {
      student_id: studentId,
      quiz_score: 0,
      focus_minutes: Math.floor(seconds / 60),
    };

    await fetch(`${apiBase}/daily-checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setMode("locked");
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
      setTask(payload.task);
    });
    socket.on("intervention_completed", () => {
      setMode("normal");
      setTask(null);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [socketUrl, studentId]);

  async function submitQuiz() {
    const payload = {
      student_id: studentId,
      quiz_score: Number(quizAnswer),
      focus_minutes: Math.floor(seconds / 60),
    };

    const res = await fetch(`${apiBase}/daily-checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (json.status === "On Track") {
      setMessage("You're on track!");
    } else {
      setMode("locked");
      setMessage("Pending Mentor Review — locked.");
    }
  }

  async function markComplete() {
    const res = await fetch(`${apiBase}/complete-intervention`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId }),
    });

    if (res.ok) {
      setMode("normal");
      setTask(null);
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

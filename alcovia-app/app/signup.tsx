import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Button,
  Text,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSignUp, useUser, useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

export default function SignUpScreen() {
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/");
    }
  }, [isSignedIn]);

  const handleSignUp = async () => {
    if (!signUpLoaded) return;

    setLoading(true);
    try {
      const created = await signUp.create({
        emailAddress: email,
        password,
      });

      Alert.alert(
        "Account created!",
        "If email verification is required, please check your inbox."
      );

      router.replace("/");
    } catch (err: any) {
      console.error("Sign up error", err);
      Alert.alert("Sign up failed", err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        placeholder="Password (min 8 characters)"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      {loading ? (
        <ActivityIndicator />
      ) : (
        <Button title="Create account" onPress={handleSignUp} />
      )}

      <View style={{ height: 12 }} />
      <Button
        title="Already have an account? Sign in"
        onPress={() => router.push("/login")}
      />

      <View style={{ height: 12 }} />
      <Text style={styles.small}>
        We may ask you to verify your email — check your inbox.
      </Text>
      <Text style={styles.hint}>
        Signed in as:{" "}
        {user?.primaryEmailAddress?.emailAddress ?? "not signed in"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    marginBottom: 12,
    borderRadius: 6,
  },
  title: { fontSize: 22, marginBottom: 12, textAlign: "center" },
  small: { marginTop: 6, color: "#999", fontSize: 12, textAlign: "center" },
  hint: { marginTop: 10, color: "#666", textAlign: "center" },
});

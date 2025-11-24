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
import { useSignIn, useUser, useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

export default function LoginScreen() {
  const { signIn, isLoaded: signInLoaded } = useSignIn();
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

  const handleSignIn = async () => {
    if (!signInLoaded) return;

    setLoading(true);
    try {
      const attempt = await signIn.create({
        identifier: email,
        password,
      });

      if (typeof signIn.attempt === "function") {
        await signIn.attempt({
          identifier: email,
          password,
        });
      }
    } catch (err: any) {
      console.error("Sign in error", err);
      Alert.alert("Sign in failed", err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>

      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      {loading ? (
        <ActivityIndicator />
      ) : (
        <Button title="Sign in" onPress={handleSignIn} />
      )}

      <View style={{ height: 12 }} />
      <Button
        title="Create an account"
        onPress={() => router.push("/signup")}
      />

      <View style={{ height: 12 }} />
      <Text style={styles.hint}>
        Signed in as:{" "}
        {user?.primaryEmailAddress?.emailAddress ?? "not signed in"}
      </Text>
      <Text style={styles.small}>
        Make sure email/password auth is enabled in Clerk Dashboard.
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
  hint: { marginTop: 10, color: "#666", textAlign: "center" },
  small: { marginTop: 6, color: "#999", fontSize: 12, textAlign: "center" },
});

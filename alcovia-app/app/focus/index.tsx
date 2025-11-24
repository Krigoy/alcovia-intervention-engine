import React from "react";
import { View, StyleSheet } from "react-native";
import FocusMode from "../../components/FocusMode";
import { useUser } from "@clerk/clerk-expo";

export default function FocusScreen() {
  const { user } = useUser();

  const studentId = user?.id || "57c5c1b1-bafb-448b-be33-fb5a331409a9";

  return (
    <View style={styles.container}>
      <FocusMode
        studentId={studentId}
        apiBase="http://localhost:3000"
        socketUrl="http://localhost:3000"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});

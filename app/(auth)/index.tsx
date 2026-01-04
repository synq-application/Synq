import { Image } from "expo-image";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

export default function AssemblySplash() {
  const [goNext, setGoNext] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGoNext(true), 10000);
    return () => clearTimeout(t);
  }, []);

  if (goNext) return <Redirect href="/(auth)/welcome" />;

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/Assembly.gif")}
        style={styles.gif}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  gif: { width: "100%", height: "100%" },
});

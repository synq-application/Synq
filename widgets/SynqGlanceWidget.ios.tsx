import { Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, padding, widgetURL } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

const ACCENT = "#1A6B58";

export type SynqGlanceWidgetProps = {
  statusLabel: string;
  memo: string;
  isActive: boolean;
};

function secondaryColor(scheme: "light" | "dark" | undefined): string {
  return scheme === "dark" ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)";
}

function SynqGlanceWidgetView(
  props: SynqGlanceWidgetProps,
  environment: WidgetEnvironment
) {
  "widget";
  const small = environment.widgetFamily === "systemSmall";
  const scheme = environment.colorScheme;
  const sub = secondaryColor(scheme);

  return (
    <VStack
      modifiers={[
        padding({ all: small ? 10 : 14 }),
        widgetURL("synq://"),
      ]}
    >
      <Text
        modifiers={[
          font({ weight: "bold", size: small ? 13 : 15 }),
          foregroundStyle(ACCENT),
        ]}
      >
        Synq
      </Text>
      <Text
        modifiers={[
          font({ size: small ? 11 : 13 }),
          foregroundStyle(props.isActive ? ACCENT : sub),
        ]}
      >
        {props.statusLabel}
      </Text>
      {!small && props.memo ? (
        <Text modifiers={[font({ size: 12 }), foregroundStyle(sub)]}>
          {props.memo}
        </Text>
      ) : null}
    </VStack>
  );
}

const SynqGlanceWidget = createWidget("SynqGlanceWidget", SynqGlanceWidgetView);
export default SynqGlanceWidget;

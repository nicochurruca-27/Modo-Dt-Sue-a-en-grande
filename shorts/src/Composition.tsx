import {
  AbsoluteFill,
  Composition,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Short de prueba: 5 segundos, vertical 1080x1920 (formato de YouTube Shorts).
export const MyComposition = () => {
  return (
    <Composition
      id="PruebaShort"
      component={PruebaShort}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};

export const PruebaShort: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const entrada = spring({ frame, fps, config: { damping: 200 } });
  const subtitulo = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const salida = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#14213d",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "sans-serif",
        opacity: salida,
      }}
    >
      <div
        style={{
          color: "#fca311",
          fontSize: 140,
          fontWeight: 900,
          textAlign: "center",
          transform: `scale(${entrada})`,
        }}
      >
        ¡FUNCIONA!
      </div>
      <div
        style={{
          color: "white",
          fontSize: 60,
          marginTop: 40,
          opacity: subtitulo,
        }}
      >
        Short de prueba · 1080x1920
      </div>
    </AbsoluteFill>
  );
};

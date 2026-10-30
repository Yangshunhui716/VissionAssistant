import { memo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';

/**
 * @param {{
 *   fps: number | null,
 *   aiFps?: number | null,
 *   latencyMetrics?: { total: number, prep: number, chw: number, infer: number, track: number } | null,
 *   showProfiling?: boolean,
 *   objectList: string[],
 *   debugImage: string | null,
 *   showFps: boolean,
 *   showObjects: boolean,
 *   onCapturePress: () => void,
 *   onBenchmarkPress?: () => void,
 *   benchmarkProgress?: number | null,
 *   benchmarkSaved?: boolean,
 *   debug: boolean
 * }} props
 */
const DebugOverlayComponent = ({
  fps,
  aiFps,
  latencyMetrics,
  showProfiling,
  objectList,
  debugImage,
  showFps,
  showObjects,
  onCapturePress,
  onBenchmarkPress,
  benchmarkProgress = null,
  benchmarkSaved = false,
  debug,
}) => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {debug && debugImage && (
        <View style={styles.debugContainer}>
          <Image
            source={{ uri: debugImage }}
            style={styles.debugImg}
            resizeMode="contain"
          />
        </View>
      )}

      {debug && (
        <Button
          mode="contained"
          buttonColor="#EF4444"
          icon="camera"
          style={styles.captureBtn}
          labelStyle={styles.captureBtnText}
          onPress={onCapturePress}
        >
          LẤY ẢNH
        </Button>
      )}

      {debug && showProfiling && (
        <Button
          mode="contained"
          buttonColor={benchmarkProgress !== null ? "#F59E0B" : "#10B981"}
          icon="timer-outline"
          style={styles.benchmarkBtn}
          labelStyle={styles.benchmarkBtnText}
          disabled={benchmarkProgress !== null}
          onPress={onBenchmarkPress}
        >
          {benchmarkProgress !== null
            ? `ĐANG ĐO (${benchmarkProgress}/100)`
            : benchmarkSaved
            ? "ĐÃ LƯU (BẤM ĐO LẠI)"
            : "ĐO 100 FRAME"}
        </Button>
      )}

      {debug && (showFps || showProfiling) && (
        <View style={styles.fps}>
          {showFps && fps != null && (
            <Text variant="labelSmall" style={styles.fpsText}>
              Cam: {fps ?? 0} | AI: {aiFps ?? 0} FPS
            </Text>
          )}
          {showProfiling && (
            <Text variant="labelSmall" style={styles.profilingText}>
              {latencyMetrics
                ? `Tot: ${latencyMetrics.total}ms\nPrep: ${latencyMetrics.prep}ms\n(CHW: ${latencyMetrics.chw}ms)\nYOLO: ${latencyMetrics.infer}ms\nTrk: ${latencyMetrics.track}ms`
                : 'Đang đo độ trễ...'}
            </Text>
          )}
        </View>
      )}

      {debug && showObjects && objectList?.length > 0 && (
        <View style={styles.debugList}>
          {objectList.map((name, index) => (
            <Text
              key={`${name}-${index}`}
              variant="labelSmall"
              style={styles.debugText}
            >
              {name}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

export const DebugOverlay = memo(DebugOverlayComponent);

const styles = StyleSheet.create({
  debugContainer: {
    position: 'absolute',
    bottom: 160,
    right: 20,
    zIndex: 100,
    elevation: 100,
  },

  debugImg: {
    width: 150,
    height: 150,
    borderWidth: 3,
    borderColor: 'lime',
  },

  captureBtn: {
    position: 'absolute',
    top: 105,
    right: 10,
    zIndex: 9999,
    borderRadius: 8,
  },
  benchmarkBtn: {
    position: 'absolute',
    top: 150,
    right: 10,
    zIndex: 9999,
    borderRadius: 8,
  },
  benchmarkBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },

  captureBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },

  fps: {
    position: 'absolute',
    top: 110,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.72)',
    zIndex: 100,
  },

  fpsText: {
    color: '#00FF00',
    fontWeight: '700',
  },

  profilingText: {
    color: '#FBBF24',
    fontWeight: '600',
    fontSize: 10,
    marginTop: 3,
  },

  debugList: {
    position: 'absolute',
    top: 195,
    right: 10,
    padding: 7,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.65)',
    zIndex: 100,
  },

  debugText: {
    color: 'yellow',
  },
});

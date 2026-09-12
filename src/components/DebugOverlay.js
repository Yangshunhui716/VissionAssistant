import { memo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';

/** @type {React.FC<any>} */
export const DebugOverlay = memo(
  ({ fps, objectList, debugImage, showFps, showObjects, onCapturePress, debug }) => {
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

        {debug && showFps && fps != null && (
          <View style={styles.fps}>
            <Text style={styles.fpsText}>FPS: {fps}</Text>
          </View>
        )}

        {debug && showObjects && objectList?.length > 0 && (
          <View style={styles.debugList}>
            {objectList.map((name, index) => (
              <Text key={`${name}-${index}`} style={styles.debugText}>
                {name}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  },
);

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
    top: 110,
    right: 10,
    zIndex: 9999,
    borderRadius: 8,
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
    fontSize: 12,
    fontWeight: '700',
  },

  debugList: {
    position: 'absolute',
    top: 160,
    right: 10,
    padding: 7,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.65)',
    zIndex: 100,
  },

  debugText: {
    color: 'yellow',
    fontSize: 12,
  },
});

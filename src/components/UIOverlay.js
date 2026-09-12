import { memo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Surface, Icon, TouchableRipple } from 'react-native-paper';

/** @type {React.FC<any>} */
export const UIOverlay = memo(
  ({
    detectedObj,
    appState,
    transcript,
    activeFunction,
    isObstacleActive,
    onObstaclePress,
    onCurrencyPress,
    onObjectPress,
    onTextPress,
    onMicPress,
    onSettingsPress,
  }) => {
    const isListening = appState === 'LISTENING';
    const isWaking = appState === 'WAKING_UP';

    const isObjectActive = activeFunction === 'Đồ vật';
    const isCurrencyActive = activeFunction === 'Tiền tệ';
    const isTextActive = activeFunction === 'Văn bản';
    const isFunctionActive = activeFunction != null;

    const isObstacleDisabled = isFunctionActive;
    const isCurrencyDisabled = isFunctionActive && !isCurrencyActive;
    const isObjectDisabled = isFunctionActive && !isObjectActive;
    const isTextDisabled = isFunctionActive && !isTextActive;

    const accentColor = isListening
      ? '#16A34A'
      : isWaking
      ? '#D97706'
      : '#6B7280';

    const stateText = isFunctionActive
      ? activeFunction
      : isListening
      ? 'Đang lắng nghe'
      : isWaking
      ? 'Đang khởi động'
      : 'Đang ngủ';

    const getMenuButtonStyle = isActive => [
      styles.menuButton,
      isActive && styles.menuButtonActive,
      isFunctionActive && !isActive && styles.menuButtonDisabled,
    ];

    const getMenuTextStyle = isActive => [
      styles.menuText,
      isActive && styles.menuTextActive,
      isFunctionActive && !isActive && styles.menuTextDisabled,
    ];

    const getMenuIconColor = isActive => {
      if (isActive) return '#16A34A';
      if (isFunctionActive) return '#9CA3AF';
      return '#374151';
    };

    return (
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="box-none"
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          pointerEvents="auto"
          onLongPress={onSettingsPress}
          delayLongPress={1500}
        />

        <View style={styles.resultContainer}>
          <Surface elevation={2} style={styles.resultBox}>
            {detectedObj?.name ? (
              <>
                <Text style={styles.detectionTitle}>
                  {detectedObj.name.toUpperCase()}
                </Text>

                <View style={styles.detectionInfo}>
                  <Text style={styles.detectionText}>{detectedObj.depth}</Text>

                  <View style={styles.dotSeparator} />

                  <Text style={styles.detectionText}>{detectedObj.motion}</Text>
                </View>
              </>
            ) : (
              <Text style={styles.resultText}>{transcript || ' '}</Text>
            )}
          </Surface>
        </View>

        <View style={styles.stateContainer}>
          <Surface
            elevation={3}
            style={[
              styles.state,
              {
                borderColor: isFunctionActive ? '#16A34A' : accentColor,
              },
            ]}
          >
            <View
              style={[
                styles.stateDot,
                {
                  backgroundColor: isFunctionActive ? '#16A34A' : accentColor,
                },
              ]}
            />

            <Text
              style={[
                styles.stateText,
                {
                  color: isFunctionActive ? '#16A34A' : accentColor,
                },
              ]}
            >
              {stateText}
            </Text>
          </Surface>
        </View>

        <View style={styles.bottomMenu}>
          <View style={styles.menuRow}>
            <TouchableRipple
              disabled={isObstacleDisabled}
              style={[
                styles.menuButton,
                isObstacleActive && styles.menuButtonObstacleActive,
                isObstacleDisabled && styles.menuButtonDisabled,
              ]}
              rippleColor="rgba(22, 163, 74, 0.2)"
              onPress={onObstaclePress}
            >
              <View style={styles.menuContent}>
                <Icon
                  source="alert-circle-outline"
                  size={26}
                  color={
                    isObstacleActive
                      ? '#16A34A'
                      : isObstacleDisabled
                      ? '#9CA3AF'
                      : '#374151'
                  }
                />

                <Text
                  style={[
                    styles.menuText,
                    isObstacleActive && styles.menuTextActive,
                    isObstacleDisabled && styles.menuTextDisabled,
                  ]}
                >
                  Vật cản
                </Text>
              </View>
            </TouchableRipple>

            <TouchableRipple
              disabled={isCurrencyDisabled}
              style={getMenuButtonStyle(isCurrencyActive)}
              rippleColor="rgba(22, 163, 74, 0.2)"
              onPress={onCurrencyPress}
            >
              <View style={styles.menuContent}>
                <Icon
                  source="cash-multiple"
                  size={26}
                  color={getMenuIconColor(isCurrencyActive)}
                />

                <Text style={getMenuTextStyle(isCurrencyActive)}>Tiền tệ</Text>
              </View>
            </TouchableRipple>
          </View>

          <View style={styles.menuRow}>
            <TouchableRipple
              disabled={isObjectDisabled}
              style={getMenuButtonStyle(isObjectActive)}
              rippleColor="rgba(22, 163, 74, 0.2)"
              onPress={onObjectPress}
            >
              <View style={styles.menuContent}>
                <Icon
                  source="cube-outline"
                  size={26}
                  color={getMenuIconColor(isObjectActive)}
                />

                <Text style={getMenuTextStyle(isObjectActive)}>Đồ vật</Text>
              </View>
            </TouchableRipple>

            <TouchableRipple
              disabled={isTextDisabled}
              style={getMenuButtonStyle(isTextActive)}
              rippleColor="rgba(22, 163, 74, 0.2)"
              onPress={onTextPress}
            >
              <View style={styles.menuContent}>
                <Icon
                  source="text-box-outline"
                  size={26}
                  color={getMenuIconColor(isTextActive)}
                />

                <Text style={getMenuTextStyle(isTextActive)}>Văn bản</Text>
              </View>
            </TouchableRipple>
          </View>
        </View>

        <View style={[styles.micWrapper, { borderColor: accentColor }]}>
          <Surface elevation={5} style={styles.micButton}>
            <TouchableRipple
              onPress={onMicPress}
              rippleColor="rgba(0, 0, 0, 0.15)"
              style={styles.micPressable}
            >
              <Icon
                source={isListening ? 'microphone' : 'microphone-outline'}
                size={42}
                color={accentColor}
              />
            </TouchableRipple>
          </Surface>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  resultContainer: {
    position: 'absolute',
    top: 20,
    left: 24,
    right: 24,
    alignItems: 'center',
  },

  resultBox: {
    minWidth: 180,
    maxWidth: '100%',
    minHeight: 54,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  resultText: {
    color: '#16A34A',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 23,
  },

  detectionTitle: {
    color: 'red',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  detectionInfo: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },

  detectionText: {
    color: 'black',
    fontSize: 13,
    fontWeight: '500',
  },

  dotSeparator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 9,
    backgroundColor: '#9CA3AF',
  },

  stateContainer: {
    position: 'absolute',
    bottom: 158,
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  state: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 2,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },

  stateDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 8,
  },

  stateText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  bottomMenu: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },

  menuRow: {
    flex: 1,
    flexDirection: 'row',
  },

  menuButton: {
    flex: 1,
    borderWidth: 0.7,
    borderColor: '#D1D5DB',
    backgroundColor: 'rgba(255,255,255,0.96)',
  },

  menuContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  menuButtonActive: {
    backgroundColor: 'rgba(220,252,231,0.95)',
    borderColor: '#16A34A',
    borderWidth: 2,
  },

  menuButtonObstacleActive: {
    backgroundColor: 'rgba(220,252,231,0.95)',
    borderColor: '#16A34A',
    borderWidth: 2,
  },

  menuButtonDisabled: {
    opacity: 0.35,
  },

  menuText: {
    marginLeft: 9,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },

  menuTextActive: {
    marginLeft: 9,
    fontSize: 16,
    fontWeight: '800',
    color: '#16A34A',
  },

  menuTextDisabled: {
    color: '#9CA3AF',
  },

  micWrapper: {
    position: 'absolute',
    bottom: 30,
    left: '50%',
    marginLeft: -45,
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    backgroundColor: 'white',
    padding: 4,
    zIndex: 30,
    elevation: 10,
  },

  micButton: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: 'white',
    overflow: 'hidden',
  },

  micPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

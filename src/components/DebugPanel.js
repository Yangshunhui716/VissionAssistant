import { memo, useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import {
  Modal,
  Portal,
  Text,
  TextInput,
  Switch,
  Button,
  Divider,
} from 'react-native-paper';
import { useRuntimeConfig } from '../context/RuntimeConfigContext';

const EditableRow = ({ title, value, onChange }) => {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = () => {
    const number = Number(text);

    if (Number.isFinite(number)) {
      onChange(number);
    }
  };

  return (
    <View style={styles.row}>
      <Text variant="bodyMedium" style={styles.label}>
        {title}
      </Text>

      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={commit}
        keyboardType="numeric"
        mode="outlined"
        dense
        style={styles.input}
        textColor="white"
        outlineColor="#4B5563"
        activeOutlineColor="#60A5FA"
      />
    </View>
  );
};

const ToggleRow = ({ title, value, onChange }) => {
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium" style={styles.label}>
        {title}
      </Text>

      <Switch value={value} onValueChange={onChange} />
    </View>
  );
};

/**
 * @param {{
 *   visible: boolean,
 *   onClose: () => void
 * }} props
 */
const DebugPanelComponent = ({ visible, onClose }) => {
  const { config, updateSection, resetConfig } = useRuntimeConfig();

  if (!config) return null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={styles.modal}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text variant="titleLarge" style={styles.title}>
              Debug & Cài đặt
            </Text>

            <Button mode="text" onPress={onClose} textColor="white" compact>
              Đóng
            </Button>
          </View>

          <Divider />

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text variant="titleMedium" style={styles.section}>
              Debug
            </Text>

            <ToggleRow
              title="Hiển thị Debug"
              value={config.debug.enabled}
              onChange={value =>
                updateSection('debug', {
                  enabled: value,
                })
              }
            />

            <ToggleRow
              title="Hiển thị log"
              value={config.debug.logging}
              onChange={value =>
                updateSection('debug', {
                  logging: value,
                })
              }
            />

            <ToggleRow
              title="Hiển thị quality frame"
              value={config.debug.qualityFrame}
              onChange={value =>
                updateSection('debug', {
                  qualityFrame: value,
                })
              }
            />

            <ToggleRow
              title="Hiển thị debug image"
              value={config.debug.showImage}
              onChange={value =>
                updateSection('debug', {
                  showImage: value,
                })
              }
            />

            <ToggleRow
              title="Hiển thị FPS"
              value={config.debug.showFps}
              onChange={value =>
                updateSection('debug', {
                  showFps: value,
                })
              }
            />

            <ToggleRow
              title="Hiển thị object"
              value={config.debug.showObjects}
              onChange={value =>
                updateSection('debug', {
                  showObjects: value,
                })
              }
            />

            <Text variant="titleMedium" style={styles.section}>
              Vision
            </Text>

            {Object.entries(config.vision).map(([key, value]) => (
              <EditableRow
                key={key}
                title={key}
                value={value}
                onChange={newValue =>
                  updateSection('vision', {
                    [key]: newValue,
                  })
                }
              />
            ))}

            <Text variant="titleMedium" style={styles.section}>
              Frame Quality
            </Text>

            {Object.entries(config.frameQuality).map(([key, value]) => (
              <EditableRow
                key={key}
                title={key}
                value={value}
                onChange={newValue =>
                  updateSection('frameQuality', {
                    [key]: newValue,
                  })
                }
              />
            ))}

            <Text variant="titleMedium" style={styles.section}>
              YOLO
            </Text>

            {Object.entries(config.yolo).map(([key, value]) => (
              <EditableRow
                key={key}
                title={key}
                value={value}
                onChange={newValue =>
                  updateSection('yolo', {
                    [key]: newValue,
                  })
                }
              />
            ))}

            <Text variant="titleMedium" style={styles.section}>
              General Scan
            </Text>

            {Object.entries(config.generalScan)
              .filter(([, value]) => typeof value === 'number')
              .map(([key, value]) => (
                <EditableRow
                  key={key}
                  title={key}
                  value={value}
                  onChange={newValue =>
                    updateSection('generalScan', {
                      [key]: newValue,
                    })
                  }
                />
              ))}

            <Text variant="titleMedium" style={styles.section}>
              Search
            </Text>

            {Object.entries(config.search).map(([key, value]) => (
              <EditableRow
                key={key}
                title={key}
                value={value}
                onChange={newValue =>
                  updateSection('search', {
                    [key]: newValue,
                  })
                }
              />
            ))}

            <Text variant="titleMedium" style={styles.section}>
              Currency
            </Text>

            {Object.entries(config.currency).map(([key, value]) => (
              <EditableRow
                key={key}
                title={key}
                value={value}
                onChange={newValue =>
                  updateSection('currency', {
                    [key]: newValue,
                  })
                }
              />
            ))}

            <Text variant="titleMedium" style={styles.section}>
              Obstacle
            </Text>

            {Object.entries(config.obstacle)
              .filter(([, value]) => typeof value === 'number')
              .map(([key, value]) => (
                <EditableRow
                  key={key}
                  title={key}
                  value={value}
                  onChange={newValue =>
                    updateSection('obstacle', {
                      [key]: newValue,
                    })
                  }
                />
              ))}

            <Text variant="titleMedium" style={styles.section}>
              Spatial
            </Text>

            {Object.entries(config.spatial).map(([key, value]) => (
              <EditableRow
                key={key}
                title={key}
                value={value}
                onChange={newValue =>
                  updateSection('spatial', {
                    [key]: newValue,
                  })
                }
              />
            ))}

            <Text variant="titleMedium" style={styles.section}>
              Motion
            </Text>

            {Object.entries(config.motion).map(([key, value]) => (
              <EditableRow
                key={key}
                title={key}
                value={value}
                onChange={newValue =>
                  updateSection('motion', {
                    [key]: newValue,
                  })
                }
              />
            ))}

            <Text variant="titleMedium" style={styles.section}>
              Voice
            </Text>

            {Object.entries(config.voice).map(([key, value]) => (
              <EditableRow
                key={key}
                title={key}
                value={value}
                onChange={newValue =>
                  updateSection('voice', {
                    [key]: newValue,
                  })
                }
              />
            ))}

            <Text variant="titleMedium" style={styles.section}>
              Intent
            </Text>

            {Object.entries(config.intent)
              .filter(([, value]) => typeof value === 'number')
              .map(([key, value]) => (
                <EditableRow
                  key={key}
                  title={key}
                  value={value}
                  onChange={newValue =>
                    updateSection('intent', {
                      [key]: newValue,
                    })
                  }
                />
              ))}

            <Text variant="titleMedium" style={styles.section}>
              Feedback
            </Text>

            {Object.entries(config.feedback)
              .filter(([, value]) => typeof value === 'number')
              .map(([key, value]) => (
                <EditableRow
                  key={key}
                  title={key}
                  value={value}
                  onChange={newValue =>
                    updateSection('feedback', {
                      [key]: newValue,
                    })
                  }
                />
              ))}

            <Button
              mode="contained"
              onPress={resetConfig}
              buttonColor="#DC2626"
              textColor="white"
              style={styles.resetButton}
            >
              Khôi phục mặc định
            </Button>
          </ScrollView>
        </View>
      </Modal>
    </Portal>
  );
};

export const DebugPanel = memo(DebugPanelComponent);

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    margin: 16,
  },

  container: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
  },

  title: {
    color: 'white',
    fontWeight: '700',
  },

  content: {
    padding: 16,
    paddingBottom: 50,
  },

  section: {
    color: '#60A5FA',
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },

  label: {
    flex: 1,
    color: 'white',
    marginRight: 10,
  },

  input: {
    width: 110,
    backgroundColor: '#1F2937',
  },

  resetButton: {
    marginTop: 30,
    marginBottom: 10,
    borderRadius: 8,
  },
});

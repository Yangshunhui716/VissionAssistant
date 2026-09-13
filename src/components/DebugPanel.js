import { memo, useEffect, useState } from 'react';

import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';

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
      <Text style={styles.label}>{title}</Text>

      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={commit}
        keyboardType="numeric"
        style={styles.input}
      />
    </View>
  );
};

const ToggleRow = ({ title, value, onChange }) => {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{title}</Text>

      <Pressable
        onPress={() => onChange(!value)}
        style={[styles.toggle, value && styles.toggleActive]}
      >
        <Text style={styles.toggleText}>{value ? 'BẬT' : 'TẮT'}</Text>
      </Pressable>
    </View>
  );
};

/** @type {React.FC<any>} */
export const DebugPanel = memo(({ visible, onClose }) => {
  const { config, updateSection, resetConfig } = useRuntimeConfig();

  if (!config) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Debug & Cài đặt</Text>

          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Đóng</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.section}>Debug</Text>

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

          <Text style={styles.section}>Vision</Text>

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

          <Text style={styles.section}>Frame Quality</Text>

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

          <Text style={styles.section}>YOLO</Text>

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

          <Text style={styles.section}>General Scan</Text>

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

          <Text style={styles.section}>Search</Text>

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

          <Text style={styles.section}>Currency</Text>

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

          <Text style={styles.section}>Obstacle</Text>

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

          <Text style={styles.section}>Spatial</Text>

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

          <Text style={styles.section}>Motion</Text>

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

          <Text style={styles.section}>Voice</Text>

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

          <Text style={styles.section}>Intent</Text>

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

          <Text style={styles.section}>Feedback</Text>

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

          <Pressable onPress={resetConfig} style={styles.resetButton}>
            <Text style={styles.resetText}>Khôi phục mặc định</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },

  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },

  closeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#374151',
    borderRadius: 8,
  },

  closeText: {
    color: 'white',
  },

  content: {
    padding: 16,
    paddingBottom: 50,
  },

  section: {
    color: '#60A5FA',
    fontSize: 18,
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
    fontSize: 14,
    marginRight: 10,
  },

  input: {
    width: 110,
    height: 40,
    color: 'white',
    backgroundColor: '#1F2937',
    borderRadius: 6,
    paddingHorizontal: 10,
    textAlign: 'right',
  },

  toggle: {
    width: 70,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#374151',
  },

  toggleActive: {
    backgroundColor: '#16A34A',
  },

  toggleText: {
    color: 'white',
    fontWeight: '700',
  },

  resetButton: {
    marginTop: 30,
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },

  resetText: {
    color: 'white',
    fontWeight: '700',
  },
});

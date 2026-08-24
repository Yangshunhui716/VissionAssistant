import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const UIOverlay = ({ fps, objectList, detectedObj, appState, transcript }) => {
  return (
    <>
      {fps ? 
        <View style={styles.fpsOverlay}>
          <Text style={styles.fpsText}>FPS: {fps}</Text>
        </View>:<></>
      }  
      <View style={styles.alertBox}>
        <Text style={styles.alertTitle}>PHÁT HIỆN: {detectedObj.name.toUpperCase()}</Text>
        <Text style={styles.alertDepth}>Chỉ số: {detectedObj.depth}</Text>
        <Text style={styles.alertDepth}>Trạng thái: {detectedObj.motion}</Text>
      </View>

      <View style={styles.debugList}>
        {objectList.map((name, index) => (
          <Text key={index} style={styles.debugText}>{name}</Text>
        ))}
      </View>

      <View style={[
        styles.transcriptBox, 
        appState === 'SLEEP' ? { borderColor: 'gray' } : 
        appState === 'LISTENING' ? { borderColor: '#00FF00' } : 
        { borderColor: 'yellow' }
      ]}>
        <Text style={styles.transcriptText}>{transcript}</Text>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  fpsOverlay: { 
    position: 'absolute', top: 60, left: 20, 
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  fpsText: { color: '#00FF00', fontSize: 18, fontWeight: 'bold' },
  alertBox: { 
    position: 'absolute', bottom: 150, alignSelf: 'center', 
    backgroundColor: 'rgba(255,0,0,0.85)', padding: 15, borderRadius: 12, alignItems: 'center',
  },
  alertTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  alertDepth: { color: 'yellow', fontSize: 24, fontWeight: '900' },
  debugList: { position: 'absolute', top: 100, right: 20 },
  debugText: { color: 'yellow', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.5)' },
  transcriptBox: {
    position: "absolute", left: 20, right: 20, bottom: 50, 
    backgroundColor: "rgba(0,0,0,0.9)", padding: 15, borderRadius: 15, alignItems: 'center',
    borderWidth: 3
  },
  transcriptText: { color: "white", fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
});
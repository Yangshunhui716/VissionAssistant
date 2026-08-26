import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

export const StatusScreen = ({ message, isLoading = false }) => {
  return (
    <View style={styles.center}>
      {isLoading && <ActivityIndicator size="large" color="#0000ff" />}
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  text: {
    fontSize: 16,
    color: 'black',
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
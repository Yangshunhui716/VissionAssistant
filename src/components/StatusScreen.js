import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

export const StatusScreen = ({ message, isLoading = false }) => {
  return (
    <View style={styles.center}>
      {isLoading && (
        <ActivityIndicator size="large" animating color="#0000ff" />
      )}

      <Text variant="bodyLarge" style={styles.text}>
        {message}
      </Text>
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
    color: 'black',
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
// @ts-ignore
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// @ts-ignore
import { SafeAreaProvider } from 'react-native-safe-area-context';
// @ts-ignore
import { NavigationContainer } from '@react-navigation/native';
// @ts-ignore
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';

const ThemedStatusBar: React.FC = () => {
  const { mode, colors } = useTheme();
  return (
    <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
  );
};

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <NavigationContainer>
              <ThemedStatusBar />
              <AppNavigator />
            </NavigationContainer>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;

// @ts-ignore
import React from 'react';
// @ts-ignore
import { View, ActivityIndicator, StyleSheet } from 'react-native';
// @ts-ignore
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// @ts-ignore
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from './types';
import { GradientHeaderBackground } from '../components/GradientHeaderBackground';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { GroupDetailScreen } from '../screens/groups/GroupDetailScreen';
import { BalanceDetailScreen } from '../screens/groups/BalanceDetailScreen';
import { CreateGroupScreen } from '../screens/groups/CreateGroupScreen';
import { AddMemberScreen } from '../screens/groups/AddMemberScreen';
import { GroupSettlementsScreen } from '../screens/groups/GroupSettlementsScreen';
import { GroupExpensesScreen } from '../screens/groups/GroupExpensesScreen';
import { AddExpenseScreen } from '../screens/expenses/AddExpenseScreen';
import { CreateUserScreen } from '../screens/admin/CreateUserScreen';
import { ExportScreen } from '../screens/reports/ExportScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { GroupHeaderActions } from '../components/GroupHeaderActions';

const Stack = createNativeStackNavigator<RootStackParamList>();

const HeaderBackground = () => <GradientHeaderBackground />;

export const AppNavigator: React.FC = () => {
  const { isLoggedIn, initializing } = useAuth();
  const { colors } = useTheme();

  if (initializing) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerBackground: HeaderBackground,
        headerTintColor: colors.onPrimary,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      {!isLoggedIn ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="GroupDetails"
            component={GroupDetailScreen}
            options={({ route, navigation }: any) => ({
              title: route.params?.groupName || 'Group',
              headerRight: () => (
                <GroupHeaderActions
                  color={colors.onPrimary}
                  onPressSettlements={() =>
                    navigation.navigate('GroupSettlements', {
                      groupId: route.params.groupId,
                      groupName: route.params?.groupName,
                    })
                  }
                  onPressExpenses={() =>
                    navigation.navigate('GroupExpenses', {
                      groupId: route.params.groupId,
                      groupName: route.params?.groupName,
                    })
                  }
                  onPressExport={() =>
                    navigation.navigate('ExportReport', {
                      groupId: route.params.groupId,
                      groupName: route.params?.groupName,
                    })
                  }
                />
              ),
            })}
          />
          <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add Expense' }} />
          <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ title: 'Create Group' }} />
          <Stack.Screen name="CreateUser" component={CreateUserScreen} options={{ title: 'Create User' }} />
          <Stack.Screen name="AddMember" component={AddMemberScreen} options={{ title: 'Manage Members' }} />
          <Stack.Screen
            name="GroupSettlements"
            component={GroupSettlementsScreen}
            options={({ route }: any) => ({ title: `${route.params?.groupName || 'Group'} · Settlements` })}
          />
          <Stack.Screen
            name="GroupExpenses"
            component={GroupExpensesScreen}
            options={({ route }: any) => ({ title: `${route.params?.groupName || 'Group'} · Expenses` })}
          />
          <Stack.Screen name="ExportReport" component={ExportScreen} options={{ title: 'Export Report' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
          <Stack.Screen name="BalanceDetail" component={BalanceDetailScreen} options={{ title: 'Balance Detail' }} />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

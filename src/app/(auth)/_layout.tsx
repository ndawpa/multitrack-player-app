import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="login/index"
        options={{
          title: 'Login',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="register/index"
        options={{
          title: 'Register',
          headerShown: false,
        }}
      />
    </Stack>
  );
} 
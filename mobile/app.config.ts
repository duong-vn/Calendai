import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const iosUrlScheme = iosClientId?.endsWith('.apps.googleusercontent.com')
    ? `com.googleusercontent.apps.${iosClientId.slice(0, -'.apps.googleusercontent.com'.length)}`
    : undefined;
  if (process.env.EAS_BUILD_PLATFORM === 'ios' && !iosUrlScheme) {
    throw new Error('iOS build requires EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (public OAuth iOS client ID).');
  }
  return {
    ...config,
    name: 'Calendai', slug: 'calendai-mobile',
    plugins: [
      ...(config.plugins || []),
      'expo-secure-store',
      'expo-font',
      ...(iosUrlScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme }] as [string, { iosUrlScheme: string }]] : []),
      ['expo-speech-recognition', {
        microphonePermission: 'Cho phép Calendai dùng mic khi bạn bấm nhập bằng giọng nói.',
        speechRecognitionPermission: 'Cho phép chuyển lời nói tiếng Việt thành bản nháp tin nhắn.',
        androidSpeechServicePackages: ['com.google.android.googlequicksearchbox', 'com.google.android.tts'],
      }],
    ],
  };
};

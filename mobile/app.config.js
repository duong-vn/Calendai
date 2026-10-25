/** @param {import('expo/config').ConfigContext} context */
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD === 'true') {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId?.endsWith('.apps.googleusercontent.com')) {
      throw new Error('Thiếu EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID cho bản build. Cấu hình OAuth Web client ID trong EAS environment.');
    }
    const origin = new URL(process.env.EXPO_PUBLIC_API_URL || 'https://calendai.tduong.online');
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
      throw new Error('EXPO_PUBLIC_API_URL phải là HTTPS origin hợp lệ, không có đường dẫn hoặc thông tin đăng nhập.');
    }
  }
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
      ...(iosUrlScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme }]] : []),
      ['expo-speech-recognition', {
        microphonePermission: 'Cho phép Calendai dùng mic khi bạn bấm nhập bằng giọng nói.',
        speechRecognitionPermission: 'Cho phép chuyển lời nói tiếng Việt thành bản nháp tin nhắn.',
        androidSpeechServicePackages: ['com.google.android.googlequicksearchbox', 'com.google.android.tts'],
      }],
    ],
  };
};

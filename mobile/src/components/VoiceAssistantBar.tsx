import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

interface VoiceAssistantBarProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
}

const QUICK_CHIPS = [
  'Họp nhóm 10h sáng mai có Meet',
  'Gặp đối tác 14h thứ 6',
  'Xem các cuộc họp sắp tới',
];

export function VoiceAssistantBar({
  onSendMessage,
  isLoading,
}: VoiceAssistantBarProps) {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);

  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleChipPress = (chip: string) => {
    onSendMessage(chip);
  };

  const handleToggleVoice = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    // Toggle listening state
    setIsListening(true);

    // Mock voice transcription delay for demo if native voice engine isn't mounted yet
    setTimeout(() => {
      setIsListening(false);
      setInputText('Họp khẩn cấp dự án chiều nay lúc 15h');
    }, 2500);
  };

  return (
    <View style={styles.container}>
      {/* Quick Prompts Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
      >
        {QUICK_CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip}
            activeOpacity={0.7}
            onPress={() => handleChipPress(chip)}
            style={styles.chip}
          >
            <Text style={styles.chipText}>⚡ {chip}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input Row */}
      <View style={styles.inputRow}>
        {/* Voice Mic Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleToggleVoice}
          style={[
            styles.micButton,
            isListening && styles.micButtonListening,
          ]}
        >
          <Text style={styles.micIcon}>{isListening ? '🔴' : '🎙️'}</Text>
        </TouchableOpacity>

        {/* Text Input */}
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder={
            isListening
              ? 'Đang lắng nghe tiếng Việt...'
              : 'Nói hoặc nhập yêu cầu đặt lịch...'
          }
          placeholderTextColor="#71717a"
          style={styles.input}
          editable={!isLoading}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />

        {/* Send Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSend}
          disabled={isLoading || !inputText.trim()}
          style={[
            styles.sendButton,
            (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#09090b" />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#18181b',
    borderTopWidth: 1.5,
    borderTopColor: '#27272a',
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 12,
  },
  chipsScroll: {
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    backgroundColor: '#27272a',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  chipText: {
    color: '#d4d4d8',
    fontSize: 11,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090b',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#3f3f46',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 8,
  },
  micButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonListening: {
    backgroundColor: '#7f1d1d',
    borderWidth: 1.5,
    borderColor: '#ef4444',
  },
  micIcon: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    color: '#f4f4f5',
    fontSize: 13,
    paddingVertical: 6,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eab308',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    color: '#09090b',
    fontSize: 15,
    fontWeight: '800',
  },
});

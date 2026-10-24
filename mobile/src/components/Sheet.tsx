import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Copy, IconButton, useTheme } from '../theme';

export function Sheet({ title, visible, onClose, children }: { title: string; visible: boolean; onClose: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 2, borderColor: colors.border, padding: 12 }}><Copy strong accessibilityRole="header" style={{ fontSize: 19, flex: 1 }}>{title}</Copy><IconButton icon={X} label="Đóng" onPress={onClose} /></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>{children}</ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}

import React, { createContext, useContext } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, type TextProps, type ViewProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

export const palettes = {
  light: { bg: '#f5eee1', ink: '#2b1f17', accent: '#c25e2e', brass: '#9b641b', teal: '#1f7560', surface: '#fffaf2', raised: '#ede4d5', border: '#2d2015', muted: '#786455', user: '#e8d5c4', danger: '#a63024' },
  dark: { bg: '#14110f', ink: '#f5ebd9', accent: '#e07a3f', brass: '#fbbf24', teal: '#2dd4bf', surface: '#211a14', raised: '#2a221b', border: '#453427', muted: '#ba9f88', user: '#3d2719', danger: '#f87171' },
};
export type Palette = typeof palettes.light;
export const ThemeContext = createContext<{ colors: Palette; dark: boolean; fonts: boolean }>({ colors: palettes.light, dark: false, fonts: false });
export const useTheme = () => useContext(ThemeContext);

export function Copy({ style, ...props }: TextProps & { strong?: boolean }) {
  const { colors, fonts } = useTheme();
  const { strong, ...rest } = props;
  return <Text {...rest} style={[{ color: colors.ink, fontSize: 14, lineHeight: 22, fontFamily: fonts ? strong ? 'JakartaBold' : 'Jakarta' : undefined, fontWeight: strong ? '700' : '400' }, style]} />;
}
export function Panel({ style, ...props }: ViewProps) {
  const { colors } = useTheme();
  return <View {...props} style={[{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 2, borderRadius: 16, padding: 16, shadowColor: colors.border, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0 }, style]} />;
}
interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  primary?: boolean;
  compact?: boolean;
  accessibilityLabel?: string;
}
export function Action({ label, onPress, icon: Icon, disabled, primary, compact, accessibilityLabel }: ButtonProps) {
  const { colors, dark } = useTheme();
  const color = primary ? dark ? colors.bg : '#ffffff' : colors.ink;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 46, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: compact ? 10 : 16, paddingVertical: 10, borderWidth: 2, borderColor: colors.border, borderRadius: 14, backgroundColor: primary ? colors.accent : colors.raised, opacity: disabled ? 0.5 : 1 }}>
    {Icon && <Icon size={18} color={color} />}
    <Copy strong style={{ color, fontSize: compact ? 12 : 13, flexShrink: 1 }}>{label}</Copy>
  </TouchableOpacity>;
}
export function IconButton({ icon: Icon, label, onPress, disabled }: { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={{ minWidth: 46, minHeight: 46, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}><Icon size={22} color={colors.accent} /></TouchableOpacity>;
}
export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });
export const layout = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, stack: { gap: 12 }, fill: { flex: 1 }, section: { padding: 20, gap: 16 } });
